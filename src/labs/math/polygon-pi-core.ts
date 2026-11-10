/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 割圆术数学核（人教版 九上「圆」拓展 · 刘徽割圆术）
 *
 * 只放数学：内接 / 外切正多边形对圆周长与面积的逼近。
 * 半径取 r = 1 时，圆周长 = 2π ≈ 6.2832，圆面积 = π ≈ 3.1416，
 * 于是「多边形周长 ÷ 直径」本身就是 π 的一个估计值。
 *
 * 全部为纯函数，可被测试直接调用；组件只负责呈现。
 */

export const PI = Math.PI;

export interface Pt {
  x: number;
  y: number;
}

/** 可选的边数序列（翻倍式递进，3 起步） */
export const N_STEPS = [3, 4, 6, 8, 12, 16, 24, 32, 48, 96, 192] as const;

/** 最小边数：少于 3 不成多边形 */
export const N_MIN = 3;

/** 内接正 n 边形边长：s = 2r·sin(π/n) */
export function sideLen(n: number, r = 1): number {
  if (!(n >= N_MIN)) return 0;
  return 2 * r * Math.sin(PI / n);
}

/** 内接正 n 边形周长：P = 2nr·sin(π/n)，恒小于 2πr */
export function inPerimeter(n: number, r = 1): number {
  if (!(n >= N_MIN)) return 0;
  return 2 * n * r * Math.sin(PI / n);
}

/** 内接正 n 边形面积：A = (n/2)·r²·sin(2π/n)，恒小于 πr² */
export function inArea(n: number, r = 1): number {
  if (!(n >= N_MIN)) return 0;
  return 0.5 * n * r * r * Math.sin((2 * PI) / n);
}

/** 外切正 n 边形外接圆半径（其内切圆半径 = r）：R = r / cos(π/n) */
export function outRadius(n: number, r = 1): number {
  if (!(n >= N_MIN)) return r;
  return r / Math.cos(PI / n);
}

/** 外切正 n 边形周长：P = 2nr·tan(π/n)，恒大于 2πr */
export function outPerimeter(n: number, r = 1): number {
  if (!(n >= N_MIN)) return 0;
  return 2 * n * r * Math.tan(PI / n);
}

/** 外切正 n 边形面积：A = n·r²·tan(π/n)，恒大于 πr² */
export function outArea(n: number, r = 1): number {
  if (!(n >= N_MIN)) return 0;
  return n * r * r * Math.tan(PI / n);
}

/** 由周长反推 π 的估计值：π ≈ 周长 ÷ 直径 */
export function piFromPerimeter(p: number, r = 1): number {
  if (!(r > 0)) return 0;
  return p / (2 * r);
}

/** 由面积反推 π 的估计值：π ≈ 面积 ÷ r² */
export function piFromArea(a: number, r = 1): number {
  if (!(r > 0)) return 0;
  return a / (r * r);
}

/**
 * 内接正 n 边形顶点（角度从正上方开始，逆时针排列）。
 * @param rot 起始角偏移（弧度），默认 −π/2 = 正上方
 */
export function inVertices(n: number, r = 1, rot = -PI / 2): Pt[] {
  if (!(n >= N_MIN)) return [];
  const out: Pt[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = rot + (2 * PI * i) / n;
    out.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return out;
}

/**
 * 外切正 n 边形顶点：每条边与圆相切，切点正好是内接多边形的顶点位置，
 * 所以起始角要再偏移半个圆心角。
 */
export function outVertices(n: number, r = 1, rot = -PI / 2): Pt[] {
  if (!(n >= N_MIN)) return [];
  const R = outRadius(n, r);
  const out: Pt[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = rot + PI / n + (2 * PI * i) / n;
    out.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
  }
  return out;
}

/** 内接多边形周长与圆周长的差（恒为正） */
export function inGap(n: number, r = 1): number {
  return 2 * PI * r - inPerimeter(n, r);
}

/** 外切多边形周长与圆周长的差（恒为正） */
export function outGap(n: number, r = 1): number {
  return outPerimeter(n, r) - 2 * PI * r;
}

/** 内接面积的差（圆面积 − 内接面积） */
export function areaGap(n: number, r = 1): number {
  return PI * r * r - inArea(n, r);
}

/** 内接 / 外切两条周长构成的 π 夹逼区间 */
export function piBounds(n: number, r = 1): { lo: number; hi: number; width: number } {
  const lo = piFromPerimeter(inPerimeter(n, r), r);
  const hi = piFromPerimeter(outPerimeter(n, r), r);
  return { lo, hi, width: hi - lo };
}

/** 数组里下一个边数（用于「边数翻倍」按钮，到顶返回 null） */
export function nextStep(n: number): number | null {
  const i = N_STEPS.indexOf(n as (typeof N_STEPS)[number]);
  if (i < 0) return null;
  return N_STEPS[i + 1] ?? null;
}

/** 数组里索引对应的边数（滑块按索引走，才不会在 3→4 之间卡住） */
export function stepAt(index: number): number {
  const i = Math.max(0, Math.min(N_STEPS.length - 1, Math.round(index)));
  return N_STEPS[i];
}

/** 边数对应的滑块索引 */
export function indexOf(n: number): number {
  const i = N_STEPS.indexOf(n as (typeof N_STEPS)[number]);
  return i < 0 ? 0 : i;
}
