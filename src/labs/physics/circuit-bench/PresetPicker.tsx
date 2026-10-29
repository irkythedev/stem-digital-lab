/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 预设胶囊行（画布卡上方）
 *
 * 从画布内浮层改成页面流里的一行胶囊：八套教材预设直接平铺，
 * 选中的用实心前景色，其余留边框，最右侧的「ⓘ 实验导读」开关画布上那张导读浮卡
 * （抽屉本体见 `PresetBriefing`：它是画布上可自由拖拽的浮卡，挂在工作台根节点上；
 * 开关这里只翻转 `infoOpen`，打开时由 CircuitBench 顺带把元件坞收成小胶囊）。
 * 胶囊与全站按钮同一套 Design Tokens；窄屏横向滚动，不换行、不撑高。
 */
import { Info } from 'lucide-react';

import { CIRCUIT_PRESETS } from './circuit-bench-presets';

export interface PresetPickerProps {
  activeId: string;
  onPick: (id: string) => void;
  infoOpen: boolean;
  onToggleInfo: () => void;
  zh: boolean;
}

// compact：预设胶囊是 L2 并排控件，解除 main button 的 40px 地板，保持 30px 密度。
// 窄屏 `max-sm:h-9`：36px 的拇指高度——胶囊本来只有 30px，一排挤着八个预设，
// 手指点「欧姆定律」却选中隔壁是最常见的误触。
const PILL =
  'compact shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors max-sm:h-9';

export default function PresetPicker({
  activeId,
  onPick,
  infoOpen,
  onToggleInfo,
  zh,
}: PresetPickerProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <div
          role="listbox"
          aria-label={zh ? '教材预设' : 'Textbook presets'}
          /* `scroll-padding-inline`：窄屏横向滚动时，滚到头的胶囊不会紧贴边框被切掉半个字。 */
          className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5 [scroll-padding-inline:0.75rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {CIRCUIT_PRESETS.map((preset) => {
            const isActive = preset.id === activeId;
            return (
              <button
                key={preset.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => onPick(preset.id)}
                title={zh ? preset.subtitle.zh : preset.subtitle.en}
                className={`${PILL} whitespace-nowrap ${
                  isActive
                    ? 'border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]'
                    : 'border-[var(--border)] bg-[var(--card-bg)] text-[var(--muted)] hover:text-[var(--fg)]'
                }`}
              >
                {zh ? preset.title.zh : preset.title.en}
              </button>
            );
          })}
        </div>
        {/* 右侧渐隐：窄屏一排胶囊必然溢出，「还能往右划」这件事得看得见——
            没有这层渐变时右边缘是硬切，学生以为预设就这几个。
            只在窄屏出现（`max-sm:block`），桌面胶囊本来就排得下。 */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-6 bg-gradient-to-l from-[var(--bg)] to-transparent max-sm:block"
        />
      </div>

      <button
        type="button"
        onClick={onToggleInfo}
        aria-pressed={infoOpen}
        title={zh ? '导读与公式' : 'Guide & formulas'}
        className={`${PILL} inline-flex shrink-0 items-center gap-1 whitespace-nowrap ${
          infoOpen
            ? 'border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]'
            : 'border-[var(--border)] bg-[var(--card-bg)] text-[var(--muted)] hover:text-[var(--fg)]'
        }`}
      >
        <Info className="h-3.5 w-3.5 shrink-0" />
        {zh ? '实验导读' : 'Guide'}
      </button>
    </div>
  );
}
