/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 元件状态与监控看板（纯函数层）
 *
 * 把「现在整台仪器上每只元件到底怎么了」聚合成一张表：用电器看 U/I/P 与工作状态，
 * 电表看读数、量程占用率、接反与过载，其余（电源/开关/保险丝）看通断与熔断。
 *
 * 这里只做数据，不碰 DOM：语言、单位前缀、量程挡位全部复用现有口径
 * （`elementName` / `formatPhysicalValue` / `meterRange` / `readingReversed`），
 * 免得看板上的数字和画布标签、数据记录各说各话。
 *
 * 除了「现在怎么样」，这里还回答了「接下来会怎么样」的一半：
 * `repairCaution` 预测「一键修复」之后会不会立刻又坏（物理后果），
 * `deenergizePlan` 判断更换元件之前是否必须先断开某只开关（实验操作规范）——
 * 前者管「会不会烧」，后者管「该不该带电动手」，两套判据各自独立。
 */
import type { BenchState, CircuitComponent, ElementKind, ElementReading, SolveResult } from './circuit-bench-core';
import { finite, formatPhysicalValue, LIVE_CURRENT_A, resetElementState, solveCircuit } from './circuit-bench-core';
import { elementCanvasLabel, elementName } from './circuit-bench-naming';
import { isFaulty } from './circuit-bench-menu';
import { bulbRadK, bulbResistance, FUSE_TRIP_HEAT, meterRange, T_AMBIENT, T_BULB_BURN } from './circuit-bench-models';
import { readingReversed } from './circuit-bench-labels';

/** 用电器：会发热/发光的耗能元件，看板第一组。 */
const LOAD_KINDS: ReadonlySet<ElementKind> = new Set<ElementKind>([
  'bulb',
  'resistor',
  'heater',
  'rheostat',
]);

/** 电表：看板第二组，读数 + 量程占用率 + 接反/过载。 */
const METER_KINDS: ReadonlySet<ElementKind> = new Set<ElementKind>([
  'ammeter',
  'voltmeter',
  'galvanometer',
]);

/**
 * 灯泡「亮着」的门槛：与电路图/实物图里灯泡发光的判据同源（`power / ratedPower`），
 * 1% 以上才亮，避免「残余电流」把熄灭写成发光。
 */
const LIT_FRACTION = 0.01;

/**
 * 「真的有电流」的门槛（A）。**不能用 `> 1e-9`**。
 *
 * 求解器在每个节点对地挂了 `GMIN = 1e-9 S` 的数值接地（见 core 的 `solveDcArrays`），
 * 断开的开关支路因此仍有 `GMIN · U` 量级的漏电流：6 V 电源下实测 6e-9–2.4e-8 A，
 * 恰好越过旧的 1e-9 判据。于是「开关一断，电阻仍显示发热、电源仍显示供电中」——
 * 学生看到 0.00 A 的读数旁边挂着琥珀色「发热」，这是纯数值泄漏被当成了物理状态。
 *
 * 1e-5 A = 10 µA：比任何中学实验里可观测的电流都小三个数量级，又比数值泄漏大三个
 * 数量级，正好落在两者之间的空带里。功率门槛同理（P = I²R，10 µA 过 8 Ω 只有 8e-10 W）。
 *
 * 定义在 core 里（求解器标连接件的 `nodeLive` 也要用同一个阈值），这里转出给看板
 * 与既有引用；两处各写一份就会出现「看板说没电流、检查器说在回路里」。
 */
export { LIVE_CURRENT_A };
export const LIVE_POWER_W = 1e-4;
/** 电压表没有电流也能有读数：并联在断开的开关两端时它照样量出电源电压。 */
export const LIVE_VOLTAGE_V = 1e-4;

/**
 * 工作状态关键词，与 InspectorPanel 的「已烧毁 / 已熔断」保持同一套说法。
 *
 * `heating` 与 `lit` 分开：两者都是「正在工作的暖色态」（界面上同为琥珀金），
 * 但文案不同——灯泡说「发光」、电阻/电热丝/变阻器说「发热」，混用会被学生当成写错了。
 *
 * `idle` 是「接入但无电流」：开关断开、支路开路、保险丝熔断后的串联电阻都落在这里。
 * 它必须与 `normal`（通电且正常）分开——否则一块绿色的「正常」会压在 0.00 A 上，
 * 学生只会读成「电路还通着」。
 */
export type LoadStatus = 'normal' | 'idle' | 'lit' | 'heating' | 'dark' | 'burnt' | 'blown';

