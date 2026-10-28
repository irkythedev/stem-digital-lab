/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 线性直流求解核（header-only）
 *
 * 与 circuit-bench-core.ts 的 solveLinearSystem 对拍：同一组节点/电源/电导，
 * 两边输出必须在 1e-9 相对误差内一致。这里只做纯线性代数，不包含灯泡热模型、
 * 保险丝熔断或任何 UI 逻辑。
 *
 * 编号约定：节点 0..n-1，ground 节点电压固定为 0；电源用诺顿等效，
 * 内阻 r > 0。矩阵为纯节点导纳矩阵，对角线额外加 gmin。
 */
#ifndef CIRCUIT_BENCH_SOLVER_HPP
#define CIRCUIT_BENCH_SOLVER_HPP

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <vector>

namespace cb {

struct Source {
  int a = 0;
  int b = 0;
  double emf = 0.0;
  double r = 1.0;
};

struct Conductor {
  int a = 0;
  int b = 0;
  double g = 0.0;
};

struct Outcome {
  bool ok = false;
  std::vector<double> voltages;
};

inline bool finite_number(double v) { return std::isfinite(v); }

/**
 * 部分主元高斯消去。A 行主序 n×n；b 长度 n。
 * 返回 false 表示奇异或出现非有限值。
 */
inline bool lu_solve(std::vector<double> a, std::vector<double> b, int n, std::vector<double>& x) {
  if (n <= 0) {
    x.clear();
    return true;
  }
  for (int col = 0; col < n; ++col) {
    int pivot = col;
    double best = std::fabs(a[static_cast<std::size_t>(col) * n + col]);
    for (int row = col + 1; row < n; ++row) {
      const double v = std::fabs(a[static_cast<std::size_t>(row) * n + col]);
      if (v > best) {
        best = v;
        pivot = row;
      }
    }
    if (!(best > 1e-14) || !finite_number(best)) return false;
    if (pivot != col) {
      for (int k = col; k < n; ++k) {
        std::swap(a[static_cast<std::size_t>(col) * n + k], a[static_cast<std::size_t>(pivot) * n + k]);
      }
      std::swap(b[col], b[pivot]);
    }
    const double d = a[static_cast<std::size_t>(col) * n + col];
    for (int row = col + 1; row < n; ++row) {
      const double f = a[static_cast<std::size_t>(row) * n + col] / d;
      if (!finite_number(f) || f == 0.0) continue;
      a[static_cast<std::size_t>(row) * n + col] = 0.0;
      for (int k = col + 1; k < n; ++k) {
        a[static_cast<std::size_t>(row) * n + k] -= f * a[static_cast<std::size_t>(col) * n + k];
      }
      b[row] -= f * b[col];
    }
  }
  x.assign(static_cast<std::size_t>(n), 0.0);
  for (int row = n - 1; row >= 0; --row) {
    double s = b[row];
    for (int k = row + 1; k < n; ++k) s -= a[static_cast<std::size_t>(row) * n + k] * x[k];
    const double d = a[static_cast<std::size_t>(row) * n + row];
    if (!(std::fabs(d) > 1e-14) || !finite_number(d)) return false;
    x[row] = s / d;
    if (!finite_number(x[row])) return false;
  }
  return true;
}

/** 求解线性直流电路，返回 n 个节点电压（ground=0）。 */
inline Outcome solve_dc(int n, int ground, const std::vector<Source>& sources,
                        const std::vector<Conductor>& conductors, double gmin = 1e-9) {
  Outcome out;
  if (n <= 0) {
    out.ok = true;
    return out;
  }
  if (ground < 0 || ground >= n) ground = 0;
  if (n == 1) {
    out.ok = true;
    out.voltages.assign(1, 0.0);
    return out;
  }

  std::vector<double> A(static_cast<std::size_t>(n) * n, 0.0);
  std::vector<double> b(static_cast<std::size_t>(n), 0.0);

  auto stamp_g = [&](int i, int j, double g) {
    if (i < 0 || i >= n || j < 0 || j >= n || !finite_number(g) || g == 0.0) return;
    A[static_cast<std::size_t>(i) * n + i] += g;
    A[static_cast<std::size_t>(j) * n + j] += g;
    A[static_cast<std::size_t>(i) * n + j] -= g;
    A[static_cast<std::size_t>(j) * n + i] -= g;
  };

  for (const auto& c : conductors) stamp_g(c.a, c.b, c.g);
  for (const auto& s : sources) {
    const double r = std::max(1e-6, s.r);
    const double g = 1.0 / r;
    stamp_g(s.a, s.b, g);
    const double inj = s.emf * g;
    if (s.a >= 0 && s.a < n) b[s.a] += inj;
    if (s.b >= 0 && s.b < n) b[s.b] -= inj;
  }
  for (int i = 0; i < n; ++i) A[static_cast<std::size_t>(i) * n + i] += gmin;

  std::vector<int> map(static_cast<std::size_t>(n), -1);
  int m = 0;
  for (int i = 0; i < n; ++i) {
    if (i == ground) continue;
    map[i] = m++;
  }
  std::vector<double> Ar(static_cast<std::size_t>(m) * m, 0.0);
  std::vector<double> br(static_cast<std::size_t>(m), 0.0);
  for (int i = 0; i < n; ++i) {
    if (i == ground) continue;
    const int ri = map[i];
    for (int j = 0; j < n; ++j) {
      if (j == ground) continue;
      Ar[static_cast<std::size_t>(ri) * m + map[j]] = A[static_cast<std::size_t>(i) * n + j];
    }
    br[ri] = b[i];
  }

  std::vector<double> x;
  if (!lu_solve(Ar, br, m, x)) {
    out.ok = false;
    return out;
  }
  out.voltages.assign(static_cast<std::size_t>(n), 0.0);
  int k = 0;
  for (int i = 0; i < n; ++i) {
    if (i == ground) continue;
    out.voltages[i] = x[k++];
  }
  out.ok = true;
  return out;
}

}  // namespace cb

#endif  // CIRCUIT_BENCH_SOLVER_HPP
