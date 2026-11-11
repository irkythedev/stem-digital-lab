/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 全局排他 TTS 播放单例（AI 问答/历史共用）。
 *
 * 解决的问题：
 * - 连续点击/切换历史条目时，旧请求或旧 utterance 仍可能在 stop() 后启动；
 * - 每个卡片各自持有 playing 状态，导致图标/声音错位；
 * - speechSynthesis.cancel() 的异步队列尚未排空就同步 speak()，产生双声；
 * - 本地 SpeechSynthesisUtterance 未被长期持有，存在 GC 后 onend 丢失；
 * - 回答尾部的「可以继续了解」与追问被一并朗读。
 *
 * 每个 play() 都生成新的 token；所有 await 后必须重新核对 token。播放器只允许
 * 当前 token 启动 AudioBufferSource / speechSynthesis；旧 token 一律静默丢弃。
 */
import { useSyncExternalStore } from 'react';
import { stripThinkingFromHistory } from './ai-config';
import { stripFollowUps } from './ai-clipboard';
import { cleanTextForTTS, fetchCloudSpeech, fetchScfSpeech, localVoiceLang, resolveLocalVoice, splitForTTS, type LocalSpeechHost, type SpeechOpts } from './use-speak';
import { getTtsVoice, loadTtsConfig, isCloudTtsReady, type LocalVoice, type TtsConfig } from './tts-config';

export type TtsState = 'idle' | 'synthesizing' | 'playing' | 'paused' | 'finished' | 'error';

export interface TtsPlayOptions {
  id: string;
  text: string;
  lang: 'zh' | 'en';
  opts?: SpeechOpts;
  /** 可选的云端音色提示；为空时按配置/语言取默认 */
  voice?: string;
}

export interface TtsSnapshot {
  activeId: string | null;
  state: TtsState;
  errorMsg: string;
  notice: string;
  finishedText: string;
  waitingLong: boolean;
}

type UtteranceLike = {
  lang: string;
  rate?: number;
  voice?: unknown;
  onstart?: (() => void) | null;
  onend?: (() => void) | null;
  onerror?: ((e?: unknown) => void) | null;
  onpause?: (() => void) | null;
  onresume?: (() => void) | null;
};

type SpeechHost = LocalSpeechHost & {
  SpeechSynthesisUtterance?: new (text: string) => UtteranceLike;
};

export interface TtsPlayerOptions {
  /** 可注入假宿主，供 Node 单测使用 */
  host?: SpeechHost;
  /** 可注入配置读取器，供单测避开 localStorage */
  loadConfig?: () => TtsConfig;
  /** cancel 后的浏览器队列排空等待；测试可缩短 */
  waitMs?: number;
}

const DEFAULT_WAIT_MS = 50;