export interface LoadRow {
  id: string;
  kind: ElementKind;
  name: string;
  status: LoadStatus;
  statusText: string;
  /** 两端电压 U（V，取绝对值——反向只是接线极性，不是负的电压读数）。 */
  voltage: number;
  /** 支路电流 I（A，取绝对值）。 */
  current: number;
  /** 实时功耗 P（W，取绝对值）。 */
  power: number;
  /** 熔毁（灯泡烧毁 / 保险丝熔断）：看板据此把它整行标红。 */
  faulty: boolean;
  /** 通电与否：断开/未接入的元件是「无读数」，不是 0 W 的静默读数。 */
  live: boolean;
}

export interface MeterRow {
  id: string;
  kind: ElementKind;
  name: string;
  /** 表盘当前读数（取绝对值，接反由 `reversed` 单独表达）。 */
  value: number;
  unit: 'A' | 'V';
  /** 当前挡位满量程。 */
  range: number;
  /** 量程占用率，0-1 之间不截断（过载时 > 1，看板据此报警）。 */
  usage: number;
  reversed: boolean;
  over: boolean;
  live: boolean;
}

/**
 * 电源 / 开关 / 保险丝 / 导线：一句话说清当前状态。
 *
 * 除文案外还给出配色语义，`status` 只表达「好 / 静息 / 坏」三种语义，
 * 具体色值由组件按主题落定——模型层不碰颜色，免得深色主题下两张皮。
 */
export interface OtherRow {
  id: string;
  kind: ElementKind;
  name: string;
  text: string;
  /** 导通/闭合/供电 = ok；断开/未接入 = idle；熔断 = fault。 */
  status: 'ok' | 'idle' | 'fault';
  /** 两侧电压 U（V，取绝对值）。 */
  voltage: number;
  /** 支路电流 I（A，取绝对值）。 */
  current: number;
  live: boolean;
  faulty: boolean;
}

export interface MonitorModel {
  loads: LoadRow[];
  meters: MeterRow[];
  others: OtherRow[];
  /**
   * 画布上**一只元件都没有**（还没拖进来，或者刚清空）。看板据此切到引导态：
   * 空台面不是「一切正常」，见 `monitorVerdict`。
   */
  empty: boolean;
  /** 全部熔毁元件 id：一键修复的输入，也是看板报警的判据。 */
  faultIds: string[];
  /** 过载/接反的电表数，供折叠态红点提示。 */
  meterAlerts: number;
}

/**
 * 看板的一句话结论，四档语义互斥：空台面 / 有东西坏了 / 电表告警 / 都正常。
 *
 * `meter` 单列一档：电表超量程或表笔接反时，电路本身没坏（没有熔毁元件），
 * 但「N 元件正常」这句话会把学生的注意力从「表针已经打到底」上引开。
 */
export type MonitorVerdict = 'empty' | 'fault' | 'meter' | 'ok';

/**
 * 判定顺序：**空 → 故障 → 电表告警 → 正常**。
 *
 * 空必须排在故障之前，否则会掉进「0 元件正常」这种机械结论：空画布的
 * `faultIds` 天然为空，只看故障有无就会顺理成章地打出一个绿勾——可那不是一个
 * 结论，只是一个没有任何测量支撑的空真（「没有损坏的元件」和「没有元件」在布尔
 * 上等价，在认知上正好相反）。学生看到绿勾会以为「检查过了，没问题」，
 * 而台面上其实什么都还没有。
 *
 * 电表告警排在正常之前，同理：熔毁是「坏了」，超量程/接反是「读不出来」，
 * 两者都不是绿勾能概括的状态。
 */
export function monitorVerdict(model: MonitorModel): MonitorVerdict {
  if (model.empty) return 'empty';
  if (model.faultIds.length > 0) return 'fault';
  return model.meterAlerts > 0 ? 'meter' : 'ok';
}

function statusTextOf(status: LoadStatus, lang: 'zh' | 'en'): string {
  const zh: Record<LoadStatus, string> = {
    normal: '正常',
    idle: '未通电',
    lit: '发光',
    heating: '发热',
    dark: '熄灭',
    burnt: '烧毁',
    blown: '熔断',
  };
  const en: Record<LoadStatus, string> = {
    normal: 'Normal',
    idle: 'Idle',
    lit: 'Lit',
    heating: 'Heating',
    dark: 'Dark',
    burnt: 'Burnt out',
    blown: 'Blown',
  };
  return (lang === 'zh' ? zh : en)[status];
}

