/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 线性直流求解器（改进节点法 / 纯节点导纳矩阵）
 *
 * 设计取舍（M1）：
 *  - 导线与闭合开关用并查集合并为同一节点，避免 1e-3 Ω 带来的病态矩阵；
 *  - 电源用诺顿等效（内阻 ≥ 1 mΩ），因此矩阵里没有电压源支路；
 *  - 每个节点加 1e-9 S 的 gmin，孤立子网也能得到有界解；
 *  - 部分主元 LU；失败时返回 ok=false，绝不向 UI 抛异常。
 *  - 灯泡热模型 / 保险丝熔断在 time-step 层，和本文件的线性解耦。
 */
import {
  FUSE_TAU,
  FUSE_TRIP_HEAT,
  HEATER_COOL_TAU,
  HEATER_MIN_CURRENT,
  T_AMBIENT,
  T_BULB_BURN,
  bulbHeatCapacity,
  bulbResistance,
  defaultElementState,
  defaultParams,
  isOpen,
  isSource,
  mergesTerminals,
  meterRange,
  resistanceOf,
  sourceEmf,
  sourceInternalR,
} from './circuit-bench-models';
import { bulbRadK, bulbTempStep } from '../stem-engine';

export type ElementKind =
  | 'battery'
  | 'resistor'
  | 'bulb'
  | 'rheostat'
  | 'switch'
  | 'ammeter'
  | 'voltmeter'
  | 'galvanometer'
  | 'fuse'
  | 'heater'
  | 'wire';

export type ParamValue = number | string | boolean;
export type ParamBag = Record<string, ParamValue>;

export interface ElementState {
  /** 灯丝温度 K（其他元件保持环境温度） */
  temp: number;
  /** 保险丝归一化热量 h；电热丝累计焦耳热 J */
  heat: number;
  blown: boolean;
  burnt: boolean;
}

export interface CircuitComponent {
  id: string;
  kind: ElementKind;
  x: number;
  y: number;
  /** 0/90/180/270，仅影响端子与绘制方向 */
  rotation: number;
  label?: string;
  /**
   * 英文标签。画布/探针/检查器在 lang='en' 时优先取它，缺省回落到 `label`。
   *
   * 教学预设里的元件名（电源、试样…）是中文常量，若没有这一项，切到英文界面后
   * 画布和探针下拉里会残留中文——这正是双语完成度最显眼的漏点。
   * 学生的元件名仍是纯 ASCII（S、R₁…），两种语言下同一个字符串，不必填。
   */
  labelEn?: string;
  params: ParamBag;
  state: ElementState;
}

export interface Wire {
  id: string;
  /** 端子引用：`${componentId}:a` */
  from: string;
  to: string;
  /** 手工指定的正交折线中间点（世界坐标）；缺省时由走线算法自动绕行。 */
  waypoints?: { x: number; y: number }[];
}

export interface BenchState {
  v: 1;
  components: CircuitComponent[];
  wires: Wire[];
}

export type WarningCode =
  | 'no-source'
  | 'open-circuit'
  | 'short-circuit'
  | 'floating-node'
  | 'over-range'
  | 'wrong-connection'
  | 'meter-reversed'
  | 'fuse-overload'
  | 'fuse-blown'
  | 'bulb-overload'
  | 'bulb-burnt'
  | 'singular'
  | 'too-large'
  | 'internal';

export interface SolveWarning {
  code: WarningCode;
  zh: string;
  en: string;
  elementIds?: string[];
}

export interface ElementReading {
  id: string;
  kind: ElementKind;
  /**
   * 元件内部电流，A。**符号约定按元件类型分两种**，历史遗留：
   * - 非电源元件：正 = 由 a 端流向 b 端；
   * - 电源（电池）：正 = 内部由 b 端流向 a 端（即放电）。
   *
   * 新代码不要直接消费本字段做「流向」判断，请用语义统一的 `currentAB`。
   */
  current: number;
  /**
   * 统一拓扑方向的电流，A：**正 = 电流由端子 a 流向端子 b，负 = 由 b 流向 a**。
   *
   * 这是全元件（含电池）唯一的流向语义，`CircuitCanvas` 的导线动画等下游一律用它，
   * 从根上消除「电池符号与其它元件相反」导致的流向画反。
   */
  currentAB: number;
  /** a、b 端电压差 V_a - V_b，V */
  voltage: number;
  /** 该元件当前等效电阻；Infinity 表示开路 */
  resistance: number;
  /** 吸收功率 I²R，W（电源为输出功率的相反数语义，UI 只显示绝对值） */
  power: number;
  /**
   * 只对**被并点的理想连接件**（导线、闭合开关）有意义：它所在节点是否在载流回路里。
   *
   * 这类元件两端被并成同一节点，`v = Va − Vb` 恒为 0，于是 `current = v / r` 也恒为 0。
   * 这个 0 **不是「测到 0 A」**，而是「模型里这条支路根本不解电流」——串联在干路上的
   * 导线元件分明承载着整条回路的电流。UI 不能用 `currentAB` 报数，改用本字段说
   * 「导通 / 无电流」。未并点的元件没有这个字段。
   */
  nodeLive?: boolean;
}

export interface SolveResult {
  ok: boolean;
  nodeVoltages: Record<string, number>;
  elements: Record<string, ElementReading>;
  warnings: SolveWarning[];
  totalPower: number;
}

export interface SystemSource {
  id: string;
  a: number;
  b: number;
  emf: number;
  r: number;
}

export interface SystemConductor {
  id: string;
  a: number;
  b: number;
  g: number;
  open: boolean;
}

export interface SystemElementMeta {
  id: string;
  kind: ElementKind;
  a: number;
  b: number;
  r: number;
  emf: number;
  internalR: number;
  source: boolean;
  open: boolean;
}

export interface CircuitSystem {
  state: BenchState;
  nodes: string[];
  nodeIndex: Record<string, number>;
  ground: number;
  sources: SystemSource[];
  conductors: SystemConductor[];
  elements: SystemElementMeta[];
  warnings: SolveWarning[];
}

const GMIN = 1e-9;
const MAX_NODES = 160;

