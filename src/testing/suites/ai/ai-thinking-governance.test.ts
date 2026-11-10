/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 思考治理守卫的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./ai-thinking-governance.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 * 注册函数需要第二个参数 `testAsync`，这里用箭头包一层；入口本身不含业务逻辑。
 *
 * 运行：npx tsx src/testing/suites/ai/ai-thinking-governance.test.ts
 */
import { testAsync } from '../../harness';
import { runEntry } from '../../run-entry';
import { registerAiThinkingGovernanceTests } from './ai-thinking-governance.suite';

await runEntry({
  suite: 'AI 思考治理 · 任务分级 / 上下文清洗 / 防冗余',
  register: (test) => registerAiThinkingGovernanceTests(test, testAsync),
});
