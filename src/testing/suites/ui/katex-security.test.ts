/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * KaTeX 零信任渲染契约安全断言的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./katex-security.suite.ts`（注册模块），本文件不含业务逻辑。
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 *
 * 运行：npx tsx src/testing/suites/ui/katex-security.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerKatexSecurityTests } from './katex-security.suite';

await runEntry({
  suite: 'KaTeX 渲染契约 · 零信任安全边界',
  register: registerKatexSecurityTests,
});
