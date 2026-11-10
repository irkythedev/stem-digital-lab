/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 求解器属性测试（property-based）。
 *
 * 与 `circuit-bench.test.ts` 的手写场景用例互补：那边逐条锁定具体读数与教材情境，
 * 这边用固定种子的随机输入扫不变量。种子写死，失败信息由 `forAll` 带上
 * `seed + round + input`，照抄即可复现；每个属性 200 轮，不改变测试链的时间量级。
 *
 * 只调用 `solveCircuit` / `buildCircuitSystem` 读结果，不复制、也不改变求解器逻辑；
 * 电路统一经 `createComponent` 与 `circuit-bench/fixtures.ts` 的构造器拼装。
 *
 * 为什么不用随机连线的「野生网表」：本套件要断言 `ok === true`，就必须保证输入可解。
 * 因此随机化的是元件种类、参数与三种已证明可解的拓扑（串联 / 并联 / 梯形），
 * 而「非法参数也绝不崩」的宽谱 Fuzz 仍由 circuit-bench.test.ts 承担。
 */
import { strict as assert } from 'node:assert';

import type { TestFn } from '../../harness';
import { assertRelClose } from '../../fixtures/assert';
import { forAll, randInt } from '../../fixtures/random';
import {
  buildCircuitSystem,
  createComponent,
  solveCircuit,
  type BenchState,
  type ElementKind,
  type ParamBag,
  type SolveResult,
} from '../../../labs/physics/circuit-bench/circuit-bench-core';
import { seriesChain, stateOf } from '../../../labs/physics/circuit-bench/fixtures';

/** 基础种子：每个属性在其上小幅偏移，保持「写死」又互不重复。 */
const SEED = 20261103;
/** 单个属性的轮数；实测 6 个属性合计仍在百毫秒级，不需要再降。 */
const ROUNDS = 200;

/* ── 通用断言 ── */

/** 数值读数不得出现 NaN / Infinity；`resistance` 是唯一例外（开路 = Infinity）。 */
function assertFiniteResult(result: SolveResult, hint: string): void {
  for (const [node, v] of Object.entries(result.nodeVoltages)) {
    assert.ok(Number.isFinite(v), `${hint}：节点 ${node} 电压非有限值（${v}）`);
  }
  for (const r of Object.values(result.elements)) {
    for (const field of ['current', 'currentAB', 'voltage', 'power'] as const) {
      assert.ok(
        Number.isFinite(r[field]),
        `${hint}：${r.kind} ${r.id} 的 ${field} 非有限值（${r[field]}）`,
      );
    }
    assert.ok(!Number.isNaN(r.resistance), `${hint}：${r.kind} ${r.id} 的 resistance 是 NaN`);
  }
  assert.ok(Number.isFinite(result.totalPower), `${hint}：totalPower 非有限值（${result.totalPower}）`);
}

/** 无源、非开路且电阻有限的元件必须满足 V = I·R，且耗散功率非负。 */
function assertOhmAndPower(state: BenchState, result: SolveResult, hint: string): void {
  const system = buildCircuitSystem(state);
  for (const meta of system.elements) {
    const reading = result.elements[meta.id];
    assert.ok(reading, `${hint}：元件 ${meta.id} 缺少读数`);
    assert.ok(
      reading.power >= 0 && Number.isFinite(reading.power),
      `${hint}：${meta.kind} ${meta.id} 的功率为 ${reading.power}`,
    );
    if (meta.source || meta.open || !Number.isFinite(meta.r) || meta.r <= 0) continue;
    assertRelClose(
      reading.currentAB,
      reading.voltage / meta.r,
      `${hint}：${meta.kind} ${meta.id} 不满足欧姆关系 V=I·R（V=${reading.voltage}, I=${reading.currentAB}, R=${meta.r}）`,
      1e-9,
    );
  }
}

/** KCL：每个节点上「流入 − 流出」的代数和为零（gmin 漏电只留下极小残差）。 */
function assertKcl(state: BenchState, result: SolveResult, hint: string): void {
  const system = buildCircuitSystem(state);
  const sums = new Array<number>(system.nodes.length).fill(0);
  let maxAbsCurrent = 0;
  for (const meta of system.elements) {
    const reading = result.elements[meta.id];
    if (!reading || meta.a === meta.b) continue;
    sums[meta.a] += reading.currentAB;
    sums[meta.b] -= reading.currentAB;
    maxAbsCurrent = Math.max(maxAbsCurrent, Math.abs(reading.currentAB));
  }
  for (let i = 0; i < sums.length; i++) {
    const tol = 1e-6 + 1e-6 * maxAbsCurrent;
    assert.ok(
      Math.abs(sums[i]) <= tol,
      `${hint}：节点 ${system.nodes[i]} 的 KCL 残差 ${sums[i]} 超过容差 ${tol}（最大支路电流 ${maxAbsCurrent}）`,
    );
  }
}

