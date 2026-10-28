/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 画布几何
 *
 * 世界坐标 1000×620；元件 rotation=0 时 a 端在右。
 * 导线用「先横后竖」的正交折线，和现有 textbook line-art 一致。
 * 这里全部是纯函数，方便单测；DOM 坐标换算在 CircuitCanvas 内做。
 */
import {
  TERMINAL_HALF_SPAN,
  parseTerminalRef,
  terminalOffsets,
  type BenchState,
  type CircuitComponent,
  type ElementKind,
} from './circuit-bench-core';
import type { CircuitViewMode } from './circuit-bench-view';

export interface Pt {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ViewTransform {
  tx: number;
  ty: number;
  scale: number;
}

export const WORLD_W = 1000;
export const WORLD_H = 620;
export const MIN_SCALE = 0.55;
export const MAX_SCALE = 2.4;
export const GRID = 10;

export function snap(v: number, grid = GRID): number {
  return Math.round(v / grid) * grid;
}

export function clampWorld(p: Pt): Pt {
  return {
    x: Math.min(WORLD_W - 12, Math.max(12, p.x)),
    y: Math.min(WORLD_H - 12, Math.max(12, p.y)),
  };
}

export function terminalPoint(el: CircuitComponent, terminal: 'a' | 'b'): Pt {
  const off = terminalOffsets(el.kind, el.rotation);
  const d = terminal === 'a' ? off.a : off.b;
  return { x: el.x + d[0], y: el.y + d[1] };
}

export function componentTerminals(el: CircuitComponent): { a: Pt; b: Pt } {
  return { a: terminalPoint(el, 'a'), b: terminalPoint(el, 'b') };
}

export function terminalRefOf(el: CircuitComponent, terminal: 'a' | 'b'): string {
  return `${el.id}:${terminal}`;
}

/** 接线柱朝外的单位法线；rotation=0 时 a 向右、b 向左。 */
export function terminalNormal(el: CircuitComponent, terminal: 'a' | 'b'): Pt {
  const rot = ((Math.round(el.rotation / 90) * 90) % 360 + 360) % 360;
  if (rot === 90) return terminal === 'a' ? { x: 0, y: 1 } : { x: 0, y: -1 };
  if (rot === 180) return terminal === 'a' ? { x: -1, y: 0 } : { x: 1, y: 0 };
  if (rot === 270) return terminal === 'a' ? { x: 0, y: -1 } : { x: 0, y: 1 };
  return terminal === 'a' ? { x: 1, y: 0 } : { x: -1, y: 0 };
}

/**
 * 正交折线：从接线柱沿法线先出 16–20 单位的短桩，再正交折到对方短桩。
 *
 * 不传法线时退化为「两点中分」的旧行为（仅供工具函数与测试使用）。
 */
export function wirePoints(from: Pt, to: Pt, fromNormal?: Pt, toNormal?: Pt, stub = 18): Pt[] {
  if (fromNormal && toNormal) {
    const a = { x: from.x + fromNormal.x * stub, y: from.y + fromNormal.y * stub };
    const b = { x: to.x + toNormal.x * stub, y: to.y + toNormal.y * stub };
    return dedupePoints([from, ...orthogonalize([a, b]), to]);
  }
  if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) {
    const midX = (from.x + to.x) / 2;
    return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
  }
  const midY = (from.y + to.y) / 2;
  return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
}

export function wirePath(from: Pt, to: Pt): string {
  const pts = wirePoints(from, to);
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join(' ');
}

/** 走线避让用的矩形（通常是元件本体）；正交走线只关心轴对齐包围盒。 */
export interface RouteObstacle extends Bounds {}

/** 端口短桩长度：标准件 18 单位（18–24 区间），与预设排版实测值一致。 */
export const PORT_STUB = 18;

/** 绕行车道与元件本体之间要留的净空：12 单位，留出圆角半径后仍不会蹭到外壳。 */
export const ROUTE_CLEARANCE = 12;

/** 绕行车道与元件本体之间的空隙。 */
const LANE_PAD = ROUTE_CLEARANCE;

/** 端口短桩可以收短到的下限：再短也要留一小截，实物模式的护套（9 单位）才画得出来。 */
export const MIN_PORT_STUB = 4;

/** 两个接线柱近到这个距离就算「贴脸」：任何非零短桩都会折出一个套环。 */
const NEAR_TERMINAL_DIST = 20;

/** 收短短桩时在邻居本体前面留出的余量。 */
const PORT_STUB_INSET = 4;

/** 平行车道微偏置：基础车道躲不开共线重叠时，往两侧各挪 8 / 16 单位再试。 */
const LANE_MICRO = [-16, -8, 8, 16];

/** 共线重叠的最小长度：短于此只当是在拐角处蹭了一下，不算叠线。 */
const OVERLAP_MIN = 3;

/** 同网络导线「不共享接线柱」时的叠线判定长度：短距离并行本来就是正常的。 */
const SAME_NET_OVERLAP_MIN = 20;

/* ── 分层打分权重 ────────────────────────────────────────────────────────
 * 五层按字典序比较，不是加权求和：低优项再怎么累加也绝不可能盖过高优项。
 *   1. 穿体（唯一的硬底线）      2. 异网共线重叠（读图会直接读错）
 *   3. 折返尖刺                  4. 净空侵入 + 同网长距离叠线
 *   5. 线长 + 拐角数
 * 早先「穿体与折返同权」（都乘 1e6）会静默互换：少一个尖刺可以换一次穿体，
 * 用户完全看不出来。分层之后这类交换不再可能发生。
 */
const W_CROSSINGS = 1e8;
const W_CROSS_NET = 1e7;
const W_BACKTRACK = 1e6;
const W_CLEARANCE = 1e4;
const W_SAME_NET = 5e3;
const W_BEND = 15;

/**
 * 轴对齐线段是否真的扎进本体内部（贴边不算）。
 *
 * 开关的接线柱跨距正好等于本体宽度，端子点就落在包围盒边界上；若把「贴着
 * 边界」也算穿过，则每根从开关端子离开的导线都会被判成穿身而过，算法随后
 * 找不到任何干净路线。所以这里把本体**向内收缩** `pad` 个单位后再判。
 *
 * 线段包围盒由调用方算好（轴对齐，四个 min/max 与具体本体无关）：这两个判定是
 * 满负载下的热点，每帧要跑几千次 × 几十个本体，把 min/max 放进内层循环就是
 * 纯浪费；返回小对象又会给每帧添十几万次垃圾回收。
 */
function hitsShrunk(x1: number, x2: number, y1: number, y2: number, box: RouteObstacle, pad: number): boolean {
  return x1 < box.x + box.w - pad && x2 > box.x + pad && y1 < box.y + box.h - pad && y2 > box.y + pad;
}

/** 同上，但把本体**向外膨胀** `grown` 个单位（净空判定用；贴边不算）。 */
function hitsGrown(x1: number, x2: number, y1: number, y2: number, box: RouteObstacle, grown: number): boolean {
  return (
    x1 < box.x + box.w + grown - 1 &&
    x2 > box.x - grown + 1 &&
    y1 < box.y + box.h + grown - 1 &&
    y2 > box.y - grown + 1
  );
}

/**
 * 这根走线穿过了几个本体。
 *
 * `cap` 是给打分器用的提前退出上限：分层比较只需要知道「比当前最好那条多还是少」，
 * 数到 cap 就够判负，不必把 64 个本体全扫一遍。默认 Infinity = 精确计数（测试用）。
 */
export function routeCrossings(pts: Pt[], obstacles: readonly RouteObstacle[], cap = Number.POSITIVE_INFINITY): number {
  let hits = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    const x1 = Math.min(p.x, q.x);
    const x2 = Math.max(p.x, q.x);
    const y1 = Math.min(p.y, q.y);
    const y2 = Math.max(p.y, q.y);
    for (const box of obstacles) {
      if (hitsShrunk(x1, x2, y1, y2, box, 1)) {
        hits++;
        if (hits >= cap) return hits;
      }
    }
  }
  return hits;
}

function routeLength(pts: Pt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
  return len;
}

