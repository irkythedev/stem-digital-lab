/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 电路状态纯函数层
 *
 * 所有编辑操作返回新对象，不修改入参；UI 可以直接放进 React state。
 * 反序列化会对任意来源的 JSON 做白名单清洗（参数、端点、重复 id、数量上限），
 * 这样 localStorage / AI 建议 / 导入文件都不能把非法值灌进求解器。
 */
import {
  createComponent,
  finite,
  parseTerminalRef,
  snapMeterRange,
  terminalRef,
  type BenchState,
  type CircuitComponent,
  type ElementKind,
  type ElementState,
  type ParamBag,
  type Wire,
} from './circuit-bench-core';
import { T_AMBIENT, defaultElementState, defaultParams, ELEMENT_MODELS } from './circuit-bench-models';
// 只取一个纯判定函数（menu 只依赖 core 的类型），状态层与右键菜单共用同一套「坏没坏」。
import { isFaulty } from './circuit-bench-menu';

const KIND_SET = new Set<ElementKind>(Object.keys(ELEMENT_MODELS) as ElementKind[]);

/**
 * 容量上限：超出后 `addComponent` / `addWire` 会**静默拒绝**，
 * 所以 UI 必须自己拿这两个数做「元件栏置灰 + 计数」，不能让学生点了没反应。
 */
export const MAX_COMPONENTS = 64;
export const MAX_WIRES = 128;

/** 当前用量与上限：给元件栏/HUD 显示容量，并据此禁用添加按钮。 */
export function capacityOf(state: BenchState): {
  components: number;
  maxComponents: number;
  wires: number;
  maxWires: number;
  full: boolean;
  wiresFull: boolean;
} {
  return {
    components: state.components.length,
    maxComponents: MAX_COMPONENTS,
    wires: state.wires.length,
    maxWires: MAX_WIRES,
    full: state.components.length >= MAX_COMPONENTS,
    wiresFull: state.wires.length >= MAX_WIRES,
  };
}

export function createEmptyState(): BenchState {
  return { v: 1, components: [], wires: [] };
}

export function cloneState(state: BenchState): BenchState {
  return {
    v: 1,
    components: state.components.map((c) => ({
      ...c,
      params: { ...c.params },
      state: { ...c.state },
    })),
    wires: state.wires.map((w) => ({ ...w })),
  };
}

export function sanitizeNumber(v: unknown, fallback: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, finite(v, fallback)));
}

function sanitizeParams(kind: ElementKind, raw: unknown): ParamBag {
  const base = defaultParams(kind);
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as Record<string, unknown>;
  const out: ParamBag = { ...base };
  for (const key of Object.keys(base)) {
    const def = base[key];
    const v = src[key];
    if (typeof def === 'number') {
      if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
      else if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) out[key] = Number(v);
    } else if (typeof def === 'boolean') {
      if (typeof v === 'boolean') out[key] = v;
    } else if (typeof def === 'string') {
      if (typeof v === 'string' && v.length <= 32) out[key] = v;
    }
  }
  // 数值参数按元件语义夹取，避免 0 Ω 导线 / 1e300 电阻进入矩阵。
  switch (kind) {
    case 'battery':
      out.emf = sanitizeNumber(out.emf, 6, -60, 60);
      out.r = sanitizeNumber(out.r, 0.5, 0.001, 1000);
      break;
    case 'resistor':
      out.r = sanitizeNumber(out.r, 10, 0.001, 1e7);
      out.rho = sanitizeNumber(out.rho, 1.7e-8, 1e-10, 1e3);
      out.length = sanitizeNumber(out.length, 1, 0.001, 1e4);
      out.area = sanitizeNumber(out.area, 5e-7, 1e-12, 1);
      if (out.mode !== 'specimen') out.mode = 'fixed';
      break;
    case 'bulb':
      // 下界与 `bulbResistance` / `bulbHeatCapacity` 里的夹取一致（都是 0.01）：
      // 从前这里是 0.001，于是「旧存档/分享链接能进来 0.005 W」而「引擎自己算的
      // 热容却按 0.01 W」——同一个小灯泡在两处得到不同的物理常数。
      out.ratedVoltage = sanitizeNumber(out.ratedVoltage, 3.8, 0.1, 240);
      out.ratedPower = sanitizeNumber(out.ratedPower, 1.14, 0.01, 2000);
      break;
    case 'rheostat':
      out.maxR = sanitizeNumber(out.maxR, 20, 0.001, 1e6);
      out.minR = sanitizeNumber(out.minR, 0, 0, out.maxR as number);
      out.ratio = sanitizeNumber(out.ratio, 0.5, 0, 1);
      break;
    case 'ammeter':
      // 电表量程是接线柱上的标准挡位，旧存档里连续滑块留下的中间值在这里归挡。
      out.range = snapMeterRange('ammeter', sanitizeNumber(out.range, 0.6, 0.001, 100)) ?? 0.6;
      out.r = sanitizeNumber(out.r, 0.001, 1e-6, 10);
      break;
    case 'voltmeter':
      out.range = snapMeterRange('voltmeter', sanitizeNumber(out.range, 3, 0.01, 1000)) ?? 3;
      out.r = sanitizeNumber(out.r, 1e6, 1e3, 1e9);
      break;
    case 'galvanometer':
      out.range = snapMeterRange('galvanometer', sanitizeNumber(out.range, 0.05, 1e-5, 10)) ?? 0.05;
      out.r = sanitizeNumber(out.r, 20, 0.001, 1e6);
      break;
    case 'fuse':
      out.ratedCurrent = sanitizeNumber(out.ratedCurrent, 1, 0.01, 100);
      out.r = sanitizeNumber(out.r, 0.05, 1e-6, 100);
      break;
    case 'heater':
      out.r = sanitizeNumber(out.r, 8, 0.001, 1e6);
      out.mass = sanitizeNumber(out.mass, 0.02, 1e-5, 100);
      out.specificHeat = sanitizeNumber(out.specificHeat, 460, 1, 1e6);
      break;
    case 'wire':
      out.r = sanitizeNumber(out.r, 0.001, 1e-6, 10);
      break;
  }
  if (typeof out.mode === 'string' && out.mode !== 'specimen') out.mode = 'fixed';
  if (out.closed !== undefined) out.closed = out.closed !== false;
  return out;
}

