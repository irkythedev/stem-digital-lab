/**
 * 轻量实验 URL 状态契约。
 *
 * - read 阶段：SSR/静态预渲染安全（window 不存在时返回空参数）；
 * - run 阶段：只通过 history.replaceState 静默更新，不制造浏览器后退历史；
 * - 白名单字段 + 默认值省略，保持默认进入实验时 URL 干净。
 */
import { useEffect } from 'react';

export type UrlValue = string | number | boolean | null | undefined;

export function readUrlParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

/** 数字解析：NaN/空值回退；越界钳制；可选步进对齐与禁止 0（a、k）。 */
export function numParam(
  raw: string | null | undefined,
  fallback: number,
  min: number,
  max: number,
  opts: { step?: number; disallowZero?: boolean } = {},
): number {
  if (raw === null || raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  if (opts.disallowZero && Math.abs(n) < 1e-9) return fallback;
  let v = Math.min(max, Math.max(min, n));
  if (opts.step && Number.isFinite(opts.step) && opts.step > 0) {
    v = Math.round(v / opts.step) * opts.step;
    v = Math.min(max, Math.max(min, v));
  }
  return v;
}

/** 枚举解析：不在白名单时回退。 */
export function enumParam<T extends string>(
  raw: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return raw !== null && raw !== undefined && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/** boolean 解析：URL 兼容 1/0、true/false、on/off。 */
export function boolParam(raw: string | null | undefined, fallback: boolean): boolean {
  if (raw === null || raw === undefined) return fallback;
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'on', 'yes'].includes(v)) return true;
  if (['0', 'false', 'off', 'no'].includes(v)) return false;
  return fallback;
}

/** 纯函数：根据白名单值和默认值生成规范 query string（默认值省略）。 */
export function buildLabSearch(
  values: Record<string, UrlValue>,
  defaults: Record<string, UrlValue> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    const fallback = defaults[key];
    const same =
      value === fallback ||
      (typeof value === 'number' && typeof fallback === 'number' && Math.abs(value - fallback) < 1e-9) ||
      (typeof value === 'boolean' && typeof fallback === 'boolean' && value === fallback);
    if (same) continue;
    params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  return params.toString();
}

/** 静默写 URL；保留未知参数，不 pushState。 */
export function syncLabUrl(
  values: Record<string, UrlValue>,
  defaults: Record<string, UrlValue> = {},
): void {
  if (typeof window === 'undefined') return;
  const nextSearch = buildLabSearch(values, defaults);
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

/** 在实验中把当前白名单值静默同步到地址栏。deps 显式传入，保持滑块 60fps 路径轻量。 */
export function useLabUrlSync(
  values: Record<string, UrlValue>,
  defaults: Record<string, UrlValue>,
  deps: readonly unknown[],
  delayMs = 100,
): void {
  useEffect(() => {
    // 轻微防抖：滑块高频事件不阻塞 60fps；分享前用户通常已松手/停留。
    const timer = setTimeout(() => syncLabUrl(values, defaults), delayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
