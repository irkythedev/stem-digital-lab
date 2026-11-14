/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 二次函数计算核（纯函数，零 React / DOM / WASM 依赖）。
 *
 * 原样抽离自 src/labs/math/Quadratic.tsx（三幕式探究的纯计算部分），行为保持零变化：
 * 采样区间 x ∈ [-4, 4.0001]、步长 0.05、单段返回 [x, y] 点列。
 *
 * 顶点 h = -b/(2a)、k = a·h²+b·h+c 属「标注/显示」用途（直接格式化为 SVG label），
 * 有意留在 Quadratic.tsx 组件内，不搬入本文件。
 *
 * 供 Quadratic.tsx 与 smoke 测试共用；后续 C++ → WASM 阶段在其上做同签名替换，
 * 加载失败静默回退本模块，不改变任何调用点语义。
 */

/** 二次函数单点求值 y = ax² + bx + c（供测试与日后 facade 复用）。 */
export function quadraticY(a: number, b: number, c: number, x: number): number {
  return a * x * x + b * x + c;
}

/** 采样区间与步长（导出供守卫断言末点精确落在 +4，而非 3.9999999999999…） */
export const SAMPLE_MIN = -4;
export const SAMPLE_MAX = 4;
export const SAMPLE_STEP = 0.05;

/**
 * 采样一条二次函数曲线：x ∈ [-4, 4]，步长 0.05。
 * **索引乘法**取点（x = MIN + k·STEP），不做浮点逐点累加——
 * 累加会让末点漂移成 3.9999999999999396 并在 160 个点里留下浮点尾巴，
 * 相邻点间距不再严格相等，坐标轴刻度与曲线交点会出现亚像素抖动。
 */
export function sampleQuadratic(
  a: number,
  b: number,
  c: number,
  xMin: number = SAMPLE_MIN,
  xMax: number = SAMPLE_MAX,
): [number, number][] {
  const pts: [number, number][] = [];
  const span = Math.max(SAMPLE_STEP, xMax - xMin);
  const n = Math.round(span / SAMPLE_STEP);
  const step = span / Math.max(1, n);
  for (let k = 0; k <= n; k++) {
    const x = xMin + k * step;
    pts.push([x, quadraticY(a, b, c, x)]);
  }
  return pts;
}

/* ---------- 判别式与实根（Δ = b²−4ac） ---------- */

/** 判别式 Δ = b² − 4ac。 */
export function discriminant(a: number, b: number, c: number): number {
  return b * b - 4 * a * c;
}

/**
 * 实根。**Δ < 0 时返回空数组**（而不是 Math.sqrt 负数 → NaN 污染坐标渲染）；
 * a = 0 时退化为一次方程：bx + c = 0 → 单根（b = 0 时无解，返回空数组）。
 * 返回的根按升序排列，便于直接标注在 x 轴上。
 */
export function quadraticRoots(a: number, b: number, c: number): number[] {
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) return [];
    return [(-c / b) || 0];
  }
  const rawD = discriminant(a, b, c);
  // 相对浮点容差：顶点式 k=0 或一般式接近切点时，b²−4ac 会留下 −1e-13 量级误差，
  // 若不归零会被误判为「无实根」，丢掉唯一切点。容差随系数尺度缩放。
  const eps = 1e-9 * Math.max(1, b * b, Math.abs(4 * a * c));
  const d = Math.abs(rawD) <= eps ? 0 : rawD;
  if (d < 0) return [];
  if (d === 0) return [(-b / (2 * a)) || 0]; // -0 → 0：否则坐标标注会渲染成「-0」
  const sq = Math.sqrt(d);
  const r1 = (-b - sq) / (2 * a);
  const r2 = (-b + sq) / (2 * a);
  return r1 <= r2 ? [r1, r2] : [r2, r1];
}

/**
 * 抛物线 y = ax² + bx + c 上关于对称轴 x = h 对称的一对点。
 * 传入 t（通常取 h + d），返回 (t, y) 与 (2h − t, y)，两点同高，
 * 连线被对称轴垂直平分——这是「轴对称」最直接的几何证据。
 * a = 0 时不是抛物线，返回 null（由调用方隐藏对称点）。
 */
export function symPair(
  a: number,
  b: number,
  c: number,
  t: number,
): { x1: number; x2: number; y: number; axisX: number } | null {
  if (Math.abs(a) < 1e-12) return null;
  const axisX = -b / (2 * a);
  const y = a * t * t + b * t + c;
  return { x1: t, x2: 2 * axisX - t, y, axisX };
}
