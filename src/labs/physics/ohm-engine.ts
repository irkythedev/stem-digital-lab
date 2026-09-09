/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 兼容壳（compatibility shim）：实现已迁至 ./stem-engine（多学科计算引擎门面，
 * 欧姆定律 / 凸透镜成像 / 二次函数共用同一份 src/wasm/stemCore.js）。
 *
 * 保留本文件仅避免 Ohm.tsx 与旧 smoke 测试改动 import 路径；
 * 不在壳里重复加载 glue（loadOhmEngine 单例在 stem-engine）。
 */
export {
  BULB_GAMMA,
  currentOf,
  elementResistance,
  getEngineKind,
  imageV,
  loadOhmEngine,
  loadStemEngine,
  quadraticY,
  sampleOhm,
  sampleQuadratic,
} from './stem-engine';
export type { ElementType } from './stem-engine';
