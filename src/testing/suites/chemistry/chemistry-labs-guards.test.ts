/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学实验「学术级硬伤」回归守卫的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./chemistry-labs-guards.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 * 路径基准由注册模块的 `repoPath()` 从模块位置推导，与 `process.cwd()` 无关。
 *
 * 运行：npx tsx src/testing/suites/chemistry/chemistry-labs-guards.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerChemistryLabsTests } from './chemistry-labs-guards.suite';

await runEntry({
  suite: '化学实验守卫 · 学术级硬伤回归',
  register: registerChemistryLabsTests,
});
