/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * circuit-bench 测试夹具：手搭电路的纯构造器。
 *
 * `stateOf` / `simpleLoop` 自 `circuit-bench.test.ts` 原样抽出，供注册模块与
 * `src/testing/suites/physics/circuit-property.suite.ts` 共用；`seriesChain`
 * 是属性测试需要的「n 只元件首尾相接」构造器。
 *
 * 这里只有拼装，不做任何求解、夹取或状态清洗——那些仍以 circuit-bench-core /
 * circuit-bench-state 为准，夹具不该出现第二套口径。
 */
import {
  createComponent,
  type BenchState,
  type CircuitComponent,
  type ElementKind,
  type ParamBag,
} from './circuit-bench-core';

/** 把元件与「端子对」列表拼成工作台状态；导线 id 按顺序生成 `w_1…`。 */
export function stateOf(components: CircuitComponent[], pairs: [string, string][]): BenchState {
  return {
    v: 1,
    components,
    wires: pairs.map(([from, to], i) => ({ id: `w_${i + 1}`, from, to })),
  };
}

/**
 * 最小串联回路：电池 → 闭合开关 → 一只用电器 → 电池。
 * 默认 6 V / 0.5 Ω 内阻，负载为 10 Ω 电阻；`extra` 可再塞入额外元件（自行接线）。
 */
export function simpleLoop(params: {
  emf?: number;
  r?: number;
  loadKind?: ElementKind;
  loadParams?: Record<string, number | string | boolean>;
  extra?: CircuitComponent[];
}): BenchState {
  const load = createComponent('load', params.loadKind ?? 'resistor', 300, 160, params.loadParams ?? { r: 10 });
  const comps = [
    createComponent('bat', 'battery', 120, 300, { emf: params.emf ?? 6, r: params.r ?? 0.5 }, 90),
    createComponent('sw', 'switch', 120, 160, { closed: true }, 90),
    load,
    ...(params.extra ?? []),
  ];
  return stateOf(comps, [
    ['bat:b', 'sw:a'],
    ['sw:b', 'load:b'],
    ['load:a', 'bat:a'],
  ]);
}

/**
 * n 只元件首尾相接的串联回路（电池 → 末只 → … → 首只 → 电池）。
 *
 * 每只元件的 `a → b` 方向与回路电流方向一致，电池的 `currentAB` 因此为 −I；
 * 属性测试可直接拿读数断言「电流处处相等」与「电源功率 = 内阻损耗 + 外电路耗散」。
 */
export function seriesChain(spec: {
  emf: number;
  internalR?: number;
  loads: Array<{ kind?: ElementKind; params?: ParamBag }>;
}): BenchState {
  const bat = createComponent('bat', 'battery', 120, 300, { emf: spec.emf, r: spec.internalR ?? 0.5 }, 90);
  const comps: CircuitComponent[] = [bat];
  const ids: string[] = [];
  spec.loads.forEach((load, i) => {
    const id = `l${i + 1}`;
    comps.push(createComponent(id, load.kind ?? 'resistor', 200 + i * 40, 120, load.params ?? {}));
    ids.push(id);
  });

  const pairs: [string, string][] = [];
  if (ids.length === 0) {
    // 没有负载就只剩电源自身；两端直连等价于短路，属性测试不会这样用，但构造器不该炸。
    pairs.push(['bat:a', 'bat:b']);
  } else {
    pairs.push(['bat:a', `${ids[ids.length - 1]}:a`]);
    for (let i = ids.length - 1; i > 0; i--) pairs.push([`${ids[i]}:b`, `${ids[i - 1]}:a`]);
    pairs.push([`${ids[0]}:b`, 'bat:b']);
  }
  return stateOf(comps, pairs);
}
