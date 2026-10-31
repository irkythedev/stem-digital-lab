/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 深水区修复的回归断言（注册模块，不含执行入口）：
 *   1. 化学式排印 tokenizer：前导化学计量数（2H2O）与结晶水系数（CuSO4·5H2O）
 *      必须是正体，普通原子个数才是下标；
 *   2. AI 实时上下文的外电路等效电阻公式 R_ext = (emf − I·r_int) / I_total。
 *
 * 依赖特征：零 DOM、零 async，只测纯函数。
 */
import assert from 'node:assert';
import type { TestFn } from './harness';
import { tokenizeFormula, type FormulaSegment } from '../components/chemistry/ChemFormula';
import { externalEquivalentResistance } from '../labs/physics/circuit-bench/circuit-bench-core';

/** 把 tokenizer 结果压成可断言的字符串：下标片段写成 <sub>x</sub>，正体原样。 */
function render(formula: string): string {
  return tokenizeFormula(formula)
    .map((s: FormulaSegment) => (s.sub ? `<sub>${s.text}</sub>` : s.text))
    .join('');
}

export function registerDeepFixTests(test: TestFn): void {
  test('化学式 tokenizer：前导系数 2H2O 的首个 2 保持正体，第二个 2 才是下标', () => {
    assert.equal(render('2H2O'), '2H<sub>2</sub>O');
  });

  test('化学式 tokenizer：结晶水 CuSO4·5H2O 的 5 保持正体，H2O 正常下标', () => {
    assert.equal(render('CuSO4·5H2O'), 'CuSO<sub>4</sub>·5H<sub>2</sub>O');
  });

  test('化学式 tokenizer：常规下标 H2O / (NH4)2SO4 不受影响', () => {
    assert.equal(render('H2O'), 'H<sub>2</sub>O');
    assert.equal(render('(NH4)2SO4'), '(NH<sub>4</sub>)<sub>2</sub>SO<sub>4</sub>');
    // 下标数字本身不含系数语义
    assert.ok(tokenizeFormula('Fe2O3').filter((s) => s.sub).length === 2, 'Fe2O3 应有两处下标');
  });

  test('外电路等效电阻：R = (emf − I·r_int) / I（放电电流为正）', () => {
    // emf=6, r_int=0.5, I=0.5 → U=5.75, R=11.5
    assert.ok(Math.abs(externalEquivalentResistance(6, 0.5, 0.5) - 11.5) < 1e-9);
    // emf=6, r_int=0.5, I=0.6 → U=5.7, R=9.5
    assert.ok(Math.abs(externalEquivalentResistance(6, 0.5, 0.6) - 9.5) < 1e-9);
  });

  test('外电路等效电阻：断路=Infinity（I 低于阈值），纯短路=0（端电压≤0）', () => {
    assert.equal(externalEquivalentResistance(6, 0.5, 0), Infinity);
    assert.equal(externalEquivalentResistance(6, 0.5, 1e-7), Infinity, '低于 1e-6 视为断路');
    assert.equal(externalEquivalentResistance(6, 0.5, 100), 0, '端电压被拉负 → 短路记 0');
    // 非有限输入不炸
    assert.equal(externalEquivalentResistance(Number.NaN, 0.5, 0.5), 0);
  });
}
