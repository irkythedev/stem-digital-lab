/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 思考参数下发 · 留痕与实发同源的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./ai-thinking-dispatch.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 * 路径基准由注册模块的 `repoPath()` 从模块位置推导，与 `process.cwd()` 无关。
 *
 * 运行：npx tsx src/testing/suites/ai/ai-thinking-dispatch.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerAiThinkingDispatchTests } from './ai-thinking-dispatch.suite';

await runEntry({
  suite: 'AI 思考下发 · 留痕与实发同源',
  register: registerAiThinkingDispatchTests,
});