function sanitizeElementState(kind: ElementKind, raw: unknown): ElementState {
  const base = defaultElementState(kind);
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as Record<string, unknown>;
  return {
    temp: sanitizeNumber(src.temp, base.temp, T_AMBIENT, 5000),
    heat: sanitizeNumber(src.heat, base.heat, 0, 1e9),
    blown: src.blown === true,
    burnt: src.burnt === true,
  };
}

/** 清洗任意 JSON 为合法 BenchState。非法元件/导线被丢弃，而不是抛错。 */
export function sanitizeState(raw: unknown): BenchState {
  if (!raw || typeof raw !== 'object') return createEmptyState();
  const src = raw as { components?: unknown; wires?: unknown };
  const componentsRaw = Array.isArray(src.components) ? src.components : [];
  const components: CircuitComponent[] = [];
  const used = new Set<string>();
  for (const item of componentsRaw) {
    if (!item || typeof item !== 'object') continue;
    if (components.length >= MAX_COMPONENTS) break;
    const c = item as Record<string, unknown>;
    const kind = c.kind as ElementKind;
    if (!KIND_SET.has(kind)) continue;
    let id = typeof c.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(c.id) ? c.id : `${kind}_${components.length + 1}`;
    if (used.has(id)) id = `${id}_${components.length + 1}`;
    used.add(id);
    const x = sanitizeNumber(c.x, 120, -5000, 5000);
    const y = sanitizeNumber(c.y, 120, -5000, 5000);
    const rotation = (Math.round(sanitizeNumber(c.rotation, 0, -360, 360) / 90) * 90 + 360) % 360;
    const params = sanitizeParams(kind, c.params);
    const state = sanitizeElementState(kind, c.state);
    const label = typeof c.label === 'string' ? c.label.slice(0, 40) : undefined;
    // 英文名与中文名同样需要过一遍长度与类型清洗，否则分享链接会把任意长串带回来。
    const labelEn = typeof c.labelEn === 'string' ? c.labelEn.slice(0, 40) : undefined;
    components.push({ id, kind, x, y, rotation, params, state, label, labelEn });
  }

  const wires: Wire[] = [];
  const wireSet = new Set<string>();
  const ids = new Set(components.map((c) => c.id));
  const validTerminal = (ref: unknown): ref is string => {
    if (typeof ref !== 'string') return false;
    const p = parseTerminalRef(ref);
    return !!p && ids.has(p.id);
  };
  const wiresRaw = Array.isArray(src.wires) ? src.wires : [];
  for (const item of wiresRaw) {
    if (!item || typeof item !== 'object') continue;
    if (wires.length >= MAX_WIRES) break;
    const w = item as Record<string, unknown>;
    if (!validTerminal(w.from) || !validTerminal(w.to)) continue;
    if (w.from === w.to) continue;
    const p1 = parseTerminalRef(w.from);
    const p2 = parseTerminalRef(w.to);
    if (!p1 || !p2 || p1.id === p2.id) continue;
    const key = [w.from, w.to].sort().join('|');
    if (wireSet.has(key)) continue;
    wireSet.add(key);
    const id = typeof w.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(w.id) ? w.id : `w_${wires.length + 1}`;
    wires.push({ id, from: w.from, to: w.to });
  }
  return { v: 1, components, wires };
}

