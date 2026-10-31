/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学式与化合价确定性内核（纯 TS，零 React / DOM / WASM）。
 *
 * 设计原则（2026-10-30 拍板）：
 *   - 只用整数运算（gcd / lcm）做十字交叉与约简，不引入浮点误差；
 *   - 解析器识别 7 个教材原子团与括号倍数，所有原子个数可追溯；
 *   - 求化合价用「代数式总和 = 0」反推；变价元素枚举候选价态，只接受整数解；
 *   - 练习题、选项、干扰项与错因全部由固定题库生成，无随机数，
 *     同一输入永远得到同一输出，便于测试与 GEO 静态化。
 *
 * 本文件不声称存在 C++/WASM 计算核——它就是 TS 内核本身。
 */
import {
  ION_GROUP_KEYS,
  ION_GROUPS,
  TEXTBOOK_MASSES,
  TYPICAL_COMPOUNDS,
  ionGroupByFormula,
  valenceElementBySymbol,
  electronegativityOf,
  type Bi,
  type IonGroup,
} from './valency';
import { ELEMENTS } from '../elements';

export interface ElementPart {
  kind: 'element';
  symbol: string;
  count: number;
}

export interface GroupPart {
  kind: 'group';
  ion: IonGroup;
  count: number;
}

export type FormulaPart = ElementPart | GroupPart;

export interface ParsedFormula {
  raw: string;
  parts: FormulaPart[];
}

export interface FormulaError {
  /** 中文错误信息（保留该字段以兼容既有调用方）。 */
  error: string;
  /** 英文错误信息；缺省时调用方回退到 `error`。 */
  errorEn?: string;
}

const formulaError = (zh: string, en: string): FormulaError => ({ error: zh, errorEn: en });

const bi = (zh: string, en: string): Bi => ({ zh, en });

export const isFormulaError = (value: unknown): value is FormulaError =>
  typeof value === 'object' && value !== null && 'error' in value;

/** 最大公约数（正整数）。 */
export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

/** 最小公倍数（正整数）。 */
export function lcm(a: number, b: number): number {
  return Math.abs(Math.trunc(a) * Math.trunc(b)) / gcd(a, b);
}

const SUBSCRIPT_DIGITS: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
};

/** 大小写不敏感地还原元素符号与原子团的规范写法。 */
const CANON_BY_LOWER = new Map<string, string>();
for (const symbol of Object.keys(TEXTBOOK_MASSES)) CANON_BY_LOWER.set(symbol.toLowerCase(), symbol);
for (const key of ION_GROUP_KEYS) CANON_BY_LOWER.set(key.toLowerCase(), key);
const CANON_MAX_LEN = Math.max(...[...CANON_BY_LOWER.keys()].map((k) => k.length));

/**
 * 把中文排版里的下标数字、空格与中点统一成解析器可读的 ASCII，
 * 并把 `fe2o3` / `ca(oh)2` 这类小写输入还原成规范元素符号。
 *
 * 只按已知元素符号与 7 个原子团做最长匹配，不做任意首字母大写：
 * 否则 `Na` 的第二个字母会被改坏。未知片段原样保留，交给解析器报错。
 */
export function normalizeFormula(raw: string): string {
  const typographic = raw
    .trim()
    .replace(/[₀-₉]/g, (c) => SUBSCRIPT_DIGITS[c] ?? c)
    .replace(/\s+/g, '')
    .replace(/[·•]/g, '·');

  let out = '';
  let i = 0;
  while (i < typographic.length) {
    if (!/[A-Za-z]/.test(typographic[i])) {
      out += typographic[i];
      i += 1;
      continue;
    }
    let matched = false;
    for (let len = Math.min(CANON_MAX_LEN, typographic.length - i); len >= 1; len -= 1) {
      const canonical = CANON_BY_LOWER.get(typographic.slice(i, i + len).toLowerCase());
      if (!canonical) continue;
      out += canonical;
      i += len;
      matched = true;
      break;
    }
    if (!matched) {
      out += typographic[i];
      i += 1;
    }
  }
  return out;
}

/** 元素周期表全集（含 Cs / Hf 等初中不常考但要能正确大写化的符号）。 */
const ELEMENT_SYMBOLS = new Set(ELEMENTS.map((e) => e.symbol));

/**
 * 常见化学式/原子团真值表（用于消歧：优先认「人熟悉的分子」而非生僻单质）。
 * 来源：初中常见化合物库 + 教材常见酸碱 + 原子团。
 */
const KNOWN_FORMULAS: ReadonlySet<string> = (() => {
  const set = new Set<string>();
  for (const c of TYPICAL_COMPOUNDS) set.add(c.formula);
  for (const g of ION_GROUPS) set.add(g.formula);
  for (const f of [
    'H2O', 'H2O2', 'CO', 'CO2', 'NO', 'NO2', 'NO3', 'SO2', 'SO3', 'NH3', 'CH4',
    'HF', 'HCl', 'H2SO4', 'HNO3', 'H2CO3', 'NH4NO3', 'KMnO4', 'K2MnO4', 'KClO3',
    'Fe2O3', 'Fe3O4', 'CuO', 'Cu(OH)2', 'Fe(OH)3', 'Al2O3', 'Ca(OH)2', 'NaOH',
  ]) set.add(f);
  return set;
})();

/** 歧义输入：既可读作双字母元素、也可读作「两个单字母元素组成的常见分子」。 */
export const AMBIGUOUS_PAIRS = new Set(['co', 'no', 'cs', 'hf']);