/** 折返（同一轴上先走再退回）会让线头在接线柱旁画出一个尖刺，必须避免。 */
export function routeBacktracks(pts: Pt[]): number {
  let count = 0;
  for (let i = 2; i < pts.length; i++) {
    const d1 = { x: pts[i - 1].x - pts[i - 2].x, y: pts[i - 1].y - pts[i - 2].y };
    const d2 = { x: pts[i].x - pts[i - 1].x, y: pts[i].y - pts[i - 1].y };
    if (d1.x * d2.x + d1.y * d2.y < 0) count++;
  }
  return count;
}

function pointInBox(p: Pt, box: RouteObstacle, grown: number): boolean {
  return (
    p.x >= box.x - grown &&
    p.x <= box.x + box.w + grown &&
    p.y >= box.y - grown &&
    p.y <= box.y + box.h + grown
  );
}

/** 包围盒是值对象，按值比较即可判断「这是不是它自己的本体」。 */
function isSameBox(a: RouteObstacle, list: readonly RouteObstacle[]): boolean {
  return list.some((b) => b.x === a.x && b.y === a.y && b.w === a.w && b.h === a.h);
}

/**
 * 折线钻进「本体 + 净空」膨胀框里的段数。
 *
 * 硬约束是 `routeCrossings`（真实本体、贴边不算），它保证「零穿体」这条底线；
 * 这里是软约束，只进打分：贴得越紧分越高，路由就会主动把折线推到本体外
 * 12 单位的安全走廊上，而不是擦着外壳走。
 *
 * 首末两段是端口短桩，接线柱就长在本体边上，短桩天然要从膨胀框里穿出去，
 * 所以豁免是**按语义**给的，不是按下标整根跳过：
 *   a. 该框是这根导线两端元件自己的本体（`ownBodies`）；
 *   b. 该框的膨胀走廊本来就含着这一段的接线柱落脚点（例如电池端子正好在
 *      `本体/2 + 12` 上）。
 * 早先实现按下标跳过 `i===1` 与 `i===last`，两点直线时两个条件落在同一段上，
 * 于是**整根线**被漏检——手工折线贴着别人本体 0.5 单位也能无条件通过。
 * 现在只有上面两种语义豁免生效，两点折线也一样逐段检查。
 */
export function routeClearance(
  pts: Pt[],
  obstacles: readonly RouteObstacle[],
  clearance = ROUTE_CLEARANCE,
  /** 本根导线两端元件自己的本体（与 `elementBounds` 的值相等即可）。 */
  ownBodies: readonly RouteObstacle[] = [],
  /** 提前退出上限：打分器只需要「比当前最好那条多还是少」。默认 Infinity = 精确计数。 */
  cap = Number.POSITIVE_INFINITY,
): number {
  let hits = 0;
  const last = pts.length - 1;
  const two = pts.length === 2;
  for (let i = 1; i <= last; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    const x1 = Math.min(p.x, q.x);
    const x2 = Math.max(p.x, q.x);
    const y1 = Math.min(p.y, q.y);
    const y2 = Math.max(p.y, q.y);
    // 这一段的「接线柱端」：首段是 p，末段是 q；只剩两点的折线两端都是接线柱。
    // 用两个布尔量代替每段新建的 tips 数组——这里每帧要跑几千次，数组就是垃圾。
    const tipStart = two || i === 1;
    const tipEnd = two || i === last;
    const stub = pts.length > 3 && (i === 1 || i === last);
    for (const box of obstacles) {
      if (stub && isSameBox(box, ownBodies)) continue;
      if (
        tipStart &&
        p.x >= box.x - clearance &&
        p.x <= box.x + box.w + clearance &&
        p.y >= box.y - clearance &&
        p.y <= box.y + box.h + clearance
      ) {
        continue;
      }
      if (
        tipEnd &&
        q.x >= box.x - clearance &&
        q.x <= box.x + box.w + clearance &&
        q.y >= box.y - clearance &&
        q.y <= box.y + box.h + clearance
      ) {
        continue;
      }
      if (hitsGrown(x1, x2, y1, y2, box, clearance)) {
        hits++;
        if (hits >= cap) return hits;
      }
    }
  }
  return hits;
}

/* ── 已布线段索引：异网共线重叠 ──────────────────────────────────────────
 * 不同网络的两根导线被画成同一条直线，读图时会当成同一个节点；屏幕上却
 * 没有任何标记（跳线只覆盖正交穿越，不覆盖共线）。这是比穿体更危险的一类
 * 缺陷，所以后布的导线必须知道前面压过哪些线。
 *
 * 索引按「同一条横线 / 竖线」分桶：共线重叠只可能发生在完全同 y（横向）或
 * 同 x（纵向）的两段之间，查一次桶就够，不必两两比对（满负载时那是每次
 * 几十万次线段关系判定）。
 */
export interface PlacedSegments {
  horizontal: Map<number, PlacedLine[]>;
  vertical: Map<number, PlacedLine[]>;
}

interface PlacedLine {
  lo: number;
  hi: number;
  net: number;
  terminals: readonly string[];
}

export interface OverlapCount {
  /** 跨网络共线重叠：读图直接读错，权重最高。 */
  crossNet: number;
  /** 同网络、两端接线柱也不共享的长距离叠线：画面上就是「一根粗线」。 */
  sameNet: number;
}

/** 需要「这根线压在哪几条已布线道上」时才传（微偏置只挪真正撞上的那几条）。 */
export interface OverlapLines {
  lines: number[];
}

export function createPlacedSegments(): PlacedSegments {
  return { horizontal: new Map(), vertical: new Map() };
}

function lineKey(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

/** 把一根已经定稿的导线登记进索引，供后面的导线避让。 */
export function addPlacedSegments(
  placed: PlacedSegments,
  pts: readonly Pt[],
  net: number,
  terminals: readonly string[],
): void {
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    const horizontal = Math.abs(p.y - q.y) <= 1e-6;
    if (!horizontal && Math.abs(p.x - q.x) > 1e-6) continue;
    const map = horizontal ? placed.horizontal : placed.vertical;
    const key = lineKey(horizontal ? p.y : p.x);
    const lo = horizontal ? Math.min(p.x, q.x) : Math.min(p.y, q.y);
    const hi = horizontal ? Math.max(p.x, q.x) : Math.max(p.y, q.y);
    const line: PlacedLine = { lo, hi, net, terminals };
    const bucket = map.get(key);
    if (bucket) bucket.push(line);
    else map.set(key, [line]);
  }
}

/**
 * 折线与已布线段共线重叠的处数。
 *
 * 异网重叠无论如何都要避免；同网重叠网开一面：两根线本来就在同一个接线柱上
 * 分叉（共享端点，重合是必然的），以及重叠很短（只是在拐角处蹭了一下）。
 */
export function routeOverlaps(
  pts: readonly Pt[],
  placed: PlacedSegments | undefined,
  net = 0,
  terminals: readonly string[] = [],
  /** 传了就把「撞上的那条已布线道坐标」记下来，供微偏置定点避让。 */
  out?: OverlapLines,
): OverlapCount {
  const counts: OverlapCount = { crossNet: 0, sameNet: 0 };
  if (!placed) return counts;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    const horizontal = Math.abs(p.y - q.y) <= 1e-6;
    if (!horizontal && Math.abs(p.x - q.x) > 1e-6) continue;
    const coordinate = horizontal ? p.y : p.x;
    const bucket = horizontal ? placed.horizontal.get(lineKey(p.y)) : placed.vertical.get(lineKey(p.x));
    if (!bucket) continue;
    const lo = horizontal ? Math.min(p.x, q.x) : Math.min(p.y, q.y);
    const hi = horizontal ? Math.max(p.x, q.x) : Math.max(p.y, q.y);
    for (const line of bucket) {
      const span = Math.min(hi, line.hi) - Math.max(lo, line.lo);
      if (span < OVERLAP_MIN) continue;
      if (line.net !== net) counts.crossNet += 1;
      else if (span >= SAME_NET_OVERLAP_MIN && !sharesTerminal(line.terminals, terminals)) counts.sameNet += 1;
      if (out && !out.lines.includes(coordinate)) out.lines.push(coordinate);
    }
  }
  return counts;
}

function sharesTerminal(a: readonly string[], b: readonly string[]): boolean {
  for (const x of a) if (b.includes(x)) return true;
  return false;
}

