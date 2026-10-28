/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 数据记录探针（纯函数，不依赖 React）
 *
 * 面板只负责渲染，选项表与取值都在这里：这样才能在单测里直接断言
 * 「开关、保险丝根本不进表」「电表永远排在最前面」「下拉里不出现内部 id」。
 *
 * 选项文案统一成「元件名 · 物理量 (单位)」（打开时左列元件名、右列量+单位；
 * 收起时只留 `灯泡 L₁ · U (V)`）。元件名走 circuit-bench-naming，
 * 画布上写的是同一个标号，学生照着画布就能在下拉里找到那一项。
 *
 * 分组与排序：
 * - 顶部一组＝画布上所有电流表 / 电压表 / 电流计（读数就是读数，先给表）；
 * - 其余按 电源 → 灯泡 → 定值电阻 → 变阻器 → 电热丝；
 * - 每个元件内部固定 U → I → R → P（→ T → Q），不随元件添加顺序乱跳。
 *
 * 开关/保险丝不进表：它们的 U/I/R 不是教学内容（保险丝真正的观测量是熔断与否，
 * 画布上已经用颜色和读数画出来了），塞进来只会把列表拉长、把真探针挤下去。
 *
 * 与画布联动的三件事也在这里（纯函数，便于单测直接断言）：
 * - 电表选项额外带 `gear`（当前挡位）与 `kind`（物理角色），多表同屏时靠它区分
 *   「电压表 V₁ 打在 3 V 挡」和「电压表 V₂ 打在 15 V 挡」；
 * - `meterOptions` 给出「画布上到底有没有电表」，面板据此决定空态提示；
 * - `goldenAxes` 按角色解析预设的黄金横纵轴，元件被删掉时自动往下回退。
 */
import { meterGearLabel, type BenchState, type ElementKind, type SolveResult } from './circuit-bench-core';
import { meterRange } from './circuit-bench-models';
import { elementName } from './circuit-bench-naming';

export type Quantity = 'voltage' | 'current' | 'resistance' | 'power' | 'temperature' | 'heat';

/** 量的固定顺序：U → I → R → P → T → Q。 */
export const QUANTITY_ORDER: readonly Quantity[] = ['voltage', 'current', 'resistance', 'power', 'temperature', 'heat'];

export const QUANTITY_MARK: Record<Quantity, string> = {
  voltage: 'U',
  current: 'I',
  resistance: 'R',
  power: 'P',
  temperature: 'T',
  heat: 'Q',
};

export const QUANTITY_LABEL: Record<Quantity, { zh: string; en: string }> = {
  voltage: { zh: '电压', en: 'Voltage' },
  current: { zh: '电流', en: 'Current' },
  resistance: { zh: '电阻', en: 'Resistance' },
  power: { zh: '功率', en: 'Power' },
  temperature: { zh: '温度', en: 'Temperature' },
  heat: { zh: '热量', en: 'Heat' },
};

export interface ProbeOption {
  /** 稳定键：`元件 id:量`，学生手选的轴键、CSV 列、回退逻辑都认它。 */
  key: string;
  elementId: string;
  quantity: Quantity;
  /** 打开时左列：元件名（含标号），「灯泡 L₁」。 */
  name: string;
  /** 打开时右列：物理量名（含符号），「电压 U」。 */
  quantityName: string;
  /** 收起时（触发器）：「灯泡 L₁ · U (V)」。 */
  short: string;
  /** 数据表表头 / CSV 列名：「灯泡 L₁ · 电压 U (V)」。 */
  label: string;
  unit: string;
  /** 读数来源：网表（求解结果）或元件状态（电热丝的温度/热量不在网表里）。 */
  source: 'result' | 'state';
  /** 单位换算：显示值 = 原值 × scale + offset。 */
  scale: number;
  offset: number;
  /** 分组：电表置顶，其余元件按种类顺序排。 */
  group: 'meter' | 'element';
  /**
   * 元件种类。用来做「黄金轴」的语义识别（电压表 → 横轴、电流计 → 纵轴），
   * 不参与文案——可选是为了让手写的幽灵探针（测试夹具）仍能构造出来。
   */
  kind?: ElementKind;
  /**
   * 电表当前挡位（`3 V` / `±50 mA`），非电表为 null。
   *
   * 挡位不进 `label` / `short`：那两处有「元件名 · 物理量 符号 (单位)」的形状契约
   * （见 circuit-bench.test.ts 的三段式断言），多挂一截就会把契约撑破。
   * 它在下拉里单独占一列——量程变了读数含义就变了，多表同屏时必须看得见。
   */
  gear?: string | null;
}

/** 电表：读数表里自带单位的量，排在所有元件之前。 */
const METER_KINDS: readonly string[] = ['ammeter', 'voltmeter', 'galvanometer'];

