/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 画布内左侧元件坞
 *
 * 从画布底部那条「与画布同宽的长工具条」改成贴在画布左内缘的竖向浮板：
 * 元件栏不再吃掉版心宽度，画布保持 100% 宽；竖排也更贴合「电源在左、电表在下」
 * 的读图直觉。
 *
 * **默认收起成 `[ + 元件库 ]` 胶囊**：一进实验台先看见完整的电路与画布，左侧只留
 * 一枚 32px 高的小胶囊；点它展开，点标题栏的减号再收回去。左侧这块位置同时是
 * 检查器（InspectorPanel）的地盘，工作台保证同一时刻只站一块面板（见 CircuitBench）。
 *
 * 元件按物理用途分四组（电源与连接 / 用电器 / 控制与保护 / 测量电表），
 * 点标题折叠展开，右上角一键「全部展开 / 收起」。
 *
 * 每个按钮里的缩略图是画布本体的等比缩小版（`PaletteGlyph`），跟着
 * 「电路图 / 仿真图」实时切换；拖拽时那枚半透明幽灵预览用的是同一个组件，
 * 所以「手指底下看到的图形」与「松手后画布上出现的图形」永远一致。
 *
 * 拖拽一律走 pointerdown / pointermove / pointerup：
 * 希沃（Seewo）红外与电容大屏、iPad 都不支持 HTML5 原生 draggable，
 * 手指按下去根本不会触发 dragstart。这里按住移动超过 6px 才开始拖，
 * 松手前跟着一枚半透明幽灵预览——它按画布世界坐标吸附到网格，
 * 所以「手指松在哪，元件就落在哪一格」，不是落在一个大致的附近。
 *
 * 纯点击（位移没超阈值）仍然走原来的「自动铺在空位」逻辑，可拖可点。
 *
 * 收起是**受控可选**的：工作台打开实验导读浮卡时把它收成一枚小胶囊，
 * 免得左上方那两条竖排工具栏把画布让出的空间又占回去（见 CircuitBench 的 paletteCollapsed）。
 * 学生点胶囊展开时会上报 `onCollapsedChange(false)`，工作台据此解除「因导读而收起」。
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react';

import type { ElementKind } from './circuit-bench-core';
import type { CircuitViewMode } from './circuit-bench-view';
import PaletteGlyph from './PaletteGlyph';
import {
  PALETTE_GROUPS,
  allGroupsClosed,
  defaultOpenState,
  setAllGroups,
  snapDropPoint,
  toggleGroup,
  type PaletteOpenState,
} from './circuit-bench-palette';
import {
  TOUCH_GUARD,
  exceededDragThreshold,
  type PointerSample,
} from './circuit-bench-touch';
import { useNarrow } from './use-bench-media';

/** 屏幕点 ↔ 画布世界点的换算入口；由 CircuitBench 从画布句柄转发过来。 */
export interface PaletteProjection {
  /** 屏幕点 → 世界点；不在画布矩形内返回 null（= 松手处不接受元件）。 */
  toWorld(clientX: number, clientY: number): { x: number; y: number } | null;
  /** 世界点 → 屏幕点（把吸附后的落点画回光标处）。 */
  toClient(p: { x: number; y: number }): { x: number; y: number } | null;
}

interface PaletteItem {
  kind: ElementKind;
  zh: string;
  en: string;
}

const NAMES: Record<ElementKind, { zh: string; en: string }> = {
  battery: { zh: '电源', en: 'Cell' },
  bulb: { zh: '灯泡', en: 'Bulb' },
  resistor: { zh: '电阻', en: 'Resistor' },
  heater: { zh: '电热丝', en: 'Heater' },
  switch: { zh: '开关', en: 'Switch' },
  rheostat: { zh: '变阻器', en: 'Rheostat' },
  fuse: { zh: '保险丝', en: 'Fuse' },
  ammeter: { zh: '电流表', en: 'Ammeter' },
  voltmeter: { zh: '电压表', en: 'Voltmeter' },
  galvanometer: { zh: '电流计', en: 'Galvanometer' },
  wire: { zh: '导线', en: 'Wire' },
};