/** 灯泡的发光判据复用电路图里的 `power / ratedPower`：功率与额定值比，不是「有没有电流」。 */
function bulbLit(el: CircuitComponent, power: number): boolean {
  const rated = Number(el.params.ratedPower);
  const safe = Number.isFinite(rated) && rated > 0 ? rated : 1;
  return Math.abs(power) / safe >= LIT_FRACTION;
}

function loadStatus(el: CircuitComponent, live: boolean, power: number): LoadStatus {
  if (el.kind === 'bulb' && el.state.burnt) return 'burnt';
  if (el.kind === 'fuse' && el.state.blown) return 'blown';
  // 无流支路一律中性灰：灯泡说「熄灭」，电阻/变阻器/电热丝说「未通电」。
  // 这一行必须排在 `bulbLit` 之前，也不能回落到 `normal`——`normal` 是绿色「正常」，
  // 挂在 0.00 A 上等于告诉学生「电路还通着」。
  if (!live) return el.kind === 'bulb' ? 'dark' : 'idle';
  if (el.kind === 'bulb') return bulbLit(el, power) ? 'lit' : 'dark';
  // 电阻类元件通电即发热：这是它的正常工作态，不是「故障」，所以走暖色而不是红。
  return 'heating';
}

/**
 * 某一支路「真的在通电」吗？
 *
 * 同时看电流与功率，而不是只看 `reading.current > 1e-9`：后者会把求解器的
 * `GMIN` 漏电流（6 V 下 1e-8 A 量级）当成真实电流，断开开关后电阻照样报「发热」。
 */
function loadLive(reading: ElementReading | undefined): boolean {
  if (!reading) return false;
  const current = Math.abs(reading.current);
  const power = Math.abs(reading.power);
  return Number.isFinite(current) && Number.isFinite(power) && current > LIVE_CURRENT_A && power > LIVE_POWER_W;
}

/** 电表的「有读数」判据按被测量分开：电压表并联开路也能量出电压，没有电流。 */
function meterLive(kind: ElementKind, reading: ElementReading | undefined): boolean {
  if (!reading) return false;
  if (kind === 'voltmeter') return Number.isFinite(reading.voltage) && Math.abs(reading.voltage) > LIVE_VOLTAGE_V;
  return Number.isFinite(reading.currentAB) && Math.abs(reading.currentAB) > LIVE_CURRENT_A;
}

/**
 * 建表。元件的分组由种类决定（不依赖读数存在与否），所以「装了没接线」的元件
 * 也会出现在看板上——学生正需要看见它「接入但没电流」。
 *
 * 三元表全空时 `empty` 为真：看板不该拿一张空表去汇报「正常」，而该改成引导
 * （见 `monitorVerdict` 与 `CircuitMonitor` 的空态分支）。
 */
