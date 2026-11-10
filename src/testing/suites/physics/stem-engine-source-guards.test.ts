/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学门面源码守卫的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 业务用例与断言全部在 `./stem-engine-source-guards.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不加载计算引擎（本守卫只读源码文本，与引擎状态无关），
 * 也不依赖任何其他测试先执行。
 *
 * 本入口只迁了与引擎状态无关的源码守卫；同套件另外 3 个依赖 `loadOhmEngine()`
 * 模块级状态的用例仍留在 smoke 中，故套件名改为独立的源码守卫名称。
 *
 * 路径基准：注册模块用 `repoPath()` 从自身位置推导仓库根，不依赖 `process.cwd()`，
 * 因此本入口从仓库根与 `/tmp` 启动结果一致。
 *
 * 运行：npx tsx src/testing/suites/physics/stem-engine-source-guards.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerStemEngineSourceGuardsTests } from './stem-engine-source-guards.suite';

await runEntry({
  suite: 'STEM 引擎源码守卫 · 电学门面边界兜底',
  register: registerStemEngineSourceGuardsTests,
});
