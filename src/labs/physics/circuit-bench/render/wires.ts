/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 导线材质
 *
 * 电路图用单色细线；仿真图用彩皮绝缘导线（`--chart-1..6` 循环），
 * 线端再画一段加粗护套，模拟真实实验箱里的香蕉插头。
 * 两种材质共用同一份 route.points，因此切换视图不会改变走线。
 */
import type { CircuitViewMode } from '../circuit-bench-view';
import type { WireStyle } from './types';

/**
 * 实验箱导线的绝缘皮配色；顺序固定，保证同一根导线每次重绘颜色一致。
 *
 * 取仓库既有的 `--chart-1..6`（Okabe-Ito 无障碍色族，见 index.css）而不是自配色：
 * 自配的六色在浅色底上有两色跌破 3:1（`#e0a33a` 2.22、`#3aa6a6` 2.92），
 * 且蓝紫一对的相对亮度比只有 1.051，红绿色觉障碍下几乎分不开。
 * 走令牌的另一个好处是暗色主题自动换成同色相提亮档，不必在这里写两套。
 *
 * 颜色不是唯一的身份通道：画布会给每根线挂一枚线号牌（见 CircuitCanvas），
 * 所以即使两根线同色（第 7 根与第 1 根循环同色）也仍然可辨。
 */
export const WIRE_PALETTE: readonly string[] = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];

export function wireColorAt(index: number): string {
  const i = ((Math.round(index) % WIRE_PALETTE.length) + WIRE_PALETTE.length) % WIRE_PALETTE.length;
  return WIRE_PALETTE[i];
}

/**
 * 线号牌的落点：整条走线里最长的那一段直线的中点。
 *
 * 取「最长直线段」而不是整条折线的几何中点：折线的中点常常正好落在拐角上，
 * 那里线宽收窄、又常有接线柱或跳线压着，号码牌会读成导线上的一个疙瘩。
 * 最长段的中点在直道上，离两端的插头护套也最远。
 *
 * 返回 null 表示这根线没有足够长的直段（比如两个接线柱紧挨着），
 * 此时不挂号码牌——一枚直径 14 的牌子会把整段线全糊住，反而更看不出走向。
 */
export const WIRE_LABEL_MIN_SEGMENT = 18;

export function wireLabelAnchor(
  points: { x: number; y: number }[],
  minSegment = WIRE_LABEL_MIN_SEGMENT,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestLen = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > bestLen) {
      bestLen = len;
      best = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }
  return bestLen >= minSegment ? best : null;
}

export function wireStyleFor(mode: CircuitViewMode, index: number): WireStyle {
  if (mode === 'physical') {
    return {
      stroke: wireColorAt(index),
      strokeWidth: 2.5,
      strokeOpacity: 1,
      casing: { stroke: 'var(--card-bg)', strokeWidth: 3.6, strokeOpacity: 0.9 },
      sleeves: true,
    };
  }
  return {
    stroke: 'var(--cb-wire, var(--fg))',
    strokeWidth: 1.45,
    strokeOpacity: 0.86,
    casing: null,
    sleeves: false,
  };
}

/** 护套长度（世界单位）：沿端口短桩方向覆盖住线头。 */
export const SLEEVE_LENGTH = 9;

/**
 * 线端护套的两点：从端子沿第一段（端口短桩）方向延伸。
 * 折线被去重成两点（直线）时同样适用。
 */
export function sleevePoints(
  points: { x: number; y: number }[],
  atStart: boolean,
  length = SLEEVE_LENGTH,
): [{ x: number; y: number }, { x: number; y: number }] | null {
  if (points.length < 2) return null;
  const tip = atStart ? points[0] : points[points.length - 1];
  const next = atStart ? points[1] : points[points.length - 2];
  const dx = next.x - tip.x;
  const dy = next.y - tip.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const d = Math.min(length, len);
  return [tip, { x: tip.x + (dx / len) * d, y: tip.y + (dy / len) * d }];
}