export function serializeState(state: BenchState): string {
  return JSON.stringify(state);
}

export function deserializeState(text: string): BenchState {
  try {
    return sanitizeState(JSON.parse(text));
  } catch {
    return createEmptyState();
  }
}

/* ── 编辑操作 ── */

function nextId(state: BenchState, prefix: string): string {
  const used = new Set(state.components.map((c) => c.id));
  const wireUsed = new Set(state.wires.map((w) => w.id));
  let i = 1;
  while (used.has(`${prefix}_${i}`) || wireUsed.has(`${prefix}_${i}`)) i++;
  return `${prefix}_${i}`;
}

export function addComponent(
  state: BenchState,
  kind: ElementKind,
  x: number,
  y: number,
  params: ParamBag = {},
  rotation = 0,
): BenchState {
  if (!KIND_SET.has(kind) || state.components.length >= MAX_COMPONENTS) return state;
  const id = nextId(state, kind);
  const component = createComponent(id, kind, x, y, params, rotation);
  return { ...state, components: [...state.components, component] };
}

export function removeComponent(state: BenchState, id: string): BenchState {
  if (!state.components.some((c) => c.id === id)) return state;
  const components = state.components.filter((c) => c.id !== id);
  const wires = state.wires.filter((w) => {
    const a = parseTerminalRef(w.from);
    const b = parseTerminalRef(w.to);
    return a?.id !== id && b?.id !== id;
  });
  return { ...state, components, wires };
}

/**
 * 元件一挪动（旋转 / 翻转 / 拖拽），挂在它身上的导线就不再走原来那条静态折线：
 * 预设里写死的 `waypoints` 只是为静态排版量出来的「大致经过这里」，
 * 元件姿态一变，这些折点会立刻把导线拽进元件本体里（甚至拐出折返尖刺）。
 *
 * 所以这里把这些导线的 `waypoints` 清掉，交回 `wireRoutePoints` 的动态正交路由
 * 按当前端子法线重新算一条干净的路径。没有任何一条导线受影响时返回原数组，
 * 让上层 `useMemo` 的引用比较照常短路。
 */
function dropWaypoints(state: BenchState, componentId: string): Wire[] {
  let touched = false;
  const wires = state.wires.map((w) => {
    if (!w.waypoints) return w;
    const a = parseTerminalRef(w.from);
    const b = parseTerminalRef(w.to);
    if (a?.id !== componentId && b?.id !== componentId) return w;
    touched = true;
    const { waypoints: _drop, ...rest } = w;
    return rest;
  });
  return touched ? wires : state.wires;
}

export function moveComponent(state: BenchState, id: string, x: number, y: number): BenchState {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return state;
  const el = state.components.find((c) => c.id === id);
  // 原地「移动」到同一个坐标不算姿态变化，别让拖动过程中的零位移把折点洗掉。
  if (el && el.x === clampPos(x) && el.y === clampPos(y)) return state;
  return {
    ...state,
    components: state.components.map((c) =>
      c.id === id ? { ...c, x: clampPos(x), y: clampPos(y) } : c,
    ),
    wires: dropWaypoints(state, id),
  };
}

function clampPos(v: number): number {
  return Math.min(5000, Math.max(-5000, v));
}

export function rotateComponent(state: BenchState, id: string, delta = 90): BenchState {
  const el = state.components.find((c) => c.id === id);
  if (!el) return state;
  const rotation = (((el.rotation + delta) % 360) + 360) % 360;
  if (rotation === el.rotation) return state;
  return {
    ...state,
    components: state.components.map((c) => (c.id === id ? { ...c, rotation } : c)),
    wires: dropWaypoints(state, id),
  };
}

export function setRotation(state: BenchState, id: string, rotation: number): BenchState {
  const r = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  const el = state.components.find((c) => c.id === id);
  if (!el || el.rotation === r) return state;
  return {
    ...state,
    components: state.components.map((c) => (c.id === id ? { ...c, rotation: r } : c)),
    wires: dropWaypoints(state, id),
  };
}

