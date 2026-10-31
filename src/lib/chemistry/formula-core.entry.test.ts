/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学式与化合价内核的黄金样例（独立入口）。
 *
 * 钉住四类不可回退的数值契约：
 *   1. 十字交叉：价数交叉 → gcd 约简 → 原子团括号，结果逐字固定；
 *   2. 由式反推：代数总和为零，变价元素取整数解，教材特例不臆造数字；
 *   3. 相对分子质量：采用初中教材取整值（Cl = 35.5），与质量分数同源；
 *   4. URL 状态与周期表深链：四模式可刷新、可从元素符号预选配对。
 *
 * 运行：npx tsx src/lib/chemistry/formula-core.entry.test.ts
 */
import assert from 'node:assert/strict';
import { describe, runAll, test } from '../../testing/harness';
import {
  CHEM_MODES,
  PRACTICE_QUESTIONS,
  atomCounts,
  chemistryQuery,
  crossValence,
  formatValence,
  gcd,
  isFormulaError,
  lcm,
  massFraction,
  molarMass,
  normalizeFormula,
  normalizeFormulaCase,
  parseChemistryQuery,
  parseFormula,
  parsePeriodicElementQuery,
  practiceQuestions,
  preselectFromSymbol,
  solveValence,
} from './formula-core';
import { ION_GROUPS, TYPICAL_COMPOUNDS, VALENCE_ELEMENTS, compoundKind, valenceElementBySymbol } from './valency';
import { nameCompound } from './formula-name';
import { ELEMENTS } from '../elements';

const formulaOf = (cation: string, anion: string, c: number, a: number): string => {
  const result = crossValence(cation, anion, c, a);
  assert.ok(!isFormulaError(result), `交叉失败：${cation} / ${anion}`);
  return result.formula;
};

