/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · C++/WASM 导出层（Emscripten Embind，无 main）。
 * 只导出 solveDc；灯泡热模型、保险丝与 UI 全部留在 TypeScript。
 *
 * 编译：bash tools/build-wasm-circuit.sh
 */
#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <vector>

#include "circuit_bench_solver.hpp"

using emscripten::val;

static std::vector<int> to_int_vector(const val& arr) {
  return emscripten::convertJSArrayToNumberVector<int>(arr);
}

static std::vector<double> to_double_vector(const val& arr) {
  return emscripten::convertJSArrayToNumberVector<double>(arr);
}

/**
 * n       节点数
 * ground  接地点
 * srcA/srcB/emf/srcR       电源数组（等长）
 * resA/resB/conductance    电导数组（等长）
 *
 * 返回长度为 n + 1 的数组：[status, v0, v1, …, v_{n-1}]。
 * status 是 Fault 状态码，与 TS 端 SolveResult.ok 一一对应：
 *   0 = 收敛，1 = 奇异/非有限（TS: ok=false + warning.code='singular'）。
 * 长度不符由 JS facade 判为非法并回退 TS。
 */
val bench_solve(int n, int ground, val srcA, val srcB, val emf, val srcR, val resA, val resB, val conductance) {
  const auto sa = to_int_vector(srcA);
  const auto sb = to_int_vector(srcB);
  const auto se = to_double_vector(emf);
  const auto sr = to_double_vector(srcR);
  const auto ra = to_int_vector(resA);
  const auto rb = to_int_vector(resB);
  const auto g = to_double_vector(conductance);

  const std::size_t ns = std::min(std::min(sa.size(), sb.size()), std::min(se.size(), sr.size()));
  const std::size_t nr = std::min(std::min(ra.size(), rb.size()), g.size());
  std::vector<cb::Source> sources;
  sources.reserve(ns);
  for (std::size_t i = 0; i < ns; ++i) {
    sources.push_back(cb::Source{sa[i], sb[i], se[i], sr[i]});
  }
  std::vector<cb::Conductor> conductors;
  conductors.reserve(nr);
  for (std::size_t i = 0; i < nr; ++i) {
    conductors.push_back(cb::Conductor{ra[i], rb[i], g[i]});
  }

  const cb::Outcome out = cb::solve_dc(n, ground, sources, conductors);
  val result = val::array();
  if (!out.ok) {
    result.call<void>("push", 1);
    return result;
  }
  result.call<void>("push", 0);
  for (double v : out.voltages) result.call<void>("push", v);
  return result;
}

EMSCRIPTEN_BINDINGS(circuit_bench) {
  emscripten::function("bench_solve", &bench_solve);
}
