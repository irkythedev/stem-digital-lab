/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 浮层标题 / 问题行化学式排印守卫的独立入口。
 *
 * 与既有入口同构：用例与断言全部留在注册模块，本文件只负责
 * 「登记 → 执行 → 传递退出码」，不含任何业务逻辑。
 * 只导入一次 `src/testing/harness.ts`，只调用一次 `runAll()`。
 *
 * 运行：npx tsx src/testing/ai-heading-formatting.entry.test.ts
 */
import { describe, runAll, test } from './harness';
import { registerAiHeadingFormattingTests } from './ai-heading-formatting.test';

describe('AI 浮层标题 / 问题行化学式排印（防二次回归）', () => {
  registerAiHeadingFormattingTests(test);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
