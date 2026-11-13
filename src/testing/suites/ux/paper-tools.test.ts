/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 纸墨工具组独立入口：只做「登记 → 执行 → 传递退出码」。
 */
import { runEntry } from '../../run-entry';
import { registerPaperToolsTests } from './paper-tools.suite';

await runEntry({
  suite: '纸墨工具组 · 速查 / 刻度 / 快照 / 定格',
  register: registerPaperToolsTests,
});
