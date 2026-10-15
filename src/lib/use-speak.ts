/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * TTS 朗读 hook（去中心化：默认端侧离线，云端为可选扩展）。
 *
 * 引擎选择（配置存 localStorage 键 stem-tts-config，见 src/lib/tts-config.ts）：
 *   ① **默认 local**：直接调用 window.speechSynthesis 朗读，不触网、不依赖任何固定服务商，
 *      断网/离线 100% 可用；
 *   ② **可选 cloud**：使用者在设置面板自填兼容 /v1/audio/speech 的端点与 Key 后，
 *      优先走该端点合成（费用与调用由使用者自理）；请求失败（网络错误/Key 失效/超限/端点非法）
 *      一律**静默回退**到端侧语音，并给一句克制轻提示，绝不把状态码当界面文案。
 *
 * 状态机：idle → synthesizing → playing ↔ paused → playing → ... → idle（云端路径按段推进）。
 * 端侧语音不支持断点续播：暂停即取消、继续时从本段开头重读。
 * 播放与取消：云端走 Web Audio（点击时同步解锁自动播放策略），端侧走 speechSynthesis；
 * 两条路径在 stop() / 组件卸载 / 重新朗读前都会取消，避免叠音。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadTtsConfig,
  isCloudTtsReady,
  normalizeSpeechEndpoint,
  preferredLocalVoice,
  voiceRank,
  isBlockedLocalVoice,
  getTtsUrl,
  getTtsVoice,
  type LocalVoice,
  type TtsConfig,
} from './tts-config';
import { setTtsStatus } from './tts-status';
import { scfUrlWithToken } from './scf-token';
import { latexToSpeech, PHYS_UNIT_ZH, PHYS_UNIT_KEYS_SORTED, type SpeechMode } from './latex-speech';

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

/** 浏览器 speechSynthesis 的最小结构：抽成接口便于在 Node 里用假宿主做降级分支测试 */
export interface LocalSpeechHost {
  speechSynthesis?: {
    speak: (u: unknown) => void;
    cancel: () => void;
    getVoices?: () => LocalVoice[];
  };
  SpeechSynthesisUtterance?: new (text: string) => {
    lang: string;
    rate?: number;
    voice?: unknown;
    onstart?: (() => void) | null;
    onend?: (() => void) | null;
    onerror?: ((e?: unknown) => void) | null;
  };
}

/** 语言 → 端侧语音标签（中文 zh-CN / 英文 en-US） */
export const localVoiceLang = (lang: 'zh' | 'en'): string => (lang === 'en' ? 'en-US' : 'zh-CN');

/**
 * 从设备语音表挑最匹配的语音：只接受同语种，绝不为「有声」硬塞一个不相干的音色；
 * 同语种内按与设置面板一致的权重排序（语言档 → 自然音色 → 玩具音色垫底），
 * 取最优；无同语种返回 null（交给浏览器按 lang 自选）。
 */
export function pickLocalVoice<T extends { name?: string; lang: string; voiceURI?: string }>(voices: T[], want: string): T | null {
  const norm = (v: string) => v.toLowerCase().replace(/_/g, '-');
  const w = norm(want);
  const base: 'zh' | 'en' = w.startsWith('en') ? 'en' : 'zh';
  const candidates = voices
    .filter((v) => !isBlockedLocalVoice(v)) // 合规：外域语音服务音色不参与优选
    .filter((v) => norm(v.lang).split('-')[0] === w.split('-')[0])
    .slice()
    .sort((a, b) => voiceRank(a, base) - voiceRank(b, base));
  return candidates[0] ?? null;
}

/**
 * 按「用户显式选择 → 语言匹配 → 无」三级解析端侧发音人。
 * 用户选择按 voiceURI 或 name 匹配（不同浏览器给的标识不同，故两者都认）。
 */
export function resolveLocalVoice(
  voices: LocalVoice[],
  preferredUri: string,
  lang: 'zh' | 'en',
): LocalVoice | null {
  const want = preferredUri.trim();
  if (want) {
    // 历史保存值可能是外域音色（合规更新前选的）：不认它，退回按语言自动挑
    const hit = voices.find((v) => !isBlockedLocalVoice(v) && (v.voiceURI === want || v.name === want));
    if (hit) return hit;
  }
  return pickLocalVoice(voices, localVoiceLang(lang));
}

/**
 * 端侧朗读：**全程不抛异常**，设备不支持（或宿主自身抛错）返回 false。
 * 调用顺序恒为 先 cancel() 再 speak()——切页 / 连点 / 云端与端侧切换都可能留下残响。
 */
export function speakLocally(
  text: string,
  lang: 'zh' | 'en',
  host: LocalSpeechHost | undefined,
  opts?: { preferredVoice?: string; onStart?: () => void; onDone?: () => void },
): boolean {
  try {
    const ss = host?.speechSynthesis;
    const Utter = host?.SpeechSynthesisUtterance;
    if (!ss || !Utter) return false;
    ss.cancel();
    const u = new Utter(text);
    u.lang = localVoiceLang(lang);
    u.rate = 0.95;
    const v = resolveLocalVoice(ss.getVoices?.() ?? [], opts?.preferredVoice ?? '', lang);
    if (v) u.voice = v;
    u.onstart = () => opts?.onStart?.();
    u.onend = () => opts?.onDone?.();
    u.onerror = () => opts?.onDone?.();
    ss.speak(u);
    return true;
  } catch {
    return false;
  }
}