export function buildMonitorModel({
  state,
  readings,
  lang = 'zh',
  shortCircuit = false,
}: {
  state: BenchState;
  readings?: Record<string, ElementReading> | null;
  lang?: 'zh' | 'en';
  /**
   * 求解器报出的「电源两端被直接短接」。看板据此把电源标成红色 `fault`：
   * 短路时端电压被拉到接近 0，单看读数与「轻载」分不开，只有求解器的拓扑判定是权威的。
   */
  shortCircuit?: boolean;
}): MonitorModel {
  const loads: LoadRow[] = [];
  const meters: MeterRow[] = [];
  const others: OtherRow[] = [];
  const faultIds: string[] = [];

  for (const el of state.components) {
    const reading = readings?.[el.id];
    const live = loadLive(reading);
    const name = elementName(state, el, lang);
    const faulty = isFaulty(el);
    if (faulty) faultIds.push(el.id);

    if (LOAD_KINDS.has(el.kind)) {
      const power = reading ? Math.abs(reading.power) : 0;
      const status = loadStatus(el, live, power);
      loads.push({
        id: el.id,
        kind: el.kind,
        name,
        status,
        statusText: statusTextOf(status, lang),
        voltage: reading ? Math.abs(reading.voltage) : 0,
        current: reading ? Math.abs(reading.currentAB) : 0,
        power,
        faulty,
        live,
      });
      continue;
    }

    if (METER_KINDS.has(el.kind)) {
      const range = meterRange(el);
      const raw = el.kind === 'voltmeter' ? (reading?.voltage ?? 0) : (reading?.currentAB ?? 0);
      const value = Math.abs(raw);
      meters.push({
        id: el.id,
        kind: el.kind,
        name,
        value,
        unit: el.kind === 'voltmeter' ? 'V' : 'A',
        range,
        usage: range > 0 ? value / range : 0,
        reversed: reading ? readingReversed(el.kind, reading) : false,
        // 与求解器过载告警同一阈值口径：超满量程才算过载。
        over: range > 0 && value > range * 1.000001,
        live: meterLive(el.kind, reading),
      });
      continue;
    }

    /*
     * 导线元件两端在求解器里被并成同一节点，支路电压恒为 0，`loadLive` 因此恒 false。
     * 若直接拿它建行，串联在干路上的导线永远显示「无电流」——它明明扛着整条回路的
     * 电流。通断改问求解器标在读数上的 `nodeLive`（所在节点是否在载流回路里）。
     */
    const connectorLive = el.kind === 'wire' ? (reading?.nodeLive ?? false) : live;
    others.push({
      id: el.id,
      kind: el.kind,
      name,
      text: otherText(el, connectorLive, lang, shortCircuit),
      status: otherStatus(el, connectorLive, shortCircuit),
      voltage: reading ? Math.abs(reading.voltage) : 0,
      current: reading ? Math.abs(reading.currentAB) : 0,
      live: connectorLive,
      faulty,
    });
  }

  return {
    loads,
    meters,
    others,
    empty: state.components.length === 0,
    faultIds,
    meterAlerts: meters.filter((m) => m.over || m.reversed).length,
  };
}

/**
 * 电源/开关/保险丝的状态语义。
 *
 * 阈值口径与 `otherText` 完全一致（同一处判断抄两遍也要抄得一样）：
 * 只有「熔断」与「短路」是故障，闭合的开关与供电中的电源都是**正常工作态**——
 * 它们的绿色说明「路是通的」，红色只留给真出事的那一只。
 */
function otherStatus(el: CircuitComponent, live: boolean, shortCircuit: boolean): 'ok' | 'idle' | 'fault' {
  if (el.kind === 'fuse') {
    if (el.state.blown) return 'fault';
    return live ? 'ok' : 'idle';
  }
  if (el.kind === 'switch') return el.params.closed === false ? 'idle' : 'ok';
  // 短路时电源端电压被拉到接近 0：它不是在「正常工作」，是在被自己灌爆。
  if (el.kind === 'battery' && shortCircuit) return 'fault';
  return live ? 'ok' : 'idle';
}

function otherText(el: CircuitComponent, live: boolean, lang: 'zh' | 'en', shortCircuit: boolean): string {
  const zh = lang === 'zh';
  if (el.kind === 'fuse') {
    if (el.state.blown) return zh ? '熔断' : 'Blown';
    return live ? (zh ? '导通' : 'Conducting') : zh ? '无电流' : 'No current';
  }
  if (el.kind === 'switch') {
    return el.params.closed === false ? (zh ? '断开' : 'Open') : zh ? '闭合' : 'Closed';
  }
  if (el.kind === 'wire') {
    // 连接件只有「在回路里 / 不在回路里」两态，没有电流读数可报：
    // 「无电流」在开路时是实话，在串联干路上就是假话，所以通断要按 nodeLive 说。
    return live ? (zh ? '导通' : 'Conducting') : zh ? '无电流' : 'No current';
  }
  if (el.kind === 'battery') {
    if (shortCircuit) return zh ? '短路' : 'Shorted';
    // 干路无电流时电源仍然挂在那里、端电压仍在，说「未接入」是不对的；
    // 「开路 / 待机」才描述的是「有电源，但回路没通」。
    return live ? (zh ? '供电中' : 'Supplying') : zh ? '待机 · 开路' : 'Idle · open';
  }
  return live ? (zh ? '有电流' : 'Carrying current') : zh ? '无电流' : 'No current';
}

/** 看板用的数值文案：全部走工程单位格式化，界面上不出现科学计数法。 */
export function monitorValue(value: number, unit: string): string {
  return formatPhysicalValue(value, unit);
}

/* ------------------------------------------------------------------ *
 * 「一键修复」之前的那句提醒：这条路还是坏的，修了还会坏
 * ------------------------------------------------------------------ */

