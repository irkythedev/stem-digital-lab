/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学公式配图（函数类）：轻量静态坐标系 + 函数曲线。
 * - linear     一次函数 y = kx + b（直线 + 截距标注）
 * - quadratic  二次函数顶点（抛物线 + 顶点 + 对称轴虚线）
 * - inverse    反比例函数（双曲线两支）
 * - kabs       |k| 几何意义（双曲线 + 阴影矩形）
 * 坐标刻度与曲线采样严格按函数计算，标注对照教材；主题色自适应。
 */
import { useApp } from '../../lib/app-context';

export type FunctionDiagramType = 'linear' | 'quadratic' | 'inverse' | 'kabs';

interface FunctionDiagramProps {
  type: FunctionDiagramType;
  className?: string;
}

/** 坐标系视图：x ∈ [-5, 5]，y ∈ [-5, 5]，320×240 */
const W = 320, H = 240;
const PAD = { left: 28, right: 12, top: 12, bottom: 24 };
const PLOT_W = W - PAD.left - PAD.right;   // 280
const PLOT_H = H - PAD.top - PAD.bottom;   // 204
const X_MIN = -5, X_MAX = 5, Y_MIN = -5, Y_MAX = 5;
const sx = (x: number) => PAD.left + ((x - X_MIN) / (X_MAX - X_MIN)) * PLOT_W;
const sy = (y: number) => PAD.top + ((Y_MAX - y) / (Y_MAX - Y_MIN)) * PLOT_H;

/** 把点列转成 SVG path */
function toPath(pts: [number, number][]): string {
  if (pts.length === 0) return '';
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(' ');
}

/** 采样函数曲线 */
function sample(fn: (x: number) => number, xMin: number, xMax: number, step = 0.2, guard?: (y: number) => boolean): [number, number][] {
  const pts: [number, number][] = [];
  for (let x = xMin; x <= xMax + 1e-9; x += step) {
    const y = fn(x);
    if (guard && !guard(y)) continue;
    pts.push([x, y]);
  }
  return pts;
}

