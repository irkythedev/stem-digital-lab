/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 欧姆定律计算核 · 命令行版（cli.cpp）
 *
 * 与 cpp/ohm_formula.hpp 同源公式（与 WASM 导出、JS 真源三方一致），
 * 仅依赖 C++ 标准库，用系统 g++ 即可编译（不链接 Emscripten），
 * 给评委 / 本地一条可离线复现的公式证据。
 *
 * 用法：
 *   g++ -std=c++17 cpp/cli.cpp -o ohm_cli
 *   ./ohm_cli --u 6 --r 10 --element resistor --rp 0   → I=0.6
 *   ./ohm_cli --u 6 --r 10 --element bulb --rp 0       → I≈0.4838709677
 *
 * 约定：
 *   - --element 只接受 resistor / bulb
 *   - 缺参或非法参数：用法打印到 stderr，exit 1
 *   - 成功时一行打印电流：I=<值>
 *   - 分母为 0 不特判成 0：按 IEEE 除法输出（I=inf / I=-inf / I=nan）
 */

#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <optional>
#include <string>

#include "ohm_formula.hpp"

namespace {

void usage(const char* argv0) {
  std::cerr << "用法: " << argv0
            << " --u <电压V> --r <阻值Ω> --element <resistor|bulb> [--rp <变阻器Ω>]\n"
            << "例:   " << argv0 << " --u 6 --r 10 --element resistor --rp 0\n"
            << "      " << argv0 << " --u 6 --r 10 --element bulb --rp 0\n";
}

}  // namespace

int main(int argc, char** argv) {
  std::optional<double> u;
  std::optional<double> r;
  std::optional<bool> is_bulb;
  double rp = 0.0;

  for (int i = 1; i < argc; ++i) {
    const std::string a = argv[i];

    const auto value_of = [&](const char* flag) -> std::string {
      if (i + 1 >= argc) {
        std::cerr << "错误: 缺少参数值: " << flag << "\n";
        usage(argv[0]);
        std::exit(1);
      }
      return argv[++i];
    };

    const auto number_of = [&](const char* flag) -> double {
      const std::string raw = value_of(flag);
      char* end = nullptr;
      const double v = std::strtod(raw.c_str(), &end);
      if (end != raw.c_str() + raw.size()) {
        std::cerr << "错误: 非法数字 " << flag << " = " << raw << "\n";
        usage(argv[0]);
        std::exit(1);
      }
      return v;
    };

    if (a == "--u") {
      u = number_of("--u");
    } else if (a == "--r") {
      r = number_of("--r");
    } else if (a == "--rp") {
      rp = number_of("--rp");
    } else if (a == "--element") {
      const std::string e = value_of("--element");
      if (e == "resistor") {
        is_bulb = false;
      } else if (e == "bulb") {
        is_bulb = true;
      } else {
        std::cerr << "错误: --element 只接受 resistor 或 bulb，收到: " << e << "\n";
        usage(argv[0]);
        return 1;
      }
    } else {
      std::cerr << "错误: 未知参数: " << a << "\n";
      usage(argv[0]);
      return 1;
    }
  }

  if (!u || !r || !is_bulb) {
    std::cerr << "错误: 缺少必需参数（--u --r --element）\n";
    usage(argv[0]);
    return 1;
  }

  const double i = ohm::current_of(*u, *r, *is_bulb, rp);
  std::cout << std::setprecision(10) << "I=" << i << "\n";
  return 0;
}