/** 这只元件是不是电表（决定挡位要不要报出来、要不要参与「黄金轴」绑定）。 */
export function isMeterKind(kind: string): boolean {
  return METER_KINDS.includes(kind);
}

/** 画布上的电表探针（下拉里最上面那一组）。空数组 = 画布上没有任何测量电表。 */
export function meterOptions(options: readonly ProbeOption[]): ProbeOption[] {
  return options.filter((o) => o.group === 'meter');
}

/** 元件组顺序：电源 → 灯泡 → 定值电阻 → 变阻器 → 电热丝。 */
const ELEMENT_ORDER: readonly string[] = ['battery', 'bulb', 'resistor', 'rheostat', 'heater'];

/**
 * 每种元件可记录的量。
 *
 * 开关/保险丝/导线是空表：不出现在下拉里（见文件抬头）。
 */
const KIND_QUANTITIES: Record<string, readonly Quantity[]> = {
  battery: ['voltage', 'current'],
  bulb: ['voltage', 'current', 'resistance', 'power'],
  resistor: ['voltage', 'current', 'resistance', 'power'],
  rheostat: ['voltage', 'current', 'resistance', 'power'],
  heater: ['voltage', 'current', 'resistance', 'power', 'temperature', 'heat'],
  ammeter: ['current'],
  voltmeter: ['voltage'],
  galvanometer: ['current'],
  switch: [],
  fuse: [],
  wire: [],
};

/** 个别元件对某个量有自己的叫法（滑动变阻器读的是「接入电阻」而不是元件电阻）。 */
const QUANTITY_NAME_OVERRIDE: Record<string, Partial<Record<Quantity, { zh: string; en: string }>>> = {
  rheostat: { resistance: { zh: '接入电阻', en: 'Set resistance' } },
};

interface QuantitySpec {
  unit: string;
  source: 'result' | 'state';
  scale: number;
  offset: number;
}

/**
 * 单位与换算。
 *
 * - 电热丝的温度在元件状态里是开尔文（与环境温度同一套刻度），显示按摄氏度：
 *   `offset = -273.15`；热量本身是 J，直接读。
 * - 电流计的量程是几十毫安，显示成 mA 才有读数精度（50.0 mA 而不是 0.05 A），
 *   所以 `scale = 1000`——键仍是 `元件:current`，只有显示值变。
 */
function specOf(kind: string, quantity: Quantity): QuantitySpec {
  if (quantity === 'temperature') return { unit: '°C', source: 'state', scale: 1, offset: -273.15 };
  if (quantity === 'heat') return { unit: 'J', source: 'state', scale: 1, offset: 0 };
  if (quantity === 'current' && kind === 'galvanometer') {
    return { unit: 'mA', source: 'result', scale: 1000, offset: 0 };
  }
  if (quantity === 'current') return { unit: 'A', source: 'result', scale: 1, offset: 0 };
  if (quantity === 'voltage') return { unit: 'V', source: 'result', scale: 1, offset: 0 };
  if (quantity === 'resistance') return { unit: 'Ω', source: 'result', scale: 1, offset: 0 };
  return { unit: 'W', source: 'result', scale: 1, offset: 0 };
}

function quantityNameOf(kind: string, quantity: Quantity, lang: 'zh' | 'en'): string {
  const overridden = QUANTITY_NAME_OVERRIDE[kind]?.[quantity];
  const base = overridden ?? QUANTITY_LABEL[quantity];
  return `${base[lang]} ${QUANTITY_MARK[quantity]}`;
}

/**
 * 当前画布上真实可记录的探针。
 *
 * 表由画布本身生成（不再依赖预设里写死的 probes）：元件一旦被学生删掉，
 * 它的探针跟着消失，不会留下「下拉里列着、画布上却没有」的幽灵项。
 */
export function buildOptions(state: BenchState, lang: 'zh' | 'en' = 'zh'): ProbeOption[] {
  const out: ProbeOption[] = [];
  const push = (el: BenchState['components'][number], quantity: Quantity, group: 'meter' | 'element') => {
    if (!KIND_QUANTITIES[el.kind]?.includes(quantity)) return;
    const spec = specOf(el.kind, quantity);
    const name = elementName(state, el, lang);
    const quantityName = quantityNameOf(el.kind, quantity, lang);
    out.push({
      key: `${el.id}:${quantity}`,
      elementId: el.id,
      quantity,
      name,
      quantityName,
      short: `${name} · ${QUANTITY_MARK[quantity]} (${spec.unit})`,
      label: `${name} · ${quantityName} (${spec.unit})`,
      unit: spec.unit,
      source: spec.source,
      scale: spec.scale,
      offset: spec.offset,
      group,
      kind: el.kind,
      gear: isMeterKind(el.kind) ? meterGearLabel(el.kind, meterRange(el)) : null,
    });
  };

  // ① 画布上的电表（按画布顺序，不按种类分组：A 就在 V 旁边，学生一眼扫过去）
  for (const el of state.components) {
    if (!METER_KINDS.includes(el.kind)) continue;
    for (const q of QUANTITY_ORDER) push(el, q, 'meter');
  }
  // ② 元件组：固定种类顺序，同类内按画布顺序
  for (const kind of ELEMENT_ORDER) {
    for (const el of state.components) {
      if (el.kind !== kind) continue;
      for (const q of QUANTITY_ORDER) push(el, q, 'element');
    }
  }
  return out;
}

