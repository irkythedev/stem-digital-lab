/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 元件模型与参数定义
 *
 * 本文件只放「元件本身是什么」：默认参数、端子、物理公式。
 * 求解器在 circuit-bench-core.ts，预设电路在 circuit-bench-presets.ts。
 * 所有电阻单位 Ω，电流 A，电压 V，温度 K，时间 s。
 */
import type { CircuitComponent, ElementKind, ElementState, ParamBag } from './circuit-bench-core';
import { T_AMBIENT, bulbResistance } from '../stem-engine';
import { num, safeNum } from '../bulb-core';

/**
 * 灯泡常量与公式**不再自持**：单一事实源搬到了 `../bulb-core`（TS 回退腿），经计算门面
 * `../stem-engine` 暴露（WASM 就绪后 `bulbResistance` 由 C++ 原生核求值，`bulb_temp_step`
 * 亦同）。这里只做转出，工作台其余文件仍从本模块取，调用点一处没动。
 *
 * 参数兜底/夹取（`num` / `safeNum`）随公式一齐搬到 `../bulb-core`：它们与灯泡公式原属
 * 同一条「非法参数怎么办」的口径，留两份就会出现两套夹取标准。
 */
export { T_AMBIENT, T_BULB_BURN, T_BULB_RATED, bulbHeatCapacity, bulbRadK, bulbResistance } from '../stem-engine';

export const FUSE_TRIP_HEAT = 2.2;
export const FUSE_TAU = 0.15;

export interface ElementModel {
  kind: ElementKind;
  name: { zh: string; en: string };
  short: { zh: string; en: string };
  category: 'source' | 'load' | 'control' | 'meter' | 'wire';
  defaults: ParamBag;
  description: { zh: string; en: string };
}

function bulbInitial(): ElementState {
  return { temp: T_AMBIENT, heat: 0, blown: false, burnt: false };
}

export const ELEMENT_MODELS: Record<ElementKind, ElementModel> = {
  battery: {
    kind: 'battery',
    name: { zh: '电源', en: 'Battery' },
    short: { zh: '电源', en: 'Cell' },
    category: 'source',
    defaults: { emf: 6, r: 0.5 },
    description: {
      zh: '直流电源，a 端为正极。内阻参与分压，短路电流有限。',
      en: 'DC source; terminal a is positive. Internal resistance limits short-circuit current.',
    },
  },
  resistor: {
    kind: 'resistor',
    name: { zh: '定值电阻', en: 'Resistor' },
    short: { zh: '电阻', en: 'R' },
    category: 'load',
    defaults: { r: 10, mode: 'fixed', rho: 1.7e-8, length: 1, area: 5e-7, material: 'copper' },
    description: {
      zh: '可切换为「电阻定律试样」，用 ρ、L、S 计算电阻。',
      en: 'Switch to a resistivity specimen and compute R from rho, length and area.',
    },
  },
  bulb: {
    kind: 'bulb',
    name: { zh: '小灯泡', en: 'Filament bulb' },
    short: { zh: '灯泡', en: 'Bulb' },
    category: 'load',
    defaults: { ratedVoltage: 3.8, ratedPower: 1.14 },
    description: {
      zh: '钨丝电阻随温度变化：冷态小、正常发光时大，可烧毁。',
      en: 'Tungsten resistance rises with temperature; the filament can burn out.',
    },
  },
  rheostat: {
    kind: 'rheostat',
    name: { zh: '滑动变阻器', en: 'Rheostat' },
    short: { zh: '变阻器', en: 'Rheo' },
    category: 'control',
    defaults: { maxR: 20, minR: 0, ratio: 0.5 },
    description: {
      zh: '滑片比例 0→1 对应接入电阻 minR→maxR，可用于分压与限流。',
      en: 'Wiper ratio 0..1 maps to minR..maxR.',
    },
  },
  switch: {
    kind: 'switch',
    name: { zh: '开关', en: 'Switch' },
    short: { zh: '开关', en: 'S' },
    category: 'control',
    defaults: { closed: true },
    description: {
      zh: '闭合时视为理想导线；断开时该支路无电流。',
      en: 'Ideal conductor when closed; open branch carries no current.',
    },
  },
  ammeter: {
    kind: 'ammeter',
    name: { zh: '电流表', en: 'Ammeter' },
    short: { zh: '电流表', en: 'A' },
    category: 'meter',
    defaults: { range: 0.6, r: 0.001 },
    description: {
      zh: '串联接入，内阻很小；超过量程会给出超量程提示。',
      en: 'Connected in series with tiny resistance; flags over-range readings.',
    },
  },
  voltmeter: {
    kind: 'voltmeter',
    name: { zh: '电压表', en: 'Voltmeter' },
    short: { zh: '电压表', en: 'V' },
    category: 'meter',
    defaults: { range: 3, r: 1e6 },
    description: {
      zh: '并联接入，内阻很大；误串联时几乎切断电路。',
      en: 'Connected in parallel with very high resistance.',
    },
  },
  galvanometer: {
    kind: 'galvanometer',
    name: { zh: '灵敏电流计', en: 'Galvanometer' },
    short: { zh: '电流计', en: 'G' },
    category: 'meter',
    defaults: { range: 0.05, r: 20 },
    description: {
      zh: '惠斯通电桥的检流计，指针偏向电流方向，示数接近零表示平衡。',
      en: 'Bridge detector; near-zero reading indicates balance.',
    },
  },
  fuse: {
    kind: 'fuse',
    name: { zh: '保险丝', en: 'Fuse' },
    short: { zh: '保险丝', en: 'Fuse' },
    category: 'control',
    defaults: { ratedCurrent: 1, r: 0.05 },
    description: {
      zh: '电流超过额定值后熔断，切断电路；可手动更换。',
      en: 'Melts when current exceeds its rating; can be replaced manually.',
    },
  },
  heater: {
    kind: 'heater',
    name: { zh: '电热丝', en: 'Heating wire' },
    short: { zh: '电热丝', en: 'Heater' },
    category: 'load',
    defaults: { r: 8, mass: 0.02, specificHeat: 460 },
    description: {
      zh: '焦耳定律负载：Q = I²Rt，可观察发热功率。',
      en: 'Joule-law load: Q = I²Rt.',
    },
  },
  wire: {
    kind: 'wire',
    name: { zh: '导线', en: 'Wire' },
    short: { zh: '导线', en: 'Wire' },
    category: 'wire',
    defaults: { r: 0.001 },
    description: {
      zh: '理想连接线，求解时合并两端节点。',
      en: 'Ideal connection; merges both terminals into one node.',
    },
  },
};

