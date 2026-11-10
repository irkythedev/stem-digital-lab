/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 周期表页面守卫的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./periodic-table-guards.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 * 路径基准由注册模块的 `repoPath()` 从模块位置推导，与 `process.cwd()` 无关。
 *
 * 注意：套件内含 1 个 `testAsync` 用例（原「⑯ 欢迎弹窗…」），它会在用例内临时替换
 * `globalThis.window` / `globalThis.fetch` / `globalThis.navigator` 并在 finally 中还原，
 * 因此本文件不得与其他用例并发执行（`npm test` 是串行链，满足该前提）。
 * 注册函数需要第二个参数 `testAsync`，这里用箭头包一层；入口本身仍不含业务逻辑。
 *
 * 运行：npx tsx src/testing/suites/pages/periodic-table-guards.test.ts
 */
import { testAsync } from '../../harness';
import { runEntry } from '../../run-entry';
import { registerPeriodicTableTests } from './periodic-table-guards.suite';

await runEntry({
  suite: '周期表 · 离线包行内化 / 展台去硬包裹 / 3D 空间模型',
  register: (test) => registerPeriodicTableTests(test, testAsync),
});
