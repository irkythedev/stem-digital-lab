/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * src/wasm/stemCore.js 的类型声明（仅类型，不假装有 glue）。
 *
 * 产物由 em++ 直接编译（-s SINGLE_FILE -s EXPORT_ES6 -s MODULARIZE）
 * 生成：单文件 ESM，默认导出一个 factory，调用后返回 Embind 导出的标量函数集合。
 * 本机无 em++ / 未生成产物时，stem-engine.ts 的动态 import 会失败并静默回退 JS。
 *
 * 导出必须与 cpp/stem_core.cpp 的 EMSCRIPTEN_BINDINGS 逐名一致（共 10 个）：
 *   element_resistance / current_of / image_v / quadratic_y / inverse_y /
 *   bulb_resistance / bulb_temp_step / ph_from_moles / displaced_volume / spring_reading；
 * 任一缺失 → TS facade 整颗回退 JS（禁止半 wasm 半 js）。
 *
 * 定义域外一律给 NaN 哨兵（image_v 的 u≈f、inverse_y 的 x=0），归一成 null / 夹取
 * 由 TS facade 完成——C++ 侧不认识「无像」「渐近线」这类界面概念，只负责返回一个
 * 不会被误当成有限值的标记。
 */

declare const factory: (opts?: unknown) => Promise<{
  element_resistance(r: number, is_bulb: boolean, u: number): number;
  current_of(u: number, r: number, is_bulb: boolean, rp: number): number;
  image_v(u: number, f: number): number; // u≈f 时返回 NaN（无清晰实像哨兵）
  quadratic_y(a: number, b: number, c: number, x: number): number;
  inverse_y(k: number, x: number): number; // x = 0 时返回 NaN（定义域外哨兵）
  bulb_resistance(rated_v: number, rated_p: number, temp: number): number;
  /** r_now / c_heat / rad_k 由调用方按当前温度与额定参数算好传入（见 cpp/bulb_formula.hpp） */
  bulb_temp_step(
    temp: number,
    current: number,
    r_now: number,
    c_heat: number,
    h: number,
    t_ambient: number,
    rad_k: number,
  ): number;
  /** n酸 / n碱为摩尔数，total_volume 为总体积；等当点用相对容差判 7 */
  ph_from_moles(acid_mol: number, base_mol: number, total_volume: number): number;
  /** V排 = 体积 · 浸入比例，且不超过物体自身体积 */
  displaced_volume(vsub: number, stone_volume: number): number;
  /** F示 = 物重 − 浮力，且不小于 0 */
  spring_reading(weight: number, buoyancy: number): number;
}>;

export default factory;
