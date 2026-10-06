/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 多学科计算核 WASM 导出层（Emscripten Embind，无 main）——公式在各 hpp：
 * ohm_formula.hpp（欧姆定律）、lens_formula.hpp（凸透镜成像）、math_fn.hpp（数学核），
 * 与各自 TS 真源（ohm-core / lens-core / quadratic-core）同源，此处只做符号导出。
 *
 *   - element_resistance / current_of / image_v / quadratic_y 为 Embind 导出的
 *     标量函数（不在 C++ 里采样整条曲线）；任一导出缺失时 TS facade 整颗回退 JS
 *     （禁止半 wasm 半 js）；
 *   - 分母为 0 不特判，保持与 JS 相同的 IEEE 除法语义（Infinity / NaN），短路逻辑留在 React 层；
 *   - image_v 的 u≈f 阈值在 C++ 内判定（返回 NaN 哨兵），归一 null 由 TS facade 完成；
 *   - bool 适配（is_bulb）只允许发生在 TS 侧，C++ 侧用原生 bool。
 *
 * 编译：见 cpp/README.md（需要 em++ / Emscripten）
 */

#include <emscripten/bind.h>

#include "lens_formula.hpp"
#include "math_fn.hpp"
#include "ohm_formula.hpp"

EMSCRIPTEN_BINDINGS(stem_core) {
  emscripten::function("element_resistance", &ohm::element_resistance);
  emscripten::function("current_of", &ohm::current_of);
  emscripten::function("image_v", &lens::image_v);
  emscripten::function("quadratic_y", &mathfn::quadratic_y);
}
