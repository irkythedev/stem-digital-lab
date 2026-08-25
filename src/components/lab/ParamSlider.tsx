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
}: ParamSliderProps) {
  // 修复浮点精度：根据 step 取整
  const value = step >= 1 ? Math.round(rawValue) : step >= 0.1 ? Math.round(rawValue * 10) / 10 : Math.round(rawValue * 100) / 100;

  const handleStep = (delta: number) => {
    if (disabled) return;
    const nextRaw = Math.min(max, Math.max(min, value + delta));
    const rounded = step >= 1 ? Math.round(nextRaw) : step >= 0.1 ? Math.round(nextRaw * 10) / 10 : Math.round(nextRaw * 100) / 100;
    onChange(rounded);
  };

  return (
    <div className={`flex flex-col space-y-1.5 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-baseline justify-between text-xs 2xl:text-sm mono-font">
        <label className="text-[var(--fg)] tracking-wider font-medium">{label}</label>
        <span className="text-[var(--fg)] font-semibold tabular-nums px-2 py-0.5 rounded-md bg-[var(--accent-light)]">
          {format ? format(value) : value}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => handleStep(-step)}
          aria-label={`Decrease ${label}`}
          className="shrink-0 w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center border border-[var(--border)]/80 text-[var(--fg)] hover:border-[var(--fg)] hover:bg-[var(--accent-light)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all rounded-lg touch-manipulation select-none"
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
          onChange={(e) => {
            const raw = Number(e.target.value);
            const rounded = step >= 1 ? Math.round(raw) : step >= 0.1 ? Math.round(raw * 10) / 10 : Math.round(raw * 100) / 100;
            onChange(rounded);
          }}
          className="flex-1 cursor-pointer accent-[var(--fg)] touch-manipulation"
        />
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => handleStep(step)}
          aria-label={`Increase ${label}`}
          className="shrink-0 w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center border border-[var(--border)]/80 text-[var(--fg)] hover:border-[var(--fg)] hover:bg-[var(--accent-light)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all rounded-lg touch-manipulation select-none"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
