/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 初等函数数学核（header-only，单一事实源）——与 TS 真源
 * src/labs/math/quadratic-core.ts 同语义，供 stem_core.cpp（WASM Embind）
 * 与未来的命令行演示共用；不在 C++ 里做采样循环/表达式格式化。
 *
 * 约定：
 *   - 只提供单点求值标量；采样区间（[-4, 4.0001]、步长 0.05）与循环在 TS facade
 *     （stem-engine.ts），与欧姆定律 sampleOhm 的「TS 循环 + C++ 标量」同构；
 *   - 顶点 h = -b/(2a) 属标注/显示用途，留在组件（Quadratic.tsx）。
 */
#ifndef STEM_MATH_FN_HPP
#define STEM_MATH_FN_HPP

namespace mathfn {

/** 二次函数单点求值 y = a·x² + b·x + c。 */
inline double quadratic_y(double a, double b, double c, double x) {
  return a * x * x + b * x + c;
}

}  // namespace mathfn

#endif  // STEM_MATH_FN_HPP
