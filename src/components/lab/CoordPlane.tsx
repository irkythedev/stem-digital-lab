/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 通用 SVG 坐标系：网格 + 坐标轴 + 刻度 + 多曲线叠加。
 * 数学坐标 y 向上，内部映射到 SVG（y 翻转）；y 范围未提供时自动适配曲线。
 * 视觉纪律：只用 --fg / --muted / --border，主曲线实线、叠加曲线虚线。
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

interface CoordPlaneProps {
  curves: CoordCurve[];
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
const PAD = { top: 18, right: 18, bottom: 26, left: 30 };
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
  clip,
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
  /** 绘图区边界 [xMin, xMax, yMin, yMax]（像素），曲线点出界时裁剪到边缘，避免穿出图框 */
  clip?: [number, number, number, number];
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
    return () => {
      cancelAnimationFrame(raf);
      el.style.transition = '';
    };
  }, [drawOnMount]);

  return (
    <polyline
      ref={polyRef}
      points={display
        .map(([x, y]) => {
          const px = sx(x);
          const py = sy(y);
          if (clip) {
            const [cx0, cx1, cy0, cy1] = clip;
            return `${Math.min(Math.max(px, cx0), cx1)},${Math.min(Math.max(py, cy0), cy1)}`;
          }
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

export default function CoordPlane({
  curves,
  xMin = -5,
  xMax = 5,
  yMin,
  yMax,
  ariaLabel = 'coordinate plane',
  xLabel,
  yLabel,
}: CoordPlaneProps) {
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
  const padY = Math.max((autoYMax - autoYMin) * 0.1, 0.5);
  const effYMin = yMin ?? Math.floor(autoYMin - padY);
  const effYMax = yMax ?? Math.ceil(autoYMax + padY);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y: number) => PAD.top + ((effYMax - y) / (effYMax - effYMin)) * plotH;

  // 1/2/5/10 系自适应步长（Y 轴与 X 轴共用），目标标签数 ≈7
  const niceStep = (range: number): number => {
    const raw = range / 7;
    const m = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / m;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * m;
  };

  // y 轴刻度
  const yRange = effYMax - effYMin;
  const yTick = niceStep(yRange);
  const yTicks: number[] = [];
  for (let v = Math.ceil(effYMin / yTick) * yTick; v <= effYMax; v += yTick) {
    if (Math.abs(v) < 1e-9) v = 0;
    yTicks.push(v);
  }

  // x 轴刻度：同样 1/2/5/10 自适应（修复 C-3：原来硬编码 step=1，大范围时标签重叠）
  const xRange = xMax - xMin;
  const xTick = niceStep(xRange);
  const xTicks: number[] = [];
  for (let v = Math.ceil(xMin / xTick) * xTick; v <= xMax + 1e-9; v += xTick) {
    if (Math.abs(v) < 1e-9) v = 0;
    xTicks.push(v);
  }

  const zeroX = sx(0);
  const zeroY = sy(0);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto max-h-[450px] border border-[var(--border)] bg-[var(--card-bg)]"
      role="img"
      aria-label={ariaLabel}
    >
      {/* 网格 */}
      {yTicks.map((v) => (
        <line
          key={`gy${v}`}
          x1={PAD.left}
          y1={sy(v)}
          x2={W - PAD.right}
          y2={sy(v)}
          stroke="var(--border)"
          strokeWidth="0.5"
        />
      ))}
      {xTicks.map((v) => (
        <line
          key={`gx${v}`}
          x1={sx(v)}
          y1={PAD.top}
          x2={sx(v)}
          y2={H - PAD.bottom}
          stroke="var(--border)"
          strokeWidth="0.5"
        />
      ))}

      {/* 坐标轴 */}
      <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY} stroke="var(--fg)" strokeWidth="1" />
      <line x1={zeroX} y1={PAD.top} x2={zeroX} y2={H - PAD.bottom} stroke="var(--fg)" strokeWidth="1" />

      {/* 刻度标签 */}
      {xTicks.map((v) =>
        v === 0 ? null : (
          <text
            key={`tx${v}`}
            x={sx(v)}
            y={H - PAD.bottom + 14}
            textAnchor="middle"
            fontSize="9"
            fill="var(--muted)"
            fontFamily="var(--f-mono)"
          >
            {v}
          </text>
        ),
      )}
      {yTicks.map((v) =>
        v === 0 ? null : (
          <text
            key={`ty${v}`}
            x={PAD.left - 6}
            y={sy(v) + 3}
            textAnchor="end"
            fontSize="9"
            fill="var(--muted)"
            fontFamily="var(--f-mono)"
          >
            {v}
          </text>
        ),
      )}

      {/* 原点 */}
      <text x={zeroX - 8} y={zeroY + 14} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--f-mono)">
        0
      </text>

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
                clip={[PAD.left, W - PAD.right, PAD.top, H - PAD.bottom]}
              />
            ))}
          </g>
        );
      })}

      {/* 图例（半透明背景矩形避免与曲线/网格重叠） */}
      {curves.length > 0 && (
        <g fontFamily="var(--f-mono)" fontSize="10">
          <rect
            x={PAD.left + 2}
            y={PAD.top + 2}
            width={120}
            height={curves.length * 14 + 6}
            rx="2"
            fill="var(--card-bg)"
            opacity="0.85"
          />
          {curves.map((c, i) => (
            <text
              key={`lg${c.id}`}
              x={PAD.left + 6}
              y={PAD.top + 12 + i * 14}
              fill={i === 0 ? 'var(--fg)' : 'var(--muted)'}
            >
              {i === 0 ? '— ' : '- - '}
              {c.label ?? ''}
            </text>
          ))}
        </g>
      )}

      {/* 轴名称标签 */}
      {xLabel && (
        <text
          x={W - PAD.right}
          y={H - 4}
          textAnchor="end"
          fontSize="10"
          fill="var(--muted)"
          fontFamily="var(--f-mono)"
        >
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text
          x={6}
          y={PAD.top + 2}
          textAnchor="start"
          fontSize="10"
          fill="var(--muted)"
          fontFamily="var(--f-mono)"
        >
          {yLabel}
        </text>
      )}
    </svg>
  );
}
