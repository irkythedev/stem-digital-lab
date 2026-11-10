/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 通用 SVG 坐标系：网格 + 坐标轴 + 刻度 + 多曲线叠加。
 * 数学坐标 y 向上，内部映射到 SVG（y 翻转）；y 范围未提供时自动适配曲线。
 * 样式说明：只用 --fg / --muted / --border / --accent，主曲线实线、叠加曲线虚线、
 * 标注层（对称轴/渐近线/顶点等）用 --accent 强调。
 *
 * 动画（#3 描画 + #4 平滑过渡，零依赖，JS rAF）：
 *  - 主曲线首次挂载时从左到右「画出来」（stroke-dashoffset 过渡）
 *  - 参数变化时曲线平滑变形（points 插值，easeOutCubic 350ms）
 */
import { useEffect, useRef, useState, type Key } from 'react';

export interface CoordCurve {
  id: string;
  /** 数学坐标点列（连续单段曲线）；提供 segments 时忽略 */
  points?: [number, number][];
  /** 多段曲线（如反比例双曲线的两支，x=0 处断开） */
  segments?: [number, number][][];
  /** 叠加曲线（虚线弱化） */
  dashed?: boolean;
  /** 图例文字，如 "y = 1/x" */
  label?: string;
  /**
   * 是否参与自动 y 范围计算（默认 true）。
   * 基准残影设 false：它只作参照，不能把主曲线压扁。
   */
  affectsRange?: boolean;
}

/**
 * 标注元素（数学坐标，随参数实时移动；淡入出现）——Manim 式辅助线/特征点：
 *  - vline: 垂直虚线（如二次对称轴 x=-b/2a、反比例渐近线 x=0）
 *  - hline: 水平虚线（如反比例渐近线 y=0）
 *  - dot:   特征点 + 可选标签（如二次顶点、一次截距）
 */
export interface CoordMarker {
  key: string;
  /** noLine：与该方向坐标轴重合时不重复画虚线（反比例的 x=0 / y=0 就是坐标轴本身） */
  vline?: { x: number; label?: string; color?: string; noLine?: boolean; labelPlace?: 'top' | 'bottom' };
  hline?: { y: number; label?: string; color?: string; noLine?: boolean; labelPlace?: 'left' | 'right' };
  /**
   * place：点标注相对特征点的落位。
   * - 'above' / 'below'：显式指定（顶点、x 轴交点按开口方向传，避免文字被抛物线穿过）
   * - 'auto'（默认）：优先上方，顶到视口上沿才翻到下方
   *
   * side：文字横向落在点的哪一侧。默认右；越界自动翻到左。
   * x 轴交点必须显式给（左根标左侧、右根标右侧），否则文字会朝抛物线内侧延伸被曲线穿过。
   */
  dot?: {
    x: number;
    y: number;
    label?: string;
    color?: string;
    place?: 'above' | 'below' | 'auto';
    side?: 'left' | 'right';
  };
}

/**
 * 声明式几何叠加层（数学坐标）：斜率阶梯、|k| 矩形、对称点连线、直角标记等。
 * 与 CoordMarker 的分工：marker 是「轴/特征点」语义，overlay 是「任意图元」语义。
 * 所有颜色走 CSS 变量；不传 color 时用 --accent。
 */
export type CoordOverlay =
  | {
      kind: 'segment';
      x1: number; y1: number; x2: number; y2: number;
      color?: string; width?: number; dash?: string; opacity?: number;
    }
  | {
      kind: 'polyline';
      points: [number, number][];
      close?: boolean;
      color?: string; width?: number; dash?: string;
      fill?: string; fillOpacity?: number; opacity?: number;
    }
  | {
      kind: 'rect';
      x: number; y: number; w: number; h: number;
      color?: string; width?: number; dash?: string;
      fill?: string; fillOpacity?: number; opacity?: number;
    }
  | {
      kind: 'label';
      x: number; y: number; text: string;
      color?: string; size?: number;
      place?: 'above' | 'below' | 'left' | 'right';
      opacity?: number;
    }
  | {
      kind: 'rightAngle';
      x: number; y: number;
      /** 两条边的数学方向（不需要归一化，渲染时按屏幕像素归一化） */
      ux: number; uy: number; vx: number; vy: number;
      size?: number; color?: string; opacity?: number;
    }
  | {
      kind: 'arc';
      cx: number; cy: number; r: number;
      /** 弧度，数学坐标（逆时针为正） */
      from: number; to: number;
      color?: string; width?: number; opacity?: number;
    };

interface CoordPlaneProps {
  curves: CoordCurve[];
  /** 标注层（对称轴/渐近线/顶点等），随参数实时移动 */
  markers?: CoordMarker[];
  /** 几何叠加层（斜率阶梯、面积矩形、对称连线等） */
  overlays?: CoordOverlay[];
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  ariaLabel?: string;
  /** X 轴名称标签（如 "U/V"），不传则不显示 */
  xLabel?: string;
  /** Y 轴名称标签（如 "I/A"），不传则不显示 */
  yLabel?: string;
  /** 函数实验大画布：覆盖默认 max-h-[450px] */
  maxHeightClass?: string;
  /** false 时去掉自带边框，由外层画布卡统一包边 */
  framed?: boolean;
  /** 可选 viewBox 宽度；Quadratic 用 600 宽幅画布，其他调用保持 520 */
  viewWidth?: number;
  viewHeight?: number;
  /** 全画布工作台：让 SVG 高度撑满父级舞台 */
  fillContainer?: boolean;
  /** 数学原点在绘图区中的横向占比；用于右侧悬浮面板展开时把原点移到左侧净空区中心 */
  originXRatio?: number;
  /** 满铺画布：网格/坐标轴尽量贴到视觉边界 */
  bleed?: boolean;
  /** 是否在 SVG 右上角绘制图例；全画布工具栏已显示时关闭 */
  showLegend?: boolean;
  /** 是否把绘图内容裁剪到画布内部（全画布实验开启） */
  clipContent?: boolean;
  /** 1:1 等比例正方形网格：按实际画布宽高自动校准 x 视窗跨度 */
  squareGrid?: boolean;
  /** 纸墨无界画板：固定像素比例尺 + 画布中心，无外框、无 padding */
  sheetMode?: boolean;
  /** 实验内原生平移缩放（桌面 squareGrid 用） */
  interactiveView?: boolean;
  zoomCommand?: { factor: number; reset?: boolean; nonce: number };
  /** 可选：可拖拽的曲线上的点（用于 Inverse 的 P 探针）。 */
  draggablePoint?: { x: number; y: number; onDrag: (x: number, y: number) => void };
  pixelsPerUnit?: number;
  centerX?: number;
  centerY?: number;
}

