/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 天平 SVG 组件：称量前后质量对比显示。
 * 并排显示两个天平（反应前 / 反应后），指针摆动 + 质量数值。
 *
 * 视觉纪律：只用 --fg / --muted / --border / --accent / --error。
 */

interface BalanceScaleProps {
  beforeMass: number;
  afterMass: number;
  /** 是否显示反应后（用于动画过渡） */
  showAfter?: boolean;
  /** 质量单位 */
  unit?: string;
}

const SCALE = 0.6;
const CX = 120;
const CY = 100;

/** 天平底座 + 横梁 + 指针 + 托盘 */
function SingleScale({
  mass,
  label,
  accent,
}: {
  mass: number;
  label: string;
  accent: string;
}) {
  const beamAngle = 0; // 简化：水平
  const panY = CY + 30;

  return (
    <g>
      {/* 底座 */}
      <rect x={CX - 40} y={CY + 50} width={80} height={8} rx={2}
        fill="var(--muted)" opacity={0.3} />
      {/* 立柱 */}
      <rect x={CX - 3} y={CY - 10} width={6} height={62}
        fill="var(--muted)" opacity={0.4} />
      {/* 横梁 */}
      <line x1={CX - 50} y1={CY} x2={CX + 50} y2={CY}
        stroke="var(--fg)" strokeWidth={2.5} />
      {/* 指针 */}
      <line x1={CX} y1={CY} x2={CX} y2={CY + 30}
        stroke={accent} strokeWidth={1.5} />
      <circle cx={CX} cy={CY} r={4} fill={accent} />
      {/* 左托盘（放被测物） */}
      <line x1={CX - 50} y1={CY} x2={CX - 50} y2={panY}
        stroke="var(--muted)" strokeWidth={1.2} />
      <line x1={CX - 60} y1={panY} x2={CX - 40} y2={panY}
        stroke="var(--muted)" strokeWidth={1.5} />
      {/* 被测物（左盘） */}
      <rect x={CX - 56} y={panY - 12} width={10} height={12} rx={1}
        fill="var(--fg)" opacity={0.4} />
      {/* 右托盘（放砝码） */}
      <line x1={CX + 50} y1={CY} x2={CX + 50} y2={panY}
        stroke="var(--muted)" strokeWidth={1.2} />
      <line x1={CX + 40} y1={panY} x2={CX + 60} y2={panY}
        stroke="var(--muted)" strokeWidth={1.5} />
      {/* 砝码（右盘，叠放） */}
      <rect x={CX + 42} y={panY - 14} width={12} height={6} rx={1}
        fill="var(--fg)" opacity={0.35} />
      <rect x={CX + 44} y={panY - 8} width={8} height={8} rx={1}
        fill="var(--fg)" opacity={0.25} />
      {/* 质量数值 */}
      <text x={CX} y={CY + 80} textAnchor="middle"
        fill={accent} fontSize={14} className="mono-font font-bold">
        {mass.toFixed(1)}
      </text>
      {/* 标签 */}
      <text x={CX} y={CY + 95} textAnchor="middle"
        fill="var(--muted)" fontSize={10} className="mono-font">
        {label}
      </text>
    </g>
  );
}

export default function BalanceScale({
  beforeMass,
  afterMass,
  showAfter = false,
  unit = 'g',
}: BalanceScaleProps) {
  const equal = Math.abs(beforeMass - afterMass) < 0.01;

  return (
    <svg viewBox="0 0 360 200" className="w-full max-h-[350px]" aria-label="天平">
      {/* 反应前 */}
      <g transform={`translate(0, 0) scale(${SCALE})`}>
        <SingleScale mass={beforeMass} label="反应前" accent="var(--fg)" />
      </g>

      {/* 箭头 */}
      <text x={180} y={70} textAnchor="middle"
        fill="var(--muted)" fontSize={18} className="mono-font">→</text>

      {/* 反应后 */}
      <g transform={`translate(180, 0) scale(${SCALE})`}
        style={{ opacity: showAfter ? 1 : 0.3, transition: 'opacity 0.5s' }}>
        <SingleScale
          mass={afterMass}
          label="反应后"
          accent={equal ? 'var(--fg)' : 'var(--error)'}
        />
      </g>

      {/* 单位 */}
      <text x={180} y={185} textAnchor="middle"
        fill="var(--muted)" fontSize={10} className="mono-font">
        {unit}
      </text>

      {/* 质量变化提示 */}
      {showAfter && (
        <text x={180} y={20} textAnchor="middle"
          fill={equal ? 'var(--fg)' : 'var(--error)'}
          fontSize={12} className="mono-font">
          {equal
            ? '✓ 反应前后质量相等'
            : `✗ 质量变化: ${(afterMass - beforeMass) > 0 ? '+' : ''}${(afterMass - beforeMass).toFixed(1)} ${unit}`}
        </text>
      )}
    </svg>
  );
}