/**
 * 五态正交路由的形态：由两端外法线与两个短桩端点的相对位置判定。
 *
 * - `straight` 共线对向且短桩端点同轴：一根直线，0 拐角；
 * - `L`  两端法线正交（一横一竖）：一个拐角就够，不该拐三次；
 * - `Z`  两端法线平行反向（→ ←）：中分 Z 型，两个拐角；
 * - `U`  两端法线平行同向（↑ ↑，并排的两只电压表）：从同侧兜出去再回来；
 * - `S`  平行反向但两端背对背（两个短桩端点反着方向拉开）：得绕到更外侧的 S 形。
 *
 * 形态只是「优先画法」，遇到障碍物允许退化成更多拐角（打分时拐角数最轻）。
 */
export type WireShape = 'straight' | 'L' | 'Z' | 'U' | 'S';

export function wireShapeOf(fromNormal: Pt, toNormal: Pt, a: Pt, b: Pt): WireShape {
  const dot = fromNormal.x * toNormal.x + fromNormal.y * toNormal.y;
  // 一横一竖：一个拐角就能接上。
  if (Math.abs(dot) < 1e-6) return 'L';
  // 同向（↑↑）：两根短桩朝同一侧，只能从外侧包一圈（U / C）。
  if (dot > 0) return 'U';
  // 反向（→←）：冲着的方向 + 有没有错开，定直线 / 面对面 Z / 背对背 S。
  const horizontal = fromNormal.x !== 0;
  const along = horizontal ? b.x - a.x : b.y - a.y;
  const offset = horizontal ? b.y - a.y : b.x - a.x;
  const facing = (horizontal ? fromNormal.x : fromNormal.y) * along;
  // 两个短桩端点同轴、而且是对着走的：一根直线接上，不用拐。
  if (Math.abs(offset) < 1e-6 && facing > 0) return 'straight';
  return facing < 0 ? 'S' : 'Z';
}

/**
 * 共线冗余折点清理：`P(i-1) → P(i) → P(i+1)` 同横或同竖时丢掉 P(i)。
 *
 * 首末两点恒定保留（只有中间的点才可能被判成冗余）。短桩、中分折线与车道
 * 拼起来常留下「同方向的两小段」（例如先出短桩、再沿同一条线继续走），
 * 不清理会让拐角数虚高：圆角是按拐点切的，多余折点会把一根直线在视觉上
 * 切成几截，也让「最少拐角」的打分失真。
 */
export function simplifyCollinear(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.x - p.x) < 1e-6 && Math.abs(prev.y - p.y) < 1e-6) continue;
    while (out.length >= 2 && isCollinear(out[out.length - 2], out[out.length - 1], p)) out.pop();
    out.push(p);
  }
  return out;
}

/**
 * 折线收口：首末两个接线柱与两端**短桩端点**恒定保留，只清理中间冗余折点。
 *
 * 短桩端点为什么不能顺手删掉：它是最外侧「首段方向 = 端口法线」这条约定、
 * 以及实物模式护套（`sleevePoints`）的锚点；连点一根直线本来就只剩两点，
 * 保留它才判得出「导线是先沿法线出来再折」。
 */
function closeRoute(from: Pt, stubStart: Pt, middle: readonly Pt[], stubEnd: Pt, to: Pt): Pt[] {
  return dedupePoints([from, ...simplifyCollinear([stubStart, ...middle, stubEnd]), to]);
}

/** 折线的真实拐角数：相邻两段方向不同才算一个拐角（同向延长线不算）。 */
export function routeBends(pts: readonly Pt[]): number {
  let bends = 0;
  for (let i = 2; i < pts.length; i++) {
    const ax = pts[i - 1].x - pts[i - 2].x;
    const ay = pts[i - 1].y - pts[i - 2].y;
    const bx = pts[i].x - pts[i - 1].x;
    const by = pts[i].y - pts[i - 1].y;
    if (Math.abs(ax * by - ay * bx) > 1e-6) bends++;
  }
  return bends;
}

/**
 * 中间段折弯数：只统计两个短桩端点**之间**的拐角。
 *
 * 端口短桩是接线端子自身的一部分（见 `closeRoute`），它必然与后续走线成直角。
 * 把这两个角算进折弯数会让同一个单拐 L 型有时报 1、有时报 3——取决于 L 的
 * 拐角恰好与哪一侧短桩同向。判「一次能拐完却拐成了阶梯」只该看中间段，
 * 这也是 `五态` 校验与预设「每根 ≤2 个折弯」共用的口径。
 */
export function routeMiddleBends(pts: readonly Pt[]): number {
  // 只有三点时短桩已经塌成拐点本身，那一个角就在两个接线柱之间，照算。
  if (pts.length < 4) return routeBends(pts);
  let bends = 0;
  // 拐点 pts[k] 落在 2 .. len-3 之间才算「中间段」的折弯。
  for (let k = 2; k <= pts.length - 3; k++) {
    const ax = pts[k].x - pts[k - 1].x;
    const ay = pts[k].y - pts[k - 1].y;
    const bx = pts[k + 1].x - pts[k].x;
    const by = pts[k + 1].y - pts[k].y;
    if (Math.abs(ax * by - ay * bx) > 1e-6) bends++;
  }
  return bends;
}

/** 路由需要的上下文：已布线段、本根所属网络、端子引用、两端自己的本体。 */
export interface RouteContext {
  /** 已经布好的线段（异网共线重罚、同网长距离叠线轻罚）。 */
  placed?: PlacedSegments;
  /** 本根导线所属的电气网络编号。 */
  net?: number;
  /** 本根导线两端的端子引用。 */
  terminals?: readonly string[];
  /** 本根导线两端元件自己的本体：端口短桩天然从它们的净空里穿出来。 */
  ownBodies?: readonly RouteObstacle[];
}

/**
 * 带端口短桩的走线：先沿接线柱法线出线，再做正交折线。
 * 纯表现层几何，不改变端子引用或网表。
 *
 * 两端法线用的是**当前 rotation 下的真实外法线**（`terminalNormal`），
 * 所以元件转过 90°/180°/270° 之后，导线依旧先沿新法线出短桩，
 * 不会一出来就往本体里折。
 *
 * 候选按「五态正交路由」生成（见 `wireShapeOf`）：共线对向走直线、
 * 正交垂直优先单拐角 L 型、平行反向走中分 Z 型、平行同向与背对背走
 * 外包络 U / S 型；再按**分层字典序**打分挑一条：
 *   穿体 > 异网共线重叠 > 折返 > 净空侵入 + 同网长距离叠线 > 线长 + 拐角数。
 *
 * 三处兜底（对应审计报告 H1 / H3）：
 *   ① 手工 waypoints 只在「不穿体、不折返、不侵别人净空」时才被采纳；
 *   ② 两个接线柱贴脸（< 20 单位）时短桩归零，直接正交连过去，不再折出套环；
 *   ③ 标准短桩撞进邻居本体时按法线方向的剩余走廊收短（18 / 10 / 4 三档），
 *      让「候选集里存在干净解」成为可能，而不是静默返回最不脏的那根。
 */