/** 元件分组已迁到 `circuit-bench-palette.ts`（四组：电源与连接 / 用电器 /
 * 控制与保护 / 测量电表），这里不再保留第二份，免得两处定义互相跑偏。 */

export function terminalNames(_kind: ElementKind): readonly [string, string] {
  return ['a', 'b'];
}

export function defaultParams(kind: ElementKind): ParamBag {
  return { ...ELEMENT_MODELS[kind].defaults };
}

export function defaultElementState(kind: ElementKind): ElementState {
  return kind === 'bulb' ? bulbInitial() : { temp: T_AMBIENT, heat: 0, blown: false, burnt: false };
}

export function kindName(kind: ElementKind, lang: 'zh' | 'en' = 'zh'): string {
  return ELEMENT_MODELS[kind].name[lang];
}

export function kindShort(kind: ElementKind, lang: 'zh' | 'en' = 'zh'): string {
  return ELEMENT_MODELS[kind].short[lang];
}

/**
 * 电阻定律试样的材料表：电阻率 ρ（Ω·m，20 ℃ 的教科书值）。
 *
 * 这张表就是「材料」下拉的全部内容，也必须是选项上那个数字的唯一来源——
 * 选项显示的 ρ 与引擎真正拿来算 R 的 ρ 必须同源。改前实测：下拉只往
 * `params.material` 里写了个字符串，从不写 `params.rho`，而 `resistanceOf`
 * 只读 `params.rho`。学生照预设步骤「保持 L、S 不变，切换材料，读电阻」做，
 * 读数一动不动——选项上印着的 1.1×10⁻⁶ Ω·m 是个纯装饰。
 */
