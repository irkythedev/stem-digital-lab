/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 初中化学「化学式与化合价」数据层（纯数据 + 纯函数，零 React / DOM 依赖）。
 *
 * 口径（2026-10-30 拍板）：
 *   - 元素范围：人教版 7–9 年级核心元素 + 常见变价元素；
 *   - 化合价：只列初中教材出现过的价态，不做百科式穷举；
 *   - 相对原子质量：统一取初中计算口径（Cl = 35.5，Fe = 56，Cu = 64 …），
 *     与周期表的 IUPAC 标准原子量刻意分离，页面里说明差异；
 *   - 原子团只有教材要求的 7 个，不多不少。
 *
 * 本文件同时被 UI、GEO 生成器与门禁测试引用：任何数字改动都会同时反映到
 * 速查卡、交叉法结果与 content/tools/chemistry-formulas.json。
 */
import { ELEMENTS, type ElementInfo } from '../elements';
import { elementByNumber } from '../elements';

export interface Bi {
  zh: string;
  en: string;
}

export interface ValenceElement {
  symbol: string;
  atomicNumber: number;
  name: Bi;
  /** 教材出现过的化合价，升序；第一个为该元素的「主要价态」。 */
  valences: number[];
  /** 主要价态（金属/H 用来做阳离子，非金属用来做阴离子）。 */
  dominant: number;
  /** 记忆钩子或特殊说明。 */
  note?: Bi;
}

export interface IonGroup {
  /** 原子团化学式，如 SO4。 */
  formula: string;
  /** 电荷数：+1 / -1 / -2 / -3。 */
  charge: number;
  name: Bi;
  /** 口诀 / 记忆点。 */
  mnemonic: Bi;
}

const bi = (zh: string, en: string): Bi => ({ zh, en });

/**
 * 初中计算口径的相对原子质量。
 * 与周期表的 IUPAC 值不同（周期表 Fe = 55.8，本表取 56），页面明确标注。
 */
export const TEXTBOOK_MASSES: Readonly<Record<string, number>> = {
  H: 1,
  C: 12,
  N: 14,
  O: 16,
  Na: 23,
  Mg: 24,
  Al: 27,
  Si: 28,
  P: 31,
  S: 32,
  Cl: 35.5,
  K: 39,
  Ca: 40,
  Mn: 55,
  Fe: 56,
  Cu: 64,
  Zn: 65,
  Ag: 108,
  Ba: 137,
  Hg: 201,
};

