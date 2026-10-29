/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学题库注册表守卫的独立入口。
 *
 * 与 `math-pure.entry.test.ts` / `math-stability.entry.test.ts` /
 * `math-source-guards.entry.test.ts` / `circuit-bench.entry.test.ts` 同构：
 * 业务用例与断言全部留在 `src/testing/math-question-bank-guards.test.ts`（注册模块），
 * 本文件只负责「登记 → 执行 → 传递退出码」，不含任何业务逻辑。
 *
 * 本进程只导入一次 `src/testing/harness.ts`，只调用一次 `runAll()`；
 * 不导入 smoke.test.ts，不做引擎初始化，也不依赖任何其他测试先执行。
 *
 * 套件名与迁移前 smoke.test.ts 中的 describe 完全一致，便于逐项比用例名集合；
 * 该套件现在分布在三处（本入口 / math-stability 入口 / math-source-guards 入口 / smoke
 * 保留部分），与先例相同。
 *
 * 路径基准：注册模块用 `repoPath()` 从自身位置推导仓库根，不依赖 `process.cwd()`，
 * 因此本入口从仓库根与 `/tmp` 启动结果一致。
 *
 * 运行：npx tsx src/labs/math/math-question-bank-guards.entry.test.ts
 */
import { describe, runAll, test } from '../../testing/harness';
import { registerMathQuestionBankGuardsTests } from '../../testing/math-question-bank-guards.test';

describe('数学模块数值稳定性与题库守卫', () => {
  registerMathQuestionBankGuardsTests(test);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
