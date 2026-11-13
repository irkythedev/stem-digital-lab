/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 纸墨工具组（速查 / 刻度反馈 / 快照分享 / 定格对照）的纯函数守卫。
 * 组件层行为（焦点、滚动锁、键盘）由 UI 守卫另行覆盖；这里只钉可复现的纯逻辑。
 */
import assert from 'node:assert/strict';
import type { TestFn } from '../../harness';
import { LOOKUP_ITEMS, formatChemicalFormula, groupLookup, searchLookup } from '../../../lib/quick-lookup';
import { detentCrossed } from '../../../lib/detent-feedback';
import { buildLabShareText, snapshotSummary, urlHasSnapshot } from '../../../lib/lab-snapshot';

export function registerPaperToolsTests(test: TestFn): void {
  test('速查索引：四类数据都非空，且覆盖实验/公式/物质/元素', () => {
    const grouped = groupLookup(LOOKUP_ITEMS);
    assert.ok(grouped.lab.length >= 20, `实验条目应 ≥20，当前 ${grouped.lab.length}`);
    assert.ok(grouped.formula.length >= 20, `公式应 ≥20，当前 ${grouped.formula.length}`);
    assert.ok(grouped.compound.length >= 20, `常见物质应 ≥20，当前 ${grouped.compound.length}`);
    assert.ok(grouped.element.length >= 100, `元素应 ≥100，当前 ${grouped.element.length}`);
  });

  test('速查过滤：中文、元素符号、英文关键词都能命中', () => {
    assert.ok(searchLookup('浮力').some((i) => i.kind === 'lab' && i.title.zh.includes('浮力')));
    assert.ok(searchLookup('二次函数').some((i) => i.kind === 'lab' && i.title.zh.includes('二次函数')));
    assert.ok(searchLookup('Ca').some((i) => i.kind === 'element' && i.element?.symbol === 'Ca'));
    assert.ok(searchLookup('ohm').some((i) => i.kind === 'lab' && i.title.en.toLowerCase().includes('ohm')));
    assert.equal(searchLookup('zzzz-not-found').length, 0);
    assert.equal(formatChemicalFormula('H2O'), 'H₂O');
    assert.equal(formatChemicalFormula('CO2'), 'CO₂');
    assert.equal(formatChemicalFormula('Ca(OH)2'), 'Ca(OH)₂');
    assert.equal(formatChemicalFormula('2H2O'), '2H₂O');
  });

  test('临界点判定：正向/反向跨越、恰好命中、初值不触发', () => {
    assert.equal(detentCrossed(0.9, 1.1, [1]), true);
    assert.equal(detentCrossed(1.1, 0.9, [1]), true);
    assert.equal(detentCrossed(0.5, 0.8, [1]), false);
    assert.equal(detentCrossed(0, 1, [1]), true);
    assert.equal(detentCrossed(null, 1, [1]), false);
    assert.equal(detentCrossed(0, 3, [1, 2, 3]), true);
    assert.equal(detentCrossed(2, 2, [2]), false);
  });

  test('快照摘要：二次函数按 a/b/c 还原表达式，一次函数按 k/b 还原', () => {
    assert.equal(snapshotSummary({ labId: 'quadratic', state: { a: -2, b: 0, c: 3 }, lang: 'zh' }), 'y = -2x² + 3');
    assert.equal(snapshotSummary({ labId: 'linear', state: { k: 2, b: -3 }, lang: 'zh' }), 'y = 2x − 3');
    assert.match(snapshotSummary({ labId: 'ohm', state: { u: 6, r: 10, i: 0.6 }, lang: 'zh' }), /U=6 V · R=10 Ω · I=0\.6 A/);
  });

  test('分享正文：包含实验名、工况、阶段与链接；无快照链接时措辞降级', () => {
    const text = buildLabShareText({
      labName: { zh: '二次函数', en: 'Quadratic Functions' },
      labId: 'quadratic',
      state: { stage: 'explore', a: -2, b: 0, c: 3 },
      url: 'https://stem.irky.dev/lab/quadratic?stage=explore&a=-2&b=0&c=3',
      lang: 'zh',
      restorable: true,
    });
    assert.match(text, /二次函数/);
    assert.match(text, /y = -2x² \+ 3/);
    assert.match(text, /探索阶段/);
    assert.match(text, /打开即刻复现/);
    const noSnap = buildLabShareText({
      labName: { zh: '欧姆定律', en: "Ohm's Law" }, labId: 'ohm',
      state: { stage: 'explore', u: 6, r: 10, i: 0.6 },
      url: 'https://stem.irky.dev/lab/ohm', lang: 'zh', restorable: false,
    });
    assert.match(noSnap, /打开实验页/);
  });

  test('URL 快照判定：带 stage/核心参数为真，普通页面为假', () => {
    assert.equal(urlHasSnapshot('https://stem.irky.dev/lab/quadratic?stage=explore&a=-2'), true);
    assert.equal(urlHasSnapshot('https://stem.irky.dev/lab/ohm?u=6'), true);
    assert.equal(urlHasSnapshot('https://stem.irky.dev/lab/ohm'), false);
  });

  test('临界点：离开刻度不误触发，进入/穿越才触发', () => {
    assert.equal(detentCrossed(0.9, 1, [1]), true);      // 进入
    assert.equal(detentCrossed(1, 1.1, [1]), false);     // 离开
    assert.equal(detentCrossed(1, 0.9, [1]), false);     // 离开（反向）
    assert.equal(detentCrossed(0, 1.1, [1]), true);      // 穿越
    assert.equal(detentCrossed(2, 1.9, [2]), false);     // 从刻度离开
  });
}