/** 常用元素与化合价（按周期表顺序排列，方便与周期表互链）。 */
export const VALENCE_ELEMENTS: readonly ValenceElement[] = [
  { symbol: 'H', atomicNumber: 1, name: bi('氢', 'Hydrogen'), valences: [1], dominant: 1, note: bi('氢通常显 +1 价。', 'Hydrogen is normally +1.') },
  { symbol: 'C', atomicNumber: 6, name: bi('碳', 'Carbon'), valences: [2, 4], dominant: 4, note: bi('碳在 CO 中为 +2，在 CO₂ 中为 +4。', 'Carbon is +2 in CO and +4 in CO₂.') },
  { symbol: 'N', atomicNumber: 7, name: bi('氮', 'Nitrogen'), valences: [-3, 2, 4, 5], dominant: -3, note: bi('NH₃ 中 N 为 −3，HNO₃ 中 N 为 +5。', 'N is −3 in NH₃ and +5 in HNO₃.') },
  { symbol: 'O', atomicNumber: 8, name: bi('氧', 'Oxygen'), valences: [-2], dominant: -2, note: bi('氧通常显 −2；H₂O₂ 中氧为 −1，属特例。', 'Oxygen is normally −2; in H₂O₂ it is −1.') },
  { symbol: 'Na', atomicNumber: 11, name: bi('钠', 'Sodium'), valences: [1], dominant: 1 },
  { symbol: 'Mg', atomicNumber: 12, name: bi('镁', 'Magnesium'), valences: [2], dominant: 2 },
  { symbol: 'Al', atomicNumber: 13, name: bi('铝', 'Aluminium'), valences: [3], dominant: 3 },
  { symbol: 'Si', atomicNumber: 14, name: bi('硅', 'Silicon'), valences: [4], dominant: 4 },
  { symbol: 'P', atomicNumber: 15, name: bi('磷', 'Phosphorus'), valences: [-3, 5], dominant: 5, note: bi('P₂O₅ 中 P 为 +5；磷化物中可显 −3。', 'P is +5 in P₂O₅ and can be −3 in phosphides.') },
  { symbol: 'S', atomicNumber: 16, name: bi('硫', 'Sulfur'), valences: [-2, 4, 6], dominant: -2, note: bi('H₂S 中 −2，SO₂ 中 +4，SO₃ 中 +6。', 'S is −2 in H₂S, +4 in SO₂ and +6 in SO₃.') },
  { symbol: 'Cl', atomicNumber: 17, name: bi('氯', 'Chlorine'), valences: [-1, 1, 5, 7], dominant: -1, note: bi('Cl 通常显 −1；KClO₃ 中 +5，KClO₄ 中 +7。', 'Cl is usually −1; +5 in KClO₃ and +7 in KClO₄.') },
  { symbol: 'K', atomicNumber: 19, name: bi('钾', 'Potassium'), valences: [1], dominant: 1 },
  { symbol: 'Ca', atomicNumber: 20, name: bi('钙', 'Calcium'), valences: [2], dominant: 2 },
  { symbol: 'Mn', atomicNumber: 25, name: bi('锰', 'Manganese'), valences: [2, 4, 6, 7], dominant: 2, note: bi('MnO₂ 中 +4，K₂MnO₄ 中 +6，KMnO₄ 中 +7。', 'Mn is +4 in MnO₂, +6 in K₂MnO₄ and +7 in KMnO₄.') },
  { symbol: 'Fe', atomicNumber: 26, name: bi('铁', 'Iron'), valences: [2, 3], dominant: 3, note: bi('Fe²⁺ 读「亚铁」，Fe³⁺ 读「铁」。', 'Fe²⁺ is iron(II), Fe³⁺ is iron(III) in Chinese naming.') },
  { symbol: 'Cu', atomicNumber: 29, name: bi('铜', 'Copper'), valences: [1, 2], dominant: 2, note: bi('Cu₂O 中 Cu 为 +1，读「氧化亚铜」。', 'Cu is +1 in Cu₂O (copper(I) oxide).') },
  { symbol: 'Zn', atomicNumber: 30, name: bi('锌', 'Zinc'), valences: [2], dominant: 2 },
  { symbol: 'Ag', atomicNumber: 47, name: bi('银', 'Silver'), valences: [1], dominant: 1 },
  { symbol: 'Ba', atomicNumber: 56, name: bi('钡', 'Barium'), valences: [2], dominant: 2 },
  { symbol: 'Hg', atomicNumber: 80, name: bi('汞', 'Mercury'), valences: [1, 2], dominant: 2, note: bi('汞在 Hg₂Cl₂ 中为 +1，常见为 +2。', 'Mercury is +1 in Hg₂Cl₂ and commonly +2.') },
] as const;

/**
 * Pauling 电负性（只覆盖本表元素）。
 *
 * 用途仅一个：判断二元化合物里谁是阴离子。化合价反推与自动命名都靠它
 * 给「另一种元素」限定符号，避免出现 FeCl₃ 中「Cl 取 +7、Fe 取 −21」
 * 这类数学上成立、化学上荒谬的解。
 */
export const ELECTRONEGATIVITY: Readonly<Record<string, number>> = {
  H: 2.2,
  C: 2.55,
  N: 3.04,
  O: 3.44,
  Na: 0.93,
  Mg: 1.31,
  Al: 1.61,
  Si: 1.9,
  P: 2.19,
  S: 2.58,
  Cl: 3.16,
  K: 0.82,
  Ca: 1.0,
  Mn: 1.55,
  Fe: 1.83,
  Cu: 1.9,
  Zn: 1.65,
  Ag: 1.93,
  Ba: 0.89,
  Hg: 2.0,
};

/** 取电负性；未知元素返回 undefined。 */
export function electronegativityOf(symbol: string): number | undefined {
  return ELECTRONEGATIVITY[symbol];
}

export const valenceElementBySymbol: ReadonlyMap<string, ValenceElement> = new Map(
  VALENCE_ELEMENTS.map((e) => [e.symbol, e]),
);