/**
 * 调换极性：把元件原地转 180°，同时把接在它身上的导线端点 a↔b 对调。
 *
 * 转 180° 后正极（电池 a / 表红柱）跑到原来另一端，物理极性随之反转；
 * 端点对调则保证导线仍接在画布上的同一侧，网表里其它节点完全不动。
 */
export function swapPolarity(state: BenchState, id: string): BenchState {
  const el = state.components.find((c) => c.id === id);
  if (!el) return state;
  const flip = (ref: string) => {
    const parsed = parseTerminalRef(ref);
    if (!parsed || parsed.id !== id) return ref;
    return `${id}:${parsed.terminal === 'a' ? 'b' : 'a'}`;
  };
  const flipped: BenchState = {
    ...state,
    components: state.components.map((c) =>
      c.id === id ? { ...c, rotation: (((c.rotation + 180) % 360) + 360) % 360 } : c,
    ),
    wires: state.wires.map((w) => ({ ...w, from: flip(w.from), to: flip(w.to) })),
  };
  // 元件翻了个身，原折线同样要作废（对调 a↔b 不改变导线归属，按元件 id 照样能认出来）。
  return { ...flipped, wires: dropWaypoints(flipped, id) };
}

export function updateParams(state: BenchState, id: string, patch: ParamBag): BenchState {
  return {
    ...state,
    components: state.components.map((c) => {
      if (c.id !== id) return c;
      return { ...c, params: sanitizeParams(c.kind, { ...c.params, ...patch }) };
    }),
  };
}

export function toggleSwitch(state: BenchState, id: string): BenchState {
  return {
    ...state,
    components: state.components.map((c) =>
      c.id === id && c.kind === 'switch'
        ? { ...c, params: { ...c.params, closed: c.params.closed === false } }
        : c,
    ),
  };
}

/**
 * 把某只开关设成指定的通断状态。
 *
 * 与 `toggleSwitch` 的区别只在「幂等」：换件前的断电动作已知自己要把开关弄成断开，
 * 写 `closed: false` 比「翻一下」更诚实——万一那一瞬间它已经是断开的（学生自己先断了），
 * 翻一下会把它**合上**，等于在带电作业的节骨眼上给电路通电。
 */
export function setSwitchClosed(state: BenchState, id: string, closed: boolean): BenchState {
  return {
    ...state,
    components: state.components.map((c) =>
      c.id === id && c.kind === 'switch' ? { ...c, params: { ...c.params, closed } } : c,
    ),
  };
}

export function setElementState(state: BenchState, id: string, patch: Partial<ElementState>): BenchState {
  return {
    ...state,
    components: state.components.map((c) =>
      c.id === id ? { ...c, state: { ...c.state, ...patch } } : c,
    ),
  };
}

/**
 * 一键修复：把所有已损坏元件的物理态整体复位。
 *
 * 走 `defaultElementState` 而不是把 burnt/blown 置 false：灯泡的初始态是
 * 「冷态、灯丝完好」（temp 300 / heat 0），手写 `temp: 0` 会让灯泡停在物理上
 * 不可能的温度上；`resistanceOf` 也据此把阻值复原成额定值——这正是学生要的
 * 「换一只新的」，而不是「把标记擦掉」。
 *
 * 没有损坏元件时原样返回（引用不变），`commit` 的历史里不会留下空撤销点。
 * 判定复用右键菜单的 `isFaulty`：一处定义，菜单项与一键修复不会各修各的。
 */
export function repairFaultyElements(state: BenchState): BenchState {
  let changed = false;
  const components = state.components.map((el) => {
    if (!isFaulty(el)) return el;
    changed = true;
    return { ...el, state: defaultElementState(el.kind) };
  });
  return changed ? { ...state, components } : state;
}

export function componentById(state: BenchState, id: string): CircuitComponent | undefined {
  return state.components.find((c) => c.id === id);
}

export function terminalExists(state: BenchState, ref: string): boolean {
  const p = parseTerminalRef(ref);
  return !!p && state.components.some((c) => c.id === p.id);
}

export type AddWireResult = { state: BenchState; added: boolean; reason?: string };

