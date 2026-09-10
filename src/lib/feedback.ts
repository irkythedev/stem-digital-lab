/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 反馈存储：钉钉群机器人推送（SCF 云函数转发，未配置时回退 Server酱微信）+ 本地队列兜底。
 * 推送成功 → 按 id 删除本地记录；失败（离线/未配置/网络异常）→ 留在本地，
 * 下次打开页面自动重试补传；累计失败达 FEEDBACK_MAX_ATTEMPTS 次后丢弃。
 *
 * 发送路径纪律：面板提交走 submitFeedback，离线补传走 flushFeedbackQueue，
 * 两者共用 sendOnce（同一 id 在途即拒绝第二次发送）→ 一次提交恒定只推一条。
 * 不要在 saveFeedback 之后再单独直发一次（历史双发即由此而来）。
 */
import { isServerChanConfigured, isDingtalkProxyConfigured, SERVERCHAN_CONFIG, DINGTALK_PROXY } from './serverchan-config';
import { scfUrlWithToken } from './scf-token';

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
  /** 可选：学校/年级/班级（仅用于回访，用户自主填写） */
  grade?: string;
  /** 可选：如何称呼（昵称/称呼，仅用于回访） */
  name?: string;
  /** 可选：联系方式（手机号/微信/邮箱，仅用于回访） */
  contact?: string;
  /** 推送失败次数（达到 FEEDBACK_MAX_ATTEMPTS 后丢弃该条，避免永久重复推送） */
  attempts?: number;
}

const STORAGE_KEY = 'stem-lab-feedback';

/** 本地待发队列容量上限：保留最近 100 条，超出丢最旧（与 ai-history 上限一致，防离线堆积无界增长） */
export const FEEDBACK_LIMIT = 100;

/** 单条失败重试上限：达到后丢弃，避免每次打开页面重复推送同一条（内容与时间完全相同） */
export const FEEDBACK_MAX_ATTEMPTS = 5;

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

/**
 * 入队并落盘（不发送）。发送请走 submitFeedback / flushFeedbackQueue。
 * 这里刻意不自动 flush：调用方若在此之后又单独直发一次，同一条记录会被推两遍。
 */
export function saveFeedback(record: FeedbackRecord): void {
  if (typeof window === 'undefined') return;
  // 容量上限：保留最近 FEEDBACK_LIMIT 条，超出丢最旧（防止离线堆积无界增长）
  const records = [...loadFeedback(), record].slice(-FEEDBACK_LIMIT);
  persist(records);
}

export function exportFeedback(): string {
  return JSON.stringify(loadFeedback(), null, 2);
}