/** 化合价口诀（教材常用版本）。 */
export const VALENCE_MNEMONIC: Bi = bi(
  '一价钾钠氯氢银，二价氧钙钡镁锌；三铝四硅五价磷，二三铁、二四碳；二四六硫都齐全，铜汞二价最常见。',
  'K, Na, Cl, H, Ag: +1; O, Ca, Ba, Mg, Zn: +2; Al +3, Si +4, P +5; Fe 2/3, C 2/4; S 2/4/6; Cu and Hg are most often +2.',
);

/** 原子团（根）——初中阶段只要求这 7 个。 */
export const ION_GROUPS: readonly IonGroup[] = [
  { formula: 'OH', charge: -1, name: bi('氢氧根', 'Hydroxide'), mnemonic: bi('「氢氧根」带 1 个负电荷。', 'Hydroxide carries a single negative charge.') },
  { formula: 'NO3', charge: -1, name: bi('硝酸根', 'Nitrate'), mnemonic: bi('硝酸根 −1 价，写在括号里才乘个数。', 'Nitrate is −1; multiply the whole group inside brackets.') },
  { formula: 'SO4', charge: -2, name: bi('硫酸根', 'Sulfate'), mnemonic: bi('硫酸根 −2 价，和金属配对时常要括号。', 'Sulfate is −2; bracket it when it appears more than once.') },
  { formula: 'CO3', charge: -2, name: bi('碳酸根', 'Carbonate'), mnemonic: bi('碳酸根 −2 价，Na₂CO₃ 中只有一个。', 'Carbonate is −2; Na₂CO₃ has a single group.') },
  { formula: 'HCO3', charge: -1, name: bi('碳酸氢根', 'Hydrogen carbonate'), mnemonic: bi('碳酸氢根 −1 价，小苏打就是 NaHCO₃。', 'Hydrogen carbonate is −1 (baking soda, NaHCO₃).') },
  { formula: 'NH4', charge: 1, name: bi('铵根', 'Ammonium'), mnemonic: bi('铵根是唯一常见的带正电原子团。', 'Ammonium is the common positively charged group.') },
  { formula: 'PO4', charge: -3, name: bi('磷酸根', 'Phosphate'), mnemonic: bi('磷酸根 −3 价，Ca₃(PO₄)₂ 需要括号。', 'Phosphate is −3; Ca₃(PO₄)₂ needs brackets.') },
] as const;

export const ionGroupByFormula: ReadonlyMap<string, IonGroup> = new Map(
  ION_GROUPS.map((g) => [g.formula, g]),
);

/** 供解析器使用：按长度倒序，保证 HCO3 先于 CO3 命中。 */
export const ION_GROUP_KEYS: readonly string[] = ION_GROUPS.map((g) => g.formula).sort(
  (a, b) => b.length - a.length || a.localeCompare(b),
);

export interface TypicalCompound {
  formula: string;
  name: Bi;
  category: Bi;
  note?: Bi;
}