export function wireRoutePoints(
  from: Pt,
  to: Pt,
  fromNormal: Pt,
  toNormal: Pt,
  stub = PORT_STUB,
  avoid: readonly RouteObstacle[] = [],
  waypoints: readonly Pt[] = [],
  context: RouteContext = {},
): Pt[] {
  const a = { x: from.x + fromNormal.x * stub, y: from.y + fromNormal.y * stub };
  const b = { x: to.x + toNormal.x * stub, y: to.y + toNormal.y * stub };

  // 手工指定中间点时不做候选搜索：教师排版好的折线比「最短干净线」更重要。
  // 但元件被旋转 / 挪动之后，写死的折点可能已经扎进本体里、或贴着别人的
  // 外壳擦过去：这时交回动态正交路由接管（状态层在旋转 / 移动时就会先清掉
  // 折点，这里再兜一道）。净空也参与判定——早先只查穿体，折线贴着本体
  // 0.5 单位也能无条件通过。
  if (waypoints.length) {
    const manual = closeRoute(from, a, orthogonalize([a, ...waypoints, b]).slice(1, -1), b, to);
    if (
      routeCrossings(manual, avoid) === 0 &&
      routeBacktracks(manual) === 0 &&
      routeClearance(manual, avoid, ROUTE_CLEARANCE, context.ownBodies) === 0
    ) {
      return manual;
    }
  }

  // 两个接线柱几乎贴在一起（设备面对面并排：电阻端子跨距各 ±30，中心只差 60
  // 就完全重合）：任何非零短桩都会折出一个套环，甚至是一个闭合小环。直接从
  // 端子正交走线；完全重合时折线退化成一点，画布上什么也不画。
  if (Math.hypot(to.x - from.x, to.y - from.y) < NEAR_TERMINAL_DIST) {
    return traceRoute(from, to, fromNormal, toNormal, 0, avoid, context);
  }

  const nominal = traceRoute(from, to, fromNormal, toNormal, stub, avoid, context);
  if (isCleanRoute(nominal, avoid, context)) return nominal;

  // 只有在「短桩撞进邻居本体」时才启用自适应档位。量出端子沿法线还剩多少
  // 走廊，把短桩收到 avail−4（下限 4），再从可用档位里挑一条干净线。
  // 这是 H1 的根因修复：短桩长度原本是硬编码常量、不进候选空间，别人的
  // 本体一旦压进这条走廊，所有候选的第一段都穿体，候选集里根本没有干净解。
  const availFrom = availableStub(from, fromNormal, avoid);
  const availTo = availableStub(to, toNormal, avoid);
  const tierFrom = adaptiveStubFor(availFrom, stub);
  const tierTo = adaptiveStubFor(availTo, stub);
  if (routeCrossings(nominal, avoid) === 0 || (tierFrom >= stub && tierTo >= stub)) return nominal;

  let best = nominal;
  let bestLayers: number[] | null = layeredScore(nominal, avoid, context);
  for (const stubFrom of tiersOf(tierFrom, stub)) {
    for (const stubTo of tiersOf(tierTo, stub)) {
      if (stubFrom === stub && stubTo === stub) continue;
      const pts = traceRoute(from, to, fromNormal, toNormal, stubFrom, avoid, context, stubTo);
      const layers = layeredScore(pts, avoid, context, bestLayers ?? undefined);
      if (!layers) continue;
      if (!bestLayers || lexLess(layers, bestLayers)) {
        best = pts;
        bestLayers = layers;
      }
    }
  }
  return best;
}

/** 一根走线是否「一点毛病都没有」：不穿体、不折返、不侵净空、不叠线。 */
function isCleanRoute(pts: Pt[], avoid: readonly RouteObstacle[], context: RouteContext): boolean {
  if (routeCrossings(pts, avoid) > 0) return false;
  if (routeBacktracks(pts) > 0) return false;
  if (routeClearance(pts, avoid, ROUTE_CLEARANCE, context.ownBodies) > 0) return false;
  const overlaps = routeOverlaps(pts, context.placed, context.net ?? 0, context.terminals ?? []);
  return overlaps.crossNet === 0 && overlaps.sameNet === 0;
}

/** 走廊：两端点（含短桩端点）围出的包围盒，四边各外扩两倍车道间距。 */
interface Corridor {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function corridorOf(pts: readonly Pt[]): Corridor {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const p of pts) {
    x1 = Math.min(x1, p.x);
    y1 = Math.min(y1, p.y);
    x2 = Math.max(x2, p.x);
    y2 = Math.max(y2, p.y);
  }
  const pad = LANE_PAD * 2;
  return { x1: x1 - pad, y1: y1 - pad, x2: x2 + pad, y2: y2 + pad };
}

function corridorHit(box: RouteObstacle, c: Corridor): boolean {
  return box.x <= c.x2 && box.x + box.w >= c.x1 && box.y <= c.y2 && box.y + box.h >= c.y1;
}

/** 候选集内挑一条最不脏的正交折线。 */
function traceRoute(
  from: Pt,
  to: Pt,
  fromNormal: Pt,
  toNormal: Pt,
  stub: number,
  avoid: readonly RouteObstacle[],
  context: RouteContext,
  toStub = stub,
): Pt[] {
  const a = { x: from.x + fromNormal.x * stub, y: from.y + fromNormal.y * stub };
  const b = { x: to.x + toNormal.x * toStub, y: to.y + toNormal.y * toStub };
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const base: Pt[][] = [];

  // ① 共线对向：两个短桩端点同轴时一根直线接上，0 拐角。
  if (Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6) base.push([a, b]);
  // ② 正交垂直：单拐角 L 型，两个方向的拐角都试一遍——
  //    一次能拐完却拐成三级阶梯，正是要消掉的毛病。
  base.push([a, { x: b.x, y: a.y }, b]);
  base.push([a, { x: a.x, y: b.y }, b]);
  // ③ 平行反向：中分 Z 型（两个拐角），教科书上最规矩的画法。
  base.push([a, { x: midX, y: a.y }, { x: midX, y: b.y }, b]);
  base.push([a, { x: a.x, y: midY }, { x: b.x, y: midY }, b]);
  // ④⑤ 外包络 U / S 型：车道既取元件包围盒的四边，也取两个短桩端点自身的外侧
  //      ——空场地上（一个障碍也没有）也得绕得出 U 型，否则并排电表会被接成直线。
  //
  //     只收「可能挡在这条线路上」的本体：包围盒与两端点围出的走廊（外扩两倍车道间距）
  //     相交的才算。元件一多，全量车道会让候选数按元件数线性膨胀——64 元件时每根导线
  //     近千个候选，满负载一帧要一秒；而远处元件的车道只可能绕出巨大回头路，
  //     在分层打分里永远排不上（实测候选数 ÷5，被删的候选 0 次夺冠）。
  //     注意：这只是**候选集**的收敛，打分仍然拿全部 avoid 判穿体/净空，
  //     所以删掉的只是「不可能更好」的选项，不会让某条脏解被误判成干净。
  const lanesX = new Set<number>([Math.min(a.x, b.x) - LANE_PAD, Math.max(a.x, b.x) + LANE_PAD]);
  const lanesY = new Set<number>([Math.min(a.y, b.y) - LANE_PAD, Math.max(a.y, b.y) + LANE_PAD]);
  const corridor = corridorOf([from, to, a, b]);
  for (const box of avoid) {
    if (!corridorHit(box, corridor)) continue;
    for (const d of [LANE_PAD, LANE_PAD * 2]) {
      lanesX.add(box.x - d);
      lanesX.add(box.x + box.w + d);
      lanesY.add(box.y - d);
      lanesY.add(box.y + box.h + d);
    }
  }
  for (const x of lanesX) base.push([a, { x, y: a.y }, { x, y: b.y }, b]);
  for (const y of lanesY) base.push([a, { x: a.x, y }, { x: b.x, y }, b]);

  const first = pickRoute(from, to, a, b, base, avoid, context);
  // 第一遍只用基础车道。只有最好的那条**仍然有毛病**（与已布导线共线重叠，或者
  // 为了躲穿体而折返出尖刺）时，才补上 ±8 / ±16 的平行微偏置再挑一遍——
  // 车道翻五倍很贵，而大多数导线一遍就有干净解（满负载下这一条决定拖动是否流畅）。
  if (!needsMicroPass(first, context)) return first;
  const micro: Pt[][] = [];
  // 微偏置只挪**真正撞上的那几条车道**（外加两条 Z 中线）：把所有车道都 ±8/±16 铺一遍，
  // 候选数直接翻五倍——满负载下每根导线三百多个候选，一帧要付 900 ms。而共线重叠只可能
  // 发生在「与已布线同一条横线/竖线」上，把那一条挪开就够，别的车道挪了也不会被选中。
  const hitLines = overlapLinesOf(first, context);
  const collide = (v: number): boolean => hitLines.some((c) => Math.abs(c - v) < 1);
  for (const off of LANE_MICRO) {
    micro.push([a, { x: midX + off, y: a.y }, { x: midX + off, y: b.y }, b]);
    micro.push([a, { x: a.x, y: midY + off }, { x: b.x, y: midY + off }, b]);
    for (const x of lanesX) if (collide(x)) micro.push([a, { x: x + off, y: a.y }, { x: x + off, y: b.y }, b]);
    for (const y of lanesY) if (collide(y)) micro.push([a, { x: a.x, y: y + off }, { x: b.x, y: y + off }, b]);
  }
  return pickRoute(from, to, a, b, micro, avoid, context, first);
}

