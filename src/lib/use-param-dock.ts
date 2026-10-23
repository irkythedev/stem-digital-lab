/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 参数抽屉（ParamDock）的状态机。三态由两个输入派生，不另存第二份状态：
 *   - 断点（<640px）：false → hidden（桌面平铺，零额外 DOM）
 *   - 手动开关 manualOpen + AI 面板是否打开 aiOpen：窄屏下 manualOpen && !aiOpen → open，否则 collapsed
 * AI 面板一旦打开（问 AI / 考考你 / 顶栏）即强制收起抽屉，避免两个底部面板抢位。
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useAiContext } from './ai-context';

export type ParamDockState = 'hidden' | 'collapsed' | 'open';

const NARROW_QUERY = '(max-width: 639px)';

function subscribeNarrow(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const mq = window.matchMedia(NARROW_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function readNarrow(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(NARROW_QUERY).matches;
}

export function useParamDock(): { state: ParamDockState; isNarrow: boolean; aiOpen: boolean; open: () => void; close: () => void } {
  const isNarrow = useSyncExternalStore(subscribeNarrow, readNarrow, () => false);
  const { open: aiOpen } = useAiContext();
  const [manualOpen, setManualOpen] = useState(false);

  // 切到桌面、或 AI 面板打开：一律收起（联动 close，不留残留开关）
  useEffect(() => {
    if (!isNarrow || aiOpen) setManualOpen(false);
  }, [isNarrow, aiOpen]);

  const state: ParamDockState = !isNarrow ? 'hidden' : manualOpen && !aiOpen ? 'open' : 'collapsed';
  const open = useCallback(() => setManualOpen(true), []);
  const close = useCallback(() => setManualOpen(false), []);
  return { state, isNarrow, aiOpen, open, close };
}