/**
 * 「这条支路真的有电流」的阈值，A。
 *
 * 必须压过 `GMIN` 的数值漏电流（6 V 下约 1e-8 A），否则断开的开关两侧会被当成
 * 载流回路。看板（`circuit-bench-monitor`）与连接件的 `nodeLive` 判定共用这一个值：
 * 两处口径一旦分叉，就会出现「看板说导线没电流、检查器说在回路里」。
 */
export const LIVE_CURRENT_A = 1e-5;

/* ── 小工具 ── */

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function finite(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 外电路等效电阻 R_ext = U_terminal / I_total（供 AI 实时上下文使用）。
 *
 * 为什么不能直接用某个元件的 `reading.resistance`：电池是理想电压源 + 内阻模型，
 * `resistanceOf('battery')` 恒为 Infinity（见 circuit-bench-models），旧代码用
 * `Number.isFinite(batteryReading?.resistance) ? … : 0` 兜底，于是永远上报「外电阻 0Ω」这一错误物理量。
 *
 * 口径：端电压 U = emf − I·r_int（I 取电池放电电流，正为放电），
 * - I_total ≤ 1e-6（回路断开 / 无电流）→ Infinity；
 * - 端电压 ≤ 0（电源被短路）→ 0；
 * - 其余 → U_terminal / I_total。
 */
export function externalEquivalentResistance(emf: number, internalR: number, current: number): number {
  const ef = Number.isFinite(emf) ? emf : 0;
  const rInt = Number.isFinite(internalR) ? Math.max(0, internalR) : 0;
  const i = Number.isFinite(current) ? current : 0;
  const iTotal = Math.abs(i);
  if (!(iTotal > 1e-6)) return Infinity;
  const terminalU = ef - i * rInt;
  if (!(terminalU > 0)) return 0;
  return terminalU / iTotal;
}

export function terminalRef(componentId: string, terminal: 'a' | 'b'): string {
  return `${componentId}:${terminal}`;
}

export function parseTerminalRef(ref: string): { id: string; terminal: 'a' | 'b' } | null {
  const i = ref.lastIndexOf(':');
  if (i <= 0) return null;
  const id = ref.slice(0, i);
  const t = ref.slice(i + 1);
  if (t !== 'a' && t !== 'b') return null;
  return { id, terminal: t };
}

/**
 * 元件端子坐标系：rotation=0 时 a 在右、b 在左。几何层会使用同一约定。
 *
 * 实物模式的教具外壳比电路图符号大一圈（1.3–1.5x），端子必须跟着外扩，
 * 否则接线柱会缩进电池盒/闸刀座里面。这里统一 +6 左右：两种视图仍然共享
 * 同一套端子坐标与网表，只是教科书线稿的引线跟着变长——这正好符合标准符号
 * 的画法，也不会改变任何读数。
 */
export const TERMINAL_HALF_SPAN: Record<ElementKind, number> = {
  battery: 30,
  resistor: 30,
  bulb: 24,
  rheostat: 29,
  switch: 27,
  ammeter: 24,
  voltmeter: 24,
  galvanometer: 24,
  fuse: 24,
  heater: 33,
  wire: 26,
};

export function terminalOffsets(kind: ElementKind, rotation: number): { a: [number, number]; b: [number, number] } {
  const h = TERMINAL_HALF_SPAN[kind] ?? 22;
  const rot = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  if (rot === 90) return { a: [0, h], b: [0, -h] };
  if (rot === 180) return { a: [-h, 0], b: [h, 0] };
  if (rot === 270) return { a: [0, -h], b: [0, h] };
  return { a: [h, 0], b: [-h, 0] };
}

/**
 * 有极性元件的接线柱极性：电池 a 端是正极，A/V/G 表 a 端是红表笔（+）。
 *
 * 这个约定必须和两处保持一致：
 * - `solveDcArrays` 把 emf 注入 a 节点，即 a 电位高于 b；
 * - 两种画法都把「+」/凸帽/红柱画在 a 侧。
 *
 * 端子的世界坐标由 `terminalOffsets` 随 rotation 旋转，所以极性跟着元件一起转，
 * 90°/180°/270° 下不会出现「红柱跑到负极那边」的翻转。
 */
export function terminalPolarity(kind: ElementKind, terminal: 'a' | 'b'): '+' | '-' | null {
  const polarized =
    kind === 'battery' || kind === 'ammeter' || kind === 'voltmeter' || kind === 'galvanometer';
  if (!polarized) return null;
  return terminal === 'a' ? '+' : '-';
}

export function isPolarizedKind(kind: ElementKind): boolean {
  return terminalPolarity(kind, 'a') !== null;
}

/* ── 并查集 ── */

class UnionFind {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    let r = x;
    while (this.parent[r] !== r) r = this.parent[r];
    while (this.parent[x] !== x) {
      const next = this.parent[x];
      this.parent[x] = r;
      x = next;
    }
    return r;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

/* ── 建系统 ── */

export function buildCircuitSystem(state: BenchState): CircuitSystem {
  const components = Array.isArray(state?.components) ? state.components : [];
  const wires = Array.isArray(state?.wires) ? state.wires : [];
  const warnings: SolveWarning[] = [];

  const terminalIds: string[] = [];
  const index = new Map<string, number>();
  const addTerminal = (ref: string) => {
    if (index.has(ref)) return;
    index.set(ref, terminalIds.length);
    terminalIds.push(ref);
  };
  for (const el of components) {
    addTerminal(terminalRef(el.id, 'a'));
    addTerminal(terminalRef(el.id, 'b'));
  }

  const uf = new UnionFind(terminalIds.length);
  for (const w of wires) {
    const a = index.get(w.from);
    const b = index.get(w.to);
    if (a === undefined || b === undefined) continue;
    uf.union(a, b);
  }
  for (const el of components) {
    if (!mergesTerminals(el)) continue;
    const a = index.get(terminalRef(el.id, 'a'));
    const b = index.get(terminalRef(el.id, 'b'));
    if (a !== undefined && b !== undefined) uf.union(a, b);
  }

  // 根 → 节点号；同时记录每个节点包含的端子，便于调试与浮动节点提示。
  const rootToNode = new Map<number, number>();
  const nodes: string[] = [];
  const nodeIndex: Record<string, number> = {};
  const members: string[][] = [];
  const refNode = new Map<string, number>();
  for (let i = 0; i < terminalIds.length; i++) {
    const root = uf.find(i);
    let node = rootToNode.get(root);
    if (node === undefined) {
      node = nodes.length;
      rootToNode.set(root, node);
      nodes.push(`n${node}`);
      members.push([]);
    }
    refNode.set(terminalIds[i], node);
    members[node].push(terminalIds[i]);
  }
  nodes.forEach((id, i) => {
    nodeIndex[id] = i;
  });

  const elements: SystemElementMeta[] = [];
  const sources: SystemSource[] = [];
  const conductors: SystemConductor[] = [];
  for (const el of components) {
    const a = refNode.get(terminalRef(el.id, 'a'));
    const b = refNode.get(terminalRef(el.id, 'b'));
    if (a === undefined || b === undefined) continue;
    const r = resistanceOf(el);
    const open = isOpen(el);
    const src = isSource(el);
    elements.push({
      id: el.id,
      kind: el.kind,
      a,
      b,
      r,
      emf: src ? sourceEmf(el) : 0,
      internalR: src ? sourceInternalR(el) : 0,
      source: src,
      open,
    });
    if (src) {
      sources.push({ id: el.id, a, b, emf: sourceEmf(el), r: sourceInternalR(el) });
    } else if (!open && Number.isFinite(r)) {
      conductors.push({ id: el.id, a, b, g: 1 / Math.max(1e-9, r), open: false });
    } else if (open) {
      conductors.push({ id: el.id, a, b, g: 0, open: true });
    }
  }

  if (nodes.length > MAX_NODES) {
    warnings.push({
      code: 'too-large',
      zh: `节点数 ${nodes.length} 超过 M1 上限 ${MAX_NODES}，请拆分电路。`,
      en: `Node count ${nodes.length} exceeds the M1 limit ${MAX_NODES}.`,
    });
  }

  // 接地：优先取第一只电源负极；没有电源时取 0 号节点。
  const firstSource = sources[0];
  const ground = firstSource ? firstSource.b : 0;

  // 浮动节点：从**所有**电源端子沿全部元件（含电源自身）做无向遍历。
  // 只从第一只电源出发会把「第二个电源自成一路」的子网误判成浮空——那一路其实有源、
  // 读数也不为零，告警文案「未与电源连通」就不成立了。
  if (firstSource) {
    const adj: number[][] = nodes.map(() => []);
    for (const e of elements) {
      adj[e.a].push(e.b);
      adj[e.b].push(e.a);
    }
    const seen = new Set<number>();
    const queue: number[] = [];
    for (const s of sources) {
      for (const n of [s.a, s.b]) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    while (queue.length) {
      const n = queue.pop() as number;
      for (const m of adj[n]) {
        if (!seen.has(m)) {
          seen.add(m);
          queue.push(m);
        }
      }
    }
    const floating = nodes.map((_, i) => i).filter((i) => !seen.has(i));
    if (floating.length) {
      warnings.push({
        code: 'floating-node',
        zh: `有 ${floating.length} 个节点未与任何电源连通，读数可能为零。`,
        en: `${floating.length} node(s) are not connected to any source.`,
      });
    }

    // 开路 / 短路判定：只看断开的元件，**电源照常算作导通支路**。
    // 之前把电源一并排除，会让「回流路径要经过另一只电源」的电路被误判为开路
    // （双电源回路里明明有电流，却报「没有形成闭合回路」）。
    // 判定对象是第一只电源：遍历时跳过它自己，否则 a↔b 恒可达、开路永远测不出来。
    const adj2: number[][] = nodes.map(() => []);
    for (const e of elements) {
      if (e.open) continue;
      if (e.source && e.id === firstSource.id) continue;
      adj2[e.a].push(e.b);
      adj2[e.b].push(e.a);
    }
    const seen2 = new Set<number>([firstSource.a]);
    const q2 = [firstSource.a];
    while (q2.length) {
      const n = q2.pop() as number;
      for (const m of adj2[n]) {
        if (!seen2.has(m)) {
          seen2.add(m);
          q2.push(m);
        }
      }
    }
    if (firstSource.a === firstSource.b) {
      warnings.push({
        code: 'short-circuit',
        zh: '电源两端被导线直接短接，电流过大。',
        en: 'The source terminals are shorted by a wire.',
        elementIds: [firstSource.id],
      });
    } else if (!seen2.has(firstSource.b)) {
      warnings.push({
        code: 'open-circuit',
        zh: '电源没有形成闭合回路（开关可能断开）。',
        en: 'No closed loop through the source (a switch may be open).',
        elementIds: [firstSource.id],
      });
    }
  } else if (components.length) {
    warnings.push({
      code: 'no-source',
      zh: '电路中没有电源，所有读数为零。',
      en: 'No source in the circuit; all readings are zero.',
    });
  }

  return { state, nodes, nodeIndex, ground, sources, conductors, elements, warnings };
}

/* ── 线性方程 ── */

/**
 * 部分主元高斯消去。A 为行主序 n×n，b 长度 n；返回 null 表示奇异。
 * 不修改入参。
 */
export function solveLinearSystem(A: ArrayLike<number>, b: ArrayLike<number>, n: number): Float64Array | null {
  if (n <= 0) return new Float64Array(0);
  const a = new Float64Array(n * n);
  const x = new Float64Array(n);
  for (let i = 0; i < n * n; i++) a[i] = finite(A[i], 0);
  for (let i = 0; i < n; i++) x[i] = finite(b[i], 0);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    let best = Math.abs(a[col * n + col]);
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(a[row * n + col]);
      if (v > best) {
        best = v;
        pivot = row;
      }
    }
    if (!(best > 1e-14) || !Number.isFinite(best)) return null;
    if (pivot !== col) {
      for (let k = col; k < n; k++) {
        const t = a[col * n + k];
        a[col * n + k] = a[pivot * n + k];
        a[pivot * n + k] = t;
      }
      const t = x[col];
      x[col] = x[pivot];
      x[pivot] = t;
    }
    const d = a[col * n + col];
    for (let row = col + 1; row < n; row++) {
      const f = a[row * n + col] / d;
      if (!Number.isFinite(f) || f === 0) continue;
      a[row * n + col] = 0;
      for (let k = col + 1; k < n; k++) a[row * n + k] -= f * a[col * n + k];
      x[row] -= f * x[col];
    }
  }
  for (let row = n - 1; row >= 0; row--) {
    let s = x[row];
    for (let k = row + 1; k < n; k++) s -= a[row * n + k] * x[k];
    const d = a[row * n + row];
    if (!(Math.abs(d) > 1e-14) || !Number.isFinite(d)) return null;
    x[row] = s / d;
    if (!Number.isFinite(x[row])) return null;
  }
  return x;
}

/** 求解节点电压（包含 ground，长度为 n）。WASM 与 TS 共用的唯一线性入口。 */
export function solveDcArrays(
  n: number,
  ground: number,
  sources: { a: number; b: number; emf: number; r: number }[],
  conductors: { a: number; b: number; g: number; open?: boolean }[],
): Float64Array | null {
  if (n <= 0) return new Float64Array(0);
  if (n > MAX_NODES) return null;
  if (ground < 0 || ground >= n) ground = 0;

  const A = new Float64Array(n * n);
  const b = new Float64Array(n);
  const stampG = (i: number, j: number, g: number) => {
    if (!Number.isFinite(g) || g === 0) return;
    A[i * n + i] += g;
    A[j * n + j] += g;
    A[i * n + j] -= g;
    A[j * n + i] -= g;
  };
  for (const c of conductors) {
    if (c.open) continue;
    stampG(c.a, c.b, c.g);
  }
  for (const s of sources) {
    const g = 1 / Math.max(1e-6, s.r);
    stampG(s.a, s.b, g);
    const inj = s.emf * g;
    b[s.a] += inj;
    b[s.b] -= inj;
  }
  for (let i = 0; i < n; i++) A[i * n + i] += GMIN;

  const reducedN = n - 1;
  if (reducedN <= 0) return new Float64Array(1);
  const Ar = new Float64Array(reducedN * reducedN);
  const br = new Float64Array(reducedN);
  let r = 0;
  for (let i = 0; i < n; i++) {
    if (i === ground) continue;
    let c = 0;
    for (let j = 0; j < n; j++) {
      if (j === ground) continue;
      Ar[r * reducedN + c] = A[i * n + j];
      c++;
    }
    br[r] = b[i];
    r++;
  }
  const x = solveLinearSystem(Ar, br, reducedN);
  if (!x) return null;
  const full = new Float64Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (i === ground) full[i] = 0;
    else full[i] = x[k++];
  }
  return full;
}

