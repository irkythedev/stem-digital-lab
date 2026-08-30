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

const STORAGE_KEY = 'stem-ai-history';
/** 历史容量上限：保留最近 100 条，超出丢最旧 */
export const HISTORY_LIMIT = 100;

/** 读取历史（损坏/异常一律返回空数组，绝不让历史数据拖垮面板） */
export function listHistory(): AiHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr as AiHistoryEntry[]) : [];
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
  };
  const list = listHistory();
  // 简单去重：同一 id 不重复写入（防极少数重复完成回调）
  const next = [item, ...list.filter((x) => x.id !== item.id)].slice(0, HISTORY_LIMIT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // QuotaExceededError 等：丢最旧一批（约 1/4）再试一次
    try {
      const retry = next.slice(0, Math.max(1, Math.floor(HISTORY_LIMIT * 0.75)));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(retry));
    } catch {
      // 仍失败：静默放弃本次写入，不抛到 UI
    }
  }
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
