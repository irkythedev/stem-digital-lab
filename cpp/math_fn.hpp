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
 *   - 顶点 h = -b/(2a) 属标注/显示用途，留在组件（Quadratic.tsx）；
 *   - inverse_y 在 x = 0 处返回 NaN（定义域外哨兵），不返回 ±Infinity：
 *     反比例函数在 x = 0 无定义，而 Infinity 会被绘图层当成「一个很大的数」画出去。
 *     采样本来也跳过 x = 0 邻域，此约定只服务于「越界输入不得给出有限值」。
 */
#ifndef STEM_MATH_FN_HPP
#define STEM_MATH_FN_HPP

#include <cmath>

namespace mathfn {

/** 二次函数单点求值 y = a·x² + b·x + c。 */
inline double quadratic_y(double a, double b, double c, double x) {
  return a * x * x + b * x + c;
}

/** 反比例函数单点求值 y = k / x；x = 0（定义域外）返回 NaN。 */
inline double inverse_y(double k, double x) {
  if (x == 0.0) return NAN;
  return k / x;
}

}  // namespace mathfn

#endif  // STEM_MATH_FN_HPP
