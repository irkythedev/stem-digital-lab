/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 串并联电路计算核（纯函数，零 React / DOM 依赖）。
 *
 * 抽离自 Circuits.tsx 的「通用引擎：串联分压 / 并联分流」，与 ohm-core 同构。
 * 与 ohm-core 的差别：ohm-core 只算单个元件（含变阻器分压），本核算**整条电路**的
 * 各支路电流与电压分配，供 8 个电路样式共用并接受单元测试复算。
 *
 * 数值纪律：任何支路电阻为 0（导线/短路）时**不产生 Infinity / NaN**——
 * 支路短路的物理事实由组件层提示，本核只保证返回值有限。
 */

/** 支路/元件电阻列表（Ω），下标与电路图上的元件一一对应 */
export type Resistances = ReadonlyArray<number>;

/**
 * 串联电流：I = U / ΣR。全部电阻为 0（电源直接短接）时返回 0，
 * 由调用方标记短路——不让 Infinity 流进读数与 SVG 属性。
 */
export function seriesCurrent(u: number, rs: Resistances, closed = true): number {
  const total = rs.reduce((a, b) => a + b, 0);
  if (!closed || total <= 0) return 0;
  return u / total;
}

/**
 * 并联各支路电流：Iᵢ = U / Rᵢ（并联各支路电压相等，都等于电源电压）。
 * @param branchClosed 每个支路的开关状态；缺省视为全闭合
 * @returns 与 rs 等长的电流数组，恒为有限值
 */
export function parallelBranchCurrents(
  u: number,
  rs: Resistances,
  branchClosed?: ReadonlyArray<boolean>,
  mainClosed = true,
): number[] {
  return rs.map((r, i) => {
    if (!mainClosed) return 0;
    if (branchClosed && !branchClosed[i]) return 0;
    if (!(r > 0)) return 0; // 零阻支路 = 短路导线：不给出 Infinity
    return u / r;
  });
}

/** 干路电流：串联 = 唯一电流；并联 = 各支路电流之和（I₀ = I₁ + I₂） */
export function mainCurrent(
  u: number,
  rs: Resistances,
  mode: 'series' | 'parallel',
  branchClosed?: ReadonlyArray<boolean>,
  closed = true,
): number {
  if (mode === 'series') return seriesCurrent(u, rs, closed);
  return parallelBranchCurrents(u, rs, branchClosed, closed).reduce((a, b) => a + b, 0);
}

/**
 * 每个元件两端电压：
 * 串联 = I·Rᵢ（分压），并联 = U（各支路电压相等，都等于电源电压）。
 * 开关断开或支路断开时为 0。
 */
export function elementVoltages(
  u: number,
  rs: Resistances,
  mode: 'series' | 'parallel',
  branchClosed?: ReadonlyArray<boolean>,
  closed = true,
): number[] {
  if (mode === 'series') {
    const i = seriesCurrent(u, rs, closed);
    return rs.map((r) => i * r);
  }
  return parallelBranchCurrents(u, rs, branchClosed, closed).map((i, k) => (i > 0 ? rs[k] * i : 0));
}

/**
 * 并联总电阻：1/R总 = Σ(1/Rᵢ) → R总 必小于任一支路电阻。
 * 含零阻支路（短路）时返回 0。
 */
export function parallelResistance(rs: Resistances): number {
  if (rs.some((r) => !(r > 0))) return 0;
  const inv = rs.reduce((a, r) => a + 1 / r, 0);
  return inv > 0 ? 1 / inv : 0;
}

/** 元件功率（用于亮度标定）：P = I²R */
export function elementPower(current: number, r: number): number {
  return current * current * r;
}
