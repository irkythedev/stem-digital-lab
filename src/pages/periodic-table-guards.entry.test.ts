/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 周期表页面守卫的独立入口。
 *
 * 与既有八个入口同构：用例与断言全部留在 `src/testing/periodic-table-guards.test.ts`
 * （注册模块），本文件只负责「登记 → 执行 → 传递退出码」，不含任何业务逻辑。
 *
 * 本进程只导入一次 `src/testing/harness.ts`，只调用一次 `runAll()`；
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 *
 * 套件名与迁移前 smoke.test.ts 中的 describe 完全一致，便于逐项比用例名集合。
 * 路径基准由注册模块的 `repoPath()` 从模块位置推导，与 `process.cwd()` 无关。
 *
 * 注意：套件内含 1 个 `testAsync` 用例（原「⑯ 欢迎弹窗…」），它会在用例内临时替换
 * `globalThis.window` / `globalThis.fetch` / `globalThis.navigator` 并在 finally 中还原，
 * 因此本文件不得与其他用例并发执行（`npm test` 是串行链，满足该前提）。
 *
 * 运行：npx tsx src/pages/periodic-table-guards.entry.test.ts
 */
import { describe, runAll, test, testAsync } from '../testing/harness';
import { registerPeriodicTableTests } from '../testing/periodic-table-guards.test';

describe('周期表：离线包行内化 / 展台去硬包裹 / 3D 空间模型', () => {
  registerPeriodicTableTests(test, testAsync);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
