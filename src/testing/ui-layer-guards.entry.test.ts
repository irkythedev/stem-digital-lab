/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * UI 审计回归的独立入口：登记 → 执行 → 传递退出码，不含业务逻辑。
 *
 * 运行：npx tsx src/testing/ui-layer-guards.entry.test.ts
 */
import { describe, runAll, test } from './harness';
import { registerUiLayerGuardsTests } from './ui-layer-guards.test';

describe('UI 审计回归（更新链路 / 浮层层级 / 键盘可达）', () => {
  registerUiLayerGuardsTests(test);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
