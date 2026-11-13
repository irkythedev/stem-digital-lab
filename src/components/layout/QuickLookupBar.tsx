/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 移动端专属速查条（<768px）：首页与学科页顶部使用；实验页保持沉浸不出现。
 */
import { useState } from 'react';
import { Search } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import QuickLookupModal from './QuickLookupModal';

export default function QuickLookupBar() {
  const { lang } = useApp();
  const [open, setOpen] = useState(false);
  const zh = lang === 'zh';
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden mb-4 inline-flex w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--panel-bg)]/40 px-3 py-2 text-left text-xs text-[var(--muted)] transition-colors hover:border-[var(--fg)]/40 hover:text-[var(--fg)]"
      >
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1">{zh ? '速查实验 / 公式 / 元素' : 'Search labs, formulas, elements'}</span>
        <kbd className="rounded border border-[var(--border)] px-1 font-mono text-[10px]">/</kbd>
      </button>
      {open && <QuickLookupModal onClose={() => setOpen(false)} />}
    </>
  );
}