/** 贪婪元素分词（双字母优先 + 元素表校验），只做大写规范化，不改数字/括号/下标。 */
function greedyElementCase(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (!/[A-Za-z]/.test(ch)) {
      out += ch;
      i += 1;
      continue;
    }
    if (i + 1 < src.length && /[A-Za-z]/.test(src[i + 1])) {
      const two = src[i].toUpperCase() + src[i + 1].toLowerCase();
      if (ELEMENT_SYMBOLS.has(two)) {
        out += two;
        i += 2;
        continue;
      }
    }
    const one = ch.toUpperCase();
    if (ELEMENT_SYMBOLS.has(one)) {
      out += one;
      i += 1;
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

/**
 * 化学式大小写智能规范化（供失焦/回车/解析时调用，不在 onChange 实时强转）。
 *
 * 策略：
 *   1. 先查常见化学式真值表（忽略大小写全等）——`co2 → CO2`、`nh4no3 → NH4NO3`、
 *      `cu(oh)2 → Cu(OH)2` 等直接命中教材写法；
 *   2. 未命中则贪婪分词：双字母元素优先（`fe→Fe`、`na→Na`、`cl→Cl`），
 *      再退回单字母（`h→H`、`o→O`），数字/括号/· 原样保留；
 *   3. `mode='element'` 时跳过真值表、只按元素分词——用于给出「歧义切换」的备选答案
 *      （如 `co` 默认 `CO`，备选 `Co`）。
 */
export function normalizeFormulaCase(raw: string, mode: 'compound' | 'element' = 'compound'): string {
  const src = raw.trim();
  if (!src) return '';
  if (mode === 'compound') {
    const lower = src.toLowerCase();
    for (const f of KNOWN_FORMULAS) {
      if (f.toLowerCase() === lower) return f;
    }
  }
  return greedyElementCase(src);
}

function readCount(src: string, start: number): { count: number; next: number } {
  let i = start;
  while (i < src.length && /[0-9]/.test(src[i])) i += 1;
  if (i === start) return { count: 1, next: start };
  return { count: Number(src.slice(start, i)), next: i };
}

function symbolKnown(symbol: string): boolean {
  return symbol in TEXTBOOK_MASSES;
}

/** 解析化学式。失败时返回 `{ error }`，不抛异常，便于 UI 直接展示。 */
export function parseFormula(raw: string, allowIons = true): ParsedFormula | FormulaError {
  const src = normalizeFormula(raw);
  if (!src) return formulaError('化学式为空', 'The formula is empty.');
  if (src.includes('·')) {
    return formulaError('暂不支持含结晶水的化学式', 'Hydrated formulas with crystal water are not supported yet.');
  }

  const parts: FormulaPart[] = [];
  let i = 0;

  const readGroup = (): boolean => {
    if (src[i] !== '(') return false;
    const close = src.indexOf(')', i + 1);
    if (close < 0) return false;
    const inner = src.slice(i + 1, close);
    const ion = ionGroupByFormula.get(inner);
    if (!ion) return false;
    const { count, next } = readCount(src, close + 1);
    parts.push({ kind: 'group', ion, count });
    i = next;
    return true;
  };

  while (i < src.length) {
    if (allowIons && readGroup()) continue;

    const ch = src[i];
    if (!/[A-Z]/.test(ch)) {
      return formulaError(
        `无法识别的字符「${ch}」`,
        `Unrecognised character “${ch}”.`,
      );
    }

    // 原子团优先：HCO3 必须比 CO3 先命中，因此按键长倒序匹配。
    const ionKey = allowIons ? ION_GROUP_KEYS.find((key) => src.startsWith(key, i)) : undefined;
    if (ionKey) {
      const ion = ionGroupByFormula.get(ionKey);
      if (!ion) return formulaError(`未知原子团 ${ionKey}`, `Unknown polyatomic ion ${ionKey}.`);
      const { count, next } = readCount(src, i + ionKey.length);
      parts.push({ kind: 'group', ion, count });
      i = next;
      continue;
    }

    const match = /^[A-Z][a-z]?/.exec(src.slice(i));
    if (!match) {
      return formulaError(`无法识别的元素符号（位置 ${i + 1}）`, `Unrecognised element symbol at position ${i + 1}.`);
    }
    const symbol = match[0];
    if (!symbolKnown(symbol)) {
      return formulaError(`数据表中没有元素「${symbol}」`, `Element “${symbol}” is not in the data table.`);
    }
    const { count, next } = readCount(src, i + symbol.length);
    parts.push({ kind: 'element', symbol, count });
    i = next;
  }

  if (!parts.length) return formulaError('化学式为空', 'The formula is empty.');
  return { raw: src, parts };
}

/** 原子个数表（元素 → 总个数），原子团会展开。 */
export function atomCounts(parsed: ParsedFormula): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (symbol: string, n: number) => {
    counts.set(symbol, (counts.get(symbol) ?? 0) + n);
  };
  for (const part of parsed.parts) {
    if (part.kind === 'element') {
      add(part.symbol, part.count);
      continue;
    }
    const inner = parseFormula(part.ion.formula, false);
    if (isFormulaError(inner)) continue;
    for (const [symbol, n] of atomCounts(inner)) add(symbol, n * part.count);
  }
  return counts;
}

/** 相对分子质量（按初中取整口径）。含未知元素时返回 null。 */
export function molarMass(formula: string | ParsedFormula): number | null {
  const parsed = typeof formula === 'string' ? parseFormula(formula) : formula;
  if (isFormulaError(parsed)) return null;
  let total = 0;
  for (const [symbol, n] of atomCounts(parsed)) {
    const mass = TEXTBOOK_MASSES[symbol];
    if (mass === undefined) return null;
    total += mass * n;
  }
  return Math.round(total * 100) / 100;
}

/** 质量分数（0–1）。元素不存在时返回 null。 */
export function massFraction(formula: string, symbol: string): number | null {
  const parsed = parseFormula(formula);
  if (isFormulaError(parsed)) return null;
  const total = molarMass(parsed);
  if (total === null || total === 0) return null;
  const count = atomCounts(parsed).get(symbol) ?? 0;
  const mass = TEXTBOOK_MASSES[symbol];
  if (!count || mass === undefined) return null;
  return (mass * count) / total;
}

export const formatNumber = (n: number, digits = 2): string => {
  const fixed = n.toFixed(digits);
  return fixed.replace(/\.?0+$/, '') || '0';
};

export const formatMass = (n: number): string => formatNumber(n, 2);

export const formatValence = (v: number): string =>
  v === 0 ? '0' : v > 0 ? `+${v}` : `−${Math.abs(v)}`;

/** 原子团书写：个数 > 1 才加括号。 */
export function speciesFormula(formula: string, count: number): string {
  if (count === 1) return formula;
  return ionGroupByFormula.has(formula) ? `(${formula})${count}` : `${formula}${count}`;
}

export interface CrossStep {
  title: Bi;
  detail: Bi;
}

export interface CrossResult {
  cation: string;
  anion: string;
  cationCharge: number;
  anionCharge: number;
  cationCount: number;
  anionCount: number;
  divisor: number;
  formula: string;
  steps: CrossStep[];
}

/**
 * 十字交叉法：阳离子 +a、阴离子 −b。
 * 个数取 b : a，再除以 gcd 约简；原子团个数 > 1 自动加括号。
 */
export function crossValence(
  cation: string,
  anion: string,
  cationOverride?: number,
  anionOverride?: number,
): CrossResult | FormulaError {
  const cationCharge =
    cationOverride ?? valenceElementBySymbol.get(cation)?.dominant ?? ionGroupByFormula.get(cation)?.charge;
  const anionCharge =
    anionOverride ?? ionGroupByFormula.get(anion)?.charge ?? valenceElementBySymbol.get(anion)?.dominant;

  if (cationCharge === undefined || cationCharge <= 0) {
    return { error: `「${cation}」不是可用的阳离子` };
  }
  if (anionCharge === undefined || anionCharge >= 0) {
    return { error: `「${anion}」不是可用的阴离子` };
  }

  const absCation = Math.abs(cationCharge);
  const absAnion = Math.abs(anionCharge);
  const divisor = gcd(absCation, absAnion);
  const cationCount = absAnion / divisor;
  const anionCount = absCation / divisor;
  const formula = `${speciesFormula(cation, cationCount)}${speciesFormula(anion, anionCount)}`;

  return {
    cation,
    anion,
    cationCharge,
    anionCharge,
    cationCount,
    anionCount,
    divisor,
    formula,
    steps: [
      {
        title: bi('① 标价', '1 · Valences'),
        detail: bi(
          `阳离子 ${cation} 为 ${formatValence(cationCharge)}，阴离子 ${anion} 为 ${formatValence(anionCharge)}。`,
          `${cation} is ${formatValence(cationCharge)}; ${anion} is ${formatValence(anionCharge)}.`,
        ),
      },
      {
        title: bi('② 交叉', '2 · Cross'),
        detail: bi(
          `把价数交叉写到对方右下角：${cation} 取 ${absAnion}，${anion} 取 ${absCation}。`,
          `Swap the magnitudes into the subscripts: ${cation} gets ${absAnion}, ${anion} gets ${absCation}.`,
        ),
      },
      {
        title: bi('③ 约简', '3 · Reduce'),
        detail: bi(
          divisor > 1
            ? `${absCation} 与 ${absAnion} 的最大公因数是 ${divisor}，同时除以 ${divisor}，得到 ${cationCount} : ${anionCount}。`
            : `${absCation} 与 ${absAnion} 互质，已是最简整数比 ${cationCount} : ${anionCount}。`,
          divisor > 1
            ? `gcd(${absCation}, ${absAnion}) = ${divisor}; divide both, giving ${cationCount} : ${anionCount}.`
            : `${absCation} and ${absAnion} are coprime; the simplest ratio is ${cationCount} : ${anionCount}.`,
        ),
      },
      {
        title: bi('④ 加括号与检验', '4 · Brackets and check'),
        detail: bi(
          `原子团个数大于 1 时加括号；检查 ${cationCount}×(${formatValence(cationCharge)}) + ${anionCount}×(${formatValence(anionCharge)}) = 0，化学式为 ${formula}。`,
          `Bracket a polyatomic ion when its count exceeds 1; ${cationCount}×(${formatValence(cationCharge)}) + ${anionCount}×(${formatValence(anionCharge)}) = 0, so the formula is ${formula}.`,
        ),
      },
    ],
  };
}

export interface ValenceAnswer {
  valence: number;
  /** 解的是哪个位置的该元素（同一化学式里可能出现在不同原子团）。 */
  scope: Bi;
  derivation: Bi;
}

export interface SolveResult {
  formula: string;
  target: string;
  answers: ValenceAnswer[];
  note?: Bi;
}

/** 教材特例：普通代数式无法直接给出单一整数解。 */
const SPECIAL_SOLVES: Record<string, SolveResult> = {
  Fe3O4: {
    formula: 'Fe3O4',
    target: 'Fe',
    answers: [],
    note: bi(
      '四氧化三铁可视为 FeO·Fe₂O₃ 的复合氧化物，初中阶段不作单一整数化合价反推。',
      'Fe₃O₄ can be viewed as the composite oxide FeO·Fe₂O₃; junior high does not solve it as a single integer valence.',
    ),
  },
};

interface Combo {
  valences: Map<string, number>;
}

function* combinations(
  symbols: string[],
  index: number,
  acc: Map<string, number>,
  candidatesOf: (symbol: string) => readonly number[],
): Generator<Combo> {
  if (index >= symbols.length) {
    yield { valences: new Map(acc) };
    return;
  }
  const symbol = symbols[index];
  for (const v of candidatesOf(symbol)) {
    acc.set(symbol, v);
    yield* combinations(symbols, index + 1, acc, candidatesOf);
    acc.delete(symbol);
  }
}

/** 二元体系里电负性最大的元素是阴离子；其余元素按阳离子（正价）枚举。 */
function anionSymbolOf(symbols: readonly string[]): string | null {
  let best: string | null = null;
  let bestEn = -Infinity;
  for (const symbol of symbols) {
    const en = electronegativityOf(symbol) ?? -Infinity;
    if (en > bestEn) {
      best = symbol;
      bestEn = en;
    }
  }
  return best;
}

/**
 * 由化学式反推某元素的化合价。
 *
 * 候选枚举遵守两条化学约束，而不是只做「代数和为 0」的数学题：
 *   1. 电负性最大的元素只取负价（阴离子位），其余元素只取正价；
 *   2. 目标元素的解必须符合它在体系中的角色（阴离子解 ≤ 0，阳离子解 ≥ 0），
 *      并排除 |x| > 8 的非教材答案。
 * 教材中只出现单一价态的元素（H、O、Na、K 等）直接按价态表给出；
 * H₂O₂ 中的氧是明确写进教材的特例，仍走代数反推得到 −1。
 *
 * 支持三类情形：
 *   1. 目标元素以单原子形式出现：枚举其它元素的教材价态，取整数解；
 *   2. 目标元素只出现在原子团内（如 NH₄NO₃ 中的 N）：按原子团电荷分别反推；
 *   3. 教材特例（Fe₃O₄、H₂O₂）：返回说明而不是臆造整数。
 */
export function solveValence(formula: string, target: string): SolveResult | FormulaError {
  const parsed = parseFormula(formula);
  if (isFormulaError(parsed)) return parsed;

  const exactFormula = parsed.raw;
  const special = SPECIAL_SOLVES[exactFormula];
  if (special && special.target === target) {
    return { ...special, target, answers: [] };
  }

  const counts = atomCounts(parsed);
  const targetCount = counts.get(target) ?? 0;
  if (!targetCount) {
    return formulaError(
      `${formula} 中找不到元素 ${target}`,
      `Element ${target} does not appear in ${formula}.`,
    );
  }

  // 单质：化合价为 0，不能再套「正负代数和」。
  if (counts.size === 1) {
    return {
      formula,
      target,
      answers: [
        {
          valence: 0,
          scope: bi(`${formula} 中的 ${target}`, `${target} in ${formula}`),
          derivation: bi(
            `${formula} 是单质，元素在单质中的化合价为 0。`,
            `${formula} is an element; an element in its free state has valence 0.`,
          ),
        },
      ],
    };
  }

  const targetEntry = valenceElementBySymbol.get(target);
  const answers: ValenceAnswer[] = [];
  const notes: Bi[] = [];
  const isPeroxideOxygen = exactFormula === 'H2O2' && target === 'O';

  // 教材只给出单一价态的元素（H、O、Na、K…）：直接按表回答。
  // H₂O₂ 的氧例外，留给代数反推得到 −1。
  if (targetEntry && targetEntry.valences.length === 1 && !isPeroxideOxygen) {
    const valence = targetEntry.valences[0];
    answers.push({
      valence,
      scope: bi(`${formula} 中的 ${target}`, `${target} in ${formula}`),
      derivation: bi(
        `按教材价态表，${target} 通常只显 ${formatValence(valence)} 价。`,
        `The textbook valence table lists ${formatValence(valence)} as the only common valence for ${target}.`,
      ),
    });
    if (exactFormula === 'Fe3O4') {
      notes.push(
        bi(
          '四氧化三铁中铁为 +2 / +3 混合价态；氧仍按 −2 价计。',
          'Iron is mixed +2/+3 in Fe₃O₄, while oxygen is still counted as −2.',
        ),
      );
    }
  } else {
    const elementParts = parsed.parts.filter((p): p is ElementPart => p.kind === 'element');
    const elementSymbols = [...new Set(elementParts.map((p) => p.symbol))];
    const groupParts = parsed.parts.filter(
      (p): p is GroupPart => p.kind === 'group' && p.ion.formula.includes(target),
    );

    if (elementParts.some((p) => p.symbol === target)) {
      const anionSymbol = anionSymbolOf(elementSymbols);
      const targetIsAnion = anionSymbol === target;
      const otherSymbols = elementSymbols.filter((s) => s !== target);
      const groupCharge = parsed.parts.reduce((sum, p) => {
        return p.kind === 'group' ? sum + p.ion.charge * p.count : sum;
      }, 0);

      // 阴离子位只枚举负价，阳离子位只枚举正价——这一步排除
      // FeCl₃ 中「Cl = +7，Fe = −21」这类数学成立但化学荒谬的组合。
      const candidatesOf = (symbol: string): readonly number[] => {
        const entry = valenceElementBySymbol.get(symbol);
        if (!entry) return [];
        const wantNegative = symbol === anionSymbol;
        return entry.valences.filter((v) => (wantNegative ? v <= 0 : v >= 0));
      };

      const seen = new Set<number>();
      for (const combo of combinations(otherSymbols, 0, new Map(), candidatesOf)) {
        let fixed = groupCharge;
        for (const [symbol, v] of combo.valences) {
          const count = elementParts.reduce(
            (n, p) => (p.symbol === symbol ? n + p.count : n),
            0,
          );
          fixed += v * count;
        }
        const x = -fixed / targetCount;
        if (!Number.isInteger(x) || x === 0 || Math.abs(x) > 8) continue;
        if (targetIsAnion ? x > 0 : x < 0) continue;
        // 若目标元素在教材价态表里明确列了负价，负解必须落在表内；
        // 正解同理必须落在正价表内。这样 FeCl₃ 的氯只会得到 −1，
        // 而不是拿 Fe 的 +2/+3 反推出 −2/−3。
        const needsMembership =
          !isPeroxideOxygen &&
          (x > 0 || (targetEntry?.valences.some((v) => v < 0) ?? false));
        if (needsMembership && !(targetEntry?.valences.includes(x) ?? false)) continue;
        if (seen.has(x)) continue;
        seen.add(x);
        // 完整因数式：每项都写成「原子个数 × (已知化合价)」，不跳步成乘积结果。
        const terms: string[] = [];
        for (const [symbol, v] of combo.valences) {
          const count = elementParts.reduce((n, p) => (p.symbol === symbol ? n + p.count : n), 0);
          terms.push(`${count} × (${formatValence(v)})`);
        }
        for (const gp of parsed.parts) {
          if (gp.kind === 'group') terms.push(`${gp.count} × (${formatValence(gp.ion.charge)})`);
        }
        const coeffX = targetCount === 1 ? 'x' : `${targetCount}x`;
        const expr = terms.length ? `${coeffX} + ${terms.join(' + ')}` : coeffX;
        answers.push({
          valence: x,
          scope: bi(`${formula} 中的 ${target}`, `${target} in ${formula}`),
          derivation: bi(
            `${expr} = 0，解得 x = ${formatValence(x)}，故 ${target} 的化合价为 ${formatValence(x)}。`,
            `${expr} = 0, so x = ${formatValence(x)}; the valence of ${target} is ${formatValence(x)}.`,
          ),
        });
      }
    } else if (groupParts.length) {
      for (const part of groupParts) {
        const inner = parseFormula(part.ion.formula, false);
        if (isFormulaError(inner)) continue;
        const innerCounts = atomCounts(inner);
        const innerTargetCount = innerCounts.get(target) ?? 0;
        if (!innerTargetCount) continue;
        let fixed = part.ion.charge;
        for (const [symbol, n] of innerCounts) {
          if (symbol === target) continue;
          const entry = valenceElementBySymbol.get(symbol);
          if (entry && entry.valences.length === 1) fixed -= entry.valences[0] * n;
        }
        const x = fixed / innerTargetCount;
        if (!Number.isInteger(x) || x === 0 || Math.abs(x) > 8) continue;
        const needsMembership =
          x > 0 || (targetEntry?.valences.some((v) => v < 0) ?? false);
        if (needsMembership && !(targetEntry?.valences.includes(x) ?? false)) continue;
        if (answers.some((a) => a.valence === x)) continue;
        const terms: string[] = [];
        for (const [symbol, n] of innerCounts) {
          if (symbol === target) continue;
          const entry = valenceElementBySymbol.get(symbol);
          if (entry && entry.valences.length === 1) terms.push(`${n} × (${formatValence(entry.valences[0])})`);
        }
        const coeffX = innerTargetCount === 1 ? 'x' : `${innerTargetCount}x`;
        const expr = terms.length ? `${coeffX} + ${terms.join(' + ')}` : coeffX;
        answers.push({
          valence: x,
          scope: bi(`${part.ion.name.zh}（${part.ion.formula}）中的 ${target}`, `${target} in ${part.ion.name.en} (${part.ion.formula})`),
          derivation: bi(
            `${part.ion.formula} 整体带 ${formatValence(part.ion.charge)}：${expr} = ${formatSigned(part.ion.charge)}，解得 x = ${formatValence(x)}，故 ${target} 的化合价为 ${formatValence(x)}。`,
            `The ${part.ion.formula} group carries ${formatValence(part.ion.charge)}: ${expr} = ${formatSigned(part.ion.charge)}, so x = ${formatValence(x)}; the valence of ${target} is ${formatValence(x)}.`,
          ),
        });
      }
    }

    if (!answers.length) {
      notes.push(
        bi(
          `${formula} 中的 ${target} 按教材价态表得不到单一整数化合价，可能是混合价态或超出初中价态范围。`,
          `${target} in ${formula} has no single integer valence within the textbook table; it may be a mixed valence or beyond the junior-high range.`,
        ),
      );
    }
  }

  if (exactFormula === 'H2O2') {
    notes.push(
      bi(
        '过氧化氢是特例：按总和为 0 可得氧为 −1，而不是通常的 −2。',
        'Hydrogen peroxide is the exception: the zero-sum rule gives oxygen −1, not the usual −2.',
      ),
    );
  }
  if (exactFormula === 'NH4NO3' && target === 'N') {
    notes.push(
      bi(
        '硝酸铵里有两处氮：NH₄⁺ 中为 −3，NO₃⁻ 中为 +5，必须分开计算。',
        'Ammonium nitrate has nitrogen in two places: −3 in NH₄⁺ and +5 in NO₃⁻; solve them separately.',
      ),
    );
  }

  return { formula, target, answers, note: notes.length ? notes[notes.length - 1] : undefined };
}

function formatSigned(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/* ------------------------------------------------------------------ */
/* 练习题：固定题库 + 固定选项顺序，无随机数                            */
/* ------------------------------------------------------------------ */

export type PracticeKind = 'valence' | 'formula' | 'solve' | 'judge' | 'name' | 'mass' | 'order';

/** 中考课标四大练习分类。 */
export type PracticeCategory = 'basic' | 'pitfall' | 'formula' | 'order';

export interface PracticeQuestion {
  id: string;
  kind: PracticeKind;
  /** 所属练习分类（缺省按 basic 处理，兼容旧数据）。 */
  category?: PracticeCategory;
  prompt: Bi;
  formula?: string;
  options: string[];
  answer: number;
  explanation: Bi;
  /** 选项下标 → 精确错因；未列出的选项走通用提示。 */
  diagnosis: Record<number, Bi>;
}

const Q = (
  id: string,
  kind: PracticeKind,
  prompt: Bi,
  options: string[],
  answer: number,
  explanation: Bi,
  diagnosis: Record<number, Bi>,
  formula?: string,
): PracticeQuestion => ({ id, kind, prompt, options, answer, explanation, diagnosis, formula });

const RAW_PRACTICE_QUESTIONS: readonly PracticeQuestion[] = [
  Q(
    'valence-fe2o3',
    'valence',
    bi('Fe₂O₃ 中铁元素的化合价是？', 'What is the valence of iron in Fe₂O₃?'),
    ['+3', '+2', '−2', '−3'],
    0,
    bi('氧为 −2：2x + 3×(−2) = 0，解得 x = +3。', 'Oxygen is −2: 2x + 3×(−2) = 0, so x = +3.'),
    {
      1: bi('+2 是 FeO（氧化亚铁）中铁的价态；Fe₂O₃ 有三个氧，总和更大。', '+2 belongs to FeO (iron(II) oxide); Fe₂O₃ has three oxygens.'),
      2: bi('氧才是 −2；铁是金属，在化合物中显正价。', 'Oxygen is the −2 partner; iron is a metal and is positive here.'),
      3: bi('符号和数值都不对：先设 x，再解 2x + 3×(−2) = 0。', 'Both sign and value are wrong: set x and solve 2x + 3×(−2) = 0.'),
    },
    'Fe2O3',
  ),
  Q(
    'solve-kmno4',
    'solve',
    bi('KMnO₄ 中锰元素的化合价是？', 'What is the valence of manganese in KMnO₄?'),
    ['+7', '+6', '+5', '+4'],
    0,
    bi('钾 +1、氧 −2：1 + x + 4×(−2) = 0，解得 x = +7。', 'K is +1 and O is −2: 1 + x + 4×(−2) = 0, so x = +7.'),
    {
      1: bi('+6 是 K₂MnO₄（锰酸钾）中锰的价态，别把两个盐混了。', '+6 is manganese in K₂MnO₄ (potassium manganate); do not confuse the two salts.'),
      2: bi('+5 常出现在 KClO₃ 的氯上；本题是锰，按 1 + x − 8 = 0 算。', '+5 is common for chlorine in KClO₃; here use 1 + x − 8 = 0 for manganese.'),
      3: bi('+4 是 MnO₂ 中锰的价态；KMnO₄ 多了一个钾和一个氧。', '+4 is manganese in MnO₂; KMnO₄ has one more K and O.'),
    },
    'KMnO4',
  ),
  Q(
    'formula-feo',
    'formula',
    bi('铁离子 Fe³⁺ 与氧离子 O²⁻ 组成的化学式是？', 'Which formula forms from Fe³⁺ and O²⁻?'),
    ['Fe2O3', 'FeO', 'Fe3O2', 'FeO3'],
    0,
    bi('3 与 2 交叉得 Fe₂O₃；检查 2×(+3) + 3×(−2) = 0。', 'Cross 3 and 2 to get Fe₂O₃; check 2×(+3) + 3×(−2) = 0.'),
    {
      1: bi('FeO 对应 Fe²⁺，不是 Fe³⁺；本题价数 3 与 2 不相等。', 'FeO pairs with Fe²⁺, not Fe³⁺; the magnitudes 3 and 2 differ.'),
      2: bi('交叉方向反了：阳离子的价数应写到阴离子右下角。', 'The cross is reversed: the cation valence goes under the anion.'),
      3: bi('2 与 3 的交叉结果不是 1 与 3；再算一次 gcd(3, 2) = 1。', 'Crossing 2 and 3 does not give 1 and 3; gcd(3, 2) = 1.'),
    },
    'Fe2O3',
  ),
  Q(
    'formula-ca-po4',
    'formula',
    bi('Ca²⁺ 与 PO₄³⁻ 组成的化学式是？', 'Which formula forms from Ca²⁺ and PO₄³⁻?'),
    ['Ca3(PO4)2', 'CaPO4', 'Ca2(PO4)3', 'Ca3PO4'],
    0,
    bi('交叉得 Ca₃(PO₄)₂；磷酸根个数为 2，必须整体加括号。', 'Crossing gives Ca₃(PO₄)₂; with two phosphate groups the whole group needs brackets.'),
    {
      1: bi('CaPO₄ 没有约简，但 2 与 3 互质，正确个数是 3 : 2。', 'CaPO₄ is not the reduced ratio; 2 and 3 are coprime, so the counts are 3 : 2.'),
      2: bi('交叉方向反了：Ca 应取 3 个，PO₄ 取 2 个。', 'The cross is reversed: take 3 Ca and 2 PO₄.'),
      3: bi('磷酸根个数为 2 时漏了括号，写成 Ca₃PO₄ 会被误读。', 'With two phosphate groups the brackets are missing; Ca₃PO₄ would be misread.'),
    },
    'Ca3(PO4)2',
  ),
  Q(
    'judge-feo',
    'judge',
    bi('判断：FeO 中铁显 +3 价。', 'True or false: iron is +3 in FeO.'),
    ['错误：FeO 中铁为 +2，读「氧化亚铁」', '正确：FeO 中铁为 +3', '错误：FeO 中铁为 −2', '错误：FeO 不是化合物'],
    0,
    bi('氧 −2，铁只能是 +2；+3 对应 Fe₂O₃。', 'Oxygen is −2, so iron must be +2; +3 corresponds to Fe₂O₃.'),
    {
      1: bi('FeO 与 Fe₂O₃ 混淆了：氧的个数不同，铁的价态也不同。', 'Confused FeO with Fe₂O₃: different oxygen counts mean different iron valences.'),
      2: bi('铁是金属，在化合物中显正价，不可能为 −2。', 'Iron is a metal and is positive in compounds; it cannot be −2.'),
      3: bi('FeO 是铁和氧组成的化合物，名称与价态都要看具体组成。', 'FeO is a compound of iron and oxygen; naming and valence depend on its composition.'),
    },
    'FeO',
  ),
  Q(
    'judge-caoh2',
    'judge',
    bi('判断：Ca(OH)₂ 中含有 2 个氢氧根。', 'True or false: Ca(OH)₂ contains two hydroxide groups.'),
    ['正确：括号外的 2 表示 2 个 OH', '错误：只有 1 个氢氧根', '错误：含有 2 个氧原子和 1 个氢', '错误：Ca(OH)₂ 中没有原子团'],
    0,
    bi('括号外的 2 乘到整个 OH 上，得到 2 个氢氧根。', 'The 2 outside the bracket multiplies the whole OH group, giving two hydroxides.'),
    {
      1: bi('括号外的 2 不是装饰：它同时乘到 O 和 H 上。', 'The 2 outside the bracket is not decoration: it multiplies both O and H.'),
      2: bi('括号是整体：OH 是原子团，不能拆开只数其中一个原子。', 'The bracket is a unit: OH is a group and must not be split.'),
      3: bi('OH 正是教材要求的 7 个原子团之一。', 'OH is one of the seven polyatomic ions required by the textbook.'),
    },
    'Ca(OH)2',
  ),
  Q(
    'name-fe2o3',
    'name',
    bi('Fe₂O₃ 的名称是？', 'What is the name of Fe₂O₃?'),
    ['氧化铁', '氧化亚铁', '四氧化三铁', '氢氧化铁'],
    0,
    bi('铁显 +3 时读「铁」，Fe₂O₃ 是氧化铁；+2 才读「亚铁」。', 'With iron at +3 the Chinese name uses 铁; Fe₂O₃ is 氧化铁, while +2 uses 亚铁.'),
    {
      1: bi('「亚铁」只用于 +2 价，例如 FeO、FeCl₂。', '「亚铁」(iron(II)) is only for +2, e.g. FeO and FeCl₂.'),
      2: bi('Fe₃O₄ 才是四氧化三铁，它是 FeO·Fe₂O₃ 的混合价态。', 'Fe₃O₄ is 四氧化三铁, a mixed-valence FeO·Fe₂O₃.'),
      3: bi('氢氧化铁是 Fe(OH)₃，含 OH 原子团，不是氧化物。', '氢氧化铁 is Fe(OH)₃, which contains OH groups and is not an oxide.'),
    },
    'Fe2O3',
  ),
  Q(
    'name-cu2o',
    'name',
    bi('Cu₂O 的名称是？', 'What is the name of Cu₂O?'),
    ['氧化亚铜', '氧化铜', '氢氧化铜', '硫酸铜'],
    0,
    bi('铜显 +1 时读「亚铜」，Cu₂O 是氧化亚铜。', 'Copper at +1 is 亚铜, so Cu₂O is 氧化亚铜.'),
    {
      1: bi('氧化铜是 CuO，铜显 +2；注意氧的个数。', '氧化铜 is CuO with copper at +2; check the oxygen count.'),
      2: bi('氢氧化铜是 Cu(OH)₂，含 OH 原子团。', '氢氧化铜 is Cu(OH)₂ with OH groups.'),
      3: bi('硫酸铜是 CuSO₄，含硫酸根，不是氧化物。', '硫酸铜 is CuSO₄, containing sulfate rather than being an oxide.'),
    },
    'Cu2O',
  ),
  Q(
    'mass-h2o',
    'mass',
    bi('H₂O 的相对分子质量是？', 'What is the relative molecular mass of H₂O?'),
    ['18', '17', '20', '16'],
    0,
    bi('2×1 + 16 = 18。', '2×1 + 16 = 18.'),
    {
      1: bi('少算了一个氢：水分子有 2 个 H，不是 1 个。', 'One hydrogen is missing: water has two H atoms.'),
      2: bi('把氢的相对原子质量当成 2 了；H 取 1。', 'Hydrogen was taken as 2; H is 1.'),
      3: bi('只算了氧，漏掉两个氢。', 'Only oxygen was counted; the two hydrogens are missing.'),
    },
    'H2O',
  ),
  Q(
    'mass-fe2o3-fraction',
    'mass',
    bi('Fe₂O₃ 中铁元素的质量分数约为？', 'What is the mass fraction of iron in Fe₂O₃?'),
    ['70%', '30%', '56%', '88.9%'],
    0,
    bi('Fe：2×56 = 112，Mr = 112 + 48 = 160，112/160 = 70%。', 'Fe: 2×56 = 112; Mr = 112 + 48 = 160; 112/160 = 70%.'),
    {
      1: bi('30% 是氧的质量分数，问的是铁。', '30% is the mass fraction of oxygen; the question asks for iron.'),
      2: bi('56 是一个铁原子的相对原子质量，没有乘 2、也没有除以 Mr。', '56 is one iron atom, without multiplying by 2 or dividing by Mr.'),
      3: bi('88.9% 是水中氧的质量分数，不是 Fe₂O₃。', '88.9% is the oxygen fraction in water, not Fe₂O₃.'),
    },
    'Fe2O3',
  ),
  Q(
    'valence-h2o2',
    'valence',
    bi('H₂O₂ 中氧元素的化合价是？', 'What is the valence of oxygen in H₂O₂?'),
    ['−1', '−2', '+1', '+2'],
    0,
    bi('氢 +1：2×(+1) + 2x = 0，解得 x = −1；这是过氧化氢的特例。', 'Hydrogen is +1: 2×(+1) + 2x = 0, so x = −1; this is the hydrogen-peroxide exception.'),
    {
      1: bi('−2 是氧的通常价态，但 H₂O₂ 是教材明确点出的特例。', '−2 is the usual oxygen valence, but H₂O₂ is the textbook exception.'),
      2: bi('氧的非金属性强，在过氧化物中仍显负价。', 'Oxygen is strongly non-metallic and remains negative in peroxides.'),
      3: bi('先设 x 再解方程，不要凭感觉给正价。', 'Set x and solve the equation rather than guessing a positive value.'),
    },
    'H2O2',
  ),
  Q(
    'formula-nh4-so4',
    'formula',
    bi('NH₄⁺ 与 SO₄²⁻ 组成的化学式是？', 'Which formula forms from NH₄⁺ and SO₄²⁻?'),
    ['(NH4)2SO4', 'NH4SO4', '(NH4)2(SO4)2', 'NH4(SO4)2'],
    0,
    bi('交叉得 2 个 NH₄ 和 1 个 SO₄；铵根个数为 2，整体加括号。', 'Crossing gives two NH₄ and one SO₄; the ammonium group needs brackets.'),
    {
      1: bi('电荷没有配平：+1 与 −2 需要 2 个铵根。', 'Charges are unbalanced: +1 and −2 need two ammonium groups.'),
      2: bi('没有约简到最简整数比：2 : 2 应约成 2 : 1。', 'Not reduced to the simplest ratio: 2 : 2 becomes 2 : 1.'),
      3: bi('把硫酸根的个数算成 2 了；交叉方向应为 SO₄ 取 1。', 'The sulfate count is wrong; sulfate should take 1.'),
    },
    '(NH4)2SO4',
  ),
  Q(
    'pitfall-nh4no3-n',
    'judge',
    bi('NH₄NO₃（硝酸铵）中氮元素的化合价，下列说法正确的是？', 'Which statement about nitrogen in NH₄NO₃ is correct?'),
    ['铵根中氮为 −3，硝酸根中氮为 +5', '两处氮都是 +5', '两处氮都是 −3', '铵根中氮为 +5，硝酸根中氮为 −3'],
    0,
    bi('分两处算：NH₄⁺ 整体 +1，x + 4×(+1) = +1 → x = −3；NO₃⁻ 整体 −1，x + 3×(−2) = −1 → x = +5。', 'Treat them separately: NH₄⁺ carries +1, x + 4×(+1) = +1 → x = −3; NO₃⁻ carries −1, x + 3×(−2) = −1 → x = +5.'),
    {
      1: bi('两处环境不同，不能都按 +5 算；铵根里的氮是 −3。', 'The two sites differ; nitrogen is −3 in ammonium, not +5.'),
      2: bi('硝酸根里的氮是 +5，不是 −3。', 'Nitrogen in nitrate is +5, not −3.'),
      3: bi('符号反了：铵根 −3、硝酸根 +5。', 'Signs are reversed: −3 in ammonium, +5 in nitrate.'),
    },
    'NH4NO3',
  ),
  Q(
    'pitfall-fe3o4',
    'judge',
    bi('关于 Fe₃O₄ 中铁的化合价，下列说法正确的是？', 'Which statement about iron in Fe₃O₄ is correct?'),
    ['可视为 FeO·Fe₂O₃，铁为 +2/+3 混合价，初中不作单一整数反推', '铁全部为 +2', '铁全部为 +3', '铁为 +8/3，直接按分数记'],
    0,
    bi('Fe₃O₄ 是复合氧化物 FeO·Fe₂O₃，铁同时有 +2 和 +3，教材不要求推出单一整数价。', 'Fe₃O₄ is the composite oxide FeO·Fe₂O₃; iron is +2 and +3, and the textbook does not assign one integer valence.'),
    {
      1: bi('若全为 +2，与 FeO·Fe₂O₃ 的真实组成不符。', 'All +2 would not reflect the FeO·Fe₂O₃ composition.'),
      2: bi('全为 +3 也不符合 FeO·Fe₂O₃ 的组成。', 'All +3 also contradicts the FeO·Fe₂O₃ composition.'),
      3: bi('+8/3 是数学平均，不是教材要求的整数化合价。', '+8/3 is a mathematical average, not a textbook integer valence.'),
    },
    'Fe3O4',
  ),
  Q(
    'pitfall-o2-zero',
    'valence',
    bi('O₂（氧气）中氧元素的化合价是？', 'What is the valence of oxygen in O₂?'),
    ['0', '−2', '+2', '−1'],
    0,
    bi('单质中元素化合价为 0，O₂ 是单质。', 'In a free element the valence is 0; O₂ is an element.'),
    {
      1: bi('−2 是化合物中氧的常见价态，单质里不是。', '−2 is common in compounds, not in the free element.'),
      2: bi('氧在单质中不带正价。', 'Oxygen is not positive in its free state.'),
      3: bi('−1 是过氧化物中的特例，O₂ 中为 0。', '−1 is the peroxide exception; here it is 0.'),
    },
    'O2',
  ),
  Q(
    'order-cl',
    'order',
    bi('下列含氯物质中，氯元素化合价由低到高排列正确的是？', 'Which order lists chlorine valence from low to high?'),
    ['HCl → Cl₂ → HClO → HClO₃', 'Cl₂ → HCl → HClO → HClO₃', 'HClO → HCl → Cl₂ → HClO₃', 'HCl → HClO → Cl₂ → HClO₃'],
    0,
    bi('HCl(−1) → Cl₂(0) → HClO(+1) → HClO₃(+5)。', 'HCl(−1) → Cl₂(0) → HClO(+1) → HClO₃(+5).'),
    {
      1: bi('Cl₂ 是 0，应排在 HCl(−1) 之后。', 'Cl₂ is 0 and should come after HCl(−1).'),
      2: bi('HClO 是 +1，比 HCl(−1) 高，不能放最前。', 'HClO is +1, higher than HCl(−1).'),
      3: bi('HClO₃ 是 +5，应排在 Cl₂(0) 之后。', 'HClO₃ is +5 and should come after Cl₂(0).'),
    },
  ),
  Q(
    'order-s',
    'order',
    bi('下列含硫物质中，硫元素化合价由低到高排列正确的是？', 'Which order lists sulfur valence from low to high?'),
    ['H₂S → S → SO₂ → SO₃', 'SO₂ → H₂S → S → SO₃', 'S → H₂S → SO₂ → SO₃', 'H₂S → SO₂ → S → SO₃'],
    0,
    bi('H₂S(−2) → S(0) → SO₂(+4) → SO₃(+6)。', 'H₂S(−2) → S(0) → SO₂(+4) → SO₃(+6).'),
    {
      1: bi('SO₂ 是 +4，应排在 H₂S(−2) 之后。', 'SO₂ is +4 and should come after H₂S(−2).'),
      2: bi('S 是 0，比 H₂S(−2) 高。', 'S is 0, higher than H₂S(−2).'),
      3: bi('S 是 0，应排在 SO₂(+4) 之前。', 'S is 0 and should come before SO₂(+4).'),
    },
  ),
  Q(
    'order-n',
    'order',
    bi('下列含氮物质中，氮元素化合价由低到高排列正确的是？', 'Which order lists nitrogen valence from low to high?'),
    ['NH₃ → N₂ → NO → HNO₃', 'N₂ → NH₃ → NO → HNO₃', 'NO → NH₃ → N₂ → HNO₃', 'NH₃ → NO → N₂ → HNO₃'],
    0,
    bi('NH₃(−3) → N₂(0) → NO(+2) → HNO₃(+5)。', 'NH₃(−3) → N₂(0) → NO(+2) → HNO₃(+5).'),
    {
      1: bi('N₂ 是 0，应排在 NH₃(−3) 之后。', 'N₂ is 0 and should come after NH₃(−3).'),
      2: bi('NO 是 +2，比 NH₃(−3) 高。', 'NO is +2, higher than NH₃(−3).'),
      3: bi('N₂ 是 0，应排在 NO(+2) 之前。', 'N₂ is 0 and should come before NO(+2).'),
    },
  ),
] as const;

/**
 * 按题号确定性地旋转选项，让正确答案均匀落在四个位置。
 *
 * 题库作者习惯把正确答案写在第一个，若直接展示，12 道题的正确选项全部在
 * A。这里按 (answer − 题号) 取模旋转，既保证位置分布确定、可复现，
 * 又把 diagnosis（选项下标 → 错因）一并重映射，错因提示不会指错选项。
 */
function rotateQuestion(q: PracticeQuestion, index: number): PracticeQuestion {
  const n = q.options.length;
  if (n <= 1) return q;
  const shift = (((q.answer - index) % n) + n) % n;
  if (shift === 0) return q;
  const remap = (oldIndex: number): number => (oldIndex - shift + n) % n;
  const diagnosis: Record<number, Bi> = {};
  for (const [key, value] of Object.entries(q.diagnosis)) {
    diagnosis[remap(Number(key))] = value;
  }
  return {
    ...q,
    options: [...q.options.slice(shift), ...q.options.slice(0, shift)],
    answer: remap(q.answer),
    diagnosis,
  };
}

const PRACTICE_CATEGORY_BY_ID: Record<string, PracticeCategory> = {
  'valence-fe2o3': 'basic',
  'solve-kmno4': 'basic',
  'name-fe2o3': 'basic',
  'name-cu2o': 'basic',
  'mass-h2o': 'basic',
  'mass-fe2o3-fraction': 'basic',
  'judge-feo': 'pitfall',
  'judge-caoh2': 'pitfall',
  'valence-h2o2': 'pitfall',
  'pitfall-nh4no3-n': 'pitfall',
  'pitfall-fe3o4': 'pitfall',
  'pitfall-o2-zero': 'pitfall',
  'formula-feo': 'formula',
  'formula-ca-po4': 'formula',
  'formula-nh4-so4': 'formula',
  'order-cl': 'order',
  'order-s': 'order',
  'order-n': 'order',
};

export const PRACTICE_QUESTIONS: readonly PracticeQuestion[] = RAW_PRACTICE_QUESTIONS.map((q, i) => ({
  ...rotateQuestion(q, i),
  category: PRACTICE_CATEGORY_BY_ID[q.id] ?? 'basic',
}));

/** 四大练习分类的固定展示顺序。 */
export const PRACTICE_CATEGORY_ORDER: readonly PracticeCategory[] = ['basic', 'pitfall', 'formula', 'order'];

/** 按固定顺序取题；count 超过题库长度时循环（题目 id 加轮次后缀保证唯一）。 */
export function practiceQuestions(count = 6): PracticeQuestion[] {
  const out: PracticeQuestion[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = PRACTICE_QUESTIONS[i % PRACTICE_QUESTIONS.length];
    out.push(i < PRACTICE_QUESTIONS.length ? base : { ...base, id: `${base.id}-${Math.floor(i / PRACTICE_QUESTIONS.length)}` });
  }
  return out;
}

export const PRACTICE_KIND_LABEL: Record<PracticeKind, Bi> = {
  valence: bi('标化合价', 'Assign valence'),
  formula: bi('由价写式', 'Formula from valences'),
  solve: bi('由式求价', 'Valence from formula'),
  judge: bi('判断正误', 'True or false'),
  name: bi('物质命名', 'Naming'),
  mass: bi('相对分子质量', 'Relative mass'),
  order: bi('价态排序', 'Valence ordering'),
};

export const PRACTICE_CATEGORY_LABEL: Record<PracticeCategory, Bi> = {
  basic: bi('基础反推', 'Basics'),
  pitfall: bi('易错避坑', 'Pitfalls'),
  formula: bi('十字交叉写化学式', 'Cross-rule formulas'),
  order: bi('价态排序', 'Valence ordering'),
};

/* ------------------------------------------------------------------ */
/* URL 状态：单页四模式与周期表互链                                     */
/* ------------------------------------------------------------------ */

export type ChemMode = 'reference' | 'builder' | 'solver' | 'practice';

export const CHEM_MODES: readonly ChemMode[] = ['reference', 'builder', 'solver', 'practice'];

export interface IonRef {
  formula: string;
  charge: number;
}

export interface ChemQueryState {
  mode: ChemMode;
  cation: IonRef | null;
  anion: IonRef | null;
  symbol: string | null;
  /** 反推模式深链：预填化学式（保持原始 ASCII，便于输入框键盘编辑）。 */
  formula: string | null;
  from: 'element' | null;
}

export function parseIonRef(raw: string | null): IonRef | null {
  if (!raw) return null;
  const [formula, chargeRaw] = raw.split(':');
  if (!formula) return null;
  const charge = Number(chargeRaw);
  if (!Number.isFinite(charge) || charge === 0) return null;
  return { formula, charge };
}

export const formatIonRef = (ion: IonRef): string => `${ion.formula}:${ion.charge}`;

const isChemMode = (v: string | null): v is ChemMode =>
  v === 'reference' || v === 'builder' || v === 'solver' || v === 'practice';

export function parseChemistryQuery(search: URLSearchParams): ChemQueryState {
  const mode = search.get('mode');
  const rawFormula = search.get('formula');
  return {
    mode: isChemMode(mode) ? mode : 'reference',
    cation: parseIonRef(search.get('cation')),
    anion: parseIonRef(search.get('anion')),
    symbol: search.get('symbol'),
    formula: rawFormula && /^[A-Za-z0-9()·]{1,40}$/.test(rawFormula) ? rawFormula : null,
    from: search.get('from') === 'element' ? 'element' : null,
  };
}

/** 周期表深链：?element=Fe 或 ?symbol=Fe。 */
export function parsePeriodicElementQuery(search: URLSearchParams): string | null {
  const raw = search.get('element') ?? search.get('symbol');
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^[A-Z][a-z]?$/.test(trimmed)) return null;
  return trimmed;
}

export interface Preselect {
  cation: IonRef;
  anion: IonRef;
}

/**
 * 从元素符号给出「马上能看到交叉结果」的默认配对：
 *   - 金属 / 氢：作阳离子，配 O²⁻（Fe → Fe₂O₃）；
 *   - 非金属：作阴离子，配 Na⁺（Cl → NaCl）。
 */
export function preselectFromSymbol(symbol: string): Preselect | null {
  const el = valenceElementBySymbol.get(symbol);
  if (!el) return null;
  const dominant = el.dominant;
  if (dominant > 0) {
    const anionFormula = symbol === 'H' ? 'Cl' : 'O';
    const anionCharge = symbol === 'H' ? -1 : -2;
    return { cation: { formula: symbol, charge: dominant }, anion: { formula: anionFormula, charge: anionCharge } };
  }
  return { cation: { formula: 'Na', charge: 1 }, anion: { formula: symbol, charge: dominant } };
}

/** 把状态写回查询串（只写非默认字段，保持 URL 干净）。 */
export function chemistryQuery(state: Partial<ChemQueryState>): URLSearchParams {
  const search = new URLSearchParams();
  if (state.mode && state.mode !== 'reference') search.set('mode', state.mode);
  if (state.cation) search.set('cation', formatIonRef(state.cation));
  if (state.anion) search.set('anion', formatIonRef(state.anion));
  if (state.symbol) search.set('symbol', state.symbol);
  if (state.from) search.set('from', state.from);
  return search;
}
