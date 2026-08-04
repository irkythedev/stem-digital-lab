/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 电路图公共 SVG 零件：灯泡、闸刀开关、电池、保险丝、滑动变阻器、固定电表。
 * 视觉纪律与全站一致：1px 描边 var(--fg)、card-bg 填充、无阴影无渐变。
 * 8 例经典电路图样式共享这些零件，避免重复绘制。
 */
import type { ReactNode } from 'react';

/* ---------- 灯泡（灯丝发光 + 玻璃透亮 + 分层光晕，亮度随功率） ---------- */
export function Bulb({
  cx,
  cy,
  r = 12,
  glow = 0,
  label,
  labelY,
}: {
  cx: number;
  cy: number;
  r?: number;
  /** 亮度 0..1（功率归一化，同电路内相对） */
  glow?: number;
  label?: ReactNode;
  labelY?: number;
}) {
  const g = Math.max(0, Math.min(1, glow));
  const lit = g > 0.02;
  const filamentColor = g > 0.25 ? '#ffd166' : 'var(--fg)'; // 灯丝：通电变暖黄
  return (
    <g>
      {/* 光晕外圈（扩散） */}
      <circle
        cx={cx}
        cy={cy}
        r={r + 3}
        fill="rgba(255, 190, 80, 0.22)"
        opacity={g}
        style={{ transition: 'opacity 0.3s ease-out' }}
      />
      {/* 光晕内芯（亮核：饱和时仍可区分） */}
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.55}
        fill="rgba(255, 205, 120, 0.4)"
        opacity={g}
        style={{ transition: 'opacity 0.3s ease-out' }}
      />
      {/* 玻璃：通电透亮 */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={lit ? 'rgba(255, 190, 80, 0.1)' : 'var(--card-bg)'}
        stroke="var(--fg)"
        strokeWidth="1.2"
        style={{ transition: 'fill 0.3s ease-out' }}
      />
      {/* 灯丝：教科书「圆内 X」形，通电变暖黄（stroke 是 CSS 属性可过渡） */}
      <line
        x1={cx - r * 0.33}
        y1={cy - r * 0.33}
        x2={cx + r * 0.33}
        y2={cy + r * 0.33}
        stroke={filamentColor}
        strokeWidth="1.3"
        style={{ transition: 'stroke 0.3s ease-out' }}
      />
      <line
        x1={cx + r * 0.33}
        y1={cy - r * 0.33}
        x2={cx - r * 0.33}
        y2={cy + r * 0.33}
        stroke={filamentColor}
        strokeWidth="1.3"
        style={{ transition: 'stroke 0.3s ease-out' }}
      />
      {label && (
        <text x={cx} y={labelY ?? cy + r + 20} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--f-mono)">
          {label}
        </text>
      )}
    </g>
  );
}

/* ---------- 闸刀开关（闭合=水平接通，断开=翘起；transform rotate 过渡） ---------- */
export function BladeSwitch({
  x1,
  y1,
  x2,
  y2,
  on,
  onToggle,
  label,
  labelX,
  labelY,
  flipDown = false,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  on: boolean;
  onToggle: () => void;
  label: string;
  labelX?: number;
  labelY?: number;
  /** 下支路开关断开时向下翘（避免刀片穿入电路中间区域） */
  flipDown?: boolean;
}) {
  // 刀片用 transform rotate 实现平滑过渡（CSS transform 是 CSS 属性可过渡，SVG 几何属性不可）
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = Math.atan2(y2 - y1, x2 - x1); // 闭合时刀片角度
  const openAng = flipDown ? ang + 1.05 : ang - 1.05; // 断开时翘起：上支路向上、下支路向下
  return (
    <g
      role="button"
      aria-label={`${label}: ${on ? '闭合' : '断开'}`}
      onClick={onToggle}
      className="cursor-pointer"
    >
      <circle cx={x1} cy={y1} r="3" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.2" />
      <circle cx={x2} cy={y2} r="3" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.2" />
      {/* 刀片：起点在左触点，沿闭合角度延伸 len；用 transform rotate 翻转 */}
      <line
        x1={0}
        y1={0}
        x2={len}
        y2={0}
        stroke="var(--fg)"
        strokeWidth="1.5"
        style={{
          transform: `translate(${x1}px, ${y1}px) rotate(${(on ? ang : openAng) * (180 / Math.PI)}deg)`,
          transition: 'transform 0.18s ease-out',
        }}
      />
      <text
        x={labelX ?? (x1 + x2) / 2}
        y={labelY ?? y1 + 16}
        textAnchor="middle"
        fontSize="9"
        fill="var(--muted)"
        fontFamily="var(--f-mono)"
      >
        {label}
      </text>
    </g>
  );
}

