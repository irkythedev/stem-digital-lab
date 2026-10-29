/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * Feedback queue的独立入口。
 *
 * 用例与断言全部留在 `src/testing/feedback-queue-storage.test.ts`（注册模块），本文件只负责
 * 「登记 → 执行 → 传递退出码」，不含任何业务逻辑。
 *
 * 注意：套件内的用例会临时替换 `globalThis.window`（必要时还有 `globalThis.fetch`），
 * 并在 `finally` 里还原；因此本进程内的用例必须串行执行，不得与其它用例并发。
 * `runAll()` 是逐个 await，满足该前提。
 *
 * 套件名与迁移前 smoke.test.ts 中的 describe 完全一致，便于逐项比用例名集合。
 *
 * 运行：npx tsx src/lib/feedback-queue-storage.entry.test.ts
 */
import { describe, runAll, test } from '../testing/harness';
import { registerFeedbackQueueStorageTests } from '../testing/feedback-queue-storage.test';

describe('Feedback queue (localStorage persistence)', () => {
  registerFeedbackQueueStorageTests(test);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
