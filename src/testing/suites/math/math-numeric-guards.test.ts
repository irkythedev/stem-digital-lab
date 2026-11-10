/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学模块数值稳定性与题库守卫的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./math-numeric-guards.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 * 路径基准由注册模块的 `repoPath()` 从模块位置推导，与 `process.cwd()` 无关。
 *
 * 运行：npx tsx src/testing/suites/math/math-numeric-guards.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerMathNumericGuardTests } from './math-numeric-guards.suite';

await runEntry({
  suite: '数学数值守卫 · 稳定性与题库',
  register: registerMathNumericGuardTests,
});