/**
 * 「黄金探究组合」：若干课标实验里那张图该画什么，是**按元件的物理角色**定死的，
 * 不该让预设作者手写元件内部 id 去凑。
 *
 * 手写 id 的老办法有两种失效方式：学生把电压表删了，预设里写死的 `v1:voltage`
 * 就指向幽灵探针；而惠斯通电桥那种「纵轴必须是检流计」的语义，写成数组下标后
 * 会被下一个人重排 probes 时无声改掉。这里改成「找同类元件」：谁在画布上
 * 承担这个角色，轴就落在谁身上，跟 id 叫什么无关。
 */
const GOLDEN_AXES: Record<string, readonly [AxisWant, AxisWant]> = {
  // 欧姆定律 / 小灯泡伏安特性：横轴 = 被测元件两端的电压表，纵轴 = 干路电流表，
  // 载入即可直接画出标准的 I-U 图，不必先手动配轴。
  ohm: [
    { kind: 'voltmeter', quantity: 'voltage' },
    { kind: 'ammeter', quantity: 'current' },
  ],
  iv: [
    { kind: 'voltmeter', quantity: 'voltage' },
    { kind: 'ammeter', quantity: 'current' },
  ],
  // 惠斯通电桥：纵轴永远对齐灵敏电流计（零示法看的正是 G 的偏转），
  // 横轴取桥臂电压，看 G 过零时桥臂落在哪一档。
  bridge: [
    { kind: 'resistor', quantity: 'voltage' },
    { kind: 'galvanometer', quantity: 'current' },
  ],
};

interface AxisWant {
  kind: ElementKind;
  quantity: Quantity;
}

/** 按「物理角色」在现有选项里找一条：找不到返回 null（元件已被学生删掉）。 */
function pickByRole(options: readonly ProbeOption[], want: AxisWant): string | null {
  const hit = options.find((o) => o.kind === want.kind && o.quantity === want.quantity);
  return hit?.key ?? null;
}

/**
 * 载入预设时横纵轴的落点，三级优先：
 *
 * 1. **黄金组合**（按角色找）——课标实验的图该画什么，上面那张表说了算；
 * 2. 预设作者写的 `probes[i]`——作者比通用规则更懂这个实验，只是不能覆盖角色语义；
 * 3. 列表第 i 项——电表在前，总能画出点东西。
 *
 * 任一档落到画布上已经不存在的探针就自动往下走，所以预设里写的元件被删掉
 * 也不会把轴停在幽灵探针上。
 */
export function goldenAxes(
  presetId: string | undefined,
  presetProbes: readonly { elementId: string; quantity: Quantity }[] | undefined,
  options: readonly ProbeOption[],
): [string, string] {
  const golden = presetId ? GOLDEN_AXES[presetId] : undefined;
  const byAuthor = (i: number): string | null => {
    const want = presetProbes?.[i];
    if (!want) return null;
    const hit = options.find((o) => o.elementId === want.elementId && o.quantity === want.quantity);
    return hit?.key ?? null;
  };
  const fallback = (i: number) => options[i]?.key ?? options[0]?.key ?? '';
  return [
    (golden && pickByRole(options, golden[0])) ?? byAuthor(0) ?? fallback(0),
    (golden && pickByRole(options, golden[1])) ?? byAuthor(1) ?? fallback(1),
  ];
}

/**
 * 取一条探针当前的读数（已按单位换算）。
 *
 * 求解结果里的读数一律取绝对值：表笔接反时电流为负，学生要读的是大小，
 * 符号在画布上另有 ⚠ 提示。元件状态里的量不取绝对值——温度换到摄氏度后
 * 是可能有正负之分的量，取绝对值等于篡改物理量。
 */
export function readProbe(state: BenchState, result: SolveResult | null, probe: ProbeOption): number {
  let raw: number;
  if (probe.source === 'state') {
    const el = state.components.find((c) => c.id === probe.elementId);
    if (!el) return NaN;
    raw = probe.quantity === 'temperature' ? el.state.temp : probe.quantity === 'heat' ? el.state.heat : NaN;
  } else {
    const reading = result?.elements[probe.elementId];
    if (!reading) return NaN;
    const value = reading[probe.quantity as 'current' | 'voltage' | 'resistance' | 'power'];
    raw = Number.isFinite(value) ? Math.abs(value) : NaN;
  }
  if (!Number.isFinite(raw)) return NaN;
  return raw * probe.scale + probe.offset;
}
