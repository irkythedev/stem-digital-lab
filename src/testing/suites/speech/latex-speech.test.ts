/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * LaTeX → TTS 朗读断言的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./latex-speech.suite.ts`（注册模块），本文件不含业务逻辑。
 * 不导入 smoke.test.ts，不读文件，也不依赖任何其他测试先执行。
 * 用例名与迁移前 smoke.test.ts 的套件一致，便于逐项比对。
 *
 * 运行：npx tsx src/testing/suites/speech/latex-speech.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerLatexTtsTests } from './latex-speech.suite';

await runEntry({
  suite: 'LaTeX 朗读 · TTS 转换断言',
  register: registerLatexTtsTests,
});
