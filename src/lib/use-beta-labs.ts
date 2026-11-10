/**
 * Beta 实验预览的本地状态。
 *
 * 约定：
 * - localStorage key = `stemlab:show-beta`，默认 false；
 * - URL `?beta=1` 自动开启并持久化；
 * - 直接打开任一 beta 实验详情页时自动解锁（unlockBetaLabs），不拦截路由。
 * 全部读取路径均对 SSR/静态构建安全。
 */
import { useCallback, useEffect, useState } from 'react';

export const BETA_LABS_STORAGE_KEY = 'stemlab:show-beta';
const BETA_CHANGE_EVENT = 'stemlab:beta-change';

function canUseDom(): boolean {
  return typeof window !== 'undefined';
}

function readStoredBeta(): boolean {
  if (!canUseDom()) return false;
  try {
    return window.localStorage.getItem(BETA_LABS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStoredBeta(next: boolean): void {
  if (!canUseDom()) return;
  try {
    if (next) window.localStorage.setItem(BETA_LABS_STORAGE_KEY, '1');
    else window.localStorage.removeItem(BETA_LABS_STORAGE_KEY);
  } catch {
    // 隐私模式/禁用 localStorage 时静默降级；不影响实验路由访问。
  }
  window.dispatchEvent(new Event(BETA_CHANGE_EVENT));
}

/** 页面初次挂载时读取：URL `?beta=1` 优先并写回本地。 */
export function readBetaLabsInitial(): boolean {
  if (!canUseDom()) return false;
  try {
    const beta = new URLSearchParams(window.location.search).get('beta');
    if (beta === '1') {
      writeStoredBeta(true);
      return true;
    }
    if (beta === '0') {
      writeStoredBeta(false);
      return false;
    }
  } catch {
    // ignore malformed URL
  }
  return readStoredBeta();
}

/** 深链访问 beta 实验时自动解锁，保证返回学科页后仍能看到它。 */
export function unlockBetaLabs(): void {
  writeStoredBeta(true);
}

export function useBetaLabs(): { showBeta: boolean; setShowBeta: (next: boolean) => void } {
  const [showBeta, setShowBetaState] = useState<boolean>(() => readBetaLabsInitial());

  useEffect(() => {
    if (!canUseDom()) return;
    // 同页其他组件（详情页深链解锁）通过自定义事件同步。
    const onCustom = () => setShowBetaState(readStoredBeta());
    const onStorage = (event: StorageEvent) => {
      if (event.key === BETA_LABS_STORAGE_KEY) setShowBetaState(event.newValue === '1');
    };
    window.addEventListener(BETA_CHANGE_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(BETA_CHANGE_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setShowBeta = useCallback((next: boolean) => {
    writeStoredBeta(next);
    setShowBetaState(next);
    if (canUseDom()) {
      try {
        const url = new URL(window.location.href);
        if (next) url.searchParams.set('beta', '1');
        else url.searchParams.delete('beta');
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      } catch {
        // ignore
      }
    }
  }, []);

  return { showBeta, setShowBeta };
}
