/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学数值稳定性测试独立入口。
 *
 * 与 `math-pure.entry.test.ts` / `circuit-bench.entry.test.ts` 同构：
 * 业务用例与断言全部留在 `./math-stability.test.ts`（注册模块），本文件只负责
 * 「登记 → 执行 → 传递退出码」，不含任何业务逻辑。
 *
 * 本进程只导入一次 `src/testing/harness.ts`，只调用一次 `runAll()`；
 * 不导入 smoke.test.ts，不做任何引擎初始化或全局 setup，也不读源码文件。
 *
 * 套件名与迁移前 smoke.test.ts 中的 describe 同名——该套件在本入口与 smoke
 * 中各持有不同用例（本入口只有纯计算用例）。
 *
 * 运行：npx tsx src/labs/math/math-stability.entry.test.ts
 */
import { describe, runAll, test } from '../../testing/harness';
import { registerMathStabilityTests } from './math-stability.test';

describe('数学模块数值稳定性与题库守卫', () => {
  registerMathStabilityTests(test);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
