/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 通用参数滑块：label + 数值范围 + 步长 + 实时读数。
 * 与语言无关，文案由父级按当前语言解析后传入。
 */
import { Minus, Plus } from 'lucide-react';

interface ParamSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
  /**
   * 取整小数位。缺省按 step 推导（≥1 → 0 位，≥0.1 → 1 位，其余 → 2 位）；
   * 极小步长（如横截面积 1e-7 m²）的实验须显式传入，否则会被取整成 0。
   */
  precision?: number;
}

export default function ParamSlider({
  label,
  value: rawValue,
  min,
  max,
  step = 1,
  onChange,
  format,
  disabled = false,
  precision,
}: ParamSliderProps) {
  // 修复浮点精度：根据 step（或显式 precision）取整
  const decimals = precision ?? (step >= 1 ? 0 : step >= 0.1 ? 1 : 2);
  const quantize = (v: number) => Number(v.toFixed(decimals));

  const value = quantize(rawValue);

  const handleStep = (delta: number) => {
    if (disabled) return;
    const nextRaw = Math.min(max, Math.max(min, value + delta));
    onChange(quantize(nextRaw));
  };

  return (
    <div className={`flex flex-col space-y-1.5 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-baseline justify-between text-xs 2xl:text-sm mono-font">
        <label className="text-[var(--fg)] tracking-wider font-medium">{label}</label>
        <span className="text-[var(--fg)] font-semibold tabular-nums px-2 py-0.5 rounded-md bg-[var(--accent-light)]">
          {format ? format(value) : value}
        </span>
      </div>
      {/* 触控热区：滑块行 ≥44px（希沃大屏 / 手机端），滑块本体 44px 高，整条可拖 */}
      <div className="flex min-h-[44px] items-center gap-2.5">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => handleStep(-step)}
          aria-label={`Decrease ${label}`}
          className="shrink-0 w-8 h-11 sm:w-7 sm:h-11 tap-area flex items-center justify-center border border-[var(--border)]/80 text-[var(--fg)] hover:border-[var(--fg)] hover:bg-[var(--accent-light)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all rounded-lg touch-manipulation select-none"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(quantize(Number(e.target.value)))}
          className="h-11 min-h-[44px] flex-1 cursor-pointer accent-[var(--fg)] touch-manipulation"
        />
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => handleStep(step)}
          aria-label={`Increase ${label}`}
          className="shrink-0 w-8 h-11 sm:w-7 sm:h-11 tap-area flex items-center justify-center border border-[var(--border)]/80 text-[var(--fg)] hover:border-[var(--fg)] hover:bg-[var(--accent-light)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all rounded-lg touch-manipulation select-none"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
