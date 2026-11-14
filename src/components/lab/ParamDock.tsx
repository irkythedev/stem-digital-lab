/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 移动端参数抽屉：窄屏（<640px）把超屏的参数卡收进底部半屏抽屉，画布留在上半屏。
 * - hidden（桌面）：直接平铺 children，不挂任何额外节点
 * - collapsed：只渲染底部胶囊「⚙ 调节参数 · 摘要」，children 不挂载（单份 DOM）
 * - open：children 通过 portal 挂到 body 的抽屉里；上方透明遮罩点击收起；把手可下拉收起
 * 展开时把 anchorRef（画布卡）滚到视口顶部，保证电表/电路在抽屉上方可见。
 */
import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal } from 'lucide-react';
import { useParamDock } from '../../lib/use-param-dock';
import { useEscapeKey } from '../../lib/use-escape-key';
import { useFocusReturn } from '../../lib/use-focus-return';
import { useLockBodyScroll } from '../../lib/use-lock-body-scroll';

interface ParamDockProps {
  children: ReactNode;
  /** 胶囊上的摘要（如「6.0V / 10Ω」），收起时也能看到当前数值 */
  summary: string;
  /** 展开时滚到顶部的画布卡 */
  anchorRef?: RefObject<HTMLElement | null>;
  title: string;
  closeLabel: string;
  /** 下拉收起的阈值（px） */
  dismissPx?: number;
  /** 预测阶段不挂载参数抽屉（连 portal 胶囊也不渲染） */
  disabled?: boolean;
  /** 移动端且非探索阶段时隐藏胶囊与参数卡；桌面端仍平铺参数卡 */
  disabledMobile?: boolean;
  /** 移动端探索阶段把收起胶囊放回文档流，避免固定浮层压住 I-U 图像 */
  inlineCollapsed?: boolean;
}

export default function ParamDock({ children, summary, anchorRef, title, closeLabel, dismissPx = 80, disabled = false, disabledMobile = false, inlineCollapsed = false }: ParamDockProps) {
  const dock = useParamDock();
  useLockBodyScroll(dock.state === 'open');
  const [dragDy, setDragDy] = useState(0);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const suppressClick = useRef(false);

  // 挂载标记：让 CSS 只给「装了参数抽屉」的实验页补底部安全区。
  // 用 <html> 类而不是给每个实验页加 pb-* —— 未装抽屉的 14 个实验必须零改动。
  useEffect(() => {
    if (disabled || (disabledMobile && dock.isNarrow)) return;
    const cls = document.documentElement.classList;
    cls.add('param-dock-mounted');
    return () => cls.remove('param-dock-mounted');
  }, [disabled, disabledMobile, dock.isNarrow]);

  // 展开期间：反馈气泡淡出（CSS 按 html 类名控制）
  useEffect(() => {
    const cls = document.documentElement.classList;
    if (dock.state === 'open') cls.add('param-dock-open');
    else cls.remove('param-dock-open');
    return () => cls.remove('param-dock-open');
  }, [dock.state]);

  // 展开期间 Esc 收起（走浮层栈：同时开着别的浮层时，只退最后打开的那一层）
  useEscapeKey(() => dock.close(), dock.state === 'open');

  /* 抽屉是模态的（上半屏有透明拦截层），所以打开时把焦点搬进抽屉、关闭时还给胶囊：
     否则键盘用户点开抽屉后，Tab 还在背后的画布上转圈，压根进不来。 */
  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusReturn(dock.state === 'open');
  useEffect(() => {
    if (dock.state === 'open') sheetRef.current?.focus({ preventScroll: true });
  }, [dock.state]);

  // 展开时把画布卡滚到视口顶部（略留 12px），抽屉只盖住下半屏
  useEffect(() => {
    if (dock.state !== 'open' || !anchorRef?.current) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const top = anchorRef.current.getBoundingClientRect().top + window.scrollY - 12;
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
  }, [dock.state, anchorRef]);

  if (disabled) return null;
  if (disabledMobile && dock.isNarrow) return null;

  // 桌面：原样平铺，零额外节点
  if (dock.state === 'hidden') return <>{children}</>;

  // 收起：占位 + 底部胶囊（children 不挂载，保证全页只有一份参数 DOM）。
  // AI 面板打开时胶囊整体让位（不渲染），避免它被压在 AI 遮罩下面。
  if (dock.state === 'collapsed') {
    if (dock.aiOpen) return null;
    const collapsedButton = (
      <button
        type="button"
        onClick={dock.open}
        aria-label={title}
        aria-expanded={false}
        className={inlineCollapsed
          ? 'flex h-12 w-full items-center justify-between gap-3 rounded-full border border-[var(--border)]/80 bg-[var(--card-bg)]/90 px-4 text-xs mono-font text-[var(--fg)] shadow-[var(--elev-md)] backdrop-blur-md touch-manipulation select-none transition-transform duration-[var(--dur-fast)] active:scale-[0.98]'
          : 'fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] left-4 right-[4.5rem] z-sticky-layer flex h-12 items-center justify-between gap-3 rounded-full border border-[var(--border)]/80 bg-[var(--card-bg)]/90 px-4 text-xs mono-font text-[var(--fg)] shadow-[var(--elev-md)] backdrop-blur-md touch-manipulation select-none transition-transform duration-[var(--dur-fast)] active:scale-[0.98]'}
      >
        <span className="inline-flex shrink-0 items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </span>
        <span className="min-w-0 flex-1 truncate text-right tabular-nums text-[var(--muted)]">{summary}</span>
      </button>
    );
    return (
      <>
        <div aria-hidden="true" className="hidden" />
        {inlineCollapsed ? collapsedButton : createPortal(collapsedButton, document.body)}
      </>
    );
  }

  // 展开：上方透明遮罩（点击收起）+ 底部抽屉
  const onHandleDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = { y: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    drag.current.dy = dy;
    setDragDy(dy);
  };
  const onHandleUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragDy(0);
    if (d && d.dy > 4) suppressClick.current = true;
    if (d && d.dy > dismissPx) dock.close();
  };

  return createPortal(
    <>
      <div
        aria-hidden="true"
        onClick={dock.close}
        className="fixed inset-x-0 top-0 bottom-[50dvh] z-sticky-layer touch-none"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="param-sheet fixed inset-x-0 bottom-0 z-overlay flex max-h-[50dvh] flex-col rounded-t-xl border-t border-[var(--border)] bg-[var(--bg)] shadow-[var(--elev-up)] pb-[env(safe-area-inset-bottom,0px)] focus:outline-none"
        style={{ transform: dragDy ? `translateY(${dragDy}px)` : undefined, transition: dragDy ? 'none' : undefined }}
      >
        <button
          type="button"
          aria-label={closeLabel}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            dock.close();
          }}
          className="flex h-7 w-full shrink-0 touch-none items-center justify-center"
        >
          <span className="h-1 w-10 rounded-full bg-[var(--border)]" aria-hidden="true" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pt-0">{children}</div>
      </div>
    </>,
    document.body,
  );
}
