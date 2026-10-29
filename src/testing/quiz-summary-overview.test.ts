/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 错题学情「科目聚合与薄弱知识点」守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe，**整组 3 个用例一次迁出**。
 * 用例名、断言与执行顺序与迁移前逐字相同；本套件零文件读取、零 DOM、零 async。
 * 样本构造器 `qh()` 见 `./quiz-summary-fixtures`。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import type { TestFn } from './harness';
import { qh } from './quiz-summary-fixtures';
import { computeQuizOverview } from '../lib/quiz-summary';

export function registerQuizSummaryOverviewTests(test: TestFn): void {
  test('科目正确率按科目聚合', () => {
    const ov = computeQuizOverview([
      qh({ subject: '数学', correct: true }),
      qh({ subject: '数学', correct: false }),
      qh({ subject: '物理', correct: true }),
    ]);
    assert.equal(ov.total, 3);
    assert.equal(ov.correct, 2);
    assert.equal(ov.wrong, 1);
    assert.equal(ov.rate, 67);
    const math = ov.subjects.find((s) => s.subject === '数学')!;
    assert.equal(math.total, 2);
    assert.equal(math.rate, 50);
  });

  test('薄弱知识点 TOP 按错误数降序、截断 limit', () => {
    const ov = computeQuizOverview([
      qh({ topic: '一次函数', correct: false }),
      qh({ topic: '一次函数', correct: false }),
      qh({ topic: '二次函数', correct: false }),
      qh({ topic: '凸透镜', correct: true }),
    ], 1);
    assert.equal(ov.weakTopics.length, 1);
    assert.equal(ov.weakTopics[0].topic, '一次函数');
    assert.equal(ov.weakTopics[0].wrong, 2);
  });

  test('无错题时 weakTopics 为空', () => {
    const ov = computeQuizOverview([qh({ correct: true })]);
    assert.equal(ov.weakTopics.length, 0);
  });
}