const DEFAULT_W = 520;
const DEFAULT_H = 380;
const PAD = { top: 20, right: 20, bottom: 28, left: 34 };
/** 插值动画时长（ms） */
const INTERP_MS = 350;

type Sx = (x: number) => number;
type Sy = (y: number) => number;

/** 单条折线：支持 points 平滑插值 + 首次挂载描画动画 */
function AnimatedPolyline({
  mathPoints,
  sx,
  sy,
  stroke,
  width,
  dash,
  opacity,
  drawOnMount,
}: {
  /** React key（map 内使用） */
  key?: Key;
  mathPoints: [number, number][];
  sx: Sx;
  sy: Sy;
  stroke: string;
  width: number;
  dash?: string;
  opacity?: number;
  drawOnMount?: boolean;
}) {
  const [display, setDisplay] = useState<[number, number][]>(mathPoints);
  const prevRef = useRef(mathPoints);
  const rafRef = useRef<number>(0);
  const polyRef = useRef<SVGPolylineElement>(null);

  // #4 平滑过渡：mathPoints 变化时插值
  useEffect(() => {
    const from = prevRef.current;
    const to = mathPoints;
    prevRef.current = mathPoints;
    if (from.length !== to.length) {
      setDisplay(to);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / INTERP_MS);
      const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const next = from.map(([x, y], i) => {
        const tx = to[i]?.[0] ?? x;
        const ty = to[i]?.[1] ?? y;
        return [x + (tx - x) * e, y + (ty - y) * e] as [number, number];
      });
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mathPoints]);

  // #3 描画：主曲线首次挂载时「画出来」
  // 关键：动画结束后必须清除 stroke-dasharray，否则残留旧长度会让曲线
  // 随路径变长而被「截尾」（只画 [0, 旧L] 段）——这是「曲线显示不全/像被裁剪」的根因
  useEffect(() => {
    if (!drawOnMount || !polyRef.current) return;
    const el = polyRef.current;
    const len = el.getTotalLength();
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    const raf = requestAnimationFrame(() => {
      el.style.transition = `stroke-dashoffset 0.8s ease-out`;
      el.style.strokeDashoffset = '0';
    });
    // 动画结束后恢复实线全长（清空描边限制），并重置过渡
    const clearTimer = setTimeout(() => {
      el.style.strokeDasharray = '';
      el.style.strokeDashoffset = '';
      el.style.transition = '';
    }, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(clearTimer);
      el.style.transition = '';
      el.style.strokeDasharray = '';
      el.style.strokeDashoffset = '';
    };
  }, [drawOnMount]);

  return (
    <polyline
      ref={polyRef}
      points={display
        .map(([x, y]) => {
          const px = sx(x);
          const py = sy(y);
          return `${px},${py}`;
        })
        .join(' ')}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeDasharray={dash}
      strokeOpacity={opacity}
    />
  );
}

/** 数字/坐标文本统一用学术减号 U+2212：等宽字体里 ASCII 连字符过窄且不合数学排版规范 */
export const mathMinus = (v: string | number): string => String(v).replace(/-/g, '\u2212');

/**
 * 文本防遮挡光晕：描边画在填充之前（paintOrder='stroke'），等于给文字垫一圈背景色。
 * 必须用 --card-bg 令牌——坐标系底色就是它；写死色值会在深色主题下露出一圈白边。
 * 3px 是「刚好盖住 1px 轴线 + 0.5px 网格线」的最小值，再粗会糊住细网格的格子。
 */
export const TEXT_HALO = {
  stroke: 'var(--card-bg)',
  strokeWidth: 3,
  paintOrder: 'stroke',
  strokeLinejoin: 'round',
} as const;

/**
 * 细网格步长：目标 8~10 格，取 1/2/2.5/5/10 序列（教材坐标纸口径，格子近似正方）。
 * 与「带数字的主网格」解耦：主网格 = 细网格的整数倍，数字才不会挤成一团。
 * 实测（2026-10）：Quadratic x 范围 8 → 1（原为 2，只有 4 格）；y 范围 41 → 5（原为 10，只有 3 格）。
 */
export function fineStep(range: number, target = 10): number {
  const raw = Math.abs(range) / target;
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const m = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / m;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * m;
}

/** 主网格（带数字刻度）步长：细网格的整数倍，标签条数收口到 ≤6，避免数字互相压 */
export function majorStepFor(range: number, fine: number): number {
  const cells = Math.abs(range) / fine;
  const k = Math.max(1, Math.ceil(cells / 6));
  return fine * k;
}

