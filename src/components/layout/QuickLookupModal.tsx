/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 全局「/ 口袋速查台」：纯前端内存检索，零网络请求。
 *
 * 设计约束：
 * - 纸墨单色：只用 --fg / --muted / --border / --panel-bg / --card-bg；
 * - 移动端输入框 16px（text-base），避免 iOS 聚焦自动放大；
 * - 顶部固定 12dvh，软键盘弹起时不会把面板顶出视口；
 * - Esc / 点遮罩关闭；↑↓ 选择、Enter 打开；打开期间锁 body 滚动。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, CornerDownLeft, Search } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { useEscapeKey } from '../../lib/use-escape-key';
import { useLockBodyScroll } from '../../lib/use-lock-body-scroll';
import { isComposingEvent } from '../../lib/ime';
import Formula from '../ui/Formula';
import {
  groupLookup,
  searchLookup,
  type LookupItem,
  type LookupKind,
} from '../../lib/quick-lookup';

interface QuickLookupModalProps {
  onClose: () => void;
}

const GROUP_LABEL: Record<LookupKind, { zh: string; en: string }> = {
  lab: { zh: '实验', en: 'Labs' },
  formula: { zh: '公式', en: 'Formulas' },
  compound: { zh: '物质 / 方程式', en: 'Substances' },
  element: { zh: '元素', en: 'Elements' },
};

