/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 深水区修复回归的独立入口（化学式 tokenizer + 外电路等效电阻公式）：只做
 * 「登记 → 执行 → 传递退出码」。用例与断言全部在 `./deep-fixes.suite.ts`（注册模块）。
 *
 * 运行：npx tsx src/testing/suites/regressions/deep-fixes.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerDeepFixTests } from './deep-fixes.suite';

await runEntry({
  suite: '深水区修复 · 化学式排印与外电路等效电阻',
  register: registerDeepFixTests,
});