describe('化学式与化合价内核（formula-core）', () => {
  test('整数运算：gcd 取正、lcm 不引入浮点', () => {
    assert.equal(gcd(6, 4), 2);
    assert.equal(gcd(-6, 4), 2);
    assert.equal(gcd(0, 5), 5);
    assert.equal(lcm(3, 5), 15);
    assert.equal(lcm(2, 2), 2);
  });

  test('解析器：下标归一化、大小写归一、原子团优先、括号倍数与错误分支', () => {
    assert.equal(normalizeFormula(' Ca(OH)₂ '), 'Ca(OH)2');
    assert.equal(normalizeFormula('fe2o3'), 'Fe2O3');
    assert.equal(normalizeFormula('(nh4)2so4'), '(NH4)2SO4');
    assert.equal(normalizeFormula('cacl2'), 'CaCl2');

    const calcium = parseFormula('Ca(OH)2');
    assert.ok(!isFormulaError(calcium));
    assert.deepEqual(
      calcium.parts.map((p) => (p.kind === 'group' ? `(${p.ion.formula})×${p.count}` : `${p.symbol}×${p.count}`)),
      ['Ca×1', '(OH)×2'],
    );

    const ammonium = parseFormula('(NH4)2SO4');
    assert.ok(!isFormulaError(ammonium));
    assert.deepEqual([...atomCounts(ammonium)], [['N', 2], ['H', 8], ['S', 1], ['O', 4]]);

    assert.ok(isFormulaError(parseFormula('CuSO4·5H2O')));
    assert.ok(isFormulaError(parseFormula('Xx2')));
    assert.ok(isFormulaError(parseFormula('')));
  });

  test('相对分子质量：初中教材取整黄金样例', () => {
    const cases: [string, number][] = [
      ['H2O', 18],
      ['CO2', 44],
      ['NaCl', 58.5],
      ['Ca(OH)2', 74],
      ['NH4NO3', 80],
      ['H2SO4', 98],
      ['KMnO4', 158],
      ['Fe2O3', 160],
      ['Fe3O4', 232],
      ['H2O2', 34],
    ];
    for (const [formula, expected] of cases) {
      assert.equal(molarMass(formula), expected, `${formula} 的相对分子质量`);
    }
  });

  test('质量分数：分母用同一口径的相对分子质量', () => {
    assert.ok(Math.abs((massFraction('H2O', 'H') ?? 0) - 2 / 18) < 1e-12);
    assert.ok(Math.abs((massFraction('Fe2O3', 'Fe') ?? 0) - 112 / 160) < 1e-12);
    assert.equal(massFraction('H2O', 'Fe'), null);
  });

  test('十字交叉：交叉、约简与原子团括号', () => {
    const cases: [string, string, number, number, string][] = [
      ['Na', 'Cl', 1, -1, 'NaCl'],
      ['Ca', 'Cl', 2, -1, 'CaCl2'],
      ['Al', 'O', 3, -2, 'Al2O3'],
      ['Ca', 'O', 2, -2, 'CaO'],
      ['Fe', 'SO4', 3, -2, 'Fe2(SO4)3'],
      ['Fe', 'SO4', 2, -2, 'FeSO4'],
      ['Cu', 'OH', 2, -1, 'Cu(OH)2'],
      ['Mg', 'NO3', 2, -1, 'Mg(NO3)2'],
      ['NH4', 'SO4', 1, -2, '(NH4)2SO4'],
      ['K', 'CO3', 1, -2, 'K2CO3'],
      ['H', 'PO4', 1, -3, 'H3PO4'],
    ];
    for (const [cation, anion, c, a, expected] of cases) {
      assert.equal(formulaOf(cation, anion, c, a), expected);
    }

    const reduced = crossValence('Ca', 'O', 2, -2);
    assert.ok(!isFormulaError(reduced));
    assert.equal(reduced.divisor, 2);
    assert.equal(reduced.cationCount, 1);
    assert.equal(reduced.anionCount, 1);
    assert.equal(reduced.steps.length, 4, '十字交叉必须保留四步推导');

    assert.ok(isFormulaError(crossValence('Cl', 'Na', -1, 1)));
  });

  test('由式反推：单点、变价枚举与教材特例', () => {
    const oxygen = solveValence('H2O', 'O');
    assert.ok(!isFormulaError(oxygen));
    assert.deepEqual(oxygen.answers.map((a) => a.valence), [-2]);

    const peroxide = solveValence('H2O2', 'O');
    assert.ok(!isFormulaError(peroxide));
    assert.deepEqual(peroxide.answers.map((a) => a.valence), [-1], '过氧化氢中氧为 −1');

    const manganese = solveValence('KMnO4', 'Mn');
    assert.ok(!isFormulaError(manganese));
    assert.deepEqual(manganese.answers.map((a) => a.valence), [7]);

    const iron = solveValence('Fe2O3', 'Fe');
    assert.ok(!isFormulaError(iron));
    assert.deepEqual(iron.answers.map((a) => a.valence), [3]);

    const nitrate = solveValence('NH4NO3', 'N');
    assert.ok(!isFormulaError(nitrate));
    assert.deepEqual(nitrate.answers.map((a) => a.valence), [-3, 5]);
    assert.ok(nitrate.note);

    const magnetite = solveValence('Fe3O4', 'Fe');
    assert.ok(!isFormulaError(magnetite));
    assert.deepEqual(magnetite.answers, [], '混合价态不臆造单一整数');
    assert.ok(magnetite.note);
  });

  test('由式反推：按阴阳离子角色约束，不得出现负价金属或荒谬高价', () => {
    const cases: [string, string, number[]][] = [
      ['FeCl3', 'Fe', [3]],
      ['FeCl3', 'Cl', [-1]],
      ['FeCl2', 'Fe', [2]],
      ['CuCl2', 'Cu', [2]],
      ['CuCl2', 'Cl', [-1]],
      ['H2SO4', 'O', [-2]],
      ['H2SO4', 'S', [6]],
      ['H2S', 'S', [-2]],
      ['Cl2O', 'Cl', [1]],
      ['N2O5', 'N', [5]],
      ['CH4', 'C', [-4]],
      ['NH3', 'N', [-3]],
      ['SO2', 'S', [4]],
      ['MnO2', 'Mn', [4]],
      ['Fe3O4', 'O', [-2]],
      ['O2', 'O', [0]],
    ];
    for (const [formula, target, expected] of cases) {
      const result = solveValence(formula, target);
      assert.ok(!isFormulaError(result), `${formula}/${target} 应能反推`);
      assert.deepEqual(
        result.answers.map((a) => a.valence),
        expected,
        `${formula} 中 ${target} 的答案`,
      );
    }
    // 数学上成立、化学上荒谬的解必须被排除。
    for (const [formula, target] of [
      ['FeCl3', 'Fe'],
      ['CuCl2', 'Cu'],
    ] as const) {
      const result = solveValence(formula, target);
      assert.ok(!isFormulaError(result));
      assert.ok(
        result.answers.every((a) => a.valence > 0),
        `${formula} 的 ${target} 只能是正价`,
      );
    }
  });

  test('命名：氧化物、酸、碱、盐与教材特例', () => {
    const cases: [string, string][] = [
      ['NaCl', '氯化钠'],
      ['H2SO4', '硫酸'],
      ['Ca(OH)2', '氢氧化钙'],
      ['Fe2(SO4)3', '硫酸铁'],
      ['NH4NO3', '硝酸铵'],
      ['Na2CO3', '碳酸钠'],
      ['FeO', '氧化亚铁'],
      ['Fe2O3', '氧化铁'],
      ['CuO', '氧化铜'],
      ['KMnO4', '高锰酸钾'],
      ['H2O', '水'],
      ['Fe3O4', '四氧化三铁'],
      ['Na3N', '氮化钠'],
      ['Mg3N2', '氮化镁'],
      ['H2S', '氢硫酸'],
      ['PH3', '磷化氢'],
      ['Cl2O', '一氧化二氯'],
      ['N2O5', '五氧化二氮'],
    ];
    for (const [formula, zh] of cases) {
      const named = nameCompound(formula);
      assert.ok(!('error' in named), `${formula} 应能自动命名`);
      assert.equal(named.zh, zh);
    }

    const sulfur = nameCompound('H2S');
    assert.ok(!('error' in sulfur));
    assert.equal(sulfur.en, 'hydrosulfuric acid');
    const nitrous = nameCompound('Na3N');
    assert.ok(!('error' in nitrous));
    assert.equal(nitrous.en, 'sodium nitride');
  });

  test('URL：四模式与离子状态可往返，周期表深链只认合法符号', () => {
    assert.deepEqual(CHEM_MODES, ['reference', 'builder', 'solver', 'practice']);

    const query = chemistryQuery({
      mode: 'builder',
      cation: { formula: 'Fe', charge: 3 },
      anion: { formula: 'SO4', charge: -2 },
      from: 'element',
      symbol: 'Fe',
    });
    const parsed = parseChemistryQuery(query);
    assert.equal(parsed.mode, 'builder');
    assert.deepEqual(parsed.cation, { formula: 'Fe', charge: 3 });
    assert.deepEqual(parsed.anion, { formula: 'SO4', charge: -2 });
    assert.equal(parsed.symbol, 'Fe');
    assert.equal(parsed.from, 'element');

    assert.equal(parseChemistryQuery(new URLSearchParams('mode=nope')).mode, 'reference');
    assert.equal(parseChemistryQuery(new URLSearchParams('cation=Fe:0')).cation, null);

    assert.equal(parsePeriodicElementQuery(new URLSearchParams('element=Fe')), 'Fe');
    assert.equal(parsePeriodicElementQuery(new URLSearchParams('symbol=Cl')), 'Cl');
    assert.equal(parsePeriodicElementQuery(new URLSearchParams('element=FE')), null);
    assert.equal(parsePeriodicElementQuery(new URLSearchParams('element=Iron')), null);
  });

  test('元素深链：金属配氧、非金属配钠，价态取主要价', () => {
    assert.deepEqual(preselectFromSymbol('Fe'), {
      cation: { formula: 'Fe', charge: 3 },
      anion: { formula: 'O', charge: -2 },
    });
    assert.deepEqual(preselectFromSymbol('Cl'), {
      cation: { formula: 'Na', charge: 1 },
      anion: { formula: 'Cl', charge: -1 },
    });
    assert.deepEqual(preselectFromSymbol('H'), {
      cation: { formula: 'H', charge: 1 },
      anion: { formula: 'Cl', charge: -1 },
    });
    assert.equal(preselectFromSymbol('Xx'), null);
    assert.equal(formatValence(-2), '−2');
  });

  test('价态表与周期表互链：符号存在、原子序数一致、原子团电荷自洽', () => {
    for (const entry of VALENCE_ELEMENTS) {
      const element = ELEMENTS.find((e) => e.symbol === entry.symbol);
      assert.ok(element, `周期表缺少 ${entry.symbol}`);
      assert.equal(element.n, entry.atomicNumber, `${entry.symbol} 原子序数不一致`);
      assert.ok(entry.valences.includes(entry.dominant), `${entry.symbol} 主要价态须在价态表中`);
      assert.equal(valenceElementBySymbol.get(entry.symbol), entry);
    }
    for (const ion of ION_GROUPS) {
      assert.notEqual(ion.charge, 0, `${ion.formula} 电荷不得为 0`);
      assert.ok(ion.name.zh && ion.name.en && ion.mnemonic.zh && ion.mnemonic.en);
    }
  });

  test('常见物质：分类标签必须落到唯一 kind，不得让页面猜颜色', () => {
    for (const compound of TYPICAL_COMPOUNDS) {
      assert.ok(
        compoundKind(compound.category),
        `${compound.formula} 的分类「${compound.category.zh}」没有登记 CompoundKind`,
      );
    }
  });

  test('练习题：固定题库、选项四选一、答案下标合法、按轮次取题', () => {
    assert.equal(PRACTICE_QUESTIONS.length, 12);
    for (const q of PRACTICE_QUESTIONS) {
      assert.equal(q.options.length, 4, `${q.id} 应有 4 个选项`);
      assert.ok(q.answer >= 0 && q.answer < q.options.length, `${q.id} 答案下标越界`);
      assert.ok(q.explanation.zh && q.explanation.en, `${q.id} 缺双语解析`);
      assert.equal(q.diagnosis[q.answer], undefined, `${q.id} 正确选项不应带错因`);
    }
    // 正确答案必须均匀分布，不能 12 道题全在同一个位置。
    assert.deepEqual(
      PRACTICE_QUESTIONS.map((q) => q.answer),
      PRACTICE_QUESTIONS.map((_, i) => i % 4),
    );
    const positions = new Set(PRACTICE_QUESTIONS.map((q) => q.answer));
    assert.equal(positions.size, 4, '四个选项位置都应出现正确答案');

    const first = practiceQuestions(12);
    const again = practiceQuestions(12);
    assert.deepEqual(first.map((q) => q.id), again.map((q) => q.id), '同一输入必须得到同一题序');
    assert.equal(new Set(first.map((q) => q.id)).size, 12);

    const wrapped = practiceQuestions(14);
    assert.equal(wrapped.length, 14);
    assert.equal(wrapped[12].id, `${PRACTICE_QUESTIONS[0].id}-1`);
    assert.equal(wrapped[13].id, `${PRACTICE_QUESTIONS[1].id}-1`);
  });
});

