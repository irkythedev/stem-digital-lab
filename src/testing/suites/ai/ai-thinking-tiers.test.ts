/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 思考强度档位的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./ai-thinking-tiers.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 * 注册函数需要第二个参数 `testAsync`，这里用箭头包一层；入口本身不含业务逻辑。
 *
 * 教学伦理：只调思考深度，不改提示词约束——该约束由注册模块内的用例守护。
 *
 * 运行：npx tsx src/testing/suites/ai/ai-thinking-tiers.test.ts
 */
import { testAsync } from '../../harness';
import { runEntry } from '../../run-entry';
import { registerAiThinkingTiersTests } from './ai-thinking-tiers.suite';

await runEntry({
  suite: 'AI 思考档位 · 逐模型能力表',
  register: (test) => registerAiThinkingTiersTests(test, testAsync),
});
