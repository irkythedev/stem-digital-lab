/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 浮层标题 / 问题行化学式排印守卫（注册模块，不含执行入口）。
 *
 * 回归来源：AI 抽屉顶栏标题曾带 `uppercase`，把 `Fe2O3` 渲染成 `FE203`；问题行则
 * 直接裸渲染原始 ASCII 串，未做下标规范化。本守卫锁死两点，防止二次回归：
 *   1. 顶栏标题不得再强制大写，标题/问题行必须经 `FormulaText` 规范化；
 *   2. `FormulaText` 的解析必须 useMemo 化，避免流式打字时每次重渲染都重跑正则。
 *
 * 零 DOM、零 async、纯源码断言（与 settings-layout 等守卫同构）。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { readAiPanel } from './ai-panel-source';
import { repoPath } from './repo-paths';

export function registerAiHeadingFormattingTests(test: TestFn): void {
  const ai = readAiPanel();
  const chem = readFileSync(repoPath('src/components/chemistry/ChemFormula.tsx'), 'utf8');

  test('顶栏标题容器不得含 uppercase（防 Fe 变 FE），且标题经 FormulaText 规范化', () => {
    // 标题 h2 起始标签：不得出现 uppercase（否则化学式被整段大写化）
    assert.doesNotMatch(
      ai,
      /<h2 className="text-xs font-bold tracking-widest mono-font uppercase/,
      '顶栏标题 h2 不得再带 uppercase（会把 Fe₂O₃ 渲染成 FE203）',
    );
    // 标题文本必须交给 FormulaText 做下标/大小写规范化，而不是裸字符串
    assert.match(
      ai,
      /<FormulaText text=\{view === 'settings'/,
      '顶栏标题必须经 <FormulaText> 渲染化学式',
    );
    assert.match(ai, /text-xs font-bold tracking-widest mono-font truncate max-w-\[80%\]/, '标题容器类名应去掉 uppercase 后保持原样');
  });

  test('问题行（历史 + 当前）必须经 FormulaText 规范化，不得裸渲染 ASCII 化学式', () => {
    // 两处「问题：」行均接入 FormulaText
    assert.match(
      ai,
      /'问题' : 'Question'\}: <FormulaText text=\{h\.user\}/,
      '历史问题行须经 <FormulaText> 渲染',
    );
    assert.match(
      ai,
      /'问题' : 'Question'\}: <FormulaText text=\{pending \|\| currentQuestion \|\| ''\}/,
      '当前问题行须经 <FormulaText> 渲染',
    );
    // 反例：不得回退到裸渲染
    assert.doesNotMatch(ai, /<InlineAnswer text=\{h\.user\}/, '历史问题行不得回退为裸 InlineAnswer');
    assert.doesNotMatch(ai, /<InlineAnswer text=\{pending \|\| currentQuestion \|\| ''\}/, '当前问题行不得回退为裸 InlineAnswer');
  });

  test('FormulaText 解析必须 useMemo 化（流式重渲染零重复正则）', () => {
    assert.match(
      chem,
      /const parts = useMemo<ReactNode\[\]>\(\(\) => \{/,
      'FormulaText 的 parts 解析须用 useMemo 包裹',
    );
    assert.match(
      chem,
      /\}, \[text, targetSymbol, lang, hovered\]\);/,
      'FormulaText useMemo 依赖须为 [text, targetSymbol, lang, hovered]（text 不变即复用）',
    );
  });
}
