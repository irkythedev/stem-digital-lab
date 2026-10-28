/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 多学科计算核 · 三方对拍门禁（独立 runner，与 src/smoke.test.ts 并列）
 *
 * 目的：把「C++ 侧写的公式 == WASM 导出的 == TS 回退真源」这件事钉死成可执行的断言。
 * 三条腿：
 *   ① g++ 原生真值：`g++ -std=c++17 cpp/stem_cli.cpp` 编出的可执行文件，stdin 喂参数；
 *   ② WASM 导出：src/wasm/stemCore.js（Emscripten Embind，SINGLE_FILE ESM）直接实例化，
 *      不经过门面，测的是产物本身；
 *   ③ TS 回退：各 TS core（ohm-core / lens-core / quadratic-core / inverse-core /
 *      titration-core / bulb-core / mechanics-core）—— 它们才是仓库里的真源。
 * 比对容差 1e-5（相对，下限 1），NaN 必须**两边都是 NaN**（不是「都算作不等」），
 * 因为 NaN 在这里是有意义的哨兵（image_v 的 u≈f、inverse_y 的 x=0）。
 *
 * 为什么单独一个文件：smoke.test.ts 与 circuit-bench.test.ts 由并行 agent 维护，
 * 本门禁不碰它们；`npm test` 顺序跑两个文件（见 package.json）。
 *
 * 硬失败策略：g++ 缺失、cpp/stem_cli.cpp 编译失败、WASM 产物缺失——一律记为失败并以
 * 退出码 1 结束，绝不「跳过即通过」。前置缺失时后续用例整组跳过（不计入 passed），
 * 结果里已有前置失败项，不会假绿。
 *
 * 数值诚实性注意：C++ 侧刻意不做 `std::fmax` / `std::min`（会把 NaN 吞成 0 / 有值），
 * 一律写成比较式夹取，才能与 JS 的 Math.max / Math.min 逐位对上；见
 * cpp/mechanics_formula.hpp 与 cpp/chem_formula.hpp 的注释。
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  currentOf as jsCurrentOf,
  elementResistance as jsElementResistance,
} from './labs/physics/ohm-core';
import { imageV as jsImageV } from './labs/physics/lens-core';
import { quadraticY as jsQuadraticY } from './labs/math/quadratic-core';
import { inverseY as jsInverseY, sampleInverse as jsSampleInverse } from './labs/math/inverse-core';
import { phFromMoles as jsPhFromMoles } from './labs/chemistry/titration-core';
import {
  bulbResistance as jsBulbResistance,
  bulbTempStep as jsBulbTempStep,
} from './labs/physics/bulb-core';
import {
  G,
  STONE_VOLUME,
  STONE_WEIGHT,
  buoyantForce,
  displacedVolume as jsDisplacedVolume,
  springReading as jsSpringReading,
} from './labs/physics/mechanics-core';
import {
  getEngineKind,
  inverseY as facadeInverseY,
  loadStemEngine,
  sampleInverse as facadeSampleInverse,
  springReading as facadeSpringReading,
} from './labs/physics/stem-engine';

