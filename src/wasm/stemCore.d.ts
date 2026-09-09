/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * src/wasm/stemCore.js 的类型声明（仅类型，不假装有 glue）。
 *
 * 产物由 `bash scripts/build-wasm.sh`（em++ -s SINGLE_FILE -s EXPORT_ES6 -s MODULARIZE）
 * 生成：单文件 ESM，默认导出一个 factory，调用后返回 Embind 导出的标量函数集合。
 * 本机无 em++ / 未生成产物时，stem-engine.ts 的动态 import 会失败并静默回退 JS。
 *
 * 导出必须与 cpp/stem_core.cpp 的 EMSCRIPTEN_BINDINGS 保持一致：
 * element_resistance / current_of / image_v / quadratic_y；
 * 任一缺失 → TS facade 整颗回退 JS（禁止半 wasm 半 js）。
 */

declare const factory: (opts?: unknown) => Promise<{
  element_resistance(r: number, is_bulb: boolean, u: number): number;
  current_of(u: number, r: number, is_bulb: boolean, rp: number): number;
  image_v(u: number, f: number): number; // u≈f 时返回 NaN（无清晰实像哨兵）
  quadratic_y(a: number, b: number, c: number, x: number): number;
}>;

export default factory;
