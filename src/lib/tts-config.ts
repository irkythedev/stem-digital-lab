/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 语音朗读配置（去中心化：默认浏览器原生离线语音，云端为使用者自配的可选扩展）。
 *
 * 设计原则：
 * - **默认零配置可用**：engine 缺省 'local'，直接走 window.speechSynthesis，断网/离线 100% 可用；
 * - **云端可选、可换、可撤**：使用者自行填写兼容 /v1/audio/speech 的端点与 Key，
 *   费用与调用由其自理；本应用不提供、不代购、不中转任何语音服务；
 * - **Key 只在本机**：配置整体存 localStorage 键 `stem-tts-config`，不上传、不进构建产物；
 * - 读配置一律容错：字段缺失/JSON 损坏一律回落默认，把「能出声」放在第一位。
 */

/** 存储键（配置与清除都只在本机完成） */
export const TTS_STORAGE_KEY = 'stem-tts-config';

/** 系统原生语音的最小结构（getVoices() 的元素） */
export interface LocalVoice {
  name: string;
  lang: string;
  voiceURI?: string;
}

export interface TtsConfig {
  /**
   * 引擎：
   *   scf   = 内置云函数高质量语音（默认，免配置；Windows/macOS/Linux/微信内置浏览器音色一致）
   *   cloud = 使用者自配的云端 TTS（兼容 /v1/audio/speech，自备 Key）
   * 两者任一不可用时，运行时自动静默回退 `window.speechSynthesis`（见 use-speak.ts）。
   */
  engine: 'scf' | 'cloud';
  /** 原生中文发音人（voiceURI；空 = 按语言自动挑） */
  localVoiceZh: string;
  /** 原生英文发音人（voiceURI；空 = 按语言自动挑） */
  localVoiceEn: string;
  /** 云端端点：兼容 OpenAI /v1/audio/speech；填 base 或完整端点都可 */
  endpoint: string;
  /** 云端 API Key（仅存本机） */
  apiKey: string;
  /** 云端模型名（选填） */
  model: string;
  /** 云端音色名（选填） */
  voice: string;
}

export const DEFAULT_TTS_CONFIG: TtsConfig = {
  engine: 'scf',
  localVoiceZh: '',
  localVoiceEn: '',
  endpoint: '',
  apiKey: '',
  model: 'tts-1',
  voice: 'alloy',
};

/** 读配置：任何异常（无 window / JSON 坏 / 字段类型不对）都回落默认，绝不因配置损坏让朗读不可用 */
export function loadTtsConfig(): TtsConfig {
  const base: TtsConfig = { ...DEFAULT_TTS_CONFIG };
  try {
    if (typeof window === 'undefined' || !window.localStorage) return base;
    const raw = window.localStorage.getItem(TTS_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<TtsConfig> | null;
    if (!parsed || typeof parsed !== 'object') return base;
    const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
    return {
      engine: parsed.engine === 'cloud' ? 'cloud' : 'scf',
      localVoiceZh: str(parsed.localVoiceZh, ''),
      localVoiceEn: str(parsed.localVoiceEn, ''),
      endpoint: str(parsed.endpoint, ''),
      apiKey: str(parsed.apiKey, ''),
      model: str(parsed.model, DEFAULT_TTS_CONFIG.model),
      voice: str(parsed.voice, DEFAULT_TTS_CONFIG.voice),
    };
  } catch {
    return base;
  }
}

/** 写配置（静默失败：隐私模式 / 配额满时不阻塞朗读） */
export function saveTtsConfig(config: TtsConfig): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(TTS_STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* 静默 */
  }
}

/** 清除朗读配置 → 回到默认（原生离线语音 + 清空云端端点与 Key） */
export function clearTtsConfig(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(TTS_STORAGE_KEY);
  } catch {
    /* 静默 */
  }
}

/**
 * 归一化云端端点：只认绝对 http(s) 地址（与 AI 端点同一规矩，不做相对路径之类的应用侧补偿）；
 * 未带 `audio/speech` 时补上，故用户填 base（…/v1）或完整端点都能用。
 * 非法地址返回 null（调用方据此回落本地朗读）。
 */
