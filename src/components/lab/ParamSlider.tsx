/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 通用参数滑块：label + 数值范围 + 步长 + 实时读数。
 * 与语言无关，文案由父级按当前语言解析后传入。
 */
import { useEffect, useRef } from 'react';
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
  /**
   * 连续拖动滑块的起止。`onChange` 在拖动中每帧都会触发，调用方据此把
   * 「一次拖动」记成一次撤销（起点 mark、过程覆盖 present、终点收尾），
   * 而不是几十条历史。不传则完全不影响既有行为。
   */
  onAdjustStart?: () => void;
  onAdjustEnd?: () => void;
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
  onAdjustStart,
  onAdjustEnd,
}: ParamSliderProps) {
  // 修复浮点精度：根据 step（或显式 precision）取整
  const decimals = precision ?? (step >= 1 ? 0 : step >= 0.1 ? 1 : 2);
  const quantize = (v: number) => Number(v.toFixed(decimals));

  const value = quantize(rawValue);

  /**
   * 滑块拖动的起止：range 的拖动可能把指针甩到控件外再松手，
   * 所以结束不能只监听 input 自己的 pointerup——挂一次 window 级别更稳。
   * 回调走 ref，避免父级每次渲染换一个新函数就重挂监听。
   */
  const dragging = useRef(false);
  const endRef = useRef(onAdjustEnd);
  endRef.current = onAdjustEnd;
  useEffect(() => {
    const end = () => {
      if (!dragging.current) return;
      dragging.current = false;
      endRef.current?.();
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

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
          onPointerDown={() => {
            if (dragging.current) return;
            dragging.current = true;
            onAdjustStart?.();
          }}
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