/** 这条折线压在哪几条已布线道上（没有上下文就返回空）。 */
function overlapLinesOf(pts: Pt[], context: RouteContext): number[] {
  if (!context.placed) return [];
  const out: OverlapLines = { lines: [] };
  routeOverlaps(pts, context.placed, context.net ?? 0, context.terminals ?? [], out);
  return out.lines;
}

/**
 * 第一遍的车道够不够用？只有「还有毛病」才值得翻五倍车道再来一遍。
 *
 * 两种毛病都算：与已布导线共线重叠（跨网叠线分不清谁是谁），以及折返尖刺。
 * 后者在严格分层下是有意为之的取舍——「宁可折返也不穿体」（穿体 1e8 > 折返 1e6），
 * 但折返同样是画面上的坏味道，所以一旦出现就再给微偏置一次机会，
 * 能选到既不穿体、又不折返的车道就换掉它；换不掉才认这份取舍。
 */
function needsMicroPass(pts: Pt[], context: RouteContext): boolean {
  if (routeBacktracks(pts) > 0) return true;
  if (!context.placed) return false;
  const overlaps = routeOverlaps(pts, context.placed, context.net ?? 0, context.terminals ?? []);
  return overlaps.crossNet > 0 || overlaps.sameNet > 0;
}

/**
 * 逐候选打分取最优。`seed` 是上一轮已经挑出来的线：第二轮（微偏置）只能拿它
 * 当基准改进，绝不允许把第一轮的干净解换成脏解。
 */
function pickRoute(
  from: Pt,
  to: Pt,
  a: Pt,
  b: Pt,
  candidates: readonly Pt[][],
  avoid: readonly RouteObstacle[],
  context: RouteContext,
  seed?: Pt[],
): Pt[] {
  let bestPts: Pt[] | null = seed ?? null;
  let bestLayers: number[] | null = seed ? layeredScore(seed, avoid, context) : null;
  const seen = new Set<string>();
  for (const raw of candidates) {
    // 评分必须带上两端端子点：折返常常发生在「最后一段接回接线柱」时。
    const middle = raw.slice(1, -1);
    const key = middle.map((p) => `${p.x},${p.y}`).join(';');
    if (seen.has(key)) continue;
    seen.add(key);
    const pts = closeRoute(from, a, middle, b, to);
    if (pts.length < 2) continue;
    const layers = layeredScore(pts, avoid, context, bestLayers ?? undefined);
    if (!layers) continue;
    if (!bestLayers || lexLess(layers, bestLayers)) {
      bestPts = pts;
      bestLayers = layers;
    }
  }
  return bestPts ?? closeRoute(from, a, [], b, to);
}

/**
 * 分层打分：逐层算，一旦发现已经赢不了当前最优就立刻放弃这个候选。
 *
 * 分层是**字典序**而非加权求和——低优项再多也盖不过高优项：穿一个本体
 * 永远比多一次折返更糟，异网共线重叠永远比净空侵入更糟。
 */
function layeredScore(
  pts: Pt[],
  avoid: readonly RouteObstacle[],
  context: RouteContext,
  best?: readonly number[],
): number[] | null {
  const layers: number[] = [];
  const push = (value: number): boolean => {
    layers.push(value);
    if (!best) return true;
    for (let i = 0; i < layers.length; i++) {
      if (layers[i] !== best[i]) return layers[i] < best[i];
    }
    return true;
  };
  // 提前退出上限：候选跑在同一个 `avoid` 上，层 1/层 4 的扫描最贵（64 个本体就要
  // 全扫一遍）。只需要判「比当前最好那条多还是少」，数到 best+1 即可收工。
  if (best) {
    const crossCap = Math.floor(best[0] / W_CROSSINGS) + 1;
    if (!push(routeCrossings(pts, avoid, crossCap) * W_CROSSINGS)) return null;
  } else if (!push(routeCrossings(pts, avoid) * W_CROSSINGS)) {
    return null;
  }
  const overlaps = routeOverlaps(pts, context.placed, context.net ?? 0, context.terminals ?? []);
  if (!push(overlaps.crossNet * W_CROSS_NET)) return null;
  if (!push(routeBacktracks(pts) * W_BACKTRACK)) return null;
  // 层 4 同理：净空已经数到「比最好那条还多一个」，加上同网重叠只会更差，
  // 后面几十个本体不必再扫。
  const clearCap = best ? Math.floor(best[3] / W_CLEARANCE) + 1 : Number.POSITIVE_INFINITY;
  const soft = routeClearance(pts, avoid, ROUTE_CLEARANCE, context.ownBodies, clearCap) * W_CLEARANCE;
  if (!push(soft + overlaps.sameNet * W_SAME_NET)) return null;
  push(routeLength(pts) + routeBends(pts) * W_BEND);
  return layers;
}

function lexLess(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/**
 * 接线柱沿外法线到「别人本体」的距离；一路没有遮挡时返回 Infinity。
 *
 * H1 的根因就在这里：候选里每条路的第一段恒为 from → from + n̂·stub，短桩
 * 长度是硬编码常量，一旦邻居本体压进这条走廊，所有候选的第一段都穿体，
 * 候选集里根本不存在干净解。量出走廊还剩多少，才能在贴脸布局里收短短桩。
 */
function availableStub(from: Pt, normal: Pt, avoid: readonly RouteObstacle[]): number {
  let best = Infinity;
  for (const box of avoid) {
    let reach = Infinity;
    if (normal.y !== 0) {
      // 竖直出线：只有本体在 y 上挡住、并且横向真的跨过这条竖线时才算。
      if (from.x <= box.x + 1 || from.x >= box.x + box.w - 1) continue;
      reach = normal.y > 0 ? box.y - from.y : from.y - (box.y + box.h);
    } else {
      if (from.y <= box.y + 1 || from.y >= box.y + box.h - 1) continue;
      reach = normal.x > 0 ? box.x - from.x : from.x - (box.x + box.w);
    }
    // 负值是「本体在身后」，不算遮挡。
    if (reach >= 0 && reach < best) best = reach;
  }
  return best;
}

/** 走廊还够宽就走标准件 18，被邻居堵住就收到 avail−4（下限 4）。 */
function adaptiveStubFor(avail: number, nominal: number): number {
  if (!Number.isFinite(avail) || avail >= nominal) return nominal;
  return Math.max(MIN_PORT_STUB, Math.min(nominal, avail - PORT_STUB_INSET));
}

/** 自适应档位（收短值 + 下限）到标准件之间的可选短桩长度。 */
function tiersOf(tier: number, nominal: number): number[] {
  if (tier >= nominal) return [nominal];
  return tier === MIN_PORT_STUB ? [tier] : [tier, MIN_PORT_STUB];
}

/**
 * 把任意折线补成正交折线：相邻两点若在两个轴上都不同，插入一个直角拐点。
 * 手工 waypoints 只需写「大致经过这里」，不必自己保证每段都横平竖直。
 */
export function orthogonalize(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.x - p.x) > 1e-6 && Math.abs(prev.y - p.y) > 1e-6) {
      out.push({ x: p.x, y: prev.y });
    }
    out.push(p);
  }
  return out;
}

const SEG_EPS = 1e-6;

/** 两段轴对齐线段的关系：不相交 / 正交穿越 / 端点相触 / 共线重叠。 */
export type SegmentRelation = 'none' | 'cross' | 'touch' | 'overlap';

function isHorizontal(a: Pt, b: Pt): boolean {
  return Math.abs(a.y - b.y) <= SEG_EPS;
}

/**
 * 判断两条轴对齐线段的关系。
 *
 * `cross` 指两段都在内部相交（教科书上的「导线交叉」）；
 * `overlap` 指两段共线且有一段非零长度的公共部分（导线被画成重叠的一条）；
 * `touch` 只在一个端点相接，通常就是同一接线柱的汇合，不算缺陷。
 */
