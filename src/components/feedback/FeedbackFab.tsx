/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 全局浮动反馈气泡：固定在右下角（常见交互方式）。
 * 根据当前路由自动切换类型——实验页 → 实验反馈（带 labId），其他页 → 项目反馈。
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import FeedbackPanel from './FeedbackPanel';
import { useApp } from '../../lib/app-context';
import { NARROW_QUERY } from '../../lib/use-param-dock';
import { labMap } from '../../lib/labs';
import type { FeedbackType } from '../../lib/feedback';

export default function FeedbackFab() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(NARROW_QUERY).matches);
  const fabRef = useRef<HTMLButtonElement>(null);
  const { lang } = useApp();
  const { pathname } = useLocation();

  useEffect(() => {
    const mq = window.matchMedia?.(NARROW_QUERY);
    if (!mq) return;
    const update = () => {
      setIsNarrow(mq.matches);
      if (!mq.matches) setExpanded(false);
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    setExpanded(false);
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isNarrow || !expanded || open) return;
    const collapse = () => setExpanded(false);
    const timer = window.setTimeout(collapse, 3500);
    const onScroll = () => collapse();
    const onPointerDown = (e: PointerEvent) => {
      if (!fabRef.current?.contains(e.target as Node)) collapse();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [isNarrow, expanded, open]);

  // 实验页：/lab/:labId → 实验反馈；其余 → 项目反馈
  const labMatch = pathname.match(/^\/lab\/([^/]+)/);
  const labId = labMatch ? labMatch[1] : undefined;
  const type: FeedbackType = labId && labMap[labId] ? 'experiment' : 'project';

  const label = type === 'experiment'
    ? (lang === 'zh' ? '实验反馈' : 'Experiment feedback')
    : (lang === 'zh' ? '项目反馈' : 'Project feedback');

  return (
    <>
      {open && <FeedbackPanel type={type} labId={labId} onClose={() => { setOpen(false); setExpanded(false); }} />}
      <button
        ref={fabRef}
        type="button"
        onClick={() => {
          if (!isNarrow) {
            setOpen((v) => !v);
          } else if (!expanded) {
            setExpanded(true);
          } else {
            setOpen(true);
          }
        }}
        aria-label={label}
        title={label}
        aria-expanded={open}
        data-docked={isNarrow && !expanded ? 'true' : 'false'}
        className={`feedback-fab fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-4 sm:right-6 z-sticky-layer flex items-center justify-center w-12 h-12 rounded-full border border-[var(--border)]/80 bg-[var(--card-bg)]/85 backdrop-blur-md text-[var(--fg)] shadow-[var(--elev-md)] transition-[background-color,box-shadow,transform] duration-[var(--dur-fast)] active:scale-95 touch-manipulation hover:bg-[var(--accent-light)] select-none ${
          isNarrow
            ? `max-sm:bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] max-sm:duration-200 max-sm:transition-[transform,opacity,background-color,box-shadow] ${
                expanded
                  ? 'max-sm:right-4 max-sm:translate-x-0 max-sm:opacity-100'
                  : 'max-sm:right-0 max-sm:translate-x-[62%] max-sm:opacity-60'
              }`
            : ''
        }`}
      >
        <MessageSquare className="w-5 h-5" />
      </button>
    </>
  );
}