/** 能量守恒：电源发出的 emf·I = 内阻损耗 + 外电路耗散；totalPower 等于各读数 power 之和。 */
function assertPowerBalance(state: BenchState, result: SolveResult, hint: string): void {
  const system = buildCircuitSystem(state);
  let sourcePower = 0;
  let dissipation = 0;
  for (const meta of system.elements) {
    const reading = result.elements[meta.id];
    if (!reading) continue;
    if (meta.source) {
      sourcePower += reading.power;
      dissipation += reading.current * reading.current * meta.internalR;
    } else if (!meta.open && Number.isFinite(meta.r) && meta.r > 0) {
      dissipation += reading.currentAB * reading.currentAB * meta.r;
    }
  }
  assertRelClose(sourcePower, dissipation, `${hint}：电源输出功率 ≠ 内阻损耗 + 外电路耗散`, 5e-4);

  let sum = 0;
  for (const r of Object.values(result.elements)) sum += r.power;
  assertRelClose(result.totalPower, sum, `${hint}：totalPower ≠ Σ 元件 power`, 1e-12);
}

/* ── 随机电路生成 ── */

interface LoadSpec {
  kind: ElementKind;
  params: ParamBag;
}

interface CircuitSpec {
  topology: 'series' | 'parallel' | 'ladder';
  emf: number;
  internalR: number;
  loads: LoadSpec[];
}

/** 全是「非开路、非电源」的可解负载；不含导线，避免 0.001 Ω 造成无意义的千安级电流。 */
const LOAD_KINDS: readonly ElementKind[] = [
  'resistor',
  'heater',
  'rheostat',
  'ammeter',
  'galvanometer',
  'fuse',
  'voltmeter',
  'switch',
  'bulb',
];

function randomParams(rand: () => number, kind: ElementKind): ParamBag {
  switch (kind) {
    case 'resistor':
    case 'heater':
      return { r: 0.1 + rand() * 50 };
    case 'rheostat': {
      const minR = rand() * 2;
      return { minR, maxR: minR + 0.5 + rand() * 30, ratio: rand() };
    }
    case 'ammeter':
      return { r: 0.01 + rand() * 0.5 };
    case 'galvanometer':
      return { r: 1 + rand() * 40 };
    case 'voltmeter':
      return { r: 1e3 + rand() * 1e6 };
    case 'fuse':
      return { r: 0.01 + rand() * 0.5, ratedCurrent: 0.5 + rand() * 5 };
    case 'switch':
      return { closed: true };
    case 'bulb':
      // 灯泡默认处于环境温度，本套件只解一次电路、不做热积分，R 恒定，欧姆关系成立。
      return { ratedVoltage: 2 + rand() * 10, ratedPower: 0.3 + rand() * 5 };
    default:
      return {};
  }
}

function randomCircuit(rand: () => number): CircuitSpec {
  const topologies = ['series', 'parallel', 'ladder'] as const;
  const topology = topologies[randInt(rand, 0, topologies.length - 1)];
  const count = topology === 'ladder' ? 3 : randInt(rand, 1, 4);
  const loads: LoadSpec[] = [];
  for (let i = 0; i < count; i++) {
    const kind = LOAD_KINDS[randInt(rand, 0, LOAD_KINDS.length - 1)];
    loads.push({ kind, params: randomParams(rand, kind) });
  }
  return { topology, emf: 1 + rand() * 11, internalR: 0.01 + rand() * 1.99, loads };
}

function buildCircuit(spec: CircuitSpec): BenchState {
  if (spec.topology === 'series') return seriesChain(spec);

  const bat = createComponent('bat', 'battery', 120, 300, { emf: spec.emf, r: spec.internalR }, 90);
  const comps = [bat];
  const pairs: [string, string][] = [];

  if (spec.topology === 'parallel') {
    spec.loads.forEach((load, i) => {
      const id = `l${i + 1}`;
      comps.push(createComponent(id, load.kind, 200 + i * 60, 150, load.params));
      pairs.push(['bat:a', `${id}:a`], [`${id}:b`, 'bat:b']);
    });
  } else {
    // 梯形：l1 与 (l2 ∥ l3) 串联，l1 的 a→b 与 l2/l3 方向一致。
    const [first, second, third] = spec.loads;
    comps.push(createComponent('l1', first.kind, 200, 150, first.params));
    comps.push(createComponent('l2', second.kind, 300, 150, second.params));
    comps.push(createComponent('l3', third.kind, 300, 260, third.params));
    pairs.push(
      ['bat:a', 'l1:a'],
      ['l1:b', 'l2:a'],
      ['l2:a', 'l3:a'],
      ['l2:b', 'l3:b'],
      ['l2:b', 'bat:b'],
    );
  }
  return stateOf(comps, pairs);
}

