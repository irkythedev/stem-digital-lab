/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电路图公共 SVG 零件：灯泡、闸刀开关、电池、保险丝、滑动变阻器、固定电表。
 * 样式说明：1px 描边 var(--fg)、card-bg 填充、无阴影无渐变。
 * 8 例经典电路图样式共享这些零件，避免重复绘制。
 */
import { FLOW_DOT_R, FLOW_DOT_OPACITY } from './use-flow-dots';
import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useApp } from '../../../lib/app-context';

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
  const { lang } = useApp();
  // 刀片用 transform rotate 实现平滑过渡（CSS transform 是 CSS 属性可过渡，SVG 几何属性不可）
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = Math.atan2(y2 - y1, x2 - x1); // 闭合时刀片角度
  const openAng = flipDown ? ang + 1.05 : ang - 1.05; // 断开时翘起：上支路向上、下支路向下
  return (
    <g
      role="button"
      aria-label={`${label}: ${on ? (lang === 'zh' ? '闭合' : 'closed') : (lang === 'zh' ? '断开' : 'open')}`}
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
      {/* L 母线在总开关 S（x=120-145）处断开：闭合由刀片补齐，断开露出缺口 */}
      <line x1={L} y1={L_Y} x2={120} y2={L_Y} stroke={LIVE} strokeWidth="1.4" />
      <line x1={145} y1={L_Y} x2={290} y2={L_Y} stroke={LIVE} strokeWidth="1.4" />
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
            <Bulb cx={bx} cy={bulbY} glow={glow[i] ?? 0} label={`L${i + 1}=${effR[i]}Ω`} labelY={bulbY + 24} />
            {/* 电流小点：闭合且有电流时沿支路流动 */}
            {current > 0.01 && (
              <g fill="var(--fg)" opacity={FLOW_DOT_OPACITY}>
                <circle r={FLOW_DOT_R}>
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

/* ---------- 滑动变阻器（中考实物标准四柱：下层线圈瓷筒 A/B + 上层金属杆 C/D + 中层滑片 P） ---------- */

/** 几何常量——父级导线端点须与接线柱圆心严格对齐，故导出共用 */
export const RHEO_W = 34;        // 瓷筒宽度（接线柱 A/B/C/D 横向间距基准）
export const RHEO_H = 12;        // 瓷筒高度
export const RHEO_ROD_DY = -16;  // 金属杆相对主回路线(y)的偏移：负值 = 位于上方
export const RHEO_TERM_R = 2.2;  // 接线柱圆孔半径

/**
 * 四个接线柱圆心。教科书「一上一下」标准接法 = **左下 A 进、右上 D 出**：
 * 电流 A → 线圈(A..P 段) → 滑片 P → 金属杆 → D，故滑片右移时接入线圈变长、Rp 增大。
 * B（右下）、C（左上）默认悬空。
 */
export function rheostatTerminals(x: number, y: number) {
  const hw = RHEO_W / 2;
  return {
    A: { x: x - hw, y },
    B: { x: x + hw, y },
    C: { x: x - hw, y: y + RHEO_ROD_DY },
    D: { x: x + hw, y: y + RHEO_ROD_DY },
  };
}

/**
 * 滑片中心 x：行程两端各留 4px。ratio 单调递增 → wiperX 单调递增 → A→P 接入线圈变长 → Rp 增大。
 * 导出供守卫做单调性断言，避免「公式改了但守卫还在测旧行为」。
 */
export function rheostatWiperX(x: number, ratio: number) {
  const r = Math.max(0, Math.min(1, ratio));
  return x - RHEO_W / 2 + 4 + (RHEO_W - 8) * r;
}

export function Rheostat({
  x,
  y,
  value = 0,
  max = 20,
  label,
  onChange,
}: {
  x: number;
  y: number;
  value?: number;
  max?: number;
  label?: ReactNode;
  /** 直接拖动滑片回传新阻值（不传则滑片不可拖，纯展示用法） */
  onChange?: (rp: number) => void;
}) {
  const ratio = Math.max(0, Math.min(1, value / max));
  const t = rheostatTerminals(x, y);
  const rodY = t.C.y;
  const coilTop = y - RHEO_H / 2;
  const coilBot = y + RHEO_H / 2;
  /** 滑片行程：两端各留 4px，不越过瓷筒端头。P 右移 → A→P 接入线圈变长 → Rp 增大 */
  const wiperX = rheostatWiperX(x, ratio);
  /** 接入线圈的有效长度（px），与滑片同步伸缩 */
  const activeW = wiperX - t.A.x;
  const turns = 8;
  /** 拖动中：禁用 CSS 过渡，让滑片严格跟随指针（松手后恢复过渡） */
  const [dragging, setDragging] = useState(false);

  /** 滑片有效行程（与 rheostatWiperX 同一组常量：两端各留 4px），拖动时严格夹取在此区间 */
  const xMin = t.A.x + 4;
  const xMax = t.B.x - 4;

  /**
   * 客户端屏幕坐标 → SVG 视口局部 x。
   * 用最近 <svg> 的 getScreenCTM().inverse() 做逆映射（与 InteractiveCircle 同一手法），
   * 画布缩放、页面滚动、父级 transform 下都不会漂移。
   */
  const localX = (e: ReactPointerEvent<SVGGElement>): number | null => {
    const svg = e.currentTarget.ownerSVGElement;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(ctm.inverse()).x;
  };

  /** 按指针位置折算阻值：与右侧参数滑块共用同一 0..max 口径（整数档，对应 step=1） */
  const applyFromPointer = (e: ReactPointerEvent<SVGGElement>) => {
    if (!onChange) return;
    const lx = localX(e);
    if (lx === null) return;
    const clamped = Math.max(xMin, Math.min(xMax, lx));
    onChange(Math.round(((clamped - xMin) / (xMax - xMin)) * max));
  };

  const startDrag = (e: ReactPointerEvent<SVGGElement>) => {
    if (!onChange) return;
    e.preventDefault(); // 拖滑片时不选中文本，也不夺走父级 tooltip 的焦点语义
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId); // 指针移出元件/窗口也继续跟随
    setDragging(true);
    applyFromPointer(e); // 按下即定位，无需先移动
  };

  const moveDrag = (e: ReactPointerEvent<SVGGElement>) => {
    if (dragging) applyFromPointer(e);
  };

  const endDrag = (e: ReactPointerEvent<SVGGElement>) => {
    if (!dragging) return;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <g>
      {/* ── 下层：漆包线线圈瓷筒（接线柱 A / B 在其两端） ── */}
      <rect
        x={t.A.x}
        y={coilTop}
        width={RHEO_W}
        height={RHEO_H}
        rx="1.5"
        fill="var(--card-bg)"
        stroke="var(--muted)"
        strokeWidth="1.2"
      />
      {/* 线圈匝：等距竖细线，仅作纹理，不抢主结构 */}
      {Array.from({ length: turns }, (_, i) => {
        const tx = t.A.x + (RHEO_W / (turns + 1)) * (i + 1);
        return <line key={i} x1={tx} y1={coilTop + 1.6} x2={tx} y2={coilBot - 1.6} stroke="var(--muted)" strokeWidth="0.6" />;
      })}
      {/* 接入区间（A → 滑片）：直观呈现「接入电路的有效线圈长度」 */}
      <rect
        x={t.A.x + 0.6}
        y={y - 1.5}
        width={Math.max(0, activeW - 0.6)}
        height="3"
        fill="var(--accent)"
        opacity="0.16"
        style={{ transition: dragging ? 'none' : 'width 0.18s ease-out' }}
      />
      {/* ── 上层：导电金属杆（接线柱 C / D 在其两端） ── */}
      <line x1={t.C.x} y1={rodY} x2={t.D.x} y2={rodY} stroke="var(--fg)" strokeWidth="1.6" />
      {/* ── 中层：滑片 P —— 实体垂直连通金属杆与线圈，随调参连续水平位移；支持鼠标/触控直接拖动 ── */}
      <g
        style={{
          transform: `translateX(${wiperX}px)`,
          // 拖动中取消过渡：滑片严格跟随指针；松手后回到平滑过渡
          transition: dragging ? 'none' : 'transform 0.18s ease-out',
          cursor: onChange ? (dragging ? 'grabbing' : 'grab') : undefined,
          // 触屏拖动必须禁用默认手势，否则手指一动被判成滚动 → pointercancel（沿用探针的做法）
          touchAction: onChange ? 'none' : undefined,
        }}
        onPointerDown={onChange ? startDrag : undefined}
        onPointerMove={onChange ? moveDrag : undefined}
        onPointerUp={onChange ? endDrag : undefined}
        onPointerCancel={onChange ? endDrag : undefined}
      >
        {/* 透明命中区 44×44（覆盖杆上滑块与垂直连杆，鼠标/触屏都能稳定抓住滑片） */}
        {onChange && <rect x={-22} y={rodY - 9} width="44" height="44" fill="transparent" />}
        {/* 杆上滑块：滑片与金属杆的接触点 */}
        <rect x="-3.2" y={rodY - 2.2} width="6.4" height="4.4" rx="1" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.1" />
        {/* 垂直连杆：金属杆 → 瓷筒上沿（一体化，行程内始终连通，不脱节） */}
        <line x1="0" y1={rodY} x2="0" y2={coilTop} stroke="var(--fg)" strokeWidth="1.4" />
        {/* 触头：压在线圈上的三角触点 */}
        <polygon points={`-2.6,${coilTop} 2.6,${coilTop} 0,${coilTop + 3.6}`} fill="var(--fg)" />
      </g>
      {/* ── 接线柱（圆孔）：A/B 在下层线圈两端，C/D 在上层金属杆两端 ── */}
      {(['A', 'B', 'C', 'D'] as const).map((k) => (
        <circle key={k} cx={t[k].x} cy={t[k].y} r={RHEO_TERM_R} fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1" />
      ))}
      {/* 接线柱标号（教科书 A/B/C/D） */}
      <text x={t.A.x - 5} y={y + 12.5} textAnchor="middle" fontSize="7" fill="var(--muted)" fontFamily="var(--f-mono)">A</text>
      <text x={t.B.x + 5} y={y + 12.5} textAnchor="middle" fontSize="7" fill="var(--muted)" fontFamily="var(--f-mono)">B</text>
      <text x={t.C.x - 5} y={rodY - 3.5} textAnchor="middle" fontSize="7" fill="var(--muted)" fontFamily="var(--f-mono)">C</text>
      <text x={t.D.x + 5} y={rodY - 3.5} textAnchor="middle" fontSize="7" fill="var(--muted)" fontFamily="var(--f-mono)">D</text>
      {label && (
        <text x={x} y={coilBot + 16} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--f-mono)">
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
