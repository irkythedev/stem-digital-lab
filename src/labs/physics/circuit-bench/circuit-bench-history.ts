/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 撤销 / 重做历史
 *
 * 只保存 BenchState 不可变快照，不关心 React。
 * - commit：用户完成一次离散编辑（加删元件、接线、开关、参数）
 * - mark + replace：连续手势（拖动元件）只在起点记一次，后续帧覆盖 present
 * - replace：热学仿真推进，不进历史
 */

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

/** 最多保留的快照数，防止长时间拖动累积内存。 */
export const HISTORY_LIMIT = 80;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** 在连续手势开始前打一个可回退点，但当前帧尚未改变。 */
export function mark<T>(h: History<T>): History<T> {
  return {
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: h.present,
    future: [],
  };
}

/** 提交一次离散编辑；同一引用视为无变化。 */
export function commit<T>(h: History<T>, next: T): History<T> {
  if (Object.is(next, h.present)) return h;
  return {
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

/** 覆盖当前快照但不产生历史（热学仿真 / 拖动中的帧）。 */
export function replace<T>(h: History<T>, next: T): History<T> {
  if (Object.is(next, h.present)) return h;
  return { ...h, present: next };
}

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  const present = h.past[h.past.length - 1];
  return {
    past: h.past.slice(0, -1),
    present,
    future: [h.present, ...h.future].slice(0, HISTORY_LIMIT),
  };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  const [present, ...future] = h.future;
  return {
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    present,
    future,
  };
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0;
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0;
}
