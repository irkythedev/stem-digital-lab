/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 元件命名（画布标号 + 数据记录里的元件名）
 *
 * 由来（一次实测截图）：预设里的灯泡只写了参数、没写 label，数据记录下拉就回落到
 * 内部 id，列表里出现 `l1 I (A)`——无衬线字体下小写 `l` 和大写电流符号 `I` 分不开；
 * 电流表更只有 `A I (A)`，元件名、物理量符号、单位三样挤成一串。
 *
 * 于是把命名收成一条口径，画布标签层与数据记录下拉**共用同一个函数**：
 * - 元件名 = 种类名 + 标号（`电流表 A`、`灯泡 L₁`、`变阻器 Rp`）；
 * - 标号按种类派生：灯泡/定值电阻/电热丝永远带下标（L₁、R₁），
 *   电表/开关/保险丝只有一个时就用裸符号（A、V、G、S、FU），同类多于一个才编号；
 * - 电源没有教科书标号，只有画布上真有两个电源时才用 E₁/E₂ 区分。
 *
 * 元件自带 label（预设里的「电源」「试样」）优先，但**只允许放描述性名字**：
 * 符号型标签（A / V / R′ / FU）一律从预设里撤掉，否则 `A · 电流 I (A)`
 * 那种「元件名与单位打架」的文案迟早从某个角落漏出来。
 *
 * 内部 id（l1 / r2 / rh）永远只是内部 id，绝不作为用户可见的名称。
 */
import { componentLabel, type BenchState, type CircuitComponent, type ElementKind } from './circuit-bench-core';

/** 元件种类名：与元件栏一致的短名（灯泡 / 电阻 / 变阻器…），不是元件栏里的全名。 */
export const KIND_LABEL: Record<ElementKind, { zh: string; en: string }> = {
  battery: { zh: '电源', en: 'Cell' },
  resistor: { zh: '电阻', en: 'Resistor' },
  bulb: { zh: '灯泡', en: 'Bulb' },
  rheostat: { zh: '变阻器', en: 'Rheostat' },
  switch: { zh: '开关', en: 'Switch' },
  ammeter: { zh: '电流表', en: 'Ammeter' },
  voltmeter: { zh: '电压表', en: 'Voltmeter' },
  galvanometer: { zh: '电流计', en: 'Galvanometer' },
  fuse: { zh: '保险丝', en: 'Fuse' },
  heater: { zh: '电热丝', en: 'Heater' },
  wire: { zh: '导线', en: 'Wire' },
};

/** 标号基线：`灯泡 L` → `L₁`。空串表示这一种类不给标号（导线自己就是一段线）。 */
const SYMBOL_BASE: Record<ElementKind, string> = {
  battery: 'E',
  resistor: 'R',
  bulb: 'L',
  rheostat: 'Rp',
  switch: 'S',
  ammeter: 'A',
  voltmeter: 'V',
  galvanometer: 'G',
  fuse: 'FU',
  heater: 'R',
  wire: '',
};

/**
 * 常驻下标的种类：教科书里灯泡、定值电阻、电热丝永远写成 L₁ / R₁，
 * 哪怕画布上只有一个；电表、开关、保险丝则「只有一个就不编号」（`A` 而不是 `A₁`）。
 */
const ALWAYS_INDEXED: ReadonlySet<ElementKind> = new Set<ElementKind>(['bulb', 'resistor', 'heater']);

/** 只有一个时用「裸符号」的种类：表盘/闸刀上本来就画着 A / V / G / S / FU，不必再起名。 */
const BARE_WHEN_SINGLE: ReadonlySet<ElementKind> = new Set<ElementKind>([
  'ammeter',
  'voltmeter',
  'galvanometer',
  'switch',
  'fuse',
]);

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';

/** 把序号写成下标数字：1 → ₁。超出 0-9 的位数逐位转换（10 → ₁₀）。 */
export function subscript(n: number): string {
  const digits = String(Math.max(0, Math.round(n)));
  return [...digits].map((d) => SUBSCRIPTS[Number(d)] ?? d).join('');
}

/**
 * 元件标号：同类元件在画布上的第几只决定下标。
 *
 * 序号取自 `state.components` 的顺序（= 元件栏添加顺序 / 预设书写顺序），
 * 所以「画布上从左到右第 2 只灯泡」与下拉里的 `L₂` 永远对得上；
 * 学生删掉 L₁ 后剩下的那只自动变成 L₁，不会留下跳号的空档。
 *
 * 只有一个时的三种写法：常驻下标（灯泡 L₁）／裸符号（电流表 A）／干脆不写
 * （电源——教科书里它没有标号，画布上就写「电源」，两个电源才开始分 E₁ / E₂）。
 */
export function elementTag(state: BenchState, el: CircuitComponent): string {
  const base = SYMBOL_BASE[el.kind] ?? '';
  if (!base) return '';
  const same = state.components.filter((c) => c.kind === el.kind);
  const index = same.findIndex((c) => c.id === el.id);
  const ordinal = index >= 0 ? index + 1 : same.length + 1;
  if (same.length > 1) return base + subscript(ordinal);
  if (ALWAYS_INDEXED.has(el.kind)) return base + subscript(ordinal);
  return BARE_WHEN_SINGLE.has(el.kind) ? base : '';
}

/**
 * 数据记录下拉左列的元件名：`灯泡 L₁`、`电流表 A`、`变阻器 Rp`。
 *
 * 带描述性 label 的元件（预设里的「试样」）直接用那个名字——它已经比
 * 「电阻 R₁」信息量更大，再拼一次种类名只会变成「电阻 试样」。
 */
export function elementName(state: BenchState, el: CircuitComponent, lang: 'zh' | 'en' = 'zh'): string {
  const explicit = componentLabel(el, lang).trim();
  if (explicit) return explicit;
  const label = KIND_LABEL[el.kind]?.[lang] ?? el.kind;
  const tag = elementTag(state, el);
  return tag ? `${label} ${tag}` : label;
}

/**
 * 画布上的元件名标签：与下拉同源，但取**短的那一半**。
 *
 * 画布上 `L₁` 就够了（下拉里才需要「灯泡」三个字来解释 L 是什么），
 * 电源这种没有标号的种类才退回种类名（`电源` / `Cell`）。
 */
export function elementCanvasLabel(state: BenchState, el: CircuitComponent, lang: 'zh' | 'en' = 'zh'): string {
  const explicit = componentLabel(el, lang).trim();
  if (explicit) return explicit;
  const tag = elementTag(state, el);
  if (tag) return tag;
  return KIND_LABEL[el.kind]?.[lang] ?? '';
}
