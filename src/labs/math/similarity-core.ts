/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 相似与位似几何核（纯函数，零 React / DOM 依赖）。
 *
 * 位似变换：以 O 为中心、位似比 k 把点 P 映成 P′ = O + k·(P − O)。
 * k > 0 时像与原图在 O 同侧；k < 0 时落在 O 的另一侧（等价于绕 O 旋转 180° 再按 |k| 缩放）。
 * 位似图形必然相似：对应边比 = |k|、周长比 = |k|、面积比 = k²，且对应点连线都过 O。
 */

export type Pt = { x: number; y: number };
export type Tri = { A: Pt; B: Pt; C: Pt };

export const ORIGIN: Pt = { x: 0, y: 0 };

/** 以 O 为中心、位似比 k 的单点像 */
export function scaleAbout(o: Pt, p: Pt, k: number): Pt {
  return { x: o.x + k * (p.x - o.x), y: o.y + k * (p.y - o.y) };
}

/** 整个三角形的位似像 */
export function homothetic(o: Pt, t: Tri, k: number): Tri {
  return { A: scaleAbout(o, t.A, k), B: scaleAbout(o, t.B, k), C: scaleAbout(o, t.C, k) };
}

export function dist(p: Pt, q: Pt): number {
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** 周长 */
export function perimeter(t: Tri): number {
  return dist(t.A, t.B) + dist(t.B, t.C) + dist(t.C, t.A);
}

/** 面积（鞋带公式，取绝对值；退化共线时为 0） */
export function area(t: Tri): number {
  const s =
    (t.B.x - t.A.x) * (t.C.y - t.A.y) - (t.C.x - t.A.x) * (t.B.y - t.A.y);
  return Math.abs(s) / 2;
}

/** 周长比（像 / 原），k = 0 时无意义返回 0 */
export function perimeterRatio(k: number): number {
  return Math.abs(k);
}

/** 面积比（像 / 原）：k²，k = 0 时退化成 0 */
export function areaRatio(k: number): number {
  return k * k;
}

/** 三点是否共线（用于验证「对应点与位似中心共线」；退化输入返回 false） */
export function areCollinear(p: Pt, q: Pt, r: Pt, tol = 1e-9): boolean {
  const cross = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const scale = Math.max(1, dist(p, q) * dist(p, r));
  return Math.abs(cross) / scale < tol;
}

/** 位似是否成立：三点各自与原像、中心共线，且边长比一致 */
export function isHomothetic(o: Pt, src: Tri, img: Tri, tol = 1e-9): boolean {
  const sameLine =
    areCollinear(o, src.A, img.A, tol) &&
    areCollinear(o, src.B, img.B, tol) &&
    areCollinear(o, src.C, img.C, tol);
  if (!sameLine) return false;
  const r1 = dist(o, img.A) / Math.max(1e-9, dist(o, src.A));
  const r2 = dist(o, img.B) / Math.max(1e-9, dist(o, src.B));
  const r3 = dist(o, img.C) / Math.max(1e-9, dist(o, src.C));
  return Math.abs(r1 - r2) < 1e-6 && Math.abs(r2 - r3) < 1e-6;
}

/** 把数学坐标夹到可视区域内（拖拽用，防止点拖出画布后抓不回来） */
export function clampPt(p: Pt, xMin: number, xMax: number, yMin: number, yMax: number): Pt {
  return { x: Math.min(xMax, Math.max(xMin, p.x)), y: Math.min(yMax, Math.max(yMin, p.y)) };
}