export function clearFeedback(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * 从本地队列移除单条（推送成功后调用）。
 * 走 persist 的 try/catch：即使存储异常也不抛到 UI，且避免裸 setItem 失败后
 * 本地残留导致下次 flush 重复推送。
 */
export function removeFeedback(id: string): void {
  if (typeof window === 'undefined') return;
  const rest = loadFeedback().filter((r) => r.id !== id);
  persist(rest);
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

/** 单条记录 → 推送正文（Markdown，逐行展示） */
function formatPushContent(record: FeedbackRecord): string {
  const lines: string[] = [
    `- **类型**：${record.type === 'experiment' ? '实验反馈' : '项目反馈'}`,
    `- **位置**：${record.labId ?? '通用'}`,
    `- **评分**：${record.rating ? RATING_ZH[record.rating] : '未评'}`,
    `- **分类**：${record.categories.length ? record.categories.map((c) => CATEGORY_ZH[c]).join('、') : '未选'}`,
    `- **语言**：${record.language === 'zh' ? '中文' : 'English'}`,
    `- **时间**：${new Date(record.createdAt).toLocaleString('zh-CN', { hour12: false })}`,
  ];
  if (record.grade?.trim()) {
    lines.push(`- **学校/年级/班级**：${record.grade.trim()}`);
  }
  if (record.name?.trim()) {
    lines.push(`- **称呼**：${record.name.trim()}`);
  }
  if (record.contact?.trim()) {
    lines.push(`- **联系方式**：${record.contact.trim()}`);
  }
  if (record.message.trim()) {
    lines.push(`\n${record.message.trim()}`);
  }
  return lines.join('\n');
}

/** 发送结果：sent=已送达；failed=发送失败（可重试）；busy=同一条正在发送中（并发去重） */
type SendOutcome = 'sent' | 'failed' | 'busy';

/** 在途记录 id 集合：面板提交与队列补传并发时，同一条只允许有一次发送 */
const inFlight = new Set<string>();

/**
 * 低层发送：同一 id 在途时直接拒绝（返回 busy），不做任何队列改动。
 * 这是全模块唯一的出口，杜绝「一次提交推两条」。
 */
async function sendOnce(record: FeedbackRecord): Promise<SendOutcome> {
  if (inFlight.has(record.id)) return 'busy';
  inFlight.add(record.id);
  try {
    return (await sendToChannel(record)) ? 'sent' : 'failed';
  } finally {
    inFlight.delete(record.id);
  }
}

/** 兼容导出：单条发送（busy 视为未送达，不代表失败） */
export async function submitOneFeedback(record: FeedbackRecord): Promise<boolean> {
  return (await sendOnce(record)) === 'sent';
}

/**
 * 提交单条反馈：入队落盘 → 发送一次 → 成功按 id 移除 / 失败累计重试次数。
 * 面板提交只调这一个函数：一次提交 = 一条推送。
 */
export async function submitFeedback(record: FeedbackRecord): Promise<boolean> {
  saveFeedback(record);
  const outcome = await sendOnce(record);
  if (outcome === 'sent') {
    removeFeedback(record.id);
  } else if (outcome === 'failed') {
    bumpAttempt(record.id);
  }
  return outcome === 'sent';
}

/** 失败计数 +1；达到 FEEDBACK_MAX_ATTEMPTS 则丢弃该条，不再重试 */
function bumpAttempt(id: string): void {
  const next: FeedbackRecord[] = [];
  let changed = false;
  for (const r of loadFeedback()) {
    if (r.id !== id) {
      next.push(r);
      continue;
    }
    changed = true;
    const attempts = (r.attempts ?? 0) + 1;
    // 未达上限：保留待下次补传；达上限：丢弃，避免每次打开页面重复推同一条
    if (attempts < FEEDBACK_MAX_ATTEMPTS) next.push({ ...r, attempts });
  }
  if (changed) persist(next);
}

/**
 * 通道发送：优先钉钉通道（SCF 云函数转发 → 钉钉群机器人），
 * 未配置时回退 Server酱微信推送。返回 true=推送成功。
 */
async function sendToChannel(record: FeedbackRecord): Promise<boolean> {
  if (isDingtalkProxyConfigured()) {
    return submitViaDingtalk(record);
  }
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

/** 钉钉通道：POST {title, content} 到 SCF 云函数，云函数转发钉钉群机器人 */
async function submitViaDingtalk(record: FeedbackRecord): Promise<boolean> {
  try {
    const res = await fetch(scfUrlWithToken(DINGTALK_PROXY.apiBase), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: DINGTALK_PROXY.title,
        content: formatPushContent(record),
      }),
    });
    if (!res.ok) return false;
    const json: unknown = await res.json();
    const code = (json as { code?: number } | null)?.code;
    return code === 0;
  } catch {
    return false;
  }
}

let flushing: Promise<void> | null = null;

/**
 * 补传本地待发队列：逐条发送，成功按 id 移除，失败累计次数（超限丢弃）。
 * 关键：按 id 精确增删，不用开跑时的快照整体覆盖写盘，
 * 否则补传期间新提交的记录会被覆盖掉（静默丢失）。
 * 已在补传中时返回同一个在途 Promise（调用方 await 即为本次补传完成）。
 */
export async function flushFeedbackQueue(): Promise<void> {
  if (typeof window === 'undefined') return;
  // 任一通道已配置即可补传（旧实现只判 Server酱，仅配钉钉时补传会失效）
  if (!isDingtalkProxyConfigured() && !isServerChanConfigured()) return;
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      for (const record of loadFeedback()) {
        const outcome = await sendOnce(record);
        if (outcome === 'sent') {
          removeFeedback(record.id);
        } else if (outcome === 'failed') {
          bumpAttempt(record.id);
        }
      }
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}
