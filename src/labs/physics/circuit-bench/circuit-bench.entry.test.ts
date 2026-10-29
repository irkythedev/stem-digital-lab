/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * Circuit Bench 独立测试入口。
 *
 * 拆分前，本套件由 `src/smoke.test.ts` 顶层调用 `registerCircuitBenchTests(test, skip)`
 * 登记，与其余 60 多个 describe 共用同一个 harness 实例和同一个 `runAll()`。
 * 现在它有自己的进程、自己的 harness 模块实例（每个入口只导入一次 harness）、
 * 并且只调用一次 `runAll()`——这正是「一份业务测试文件、一个独立 harness、
 * 一个 runAll()」的最小样本。
 *
 * 业务用例与断言全部留在 `./circuit-bench.test.ts`（注册模块），本文件只负责
 * 「登记 → 执行 → 传递退出码」，不含任何业务逻辑。
 *
 * 运行：npx tsx src/labs/physics/circuit-bench/circuit-bench.entry.test.ts
 */
import { describe, skip, test, runAll } from '../../../testing/harness';
import { registerCircuitBenchTests } from './circuit-bench.test';

// 套件名与拆分前 smoke 中的 describe 完全一致，便于逐项比用例名集合。
describe('Circuit Bench · 电学工作台 M1', () => {
  registerCircuitBenchTests(test, skip);
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
