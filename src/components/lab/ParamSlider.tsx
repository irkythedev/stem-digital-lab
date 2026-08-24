/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 通用参数滑块：label + 数值范围 + 步长 + 实时读数。
 * 与语言无关，文案由父级按当前语言解析后传入。
 */
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
  return (
    <label className={`flex flex-col space-y-1.5 ${disabled ? 'opacity-50' : ''}`}>
      <span className="flex items-baseline justify-between text-[0.6875rem] mono-font">
        <span className="text-[var(--fg)] tracking-widest">{label}</span>
        <span className="text-[var(--muted)]">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const raw = Number(e.target.value);
          // 修复浮点精度：根据 step 取整
          const rounded = step >= 1 ? Math.round(raw) : step >= 0.1 ? Math.round(raw * 10) / 10 : Math.round(raw * 100) / 100;
          onChange(rounded);
        }}
        className="w-full cursor-pointer accent-[var(--fg)]"
        style={{ touchAction: 'none' }}
      />
    </label>
  );
}
