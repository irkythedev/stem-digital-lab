/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 导线电流（流向与幅值）
 *
 * 画布上每条导线要不要画「电流流动层」、往哪个方向滚，全部由这里决定。
 * 抽成纯函数有两个原因：
 * 1) 这是历史缺陷的重灾区（电池端画反、并联引线画反、开路支路凭空有电流），
 *    必须能被 `circuit-bench.test.ts` 直接跑，而不是只靠源码字符串断言；
 * 2) 与视图无关 —— 电路图和仿真图共用同一份流向。
 *
 * 三条口径：
 * - 符号一律取 `currentAB`（统一约定：正 = 由端子 a 流向端子 b）。`current` 对电池是
 *   「内部 b→a（放电）」的反向语义，直接拿它推流向会把电源两端的导线画反。
 * - 取值端必须优先选**串联端**（该接线柱上只有这一根导线）：此时元件电流必然整根流过这根线，
 *   读数就是这根线的精确电流。并接端上元件电流会分流，拿它推方向会把并联引线画反。
 * - **死支路不画流动**：接在不导通元件（断开的开关 / 烧断的保险丝、灯泡）上的、
 *   该接线柱只有这一根导线的导线，按连续性它的电流恒为 0。此时若退回并接端，
 *   会把大电流「借」给这条死线（实测 `fuse` 预设两根短路线凭空显示 0.487 A）。
 */
import type { BenchState, CircuitComponent, SolveResult } from './circuit-bench-core';
import { isOpen, mergesTerminals } from './circuit-bench-models';
import { buildWireRoutes, type WireRoute } from './circuit-bench-render';

/** 支路电流低于 1mA 视为断路：不画流动层，避免「静止的虚线」被读成有电流。 */
export const FLOW_MIN_AMPS = 1e-3;

/** 电流流动层的速度分档：电流越大，虚线滚动越快（纯 CSS 动画，不占用主线程）。 */
export function flowDuration(amps: number): number {
  const i = Math.abs(amps);
  if (i >= 0.5) return 0.42;
  if (i >= 0.2) return 0.62;
  if (i >= 0.05) return 0.9;
  return 1.35;
}

export interface WireFlow {
  /** 导线上的电流幅值（A），取自被采纳那一端的元件读数。 */
  amps: number;
  /** +1 = 电流沿导线路径的绘制方向（from 端 → to 端）；-1 = 反向。 */
  dir: 1 | -1;
}

/** 每个接线柱接了几根导线：1 根即为串联端，元件电流必然整根流过这根线。 */
function terminalDegrees(state: BenchState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const w of state.wires) {
    counts[w.from] = (counts[w.from] ?? 0) + 1;
    counts[w.to] = (counts[w.to] ?? 0) + 1;
  }
  return counts;
}

interface WireEnd {
  side: 'from' | 'to';
  /** 接线柱引用（`元件id:端子`），用于查该柱上接了几根线。 */
  ref: string;
  el: CircuitComponent;
  terminal: 'a' | 'b';
}

/**
 * 这一端能不能给整根线投票定电流。
 *
 * 闭合开关（以及导线）在网表里把两端并成同一个节点，求解器对它们只能给出 v=0、I=0 ——
 * 那是「合并后的节点」，不是真实支路电流。拿这个 0 去推流向只会把线画成没有电流，
 * 所以这类端不参与表决（`fuse/w_1` 一端是闭合开关、一端是电池，正是靠电池端定流）。
 */
function canVote(el: CircuitComponent): boolean {
  return !mergesTerminals(el);
}

/** 端子相对导线绘制方向的正负：端子在 from 端时 a→b 为逆向，在 to 端时 a→b 为顺向。 */
function endDirection(end: WireEnd, currentAB: number): 1 | -1 {
  const sign = (end.side === 'from') === (end.terminal === 'a') ? -1 : 1;
  return (sign * Math.sign(currentAB || 1)) as 1 | -1;
}

/**
 * 计算每条导线的电流。返回的 Map 只包含**真的会画流动层**的导线：
 * 死支路、零电流支路都不在表里（画布因此不会给它们画流动层）。
 *
 * `routes` 可复用调用方在同一帧里已经算好的导线路径（画布、标签层共用一份，
 * 满负载时省掉每帧两次 ~90 ms 的 `buildWireRoutes`）；不传就自己算，结果相同。
 */
export function computeWireFlows(
  state: BenchState,
  result: SolveResult | null,
  routes?: WireRoute[] | null,
): Map<string, WireFlow> {
  const map = new Map<string, WireFlow>();
  if (!result) return map;

  const counts = terminalDegrees(state);
  const byId = new Map(state.components.map((el) => [el.id, el]));

  for (const route of routes ?? buildWireRoutes(state)) {
    const ends: WireEnd[] = (
      [
        { side: 'from', ref: route.fromRef, id: route.fromEl.id, terminal: route.fromTerminal },
        { side: 'to', ref: route.toRef, id: route.toEl.id, terminal: route.toTerminal },
      ] as const
    ).flatMap((e) => {
      const el = byId.get(e.id);
      return el ? [{ side: e.side, ref: e.ref, el, terminal: e.terminal }] : [];
    });

    // 死支路：断开的开关 / 烧断的保险丝灯泡，且这个柱子上只有这一根线 ——
    // 按连续性这根线电流恒为 0（`fuse` 预设短路线曾被并接端借来 0.487 A 的假电流）。
    if (ends.some((e) => isOpen(e.el) && (counts[e.ref] ?? 0) === 1)) continue;

    const votable = ends.flatMap((end) => {
      if (!canVote(end.el)) return [];
      const currentAB = Number(result.elements[end.el.id]?.currentAB);
      if (!Number.isFinite(currentAB)) return [];
      return [{ amps: Math.abs(currentAB), series: (counts[end.ref] ?? 0) === 1, dir: endDirection(end, currentAB) }];
    });
    // 有串联端时**只信串联端**：那是这根线的精确电流。它低于 1mA 就说明这根线本来就没电流，
    // 绝不能退回并接端去借一个大电流（电压表引线实测只有 3µA，却曾被画成 0.258 A 的亮线）。
    const series = votable.filter((c) => c.series);
    const pool = series.length ? series : votable;
    const best = pool.filter((c) => c.amps > FLOW_MIN_AMPS).sort((a, b) => b.amps - a.amps)[0];
    if (best) map.set(route.wire.id, { amps: best.amps, dir: best.dir });
  }
  return map;
}
