/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 物理力学计算核（纯函数，零 React / DOM 依赖）。
 *
 * 抽离自 Buoyancy / Lever / Pressure 三个实验的内联算式，与 ohm-core / lens-core 同构：
 * 组件与 smoke 测试共用同一份真源，数值关系（阿基米德原理、杠杆平衡、压强定义式）
 * 可以直接被单元测试复算，不再是「源码里出现过某个魔数」的空转断言。
 *
 * 常量口径（苏科版初中）：g = 10 N/kg；石块体积 1×10⁻⁴ m³、重 2 N；每格钩码 0.5 N。
 */

/** 重力加速度（初中取值） */
export const G = 10; // N/kg
/**
 * 石块体积（固定演示物）。取 1.5×10⁻⁴ m³ 是**刻度分辨率**驱动的选择：
 * 浮力每档增量 ΔF = ρ液·g·V·0.1（滑块步长 0.1），三种液体中最小的酒精 ρ=800
 * → ΔF = 800×10×1.5e-4×0.1 = **0.12 N ≥ 0.1 N**，即每拨一档都能在 0.1N 刻度上看到读数变化；
 * 若沿用 1e-4，酒精中 ΔF 仅 0.08 N（不足一格，读数看不出变化）。
 * 上界约束：完全浸没于盐水（ρ=1200）时 F浮 = 1.8 N < G = 2 N，石块仍由测力计承担（示数 0.2 N > 0），
 * 即石块密度 1333 kg/m³ 仍大于三种液体，不会上浮，「浸没后示数恒定」考点成立。
 */
export const STONE_VOLUME = 1.5e-4; // m³
/** 石块重力（弹簧测力计空载示数） */
export const STONE_WEIGHT = 2; // N

/**
 * 排开液体的体积：V排 = V物 · 浸入比例，**且不超过物体自身体积**。
 * 饱和（浸入比例 ≥ 1）是「完全浸没后继续下沉，浮力不再增大」这一考点能成立的前提——
 * 无饱和的算式在 vSub > 1 时会给出超过物体体积的 V排，属于非物理值。
 */
export function displacedVolume(vSubRatio: number): number {
  return STONE_VOLUME * Math.min(1, Math.max(0, vSubRatio));
}

/** 浮力：F浮 = ρ液 · g · V排（阿基米德原理） */
export function buoyantForce(rho: number, vSubRatio: number): number {
  return rho * G * displacedVolume(vSubRatio);
}

/**
 * 弹簧测力计示数：F示 = G − F浮。
 * 完全浸没后 V排 饱和 → 示数恒定（与浸入深度无关，模型里没有深度变量是刻意的）。
 * 示数是「读数」，不可能为负：F浮 ≥ G 时物体不再由测力计承担（漂浮/上浮），取 0。
 */
export function springReading(rho: number, vSubRatio: number): number {
  return Math.max(0, STONE_WEIGHT - buoyantForce(rho, vSubRatio));
}

/** 每格钩码的重力（m = 50 g） */
export const HOOK_WEIGHT = 0.5; // N

/**
 * 力矩：M = F · l。
 * 钩码**竖直悬挂**，力的作用线竖直，故力臂 l = 支点到作用线的**垂线段长** = 水平格距 × 格宽，
 * 在本实验里就是「格数」（格宽等分）。多挂钩 = 同一力臂上的多份力，力矩直接相加。
 */
export function torque(hooks: number, armGrids: number): number {
  return hooks * HOOK_WEIGHT * armGrids;
}

/** 杠杆平衡：|M₁ − M₂| < 容差。0.5N 粒度下力矩差必为 0.5 的倍数 → 容差 0.05 等价于精确相等 */
export const LEVER_BALANCE_TOLERANCE = 0.05;

export function isLeverBalanced(t1: number, t2: number): boolean {
  return Math.abs(t1 - t2) < LEVER_BALANCE_TOLERANCE;
}

/** 杠杆最大倾角（度）与灵敏度：不平衡时按力矩差线性倾斜 */
export const LEVER_MAX_TILT = 8; // deg
export const LEVER_TILT_GAIN = 3.5; // deg/(N·格)

export function leverTilt(t1: number, t2: number): number {
  if (isLeverBalanced(t1, t2)) return 0;
  const raw = (t2 - t1) * LEVER_TILT_GAIN;
  return Math.max(-LEVER_MAX_TILT, Math.min(LEVER_MAX_TILT, raw));
}

/**
 * 固体压强：p = F / S。界面量纲：F 用 N、S 用 cm²，返回 **kPa**（1 cm² = 1×10⁻⁴ m²）。
 * 分母下界由滑块保证（S ≥ 1 cm²）；此处仍夹一次，保证函数全域有限（S → 0 不产生 Infinity）。
 */
export const PRESSURE_MIN_AREA = 1; // cm²

export function solidPressure(f: number, sCm2: number): number {
  const s = Math.max(PRESSURE_MIN_AREA, sCm2) * 1e-4; // m²
  return f / s / 1000; // kPa
}

/** 海绵凹陷程度（0~1 的可视化代理量，非教学量：仅用于表现压力作用效果） */
export function dentAmount(f: number, sCm2: number): number {
  return Math.min(1, Math.max(0, f / (Math.max(PRESSURE_MIN_AREA, sCm2) * 2)));
}
