/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · C++/WASM 门面
 *
 * 与 stem-engine.ts 相同的「全有或全无」策略：bench_solve 导出存在才启用 WASM，
 * 否则静默回退到 TS 求解器，页面不出现加载失败。
 *
 * 产物 src/wasm/circuitBench.js 由 scripts/build-wasm-circuit.sh 单独生成
 * （MODULARIZE + EXPORT_NAME=createCircuitBenchModule，默认导出是工厂函数）。
 *
 * Fault 状态码映射：C++ 返回 [status, v0 … v_{n-1}]，status=0 表示收敛，
 * status≠0 表示奇异/非有限。非 0 时本门面直接走 finalizeSolve(system, null)，
 * 与 TS 的 ok=false + warning.code='singular' 完全同构，绝不静默改判。
 */
import {
  buildCircuitSystem,
  finalizeSolve,
  solveCircuit,
  solveSystemVoltages,
  type BenchState,
  type SolveResult,
} from './circuit-bench-core';

export type CircuitEngineKind = 'ts' | 'wasm';

/** C++ Fault 状态码：0 = 收敛；1 = 奇异 / 出现非有限值。 */
export const WASM_STATUS_OK = 0;

/** Emscripten Embind 导出的端口函数（数组按值传入，返回 [status, …voltages]）。 */
export type BenchSolveFn = (
  n: number,
  ground: number,
  srcA: ArrayLike<number>,
  srcB: ArrayLike<number>,
  emf: ArrayLike<number>,
  srcR: ArrayLike<number>,
  resA: ArrayLike<number>,
  resB: ArrayLike<number>,
  conductance: ArrayLike<number>,
) => Float64Array | number[];

export interface CircuitBenchWasmModule {
  bench_solve?: BenchSolveFn;
}

export interface CircuitEngine {
  kind: CircuitEngineKind;
  solve: (state: BenchState) => SolveResult;
}

const TS_ENGINE: CircuitEngine = { kind: 'ts', solve: solveCircuit };

/** 当前生效的引擎：WASM 加载成功后整体切换，此前/失败时保持 TS。 */
let activeEngine: CircuitEngine = TS_ENGINE;

let pending: Promise<CircuitEngine> | null = null;

/** 同步读当前引擎种类（未加载完成/失败均为 'ts'）。 */
export function getCircuitEngineKind(): CircuitEngineKind {
  return activeEngine.kind;
}

/** 求解一次；WASM 结果不合法时同样回退 TS，绝不让 NaN 进入 UI。 */
export function solveWithWasm(mod: CircuitBenchWasmModule, state: BenchState): SolveResult {
  try {
    if (typeof mod.bench_solve !== 'function') return solveCircuit(state);
    const system = buildCircuitSystem(state);
    const n = system.nodes.length;
    if (n === 0) return solveCircuit(state);
    const srcA = Int32Array.from(system.sources.map((s) => s.a));
    const srcB = Int32Array.from(system.sources.map((s) => s.b));
    const emf = Float64Array.from(system.sources.map((s) => s.emf));
    const srcR = Float64Array.from(system.sources.map((s) => s.r));
    const res = system.conductors.filter((c) => !c.open);
    const resA = Int32Array.from(res.map((c) => c.a));
    const resB = Int32Array.from(res.map((c) => c.b));
    const g = Float64Array.from(res.map((c) => c.g));
    const out = mod.bench_solve(n, system.ground, srcA, srcB, emf, srcR, resA, resB, g);
    // 长度必须是 n+1（状态码 + n 个节点电压），否则视为非法产物
    if (!out || out.length !== n + 1) return solveCircuit(state);
    const status = Number(out[0]);
    if (!Number.isFinite(status)) return solveCircuit(state);
    // 奇异 / 非有限：与 TS 同构的 Fault 结果（ok=false + singular warning）
    if (status !== WASM_STATUS_OK) return finalizeSolve(system, null);
    const voltages = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const v = Number(out[i + 1]);
      if (!Number.isFinite(v)) return finalizeSolve(system, null);
      voltages[i] = v;
    }
    return finalizeSolve(system, voltages);
  } catch {
    return solveCircuit(state);
  }
}

/**
 * 动态加载构建产物 src/wasm/circuitBench.js（单独脚本生成，不影响 stemCore.js）。
 * Emscripten MODULARIZE 的默认导出是工厂函数，必须 await 之后才是模块实例。
 * 产物不存在 / 工厂抛错 / 缺 bench_solve → 静默保持 TS。
 */
export async function loadCircuitBenchEngine(): Promise<CircuitEngine> {
  if (pending) return pending;
  pending = (async (): Promise<CircuitEngine> => {
    try {
      // 本文件在 src/labs/physics/circuit-bench/：向上一级是 physics，三级才到 src/
      const href = new URL('../../../wasm/' + 'circuitBench.js', import.meta.url).href;
      const imported = (await import(/* @vite-ignore */ href)) as {
        default?: unknown;
        bench_solve?: BenchSolveFn;
      };
      const candidate = imported.default ?? imported;
      let mod: CircuitBenchWasmModule;
      if (typeof candidate === 'function') {
        mod = (await (candidate as (opts?: unknown) => Promise<CircuitBenchWasmModule>)()) ?? {};
      } else {
        mod = candidate as CircuitBenchWasmModule;
      }
      if (typeof mod.bench_solve !== 'function') return TS_ENGINE;
      const engine: CircuitEngine = { kind: 'wasm', solve: (state) => solveWithWasm(mod, state) };
      activeEngine = engine;
      return engine;
    } catch {
      // 文件缺失 / 实例化失败 / import 被拒 → 保持 TS，不向 React 层抛异常
      return TS_ENGINE;
    }
  })();
  return pending;
}

/** 求解入口：WASM 就绪后自动分发到 C++，否则走 TS。 */
export function solveNow(state: BenchState): SolveResult {
  return activeEngine.solve(state);
}

/** 仅给测试使用：不经过 WASM，直接看 TS 的节点电压是否有限。 */
export function tsVoltages(state: BenchState): Float64Array | null {
  return solveSystemVoltages(buildCircuitSystem(state)).voltages;
}