export function paletteItemLabel(kind: ElementKind, zh: boolean): string {
  return zh ? NAMES[kind].zh : NAMES[kind].en;
}

export interface ElementPaletteProps {
  onAdd: (kind: ElementKind) => void;
  /** 拖拽落点（屏幕坐标）：由上层换算成世界坐标后建元件并选中。 */
  onDropAt?: (kind: ElementKind, clientX: number, clientY: number) => void;
  projection?: PaletteProjection;
  zh: boolean;
  /** 电路图 / 仿真图：缩略图与拖拽幽灵都按它取本体画法。 */
  viewMode?: CircuitViewMode;
  /** 当前元件数与该实验台的容量。到顶后按钮置灰——`addComponent` 会静默拒绝，不能让点了没反应。 */
  used?: number;
  max?: number;
  /**
   * 受控收起：工作台在打开实验导读、或左侧要让位给检查器时把元件坞收成胶囊。
   * 不传则用组件内部状态（默认收起，自收自展）。
   */
  collapsed?: boolean;
  /** 收起状态变化（学生点胶囊展开、点标题栏收起、或受控值自身变化时上报）。 */
  onCollapsedChange?: (v: boolean) => void;
}

interface DragState {
  kind: ElementKind;
  start: PointerSample;
  pointerId: number;
  active: boolean;
  /** 按下的那个按钮：Esc 取消时要先把指针捕获还回去。 */
  el: HTMLElement | null;
}

interface Ghost {
  kind: ElementKind;
  x: number;
  y: number;
  /** 落点是否在画布内：在画布外松手会取消，幽灵也要给出明确反馈。 */
  ok: boolean;
}

/**
 * 浮层命中：元件坞自身、检查器、监控看板、工具栏都盖在画布上方。
 * 指针在这些地方松手时，屏幕坐标仍然落在画布矩形内（`toWorld` 不会返回 null），
 * 于是会建出一个被面板挡住的「隐形元件」——进了历史栈，学生却看不到。
 * 统一给这些浮层的根节点打标记，落点判定与拖影反馈共用同一个判断。
 */
const DROP_BLOCK_SELECTOR = '[data-palette], [data-drop-blocked]';

function overOverlay(clientX: number, clientY: number): boolean {
  // 视口之外 `elementFromPoint` 一律返回 null，但 `toWorld` 仍能把那个点换算成
  // 页面下方的世界坐标——浮层比视口高时（桌面竖排元件坞贴着画布底边），指针
  // 捕获允许在视口外松手，就会建出一只被裁掉一半、学生看不见的元件。
  // 因此「没有可命中的元素」也算浮层：落点必须先落在真的看得见的画面上。
  if (
    clientX < 0 ||
    clientY < 0 ||
    clientX >= window.innerWidth ||
    clientY >= window.innerHeight
  ) {
    return true;
  }
  const el = document.elementFromPoint(clientX, clientY) as Element | null;
  return !el || !!el.closest?.(DROP_BLOCK_SELECTOR);
}

