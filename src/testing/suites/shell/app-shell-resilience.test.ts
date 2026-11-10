/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 应用外壳韧性的独立入口（chunk 自救 + 反馈自动补传）：只做
 * 「登记 → 执行 → 传递退出码」。用例与断言全部在
 * `./app-shell-resilience.suite.ts`（注册模块）。不启动浏览器、不访问网络。
 *
 * 运行：npx tsx src/testing/suites/shell/app-shell-resilience.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerAppShellResilienceTests } from './app-shell-resilience.suite';

await runEntry({
  suite: '应用外壳韧性 · chunk 自救与反馈补传',
  register: registerAppShellResilienceTests,
});