/**
 * 红条上的提醒：这次「一键修复」修得住吗？修不住就说明白先动哪一下。
 *
 * 由来是一次真实的课堂反馈链：短接开关 S₂ 还闭着的时候点「一键修复」，换上去的
 * 保险丝 0.09 s 内又熔断——学生眼里这是「修不好 / 按钮坏了」，而真相是「路还是
 * 短路的」，故障根本不在保险丝身上。与其让人反复点、反复怀疑工具，不如在红条上
 * 先把话说明白：先断开 S₂ 再修复。
 *
 * 判据复用仿真自己那套物理，不另立标准（另立一套就会出现「提示说没事、下一秒
 * 又烧了」这种自相矛盾）：
 * - 保险丝：发热量稳态值就是 `I²/额定²`（见 `stepSimulation` 里那条一阶 ODE 的
 *   平衡点），电流不依赖保险丝自身温度，所以只要这个稳态值超过 `FUSE_TRIP_HEAT`，
 *   无论热时间常数多长都必然熔断——这一步是**精确**的，不是估算；
 * - 灯泡：把钨丝温度直接推到「刚好烧断」那一刻再解一次电路，若那时输入的电功率
 *   仍大于辐射散热功率（`P > k(T⁴ − T₀⁴)`，k 与 `bulbHeatCapacity` 里同一个口径），
 *   温度就会继续往上走，同样必然烧断。
 */
export interface RepairCaution {
  /** 修好后照样会坏的元件（用完整名字，如「保险丝 FU」）。 */
  atRisk: string;
  /** 建议先断开的开关标号（如 `S₂`）；null = 没有单只开关能救，只能泛泛提示。 */
  openSwitch: string | null;
  text: string;
}

/** 在 `state` 基础上，把某只元件的热状态烧到指定温度后的新状态（不动原状态）。 */
function withBulbTemp(state: BenchState, id: string, temp: number): BenchState {
  return {
    ...state,
    components: state.components.map((el) => (el.id === id ? { ...el, state: { ...el.state, temp } } : el)),
  };
}

/** 在 `state` 基础上断开某只开关（不动原状态）。 */
function withSwitchOpen(state: BenchState, id: string): BenchState {
  return {
    ...state,
    components: state.components.map((el) => (el.id === id ? { ...el, params: { ...el.params, closed: false } } : el)),
  };
}

/**
 * 已经修好的电路里，还会有谁被烧掉？返回这些元件的 id（空数组 = 修得住）。
 *
 * 只判「热积累型」故障：保险丝与灯泡。接反、过载这类电气故障不看——它们不会
 * 在修好之后 0.1 秒内把元件毁掉，也就没有「先断开再修」这层意思。
 */
function rebuiltFaults(state: BenchState): string[] {
  const result = solveCircuit(state);
  if (!result.ok) return [];
  const ids: string[] = [];
  for (const el of state.components) {
    const reading = result.elements[el.id];
    if (!reading) continue;
    const current = Math.abs(reading.current);

    if (el.kind === 'fuse') {
      const rated = Math.max(0.01, finite(el.params?.ratedCurrent, 1));
      const heat = (current * current) / (rated * rated);
      if (current > 1e-9 && heat > FUSE_TRIP_HEAT) ids.push(el.id);
      continue;
    }

    if (el.kind !== 'bulb') continue;
    const ratedV = Math.max(0.1, finite(el.params?.ratedVoltage, 3.8));
    const ratedP = Math.max(0.01, finite(el.params?.ratedPower, 1.14));
    // 原本这里有一条「端电压不超额定就跳过」的先行判据（省一次重解）。它不健全：
    // 它拿**刚换上的冷态**电压去推「钨丝升不到额定温度」，可冷态灯丝阻值只有额定
    // 值的约 1/9，端电压低并不代表功率低——6 V 串两只 3.8 V 灯泡，冷态端电压
    // 2.70 V < 3.80 V，实际功率却有 5.37 W ≈ 4.7×额定。那条捷径因此会在最该
    // 预警的场合直接 `continue`，预告静默漏报。
    //
    // 现在一律走下面的精确判据：把这只灯泡按在 T_BULB_BURN 上重解一次，比较
    // 「该温度下的电功率」与「该温度下的辐射散热」。只有电功率确实超过散热，
    // 即稳态解不存在、温度必然继续上爬到烧断线，才报告「修完还会烧」。
    // 冷态浪涌本身不再是烧毁通道——它已由 stepSimulation 的逐子步联合重解
    // 消耗掉（灯丝一热阻值立涨、电流随即回落），所以这里不该再拿浪涌功率定罪。
    const hotState = withBulbTemp(state, el.id, T_BULB_BURN);
    const hot = solveCircuit(hotState).elements[el.id];
    if (!hot) continue;
    const rBurn = bulbResistance(ratedV, ratedP, T_BULB_BURN);
    const power = Math.pow(Math.abs(hot.current), 2) * rBurn;
    const loss = bulbRadK(ratedP) * (Math.pow(T_BULB_BURN, 4) - Math.pow(T_AMBIENT, 4));
    if (power > loss) ids.push(el.id);
  }
  return ids;
}

