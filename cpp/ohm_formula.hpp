/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 欧姆定律共用公式（header-only）——C++ 侧的单一事实来源，
 * 供 stem_core.cpp（Emscripten/WASM 导出）与 cli.cpp（g++ 命令行）include，
 * 避免两份公式漂移。
 *
 * 语义与 src/labs/physics/ohm-core.ts（JS 真源）完全一致：
 *   - 定值电阻动态电阻 = r；灯泡 = r + γ·U（γ = 0.4 Ω/V）
 *   - 定值电阻 I = U / (r + rp)；灯泡 I = U / (r + γ·U + rp)
 *   - 分母为 0 不特判，保持 IEEE 除法语义（inf / nan），短路由交互层处理
 */

#ifndef OHM_FORMULA_HPP
#define OHM_FORMULA_HPP

namespace ohm {

// Ω/V —— 与 ohm-core.ts 的 BULB_GAMMA = 0.4 一致
constexpr double kBULB_GAMMA = 0.4;

/** 元件动态电阻：定值电阻 = r；灯泡 = r + γ·U（钨丝升温，简化非线性模型）。 */
inline double element_resistance(double r, bool is_bulb, double u) {
  return is_bulb ? r + kBULB_GAMMA * u : r;
}

/** 电路读数 I（A）。分母为 0 不特判（IEEE 除法语义）。 */
inline double current_of(double u, double r, bool is_bulb, double rp) {
  return is_bulb ? u / (r + kBULB_GAMMA * u + rp) : u / (r + rp);
}

}  // namespace ohm

#endif  // OHM_FORMULA_HPP