/* ── 属性用例 ── */

export function registerCircuitPropertyTests(test: TestFn): void {
  test('串联回路：电流处处相等，电压之和等于电源端电压', () => {
    forAll(
      SEED,
      ROUNDS,
      (rand) => {
        const loadCount = randInt(rand, 1, 5);
        const loads: LoadSpec[] = [];
        for (let i = 0; i < loadCount; i++) {
          const r = 0.1 + rand() * 50;
          loads.push({ kind: 'resistor', params: { r } });
        }
        return { emf: 1 + rand() * 11, internalR: 0.01 + rand() * 1.99, loads };
      },
      (spec, round) => {
        const state = seriesChain(spec);
        const result = solveCircuit(state);
        const hint = `串联第 ${round} 轮`;
        assert.equal(result.ok, true, `${hint}：串联回路应可解`);
        assertFiniteResult(result, hint);

        const loadIds = spec.loads.map((_, i) => `l${i + 1}`);
        const readings = loadIds.map((id) => result.elements[id]);
        for (const r of readings) assert.ok(r, `${hint}：负载 ${r?.id} 缺少读数`);

        const totalResistance = spec.internalR + readings.reduce((s, r) => s + r.resistance, 0);
        const expected = spec.emf / totalResistance;
        for (const r of readings) {
          assertRelClose(r.currentAB, expected, `${hint}：${r.id} 串联电流不相等`, 1e-6);
        }
        assertRelClose(
          result.elements.bat.currentAB,
          -expected,
          `${hint}：电池内部电流与回路电流不相等`,
          1e-6,
        );

        const loadVoltage = readings.reduce((s, r) => s + r.voltage, 0);
        assertRelClose(loadVoltage, result.elements.bat.voltage, `${hint}：负载电压之和 ≠ 电源端电压`, 1e-6);
        assertRelClose(
          result.elements.bat.voltage,
          spec.emf - expected * spec.internalR,
          `${hint}：电源端电压 ≠ emf − I·r`,
          1e-5,
        );
      },
    );
  });

  test('求解结果无 NaN / Infinity 泄漏', () => {
    forAll(
      SEED + 1,
      ROUNDS,
      randomCircuit,
      (spec, round) => {
        const result = solveCircuit(buildCircuit(spec));
        assertFiniteResult(result, `随机拓扑第 ${round} 轮`);
      },
    );
  });

  test('电阻元件满足欧姆关系 V ≈ I·R，耗散功率非负', () => {
    forAll(
      SEED + 2,
      ROUNDS,
      randomCircuit,
      (spec, round) => {
        const state = buildCircuit(spec);
        const result = solveCircuit(state);
        assertOhmAndPower(state, result, `欧姆关系第 ${round} 轮`);
      },
    );
  });

  test('KCL：每个节点的电流代数和为零', () => {
    forAll(
      SEED + 3,
      ROUNDS,
      randomCircuit,
      (spec, round) => {
        const state = buildCircuit(spec);
        const result = solveCircuit(state);
        assert.equal(result.ok, true, `KCL 第 ${round} 轮：拓扑应可解`);
        assertKcl(state, result, `KCL 第 ${round} 轮`);
      },
    );
  });

  test('功率守恒：电源输出 = 内阻损耗 + 外电路耗散', () => {
    forAll(
      SEED + 4,
      ROUNDS,
      randomCircuit,
      (spec, round) => {
        const state = buildCircuit(spec);
        const result = solveCircuit(state);
        assertPowerBalance(state, result, `功率第 ${round} 轮`);
      },
    );
  });

  test('随机可解拓扑：不抛异常、返回 ok，且无内部错误 / 奇异矩阵告警', () => {
    forAll(
      SEED + 5,
      ROUNDS,
      randomCircuit,
      (spec, round) => {
        let result: SolveResult | undefined;
        assert.doesNotThrow(() => {
          result = solveCircuit(buildCircuit(spec));
        }, `第 ${round} 轮：求解器把异常抛给了调用方`);
        assert.ok(result, `第 ${round} 轮：没有拿到求解结果`);
        assert.equal(result.ok, true, `第 ${round} 轮：可解拓扑返回 ok=false`);
        for (const w of result.warnings) {
          assert.ok(
            w.code !== 'internal' && w.code !== 'singular',
            `第 ${round} 轮：出现 ${w.code} 告警「${w.zh}」`,
          );
        }
      },
    );
  });
}
