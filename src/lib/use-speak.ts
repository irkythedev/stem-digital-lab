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

export type SpeakState = 'idle' | 'synthesizing' | 'playing' | 'paused' | 'error';

/** 朗读前清洗：去掉 KaTeX 公式、markdown 符号 */
export function cleanTextForTTS(text: string): string {
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, ' 公式省略。')
    .replace(/\$[^$\n]*?\$/g, ' 公式省略。')
    .replace(/```[\s\S]*?```/g, ' 代码省略。')
    .replace(/`[^`\n]*`/g, '')
    .replace(/[#>*_~|]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
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
  /** 当前段播完后的回调（接下一段或结束） */
  const onNaturalEndRef = useRef<(() => void) | null>(null);

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

  /** 停止（归零）：清队列，下次从头播 */
  const stop = useCallback(() => {
    wasStoppedRef.current = true;
    onNaturalEndRef.current = null;
    stopSource();
    elapsedRef.current = 0;
    audioBufferRef.current = null;
    segsRef.current = [];
    idxRef.current = 0;
    setState('idle');
  }, [stopSource]);

  useEffect(() => () => stop(), [stop]);

  /** 合成一段文本并播放；播完自动接下一段 */
  const playSegment = useCallback(
    async (seg: string) => {
      setState('synthesizing');
      try {
        const url = getTtsUrl();
        // 冷启动容错：失败自动重试一次
        const doFetch = async (attempt: number): Promise<Response> => {
          try {
            const resp = await fetch(
              `${url}?text=${encodeURIComponent(seg)}&voice=${encodeURIComponent(TTS_CONFIG.DEFAULT_VOICE)}`,
            );
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
        audioBufferRef.current = await ctx.decodeAudioData(audioBytes);
        elapsedRef.current = 0;
        startSource(0);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    },
    [startSource],
  );

  /** 当前段自然播完：接下一段或结束 */
  const onSegmentEnd = useCallback(() => {
    const nextIdx = idxRef.current + 1;
    if (nextIdx < segsRef.current.length) {
      idxRef.current = nextIdx;
      void playSegment(segsRef.current[nextIdx]);
    } else {
      // 全部播完
      segsRef.current = [];
      idxRef.current = 0;
      audioBufferRef.current = null;
      setState('idle');
    }
  }, [playSegment]);

  onNaturalEndRef.current = onSegmentEnd;

  const speak = useCallback(
    async (rawText: string, voice?: string) => {
      unlockAudio();
      stop();

      const text = cleanTextForTTS(rawText);
      if (!text) return;

      const segs = splitForTTS(text);
      if (segs.length === 0) return;
      segsRef.current = segs;
      idxRef.current = 0;
      void playSegment(segs[0]);
    },
    [unlockAudio, stop, playSegment],
  );

  return { state, errorMsg, speak, pause, resume, stop };
}