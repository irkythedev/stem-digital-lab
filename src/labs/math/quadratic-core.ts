/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 二次函数计算核（纯函数，零 React / DOM / WASM 依赖）。
 *
 * 原样抽离自 src/labs/math/Quadratic.tsx（三幕式探究的纯计算部分），行为保持零变化：
 * 采样区间 x ∈ [-4, 4.0001]、步长 0.05、单段返回 [x, y] 点列。
 *
 * 顶点 h = -b/(2a)、k = a·h²+b·h+c 属「标注/显示」用途（直接格式化为 SVG label），
 * 有意留在 Quadratic.tsx 组件内，不搬入本文件。
 *
 * 供 Quadratic.tsx 与 smoke 测试共用；后续 C++ → WASM 阶段在其上做同签名替换，
 * 加载失败静默回退本模块，不改变任何调用点语义。
 */

/** 二次函数单点求值 y = ax² + bx + c（供测试与日后 facade 复用）。 */
export function quadraticY(a: number, b: number, c: number, x: number): number {
  return a * x * x + b * x + c;
}

/** 采样一条二次函数曲线：x ∈ [-4, 4]，步长 0.05（4.0001 为浮点尾差防护上界）。 */
export function sampleQuadratic(a: number, b: number, c: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let x = -4; x <= 4.0001; x += 0.05) {
    pts.push([x, quadraticY(a, b, c, x)]);
  }
  return pts;
}