/**
 * 预测「点了一键修复之后会不会立刻又坏」，会坏就给出先断开哪只开关。
 *
 * 挑开关的原则只有一条：**断开它之后，故障没了、电路还通着**。短接支路上的分路
 * 开关（预设里的 S₂）正是这样：断开它，故障支路没了、主回路照常亮灯。
 *
 * 反过来——只能靠断开总闸才不坏的，**不算解决方案**：总闸一断，电路整条不通，
 * 换上新的保险丝当然不会烧，可学生再合上闸，0.1 秒后照样烧一遍。那不是在教
 * 「先排查短路支路」，是在教「拉闸逃避」。这种情形（多半是电源电压本身就太高、
 * 或者整条回路短路）退回一句通用的处置建议，不点名任何开关。
 *
 * 没有故障（不该出现红条）、或者修得住，都返回 null：红条只在真有坑的时候多占一行。
 */
export function repairCaution({
  state,
  lang = 'zh',
}: {
  state: BenchState;
  lang?: 'zh' | 'en';
}): RepairCaution | null {
  const faulty = state.components.filter((el) => isFaulty(el));
  if (faulty.length === 0) return null;

  // 先把坏元件都换新（`resetElementState` 只重置热状态：换了灯泡/保险丝，接法不变）
  let repaired: BenchState = state;
  for (const el of faulty) repaired = resetElementState(repaired, el.id);

  const riskIds = rebuiltFaults(repaired);
  if (riskIds.length === 0) return null;
  const risk = repaired.components.find((el) => el.id === riskIds[0]);
  if (!risk) return null;
  const atRisk = elementName(repaired, risk, lang);

  let picked: CircuitComponent | null = null;
  for (const sw of state.components) {
    if (sw.kind !== 'switch' || sw.params.closed === false) continue;
    const opened = withSwitchOpen(repaired, sw.id);
    if (rebuiltFaults(opened).length > 0) continue;
    // 断开后还要有电流/功率：断总闸当然不烧了，可它也把整台仪器停了，
    // 学生合上闸就又烧一次——那不是处置方法（见上面函数注释）。
    if (solveCircuit(opened).totalPower > 0.01) {
      picked = sw;
      break;
    }
  }

  const zh = lang === 'zh';
  const again = risk.kind === 'fuse' ? (zh ? '还会熔断' : 'blows again') : zh ? '还会烧毁' : 'burns out again';
  if (picked) {
    const openSwitch = elementCanvasLabel(repaired, picked, lang);
    return {
      atRisk,
      openSwitch,
      text: zh
        ? `先断开 ${openSwitch} 再修复，否则${atRisk} ${again}`
        : `Open ${openSwitch} first — otherwise ${atRisk} ${again}`,
    };
  }
  return {
    atRisk,
    openSwitch: null,
    text: zh
      ? `先排除短路或调低电源电压再修复，否则${atRisk} ${again}`
      : `Clear the short or lower the supply first — otherwise ${atRisk} ${again}`,
  };
}

/**
 * 「先断电再换件」的分步计划：换新之后这只元件仍然带电时，按实验操作规范必须先
 * 断开某只开关，换好了再合上。
 *
 * 与 `RepairCaution` 是两回事，判据也刻意分开：
 * - `repairCaution` 说的是**物理**后果（断开这个开关，换上新的才不会再烧）；
 * - `deenergizePlan` 说的是**操作规范**（带电作业本身就不允许，与会不会烧无关）。
 * 一只灯泡并联在另一条支路上、换了也不会烧，可只要那条支路还通着电，就不该伸手去换。
 */