/** 求解 system 的节点电压（包含 ground，长度为 nodes.length）。 */
export function solveSystemVoltages(system: CircuitSystem): { voltages: Float64Array | null; ok: boolean } {
  const n = system.nodes.length;
  if (n === 0) return { voltages: new Float64Array(0), ok: true };
  const v = solveDcArrays(n, system.ground, system.sources, system.conductors);
  return { voltages: v, ok: !!v };
}

/* ── 结果整理 ── */

export function finalizeSolve(system: CircuitSystem, voltages: Float64Array | null): SolveResult {
  const warnings = [...system.warnings];
  const n = system.nodes.length;
  const nodeVoltages: Record<string, number> = {};
  for (let i = 0; i < n; i++) nodeVoltages[system.nodes[i]] = voltages ? finite(voltages[i], 0) : 0;

  const elements: Record<string, ElementReading> = {};
  let totalPower = 0;
  const componentById = new Map(system.state.components.map((c) => [c.id, c]));

  if (!voltages) {
    warnings.push({
      code: 'singular',
      zh: '矩阵奇异，无法求解。请检查是否存在悬空节点或零电阻回路。',
      en: 'Singular matrix; check floating nodes or zero-resistance loops.',
    });
    for (const e of system.elements) {
      elements[e.id] = {
        id: e.id,
        kind: e.kind,
        current: 0,
        currentAB: 0,
        voltage: 0,
        resistance: e.r,
        power: 0,
        // 解不出来就没有「导通」可言；连接件这里显式给 false，别让 UI 拿到 undefined。
        nodeLive: e.a === e.b ? false : undefined,
      };
    }
    return { ok: false, nodeVoltages, elements, warnings, totalPower: 0 };
  }

  for (const e of system.elements) {
    const va = voltages[e.a] ?? 0;
    const vb = voltages[e.b] ?? 0;
    let v = va - vb;
    let current = 0;
    if (e.source) {
      current = (e.emf - v) / Math.max(1e-6, e.internalR);
    } else if (!e.open && Number.isFinite(e.r) && e.r > 0) {
      current = v / e.r;
    }
    if (!Number.isFinite(current)) current = 0;
    if (!Number.isFinite(v)) v = 0;
    const power = e.source ? Math.abs(e.emf * current) : Math.abs(current * current * (Number.isFinite(e.r) ? e.r : 0));
    if (Number.isFinite(power)) totalPower += Math.max(0, power);
    // 电源的 `current` 是「内部 b→a」（放电），取反后才是与其它元件统一的 a→b 语义。
    const currentAB = e.source ? -current : current;
    elements[e.id] = {
      id: e.id,
      kind: e.kind,
      current,
      currentAB,
      voltage: v,
      resistance: e.r,
      power,
    };
  }

  // 并点连接件（导线 / 闭合开关）的支路电流在模型里恒为 0，单独标出「它所在的节点
  // 有没有电流经过」。判据只看**非并点元件**的读数：并点元件自己恒为 0，参与判定
  // 只会得到「永远没有电流」这个错答案。
  const liveNodes = new Set<number>();
  for (const e of system.elements) {
    if (e.a === e.b) continue;
    const reading = elements[e.id];
    if (reading && Math.abs(reading.currentAB) > LIVE_CURRENT_A) {
      liveNodes.add(e.a);
      liveNodes.add(e.b);
    }
  }
  for (const e of system.elements) {
    if (e.a !== e.b) continue;
    const reading = elements[e.id];
    if (reading) reading.nodeLive = liveNodes.has(e.a);
  }

  // 逐元件保护/量程提示。
  for (const e of system.elements) {
    const reading = elements[e.id];
    const el = componentById.get(e.id);
    if (!el || !reading) continue;
    if (e.kind === 'ammeter' || e.kind === 'galvanometer') {
      const range = meterRange(el);
      if (Math.abs(reading.current) > range * 1.000001) {
        const shown = formatPhysicalValue(Math.abs(reading.current), 'A');
        const full = formatPhysicalValue(range, 'A');
        const next = nextMeterGear(e.kind, Math.abs(reading.current));
        const label = e.kind === 'ammeter' ? '电流表' : '电流计';
        const en = e.kind === 'ammeter' ? 'Ammeter' : 'Galvanometer';
        // 超量程时顺手提示该拨到哪一挡——挡位是有限的标准值，学生自己就能换过来。
        warnings.push({
          code: 'over-range',
          zh: `${label}超量程：${shown} > ${full}${next ? `，请换用 ${meterGearLabel(e.kind, next)} 挡` : ''}`,
          en: `${en} over range: ${shown} > ${full}${next ? `; switch to the ${meterGearLabel(e.kind, next)} gear` : ''}`,
          elementIds: [e.id],
        });
      }
      if (e.kind === 'ammeter' && Math.abs(reading.voltage) > 0.5 && Math.abs(reading.current) > 0.1) {
        warnings.push({
          code: 'wrong-connection',
          zh: '电流表两端电压过大，可能误并联在电路中。',
          en: 'Large voltage across the ammeter; it may be connected in parallel.',
          elementIds: [e.id],
        });
      }
      // 极性接反：电流从黑 − 柱（b 端）流入、红 + 柱流出，表针会反偏。
      // 电表是极性元件，这属于接线错误而不是「读数恰好为负」，必须显式提示。
      if (reading.current < -Math.max(1e-9, range * 1e-6)) {
        warnings.push({
          code: 'meter-reversed',
          zh: `${e.kind === 'ammeter' ? '电流表' : '电流计'}正负极接反：电流从黑 − 接线柱流入，表针反偏。请把红 + 接线柱改接到电流流入的那一端。`,
          en: `${e.kind === 'ammeter' ? 'Ammeter' : 'Galvanometer'} polarity reversed: current enters the black − terminal, so the needle deflects the wrong way. Move the red + terminal to the inflow side.`,
          elementIds: [e.id],
        });
      }
    }
    if (e.kind === 'voltmeter') {
      const range = meterRange(el);
      if (Math.abs(reading.voltage) > range * 1.000001) {
        const shown = formatPhysicalValue(Math.abs(reading.voltage), 'V');
        const full = formatPhysicalValue(range, 'V');
        const next = nextMeterGear(e.kind, Math.abs(reading.voltage));
        warnings.push({
          code: 'over-range',
          zh: `电压表超量程：${shown} > ${full}${next ? `，请换用 ${meterGearLabel(e.kind, next)} 挡` : ''}`,
          en: `Voltmeter over range: ${shown} > ${full}${next ? `; switch to the ${meterGearLabel(e.kind, next)} gear` : ''}`,
          elementIds: [e.id],
        });
      }
      if (Math.abs(reading.current) > 1e-4) {
        warnings.push({
          code: 'wrong-connection',
          zh: '电压表有明显电流通过，可能误串联在电路中。',
          en: 'Significant current through the voltmeter; it may be in series.',
          elementIds: [e.id],
        });
      }
      // 电压表同理：b 端（黑 −）电位高于 a 端（红 +）时表针反偏，说明表笔接反了。
      if (reading.voltage < -Math.max(1e-9, range * 1e-6)) {
        warnings.push({
          code: 'meter-reversed',
          zh: '电压表正负极接反：黑 − 表笔的电位高于红 + 表笔，表针反偏。请把红 + 表笔接到电位较高的一端。',
          en: 'Voltmeter polarity reversed: the black − probe sits at a higher potential than the red + probe, so the needle deflects the wrong way. Put the red + probe on the higher-potential side.',
          elementIds: [e.id],
        });
      }
    }
    if (e.kind === 'fuse') {
      const rated = Math.max(0.01, finite(el.params?.ratedCurrent, 1));
      if (el.state?.blown) {
        warnings.push({
          code: 'fuse-blown',
          zh: '保险丝已熔断，请更换后继续。',
          en: 'The fuse is blown; replace it to continue.',
          elementIds: [e.id],
        });
      } else if (Math.abs(reading.current) > rated) {
        warnings.push({
          code: 'fuse-overload',
          zh: `保险丝过载：${formatPhysicalValue(Math.abs(reading.current), 'A')} > 额定 ${formatPhysicalValue(rated, 'A')}`,
          en: `Fuse overload: ${formatPhysicalValue(Math.abs(reading.current), 'A')} > ${formatPhysicalValue(rated, 'A')}`,
          elementIds: [e.id],
        });
      }
    }
    if (e.kind === 'bulb') {
      if (el.state?.blown || el.state?.burnt) {
        warnings.push({
          code: 'bulb-burnt',
          zh: '灯丝已烧断，请更换灯泡。',
          en: 'The filament has burnt out; replace the bulb.',
          elementIds: [e.id],
        });
      } else {
        // 判据与热积分同源：灯丝危不危险看的是**功率**和**温度**，不是端电压。
        // 「端电压不超额定 ⇒ 不会过载」只对已烧热的灯丝成立；冷态灯丝阻值只有
        // 额定值的约 1/9，端电压看着很低、功率却可以是额定的好几倍
        // （6 V 串两只冷态 3.8 V 灯泡：U = 2.70 V < 3.80 V，P = 5.37 W ≈ 4.7×额定）。
        // 纯电压判据恰好把最该预警的那一瞬漏掉，于是「烧断前一帧一条告警都没有」。
        // 反过来，只要稳态功率没超、温度也没逼近烧断线，就不要误报。
        const ratedP = Math.max(0.01, finite(el.params?.ratedPower, 1.14));
        if (reading.power > ratedP * 1.3 || finite(el.state?.temp, T_AMBIENT) > 3200) {
          const shown = formatPhysicalValue(reading.power, 'W');
          const full = formatPhysicalValue(ratedP, 'W');
          warnings.push({
            code: 'bulb-overload',
            zh: `灯泡过载：实际功率 ${shown} > 额定 ${full}`,
            en: `Bulb overload: ${shown} > rated ${full}`,
            elementIds: [e.id],
          });
        }
      }
    }
  }

  for (const s of system.sources) {
    const r = elements[s.id];
    // 拓扑上已经被判为「直接短接」的电源不再重复报一次近短路，
    // 否则同一处故障会并列出现两条含义重叠的红告警。
    const alreadyShorted = warnings.some(
      (w) => w.code === 'short-circuit' && !!w.elementIds?.includes(s.id),
    );
    if (r && !alreadyShorted && Math.abs(r.current) > 10) {
      warnings.push({
        code: 'short-circuit',
        zh: `电源电流 ${formatPhysicalValue(Math.abs(r.current), 'A')}，接近短路。`,
        en: `Source current ${formatPhysicalValue(Math.abs(r.current), 'A')}; near short circuit.`,
        elementIds: [s.id],
      });
    }
  }

  return { ok: true, nodeVoltages, elements, warnings, totalPower };
}