/** 结构级清洗 + 符号口语化；用于测试和外部调用 */
export function prepareSpeechText(rawText: string, lang: 'zh' | 'en' = 'zh', opts?: SpeechOpts): string {
  const withoutThink = stripThinkingFromHistory(rawText);
  const withoutFollowUps = stripFollowUps(withoutThink);
  return cleanTextForTTS(withoutFollowUps, lang, opts);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class TtsPlayer {
  private listeners = new Set<() => void>();
  private snapshot: TtsSnapshot = {
    activeId: null,
    state: 'idle',
    errorMsg: '',
    notice: '',
    finishedText: '',
    waitingLong: false,
  };

  private token = 0;
  private abortController: AbortController | null = null;
  private utteranceRef: UtteranceLike | null = null;
  private audioCtx: AudioContext | null = null;
  private audioSource: AudioBufferSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private elapsedSec = 0;
  private startAt = 0;
  private segments: string[] = [];
  private segmentIndex = 0;
  private localMode = false;
  private lastOptions: TtsPlayOptions | null = null;
  private waitTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  private readonly host: SpeechHost | undefined;
  private readonly loadConfig: () => TtsConfig;
  private readonly waitMs: number;

  constructor(options: TtsPlayerOptions = {}) {
    this.host = options.host ?? (typeof window !== 'undefined' ? (window as unknown as SpeechHost) : undefined);
    this.loadConfig = options.loadConfig ?? loadTtsConfig;
    this.waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): TtsSnapshot => this.snapshot;

  /** 只读暴露当前 utterance，供单测/诊断确认 GC 防护引用仍在。 */
  getUtterance(): UtteranceLike | null {
    return this.utteranceRef;
  }

  private publish(patch: Partial<TtsSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  private clearTimers(): void {
    if (this.waitTimer) {
      clearTimeout(this.waitTimer);
      this.waitTimer = null;
    }
    if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
  }

  /** 主动停止当前播放并作废旧 token。 */
  stop = (): void => {
    this.token += 1;
    this.abortController?.abort();
    this.abortController = null;
    this.stopAudio();
    this.cancelSpeech();
    this.utteranceRef = null;
    this.localMode = false;
    this.lastOptions = null;
    this.segments = [];
    this.segmentIndex = 0;
    this.clearTimers();
    this.publish({ activeId: null, state: 'idle', errorMsg: '', notice: '', finishedText: '', waitingLong: false });
  };

  /** 播放/暂停/恢复同一 ID；不同 ID 强制排他切换。 */
  toggle = (options: TtsPlayOptions): void => {
    if (this.snapshot.activeId !== options.id) {
      void this.play(options);
      return;
    }
    if (this.snapshot.state === 'playing') {
      this.pause();
      return;
    }
    if (this.snapshot.state === 'paused') {
      this.resume();
      return;
    }
    if (this.snapshot.state === 'synthesizing') {
      this.stop();
      return;
    }
    // finished / error / idle：从头播放
    void this.play(options);
  };

  /**
   * 一次完整的排他播放。所有异步阶段都带 token 校验，旧 play 不得再启动声音。
   */
  play = async (options: TtsPlayOptions): Promise<void> => {
    const currentToken = ++this.token;
    this.abortController?.abort();
    this.abortController = null;
    this.stopAudio();
    this.cancelSpeech();
    this.utteranceRef = null;
    this.localMode = false;
    this.lastOptions = options;
    this.clearTimers();
    this.publish({
      activeId: options.id,
      state: 'synthesizing',
      errorMsg: '',
      notice: '',
      finishedText: '',
      waitingLong: false,
    });
    this.waitTimer = setTimeout(() => {
      if (currentToken === this.token && this.snapshot.state === 'synthesizing') {
        this.publish({ waitingLong: true });
      }
    }, 4000);

    // 让浏览器完成 cancel 队列排空；期间若用户再次点击，当前 token 已失效。
    await sleep(this.waitMs);
    if (currentToken !== this.token) return;

    const text = prepareSpeechText(options.text, options.lang, options.opts);
    if (!text) {
      this.publish({ state: 'idle', activeId: null });
      return;
    }
    this.segments = splitForTTS(text);
    this.segmentIndex = 0;
    const cfg = this.loadConfig();
    if (cfg.engine === 'cloud' && !isCloudTtsReady(cfg)) {
      this.playLocal(text, options.lang, currentToken);
      return;
    }
    if (cfg.engine === 'scf' || isCloudTtsReady(cfg)) {
      this.playSegment(currentToken).catch(() => {
        if (currentToken === this.token) this.playLocal(text, options.lang, currentToken);
      });
      return;
    }
    this.playLocal(text, options.lang, currentToken);
  };

  pause = (): void => {
    if (!this.snapshot.activeId) return;
    if (this.localMode) {
      this.cancelSpeech();
      this.localMode = false;
      this.publish({ state: 'paused' });
      return;
    }
    if (this.audioSource && this.audioCtx) {
      this.elapsedSec = Math.max(0, this.audioCtx.currentTime - this.startAt);
      this.stopAudio();
      this.publish({ state: 'paused' });
    }
  };

  resume = (): void => {
    if (this.snapshot.state !== 'paused' || !this.lastOptions) return;
    if (this.audioSource && this.audioBuffer && this.audioCtx) {
      this.startSource(this.elapsedSec);
      this.elapsedSec = 0;
      return;
    }
    // 本地朗读无断点：从当前段重新开始
    void this.play(this.lastOptions);
  };

  private playSegment = async (currentToken: number): Promise<void> => {
    const seg = this.segments[this.segmentIndex];
    if (!seg) {
      this.finish(currentToken);
      return;
    }
    try {
      const cfg = this.loadConfig();
      const controller = new AbortController();
      this.abortController = controller;
      const lang = this.lastOptions?.lang ?? 'zh';
      const bytes = cfg.engine === 'scf'
        ? await fetchScfSpeech(seg, this.voiceHint(cfg, lang), fetch, controller.signal)
        : await fetchCloudSpeech(seg, cfg, this.voiceHint(cfg, lang), fetch, controller.signal);
      if (currentToken !== this.token) return;

      const ctx = this.ensureAudioContext();
      if (!ctx) throw new Error('no audio context');
      const decoded = await ctx.decodeAudioData(bytes);
      if (currentToken !== this.token) return;

      this.audioBuffer = decoded;
      this.elapsedSec = 0;
      this.startSource(0);
    } catch {
      if (currentToken !== this.token) return;
      this.cancelSpeech();
      await sleep(this.waitMs);
      if (currentToken !== this.token) return;
      this.playLocal(seg, this.lastOptions?.lang ?? 'zh', currentToken);
    }
  };

  private startSource(offset: number): void {
    const ctx = this.audioCtx;
    const buf = this.audioBuffer;
    if (!ctx || !buf) return;
    this.stopAudio();
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.connect(ctx.destination);
    this.audioSource = source;
    this.startAt = ctx.currentTime - offset;
    const tokenAtStart = this.token;
    source.onended = () => {
      if (tokenAtStart !== this.token) return;
      this.audioSource = null;
      const next = this.segmentIndex + 1;
      if (next < this.segments.length) {
        this.segmentIndex = next;
        void this.playSegment(tokenAtStart).catch(() => {
          if (tokenAtStart === this.token) this.playLocal(this.segments[next] ?? '', this.lastOptions?.lang ?? 'zh', tokenAtStart);
        });
      } else {
        this.finish(tokenAtStart);
      }
    };
    source.start(0, offset);
    this.publish({ state: 'playing', waitingLong: false });
  }

  private playLocal(text: string, lang: 'zh' | 'en', currentToken: number): void {
    const ss = this.host?.speechSynthesis;
    const Utter = this.host?.SpeechSynthesisUtterance;
    if (!ss || !Utter) {
      this.publish({ state: 'error', errorMsg: '朗读暂不可用：设备未提供语音，且云端未配置' });
      return;
    }
    try {
      ss.cancel();
      const u = new Utter(text) as UtteranceLike;
      this.utteranceRef = u;
      this.localMode = true;
      u.lang = localVoiceLang(lang);
      u.rate = 0.95;
      const cfg = this.loadConfig();
      const preferred = lang === 'en' ? cfg.localVoiceEn : cfg.localVoiceZh;
      const voice = resolveLocalVoice((ss.getVoices?.() ?? []) as LocalVoice[], preferred ?? '', lang);
      if (voice) u.voice = voice;
      u.onstart = () => {
        if (currentToken !== this.token) return;
        this.clearTimers();
        this.publish({ state: 'playing', waitingLong: false });
      };
      u.onend = () => {
        if (currentToken !== this.token) return;
        this.utteranceRef = null;
        this.finish(currentToken);
      };
      u.onerror = () => {
        if (currentToken !== this.token) return;
        this.utteranceRef = null;
        this.publish({ state: 'error', errorMsg: '朗读暂不可用：设备未提供语音，且云端未配置' });
      };
      u.onpause = () => {
        if (currentToken === this.token) this.publish({ state: 'paused' });
      };
      u.onresume = () => {
        if (currentToken === this.token) this.publish({ state: 'playing' });
      };
      ss.speak(u);
      // onstart 可能永远不触发（个别 WebView）：兜底避免按钮永久 loading。
      this.watchdog = setTimeout(() => {
        if (currentToken === this.token && this.snapshot.state === 'synthesizing') {
          this.publish({ state: 'playing', waitingLong: false });
        }
      }, 800);
    } catch {
      this.publish({ state: 'error', errorMsg: '朗读暂不可用：设备未提供语音，且云端未配置' });
    }
  }

  private finish(currentToken: number): void {
    if (currentToken !== this.token) return;
    this.clearTimers();
    this.localMode = false;
    this.audioSource = null;
    this.publish({ state: 'finished', waitingLong: false, finishedText: this.lastOptions?.text ?? '' });
  }

  private ensureAudioContext(): AudioContext | null {
    if (this.audioCtx) return this.audioCtx;
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.audioCtx = new Ctor();
    return this.audioCtx;
  }

  private stopAudio(): void {
    try {
      this.audioSource?.stop();
    } catch {
      /* 未启动的 source stop 会抛错 */
    }
    this.audioSource = null;
  }

  private cancelSpeech(): void {
    try {
      this.host?.speechSynthesis?.cancel();
    } catch {
      /* 无 speechSynthesis 环境忽略 */
    }
  }

  private voiceHint(cfg: TtsConfig, lang: 'zh' | 'en'): string {
    if (cfg.engine === 'cloud') return cfg.voice || '';
    return getTtsVoice(lang);
  }
}

/** AI 面板/历史面板共用的模块级唯一播放器。 */
export const ttsPlayer = new TtsPlayer();

/** 订阅全局唯一播放器；同一时刻只允许一条 activeId 播放。 */
export function useTtsPlayer(): TtsSnapshot & {
  play: (options: TtsPlayOptions) => Promise<void>;
  toggle: (options: TtsPlayOptions) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
} {
  const snapshot = useSyncExternalStore(ttsPlayer.subscribe, ttsPlayer.getSnapshot, ttsPlayer.getSnapshot);
  return {
    ...snapshot,
    play: ttsPlayer.play,
    toggle: ttsPlayer.toggle,
    pause: ttsPlayer.pause,
    resume: ttsPlayer.resume,
    stop: ttsPlayer.stop,
  };
}
