/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 减动效偏好：`prefers-reduced-motion: reduce` 的 React 订阅。
 *
 * 为什么不用一次性 matchMedia：系统偏好可以在页面打开期间切换（macOS 辅助功能、
 * Windows 动画开关），一次性读取会让「已经打开的演示」继续逐帧跑。
 * 用 useSyncExternalStore 与 use-param-dock 的窄屏订阅同范式，SSR 回退 false。
 */
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
