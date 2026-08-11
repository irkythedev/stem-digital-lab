/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
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
  // 灯丝颜色：熄灭用主题灰，点亮后平滑过渡到暖黄（消除 g 阈值突变）
  const glowT = Math.min(1, Math.max(0, (g - 0.15) / 0.35)); // 0.15 → 0.5 渐变
  const filamentColor =
    g <= 0.15
      ? 'var(--fg)'
      : `rgb(${Math.round(138 + 117 * glowT)}, ${Math.round(138 + 71 * glowT)}, ${Math.round(144 - 42 * glowT)})`;
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
      {/* 透明命中区：扩大点击/触屏区域（沿开关方向延伸，保证 ≥44px 可点） */}
      <rect
        x={x1 - 8}
        y={y1 - 20}
        width={Math.hypot(x2 - x1, y2 - y1) + 16}
        height={40}
        fill="transparent"
        transform={`rotate(${ang * (180 / Math.PI)} ${x1} ${y1})`}
      />
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
      <g stroke="var(--fg)" strokeWidth="2">
        <line x1={cx - 18} y1={cy - 40} x2={cx + 18} y2={cy - 40} />
        <line x1={cx - 8} y1={cy - 28} x2={cx + 8} y2={cy - 28} />
      </g>
      <text x={cx - 22} y={cy - 46} textAnchor="middle" fontSize="11" fill="var(--fg)" fontFamily="var(--f-mono)">
        +
      </text>
      <text x={cx - 22} y={cy - 20} textAnchor="middle" fontSize="11" fill="var(--fg)" fontFamily="var(--f-mono)">
        −
      </text>
    </g>
  );
}

/* ---------- 交流电源（家庭电路：火线 L / 零线 N + 交流符号 ~ + 接地） ---------- */
export function ACSource({ cx = 40, cy = 110 }: { cx?: number; cy?: number }) {
  // 家庭电路为交流电源：火线在上（接干路）、零线在下（接回流），用 ~ 表示交流；
  // 右侧标注火线 L 与零线 N，下方附接地符号示意。
  return (
    <g>
      <g stroke="var(--fg)" strokeWidth="1.5">
        {/* 交流符号 ~ */}
        <path d={`M ${cx - 16} ${cy - 40} q 4 6 8 0 q 4 -6 8 0`} fill="none" strokeLinecap="round" />
        {/* 火线端（长线） */}
        <line x1={cx - 18} y1={cy - 26} x2={cx + 18} y2={cy - 26} />
        {/* 零线端（短线） */}
        <line x1={cx - 8} y1={cy - 14} x2={cx + 8} y2={cy - 14} strokeWidth="3" />
      </g>
      <text x={cx + 24} y={cy - 20} textAnchor="middle" fontSize="10" fill="var(--fg)" fontFamily="var(--f-mono)">
        L
      </text>
      <text x={cx + 24} y={cy - 8} textAnchor="middle" fontSize="10" fill="var(--fg)" fontFamily="var(--f-mono)">
        N
      </text>
      {/* 接地符号：三条递减横线 */}
      <g stroke="var(--fg)" strokeWidth="1">
        <line x1={cx - 14} y1={cy + 6} x2={cx + 14} y2={cy + 6} />
        <line x1={cx - 9} y1={cy + 12} x2={cx + 9} y2={cy + 12} strokeWidth="0.8" />
        <line x1={cx - 4} y1={cy + 18} x2={cx + 4} y2={cy + 18} strokeWidth="0.6" />
      </g>
    </g>
  );
}

