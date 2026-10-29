/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学源码守卫测试独立入口。
 *
 * 与 `math-pure.entry.test.ts` / `math-stability.entry.test.ts` /
 * `circuit-bench.entry.test.ts` 同构：业务用例与断言全部留在
 * `src/testing/math-source-guards.test.ts`（注册模块），本文件只负责
 * 「登记 → 执行 → 传递退出码」，不含任何业务逻辑。
 *
 * 本进程只导入一次 `src/testing/harness.ts`，只调用一次 `runAll()`；
 * 不导入 smoke.test.ts，不做引擎初始化，也不读源码文件。
 *
 * 套件名与迁移前 smoke.test.ts 中的 describe 完全一致，便于逐项比用例名集合；
 * 该套件现在分布在三处（本入口 / math-stability 入口 / smoke 保留部分），
 * 与 math-stability 先例相同。
 *
 * 路径基准：本入口从任意工作目录启动都可运行——注册模块用 `repoPath()` 从自身
 * 位置推导仓库根，不依赖 `process.cwd()`。已验证从仓库根与 `/tmp` 启动结果一致。
 *
 * 运行：npx tsx src/labs/math/math-source-guards.entry.test.ts
 */
import { describe, runAll, test } from '../../testing/harness';
import { registerMathSourceGuardsTests } from '../../testing/math-source-guards.test';

describe('数学模块数值稳定性与题库守卫', () => {
  registerMathSourceGuardsTests(test);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
