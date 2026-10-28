/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · C++ 对拍 CLI（node:test / smoke test 调用）
 *
 * stdin 格式（空白分隔，允许换行）：
 *   n ground sourceCount conductorCount
 *   sourceCount 行： a b emf r
 *   conductorCount 行： a b g
 * stdout：n 个节点电压（setprecision(17)），失败输出 FAIL。
 */
#include <cstdio>
#include <iomanip>
#include <iostream>
#include <vector>

#include "circuit_bench_solver.hpp"

int main() {
  std::ios::sync_with_stdio(false);
  std::cin.tie(nullptr);

  int n = 0;
  int ground = 0;
  int ns = 0;
  int nc = 0;
  if (!(std::cin >> n >> ground >> ns >> nc)) {
    std::cout << "FAIL\n";
    return 1;
  }
  if (n < 0 || ns < 0 || nc < 0) {
    std::cout << "FAIL\n";
    return 1;
  }

  std::vector<cb::Source> sources;
  sources.reserve(static_cast<std::size_t>(ns));
  for (int i = 0; i < ns; ++i) {
    cb::Source s;
    if (!(std::cin >> s.a >> s.b >> s.emf >> s.r)) {
      std::cout << "FAIL\n";
      return 1;
    }
    sources.push_back(s);
  }
  std::vector<cb::Conductor> conductors;
  conductors.reserve(static_cast<std::size_t>(nc));
  for (int i = 0; i < nc; ++i) {
    cb::Conductor c;
    if (!(std::cin >> c.a >> c.b >> c.g)) {
      std::cout << "FAIL\n";
      return 1;
    }
    conductors.push_back(c);
  }

  const cb::Outcome out = cb::solve_dc(n, ground, sources, conductors);
  if (!out.ok) {
    std::cout << "FAIL\n";
    return 2;
  }
  std::cout << std::setprecision(17);
  for (int i = 0; i < n; ++i) {
    if (i) std::cout << ' ';
    std::cout << out.voltages[static_cast<std::size_t>(i)];
  }
  std::cout << '\n';
  return 0;
}
