/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 思考治理守卫的独立入口：
 * 用例与断言全部在注册模块，本文件只负责「登记 → 执行 → 传递退出码」。
 * 只导入一次 harness，只调用一次 runAll()。
 *
 * 运行：npx tsx src/testing/ai-thinking-governance.entry.test.ts
 */
import { describe, runAll, test, testAsync } from './harness';
import { registerAiThinkingGovernanceTests } from './ai-thinking-governance.test';

describe('AI 思考治理：任务分级派发 + 上下文清洗 + 防冗余提示', () => {
  registerAiThinkingGovernanceTests(test, testAsync);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