export default function FunctionDiagram({ type, className = '' }: FunctionDiagramProps) {
  const { lang } = useApp();
  const FG = 'var(--fg)';
  const MUT = 'var(--muted)';
  const ACC = 'var(--accent)';
  const BG = 'var(--card-bg)';

  const labels = {
    linear: lang === 'zh' ? '一次函数 y=kx+b：k>0 直线上升，b 为 y 轴截距' : 'Linear function y=kx+b: rises when k>0, b is the y-intercept',
    quadratic: lang === 'zh' ? '二次函数 y=ax²+bx+c：顶点与对称轴' : 'Quadratic y=ax²+bx+c: vertex and axis of symmetry',
    inverse: lang === 'zh' ? '反比例函数 y=k/x：双曲线两支' : 'Inverse variation y=k/x: two hyperbola branches',
    kabs: lang === 'zh' ? '反比例函数 |k| 的几何意义：矩形面积 = |k|' : 'Geometric meaning of |k|: rectangle area equals |k|',
  } as const;

  // 曲线数据
  let curves: { d: string; stroke: string; width: number; dash?: string }[] = [];
  let annotate: { x: number; y: number; text: string; fill?: string; italic?: boolean }[] = [];

  if (type === 'linear') {
    // y = 2x - 1（采样裁剪到视口 y∈[-5,5]）
    const clip = (y: number) => y >= Y_MIN && y <= Y_MAX;
    curves = [{ d: toPath(sample((x) => 2 * x - 1, -5, 5, 0.2, clip)), stroke: ACC, width: 1.6 }];
    annotate = [
      { x: -4.4, y: 4.6, text: 'y = 2x − 1', fill: ACC, italic: true },
      { x: -5.3, y: -0.5, text: 'b=−1', fill: MUT },
    ];
  } else if (type === 'quadratic') {
    // y = x² - 2x - 1 = (x-1)² - 2，顶点 (1, -2)（采样裁剪到视口）
    const clip = (y: number) => y >= Y_MIN && y <= Y_MAX;
    curves = [
      { d: toPath(sample((x) => x * x - 2 * x - 1, -5, 5, 0.2, clip)), stroke: ACC, width: 1.6 },
      { d: `M${sx(1).toFixed(1)} ${sy(Y_MIN)} L${sx(1).toFixed(1)} ${sy(Y_MAX)}`, stroke: MUT, width: 0.8, dash: '4 3' }, // 对称轴 x=1
    ];
    annotate = [
      { x: -4.8, y: 4.7, text: 'y = x² − 2x − 1', fill: ACC, italic: true },
      { x: 1.4, y: -1.2, text: '顶点(1,−2)', fill: FG },
    ];
  } else if (type === 'inverse') {
    // y = 4/x，两支（采样裁剪到视口 y∈[-5,5]，避免画出界）
    const clip = (y: number) => y >= Y_MIN && y <= Y_MAX;
    curves = [
      { d: toPath(sample((x) => 4 / x, -5, -0.2, 0.2, clip)), stroke: ACC, width: 1.6 },
      { d: toPath(sample((x) => 4 / x, 0.2, 5, 0.2, clip)), stroke: ACC, width: 1.6 },
    ];
    annotate = [
      { x: -4.6, y: 4.6, text: 'y = 4/x', fill: ACC, italic: true },
      { x: 3.0, y: 1.4, text: 'k > 0', fill: MUT },
    ];
  } else {
    // kabs: y = 4/x + 阴影矩形（点 P(2, 2)，矩形面积 = |k| = 4）
    const px = 2, py = 2; // P 在双曲线上 (2, 2)
    const clip = (y: number) => y >= Y_MIN && y <= Y_MAX;
    const rect = `M${sx(0).toFixed(1)} ${sy(0).toFixed(1)} H${sx(px).toFixed(1)} V${sy(py).toFixed(1)} H${sx(0).toFixed(1)} Z`;
    curves = [
      { d: rect, stroke: 'none', width: 0 }, // 阴影矩形（单独画 fill）
      { d: toPath(sample((x) => 4 / x, -5, -0.2, 0.2, clip)), stroke: ACC, width: 1.4 },
      { d: toPath(sample((x) => 4 / x, 0.2, 5, 0.2, clip)), stroke: ACC, width: 1.4 },
    ];
    annotate = [
      { x: 0.4, y: 2.4, text: 'P(2, 2)', fill: FG },
      { x: -4.8, y: 4.6, text: 'S = |k| = 4', fill: ACC, italic: true },
    ];
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={labels[type]}>
      {/* 网格（细） */}
      {[-4, -2, 0, 2, 4].map((v) => (
        <g key={v}>
          <line x1={sx(v)} y1={sy(Y_MIN)} x2={sx(v)} y2={sy(Y_MAX)} stroke={MUT} strokeWidth="0.3" opacity="0.25" />
          <line x1={sx(X_MIN)} y1={sy(v)} x2={sx(X_MAX)} y2={sy(v)} stroke={MUT} strokeWidth="0.3" opacity="0.25" />
        </g>
      ))}
      {/* 坐标轴 */}
      <line x1={sx(X_MIN)} y1={sy(0)} x2={sx(X_MAX)} y2={sy(0)} stroke={FG} strokeWidth="1.1" />
      <line x1={sx(0)} y1={sy(Y_MAX)} x2={sx(0)} y2={sy(Y_MIN)} stroke={FG} strokeWidth="1.1" />
      {/* 箭头：x 轴指向右端（正方向），y 轴指向顶端（正方向向上） */}
      <path d={`M${sx(X_MAX)} ${sy(0)} l-5 -2.5 v5 Z`} fill={FG} />
      <path d={`M${sx(0)} ${sy(Y_MAX)} l-2.5 5 h5 Z`} fill={FG} />
      {/* 刻度数字 */}
      <text x={sx(1)} y={sy(0) + 13} fontSize="8" fill={MUT} textAnchor="middle" fontFamily="var(--f-mono)">1</text>
      <text x={sx(2)} y={sy(0) + 13} fontSize="8" fill={MUT} textAnchor="middle" fontFamily="var(--f-mono)">2</text>
      <text x={sx(-1)} y={sy(0) + 13} fontSize="8" fill={MUT} textAnchor="middle" fontFamily="var(--f-mono)">−1</text>
      <text x={sx(0) + 6} y={sy(1) + 3} fontSize="8" fill={MUT} fontFamily="var(--f-mono)">1</text>
      <text x={sx(0) + 6} y={sy(2) + 3} fontSize="8" fill={MUT} fontFamily="var(--f-mono)">2</text>
      <text x={sx(0) + 6} y={sy(-1) + 3} fontSize="8" fill={MUT} fontFamily="var(--f-mono)">−1</text>
      {/* 轴名 */}
      <text x={sx(X_MAX) - 8} y={sy(0) + 20} fontSize="9" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">x</text>
      <text x={sx(0) + 14} y={sy(Y_MAX) + 8} fontSize="9" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">y</text>

      {/* 阴影矩形（kabs） */}
      {type === 'kabs' && (
        <path d={`M${sx(0).toFixed(1)} ${sy(0).toFixed(1)} H${sx(2).toFixed(1)} V${sy(2).toFixed(1)} H${sx(0).toFixed(1)} Z`} fill="rgba(199,29,35,0.12)" stroke={ACC} strokeWidth="1" strokeDasharray="4 3" />
      )}

      {/* 曲线 */}
      {curves.map((c, i) => (
        <path key={i} d={c.d} fill="none" stroke={c.stroke} strokeWidth={c.width} strokeDasharray={c.dash} strokeLinecap="round" strokeLinejoin="round" />
      ))}

      {/* 标注 */}
      {annotate.map((a, i) => (
        <text
          key={i}
          x={sx(a.x)}
          y={sy(a.y)}
          fontSize="10"
          fill={a.fill ?? FG}
          fontFamily="var(--f-serif)"
          fontStyle={a.italic ? 'italic' : 'normal'}
        >
          {a.text}
        </text>
      ))}
    </svg>
  );
}
