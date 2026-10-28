/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 元件库缩略图
 *
 * 只做一件事：把画布上的**同一个本体渲染器**（render/schematic 或 render/physical）
 * 塞进一个按视图模式裁好的小视口里。
 *
 * 于是「元件库图标 / 拖拽幽灵 / 画布上的元件」三处长得完全一样，换视图模式一起换——
 * 不再有第三套手绘简笔符号可以跑偏。线宽也由本体自己带（不注入 stroke-width：
 * 本体的粗细是有意分层的，CSS 统一改粗会把「细引线 + 粗线身」压成一坨）。
 */
import { useId } from 'react';

import type { ElementKind } from './circuit-bench-core';
import type { CircuitViewMode } from './circuit-bench-view';
import { paletteDemoElement, paletteHalfSpan, paletteIconBox } from './circuit-bench-palette-icon';
import { strategyFor } from './render';

export interface PaletteGlyphProps {
  kind: ElementKind;
  /** 电路图 → 国标线稿符号；仿真图 → 实物教具。图标随它实时切换。 */
  viewMode: CircuitViewMode;
  className?: string;
}

export default function PaletteGlyph({ kind, viewMode, className }: PaletteGlyphProps) {
  // 逐实例唯一的 id 前缀：仿真图的灯泡渐变按 id 注册，和画布上那份不能撞名。
  // React 的 useId 带冒号（`:_r1:`），进 `url(#…)` 前洗掉，只留字母数字下划线。
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const box = paletteIconBox(kind, viewMode);
  const Body = strategyFor(viewMode).Body;

  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      // meet：视口比例各异（导线扁、灯泡高），按需内切居中，绝不拉伸变形。
      preserveAspectRatio="xMidYMid meet"
      className={className}
      data-palette-glyph={kind}
      data-view-mode={viewMode}
      aria-hidden
    >
      <Body
        el={paletteDemoElement(kind, `palette-${uid}`)}
        half={paletteHalfSpan(kind)}
        stroke="currentColor"
      />
    </svg>
  );
}
