/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 拉线预览几何
 *
 * 拖端子接线时的虚线皮筋以前是一根**直线**：起点在接线柱、终点跟着手指，
 * 松手那一下才「啪」地变成正交折线。学生看到的是两套几何，而且斜线在电路图里
 * 根本不存在——它既不提示这条线最后往哪拐，也没法判断会不会压到别的元件。
 *
 * 现在预览直接走**同一套正交路由**（`wireRoutePoints`）：
 * - 悬空时（没有命中目标端子）用 0 短桩，线头贴着手指，不抢先替学生决定方向；
 * - 命中目标端子时按 `PREVIEW_STUB` 出一小截短桩，末段严格沿目标端子法线，
 *   与松手后 `buildWireRoutes` 的进线方向一致——「吸附的那一刻所见即所得」。
 *
 * 注意这里**不传 avoid**：预览要求每帧都便宜（满负载时元件本体全量参与净空判定
 * 会拖慢指针事件），而且皮筋本来就该是一条「理想折线」，压到谁由松手后的正式
 * 路由去避让。
 */
import { roundedWirePath, wireRoutePoints, type Pt } from './circuit-bench-geometry';
import type { CircuitViewMode } from './circuit-bench-view';

/**
 * 命中目标端子时预览短桩的长度（世界单位）。
 *
 * 比正式走线的 18 短一些：皮筋要够「短」才跟手，但又必须非零——只有真正沿法线
 * 出这一小截，末段方向才和松手后的走线一致，吸附瞬间不会整体跳一下。
 */
export const PREVIEW_STUB = 10;

const ZERO: Pt = { x: 0, y: 0 };

/** 预览折线：两端法线齐备时按法线进出，悬空端退化成直角折线。 */
export function previewRoutePoints(from: Pt, to: Pt, normalA: Pt, normalB: Pt): Pt[] {
  const snapped = normalB.x !== 0 || normalB.y !== 0;
  return wireRoutePoints(from, to, normalA, snapped ? normalB : ZERO, PREVIEW_STUB);
}

/**
 * 预览拐角半径：与正式导线同一套视图分流。
 * 电路图 0 = 直角折线；仿真图 6 = 与正式导线一致的圆弧。
 */
export const PREVIEW_CORNER_RADIUS: Record<CircuitViewMode, number> = {
  schematic: 0,
  physical: 6,
};

/** 预览折线 → 当前视图的拐角路径（吸附前后线型不突变）。 */
export function previewWirePath(
  from: Pt,
  to: Pt,
  normalA: Pt,
  normalB: Pt,
  radius = PREVIEW_CORNER_RADIUS.physical,
): string {
  return roundedWirePath(previewRoutePoints(from, to, normalA, normalB), radius);
}
