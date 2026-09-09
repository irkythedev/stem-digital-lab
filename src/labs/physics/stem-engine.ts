/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 多学科计算引擎门面（facade）——欧姆定律 / 凸透镜成像 / 二次函数共用
 * 同一份 src/wasm/stemCore.js（C++ → WASM，SINGLE_FILE）。
 *
 * 设计：计算真源始终是各 TS core（./ohm-core、./lens-core、../math/quadratic-core，
 * 被 smoke 测试直接覆盖）。本模块提供同签名门面，内部实现指针默认指向 JS 真源；
 * loadOhmEngine()（别名 loadStemEngine）成功后指针整体切换到 C++ → WASM。
 * 任何加载/实例化失败都静默保持 JS 实现，绝不 throw 到 React 层。
 *
 * 原子回退：必须同时存在 element_resistance / current_of / image_v / quadratic_y
 * 四个 Embind 导出才切换 wasm；任一缺失或 throw → 全部指针保持 JS
 * （欧姆 + 透镜 + 二次一起，禁止半 wasm 半 js）。
 *
 * 采样循环固定在本模块（照抄各 core 语义）：sampleOhm / sampleQuadratic 的
 * 循环体内调用「当前指针」的标量——WASM 就绪后整条曲线同样走 C++ 标量，
 * 调用点（Ohm.tsx / Lens.tsx / Quadratic.tsx）无需任何改动。
 */

import {
  currentOf as jsCurrentOf,
  elementResistance as jsElementResistance,
  type ElementType,
} from './ohm-core';
import { imageV as jsImageV } from './lens-core';
import { quadraticY as jsQuadraticY } from '../math/quadratic-core';

export type { ElementType } from './ohm-core';
export { BULB_GAMMA } from './ohm-core';

type CurrentOfImpl = (u: number, r: number, element: ElementType, rp: number) => number;
type ElementResistanceImpl = (r: number, element: ElementType, u: number) => number;
type ImageVImpl = (u: number, f: number) => number | null;
type QuadraticYImpl = (a: number, b: number, c: number, x: number) => number;

let engineKind: 'wasm' | 'js' = 'js';
let implCurrentOf: CurrentOfImpl = jsCurrentOf;
let implElementResistance: ElementResistanceImpl = jsElementResistance;
let implImageV: ImageVImpl = jsImageV;
let implQuadraticY: QuadraticYImpl = jsQuadraticY;

/** 当前引擎种类（同步读；loadOhmEngine 完成后才可能为 'wasm'）。 */
export function getEngineKind(): 'wasm' | 'js' {
  return engineKind;
}

/** 元件动态电阻（签名与 ohm-core 一致）。 */
export function elementResistance(r: number, element: ElementType, u: number): number {
  return implElementResistance(r, element, u);
}

/** 电路读数 I（A）（签名与 ohm-core 一致）。分母为 0 不特判。 */
export function currentOf(u: number, r: number, element: ElementType, rp = 0): number {
  return implCurrentOf(u, r, element, rp);
}

/** 像距 v（cm）（签名与 lens-core 一致）：u≈f 时返回 null（无清晰实像）。 */
export function imageV(u: number, f: number): number | null {
  return implImageV(u, f);
}

/** 二次函数单点求值（签名与 quadratic-core 一致）。 */
export function quadraticY(a: number, b: number, c: number, x: number): number {
  return implQuadraticY(a, b, c, x);
}

/**
 * 采样 I-U 曲线（与 ohm-core 同语义）：U ∈ [0, 12]（u <= 12.0001）步长 0.1；
 * 点 = [I·R_dyn, I]；定值电阻 r === 0 短路 → []。循环固定在此，标量走当前指针。
 */
export function sampleOhm(r: number, element: ElementType, rp = 0): [number, number][] {
  // 元件短路（R=0 相当于导线）：I-U 图像无有效关系，返回空曲线
  if (element === 'resistor' && r === 0) return [];
  const pts: [number, number][] = [];
  for (let u = 0; u <= 12.0001; u += 0.1) {
    const i = implCurrentOf(u, r, element, rp);
    pts.push([i * implElementResistance(r, element, u), i]);
  }
  return pts;
}

/**
 * 采样一条二次函数曲线（与 quadratic-core 同语义）：x ∈ [-4, 4]（x <= 4.0001）
 * 步长 0.05，单段。循环固定在此，标量走当前指针。
 */
export function sampleQuadratic(a: number, b: number, c: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let x = -4; x <= 4.0001; x += 0.05) {
    pts.push([x, implQuadraticY(a, b, c, x)]);
  }
  return pts;
}

let loadPromise: Promise<'wasm' | 'js'> | null = null;

/**
 * 尝试加载 C++ → WASM 引擎（src/wasm/stemCore.js，SINGLE_FILE ESM，默认导出 factory）。
 * 单例；任何失败（文件缺失 / 实例化失败 / 缺任一导出函数）都静默回退 JS，不 throw。
 */
export function loadOhmEngine(): Promise<'wasm' | 'js'> {
  if (!loadPromise) {
    loadPromise = (async (): Promise<'wasm' | 'js'> => {
      try {
        // 相对路径拼接成两段：避免 Vite 把 new URL(字面量) 当作必选静态资源
        // （本机可能没有产物，缺失的 asset 会让 build 报错）；运行时仍解析到
        // src/wasm/stemCore.js，文件不存在时 import 失败 → catch → js 回退。
        const href = new URL('../../wasm/' + 'stemCore.js', import.meta.url).href;
        const mod = (await import(/* @vite-ignore */ href)) as { default?: unknown };
        const factory = (mod.default ?? mod) as (opts?: unknown) => Promise<unknown>;
        const Module = (await factory()) as {
          element_resistance: unknown;
          current_of: unknown;
          image_v: unknown;
          quadratic_y: unknown;
        };
        // 原子回退：四个导出必须齐全，缺任一 → 整颗保持 JS
        if (
          typeof Module.element_resistance !== 'function' ||
          typeof Module.current_of !== 'function' ||
          typeof Module.image_v !== 'function' ||
          typeof Module.quadratic_y !== 'function'
        ) {
          return 'js';
        }
        const core = Module as {
          element_resistance(r: number, isBulb: boolean, u: number): number;
          current_of(u: number, r: number, isBulb: boolean, rp: number): number;
          image_v(u: number, f: number): number;
          quadratic_y(a: number, b: number, c: number, x: number): number;
        };
        implElementResistance = (r, element, u) => core.element_resistance(r, element === 'bulb', u);
        implCurrentOf = (u, r, element, rp) => core.current_of(u, r, element === 'bulb', rp);
        // C++ 用 NaN 哨兵表示 u≈f 无像；TS facade 收成 null（与 lens-core 签名一致）
        implImageV = (u, f) => {
          const v = core.image_v(u, f);
          return Number.isNaN(v) ? null : v;
        };
        implQuadraticY = (a, b, c, x) => core.quadratic_y(a, b, c, x);
        engineKind = 'wasm';
        return 'wasm';
      } catch {
        // 文件缺失 / 实例化失败 / import 被拒 → 指针未动，engineKind 仍为 'js'
        return 'js';
      }
    })();
  }
  return loadPromise;
}

/** loadOhmEngine 的别名：引擎已泛化为多学科（欧姆/透镜/二次共用同一份 WASM）。 */
export const loadStemEngine = loadOhmEngine;
