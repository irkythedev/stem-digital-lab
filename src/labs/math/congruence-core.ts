/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 全等判定几何核（纯函数，零 React / DOM 依赖）。
 *
 * 统一坐标约定：局部坐标系里 A 在原点、AB 沿 +x 轴、C 在 y > 0 一侧。
 * 六种条件都从这里的一组「量出来的边角」重新构件三角形：
 * 判定的意义正是——只给这些量，能不能唯一确定形状。
 *
 * 基准三角形取「SSA 的模糊情形」：∠A = 40°、b = CA = 6、a = BC = 4.5。
 * 此时 b·sin A ≈ 3.857 < a < b，同一组 SSA 条件有两个不同解——
 * 第二个解就是学生要亲手找出来的反例（不是老师直接给的结论）。
 */

export type Pt = { x: number; y: number };
export type Tri = { A: Pt; B: Pt; C: Pt };
export type ConditionId = 'sss' | 'sas' | 'asa' | 'aas' | 'hl' | 'ssa';

const D2R = Math.PI / 180;

/** 两点距离 */
export function dist(p: Pt, q: Pt): number {
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** ∠(p, vertex, q) 的角度值（0~180，度） */
export function angleAt(p: Pt, vertex: Pt, q: Pt): number {
  const v1x = p.x - vertex.x;
  const v1y = p.y - vertex.y;
  const v2x = q.x - vertex.x;
  const v2y = q.y - vertex.y;
  const n1 = Math.hypot(v1x, v1y);
  const n2 = Math.hypot(v2x, v2y);
  if (n1 < 1e-12 || n2 < 1e-12) return NaN;
  const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (n1 * n2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export interface Measures {
  /** a = BC（∠A 的对边） */
  a: number;
  /** b = CA（∠B 的对边） */
  b: number;
  /** c = AB（∠C 的对边） */
  c: number;
  A: number;
  B: number;
  C: number;
}

/** 量出三边三角（角度单位为度） */
export function measure(t: Tri): Measures {
  return {
    a: dist(t.B, t.C),
    b: dist(t.A, t.C),
    c: dist(t.A, t.B),
    A: angleAt(t.B, t.A, t.C),
    B: angleAt(t.A, t.B, t.C),
    C: angleAt(t.A, t.C, t.B),
  };
}

/** SSS：三边定形（余弦定理求 C 的横坐标，再求高） */
export function sssTri(a: number, b: number, c: number): Tri | null {
  if (c <= 0) return null;
  const x = (b * b + c * c - a * a) / (2 * c);
  const y2 = b * b - x * x;
  if (y2 < -1e-9) return null; // 三边不满足三角形不等式
  return { A: { x: 0, y: 0 }, B: { x: c, y: 0 }, C: { x, y: Math.sqrt(Math.max(0, y2)) } };
}

/** SAS：两边 + 夹角 */
export function sasTri(b: number, angleADeg: number, c: number): Tri | null {
  if (b <= 0 || c <= 0) return null;
  const al = angleADeg * D2R;
  return { A: { x: 0, y: 0 }, B: { x: c, y: 0 }, C: { x: b * Math.cos(al), y: b * Math.sin(al) } };
}

/** ASA：两角 + 夹边（正弦定理求 AC 长） */
export function asaTri(alphaDeg: number, betaDeg: number, c: number): Tri | null {
  const al = alphaDeg * D2R;
  const be = betaDeg * D2R;
  const den = Math.sin(al + be);
  if (Math.abs(den) < 1e-12 || c <= 0) return null;
  const t = (c * Math.sin(be)) / den; // AC 的长度
  return { A: { x: 0, y: 0 }, B: { x: c, y: 0 }, C: { x: t * Math.cos(al), y: t * Math.sin(al) } };
}

/** AAS：两角 + 一边（先补第三角，再用正弦定理，最后退回 SAS 构造） */
export function aasTri(alphaDeg: number, gammaDeg: number, b: number): Tri | null {
  const betaDeg = 180 - alphaDeg - gammaDeg;
  if (betaDeg <= 1e-9 || b <= 0) return null;
  const c = (b * Math.sin(gammaDeg * D2R)) / Math.sin(betaDeg * D2R);
  return sasTri(b, alphaDeg, c);
}

/** HL：斜边 + 一条直角边（直角在 B） */
export function hlTri(hyp: number, leg: number): Tri | null {
  if (leg <= 0 || hyp <= leg) return null;
  const c = Math.sqrt(hyp * hyp - leg * leg);
  return { A: { x: 0, y: 0 }, B: { x: c, y: 0 }, C: { x: c, y: leg } };
}

/**
 * SSA：两边 + 其中一边的对角（∠A、a = BC、b = CA）。
 * **可能有两个解**——这正是 SSA 不能作为判定依据的原因：
 * 判别式 a² − (b·sin A)² > 0 时，B 可以在垂足左右两侧各取一个位置。
 * branch = 0 取 |AB| 较大的解，branch = 1 取另一个（反例）。
 */
export function ssaTri(b: number, angleADeg: number, a: number, branch: 0 | 1 = 0): Tri | null {
  const al = angleADeg * D2R;
  const C = { x: b * Math.cos(al), y: b * Math.sin(al) };
  const disc = a * a - C.y * C.y;
  if (disc < -1e-9) return null; // 无解：a 比高还短
  const dx = Math.sqrt(Math.max(0, disc));
  const bx = branch === 0 ? C.x + dx : C.x - dx;
  return { A: { x: 0, y: 0 }, B: { x: bx, y: 0 }, C };
}

/** 基准三角形：SSA 模糊情形的一个解（∠A = 40°、b = 6、a = 4.5） */
export const REF_SSA = { angleA: 40, b: 6, a: 4.5 } as const;

export function refTriangle(): Tri {
  const t = ssaTri(REF_SSA.b, REF_SSA.angleA, REF_SSA.a, 0);
  if (!t) throw new Error('基准三角形构造失败'); // 常量参数，永不触发
  return t;
}

/** 与基准满足同一组 SSA 条件、但形状不同的另一个三角形（反例） */
export function altSsaTriangle(): Tri | null {
  return ssaTri(REF_SSA.b, REF_SSA.angleA, REF_SSA.a, 1);
}

/** 直角三角形（直角在 B，用来演示 HL）：三边 3-4-5 */
export function rightTriangle(): Tri {
  return { A: { x: 0, y: 0 }, B: { x: 4, y: 0 }, C: { x: 4, y: 3 } };
}

/** HL 只适用于直角三角形，所以这一组条件的基准换成直角三角形 */
export function referenceFor(mode: ConditionId): Tri {
  return mode === 'hl' ? rightTriangle() : refTriangle();
}

/** 按某组条件、用基准三角形量出来的量重构一个三角形 */
export function buildByCondition(mode: ConditionId, ref: Tri, branch: 0 | 1 = 0): Tri | null {
  const m = measure(ref);
  switch (mode) {
    case 'sss':
      return sssTri(m.a, m.b, m.c);
    case 'sas':
      return sasTri(m.b, m.A, m.c);
    case 'asa':
      return asaTri(m.A, m.B, m.c);
    case 'aas':
      return aasTri(m.A, m.C, m.b);
    case 'hl':
      return hlTri(m.b, m.a);
    case 'ssa':
      return ssaTri(m.b, m.A, m.a, branch);
    default:
      return null;
  }
}

/** 三边排序后逐项比较（全等的等价判据；容差 1e-6 吸收浮点误差） */
export function congruentSides(t1: Tri, t2: Tri, tol = 1e-6): boolean {
  const s1 = [measure(t1).a, measure(t1).b, measure(t1).c].sort((x, y) => x - y);
  const s2 = [measure(t2).a, measure(t2).b, measure(t2).c].sort((x, y) => x - y);
  return s1.every((v, i) => Math.abs(v - s2[i]) <= tol * Math.max(1, Math.abs(v)));
}

/** 逐顶点配对后的最大偏差（判断「叠合后还差多少」） */
export function vertexGaps(t1: Tri, t2: Tri): { A: number; B: number; C: number; max: number; at: 'A' | 'B' | 'C' } {
  const g = { A: dist(t1.A, t2.A), B: dist(t1.B, t2.B), C: dist(t1.C, t2.C), max: 0, at: 'A' as 'A' | 'B' | 'C' };
  for (const k of ['A', 'B', 'C'] as const) {
    if (g[k] > g.max) {
      g.max = g[k];
      g.at = k;
    }
  }
  return g;
}