export default function ElementPalette({
  onAdd,
  onDropAt,
  projection,
  zh,
  viewMode = 'schematic',
  used = 0,
  max = 0,
  collapsed: collapsedProp,
  onCollapsedChange,
}: ElementPaletteProps) {
  const [open, setOpen] = useState<PaletteOpenState>(() => defaultOpenState());
  // 默认收起：一进实验台就是开阔画布 + 左侧一枚小胶囊。
  const [collapsedState, setCollapsedState] = useState(true);
  // 受控优先：工作台要能在打开导读时把它收起来（并把学生的原状态记着，关导读再还原）。
  const collapsed = collapsedProp ?? collapsedState;
  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    onCollapsedChange?.(v);
  };
  const narrow = useNarrow();
  /**
   * 窄屏添加即收起：坞是贴视口底的 121px 横条，加完元件还摊着就把新元件与
   * 画布下半截继续压住（审计 §2.7：添加灯泡后坞仍占住底部）。桌面竖排坞常开，
   * 连续摆元件是桌面最常用的动作，不能在宽屏上改掉。
   */
  const finishAdd = (run: () => void) => {
    run();
    if (narrow) setCollapsed(true);
  };
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const dragRef = useRef<DragState | null>(null);
  /** 指针路径处理过的时刻：用来吃掉紧随其后的合成 click，避免一次点击加两个元件。 */
  const handledAt = useRef(0);

  const full = max > 0 && used >= max;
  const allClosed = allGroupsClosed(open);
  const limitTitle = zh
    ? `已达上限 ${max} 个元件，请先移除一些`
    : `Limit reached (${max} parts) — remove some first`;

  const itemsOf = (kinds: ElementKind[]): PaletteItem[] =>
    kinds.map((kind) => ({ kind, ...NAMES[kind] }));

  const endDrag = (
    e: { pointerId: number; clientX: number; clientY: number; timeStamp: number },
    target: HTMLElement | null,
    cancelled = false,
  ) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    target?.releasePointerCapture?.(e.pointerId);
    setGhost(null);
    handledAt.current = e.timeStamp;
    if (cancelled) return;
    if (d.active) {
      // 拖拽落位：只有「画布内 && 不在任何浮层上」才建元件；
      // 拖到画布外或元件库/检查器/看板上松手 = 取消本次添加。
      const world = projection?.toWorld(e.clientX, e.clientY) ?? null;
      if (world && !overOverlay(e.clientX, e.clientY)) {
        finishAdd(() => onDropAt?.(d.kind, e.clientX, e.clientY));
      }
      return;
    }
    // 没越过阈值 —— 是一次点击，沿用「自动铺到空位」的老逻辑。
    finishAdd(() => onAdd(d.kind));
  };

  const onItemDown = (e: React.PointerEvent<HTMLButtonElement>, kind: ElementKind) => {
    if (full) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    // 阻止浏览器把这次按下当成滚动手势 / 长按选择文本。
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      kind,
      start: { t: e.timeStamp, x: e.clientX, y: e.clientY },
      pointerId: e.pointerId,
      active: false,
      el: e.currentTarget,
    };
  };

  const onItemMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.active && !exceededDragThreshold(d.start, { t: e.timeStamp, x: e.clientX, y: e.clientY })) {
      return;
    }
    d.active = true;
    const world = projection?.toWorld(e.clientX, e.clientY) ?? null;
    if (!world || overOverlay(e.clientX, e.clientY)) {
      setGhost({ kind: d.kind, x: e.clientX, y: e.clientY, ok: false });
      return;
    }
    // 吸附到网格后再画回屏幕：预览所在的那一格，就是松手后元件所在的那一格。
    const snapped = snapDropPoint(world);
    const client = projection?.toClient(snapped);
    setGhost({
      kind: d.kind,
      x: client?.x ?? e.clientX,
      y: client?.y ?? e.clientY,
      ok: true,
    });
  };

  /**
   * 拖拽中按 Esc = 取消本次添加。
   *
   * 只在拖拽真的开始时接管：不拖拽时 Esc 仍归工作台（收检查器 / 取消待接端子）。
   * 取消要三件事一起做——清 dragRef（松手时 endDrag 直接返回）、清幽灵、
   * 归还指针捕获——少一件都会在松手后又悄悄建出一个元件。
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      dragRef.current = null;
      d.el?.releasePointerCapture?.(d.pointerId);
      setGhost(null);
      handledAt.current = performance.now();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /**
   * 一格元件按钮。桌面的分组竖排与窄屏的横向长条共用这一份——两处各写一遍
   * 迟早会有一处忘了接 pointer 拖拽，或者忘了 `handledAt` 的去重，
   * 变成「桌面上点一次加一个、手机上点一次加两个」。
   */
  const itemButton = (item: PaletteItem, extra = '') => (
    <button
      key={item.kind}
      type="button"
      disabled={full}
      onClick={(e) => {
        // 指针路径（pointerdown→up）已经处理过这次交互；这里只接
        // 键盘 Enter/Space 合成的点击，以及 pointer 事件缺失的兜底。
        if (e.timeStamp - handledAt.current < 500) return;
        finishAdd(() => onAdd(item.kind));
      }}
      onPointerDown={(e) => onItemDown(e, item.kind)}
      onPointerMove={onItemMove}
      onPointerUp={(e) => endDrag(e, e.currentTarget)}
      onPointerCancel={(e) => endDrag(e, e.currentTarget, true)}
      // 导线元件的 title 多说一句：坞里只显示名字，学生没有任何地方能知道
      // 「导线元件」与工具栏的「接线」是什么关系。这句是拿起它之前唯一能看到的说明。
      title={
        full
          ? limitTitle
          : `${paletteItemLabel(item.kind, zh)} · ${
              item.kind === 'wire'
                ? zh
                  ? '等同直接接线：两端并成一个节点，本身不产生读数。点击或拖入画布'
                  : 'Same as a direct connection: both terminals become one node, no readings of its own. Click or drag onto the canvas'
                : zh
                  ? '点击或拖入画布'
                  : 'click or drag onto the canvas'
            }`
      }
      aria-label={zh ? `添加${item.zh}` : `Add ${item.en}`}
      className={`${TOUCH_GUARD} compact flex cursor-grab flex-col items-center gap-1 rounded-md px-0.5 py-1 text-[var(--fg)] transition-colors active:cursor-grabbing ${
        full ? 'cursor-not-allowed opacity-40' : 'hover:bg-[var(--accent-light)]'
      } ${extra}`}
    >
      {/* 缩略图 = 画布本体等比缩小：视口按模式裁到刚好包住图形，
          撑满 40×32（窄元件按比例取宽），线宽随缩放一起变粗。
          高度定 32、宽度按 viewBox 比例自适应并封顶在单元格内，
          所以扁元件（导线）不会被拉长，方元件（灯泡）也不会留大空档。 */}
      <PaletteGlyph kind={item.kind} viewMode={viewMode} className="h-8 max-w-full shrink-0 text-[var(--fg)]" />
      <span className="whitespace-nowrap text-xs leading-none font-medium">{zh ? item.zh : item.en}</span>
    </button>
  );

  return (
    <>
      {collapsed ? (
        <button
          type="button"
          data-palette
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          title={zh ? '展开元件库' : 'Open parts library'}
          className={`compact pointer-events-auto flex h-8 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card-bg)]/95 px-3 text-xs text-[var(--fg)] shadow-lg backdrop-blur-md transition-colors hover:bg-[var(--accent-light)] ${TOUCH_GUARD}`}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">{zh ? '元件库' : 'Parts'}</span>
        </button>
      ) : (
        <div
          data-palette
          data-view-mode={viewMode}
          /* 窄屏换形态：贴画布底边的横向长条坞（fixed 到视口底），而不是 124px 宽的
             竖板——375px 的屏上竖板会吃掉三分之一画布宽度，而横向长条只吃掉约
             110px 高度，剩下的画布仍然能接线。桌面宽度、圆角、阴影一个字符不动。 */
          className={`pointer-events-auto flex max-h-full w-[124px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-bg)]/95 shadow-lg backdrop-blur-md max-sm:fixed max-sm:inset-x-2 max-sm:top-auto max-sm:bottom-2 max-sm:z-40 max-sm:max-h-40 max-sm:w-auto ${TOUCH_GUARD}`}
        >
          <div className="flex shrink-0 items-center gap-0.5 border-b border-[var(--border)]/70 px-1.5 py-1">
            <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-[var(--fg)]">
              {zh ? '元件库' : 'Parts'}
            </span>
            <button
              type="button"
              onClick={() => setOpen((s) => setAllGroups(s, allClosed))}
              title={
                allClosed
                  ? zh
                    ? '全部展开'
                    : 'Expand all'
                  : zh
                    ? '全部收起'
                    : 'Collapse all'
              }
              /* 窄屏横向长条没有分组标题，「全部展开/收起」无从下手，收起来。 */
              className="compact flex h-5 items-center rounded px-1 text-[0.625rem] text-[var(--muted)] transition-colors hover:bg-[var(--accent-light)] hover:text-[var(--fg)] max-sm:hidden"
            >
              {allClosed ? (zh ? '全部展开' : 'Expand all') : zh ? '全部收起' : 'Collapse all'}
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title={zh ? '收起元件库' : 'Hide parts library'}
              aria-label={zh ? '收起元件库' : 'Hide parts library'}
              className="compact tap-area flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--accent-light)] hover:text-[var(--fg)]"
            >
              <Minus className="h-3 w-3 shrink-0" />
            </button>
          </div>

          {/* 桌面：按物理用途分组竖排；窄屏隐藏（改用下面的横向长条）。 */}
          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1 max-sm:hidden">
            {PALETTE_GROUPS.map((group) => {
              const expanded = open[group.id] !== false;
              const Chevron = expanded ? ChevronDown : ChevronRight;
              const label = zh ? group.zh : group.en;
              return (
                <div key={group.id}>
                  <button
                    type="button"
                    onClick={() => setOpen((s) => toggleGroup(s, group.id))}
                    aria-expanded={expanded}
                    title={label}
                    className="compact tap32 flex h-5 w-full items-center gap-0.5 rounded px-0.5 text-[0.625rem] font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                  >
                    <Chevron className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{label}</span>
                  </button>
                  {expanded && (
                    <div className="grid grid-cols-2 gap-0.5">{itemsOf(group.kinds).map((item) => itemButton(item, 'w-full'))}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 窄屏：一条可横向滚动的元件长条。
              分组标题在这个高度里塞不下（40px 标题 × 4 组就把 160px 的坞吃光），
              所以窄屏放弃分组、按原来的组序铺成一排；11 只元件约 750px 宽，
              一指横扫即可，比纵向滚一个 110px 高的小窗更好找。 */}
          <div className="hidden min-h-0 flex-1 items-stretch gap-1 overflow-x-auto overflow-y-hidden p-1 max-sm:flex">
            {PALETTE_GROUPS.flatMap((group) => itemsOf(group.kinds)).map((item) =>
              itemButton(item, 'w-[64px] shrink-0'),
            )}
          </div>

          {max > 0 && (
            <div
              className={`shrink-0 border-t border-[var(--border)]/70 px-1.5 py-0.5 text-center mono-font text-[0.625rem] tabular-nums ${
                full ? 'text-[var(--danger)]' : 'text-[var(--muted)] opacity-70'
              }`}
              title={full ? limitTitle : undefined}
            >
              {used}/{max}
            </div>
          )}
        </div>
      )}

      {/* 跟手幽灵预览：固定定位，不受任何祖先的 overflow 裁剪。
          图形与元件库按钮同源（同一个 PaletteGlyph），所以「手指底下看到的」
          就是「松手后落到画布上的」那一个；吸附过的落点带一枚实心点，
          画布外则变虚、变红。 */}
      {ghost && (
        <div
          className="pointer-events-none fixed z-[70] -translate-x-1/2 -translate-y-1/2"
          style={{ left: ghost.x, top: ghost.y }}
          data-view-mode={viewMode}
          aria-hidden
        >
          <div
            className={`flex flex-col items-center gap-0.5 rounded-lg border px-1.5 py-1 shadow-xl backdrop-blur-sm ${
              ghost.ok
                ? 'border-[var(--accent)] bg-[var(--card-bg)]/90'
                : 'border-[var(--danger)]/60 bg-[var(--card-bg)]/70 opacity-60'
            }`}
          >
            <PaletteGlyph kind={ghost.kind} viewMode={viewMode} className="h-9 w-16 text-[var(--fg)]" />
            <span className="whitespace-nowrap text-xs leading-none text-[var(--fg)]">
              {paletteItemLabel(ghost.kind, zh)}
            </span>
          </div>
          {ghost.ok && <span className="mx-auto mt-1 block h-1 w-1 rounded-full bg-[var(--accent)]" />}
        </div>
      )}
    </>
  );
}
