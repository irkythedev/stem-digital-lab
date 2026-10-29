/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学门面源码守卫的独立入口。
 *
 * 与 `math-pure` / `math-stability` / `math-source-guards` /
 * `math-question-bank-guards` / `circuit-bench` 五个入口同构：业务用例与断言全部留在
 * `src/testing/stem-engine-source-guards.test.ts`（注册模块），本文件只负责
 * 「登记 → 执行 → 传递退出码」，不含任何业务逻辑。
 *
 * 本进程只导入一次 `src/testing/harness.ts`，只调用一次 `runAll()`；
 * 不导入 smoke.test.ts，不加载计算引擎（本守卫只读源码文本，与引擎状态无关），
 * 也不依赖任何其他测试先执行。
 *
 * 套件名与迁移前 smoke.test.ts 中的 describe 完全一致，便于逐项比用例名集合；
 * 该套件现在分布在两处（本入口 1 条源码守卫 / smoke 保留 3 条依赖引擎状态的纯函数用例），
 * 与 `math-stability`、`math-source-guards` 的先例相同。
 *
 * 路径基准：注册模块用 `repoPath()` 从自身位置推导仓库根，不依赖 `process.cwd()`，
 * 因此本入口从仓库根与 `/tmp` 启动结果一致。
 *
 * 运行：npx tsx src/labs/physics/stem-engine-source-guards.entry.test.ts
 */
import { describe, runAll, test } from '../../testing/harness';
import { registerStemEngineSourceGuardsTests } from '../../testing/stem-engine-source-guards.test';

describe('Physics 电学门面（应用真实调用点）：边界兜底与采样口径', () => {
  registerStemEngineSourceGuardsTests(test);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
