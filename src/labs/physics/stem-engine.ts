/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 多学科计算引擎门面（facade）——欧姆定律 / 凸透镜成像 / 二次函数 / 反比例函数 /
 * 酸碱中和 / 灯泡热力学 / 浮力共用同一份 src/wasm/stemCore.js（C++ → WASM，SINGLE_FILE）。
 *
 * 设计：计算真源始终是各 TS core（./ohm-core、./lens-core、../math/quadratic-core、
 * ../math/inverse-core、../chemistry/titration-core、./bulb-core，被 smoke / 三方对拍
 * 测试直接覆盖）。本模块提供同签名门面，内部实现指针默认指向 JS 真源；
 * loadOhmEngine()（别名 loadStemEngine）成功后指针整体切换到 C++ → WASM。
 * 任何加载/实例化失败都静默保持 JS 实现，绝不 throw 到 React 层。
 *
 * 原子回退：必须同时存在全部 10 个 Embind 导出（element_resistance / current_of /
 * image_v / quadratic_y / inverse_y / bulb_resistance / bulb_temp_step / ph_from_moles /
 * displaced_volume / spring_reading）才切换 wasm；任一缺失或 throw → 全部指针保持 JS
 * （七个实验一起，禁止半 wasm 半 js）。
 *
 * 采样循环固定在本模块（与各 core 同语义，**含索引乘法口径**）：sampleOhm /
 * sampleQuadratic / sampleInverse 的循环体内调用「当前指针」的标量——WASM 就绪后
 * 整条曲线同样走 C++ 标量，调用点（Ohm.tsx / Lens.tsx / Quadratic.tsx / Inverse.tsx）
 * 无需任何改动。
 *
 * ⚠️ 数值边界由本门面统一兜底（currentOf 的 NaN→0、imageV 的非有限→null）：
 * 运行时可能已切到 WASM，只改 TS core 对应用无效——smoke 测试覆盖的是 core，
 * 会出现「测试全绿、页面仍 NaN」。边界修复必须落在本文件。
 *
 * 签名分歧（有意为之，不是漏改）：C++ 侧只认裸标量，看不到「演示物」与「实验场景」。
 * 因此 `spring_reading(weight, buoyancy)` 收的是物重与浮力本身，门面按 Buoyancy 实验的
 * 既有签名 `springReading(rho, vSubRatio)` 组装（V物 = STONE_VOLUME、G、STONE_WEIGHT
 * 三个展示常量取自 mechanics-core）；`bulb_temp_step` 的 rad_k / r_now / c_heat 亦由
 * 调用方算好传入。这两处都只做「同式重排」，不改任何一个数值。
 */

import {
  currentOf as jsCurrentOf,
  elementResistance as jsElementResistance,
  type ElementType,
} from './ohm-core';
import { imageV as jsImageV } from './lens-core';
import { quadraticY as jsQuadraticY } from '../math/quadratic-core';
import { inverseY as jsInverseY } from '../math/inverse-core';
import { phFromMoles as jsPhFromMoles } from '../chemistry/titration-core';
import {
  T_AMBIENT,
  T_BULB_BURN,
  T_BULB_RATED,
  bulbHeatCapacity,
  bulbRadK,
  bulbResistance as jsBulbResistance,
  bulbTempStep as jsBulbTempStep,
} from './bulb-core';
import { G, STONE_VOLUME, STONE_WEIGHT } from './mechanics-core';

export type { ElementType } from './ohm-core';
export { BULB_GAMMA } from './ohm-core';
// 灯泡的常量与两个「额定参数 → 常数」的换算（热容 / 辐射散热系数）在 C++ 侧没有导出：
// 它们是积分器的**入参**而非输出，三条腿算的是同一件事（见 cpp/bulb_formula.hpp 头注释）。
// 从门面转出去，让电学工作台只需认这一个进口。
export { T_AMBIENT, T_BULB_BURN, T_BULB_RATED, bulbHeatCapacity, bulbRadK };

type CurrentOfImpl = (u: number, r: number, element: ElementType, rp: number) => number;
type ElementResistanceImpl = (r: number, element: ElementType, u: number) => number;
type ImageVImpl = (u: number, f: number) => number | null;
type QuadraticYImpl = (a: number, b: number, c: number, x: number) => number;
type InverseYImpl = (k: number, x: number) => number;
type PhFromMolesImpl = (acidMol: number, baseMol: number, totalVolume: number) => number;
type BulbResistanceImpl = (ratedVoltage: number, ratedPower: number, temp: number) => number;
type BulbTempStepImpl = (
  temp: number,
  current: number,
  rNow: number,
  cHeat: number,
  h: number,
  tAmbient: number,
  radK: number,
) => number;
type DisplacedVolumeImpl = (vSubRatio: number, stoneVolume: number) => number;
type SpringReadingImpl = (weight: number, buoyancy: number) => number;

