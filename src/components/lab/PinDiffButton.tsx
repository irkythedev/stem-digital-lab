/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 通用「定格对照」：桌面端在实验动作簇提供一个 h-7 的 Pin 微按钮，
 * 定格后以固定底部胶囊展示「定格值 → 当前值」。移动端不新增顶栏按钮，
 * 数学函数实验沿用画布内已有的 Pin 按钮与虚线残影。
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pin, X } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { getLabState } from '../../lib/ai-dynamic-questions';
import { snapshotSummary } from '../../lib/lab-snapshot';

const HAS_OWN_PIN = new Set(['quadratic', 'linear', 'inverse']);

export default function PinDiffButton({ labId }: { labId: string }) {
  const { lang } = useApp();
  const [pinned, setPinned] = useState<Record<string, unknown> | null>(null);
  const [current, setCurrent] = useState<Record<string, unknown> | undefined>(undefined);

  useEffect(() => {
    if (!pinned) return;
    setCurrent(getLabState(labId));
    const id = window.setInterval(() => setCurrent(getLabState(labId)), 400);
    return () => window.clearInterval(id);
  }, [pinned, labId]);

  if (HAS_OWN_PIN.has(labId)) return null;

  const zh = lang === 'zh';
  const pinnedText = pinned ? snapshotSummary({ labId, state: pinned, lang }) : '';
  const currentText = current ? snapshotSummary({ labId, state: current, lang }) : '';

  return (
    <>
      <button
        type="button"
        onClick={() => setPinned((v) => (v ? null : (getLabState(labId) ?? {})))}
        aria-pressed={Boolean(pinned)}
        title={zh ? '定格对照' : 'Pin readings'}
        className={`compact hidden h-7 items-center gap-1 rounded border px-2 text-[0.625rem] mono-font transition-colors sm:inline-flex ${
          pinned
            ? 'border-[var(--fg)] bg-[var(--fg)] text-[var(--card-bg)]'
            : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
        }`}
      >
        <Pin className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden lg:inline">{zh ? '定格对照' : 'Pin'}</span>
      </button>
      {pinned && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-3 left-3 z-tooltip flex max-w-[calc(100vw-1.5rem)] items-center gap-1.5 rounded border border-[var(--fg)] bg-[var(--card-bg)] px-2 py-1 text-[0.625rem] mono-font tabular-nums text-[var(--fg)] shadow-sm">
          <span className="truncate">
            <span aria-hidden="true">// </span>
            {zh ? '定格对照: ' : 'pinned: '}
            {pinnedText} → {currentText}
          </span>
          <button
            type="button"
            onClick={() => setPinned(null)}
            aria-label={zh ? '清除定格' : 'Clear pin'}
            className="shrink-0 rounded p-0.5 text-[var(--muted)] hover:text-[var(--fg)]"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
