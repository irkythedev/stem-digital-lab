/**
 * 反馈存储：Server酱微信推送（无后端，前端直连）+ 本地队列兜底。
 * 推送成功 → 删除本地记录；失败（离线/未配置/网络异常）→ 留在本地，
 * 下次打开页面自动重试补传。教师微信实时收到反馈。
 */
import { isServerChanConfigured, SERVERCHAN_CONFIG } from './serverchan-config';

export type FeedbackType = 'experiment' | 'project';
export type FeedbackRating = 'helpful' | 'neutral' | 'not-helpful';
export type FeedbackCategory = 'content' | 'interaction' | 'visual' | 'language' | 'bug' | 'suggestion';

export interface FeedbackRecord {
  id: string;
  type: FeedbackType;
  labId?: string;
  rating?: FeedbackRating;
  categories: FeedbackCategory[];
  message: string;
  language: 'zh' | 'en';
  createdAt: string;
}

const STORAGE_KEY = 'stem-lab-feedback';

export function loadFeedback(): FeedbackRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as FeedbackRecord[] : [];
  } catch {
    return [];
  }
}

function persist(records: FeedbackRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // 存储满等异常：静默丢弃（推送仍可能成功）
  }
}

export function saveFeedback(record: FeedbackRecord): void {
  if (typeof window === 'undefined') return;
  const records = [...loadFeedback(), record];
  persist(records);
  // 异步尝试推送（不阻塞 UI）
  void flushFeedbackQueue();
}

export function exportFeedback(): string {
  return JSON.stringify(loadFeedback(), null, 2);
}

export function clearFeedback(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
}

export function makeFeedbackId(): string {
  return `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const FEEDBACK_STORAGE_KEY = STORAGE_KEY;

/** 评分/分类 → 可读中文（用于推送内容） */
const RATING_ZH: Record<FeedbackRating, string> = { helpful: '有帮助', neutral: '一般', 'not-helpful': '没帮助' };
const CATEGORY_ZH: Record<FeedbackCategory, string> = {
  content: '内容', interaction: '交互', visual: '视觉', language: '语言', bug: '问题', suggestion: '建议',
};

/** 单条记录 → Server酱 desp 正文（Markdown，逐行展示） */
function formatPushContent(record: FeedbackRecord): string {
  const lines: string[] = [
    `- **类型**：${record.type === 'experiment' ? '实验反馈' : '项目反馈'}`,
    `- **位置**：${record.labId ?? '通用'}`,
    `- **评分**：${record.rating ? RATING_ZH[record.rating] : '未评'}`,
    `- **分类**：${record.categories.length ? record.categories.map((c) => CATEGORY_ZH[c]).join('、') : '未选'}`,
    `- **语言**：${record.language === 'zh' ? '中文' : 'English'}`,
    `- **时间**：${new Date(record.createdAt).toLocaleString('zh-CN', { hour12: false })}`,
  ];
  if (record.message.trim()) {
    lines.push(`\n${record.message.trim()}`);
  }
  return lines.join('\n');
}

/** 提交单条反馈到 Server酱微信推送。返回 true=推送成功 */
export async function submitOneFeedback(record: FeedbackRecord): Promise<boolean> {
  if (!isServerChanConfigured()) return false;
  try {
    const res = await fetch(`${SERVERCHAN_CONFIG.apiBase}/${SERVERCHAN_CONFIG.sendKey}.send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        title: SERVERCHAN_CONFIG.title,
        desp: formatPushContent(record),
      }),
    });
    if (!res.ok) return false;
    // Server酱成功返回 { code: 0, message: 'ok', ... }
    const json: unknown = await res.json();
    const code = (json as { code?: number } | null)?.code;
    return code === 0;
  } catch {
    return false;
  }
}

let flushing = false;

/** 将本地待发队列逐条推送；成功的移除，失败的保留待下次重试 */
export async function flushFeedbackQueue(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isServerChanConfigured()) return;
  if (flushing) return;
  flushing = true;
  try {
    const records = loadFeedback();
    if (records.length === 0) return;
    const remaining: FeedbackRecord[] = [];
    let changed = false;
    for (const record of records) {
      const ok = await submitOneFeedback(record);
      if (ok) {
        changed = true; // 已送达微信，从本地移除
      } else {
        remaining.push(record); // 失败保留，下次重试
      }
    }
    if (changed) persist(remaining);
  } finally {
    flushing = false;
  }
}
