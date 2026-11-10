/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 问答历史 —— 纯浏览器本地持久化（localStorage）。
 *
 * 隐私承诺：
 * - 数据仅存用户本机浏览器，不触网、不上传、不中转；
 * - 与 stem-ai-config 同生命周期：用户清除浏览器数据即一并清除；
 * - 容量上限 100 条，超出丢最旧（一学期重点回顾足够）。
 */

import { loadStorageLimit } from './ai-storage-limit';
import { stripThinkingFromHistory } from './ai-config';

export interface AiHistoryEntry {
  /** 时间戳36进制 + 随机36进制，冲突概率可忽略 */
  id: string;
  /** 完成时间（ms） */
  ts: number;
  /** 来源页面完整路径（含 query，如 /physics-constants?focus=g） */
  path: string;
  /** 科目（数学/物理/化学…，页面语言对应） */
  subject: string;
  /** 页面主题（如「凸透镜成像」） */
  topic: string;
  /** 用户问题 */
  question: string;
  /** AI 回答原文 */
  answer: string;
  /** 所用模型名 */
  model: string;
}

export const HISTORY_STORAGE_KEY = 'stem-ai-history';
const STORAGE_KEY = HISTORY_STORAGE_KEY;
/** 历史容量默认上限：保留最近 100 条（实际以 loadStorageLimit() 用户档位为准） */
export const HISTORY_LIMIT = 100;

/** 单条历史结构校验：answer 必须是字符串（AnswerRich 会对 text.split，缺字段会整站白屏）。
 *  旧版本写入 / 手工导入 / 将来字段改名都可能出现坏条目，读取时直接过滤，不让一条坏数据拖垮面板。 */
function isAiHistoryEntry(v: unknown): v is AiHistoryEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.ts === 'number' &&
    typeof e.question === 'string' &&
    typeof e.answer === 'string'
  );
}

/** 读取历史（损坏/异常一律返回空数组，绝不让历史数据拖垮面板） */
export function listHistory(): AiHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    let changed = false;
    const migrated = arr.map((item) => {
      if (!isAiHistoryEntry(item)) return item; // 保留损坏条目，避免迁移时误删用户数据
      const answer = stripThinkingFromHistory(item.answer);
      // 只有“确实命中思考标签”或“去标签后实质内容变化”才迁移；
      // 普通正文仅首尾空白被 trim 时保留原文，避免无意义回写。
      const substantive = /<\/?(?:think|thinking|reasoning)\b/i.test(item.answer) || answer !== item.answer.trim();
      if (substantive) changed = true;
      return substantive ? { ...item, answer } : item;
    });
    // 旧版本 localStorage 可能保存过原始 reasoning；读取时统一清洗，绝不让它进入可见历史。
    const visible = migrated.filter(isAiHistoryEntry) as AiHistoryEntry[];
    if (changed) {
      try {
        // 一次性回写迁移结果，避免每次启动重复清洗；写入失败也不影响本次返回的干净内存数据。
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      } catch {
        /* 存储失败：保留内存中的清洗结果，不重新暴露旧 reasoning */
      }
    }
    return visible;
  } catch {
    return [];
  }
}

/** 写入一条历史（流式完成后调用；失败先丢最旧再试一次，仍失败静默放弃） */
export function saveHistory(entry: Omit<AiHistoryEntry, 'id' | 'ts'>): void {
  if (typeof window === 'undefined') return;
  const item: AiHistoryEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    ts: Date.now(),
    ...entry,
    // 防御性清洗：即使未来调用方传入原始流式文本，也不把 reasoning 写入 localStorage。
    answer: stripThinkingFromHistory(entry.answer),
  };
  const list = listHistory();
  const limit = loadStorageLimit();
  // 简单去重：同一 id 不重复写入（防极少数重复完成回调）
  const next = [item, ...list.filter((x) => x.id !== item.id)].slice(0, limit);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // QuotaExceededError 等：丢最旧一批（约 1/4）再试一次
    try {
      const retry = next.slice(0, Math.max(1, Math.floor(limit * 0.75)));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(retry));
    } catch {
      // 仍失败：静默放弃本次写入，不抛到 UI
    }
  }
}