export interface DeenergizePlan {
  /** 先断开的开关 id（确认后由上层执行）。 */
  switchId: string;
  /** 开关标号，如 `S₁`。 */
  switchLabel: string;
  /** 换新后仍会带电的元件名（完整名字，如「灯泡 L₁」），用于文案。 */
  targetNames: string[];
  title: string;
  /** 正文：为什么先断开、断开谁、换好之后还要干什么。 */
  text: string;
  /**
   * 额外隐患（换好之后合闸还会再坏），没有则为 null。
   *
   * 与 `repairCaution` 同源同判，挪到这张卡里说是因为弹窗盖住了看板红条，
   * 而件换好之后红条自己也会消失——那时学生已经合上闸了。
   */
  hint: string | null;
  /** 主按钮：一次点击同时断电与换件。 */
  confirmText: string;
  cancelText: string;
}

/**
 * 一只元件「还带不带电」：断开某只开关之后，它算不算真的失电了。
 *
 * 求解器给断开支路的不是精确的 0，而是**数值零**：实测把串并联预设的 S₁ 断开后，
 * 两只灯泡上仍测得到约 6e-9 A 的残差（浮点消元留下的尾巴）。拿 `> 0` 甚至
 * `> 1e-9` 当「带电」，学生明明按规范断了电，提示还是不走——那比没有提示更糟。
 *
 * 所以两个门槛一起用，缺一不可：
 * - 绝对值忽略不计：< 0.1 mA。灯泡冷态阻值仅 1.36 Ω，0.1 mA 连微微发红都谈不上；
 * - 相对值也要掉下去：只剩原来的千分之一以下。只看绝对值的判据会被「本来就很小
 *   但确实带电」的回路骗过去（串联一大电阻后，灯泡上可能本来就只有几百微安）。
 */
const DEAD_CURRENT = 1e-4;

function stillLive(after: number, before: number): boolean {
  const a = Math.abs(after);
  if (!Number.isFinite(a)) return false;
  if (a < DEAD_CURRENT) return false;
  return a > Math.abs(before) / 1000;
}

/**
 * 在 `state` 里挑一只闭合的开关：断开它之后 `acceptable` 成立的那只。
 *
 * 返回两个候选，因为「能解决问题」与「解决问题还不伤及无辜」不是一回事：
 * - `alive`：断开后电路其余部分照常工作（`totalPower > 0.01`）——支路开关通常在这；
 * - `any`：只要能解决问题就行，哪怕它是总闸。
 *
 * 调用方自己决定要不要用 `any`：`repairCaution` 坚决不要（拉总闸不叫处置），
 * 而「换件前必须断电」这一路在元件就串在总回路上时只能用它。
 */
function pickOpenSwitch(
  state: BenchState,
  acceptable: (opened: BenchState, openedResult: SolveResult) => boolean,
): { alive: CircuitComponent | null; any: CircuitComponent | null } {
  let alive: CircuitComponent | null = null;
  let any: CircuitComponent | null = null;
  for (const sw of state.components) {
    if (sw.kind !== 'switch' || sw.params.closed === false) continue;
    const openedState = withSwitchOpen(state, sw.id);
    const opened = solveCircuit(openedState);
    if (!acceptable(openedState, opened)) continue;
    if (opened.totalPower > 0.01) {
      alive = sw;
      break;
    }
    if (!any) any = sw;
  }
  return { alive, any };
}

/**
 * 更换 `ids` 这批元件之前，是否必须先把某只开关断开？要断就返回计划，不必断返回 null。
 *
 * 判据只有一条，且与仿真同源：**把待换的元件先按新件摆上去重解一次电路**，
 * 若那时它们仍流过电流，就说明「这一手是带电操作」。坏掉的灯泡/保险丝此刻是断的
 * （灯丝断了、熔丝断了），电流为零，所以不能拿**当前**读数判——必须换新后再解，
 * 这正是学生伸手那一刻的真实处境：手一碰上去，电路立刻恢复导通。
 *
 * 开关的挑法与 `repairCaution` 同一口径：优先挑那只「断开后这批元件全部失电、
 * 而电路其余部分照常工作」的；支路开关因此胜出，而不是一上来就拉总闸。
 * 只有支路开关救不了（元件就串在总回路上）时才退回总闸——那种情况下断电确实
 * 只能靠它，且这次不涉及「合闸后又烧」，仅仅是规范要求。
 *
 * 已经在断开状态、或者元件本来就悬空不带电时返回 null：提示不该常驻，
 * 学生按要求断好开关，弹窗与提示自然就没有了。
 */
