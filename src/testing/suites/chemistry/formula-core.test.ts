/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学式与化合价内核黄金样例的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./formula-core.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不做引擎初始化，也不依赖任何其他测试先执行。
 *
 * 路径基准：注册模块从自身位置导入内核与数据表，不依赖 `process.cwd()`，
 * 因此本入口从仓库根与 `/tmp` 启动结果一致。
 *
 * 运行：npx tsx src/testing/suites/chemistry/formula-core.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerFormulaCoreTests } from './formula-core.suite';

await runEntry({
  suite: '化学式内核 · 化合价与大小写规范化',
  register: registerFormulaCoreTests,
});