export function segmentRelation(p1: Pt, q1: Pt, p2: Pt, q2: Pt): SegmentRelation {
  const h1 = isHorizontal(p1, q1);
  const h2 = isHorizontal(p2, q2);
  const x1 = [Math.min(p1.x, q1.x), Math.max(p1.x, q1.x)];
  const y1 = [Math.min(p1.y, q1.y), Math.max(p1.y, q1.y)];
  const x2 = [Math.min(p2.x, q2.x), Math.max(p2.x, q2.x)];
  const y2 = [Math.min(p2.y, q2.y), Math.max(p2.y, q2.y)];

  if (h1 && h2) {
    if (Math.abs(p1.y - p2.y) > SEG_EPS) return 'none';
    const lo = Math.max(x1[0], x2[0]);
    const hi = Math.min(x1[1], x2[1]);
    if (hi < lo - SEG_EPS) return 'none';
    if (Math.abs(hi - lo) <= SEG_EPS) return 'touch';
    return 'overlap';
  }
  if (!h1 && !h2) {
    if (Math.abs(p1.x - p2.x) > SEG_EPS) return 'none';
    const lo = Math.max(y1[0], y2[0]);
    const hi = Math.min(y1[1], y2[1]);
    if (hi < lo - SEG_EPS) return 'none';
    if (Math.abs(hi - lo) <= SEG_EPS) return 'touch';
    return 'overlap';
  }

  // 一横一竖：取交点，判断是否同时落在两段的闭区间内。
  const hSeg = h1 ? { a: p1, b: q1 } : { a: p2, b: q2 };
  const vSeg = h1 ? { a: p2, b: q2 } : { a: p1, b: q1 };
  const cx = vSeg.a.x;
  const cy = hSeg.a.y;
  const inH = cx >= Math.min(hSeg.a.x, hSeg.b.x) - SEG_EPS && cx <= Math.max(hSeg.a.x, hSeg.b.x) + SEG_EPS;
  const inV = cy >= Math.min(vSeg.a.y, vSeg.b.y) - SEG_EPS && cy <= Math.max(vSeg.a.y, vSeg.b.y) + SEG_EPS;
  if (!inH || !inV) return 'none';
  const onH = Math.abs(cx - hSeg.a.x) <= SEG_EPS || Math.abs(cx - hSeg.b.x) <= SEG_EPS;
  const onV = Math.abs(cy - vSeg.a.y) <= SEG_EPS || Math.abs(cy - vSeg.b.y) <= SEG_EPS;
  return onH || onV ? 'touch' : 'cross';
}

/** 正交相交点（仅当关系为 cross 时有意义）。 */
export function segmentCrossPoint(p1: Pt, q1: Pt, p2: Pt, q2: Pt): Pt | null {
  if (isHorizontal(p1, q1) === isHorizontal(p2, q2)) return null;
  return isHorizontal(p1, q1) ? { x: p2.x, y: p1.y } : { x: p1.x, y: p2.y };
}

/** 折线拆成线段。 */
export function polylineSegments(pts: readonly Pt[]): [Pt, Pt][] {
  const out: [Pt, Pt][] = [];
  for (let i = 1; i < pts.length; i++) out.push([pts[i - 1], pts[i]]);
  return out;
}

function dedupePoints(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 1e-6) out.push(p);
  }
  return out;
}

