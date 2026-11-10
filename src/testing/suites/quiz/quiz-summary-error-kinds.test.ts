/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * Quiz summary — 错误类型归类的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./quiz-summary-error-kinds.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不依赖任何其他测试先执行；用例名与迁移前一致。
 *
 * 运行：npx tsx src/testing/suites/quiz/quiz-summary-error-kinds.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerQuizSummaryErrorKindsTests } from './quiz-summary-error-kinds.suite';

await runEntry({
  suite: 'Quiz summary · 错误类型归类',
  register: registerQuizSummaryErrorKindsTests,
});
