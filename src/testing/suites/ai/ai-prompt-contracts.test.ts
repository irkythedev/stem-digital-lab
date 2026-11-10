/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI prompt contracts 的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./ai-prompt-contracts.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 * 路径基准由注册模块的 `repoPath()` 从模块位置推导，与 `process.cwd()` 无关。
 *
 * 运行：npx tsx src/testing/suites/ai/ai-prompt-contracts.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerAiPromptContractsTests } from './ai-prompt-contracts.suite';

await runEntry({
  suite: 'AI 提示词契约 · 角色与结构约束',
  register: registerAiPromptContractsTests,
});
