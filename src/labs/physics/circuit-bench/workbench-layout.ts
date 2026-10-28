/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 布局计算（纯函数，无 DOM 依赖）
 *
 * 工作台完全融入全站页面流：预设胶囊行在画布卡上方，工具栏是画布卡的标题栏，
 * 元件栏与检查器浮在画布内部，测量记录台在画布卡下方。
 * 横向宽度就是全站版心的内容宽度 —— 与 Header / Footer 共用同一套
 * max-width 与左右内边距，画布卡 100% 占满版心，没有任何贴边特权。
 *
 * 纵向：画布高度由版心宽度和世界比例（1000:620）推导，再夹在 300–620px 之间，
 * 因此画布与电路同形，窄屏也不会退化成一只细长空框。整块工作区随页面滚动。
 */
import { WORLD_H, WORLD_W } from './circuit-bench-geometry';

/** 画布卡工具栏高度（标题栏，与全站 40–44px 的小工具栏一致） */
export const CARD_TOOLBAR_H = 44;
/** 窄屏断点：与 useParamDock 的 (max-width: 639px) 保持一致 */
export const NARROW_MAX = 639;
/** 世界坐标宽高比（1000 : 620） */
export const WORLD_ASPECT = WORLD_W / WORLD_H;
/** 画布高度上下限 */
export const MIN_CANVAS_H = 300;
export const MAX_CANVAS_H = 620;

/**
 * 全站版心的内容宽度（纯函数，与 Header / App 内容列的 Tailwind 类一一对应）：
 * - 容器最大宽度：max-w-4xl 896 → lg:5xl 1024 → xl:6xl 1152 → 2xl:7xl 1280
 * - 左右内边距：px-4+px-2 24 → sm:px-6+px-6 48 → lg:px-8+px-6 56
 * 工作台用它作为画布宽度，因此顶栏 / 画布 / 测量卡的左右边缘与页头严格对齐。
 */
export function siteContentWidth(vw: number): number {
  const width = Number.isFinite(vw) ? Math.max(0, vw) : 0;
  const maxW = width >= 1536 ? 1280 : width >= 1280 ? 1152 : width >= 1024 ? 1024 : 896;
  const pad = width >= 1024 ? 56 : width >= 640 ? 48 : 24;
  return Math.max(0, Math.min(width, maxW) - pad * 2);
}

export interface BenchLayout {
  /** 窄屏（<640px）：浮层控件收成紧凑尺寸 */
  narrow: boolean;
  /** 画布卡宽度（= 版心内容宽度） */
  canvasW: number;
  /** 画布高度（按世界比例由宽度推导，夹在上下限之间） */
  canvasH: number;
  /** 画布宽度占视口宽度的比例（诊断用；版心对齐后不再追求贴满视口） */
  canvasShare: number;
}

export interface BenchLayoutOptions {
  minCanvasH?: number;
  maxCanvasH?: number;
}

