/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI thinking stream 的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./ai-thinking-stream.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 * 注册函数需要第二个参数 `testAsync`，这里用箭头包一层；入口本身不含业务逻辑。
 *
 * 运行：npx tsx src/testing/suites/ai/ai-thinking-stream.test.ts
 */
import { testAsync } from '../../harness';
import { runEntry } from '../../run-entry';
import { registerAiThinkingStreamTests } from './ai-thinking-stream.suite';

await runEntry({
  suite: 'AI 思考流 · 仅展示',
  register: (test) => registerAiThinkingStreamTests(test, testAsync),
});
