/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 思考强度档位的独立入口。
 *
 * 与既有十四个入口同构：用例与断言全部留在注册模块，本文件只负责
 * 「登记 → 执行 → 传递退出码」，不含任何业务逻辑。
 *
 * 本进程只导入一次 `src/testing/harness.ts`，只调用一次 `runAll()`；
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 *
 * 套件名与迁移前 smoke.test.ts 中的 describe 完全一致，便于逐项比用例名集合。
 * 路径基准由注册模块的 `repoPath()` 从模块位置推导，与 `process.cwd()` 无关。
 *
 * 运行：npx tsx src/lib/ai-thinking-tiers.entry.test.ts
 */
import { describe, runAll, test, testAsync } from '../testing/harness';
import { registerAiThinkingTiersTests } from '../testing/ai-thinking-tiers.test';

describe('AI 思考强度档位（逐模型能力表；教学伦理：只调思考深度，不改提示词约束）', () => {
  registerAiThinkingTiersTests(test, testAsync);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
