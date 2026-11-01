/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 本地历史保留上限与用量统计守卫入口：
 * 用例与断言全部在注册模块，本文件只负责「登记 → 执行 → 传递退出码」。
 *
 * 运行：npx tsx src/testing/ai-storage-usage.entry.test.ts
 */
import { describe, runAll, test } from './harness';
import { registerAiStorageUsageTests } from './ai-storage-usage.test';

describe('本地历史存储：可配置上限 / FIFO / 用量统计', () => {
  registerAiStorageUsageTests(test);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
