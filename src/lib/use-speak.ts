/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * TTS 朗读 hook：文本 → 腾讯云 SCF（edge-tts 代理）→ MP3 播放。
 * 长文本自动分句（每段 ≤800 字，云函数单次上限 1000），逐段合成、播放完自动接下一段。
 * 状态机：idle → synthesizing → playing ↔ paused → playing → ... → idle。
 * Web Audio API 播放（点击时同步解锁自动播放策略）；暂停/继续记录断点。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getTtsUrl, TTS_CONFIG } from './tts-config';
import { latexToSpeech, PHYS_UNIT_ZH, PHYS_UNIT_KEYS_SORTED, type SpeechMode } from './latex-speech';
import { scfUrlWithToken } from './scf-token';

export type SpeakState = 'idle' | 'synthesizing' | 'playing' | 'paused' | 'finished' | 'error';

/**
 * 重播缓存的 PCM 字节上限：48kHz 单声道 16bit ≈ 5.8MB/分钟，32MB ≈ 5.5 分钟朗读量。
 * 超限后新合成的段不再缓存（照常播放），重播时未缓存段回退为重新合成——
 * 防止超长回答（错题归纳等）把解码后 PCM 无限堆在页面内存里。
 */
const REPLAY_CACHE_MAX_BYTES = 32 * 1024 * 1024;

/** 朗读公式的口径选项：physics 模式 + 逐公式量名表（多义符号按公式消歧） */
export interface SpeechOpts {
  mode?: SpeechMode;
  symbols?: Record<string, string>;
}