/* ---------- 家庭电路（真实结构：火线 L / 零线 N 双母线 + 用电器跨接 + 三孔插座接地） ---------- */
export function HouseholdCircuit({
  on,
  branchOn,
  u,
  effR,
  glow,
  onToggleMaster,
  onToggleBranch,
}: {
  /** 总开关闭合？ */
  on: boolean;
  /** 各支路开关闭合？ */
  branchOn: boolean[];
  /** 电源电压（等效 220V，按比例显示） */
  u: number;
  /** 各用电器阻值（Ω） */
  effR: number[];
  /** 各灯泡亮度 0..1 */
  glow: number[];
  onToggleMaster: () => void;
  onToggleBranch: (i: number) => void;
}) {
  // 布局（SVG 320×220）：
  // 火线 L 母线 y=60（红），零线 N 母线 y=150（蓝），左侧电源进线 x=40（交流 ~ 符号）
  // 支路：x=170 / x=230 处从 L 引竖线 → 开关（火线侧）→ 灯泡（y≈105）→ 回 N
  // 三孔插座 x=270：L/N 两下孔 + E 上孔接接地线（黄绿），接地符号在 y=185
  const LIVE = '#e5484d';
  const NEUTRAL = '#3b82f6';
  const EARTH = '#8a8a8a';
  const L = 40; // 电源进线 x
  const L_Y = 60; // 火线母线
  const N_Y = 150; // 零线母线
  const R = 12; // 灯泡半径

  const branches = [
    { x: 170, label: 'S₁' },
    { x: 230, label: 'S₂' },
  ];

  return (
    <g>
      {/* ── 双母线：火线 L（上）、零线 N（下） ── */}
      <line x1={L} y1={L_Y} x2={290} y2={L_Y} stroke={LIVE} strokeWidth="1.4" />
      <line x1={L} y1={N_Y} x2={290} y2={N_Y} stroke={NEUTRAL} strokeWidth="1.4" />
      {/* 电源进线竖线（左侧） */}
      <line x1={L} y1={L_Y} x2={L} y2={N_Y} stroke="var(--fg)" strokeWidth="1.2" />

      {/* 电源交流符号 ~：画在进线竖线 x=40 上（垂直波浪），表示交流电源 */}
      <path
        d={`M ${L} 88 q 5 4 0 8 q -5 4 0 8 q 5 4 0 8`}
        fill="none"
        stroke="var(--fg)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* 交流电标注 */}
      <text x={L - 12} y={130} textAnchor="end" fontSize="9" fill="var(--muted)" fontFamily="var(--f-mono)">
        ~ 220V
      </text>
      {/* 母线端标签 */}
      <text x={L - 26} y={L_Y + 4} textAnchor="end" fontSize="10" fill={LIVE} fontFamily="var(--f-mono)" fontWeight="bold">
        L
      </text>
      <text x={L - 26} y={N_Y + 4} textAnchor="end" fontSize="10" fill={NEUTRAL} fontFamily="var(--f-mono)" fontWeight="bold">
        N
      </text>

      {/* 保险丝：串在火线 L 上（进线右侧） */}
      <g>
        <rect x={70} y={L_Y - 3} width="20" height="6" rx="1" fill="var(--card-bg)" stroke={LIVE} strokeWidth="1.2" />
        <line x1={74} y1={L_Y} x2={86} y2={L_Y} stroke={LIVE} strokeWidth="0.8" />
        <text x={80} y={L_Y + 16} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--f-mono)">
          保险丝
        </text>
      </g>

      {/* 总开关 S：接在火线 L 上（保险丝右侧） */}
      <BladeSwitch
        x1={120}
        y1={L_Y}
        x2={145}
        y2={L_Y}
        on={on}
        onToggle={onToggleMaster}
        label="S"
        labelY={L_Y + 16}
      />

      {/* ── 各支路：火线 → 开关 → 灯泡 → 零线 ── */}
      {branches.map((br, i) => {
        const bx = br.x;
        const swY1 = L_Y + 14; // 开关上触点
        const swY2 = L_Y + 38; // 开关下触点
        const bulbY = 105;
        const bulbOn = on && branchOn[i] && u > 0;
        const current = bulbOn && effR[i] > 0 ? u / effR[i] : 0;
        return (
          <g key={`hb${i}`}>
            {/* 支路竖线：L → 开关 → 灯泡 → N */}
            <line x1={bx} y1={L_Y} x2={bx} y2={swY1} stroke="var(--fg)" strokeWidth="1.2" />
            <line x1={bx} y1={swY2} x2={bx} y2={bulbY - R} stroke="var(--fg)" strokeWidth="1.2" />
            <line x1={bx} y1={bulbY + R} x2={bx} y2={N_Y} stroke="var(--fg)" strokeWidth="1.2" />
            {/* 支路开关（竖直，沿支路导线方向，接在火线侧） */}
            <BladeSwitch
              x1={bx}
              y1={swY1}
              x2={bx}
              y2={swY2}
              on={branchOn[i]}
              onToggle={() => onToggleBranch(i)}
              label={br.label}
              labelX={bx + 14}
              labelY={(swY1 + swY2) / 2}
            />
            {/* 灯泡（用电器）跨接在 L-N 之间 */}
            <Bulb cx={bx} cy={bulbY} glow={glow[i] ?? 0} label={`R${i + 1}=${effR[i]}Ω`} labelY={bulbY + 24} />
            {/* 电流小点：闭合且有电流时沿支路流动 */}
            {current > 0.01 && (
              <g fill="var(--fg)" opacity="0.85">
                <circle r="2.4">
                  <animateMotion
                    dur={`${Math.max(0.45, 2.2 / current).toFixed(2)}s`}
                    begin={`${i * 0.5}s`}
                    repeatCount="indefinite"
                    path={`M${bx},${L_Y} L${bx},${N_Y}`}
                  />
                </circle>
              </g>
            )}
          </g>
        );
      })}

      {/* ── 三孔插座：L/N 两下孔 + E 上孔接地 ── */}
      <g>
        {/* 插座引线：从 L、N 母线接到插座 */}
        <line x1={270} y1={L_Y} x2={270} y2={78} stroke="var(--fg)" strokeWidth="1.2" />
        <line x1={270} y1={N_Y} x2={270} y2={128} stroke="var(--fg)" strokeWidth="1.2" />
        {/* 插座本体：圆角矩形 + 三孔 */}
        <rect x={256} y={80} width="28" height="46" rx="3" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.2" />
        {/* E 上孔（接地） */}
        <circle cx={270} cy={90} r="3" fill="var(--card-bg)" stroke={EARTH} strokeWidth="1.2" />
        <text x={286} y={93} fontSize="9" fill={EARTH} fontFamily="var(--f-mono)">
          E
        </text>
        {/* L/N 两下孔 */}
        <circle cx={263} cy={112} r="3" fill="var(--card-bg)" stroke={LIVE} strokeWidth="1.2" />
        <circle cx={277} cy={112} r="3" fill="var(--card-bg)" stroke={NEUTRAL} strokeWidth="1.2" />
        <text x={250} y={115} textAnchor="end" fontSize="9" fill={LIVE} fontFamily="var(--f-mono)">
          L
        </text>
        <text x={290} y={115} fontSize="9" fill={NEUTRAL} fontFamily="var(--f-mono)">
          N
        </text>
        {/* E 接地线：从 E 孔引到下方接地符号 */}
        <line x1={270} y1={93} x2={270} y2={150} stroke={EARTH} strokeWidth="1.2" strokeDasharray="3 2" />
        {/* 接地符号（三条递减横线） */}
        <g stroke={EARTH} strokeWidth="1">
          <line x1={256} y1={165} x2={284} y2={165} />
          <line x1={262} y1={172} x2={278} y2={172} strokeWidth="0.8" />
          <line x1={268} y1={179} x2={272} y2={179} strokeWidth="0.6" />
        </g>
        <text x={270} y={194} textAnchor="middle" fontSize="9" fill={EARTH} fontFamily="var(--f-mono)">
          接地 E
        </text>
      </g>
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
      {/* 接线端子：电阻体两端接入电路（教科书符号，一上一下接入） */}
      <circle cx={x - w / 2} cy={y} r="2" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1" />
      <circle cx={x + w / 2} cy={y} r="2" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1" />
      {/* 滑片：斜向下的箭头（教科书画法），尖端指向电阻体下方；用 transform translateX 平滑过渡 */}
      <g
        style={{
          transform: `translateX(${wiperX}px)`,
          transition: 'transform 0.18s ease-out',
        }}
      >
        <line
          x1={0}
          y1={y - h / 2 - 3}
          x2={7}
          y2={y + h / 2 + 1}
          stroke="var(--fg)"
          strokeWidth="1.3"
        />
        <path d={`M7 ${y + h / 2 + 1} l-2.6 3.8 h5.2 Z`} fill="var(--fg)" />
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
  label,
  readoutDir = 'down',
}: {
  x: number;
  y: number;
  glyph: 'A' | 'V';
  reading: string;
  unit: string;
  /** 仪表编号（如 A₀/A₁/A₂），传入时优先显示（教科书图例样式） */
  label?: string;
  /** 读数方向：下（默认，远离上方导线）或上（支路表避让下方导线） */
  readoutDir?: 'down' | 'up';
}) {
  // 读数单行（值+单位合并，如 0.90A），距仪表 14px；方向按 readoutDir 避让相邻导线（label safety ≥8px）
  const ry = readoutDir === 'up' ? y - 20 : y + 23;
  return (
    <g>
      <rect x={x - 8} y={y - 8} width="16" height="16" rx="2" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.2" />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fill="var(--fg)" fontFamily="var(--f-mono)">
        {label ?? glyph}
      </text>
      {/* 读数底衬：主题自适应半透背景 + 细边框（防压线，统一三表样式） */}
      <g>
        <rect
          x={x - 19}
          y={ry - 10}
          width="38"
          height="13"
          rx="2"
          fill="var(--bg)"
          fillOpacity="0.88"
          stroke="var(--border)"
          strokeWidth="0.8"
        />
        <text x={x} y={ry} textAnchor="middle" fontSize="10" fill="var(--fg)" fontFamily="var(--f-mono)">
          {reading}
          {unit}
        </text>
      </g>
    </g>
  );
}
