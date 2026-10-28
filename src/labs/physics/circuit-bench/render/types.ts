/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 双模渲染策略类型
 *
 * 策略只决定「长什么样」：本体画法、导线材质、接线柱样式。
 * 端子坐标、导线拓扑、网表与求解结果全部来自 core/geometry，两种模式共用，
 * 因此切换视图不会让接线柱漂移，也不会影响任何读数。
 */
import type { ReactElement } from 'react';

import type { CircuitComponent, ElementReading } from '../circuit-bench-core';
import type { CircuitViewMode } from '../circuit-bench-view';

export interface BodyProps {
  el: CircuitComponent;
  /** 接线柱半跨度；由 TERMINAL_HALF_SPAN 推导后传入，本体不得自己另算。 */
  half: number;
  stroke: string;
  reading?: ElementReading;
}

export type BodyRenderer = (props: BodyProps) => ReactElement;

export interface WireStyle {
  /** 绝缘皮颜色；schematic 用主题前景色。 */
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  /** physical 的线缆外壳（深色描边），schematic 为 null。 */
  casing: { stroke: string; strokeWidth: number; strokeOpacity: number } | null;
  /** 线端是否画彩色插头护套。 */
  sleeves: boolean;
}

export interface JunctionStyle {
  r: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface RenderStrategy {
  mode: CircuitViewMode;
  Body: BodyRenderer;
  wireStyle: (index: number) => WireStyle;
  junctionStyle: JunctionStyle;
  /** 接线柱外观：仿真图是金属柱 + 彩色极性套，电路图是实心点。 */
  terminal: {
    ring: boolean;
    radius: number;
    positive: string;
    negative: string;
  };
}
