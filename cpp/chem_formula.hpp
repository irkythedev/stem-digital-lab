/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 酸碱中和滴定核（header-only，单一事实源）——C++ 侧的 pH 模型，
 * 供 stem_core.cpp（Emscripten/WASM 导出）与 stem_cli.cpp（g++ 对拍）include。
 *
 * 语义与 TS 真源 src/labs/chemistry/titration-core.ts 完全一致（同为
 * 酸碱中和实验 Neutralization.tsx 的 phAt 授权实现）。
 *
 * 模型：强酸强碱（HCl + NaOH）完全电离的简化浓度模型。
 *   - 恰好中和：pH = 7；
 *   - 酸过量：pH = −log10(剩余酸浓度)，剩余酸浓度 = (n酸 − n碱) / 总体积；
 *   - 碱过量：pH = 14 + log10(过量碱浓度)，过量碱浓度 = (n碱 − n酸) / 总体积；
 *   - 两个分支都双向夹到 [0, 14]。
 *
 * 为什么是三个参数而不是两个：每个分支都要除以**总体积**（酸的初始体积 + 滴入体积），
 * 只给「酸摩尔数 / 碱摩尔数」无法还原 pH —— 缺总体积时等当点附近会算出无界浓度。
 * 调用方（Neutralization.tsx）持有 v0 = 20 mL 与滴入体积，总积由它算好传进来。
 *
 * 等当点判定用**相对容差**且必须先判：`|n碱 − n酸| < 1e-9·max(1, n酸)` 时直接返回 7。
 * 顺序不能颠倒（先分支后容差会让残余浓度趋零、pH 发散到 16.9），容差也不能省
 * （浮点误差会让等当点当不成正好相等）——这正是 pH 曲线上那根 0.2 mL 突跃成立的
 * 前提，也是守卫断言 `phAt(c, eqVolume(c)) === 7` 精确成立的唯一原因。
 */
#ifndef STEM_CHEM_FORMULA_HPP
#define STEM_CHEM_FORMULA_HPP

#include <cmath>

namespace chem {

/** 强酸强碱滴定的单点 pH：n酸、n碱为摩尔数，total_volume 为总体积（同一体积单位）。 */
inline double ph_from_moles(double acid_mol, double base_mol, double total_volume) {
  if (std::fabs(base_mol - acid_mol) < 1e-9 * std::fmax(1.0, acid_mol)) return 7.0;
  if (base_mol < acid_mol) {
    const double h = (acid_mol - base_mol) / total_volume;
    const double ph = -std::log10(h);
    if (ph < 0.0) return 0.0;
    return ph > 14.0 ? 14.0 : ph;
  }
  const double oh = (base_mol - acid_mol) / total_volume;
  const double ph = 14.0 + std::log10(oh);
  if (ph < 0.0) return 0.0;
  return ph > 14.0 ? 14.0 : ph;
}

}  // namespace chem

#endif  // STEM_CHEM_FORMULA_HPP
