/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 二元显示开关（辅助线 / 外切多边形 / 顶点标注…）的统一外观。
 *
 * 为什么单独抽一个：这类开关在多个实验里出现，之前每个文件各写一遍
 * 「小圆点 + 文字」的胶囊按钮，既重复又看不出是开关（看起来像普通按钮）。
 * 这里统一成「轨道 + 滑块 + 文字」的拨动开关形态，触控目标仍保持 40px。
 *
 * 注意：开启轨道用 --fg、关闭轨道用 --border-strong；滑块在开启态用 --card-bg、关闭态用纯白，
 * 这样深浅主题下都不会出现「白点吞进白轨」或「暗点吞进暗轨」的回归。
 */
interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** 额外类名（布局用，如 flex-none） */
  className?: string;
  /** 顶栏工具条紧凑模式：与 h-7 图标按钮同高 */
  compact?: boolean;
  /** 视觉上隐藏标签但保留 aria-label（用于左侧已有独立标题的行） */
  hideLabel?: boolean;
}

export default function ToggleSwitch({ label, checked, onChange, className = '', compact = false, hideLabel = false }: ToggleSwitchProps) {
  return (
    <span className={`inline-flex shrink-0 select-none items-center gap-2 rounded text-[0.6875rem] mono-font leading-none ${compact ? 'h-7' : 'min-h-[40px]'} ${
      checked ? 'text-[var(--fg)]' : 'text-[var(--muted)]'
    } ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        style={{ width: 36, height: 20, minWidth: 36, minHeight: 20 }}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 min-w-[36px] shrink-0 items-center rounded-full border-0 transition-colors duration-200 ${
          checked ? 'bg-[var(--fg)]' : 'bg-[var(--border-strong)]'
        }`}
      >
        <span
          className={`pointer-events-none absolute left-0.5 top-0.5 inline-block h-4 w-4 rounded-full border-0 shadow-sm transition-transform ${checked ? 'bg-[var(--card-bg)]' : 'bg-white'} duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
          aria-hidden="true"
        />
      </button>
      <span className={hideLabel ? 'sr-only' : 'cursor-pointer leading-none'} onClick={() => onChange(!checked)}>{label}</span>
    </span>
  );
}
