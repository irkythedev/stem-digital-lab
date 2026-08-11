/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电路元件公式推导浮层（SOP 阶段三 · 教学增强）：
 * 悬停/聚焦电表、变阻器、电阻时，动态展示「公式原型 + 数值代入 + 物理原理」。
 * fixed 定位（相对视口），由触发元件传入屏幕坐标；三行小卡，书本化风格。
 */
interface CircuitTooltipProps {
  /** 触发元件中心屏幕坐标（px，相对视口） */
  x: number;
  y: number;
  /** 公式原型，如 I = U / R */
  formula: string;
  /** 数值代入，如 6.0V ÷ 10Ω = 0.60A */
  substitution: string;
  /** 物理原理简述 */
  principle: string;
  /** 元件名称（title 第一行，可选） */
  name?: string;
}

export default function CircuitTooltip({ x, y, formula, substitution, principle, name }: CircuitTooltipProps) {
  return (
    <div
      role="tooltip"
      className="fixed z-50 pointer-events-none max-w-[220px] border border-[var(--border)] bg-[var(--bg)] shadow-[0_4px_16px_rgba(0,0,0,0.12)] px-2.5 py-2"
      style={{
        left: x,
        top: y - 8,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {name && (
        <div className="text-[10px] mono-font uppercase tracking-widest text-[var(--muted)] mb-1">
          {name}
        </div>
      )}
      <div className="text-xs serif-font font-bold text-[var(--fg)] mb-0.5 whitespace-nowrap">
        {formula}
      </div>
      <div className="text-[11px] serif-font text-[var(--fg)] mb-0.5 whitespace-nowrap">
        {substitution}
      </div>
      <div className="text-[10px] sans-font text-[var(--muted)] leading-snug">
        {principle}
      </div>
    </div>
  );
}
