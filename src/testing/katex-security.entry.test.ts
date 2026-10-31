/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * KaTeX 零信任渲染契约安全断言的独立入口。
 *
 * 与既有入口同构：用例与断言全部留在注册模块 `katex-security.test.ts`，
 * 本文件只负责「登记 → 执行 → 传递退出码」，不含任何业务逻辑。
 *
 * 本进程只导入一次 `./harness`，只调用一次 `runAll()`；
 * 不导入 smoke.test.ts，不加载计算引擎，也不依赖任何其他测试先执行。
 *
 * 运行：npx tsx src/testing/katex-security.entry.test.ts
 */
import { describe, runAll, test } from './harness';
import { registerKatexSecurityTests } from './katex-security.test';

describe('KaTeX 零信任渲染契约（安全边界）', () => {
  registerKatexSecurityTests(test);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
