/**
 * 反馈存储：CloudBase 云端提交（无后端，前端 SDK 匿名登录直连）+ 本地队列兜底。
 * 云端成功 → 删除本地记录；云端失败（离线/未配置/微信内网络）→ 留在本地，
 * 下次打开页面自动重试补传。
 */
import { isCloudBaseConfigured, CLOUDBASE_CONFIG } from './cloudbase-config';

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
    // 存储满等异常：静默丢弃（云端仍可能成功）
  }
}

export function saveFeedback(record: FeedbackRecord): void {
  if (typeof window === 'undefined') return;
  const records = [...loadFeedback(), record];
  persist(records);
  // 异步尝试云端提交（不阻塞 UI）
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

/** 单条记录 → CloudBase 文档字段（下划线风格与云数据库惯例一致） */
function toCloudDoc(record: FeedbackRecord): Record<string, unknown> {
  return {
    id: record.id,
    type: record.type,
    labId: record.labId ?? '',
    rating: record.rating ?? '',
    categories: record.categories,
    message: record.message,
    language: record.language,
    createdAt: record.createdAt,
  };
}

let sdkPromise: Promise<unknown> | null = null;

/** 动态加载 @cloudbase/js-sdk（反馈是低频功能，避免拖慢首屏） */
function loadSdk(): Promise<unknown> {
  if (!sdkPromise) {
    sdkPromise = import('@cloudbase/js-sdk').then((m) => m.default ?? m);
  }
  return sdkPromise;
}

/** 提交单条反馈到 CloudBase（匿名登录 + 集合写入）。返回 true=成功 */
export async function submitOneFeedback(record: FeedbackRecord): Promise<boolean> {
  if (!isCloudBaseConfigured()) return false;
  try {
    const cloudbase = await loadSdk();
    const app = (cloudbase as { init: (opts: object) => { auth: () => { anonymousAuthProvider: () => { signIn: () => Promise<void> } }; database: () => { collection: (name: string) => { add: (doc: object) => Promise<unknown> } } } }).init({
      env: CLOUDBASE_CONFIG.envId,
      region: CLOUDBASE_CONFIG.region,
    });
    const auth = app.auth();
    // 匿名登录（每设备一个匿名用户，永不过期）；已登录时静默成功
    try {
      await auth.anonymousAuthProvider().signIn();
    } catch {
      // 已登录或其他登录态：继续尝试写入
    }
    await app.database().collection('Feedback').add(toCloudDoc(record));
    return true;
  } catch {
    return false;
  }
}

let flushing = false;

/** 将本地待发队列逐条提交到云端；成功的移除，失败的保留待下次重试 */
export async function flushFeedbackQueue(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isCloudBaseConfigured()) return;
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
        changed = true; // 已送达云端，从本地移除
      } else {
        remaining.push(record); // 失败保留，下次重试
      }
    }
    if (changed) persist(remaining);
  } finally {
    flushing = false;
  }
}