describe('化学式大小写智能规范化（normalizeFormulaCase）', () => {
  test('全小写 / 不规则大小写 → 教材规范大写', () => {
    assert.equal(normalizeFormulaCase('fe2o3'), 'Fe2O3');
    assert.equal(normalizeFormulaCase('cu(oh)2'), 'Cu(OH)2');
    assert.equal(normalizeFormulaCase('kmno4'), 'KMnO4');
    assert.equal(normalizeFormulaCase('h2so4'), 'H2SO4');
    assert.equal(normalizeFormulaCase('nh4no3'), 'NH4NO3');
    assert.equal(normalizeFormulaCase('co2'), 'CO2');
  });
  test('歧义消解：co 默认 CO、元素备选 Co；hf 默认 HF、备选 Hf；cs 归元素 Cs', () => {
    assert.equal(normalizeFormulaCase('co'), 'CO', 'co 默认判为常见化合物 CO');
    assert.equal(normalizeFormulaCase('co', 'element'), 'Co', 'co 元素备选为金属钴 Co');
    assert.equal(normalizeFormulaCase('hf'), 'HF', 'hf 默认判为氟化氢 HF');
    assert.equal(normalizeFormulaCase('hf', 'element'), 'Hf', 'hf 元素备选为铪 Hf');
    assert.equal(normalizeFormulaCase('cs'), 'Cs', 'cs 无常见化合物，归元素铯 Cs');
    // 已知式优先：带下标时不做歧义切换
    assert.equal(normalizeFormulaCase('co2'), 'CO2');
    assert.equal(normalizeFormulaCase('no3'), 'NO3');
  });
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
