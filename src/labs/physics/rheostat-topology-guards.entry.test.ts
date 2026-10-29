/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 滑动变阻器「一上一下」结构与直角走线守卫的独立入口。
 *
 * 用例与断言全部留在 `src/testing/rheostat-topology-guards.test.ts`（注册模块），本文件只负责
 * 「登记 → 执行 → 传递退出码」，不含任何业务逻辑。
 *
 * 本进程只导入一次 `src/testing/harness.ts`，只调用一次 `runAll()`；
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 *
 * 套件名与迁移前 smoke.test.ts 中的 describe 完全一致，便于逐项比用例名集合。
 * 路径基准由注册模块的 `repoPath()` 从模块位置推导，与 `process.cwd()` 无关。
 *
 * 运行：npx tsx src/labs/physics/rheostat-topology-guards.entry.test.ts
 */
import { describe, runAll, test } from '../../testing/harness';
import { registerRheostatTopologyTests } from '../../testing/rheostat-topology-guards.test';

describe('滑动变阻器「一上一下」结构与直角走线守卫', () => {
  registerRheostatTopologyTests(test);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
