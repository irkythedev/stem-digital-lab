/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 本地存储契约套件的入口：只做「登记 → 执行 → 传递退出码」。
 * 用例全在 `contract.suite.ts`，本文件不含任何断言。
 *
 * 运行：npx tsx src/testing/suites/storage/contract.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerStorageContractTests } from './contract.suite';

await runEntry({
  suite: '本地存储契约 · 问答历史 / 考考你历史 / 反馈队列',
  register: registerStorageContractTests,
});