/* ---------- 电池（教科书竖式：正极长线在上、负极短线在下，+ / − 标注） ---------- */
export function Battery({ cx = 40, cy = 110 }: { cx?: number; cy?: number }) {
  // 竖式电池：长线（正极）在 cy-40，短线（负极）在 cy-28，正极接干路（上方）、负极接回流（下方）
  return (
    <g>
      <g stroke="var(--fg)" strokeWidth="1.5">
        <line x1={cx - 18} y1={cy - 40} x2={cx + 18} y2={cy - 40} />
        <line x1={cx - 8} y1={cy - 28} x2={cx + 8} y2={cy - 28} strokeWidth="3" />
      </g>
      <text x={cx + 24} y={cy - 34} textAnchor="middle" fontSize="11" fill="var(--fg)" fontFamily="var(--f-mono)">
        +
      </text>
      <text x={cx + 24} y={cy - 22} textAnchor="middle" fontSize="11" fill="var(--fg)" fontFamily="var(--f-mono)">
        −
      </text>
    </g>
  );
}

/* ---------- 保险丝（小矩形 + 内部细线） ---------- */
export function Fuse({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 10} y={y - 3} width="20" height="6" rx="1" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.2" />
      <line x1={x - 6} y1={y} x2={x + 6} y2={y} stroke="var(--fg)" strokeWidth="0.8" />
    </g>
  );
}

/* ---------- 滑动变阻器（教科书样式：矩形电阻体 + 斜箭头滑片，阻值随 value 比例滑动） ---------- */
export function Rheostat({
  x,
  y,
  value = 0,
  max = 20,
  label,
}: {
  x: number;
  y: number;
  value?: number;
  max?: number;
  label?: ReactNode;
}) {
  const ratio = Math.max(0, Math.min(1, value / max));
  const w = 34;
  const h = 12;
  // 滑片位置：沿电阻体宽度
  const wiperX = x - w / 2 + 4 + (w - 8) * ratio;
  return (
    <g>
      {/* 电阻体：教科书矩形框（下方两端开口接导线） */}
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx="1"
        fill="var(--card-bg)"
        stroke="var(--fg)"
        strokeWidth="1.2"
      />
      {/* 滑片：斜箭头指向电阻体（用 transform translateX 平滑过渡，CSS transform 可过渡） */}
      <g
        style={{
          transform: `translateX(${wiperX}px)`,
          transition: 'transform 0.18s ease-out',
        }}
      >
        <line
          x1={0}
          y1={y + h / 2}
          x2={7}
          y2={y - h / 2 - 3}
          stroke="var(--fg)"
          strokeWidth="1.3"
        />
      </g>
      {label && (
        <text x={x} y={y + h + 18} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--f-mono)">
          {label}
        </text>
      )}
    </g>
  );
}

/* ---------- 固定电表（16×16 圆角方块 + 字母 + 数字读数） ---------- */
export function FixedMeter({
  x,
  y,
  glyph,
  reading,
  unit,
}: {
  x: number;
  y: number;
  glyph: 'A' | 'V';
  reading: string;
  unit: string;
}) {
  return (
    <g>
      <rect x={x - 8} y={y - 8} width="16" height="16" rx="2" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.2" />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fill="var(--fg)" fontFamily="var(--f-mono)">
        {glyph}
      </text>
      {/* 读数：数值（10px）+ 单位（8px 灰，SVG 内换行两行显示避免宽度溢出） */}
      <text x={x} y={y + 23} textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">
        {reading}
      </text>
      <text x={x} y={y + 33} textAnchor="middle" fontSize="8" fill="var(--muted)" fontFamily="var(--f-mono)">
        {unit}
      </text>
    </g>
  );
}