/** 完整求解；任何内部异常都转成 ok=false，确保 UI 与 Fuzz 不崩。 */
export function solveCircuit(state: BenchState): SolveResult {
  try {
    const system = buildCircuitSystem(state);
    const { voltages, ok } = solveSystemVoltages(system);
    const result = finalizeSolve(system, ok ? voltages : null);
    return result;
  } catch (err) {
    return {
      ok: false,
      nodeVoltages: {},
      elements: {},
      warnings: [
        {
          code: 'internal',
          zh: `求解器内部错误：${err instanceof Error ? err.message : String(err)}`,
          en: `Solver internal error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      totalPower: 0,
    };
  }
}

/* ── 时域：灯泡热惯性 / 保险丝熔断 / 电热丝升温 ── */

/**
 * 灯泡热积分：**每个子步按当前温度联合重解电路**。
 *
 * 旧实现把 `R = R(T₀)` 与帧初电流 `I₀` 一起冻结在子步循环之外，等于假定整帧
 * 里灯丝温度不变。冷态灯丝阻值只有额定值的 300/2800 ≈ 1/9，冻结的 `I₀` 因此
 * 被高估近一个数量级，一帧的温升上界 `P·dt/C` 直接越过 3450 K 烧断线——
 * 6 V 串两只冷态 3.8 V 灯泡，0.1 s 就把两只灯丝全烧断，学生看到的是「一上电
 * 就炸」，而不是「预热后稳定发光」。
 *
 * 只把「本元件」的 `R_i` 换成随温度变化的量、其余灯泡仍冻结在帧初阻值同样不成立：
 * 另一只灯泡阻值同时上涨带来的分流效应被丢弃后，电流仍被高估约 78%，
 * 额定 2.5 V 的灯泡照样 300 K → 3452 K 秒烧。唯一健全的做法是每个子步都按
 * **全部**灯泡的当前温度重算阻值再解一次回路：灯丝一热、总阻一涨，电流立刻
 * 落回来，温升自然收敛到真实平衡温度（6 V 口径 2534 K，2.5 V 口径 2981 K）。
 *
 * 返回本帧结束时各只**帧初未烧断**灯泡的热状态；本帧才烧断的也在其中
 * （`temp = 3450`、`blown = burnt = true`）。没有可积分的灯泡时返回空 Map。
 */
function advanceBulbTemperatures(state: BenchState, steps: number, h: number): Map<string, ElementState> {
  const live = state.components.filter((el) => el.kind === 'bulb' && !el.state.blown);
  const work = new Map<string, ElementState>();
  for (const el of live) work.set(el.id, { ...el.state });
  if (!live.length) return work;

  for (let i = 0; i < steps; i++) {
    // 探针网表：只换灯泡的热状态，拓扑与参数一概不动，所以求解成本与主解同阶。
    const probe: BenchState = {
      ...state,
      components: state.components.map((el) => {
        const st = work.get(el.id);
        return st ? { ...el, state: st } : el;
      }),
    };
    const solved = solveCircuit(probe);
    let alive = 0;
    for (const el of live) {
      const st = work.get(el.id)!;
      if (st.blown) continue;
      const ratedV = Math.max(0.1, finite(el.params?.ratedVoltage, 3.8));
      const ratedP = Math.max(0.01, finite(el.params?.ratedPower, 1.14));
      const R = bulbResistance(ratedV, ratedP, st.temp);
      const C = bulbHeatCapacity(ratedV, ratedP);
      const I = Math.abs(finite(solved.elements[el.id]?.current, 0));
      // 灯丝温度积分走计算门面（TS 真源 bulbTempStep / WASM bulb_temp_step 是同一件事）：
      // R / C / k 按「本子步重解出的电流与当前温度」算好传入，与 C++ 侧签名一致；
      // 「T环境 / T烧断 + 200」的夹取在核内，本文件不再自己夹一遍。
      st.temp = bulbTempStep(st.temp, I, R, C, h, T_AMBIENT, bulbRadK(ratedP));
      if (st.temp >= T_BULB_BURN) {
        st.temp = T_BULB_BURN;
        st.blown = true;
        st.burnt = true;
      } else {
        alive++;
      }
    }
    if (!alive) break;
  }
  return work;
}

/**
 * 推进 dt 秒。dt 内部切成 ≤4 ms 子步，保证温度 ODE 稳定。
 * 返回新的 state 与这一帧起始时刻的解（UI 直接显示）。
 */
export function stepSimulation(state: BenchState, dt: number): { state: BenchState; result: SolveResult } {
  const result = solveCircuit(state);
  const total = clamp(finite(dt, 0), 0, 0.1);
  if (total <= 0) return { state, result };
  const steps = Math.max(1, Math.ceil(total / 0.004));
  const h = total / steps;

  // 灯泡走「每子步联合重解」的独立通道（见 advanceBulbTemperatures 的推导）。
  const bulbs = advanceBulbTemperatures(state, steps, h);

  const next: BenchState = {
    ...state,
    components: state.components.map((el) => {
      const reading = result.elements[el.id];
      if (el.state.blown && el.kind !== 'heater') return el;
      // 灯泡热状态已在上面整体推进过，这里只取回结果，避免同一物理量两套算法。
      if (el.kind === 'bulb') {
        const advanced = bulbs.get(el.id);
        return advanced ? { ...el, state: advanced } : el;
      }
      const st: ElementState = { ...el.state };
      if (el.kind === 'fuse' && !st.blown) {
        const rated = Math.max(0.01, finite(el.params?.ratedCurrent, 1));
        const I = reading ? Math.abs(reading.current) : 0;
        for (let i = 0; i < steps; i++) {
          const target = (I * I) / (rated * rated);
          st.heat += ((target - st.heat) / FUSE_TAU) * h;
          if (st.heat > FUSE_TRIP_HEAT) {
            st.blown = true;
            st.heat = FUSE_TRIP_HEAT;
            break;
          }
        }
        st.heat = Math.max(0, st.heat);
      } else if (el.kind === 'heater') {
        const I = reading ? Math.abs(reading.current) : 0;
        const R = Number.isFinite(reading?.resistance ?? NaN) ? (reading as ElementReading).resistance : finite(el.params?.r, 8);
        const mass = Math.max(1e-5, finite(el.params?.mass, 0.02));
        const c = Math.max(1, finite(el.params?.specificHeat, 460));
        const dQ = I * I * R * total;
        if (I > HEATER_MIN_CURRENT && dQ > 0) {
          st.heat += dQ;
          st.temp = clamp(st.temp + dQ / (mass * c), T_AMBIENT, 2000);
        } else {
          // 断电 / 开路 / 被保险丝切断：牛顿冷却，温度与累计热一起指数回落。
          // 只加热不冷却会让 `I=0` 之后检查器里的温度永远停在断电前那一刻
          // （看板与画布已按实时功率切回冷态，两处口径对不上）。
          const decay = Math.exp(-total / HEATER_COOL_TAU);
          st.temp = T_AMBIENT + (st.temp - T_AMBIENT) * decay;
          st.heat *= decay;
          if (Math.abs(st.temp - T_AMBIENT) < 0.01) st.temp = T_AMBIENT;
          if (st.heat < 1e-6) st.heat = 0;
        }
      }
      return { ...el, state: st };
    }),
  };
  return { state: next, result };
}

/** 连续推进 seconds 秒（用于加载预设时快速到达稳态）。 */
export function settleSimulation(state: BenchState, seconds = 0.6): { state: BenchState; result: SolveResult } {
  let s = state;
  let r = solveCircuit(s);
  const steps = Math.max(1, Math.min(600, Math.round(seconds / 0.004)));
  for (let i = 0; i < steps; i++) {
    const out = stepSimulation(s, seconds / steps);
    s = out.state;
    r = out.result;
  }
  return { state: s, result: r };
}

/** 换灯泡 / 换保险丝：只重置该元件的热状态。 */
export function resetElementState(state: BenchState, id: string): BenchState {
  return {
    ...state,
    components: state.components.map((el) => (el.id === id ? { ...el, state: defaultElementState(el.kind) } : el)),
  };
}

/** 新建元件（供状态层和测试复用）。 */
export function createComponent(
  id: string,
  kind: ElementKind,
  x: number,
  y: number,
  params: ParamBag = {},
  rotation = 0,
  label?: string,
  labelEn?: string,
): CircuitComponent {
  return {
    id,
    kind,
    x,
    y,
    rotation,
    label,
    labelEn,
    params: { ...defaultParams(kind), ...params },
    state: defaultElementState(kind),
  };
}

/**
 * 元件名按语言取值：英文界面优先 `labelEn`，缺失时回落中文 `label`。
 *
 * 全站唯一的元件名取值口——画布标签层、数据记录探针、检查器都走这里，
 * 免得某一处漏改又漏出中文。
 */
export function componentLabel(
  el: Pick<CircuitComponent, 'label' | 'labelEn'>,
  lang: 'zh' | 'en' = 'zh',
): string {
  if (lang === 'en') return el.labelEn?.trim() || el.label || '';
  return el.label || '';
}

export function fmt(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  // 极端量级不再走科学计数法：界面上永远只出现普通小数（0-9 与小数点）。
  if (a !== 0 && (a < 0.001 || a >= 10000)) return fmtNumber(v, Math.max(3, digits));
  return v.toFixed(digits).replace(/\.?0+$/, '');
}

/**
 * 普通十进制渲染：按 sig 位有效数字展开，绝不出现 e 记法。
 * 末尾多余的 0 会去掉（0.0000100 → 0.00001），用于 fmt 的极端量级分支。
 */
export function fmtNumber(v: number, sig = 3): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const decimals = Math.max(0, Math.min(20, sig - 1 - Math.floor(Math.log10(Math.abs(v)))));
  return v.toFixed(decimals).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/** 有效数字 → 定点小数位：3 位有效数字时 600→0 位、15→1 位、2.96→2 位。 */
function decimalsForSig(magnitude: number, sig: number): number {
  if (!(magnitude > 0)) return Math.max(0, sig - 1);
  return Math.max(0, sig - 1 - Math.floor(Math.log10(magnitude)));
}

/** 工程单位族：factor 为换算到基准单位的倍数，从大到小排列，取第一个放得下的档。 */
interface UnitFamily {
  /** 逐档前缀（含基准档），factor 从大到小 */
  steps: { factor: number; suffix: string }[];
  /** 基准单位后缀（factor === 1 的那档），极小量归零时用它，读作 `0 A`。 */
  base: string;
  /**
   * 基准单位；低于 zeroBelow 视为 0。
   *
   * 取值原则：最小前缀档的 1 倍（电压/电流/功率都是 1 µX）。这样任何印出来的
   * 读数小数点前都至少有 1 位，不会出现 `0.00422 μA` / `0.00000422 mV` 这类
   * 「小数点后一串零」的噪声读数；求解器噪声与绝缘漏电一律读作 0。
   */
  zeroBelow: number;
}

const UNIT_FAMILIES: Record<string, UnitFamily> = {
  // 电流：≥1 A 用 A；1 mA~1 A 用 mA；<1 mA 用 µA。
  // zeroBelow 取最小值档的 1 倍：低于 1 µA 只可能是求解器噪声/绝缘漏电，
  // 若照实换算会印出 `0.00422 μA` 这种「小数点后一长串零」的读数；
  // 直接读作 0 A 既符合「极微小视为 0」，又保证任何读数的小数点前都 ≥1。
  A: {
    steps: [
      { factor: 1, suffix: 'A' },
      { factor: 1e-3, suffix: 'mA' },
      { factor: 1e-6, suffix: 'μA' },
    ],
    base: 'A',
    zeroBelow: 1e-6,
  },
  // 电压：≥1 V 用 V；1 mV~1 V 用 mV；<1 mV 用 µV。
  // 桥式电路里电表两侧的电位差常常只剩纳伏级噪声，没有 µV 档就会印成
  // `0.00000422 mV`（题干截图里的那串），所以补一档 µV 并把地板抬到 1 µV。
  V: {
    steps: [
      { factor: 1, suffix: 'V' },
      { factor: 1e-3, suffix: 'mV' },
      { factor: 1e-6, suffix: 'μV' },
    ],
    base: 'V',
    zeroBelow: 1e-6,
  },
  // 电阻：≥1 MΩ 用 MΩ；≥1 kΩ 用 kΩ；其余用 Ω。
  // 欧姆档没有更小前缀（毫欧不是中学单位），但分流器只有几毫欧也照实写
  // `0.00200 Ω`；只有真正的导线近似（nΩ 级）才归零。
  'Ω': {
    steps: [
      { factor: 1e6, suffix: 'MΩ' },
      { factor: 1e3, suffix: 'kΩ' },
      { factor: 1, suffix: 'Ω' },
    ],
    base: 'Ω',
    zeroBelow: 1e-9,
  },
  // 功率：自适应 W / mW / µW，地板同样取 1 µW。
  W: {
    steps: [
      { factor: 1, suffix: 'W' },
      { factor: 1e-3, suffix: 'mW' },
      { factor: 1e-6, suffix: 'μW' },
    ],
    base: 'W',
    zeroBelow: 1e-6,
  },
};

/** 单位别名：调用方写 'Ohm' / 'ohms' 也能命中 Ω 族。 */
const UNIT_ALIASES: Record<string, string> = {
  ohm: 'Ω',
  ohms: 'Ω',
  ω: 'Ω',
  a: 'A',
  v: 'V',
  w: 'W',
};

const SIG_FIGS = 3;

/**
 * 物理量智能单位化：把基准单位的数值换算到最合适的 SI 工程单位并修约。
 *
 * 纯函数，只依赖入参；固定 3 位有效数字，排版统一为「数值 + 空格 + 单位」，
 * 例如 2.96e-6 → `2.96 μA`、8.77e-6 → `8.77 μW`、1e6 → `1.00 MΩ`。
 * 任何输入都不会渲染出科学计数法字符串（界面上严禁出现 e-6 / e+6），
 * 也不会渲染出「小数点后一串零」的噪声读数（低于最小前缀档的 1 倍读作 0）。
 *
 * 未登记的复合单位（m²、kg、J、K…）走普通十进制回退，同样不出现 e 记法。
 */
export function formatPhysicalValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) return value === Infinity ? '∞' : '—';
  const family = UNIT_FAMILIES[UNIT_ALIASES[unit.toLowerCase()] ?? unit];
  const sign = value < 0 ? '-' : '';
  const a = Math.abs(value);
  if (!family) {
    // 非工程单位：保留 3 位有效数字的普通小数，去掉多余尾零（2e-7 → 0.0000002）。
    return `${sign}${fmtNumber(a, SIG_FIGS)} ${unit}`.trimEnd();
  }
  if (a < family.zeroBelow) return `0 ${family.base}`;
  const step = family.steps.find((s) => a >= s.factor) ?? family.steps[family.steps.length - 1];
  const scaled = a / step.factor;
  return `${sign}${scaled.toFixed(decimalsForSig(scaled, SIG_FIGS))} ${step.suffix}`;
}

/** 电表量程挡位（实物教具接线柱）：电表只认这几挡，不做连续调节。 */
export const METER_GEARS: Record<string, number[]> = {
  ammeter: [0.6, 3],
  voltmeter: [3, 15],
  galvanometer: [0.05, 0.005],
};

/** 该元件是否为「挡位式」电表（量程只能取标准挡，不能用滑块）。 */
export function meterGears(kind: ElementKind): number[] | null {
  const gears = METER_GEARS[kind];
  return gears ? [...gears] : null;
}

/**
 * 把电表量程吸附到最接近的标准挡位；非电表或非数值原样返回。
 * 用于反序列化边界：旧存档里由连续滑块留下的 8.333 V 这类非标准量程，
 * 在进入工作台前就归一成 3 V 或 15 V。
 */
export function snapMeterRange(kind: ElementKind, range: unknown): number | null {
  const gears = METER_GEARS[kind];
  if (!gears) return null;
  const n = typeof range === 'number' ? range : Number(range);
  let best = gears[0];
  if (Number.isFinite(n)) {
    for (const g of gears) {
      if (Math.abs(Math.log10(g / n)) < Math.abs(Math.log10(best / n))) best = g;
    }
  }
  return best;
}

/**
 * 挡位面板上的印字：电表挡位是标准量程，要按它自己的刻度单位写，
 * 不能走 formatPhysicalValue 的工程换算（0.6 A 挡不能印成 `600 mA`）。
 * 电流计按教具习惯写成中心零位的 `±50 mA` / `±5 mA`。
 */
export function meterGearLabel(kind: ElementKind, gear: number): string {
  if (kind === 'galvanometer') return `±${fmtNumber(gear * 1000, 2)} mA`;
  return `${fmtNumber(gear, 3)} ${kind === 'voltmeter' ? 'V' : 'A'}`;
}

/** 比当前读数更大、最省的那一挡；已经顶格或不是电表时返回 null。 */
export function nextMeterGear(kind: ElementKind, value: number): number | null {
  const gears = METER_GEARS[kind];
  if (!gears || !Number.isFinite(value)) return null;
  const bigger = gears.filter((g) => g >= value).sort((a, b) => a - b);
  return bigger.length ? bigger[0] : null;
}
