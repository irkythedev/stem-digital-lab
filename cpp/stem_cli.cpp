/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 多学科计算核 · C++ 对拍 CLI（src/stem-core-ext.test.ts 调用）
 *
 * 与 cpp/stem_core.cpp 导出同一批公式（同一批 hpp），但不链接 Emscripten ——
 * 系统 g++ 直接编成原生可执行文件，作为「g++ 真值」这条腿，和
 * 「WASM 导出」（src/wasm/stemCore.js）与「TS 回退」（各 TS core）三方对拍。
 *
 * stdin 协议（空白分隔，允许换行；一次进程可跑多组）：
 *   <op> <参数…>
 * 支持 10 个 op（与 WASM 导出一一对应）：
 *   element_resistance r is_bulb u          is_bulb 取 0 / 1
 *   current_of u r is_bulb rp
 *   image_v u f
 *   quadratic_y a b c x
 *   inverse_y k x
 *   bulb_resistance rated_v rated_p temp
 *   bulb_temp_step temp current r_now c_heat h t_ambient rad_k
 *   ph_from_moles acid_mol base_mol total_volume
 *   displaced_volume vsub stone_volume
 *   spring_reading weight buoyancy
 * stdout：每个 op 一行结果（setprecision(17)，与 WASM 侧 double 一致；
 *         NaN / Inf 按 C++ 默认拼写 nan / inf）；未知 op 或参数不足输出 FAIL 并 exit 1。
 *
 * 编译：g++ -std=c++17 cpp/stem_cli.cpp -o stem_cli
 */
#include <cstdio>
#include <iomanip>
#include <iostream>
#include <string>

#include "bulb_formula.hpp"
#include "chem_formula.hpp"
#include "lens_formula.hpp"
#include "math_fn.hpp"
#include "mechanics_formula.hpp"
#include "ohm_formula.hpp"

namespace {

bool read_double(double& out) {
  return static_cast<bool>(std::cin >> out);
}

/** 参数不足：与未知 op 同样处理（FAIL + exit 1），绝不用 0 顶替。 */
int fail() {
  std::cout << "FAIL\n";
  return 1;
}

}  // namespace

int main() {
  std::ios::sync_with_stdio(false);
  std::cin.tie(nullptr);
  std::cout << std::setprecision(17);

  std::string op;
  while (std::cin >> op) {
    double a = 0.0;
    double b = 0.0;
    double c = 0.0;
    double d = 0.0;

    if (op == "element_resistance") {
      if (!read_double(a) || !read_double(b) || !read_double(c)) return fail();
      std::cout << ohm::element_resistance(a, b != 0.0, c) << '\n';
    } else if (op == "current_of") {
      if (!read_double(a) || !read_double(b) || !read_double(c) || !read_double(d)) return fail();
      std::cout << ohm::current_of(a, b, c != 0.0, d) << '\n';
    } else if (op == "image_v") {
      if (!read_double(a) || !read_double(b)) return fail();
      std::cout << lens::image_v(a, b) << '\n';
    } else if (op == "quadratic_y") {
      if (!read_double(a) || !read_double(b) || !read_double(c)) return fail();
      double x = 0.0;
      if (!read_double(x)) return fail();
      std::cout << mathfn::quadratic_y(a, b, c, x) << '\n';
    } else if (op == "inverse_y") {
      if (!read_double(a) || !read_double(b)) return fail();
      std::cout << mathfn::inverse_y(a, b) << '\n';
    } else if (op == "bulb_resistance") {
      if (!read_double(a) || !read_double(b) || !read_double(c)) return fail();
      std::cout << bulb::bulb_resistance(a, b, c) << '\n';
    } else if (op == "bulb_temp_step") {
      double current = 0.0;
      double r_now = 0.0;
      double c_heat = 0.0;
      double h = 0.0;
      double t_ambient = 0.0;
      double rad_k = 0.0;
      if (!read_double(a) || !read_double(current) || !read_double(r_now) || !read_double(c_heat)
          || !read_double(h) || !read_double(t_ambient) || !read_double(rad_k)) {
        return fail();
      }
      std::cout << bulb::bulb_temp_step(a, current, r_now, c_heat, h, t_ambient, rad_k) << '\n';
    } else if (op == "ph_from_moles") {
      if (!read_double(a) || !read_double(b) || !read_double(c)) return fail();
      std::cout << chem::ph_from_moles(a, b, c) << '\n';
    } else if (op == "displaced_volume") {
      if (!read_double(a) || !read_double(b)) return fail();
      std::cout << mechanics::displaced_volume(a, b) << '\n';
    } else if (op == "spring_reading") {
      if (!read_double(a) || !read_double(b)) return fail();
      std::cout << mechanics::spring_reading(a, b) << '\n';
    } else {
      return fail();
    }
  }
  return 0;
}
