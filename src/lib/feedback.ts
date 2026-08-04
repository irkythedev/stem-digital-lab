/**
 * 本地反馈存储：不登录、不联网，适合课堂/局域网使用。
 */
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

export function saveFeedback(record: FeedbackRecord): void {
  if (typeof window === 'undefined') return;
  const records = [...loadFeedback(), record];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
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
