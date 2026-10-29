/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * LaTeX → TTS 朗读断言的独立入口。
 *
 * 用例与断言全部留在 `src/testing/latex-tts.test.ts`（注册模块），本文件只负责
 * 「登记 → 执行 → 传递退出码」，不含任何业务逻辑。
 *
 * 本进程只导入一次 `src/testing/harness.ts`，只调用一次 `runAll()`；
 * 不导入 smoke.test.ts，不读文件，也不依赖任何其他测试先执行。
 *
 * 套件名与迁移前 smoke.test.ts 中的 describe 完全一致，便于逐项比用例名集合。
 *
 * 运行：npx tsx src/lib/latex-speech.entry.test.ts
 */
import { describe, runAll, test } from '../testing/harness';
import { registerLatexTtsTests } from '../testing/latex-tts.test';

describe('LaTeX → TTS speech conversion', () => {
  registerLatexTtsTests(test);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
