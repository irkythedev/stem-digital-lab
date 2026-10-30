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

/**
 * 一次连续手势收尾：丢掉 `mark` 压下的那个「最后没有任何变化」的快照。
 *
 * `mark` 在手势起点无条件压栈（拖动中途才反悔不了，得先有个可回退点），
 * 但「按下去、没拖动就松手」的手势不会产生新状态——那条快照与 present 是
 * 同一个引用，留着会让下一次 Ctrl+Z 看起来毫无反应。手势结束时若栈顶与
 * present 同引用，就把它弹掉。
 *
 * 有真实变化时栈顶是手势开始前的状态、present 已经不同，这里不动，所以
 * 一次拖动仍然只对应一次撤销。
 */
export function settle<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  if (!Object.is(h.past[h.past.length - 1], h.present)) return h;
  return { ...h, past: h.past.slice(0, -1) };
}

/**
 * 收回刚刚提交的那一步，且**不留重做项**。
 *
 * 只给「双击开关」用：双击的第一下也是一次完整的单击，而单击开关就是拨动，
 * 所以打开参数面板之前必须把那一次拨动撤回去，否则学生想看参数却先把电路
 * 断了一次。这里不能用 `undo`——它会把拨反后的状态塞进 `future`，学生接着
 * 点「重做」就会莫名其妙再把开关拨回去。撤销栈也要一起还原：双击不是编辑，
 * 不能在栈里留一条「拨了又拨回来」的空记录。
 *
 * 只在栈顶确实对应那次拨动时调用（由画布的第二击判定保证）。
 */
export function rollbackLast<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [],
  };
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
