/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * Circuit Bench 独立测试入口：只做「登记 → 执行 → 传递退出码」。
 *
 * 拆分前，本套件由 `src/smoke.test.ts` 顶层调用 `registerCircuitBenchTests(test, skip)`
 * 登记，与其余 60 多个 describe 共用同一个 harness 实例和同一个 `runAll()`。
 * 现在它有自己的进程、自己的 harness 模块实例，并且只调用一次 `runAll()`。
 *
 * 业务用例与断言全部在 `./circuit-bench.test.ts`（注册模块）。注册函数需要第二个
 * 参数 `skip`，因此这里用箭头包一层；入口本身仍不含业务逻辑。
 *
 * 运行：npx tsx src/labs/physics/circuit-bench/circuit-bench.entry.test.ts
 */
import { skip } from '../../../testing/harness';
import { runEntry } from '../../../testing/run-entry';
import { registerCircuitBenchTests } from './circuit-bench.test';

await runEntry({
  suite: '电学工作台 · M1 求解器与交互',
  register: (test) => registerCircuitBenchTests(test, skip),
});
