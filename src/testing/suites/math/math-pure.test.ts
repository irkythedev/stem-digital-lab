/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学纯函数测试独立入口：只做「登记 → 执行 → 传递退出码」。
 * 业务用例与断言全部在 `./math-pure.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，也不做任何引擎初始化或全局 setup。
 *
 * 运行：npx tsx src/testing/suites/math/math-pure.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerMathPureTests } from './math-pure.suite';

await runEntry({
  suite: '数学纯函数 · 二次采样模型',
  register: registerMathPureTests,
});