function positive(v: number, fallback: number): number {
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/**
 * 由视口宽度推导画布卡尺寸。
 * 横向取版心内容宽度；纵向按 1000:620 的世界比例推导，保证画布与电路同形。
 */
export function benchLayout(vw: number, opts: BenchLayoutOptions = {}): BenchLayout {
  const minH = positive(opts.minCanvasH ?? MIN_CANVAS_H, MIN_CANVAS_H);
  const maxH = Math.max(minH, positive(opts.maxCanvasH ?? MAX_CANVAS_H, MAX_CANVAS_H));

  const width = Number.isFinite(vw) ? Math.max(0, vw) : 0;
  const narrow = width < NARROW_MAX + 1;

  const canvasW = siteContentWidth(width);
  const canvasH = width === 0 ? 0 : Math.min(maxH, Math.max(minH, canvasW / WORLD_ASPECT));

  return {
    narrow,
    canvasW,
    canvasH,
    canvasShare: width > 0 ? canvasW / width : 0,
  };
}

export interface CanvasBox {
  w: number;
  h: number;
  /** 在可用矩形里居中的左上角偏移 */
  x: number;
  y: number;
}

/**
 * 在 availW × availH 里放一个 aspect 比例的盒子（等比内切 + 居中）。
 * 画布用 h-full w-auto 也能做到，但那样拿不到真实像素尺寸来对齐 HTML 标签层，
 * 所以这里显式算一次，React 直接把结果写进样式。
 */
export function fitCanvasBox(availW: number, availH: number, aspect: number = WORLD_ASPECT): CanvasBox {
  const w = Number.isFinite(availW) ? Math.max(0, availW) : 0;
  const h = Number.isFinite(availH) ? Math.max(0, availH) : 0;
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : WORLD_ASPECT;
  if (w <= 0 || h <= 0) return { w: 0, h: 0, x: 0, y: 0 };

  let boxW = w;
  let boxH = w / a;
  if (boxH > h) {
    boxH = h;
    boxW = h * a;
  }
  return { w: boxW, h: boxH, x: (w - boxW) / 2, y: (h - boxH) / 2 };
}

/* ──────────────────────────── 全屏沉浸式布局 ──────────────────────────── */

/**
 * 全屏根容器类名（纯函数，单测直接断言）。
 *
 * 浏览器进入全屏时会在文档之上铺一层 `::backdrop`（Chrome 默认纯黑），元素
 * 自身若没有背景，任何「元素没盖到」的地方都会漏出那层黑——不是深色主题，
 * 而是没接上主题变量。所以根容器必须自带 `bg-[var(--bg)]` 把主题底色铺满，
 * 并用 `h-screen overflow-hidden` 把高度锁在视口上、只留画布一个会伸缩的孩子。
 *
 * 改前实测（1440×900）：全屏下 y=0–39 与 y=585–592 两条通栏纯黑带，
 * 分别是预设胶囊行自身（无背景的 flex 行）与画布卡/数据卡之间的 gap。
 */
export function benchShellClass(fullscreen: boolean): string {
  return fullscreen
    ? 'relative flex h-screen w-screen flex-col gap-2.5 overflow-hidden bg-[var(--bg)] p-3 text-[var(--fg)] sm:p-4'
    : 'flex w-full flex-col gap-2';
}

/** 画布卡：全屏时吃掉除工具栏外的全部纵向空间，常态由内容（固定高度画布）撑开。 */
export function canvasCardClass(fullscreen: boolean): string {
  const card = 'overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-bg)]';
  return fullscreen ? `flex min-h-0 flex-1 flex-col ${card}` : card;
}

/** 画布槽位：全屏时 flex-1 min-h-0（高度交给容器），常态由 benchLayout 写固定高度。 */
export function canvasSlotClass(fullscreen: boolean): string {
  return fullscreen ? 'relative min-h-0 w-full flex-1' : 'relative w-full';
}

/**
 * 全屏下数据记录面板的位置：收起时只在左下角留一枚胶囊（画布拿到 100% 高度），
 * 展开时是贴着底边的浮层抽屉。外层 `pointer-events-none` 保证浮层两侧的空档
 * 不会挡住画布拖拽；面板自己带 `pointer-events-auto`（见 MeasurementPanel 的 floating）。
 */
export function measureDrawerClass(open: boolean): string {
  return open
    ? 'pointer-events-none absolute inset-x-3 bottom-3 z-40 flex max-h-[62vh] items-end justify-center'
    : 'pointer-events-none absolute bottom-3 left-3 z-40 flex';
}

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartGeometry {
  points: ChartPoint[];
  line: { x1: number; y1: number; x2: number; y2: number } | null;
  /** 绘图区（去掉轴标签后的矩形），供测试与网格线使用 */
  plot: { left: number; right: number; top: number; bottom: number };
}

/**
 * 把数据点与拟合线映射到 w × h 的像素坐标系（y 轴向上为数学方向）。
 * 退化输入（单点、全部同 x / 同 y）也返回可显示的框，不产生 NaN。
 */
export function chartGeometry(
  points: ChartPoint[],
  slope: number,
  intercept: number,
  ok: boolean,
  size: { w: number; h: number },
): ChartGeometry {
  const w = Number.isFinite(size.w) && size.w > 0 ? size.w : 320;
  const h = Number.isFinite(size.h) && size.h > 0 ? size.h : 288;
  const left = 30;
  const right = Math.max(left + 1, w - 10);
  const top = 10;
  const bottom = Math.max(top + 1, h - 22);
  const plot = { left, right, top, bottom };

  const finite = (points ?? []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!finite.length) return { points: [], line: null, plot };

  let minX = Math.min(...finite.map((p) => p.x));
  let maxX = Math.max(...finite.map((p) => p.x));
  let minY = Math.min(...finite.map((p) => p.y));
  let maxY = Math.max(...finite.map((p) => p.y));
  const hasLine = ok && Number.isFinite(slope) && Number.isFinite(intercept);
  if (hasLine) {
    minY = Math.min(minY, intercept);
    maxY = Math.max(maxY, slope * maxX + intercept);
  }
  if (maxX - minX < 1e-12) {
    minX -= 1;
    maxX += 1;
  }
  if (maxY - minY < 1e-12) {
    minY -= 1;
    maxY += 1;
  }
  const pad = 0.08;
  const dx = (maxX - minX) * pad;
  const dy = (maxY - minY) * pad;
  minX -= dx;
  maxX += dx;
  minY -= dy;
  maxY += dy;

  const px = (x: number) => left + ((x - minX) / (maxX - minX)) * (right - left);
  const py = (y: number) => bottom - ((y - minY) / (maxY - minY)) * (bottom - top);

  return {
    points: finite.map((p) => ({ x: px(p.x), y: py(p.y) })),
    line: hasLine
      ? { x1: px(minX), y1: py(slope * minX + intercept), x2: px(maxX), y2: py(slope * maxX + intercept) }
      : null,
    plot,
  };
}
