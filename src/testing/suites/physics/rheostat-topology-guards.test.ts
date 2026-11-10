/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 滑动变阻器「一上一下」结构与直角走线守卫的独立入口：只做
 * 「登记 → 执行 → 传递退出码」。用例与断言全部在
 * `./rheostat-topology-guards.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 * 路径基准由注册模块的 `repoPath()` 从模块位置推导，与 `process.cwd()` 无关。
 *
 * 运行：npx tsx src/testing/suites/physics/rheostat-topology-guards.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerRheostatTopologyTests } from './rheostat-topology-guards.suite';

await runEntry({
  suite: '滑动变阻器 · 一上一下结构与直角走线',
  register: registerRheostatTopologyTests,
});
