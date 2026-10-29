/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 应用外壳韧性的独立入口（chunk 自救 + 反馈自动补传）。
 *
 * 用例与断言在 `src/testing/app-shell-resilience.test.ts`，本文件只负责
 * 「登记 → 执行 → 传递退出码」。不启动浏览器、不访问网络。
 *
 * 运行：npx tsx src/lib/app-shell-resilience.entry.test.ts
 */
import { describe, runAll, test } from '../testing/harness';
import { registerAppShellResilienceTests } from '../testing/app-shell-resilience.test';

describe('App shell resilience (chunk recovery & feedback auto-flush)', () => {
  registerAppShellResilienceTests(test);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
