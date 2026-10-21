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
  vline?: { x: number; label?: string; color?: string; noLine?: boolean };
  hline?: { y: number; label?: string; color?: string; noLine?: boolean };
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

interface CoordPlaneProps {
  curves: CoordCurve[];
  /** 标注层（对称轴/渐近线/顶点等），随参数实时移动 */
  markers?: CoordMarker[];
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  ariaLabel?: string;
  /** X 轴名称标签（如 "U/V"），不传则不显示 */
  xLabel?: string;
  /** Y 轴名称标签（如 "I/A"），不传则不显示 */
  yLabel?: string;
}

const W = 520;
const H = 380;
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
  xMin = -5,
  xMax = 5,
  yMin,
  yMax,
  ariaLabel = 'coordinate plane',
  xLabel,
  yLabel,
}: CoordPlaneProps) {
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
  // commit 后把本次目标曲线范围记为下一次动画的 from
  useEffect(() => {
    prevAutoRange.current = { min: autoYMin, max: autoYMax };
  });

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  /* ---------- 网格双层化（教材坐标纸）：细网格 8~10 格 + 主网格带数字 ---------- */
  const xRange = xMax - xMin;
  const fineX = fineStep(xRange);
  const fineY = fineStep(effYMax - effYMin);

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

  const sx = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y: number) => PAD.top + ((effYMax - y) / (effYMax - effYMin)) * plotH;

  // y 轴刻度（主网格，带数字）
  const yRange = effYMax - effYMin;
  const yTick = majorStepFor(yRange, fineY);
  const yTicks: number[] = [];
  for (let v = Math.ceil(effYMin / yTick - 1e-9) * yTick; v <= effYMax + 1e-9; v += yTick) {
    yTicks.push(Math.abs(v) < 1e-9 ? 0 : v);
  }

  // x 轴刻度（主网格，带数字）：1/2/5 自适应，范围大时自动放大步长，避免标签重叠
  const xTick = majorStepFor(xRange, fineX);
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

  const zeroX = sx(0);
  const zeroY = sy(0);

  /* ---------- 文字落位（A3 贴轴 / A2 光晕）：全部夹进画布，绝不越界 ---------- */
  const tickFont = 11;
  const xTickY = clamp(zeroY + 15, PAD.top + 12, H - 6); // 贴 x 轴下方，而不是钉在画布底边
  const yTickX = Math.max(zeroX - 6, PAD.left - 6);      // 贴 y 轴左侧，轴在左边时退回 PAD 内
  const xNameX = W - 4;                                   // x 轴名放在轴线右端外侧
  // 轴在下半区（物理/化学的 I-U、pH-V 图，轴就是底边）时，刻度数字正好压在轴下方那一行，
  // 轴名再放同一行会与末端刻度重叠（实测中和反应 '50' 与 'V / mL' 交叠 13×2px）。
  // 故：轴在下半区 → 轴名移到轴线上方内侧；轴在中间/上方（数学三实验）→ 保持轴下方。
  const axisLow = zeroY > (PAD.top + (H - PAD.bottom)) / 2;
  const xNameY = clamp(axisLow ? zeroY - 6 : zeroY + 4, PAD.top + 12, H - 8);
  const yNameX = Math.min(zeroX + 5, W - 12);             // y 轴名放在轴线上端上方
  const yNameY = Math.max(PAD.top - 8, 12);

  /** 特征点是否落在绘图区内（越界整条不画，避免半截虚线与画布外标签，P10） */
  const inPlotX = (px: number): boolean => px >= PAD.left - 0.5 && px <= W - PAD.right + 0.5;
  const inPlotY = (py: number): boolean => py >= PAD.top - 0.5 && py <= H - PAD.bottom + 0.5;

  /* ---------- 图例（A5）：真 <line> 线型 + 动态底板 + 移到右上角 ---------- */
  const legendW = Math.max(
    120,
    ...curves.map((c) => estTextW(mathMinus(c.label ?? ''), tickFont) + 34),
  );
  const legendX = W - PAD.right - legendW;
  const legendY = PAD.top + 2;
  const legendH = curves.length * 16 + 8;

  // 标注层首次挂载淡入
  const [markersIn, setMarkersIn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMarkersIn(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto max-h-[450px] border border-[var(--border)] bg-[var(--card-bg)]"
      role="img"
      aria-label={ariaLabel}
    >
      {/* 细网格（不标数字，8~10 格）：0.5px、55% 不透明度，才不抢曲线 */}
      {fineYs.map((v) => (
        <line
          key={`fy${v}`}
          x1={PAD.left}
          y1={sy(v)}
          x2={W - PAD.right}
          y2={sy(v)}
          stroke="var(--border)"
          strokeWidth="0.5"
          strokeOpacity="0.45"
        />
      ))}
      {fineXs.map((v) => (
        <line
          key={`fx${v}`}
          x1={sx(v)}
          y1={PAD.top}
          x2={sx(v)}
          y2={H - PAD.bottom}
          stroke="var(--border)"
          strokeWidth="0.5"
          strokeOpacity="0.45"
        />
      ))}

      {/* 主网格（带数字，≤6 条）：略重一档，0 处留给坐标轴 */}
      {yTicks.map((v) =>
        v === 0 ? null : (
          <line
            key={`gy${v}`}
            x1={PAD.left}
            y1={sy(v)}
            x2={W - PAD.right}
            y2={sy(v)}
            stroke="var(--border)"
            strokeWidth="0.9"
          />
        ),
      )}
      {xTicks.map((v) =>
        v === 0 ? null : (
          <line
            key={`gx${v}`}
            x1={sx(v)}
            y1={PAD.top}
            x2={sx(v)}
            y2={H - PAD.bottom}
            stroke="var(--border)"
            strokeWidth="0.9"
          />
        ),
      )}

      {/* 坐标轴 */}
      <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY} stroke="var(--fg)" strokeWidth="1" />
      <line x1={zeroX} y1={PAD.top} x2={zeroX} y2={H - PAD.bottom} stroke="var(--fg)" strokeWidth="1" />

      {/* 曲线（第一个为主曲线：实线 + 描画动画；其余虚线弱化，无描画） */}
      {curves.map((c, i) => {
        const stroke = i === 0 ? 'var(--fg)' : 'var(--muted)';
        const width = i === 0 ? 1.5 : 1;
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
                drawOnMount={i === 0 && si === 0}
              />
            ))}
          </g>
        );
      })}

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
              const wantAbove = m.dot.place === 'above' || (m.dot.place !== 'below' && py - 22 >= PAD.top);
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
                        x1={vpx} y1={PAD.top} x2={vpx} y2={H - PAD.bottom}
                        stroke={color(m.vline.color)} strokeWidth="1" strokeDasharray="5 4"
                      />
                    )}
                    {m.vline.label != null && (
                      <text
                        /* 与坐标轴重合的「渐近线」类标注（noLine）落到轴的**下端**，
                           把上端留给 y 轴名，两个标签才不会在同一处叠成一团 */
                        x={clamp(vpx + 4, PAD.left + 2, W - PAD.right - 4 - estTextW(mathMinus(m.vline.label)))}
                        y={m.vline.noLine ? H - PAD.bottom - 8 : PAD.top + 12}
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
                        x1={PAD.left} y1={hpy} x2={W - PAD.right} y2={hpy}
                        stroke={color(m.hline.color)} strokeWidth="1" strokeDasharray="5 4"
                      />
                    )}
                    {m.hline.label != null && (
                      <text
                        x={W - PAD.right - 4}
                        y={hpy - 6}
                        textAnchor="end"
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
      {xTicks.map((v) =>
        v === 0 ? null : (
          <text
            key={`tx${v}`}
            x={clamp(sx(v), PAD.left + 6, W - PAD.right - 2)}
            y={xTickY}
            textAnchor="middle"
            fontSize={tickFont}
            fill="var(--muted)"
            fontFamily="var(--f-mono)"
            {...TEXT_HALO}
          >
            {mathMinus(v)}
          </text>
        ),
      )}
      {yTicks.map((v) =>
        v === 0 ? null : (
          <text
            key={`ty${v}`}
            x={yTickX}
            y={clamp(sy(v) + 4, PAD.top + 10, H - PAD.bottom - 2)}
            textAnchor="end"
            fontSize={tickFont}
            fill="var(--muted)"
            fontFamily="var(--f-mono)"
            {...TEXT_HALO}
          >
            {mathMinus(v)}
          </text>
        ),
      )}

      {/* 原点 0：仍在轴交点左下，但夹进画布 */}
      <text
        x={clamp(zeroX - 9, PAD.left + 4, W - PAD.right - 4)}
        y={clamp(zeroY + 17, PAD.top + 12, H - 6)}
        textAnchor="middle"
        fontSize={tickFont}
        fill="var(--muted)"
        fontFamily="var(--f-mono)"
        {...TEXT_HALO}
      >
        0
      </text>

      {/* 图例（A5）：真 <line> 线型 + 动态底板 + 右上角（避开顶点标注常见的左侧落点） */}
      {curves.length > 0 && (
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
          textAnchor="end"
          fontSize="12"
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
          fontWeight="500"
          fill="var(--fg)"
          fontFamily="var(--f-mono)"
          {...TEXT_HALO}
        >
          {yLabel}
        </text>
      )}
    </svg>
  );
}
