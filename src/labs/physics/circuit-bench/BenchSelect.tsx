/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 应用内下拉（替代浏览器原生 `<select>`）
 *
 * 为什么不用原生：见 `circuit-bench-select.ts` 抬头——系统弹层带不进全站令牌、
 * 行高在红外屏上点不准、触屏上还会飘到屏幕中央盖住学生正在看的图。
 *
 * 为什么弹层要走 createPortal：面板可能停在「数据记录」的磨砂抽屉里
 * （`backdrop-blur-md` + `overflow-auto`），这两条都会成为 fixed 定位的
 * containing block / 裁剪框，弹层会被切一半、或者跟着抽屉一起滚走。
 * 挂到 body 上才与右键菜单一样「贴指针、贴视口、不被祖先裁」。
 *
 * 弹层里的一行是两列：左边 `label`（元件名，被截断的那一半）、右边 `hint`
 * （物理量与单位，`shrink-0` 不许挤）；触发器只显示 `short`——一行装不下两列，
 * 硬塞进去只会截成「灯泡 L₁ · 电…」。
 *
 * 无障碍按 WAI-ARIA 的 select-only combobox 写：触发器报 `aria-haspopup="listbox"`
 * 与 `aria-expanded`，弹层是 `role="listbox"`，每项 `role="option"` 带 `aria-selected`，
 * 高亮项用 `aria-activedescendant` 指出去——屏幕阅读器念的是「横轴，电流 A (A)，已选中」，
 * 而不是原生下拉在没有 `<label for>` 时那种「列表框」。
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

import { dropdownPosition, nextActiveIndex, optionIndexOf, type SelectOption } from './circuit-bench-select';
import { TOUCH_GUARD } from './circuit-bench-touch';

export interface BenchSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** 无障碍名：原生 select 靠外层 label，自绘下拉必须自己报出「横轴」这类名字。 */
  ariaLabel: string;
  /** 触发器前面的小字标签（横轴 / 纵轴）；没有就不显示。 */
  label?: string;
  title?: string;
  disabled?: boolean;
  /** 紧凑档：详细参数面板里夹在若干数字输入之间的一行（h-7 / 10px）。 */
  dense?: boolean;
  /** 触发器附加类：给宽度上限（max-w-[150px]）或撑满（w-full）。 */
  className?: string;
  /** 空列表时的占位，默认「—」。 */
  placeholder?: string;
  /**
   * 悬停某一项时把它的值报出去（离开列表报 null）。
   *
   * 数据记录面板靠它把「正在看哪一块表」送回画布做轮廓微光：一堆 A/V/G 摆在
   * 同一张图上时，光看下拉里的 `电压表 V₁` 根本不知道指的是哪一只。
   * 值用 null 表示「高亮取消」，所以任何关闭路径都必须清一次。
   */
  onOptionHover?: (value: string | null) => void;
}

/** 常规档：与「记录当前读数 / CSV / 清空」一排按钮同为 h-8。 */
const TRIGGER =
  'compact flex h-8 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--accent-light)] px-1.5 text-xs text-[var(--fg)] transition-colors hover:border-[var(--accent)] disabled:opacity-45';
/** 紧凑档：h-7 / 10px，贴在详细参数面板的小字标签下。 */
const TRIGGER_DENSE =
  'compact flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--accent-light)] px-1.5 text-[10px] text-[var(--fg)] transition-colors hover:border-[var(--accent)] disabled:opacity-45';

