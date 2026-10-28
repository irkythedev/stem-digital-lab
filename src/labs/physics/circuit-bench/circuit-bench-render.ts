/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 渲染模型
 *
 * 把网表整理成「画布真正要画的东西」：带端口短桩的导线、圆角路径、汇合点。
 * 这一层不修改 BenchState，也不参与 MNA；后续 physical 视图可以复用同一份
 * 端子引用与导线拓扑，只替换符号和线材。
 */
import {
  parseTerminalRef,
  type BenchState,
  type CircuitComponent,
  type Wire,
} from './circuit-bench-core';
import {
  PORT_STUB,
  addPlacedSegments,
  createPlacedSegments,
  elementBounds,
  polylineSegments,
  roundedWirePath,
  segmentCrossPoint,
  segmentRelation,
  terminalNormal,
  terminalPoint,
  wireRoutePoints,
  type Pt,
  type RouteObstacle,
} from './circuit-bench-geometry';

export type CircuitViewMode = 'schematic' | 'physical';

export interface WireRoute {
  wire: Wire;
  fromRef: string;
  toRef: string;
  fromEl: CircuitComponent;
  toEl: CircuitComponent;
  fromTerminal: 'a' | 'b';
  toTerminal: 'a' | 'b';
  from: Pt;
  to: Pt;
  points: Pt[];
  path: string;
}

export interface WireJunction {
  ref: string;
  point: Pt;
  count: number;
}

/**
 * 生成所有可绘制导线；无效端点直接跳过，错误由状态层负责提示。
 *
 * 逐根按导线顺序布线的同时累积「已布线段」：后布的导线必须知道自己前面
 * 压过哪些线，否则两根不同网络的导线会被画成同一条直线——读图时会被当成
 * 同一个节点，而屏幕上没有任何标记（跳线只覆盖正交穿越，不覆盖共线）。
 *
 * 元件包围盒整个状态只算一次：打分要对每个候选反复比对障碍。
 */
export function buildWireRoutes(state: BenchState): WireRoute[] {
  const byId = new Map(state.components.map((c) => [c.id, c]));
  // 导线不能从元件身上穿过去；用所有本体的包围盒做绕行障碍。
  const boundsById = new Map<string, RouteObstacle>();
  for (const c of state.components) boundsById.set(c.id, elementBounds(c));
  const obstacles: RouteObstacle[] = [...boundsById.values()];
  const nets = wireNetIds(state);
  const placed = createPlacedSegments();
  const routes: WireRoute[] = [];
  for (const wire of state.wires) {
    const a = parseTerminalRef(wire.from);
    const b = parseTerminalRef(wire.to);
    if (!a || !b) continue;
    const fromEl = byId.get(a.id);
    const toEl = byId.get(b.id);
    if (!fromEl || !toEl) continue;
    const from = terminalPoint(fromEl, a.terminal);
    const to = terminalPoint(toEl, b.terminal);
    const ownA = boundsById.get(a.id);
    const ownB = boundsById.get(b.id);
    const net = nets.get(wire.id) ?? 0;
    const points = wireRoutePoints(
      from,
      to,
      terminalNormal(fromEl, a.terminal),
      terminalNormal(toEl, b.terminal),
      PORT_STUB,
      obstacles,
      wire.waypoints ?? [],
      {
        placed,
        net,
        terminals: [wire.from, wire.to],
        ownBodies: ownA && ownB ? (ownA === ownB ? [ownA] : [ownA, ownB]) : [],
      },
    );
    addPlacedSegments(placed, points, net, [wire.from, wire.to]);
    routes.push({
      wire,
      fromRef: wire.from,
      toRef: wire.to,
      fromEl,
      toEl,
      fromTerminal: a.terminal,
      toTerminal: b.terminal,
      from,
      to,
      points,
      path: roundedWirePath(points, 10),
    });
  }
  return routes;
}

/** 同一接线柱接了两根以上导线时画汇合点，避免把“共点”误读成“跨过”。 */
export function buildWireJunctions(state: BenchState): WireJunction[] {
  const counts = new Map<string, number>();
  for (const wire of state.wires) {
    counts.set(wire.from, (counts.get(wire.from) ?? 0) + 1);
    counts.set(wire.to, (counts.get(wire.to) ?? 0) + 1);
  }
  const byId = new Map(state.components.map((c) => [c.id, c]));
  const out: WireJunction[] = [];
  for (const [ref, count] of counts) {
    if (count < 2) continue;
    const parsed = parseTerminalRef(ref);
    if (!parsed) continue;
    const el = byId.get(parsed.id);
    if (!el) continue;
    out.push({ ref, point: terminalPoint(el, parsed.terminal), count });
  }
  return out;
}

/* ── 网络归属与跨线几何 ── */

/**
 * 每根导线所属的电气网络编号。
 *
 * 同一网络 = 通过任意共享接线柱串起来的导线集合；不同网络的导线如果画面上
 * 相交，就说明这是一处「没有接点的交叉」，需要画跳线或者改走线。
 */
