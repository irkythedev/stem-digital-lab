/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * Quiz 判分请求的跨题隔离守卫：请求发出时的题目必须仍是当前题，且请求未被 abort。
 */
export function judgeResultIsCurrent(
  signal: AbortSignal | null | undefined,
  requestQuestion: string,
  currentQuestion: string,
): boolean {
  return !!signal && !signal.aborted && requestQuestion === currentQuestion;
}