/** 朗读前清洗：把 LaTeX 公式（\(...\) / \[...\] / $...$ / $$...$$）转成口语，去掉 markdown 符号 */
export function cleanTextForTTS(text: string, lang: 'zh' | 'en' = 'zh', opts?: SpeechOpts): string {
  const mode = opts?.mode ?? 'math';
  const symbols = opts?.symbols;
  // 先保护代码块与行内代码，再处理公式，避免公式转口语时污染代码
  const codeBlocks: string[] = [];
  let protectedText = text.replace(/```[\s\S]*?```/g, (m) => {
    codeBlocks.push(m);
    return `\u0000CODE${codeBlocks.length - 1}\u0000`;
  });

  // LaTeX 公式（块级 $$..$$ / \[..\] 优先，再行内 $..$ / \(..\)）
  // 注意顺序：先长后短，避免 $$ 里的 $ 被行内先吃掉
  const formulas: string[] = [];
  protectedText = protectedText
    .replace(/\$\$[\s\S]*?\$\$/g, (m) => {
      formulas.push(latexToSpeech(m.slice(2, -2), lang, mode, symbols));
      return `\u0000F${formulas.length - 1}\u0000`;
    })
    .replace(/\\\[[\s\S]*?\\\]/g, (m) => {
      formulas.push(latexToSpeech(m.slice(2, -2), lang, mode, symbols));
      return `\u0000F${formulas.length - 1}\u0000`;
    })
    .replace(/\$[^$\n]*?\$/g, (m) => {
      formulas.push(latexToSpeech(m.slice(1, -1), lang, mode, symbols));
      return `\u0000F${formulas.length - 1}\u0000`;
    })
    .replace(/\\\([\s\S]*?\\\)/g, (m) => {
      formulas.push(latexToSpeech(m.slice(2, -2), lang, mode, symbols));
      return `\u0000F${formulas.length - 1}\u0000`;
    });

  // 还原公式口语
  protectedText = protectedText.replace(/\u0000F(\d+)\u0000/g, (_, idx) => formulas[Number(idx)]);

  // 物理模式（中文）：散文里的「数字+单位」转中文读法（220V → 220 伏特、0.5A → 0.5 安培）。
  // 只认表内单位且必须前邻数字，「4G 网络」「1080p」等不在表内不受影响；
  // 公式已在上面转好（输出为中文单位名），此处不会二次触碰。
  if (mode === 'physics' && lang === 'zh') {
    const unitAlt = PHYS_UNIT_KEYS_SORTED.map((u) => u.replace(/[·\\]/g, '\\$&')).join('|');
    protectedText = protectedText.replace(
      new RegExp(`(\\d)\\s*(${unitAlt})(?![A-Za-z])`, 'g'),
      (_, d, u) => `${d} ${PHYS_UNIT_ZH[u] ?? u}`,
    );
  }

  // 清理 markdown：行内代码保留内容（去掉反引号），避免 AI 回答里的英文术语（`API` 等）被整段删除
  let out = protectedText
    .replace(/`([^`\n]*)`/g, '$1')
    .replace(/[#>*_~|]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  // 还原代码块（原样读出，不删公式占位）
  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_, idx) => codeBlocks[Number(idx)]);
  return out;
}

/** 按句末标点分句，每段 ≤ MAX_SEG；无标点的长句硬切 */
export function splitForTTS(text: string, maxSeg = 800): string[] {
  const segs: string[] = [];
  let cur = '';
  for (const part of text.split(/(?<=[。！？!?；;])/)) {
    const p = part.trim();
    if (!p) continue;
    if (p.length > maxSeg) {
      // 超长无断点：硬切
      for (let i = 0; i < p.length; i += maxSeg) segs.push(p.slice(i, i + maxSeg));
      continue;
    }
    if ((cur + p).length > maxSeg) {
      if (cur) segs.push(cur);
      cur = p;
    } else {
      cur += p;
    }
  }
  if (cur) segs.push(cur);
  return segs;
}

export function useSpeak() {
  const [state, setState] = useState<SpeakState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  /** 合成等待秒数（内部计时，仅用于"等待太久"的视觉提示，不显示数字） */
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  /** 暂停时记录的已播时长（秒） */
  const elapsedRef = useRef(0);
  /** 播放开始时的 ctx.currentTime */
  const startTimeRef = useRef(0);
  /** 有意停止标记：pause/stop 置 true，新播放置 false */
  const wasStoppedRef = useRef(false);
  /** 分句队列与当前索引 */
  const segsRef = useRef<string[]>([]);
  const idxRef = useRef(0);
  /** 各段已解码音频缓存（与 segsRef 同索引）：播完后重播直接复用，不再重新合成 */
  const bufferCacheRef = useRef<(AudioBuffer | null)[]>([]);
  /** 缓存累计 PCM 字节数（上限见 REPLAY_CACHE_MAX_BYTES） */
  const cacheBytesRef = useRef(0);
  /** 当前段播完后的回调（接下一段或结束） */
  const onNaturalEndRef = useRef<(() => void) | null>(null);
  /** 当前朗读语音（speak 时设置；分段串行播放时贯通使用，避免每段都走默认中文） */
  const voiceRef = useRef<string>(TTS_CONFIG.DEFAULT_VOICE);
  /** 最近一次朗读的原始文本（finished 态下仅该文本的条目显示重播） */
  const rawTextRef = useRef('');
  const [finishedText, setFinishedText] = useState('');

  const unlockAudio = useCallback(() => {
    try {
      if (!ctxRef.current) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) throw new Error('Web Audio not supported');
        ctxRef.current = new Ctx();
      }
      if (ctxRef.current.state === 'suspended') {
        void ctxRef.current.resume();
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  }, []);

  /** 创建并播放一个 BufferSource（从 offset 秒开始） */
  const startSource = useCallback((offset = 0) => {
    const ctx = ctxRef.current;
    const buf = audioBufferRef.current;
    if (!ctx || !buf) return;
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.connect(ctx.destination);
    sourceRef.current = source;
    startTimeRef.current = ctx.currentTime - offset;
    wasStoppedRef.current = false;
    source.onended = () => {
      sourceRef.current = null;
      if (!wasStoppedRef.current) {
        // 自然播放完 → 接下一段或结束
        onNaturalEndRef.current?.();
      }
    };
    source.start(0, offset);
    setState('playing');
  }, []);

  const stopSource = useCallback(() => {
    try {
      sourceRef.current?.stop();
    } catch {
      /* 未启动的 source stop 抛错，忽略 */
    }
    sourceRef.current = null;
  }, []);

  /** 暂停：记录已播时长，停止当前 source */
  const pause = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || !sourceRef.current) return;
    const elapsed = ctx.currentTime - startTimeRef.current;
    elapsedRef.current = elapsed;
    wasStoppedRef.current = true;
    stopSource();
    setState('paused');
  }, [stopSource]);

  /** 继续：从暂停位置重播当前段 */
  const resume = useCallback(() => {
    if (elapsedRef.current <= 0) return;
    startSource(elapsedRef.current);
    elapsedRef.current = 0;
  }, [startSource]);

  /** 停止（归零）：清队列与缓存，下次从头合成 */
  const stop = useCallback(() => {
    wasStoppedRef.current = true;
    onNaturalEndRef.current = null;
    stopSource();
    elapsedRef.current = 0;
    audioBufferRef.current = null;
    segsRef.current = [];
    idxRef.current = 0;
    bufferCacheRef.current = [];
    cacheBytesRef.current = 0;
    clearTimer();
    setFinishedText('');
    setState('idle');
  }, [stopSource]);

  useEffect(() => () => stop(), [stop]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsedSec(0);
  }, []);

  const startTimer = useCallback(() => {
    setElapsedSec(0);
    timerRef.current = setInterval(() => setElapsedSec((s) => s + 0.5), 500);
  }, []);

  const waitingLong = elapsedSec > 4;

  /** 合成一段文本并播放；播完自动接下一段。命中缓存的段直接播放，不再请求合成 */
  const playSegment = useCallback(
    async (seg: string) => {
      const idx = idxRef.current;
      const cached = bufferCacheRef.current[idx];
      if (cached && ctxRef.current) {
        audioBufferRef.current = cached;
        elapsedRef.current = 0;
        startSource(0);
        return;
      }
      setState('synthesizing');
      startTimer();
      try {
        const base = getTtsUrl();
        // 先拼完整 query（text/voice），再用 scfUrlWithToken 把 token 用 & 挂上
        // （避免 base 已带 ?token= 再拼 ?text= 产生双问号 → SCF 校验失败 403）
        const url = scfUrlWithToken(`${base}?text=${encodeURIComponent(seg)}&voice=${encodeURIComponent(voiceRef.current)}`);
        // 冷启动容错：失败自动重试一次
        const doFetch = async (attempt: number): Promise<Response> => {
          try {
            const resp = await fetch(url);
            if (attempt < 1 && !resp.ok) {
              await new Promise((r) => setTimeout(r, 600));
              return doFetch(attempt + 1);
            }
            return resp;
          } catch {
            if (attempt < 1) {
              await new Promise((r) => setTimeout(r, 600));
              return doFetch(attempt + 1);
            }
            throw new Error('network failed');
          }
        };
        const resp = await doFetch(0);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        // 兼容裸 MP3 与 base64 文本两种格式
        const raw = await resp.arrayBuffer();
        const view = new Uint8Array(raw, 0, Math.min(raw.byteLength, 4));
        let audioBytes: ArrayBuffer;
        if (view.length >= 2 && (view[0] & 0xff) === 0xff && (view[1] & 0xe0) === 0xe0) {
          audioBytes = raw;
        } else {
          const text = new TextDecoder().decode(raw);
          const binary = atob(text.replace(/\s/g, ''));
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          audioBytes = bytes.buffer;
        }

        const ctx = ctxRef.current;
        if (!ctx) throw new Error('no audio context');
        const decoded = await ctx.decodeAudioData(audioBytes);
        // 缓存上限内才留存（PCM 字节 ≈ 样本数 × 声道 × 2）；超限段不缓存，重播时回退重新合成
        const pcmBytes = decoded.length * decoded.numberOfChannels * 2;
        if (cacheBytesRef.current + pcmBytes <= REPLAY_CACHE_MAX_BYTES) {
          bufferCacheRef.current[idx] = decoded;
          cacheBytesRef.current += pcmBytes;
        }
        audioBufferRef.current = decoded;
        elapsedRef.current = 0;
        clearTimer();
        startSource(0);
      } catch (e) {
        clearTimer();
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    },
    [startSource, startTimer, clearTimer],
  );

  /** 当前段自然播完：接下一段或结束 */
  const onSegmentEnd = useCallback(() => {
    const nextIdx = idxRef.current + 1;
    if (nextIdx < segsRef.current.length) {
      idxRef.current = nextIdx;
      void playSegment(segsRef.current[nextIdx]);
    } else {
      // 全部播完：进入 finished，保留 segs 与音频缓存供 replay 秒播（不重新合成）
      idxRef.current = 0;
      audioBufferRef.current = null;
      setFinishedText(rawTextRef.current);
      setState('finished');
    }
  }, [playSegment]);

  onNaturalEndRef.current = onSegmentEnd;

  /** 重新朗读：从第一段起用缓存音频秒播（命中缓存不重新合成）；缓存失效则回退重新合成 */
  const replay = useCallback(() => {
    if (segsRef.current.length === 0) return;
    unlockAudio();
    wasStoppedRef.current = false;
    idxRef.current = 0;
    void playSegment(segsRef.current[0]);
  }, [unlockAudio, playSegment]);

  const speak = useCallback(
    async (rawText: string, voice?: string, lang: 'zh' | 'en' = 'zh', opts?: SpeechOpts) => {
      unlockAudio();
      stop();
      rawTextRef.current = rawText;
      voiceRef.current = voice ?? TTS_CONFIG.DEFAULT_VOICE;

      const text = cleanTextForTTS(rawText, lang, opts);
      if (!text) return;

      const segs = splitForTTS(text);
      if (segs.length === 0) return;
      segsRef.current = segs;
      idxRef.current = 0;
      void playSegment(segs[0]);
    },
    [unlockAudio, stop, playSegment],
  );

  return { state, errorMsg, finishedText, speak, pause, resume, replay, stop, waitingLong };
}