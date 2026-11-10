/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 尺规作图数学核（人教版 七上–八上「基本作图」）
 *
 * 三个原则，全部落在这一层：
 *   1) 只用两条规则构造：直尺 = 过两点作直线；圆规 = 以某点为圆心、过另一点作圆。
 *      **没有自由落点、没有刻度测量**，所以「量一半」「目测」这些作弊路径在结构上不存在。
 *   2) 交点自动生成：每加一个图形，与已有图形的交点立刻出现，这才是尺规作图真正的引擎。
 *   3) 撤销/重来用「重放」实现：只存构造序列，画面永远由 buildScene 从头算起，
 *      不会出现回退后残留幽灵对象的问题。
 *
 * 判定也不看步骤：每关给一个几何命题（如「存在一条过 AB 中点且垂直于 AB 的直线」），
 * 满足即过关。步数只作参考显示。
 *
 * 全部纯函数，可被测试直接调用。
 */

export interface Pt {
  x: number;
  y: number;
}

export interface ScenePoint extends Pt {
  id: string;
  kind: 'given' | 'inter';
}

export interface SceneLine {
  id: string;
  a: string;
  b: string;
}

export interface SceneCircle {
  id: string;
  c: string;
  r: number;
}

export type Cons =
  | { kind: 'line'; a: string; b: string }
  | { kind: 'circle'; c: string; p: string };

export interface Scene {
  points: ScenePoint[];
  lines: SceneLine[];
  circles: SceneCircle[];
}

/** 点去重容差（数学单位；画布 1 单位 = 34px，0.02 单位 ≈ 0.7px） */
export const EPS_PT = 0.02;
/** 判定用的位置容差（数学单位；0.05 ≈ 1.7px） */
export const EPS_POS = 0.05;
/** 判定用的角度容差：|sin| 小于它即视为垂直/平行，0.03 ≈ 1.7° */
export const EPS_ANG = 0.03;

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v: Pt) => Math.hypot(v.x, v.y);
export const dist = (a: Pt, b: Pt) => len(sub(a, b));

