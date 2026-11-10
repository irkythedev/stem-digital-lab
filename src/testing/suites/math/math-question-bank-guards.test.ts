/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学题库注册表守卫的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 业务用例与断言全部在 `./math-question-bank-guards.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不做引擎初始化，也不依赖任何其他测试先执行。
 *
 * 套件名原与 math-stability / math-source-guards 共用
 * `数学模块数值稳定性与题库守卫`；本入口只覆盖题库注册表约束，故拆为独立名称。
 *
 * 路径基准：注册模块用 `repoPath()` 从自身位置推导仓库根，不依赖 `process.cwd()`，
 * 因此本入口从仓库根与 `/tmp` 启动结果一致。
 *
 * 运行：npx tsx src/testing/suites/math/math-question-bank-guards.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerMathQuestionBankGuardsTests } from './math-question-bank-guards.suite';

await runEntry({
  suite: '数学题库守卫 · 注册表与正解分布',
  register: registerMathQuestionBankGuardsTests,
});
