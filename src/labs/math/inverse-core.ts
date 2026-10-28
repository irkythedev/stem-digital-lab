/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 反比例函数计算核（纯函数，零 React / DOM / WASM 依赖）。
 *
 * 从 `math/Inverse.tsx` 抽离出「y = k/x 是什么」这条式子与两支采样循环，与
 * quadratic-core / ohm-core / lens-core 同构：式子原先只活在组件里，C++ 侧无从对拍。
 * 抽成叶子模块（本文件不 import 任何东西）后成为单一事实源，三条腿都指向它：
 *   - TS 回退腿：本文件；
 *   - WASM 腿：`cpp/math_fn.hpp` 的 `inverse_y`，经 `physics/stem-engine.ts` 门面；
 *   - g++ 真值腿：`cpp/stem_cli.cpp` 编出的原生程序。
 * 三方对拍见 `src/stem-core-ext.test.ts`。
 *
 * 采样口径（原样搬离，未做任何化简）：x ∈ [-4, −0.15] ∪ [0.15, 4]，步长 0.05，
 * 分左右两支返回。**索引乘法取点**，不做浮点逐点累加——累加会让末点漂移成
 * 3.9999… 并对不齐坐标刻度。跳过 x = 0 邻域是反比例函数的定义域要求（x = 0 处无定义），
 * 与 `inverseY` 的 NaN 哨兵各管一段：采样根本取不到 0，哨兵只服务于「越界输入不得
 * 给出有限值」。
 */

/** 采样区间（左右两支各自的范围） */
export const SAMPLE_MIN = -4;
export const SAMPLE_MAX = 4;
/** 越过 x = 0 的空档：|x| < INVERSE_GAP 不采样（定义域缺口） */
export const INVERSE_GAP = 0.15;
export const SAMPLE_STEP = 0.05;

/**
 * 反比例函数单点求值 y = k / x。
 * x = 0（定义域外）返回 **NaN**，不返回 ±Infinity：Infinity 会被绘图层当成
 * 「一个很大的数」画出去，而反比例函数在 x = 0 处没有值可画。
 */
export function inverseY(k: number, x: number): number {
  if (x === 0) return NaN;
  return k / x;
}

/**
 * 采样反比例函数的两支：`[neg, pos]`。
 * - `neg`：左支 x 从 −4 升到 −0.15；
 * - `pos`：右支 x 从 0.15 升到 4。
 * k = 0 时无定义（不是函数）→ 返回两个空段，不画任何曲线。
 */
export function sampleInverse(k: number): [number, number][][] {
  if (k === 0) return [[], []];
  const neg: [number, number][] = [];
  const pos: [number, number][] = [];
  const n = Math.round((SAMPLE_MAX - INVERSE_GAP) / SAMPLE_STEP);
  for (let i = 0; i <= n; i++) {
    const x = INVERSE_GAP + i * SAMPLE_STEP;
    // 左支点序与旧实现一致（同为升序的 −4 → −0.15）
    neg.push([SAMPLE_MIN + i * SAMPLE_STEP, inverseY(k, SAMPLE_MIN + i * SAMPLE_STEP)]);
    pos.push([x, inverseY(k, x)]);
  }
  return [neg, pos];
}
