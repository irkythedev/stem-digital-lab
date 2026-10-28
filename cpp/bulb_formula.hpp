/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 灯泡热力学核（header-only，单一事实源）——C++ 侧的灯泡模型，
 * 供 stem_core.cpp（Emscripten/WASM 导出）与 stem_cli.cpp（g++ 对拍）include。
 *
 * 语义与 TS 真源 src/labs/physics/bulb-core.ts 完全一致，也与电学工作台
 * 原有的内联热积分（circuit-bench-core.ts 的 advanceBulbTemperatures）逐式同源。
 *
 * 模型（M1 教学级）：
 *   - 钨丝电阻随温度线性：R(T) = max(0.01, (V额²/P额)·T/T额)；冷态约为额定值的 300/2800；
 *   - 辐射散热系数 k = P额 / max(1, T额⁴ − T环境⁴)（额定工况下电功率等于辐射功率，据此标定）；
 *   - 热容 C = max(1e-4, 0.08·4k·T额³)（时间常数约 0.2 s）；
 *   - 单步显式欧拉：ΔT = (I²R − k(T⁴ − T环境⁴))/C · h，随后夹到 [T环境, T烧断+200]。
 *
 * 为什么 k 与 C 由调用方算好传进来：单步积分是三种实现（TS 回退 / WASM / g++ 真值）
 * 唯一需要逐位一致的地方，而 k、C 又是「额定参数 → 常数」的纯查表式换算，放在调用方
 * 可以保证工作台对额定参数的夹取口径（ratedV ≥ 0.1、ratedP ≥ 0.01）只有一份。
 * rad_k 因此是 bulb_temp_step 的显式参数——原始内联式里它是一个自由变量，
 * 不传就没法复现那条式子。
 *
 * 约定：
 *   - 烧断闩锁（temp ≥ T烧断 → blown/burnt）留在 TS 层：那是元件状态机，不是热力学；
 *   - 本头文件不做参数合法性兜底（rated_v 等由调用方按安全范围夹取），保持与
 *     bulb-core.ts 的逐式镜像；数值边界归一由 TS facade 负责。
 */
#ifndef STEM_BULB_FORMULA_HPP
#define STEM_BULB_FORMULA_HPP

#include <cmath>

namespace bulb {

/** 环境温度 K（灯泡热模型的基准温度） */
constexpr double kT_AMBIENT = 300.0;
/** 额定工况下的灯丝温度 K —— 电阻-温度线性关系与辐射标定的基准点 */
constexpr double kT_BULB_RATED = 2800.0;
/** 钨丝烧断温度 K */
constexpr double kT_BULB_BURN = 3450.0;
/** 积分上界余量 K：越过烧断温度后再积分已无物理意义，只给闩锁留一点空间 */
constexpr double kTEMP_HEADROOM = 200.0;
/** 电阻下界 Ω（与 TS 侧 Math.max(0.01, …) 同口径） */
constexpr double kRATED_R_MIN = 0.01;

/**
 * 参数兜底 + 夹取：非法（NaN / ±Inf）取 fallback，再夹到 [lo, hi]。
 * 对应 TS 侧 `Math.min(hi, Math.max(lo, num(v, fallback)))`。
 */
inline double safe_num(double v, double fallback, double lo, double hi) {
  const double n = std::isfinite(v) ? v : fallback;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/** 灯泡钨丝电阻：冷态约为额定值的 300/2800。 */
inline double bulb_resistance(double rated_v, double rated_p, double temp) {
  const double u = safe_num(rated_v, 3.8, 0.1, 240.0);
  const double p = safe_num(rated_p, 1.14, 0.01, 2000.0);
  const double rated_r = (u * u) / p;
  const double t = safe_num(temp, kT_AMBIENT, 1.0, kT_BULB_BURN);
  const double r = rated_r * (t / kT_BULB_RATED);
  return r < kRATED_R_MIN ? kRATED_R_MIN : r;
}

/**
 * 夹取小工具：逐位等价于 JS 的 Math.max / Math.min（已按全部 ±0 / NaN / ±Inf 组合逐位对拍）。
 * 之所以不直接用 std::fmax / std::fmin：那两者对 NaN 有「吞掉 NaN、返回另一个操作数」
 * 的语义，而这里的 NaN 必须原样穿过（TS 侧 Math.max/Math.min 遇 NaN 返回 NaN），
 * 否则三方对拍会在边界输入上分叉。
 * 两个操作数都是 0 时要按符号分别取：Math.max 只在「一正一负」时归到 +0
 * （两个 −0 与两个 +0 的相等情形仍各自保持原符号），Math.min 只在「一正一负」时归到 −0
 * ——「一律取 +0 / −0」会在 −0/−0 与 +0/+0 上多出两类假分叉。
 */
inline double dmax(double a, double b) {
  if (std::isnan(a)) return a;
  if (std::isnan(b)) return b;
  if (a > b) return a;
  if (b > a) return b;
  if (a == 0.0 && b == 0.0) return (std::signbit(a) && std::signbit(b)) ? -0.0 : 0.0;
  return a;
}
inline double dmin(double a, double b) {
  if (std::isnan(a)) return a;
  if (std::isnan(b)) return b;
  if (a < b) return a;
  if (b < a) return b;
  if (a == 0.0 && b == 0.0) return (std::signbit(a) || std::signbit(b)) ? -0.0 : 0.0;
  return a;
}

/**
 * 灯丝温度单步显式欧拉积分：T' = clamp(T + (I²R − k(T⁴ − T环境⁴))/C · h, T环境, T烧断+200)。
 * r_now / c_heat / rad_k 由调用方按当前温度与额定参数算好（TS 侧 bulbResistance /
 * bulbHeatCapacity / bulbRadK），本函数只做积分与夹取——上界 T烧断+200 与本文件
 * 的常量同源，不另开参数。
 *
 * 夹取用上界在外的 dmin(hi, dmax(t_ambient, next))，与 TS 侧
 * Math.min(T烧断+200, Math.max(t_ambient, …)) 逐位同序：先取环境温度为下界，
 * 再整体夹到上界。**不要**改成「先判下界就 return t_ambient」的早退式写法——
 * 那会在 t_ambient > 上界时绕过上界夹取，让返回值冲破自己的额定上界。
 */
inline double bulb_temp_step(double temp, double current, double r_now, double c_heat,
                             double h, double t_ambient, double rad_k) {
  const double p_in = current * current * r_now;
  const double p_out = rad_k * (std::pow(temp, 4.0) - std::pow(t_ambient, 4.0));
  const double next = temp + ((p_in - p_out) / c_heat) * h;
  return dmin(kT_BULB_BURN + kTEMP_HEADROOM, dmax(t_ambient, next));
}

}  // namespace bulb

#endif  // STEM_BULB_FORMULA_HPP