/** 圆角正交折线：把每个直角用二次贝塞尔切掉。 */
export function roundedWirePath(pts: Pt[], radius = 10): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${round(pts[0].x)} ${round(pts[0].y)}`;
  if (pts.length === 2) {
    return `M${round(pts[0].x)} ${round(pts[0].y)} L${round(pts[1].x)} ${round(pts[1].y)}`;
  }
  let d = `M${round(pts[0].x)} ${round(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const p = pts[i];
    const next = pts[i + 1];
    if (isCollinear(prev, p, next)) {
      d += ` L${round(p.x)} ${round(p.y)}`;
      continue;
    }
    const r = Math.min(radius, distance(prev, p) / 2, distance(p, next) / 2);
    const a = pointAlong(p, prev, r);
    const b = pointAlong(p, next, r);
    d += ` L${round(a.x)} ${round(a.y)} Q${round(p.x)} ${round(p.y)} ${round(b.x)} ${round(b.y)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${round(last.x)} ${round(last.y)}`;
  return d;
}

/** 元件包围盒（用于缩略图、命中与导线绕障）：本体框 `componentBodyBox` 的旋转外接矩形。 */
export function elementBounds(el: CircuitComponent): Bounds {
  return boxToBounds(el, componentBodyBox(el.kind));
}

/**
 * 元件**墨迹**包围盒：本体 + 光晕（`componentInkBox`）的旋转外接矩形。
 * 选中环与标签避让要罩住屏幕上真的会亮/会画出来的东西，用这一份；
 * 导线绕障用 `elementBounds`（实体口径）。
 */
export function elementInkBounds(el: CircuitComponent): Bounds {
  return boxToBounds(el, componentInkBox(el.kind));
}

function boxToBounds(el: CircuitComponent, box: BodyBox): Bounds {
  // 本体包络可以不居中了（玻璃泡长在灯座之上、电热丝底板压在下沿），
  // 再用「换个 w/h」的写法就会把不对称量丢掉。改成把本地框四角真的转过去，
  // 取旋转后的轴对齐外接矩形：任意角度都成立，也不再需要 % 180 的特判。
  const rad = ((el.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const x of [box.x0, box.x1]) {
    for (const y of [box.y0, box.y1]) {
      const px = x * cos - y * sin;
      const py = x * sin + y * cos;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }
  return { x: el.x + minX, y: el.y + minY, w: maxX - minX, h: maxY - minY };
}

/** 本地坐标下的本体包络：`x0/y0` 是左上角，`x1/y1` 是右下角。 */
export interface BodyBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * 本体包络（本地坐标，未旋转），允许上下不对称。
 *
 * 与 `componentBodySize` 分工：后者是「必须塞进端子跨度」的对称底板尺寸，
 * 符号用它垫那张透明命中底（对称即可，它是热区不是画）；这里量的是本体
 * （实体墨迹，**不含光晕**）真的画到了哪，是 `elementBounds` 的唯一来源——
 * 也就是导线绕障与「元件外侧 12 单位净空」那条口径的本体。
 *
 * 小灯泡的玻璃泡竖着长在灯座之上（泡心 y=−23、泡顶 −29.5、r=6.5），
 * 灯座却横贯两端子：用一个 48×48 的对称框去套，泡顶那 6 个单位永远露在框外。
 * 所以这里按真实视觉高度量：底座下沿 +16（`rect y=−6 h=22`）、上沿 −30（泡顶
 * 再留 0.5 的抗锯齿余量），合起来 48×46。
 *
 * 光晕（额定/过载时把上沿顶到 −43）**不进这个框**，见 `componentInkBox`：
 * 它是光不是实体，导线从光晕里穿过去不是缺陷，而把它圈进绕障框会让
 * 12 单位净空的硬门禁失守——实测 2328 条走线里 14 条会因此贴进净空走廊
 * （`sp v2:b->l2:a` 一类「电表正上方的表笔线」被逼到只剩 6 单位高的缝，
 * 而现有候选空间只有 0/1/2 个拐点的折线，绕不出需要 3 个拐点的解）。
 */
export function componentBodyBox(kind: ElementKind): BodyBox {
  switch (kind) {
    case 'bulb':
      return { x0: -24, y0: -30, x1: 24, y1: 16 };
    case 'heater':
      // 锯齿墨迹 x∈[−28,28]、y∈[−9,9]；实物底板再往下压到 y=12。
      // 28..33 那一段是引线，±33 处是接线柱短桩——属于接线硬件，不是本体，
      // 圈进避让框会让导线绕一个大圈去躲一根本来就该被插上的柱子。
      return { x0: -28, y0: -9, x1: 28, y1: 12 };
    default: {
      const size = componentBodySize(kind);
      return { x0: -size.w / 2, y0: -size.h / 2, x1: size.w / 2, y1: size.h / 2 };
    }
  }
}

/**
 * 墨迹包络（本地坐标，未旋转）：本体**加上会画出来的光**。
 *
 * 供「选中环」与「标签避让」使用——这两处要罩住屏幕上真的会亮的东西：
 * 审计给的实测墨迹框是 `x[−20,20] y[−43,−3]`（`getBBox` 量的是含光晕的整棵子树），
 * 额定功率下光晕顶点就在 −43，比本体上沿（−30）高 **19 个单位**。选中环按
 * 本体框画会横切过玻璃泡与光晕，标签也会贴在光晕上，两处都是审计点名的
 * 「19 wu 几何上溢」的受害者。
 *
 * 与 `componentBodyBox` 分开是**有意**的：导线绕障要的是「不能从实体里穿过去」，
 * 光晕是透明的光，导线（以及任何图和它）从光晕里穿过去不是缺陷；把光晕圈进
 * 绕障框会把 12 单位净空走廊压成 6 单位的缝，让本来干净的走线被判违规。
 * 除灯泡外，两者恒等——只有灯泡的光晕会明显长到本体之外。
 */
export function componentInkBox(kind: ElementKind): BodyBox {
  switch (kind) {
    case 'bulb':
      // 上沿取额定/过载态光晕的顶点 −43（`cy=−23`、r=12 再乘最大放大 5/3），
      // 下沿同本体（底座 +16），合起来 48×59 —— 审计给出的「高度 ≥ 59」。
      // 光晕随功率伸缩，但框取的是最坏情况，所以环不会随灯泡变亮而跳动。
      return { x0: -24, y0: -43, x1: 24, y1: 16 };
    default:
      return componentBodyBox(kind);
  }
}

/**
 * 本体尺寸（未旋转）；符号用它在本地坐标里画选中环，标签层用它避让。
 * 取「电路图 / 仿真图」两种画法的最大包络，保证选中环在任一模式下都罩得住本体；
 * 所有值都必须小于端子跨度的 2 倍，否则本体就会盖住接线柱。
 */
export function componentBodySize(kind: ElementKind): { w: number; h: number } {
  switch (kind) {
    case 'bulb':
      // 实物灯泡竖直旋在灯座里：包络要罩住「底座 + 向上的玻璃泡（泡心 y=−23、r=6.5）」，
      // 48 = 端子跨度上限，旋转 90° 时正好与两端子齐平、不会盖住接线柱。
      return { w: 48, h: 48 };
    case 'battery':
      // 圆柱电池 + 正极凸帽（凸帽尖端在 x=18），包络必须罩住凸帽
      return { w: 36, h: 26 };
    case 'resistor':
      return { w: 40, h: 16 };
    case 'rheostat':
      // 高度按仿真图把滑片手柄算进去（手柄顶到 y=-22），否则选中环会切掉手柄、标签也会压在上面
      return { w: 52, h: 44 };
    case 'switch':
      // 闸刀断开时手柄向上抬起，包络必须把它算进去；底座两端正好各落一个接线柱
      return { w: 54, h: 34 };
    case 'fuse':
      return { w: 32, h: 12 };
    case 'heater':
      return { w: 58, h: 16 };
    case 'wire':
      return { w: 52, h: 10 };
    case 'ammeter':
    case 'voltmeter':
    case 'galvanometer':
      // 实物电表是面板式教具：面板左右两端就是黑/红接线柱座，
      // 面板宽度必须与端子跨度相等，接线柱才落在面板边缘而不是飘在面板外。
      return { w: 48, h: 34 };
    default:
      return { w: 24, h: 24 };
  }
}

/**
 * 接线柱命中半径：随缩放放大方便触屏，但不超过半个端子跨度，
 * 否则同一元件两端的命中区会连成一片，点哪里都算端子。
 *
 * 注意还有第二道保险：`CircuitCanvas` 的指针层另外用
 * `hitTestTerminal(..., terminalHitRadiusWorld(pxPerWorld))` 做一次屏幕空间判定，
 * 所以即使这里被 `half * 0.9` 夹小，手指的 22px 热区依然成立。
 */
export function terminalHitRadiusFor(half: number, desired: number): number {
  return Math.max(6, Math.min(desired, Math.max(7, half * 0.9)));
}

/* ── 变阻器滑片 ────────────────────────────────────────────────────────────
 * 滑片位置是 `params.ratio` 的函数：0 → 最左（接入电阻最小），1 → 最右。
 * 两种画法的瓷筒长度不同，所以导轨半长按视图取值；本体、选中环、命中区
 * 都从这一组函数取坐标，滑片不会画在一处、可拖区却在另一处。
 */
export const WIPER_RAIL_HALF: Record<CircuitViewMode, number> = { schematic: 19, physical: 21 };

/** 滑片在本体本地坐标里的位置（导轨轴向为本地 x）。 */
export function wiperLocalX(ratio: unknown, viewMode: CircuitViewMode = 'schematic'): number {
  const half = WIPER_RAIL_HALF[viewMode];
  const r = Math.min(1, Math.max(0, Number(ratio) || 0));
  return -half + 2 * half * r;
}

/** 本地坐标 → 世界坐标（含元件自身的平移与旋转）。 */
export function localToWorldPoint(el: CircuitComponent, local: Pt): Pt {
  const rad = (el.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: el.x + local.x * cos - local.y * sin, y: el.y + local.x * sin + local.y * cos };
}

/**
 * 世界坐标 → 滑片比例：先把点逆旋转回本地坐标，再投影到导轨轴线上。
 * 拖拽时直接用它换算，学生的手指位置就是滑片位置。
 */
export function wiperRatioAt(
  el: CircuitComponent,
  p: Pt,
  viewMode: CircuitViewMode = 'schematic',
): number {
  const half = WIPER_RAIL_HALF[viewMode];
  const rad = (el.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - el.x;
  const dy = p.y - el.y;
  const localX = dx * cos + dy * sin;
  return Math.min(1, Math.max(0, (localX + half) / (2 * half)));
}

export function pointInElement(el: CircuitComponent, p: Pt): boolean {
  const b = elementBounds(el);
  const pad = 8;
  return p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
}

/** 返回最上层命中的元件（后添加的优先）。 */
export function hitTestComponent(components: CircuitComponent[], p: Pt): CircuitComponent | null {
  for (let i = components.length - 1; i >= 0; i--) {
    if (pointInElement(components[i], p)) return components[i];
  }
  return null;
}

export function hitTestTerminal(
  components: CircuitComponent[],
  p: Pt,
  radius = 12,
): { component: CircuitComponent; terminal: 'a' | 'b'; point: Pt } | null {
  let best: { component: CircuitComponent; terminal: 'a' | 'b'; point: Pt; d: number } | null = null;
  for (const el of components) {
    for (const t of ['a', 'b'] as const) {
      const q = terminalPoint(el, t);
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d <= radius && (!best || d < best.d)) best = { component: el, terminal: t, point: q, d };
    }
  }
  return best;
}

/**
 * 最近的接线柱（可排除一个），返回端点引用 `id:a` / `id:b`。
 *
 * 拖拽连线时用它做磁吸：半径换算成世界单位后，指针只要落在目标接线柱的磁吸圈
 * 里就算「瞄准了它」。排除项是本次拖拽的起点——否则指针一离开就永远吸回自己。
 */
export function nearestTerminalRef(
  components: readonly CircuitComponent[],
  p: Pt,
  radius: number,
  exclude?: string,
): { ref: string; point: Pt; d: number } | null {
  let best: { ref: string; point: Pt; d: number } | null = null;
  for (const el of components) {
    for (const t of ['a', 'b'] as const) {
      const ref = `${el.id}:${t}`;
      if (ref === exclude) continue;
      const point = terminalPoint(el, t);
      const d = Math.hypot(point.x - p.x, point.y - p.y);
      if (d <= radius && (!best || d < best.d)) best = { ref, point, d };
    }
  }
  return best;
}

export function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distanceToPolyline(p: Pt, pts: Pt[]): number {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, distanceToSegment(p, pts[i - 1], pts[i]));
  return d;
}

/** 屏幕点 → 世界点；view 为 SVG 内层 g 的 translate/scale。 */
export function screenToWorld(p: Pt, view: { tx: number; ty: number; scale: number }): Pt {
  return { x: (p.x - view.tx) / view.scale, y: (p.y - view.ty) / view.scale };
}

export function worldToScreen(p: Pt, view: { tx: number; ty: number; scale: number }): Pt {
  return { x: p.x * view.scale + view.tx, y: p.y * view.scale + view.ty };
}

/** 以屏幕点为中心缩放，保证该点下的世界坐标不移动。 */
export function zoomAround(
  view: { tx: number; ty: number; scale: number },
  screen: Pt,
  factor: number,
): { tx: number; ty: number; scale: number } {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
  if (scale === view.scale) return view;
  const world = screenToWorld(screen, view);
  return { scale, tx: screen.x - world.x * scale, ty: screen.y - world.y * scale };
}

export function fitView(canvas: { w: number; h: number }): ViewTransform {
  const scale = Math.min(canvas.w / WORLD_W, canvas.h / WORLD_H) * 0.98;
  return {
    scale: Math.max(MIN_SCALE, Math.min(1.2, scale)),
    tx: (canvas.w - WORLD_W * Math.max(MIN_SCALE, Math.min(1.2, scale))) / 2,
    ty: (canvas.h - WORLD_H * Math.max(MIN_SCALE, Math.min(1.2, scale))) / 2,
  };
}

function distance(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointAlong(from: Pt, towards: Pt, d: number): Pt {
  const len = distance(from, towards);
  if (len < 1e-9) return { ...from };
  return {
    x: from.x + ((towards.x - from.x) / len) * d,
    y: from.y + ((towards.y - from.y) / len) * d,
  };
}

function isCollinear(a: Pt, b: Pt, c: Pt): boolean {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < 1e-6;
}

/**
 * 已布好的导线折线，按 `state.wires` 的 id 对应（渲染层 `buildWireRoutes` 的产物）。
 *
 * 单独调 `wireRoutePoints` 只得到一根「理想走线」：不给障碍、折点与上下文，
 * 预设里手工排的中间点、以及绕开元件本体的让位都会消失，与真正画在画布上的
 * 那根能差出几十单位。凡是拿墨迹做判断的地方都得吃同一份折线。
 */
export interface RoutedWire {
  wire: { id: string };
  points: readonly Pt[];
}

/** 导线描边宽度（世界单位）：采样点取的是折线中心线，判遮挡时要把两边补齐。 */
export const INK_STROKE = 4;

/**
 * 电路墨迹的采样点：元件本体四角、两个端子、以及导线的折点。
 *
 * `contentBounds`（适配取景）与 `boxClearanceShift`（浮窗避让）必须走同一套几何，
 * 否则「让开多少」与「内容多宽」会在两个口径下打架，出现「算出来没挡住、看起来挡住了」。
 *
 * `routes` 传了就按它走线；没传只能退回理想走线（只有拿不到渲染结果的调用方才这样，
 * 精度足够算取景，但不足以判「有没有被浮窗压住」）。
 */
function eachInkPoint(state: BenchState, visit: (p: Pt) => void, routes?: readonly RoutedWire[]): void {
  const byId = new Map(state.components.map((c) => [c.id, c]));
  for (const el of state.components) {
    const b = elementBounds(el);
    visit({ x: b.x, y: b.y });
    visit({ x: b.x + b.w, y: b.y + b.h });
    visit(terminalPoint(el, 'a'));
    visit(terminalPoint(el, 'b'));
  }
  const drawn = routes ? new Map(routes.map((r) => [r.wire.id, r.points])) : null;
  for (const wire of state.wires) {
    const routed = drawn?.get(wire.id);
    if (routed) {
      for (const p of routed) visit(p);
      continue;
    }
    const a = parseTerminalRef(wire.from);
    const b = parseTerminalRef(wire.to);
    if (!a || !b) continue;
    const fromEl = byId.get(a.id);
    const toEl = byId.get(b.id);
    if (!fromEl || !toEl) continue;
    const from = terminalPoint(fromEl, a.terminal);
    const to = terminalPoint(toEl, b.terminal);
    for (const p of wireRoutePoints(
      from,
      to,
      terminalNormal(fromEl, a.terminal),
      terminalNormal(toEl, b.terminal),
    )) {
      visit(p);
    }
  }
}

/** 当前电路实际占用的世界范围（元件本体、端子与带短桩的导线）。 */
export function contentBounds(state: BenchState, routes?: readonly RoutedWire[]): Bounds {
  if (state.components.length === 0) {
    return { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  eachInkPoint(state, (p) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }, routes);
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

/**
 * 把内容边界适配到画布，而不是把整张世界画布塞进去。
 *
 * `fill > 0` 时改用「视觉占比」模式：让内容在受限方向上恰好占画布的 fill
 * （实物模式取 0.8，落在 75%–85% 的目标区间），比固定 padding 更能吃满画布；
 * 传 0（默认）时仍是原来的留白算法，既有调用与单测不受影响。
 *
 * `rightInset`（世界单位）为右侧浮层（监控 HUD）预留净空：**只平移、不缩放**。
 * 之所以不改 scale：缩放会连带改变网格点距、连线拐角与命中半径的视觉密度，
 * 「让开一点」这种版式诉求不该动到物理图的几何；平移是纯视觉偏置，可逆且无副作用。
 * 偏置量按 `rightInset / 2` 分摊，内容整体左移半个预留量——右边界让出净空的同量，
 * 左边界只吃一半，电池/开关不会被左侧检查器卡压住。
 */
export function fitViewToContent(
  content: Bounds,
  canvas: { w: number; h: number } = { w: WORLD_W, h: WORLD_H },
  padding = 56,
  fill = 0,
  rightInset = 0,
): ViewTransform {
  const contentW = Math.max(1, content.w);
  const contentH = Math.max(1, content.h);
  const raw =
    fill > 0
      ? fill * Math.min(canvas.w / contentW, canvas.h / contentH)
      : Math.min(
          Math.max(1, canvas.w - padding * 2) / contentW,
          Math.max(1, canvas.h - padding * 2) / contentH,
        );
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, raw));
  const cx = content.x + content.w / 2;
  const cy = content.y + content.h / 2;
  return {
    scale,
    tx: canvas.w / 2 - cx * scale - rightInset / 2,
    ty: canvas.h / 2 - cy * scale,
  };
}

/**
 * 浮窗硬避让：为了让 `box`（画布矩形，含右上角监控 HUD）里不留任何电路墨迹，
 * 视图还要再整体左移多少（画布单位）。
 *
 * 与 `fitViewToContent` 的 `rightInset` 是两件事：那里是**固定**的视觉缓冲，
 * 让默认电路「看起来偏向左边」；这里量的是**真实几何**——只推真的被压住的那一段。
 * 之所以按矩形判、而不只看内容右缘：多数预设的内容右缘本来就从浮窗下方掠过
 * （y 与浮窗不重叠，视觉上完全没被挡），一刀切会把整幅图白推几十像素。
 *
 * 推的量宁可保守（`clearance` 之外就收手）：把内容推出画布左缘比留一点贴边更糟，
 * 所以左移量以「最左墨迹退到画布原点」为上限。
 */
export function boxClearanceShift(
  state: BenchState,
  view: ViewTransform,
  box: Bounds,
  clearance = 0,
  routes?: readonly RoutedWire[],
): number {
  const limit = box.x - clearance;
  const half = INK_STROKE / 2;
  let worst = -Infinity;
  let leftmost = Infinity;
  eachInkPoint(state, (p) => {
    // 采样点走的是中心线，描边还有半个线宽铺在外面：判「压没压住」得按笔画算。
    const x = p.x * view.scale + view.tx;
    leftmost = Math.min(leftmost, x - half);
    const y = p.y * view.scale + view.ty;
    if (y < box.y || y > box.y + box.h) return;
    worst = Math.max(worst, x + half);
  }, routes);
  if (!(worst > limit)) return 0;
  return Math.max(0, Math.min(worst - limit, leftmost));
}

/** 元件标签位置：默认在元件上方，竖直元件放右侧。 */
export function labelPoint(el: CircuitComponent): Pt {
  const b = elementBounds(el);
  if (el.rotation % 180 !== 0) return { x: el.x + b.w / 2 + 14, y: el.y - 4 };
  return { x: el.x, y: b.y - 8 };
}

export function round(v: number): number {
  return Math.round(v * 100) / 100;
}
