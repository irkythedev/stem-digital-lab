/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 浮点数近似断言。
 *
 * 为什么需要它：13 个测试文件手写 `Math.abs(a - b) < 1e-9`，失败信息通常只有一句
 * `expected true`，看不出实际值差多少；`circuit-bench` 与 `stem-core-ext` 还各有一个
 * 语义不同、名字不同（`assertRelClose` / `close`）的私有版本。
 *
 * 两个函数的区别：
 *   - `assertClose`   绝对误差，适合「量级已知且接近 0」的场合（坐标、角度）；
 *   - `assertRelClose` 相对误差（按 max(1, |a|, |b|) 缩放），适合「量级跨度大」的
 *     场合（电流 1e-5 A 到 1e3 A、功率、电压）。
 *
 * NaN 与 Infinity 会让差值变成 NaN，比较结果为 false，因此两者都会**失败**而不是
 * 静默通过——这正是数值守卫想要的。
 */
import assert from 'node:assert';

/** 绝对误差断言：`|actual - expected| <= tol`。 */
export function assertClose(
  actual: number,
  expected: number,
  message: string,
  tol = 1e-9,
): void {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= tol,
    `${message}：期望 ${expected}，实际 ${actual}（绝对误差 ${diff} > ${tol}）`,
  );
}

/** 相对误差断言：`|actual - expected| <= tol * max(1, |actual|, |expected|)`。 */
export function assertRelClose(
  actual: number,
  expected: number,
  message: string,
  tol = 1e-5,
): void {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= tol * scale,
    `${message}：期望 ${expected}，实际 ${actual}（相对误差 ${diff / scale} > ${tol}）`,
  );
}