/** 等宽字体文本宽度估算（不引布局引擎；实测 11px ≈ 6.6px/字符、12px ≈ 7.2px/字符） */
export function estTextW(s: string, size = 11): number {
  return s.length * (size >= 12 ? 7.2 : 6.6);
}

/** 把值夹到 [lo, hi] */
const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

export default function CoordPlane({
  curves,
  markers = [],
  overlays = [],
  xMin: inputXMin = -5,
  xMax: inputXMax = 5,
  yMin,
  yMax,
  ariaLabel = 'coordinate plane',
  xLabel,
  yLabel,
  maxHeightClass = 'max-h-[450px]',
  framed = true,
  viewWidth = DEFAULT_W,
  viewHeight = DEFAULT_H,
  fillContainer = false,
  originXRatio,
  bleed = false,
  showLegend = true,
  clipContent = false,
  squareGrid = false,
  sheetMode = false,
  interactiveView = false,
  zoomCommand,
  draggablePoint,
  pixelsPerUnit = 64,
  centerX = 0,
  centerY = 0,
}: CoordPlaneProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [measured, setMeasured] = useState({ width: 0, height: 0 });
  const [nav, setNav] = useState({ cx: 0, cy: 0, zoom: 1 });
  const navDragRef = useRef<{ x: number; y: number; cx: number; cy: number; sx: number; sy: number } | null>(null);
  const pointDragRef = useRef(false);
  useEffect(() => {
    if (!squareGrid && !sheetMode) return;
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setMeasured({ width: Math.round(r.width), height: Math.round(r.height) });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) setMeasured({ width: Math.round(r.width), height: Math.round(r.height) });
    return () => ro.disconnect();
  }, [squareGrid, sheetMode]);
  const W = (squareGrid || sheetMode) && measured.width > 0 ? measured.width : viewWidth;
  const H = (squareGrid || sheetMode) && measured.height > 0 ? measured.height : viewHeight;
  const BLEED_PAD = { top: 4, right: 4, bottom: 8, left: 8 };
  const pad = sheetMode ? { top: 0, right: 0, bottom: 0, left: 0 } : bleed ? BLEED_PAD : PAD;
  const sheetScale = Math.max(8, pixelsPerUnit);
  const rawSpanX = inputXMax - inputXMin;
  // 记录上一次目标曲线的 y 范围（动画 from），用于动画期间联合适配防止越界
  const prevAutoRange = useRef<{ min: number; max: number } | null>(null);
  // 自动 y 范围：覆盖所有曲线（points 或 segments）并留边（不强制对称）
  let autoYMin = Infinity;
  let autoYMax = -Infinity;
  const eachPoint = (c: CoordCurve, fn: (y: number) => void) => {
    if (c.segments) {
      for (const seg of c.segments) for (const [, y] of seg) fn(y);
    } else if (c.points) {
      for (const [, y] of c.points) fn(y);
    }
  };
  for (const c of curves) {
    if (c.affectsRange === false) continue;
    eachPoint(c, (y) => {
      if (y < autoYMin) autoYMin = y;
      if (y > autoYMax) autoYMax = y;
    });
  }
  if (!Number.isFinite(autoYMin)) autoYMin = -1;
  if (!Number.isFinite(autoYMax)) autoYMax = 1;

  // 动画期间 y 范围联合「上一次目标曲线」：from∪to，保证曲线变形全程都不越界、不被裁
  // （坐标只在用户下一次改参时重算，动画进行中保持稳定，不产生跳变）
  const prevAuto = prevAutoRange.current;
  const mergeMin = prevAuto ? Math.min(prevAuto.min, autoYMin) : autoYMin;
  const mergeMax = prevAuto ? Math.max(prevAuto.max, autoYMax) : autoYMax;
  // 适度 y 留边（12% + 下缘 0.5）：贴合曲线不过度撑大，让 y 刻度保持 1/2/5 nice 步长、数值不虚大；
  // clip 已移除，靠 merge-union（动画 from∪to）保证不越界
  const padY = Math.max((mergeMax - mergeMin) * 0.12, 0.6);
  let effYMin = yMin ?? Math.floor(mergeMin - padY - 0.5);
  let effYMax = yMax ?? Math.ceil(mergeMax + padY);
  if (sheetMode) {
    effYMin = centerY - H / (2 * sheetScale);
    effYMax = centerY + H / (2 * sheetScale);
  } else if (interactiveView) {
    const baseYMin = yMin ?? effYMin;
    const baseYMax = yMax ?? effYMax;
    const cy = (baseYMin + baseYMax) / 2 + nav.cy;
    const ys = Math.max(0.1, (baseYMax - baseYMin) / nav.zoom);
    effYMin = cy - ys / 2;
    effYMax = cy + ys / 2;
  }
  // commit 后把本次目标曲线范围记为下一次动画的 from
  useEffect(() => {
    prevAutoRange.current = { min: autoYMin, max: autoYMax };
  });

  // 1:1：横向跨度 = 纵向跨度 × 实际画布宽高比；保留原 x 视窗中心，避免跳轴。
  const xCenter = sheetMode ? centerX : (inputXMin + inputXMax) / 2 + (interactiveView ? nav.cx : 0);
  const xSpan = sheetMode ? W / sheetScale : squareGrid ? (effYMax - effYMin) * (W / H) : rawSpanX;
  const xMin = sheetMode
    ? xCenter - xSpan / 2
    : squareGrid
      ? xCenter - xSpan / 2
      : originXRatio == null
        ? inputXMin
        : -originXRatio * rawSpanX;
  const xMax = sheetMode
    ? xCenter + xSpan / 2
    : squareGrid
      ? xCenter + xSpan / 2
      : originXRatio == null
        ? inputXMax
        : (1 - originXRatio) * rawSpanX;

  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  /* ---------- 网格双层化（教材坐标纸）：细网格 8~10 格 + 主网格带数字 ---------- */
  const xRange = xMax - xMin;
  const fineX = sheetMode ? 0.2 : squareGrid ? 1 : fineStep(xRange);
  const fineY = sheetMode ? 0.2 : squareGrid ? 1 : fineStep(effYMax - effYMin);

  /** 区间内主网格能落下的刻度条数（含两端） */
  const ticksBetween = (lo: number, hi: number, step: number): number =>
    Math.floor((hi + 1e-9) / step) - Math.ceil((lo - 1e-9) / step) + 1;

  // 端点吸附（P8）：视野末端若多出「不足 0.35 格」的空白，就吸到最近的整数刻度上，
  // 让坐标纸两端都有刻度标尺，而不是只有轴旁那几个数字。
  // 只接受「刻度条数不减少」的吸附：反比例 -34…34 一旦吸到 ±40，步长被迫从 10 放大到 20、
  // 标签从 7 条掉到 5 条 —— 那种吸附是净损失，直接放弃。
  if (yMin == null && yMax == null) {
    const est = majorStepFor(effYMax - effYMin, fineY);
    const loSnap = Math.floor(effYMin / est) * est;
    const hiSnap = Math.ceil(effYMax / est) * est;
    const lo2 = effYMin - loSnap <= est * 0.35 + 1e-9 ? loSnap : effYMin;
    const hi2 = hiSnap - effYMax <= est * 0.35 + 1e-9 ? hiSnap : effYMax;
    const step2 = majorStepFor(hi2 - lo2, fineY);
    if (ticksBetween(lo2, hi2, step2) >= ticksBetween(effYMin, effYMax, est)) {
      effYMin = lo2;
      effYMax = hi2;
    }
  }

  const sx = (x: number) => pad.left + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y: number) => pad.top + ((effYMax - y) / (effYMax - effYMin)) * plotH;
  /** 数学单位 → 屏幕像素的横/纵比例（直角符号必须在屏幕空间归一化） */
  const scaleX = plotW / (xMax - xMin);
  const scaleY = plotH / (effYMax - effYMin);

  // y 轴刻度（主网格，带数字）
  const yRange = effYMax - effYMin;
  const yTick = sheetMode ? 1 : squareGrid ? 2 : majorStepFor(yRange, fineY);
  const yTicks: number[] = [];
  for (let v = Math.ceil(effYMin / yTick - 1e-9) * yTick; v <= effYMax + 1e-9; v += yTick) {
    yTicks.push(Math.abs(v) < 1e-9 ? 0 : v);
  }

  // x 轴刻度（主网格，带数字）：1/2/5 自适应，范围大时自动放大步长，避免标签重叠
  const xTick = sheetMode ? 1 : squareGrid ? 2 : majorStepFor(xRange, fineX);
  const xTicks: number[] = [];
  for (let v = Math.ceil(xMin / xTick - 1e-9) * xTick; v <= xMax + 1e-9; v += xTick) {
    xTicks.push(Math.abs(v) < 1e-9 ? 0 : v);
  }

  /**
   * 细网格线（不标数字）：铺满整个绘图区，但跳过「主网格线位置」与「坐标轴」。
   * 否则同一条线会被描两遍（0.5px 细线 + 1px 轴线），在 0 处尤其明显（P9）。
   */
  const fineTicksOf = (lo: number, hi: number, fine: number, major: number): number[] => {
    const out: number[] = [];
    for (let k = Math.ceil(lo / fine - 1e-9); k <= Math.floor(hi / fine + 1e-9); k++) {
      const v = k * fine;
      if (Math.abs(v) < 1e-9) continue; // 0 处是坐标轴
      if (Math.abs(v / major - Math.round(v / major)) < 1e-6) continue; // 主网格自会画
      out.push(Math.round(v * 1e6) / 1e6);
    }
    return out;
  };
  const fineXs = fineTicksOf(xMin, xMax, fineX, xTick);
  const fineYs = fineTicksOf(effYMin, effYMax, fineY, yTick);
  // 1:1 方格纸的第三层：0.5 单位微网格（只在平方格模式启用），让一个大格呈现“4×4 小方格本”的精度。
  const microXs = squareGrid ? fineTicksOf(xMin, xMax, 0.5, 1) : [];
  const microYs = squareGrid ? fineTicksOf(effYMin, effYMax, 0.5, 1) : [];

  const zeroX = sx(0);
  const zeroY = sy(0);

  /* ---------- 文字落位（A3 贴轴 / A2 光晕）：全部夹进画布，绝不越界 ---------- */
  const tickFont = sheetMode ? 11 : bleed ? 12 : 11;
  const xTickY = clamp(zeroY + 15, pad.top + 12, H - 6); // 贴 x 轴下方，而不是钉在画布底边
  const yTickX = Math.max(zeroX - 6, pad.left - 6);      // 贴 y 轴左侧，轴在左边时退回 PAD 内
  const xNameX = W - 16;
  const xNameY = clamp(zeroY + 18, pad.top + 12, H - 8);
  const yNameX = clamp(zeroX + 14, pad.left + 4, W - 12);
  const yNameY = 18;

  /** 特征点是否落在绘图区内（越界整条不画，避免半截虚线与画布外标签，P10） */
  const inPlotX = (px: number): boolean => px >= pad.left - 0.5 && px <= W - pad.right + 0.5;
  const inPlotY = (py: number): boolean => py >= pad.top - 0.5 && py <= H - pad.bottom + 0.5;

  /* ---------- 图例（A5）：真 <line> 线型 + 动态底板 + 移到右上角 ---------- */
  const legendW = Math.max(
    120,
    ...curves.map((c) => estTextW(mathMinus(c.label ?? ''), tickFont) + 34),
  );
  const legendX = W - pad.right - legendW;
  const legendY = pad.top + 2;
  const legendH = curves.length * 16 + 8;

  // 标注层首次挂载淡入
  const [markersIn, setMarkersIn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMarkersIn(true), 30);
    return () => clearTimeout(t);
  }, []);

  const overlayColor = (c?: string) => c ?? 'var(--accent)';

  /** 只画「图形」类 overlay；label 单独在曲线之后画，避免被曲线压住 */
  const renderOverlayShape = (o: CoordOverlay, i: number) => {
    if (o.kind === 'label') return null;
    const key = `ov${i}`;
    if (o.kind === 'segment') {
      return (
        <line
          key={key}
          x1={sx(o.x1)} y1={sy(o.y1)} x2={sx(o.x2)} y2={sy(o.y2)}
          stroke={overlayColor(o.color)} strokeWidth={o.width ?? 1.2}
          strokeDasharray={o.dash} opacity={o.opacity ?? 1}
        />
      );
    }
    if (o.kind === 'polyline') {
      const pts = o.close && o.points.length > 2 ? [...o.points, o.points[0]] : o.points;
      return (
        <polyline
          key={key}
          points={pts.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ')}
          fill={o.fill ?? 'none'} fillOpacity={o.fillOpacity ?? 1}
          stroke={o.color ? overlayColor(o.color) : o.fill ? 'none' : overlayColor()}
          strokeWidth={o.width ?? 1.2} strokeDasharray={o.dash}
          opacity={o.opacity ?? 1} strokeLinejoin="round"
        />
      );
    }
    if (o.kind === 'rect') {
      const rx = Math.min(o.x, o.x + o.w);
      const ry = Math.min(o.y, o.y + o.h);
      const rw = Math.abs(o.w);
      const rh = Math.abs(o.h);
      return (
        <rect
          key={key}
          x={sx(rx)} y={sy(ry + rh)} width={rw * scaleX} height={rh * scaleY}
          fill={o.fill ?? 'none'} fillOpacity={o.fillOpacity ?? 1}
          stroke={o.width === 0 ? 'none' : overlayColor(o.color)}
          strokeWidth={o.width ?? 1.2} strokeDasharray={o.dash}
          opacity={o.opacity ?? 1}
        />
      );
    }
    if (o.kind === 'rightAngle') {
      // 关键：先映射到屏幕像素增量，再在像素空间归一化，最后乘像素 size。
      // 否则自动量程下 scaleX ≠ scaleY，直角会被拉成菱形。
      const ux = o.ux * scaleX;
      const uy = -o.uy * scaleY;
      const vx = o.vx * scaleX;
      const vy = -o.vy * scaleY;
      const ul = Math.hypot(ux, uy) || 1;
      const vl = Math.hypot(vx, vy) || 1;
      const size = o.size ?? 8;
      const px = sx(o.x);
      const py = sy(o.y);
      const p1 = `${px + (ux / ul) * size},${py + (uy / ul) * size}`;
      const p2 = `${px + (ux / ul) * size + (vx / vl) * size},${py + (uy / ul) * size + (vy / vl) * size}`;
      const p3 = `${px + (vx / vl) * size},${py + (vy / vl) * size}`;
      return (
        <polyline
          key={key} points={`${p1} ${p2} ${p3}`} fill="none"
          stroke={overlayColor(o.color)} strokeWidth={1.2} opacity={o.opacity ?? 1}
        />
      );
    }
    // arc：用 24 段折线，避免 SVG A 命令的 sweep 方向坑
    const n = 24;
    const pts: string[] = [];
    for (let k = 0; k <= n; k++) {
      const t = o.from + ((o.to - o.from) * k) / n;
      pts.push(`${sx(o.cx + o.r * Math.cos(t))},${sy(o.cy + o.r * Math.sin(t))}`);
    }
    return (
      <polyline
        key={key} points={pts.join(' ')} fill="none"
        stroke={overlayColor(o.color)} strokeWidth={o.width ?? 1.4}
        opacity={o.opacity ?? 1} strokeLinecap="round"
      />
    );
  };

  const renderOverlayLabel = (o: CoordOverlay, i: number) => {
    if (o.kind !== 'label') return null;
    const px = sx(o.x);
    const py = sy(o.y);
    const place = o.place ?? 'above';
    let tx = px;
    let ty = py;
    let anchor: 'start' | 'middle' | 'end' = 'middle';
    if (place === 'above') ty -= 9;
    else if (place === 'below') ty += 16;
    else if (place === 'left') {
      tx -= 8;
      anchor = 'end';
    } else {
      tx += 8;
      anchor = 'start';
    }
    const size = o.size ?? 11;
    const w = estTextW(o.text, size);
    const minX = pad.left + 2 + (anchor === 'end' ? w : anchor === 'middle' ? w / 2 : 0);
    const maxX = W - pad.right - 2 - (anchor === 'start' ? w : anchor === 'middle' ? w / 2 : 0);
    tx = clamp(tx, minX, Math.max(minX, maxX));
    ty = clamp(ty, pad.top + 10, H - pad.bottom - 2);
    return (
      <text
        key={`ovl${i}`} x={tx} y={ty} textAnchor={anchor}
        fontSize={size} fontWeight="500" fill={overlayColor(o.color)}
        fontFamily="var(--f-mono)" opacity={o.opacity ?? 1} {...TEXT_HALO}
      >
        {o.text}
      </text>
    );
  };

  useEffect(() => {
    if (!interactiveView || sheetMode) return;
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setNav((v) => ({ ...v, zoom: Math.min(2.6, Math.max(0.5, v.zoom * (e.deltaY < 0 ? 1.08 : 0.92))) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [interactiveView, sheetMode]);
  useEffect(() => {
    if (!interactiveView || !zoomCommand) return;
    if (zoomCommand.reset) setNav({ cx: 0, cy: 0, zoom: 1 });
    else setNav((v) => ({ ...v, zoom: Math.min(2.6, Math.max(0.5, v.zoom * zoomCommand.factor)) }));
  }, [interactiveView, zoomCommand?.nonce]);

  const onNavPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactiveView || sheetMode || (e.target as Element).closest('button,input,a')) return;
    if (draggablePoint) {
      const svg = svgRef.current;
      const ctm = svg?.getScreenCTM?.();
      if (svg && ctm) {
        const p = svg.createSVGPoint();
        p.x = sx(draggablePoint.x);
        p.y = sy(draggablePoint.y);
        const screen = p.matrixTransform(ctm);
        if (Math.hypot(e.clientX - screen.x, e.clientY - screen.y) < 24) {
          pointDragRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
      }
    }
    navDragRef.current = { x: e.clientX, y: e.clientY, cx: nav.cx, cy: nav.cy, sx: W / Math.max(1e-9, xMax - xMin), sy: H / Math.max(1e-9, effYMax - effYMin) };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onNavPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pointDragRef.current && draggablePoint) {
      const svg = svgRef.current;
      const ctm = svg?.getScreenCTM?.();
      if (svg && ctm) {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const p = pt.matrixTransform(ctm.inverse());
        const x = xMin + ((p.x - pad.left) / Math.max(1e-9, plotW)) * (xMax - xMin);
        const y = effYMax - ((p.y - pad.top) / Math.max(1e-9, plotH)) * (effYMax - effYMin);
        draggablePoint.onDrag(x, y);
        return;
      }
    }
    const d = navDragRef.current;
    if (!d || !(e.buttons & 1)) return;
    setNav((v) => ({ ...v, cx: d.cx - (e.clientX - d.x) / d.sx, cy: d.cy + (e.clientY - d.y) / d.sy }));
  };
  const onNavPointerUp = () => { navDragRef.current = null; pointDragRef.current = false; };
  const onPointPointerDown = (e: React.PointerEvent<SVGCircleElement>) => {
    if (!draggablePoint) return;
    e.preventDefault();
    e.stopPropagation();
    pointDragRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointPointerMove = (e: React.PointerEvent<SVGCircleElement>) => {
    if (!pointDragRef.current || !draggablePoint) return;
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    const x = xMin + ((p.x - pad.left) / Math.max(1e-9, plotW)) * (xMax - xMin);
    const y = effYMax - ((p.y - pad.top) / Math.max(1e-9, plotH)) * (effYMax - effYMin);
    draggablePoint.onDrag(x, y);
  };
  const onPointPointerUp = () => { pointDragRef.current = false; };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full h-auto ${maxHeightClass} ${framed ? 'border border-[var(--border)]' : ''} bg-[var(--card-bg)]`}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={interactiveView ? onNavPointerDown : undefined}
      onPointerMove={interactiveView ? onNavPointerMove : undefined}
      onPointerUp={interactiveView ? onNavPointerUp : undefined}
      onPointerCancel={interactiveView ? onNavPointerUp : undefined}
      onDoubleClick={interactiveView ? () => setNav({ cx: 0, cy: 0, zoom: 1 }) : undefined}
      style={interactiveView ? { touchAction: 'none' } : undefined}
    >
      {clipContent && (
        <defs>
          <clipPath id={`${ariaLabel.replace(/[^a-zA-Z0-9_-]/g, '')}-clip`}>
            <rect x="0" y="0" width={W} height={H - pad.bottom} />
          </clipPath>
        </defs>
      )}
      <g clipPath={clipContent ? `url(#${ariaLabel.replace(/[^a-zA-Z0-9_-]/g, '')}-clip)` : undefined}>
      {/* 微网格（0.5 单位）：极浅，像方格本内小格；只在小格模式出现 */}
      {microYs.map((v) => (
        <line
          key={`my${v}`}
          x1={pad.left}
          y1={sy(v)}
          x2={W - pad.right}
          y2={sy(v)}
          stroke="var(--border)"
          strokeWidth="0.45"
          strokeOpacity="0.34"
        />
      ))}
      {microXs.map((v) => (
        <line
          key={`mx${v}`}
          x1={sx(v)}
          y1={pad.top}
          x2={sx(v)}
          y2={H - pad.bottom}
          stroke="var(--border)"
          strokeWidth="0.45"
          strokeOpacity="0.34"
        />
      ))}

      {/* 细网格（不标数字，1 单位）：稍深于微网格，仍不抢曲线 */}
      {fineYs.map((v) => (
        <line
          key={`fy${v}`}
          x1={pad.left}
          y1={sy(v)}
          x2={W - pad.right}
          y2={sy(v)}
          stroke={sheetMode ? 'var(--fg)' : 'var(--border)'}
          strokeWidth={sheetMode ? 1 : 0.55}
          strokeOpacity={sheetMode ? 0.04 : 0.62}
        />
      ))}
      {fineXs.map((v) => (
        <line
          key={`fx${v}`}
          x1={sx(v)}
          y1={pad.top}
          x2={sx(v)}
          y2={H - pad.bottom}
          stroke={sheetMode ? 'var(--fg)' : 'var(--border)'}
          strokeWidth={sheetMode ? 1 : 0.55}
          strokeOpacity={sheetMode ? 0.04 : 0.62}
        />
      ))}

      {/* 主网格（带数字，≤6 条）：略重一档，0 处留给坐标轴 */}
      {yTicks.map((v) =>
        v === 0 ? null : (
          <line
            key={`gy${v}`}
            x1={pad.left}
            y1={sy(v)}
            x2={W - pad.right}
            y2={sy(v)}
            stroke={sheetMode ? 'var(--fg)' : 'var(--border)'}
            strokeWidth={sheetMode ? 1 : 0.9}
            strokeOpacity={sheetMode ? 0.1 : 1}
          />
        ),
      )}
      {xTicks.map((v) =>
        v === 0 ? null : (
          <line
            key={`gx${v}`}
            x1={sx(v)}
            y1={pad.top}
            x2={sx(v)}
            y2={H - pad.bottom}
            stroke={sheetMode ? 'var(--fg)' : 'var(--border)'}
            strokeWidth={sheetMode ? 1 : 0.9}
            strokeOpacity={sheetMode ? 0.1 : 1}
          />
        ),
      )}

      {/* 坐标轴（带正方向箭头；与端点标签留出安全距离） */}
      <line x1={pad.left} y1={zeroY} x2={W - 10} y2={zeroY} stroke="var(--fg)" strokeWidth="1" strokeOpacity={sheetMode ? 0.45 : 1} />
      <line x1={zeroX} y1={H - pad.bottom} x2={zeroX} y2={10} stroke="var(--fg)" strokeWidth="1" strokeOpacity={sheetMode ? 0.45 : 1} />
      <polygon points={`${W - 8},${zeroY} ${W - 17},${zeroY - 4.5} ${W - 17},${zeroY + 4.5}`} fill="var(--fg)" />
      <polygon points={`${zeroX},8 ${zeroX - 4.5},17 ${zeroX + 4.5},17`} fill="var(--fg)" />
      {draggablePoint && (
        <circle
          cx={sx(draggablePoint.x)} cy={sy(draggablePoint.y)} r={16}
          fill="transparent" stroke="transparent"
          style={{ cursor: 'grab', touchAction: 'none' }}
          onPointerDown={onPointPointerDown}
          onPointerMove={onPointPointerMove}
          onPointerUp={onPointPointerUp}
          onPointerCancel={onPointPointerUp}
        />
      )}

      {/* 几何叠加层（图形）：画在曲线之前，填充不会把主曲线染色 */}
      {overlays.map(renderOverlayShape)}

      {/* 曲线（第一个为主曲线：实线 + 描画动画；其余虚线弱化，无描画） */}
      {curves.map((c, i) => {
        const stroke = i === 0 ? 'var(--fg)' : 'var(--muted)';
        const width = i === 0 ? (sheetMode ? 2.2 : 1.5) : (sheetMode ? 1.5 : 1);
        const curveOpacity = sheetMode && i > 0 ? 0.45 : undefined;
        const dash: string | undefined = c.dashed || i > 0 ? '5 4' : undefined;
        const segs = c.segments ?? (c.points ? [c.points] : []);
        return (
          <g key={c.id}>
            {segs.map((seg, si) => (
              <AnimatedPolyline
                key={si}
                mathPoints={seg}
                sx={sx}
                sy={sy}
                stroke={stroke}
                width={width}
                dash={dash}
                opacity={curveOpacity}
                drawOnMount={i === 0 && si === 0}
              />
            ))}
          </g>
        );
      })}

      {/* 几何叠加层（文字）：画在曲线之后，避免被曲线切穿 */}
      {overlays.map(renderOverlayLabel)}

      {/* 标注层（对称轴/渐近线/顶点/截距）：越界整条不画，文字带光晕 + 按开口方向避让 */}
      {markers.length > 0 && (
        <g style={{ opacity: markersIn ? 1 : 0, transition: 'opacity 400ms ease' }}>
          {markers.map((m) => {
            const color = (c?: string) => c ?? 'var(--accent)';
            const vpx = m.vline ? sx(m.vline.x) : 0;
            const hpy = m.hline ? sy(m.hline.y) : 0;
            const dotVisible = m.dot != null && inPlotX(sx(m.dot.x)) && inPlotY(sy(m.dot.y));

            // 点标注落位：显式 place 优先；auto 时优先上方，顶到上沿再翻到下方（P4）
            let dotTx = 0;
            let dotTy = 0;
            let dotAnchor: 'start' | 'end' = 'start';
            if (dotVisible && m.dot) {
              const px = sx(m.dot.x);
              const py = sy(m.dot.y);
              const txt = mathMinus(m.dot.label ?? '');
              const w = estTextW(txt, 12);
              const wantAbove = m.dot.place === 'above' || (m.dot.place !== 'below' && py - 22 >= pad.top);
              // 横向：显式 side 优先；未指定时默认右，若右侧会顶出画布则翻到左
              const wantRight = m.dot.side !== 'left' && px + 8 + w <= W - 4;
              const flipLeft = m.dot.side === 'left' || !wantRight;
              dotTx = flipLeft ? px - 8 : px + 8;
              dotTy = wantAbove ? py - 9 : py + 17;
              dotAnchor = flipLeft ? 'end' : 'start';
            }

            return (
              <g key={m.key}>
                {m.vline != null && inPlotX(vpx) && (
                  <>
                    {!m.vline.noLine && (
                      <line
                        x1={vpx} y1={pad.top} x2={vpx} y2={H - pad.bottom}
                        stroke={color(m.vline.color)} strokeWidth="1" strokeDasharray="5 4"
                      />
                    )}
                    {m.vline.label != null && (
                      <text
                        /* 与坐标轴重合的「渐近线」类标注（noLine）落到轴的**下端**，
                           把上端留给 y 轴名，两个标签才不会在同一处叠成一团 */
                        x={clamp(vpx + 4, pad.left + 2, W - pad.right - 4 - estTextW(mathMinus(m.vline.label)))}
                        y={m.vline.noLine || m.vline.labelPlace === 'bottom' ? H - pad.bottom - 36 : pad.top + 12}
                        fontSize="11" fontWeight="500"
                        fill={color(m.vline.color)} fontFamily="var(--f-mono)"
                        {...TEXT_HALO}
                      >
                        {mathMinus(m.vline.label)}
                      </text>
                    )}
                  </>
                )}
                {m.hline != null && inPlotY(hpy) && (
                  <>
                    {!m.hline.noLine && (
                      <line
                        x1={pad.left} y1={hpy} x2={W - pad.right} y2={hpy}
                        stroke={color(m.hline.color)} strokeWidth="1" strokeDasharray="5 4"
                      />
                    )}
                    {m.hline.label != null && (
                      <text
                        x={m.hline.labelPlace === 'left' ? pad.left + 4 : W - pad.right - 4}
                        y={hpy - 6}
                        textAnchor={m.hline.labelPlace === 'left' ? 'start' : 'end'}
                        fontSize="11" fontWeight="500"
                        fill={color(m.hline.color)} fontFamily="var(--f-mono)"
                        {...TEXT_HALO}
                      >
                        {mathMinus(m.hline.label)}
                      </text>
                    )}
                  </>
                )}
                {dotVisible && m.dot && (
                  <>
                    <circle cx={sx(m.dot.x)} cy={sy(m.dot.y)} r={4}
                      fill={color(m.dot.color)} stroke="var(--card-bg)" strokeWidth={1} />
                    {m.dot.label != null && (
                      <text x={dotTx} y={dotTy} textAnchor={dotAnchor} fontSize="12" fontWeight="600"
                        fill={color(m.dot.color)} fontFamily="var(--f-mono)"
                        {...TEXT_HALO}>
                        {mathMinus(m.dot.label)}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}
        </g>
      )}

      {/* 刻度标签与原点**最后画**：曲线会贴近坐标轴（反比例双曲线尤其），先画数字会被曲线压住；
          文字带光晕，压在最上层时任何线条都不会切穿笔画 */}
      {xTicks.map((v) => {
        const px = sx(v);
        if (v === 0 || px < 30 || px > W - 30) return null;
        return (
          <text
            key={`tx${v}`}
            x={clamp(px, pad.left + 6, W - pad.right - 2)}
            y={xTickY}
            textAnchor="middle"
            fontSize={tickFont}
            fill="var(--muted)"
            fontFamily="var(--f-mono)"
            {...TEXT_HALO}
          >
            {mathMinus(v)}
          </text>
        );
      })}
      {yTicks.map((v) => {
        const py = sy(v);
        if (v === 0 || py < 30 || py > H - 30) return null;
        return (
          <text
            key={`ty${v}`}
            x={yTickX}
            y={clamp(py + 4, pad.top + 10, H - pad.bottom - 2)}
            textAnchor="end"
            fontSize={tickFont}
            fill="var(--muted)"
            fontFamily="var(--f-mono)"
            {...TEXT_HALO}
          >
            {mathMinus(v)}
          </text>
        );
      })}

      {/* 原点 0：仍在轴交点左下，但夹进画布 */}
      <text
        x={clamp(zeroX - 8, pad.left + 4, W - pad.right - 4)}
        y={clamp(zeroY + 15, pad.top + 12, H - 6)}
        textAnchor="end"
        fontSize={tickFont}
        fill="var(--muted)"
        fontFamily="var(--f-mono)"
        {...TEXT_HALO}
      >
        0
      </text>

      {/* 图例（A5）：真 <line> 线型 + 动态底板 + 右上角；全画布工具栏可关闭 */}
      {showLegend && curves.length > 0 && (
        <g fontFamily="var(--f-mono)" fontSize={tickFont}>
          <rect
            x={legendX}
            y={legendY}
            width={legendW}
            height={legendH}
            rx="2"
            fill="var(--card-bg)"
            opacity="0.88"
          />
          {curves.map((c, i) => {
            const rowY = legendY + 14 + i * 16;
            const dashed = c.dashed || i > 0;
            return (
              <g key={`lg${c.id}`}>
                <line
                  x1={legendX + 6}
                  y1={rowY - 4}
                  x2={legendX + 20}
                  y2={rowY - 4}
                  stroke={i === 0 ? 'var(--fg)' : 'var(--muted)'}
                  strokeWidth={i === 0 ? 1.5 : 1}
                  strokeDasharray={dashed ? '4 3' : undefined}
                />
                <text x={legendX + 26} y={rowY} fill={i === 0 ? 'var(--fg)' : 'var(--muted)'}>
                  {mathMinus(c.label ?? '')}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* 轴名称：x 在轴线右端外侧、y 在轴线上端上方（不再压住末端刻度，P1） */}
      {xLabel && (
        <text
          x={xNameX}
          y={xNameY}
          textAnchor="middle"
          fontSize="12"
          fontStyle="italic"
          fontWeight="500"
          fill="var(--fg)"
          fontFamily="var(--f-mono)"
          {...TEXT_HALO}
        >
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text
          x={yNameX}
          y={yNameY}
          textAnchor="start"
          fontSize="12"
          fontStyle="italic"
          fontWeight="500"
          fill="var(--fg)"
          fontFamily="var(--f-mono)"
          {...TEXT_HALO}
        >
          {yLabel}
        </text>
      )}
      </g>
    </svg>
  );
}
