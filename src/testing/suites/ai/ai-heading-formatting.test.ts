/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 浮层标题 / 问题行化学式排印守卫的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./ai-heading-formatting.suite.ts`（注册模块），本文件不含业务逻辑。
 *
 * 运行：npx tsx src/testing/suites/ai/ai-heading-formatting.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerAiHeadingFormattingTests } from './ai-heading-formatting.suite';

await runEntry({
  suite: 'AI 浮层排印 · 标题与问题行化学式',
  register: registerAiHeadingFormattingTests,
});