let engineKind: 'wasm' | 'js' = 'js';
let implCurrentOf: CurrentOfImpl = jsCurrentOf;
let implElementResistance: ElementResistanceImpl = jsElementResistance;
let implImageV: ImageVImpl = jsImageV;
let implQuadraticY: QuadraticYImpl = jsQuadraticY;
let implInverseY: InverseYImpl = jsInverseY;
let implPhFromMoles: PhFromMolesImpl = jsPhFromMoles;
let implBulbResistance: BulbResistanceImpl = jsBulbResistance;
let implBulbTempStep: BulbTempStepImpl = jsBulbTempStep;
/**
 * V排 = V物 · clamp(浸入比例, 0, 1)（两参版，与 C++ displaced_volume 同签名）。
 * mechanics-core.displacedVolume 是它的**单参应用形态**（物体体积由 STONE_VOLUME 定死），
 * 两式逐字一致；门面用两参版是因为 WASM 侧不认识「演示物是谁」，体积必须显式传。
 */
let implDisplacedVolume: DisplacedVolumeImpl = (vSubRatio, stoneVolume) =>
  stoneVolume * Math.min(1, Math.max(0, vSubRatio));
/** F示 = 物重 − 浮力，且不小于 0（示数是读数，不可能为负）。与 mechanics-core 逐式一致。 */
let implSpringReading: SpringReadingImpl = (weight, buoyancy) => Math.max(0, weight - buoyancy);

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
  const v = implCurrentOf(u, r, element, rp);
  // 0/0 → 0：无驱动电压（U=0）且总电阻为 0 时，C++ 侧返回 NaN（实测：页面出现 4 处 "NaN"，
  // 电表读数与 SVG 属性全被污染）。门面是两条实现（JS core / WASM）的唯一汇合点，
  // 在这里统一兜住——只改 TS core 对应用无效，因为运行时可能已切到 WASM。
  return Number.isNaN(v) ? 0 : v;
}