export function normalizeSpeechEndpoint(raw: string): string | null {
  const s = (raw || '').trim();
  if (!/^https?:\/\//i.test(s)) return null;
  const noSlash = s.replace(/\/+$/, '');
  if (/\/audio\/speech$/i.test(noSlash)) return noSlash;
  return `${noSlash}/audio/speech`;
}

/** 云端是否可用：选了 cloud 引擎 + 端点合法 + 有 Key，三者齐备才发请求 */
export function isCloudTtsReady(config: TtsConfig): boolean {
  return config.engine === 'cloud' && !!normalizeSpeechEndpoint(config.endpoint) && !!config.apiKey.trim();
}

/** 按当前语言取用户配置的原生发音人（voiceURI）：未配置返回空串，由 use-speak 按语言自动挑 */
export function preferredLocalVoice(config: TtsConfig, lang: 'zh' | 'en'): string {
  return (lang === 'en' ? config.localVoiceEn : config.localVoiceZh).trim();
}

/**
 * macOS 的「玩具/特效」音色：朗读正文像卡通玩具音，一律垫底。
 * 不删除：用户若在系统里特意装了、或在别处需要它们，列表末尾仍可选到。
 */
const NOVELTY_VOICE_NAMES = ['flo', 'eddy', 'reed', 'grandma', 'grandpa', 'rocko', 'shelley', 'sandy', 'shelly'];

/**
 * 境外语音服务的音色：界面不列出、优选也不优先（合规要求，见项目约定）。
 * 使命中串写在这里而**不写进任何用户可见文案**：它只是一份排除清单，用来识别设备语音表里
 * 来自境外服务的条目。只作用于「我们列出的候选与优先级」——设备自身用哪个引擎发声不受影响；
 * 过滤后若无同语种候选，仍按浏览器自身的语言选择朗读，用户照样听得见。
 */
const BLOCKED_VOICE_HINTS = ['google', 'chrome os'];

/** 是否属于不展示、不优选的外域语音（按音色名与 voiceURI 双重判断） */
export function isBlockedLocalVoice(v: { name?: string; voiceURI?: string }): boolean {
  const hay = `${v?.name ?? ''} ${v?.voiceURI ?? ''}`.toLowerCase();
  return BLOCKED_VOICE_HINTS.some((hint) => hay.includes(hint));
}

/** 自然/高拟真音色特征：同语言档内优先（系统自带 Natural / 在线·增强版 / 神经音色） */
const PREMIUM_VOICE_HINTS = ['natural', 'online', 'premium', 'enhanced', 'neural'];

/**
 * 语言档位：0 = 首选地区（中文 zh-CN / 简体，英文 en-US、en-GB）；
 * 1 = 同语种其它地区（zh-TW / zh-HK、en-IN / en-AU…）；2 = 非同语种。
 * 中文里 zh-TW / zh-HK 排到 zh-CN 之后；英文里 en-IN 等小众口音排到末尾。
 */
export function voiceLangTier(lang: string, base: 'zh' | 'en'): number {
  const l = (lang || '').toLowerCase().replace(/_/g, '-');
  if (base === 'zh') {
    if (l === 'zh-cn' || l === 'zh-hans' || l.startsWith('zh-hans-')) return 0;
    return l.startsWith('zh') ? 1 : 2;
  }
  if (l === 'en-us' || l === 'en-gb') return 0;
  return l.startsWith('en') ? 1 : 2;
}

/** 排序权重：玩具音色垫底（+100）→ 语言档（×10）→ 自然音色优先（+1 表示非自然） */
export function voiceRank(v: { name?: string; lang: string }, base: 'zh' | 'en'): number {
  const name = String(v.name ?? '').toLowerCase();
  const novelty = NOVELTY_VOICE_NAMES.some((n) => name.includes(n)) ? 100 : 0;
  const premium = PREMIUM_VOICE_HINTS.some((h) => name.includes(h)) ? 0 : 1;
  return novelty + voiceLangTier(v.lang, base) * 10 + premium;
}

/**
 * 设置面板用：把系统语音按中/英分组（其余语言不展示），并按同一套权重排序——
 * 列表顺序即「自动优选」的顺序，用户看到的与真正挑中的一致。
 */
export function groupLocalVoices(voices: LocalVoice[]): { zh: LocalVoice[]; en: LocalVoice[] } {
  const zh: LocalVoice[] = [];
  const en: LocalVoice[] = [];
  for (const v of voices) {
    if (isBlockedLocalVoice(v)) continue; // 合规：不列出外域语音服务音色
    const l = (v.lang || '').toLowerCase();
    if (l.startsWith('zh')) zh.push(v);
    else if (l.startsWith('en')) en.push(v);
  }
  const byRank = (base: 'zh' | 'en') => (a: LocalVoice, b: LocalVoice) => voiceRank(a, base) - voiceRank(b, base);
  zh.sort(byRank('zh'));
  en.sort(byRank('en'));
  return { zh, en };
}

/* ────────────────────────────────────────────────────────────
 * 以下为**遗留常量**：仅供开发用测试页 /tts-test 使用（该页直连旧云函数验证合成）。
 * 正式朗读路径（src/lib/use-speak.ts）已不再依赖云函数，改为
 * 「默认原生离线语音 + 使用者自配云端端点」的去中心化架构。
 * ──────────────────────────────────────────────────────────── */

/** @deprecated 旧云函数地址，仅 /tts-test 开发页使用 */
export const TTS_CONFIG = {
  PRODUCTION_URL: 'https://1307683613-fg2n0ky3me.ap-shanghai.tencentscf.com',
  DEFAULT_VOICE: 'zh-CN-XiaoxiaoNeural',
  MAX_TEXT: 1000,
};

/** @deprecated 仅 /tts-test 开发页使用；正式朗读不再取云端地址 */
export function getTtsUrl(): string {
  // 必须容错访问 import.meta.env：纯 Node / CJS 转译环境（脚本、SSR、单元测试）下
  // import.meta.env 可能不存在，直接读 .DEV 会抛 TypeError，被调用方 catch 后
  // 静默降级到「不回退地址」的路径（与 scf-token.ts 的 readEnvToken 同一处理范式）。
  let dev = false;
  try {
    const meta = import.meta as ImportMeta & { env?: { DEV?: boolean } };
    dev = Boolean(meta?.env?.DEV);
  } catch {
    dev = false;
  }
  if (dev) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${host}:3100/tts`;
  }
  return TTS_CONFIG.PRODUCTION_URL;
}

/** @deprecated 旧云端音色名对照，仅 /tts-test 开发页使用 */
export function getTtsVoice(lang: 'zh' | 'en'): string {
  return lang === 'en' ? 'en-US-AriaNeural' : TTS_CONFIG.DEFAULT_VOICE;
}
