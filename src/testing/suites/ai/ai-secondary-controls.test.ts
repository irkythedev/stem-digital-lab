/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 次级控件的独立入口（视觉实体 ≤28px，触屏热区由 tap-area 承托）：只做
 * 「登记 → 执行 → 传递退出码」。用例与断言全部在
 * `./ai-secondary-controls.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 * 路径基准由注册模块的 `repoPath()` 从模块位置推导，与 `process.cwd()` 无关。
 *
 * 运行：npx tsx src/testing/suites/ai/ai-secondary-controls.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerAiSecondaryControlsTests } from './ai-secondary-controls.suite';

await runEntry({
  suite: 'AI 次级控件 · 28px 视觉实体与触屏热区',
  register: registerAiSecondaryControlsTests,
});
