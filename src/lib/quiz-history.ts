/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 考考你（Quiz）答题历史 —— 纯浏览器本地持久化（localStorage）。
 * 独立于问答历史（stem-ai-history）：错题集 + 正确率统计的数据底座。
 *
 * 隐私承诺：
 * - 数据仅存用户本机浏览器，不触网、不上传、不中转；
 * - 与 stem-ai-config 同生命周期：用户清除浏览器数据即一并清除；
 * - 容量上限 100 条，超出丢最旧。
 */

import { loadStorageLimit } from './ai-storage-limit';

export interface QuizHistoryEntry {
  /** 时间戳36进制 + 随机36进制 */
  id: string;
  /** 作答完成时间（ms） */
  ts: number;
  /** 来源页面完整路径（含 query） */
  path: string;
  /** 科目（数学/物理/化学…，页面语言对应） */
  subject: string;
  /** 页面主题（如「凸透镜成像」） */
  topic: string;
  /** 题干（可能含 LaTeX 公式） */
  question: string;
  /** 四个选项 */
  options: string[];
  /** 正确选项下标（0-3；解析失败为 -1） */
  answerIdx: number;
  /** 学生选择的下标（0-3） */
  pickedIdx: number;
  /** 是否答对 */
  correct: boolean;
  /** 题型：choice（四选一）/ fill（填空）；老数据缺省 choice */
  type?: 'choice' | 'fill';
  /** 填空标准答案（可多个等价写法；选择题为空） */
  fillAnswers?: string[];
  /** 学生填空输入（选择题为空字符串） */
  userAnswer?: string;
  /** AI 解析讲解（为什么对/错；旧数据可能没有该字段） */
  explanation?: string;
  /** 每题限时（秒；0/缺省 = 不限时） */
  timeLimit?: number;
  /** 实际作答用时（秒） */
  elapsedMs?: number;
  /** 是否超时判错（超时 = 未答 = 错） */
  timedOut?: boolean;
  /** 所用模型名 */
  model: string;
}

export const QUIZ_HISTORY_STORAGE_KEY = 'stem-quiz-history';
const STORAGE_KEY = QUIZ_HISTORY_STORAGE_KEY;
/** 记录默认容量上限：保留最近 100 条（实际以 loadStorageLimit() 用户档位为准） */
export const QUIZ_HISTORY_LIMIT = 100;

/** 读取记录（损坏/异常一律返回空数组，绝不让数据拖垮面板） */
export function listQuizHistory(): QuizHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr as QuizHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** 仅错题（答错或未判分的记录） */
export function wrongQuizHistory(): QuizHistoryEntry[] {
  return listQuizHistory().filter((e) => !e.correct);
}

/** 写入一条作答记录（每次作答完成时调用） */
export function saveQuizHistory(entry: Omit<QuizHistoryEntry, 'id' | 'ts'>): void {
  if (typeof window === 'undefined') return;
  const item: QuizHistoryEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    ts: Date.now(),
    ...entry,
  };
  const list = listQuizHistory();
  const limit = loadStorageLimit();
  // 简单去重：同一 id 不重复写入
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
export function trimQuizHistoryToLimit(limit: number): { kept: number; removed: number } {
  if (typeof window === 'undefined') return { kept: 0, removed: 0 };
  const list = listQuizHistory();
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

/** 清空全部记录（只清考考你历史，不动配置与问答历史） */
export function clearQuizHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 静默
  }
}

/**
 * 错题按题干聚合：同一道题（题干去空白后相同）多次答错只保留最新一次，并累计 repeatCount。
 * 输入应已按时间倒序（新→旧），首个出现即最新记录；输出顺序与首次出现顺序一致。
 * 纯函数，供「错题集」视图去重刷屏展示（导出/统计仍用全量记录，不受影响）。
 */
export function groupQuizByQuestion(
  entries: QuizHistoryEntry[],
): Array<QuizHistoryEntry & { repeatCount: number }> {
  const map = new Map<string, QuizHistoryEntry & { repeatCount: number }>();
  for (const e of entries) {
    // 聚合键必须带学科/知识点：不同学科常出现「下列说法正确的是？」这类同题干，
    // 只按题干合并会把物理题与数学题误并成一张卡、隐藏真实错题（评审 Important）。
    const key = `${e.subject || ''}|${(e.topic || '').replace(/[（(].*?[）)]/g, '')}|${(e.question || '').replace(/\s+/g, '').trim()}`;
    const prev = map.get(key);
    if (prev) prev.repeatCount += 1;
    else map.set(key, { ...e, repeatCount: 1 });
  }
  return [...map.values()];
}
