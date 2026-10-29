/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学实验「学术级硬伤」回归守卫的独立入口。
 *
 * 与既有六个入口同构：用例与断言全部留在 `src/testing/chemistry-labs-guards.test.ts`
 * （注册模块），本文件只负责「登记 → 执行 → 传递退出码」，不含任何业务逻辑。
 *
 * 本进程只导入一次 `src/testing/harness.ts`，只调用一次 `runAll()`；
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 *
 * 套件名与迁移前 smoke.test.ts 中的 describe 完全一致，便于逐项比用例名集合。
 * 路径基准由注册模块的 `repoPath()` 从模块位置推导，与 `process.cwd()` 无关。
 *
 * 运行：npx tsx src/labs/chemistry/chemistry-labs-guards.entry.test.ts
 */
import { describe, runAll, test } from '../../testing/harness';
import { registerChemistryLabsTests } from '../../testing/chemistry-labs-guards.test';

describe('Chemistry labs: academic hard-fault regressions', () => {
  registerChemistryLabsTests(test);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