export default function BenchSelect({
  value,
  options,
  onChange,
  ariaLabel,
  label,
  title,
  disabled = false,
  dense = false,
  className = '',
  placeholder = '—',
  onOptionHover,
}: BenchSelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number; w: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // SVG/ARIA 的 id 要能安全进 HTML 与 querySelector：useId 的冒号得洗掉。
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const listId = `bench-select-${uid}`;
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const current = options.find((o) => o.value === value) ?? null;
  const empty = options.length === 0;

  const close = (refocus = true) => {
    setOpen(false);
    // Esc / 回车关闭后把焦点还给触发器：键盘用户不该被丢回页面开头。
    if (refocus) btnRef.current?.focus({ preventScroll: true });
  };

  const openAt = () => {
    const idx = optionIndexOf(options, value);
    setActive(idx < 0 ? 0 : idx); // 高亮直接停在当前项，展开即所见
    setPos(null);
    setOpen(true);
  };

  const commit = (next: string) => {
    onChange(next);
    close();
  };

  // 键盘监听要读的最新值统统收进 ref：下面的 keydown 副作用因此只依赖 open，
  // 父组件每次重渲染（options 是新数组、onChange 是新函数）都不会把它摘下来重挂。
  // 实测过不这么做的后果：全局 Esc（取消选中）触发的同步重渲染会在一次按键的派发
  // 途中把监听器摘掉，于是「刚打开下拉就按 Esc」的第一下必然白按。
  const latest = useRef({ options, active, onChange, close });
  useLayoutEffect(() => {
    latest.current = { options, active, onChange, close };
  });

  // 悬停回调同样收进 ref（理由同上）；关闭路径一律清空：Esc、选中、点外、Tab
  // 都只把弹层收掉，不经过统一出口，所以这里盯的是 open 本身。
  const hover = useRef(onOptionHover);
  useLayoutEffect(() => {
    hover.current = onOptionHover;
  });
  useEffect(() => {
    if (!open) hover.current?.(null);
  }, [open]);
  useEffect(() => () => hover.current?.(null), []);

  // 先量再摆：弹层宽度由内容决定，只有渲染出来才知道，所以第一帧先藏（visibility），
  // 量完再定位。滚祖先容器（如磨砂抽屉内部滚动）也要跟着走，用捕获阶段的 scroll 兜住。
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const btn = btnRef.current;
      const panel = panelRef.current;
      if (!btn || !panel) return;
      const a = btn.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      const next = dropdownPosition(
        { x: a.left, y: a.top, w: a.width, h: a.height },
        { w: p.width, h: p.height },
        { w: window.innerWidth, h: window.innerHeight },
      );
      setPos({ x: next.x, y: next.y, w: next.w });
    };
    const onScroll = (e: Event) => {
      // 弹层自己内部的滚动不该重算位置（否则滚到自己就抖）。
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      place();
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  // 点外关闭走捕获阶段：面板里的按钮若在冒泡里 stopPropagation，捕获阶段仍然先到。
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (btnRef.current?.contains(t) || panelRef.current?.contains(t))) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [open]);

  // 键盘接管挂在 window 的捕获阶段：触发器失焦（某些浏览器点按钮不给焦点）时方向键仍要可用。
  // 用捕获而不是冒泡，是因为应用里还有全局 Esc（关闭检查器、取消选中）这类冒泡处理器，
  // 它们一次同步重渲染就能把本监听器摘掉（见上面 latest 的注释）；捕获阶段先跑完最稳。
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const cur = latest.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        cur.close();
        return;
      }
      // Tab：让焦点照常走，只把弹层收掉，别把用户锁在里面。
      if (e.key === 'Tab') {
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => nextActiveIndex(i, e.key === 'ArrowDown' ? 1 : -1, cur.options.length));
        return;
      }
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        setActive(e.key === 'Home' ? 0 : cur.options.length - 1);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        const pick = cur.options[cur.active];
        if (pick) {
          cur.onChange(pick.value);
          cur.close();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  // 高亮项出视野就滚回来（选项多过 max-h 时，键盘走到看不见的行等于没走）。
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const text = current ? current.short ?? current.label : placeholder;

  const trigger = (
    <button
      ref={btnRef}
      type="button"
      disabled={disabled || empty}
      title={title}
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
      onClick={() => (open ? setOpen(false) : openAt())}
      onKeyDown={(e) => {
        if (open) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openAt();
        }
      }}
      className={`${dense ? TRIGGER_DENSE : TRIGGER} ${className}`}
    >
      <span className="min-w-0 flex-1 truncate text-left">{text}</span>
      <ChevronDown
        aria-hidden="true"
        className={`h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform ${open ? 'rotate-180' : ''}`}
      />
    </button>
  );

  const list = open ? (
    <div
      ref={panelRef}
      id={listId}
      role="listbox"
      aria-label={ariaLabel}
      style={{
        left: pos?.x ?? 0,
        top: pos?.y ?? 0,
        width: pos?.w,
        // 量尺寸那一帧先藏起来：否则弹层会闪现在左上角再跳到位。
        visibility: pos ? 'visible' : 'hidden',
      }}
      className={`fixed z-[80] max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-lg border border-[var(--border)] bg-[var(--card-bg)]/97 py-1 shadow-xl backdrop-blur-md ${TOUCH_GUARD}`}
      // 指针离开整个弹层就撤高亮（在两项之间移动时这里不触发，只有真的走开才算）。
      onPointerLeave={() => hover.current?.(null)}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <div
            key={o.value}
            id={optionId(i)}
            role="option"
            data-idx={i}
            aria-selected={selected}
            // 行高 32px：红外屏与 iPad 上都要点得中，与右键菜单一致。
            className={`flex min-h-8 w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left text-xs leading-none transition-colors ${
              i === active ? 'bg-[var(--accent-light)] text-[var(--fg)]' : 'text-[var(--fg)] hover:bg-[var(--accent-light)]'
            }`}
            // 阻止 mousedown 抢焦点，pointerdown 不能拦（拦了会连带取消 click）。
            onMouseDown={(e) => e.preventDefault()}
            onPointerEnter={() => {
              setActive(i);
              // 键盘走位也报高亮：红外屏上先按方向键再抬头看画布，同样要知道指的是哪只。
              hover.current?.(o.value);
            }}
            onClick={() => commit(o.value)}
          >
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.hint && <span className="shrink-0 font-mono text-[10px] text-[var(--muted)]">{o.hint}</span>}
            {/* 选中记号常驻占位（opacity 切换），列表左右边距才不会因选中而抖。 */}
            <Check
              aria-hidden="true"
              className={`h-3.5 w-3.5 shrink-0 ${selected ? 'opacity-100' : 'opacity-0'}`}
            />
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <span className="flex min-w-0 shrink-0 items-center gap-1 text-[10px] text-[var(--muted)]">
      {label && <span>{label}</span>}
      {trigger}
      {list && createPortal(list, document.body)}
    </span>
  );
}
