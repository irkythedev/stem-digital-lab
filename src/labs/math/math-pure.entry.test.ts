/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学纯函数测试独立入口。
 *
 * 与 `src/labs/physics/circuit-bench/circuit-bench.entry.test.ts` 同构：
 * 业务用例与断言全部留在 `./math-pure.test.ts`（注册模块），本文件只负责
 * 「登记 → 执行 → 传递退出码」，不含任何业务逻辑。
 *
 * 本进程只导入一次 `src/testing/harness.ts`，只调用一次 `runAll()`；
 * 不导入 smoke.test.ts，也不做任何引擎初始化或全局 setup。
 *
 * 套件名与迁移前 smoke.test.ts 中的 describe 完全一致，便于逐项比用例名集合。
 *
 * 运行：npx tsx src/labs/math/math-pure.entry.test.ts
 */
import { describe, runAll, test } from '../../testing/harness';
import { registerMathPureTests } from './math-pure.test';

describe('Math model: quadratic sampling', () => {
  registerMathPureTests(test);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
