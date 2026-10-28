/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 灯泡热力学核（纯函数，零 React / DOM / WASM 依赖）。
 *
 * 原样搬离 `circuit-bench/circuit-bench-models.ts` 的「灯泡是什么」部分：
 * 环境/额定/烧断温度、钨丝电阻、热容、辐射散热系数与单步热积分。搬出来的理由与
 * ohm-core / lens-core / quadratic-core 同构 —— 这些式子原先埋在电学工作台的元件
 * 模型里，只有工作台自己能算，C++ 侧无从对拍。抽成叶子模块（本文件不 import 任何
 * 东西）后成为单一事实源，三条腿都指向它：
 *   - TS 回退腿：本文件；
 *   - WASM 腿：`cpp/bulb_formula.hpp`，经 `stem-engine.ts` 门面；
 *   - g++ 真值腿：`cpp/stem_cli.cpp` 编出的原生程序。
 * 三方对拍见 `src/stem-core-ext.test.ts`。
 *
 * 数值纪律：本文件是原式的**逐式**搬迁（Math.pow、Math.max 下界、参数兜底与夹取的
 * 口径都不动）。灯泡温度演化是可观察行为——烧断时机就压在温度轨迹上——任何一位
 * 偏差都会挪动「什么时候烧断」，所以不做任何化简或重排。
 *
 * 顺带承接 `num` / `safeNum`：这两个元件参数的兜底/夹取口径原先与灯泡公式同在
 * `circuit-bench-models.ts`，其余调用方（电阻定律试样、各元件阻值夹取）仍从那里取。
 * 若留两份，工作台就会出现两套「非法参数怎么办」的口径。
 */

/** 环境温度 K（灯泡热模型的基准温度） */
export const T_AMBIENT = 300;
/** 额定工况下的灯丝温度 K —— 电阻-温度线性关系与辐射标定的基准点 */
export const T_BULB_RATED = 2800;
/** 钨丝烧断温度 K */
export const T_BULB_BURN = 3450;
/** 积分上界余量 K：越过烧断温度后再积分已无物理意义，只给烧断闩锁留一点空间 */
export const TEMP_HEADROOM = 200;

/** 灯泡钨丝电阻：冷态约为额定值的 300/2800。 */
export function bulbResistance(ratedVoltage: number, ratedPower: number, temp: number): number {
  const u = safeNum(ratedVoltage, 3.8, 0.1, 240);
  const p = safeNum(ratedPower, 1.14, 0.01, 2000);
  const ratedR = (u * u) / p;
  const t = safeNum(temp, T_AMBIENT, 1, T_BULB_BURN);
  return Math.max(0.01, ratedR * (t / T_BULB_RATED));
}

/**
 * 灯泡热容：按额定功率与额定温度估算（M1 教学级模型，时间常数约 0.2 s）。
 *
 * `ratedVoltage` 保留在签名里但不参与这条式子（热容只由额定功率与额定温度标定）——
 * 原实现同样算了它却没用上，此处照抄签名，免得改调用点；冒烟测试按「热容随额定功率
 * 增大」断言，与电压无关。
 */
export function bulbHeatCapacity(_ratedVoltage: number, ratedPower: number): number {
  const p = safeNum(ratedPower, 1.14, 0.01, 2000);
  const k = p / Math.max(1, Math.pow(T_BULB_RATED, 4) - Math.pow(T_AMBIENT, 4));
  // C = 0.08 × 4k T³ 来自设计文档的时间常数标定（约 0.2 s 量级）。
  return Math.max(1e-4, 0.08 * 4 * k * Math.pow(T_BULB_RATED, 3));
}

/**
 * 灯泡辐射散热系数 k = P额 / max(1, T额⁴ − T环境⁴)。
 *
 * 口径：额定工况下电功率等于辐射功率，所以 k 由额定功率标定。**不做参数夹取**——
 * 热积分里这条式子原先直接吃调用方已按 `ratedV ≥ 0.1 / ratedP ≥ 0.01` 夹过的额定功率，
 * 这里再加一道上界会改变工作台的既有数值（额定参数越界时 k 会变），属于行为变更。
 */
export function bulbRadK(ratedPower: number): number {
  return ratedPower / Math.max(1, Math.pow(T_BULB_RATED, 4) - Math.pow(T_AMBIENT, 4));
}

/**
 * 灯丝温度单步显式欧拉积分：
 *   T' = clamp(T + (I²R − k(T⁴ − T环境⁴))/C · h, T环境, T烧断 + 200)
 *
 * 入参全部由调用方按**当前**温度与额定参数算好（`bulbResistance` / `bulbHeatCapacity` /
 * `bulbRadK`）——工作台每个子步都要按「本子步重解出的电流」重算这三个量，本函数只负责
 * 积分与夹取，保证与 `cpp/bulb_formula.hpp` 的 `bulb_temp_step` 是同一件事。
 *
 * 烧断闩锁（temp ≥ T烧断 → blown / burnt）不在这里：那是元件状态机，留 `stepSimulation`。
 * `T烧断 + 200` 的上界与 C++ 侧同源（那边读的是自己头文件里的常量）。
 */
export function bulbTempStep(
  temp: number,
  current: number,
  rNow: number,
  cHeat: number,
  h: number,
  tAmbient: number,
  radK: number,
): number {
  const dT = (current * current * rNow - radK * (Math.pow(temp, 4) - Math.pow(tAmbient, 4))) / cHeat;
  // 夹取次序：上界在外、下界在内（先 Math.max 取环境温度为下界，再 Math.min 整体夹到上界）。
  // C++ 侧 cpp/bulb_formula.hpp 用 dmin(hi, dmax(tAmbient, next)) 逐位同序——包括 NaN 原样穿过
  // 与 ±0 的符号取法（两个 0 一正一负时 Math.max 归 +0、Math.min 归 −0）。
  // 别改成「先判下界就 return tAmbient」的早退式写法：那会在 tAmbient > 上界时跳过上界夹取。
  return Math.min(T_BULB_BURN + TEMP_HEADROOM, Math.max(tAmbient, temp + dT * h));
}

/** 参数取值：非有限值（NaN / ±Infinity / 非数字）取 fallback。 */
export function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** 参数兜底 + 夹取：非法取 fallback，再夹到 [min, max]。 */
export function safeNum(v: unknown, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num(v, fallback)));
}
