/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学式 → 中文 / 英文系统命名的确定性实现（纯 TS）。
 *
 * 覆盖初中教材的五类读法：
 *   1. 氧化物：氧化某 / 氧化亚某 / 二氧化某；
 *   2. 酸：硫酸、硝酸、碳酸、磷酸；
 *   3. 碱：氢氧化某 / 氢氧化亚某；
 *   4. 盐：某酸某、氯化某、硫化某；
 *   5. 铵盐：氯化铵、硫酸铵。
 *
 * 命名只依赖化学式本身与教材价态表，不查外部词表；特例（水、过氧化氢、
 * 四氧化三铁等）集中写在 SPECIAL_NAMES，便于审阅。
 */
import {
  atomCounts,
  isFormulaError,
  parseFormula,
  type GroupPart,
  type ParsedFormula,
} from './formula-core';
import { valenceElementBySymbol, type Bi } from './valency';

export interface CompoundName {
  zh: string;
  en: string;
  /** 命名规则的简短说明，用于结果区的「为什么这样读」。 */
  rule: Bi;
  note?: Bi;
}

const bi = (zh: string, en: string): Bi => ({ zh, en });

const ZH_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const EN_NUM = ['', 'mono', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca'];

const SPECIAL_NAMES: Record<string, CompoundName> = {
  H2O: {
    zh: '水',
    en: 'water',
    rule: bi('水的名称是约定俗成的，不按「氧化氢」读。', 'Water is a conventional name, not “hydrogen oxide”.'),
  },
  H2O2: {
    zh: '过氧化氢',
    en: 'hydrogen peroxide',
    rule: bi('过氧化物按「过氧化某」命名。', 'Peroxides use the “peroxide” prefix.'),
    note: bi('H₂O₂ 中氧为 −1 价。', 'Oxygen is −1 in H₂O₂.'),
  },
  NH3: {
    zh: '氨气',
    en: 'ammonia',
    rule: bi('氨是约定俗成的名称。', 'Ammonia is a conventional name.'),
  },
  CH4: {
    zh: '甲烷',
    en: 'methane',
    rule: bi('简单有机物用习惯名称。', 'Simple organic compounds use common names.'),
  },
  Fe3O4: {
    zh: '四氧化三铁',
    en: 'iron(II,III) oxide',
    rule: bi('混合价态氧化物按原子个数读作「四氧化三铁」。', 'A mixed-valence oxide is read from its atom counts.'),
    note: bi('可视为 FeO·Fe₂O₃，初中不作单一整数化合价反推。', 'It can be viewed as FeO·Fe₂O₃; junior high does not assign one integer valence.'),
  },
  CO: {
    zh: '一氧化碳',
    en: 'carbon monoxide',
    rule: bi('非金属氧化物按氧原子个数加数字前缀。', 'Non-metal oxides take a numeric prefix from the oxygen count.'),
  },
  CO2: {
    zh: '二氧化碳',
    en: 'carbon dioxide',
    rule: bi('非金属氧化物按氧原子个数加数字前缀。', 'Non-metal oxides take a numeric prefix from the oxygen count.'),
  },
  SO2: {
    zh: '二氧化硫',
    en: 'sulfur dioxide',
    rule: bi('非金属氧化物按氧原子个数加数字前缀。', 'Non-metal oxides take a numeric prefix from the oxygen count.'),
  },
  SO3: {
    zh: '三氧化硫',
    en: 'sulfur trioxide',
    rule: bi('非金属氧化物按氧原子个数加数字前缀。', 'Non-metal oxides take a numeric prefix from the oxygen count.'),
  },
  P2O5: {
    zh: '五氧化二磷',
    en: 'phosphorus pentoxide',
    rule: bi('非金属氧化物按氧原子个数加数字前缀。', 'Non-metal oxides take a numeric prefix from the oxygen count.'),
  },
  MnO2: {
    zh: '二氧化锰',
    en: 'manganese dioxide',
    rule: bi('金属氧化物中锰显 +4 时，按原子个数读「二氧化锰」。', 'Manganese at +4 is read as manganese dioxide from the atom counts.'),
  },
  SiO2: {
    zh: '二氧化硅',
    en: 'silicon dioxide',
    rule: bi('非金属氧化物按氧原子个数加数字前缀。', 'Non-metal oxides take a numeric prefix from the oxygen count.'),
  },
  KMnO4: {
    zh: '高锰酸钾',
    en: 'potassium permanganate',
    rule: bi('含氧酸盐按习惯名称读；Mn 为 +7。', 'Oxyacid salts use their conventional names; Mn is +7.'),
  },
  K2MnO4: {
    zh: '锰酸钾',
    en: 'potassium manganate',
    rule: bi('含氧酸盐按习惯名称读；Mn 为 +6。', 'Oxyacid salts use their conventional names; Mn is +6.'),
  },
  KClO3: {
    zh: '氯酸钾',
    en: 'potassium chlorate',
    rule: bi('含氧酸盐按习惯名称读；Cl 为 +5。', 'Oxyacid salts use their conventional names; Cl is +5.'),
  },
  NaClO: {
    zh: '次氯酸钠',
    en: 'sodium hypochlorite',
    rule: bi('含氧酸盐按习惯名称读；Cl 为 +1。', 'Oxyacid salts use their conventional names; Cl is +1.'),
  },
};

const ANION_ZH: Record<string, string> = {
  OH: '氢氧',
  NO3: '硝酸',
  SO4: '硫酸',
  CO3: '碳酸',
  HCO3: '碳酸氢',
  PO4: '磷酸',
  Cl: '氯化',
  S: '硫化',
  N: '氮化',
  P: '磷化',
  O: '氧化',
};

const ANION_EN: Record<string, string> = {
  OH: 'hydroxide',
  NO3: 'nitrate',
  SO4: 'sulfate',
  CO3: 'carbonate',
  HCO3: 'hydrogen carbonate',
  PO4: 'phosphate',
  Cl: 'chloride',
  S: 'sulfide',
  N: 'nitride',
  P: 'phosphide',
  O: 'oxide',
};

const RULE_ZH: Record<string, Bi> = {
  OH: bi('碱读作「氢氧化某」；变价金属低价加「亚」。', 'Bases read “metal hydroxide”; the lower valence uses the “-ous”/Chinese 亚 prefix.'),
  NO3: bi('盐读作「硝酸某」。', 'Salts read “metal nitrate”.'),
  SO4: bi('盐读作「硫酸某」。', 'Salts read “metal sulfate”.'),
  CO3: bi('盐读作「碳酸某」。', 'Salts read “metal carbonate”.'),
  HCO3: bi('酸式盐读作「碳酸氢某」。', 'Acid salts read “metal hydrogen carbonate”.'),
  PO4: bi('盐读作「磷酸某」。', 'Salts read “metal phosphate”.'),
  Cl: bi('无氧盐读作「氯化某」；变价金属低价加「亚」。', 'Binary salts read “metal chloride”; the lower valence gets the Chinese 亚 prefix.'),
  S: bi('无氧盐读作「硫化某」。', 'Binary salts read “metal sulfide”.'),
  N: bi('无氧盐读作「氮化某」。', 'Binary salts read “metal nitride”.'),
  P: bi('无氧盐读作「磷化某」。', 'Binary salts read “metal phosphide”.'),
  O: bi('氧化物读作「氧化某」；变价金属低价加「亚」。', 'Oxides read “metal oxide”; the lower valence gets the Chinese 亚 prefix.'),
};

/** 无氧酸（氢 + 非金属）的习惯名称；不在表内就不臆造「某酸」。 */
const BINARY_ACIDS: Record<string, CompoundName> = {
  Cl: {
    zh: '盐酸（氯化氢）',
    en: 'hydrochloric acid',
    rule: bi('无氧酸按「氢某酸」或习惯名称读取。', 'Binary acids use “hydro...ic acid” or a conventional name.'),
    note: bi('HCl 的水溶液叫盐酸，气体叫氯化氢。', 'HCl in water is hydrochloric acid; the gas is hydrogen chloride.'),
  },
  S: {
    zh: '氢硫酸',
    en: 'hydrosulfuric acid',
    rule: bi('无氧酸按「氢某酸」读取。', 'Binary acids read “hydro...ic acid”.'),
    note: bi('H₂S 的水溶液称为氢硫酸。', 'Aqueous H₂S is called hydrosulfuric acid.'),
  },
  P: {
    zh: '磷化氢',
    en: 'phosphine',
    rule: bi('PH₃ 是气体，习惯称磷化氢。', 'PH₃ is a gas commonly called phosphine.'),
  },
  N: {
    zh: '氨气',
    en: 'ammonia',
    rule: bi('NH₃ 是约定俗成的名称。', 'Ammonia is a conventional name.'),
  },
};

/** 含氧酸的名称；与 BINARY_ACIDS 合起来覆盖初中要求识别的酸。 */
const OXY_ACIDS: Record<string, CompoundName> = {
  SO4: {
    zh: '硫酸',
    en: 'sulfuric acid',
    rule: bi('酸读作「某酸」，氢写在最前面。', 'Acids read “...ic acid”.'),
  },
  NO3: {
    zh: '硝酸',
    en: 'nitric acid',
    rule: bi('酸读作「某酸」，氢写在最前面。', 'Acids read “...ic acid”.'),
  },
  CO3: {
    zh: '碳酸',
    en: 'carbonic acid',
    rule: bi('酸读作「某酸」，氢写在最前面。', 'Acids read “...ic acid”.'),
  },
  PO4: {
    zh: '磷酸',
    en: 'phosphoric acid',
    rule: bi('酸读作「某酸」，氢写在最前面。', 'Acids read “...ic acid”.'),
  },
};

/** 单原子阴离子的电荷：优先取主要负价，否则取第一个负价；没有负价返回 null。 */
function anionChargeOf(entry: { valences: readonly number[]; dominant: number }): number | null {
  if (entry.dominant < 0) return entry.dominant;
  return entry.valences.find((v) => v < 0) ?? null;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function roman(n: number): string {
  return ROMAN[n] ?? String(n);
}

interface Cation {
  zh: string;
  en: string;
  /** 变价元素的英文 Stock 括号，如 iron(III)。 */
  enStock: string;
  valence: number;
  isHydrogen: boolean;
}

interface Anion {
  /** 原子团化学式，或单原子符号（O / Cl / S）。 */
  key: string;
  zhBase: string;
  enBase: string;
  charge: number;
  count: number;
}

/** 从化学式里分离出一个阳离子部分 + 一个阴离子部分；分离不了返回 null。 */
function splitBinary(parsed: ParsedFormula): { cationSymbol: string; cationCount: number; anion: Anion } | null {
  const elements = parsed.parts.filter((p) => p.kind === 'element');
  const groups = parsed.parts.filter((p): p is GroupPart => p.kind === 'group');

  // 铵盐 / 碱：一个 NH4 或 OH 原子团 + 一个元素。
  if (groups.length === 1 && elements.length === 1) {
    const group = groups[0];
    const el = elements[0];
    if (group.ion.formula === 'NH4') {
      const anionEl = valenceElementBySymbol.get(el.symbol);
      if (!anionEl) return null;
      const charge = anionChargeOf(anionEl);
      if (charge === null || !ANION_ZH[el.symbol]) return null;
      return {
        cationSymbol: 'NH4',
        cationCount: group.count,
        anion: {
          key: el.symbol,
          zhBase: ANION_ZH[el.symbol],
          enBase: ANION_EN[el.symbol],
          charge,
          count: el.count,
        },
      };
    }
    return {
      cationSymbol: el.symbol,
      cationCount: el.count,
      anion: {
        key: group.ion.formula,
        zhBase: ANION_ZH[group.ion.formula] ?? group.ion.name.zh.replace(/根$/, ''),
        enBase: ANION_EN[group.ion.formula] ?? group.ion.name.en.toLowerCase(),
        charge: group.ion.charge,
        count: group.count,
      },
    };
  }

  // 铵盐：NH4 与含氧酸根，如 NH4NO3、(NH4)2SO4。
  if (groups.length === 2) {
    const ammonium = groups.find((g) => g.ion.formula === 'NH4');
    const other = groups.find((g) => g.ion.formula !== 'NH4');
    if (ammonium && other) {
      return {
        cationSymbol: 'NH4',
        cationCount: ammonium.count,
        anion: {
          key: other.ion.formula,
          zhBase: ANION_ZH[other.ion.formula] ?? other.ion.name.zh.replace(/根$/, ''),
          enBase: ANION_EN[other.ion.formula] ?? other.ion.name.en.toLowerCase(),
          charge: other.ion.charge,
          count: other.count,
        },
      };
    }
  }

  // 二元化合物：一个金属/氢 + 一个非金属。
  // 两个非金属（Cl₂O、N₂O₅…）不按盐命名，交给后面的非金属氧化物分支。
  if (!groups.length && elements.length === 2) {
    const [a, b] = elements;
    const aEl = valenceElementBySymbol.get(a.symbol);
    const bEl = valenceElementBySymbol.get(b.symbol);
    if (!aEl || !bEl) return null;
    // 氢化物按习惯命名（H₂S、PH₃）：只要另一元素能显负价，就把 H 当阳离子。
    let cationPart: typeof a | null;
    if (a.symbol === 'H' && anionChargeOf(bEl) !== null) {
      cationPart = a;
    } else if (b.symbol === 'H' && anionChargeOf(aEl) !== null) {
      cationPart = b;
    } else if (aEl.dominant > 0 && anionChargeOf(bEl) !== null) {
      cationPart = a;
    } else if (bEl.dominant > 0 && anionChargeOf(aEl) !== null) {
      cationPart = b;
    } else {
      cationPart = null;
    }
    if (!cationPart) return null;
    const anionPart = cationPart === a ? b : a;
    const anionEl = valenceElementBySymbol.get(anionPart.symbol);
    if (!anionEl) return null;
    const charge = anionChargeOf(anionEl);
    if (charge === null || !ANION_ZH[anionPart.symbol]) return null;
    return {
      cationSymbol: cationPart.symbol,
      cationCount: cationPart.count,
      anion: {
        key: anionPart.symbol,
        zhBase: ANION_ZH[anionPart.symbol],
        enBase: ANION_EN[anionPart.symbol],
        charge,
        count: anionPart.count,
      },
    };
  }

  return null;
}

function cationFrom(symbol: string, count: number, anion: Anion): Cation | null {
  if (symbol === 'NH4') {
    return { zh: '铵', en: 'ammonium', enStock: 'ammonium', valence: 1, isHydrogen: false };
  }
  const el = valenceElementBySymbol.get(symbol);
  if (!el) return null;
  const valence = Math.abs((anion.charge * anion.count) / count);
  if (!Number.isInteger(valence) || !el.valences.includes(valence)) return null;
  const variable = el.valences.length > 1;
  const lower = Math.min(...el.valences);
  const useOus = variable && valence === lower && valence > 0;
  const zh = useOus ? `亚${el.name.zh}` : el.name.zh;
  return {
    zh,
    en: el.name.en.toLowerCase(),
    enStock: variable ? `${el.name.en.toLowerCase()}(${roman(valence)})` : el.name.en.toLowerCase(),
    valence,
    isHydrogen: symbol === 'H',
  };
}

function isAcid(cation: Cation): boolean {
  return cation.isHydrogen;
}

export function nameCompound(raw: string): CompoundName | { error: string } {
  const parsed = parseFormula(raw);
  if (isFormulaError(parsed)) return parsed;

  const special = SPECIAL_NAMES[parsed.raw];
  if (special) return special;

  const split = splitBinary(parsed);
  if (split) {
    const cation = cationFrom(split.cationSymbol, split.cationCount, split.anion);
    if (!cation) return { error: `${parsed.raw} 的阳离子无法识别` };
    const { anion } = split;
    const rule = RULE_ZH[anion.key] ?? bi('按「某化某」读取。', 'Read as “metal + anion”.');

    if (isAcid(cation)) {
      const acid = OXY_ACIDS[anion.key] ?? BINARY_ACIDS[anion.key];
      if (!acid) {
        return { error: `暂不支持 ${parsed.raw} 的酸命名` };
      }
      return acid;
    }

    const zh = `${anion.zhBase}${anion.zhBase.endsWith('化') || anion.zhBase.endsWith('酸') || anion.zhBase.startsWith('碳酸氢') ? '' : '化'}${cation.zh}`;
    const en = `${cation.enStock} ${anion.enBase}`;
    const note =
      split.cationSymbol === 'NH4' && anion.key === 'OH'
        ? bi(
            'NH₄OH 只是氨水的简写，通常不把它当作独立存在、可分离的碱。',
            'NH₄OH is shorthand for ammonia water, not a separately isolated base.',
          )
        : undefined;
    return { zh, en, rule, note };
  }

  // 非金属氧化物：按氧原子个数读，如 CO₂ → 二氧化碳。
  const counts = atomCounts(parsed);
  if (counts.size === 2 && counts.has('O')) {
    const other = [...counts.keys()].find((s) => s !== 'O');
    if (other) {
      const oCount = counts.get('O') ?? 0;
      const otherCount = counts.get(other) ?? 0;
      const otherEl = valenceElementBySymbol.get(other);
      const otherZh = otherEl?.name.zh ?? other;
      const otherEn = otherEl?.name.en.toLowerCase() ?? other;
      const zh = `${ZH_NUM[oCount] ?? oCount}氧化${otherCount > 1 ? `${ZH_NUM[otherCount] ?? otherCount}` : ''}${otherZh}`;
      const en = `${EN_NUM[otherCount] ?? otherCount}${otherEn} ${EN_NUM[oCount] ?? oCount}oxide`
        .replace('monooxide', 'monoxide')
        .replace('pentaoxide', 'pentoxide')
        .replace('tetraoxide', 'tetroxide')
        .replace('hexaoxide', 'hexoxide')
        .replace('heptaoxide', 'heptoxide')
        .replace('octaoxide', 'octoxide')
        .replace('nonaoxide', 'nonoxide')
        .replace('decaoxide', 'decoxide');
      return {
        zh,
        en: en.replace(/\s+/g, ' ').trim(),
        rule: bi('非金属氧化物按氧原子个数加数字前缀。', 'Non-metal oxides take numeric prefixes from their atom counts.'),
      };
    }
  }

  return { error: `暂不支持 ${parsed.raw} 的自动命名` };
}

/** 语音朗读用：去掉括号与下标数字的可读名。 */
export function spokenName(raw: string, lang: 'zh' | 'en' = 'zh'): string {
  const named = nameCompound(raw);
  if ('error' in named) return raw;
  return lang === 'zh' ? named.zh : named.en;
}
