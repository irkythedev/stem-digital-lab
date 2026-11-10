/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台求解器属性测试的入口：只做「登记 → 执行 → 传递退出码」。
 * 用例全在 `circuit-property.suite.ts`，本文件不含任何断言。
 *
 * 运行：npx tsx src/testing/suites/physics/circuit-property.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerCircuitPropertyTests } from './circuit-property.suite';

await runEntry({
  suite: '回路属性 · 电学工作台求解器不变量',
  register: registerCircuitPropertyTests,
});