/** 速查模式里的常见物质库（不是穷举，只覆盖初中高频物质）。 */
export const TYPICAL_COMPOUNDS: readonly TypicalCompound[] = [
  { formula: 'H2O', name: bi('水', 'Water'), category: bi('氧化物', 'Oxide') },
  { formula: 'CO2', name: bi('二氧化碳', 'Carbon dioxide'), category: bi('氧化物', 'Oxide') },
  { formula: 'CO', name: bi('一氧化碳', 'Carbon monoxide'), category: bi('氧化物', 'Oxide') },
  { formula: 'CaO', name: bi('氧化钙', 'Calcium oxide'), category: bi('金属氧化物', 'Metal oxide') },
  { formula: 'MgO', name: bi('氧化镁', 'Magnesium oxide'), category: bi('金属氧化物', 'Metal oxide') },
  { formula: 'Al2O3', name: bi('氧化铝', 'Aluminium oxide'), category: bi('金属氧化物', 'Metal oxide') },
  { formula: 'Fe2O3', name: bi('氧化铁', 'Iron(III) oxide'), category: bi('金属氧化物', 'Metal oxide'), note: bi('铁显 +3 价，读「氧化铁」。', 'Iron is +3 here, hence iron(III) oxide.') },
  { formula: 'FeO', name: bi('氧化亚铁', 'Iron(II) oxide'), category: bi('金属氧化物', 'Metal oxide'), note: bi('铁显 +2 价，读「氧化亚铁」。', 'Iron is +2 here, hence iron(II) oxide.') },
  { formula: 'Fe3O4', name: bi('四氧化三铁', 'Iron(II,III) oxide'), category: bi('特殊氧化物', 'Mixed oxide'), note: bi('四氧化三铁可视为 FeO·Fe₂O₃，初中阶段不作单一整数化合价反推。', 'Fe₃O₄ can be viewed as FeO·Fe₂O₃; junior high does not solve it as one integer valence.') },
  { formula: 'CuO', name: bi('氧化铜', 'Copper(II) oxide'), category: bi('金属氧化物', 'Metal oxide') },
  { formula: 'Cu2O', name: bi('氧化亚铜', 'Copper(I) oxide'), category: bi('金属氧化物', 'Metal oxide'), note: bi('铜显 +1 价，读「氧化亚铜」。', 'Copper is +1 here, hence copper(I) oxide.') },
  { formula: 'SO2', name: bi('二氧化硫', 'Sulfur dioxide'), category: bi('非金属氧化物', 'Non-metal oxide') },
  { formula: 'SO3', name: bi('三氧化硫', 'Sulfur trioxide'), category: bi('非金属氧化物', 'Non-metal oxide') },
  { formula: 'P2O5', name: bi('五氧化二磷', 'Phosphorus pentoxide'), category: bi('非金属氧化物', 'Non-metal oxide') },
  { formula: 'NaCl', name: bi('氯化钠', 'Sodium chloride'), category: bi('盐', 'Salt') },
  { formula: 'KCl', name: bi('氯化钾', 'Potassium chloride'), category: bi('盐', 'Salt') },
  { formula: 'FeCl2', name: bi('氯化亚铁', 'Iron(II) chloride'), category: bi('盐', 'Salt') },
  { formula: 'FeCl3', name: bi('氯化铁', 'Iron(III) chloride'), category: bi('盐', 'Salt') },
  { formula: 'CaCO3', name: bi('碳酸钙', 'Calcium carbonate'), category: bi('盐', 'Salt') },
  { formula: 'Na2CO3', name: bi('碳酸钠', 'Sodium carbonate'), category: bi('盐', 'Salt') },
  { formula: 'NaHCO3', name: bi('碳酸氢钠', 'Sodium hydrogen carbonate'), category: bi('酸式盐', 'Acid salt') },
  { formula: 'NaOH', name: bi('氢氧化钠', 'Sodium hydroxide'), category: bi('碱', 'Base') },
  { formula: 'Ca(OH)2', name: bi('氢氧化钙', 'Calcium hydroxide'), category: bi('碱', 'Base') },
  { formula: 'Fe(OH)3', name: bi('氢氧化铁', 'Iron(III) hydroxide'), category: bi('碱', 'Base') },
  { formula: 'H2SO4', name: bi('硫酸', 'Sulfuric acid'), category: bi('酸', 'Acid') },
  { formula: 'HNO3', name: bi('硝酸', 'Nitric acid'), category: bi('酸', 'Acid') },
  { formula: 'H2CO3', name: bi('碳酸', 'Carbonic acid'), category: bi('酸', 'Acid') },
  { formula: 'NH4Cl', name: bi('氯化铵', 'Ammonium chloride'), category: bi('盐', 'Salt') },
  { formula: '(NH4)2SO4', name: bi('硫酸铵', 'Ammonium sulfate'), category: bi('盐', 'Salt') },
  { formula: 'KMnO4', name: bi('高锰酸钾', 'Potassium permanganate'), category: bi('盐', 'Salt'), note: bi('Mn 显 +7 价。', 'Mn is +7 here.') },
  { formula: 'K2MnO4', name: bi('锰酸钾', 'Potassium manganate'), category: bi('盐', 'Salt'), note: bi('Mn 显 +6 价。', 'Mn is +6 here.') },
  { formula: 'KClO3', name: bi('氯酸钾', 'Potassium chlorate'), category: bi('盐', 'Salt'), note: bi('Cl 显 +5 价。', 'Cl is +5 here.') },
  { formula: 'H2O2', name: bi('过氧化氢', 'Hydrogen peroxide'), category: bi('特殊氧化物', 'Special oxide'), note: bi('H₂O₂ 中氧显 −1 价，是化合价反推的经典特例。', 'Oxygen is −1 in H₂O₂ — a classic exception.') },
] as const;

