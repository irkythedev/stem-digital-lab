/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 视图模式
 *
 * 电路图（schematic）与仿真图（physical）只是同一份 BenchState 的两种画法：
 * 元件位置、端子引用、导线拓扑、求解结果完全共用，因此切换视图不会改动网表，
 * 也不会让接线柱漂移。这里只放纯函数，UI 状态由 CircuitBench 持有。
 *
 * 注意：面向学生的文案是「电路图 / 仿真图」，但枚举值仍是 `schematic / physical`——
 * 存档、预设、测试断言都靠这两个值，改名只允许发生在 `viewModeLabel` 这一层。
 */

export type CircuitViewMode = 'schematic' | 'physical';

export const VIEW_MODES: readonly CircuitViewMode[] = ['schematic', 'physical'];

export const DEFAULT_VIEW_MODE: CircuitViewMode = 'schematic';

export function normalizeViewMode(value: unknown): CircuitViewMode {
  return value === 'physical' ? 'physical' : DEFAULT_VIEW_MODE;
}

export function nextViewMode(mode: CircuitViewMode): CircuitViewMode {
  return mode === 'schematic' ? 'physical' : 'schematic';
}

/** 面向学生的视图名：电路图 / 仿真图，Circuit / Simulation。 */
export function viewModeLabel(mode: CircuitViewMode, zh: boolean): string {
  if (mode === 'physical') return zh ? '仿真图' : 'Simulation';
  return zh ? '电路图' : 'Circuit';
}

/**
 * 画布背景 pattern 的 id 清单（按绘制顺序）。
 *
 * - `schematic`：主次双层工程方格网，基础小格与坐标吸附步长 `GRID` 对齐；
 * - `physical`：实验台孔板质感的圆点阵。
 *
 * 背景纹理和导线拐角是同一件事的两面：电路图是工程制图，仿真图是实物实验。
 */
export const CANVAS_BACKGROUND_PATTERNS: Record<CircuitViewMode, readonly string[]> = {
  schematic: ['cb-grid-minor', 'cb-grid-major'],
  physical: ['cb-grid-dot'],
};

export function canvasBackgroundPatterns(mode: CircuitViewMode): readonly string[] {
  return CANVAS_BACKGROUND_PATTERNS[mode];
}