/** 像距 v（cm）（签名与 lens-core 一致）：u≈f 时返回 null（无清晰实像）。 */
export function imageV(u: number, f: number): number | null {
  const v = implImageV(u, f);
  // 不成像（u≈f）必须是严格的 null，不能是 NaN：调用点用 `v === null` / `v < 0` 分支，
  // NaN 会让两者都落空，虚像/无像判定全部失效。WASM 侧可能返回 NaN，在此归一。
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** 二次函数单点求值（签名与 quadratic-core 一致）。 */
export function quadraticY(a: number, b: number, c: number, x: number): number {
  return implQuadraticY(a, b, c, x);
}

/**
 * 反比例函数单点求值（签名与 inverse-core 一致）：x = 0 返回 NaN。
 * 这里**不**把 NaN 归一成 0 或 null——x = 0 处「无值」这件事由 NaN 表达，采样循环
 * （sampleInverse）根本不会取到 x = 0，绘图层的 noLine 渐近线另有约定。
 */
export function inverseY(k: number, x: number): number {
  return implInverseY(k, x);
}

/**
 * 强酸强碱滴定单点 pH（签名与 titration-core 一致）：n酸 / n碱为摩尔数，totalVolume 为总体积。
 * 等当点相对容差在核内（先判容差再分支），门面不改动任何 pH 值。
 */
export function phFromMoles(acidMol: number, baseMol: number, totalVolume: number): number {
  return implPhFromMoles(acidMol, baseMol, totalVolume);
}

/** 灯泡钨丝电阻 R(T)（签名与 bulb-core 一致）。 */
export function bulbResistance(ratedVoltage: number, ratedPower: number, temp: number): number {
  return implBulbResistance(ratedVoltage, ratedPower, temp);
}

/**
 * 灯丝温度单步积分（签名与 bulb-core 一致）：rNow / cHeat / radK 由调用方按**当前**温度
 * 与额定参数算好（见 bulb-core）。烧断闩锁不在这里——那是元件状态机，留在电学工作台。
 */
export function bulbTempStep(
  temp: number,
  current: number,
  rNow: number,
  cHeat: number,
  h: number,
  tAmbient: number,
  radK: number,
): number {
  return implBulbTempStep(temp, current, rNow, cHeat, h, tAmbient, radK);
}

/** 排开液体的体积 V排 = V物 · 浸入比例，且不超过物体自身体积（指针版，体积显式传入）。 */
export function displacedVolume(vSubRatio: number, stoneVolume: number = STONE_VOLUME): number {
  return implDisplacedVolume(vSubRatio, stoneVolume);
}

/**
 * 弹簧测力计示数 F示 = 物重 − 浮力（且不小于 0）。签名沿用 Buoyancy 实验的
 * `mechanics-core.springReading(rho, vSubRatio)`；浮力经**当前指针**的 V排 换算
 * （WASM 就绪后 `displaced_volume` 参与这条读数），物重取演示物常量 STONE_WEIGHT。
 */
export function springReading(rho: number, vSubRatio: number): number {
  return implSpringReading(STONE_WEIGHT, rho * G * implDisplacedVolume(vSubRatio, STONE_VOLUME));
}

/**
 * 采样 I-U 曲线（与 ohm-core 同语义）：U ∈ [0, 12]（u <= 12.0001）步长 0.1；
 * 点 = [I·R_dyn, I]；定值电阻 r === 0 短路 → []。循环固定在此，标量走当前指针。
 */
export function sampleOhm(r: number, element: ElementType, rp = 0): [number, number][] {
  // 元件短路（R=0 相当于导线）：I-U 图像无有效关系，返回空曲线
  if (element === 'resistor' && r === 0) return [];
  const pts: [number, number][] = [];
  // 索引乘法，不用 `u += 0.1` 累加：累加式到第 120 点已漂移到 11.999999999999973，
  // 横轴 109/121 点带浮点尾数（实测）。此处与 ohm-core 保持同一口径。
  for (let k = 0; k * 0.1 <= 12.0001; k++) {
    const u = k * 0.1;
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
  // 索引乘法取点（原先的逐点累加使末点漂移为 3.9999999999999396，161 点里 160 个带尾数）
  const n = Math.round(8 / 0.05);
  for (let k = 0; k <= n; k++) {
    const x = -4 + k * 0.05;
    pts.push([x, implQuadraticY(a, b, c, x)]);
  }
  return pts;
}

/**
 * 采样反比例函数两支（与 inverse-core 同语义）：[左支, 右支]，
 * x ∈ [-4, −0.15] ∪ [0.15, 4]，步长 0.05，索引乘法取点；k = 0 → 两个空段。
 */
export function sampleInverse(k: number): [number, number][][] {
  if (k === 0) return [[], []];
  const neg: [number, number][] = [];
  const pos: [number, number][] = [];
  const n = Math.round((4 - 0.15) / 0.05);
  for (let i = 0; i <= n; i++) {
    const x = 0.15 + i * 0.05;
    neg.push([-4 + i * 0.05, implInverseY(k, -4 + i * 0.05)]);
    pos.push([x, implInverseY(k, x)]);
  }
  return [neg, pos];
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
          inverse_y: unknown;
          bulb_resistance: unknown;
          bulb_temp_step: unknown;
          ph_from_moles: unknown;
          displaced_volume: unknown;
          spring_reading: unknown;
        };
        // 原子回退：十个导出必须齐全，缺任一 → 整颗保持 JS
        if (
          typeof Module.element_resistance !== 'function' ||
          typeof Module.current_of !== 'function' ||
          typeof Module.image_v !== 'function' ||
          typeof Module.quadratic_y !== 'function' ||
          typeof Module.inverse_y !== 'function' ||
          typeof Module.bulb_resistance !== 'function' ||
          typeof Module.bulb_temp_step !== 'function' ||
          typeof Module.ph_from_moles !== 'function' ||
          typeof Module.displaced_volume !== 'function' ||
          typeof Module.spring_reading !== 'function'
        ) {
          return 'js';
        }
        const core = Module as {
          element_resistance(r: number, isBulb: boolean, u: number): number;
          current_of(u: number, r: number, isBulb: boolean, rp: number): number;
          image_v(u: number, f: number): number;
          quadratic_y(a: number, b: number, c: number, x: number): number;
          inverse_y(k: number, x: number): number;
          bulb_resistance(ratedV: number, ratedP: number, temp: number): number;
          bulb_temp_step(
            temp: number,
            current: number,
            rNow: number,
            cHeat: number,
            h: number,
            tAmbient: number,
            radK: number,
          ): number;
          ph_from_moles(acidMol: number, baseMol: number, totalVolume: number): number;
          displaced_volume(vSubRatio: number, stoneVolume: number): number;
          spring_reading(weight: number, buoyancy: number): number;
        };
        implElementResistance = (r, element, u) => core.element_resistance(r, element === 'bulb', u);
        implCurrentOf = (u, r, element, rp) => core.current_of(u, r, element === 'bulb', rp);
        // C++ 用 NaN 哨兵表示 u≈f 无像；TS facade 收成 null（与 lens-core 签名一致）
        implImageV = (u, f) => {
          const v = core.image_v(u, f);
          return Number.isNaN(v) ? null : v;
        };
        implQuadraticY = (a, b, c, x) => core.quadratic_y(a, b, c, x);
        implInverseY = (k, x) => core.inverse_y(k, x);
        implPhFromMoles = (acidMol, baseMol, totalVolume) => core.ph_from_moles(acidMol, baseMol, totalVolume);
        implBulbResistance = (ratedV, ratedP, temp) => core.bulb_resistance(ratedV, ratedP, temp);
        implBulbTempStep = (temp, current, rNow, cHeat, h, tAmbient, radK) =>
          core.bulb_temp_step(temp, current, rNow, cHeat, h, tAmbient, radK);
        implDisplacedVolume = (vSubRatio, stoneVolume) => core.displaced_volume(vSubRatio, stoneVolume);
        implSpringReading = (weight, buoyancy) => core.spring_reading(weight, buoyancy);
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

/** loadOhmEngine 的别名：引擎已泛化为多学科（七个实验共用同一份 WASM）。 */
export const loadStemEngine = loadOhmEngine;
