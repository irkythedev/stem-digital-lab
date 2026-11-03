/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 故障元件映射（把告警落到画布符号上）
 *
 * 求解器的告警本来就是「带元件 id」的（`SolveWarning.elementIds`），但短路类告警
 * 只写电源：电源附近那根把电流表并联进回路的导线、以及串在短路支路上的开关，
 * 在画布上没有任何标记，学生只能从监控看板的文字里猜「红框该画在哪」。
 *
 * 这里做两件事，都是纯函数（可被单测直接跑）：
 * 1) 合并所有告警的 `elementIds` —— 超量程、熔断、灯泡烧毁、表笔反接都有精确指向；
 * 2) 短路时按**支路电流阈值**（`SHORT_BRANCH_AMPS`）把「真的在过短路电流」的元件
 *    补进故障集合，再沿一根导线做一跳扩展，让串在短路回路上的闭合开关也跟着亮。
 *
 * 只做一跳是因为「短路支路」在图上是局部的：两跳会把整条主干都染红，
 * 而真正的判据是这条支路上有没有那股异常电流。
 */
import type { BenchState, SolveResult } from './circuit-bench-core';

/**
 * 支路电流超过它就算「过短路电流」。
 *
 * 预设里的电源是 3–6 V，正常支路都远小于 5 A（灯泡 0.3 A、电热丝 0.75 A）；
 * 而把电流表并联到灯泡两端时，回路电阻只剩 0.001 Ω 量级，电流是千安级。
 * 5 A 这个阈值既不会误伤任何正常预设，也留出了「量程 3 A 的表已经打到底」的余量。
 */
export const SHORT_BRANCH_AMPS = 5;

/**
 * 会在画布上打红框的告警码（白名单，而不是「除了开路都算」）。
 *
 * 关键是把 `open-circuit` / `no-source` / `floating-node` 排除在外：断开的开关、
 * 还没接完的回路在自由实验台里是**正常中间态**，把电源标红会把「电路还没搭完」
 * 说成「电源坏了」。反过来，`wrong-connection`（电表串/并联接法错）虽然不冒烟，
 * 却是排故练习要抓的目标，必须画出来。
 */
export const FAULT_CODES: ReadonlySet<string> = new Set([
  'short-circuit',
  'over-range',
  'wrong-connection',
  'fuse-blown',
  'fuse-overload',
  'bulb-burnt',
  'bulb-overload',
]);

/** 会真的流过支路电流的元件（开关在网表里被并成同一节点，读数恒为 0，不能拿它判流）。 */
const BRANCH_KINDS = new Set(['battery', 'ammeter', 'fuse', 'heater', 'resistor', 'bulb']);

/**
 * 当前应该打红框的元件 id。
 *
 * 返回值只包含**真的有问题**的元件：告警点名的一律进；短路时再补上过流的支路
 * 与被它串起来的闭合开关。没有告警、没有短路电流时返回空集合（画布不画任何红框）。
 */
export function collectFaultIds(state: BenchState, result: SolveResult | null): Set<string> {
  const ids = new Set<string>();
  if (!result) return ids;

  let shorted = false;
  for (const warning of result.warnings) {
    if (FAULT_CODES.has(warning.code)) {
      for (const id of warning.elementIds ?? []) ids.add(id);
    }
    if (warning.code === 'short-circuit') shorted = true;
  }
  if (!shorted) return ids;

  // ① 支路电流真的超阈值的元件：电源、电表、保险丝、用电器都可能。
  const hot = new Set<string>();
  for (const el of state.components) {
    if (!BRANCH_KINDS.has(el.kind)) continue;
    const amps = Math.abs(Number(result.elements[el.id]?.currentAB));
    if (Number.isFinite(amps) && amps > SHORT_BRANCH_AMPS) {
      hot.add(el.id);
      ids.add(el.id);
    }
  }

  // ② 一跳扩展：与过流元件直接相连的闭合开关，就是串在短路支路上的那个闸。
  //    闭合开关在网表里两端被并成一个节点、读数恒为 0，光看 `currentAB` 永远抓不到它。
  for (const wire of state.wires) {
    const from = wire.from.slice(0, wire.from.lastIndexOf(':'));
    const to = wire.to.slice(0, wire.to.lastIndexOf(':'));
    const other = hot.has(from) ? to : hot.has(to) ? from : null;
    if (!other) continue;
    const el = state.components.find((c) => c.id === other);
    if (el?.kind === 'switch' && el.params.closed !== false) ids.add(el.id);
  }

  return ids;
}
