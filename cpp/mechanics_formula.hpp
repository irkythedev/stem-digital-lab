/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 浮力核（header-only，单一事实源）——C++ 侧的阿基米德原理片段，
 * 供 stem_core.cpp（Emscripten/WASM 导出）与 stem_cli.cpp（g++ 对拍）include。
 *
 * 语义与 TS 真源 src/labs/physics/mechanics-core.ts 的
 * displacedVolume / springReading 完全一致（后者是 Buoyancy.tsx 与 smoke 测试共用的
 * 力学核，本头文件只镜像它两个标量，不改动那三个函数在 TS 里的既有口径）。
 *
 * 为什么「物体体积 / 物重 / g」是参数而不是常量：TS 真源把 STONE_VOLUME = 1.5e-4 m³、
 * STONE_WEIGHT = 2 N、G = 10 N/kg 定为演示物固定值（见 mechanics-core.ts 的注释：
 * 体积是**刻度分辨率**驱动的选择），但 C++ 侧不该再复制一份「演示物」定义 ——
 * 常量留在 TS，这里只做纯函数；浮力 F浮 = ρ液·g·V排 由调用方算好传入。
 */
#ifndef STEM_MECHANICS_FORMULA_HPP
#define STEM_MECHANICS_FORMULA_HPP

namespace mechanics {

/**
 * 排开液体的体积：V排 = 体积 · 浸入比例，**且不超过物体自身体积**。
 * 饱和（浸入比例 ≥ 1）是「完全浸没后继续下沉，浮力不再增大」这一考点成立的前提。
 */
inline double displaced_volume(double vsub, double stone_volume) {
  const double r = vsub < 0.0 ? 0.0 : (vsub > 1.0 ? 1.0 : vsub);
  return stone_volume * r;
}

/**
 * 弹簧测力计示数：F示 = 物重 − 浮力，且不小于 0。
 * 示数是「读数」，不可能为负：F浮 ≥ G 时物体不再由测力计承担（漂浮 / 上浮），取 0。
 */
inline double spring_reading(double weight, double buoyancy) {
  const double d = weight - buoyancy;
  // 写成比较而不是 std::fmax(0, d)：fmax 会「忽略 NaN」返回 0，而 TS 侧 Math.max(0, NaN)
  // 是 NaN —— 三方对拍要求两者逐位一致，NaN 必须原样穿过去。
  return d < 0.0 ? 0.0 : d;
}

}  // namespace mechanics

#endif  // STEM_MECHANICS_FORMULA_HPP
