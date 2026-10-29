/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 错题学情「错误类型归类」守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe，**整组 4 个用例一次迁出**。
 * 用例名、断言与执行顺序与迁移前逐字相同；本套件零文件读取、零 DOM、零 async。
 *
 * 样本构造器 `qh()` 原本是 smoke 的文件级函数，三组 Quiz summary 共用，现收敛到
 * `./quiz-summary-fixtures`（三组同批迁出后才没有第二个使用者）。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import type { TestFn } from './harness';
import { qh } from './quiz-summary-fixtures';
import { computeErrorKinds } from '../lib/quiz-summary';

export function registerQuizSummaryErrorKindsTests(test: TestFn): void {
  test('超时未答归为 timeout', () => {
    const kinds = computeErrorKinds([qh({ correct: false, pickedIdx: -1, timedOut: true })]);
    assert.equal(kinds.timeout, 1);
    assert.equal(kinds.plain, 0);
  });

  test('同科同知识点反复选同一干扰项归为 confuse', () => {
    const kinds = computeErrorKinds([
      qh({ correct: false, answerIdx: 1, pickedIdx: 0, elapsedMs: 5000 }),
      qh({ correct: false, answerIdx: 1, pickedIdx: 0, elapsedMs: 5500 }),
    ]);
    assert.equal(kinds.confuse, 2);
    assert.equal(kinds.plain, 0);
  });

  test('慢（≥中位数×2）归 slow，快（≤中位数×0.5）归 fast', () => {
    const kinds = computeErrorKinds([
      qh({ correct: false, answerIdx: 1, pickedIdx: 0, elapsedMs: 10000, topic: 'A' }),
      qh({ correct: false, answerIdx: 1, pickedIdx: 2, elapsedMs: 1000, topic: 'B' }),
      qh({ correct: false, answerIdx: 1, pickedIdx: 2, elapsedMs: 5000, topic: 'C' }),
    ]);
    assert.equal(kinds.slow, 1);
    assert.equal(kinds.fast, 1);
    assert.equal(kinds.plain, 1);
  });

  test('正确题不进入错误归类', () => {
    const kinds = computeErrorKinds([qh({ correct: true })]);
    assert.equal(kinds.timeout + kinds.confuse + kinds.slow + kinds.fast + kinds.plain, 0);
  });
}
