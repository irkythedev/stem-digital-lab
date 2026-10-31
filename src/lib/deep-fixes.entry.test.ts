/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 深水区修复回归的独立入口（化学式 tokenizer + 外电路等效电阻公式）。
 * 用例与断言在 `src/testing/deep-fixes.test.ts`，本文件只负责「登记 → 执行 → 传递退出码」。
 *
 * 运行：npx tsx src/lib/deep-fixes.entry.test.ts
 */
import { describe, runAll, test } from '../testing/harness';
import { registerDeepFixTests } from '../testing/deep-fixes.test';

describe('Deep fixes (chem formula typography & external equivalent resistance)', () => {
  registerDeepFixTests(test);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
