/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 本地历史保留上限与用量统计守卫入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./ai-storage-usage.suite.ts`（注册模块），本文件不含业务逻辑。
 *
 * 运行：npx tsx src/testing/suites/storage/ai-storage-usage.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerAiStorageUsageTests } from './ai-storage-usage.suite';

await runEntry({
  suite: '本地历史存储 · 可配置上限 / FIFO / 用量统计',
  register: registerAiStorageUsageTests,
});