/* ── runner（独立于 smoke.test.ts） ── */

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function describe(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

/* ── 比对原语 ── */

/** 相对容差 1e-5（下限 1，避免 pH / 读数这类接近 0 的值把绝对误差放大成假失败）。 */
const REL_TOL = 1e-5;

function close(actual: number, expected: number, label: string) {
  if (Number.isNaN(expected)) {
    assert.ok(Number.isNaN(actual), `${label}: 期望 NaN 哨兵，实得 ${actual}`);
    return;
  }
  if (!Number.isFinite(expected)) {
    assert.equal(actual, expected, `${label}: 非有限值不一致（${actual} vs ${expected}）`);
    return;
  }
  assert.ok(
    Number.isFinite(actual),
    `${label}: 期望有限值 ${expected}，实得 ${actual}`,
  );
  const tol = REL_TOL * Math.max(1, Math.abs(expected));
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: ${actual} vs ${expected}（差 ${Math.abs(actual - expected)} > ${tol}）`,
  );
}

/** 解析 stem_cli 的一行输出：C++ 默认拼写 nan / inf，Number('inf') 会变 NaN，必须显式认。 */
function parseNum(line: string): number {
  const t = line.trim().toLowerCase();
  if (t === 'nan' || t === '-nan') return NaN;
  if (t === 'inf' || t === '+inf' || t === 'infinity') return Infinity;
  if (t === '-inf' || t === '-infinity') return -Infinity;
  return Number(t);
}

/* ── 三条腿的调用形状 ── */

interface WasmCore {
  element_resistance(r: number, isBulb: boolean, u: number): number;
  current_of(u: number, r: number, isBulb: boolean, rp: number): number;
  image_v(u: number, f: number): number;
  quadratic_y(a: number, b: number, c: number, x: number): number;
  inverse_y(k: number, x: number): number;
  bulb_resistance(ratedV: number, ratedP: number, temp: number): number;
  bulb_temp_step(
    temp: number,
    current: number,
    rNow: number,
    cHeat: number,
    h: number,
    tAmbient: number,
    radK: number,
  ): number;
  ph_from_moles(acidMol: number, baseMol: number, totalVolume: number): number;
  displaced_volume(vSubRatio: number, stoneVolume: number): number;
  spring_reading(weight: number, buoyancy: number): number;
}

interface OpSpec {
  /** CLI / Embind 的导出名 */
  op: string;
  /** 参数组（裸语义参数；`is_bulb` 用 0 / 1 — CLI 与 Embind 都只认标量/布尔） */
  cases: number[][];
  /** 参数组 → C++ / WASM 的实参向量（缺省恒等；浮力在这里做「场景 → 物重/浮力」的组装） */
  numericArgs?: (c: number[]) => number[];
  /** TS 回退腿：调用各 TS core */
  js: (c: number[]) => number;
  /** WASM 腿：调用 Embind 导出，实参是 `numericArgs` 之后的向量（与 CLI 同一套实参） */
  wasm: (m: WasmCore, n: number[]) => number;
}

const isBulb = (flag: number) => (flag !== 0 ? 'bulb' : 'resistor');

const OP_TABLE: OpSpec[] = [
  {
    op: 'element_resistance',
    cases: [
      [10, 0, 6],
      [10, 1, 6],
      [0, 1, 12],
      [2.5, 1, 0],
      [3.8, 1, 3.8],
    ],
    js: (c) => jsElementResistance(c[0], isBulb(c[1]), c[2]),
    wasm: (m, c) => m.element_resistance(c[0], c[1] !== 0, c[2]),
  },
  {
    op: 'current_of',
    cases: [
      [6, 10, 0, 0],
      [6, 10, 0, 2],
      [6, 10, 1, 0],
      [12, 0, 0, 0], // 真短路：TS 与 C++ 都必须是 Infinity（不是 0、不是 NaN）
      [0, 5, 0, 0],
      [0, 0, 0, 0], // 0/0：两边都必须归一为 0（原生 IEEE 会给 NaN，NaN 进 SVG 会把曲线整条抹掉）
      [0, 0, 1, 0], // 灯泡版 0/0：分母 = r + γ·u + rp = 0，同样必须为 0
      [3.8, 3.8, 1, 1.2],
    ],
    js: (c) => jsCurrentOf(c[0], c[1], isBulb(c[2]), c[3]),
    wasm: (m, c) => m.current_of(c[0], c[1], c[2] !== 0, c[3]),
  },
  {
    op: 'image_v',
    cases: [
      [10, 5],
      [30, 10],
      [5, 10], // 虚像：v 为负
      [10, 10], // u ≈ f → 无清晰实像
      [10, 10.005], // |u−f| = 0.005 < 0.01 仍在哨兵带内
      [10, 10.02], // 刚出哨兵带：v = −5010
    ],
    js: (c) => {
      const v = jsImageV(c[0], c[1]);
      return v === null ? NaN : v; // TS 真源用 null 表达「无像」，C++ 用 NaN 哨兵
    },
    wasm: (m, c) => m.image_v(c[0], c[1]),
  },
  {
    op: 'quadratic_y',
    cases: [
      [1, -3, 2, -1],
      [1, 0, 0, 0],
      [-2, 4, 0, 1.5],
      [0.001, 0, -4, 4],
      [0, 5, -5, 2.5],
    ],
    js: (c) => jsQuadraticY(c[0], c[1], c[2], c[3]),
    wasm: (m, c) => m.quadratic_y(c[0], c[1], c[2], c[3]),
  },
  {
    op: 'inverse_y',
    cases: [
      [4, 2],
      [-4, 2],
      [4, 0.15],
      [0, 3],
      [4, 0], // 定义域外：x = 0 → NaN 哨兵
      [1e-6, 1e5],
      [4, -0.15],
    ],
    js: (c) => jsInverseY(c[0], c[1]),
    wasm: (m, c) => m.inverse_y(c[0], c[1]),
  },
  {
    op: 'bulb_resistance',
    cases: [
      [3.8, 1.14, 300], // 冷态 ≈ 额定的 300/2800
      [3.8, 1.14, 2800], // 额定工况 → R = V额²/P额
      [3.8, 1.14, 3450], // 烧断温度
      [12, 3, 2000],
      [0, 0, 0], // 非法参数走兜底 + 夹取（不是 NaN，也不是 0）
    ],
    js: (c) => jsBulbResistance(c[0], c[1], c[2]),
    wasm: (m, c) => m.bulb_resistance(c[0], c[1], c[2]),
  },
  {
    op: 'bulb_temp_step',
    cases: [
      [300, 0.5, 1.357, 0.005, 0.01, 300, 1.2e-9], // 冷态通电升温
      [2800, 0.3, 12.667, 0.06, 0.01, 300, 1.2e-9], // 额定温度附近
      [200, 0, 6, 0.02, 0.005, 300, 1.2e-9], // 起点低于环境温度且只散热 → 夹回环境温度
      [0, 0, 0, 0.005, 0.01, 300, 1.2e-9], // temp = 0：dT 全由环境辐射项决定，仍须有限
      [3450, 1, 6, 0.06, 1000, 300, 0], // 长步长 + 无辐射 → 冲过 T烧断+余量，必须被上界夹住
      [300, 0.5, 0.01, 0.005, 0, 5000, 0], // 环境温度高于上界且本步不动（next = 300）：
      // 上界在外、下界在内的次序下结果恒为 3650；早退式写法会返回 5000（冲破自己的上界）
      [3640, 2, 1.357, 0.005, 0.1, 300, 0], // 孤立升温冲过烧断+余量：必须夹到 3650
    ],
    js: (c) => jsBulbTempStep(c[0], c[1], c[2], c[3], c[4], c[5], c[6]),
    wasm: (m, c) => m.bulb_temp_step(c[0], c[1], c[2], c[3], c[4], c[5], c[6]),
  },
  {
    op: 'ph_from_moles',
    cases: [
      [2, 1, 30], // 酸过量
      [2, 2, 40], // 等当点
      [2, 2 + 1e-12, 40], // 容差带内，仍必须是 7（否则 pH 发散）
      [1, 2, 30], // 碱过量
      [1, 0, 0.02], // 强酸：未夹取时 pH = −1.699
      [0, 1, 0.02], // 强碱：未夹取时 pH = 15.699
      [0, 0, 20],
    ],
    js: (c) => jsPhFromMoles(c[0], c[1], c[2]),
    wasm: (m, c) => m.ph_from_moles(c[0], c[1], c[2]),
  },
  {
    op: 'displaced_volume',
    // 一律带 STONE_VOLUME：TS 真源 mechanics-core.displacedVolume 是这条式子的**单参应用形态**
    // （物体体积由演示物常量定死），两侧用同一体积才可比；任意体积的极值由下一条 NaN/边界组覆盖。
    cases: [
      [0, STONE_VOLUME],
      [0.5, STONE_VOLUME],
      [1, STONE_VOLUME],
      [1.7, STONE_VOLUME], // 饱和：浸没后不再增大
      [-0.3, STONE_VOLUME],
    ],
    js: (c) => jsDisplacedVolume(c[0]),
    wasm: (m, c) => m.displaced_volume(c[0], c[1]),
  },
  {
    op: 'spring_reading',
    // 参数组是**实验场景**（ρ液, 浸入比例）；物重与浮力由 TS 真源 buoyantForce 组装成
    // C++/WASM 需要的两参形态——与门面里的组装方式同一件事（同一份力学常量）。
    // 组装只发生一次（numericArgs），三条腿吃的都是它：否则 WASM 腿会把「已组装的浮力」
    // 再当 ρ 组装一遍（这正是本用例第一版踩到的坑）。
    cases: [
      [1000, 0.5],
      [800, 1],
      [1200, 1],
      [3000, 1], // F浮 > G → 示数夹到 0
      [800, 0],
    ],
    numericArgs: (c) => [STONE_WEIGHT, buoyantForce(c[0], c[1])],
    js: (c) => jsSpringReading(c[0], c[1]),
    wasm: (m, n) => m.spring_reading(n[0], n[1]),
  },
];

/* ── 前置：编译原生腿 + 载入 WASM 产物 ── */

const CLI_SRC = 'cpp/stem_cli.cpp';
const WASM_ARTIFACT = 'src/wasm/stemCore.js';

function compileCli(binDir: string): string {
  assert.ok(
    existsSync(CLI_SRC),
    `${CLI_SRC} 不存在——三方对拍的 g++ 真值腿没有源码可编`,
  );
  const bin = path.join(binDir, 'stem_cli');
  const res = spawnSync('g++', ['-std=c++17', CLI_SRC, '-o', bin], { encoding: 'utf8' });
  if (res.error) {
    throw new Error(
      `g++ 不可用（${res.error.message}）——本门禁要求 g++ 真值腿，不允许静默降级为「两方对拍」`,
    );
  }
  assert.equal(
    res.status,
    0,
    `g++ 编译 ${CLI_SRC} 失败（退出码 ${res.status}）:\n${res.stderr || res.stdout}`,
  );
  assert.ok(existsSync(bin), `编译产物未生成：${bin}`);
  return bin;
}

async function loadWasmCore(): Promise<WasmCore> {
  assert.ok(
    existsSync(WASM_ARTIFACT),
    `${WASM_ARTIFACT} 缺失——三方对拍的 WASM 腿没有产物（先跑 npm run build:wasm）`,
  );
  // 路径拼成两段：与 stem-engine.ts 同一手法，避免打包器把动态 import 当静态资源解析
  const href = new URL('./wasm/' + 'stemCore.js', import.meta.url).href;
  const mod = (await import(/* @vite-ignore */ href)) as { default?: unknown };
  const factory = (mod.default ?? mod) as (opts?: unknown) => Promise<unknown>;
  return (await factory()) as WasmCore;
}

/** 把整张用例表喂给 stem_cli（一个进程跑完全部，行数必须与用例数一致）。 */
function runCliBatch(bin: string, lines: string[]): number[] {
  const res = spawnSync(bin, [], { input: `${lines.join('\n')}\n`, encoding: 'utf8' });
  if (res.error) throw new Error(`执行 stem_cli 失败：${res.error.message}`);
  assert.equal(
    res.status,
    0,
    `stem_cli 退出码 ${res.status}（协议里未知 op / 参数不足会 FAIL + exit 1）:\n${res.stdout}`,
  );
  const out = (res.stdout || '')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  assert.equal(out.length, lines.length, `stem_cli 输出 ${out.length} 行，期望 ${lines.length} 行`);
  for (const line of out) {
    assert.notEqual(line, 'FAIL', 'stem_cli 报了 FAIL：说明某个 op 名或参数个数不对');
  }
  return out.map(parseNum);
}

/* ── 主流程 ── */

async function main() {
  const binDir = mkdtempSync(path.join(tmpdir(), 'stem-cli-'));
  let bin: string | null = null;
  let binError = '';
  let wasm: WasmCore | null = null;
  let wasmError = '';

  try {
    try {
      bin = compileCli(binDir);
    } catch (e) {
      binError = e instanceof Error ? e.message : String(e);
    }
    try {
      wasm = await loadWasmCore();
    } catch (e) {
      wasmError = e instanceof Error ? e.message : String(e);
    }

    describe('三方对拍 · 前置（缺任一腿即失败，不降级为两方）', () => {
      test('g++ 编译 cpp/stem_cli.cpp → 原生真值腿就绪', () => {
        assert.ok(bin, binError || '未知编译失败');
      });
      test('WASM 产物 src/wasm/stemCore.js 载入 → 导出腿就绪', () => {
        assert.ok(wasm, wasmError || '未知载入失败');
      });
      test('WASM 模块的 10 个导出齐全（与 EMSCRIPTEN_BINDINGS 逐名一致）', () => {
        assert.ok(wasm, wasmError || '未知载入失败');
        for (const spec of OP_TABLE) {
          const fn = (wasm as unknown as Record<string, unknown>)[spec.op];
          assert.equal(typeof fn, 'function', `WASM 缺导出 ${spec.op}`);
        }
        assert.equal(OP_TABLE.length, 10, `对拍表应恰好 10 个导出，实测 ${OP_TABLE.length}`);
      });
    });

    if (!bin || !wasm) {
      console.log('\n  前置缺失：三方对拍整组跳过（上面的失败项已计入结果，不会假绿）');
    } else {
      // 一次性把全表喂给 CLI，再逐 op 比对三条腿
      /** 用例参数 → C++ / WASM 实参（与喂给 CLI 的那一行同源，避免两处各写一遍）。 */
      const numericOf = (spec: OpSpec, args: number[]) =>
        spec.numericArgs ? spec.numericArgs(args) : args;
      /** 用例在 CLI 批次里的行号 */
      const cliIndexOf = (spec: OpSpec, args: number[]) => {
        const numeric = numericOf(spec, args);
        return layout.findIndex(
          (r) =>
            r.spec === spec &&
            r.numeric.length === numeric.length &&
            r.numeric.every((n, i) => n === numeric[i]),
        );
      };
      const specOf = (op: string) => {
        const s = OP_TABLE.find((x) => x.op === op);
        assert.ok(s, `对拍表里没有 ${op}`);
        return s as OpSpec;
      };
      /** 用例在 CLI 批次里的一行（供下面按名断言哨兵用例） */
      const cliAt = (op: string, args: number[]) => {
        const spec = specOf(op);
        const idx = cliIndexOf(spec, args);
        assert.ok(idx >= 0, `${op}(${args.join(', ')}) 未进 CLI 批次`);
        return cli[idx];
      };

      const lines: string[] = [];
      const layout: Array<{ spec: OpSpec; args: number[]; numeric: number[] }> = [];
      for (const spec of OP_TABLE) {
        for (const args of spec.cases) {
          const numeric = numericOf(spec, args);
          lines.push(`${spec.op} ${numeric.map((n) => String(n)).join(' ')}`);
          layout.push({ spec, args, numeric });
        }
      }
      const cli = runCliBatch(bin, lines);

      describe('三方对拍 · g++ 真值 vs WASM 导出 vs TS 回退（容差 1e-5）', () => {
        for (const spec of OP_TABLE) {
          const rows = layout.filter((r) => r.spec === spec);
          test(`${spec.op} · ${rows.length} 组`, () => {
            for (const row of rows) {
              const idx = cliIndexOf(spec, row.args);
              assert.ok(idx >= 0, `${spec.op}(${row.args.join(', ')}) 未进 CLI 批次`);
              const g = cli[idx];
              const w = spec.wasm(wasm as WasmCore, row.numeric);
              const t = spec.js(row.args);
              const label = `${spec.op}(${row.args.join(', ')})`;
              close(g, w, `${label} g++ vs WASM`);
              close(w, t, `${label} WASM vs TS`);
              close(g, t, `${label} g++ vs TS`);
            }
          });
        }
      });

      describe('哨兵与边界：NaN 必须两边都是 NaN，夹取必须两边都夹', () => {
        test('inverse_y(4, 0)：三方同为 NaN 哨兵（不是 0、不是 null）', () => {
          const spec = specOf('inverse_y');
          assert.ok(Number.isNaN(cliAt('inverse_y', [4, 0])), 'g++ 真值应为 NaN');
          assert.ok(Number.isNaN(spec.wasm(wasm as WasmCore, [4, 0])), 'WASM 应为 NaN');
          assert.ok(Number.isNaN(spec.js([4, 0])), 'TS 真源应为 NaN');
        });

        test('image_v(10, 10)：|u−f| < 0.01 → 三方同哨兵（TS 侧是 null，折算为 NaN）', () => {
          const spec = specOf('image_v');
          assert.ok(Number.isNaN(spec.js([10, 10])), 'TS 真源应为 null（折算 NaN）');
          assert.ok(Number.isNaN(spec.wasm(wasm as WasmCore, [10, 10])), 'WASM 应为 NaN');
          assert.ok(Number.isNaN(cliAt('image_v', [10, 10])), 'g++ 真值应为 NaN');
        });

        test('ph_from_moles 等当点恰好 7（含容差带内 1e-12 的偏移）', () => {
          const spec = specOf('ph_from_moles');
          for (const args of [
            [2, 2, 40],
            [2, 2 + 1e-12, 40],
          ]) {
            assert.equal(spec.js(args), 7, `TS 真源 ${args.join(',')} 应为 7`);
            assert.equal(spec.wasm(wasm as WasmCore, args), 7, `WASM ${args.join(',')} 应为 7`);
            assert.equal(cliAt('ph_from_moles', args), 7, `g++ 真值 ${args.join(',')} 应为 7`);
          }
        });

        test('ph_from_moles 双向夹到 [0, 14]：强酸/强碱越界不得发散', () => {
          const spec = specOf('ph_from_moles');
          for (const args of [
            [1, 0, 0.02],
            [0, 1, 0.02],
          ]) {
            for (const [leg, v] of [
              ['TS', spec.js(args)],
              ['WASM', spec.wasm(wasm as WasmCore, args)],
              ['g++', cliAt('ph_from_moles', args)],
            ] as Array<[string, number]>) {
              assert.ok(v >= 0 && v <= 14, `${leg} ${args.join(',')} = ${v} 越界 [0,14]`);
            }
          }
        });

        test('spring_reading 的 NaN 必须原样穿过：rho = NaN → 三方同语义 NaN（C++ 用比较不用 fmax）', () => {
          // rho = NaN：TS 真源 Math.max(0, 2 − NaN·10·V排) = NaN；C++ 侧若写成 std::fmax(0, d)
          // 会返回 0 —— 这条用例就是为了挡住那次「看起来更整洁」的重写。
          assert.ok(Number.isNaN(jsSpringReading(NaN, 0.5)), 'TS 真源应为 NaN');
          assert.ok(
            Number.isNaN((wasm as WasmCore).spring_reading(STONE_WEIGHT, buoyantForce(NaN, 0.5))),
            'WASM 应为 NaN',
          );
        });

        test('源码纪律：C++ 夹取写成比较式，不得出现 std::fmax / std::fmin / std::min / std::max', () => {
          // 只看代码，不看注释：这两个头文件的注释里正解释着「为什么不用 fmax」，会被误判。
          const codeOf = (f: string) =>
            readFileSync(f, 'utf8')
              .replace(/\/\*[\s\S]*?\*\//g, '')
              .replace(/\/\/[^\n]*/g, '');
          const mech = codeOf('cpp/mechanics_formula.hpp');
          assert.ok(
            !/std::(fmin|fmax|min|max)\s*\(/.test(mech),
            'cpp/mechanics_formula.hpp 出现 min/max 族调用：NaN 会被吞成 0，与 JS 侧分叉',
          );
          assert.match(mech, /d\s*<\s*0\.0\s*\?\s*0\.0\s*:\s*d/, 'spring_reading 须保持比较式夹取');
          // chem 的 pH 夹取同理；其中唯一允许的 std::fmax 是等当点容差里的 max(1, n酸)
          const chem = codeOf('cpp/chem_formula.hpp');
          assert.ok(
            !/std::(fmin|min|max)\s*\(/.test(chem),
            'cpp/chem_formula.hpp 的 pH 夹取必须写成比较式（ph < 0 / ph > 14）',
          );
          assert.match(chem, /if \(ph < 0\.0\) return 0\.0;/, 'pH 下界须为比较式夹取');
          assert.match(chem, /ph > 14\.0 \? 14\.0 : ph/, 'pH 上界须为比较式夹取');
        });
      });

      const facadeKind = await loadStemEngine();

      describe('门面接线：真实产物经 stem-engine 门面整体切到 wasm', () => {
        test('loadStemEngine() 返回 wasm 且 getEngineKind() 为 wasm（10 导出齐全才切）', () => {
          assert.equal(facadeKind, 'wasm', '带有全部 10 个导出的产物必须能切到 wasm');
          assert.equal(getEngineKind(), 'wasm');
        });

        test('门面 inverseY(4, 0) 仍是 NaN（门面不得把哨兵归一成 null / 0）', () => {
          assert.ok(Number.isNaN(facadeInverseY(4, 0)));
        });

        test('门面 springReading 走 wasm 后与 TS 真源一致（含 F浮 > G 的夹取）', () => {
          for (const [rho, v] of [
            [1000, 0.5],
            [800, 1],
            [1200, 1],
            [3000, 1],
          ]) {
            close(facadeSpringReading(rho, v), jsSpringReading(rho, v), `springReading(${rho}, ${v})`);
          }
        });

        test('门面 sampleInverse(4)（wasm 标量）与 inverse-core 采样逐点一致', () => {
          const got = facadeSampleInverse(4);
          const want = jsSampleInverse(4);
          assert.equal(got.length, 2, '应为 [左支, 右支] 两段');
          for (let seg = 0; seg < 2; seg++) {
            assert.equal(got[seg].length, want[seg].length, `第 ${seg} 段点数不一致`);
            for (let i = 0; i < want[seg].length; i++) {
              assert.equal(got[seg][i][0], want[seg][i][0], `第 ${seg} 段第 ${i} 点横坐标`);
              close(got[seg][i][1], want[seg][i][1], `第 ${seg} 段第 ${i} 点纵坐标`);
            }
          }
        });
      });
    }
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main().catch((e) => {
  console.log(`\n  ✗ 未捕获异常: ${e instanceof Error ? e.stack || e.message : String(e)}`);
  failed++;
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exit(1);
});
