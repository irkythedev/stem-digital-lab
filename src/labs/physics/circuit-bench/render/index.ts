/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 渲染策略注册表
 *
 * 视图模式 → 一套画法。策略只换外观，不碰状态：
 * 元件坐标、端子引用、导线拓扑、MNA 结果全部由 core 提供，两种模式完全共享。
 */
import { SchematicBody } from './schematic';
import { PhysicalBody } from './physical';
import { wireStyleFor } from './wires';
import type { RenderStrategy } from './types';
import type { CircuitViewMode } from '../circuit-bench-view';

export const RENDER_STRATEGIES: Record<CircuitViewMode, RenderStrategy> = {
  schematic: {
    mode: 'schematic',
    Body: SchematicBody,
    wireStyle: (index) => wireStyleFor('schematic', index),
    junctionStyle: {
      r: 3.2,
      fill: 'var(--cb-wire, var(--fg))',
      stroke: 'var(--card-bg)',
      strokeWidth: 0.8,
    },
    terminal: {
      ring: false,
      radius: 3.4,
      positive: 'var(--danger)',
      negative: 'var(--fg)',
    },
  },
  physical: {
    mode: 'physical',
    Body: PhysicalBody,
    wireStyle: (index) => wireStyleFor('physical', index),
    junctionStyle: {
      r: 3.4,
      fill: 'var(--fg)',
      stroke: 'var(--card-bg)',
      strokeWidth: 1,
    },
    terminal: {
      // 实物接线柱：金属外环 + 极性色芯，红柱固定是 a 端（正极/红表笔）。
      // 半径 5.6 世界单位（约 5–6px 手感），配合外圈金属环读成香蕉插座。
      //
      // 负极芯固定是深炭色 #18181b，不跟主题走：初中物理的「红正黑负」认的是
      // **黑色**端子本身。暗色主题里若继续用 var(--fg)（#e8e6df），负极端子会比
      // 正极还亮，学生一眼看反极性。黑芯在 #1e1e1a 画布上确实几乎没有亮度差，
      // 所以它不靠自身发亮被认出来，而是靠外面那圈金属套（--muted，暗底 5.5:1）
      // 和电池/电表面上高对比度的「−」标记——这两条线索都不依赖黑芯的亮度。
      ring: true,
      radius: 5.6,
      positive: 'var(--danger)',
      negative: '#18181b',
    },
  },
};

export function strategyFor(mode: CircuitViewMode | undefined): RenderStrategy {
  return mode === 'physical' ? RENDER_STRATEGIES.physical : RENDER_STRATEGIES.schematic;
}

export type { BodyProps, BodyRenderer, RenderStrategy, WireStyle } from './types';
export { SchematicBody } from './schematic';
export { PhysicalBody, needleAngle } from './physical';
export { WIRE_PALETTE, SLEEVE_LENGTH, wireColorAt, wireStyleFor, sleevePoints, wireLabelAnchor, WIRE_LABEL_MIN_SEGMENT } from './wires';
