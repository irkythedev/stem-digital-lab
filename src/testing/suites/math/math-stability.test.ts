/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学数值稳定性测试独立入口：只做「登记 → 执行 → 传递退出码」。
 * 业务用例与断言全部在 `./math-stability.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不做任何引擎初始化或全局 setup，也不读源码文件。
 *
 * 本入口与 `math-numeric-guards.test.ts` 曾共用同一个套件名，
 * 这里改为独立名称，保证「套件名唯一」的约定成立。
 *
 * 运行：npx tsx src/testing/suites/math/math-stability.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerMathStabilityTests } from './math-stability.suite';

await runEntry({
  suite: '数学稳定性 · 纯计算用例',
  register: registerMathStabilityTests,
});
