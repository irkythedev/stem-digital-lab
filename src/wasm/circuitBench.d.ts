/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * src/wasm/circuitBench.js 的类型声明（仅类型，不假装有 glue）。
 *
 * 产物由 scripts/build-wasm-circuit.sh 用 em++ 编译（-O3 -s SINGLE_FILE
 * -s MODULARIZE=1 -s EXPORT_NAME=createCircuitBenchModule -s EXPORT_ES6）生成：
 * 单文件 ESM，默认导出 factory，调用后返回 Embind 导出的 bench_solve。
 * 本机无 em++ / 未生成产物时，circuit-bench-engine.ts 的动态 import 会失败并
 * 静默回退 TS 求解器。
 *
 * bench_solve 返回 [status, v0 … v_{n-1}]：status=0 收敛，1 奇异/非有限。
 * 导出必须与 cpp/circuit_bench_core.cpp 的 EMSCRIPTEN_BINDINGS 保持一致。
 */

declare const factory: (opts?: unknown) => Promise<{
  bench_solve(
    n: number,
    ground: number,
    srcA: ArrayLike<number>,
    srcB: ArrayLike<number>,
    emf: ArrayLike<number>,
    srcR: ArrayLike<number>,
    resA: ArrayLike<number>,
    resB: ArrayLike<number>,
    conductance: ArrayLike<number>,
  ): Float64Array | number[];
}>;

export default factory;
