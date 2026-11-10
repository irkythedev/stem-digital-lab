/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * Feedback push path 的独立入口（每次提交只推送一次）：只做
 * 「登记 → 执行 → 传递退出码」。用例与断言全部在
 * `./feedback-push-path.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 * 注册函数需要第二个参数 `testAsync`，这里用箭头包一层；入口本身不含业务逻辑。
 *
 * 运行：npx tsx src/testing/suites/shell/feedback-push-path.test.ts
 */
import { testAsync } from '../../harness';
import { runEntry } from '../../run-entry';
import { registerFeedbackPushPathTests } from './feedback-push-path.suite';

await runEntry({
  suite: '反馈推送 · 每次提交仅一次',
  register: (test) => registerFeedbackPushPathTests(test, testAsync),
});