export function deenergizePlan({
  state,
  ids,
  lang = 'zh',
}: {
  state: BenchState;
  ids: string[];
  lang?: 'zh' | 'en';
}): DeenergizePlan | null {
  const targets = state.components.filter((el) => ids.includes(el.id));
  if (targets.length === 0) return null;

  // 把待换元件按新件摆上去，再解一次：这一步就是「换上去之后会不会带电」。
  let repaired: BenchState = state;
  for (const el of targets) repaired = resetElementState(repaired, el.id);
  const result = solveCircuit(repaired);
  if (!result.ok) return null;

  const liveCurrent = targets
    .map((el) => ({ id: el.id, i: Math.abs(result.elements[el.id]?.current ?? 0) }))
    .filter((row) => row.i >= DEAD_CURRENT);
  if (liveCurrent.length === 0) return null;
  const liveIds = liveCurrent.map((row) => row.id);
  const live = targets.filter((el) => liveIds.includes(el.id));

  // 谁能把这批元件弄失电？优先挑「断掉之后电路还在工作」的那只（支路开关），
  // 只有它不存在时才用总闸兜底——元件就串在总回路上的时候，断电确实只能靠它。
  const picked = pickOpenSwitch(repaired, (_opened, openedResult) =>
    liveCurrent.every((row) => !stillLive(openedResult.elements[row.id]?.current ?? 0, row.i)),
  );
  const sw = picked.alive ?? picked.any;
  if (!sw) return null;

  const zh = lang === 'zh';
  const switchLabel = elementCanvasLabel(repaired, sw, lang);
  const targetNames = live.map((el) => elementName(repaired, el, lang));
  const names = zh ? targetNames.join('、') : targetNames.join(', ');

  /*
   * 换好之后「合闸即再坏」的隐患，一并写在这张卡里。
   *
   * 典型情形：短接开关 S₂ 还闭着，学生换好保险丝、合上 S₁，0.09 s 后又是一声「啪」。
   * 平时这句由看板红条负责（`repairCaution`），可弹窗一盖上来红条就看不见了，
   * 而且件换好之后故障数归零、红条自己也会消失——等到能看见的时候，已经晚了。
   *
   * 所以判据与 `rebuiltFaults` 同源（同一套「把元件按在烧断线上再解一次」的算法），
   * 只挑「断掉之后电路还在工作」的那只开关：那种「只能靠拉总闸」的隐患（多半是
   * 电源电压本身就太高）不点名开关，只说事实——拉总闸从来不解决问题。
   */
  const hazards = rebuiltFaults(repaired);
  let hint: string | null = null;
  if (hazards.length > 0) {
    const hazardNames = hazards
      .map((id) => repaired.components.find((el) => el.id === id))
      .filter((el): el is CircuitComponent => Boolean(el))
      .map((el) => elementName(repaired, el, lang))
      .join(zh ? '、' : ', ');
    const clear = pickOpenSwitch(repaired, (opened) => rebuiltFaults(opened).length === 0).alive;
    const clearLabel = clear ? elementCanvasLabel(repaired, clear, lang) : '';
    hint = zh
      ? clear
        ? `⚠ 换好后先断开 ${clearLabel} 再合上 ${switchLabel}：现在这样合闸，${hazardNames} 还会再坏一次。`
        : `⚠ 换好后先别急着合闸：电路里还有短路或电源电压过高，合上还会再坏一次。`
      : clear
        ? `⚠ After replacing, open ${clearLabel} before closing ${switchLabel} — otherwise ${hazardNames} breaks again.`
        : `⚠ Do not close the switch right away: the circuit still has a short or too high a supply voltage, and the new part will break again.`;
  }

  return {
    switchId: sw.id,
    switchLabel,
    targetNames,
    title: zh ? '先断开开关再更换' : 'Open the switch first',
    text: zh
      ? `实验要求先断开 ${switchLabel} 再更换${names}（带电作业会打火，元件也容易损坏）。换好后重新合上 ${switchLabel}。`
      : `Lab rule: open ${switchLabel} before replacing ${names} — never work on a live circuit. Close ${switchLabel} again afterwards.`,
    hint,
    confirmText: zh ? `断开 ${switchLabel} 并更换` : `Open ${switchLabel} and replace`,
    cancelText: zh ? '取消' : 'Cancel',
  };
}

/** 量程占用率 → 百分数文案（`1.0` 表示打满，过载可 > 100%）。 */
export function usageText(usage: number): string {
  if (!Number.isFinite(usage)) return '—';
  const pct = usage * 100;
  if (pct >= 100) return `${pct.toFixed(0)}%`;
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  return `${pct.toFixed(1)}%`;
}