export function wireNetIds(state: BenchState): Map<string, number> {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let cur = x;
    let guard = 0;
    while (parent.has(cur) && parent.get(cur) !== cur && guard++ < 1000) cur = parent.get(cur) as string;
    return cur;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const wire of state.wires) {
    if (!parent.has(wire.from)) parent.set(wire.from, wire.from);
    if (!parent.has(wire.to)) parent.set(wire.to, wire.to);
    union(wire.from, wire.to);
  }
  const netOfRoot = new Map<string, number>();
  const out = new Map<string, number>();
  for (const wire of state.wires) {
    const root = find(wire.from);
    if (!netOfRoot.has(root)) netOfRoot.set(root, netOfRoot.size);
    out.set(wire.id, netOfRoot.get(root) as number);
  }
  return out;
}

/**
 * 不同网络导线之间「穿越 / 共线重叠」的次数；预设电路该项必须为 0。
 *
 * 调用方已经有 `routes` 时直接传进来：整算一遍是这一层最贵的一笔浪费。
 */
export function countWireIntersections(state: BenchState, precomputedRoutes?: readonly WireRoute[]): number {
  const routes = precomputedRoutes ?? buildWireRoutes(state);
  const nets = wireNetIds(state);
  let count = 0;
  for (let i = 0; i < routes.length; i++) {
    const s1 = polylineSegments(routes[i].points);
    for (let j = i + 1; j < routes.length; j++) {
      if (nets.get(routes[i].wire.id) === nets.get(routes[j].wire.id)) continue;
      const s2 = polylineSegments(routes[j].points);
      for (const [p1, q1] of s1) {
        for (const [p2, q2] of s2) {
          const rel = segmentRelation(p1, q1, p2, q2);
          if (rel === 'cross' || rel === 'overlap') count++;
        }
      }
    }
  }
  return count;
}

export interface WireJump {
  /** 从上方跨过去的导线（后绘制的那根）。 */
  jumper: string;
  /** 被跨过、保持连续的导线。 */
  crossed: string;
  /** 交叉点。 */
  point: Pt;
  /** 半圆跳线的 SVG 路径。 */
  path: string;
  /** 跳线弦的两个端点（用于抹掉直线段）。 */
  bridge: [Pt, Pt];
  /** 垂直于跳线方向、沿被跨导线的方向（用于把被跨导线补画回来）。 */
  across: [Pt, Pt];
}

const JUMP_R = 5;

/**
 * 不同网络导线交叉处的跳线几何。
 *
 * 各自独立的导线在电路图上交会时，必须用半圆「跨过去」以示不相连；
 * 每处交叉返回三段：抹掉直线段的弦、补画的被跨导线、以及半圆本身。
 *
 * `precomputedRoutes` 是画布上已经算好的那份 `buildWireRoutes` 结果。跳线
 * 只需要折点，不需要重新布线——内部再整算一遍等于让 state 每变一次就付
 * 两遍全量路由（满负载下这是拖不动的主因）。
 */
export function buildWireJumps(state: BenchState, precomputedRoutes?: readonly WireRoute[]): WireJump[] {
  const routes = precomputedRoutes ?? buildWireRoutes(state);
  const nets = wireNetIds(state);
  const out: WireJump[] = [];
  for (let i = 0; i < routes.length; i++) {
    const s1 = polylineSegments(routes[i].points);
    for (let j = i + 1; j < routes.length; j++) {
      if (nets.get(routes[i].wire.id) === nets.get(routes[j].wire.id)) continue;
      const s2 = polylineSegments(routes[j].points);
      for (const [p1, q1] of s1) {
        for (const [p2, q2] of s2) {
          if (segmentRelation(p1, q1, p2, q2) !== 'cross') continue;
          const p = segmentCrossPoint(p1, q1, p2, q2);
          if (!p) continue;
          // 后绘制的那根跳过去，保证压线关系稳定。
          const along = i < j ? { a: p2, b: q2 } : { a: p1, b: q1 };
          const acrossAxis = i < j ? { a: p1, b: q1 } : { a: p2, b: q2 };
          const d = unit({ x: along.b.x - along.a.x, y: along.b.y - along.a.y });
          const u = unit({ x: acrossAxis.b.x - acrossAxis.a.x, y: acrossAxis.b.y - acrossAxis.a.y });
          const b0 = { x: p.x - d.x * JUMP_R, y: p.y - d.y * JUMP_R };
          const b1 = { x: p.x + d.x * JUMP_R, y: p.y + d.y * JUMP_R };
          out.push({
            jumper: routes[j].wire.id,
            crossed: routes[i].wire.id,
            point: p,
            bridge: [b0, b1],
            across: [
              { x: p.x - u.x * (JUMP_R + 1.5), y: p.y - u.y * (JUMP_R + 1.5) },
              { x: p.x + u.x * (JUMP_R + 1.5), y: p.y + u.y * (JUMP_R + 1.5) },
            ],
            path: `M${round(b0.x)} ${round(b0.y)} A${JUMP_R} ${JUMP_R} 0 0 1 ${round(b1.x)} ${round(b1.y)}`,
          });
        }
      }
    }
  }
  return out;
}

function unit(v: Pt): Pt {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