export function addWire(state: BenchState, from: string, to: string): AddWireResult {
  if (!terminalExists(state, from) || !terminalExists(state, to)) {
    return { state, added: false, reason: '端子不存在' };
  }
  if (from === to) return { state, added: false, reason: '不能连接同一个端子' };
  const p1 = parseTerminalRef(from);
  const p2 = parseTerminalRef(to);
  if (!p1 || !p2) return { state, added: false, reason: '端子格式错误' };
  if (p1.id === p2.id) return { state, added: false, reason: '不能短接同一个元件的两端' };
  const key = [from, to].sort().join('|');
  if (state.wires.some((w) => [w.from, w.to].sort().join('|') === key)) {
    return { state, added: false, reason: '导线已存在' };
  }
  if (state.wires.length >= MAX_WIRES) return { state, added: false, reason: '导线数量已达上限' };
  const wire: Wire = { id: nextId(state, 'w'), from, to };
  return { state: { ...state, wires: [...state.wires, wire] }, added: true };
}

export function removeWire(state: BenchState, id: string): BenchState {
  return { ...state, wires: state.wires.filter((w) => w.id !== id) };
}

/** 拔插结果：挪好了 / 并进已有的那根 / 自环整根撤掉 / 什么都没发生（附原因）。 */
export type ReplugStatus = 'moved' | 'merged' | 'removed' | 'none';

export type ReplugResult = {
  state: BenchState;
  changed: boolean;
  status: ReplugStatus;
  reason?: string;
  removedWireId?: string;
};

/**
 * 拔插导线的一端（把 B 端摘下来丢到 C 上，`A—B` 变成 `A—C`）。
 *
 * 把「改接」做成一个原子的状态操作，UI 只负责挑目标端子，规则全部落在这里：
 *   ① 目标端子必须真实存在；
 *   ② 拖到导线另一头自己身上 → 退化成自环，整根撤掉（`from === to` 的自环不该留下）；
 *   ③ 拖到同一个元件的另一个接线柱 → 拒绝（那是短接元件两端）；
 *   ④ 目标端点对已经有一根导线 → 合并：留下既有那根，把手上这根撤掉
 *      （重边只留一条，不留幽灵重复导线）；
 *   ⑤ 真的接上了 → 端点改写，并且**清掉旧折点**，让路由器按新接续重算路径。
 */
export function replugWire(
  state: BenchState,
  wireId: string,
  end: 'from' | 'to',
  target: string,
): ReplugResult {
  const wire = state.wires.find((w) => w.id === wireId);
  if (!wire) return { state, changed: false, status: 'none', reason: '导线不存在' };
  const other = end === 'from' ? wire.to : wire.from;
  if (target === (end === 'from' ? wire.from : wire.to)) {
    return { state, changed: false, status: 'none' };
  }
  if (!terminalExists(state, target)) {
    return { state, changed: false, status: 'none', reason: '端子不存在' };
  }
  if (target === other) {
    return { state: removeWire(state, wireId), changed: true, status: 'removed', removedWireId: wireId };
  }
  const p1 = parseTerminalRef(other);
  const p2 = parseTerminalRef(target);
  if (!p1 || !p2) return { state, changed: false, status: 'none', reason: '端子格式错误' };
  if (p1.id === p2.id) {
    return { state, changed: false, status: 'none', reason: '不能短接同一个元件的两端' };
  }
  const key = [other, target].sort().join('|');
  const twin = state.wires.find(
    (w) => w.id !== wireId && [w.from, w.to].sort().join('|') === key,
  );
  if (twin) {
    return {
      state: removeWire(state, wireId),
      changed: true,
      status: 'merged',
      removedWireId: wireId,
    };
  }
  const { waypoints: _drop, ...bare } = wire;
  const moved: Wire = end === 'from' ? { ...bare, from: target } : { ...bare, to: target };
  return {
    state: { ...state, wires: state.wires.map((w) => (w.id === wireId ? moved : w)) },
    changed: true,
    status: 'moved',
  };
}

export function wiresOf(state: BenchState, componentId: string): Wire[] {
  return state.wires.filter((w) => {
    const a = parseTerminalRef(w.from);
    const b = parseTerminalRef(w.to);
    return a?.id === componentId || b?.id === componentId;
  });
}

export function toggleConnection(state: BenchState, from: string, to: string): BenchState {
  const key = [from, to].sort().join('|');
  const existing = state.wires.find((w) => [w.from, w.to].sort().join('|') === key);
  if (existing) return removeWire(state, existing.id);
  const res = addWire(state, from, to);
  return res.state;
}

/** 供 UI 显示：导线的端点引用是否还合法。 */
export function validWireEndpoints(state: BenchState): Set<string> {
  const ok = new Set<string>();
  for (const w of state.wires) {
    if (terminalExists(state, w.from) && terminalExists(state, w.to)) ok.add(w.id);
  }
  return ok;
}

export function terminalPointId(id: string, t: 'a' | 'b'): string {
  return terminalRef(id, t);
}
