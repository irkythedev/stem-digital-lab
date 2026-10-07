/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 流式回答区的「吸底」判定。
 *
 * 抽成纯函数是为了能单测边界：一旦把几何判断埋在组件里，就只能靠人眼看滚动了。
 * 流式自动滚动与右下角「↓」恢复按钮共用这一判据，避免两处阈值不一致。
 */

/** 距底阈值：小于该距离视为「贴在底部」，此时新内容到达才自动跟随 */
export const STICK_THRESHOLD = 32;

/** 是否贴近底部 */
export function isNearBottom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  threshold: number = STICK_THRESHOLD,
): boolean {
  return scrollHeight - (scrollTop + clientHeight) <= threshold;
}