/** 云端失败后回落端侧时的克制提示（不含任何状态码或异常原文） */
export const LOCAL_FALLBACK_NOTICE = '已切换为本地离线语音';

/**
 * 音频负载 → ArrayBuffer：兼容裸 MP3 与「base64 文本」两种返回
 * （自有代理 / 部分第三方端点会返回 base64，前端保持双格式兼容）。
 */
export function toAudioBytes(raw: ArrayBuffer): ArrayBuffer {
  try {
    const view = new Uint8Array(raw, 0, Math.min(raw.byteLength, 4));
    if (view.length >= 2 && (view[0] & 0xff) === 0xff && (view[1] & 0xe0) === 0xe0) return raw;
    const text = new TextDecoder().decode(raw);
    const binary = atob(text.replace(/\s/g, '').replace(/^data:audio\/[^,]+,/, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  } catch {
    return raw;
  }
}

/**
 * 向使用者自配的云端端点请求合成（POST，兼容 OpenAI /v1/audio/speech）。
 * 失败一律抛错，由调用方决定回落端侧；错误信息只用于日志，不作界面文案。
 */
/**
 * 内置云函数合成（免配置）：GET {SCF}?text=&voice=&token= → 裸 MP3 或 base64，
 * 冷启动失败自动重试一次。失败抛错（信息只用于日志），由调用方静默回退系统语音。
 */
export async function fetchScfSpeech(
  text: string,
  voice: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ArrayBuffer> {
  const base = getTtsUrl();
  // 先拼完整 query，再用 scfUrlWithToken 以 & 挂 token（避免双问号导致 SCF 校验 403）
  const url = scfUrlWithToken(`${base}?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`);
  const doFetch = async (attempt: number): Promise<Response> => {
    try {
      const resp = await fetchImpl(url);
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
  if (!resp.ok) throw new Error(`synthesis unavailable (status ${resp.status})`);
  return toAudioBytes(await resp.arrayBuffer());
}

export async function fetchCloudSpeech(
  text: string,
  cfg: TtsConfig,
  voiceHint: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ArrayBuffer> {
  const url = normalizeSpeechEndpoint(cfg.endpoint);
  if (!url) throw new Error('invalid endpoint');
  const resp = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model || 'tts-1',
      input: text,
      voice: cfg.voice || voiceHint || 'alloy',
      response_format: 'mp3',
    }),
  });
  if (!resp.ok) throw new Error(`synthesis unavailable (status ${resp.status})`);
  return toAudioBytes(await resp.arrayBuffer());
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
  const voiceRef = useRef<string>(''); // 云端音色名（speak 时由调用方给出；端侧路径不用它）
  /** 最近一次朗读的原始文本（finished 态下仅该文本的条目显示重播） */
  const rawTextRef = useRef('');
  const [finishedText, setFinishedText] = useState('');
  /** 端侧兜底模式：true = 当前朗读由设备内置语音完成（暂停语义与云端音频不同） */
  const localModeRef = useRef(false);
  /** playSegment 的前向引用（resume 声明早于它，避免 TDZ） */
  const playSegmentRef = useRef<((seg: string) => void) | null>(null);
  /** 端侧看门狗：个别设备既不触发 onstart 也不触发 onend，避免按钮卡在「合成中」 */
  const localWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 当前朗读语言与配置快照（端侧发音人按语言取） */
  const voiceLangRef = useRef<'zh' | 'en'>('zh');
  /** 降级轻提示（云端失败回落端侧时出现；正常路径为空） */
  const [notice, setNotice] = useState('');

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

  /** 暂停：记录已播时长，停止当前 source（端侧语音不支持断点续播，暂停即取消） */
  const pause = useCallback(() => {
    if (localModeRef.current) {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* 忽略 */
      }
      localModeRef.current = false;
      setState('paused');
      return;
    }
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
    if (state === 'paused' && elapsedRef.current <= 0) {
      // 端侧暂停没有断点：重走当前段（命中文档缓存则秒播）
      const seg = segsRef.current[idxRef.current];
      if (seg) void playSegmentRef.current?.(seg);
      return;
    }
    if (elapsedRef.current <= 0) return;
    startSource(elapsedRef.current);
    elapsedRef.current = 0;
  }, [startSource, state]);

  /** 停止（归零）：清队列与缓存，下次从头合成 */
  const stop = useCallback(() => {
    wasStoppedRef.current = true;
    onNaturalEndRef.current = null;
    stopSource();
    // 端侧语音同样要停：否则切页 / 重新朗读会与上一段叠音
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* 个别环境没有 speechSynthesis，忽略 */
    }
    localModeRef.current = false;
    if (localWatchdogRef.current) {
      clearTimeout(localWatchdogRef.current);
      localWatchdogRef.current = null;
    }
    setNotice('');
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

  /**
   * 端侧朗读（默认路径与云端回落的共同出口）：交给设备内置语音，接上同一套状态回调。
   * fellBack=true 时给一句克制轻提示。返回 false = 设备不支持（调用方进入错误态）。
   */
  const speakTextLocally = useCallback(
    (text: string, lang: 'zh' | 'en', fellBack: boolean): boolean => {
      const cfg = loadTtsConfig();
      const ok = speakLocally(text, lang, window as unknown as LocalSpeechHost, {
        preferredVoice: preferredLocalVoice(cfg, lang),
        onStart: () => {
          localModeRef.current = true;
          clearTimer();
          setState('playing');
        },
        onDone: () => {
          if (!localModeRef.current) return; // 已被 stop()/切页取消：不再改状态
          localModeRef.current = false;
          if (localWatchdogRef.current) clearTimeout(localWatchdogRef.current);
          clearTimer();
          setFinishedText(rawTextRef.current);
          setState('finished');
          onNaturalEndRef.current?.();
        },
      });
      if (!ok) return false;
      localModeRef.current = true;
      if (fellBack) setNotice(LOCAL_FALLBACK_NOTICE);
      startTimer();
      setState('synthesizing');
      if (localWatchdogRef.current) clearTimeout(localWatchdogRef.current);
      localWatchdogRef.current = setTimeout(() => {
        if (localModeRef.current) {
          localModeRef.current = false;
          clearTimer();
          setState('idle');
        }
      }, 8000);
      return true;
    },
    [clearTimer, startTimer],
  );

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
        const cfg = loadTtsConfig();
        // 使用自配云端端点（OpenAI 兼容 /v1/audio/speech）；失败自动重试一次
        const doFetch = async (attempt: number): Promise<ArrayBuffer> => {
          try {
            return cfg.engine === 'scf'
              ? await fetchScfSpeech(seg, voiceRef.current)
              : await fetchCloudSpeech(seg, cfg, voiceRef.current);
          } catch (err) {
            if (attempt < 1) {
              await new Promise((r) => setTimeout(r, 600));
              return doFetch(attempt + 1);
            }
            throw err;
          }
        };
        const audioBytes = await doFetch(0);
        // 状态指示器：真拿到音频才算「通道就绪」（不是发出请求就算）
        setTtsStatus('ready');

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
        // 云端不可用（断网 / Key 失效 / 超限 / 端点非法）→ 静默回落端侧语音。
        // 真实原因只进控制台：界面文案由 LOCAL_FALLBACK_NOTICE 统一给出，永不出现状态码。
        console.warn('[tts] cloud synthesis unavailable, falling back to local speech:', e);
        // 状态指示器：内置通道不可用＝平滑降级；自定义端点/Key 出问题＝连接异常
        const engineNow = loadTtsConfig().engine;
        setTtsStatus(
          engineNow === 'cloud' ? 'error' : 'fallback',
          engineNow === 'cloud'
            ? '自定义云端不可用（端点或 Key），已改用系统语音'
            : '内置云端通道不可用，已改用系统语音',
        );
        if (!speakTextLocally(seg, voiceLangRef.current, true)) {
          clearTimer();
          setErrorMsg('朗读暂不可用：设备未提供语音，且云端未配置');
          setState('error');
        }
      }
    },
    [startSource, startTimer, clearTimer, speakTextLocally],
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

  playSegmentRef.current = (seg: string) => void playSegment(seg);

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
      voiceRef.current = voice ?? '';
      voiceLangRef.current = lang;

      const text = cleanTextForTTS(rawText, lang, opts);
      if (!text) return;

      const cfg = loadTtsConfig();
      if (!voiceRef.current) voiceRef.current = cfg.engine === 'scf' ? getTtsVoice(lang) : '';
      if (cfg.engine === 'cloud' && !isCloudTtsReady(cfg)) {
        // 选了自定义云端但配置不完整 → 直接系统语音（不视为错误、不弹状态码）
        segsRef.current = [text];
        idxRef.current = 0;
        if (!speakTextLocally(text, lang, false)) {
          setErrorMsg('当前设备未提供语音朗读能力，可在设置中填写云端语音端点');
          setState('error');
        }
        return;
      }
      if (false) {
        segsRef.current = [text];
        idxRef.current = 0;
        if (!speakTextLocally(text, lang, false)) {
          setErrorMsg('当前设备未提供语音朗读能力，可在设置中填写云端语音端点');
          setState('error');
        }
        return;
      }

      const segs = splitForTTS(text);
      if (segs.length === 0) return;
      segsRef.current = segs;
      idxRef.current = 0;
      void playSegment(segs[0]);
    },
    [unlockAudio, stop, playSegment, speakTextLocally],
  );

  return { state, errorMsg, notice, finishedText, speak, pause, resume, replay, stop, waitingLong };
}