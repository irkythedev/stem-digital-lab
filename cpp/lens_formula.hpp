/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 凸透镜成像公式（header-only，单一事实源）——与 TS 真源
 * src/labs/physics/lens-core.ts 同语义，供 stem_core.cpp（WASM Embind）
 * 与未来的命令行演示共用；不在 C++ 里做成像分类/文案。
 *
 * 约定：
 *   - |u - f| < 0.01 时出射光近似平行、不成清晰实像：返回 NaN（IEEE 哨兵），
 *     UI 归一由 TS facade 完成（Number.isNaN → null），C++ 不做字符串/可空类型；
 *   - 其余返回 u*f/(u-f)，符号约定与 JS 一致（v < 0 即虚像，由 TS 层解释）。
 */
#ifndef STEM_LENS_FORMULA_HPP
#define STEM_LENS_FORMULA_HPP

#include <cmath>

namespace lens {

/** 像距 v = uf/(u-f)；u≈f（|u-f|<0.01）返回 NaN（无清晰实像哨兵）。 */
inline double image_v(double u, double f) {
  const double diff = u - f;
  if (std::fabs(diff) < 0.01) return NAN;
  return (u * f) / diff;
}

}  // namespace lens

#endif  // STEM_LENS_FORMULA_HPP
