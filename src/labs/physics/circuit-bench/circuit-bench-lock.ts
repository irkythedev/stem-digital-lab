/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 预设锁定（补线 / 排故两种诊断型预设）
 *
 * 「补线」与「排故」预设故意留了缺口或错误接法，学生只能动**该动的那几样**：
 * 电源、干路开关、被测量的支路必须钉住，否则学生一把删掉电源，「补线」就退化成
 * 从零搭电路，诊断性预设也就失去了诊断对象。
 *
 * 锁的边界（刻意画得很窄）：
 * - 锁定的是「删除 / 改接」这类**破坏性**操作，不是元件的端子；
 * - 在锁定元件的端子上**拉出新导线**永远允许（补线预设的全部意义就在于此），
 *   所以 `addWire` 不经过这里；
 * - 被拒绝的操作必须返回**原状态引用**：上层 `commit` 拿到同一个引用就不会
 *   压入历史，撤销栈里不会留下「按了删除但什么都没发生」的空快照。
 */
import type { BenchState } from './circuit-bench-core';
import { removeComponent, removeWire, replugWire, type ReplugResult } from './circuit-bench-state';

/** 预设自带的锁定清单：元件 id / 导线 id。两者都是**稳定 id**（`bat`、`w_3`）。 */
export interface PresetLock {
  components?: readonly string[];
  wires?: readonly string[];
}

export interface LockTarget {
  kind: 'component' | 'wire';
  id: string;
}

export const LOCKED_REASON = 'locked';

/** 把预设里的锁定清单展开成查表结构（每次预设切换只做一次）。 */
export function lockIndex(lock: PresetLock | null | undefined): {
  components: Set<string>;
  wires: Set<string>;
} {
  return {
    components: new Set(lock?.components ?? []),
    wires: new Set(lock?.wires ?? []),
  };
}

export function isLocked(lock: PresetLock | null | undefined, target: LockTarget): boolean {
  const index = lockIndex(lock);
  return target.kind === 'component' ? index.components.has(target.id) : index.wires.has(target.id);
}

/**
 * 删除元件：锁定即原样返回（同一个引用）。
 *
 * 与 `removeComponent` 的差别只有这一道闸；没锁定时行为完全一致，
 * 所以上层可以无脑把原来的调用点换过来。
 */
export function removeComponentIfUnlocked(
  lock: PresetLock | null | undefined,
  state: BenchState,
  id: string,
): BenchState {
  if (isLocked(lock, { kind: 'component', id })) return state;
  return removeComponent(state, id);
}

/** 删除导线：锁定即原样返回（同一个引用）。 */
export function removeWireIfUnlocked(
  lock: PresetLock | null | undefined,
  state: BenchState,
  id: string,
): BenchState {
  if (isLocked(lock, { kind: 'wire', id })) return state;
  return removeWire(state, id);
}

/**
 * 拔插导线端点：只有**导线本身**被锁时才拒绝。
 *
 * 学生把一根没锁的导线改接到锁定元件的端子上是合法的（比如把电流表从并联
 * 改接成串联，那一端就得落在被锁的灯泡柱子上），所以这里不查目标元件的锁。
 */
export function replugIfUnlocked(
  lock: PresetLock | null | undefined,
  state: BenchState,
  wireId: string,
  end: 'from' | 'to',
  target: string,
): ReplugResult {
  if (isLocked(lock, { kind: 'wire', id: wireId })) {
    return { state, changed: false, status: 'none', reason: LOCKED_REASON };
  }
  return replugWire(state, wireId, end, target);
}
