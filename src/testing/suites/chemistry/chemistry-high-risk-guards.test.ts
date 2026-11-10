/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学模块高危边界加固的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./chemistry-high-risk-guards.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 * 路径基准由注册模块的 `repoPath()` 从模块位置推导，与 `process.cwd()` 无关。
 *
 * 运行：npx tsx src/testing/suites/chemistry/chemistry-high-risk-guards.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerChemistryHighRiskTests } from './chemistry-high-risk-guards.suite';

await runEntry({
  suite: '化学高危边界 · 动画连续性 / 量程钳位 / 题库认知平衡',
  register: registerChemistryHighRiskTests,
});
