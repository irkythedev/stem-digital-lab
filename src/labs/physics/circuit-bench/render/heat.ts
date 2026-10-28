/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 发热元件的温度配色
 *
 * 两种视图（电路图 / 仿真图）共用同一套「冷灰 → 橙红 → 炽红」映射，
 * 免得同一根电热丝在两套画法里给出两个温度印象。
 *
 * 为什么用**功率**而不是 `state.temp` 驱动：模型里的电热丝是
 * `mass=0.02 kg × c=460 J/(kg·K)`，热容 9.2 J/K，焦耳定律预设（约 4 W）下
 * 约 0.43 K/s，跑一分钟才升温 26 K —— 拿它当渲染输入，屏幕上永远是一根冷丝。
 * 而「发红」这件事的因就是 I²R，直接读功率既即时又因果正确；
 * `temp` 仍然是热模型自己的状态，只是不该被当成视觉阈值。
 */
import type { CSSProperties } from 'react';

/** 参考发热功率：8 Ω 镍铬丝在 4 W 上下开始明显发红，取它当「满热」刻度。 */
export const HEATER_HOT_W = 4;

/** 发热程度 0..1；取平方根是为了让低功率段也有肉眼可见的暖色变化。 */
export function heatLevel(power: number): number {
  if (!Number.isFinite(power) || power <= 0) return 0;
  return Math.min(1, Math.sqrt(power / HEATER_HOT_W));
}

/**
 * 发热程度 → 笔触颜色。冷态直接给 `var(--muted)`（亮暗两套主题各有一个金属灰），
 * 中间用 `color-mix` 混出橙 → 炽红，所以整条色带都跟着主题的金属灰走，
 * 不会在暗底上忽然冒出一段浅色亮灰。
 */
export function heatStroke(level: number): string {
  const t = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
  if (t <= 0) return 'var(--muted)';
  if (t <= 0.5) {
    // 冷灰 → 橙：t=0 时 100% 金属灰，t=0.5 时纯 #f97316
    return `color-mix(in srgb, var(--muted) ${Math.round((1 - 2 * t) * 100)}%, #f97316)`;
  }
  // 橙 → 炽红：t=0.5 时纯橙，t=1 时纯 #ef4444
  return `color-mix(in srgb, #f97316 ${Math.round((1 - (t - 0.5) * 2) * 100)}%, #ef4444)`;
}

/** 发热丝的统一过渡：只动颜色，200ms 平滑升温/降温。 */
export const HEAT_STROKE_STYLE: CSSProperties = {
  transition: 'stroke 200ms ease-out',
};