export const MATERIAL_RHO: readonly { id: string; zh: string; en: string; rho: number }[] = [
  { id: 'copper', zh: '铜', en: 'Copper', rho: 1.7e-8 },
  { id: 'aluminum', zh: '铝', en: 'Aluminum', rho: 2.8e-8 },
  { id: 'iron', zh: '铁', en: 'Iron', rho: 1.0e-7 },
  { id: 'nichrome', zh: '镍铬合金', en: 'Nichrome', rho: 1.1e-6 },
];

/** 按 id 取材料；未知 id 回落第一项（铜），与 `defaults.material` 的默认值一致。 */
export function materialOf(id: string | undefined): (typeof MATERIAL_RHO)[number] {
  return MATERIAL_RHO.find((m) => m.id === id) ?? MATERIAL_RHO[0];
}

export function specimenResistance(rho: number, length: number, area: number): number {
  const r = safeNum(rho, 1.7e-8, 1e-10, 1e6);
  const l = safeNum(length, 1, 1e-3, 1e4);
  const s = safeNum(area, 5e-7, 1e-12, 1);
  return Math.max(1e-6, (r * l) / s);
}

/**
 * 元件的线性电阻。Infinity 表示开路；电源单独由求解器处理。
 * 该函数不抛异常，非法参数一律夹到安全范围（Fuzz 契约）。
 */
export function resistanceOf(el: CircuitComponent): number {
  const p = el.params ?? {};
  switch (el.kind) {
    case 'resistor': {
      if (p.mode === 'specimen') return specimenResistance(num(p.rho), num(p.length), num(p.area));
      return clampR(num(p.r, 10));
    }
    case 'wire':
      return clampR(num(p.r, 0.001));
    case 'heater':
      return clampR(num(p.r, 8));
    case 'bulb':
      if (el.state?.blown || el.state?.burnt) return Infinity;
      return bulbResistance(num(p.ratedVoltage, 3.8), num(p.ratedPower, 1.14), el.state?.temp ?? T_AMBIENT);
    case 'rheostat': {
      const minR = Math.max(0, num(p.minR, 0));
      const maxR = Math.max(minR, num(p.maxR, 20));
      const ratio = Math.min(1, Math.max(0, num(p.ratio, 0.5)));
      return clampR(minR + (maxR - minR) * ratio);
    }
    case 'switch':
      return p.closed === false ? Infinity : 1e-3;
    case 'ammeter':
      return clampR(num(p.r, 0.001));
    case 'voltmeter':
      return clampR(Math.max(1e3, num(p.r, 1e6)));
    case 'galvanometer':
      return clampR(num(p.r, 20));
    case 'fuse':
      return el.state?.blown ? Infinity : clampR(num(p.r, 0.05));
    case 'battery':
      return Infinity;
    default:
      return 1e-3;
  }
}

export function sourceEmf(el: CircuitComponent): number {
  return num(el.params?.emf, 6);
}

export function sourceInternalR(el: CircuitComponent): number {
  return clampR(Math.max(0.001, num(el.params?.r, 0.5)));
}

export function isSource(el: CircuitComponent): boolean {
  return el.kind === 'battery';
}

/** 两端元件在求解图里的连通性（闭合开关/导线会合并节点）。 */
export function mergesTerminals(el: CircuitComponent): boolean {
  if (el.kind === 'switch') return el.params?.closed !== false;
  if (el.kind === 'wire') return true;
  return false;
}

export function isOpen(el: CircuitComponent): boolean {
  if (el.kind === 'switch') return el.params?.closed === false;
  if (el.kind === 'fuse' && el.state?.blown) return true;
  if (el.kind === 'bulb' && (el.state?.blown || el.state?.burnt)) return true;
  return false;
}

export function isAnalogMeter(el: CircuitComponent): boolean {
  return el.kind === 'ammeter' || el.kind === 'voltmeter' || el.kind === 'galvanometer';
}

export function meterRange(el: CircuitComponent): number {
  if (el.kind === 'ammeter') return Math.max(0.001, num(el.params?.range, 0.6));
  if (el.kind === 'voltmeter') return Math.max(0.01, num(el.params?.range, 3));
  if (el.kind === 'galvanometer') return Math.max(1e-5, num(el.params?.range, 0.05));
  return Infinity;
}

// num / safeNum 已随灯泡公式搬到 ../bulb-core（同一套参数兜底口径），此处按需 import。

function clampR(r: number): number {
  return Math.min(1e9, Math.max(1e-6, r));
}
