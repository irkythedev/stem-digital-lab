/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 本地存储用量统计（纯函数，无副作用）。
 *
 * 实时统计「问答历史 / 错题记录」的条数、上限，以及两项在 localStorage 中占用的
 * 真实 UTF-8 字节数（TextEncoder 编码 JSON 原文；环境无 TextEncoder 时回退 UTF-16 估算）。
 * 供设置面板「本地数据管理」直观展示空间占用。
 */
import { HISTORY_STORAGE_KEY, listHistory } from './ai-history';
import { QUIZ_HISTORY_STORAGE_KEY, listQuizHistory } from './quiz-history';
import { formatStorageBytes, loadStorageLimit } from './ai-storage-limit';

export interface StorageUsageStats {
  /** 问答历史条数 */
  historyCount: number;
  /** 错题记录条数 */
  quizCount: number;
  /** 当前用户保留上限（两条链共用同一档位） */
  limit: number;
  /** 问答历史原文 UTF-8 字节数 */
  historyBytes: number;
  /** 错题记录原文 UTF-8 字节数 */
  quizBytes: number;
  /** 两项合计字节数 */
  totalBytes: number;
  /** 合计字节数的可读文本（如 "12.3 KB"） */
  totalText: string;
  /** 问答历史占用比（count/limit，0..1+） */
  historyRatio: number;
  /** 错题记录占用比（count/limit，0..1+） */
  quizRatio: number;
}

/** UTF-8 字节长度：优先 TextEncoder；无则按 UTF-16（每字符 2 字节）估算。 */
function byteLength(text: string): number {
  const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  return enc ? enc.encode(text).length : text.length * 2;
}

function rawBytes(key: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    return byteLength(window.localStorage.getItem(key) ?? '');
  } catch {
    return 0;
  }
}

/** 实时统计本地存储用量（条数 / 上限 / 字节）。 */
export function getStorageUsageStats(): StorageUsageStats {
  const historyCount = listHistory().length;
  const quizCount = listQuizHistory().length;
  const limit = loadStorageLimit();
  const historyBytes = rawBytes(HISTORY_STORAGE_KEY);
  const quizBytes = rawBytes(QUIZ_HISTORY_STORAGE_KEY);
  const totalBytes = historyBytes + quizBytes;
  const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);
  return {
    historyCount,
    quizCount,
    limit,
    historyBytes,
    quizBytes,
    totalBytes,
    totalText: formatStorageBytes(totalBytes),
    historyRatio: safeDiv(historyCount, limit),
    quizRatio: safeDiv(quizCount, limit),
  };
}