export function midOf(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** 单位向量；零向量返回 null */
export function unit(v: Pt): Pt | null {
  const l = len(v);
  if (l < 1e-12) return null;
  return { x: v.x / l, y: v.y / l };
}

/** 点到直线（无限延长）的距离 */
export function distToLine(p: Pt, a: Pt, b: Pt): number {
  const d = sub(b, a);
  const l = len(d);
  if (l < 1e-12) return dist(p, a);
  const cross = (p.x - a.x) * d.y - (p.y - a.y) * d.x;
  return Math.abs(cross) / l;
}

/** 点在直线（无限长）上的垂足；退化线返回端点 a */
export function projectOnLine(p: Pt, a: Pt, b: Pt): Pt {
  const d = sub(b, a);
  const l2 = d.x * d.x + d.y * d.y;
  if (l2 < 1e-18) return a;
  const t = ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / l2;
  return { x: a.x + t * d.x, y: a.y + t * d.y };
}

/** 两方向是否平行（|sinθ| < EPS_ANG） */
export function isParallel(d1: Pt, d2: Pt): boolean {
  const u1 = unit(d1);
  const u2 = unit(d2);
  if (!u1 || !u2) return false;
  return Math.abs(u1.x * u2.y - u1.y * u2.x) < EPS_ANG;
}

/** 两方向是否垂直（|cosθ| < EPS_ANG） */
export function isPerpendicular(d1: Pt, d2: Pt): boolean {
  const u1 = unit(d1);
  const u2 = unit(d2);
  if (!u1 || !u2) return false;
  return Math.abs(u1.x * u2.x + u1.y * u2.y) < EPS_ANG;
}

/* ────────────────────────── 求交 ────────────────────────── */

/** 直线 ∩ 直线；平行/重合返回空数组 */
export function lineLine(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt[] {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < 1e-10) return [];
  const a1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.x * p4.y - p3.y * p4.x;
  const x = (a1 * (p3.x - p4.x) - (p1.x - p2.x) * a2) / d;
  const y = (a1 * (p3.y - p4.y) - (p1.y - p2.y) * a2) / d;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
  return [{ x, y }];
}

/** 直线 ∩ 圆：0 / 1 / 2 个交点（相切返回 1 个） */
export function lineCircle(p1: Pt, p2: Pt, c: Pt, r: number): Pt[] {
  if (!(r > 0)) return [];
  const d = sub(p2, p1);
  const a = d.x * d.x + d.y * d.y;
  if (a < 1e-12) return [];
  const b = 2 * (d.x * (p1.x - c.x) + d.y * (p1.y - c.y));
  const cc = (p1.x - c.x) ** 2 + (p1.y - c.y) ** 2 - r * r;
  const disc = b * b - 4 * a * cc;
  if (disc < -1e-9) return [];
  if (Math.abs(disc) <= 1e-9) {
    const t = -b / (2 * a);
    return [{ x: p1.x + t * d.x, y: p1.y + t * d.y }];
  }
  const sq = Math.sqrt(disc);
  return [(-b - sq) / (2 * a), (-b + sq) / (2 * a)].map((t) => ({ x: p1.x + t * d.x, y: p1.y + t * d.y }));
}

/** 圆 ∩ 圆：同心或重合时返回空数组（交点有无穷多个，不可选） */
export function circleCircle(c1: Pt, r1: number, c2: Pt, r2: number): Pt[] {
  const d = dist(c1, c2);
  if (d < 1e-10) return [];
  if (d > r1 + r2 + 1e-9) return [];
  if (d < Math.abs(r1 - r2) - 1e-9) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  let h2 = r1 * r1 - a * a;
  if (h2 < 0) h2 = 0;
  const h = Math.sqrt(h2);
  const ux = (c2.x - c1.x) / d;
  const uy = (c2.y - c1.y) / d;
  const mx = c1.x + a * ux;
  const my = c1.y + a * uy;
  if (h < 1e-10) return [{ x: mx, y: my }];
  return [
    { x: mx - h * uy, y: my + h * ux },
    { x: mx + h * uy, y: my - h * ux },
  ];
}

/* ────────────────────────── 重放式场景 ────────────────────────── */

function findPt(points: ScenePoint[], id: string): ScenePoint | undefined {
  return points.find((p) => p.id === id);
}

/**
 * 由已知点 + 构造序列重放出整个场景。
 * 交点 id 形如 `x{构造序号}_{序号}`：同一前缀必定重放出相同 id，所以 UI 里的点引用始终有效。
 */
export function buildScene(given: { id: string; x: number; y: number }[], cons: Cons[]): Scene {
  const points: ScenePoint[] = given.map((g) => ({ id: g.id, x: g.x, y: g.y, kind: 'given' }));
  const lines: SceneLine[] = [];
  const circles: SceneCircle[] = [];

  const addPt = (p: Pt, idx: number, ord: number) => {
    for (const q of points) {
      if (Math.abs(q.x - p.x) < EPS_PT && Math.abs(q.y - p.y) < EPS_PT) return;
    }
    points.push({ id: `x${idx}_${ord}`, x: p.x, y: p.y, kind: 'inter' });
  };

  cons.forEach((con, idx) => {
    if (con.kind === 'line') {
      const a = findPt(points, con.a);
      const b = findPt(points, con.b);
      if (!a || !b || dist(a, b) < EPS_PT) return;
      lines.push({ id: `l${idx}`, a: con.a, b: con.b });
      let ord = 0;
      for (const other of lines) {
        if (other.id === `l${idx}`) continue;
        const oa = findPt(points, other.a);
        const ob = findPt(points, other.b);
        if (!oa || !ob) continue;
        for (const p of lineLine(a, b, oa, ob)) addPt(p, idx, ord++);
      }
      for (const cir of circles) {
        const cc = findPt(points, cir.c);
        if (!cc) continue;
        for (const p of lineCircle(a, b, cc, cir.r)) addPt(p, idx, ord++);
      }
      return;
    }
    const c = findPt(points, con.c);
    const through = findPt(points, con.p);
    if (!c || !through) return;
    const r = dist(c, through);
    if (r < EPS_PT) return;
    circles.push({ id: `c${idx}`, c: con.c, r });
    let ord = 0;
    for (const ln of lines) {
      const la = findPt(points, ln.a);
      const lb = findPt(points, ln.b);
      if (!la || !lb) continue;
      for (const p of lineCircle(la, lb, c, r)) addPt(p, idx, ord++);
    }
    for (const other of circles) {
      if (other.id === `c${idx}`) continue;
      const oc = findPt(points, other.c);
      if (!oc) continue;
      for (const p of circleCircle(c, r, oc, other.r)) addPt(p, idx, ord++);
    }
  });

  return { points, lines, circles };
}

/** 场景里的所有直线（双端点坐标） */
export function lineCoords(s: Scene): { id: string; a: Pt; b: Pt }[] {
  const out: { id: string; a: Pt; b: Pt }[] = [];
  for (const ln of s.lines) {
    const a = s.points.find((p) => p.id === ln.a);
    const b = s.points.find((p) => p.id === ln.b);
    if (a && b) out.push({ id: ln.id, a, b });
  }
  return out;
}

/* ────────────────────────── 四关任务与判定 ────────────────────────── */

export interface GivenPoint {
  id: string;
  label: string;
  x: number;
  y: number;
}

/**
 * 过关见证：告诉 UI「是哪条线/哪个点」满足了命题，供高亮与几何标记使用。
 * - line.point：该线上的关键点（中点 / 角的顶点 / 垂足）
 * - point：目标点本身（中点关）
 */
export type Witness =
  | { kind: 'line'; a: Pt; b: Pt; point?: Pt }
  | { kind: 'point'; p: Pt };

export interface TaskDef {
  id: string;
  givens: GivenPoint[];
  /** 已知图形要画出来的线段（引用 givens 的 id） */
  segs: [string, string][];
  /** 几何命题的见证；null 表示尚未达成 */
  witness: (s: Scene) => Witness | null;
}

const G = {
  A: { id: 'A', label: 'A', x: -1.8, y: -1.1 },
  B: { id: 'B', label: 'B', x: 2.0, y: 1.3 },
  // 角平分线关的已知三点：∠AOB = 75°，两臂不等长（避免等边三角形造成的巧合误导）
  O: { id: 'O', label: 'O', x: -2.0, y: -1.5 },
  A2: { id: 'A', label: 'A', x: 1.2, y: -1.5 },
  B2: { id: 'B', label: 'B', x: -0.965, y: 2.364 },
  // 过点作垂线关的已知直线 AB 与线外一点 P
  A3: { id: 'A', label: 'A', x: -2.4, y: -1.2 },
  B3: { id: 'B', label: 'B', x: 1.6, y: 0.4 },
  P: { id: 'P', label: 'P', x: -0.6, y: 1.4 },
};

/** 目标：作线段 AB 的垂直平分线 */
export const TASK_PERP_BISECTOR: TaskDef = {
  id: 'perp-bisector',
  givens: [G.A, G.B],
  segs: [['A', 'B']],
  witness: (s) => {
    const m = midOf(G.A, G.B);
    const dir = sub(G.B, G.A);
    const best = lineCoords(s)
      .filter((ln) => distToLine(m, ln.a, ln.b) < EPS_POS && isPerpendicular(sub(ln.b, ln.a), dir))
      .sort((x, y) => distToLine(m, x.a, x.b) - distToLine(m, y.a, y.b))[0];
    return best ? { kind: 'line', a: best.a, b: best.b, point: m } : null;
  },
};

/** 目标：作出线段 AB 的中点 */
export const TASK_MIDPOINT: TaskDef = {
  id: 'midpoint',
  givens: [G.A, G.B],
  segs: [['A', 'B']],
  witness: (s) => {
    const m = midOf(G.A, G.B);
    const p = s.points.find((q) => q.kind === 'inter' && dist(q, m) < EPS_POS);
    return p ? { kind: 'point', p } : null;
  },
};

/** 目标：作 ∠AOB 的平分线 */
export const TASK_ANGLE_BISECTOR: TaskDef = {
  id: 'angle-bisector',
  givens: [G.O, G.A2, G.B2],
  segs: [
    ['O', 'A'],
    ['O', 'B'],
  ],
  witness: (s) => {
    const u1 = unit(sub(G.A2, G.O));
    const u2 = unit(sub(G.B2, G.O));
    if (!u1 || !u2) return null;
    const bis = unit({ x: u1.x + u2.x, y: u1.y + u2.y });
    if (!bis) return null;
    const best = lineCoords(s)
      .filter((ln) => distToLine(G.O, ln.a, ln.b) < EPS_POS && isParallel(sub(ln.b, ln.a), bis))
      .sort((x, y) => distToLine(G.O, x.a, x.b) - distToLine(G.O, y.a, y.b))[0];
    return best ? { kind: 'line', a: best.a, b: best.b, point: G.O } : null;
  },
};

/** 目标：过直线 AB 外一点 P 作 AB 的垂线 */
export const TASK_PERP_THROUGH: TaskDef = {
  id: 'perp-through',
  givens: [G.A3, G.B3, G.P],
  segs: [['A', 'B']],
  witness: (s) => {
    const dir = sub(G.B3, G.A3);
    const best = lineCoords(s)
      .filter((ln) => distToLine(G.P, ln.a, ln.b) < EPS_POS && isPerpendicular(sub(ln.b, ln.a), dir))
      .sort((x, y) => distToLine(G.P, x.a, x.b) - distToLine(G.P, y.a, y.b))[0];
    // 垂足是 P 在已知直线 AB 上的投影，不是 P 在 witness 线上的投影
    // （P 本来就在 witness 线上，后者会退化成 P 自己）。
    return best
      ? { kind: 'line', a: best.a, b: best.b, point: projectOnLine(G.P, G.A3, G.B3) }
      : null;
  },
};

export const TASKS: TaskDef[] = [TASK_PERP_BISECTOR, TASK_MIDPOINT, TASK_ANGLE_BISECTOR, TASK_PERP_THROUGH];

/** 判定某次构造是否合法（同点、重复图形都拦掉，返回拒绝原因） */
export interface ConsVerdict {
  ok: boolean;
  reason?: 'same' | 'dup';
}

export function validateCons(scene: Scene, con: Cons): ConsVerdict {
  const get = (id: string) => scene.points.find((p) => p.id === id);
  if (con.kind === 'line') {
    const a = get(con.a);
    const b = get(con.b);
    if (!a || !b) return { ok: false, reason: 'same' };
    if (dist(a, b) < EPS_PT) return { ok: false, reason: 'same' };
    const dup = scene.lines.some((ln) => {
      const la = get(ln.a);
      const lb = get(ln.b);
      if (!la || !lb) return false;
      const d1 = sub(b, a);
      const d2 = sub(lb, la);
      return (
        isParallel(d1, d2) &&
        distToLine(a, la, lb) < EPS_PT &&
        distToLine(b, la, lb) < EPS_PT
      );
    });
    return dup ? { ok: false, reason: 'dup' } : { ok: true };
  }
  const c = get(con.c);
  const p = get(con.p);
  if (!c || !p) return { ok: false, reason: 'same' };
  const r = dist(c, p);
  if (r < EPS_PT) return { ok: false, reason: 'same' };
  const dup = scene.circles.some((cir) => {
    const oc = get(cir.c);
    if (!oc) return false;
    return dist(oc, c) < EPS_PT && Math.abs(cir.r - r) < EPS_PT;
  });
  return dup ? { ok: false, reason: 'dup' } : { ok: true };
}

/**
 * 预览一次构造会新产生哪些交点（不修改场景；已存在的点与重复交点不返回）。
 * 与 buildScene 的求交规则保持一致：线×线、线×圆、圆×圆。
 */
export function previewIntersections(scene: Scene, con: Cons): Pt[] {
  const get = (id: string) => scene.points.find((p) => p.id === id);
  const out: Pt[] = [];
  if (con.kind === 'line') {
    const a = get(con.a);
    const b = get(con.b);
    if (!a || !b) return out;
    for (const ln of scene.lines) {
      const la = get(ln.a);
      const lb = get(ln.b);
      if (la && lb) out.push(...lineLine(a, b, la, lb));
    }
    for (const cir of scene.circles) {
      const cc = get(cir.c);
      if (cc) out.push(...lineCircle(a, b, cc, cir.r));
    }
  } else {
    const c = get(con.c);
    const p = get(con.p);
    if (!c || !p) return out;
    const r = dist(c, p);
    for (const ln of scene.lines) {
      const la = get(ln.a);
      const lb = get(ln.b);
      if (la && lb) out.push(...lineCircle(la, lb, c, r));
    }
    for (const other of scene.circles) {
      const oc = get(other.c);
      if (oc) out.push(...circleCircle(c, r, oc, other.r));
    }
  }
  const uniq: Pt[] = [];
  for (const p of out) if (!uniq.some((q) => dist(p, q) < EPS_PT)) uniq.push(p);
  return uniq.filter((p) => !scene.points.some((q) => dist(p, q) < EPS_PT));
}

/** 当前场景是否已达成目标 */
export function isSolved(task: TaskDef, s: Scene): boolean {
  return task.witness(s) !== null;
}