/**
 * 安全裁剪到指定上限：保留最新 limit 条，仅删最旧的超出部分（严禁清空全部）。
 * 用于「调低上限」确认后执行。返回删除/保留条数，便于 UI 反馈。
 */
export function trimHistoryToLimit(limit: number): { kept: number; removed: number } {
  if (typeof window === 'undefined') return { kept: 0, removed: 0 };
  const list = listHistory();
  if (list.length <= limit) return { kept: list.length, removed: 0 };
  const kept = list.slice(0, Math.max(0, limit));
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
  } catch {
    /* 写入失败：不改变原存储，避免数据丢失 */
    return { kept: list.length, removed: 0 };
  }
  return { kept: kept.length, removed: list.length - kept.length };
}

/**
 * 「停止」/中断后的局部回答标记。
 *
 * 学生点了停止（或网络断掉）时，已经收到的正文不该被默默丢掉；但也不能看起来像
 * 一份完整答案，所以要显式标注。重复调用不会叠加标记（幂等），避免重试路径出现两个。
 */
export function markStopped(text: string, lang: 'zh' | 'en'): string {
  const body = text.trim();
  if (!body) return '';
  const mark = lang === 'zh' ? '[已停止]' : '[stopped]';
  return body.includes(mark) ? body : `${body}\n\n${mark}`;
}

/**
 * 「输出未写完」标记：这一轮不是学生停的，而是内容没生成完就断了。两种成因分开命名，
 * 因为对学生的信息不同：一个是模型自己把预算用光了（finish_reason=length），
 * 一个是连接被中途切断（网关超时/代理挂断）。同样只给学生看，回灌上下文前必须剥离。
 */
export function markTruncated(text: string, lang: 'zh' | 'en', reason: 'limit' | 'cut' = 'limit'): string {
  const body = text.trim();
  if (!body) return '';
  const mark = reason === 'cut'
    ? (lang === 'zh' ? '[连接被中断，内容可能未写完]' : '[connection cut off — content may be incomplete]')
    : (lang === 'zh' ? '[输出已达上限]' : '[output limit reached]');
  return body.includes(mark) ? body : `${body}\n\n${mark}`;
}

/**
 * 剥掉「中断 / 未写完标记」：发给模型的文本必须是干净正文。
 * 标记只给学生看（提示这不是完整答案），回灌进上下文会让模型把标记当内容读。
 */
export function stripStoppedMark(text: string): string {
  return text
    .replace(/\n*\s*\[(?:已停止|stopped|输出已达上限|output limit reached|连接被中断，内容可能未写完|connection cut off — content may be incomplete)\]\s*$/u, '')
    .trim();
}

/** 这轮回答是否「被中断或没写完」且仍有有效残句 —— 只有这种才值得给「继续生成」入口 */
export function isStoppedAnswer(text: string): boolean {
  return /\[(?:已停止|stopped|输出已达上限|output limit reached|连接被中断，内容可能未写完|connection cut off — content may be incomplete)\]\s*$/u.test(text)
    && stripStoppedMark(text).length > 0;
}

/** 清空全部历史（只清历史，不动配置与当前会话） */
export function clearHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 静默
  }
}

/** 相对时间（今天/昨天/N 天前），不引 dayjs */
export function relativeTime(ts: number, lang: 'zh' | 'en'): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return lang === 'zh' ? '刚刚' : 'just now';
  if (min < 60) return lang === 'zh' ? `${min} 分钟前` : `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return lang === 'zh' ? `${hours} 小时前` : `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return lang === 'zh' ? '昨天' : 'yesterday';
  if (days < 7) return lang === 'zh' ? `${days} 天前` : `${days} days ago`;
  // 超过一周：显示日期（短格式）
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return lang === 'zh'
    ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
