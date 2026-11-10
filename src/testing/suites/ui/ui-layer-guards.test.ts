/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * UI 审计回归的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./ui-layer-guards.suite.ts`（注册模块），本文件不含业务逻辑。
 *
 * 运行：npx tsx src/testing/suites/ui/ui-layer-guards.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerUiLayerGuardsTests } from './ui-layer-guards.suite';

await runEntry({
  suite: 'UI 审计回归 · 更新链路 / 浮层层级 / 键盘可达',
  register: registerUiLayerGuardsTests,
});
