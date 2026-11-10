/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 一次函数计算核（纯函数，零 React / DOM 依赖）。
 *
 * 只放「斜率阶梯」的几何端点：从 (0,b) 出发，横向走 Δx = 1，
 * 纵向走 Δy = k，正好落到直线上的 (1, b+k)。组件与测试共用同一份，
 * 避免测试测的是一套几何、画布画的是另一套。
 */

export interface SlopeTriangle {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  dx: number;
  dy: number;
}

/** 一次函数 y = kx + b 在截距点处的斜率阶梯（固定 Δx = 1） */
export function slopeTriangle(k: number, b: number): SlopeTriangle {
  return { x0: 0, y0: b, x1: 1, y1: b + k, dx: 1, dy: k };
}
