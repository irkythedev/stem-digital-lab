/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 酸碱中和滴定核（纯函数，零 React / DOM / WASM 依赖）。
 *
 * 从 `chemistry/Neutralization.tsx` 的 `phAt` 里搬出「pH 是什么」这条式子，理由与
 * ohm-core / lens-core / quadratic-core 同构：式子原先只活在组件函数体内，C++ 侧
 * 无从对拍，也不进冒烟测试。抽成叶子模块（本文件不 import 任何东西）后成为单一
 * 事实源，三条腿都指向它：
 *   - TS 回退腿：本文件；
 *   - WASM 腿：`cpp/chem_formula.hpp`，经 `physics/stem-engine.ts` 门面；
 *   - g++ 真值腿：`cpp/stem_cli.cpp` 编出的原生程序。
 * 三方对拍见 `src/stem-core-ext.test.ts`。
 *
 * 模型：强酸强碱（HCl + NaOH）完全电离的简化浓度模型。
 *   - 恰好中和：pH = 7；
 *   - 酸过量：pH = −log10(剩余酸浓度)，剩余酸浓度 = (n酸 − n碱) / 总体积；
 *   - 碱过量：pH = 14 + log10(过量碱浓度)，过量碱浓度 = (n碱 − n酸) / 总体积；
 *   - 两个分支都双向夹到 [0, 14]。
 *
 * 为什么是三个参数而不是两个（`ph_from_moles(acid_mol, base_mol)` 那种更省事的签名）：
 * 每个分支都要除以**总体积**（酸的初始体积 + 滴入体积），只给两个摩尔数无法还原 pH
 * —— 缺总体积时等当点附近会算出无界浓度。V0 = 20 mL 与滴入量程属**实验场景常量**，
 * 由调用方（Neutralization.tsx）持有并算好总积传进来，本文件只管式子。
 *
 * 等当点判定用**相对容差**且必须先判：`|n碱 − n酸| < 1e-9·max(1, n酸)` 时直接返回 7。
 * 顺序不能颠倒（先分支后容差会让残余浓度趋零、pH 发散到 16.9），容差也不能省
 * （浮点误差会让等当点当不成正好相等）——这正是 pH 曲线上那根 0.2 mL 突跃成立的
 * 前提，也是守卫断言 `phAt(c, eqVolume(c)) === 7` 精确成立的唯一原因。
 */

/** 强酸强碱滴定的单点 pH：n酸、n碱为摩尔数，totalVolume 为总体积（同一体积单位）。 */
export function phFromMoles(acidMol: number, baseMol: number, totalVolume: number): number {
  // 相对容差优先判等当点：Math.max(1, acidMol) 保证酸极稀时容差仍有下界
  if (Math.abs(baseMol - acidMol) < 1e-9 * Math.max(1, acidMol)) return 7;
  // 两个分支都双向 clamp 到 [0,14]——酸性分支若只有 Math.max(0,…)，会在等当点附近
  // 冲到 16.9（曲线上冲出坐标系的尖峰）。写成比较而非 Math.min/Math.max 链是为了让
  // NaN 原样穿过：与 C++ 侧 `ph > 14.0 ? 14.0 : ph` 的传播口径逐位一致。
  if (baseMol < acidMol) {
    const h = (acidMol - baseMol) / totalVolume;
    const ph = -Math.log10(h);
    if (ph < 0) return 0;
    return ph > 14 ? 14 : ph;
  }
  const oh = (baseMol - acidMol) / totalVolume;
  const ph = 14 + Math.log10(oh);
  if (ph < 0) return 0;
  return ph > 14 ? 14 : ph;
}