/** 常见物质的稳定分类键：页面据此给每个类别一枚独立样式的 tag。 */
export type CompoundKind =
  | 'oxide'
  | 'metal-oxide'
  | 'nonmetal-oxide'
  | 'special-oxide'
  | 'salt'
  | 'acid-salt'
  | 'base'
  | 'acid';

/** 以中文标签为键：特殊氧化物在英文里同时出现 Mixed / Special oxide，不能按英文映射。 */
const COMPOUND_KIND_BY_ZH: Record<string, CompoundKind> = {
  氧化物: 'oxide',
  金属氧化物: 'metal-oxide',
  非金属氧化物: 'nonmetal-oxide',
  特殊氧化物: 'special-oxide',
  盐: 'salt',
  酸式盐: 'acid-salt',
  碱: 'base',
  酸: 'acid',
};

/** 返回 undefined 表示出现了未登记的新类别；调用方应回退为纯文本，而不是猜一个颜色。 */
export function compoundKind(category: Bi): CompoundKind | undefined {
  return COMPOUND_KIND_BY_ZH[category.zh];
}

/** 解析到真实周期表元素数据；解析不到时返回 undefined。 */
export function periodicElementOf(symbol: string): ElementInfo | undefined {
  const v = valenceElementBySymbol.get(symbol);
  if (!v) return undefined;
  return elementByNumber.get(v.atomicNumber) ?? ELEMENTS.find((e) => e.symbol === symbol);
}

/** 电子层排布的一句话机理（2-8-2 这类），用于速查详情。 */
export function shellMechanism(v: ValenceElement, lang: 'zh' | 'en'): string {
  const el = periodicElementOf(v.symbol);
  const shells = el ? el.shells.join('-') : '';
  const outer = el ? el.shells.at(-1) ?? 0 : 0;
  const d = v.dominant;
  const z = v.atomicNumber;
  const listed = v.valences.map((x) => (x > 0 ? `+${x}` : `−${Math.abs(x)}`)).join(' / ');
  // 过渡元素（第 3–12 列）：次外层 d 电子参与成键，最外层电子数推不出主导价态。
  // 这里必须与价态徽章使用同一口径，否则 Fe 卡片会一边写 +3、一边写「显 +2」。
  const group = el?.group;
  const isTransition = typeof group === 'number' && group >= 3 && group <= 12;
  if (isTransition) {
    return lang === 'zh'
      ? `电子层排布 ${shells}（Z = ${z}），过渡元素：次外层 d 电子参与成键，常见 ${listed} 价，不能只按最外层 ${outer} 个电子推断。`
      : `Shells ${shells} (Z = ${z}); a transition element: d electrons in the second-outermost shell take part in bonding, so ${listed} are common. Do not infer the valence from the ${outer} outermost electrons alone.`;
  }
  if (lang === 'zh') {
    if (v.symbol === 'H') {
      return `电子层排布 ${shells}（Z = ${z}），最外层 1 个电子：既可失去 1 个（H⁺），也可得到 1 个（H⁻）。`;
    }
    if (d > 0 && outer <= 3) {
      return `电子层排布 ${shells}（Z = ${z}），最外层 ${outer} 个电子，容易失去 ${outer} 个，显 +${outer} 价。`;
    }
    if (d < 0) {
      return `电子层排布 ${shells}（Z = ${z}），最外层 ${outer} 个电子，容易得到 ${8 - outer} 个，显 −${8 - outer} 价。`;
    }
    return `电子层排布 ${shells}（Z = ${z}），可形成 ${listed} 价。`;
  }
  if (v.symbol === 'H') {
    return `Shells ${shells} (Z = ${z}); one outermost electron can be lost (H⁺) or gained (H⁻).`;
  }
  if (d > 0 && outer <= 3) {
    return `Shells ${shells} (Z = ${z}); the outermost ${outer} electrons are easily lost, giving +${outer}.`;
  }
  if (d < 0) {
    return `Shells ${shells} (Z = ${z}); the outermost shell needs ${8 - outer} electrons, giving −${8 - outer}.`;
  }
  return `Shells ${shells} (Z = ${z}); it forms ${listed}.`;
}
