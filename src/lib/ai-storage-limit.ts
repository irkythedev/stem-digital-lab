/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 本地历史保留上限配置（纯浏览器 localStorage，独立键）。
 *
 * 与问答历史 / 错题记录分开存一个键，避免把「保留上限」塞进 AI 配置对象（后者只在
 * 用户配置过模型后才存在，而历史可能先于配置产生）。默认 100 条，与改造前一致。
 */

/** 安全档位：只允许这四个值，避免用户写入任意数字把存储撑爆或一条都不留。 */
export const STORAGE_LIMIT_OPTIONS = [30, 100, 300, 500] as const;
export type StorageLimitOption = (typeof STORAGE_LIMIT_OPTIONS)[number];

/** 默认保留上限（与改造前写死的 100 条保持一致，历史数据不因升级而突变）。 */
export const DEFAULT_STORAGE_LIMIT = 100;

const STORAGE_KEY = 'stem-storage-limit';

/** 判断是否合法档位（同时收窄类型，供 UI 与存储层复用）。 */
export function isStorageLimitOption(v: unknown): v is StorageLimitOption {
  return typeof v === 'number' && (STORAGE_LIMIT_OPTIONS as readonly number[]).includes(v);
}

/** 读取当前保留上限；损坏 / 非法 / 未设置一律回退默认值（绝不让坏值影响存储）。 */
export function loadStorageLimit(): number {
  if (typeof window === 'undefined') return DEFAULT_STORAGE_LIMIT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STORAGE_LIMIT;
    const n = Number(raw);
    return isStorageLimitOption(n) ? n : DEFAULT_STORAGE_LIMIT;
  } catch {
    return DEFAULT_STORAGE_LIMIT;
  }
}

/** 写入保留上限：非法档位直接忽略（不写坏值）。 */
export function saveStorageLimit(limit: number): void {
  if (typeof window === 'undefined') return;
  if (!isStorageLimitOption(limit)) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(limit));
  } catch {
    /* 隐私模式 / 配额异常：静默，上限保持旧值 */
  }
}

/** 字节格式化：< 1024 显示 B，否则 X.X KB（统一一位小数）。 */
export function formatStorageBytes(bytes: number): string {
  const b = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (b < 1024) return `${b} B`;
  return `${(b / 1024).toFixed(1)} KB`;
}
