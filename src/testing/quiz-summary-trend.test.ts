/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 错题学情「趋势与 AI 输入」守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe，**整组 9 个用例一次迁出**。
 * 用例名、断言与执行顺序与迁移前逐字相同；本套件零文件读取、零 DOM、零 async。
 * 样本构造器 `qh()` 见 `./quiz-summary-fixtures`。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import type { TestFn } from './harness';
import { qh } from './quiz-summary-fixtures';
import {
  buildQuizRecordsForSummary, classifyErrorKind, computeQuizOverview,
} from '../lib/quiz-summary';

export function registerQuizSummaryTrendTests(test: TestFn): void {
  test('有记录且窗口够时给最近 vs 整体', () => {
    const ov = computeQuizOverview(
      [qh({ correct: true }), qh({ correct: false }), qh({ correct: true }), qh({ correct: true })],
      3,
      2,
    );
    assert.ok(ov.trend);
    assert.equal(ov.trend.recentCount, 2);
  });

  test('空记录时 trend 为 null', () => {
    const ov = computeQuizOverview([]);
    assert.equal(ov.trend, null);
  });

  test('overallRateOverride：筛选视图下 overall 取全量率（不与 recent 同批）', () => {
    // 模拟「仅错题」视图：entries 全是错（recent 0%），但全量正确率 40%
    const ov = computeQuizOverview(
      [qh({ correct: false, topic: 'X' }), qh({ correct: false, topic: 'Y' })],
      3,
      2,
      40,
    );
    assert.ok(ov.trend);
    assert.equal(ov.trend.recentRate, 0);
    assert.equal(ov.trend.overallRate, 40); // 来自全量，而非 entries 的 0%
  });

  test('AI 输入截断到 limit 条', () => {
    const entries = Array.from({ length: 40 }, (_, i) => qh({ correct: i % 2 === 0 }));
    const txt = buildQuizRecordsForSummary(entries, 30);
    assert.equal(txt.split('【第').length, 31);
    assert.ok(!txt.includes('【第31题】'));
  });

  test('AI 输入标记超时与选项拼接', () => {
    const txt = buildQuizRecordsForSummary([
      qh({ correct: false, timedOut: true, pickedIdx: -1, question: '超时题', options: ['x', 'y'] }),
    ]);
    assert.ok(txt.includes('（超时未答）'));
    assert.ok(txt.includes('选项：x｜y'));
    assert.ok(txt.includes('你的选择：无'));
  });

  test('AI 输入含解析讲解（有则拼接，无则不出现）', () => {
    const withExpl = buildQuizRecordsForSummary([
      qh({ correct: false, explanation: '斜率等于 k，因为 y=kx+b 中 k 是斜率。' }),
    ]);
    assert.ok(withExpl.includes('解析：斜率等于 k'));
    const noExpl = buildQuizRecordsForSummary([qh({ correct: false })]);
    assert.ok(!noExpl.includes('解析：'));
  });

  test('AI 输入空记录返回空串', () => {
    assert.equal(buildQuizRecordsForSummary([]), '');
  });

  test('AI 输入选项下标越界/非法值 clamp 回退（防 fromCharCode 怪字符/NUL）', () => {
    const txt = buildQuizRecordsForSummary([
      qh({ correct: false, pickedIdx: 999, answerIdx: -1, question: '越界', options: ['a', 'b'] }),
      qh({ correct: false, pickedIdx: NaN, answerIdx: Infinity, question: '非法', options: ['a'] }),
    ]);
    assert.ok(txt.includes('你的选择：无'));
    assert.ok(txt.includes('正确答案：未知'));
    // 不出现西里尔字母/控制字符
    assert.ok(!/[\u0400-\u04FF]/.test(txt));
    assert.ok(!txt.includes('\u0000'));
  });

  test('正确题 classifyErrorKind 返回 plain（防御）', () => {
    assert.equal(classifyErrorKind(qh({ correct: true })), 'plain');
  });
}