const GROUP_ORDER: LookupKind[] = ['lab', 'formula', 'compound', 'element'];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export default function QuickLookupModal({ onClose }: QuickLookupModalProps) {
  const { lang } = useApp();
  const zh = lang === 'zh';
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<number | null>(null);

  useEscapeKey(onClose);
  useLockBodyScroll(true);

  const results = useMemo(() => searchLookup(query), [query]);
  const grouped = useMemo(() => groupLookup(results), [results]);
  // 键盘、高亮、hover、Enter 统一使用“渲染顺序”的扁平数组，避免评分顺序与分组顺序错位。
  const orderedResults = useMemo(() => GROUP_ORDER.flatMap((kind) => grouped[kind]), [grouped]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query]);

  // 方向键切换时把当前高亮项滚进视野（不改变弹窗高度）。
  useEffect(() => {
    const activeEl = listRef.current?.querySelector('[aria-selected="true"]') as HTMLElement | null;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [active, orderedResults.length]);

  const hasQuery = query.trim().length > 0;

  useEffect(() => () => {
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
  }, []);

  const activate = (item: LookupItem) => {
    if (item.kind === 'lab' && item.href) {
      navigate(item.href);
      onClose();
      return;
    }
    const text = item.kind === 'element' && item.element
      ? item.element.symbol
      : (item.tex ?? item.title.zh);
    void copyText(text).then((ok) => {
      if (!ok) return;
      setCopiedId(item.id);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopiedId(null), 1200);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(orderedResults.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      if (isComposingEvent(e.nativeEvent)) return;
      e.preventDefault();
      const item = orderedResults[active];
      if (item) activate(item);
    }
  };


  return createPortal(
    <div
      className="fixed inset-0 z-overlay flex items-start justify-center bg-black/45 px-3 backdrop-blur-sm sm:px-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        className="mt-[12dvh] flex max-h-[72dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={zh ? '口袋速查台' : 'Pocket quick lookup'}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 py-2.5 transition-colors focus-within:border-[var(--fg)]/45 sm:px-4">
          <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            type="search"
            inputMode="search"
            autoComplete="off"
            spellCheck={false}
            placeholder={zh ? '搜索实验 / 公式 / 元素，如 浮力、二次函数、Ca' : 'Search labs, formulas, elements — e.g. buoyancy, Ca'}
            aria-label={zh ? '速查关键词' : 'Lookup query'}
            className="quick-lookup-input appearance-none min-w-0 flex-1 border-0 bg-transparent text-base text-[var(--fg)] outline-none ring-0 focus:outline-none focus-visible:outline-none focus:ring-0 placeholder:text-[var(--muted)] sm:text-sm"
          />
          {hasQuery ? (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              aria-label={zh ? '清空搜索' : 'Clear search'}
              className="shrink-0 rounded p-1 text-[var(--muted)] hover:text-[var(--fg)] tap-area"
            >
              <span aria-hidden="true" className="text-sm">×</span>
            </button>
          ) : (
            <>
              <kbd className="hidden shrink-0 rounded border border-[var(--border)] px-1.5 py-0.5 text-[0.5625rem] mono-font text-[var(--muted)] sm:inline">
                ESC
              </kbd>
              <button
                type="button"
                onClick={onClose}
                aria-label={zh ? '关闭' : 'Close'}
                title={zh ? '关闭' : 'Close'}
                className="lab-control-28 h-7 w-7 rounded-md inline-flex items-center justify-center shrink-0 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] ghost-x transition-colors text-lg leading-none"
              >
                <span aria-hidden="true">×</span>
              </button>
            </>
          )}
        </div>

        <div ref={listRef} className="max-h-[min(58dvh,460px)] min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5 sm:px-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs serif-font italic text-[var(--muted)]">
              {zh ? '没有匹配的条目。试试「浮力」「欧姆」「Ca」或公式名。' : 'No match. Try “buoyancy”, “Ohm”, “Ca” or a formula name.'}
            </p>
          ) : (
            GROUP_ORDER.map((kind) => {
              const items = grouped[kind];
              if (items.length === 0) return null;
              return (
                <section key={kind} className="mb-1.5">
                  <h3 className="px-2 pb-1 pt-1 text-[0.5625rem] font-bold uppercase tracking-widest text-[var(--muted)] mono-font">
                    <span aria-hidden="true">// </span>
                    {zh ? GROUP_LABEL[kind].zh : GROUP_LABEL[kind].en}
                  </h3>
                  <ul role="listbox" aria-label={zh ? GROUP_LABEL[kind].zh : GROUP_LABEL[kind].en}>
                    {items.map((item) => {
                      const isActive = orderedResults.indexOf(item) === active;
                      const isCopied = copiedId === item.id;
                      return (
                        <li key={item.id} role="option" aria-selected={isActive}>
                          <button
                            type="button"
                            onMouseEnter={() => setActive(orderedResults.indexOf(item))}
                            onClick={() => activate(item)}
                            className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
                              isActive ? 'bg-[var(--accent-light)]' : 'hover:bg-[var(--accent-light)]/60'
                            }`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium text-[var(--fg)] sm:text-[0.8125rem]">
                                {zh ? item.title.zh : item.title.en}
                              </span>
                              <span className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[0.625rem] mono-font text-[var(--muted)]">
                                {item.tex && item.kind === 'formula' ? (
                                  <Formula tex={item.tex} className="text-[0.7rem]" />
                                ) : (
                                  <span className="truncate">{zh ? item.subtitle.zh : item.subtitle.en}</span>
                                )}
                              </span>
                            </span>
                            {isCopied ? (
                              <span className="flex shrink-0 items-center gap-1 text-[0.5625rem] mono-font text-[var(--fg)]" aria-live="polite">
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                <span className="hidden sm:inline">{zh ? '已复制' : 'Copied'}</span>
                              </span>
                            ) : item.kind === 'element' && item.element ? (
                              <span className="shrink-0 text-right">
                                <span className="block text-sm font-semibold mono-font tabular-nums text-[var(--fg)]">{item.element.symbol}</span>
                                <span className="block text-[0.5625rem] mono-font tabular-nums text-[var(--muted)]">{item.element.mass ?? '—'}</span>
                              </span>
                            ) : (
                              <span className="shrink-0 text-[var(--muted)]" aria-hidden="true">
                                {item.kind === 'lab' ? <CornerDownLeft className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          )}
        </div>

        <div className="hidden shrink-0 items-center justify-between border-t border-[var(--border)] px-3 py-1.5 text-[0.5625rem] mono-font text-[var(--muted)] sm:flex">
          <span>{zh ? '↑↓ 选择 · Enter 打开 / 复制 · Esc 关闭' : '↑↓ select · Enter open/copy · Esc close'}</span>
          <span className="tabular-nums">{orderedResults.length}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
