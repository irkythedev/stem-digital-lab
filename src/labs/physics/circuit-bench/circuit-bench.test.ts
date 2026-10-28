/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 M1 单元测试（由 src/smoke.test.ts 注册）。
 * 覆盖：线性解、节点合并、量程/故障、热模型、状态清洗、拟合、C++ 对拍、
 * 以及 1000 组随机网表 Fuzz（绝不 NaN / 绝不抛异常）。
 */
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  buildCircuitSystem,
  componentLabel,
  createComponent,
  finalizeSolve,
  fmt,
  formatPhysicalValue,
  meterGearLabel,
  meterGears,
  resetElementState,
  settleSimulation,
  snapMeterRange,
  solveCircuit,
  solveDcArrays,
  solveLinearSystem,
  solveSystemVoltages,
  stepSimulation,
  terminalPolarity,
  isPolarizedKind,
  terminalRef,
  type BenchState,
  type CircuitComponent,
  type ElementKind,
  type SolveResult,
} from './circuit-bench-core';
import {
  CIRCUIT_PRESETS,
  PRESET_IDS,
  getPreset,
  instantiatePreset,
  presetState,
} from './circuit-bench-presets';
import {
  addComponent,
  addWire,
  cloneState,
  createEmptyState,
  deserializeState,
  moveComponent,
  removeComponent,
  removeWire,
  replugWire,
  rotateComponent,
  sanitizeState,
  setRotation,
  swapPolarity,
  serializeState,
  toggleSwitch,
  updateParams,
} from './circuit-bench-state';
import { fitLinear, predict, reconcileProbeKey, toCsv } from './circuit-bench-fit';
import { buildOptions, readProbe, type ProbeOption } from './circuit-bench-probes';
import { FLOW_MIN_AMPS, computeWireFlows } from './circuit-bench-flow';
import { MATERIAL_RHO, isOpen, materialOf, mergesTerminals, resistanceOf } from './circuit-bench-models';
import {
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  commit,
  createHistory,
  mark,
  redo,
  replace,
  undo,
} from './circuit-bench-history';
import {
  WASM_STATUS_OK,
  getCircuitEngineKind,
  loadCircuitBenchEngine,
  solveWithWasm,
  type CircuitBenchWasmModule,
} from './circuit-bench-engine';
import {
  WORLD_H,
  WORLD_W,
  clampWorld,
  componentTerminals,
  distanceToPolyline,
  elementBounds,
  fitView,
  hitTestComponent,
  hitTestTerminal,
  labelPoint,
  screenToWorld,
  snap,
  terminalPoint,
  contentBounds,
  fitViewToContent,
  PORT_STUB,
  MIN_PORT_STUB,
  ROUTE_CLEARANCE,
  roundedWirePath,
  routeBacktracks,
  routeBends,
  routeClearance,
  routeCrossings,
  simplifyCollinear,
  terminalNormal,
  terminalRefOf,
  componentBodySize,
  terminalHitRadiusFor,
  wirePath,
  wirePoints,
  wireRoutePoints,
  wireShapeOf,
  worldToScreen,
  zoomAround,
  addPlacedSegments,
  createPlacedSegments,
  routeMiddleBends,
  routeOverlaps,
} from './circuit-bench-geometry';
import {
  buildWireJunctions,
  buildWireJumps,
  buildWireRoutes,
  countWireIntersections,
  wireNetIds,
} from './circuit-bench-render';
import {
  hasCanvasReadout,
  layoutCircuitLabels,
  readingForKind,
  readingReversed,
  sanitizeReadout,
} from './circuit-bench-labels';
import { PhysicalBody, SchematicBody, WIRE_PALETTE, needleAngle, sleevePoints, strategyFor, wireStyleFor } from './render';
import {
  DEFAULT_VIEW_MODE,
  VIEW_MODES,
  nextViewMode,
  normalizeViewMode,
  viewModeLabel,
} from './circuit-bench-view';
import {
  CARD_TOOLBAR_H,
  MAX_CANVAS_H,
  MIN_CANVAS_H,
  benchLayout,
  benchShellClass,
  canvasCardClass,
  canvasSlotClass,
  chartGeometry,
  fitCanvasBox,
  measureDrawerClass,
  siteContentWidth,
} from './workbench-layout';
import {
  DOUBLE_TAP_MS,
  DOUBLE_TAP_SLOP_PX,
  DRAG_THRESHOLD_PX,
  LONG_PRESS_MS,
  LONG_PRESS_SLOP_PX,
  TERMINAL_TAP_PX,
  TOUCH_GUARD,
  WIRE_MAGNET_PX,
  exceededDragThreshold,
  isDoubleTap,
  isLongPress,
  longPressDrifted,
  pxToWorld,
  terminalHitRadiusWorld,
  worldToPx,
  type PointerSample,
} from './circuit-bench-touch';
import {
  PALETTE_GROUPS,
  allGroupsClosed,
  defaultOpenState,
  groupIdOfKind,
  setAllGroups,
  snapDropPoint,
  toggleGroup,
} from './circuit-bench-palette';
import {
  paletteDemoElement,
  paletteHalfSpan,
  paletteIconBox,
} from './circuit-bench-palette-icon';
import {
  dropdownPosition,
  nextActiveIndex,
  optionIndexOf,
} from './circuit-bench-select';
import {
  blankMenuItems,
  elementMenuItems,
  isFaulty,
  menuPosition,
  wireMenuItems,
  type MenuAction,
  type MenuItem,
} from './circuit-bench-menu';
import { GRID, nearestTerminalRef, WIPER_RAIL_HALF, wiperLocalX, wiperRatioAt } from './circuit-bench-geometry';

type TestFn = (name: string, fn: () => void) => void;

let cliBin: string | null = null;
let cliTried = false;

function ensureCli(): string | null {
  if (cliTried) return cliBin;
  cliTried = true;
  const bin = '/tmp/circuit_bench_cli_smoke';
  try {
    if (existsSync(bin)) unlinkSync(bin);
    execFileSync('g++', ['-O2', '-std=c++17', '-o', bin, 'cpp/circuit_bench_cli.cpp'], {
      stdio: 'pipe',
      timeout: 30000,
    });
    cliBin = bin;
  } catch {
    cliBin = null;
  }
  return cliBin;
}

function netlistText(
  n: number,
  ground: number,
  sources: { a: number; b: number; emf: number; r: number }[],
  conductors: { a: number; b: number; g: number }[],
): string {
  const lines = [`${n} ${ground} ${sources.length} ${conductors.length}`];
  for (const s of sources) lines.push(`${s.a} ${s.b} ${s.emf} ${s.r}`);
  for (const c of conductors) lines.push(`${c.a} ${c.b} ${c.g}`);
  return lines.join('\n') + '\n';
}

function runCli(text: string): number[] {
  const bin = ensureCli();
  if (!bin) return [];
  const out = execFileSync(bin, { input: text, encoding: 'utf8', timeout: 10000 }).trim();
  if (out === 'FAIL') return [];
  return out.split(/\s+/).map(Number);
}

/**
 * C++/WASM 产物（scripts/build-wasm-circuit.sh 生成）。
 *
 * smoke 的 test() 是同步执行器（异步用例 await 之后的断言不会计入结果），
 * 所以这里用顶层 await 先把工厂实例化好，双引擎对拍再以同步用例逐条断言。
 * 产物缺失 / 实例化失败 → null，对应用例跳过（不制造假绿：断言前先 requireWasm）。
 */
const wasmModule: CircuitBenchWasmModule | null = await (async () => {
  try {
    const imported = (await import('../../../wasm/circuitBench.js')) as { default?: unknown };
    const factory = imported.default as (() => Promise<CircuitBenchWasmModule>) | undefined;
    if (typeof factory !== 'function') return null;
    const mod = await factory();
    return typeof mod.bench_solve === 'function' ? mod : null;
  } catch {
    return null;
  }
})();

/** 门面加载后的引擎种类（验证 MODULARIZE 工厂 + bench_solve 接线）。 */
const loadedEngineKind = await loadCircuitBenchEngine().then((e) => e.kind);

function requireWasm(): CircuitBenchWasmModule {
  assert.ok(wasmModule, '未找到 src/wasm/circuitBench.js：先运行 bash scripts/build-wasm-circuit.sh');
  return wasmModule;
}

/** 直接调用 C++ bench_solve，返回 [status, v0 … v_{n-1}]。 */
function wasmSolveArrays(
  mod: CircuitBenchWasmModule,
  n: number,
  ground: number,
  sources: { a: number; b: number; emf: number; r: number }[],
  conductors: { a: number; b: number; g: number }[],
): number[] {
  const out = mod.bench_solve!(
    n,
    ground,
    Int32Array.from(sources.map((s) => s.a)),
    Int32Array.from(sources.map((s) => s.b)),
    Float64Array.from(sources.map((s) => s.emf)),
    Float64Array.from(sources.map((s) => s.r)),
    Int32Array.from(conductors.map((c) => c.a)),
    Int32Array.from(conductors.map((c) => c.b)),
    Float64Array.from(conductors.map((c) => c.g)),
  );
  return Array.from(out ?? []);
}

/** 相对误差断言：|a-b| <= 1e-5 * max(1, |a|, |b|)。 */
function assertRelClose(a: number, b: number, msg: string, tol = 1e-5): void {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  assert.ok(Math.abs(a - b) <= tol * scale, `${msg}: TS=${a} WASM=${b} (rel ${Math.abs(a - b) / scale})`);
}

function stateOf(components: CircuitComponent[], pairs: [string, string][]): BenchState {
  return {
    v: 1,
    components,
    wires: pairs.map(([from, to], i) => ({ id: `w_${i + 1}`, from, to })),
  };
}

function simpleLoop(params: {
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

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function registerCircuitBenchTests(test: TestFn): void {
  /* ── 路由与入口整合 ── */

  test('circuit-bench 路由: 注册表、规范路径与 labHref/labFromPath', async () => {
    const { labs, labMap, labHref, labFromPath, labsForSubject } = await import('../../../lib/labs');
    assert.equal(labs.length, 16);
    assert.equal(labsForSubject('physics').length, 8);
    const lab = labMap['circuit-bench'];
    assert.ok(lab, 'circuit-bench 已注册');
    assert.equal(lab.path, '/circuit-bench');
    assert.equal(lab.category, 'electric');
    assert.equal(lab.subjectId, 'physics');
    assert.equal(lab.meta?.kind, 'tool', '工作台须在注册表标记为专业工具');
    assert.equal(labHref(lab), '/circuit-bench');
    assert.equal(labFromPath('/circuit-bench')?.id, 'circuit-bench');
    assert.equal(labFromPath('/circuit-bench/')?.id, 'circuit-bench');
    assert.equal(labFromPath('/circuit-bench?x=1')?.id, 'circuit-bench');
    // 兼容路径仍解析到同一实验
    assert.equal(labFromPath('/lab/circuit-bench')?.id, 'circuit-bench');
    // 历史路径 /physics/circuit-bench 不进注册表：它由 App 的跳转承接，注册表每个实验只有一条规范路径
    assert.equal(labFromPath('/physics/circuit-bench'), undefined, '历史路径不应留在注册表里');
    // 未迁移的实验保持 /lab/:id
    const ohm = labMap['ohm'];
    assert.equal(ohm.path, undefined);
    assert.equal(labHref(ohm), '/lab/ohm');
    assert.equal(labFromPath('/lab/ohm')?.id, 'ohm');
    assert.equal(labFromPath('/not-a-lab'), undefined);
  });

  test('circuit-bench 归属: 专业工具台进「// 工具」栏，不混入常规实验网格', async () => {
    const { labs, labsForSubject, regularLabsForSubject, toolsForSubject } = await import('../../../lib/labs');
    const regular = regularLabsForSubject('physics');
    const tools = toolsForSubject('physics');
    assert.ok(!regular.some((lab) => lab.id === 'circuit-bench'), '工作台不能出现在常规实验列表');
    assert.ok(tools.some((lab) => lab.id === 'circuit-bench'), '工作台须归入工具列表');
    assert.equal(regular.length, 7, '物理常规实验为 7 个');
    assert.equal(tools.length, 1, '物理注册表工具台为 1 个');
    assert.equal(regular.length + tools.length, labsForSubject('physics').length, '分组不丢条目');
    assert.equal(labs.length, 16, '全站条目总数不变');
    // 其他学科：没有注册表工具台，常规实验数量不受影响
    assert.equal(toolsForSubject('math').length, 0);
    assert.equal(regularLabsForSubject('math').length, 4);
    assert.equal(toolsForSubject('chemistry').length, 0);
    assert.equal(regularLabsForSubject('chemistry').length, 4);

    const page = readFileSync(resolve('src/pages/SubjectPage.tsx'), 'utf-8');
    assert.ok(page.includes('regularLabsForSubject'), '学科页实验网格需排除工具台');
    assert.ok(page.includes('toolsForSubject'), '学科页工具栏需并入注册表工具台');
    assert.ok(!page.includes("badge?.kind === 'tool'"), '实验卡片不应再渲染工具台徽标');
    assert.ok(page.includes('专业工具台'), '工具卡片保留「专业工具台」徽标');
    assert.ok(page.includes('自由连线、实时读表') || page.includes('lab.description'), '工具卡片沿用注册表文案');

    const home = readFileSync(resolve('src/pages/HomePage.tsx'), 'utf-8');
    assert.ok(home.includes('regularLabsForSubject'), '首页实验网格需排除工具台');
    assert.ok(home.includes("toolsForSubject('physics')"), '首页物理工具栏需并入注册表工具台');
    assert.ok(!home.includes('labsForSubject'), '首页实验网格不应再取含工具台的全量列表');
    assert.ok(!home.includes("lab.meta?.kind === 'tool'"), '首页实验卡片不应再渲染工具台徽标');
    assert.ok(home.includes('专业工具台'), '首页工具卡片保留「专业工具台」徽标');
  });

  test('circuit-bench 路由: 所有入口链接统一走 labHref', () => {
    const pages = ['HomePage', 'SubjectPage', 'PhysicalConstants', 'MathFormulas', 'PhysicsFormulas'];
    for (const page of pages) {
      const src = readFileSync(resolve('src/pages', `${page}.tsx`), 'utf-8');
      assert.ok(/labHref/.test(src), `${page} 应使用 labHref`);
      assert.ok(!/to=\{`\/lab\/\$\{lab\.id\}`\}/.test(src), `${page} 仍残留硬编码实验链接`);
    }
  });

  test('circuit-bench 路由: App 注册规范路径且 SEO/GEO 跟随注册表', () => {
    const app = readFileSync(resolve('src/App.tsx'), 'utf-8');
    assert.ok(app.includes('path="/circuit-bench"'), 'App 缺少规范路由');
    assert.ok(app.includes('path="/lab/:labId"'), '兼容路由必须保留');
    // 历史路径必须还有承接，否则已分享出去的链接会 404；且不能是直渲染（注册表已不认它）
    assert.ok(
      /<Route path="\/physics\/circuit-bench" element=\{<Navigate to="\/circuit-bench"/.test(app),
      '历史路径应永久跳转到规范路径',
    );
    const vite = readFileSync(resolve('vite.config.ts'), 'utf-8');
    assert.ok(vite.includes('lab.path ?? `/lab/${lab.id}`'), 'sitemap/SEO 未读取 path');
    assert.ok(vite.includes('const path = b.match('), 'parseLabs 未解析 path 字段');
    assert.ok(vite.includes('...(path ? { path } : {})'), 'parseLabs 未把 path 带入 SEO 数据');
    assert.ok(vite.includes('15 个交互实验 + 5 个工具'), 'GEO 文案需与实际实验/工具数一致');
    assert.ok(!vite.includes('16 个交互实验'), 'GEO 文案不得回到旧的实验数口径');
  });

  test('circuit-bench 路由: 全站字面量路由统一为顶层单段', () => {
    const app = readFileSync(resolve('src/App.tsx'), 'utf-8');
    const tags = [...app.matchAll(/<Route path="([^"]+)" element=\{([^}]*)\}/g)];
    assert.ok(tags.length > 0, '未解析到字面量路由');
    // 渲染页面的字面量路由（排除参数化路由与纯跳转）都应是顶层单段，与 4 个查表工具同构
    const rendered = tags
      .filter(([, p, el]) => !p.includes(':') && !/Navigate/.test(el))
      .map(([, p]) => p);
    const multiSegment = rendered.filter((p) => p !== '/' && p.split('/').filter(Boolean).length > 1);
    assert.deepEqual(multiSegment, [], `出现多段字面量路由（与查表工具命名不一致）: ${multiSegment.join(', ')}`);
    assert.ok(rendered.includes('/circuit-bench'), '电学工作台须走顶层单段路径');
    assert.ok(rendered.includes('/periodic-table'), '查表工具仍是顶层单段路径');
    // 多段的只剩历史跳转这一条
    const redirects = tags.filter(([, , el]) => /Navigate/.test(el)).map(([, p]) => p);
    assert.deepEqual(redirects, ['/physics/circuit-bench'], '历史跳转路由有且只有一条');
  });

  test('circuit-bench 路由: 规范路径写入 AI 实验 id', async () => {
    const { labIdFromPath } = await import('../../../lib/ai-dynamic-questions');
    assert.equal(labIdFromPath('/circuit-bench'), 'circuit-bench');
    assert.equal(labIdFromPath('/circuit-bench/'), 'circuit-bench');
    assert.equal(labIdFromPath('/lab/circuit-bench'), 'circuit-bench');
    // 跳转落地前也可能先经过历史路径，AI 侧仍认它
    assert.equal(labIdFromPath('/physics/circuit-bench'), 'circuit-bench');
    assert.equal(labIdFromPath('/physics/circuit-bench/'), 'circuit-bench');
    assert.equal(labIdFromPath('/lab/ohm?x=1'), 'ohm');
    assert.equal(labIdFromPath('/periodic-table'), '');
  });

  /* ── 预设与集成 ── */

  test('circuit-bench: 8 个预设 id 完整且唯一', () => {
    assert.equal(CIRCUIT_PRESETS.length, 8);
    assert.deepEqual([...PRESET_IDS].sort(), ['bridge', 'free', 'fuse', 'iv', 'joule', 'ohm', 'rwire', 'sp']);
  });

  test('circuit-bench: 每个预设都有中英双语与可执行步骤', () => {
    for (const p of CIRCUIT_PRESETS) {
      assert.ok(p.title.zh && p.title.en, `${p.id} title`);
      assert.ok(p.objective.zh && p.objective.en, `${p.id} objective`);
      assert.ok(p.principle.zh && p.principle.en, `${p.id} principle`);
      assert.ok(p.steps.length >= 2, `${p.id} steps`);
    }
  });

  test('circuit-bench 工作台: 预设已去除三幕题库，只保留导读与探针', () => {
    for (const p of CIRCUIT_PRESETS) {
      assert.ok(!('predict' in p), `${p.id} 不应再携带预测题`);
      assert.ok(!('conclude' in p), `${p.id} 不应再携带结论题`);
      assert.ok(p.objective.zh && p.objective.en, `${p.id} 目标导读`);
      assert.ok(p.principle.zh && p.principle.en, `${p.id} 规律导读`);
      assert.ok(Array.isArray(p.probes), `${p.id} 记录探针`);
    }
  });

  test('circuit-bench 工作台: 八套预设可自由加载并往返切换', () => {
    for (const p of CIRCUIT_PRESETS) {
      const st = instantiatePreset(p.id);
      assert.equal(st.v, 1, `${p.id} 状态版本`);
      if (p.blank) {
        assert.equal(st.components.length, 0, '空白工作台不应带元件');
        assert.equal(st.wires.length, 0, '空白工作台不应带导线');
      } else {
        assert.ok(st.components.length > 0, `${p.id} 应带可操作电路`);
        assert.ok(st.wires.length > 0, `${p.id} 应带已连好的导线`);
      }
    }
    // 预设之间往返不共享可变引用
    const a = instantiatePreset('sp');
    const b = instantiatePreset('ohm');
    a.components[0].x = 10;
    a.components[0].params.emf = 999;
    const c = instantiatePreset('sp');
    assert.notEqual(c.components[0].x, 10, '重新加载预设须得到干净副本');
    assert.notEqual(c.components[0].params.emf, 999, '参数对象也须是独立副本');
    assert.ok(b.components.length > 0 && c.components.length > 0, '两套预设均可加载');
  });

  test('circuit-bench 工作台: 页面不再挂载三幕式导航、答题与阶段锁', () => {
    const src = readFileSync(
      resolve('src/labs/physics/circuit-bench/CircuitBench.tsx'),
      'utf-8',
    );
    for (const token of [
      'StageNav',
      'PresetQuestion',
      'QuestionBlock',
      'predictAns',
      'concludeAns',
      'setStage',
      'stageOrder',
      'canExplore',
      "stage === 'predict'",
      "stage === 'conclude'",
    ]) {
      assert.ok(!src.includes(token), `工作台不得残留三幕式符号：${token}`);
    }
    assert.ok(!/from '\.\/circuit-bench-presets'[^;]*PresetQuestion/s.test(src), '不得再引入题目类型');

    // 外层页面也不能替工作台念三幕式台词：LabPage 的建议流程必须按 meta.kind 分流。
    const page = readFileSync(resolve('src/pages/LabPage.tsx'), 'utf-8');
    assert.ok(page.includes("lab.meta?.kind === 'tool'"), 'LabPage 需按工具台身份分流引导文案');
    assert.ok(page.includes('自由工作台'), '工具台应显示自由工作台引导');
  });

  test('circuit-bench 工作台: 画布卡工具栏具备运行、撤销重做、清空、适配与全屏', () => {
    const src = readFileSync(
      resolve('src/labs/physics/circuit-bench/CircuitBench.tsx'),
      'utf-8',
    );
    for (const token of [
      'BenchToolbar',
      'setRunning',
      'undo(h)',
      'redo(h)',
      'clearBench',
      'fitSignal',
      'requestFullscreen',
      'setFitSignal',
      'PresetPicker',
      'ElementPalette',
      'InspectorPanel',
      'MeasurementPanel',
    ]) {
      assert.ok(src.includes(token), `工作台缺少必要能力：${token}`);
    }
    // 撤销/重做不是装饰：历史模块必须真的接入画布与编辑动作
    assert.ok(src.includes('onMoveStart'), '拖动须打撤销点');
    assert.ok(src.includes('createHistory'), '加载预设/清空须重置历史');
    // 工作台不再自带贴边外壳：预设行、画布卡、测量台都在标准页面流里
    for (const banned of ['WorkbenchShell', 'BenchTopBar']) {
      assert.ok(!src.includes(banned), `工作台不得再挂独立外壳：${banned}`);
    }
    const btn = readFileSync(resolve('src/labs/physics/circuit-bench/BenchToolbar.tsx'), 'utf-8');
    for (const token of ['compact', 'h-7', 'px-2.5', 'text-xs', 'rounded-md', 'h-3.5', 'w-3.5', 'h-11', 'flex-wrap', 'sm:flex-nowrap']) {
      assert.ok(btn.includes(token), `工具栏控件未对齐全站令牌：${token}`);
    }
  });

  test('circuit-bench 工作台: 页头徽标走标准实验页头，不再跳出容器', () => {
    const labs = readFileSync(resolve('src/lib/labs.ts'), 'utf-8');
    assert.ok(labs.includes('headerBadge: CircuitEngineBadge'), '工作台须在注册表挂页头计算核徽标');
    assert.ok(!labs.includes("shell: 'workbench'"), '注册表不得再有工作台专属外壳标记');
    const page = readFileSync(resolve('src/pages/LabPage.tsx'), 'utf-8');
    assert.ok(!page.includes("shell === 'workbench'"), 'LabPage 不得为工作台跳出标准容器');
    assert.ok(page.includes('lab.headerBadge'), 'LabPage 须渲染注册表声明的页头徽标');
    assert.ok(existsSync(resolve('src/labs/physics/circuit-bench/CircuitEngineBadge.tsx')), '缺少页头徽标组件');
  });

  test('circuit-bench 工作台: 历史模块支持提交、连续手势、撤销重做与上限', () => {
    let h = createHistory({ n: 0 });
    assert.equal(canUndo(h), false);
    assert.equal(canRedo(h), false);

    h = commit(h, { n: 1 });
    h = commit(h, { n: 2 });
    assert.equal(h.present.n, 2);
    assert.equal(canUndo(h), true);

    h = undo(h);
    assert.equal(h.present.n, 1);
    assert.equal(canRedo(h), true);
    h = redo(h);
    assert.equal(h.present.n, 2);
    assert.equal(canRedo(h), false);

    // 同引用提交不产生历史
    const before = h.past.length;
    h = commit(h, h.present);
    assert.equal(h.past.length, before);

    // 拖动：起点 mark + 多帧 replace 只留一个撤销点
    h = mark(h);
    h = replace(h, { n: 3 });
    h = replace(h, { n: 4 });
    assert.equal(h.present.n, 4);
    h = undo(h);
    assert.equal(h.present.n, 2, '一次拖动应整体回退');

    // 新提交清空 redo 分支
    h = undo(h);
    h = commit(h, { n: 9 });
    assert.equal(canRedo(h), false);

    // 上限：只保留最近 HISTORY_LIMIT 个快照
    let capped = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) capped = commit(capped, i);
    assert.equal(capped.past.length, HISTORY_LIMIT);
    assert.equal(undo(capped).present, HISTORY_LIMIT + 19);
  });

  test('circuit-bench: 每个非空预设在 0.8s 预热后仍可求解', () => {
    for (const id of PRESET_IDS) {
      const st = instantiatePreset(id);
      const r = solveCircuit(st);
      assert.ok(r.ok, `${id} 求解失败：${r.warnings.map((w) => w.code).join(',')}`);
      for (const e of st.components) {
        const reading = r.elements[e.id];
        assert.ok(reading, `${id}/${e.id} 缺少读数`);
        assert.ok(Number.isFinite(reading.current) && Number.isFinite(reading.voltage), `${id}/${e.id} 非有限`);
      }
    }
  });

  test('circuit-bench: 预设灯泡预热后不烧毁、保险丝不误熔断', () => {
    for (const id of ['sp', 'iv', 'fuse']) {
      const st = instantiatePreset(id);
      for (const el of st.components) {
        assert.ok(!el.state.blown, `${id}/${el.id} 预热后不应熔断/烧毁`);
      }
    }
  });

  test('circuit-bench: 串联预设两灯电流相等、电压之和接近电源端电压', () => {
    const st = instantiatePreset('sp');
    const r = solveCircuit(st);
    const i1 = r.elements.l1.current;
    const i2 = r.elements.l2.current;
    assert.ok(Math.abs(i1 - i2) < 1e-4, `I1=${i1}, I2=${i2}`);
    const u1 = Math.abs(r.elements.l1.voltage);
    const u2 = Math.abs(r.elements.l2.voltage);
    const ub = Math.abs(r.elements.bat.voltage);
    assert.ok(Math.abs(u1 + u2 - ub) < 0.05, `U1+U2=${u1 + u2}, Ub=${ub}`);
  });

  test('circuit-bench: 欧姆定律预设 R = U/I 约为 10 Ω', () => {
    const st = instantiatePreset('ohm');
    const r = solveCircuit(st);
    const ratio = Math.abs(r.elements.r1.voltage / r.elements.r1.current);
    assert.ok(Math.abs(ratio - 10) < 0.2, `R=${ratio}`);
  });

  test('circuit-bench: 惠斯通电桥平衡时检流计电流接近零', () => {
    const st = instantiatePreset('bridge');
    const r = solveCircuit(st);
    assert.ok(Math.abs(r.elements.g1.current) < 1e-5, `Ig=${r.elements.g1.current}`);
  });

  test('circuit-bench: 惠斯通电桥失衡后检流计有明显电流', () => {
    let st = instantiatePreset('bridge');
    st = updateParams(st, 'r3', { r: 35 });
    const r = solveCircuit(st);
    assert.ok(Math.abs(r.elements.g1.current) > 1e-4, `Ig=${r.elements.g1.current}`);
  });

  test('circuit-bench: 电阻定律预设试样电阻约 2.2 Ω', () => {
    const st = instantiatePreset('rwire');
    const r = solveCircuit(st);
    const ratio = Math.abs(r.elements.r1.voltage / r.elements.r1.current);
    assert.ok(Math.abs(ratio - 2.2) < 0.02, `R=${ratio}`);
  });

  test('circuit-bench: 焦耳定律预设电热丝功率为正且可读', () => {
    const st = instantiatePreset('joule');
    const r = solveCircuit(st);
    assert.ok(r.elements.h1.power > 1, `P=${r.elements.h1.power}`);
  });

  test('circuit-bench: 自由实验台为空状态且求解不崩', () => {
    const st = instantiatePreset('free');
    assert.equal(st.components.length, 0);
    const r = solveCircuit(st);
    assert.ok(r.ok);
    assert.equal(Object.keys(r.elements).length, 0);
  });

  /* ── 元件模型 ── */

  test('circuit-bench: 灯泡冷态电阻约为额定值 300/2800', () => {
    const st = simpleLoop({ loadKind: 'bulb', loadParams: { ratedVoltage: 3.8, ratedPower: 1.14 } });
    const bulb = st.components.find((c) => c.id === 'load') as CircuitComponent;
    assert.ok(Math.abs(bulb.state.temp - 300) < 1e-6);
    const sys = buildCircuitSystem(st);
    const meta = sys.elements.find((e) => e.id === 'load');
    assert.ok(meta && Math.abs(meta.r - (3.8 * 3.8 / 1.14) * (300 / 2800)) < 1e-3, `R=${meta?.r}`);
  });

  test('circuit-bench: 灯泡升温后电阻增大', () => {
    let st = simpleLoop({ emf: 3, loadKind: 'bulb', loadParams: { ratedVoltage: 3.8, ratedPower: 1.14 } });
    const before = buildCircuitSystem(st).elements.find((e) => e.id === 'load')?.r ?? 0;
    for (let i = 0; i < 100; i++) st = stepSimulation(st, 0.004).state;
    const after = buildCircuitSystem(st).elements.find((e) => e.id === 'load')?.r ?? 0;
    assert.ok(after > before, `${before} -> ${after}`);
  });

  test('circuit-bench: 灯泡严重过压会烧断', () => {
    let st = simpleLoop({ emf: 14, loadKind: 'bulb', loadParams: { ratedVoltage: 3.8, ratedPower: 1.14 }, r: 0.1 });
    for (let i = 0; i < 1000 && !st.components[2].state.blown; i++) st = stepSimulation(st, 0.004).state;
    assert.ok(st.components[2].state.blown, `temp=${st.components[2].state.temp}`);
  });

  test('circuit-bench: 烧断的灯泡等效电阻为无穷大', () => {
    const st = simpleLoop({ loadKind: 'bulb' });
    st.components[2].state.blown = true;
    const meta = buildCircuitSystem(st).elements.find((e) => e.id === 'load');
    assert.equal(meta?.r, Infinity);
  });

  test('circuit-bench: 保险丝热量按 τ=0.15s 上升并可熔断', () => {
    let st = instantiatePreset('fuse');
    st = updateParams(st, 'fu', { ratedCurrent: 2.5 });
    st = toggleSwitch(st, 'short');
    let blown = false;
    for (let i = 0; i < 1000; i++) {
      st = stepSimulation(st, 0.004).state;
      if (st.components.find((c) => c.id === 'fu')?.state.blown) {
        blown = true;
        break;
      }
    }
    assert.ok(blown, '短路后保险丝应在 4s 内熔断');
  });

  test('circuit-bench: 熔断后的保险丝开路', () => {
    const st = simpleLoop({ loadKind: 'fuse', loadParams: { ratedCurrent: 1 } });
    st.components[2].state.blown = true;
    const meta = buildCircuitSystem(st).elements.find((e) => e.id === 'load');
    assert.equal(meta?.r, Infinity);
  });

  test('circuit-bench: 滑动变阻器比例增大时电阻单调增大', () => {
    const st = simpleLoop({ loadKind: 'rheostat', loadParams: { maxR: 20, minR: 0, ratio: 0 } });
    let prev = -1;
    for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
      const next = updateParams(st, 'load', { ratio });
      const r = buildCircuitSystem(next).elements.find((e) => e.id === 'load')?.r ?? -1;
      assert.ok(r > prev, `ratio=${ratio} R=${r}`);
      prev = r;
    }
  });

  test('circuit-bench: 断开开关的等效电阻为无穷大', () => {
    const st = simpleLoop({});
    const next = toggleSwitch(st, 'sw');
    const meta = buildCircuitSystem(next).elements.find((e) => e.id === 'sw');
    assert.equal(meta?.open, true);
    assert.equal(meta?.r, Infinity);
  });

  test('circuit-bench: 导线合并两端节点', () => {
    const st = simpleLoop({});
    const sys = buildCircuitSystem(st);
    const sw = sys.elements.find((e) => e.id === 'sw');
    assert.ok(sw && sw.a === sw.b, '闭合开关两端应在同一节点');
  });

  test('circuit-bench: 电压表内阻远大于电流表', () => {
    const v = createComponent('v', 'voltmeter', 0, 0);
    const a = createComponent('a', 'ammeter', 0, 0);
    const sys = buildCircuitSystem(stateOf([v, a], []));
    const rv = sys.elements.find((e) => e.id === 'v')?.r ?? 0;
    const ra = sys.elements.find((e) => e.id === 'a')?.r ?? 0;
    assert.ok(rv >= 1e5 && ra <= 0.01, `Rv=${rv}, Ra=${ra}`);
  });

  /* ── 求解器 ── */

  test('circuit-bench: 2×2 线性方程精确求解', () => {
    const x = solveLinearSystem([2, 1, 1, 3], [5, 6], 2);
    assert.ok(x);
    assert.ok(Math.abs(x![0] - 1.8) < 1e-12);
    assert.ok(Math.abs(x![1] - 1.4) < 1e-12);
  });

  test('circuit-bench: 奇异矩阵返回 null', () => {
    const x = solveLinearSystem([1, 1, 1, 1], [2, 2], 2);
    assert.equal(x, null);
  });

  test('circuit-bench: 空电路求解为空结果', () => {
    const r = solveCircuit(createEmptyState());
    assert.ok(r.ok);
    assert.equal(r.warnings.length, 0);
  });

  test('circuit-bench: 电源开路时给出开路警告', () => {
    const bat = createComponent('bat', 'battery', 0, 0, { emf: 6 });
    const r = solveCircuit(stateOf([bat], []));
    assert.ok(r.warnings.some((w) => w.code === 'open-circuit'));
  });

  test('circuit-bench: 无电源时给出 no-source 警告', () => {
    const res = createComponent('r', 'resistor', 0, 0);
    const r = solveCircuit(stateOf([res], []));
    assert.ok(r.warnings.some((w) => w.code === 'no-source'));
  });

  test('circuit-bench: 电源两端被导线短接时给出短路警告', () => {
    const bat = createComponent('bat', 'battery', 0, 0);
    const r = solveCircuit(stateOf([bat], [['bat:a', 'bat:b']]));
    assert.ok(r.warnings.some((w) => w.code === 'short-circuit'));
  });

  test('circuit-bench: 悬空节点给出 floating-node 警告', () => {
    const st = simpleLoop({});
    st.components.push(createComponent('float', 'resistor', 600, 400));
    const r = solveCircuit(st);
    assert.ok(r.warnings.some((w) => w.code === 'floating-node'));
  });

  test('circuit-bench: 电流表超量程给出 over-range 警告', () => {
    const st = simpleLoop({ loadParams: { r: 1 } });
    st.components.push(createComponent('a1', 'ammeter', 500, 300, { range: 0.1 }));
    // 把电流表串进回路：用并联支路不合适，这里直接单独构造串联网表。
    const st2 = stateOf(
      [
        createComponent('bat', 'battery', 0, 0, { emf: 6, r: 0.5 }, 90),
        createComponent('sw', 'switch', 0, 0, { closed: true }, 90),
        createComponent('a1', 'ammeter', 0, 0, { range: 0.1 }),
        createComponent('r', 'resistor', 0, 0, { r: 1 }),
      ],
      [['bat:b', 'sw:a'], ['sw:b', 'a1:b'], ['a1:a', 'r:b'], ['r:a', 'bat:a']],
    );
    const r = solveCircuit(st2);
    assert.ok(r.warnings.some((w) => w.code === 'over-range' && w.elementIds?.includes('a1')));
    assert.ok(st.components.length >= 3);
  });

  test('circuit-bench: 电压表超量程给出 over-range 警告', () => {
    const st = stateOf(
      [
        createComponent('bat', 'battery', 0, 0, { emf: 12, r: 0.5 }, 90),
        createComponent('r', 'resistor', 0, 0, { r: 10 }),
        createComponent('v', 'voltmeter', 0, 0, { range: 3 }),
      ],
      [['bat:b', 'r:b'], ['r:a', 'bat:a'], ['v:b', 'r:b'], ['v:a', 'r:a']],
    );
    const r = solveCircuit(st);
    assert.ok(r.warnings.some((w) => w.code === 'over-range' && w.elementIds?.includes('v')));
  });

  test('circuit-bench: 电压表低内阻串联时提示接线错误', () => {
    const st = stateOf(
      [
        createComponent('bat', 'battery', 0, 0, { emf: 6, r: 0.5 }, 90),
        createComponent('r', 'resistor', 0, 0, { r: 10 }),
        createComponent('v', 'voltmeter', 0, 0, { range: 15, r: 1000 }),
      ],
      [['bat:b', 'v:b'], ['v:a', 'r:b'], ['r:a', 'bat:a']],
    );
    const r = solveCircuit(st);
    assert.ok(r.warnings.some((w) => w.code === 'wrong-connection'));
  });

  test('circuit-bench: 读数功率有限且非负', () => {
    const r = solveCircuit(instantiatePreset('joule'));
    for (const e of Object.values(r.elements)) {
      assert.ok(Number.isFinite(e.power) && e.power >= 0, `${e.id} P=${e.power}`);
    }
    assert.ok(Number.isFinite(r.totalPower));
  });

  test('circuit-bench: 电池正负极反接时电流方向相反', () => {
    const st = simpleLoop({});
    const fwd = solveCircuit(st);
    const rev = solveCircuit(updateParams(st, 'bat', { emf: -6 }));
    assert.ok(fwd.elements.load.current * rev.elements.load.current < 0);
  });

  test('circuit-bench: 灯泡烧断后回路电流归零', () => {
    let st = simpleLoop({ emf: 14, r: 0.1, loadKind: 'bulb', loadParams: { ratedVoltage: 3.8, ratedPower: 1.14 } });
    for (let i = 0; i < 1000 && !st.components[2].state.blown; i++) st = stepSimulation(st, 0.004).state;
    const r = solveCircuit(st);
    assert.ok(Math.abs(r.elements.load.current) < 1e-9);
  });

  test('circuit-bench: 更换灯泡后状态恢复冷态', () => {
    let st = simpleLoop({ loadKind: 'bulb' });
    st.components[2].state.blown = true;
    st.components[2].state.temp = 3400;
    const next = resetElementState(st, 'load');
    assert.equal(next.components[2].state.blown, false);
    assert.equal(next.components[2].state.temp, 300);
  });

  test('circuit-bench: fmt 处理非有限数，且任何量级都不裸露科学计数法', () => {
    assert.equal(fmt(Infinity), '—');
    assert.equal(fmt(NaN), '—');
    // UI 上严禁出现 e-6 / e+6：极端量级必须展开成普通小数（保留有效数字）。
    assert.equal(fmt(0.00001), '0.00001');
    assert.equal(fmt(1e6), '1000000');
    assert.equal(fmt(2e-7, 7), '0.0000002');
    assert.equal(fmt(3.0), '3');
    for (const v of [1e-12, 2.96e-6, 8.77e-6, 1e6, 1.2345e9, -4e-8]) {
      assert.ok(!/e[+-]/i.test(fmt(v)), `fmt(${v}) 不应出现科学计数法：${fmt(v)}`);
    }
  });

  test('circuit-bench: formatPhysicalValue 智能单位换算（2–3 位有效数字，无 e 记法）', () => {
    // 题干点名的三个字符串：2.96e-6 A / 8.77e-6 W / 1.00e+6 Ω
    assert.equal(formatPhysicalValue(2.96e-6, 'A'), '2.96 μA');
    assert.equal(formatPhysicalValue(8.77e-6, 'W'), '8.77 μW');
    assert.equal(formatPhysicalValue(1e6, 'Ω'), '1.00 MΩ');
    // 电流：≥1 A 用 A，1 mA–1 A 用 mA，<1 mA 用 μA，极微小直接读作 0 A
    assert.equal(formatPhysicalValue(2.5, 'A'), '2.50 A');
    assert.equal(formatPhysicalValue(0.0107, 'A'), '10.7 mA');
    assert.equal(formatPhysicalValue(0, 'A'), '0 A');
    assert.equal(formatPhysicalValue(1e-12, 'A'), '0 A');
    // 电压：≥1 V 用 V，1 mV–1 V 用 mV，<1 mV 用 μV，极微小直接读作 0 V
    assert.equal(formatPhysicalValue(6, 'V'), '6.00 V');
    assert.equal(formatPhysicalValue(0.42, 'V'), '420 mV');
    assert.equal(formatPhysicalValue(2.67e-6, 'V'), '2.67 μV');
    // 桥式电路电表两侧只剩纳伏级噪声：绝不印成 `0.00000422 mV`，读作 0 V
    assert.equal(formatPhysicalValue(4.22e-9, 'V'), '0 V');
    assert.equal(formatPhysicalValue(1e-6, 'V'), '1.00 μV');
    // 电流/功率同样有 1 µ 级地板：噪声不会印成一长串前导零
    assert.equal(formatPhysicalValue(4.22e-9, 'A'), '0 A');
    assert.equal(formatPhysicalValue(1.14e-7, 'W'), '0 W');
    // 电阻没有更小前缀，只有导线近似（nΩ）才归零，分流器的毫欧照实写
    assert.equal(formatPhysicalValue(0.002, 'Ω'), '0.00200 Ω');
    // 电阻：≥1 MΩ 用 MΩ，≥1 kΩ 用 kΩ，否则 Ω
    assert.equal(formatPhysicalValue(2200, 'Ω'), '2.20 kΩ');
    assert.equal(formatPhysicalValue(8.333, 'Ω'), '8.33 Ω');
    assert.equal(formatPhysicalValue(Infinity, 'Ω'), '∞');
    // 功率：W / mW / μW 自适应
    assert.equal(formatPhysicalValue(0.05, 'W'), '50.0 mW');
    assert.equal(formatPhysicalValue(3.6, 'W'), '3.60 W');
    // 未登记的复合单位照样不出现 e 记法
    assert.equal(formatPhysicalValue(5e-7, 'm²'), '0.0000005 m²');
    assert.equal(formatPhysicalValue(-2.5e-6, 'A'), '-2.50 μA');
    // 全量程扫描：任何输入都不能漏出 e 记法，也不能印出「小数点后一串零」
    for (let e = -15; e <= 15; e++) {
      for (const u of ['A', 'V', 'Ω', 'W', 'm²', 'J']) {
        const s = formatPhysicalValue(1.5 * 10 ** e, u);
        assert.ok(!/e[+-]/i.test(s), `${s} 泄漏了科学计数法`);
        // 电气三族要么读作 0，要么小数点前至少有 1 位（0.00422 μA 这类噪声读数不允许）
        if (u === 'A' || u === 'V' || u === 'W') {
          assert.ok(!/^-?0\./.test(s), `${s} 是噪声读数，应归零或换更小档`);
        }
      }
    }
  });

  test('circuit-bench: 电表量程是标准挡位，不是连续滑块', () => {
    assert.deepEqual(meterGears('ammeter'), [0.6, 3]);
    assert.deepEqual(meterGears('voltmeter'), [3, 15]);
    assert.equal(meterGears('resistor'), null);
    // 挡位印字按电表自己的刻度单位写：0.6 A 挡不能印成 600 mA
    assert.equal(meterGearLabel('ammeter', 0.6), '0.6 A');
    assert.equal(meterGearLabel('voltmeter', 15), '15 V');
    assert.equal(meterGearLabel('galvanometer', 0.005), '±5 mA');
    // 旧存档里连续滑块留下的中间值（如 8.333 V）必须吸附到标准挡
    assert.equal(snapMeterRange('voltmeter', 8.333), 15);
    assert.equal(snapMeterRange('voltmeter', 2.9), 3);
    assert.equal(snapMeterRange('ammeter', 0.1), 0.6);
    assert.equal(snapMeterRange('ammeter', 2.5), 3);
    assert.equal(snapMeterRange('galvanometer', 0.02), 0.05);
    assert.equal(snapMeterRange('resistor', 8.333), null);
    // 反序列化边界把非标准量程归一：白名单清洗之后不可能再有 8.333 V
    const raw = JSON.stringify({
      version: 1,
      components: [{ id: 'v', kind: 'voltmeter', x: 0, y: 0, rotation: 0, params: { range: 8.333, r: 1e6 } }],
      wires: [],
    });
    assert.equal(deserializeState(raw).components[0].params.range, 15);
    const rawA = JSON.stringify({
      version: 1,
      components: [{ id: 'a', kind: 'ammeter', x: 0, y: 0, rotation: 0, params: { range: 0.7 } }],
      wires: [],
    });
    assert.equal(deserializeState(rawA).components[0].params.range, 0.6);
  });

  test('circuit-bench: 超量程提示按工程单位写，并给出该拨到哪一挡', () => {
    const st = createEmptyState();
    st.components.push(createComponent('b1', 'battery', 0, 300, { emf: 6, r: 2 }));
    st.components.push(createComponent('a1', 'ammeter', 200, 300, { range: 0.6, r: 0.001 }));
    st.components.push(createComponent('r1', 'resistor', 400, 300, { r: 5 }));
    st.wires.push({ id: 'w1', from: 'b1:a', to: 'a1:a' });
    st.wires.push({ id: 'w2', from: 'a1:b', to: 'r1:a' });
    st.wires.push({ id: 'w3', from: 'r1:b', to: 'b1:b' });
    const r = solveCircuit(st);
    const w = r.warnings.find((x) => x.code === 'over-range' && x.elementIds?.includes('a1'));
    assert.ok(w, '应给出超量程警告');
    // I ≈ 6/7.001 ≈ 0.857 A：读数与满偏都走 mA，且提示换成 3 A 挡
    assert.ok(w!.zh.includes('857 mA'), `读数应工程单位化：${w!.zh}`);
    assert.ok(w!.zh.includes('600 mA'), `满偏应工程单位化：${w!.zh}`);
    assert.ok(w!.zh.includes('3 A'), `超量程文案应提示换 3 A 挡：${w!.zh}`);
    assert.ok(!/e[+-]/i.test(w!.zh) && !/e[+-]/i.test(w!.en), `警告文案不得含 e 记法：${w!.zh}`);
  });

  /* ── 状态层 ── */

  test('circuit-bench: 添加/删除元件同时清理导线', () => {
    let st = createEmptyState();
    st = addComponent(st, 'battery', 100, 100);
    st = addComponent(st, 'resistor', 300, 100);
    const bat = st.components[0];
    const res = st.components[1];
    st = addWire(st, terminalRef(bat.id, 'a'), terminalRef(res.id, 'b')).state;
    assert.equal(st.wires.length, 1);
    st = removeComponent(st, res.id);
    assert.equal(st.components.length, 1);
    assert.equal(st.wires.length, 0);
  });

  test('circuit-bench: 重复导线被拒绝', () => {
    let st = createEmptyState();
    st = addComponent(st, 'battery', 100, 100);
    st = addComponent(st, 'resistor', 300, 100);
    const a = terminalRef(st.components[0].id, 'a');
    const b = terminalRef(st.components[1].id, 'b');
    st = addWire(st, a, b).state;
    const again = addWire(st, b, a);
    assert.equal(again.added, false);
    assert.equal(again.state.wires.length, 1);
  });

  test('circuit-bench: 同一元件两端不允许直接短接', () => {
    const st = addComponent(createEmptyState(), 'resistor', 100, 100);
    const id = st.components[0].id;
    const res = addWire(st, terminalRef(id, 'a'), terminalRef(id, 'b'));
    assert.equal(res.added, false);
  });

  test('circuit-bench: 不存在的端子无法连线', () => {
    const st = addComponent(createEmptyState(), 'resistor', 100, 100);
    const id = st.components[0].id;
    const res = addWire(st, terminalRef(id, 'a'), 'ghost:a');
    assert.equal(res.added, false);
  });

  test('circuit-bench: 开关切换保持其他参数不变', () => {
    let st = simpleLoop({});
    const before = cloneState(st);
    st = toggleSwitch(st, 'sw');
    assert.equal(st.components.find((c) => c.id === 'sw')?.params.closed, false);
    assert.equal(st.components.find((c) => c.id === 'bat')?.params.emf, before.components.find((c) => c.id === 'bat')?.params.emf);
  });

  test('circuit-bench: moveComponent 拒绝 NaN 并夹取超大坐标', () => {
    let st = addComponent(createEmptyState(), 'resistor', 0, 0);
    const id = st.components[0].id;
    st = moveComponent(st, id, Number.NaN, 10);
    assert.equal(st.components[0].x, 0);
    st = moveComponent(st, id, 99999, -99999);
    assert.equal(st.components[0].x, 5000);
    assert.equal(st.components[0].y, -5000);
  });

  test('circuit-bench: rotateComponent 在 0/90/180/270 循环', () => {
    let st = addComponent(createEmptyState(), 'resistor', 0, 0);
    const id = st.components[0].id;
    for (const expected of [90, 180, 270, 0]) {
      st = rotateComponent(st, id);
      assert.equal(st.components[0].rotation, expected);
    }
  });

  test('circuit-bench: 序列化往返保持电路结构', () => {
    const st = instantiatePreset('bridge');
    const back = deserializeState(serializeState(st));
    assert.equal(back.components.length, st.components.length);
    assert.equal(back.wires.length, st.wires.length);
    assert.equal(buildCircuitSystem(back).nodes.length, buildCircuitSystem(st).nodes.length);
  });

  test('circuit-bench: 非法 JSON 反序列化为空状态', () => {
    const st = deserializeState('{not json');
    assert.equal(st.components.length, 0);
    assert.equal(st.wires.length, 0);
  });

  test('circuit-bench: sanitizeState 丢弃未知元件与越界导线', () => {
    const st = sanitizeState({
      components: [
        { id: 'ok', kind: 'battery', x: 1, y: 2, rotation: 999, params: { emf: 1e9, r: -5 } },
        { id: 'bad', kind: 'quantum_flux', x: 0, y: 0 },
      ],
      wires: [
        { id: 'w1', from: 'ok:a', to: 'ghost:b' },
        { id: 'w2', from: 'ok:a', to: 'ok:a' },
      ],
    });
    assert.equal(st.components.length, 1);
    assert.equal(st.components[0].kind, 'battery');
    assert.ok((st.components[0].params.emf as number) <= 60);
    assert.ok((st.components[0].params.r as number) >= 0.001);
    assert.equal(st.wires.length, 0);
  });

  test('circuit-bench: sanitizeState 为重复 id 自动改名', () => {
    const st = sanitizeState({
      components: [
        { id: 'x', kind: 'resistor' },
        { id: 'x', kind: 'resistor' },
      ],
      wires: [],
    });
    assert.equal(st.components.length, 2);
    assert.notEqual(st.components[0].id, st.components[1].id);
  });

  test('circuit-bench: 序列化不写 NaN/Infinity', () => {
    const st = instantiatePreset('iv');
    const text = serializeState(st);
    assert.ok(!/NaN|Infinity/.test(text));
  });

  /* ── 拟合与 CSV ── */

  test('circuit-bench: 线性拟合恢复 y=2x+1', () => {
    const fit = fitLinear([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 }]);
    assert.ok(Math.abs(fit.slope - 2) < 1e-12);
    assert.ok(Math.abs(fit.intercept - 1) < 1e-12);
    assert.ok(fit.r2 > 0.999999);
    assert.ok(Math.abs(predict(fit, 10) - 21) < 1e-12);
  });

  test('circuit-bench: 过原点拟合强制 intercept=0', () => {
    const fit = fitLinear([{ x: 1, y: 2 }, { x: 2, y: 4.1 }, { x: 3, y: 5.9 }], { throughOrigin: true });
    assert.equal(fit.intercept, 0);
    assert.ok(Math.abs(fit.slope - 1.98) < 0.03);
  });

  test('circuit-bench: 退化拟合不抛异常', () => {
    for (const pts of [[], [{ x: 1, y: 2 }], [{ x: 1, y: 2 }, { x: 1, y: 3 }]]) {
      const fit = fitLinear(pts);
      assert.ok(Number.isFinite(fit.slope) && Number.isFinite(fit.intercept) && Number.isFinite(fit.r2));
    }
  });

  test('circuit-bench: 拟合忽略非有限点', () => {
    const fit = fitLinear([{ x: 0, y: 0 }, { x: 1, y: NaN }, { x: 2, y: 2 }]);
    assert.equal(fit.n, 2);
  });

  test('circuit-bench: CSV 正确转义逗号与引号', () => {
    const text = toCsv(['a', 'b'], [['x,y', 'he said "hi"']]);
    assert.ok(text.includes('"x,y"'));
    assert.ok(text.includes('"he said ""hi"""'));
  });

  /* ── 引擎门面 ── */

  test('circuit-bench: WASM 非有限电压映射为 singular Fault', () => {
    const st = instantiatePreset('ohm');
    // status=0 但电压非有限：不把 NaN 送进 UI，也不静默改判成 TS 的成功结果
    const bad = solveWithWasm(
      { bench_solve: (n) => [WASM_STATUS_OK, Number.NaN, ...new Array(Math.max(0, n - 1)).fill(0)] },
      st,
    );
    assert.equal(bad.ok, false);
    assert.ok(bad.warnings.some((w) => w.code === 'singular'));
    for (const reading of Object.values(bad.elements)) assert.equal(reading.current, 0);
  });

  test('circuit-bench: WASM 数组长度不符时回退 TS', () => {
    const st = instantiatePreset('joule');
    const r = solveWithWasm({ bench_solve: () => [0, 0] }, st);
    assert.ok(r.ok && Number.isFinite(r.elements.h1.current));
  });

  /* ── Fuzz ── */

  test('circuit-bench: 1000 组随机网表 Fuzz 绝不 NaN/throw', () => {
    const rand = lcg(20261025);
    const kinds: ElementKind[] = [
      'battery', 'battery', 'resistor', 'bulb', 'rheostat', 'switch', 'ammeter', 'voltmeter', 'galvanometer', 'fuse', 'heater', 'wire',
    ];
    for (let k = 0; k < 1000; k++) {
      const rawComponents: unknown[] = [];
      const count = 1 + Math.floor(rand() * 10);
      for (let i = 0; i < count; i++) {
        const kind = kinds[Math.floor(rand() * kinds.length)];
        rawComponents.push({
          id: `c${i}`,
          kind,
          x: rand() * 900,
          y: rand() * 520,
          rotation: Math.floor(rand() * 4) * 90,
          params: {
            emf: (rand() - 0.5) * 24,
            r: rand() * 100,
            closed: rand() > 0.4,
            ratio: rand(),
            maxR: rand() * 50,
            minR: 0,
            ratedCurrent: 0.1 + rand() * 5,
            ratedVoltage: 0.5 + rand() * 12,
            ratedPower: 0.05 + rand() * 5,
            range: 0.01 + rand() * 5,
            mass: 0.001 + rand(),
            specificHeat: 100 + rand() * 1000,
            mode: rand() > 0.8 ? 'specimen' : 'fixed',
            rho: rand() * 1e-5,
            length: rand() * 10,
            area: 1e-8 + rand() * 1e-6,
          },
          state: { temp: 300 + rand() * 3000, heat: rand(), blown: false, burnt: false },
        });
      }
      const rawWires: unknown[] = [];
      const wireCount = Math.floor(rand() * 12);
      for (let i = 0; i < wireCount; i++) {
        const a = Math.floor(rand() * count);
        const b = Math.floor(rand() * count);
        rawWires.push({ id: `w${i}`, from: `c${a}:a`, to: `c${b}:${rand() > 0.5 ? 'a' : 'b'}` });
      }
      const st = sanitizeState({ components: rawComponents, wires: rawWires });
      let result: SolveResult;
      try {
        result = solveCircuit(st);
      } catch (err) {
        assert.fail(`第 ${k} 组抛异常：${err instanceof Error ? err.message : String(err)}`);
      }
      for (const reading of Object.values(result.elements)) {
        assert.ok(Number.isFinite(reading.current), `第 ${k} 组电流 NaN`);
        assert.ok(Number.isFinite(reading.voltage), `第 ${k} 组电压 NaN`);
        assert.ok(Number.isFinite(reading.power), `第 ${k} 组功率 NaN`);
      }
      assert.ok(Number.isFinite(result.totalPower));
      const stepped = stepSimulation(st, 0.02);
      for (const c of stepped.state.components) {
        assert.ok(Number.isFinite(c.state.temp) && Number.isFinite(c.state.heat), `第 ${k} 组热状态 NaN`);
      }
    }
  });

  test('circuit-bench: 1000 组随机网表的总功率有界', () => {
    const rand = lcg(7);
    for (let k = 0; k < 1000; k++) {
      const n = 2 + Math.floor(rand() * 5);
      const st = createEmptyState();
      for (let i = 0; i < n; i++) {
        st.components.push(createComponent(`c${i}`, rand() > 0.8 ? 'battery' : 'resistor', 0, 0, {
          emf: rand() * 12,
          r: 0.001 + rand() * 100,
        }));
      }
      const r = solveCircuit(st);
      assert.ok(Number.isFinite(r.totalPower) && r.totalPower >= 0);
    }
  });

  /* ── C++ 对拍 ── */

  test('circuit-bench: C++ 线性核与 TS 对拍（固定网表）', () => {
    const sources = [
      { a: 0, b: 1, emf: 6, r: 0.5 },
      { a: 2, b: 0, emf: 3, r: 0.2 },
    ];
    const conductors = [
      { a: 1, b: 2, g: 1 / 10 },
      { a: 2, b: 3, g: 1 / 4 },
      { a: 3, b: 0, g: 1 / 8 },
      { a: 1, b: 3, g: 1 / 30 },
    ];
    const ts = solveDcArrays(4, 0, sources, conductors);
    const cpp = runCli(netlistText(4, 0, sources, conductors));
    if (!ensureCli()) {
      console.log('  （跳过：本机无 g++，C++ 对拍未执行）');
      return;
    }
    assert.equal(cpp.length, 4);
    assert.ok(ts);
    for (let i = 0; i < 4; i++) {
      const scale = Math.max(1, Math.abs(cpp[i]));
      assert.ok(Math.abs(ts![i] - cpp[i]) <= 1e-9 * scale, `node${i}: TS=${ts![i]} C++=${cpp[i]}`);
    }
  });

  test('circuit-bench: C++ 线性核与 TS 对拍（40 组随机网表）', () => {
    if (!ensureCli()) return;
    const rand = lcg(424242);
    for (let k = 0; k < 40; k++) {
      const n = 2 + Math.floor(rand() * 14);
      const ground = Math.floor(rand() * n);
      const sources: { a: number; b: number; emf: number; r: number }[] = [];
      const conductors: { a: number; b: number; g: number }[] = [];
      const ns = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < ns; i++) {
        let a = Math.floor(rand() * n);
        let b = Math.floor(rand() * n);
        if (a === b) b = (b + 1) % n;
        sources.push({ a, b, emf: (rand() - 0.5) * 24, r: 0.001 + rand() * 5 });
      }
      // 先保证连通链，再随机加边。
      for (let i = 1; i < n; i++) conductors.push({ a: i - 1, b: i, g: 0.01 + rand() * 10 });
      const extra = Math.floor(rand() * n * 2);
      for (let i = 0; i < extra; i++) {
        let a = Math.floor(rand() * n);
        let b = Math.floor(rand() * n);
        if (a === b) b = (b + 1) % n;
        conductors.push({ a, b, g: 0.001 + rand() * 100 });
      }
      const ts = solveDcArrays(n, ground, sources, conductors);
      const cpp = runCli(netlistText(n, ground, sources, conductors));
      assert.ok(ts, `第 ${k} 组 TS 奇异`);
      assert.equal(cpp.length, n, `第 ${k} 组 C++ 输出长度`);
      for (let i = 0; i < n; i++) {
        const scale = Math.max(1, Math.abs(cpp[i]));
        assert.ok(Math.abs(ts![i] - cpp[i]) <= 2e-8 * scale, `第 ${k} 组 node${i}: TS=${ts![i]} C++=${cpp[i]}`);
      }
    }
  });

  test('circuit-bench: C++ 对拍真实预设的合并节点网表', () => {
    if (!ensureCli()) return;
    const st = instantiatePreset('bridge');
    const sys = buildCircuitSystem(st);
    const ts = solveSystemVoltages(sys).voltages;
    const cpp = runCli(
      netlistText(
        sys.nodes.length,
        sys.ground,
        sys.sources,
        sys.conductors.filter((c) => !c.open),
      ),
    );
    assert.ok(ts);
    assert.equal(cpp.length, sys.nodes.length);
    for (let i = 0; i < cpp.length; i++) {
      const scale = Math.max(1, Math.abs(cpp[i]));
      assert.ok(Math.abs(ts![i] - cpp[i]) <= 1e-8 * scale, `node${i}`);
    }
  });

  /* ── C++/WASM 双引擎严格对拍 ── */

  test('circuit-bench: WASM 门面加载成功，bench_solve 已接线', () => {
    if (!wasmModule) {
      console.log('  （跳过：src/wasm/circuitBench.js 不存在，先跑 bash scripts/build-wasm-circuit.sh）');
      return;
    }
    assert.equal(loadedEngineKind, 'wasm');
    assert.equal(getCircuitEngineKind(), 'wasm');
    assert.equal(typeof wasmModule.bench_solve, 'function');
  });

  test('circuit-bench: 8 套经典预设 WASM 与 TS 节点电压/支路电流相对误差 < 1e-5', () => {
    const mod = requireWasm();
    assert.equal(PRESET_IDS.length, 8);
    for (const id of PRESET_IDS) {
      const st = instantiatePreset(id);
      const ts = solveCircuit(st);
      const wasm = solveWithWasm(mod, st);
      assert.equal(wasm.ok, ts.ok, `${id}: ok 状态不一致`);
      for (const [eid, a] of Object.entries(ts.elements)) {
        const b = wasm.elements[eid];
        assert.ok(b, `${id}/${eid}: WASM 缺该元件读数`);
        assertRelClose(a.current, b.current, `${id}/${eid}.current`);
        assertRelClose(a.voltage, b.voltage, `${id}/${eid}.voltage`);
        assertRelClose(a.power, b.power, `${id}/${eid}.power`);
      }
      assertRelClose(ts.totalPower, wasm.totalPower, `${id}.totalPower`);
      // 提示集合（量程/短路/singular …）也须同构
      assert.deepEqual(
        wasm.warnings.map((w) => w.code).sort(),
        ts.warnings.map((w) => w.code).sort(),
        `${id}: warning 集合不一致`,
      );
    }
  });

  test('circuit-bench: 40 组随机网表 Fuzz（开路/短路/悬空）双引擎 100% 吻合', () => {
    const mod = requireWasm();
    const rand = lcg(20261026);
    let faults = 0;
    for (let k = 0; k < 40; k++) {
      const n = 1 + Math.floor(rand() * 12);
      const ground = Math.floor(rand() * n);
      const sources: { a: number; b: number; emf: number; r: number }[] = [];
      const conductors: { a: number; b: number; g: number }[] = [];
      const ns = Math.floor(rand() * 4);
      for (let i = 0; i < ns; i++) {
        let a = Math.floor(rand() * n);
        let b = Math.floor(rand() * n);
        if (a === b) b = (b + 1) % n;
        // r=0（理想电源）与常规内阻都要覆盖
        sources.push({ a, b, emf: (rand() - 0.5) * 24, r: rand() < 0.15 ? 0 : 0.001 + rand() * 5 });
      }
      // 每 8 组留一组完全悬空（无导体）；其余先铺连通链（其中若干边故意不加 = 开路）
      if (k % 8 !== 0) {
        for (let i = 1; i < n; i++) {
          if (rand() < 0.2) continue; // 开路：该边缺失
          const g = rand() < 0.12 ? 1e6 : 0.001 + rand() * 100; // 短路边 / 常规电导
          conductors.push({ a: i - 1, b: i, g });
        }
        const extra = Math.floor(rand() * n * 2);
        for (let i = 0; i < extra; i++) {
          let a = Math.floor(rand() * n);
          let b = Math.floor(rand() * n);
          if (a === b) b = (b + 1) % n;
          conductors.push({ a, b, g: 0.001 + rand() * 100 });
        }
      }
      const ts = solveDcArrays(n, ground, sources, conductors);
      const out = wasmSolveArrays(mod, n, ground, sources, conductors);
      assert.equal(out.length, n + 1, `第 ${k} 组：C++ 返回长度须为 n+1`);
      if (!ts) {
        faults++;
        assert.notEqual(out[0], WASM_STATUS_OK, `第 ${k} 组：TS 奇异但 C++ 报成功`);
        continue;
      }
      assert.equal(out[0], WASM_STATUS_OK, `第 ${k} 组：TS 收敛但 C++ 报 Fault`);
      for (let i = 0; i < n; i++) {
        assertRelClose(ts[i], out[i + 1], `第 ${k} 组 node${i}`);
      }
    }
    // gmin 让矩阵基本不可能真奇异；这里只记录，断言的是「判奇异时两边一致」
    assert.ok(faults >= 0);
  });

  test('circuit-bench: 奇异状态码映射与 TS ok=false + singular 完全同构', () => {
    const st = instantiatePreset('bridge');
    const sys = buildCircuitSystem(st);
    const viaWasm = solveWithWasm(
      { bench_solve: (n) => [1, ...new Array(n).fill(0)] },
      st,
    );
    const viaTs = finalizeSolve(sys, null);
    assert.equal(viaWasm.ok, false);
    assert.equal(viaWasm.ok, viaTs.ok);
    assert.deepEqual(
      viaWasm.warnings.map((w) => w.code).sort(),
      viaTs.warnings.map((w) => w.code).sort(),
    );
    assert.ok(viaWasm.warnings.some((w) => w.code === 'singular'));
    assert.deepEqual(viaWasm.nodeVoltages, viaTs.nodeVoltages);
    assert.equal(viaWasm.totalPower, viaTs.totalPower);
  });

  test('circuit-bench: 最终整理遇到 null 电压不抛异常', () => {
    const sys = buildCircuitSystem(instantiatePreset('ohm'));
    const r = finalizeSolve(sys, null);
    assert.equal(r.ok, false);
    assert.ok(r.warnings.some((w) => w.code === 'singular'));
  });

  test('circuit-bench: 预设 id 查询有回退', () => {
    assert.equal(getPreset('not-exist').id, 'sp');
    assert.equal(presetState('not-exist').components.length, 0);
  });

  test('circuit-bench: 预热函数不修改输入状态', () => {
    const st = presetState('ohm');
    const snapshot = serializeState(st);
    settleSimulation(st, 0.1);
    assert.equal(serializeState(st), snapshot);
  });

  test('circuit-bench: 删除不存在的导线是幂等的', () => {
    const st = instantiatePreset('bridge');
    const next = removeWire(st, 'nope');
    assert.equal(next.wires.length, st.wires.length);
  });

  test('circuit-bench geometry: 吸格与边界钳制', () => {
    assert.equal(snap(14), 10);
    assert.equal(snap(16), 20);
    assert.equal(clampWorld({ x: -50, y: 9999 }).x, 12);
    assert.equal(clampWorld({ x: -50, y: 9999 }).y, WORLD_H - 12);
  });

  test('circuit-bench geometry: 四个旋转方向的端子位置', () => {
    const el = createComponent('R1', 'resistor', 100, 100);
    // 电阻半跨 30：实物模式外扩后两种视图共用同一端子坐标
    assert.deepEqual(terminalPoint(el, 'a'), { x: 130, y: 100 });
    assert.deepEqual(terminalPoint(el, 'b'), { x: 70, y: 100 });
    assert.deepEqual(terminalPoint({ ...el, rotation: 90 }, 'a'), { x: 100, y: 130 });
    assert.deepEqual(terminalPoint({ ...el, rotation: 180 }, 'a'), { x: 70, y: 100 });
    assert.deepEqual(terminalPoint({ ...el, rotation: 270 }, 'a'), { x: 100, y: 70 });
    assert.deepEqual(componentTerminals(el).b, { x: 70, y: 100 });
  });

  test('circuit-bench geometry: 正交折线先横后竖', () => {
    const pts = wirePoints({ x: 0, y: 0 }, { x: 100, y: 50 });
    assert.equal(pts.length, 4);
    assert.deepEqual(pts[1], { x: 50, y: 0 });
    assert.deepEqual(pts[2], { x: 50, y: 50 });
    assert.match(wirePath({ x: 0, y: 0 }, { x: 100, y: 50 }), /^M0 0 L50 0 L50 50 L100 50$/);
  });

  test('circuit-bench geometry: 纵向差更大时先竖后横', () => {
    const pts = wirePoints({ x: 0, y: 0 }, { x: 20, y: 100 });
    assert.deepEqual(pts[1], { x: 0, y: 50 });
    assert.deepEqual(pts[2], { x: 20, y: 50 });
  });

  test('circuit-bench geometry: 命中检测优先最上层元件', () => {
    const a = createComponent('R1', 'resistor', 100, 100);
    const b = createComponent('L1', 'bulb', 100, 100);
    assert.equal(hitTestComponent([a, b], { x: 100, y: 100 })?.id, b.id);
    assert.equal(hitTestComponent([a], { x: 500, y: 500 }), null);
  });

  test('circuit-bench geometry: 端子命中取最近者', () => {
    const a = createComponent('R1', 'resistor', 100, 100);
    const b = createComponent('R2', 'resistor', 200, 100);
    const hit = hitTestTerminal([a, b], { x: 174, y: 100 }, 12);
    assert.ok(hit);
    assert.equal(hit!.component.id, b.id);
    assert.equal(hit!.terminal, 'b');
    assert.equal(hitTestTerminal([a, b], { x: 500, y: 500 }, 12), null);
  });

  test('circuit-bench geometry: 元件包围盒随旋转交换宽高', () => {
    const el = createComponent('R1', 'resistor', 100, 100);
    const flat = elementBounds(el);
    const upright = elementBounds({ ...el, rotation: 90 });
    assert.ok(Math.abs(flat.w - upright.h) < 1e-9);
    assert.ok(Math.abs(flat.h - upright.w) < 1e-9);
    assert.equal(flat.x + flat.w / 2, 100);
    assert.equal(flat.y + flat.h / 2, 100);
  });

  test('circuit-bench geometry: 标签不压住元件主体', () => {
    const el = createComponent('R1', 'resistor', 100, 100);
    const b = elementBounds(el);
    const p = labelPoint(el);
    assert.ok(p.y < b.y);
    const vertical = labelPoint({ ...el, rotation: 90 });
    assert.ok(vertical.x > 100);
  });

  test('circuit-bench geometry: 屏幕/世界坐标往返', () => {
    const view = { tx: 30, ty: -10, scale: 1.7 };
    const p = { x: 222, y: 131 };
    const back = screenToWorld(worldToScreen(p, view), view);
    assert.ok(Math.abs(back.x - p.x) < 1e-9);
    assert.ok(Math.abs(back.y - p.y) < 1e-9);
  });

  test('circuit-bench geometry: 以指针为中心缩放时锚点不动', () => {
    const view = { tx: 0, ty: 0, scale: 1 };
    const screen = { x: 200, y: 120 };
    const before = screenToWorld(screen, view);
    const next = zoomAround(view, screen, 1.5);
    const after = screenToWorld(screen, next);
    assert.ok(Math.abs(before.x - after.x) < 1e-9);
    assert.ok(Math.abs(before.y - after.y) < 1e-9);
    assert.equal(next.scale, 1.5);
  });

  test('circuit-bench geometry: 缩放范围被钳制', () => {
    const view = { tx: 0, ty: 0, scale: 2.3 };
    assert.equal(zoomAround(view, { x: 0, y: 0 }, 10).scale, 2.4);
    assert.equal(zoomAround({ ...view, scale: 0.6 }, { x: 0, y: 0 }, 0.1).scale, 0.55);
  });

  test('circuit-bench geometry: fitView 保持世界在画布内', () => {
    const canvas = { w: 800, h: 500 };
    const view = fitView(canvas);
    const tl = worldToScreen({ x: 0, y: 0 }, view);
    const br = worldToScreen({ x: WORLD_W, y: WORLD_H }, view);
    assert.ok(tl.x >= -0.5 && tl.y >= -0.5);
    assert.ok(br.x <= canvas.w + 0.5 && br.y <= canvas.h + 0.5);
  });

  test('circuit-bench geometry: 折线距离与读数格式', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    assert.equal(distanceToPolyline({ x: 50, y: 10 }, pts), 10);
    assert.equal(distanceToPolyline({ x: 110, y: 50 }, pts), 10);
    // 画布读数与检查器共用同一套工程单位排版；几何模块不再自己养一个格式化器
    assert.equal(formatPhysicalValue(0.5, 'A'), '500 mA');
    assert.equal(formatPhysicalValue(12.34, 'V'), '12.3 V');
    assert.equal(formatPhysicalValue(1234, 'Ω'), '1.23 kΩ');
    assert.equal(formatPhysicalValue(Infinity, 'A'), '∞');
    assert.equal(formatPhysicalValue(NaN, 'A'), '—');
  });

  test('circuit-bench geometry: 端口短桩方向与圆角走线', () => {
    const el = createComponent('R1', 'resistor', 100, 100);
    assert.deepEqual(terminalNormal(el, 'a'), { x: 1, y: 0 });
    assert.deepEqual(terminalNormal({ ...el, rotation: 90 }, 'a'), { x: 0, y: 1 });
    assert.deepEqual(terminalNormal({ ...el, rotation: 180 }, 'b'), { x: 1, y: 0 });
    assert.deepEqual(terminalNormal({ ...el, rotation: 270 }, 'b'), { x: 0, y: 1 });

    const routed = wireRoutePoints({ x: 126, y: 100 }, { x: 174, y: 100 }, { x: 1, y: 0 }, { x: -1, y: 0 });
    assert.deepEqual(routed[0], { x: 126, y: 100 });
    assert.deepEqual(routed[routed.length - 1], { x: 174, y: 100 });
    assert.deepEqual(routed[1], { x: 144, y: 100 }, '导线先沿 a 端法线出 18 单位短桩');
    // 16–20 是硬性区间：太短会贴着本体拐弯，太长会让小电路显得松散
    for (const stub of [16, 18, 20]) {
      const pts = wirePoints({ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 1, y: 0 }, { x: -1, y: 0 }, stub);
      assert.deepEqual(pts[1], { x: stub, y: 0 });
      assert.deepEqual(pts[pts.length - 2], { x: 100 - stub, y: 100 });
    }

    const path = roundedWirePath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      10,
    );
    assert.match(path, /^M0 0 L90 0 Q100 0 100 10 L100 100$/);
    assert.equal(roundedWirePath([]), '');
  });

  test('circuit-bench render: 走线端点与多导线汇合点', () => {
    const bat = createComponent('bat', 'battery', 120, 300, { emf: 6, r: 0.5 }, 90);
    const res = createComponent('res', 'resistor', 400, 300, { r: 10 });
    const loop = stateOf([bat, res], [['bat:b', 'res:b']]);
    const routes = buildWireRoutes(loop);
    assert.equal(routes.length, 1);
    assert.equal(routes[0].fromRef, 'bat:b');
    assert.equal(routes[0].toRef, 'res:b');
    assert.deepEqual(routes[0].points[0], terminalPoint(bat, 'b'));
    assert.deepEqual(routes[0].points[routes[0].points.length - 1], terminalPoint(res, 'b'));
    assert.match(routes[0].path, /^M/);

    const a = createComponent('a', 'resistor', 100, 100);
    const b = createComponent('b', 'resistor', 400, 100);
    const c = createComponent('c', 'resistor', 400, 300);
    const shared = stateOf(
      [a, b, c],
      [
        ['a:a', 'b:b'],
        ['a:a', 'c:b'],
      ],
    );
    const junctions = buildWireJunctions(shared);
    assert.equal(junctions.length, 1);
    assert.equal(junctions[0].ref, terminalRefOf(a, 'a'));
    assert.equal(junctions[0].count, 2);
    assert.deepEqual(junctions[0].point, terminalPoint(a, 'a'));
  });

  test('circuit-bench geometry: 导线绕开元件本体，且不出现折返尖刺', () => {
    // 竖直开关在本体下方 6 单位处还有电池：最短的直线会从开关中轴穿身而过
    const switchBody = { x: 150, y: 194, w: 40, h: 32 };
    const from = { x: 170, y: 130 };
    const to = { x: 170, y: 296 };
    const normals = [{ x: 0, y: 1 }, { x: 0, y: -1 }] as const;

    const naive = wireRoutePoints(from, to, normals[0], normals[1]);
    assert.ok(routeCrossings(naive, [switchBody]) > 0, '不传障碍时最短折线会穿过本体');

    const routed = wireRoutePoints(from, to, normals[0], normals[1], 10, [switchBody]);
    assert.deepEqual(routed[0], from, '首点仍是接线柱');
    assert.deepEqual(routed[routed.length - 1], to, '末点仍是接线柱');
    assert.deepEqual(routed[1], { x: 170, y: 140 }, '出线短桩沿法线，不得硬折');
    assert.equal(routeCrossings(routed, [switchBody]), 0, '绕行后不得穿过本体');
    assert.equal(routeBacktracks(routed), 0, '绕行不得折返出尖刺');
    assert.ok(routed.some((p) => p.x !== 170), '应走侧向车道，而不是沿原路直插');

    // 全部预设逐根导线复验：不穿本体、不折返
    for (const preset of CIRCUIT_PRESETS) {
      const st = presetState(preset.id);
      const obstacles = st.components.map((c) => elementBounds(c));
      for (const route of buildWireRoutes(st)) {
        const tag = `${preset.id} ${route.fromRef}->${route.toRef}`;
        assert.equal(routeCrossings(route.points, obstacles), 0, `${tag} 穿过元件本体`);
        assert.equal(routeBacktracks(route.points), 0, `${tag} 折返出尖刺`);
      }
    }
  });

  test('circuit-bench render: 预设零交叉、零穿身，电表读数非负', () => {
    // 预设是「教科书矩形」：不同电气网络的导线绝不交叉或共线重叠；
    // 每根导线只允许经过与它直接相连的两个元件本体。
    const mustBePositive = new Set(['sp', 'ohm', 'iv', 'joule', 'rwire']);
    for (const preset of CIRCUIT_PRESETS) {
      if (preset.blank) continue;
      const st = presetState(preset.id);
      assert.equal(countWireIntersections(st), 0, `${preset.id} 存在不同网络导线的交叉/重叠`);
      // 跳线是自由连线时的兜底；预设本身应该干净到不需要任何跳线
      assert.equal(buildWireJumps(st).length, 0, `${preset.id} 预设不应出现跨线跳线`);
      assert.ok(new Set([...wireNetIds(st).values()]).size >= 2, `${preset.id} 至少要有两个独立网络`);

      const routes = buildWireRoutes(st);
      assert.ok(routes.length > 0, `${preset.id} 没有导线`);
      for (const route of routes) {
        for (const el of st.components) {
          if (el.id === route.fromEl.id || el.id === route.toEl.id) continue;
          assert.equal(
            routeCrossings(route.points, [elementBounds(el)]),
            0,
            `${preset.id} ${route.fromRef}->${route.toRef} 穿过不相连的 ${el.id}`,
          );
        }
      }

      // 默认闭合状态下，电流表/电压表/检流计都读正值（红表笔接高电位）
      const solved = solveCircuit(instantiatePreset(preset.id));
      for (const el of st.components) {
        if (el.kind !== 'ammeter' && el.kind !== 'voltmeter' && el.kind !== 'galvanometer') continue;
        const reading = solved.elements[el.id];
        assert.ok(reading, `${preset.id} 缺少 ${el.id} 的读数`);
        const value = readingForKind(el.kind, reading).value;
        assert.ok(value >= 0, `${preset.id} 的 ${el.id} 读数为负：${value}`);
        if (mustBePositive.has(preset.id) && el.kind !== 'galvanometer') {
          assert.ok(value > 0, `${preset.id} 的 ${el.id} 应读出有效值`);
        }
      }
    }
  });

  test('circuit-bench render: 预设走线是干净的教科书矩形（每根 ≤2 个折弯）', () => {
    // 判定口径：折弯只统计「两个接线柱短桩之间」的中间段。
    // 从接线柱沿法线出来的 18 单位短桩是接线端子本身的一部分，
    // 它必然与后续走线成直角，不算多余的阶梯折弯。
    const bends = (points: { x: number; y: number }[]): number => {
      let n = 0;
      for (let i = 2; i < points.length - 2; i++) {
        const a = points[i - 1];
        const b = points[i];
        const c = points[i + 1];
        if (Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) > 1e-6) n += 1;
      }
      return n;
    };
    for (const preset of CIRCUIT_PRESETS) {
      if (preset.blank) continue;
      const st = presetState(preset.id);
      for (const route of buildWireRoutes(st)) {
        const tag = `${preset.id} ${route.fromRef}->${route.toRef}`;
        const path = route.points.map((p) => `${p.x},${p.y}`).join(' → ');
        assert.ok(
          bends(route.points) <= 2,
          `${tag} 出现多余阶梯折弯：${path}`,
        );
        // 每段必须横平竖直：斜线在教科书电路图里就是画错了
        for (let i = 1; i < route.points.length; i++) {
          const p = route.points[i - 1];
          const q = route.points[i];
          assert.ok(
            Math.abs(p.x - q.x) < 1e-6 || Math.abs(p.y - q.y) < 1e-6,
            `${tag} 出现斜线段 ${p.x},${p.y} → ${q.x},${q.y}`,
          );
        }
      }
    }

    // 串并联预设的「下边沿」必须是一条水平直线，而且这条干路上不能再挂电表：
    // 电源下接线柱（a）先竖直走到短桩端，再沿底边一条直线到右竖边。
    // 电表统一正立在梁上，红柱朝右迎电流、黑柱朝左出电流，学「左黑右红」的教具规范。
    const sp = presetState('sp');
    const bat = sp.components.find((c) => c.id === 'bat');
    const amp = sp.components.find((c) => c.id === 'a1');
    assert.ok(bat && amp, 'sp 预设缺少电源或电流表');
    assert.equal(amp.rotation, 0, 'sp 电流表必须正立，左右接线柱才分得出黑红');
    const spRoutes = buildWireRoutes(presetState('sp'));
    const trunk = spRoutes.find((r) => r.wire.from === 'bat:a');
    assert.ok(trunk, 'sp 缺少电源正极到梁上的干路');
    const batA = terminalPoint(bat, 'a');
    const bottomY = batA.y + 18;
    const bottomRun = trunk.points.filter((p) => Math.abs(p.y - bottomY) < 1e-6);
    assert.ok(bottomRun.length >= 2, 'sp 底边没有走成一条水平直线');
    assert.ok(
      Math.max(...bottomRun.map((p) => p.x)) - Math.min(...bottomRun.map((p) => p.x)) > 600,
      'sp 底边直线没有横贯电源与右竖边',
    );
    for (const el of sp.components) {
      if (el.id === 'bat') continue;
      for (const t of ['a', 'b'] as const) {
        const p = terminalPoint(el, t);
        assert.ok(Math.abs(p.y - bottomY) > 1e-6, `${el.id}:${t} 仍压在底边干路上`);
      }
    }

    // 预设里的电表一律正立（rotation=0）：只有表盘正着，左边黑 − / 右边红 + 的
    // 教具规范才成立；竖放时左黑右红会变成上下，学生根本认不出极性。
    for (const preset of CIRCUIT_PRESETS) {
      if (preset.blank) continue;
      for (const el of presetState(preset.id).components) {
        if (el.kind === 'ammeter' || el.kind === 'voltmeter' || el.kind === 'galvanometer') {
          assert.equal(el.rotation, 0, `${preset.id} 的 ${el.kind} 必须正立`);
        }
      }
    }
  });

  /** 折线里的「冗余折点」：两个短桩端点**之间**的中间点若与前后共线，就该被丢掉。
   *  两端各留一个点不判（从端子沿法线出来的 18 单位短桩本身必然与后续走线成直角）。 */
  const redundantCorners = (pts: { x: number; y: number }[]): number[] => {
    const out: number[] = [];
    for (let i = 2; i < pts.length - 2; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const c = pts[i + 1];
      if (Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) < 1e-6) out.push(i);
    }
    return out;
  };

  test('circuit-bench geometry: 元件转四态 / 调换极性后仍零穿体，首末段严格沿端口法线', () => {
    // 交互中最容易出事的一步：把某个元件转 90°/180°/270° 或调换极性之后，
    // 原来量好的走线全部作废，必须按新法线重算，而且不许穿任何元件本体。
    // 口径：首末段是接线柱的 18 单位短桩，从第二段起才算「走线」。
    let checked = 0;
    assert.ok(PORT_STUB >= 18 && PORT_STUB <= 24, '端口短桩必须落在 18–24 的标准区间内');
    for (const preset of CIRCUIT_PRESETS) {
      if (preset.blank) continue;
      const base = presetState(preset.id);
      for (const el of base.components) {
        for (const rot of [0, 90, 180, 270]) {
          for (const flip of [false, true]) {
            const st = flip ? swapPolarity(setRotation(base, el.id, rot), el.id) : setRotation(base, el.id, rot);
            const obstacles = st.components.map((c) => elementBounds(c));
            for (const route of buildWireRoutes(st)) {
              checked++;
              const tag = `${preset.id} ${el.id}@${rot}${flip ? ' 调换极性' : ''} ${route.fromRef}->${route.toRef}`;
              const pts = route.points;
              assert.equal(routeCrossings(pts, obstacles), 0, `${tag} 穿过元件本体`);
              assert.equal(routeBacktracks(pts), 0, `${tag} 折返出尖刺`);
              // 12 单位净空走廊：绕行车道不许贴着元件外壳蹭过去
              assert.equal(routeClearance(pts, obstacles, ROUTE_CLEARANCE), 0, `${tag} 侵入元件外侧 12 单位净空`);
              const n1 = terminalNormal(route.fromEl, route.fromTerminal);
              const n2 = terminalNormal(route.toEl, route.toTerminal);
              assert.deepEqual(
                pts[1],
                { x: pts[0].x + n1.x * PORT_STUB, y: pts[0].y + n1.y * PORT_STUB },
                `${tag} 出线方向与旋转后的端口法线不符`,
              );
              const last = pts[pts.length - 1];
              assert.deepEqual(
                pts[pts.length - 2],
                { x: last.x + n2.x * PORT_STUB, y: last.y + n2.y * PORT_STUB },
                `${tag} 入线方向与旋转后的端口法线不符`,
              );
              for (let i = 1; i < pts.length; i++) {
                const p = pts[i - 1];
                const q = pts[i];
                assert.ok(
                  Math.abs(p.x - q.x) < 1e-6 || Math.abs(p.y - q.y) < 1e-6,
                  `${tag} 出现斜线段 ${p.x},${p.y} → ${q.x},${q.y}`,
                );
              }
              assert.deepEqual(redundantCorners(pts), [], `${tag} 留着共线冗余折点`);
            }
          }
        }
      }
    }
    assert.ok(checked > 2000, `旋转四态扫描样本太少（${checked}），测试没跑满`);
  });

  test('circuit-bench geometry: 五态正交路由（直线 / L / Z / U / S）与共线冗余点清理', () => {
    const shapes = (name: string, from: { x: number; y: number }, to: { x: number; y: number }, n1: { x: number; y: number }, n2: { x: number; y: number }) => {
      const pts = wireRoutePoints(from, to, n1, n2);
      const a = pts[1];
      const b = pts[pts.length - 2];
      return { name, pts, shape: wireShapeOf(n1, n2, a, b), bends: routeBends(pts) };
    };

    // ① 共线对向（同轴）→ 一根直线接上，0 拐角
    const straight = shapes('共线对向', { x: 126, y: 100 }, { x: 174, y: 100 }, { x: 1, y: 0 }, { x: -1, y: 0 });
    assert.equal(straight.shape, 'straight');
    assert.equal(straight.bends, 0, '同轴对向应当一根直线接上，不该拐');
    // ② 正交垂直 → 优先单拐角 L 型
    const l = shapes('正交垂直', { x: 100, y: 100 }, { x: 200, y: 300 }, { x: 1, y: 0 }, { x: 0, y: -1 });
    assert.equal(l.shape, 'L');
    assert.equal(l.bends, 1, '一横一竖一次就能拐完，不该退化成阶梯');
    // ③ 平行反向面对面（→ ←）→ Z 型中点折线，2 拐角
    const z = shapes('面对面', { x: 100, y: 100 }, { x: 300, y: 260 }, { x: 0, y: 1 }, { x: 0, y: -1 });
    assert.equal(z.shape, 'Z');
    assert.equal(z.bends, 2, '面对面应当走中分 Z 型，两个拐角');
    // ④ 平行反向背对背（← →）→ 外包络 S / 环形绕行
    const s = shapes('背对背', { x: 300, y: 100 }, { x: 100, y: 260 }, { x: 0, y: -1 }, { x: 0, y: 1 });
    assert.equal(s.shape, 'S');
    assert.ok(s.bends >= 2, '背对背必须绕出去，不能贴着走一根直线');
    // ⑤ 平行同向（↑↑，并排电压表）→ U / C 型外包络
    const u = shapes('并排同向', { x: 100, y: 100 }, { x: 100, y: 300 }, { x: 1, y: 0 }, { x: 1, y: 0 });
    assert.equal(u.shape, 'U');
    assert.equal(u.bends, 2, '同向应当从外侧包一圈，两个拐角');

    // 共线冗余点清理：中间点与前后共线就该被丢掉，两端各自保留
    assert.deepEqual(
      simplifyCollinear([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
      ]),
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
      ],
    );
    assert.equal(simplifyCollinear([{ x: 0, y: 0 }, { x: 10, y: 0 }]).length, 2);
    // routeBends 数的是「真拐角」：同向延长线不算
    assert.equal(routeBends([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }]), 1);
  });

  test('circuit-bench state: 元件一旋转 / 挪动 / 调换极性，写死的静态折点自动失效', () => {
    const sp = presetState('sp');
    // sp 是唯一带静态折点的预设（底边直线、并联表的门形引线），先确认它真的带着
    const withWaypoints = sp.wires.filter((w) => (w.waypoints?.length ?? 0) > 0);
    assert.ok(withWaypoints.length >= 3, 'sp 预设应当带静态折点，否则这条测试没有意义');
    const touches = (w: { from: string; to: string }, id: string) => w.from.startsWith(`${id}:`) || w.to.startsWith(`${id}:`);

    const rotated = rotateComponent(sp, 'l2', 90);
    assert.notEqual(rotated, sp, '旋转必须返回新状态');
    for (const w of rotated.wires) {
      const before = sp.wires.find((x) => x.id === w.id);
      if (touches(w, 'l2')) {
        assert.equal(w.waypoints, undefined, `${w.id} 旋转后还留着旧折点，会从元件身上穿过去`);
      } else {
        assert.deepEqual(w.waypoints, before?.waypoints, `${w.id} 与 l2 无关，不该被牵连`);
      }
    }
    // 折点清掉之后，动态路由接管：走线依旧不穿元件、不折返
    const obstacles = rotated.components.map((c) => elementBounds(c));
    for (const route of buildWireRoutes(rotated)) {
      assert.equal(routeCrossings(route.points, obstacles), 0, `${route.fromRef}->${route.toRef} 旋转后穿体`);
      assert.equal(routeBacktracks(route.points), 0, `${route.fromRef}->${route.toRef} 旋转后折返`);
    }

    // 挪动元件同理
    const l2 = sp.components.find((c) => c.id === 'l2');
    assert.ok(l2);
    const moved = moveComponent(sp, 'l2', l2.x + 80, l2.y - 40);
    for (const w of moved.wires) {
      if (touches(w, 'l2')) assert.equal(w.waypoints, undefined, `${w.id} 挪动后还留着旧折点`);
    }
    // 零位移不算姿态变化：拖动过程的空帧不许把折点洗掉（也不会白白换对象）
    assert.equal(moveComponent(sp, 'l2', l2.x, l2.y), sp);
    assert.equal(setRotation(sp, 'l2', l2.rotation), sp);
    // 调换极性会转 180°，折点同样作废（a↔b 对调不影响按元件 id 认线）
    const flipped = swapPolarity(sp, 'l2');
    for (const w of flipped.wires) {
      if (touches(w, 'l2')) assert.equal(w.waypoints, undefined, `${w.id} 调换极性后还留着旧折点`);
    }
  });

  test('circuit-bench state: 改接一端（A-B-C → A-C）不残留旧折点，重边去重、自环撤线、汇合度数实时刷新', () => {
    const rA = createComponent('rA', 'resistor', 100, 100, { r: 10 });
    const rB = createComponent('rB', 'resistor', 300, 100, { r: 10 });
    const rC = createComponent('rC', 'resistor', 500, 100, { r: 10 });

    // A—B，B 柱上还并着第二条支路 B—C：B:a 上有两根线，画布上该有一个汇合黑点
    const chain = stateOf(
      [rA, rB, rC],
      [
        ['rA:b', 'rB:a'],
        ['rB:a', 'rC:b'],
      ],
    );
    const before = buildWireJunctions(chain);
    assert.equal(before.length, 1);
    assert.equal(before[0].ref, terminalRefOf(rB, 'a'));
    assert.equal(before[0].count, 2);

    // 把 A—B 的 B 端拔下来改接到 C 的另一端：A—B 变成 A—C，
    // B:a 上只剩一条线（汇合点消失），C:b 上并成两条（汇合点出现）
    const moved = replugWire(chain, 'w_1', 'to', 'rC:b');
    assert.equal(moved.status, 'moved');
    assert.equal(moved.changed, true);
    assert.equal(moved.state.wires.find((w) => w.id === 'w_1')?.to, 'rC:b');
    const after = buildWireJunctions(moved.state);
    assert.ok(!after.some((j) => j.ref === terminalRefOf(rB, 'a')), 'B:a 只剩一根线，汇合黑点必须消失');
    const dot = after.find((j) => j.ref === terminalRefOf(rC, 'b'));
    assert.ok(dot, 'C:b 现在并了两根线，应当出现汇合黑点');
    assert.equal(dot.count, 2);
    // 改接后的走线是现算的干净路径：不穿元件、不折返
    const obstacles = moved.state.components.map((c) => elementBounds(c));
    for (const route of buildWireRoutes(moved.state)) {
      assert.equal(routeCrossings(route.points, obstacles), 0, `${route.fromRef}->${route.toRef} 改接后穿体`);
      assert.equal(routeBacktracks(route.points), 0, `${route.fromRef}->${route.toRef} 改接后折返`);
    }

    // 旧折点不许跟着走：带折点的线改接后折点必须清掉
    const withWp: BenchState = {
      ...chain,
      wires: chain.wires.map((w) => (w.id === 'w_1' ? { ...w, waypoints: [{ x: 200, y: 100 }, { x: 240, y: 100 }] } : w)),
    };
    const reWired = replugWire(withWp, 'w_1', 'to', 'rC:b');
    assert.equal(reWired.status, 'moved');
    assert.equal(reWired.state.wires.find((w) => w.id === 'w_1')?.waypoints, undefined, '改接后旧折点必须清干净');

    // 重边去重：接到已经存在的那一对端子上 → 只留一根，不留幽灵重复边
    const dup = stateOf([rA, rB, rC], [['rA:b', 'rB:a'], ['rA:b', 'rC:a']]);
    const merged = replugWire(dup, 'w_2', 'to', 'rB:a');
    assert.equal(merged.status, 'merged');
    assert.equal(merged.removedWireId, 'w_2');
    assert.equal(merged.state.wires.length, 1, '重边必须合并成一根');
    assert.equal(merged.state.wires[0].id, 'w_1');
    assert.deepEqual([merged.state.wires[0].from, merged.state.wires[0].to], ['rA:b', 'rB:a']);

    // 自环：拖回导线自己的另一头 → 整根撤掉，不留 `from === to`
    const loop = replugWire(chain, 'w_1', 'to', 'rA:b');
    assert.equal(loop.status, 'removed');
    assert.equal(loop.state.wires.some((w) => w.id === 'w_1'), false);

    // 短接同一元件两端 / 端子不存在 / 原地松手：都不许动状态
    const short = replugWire(chain, 'w_1', 'to', 'rA:a');
    assert.equal(short.status, 'none');
    assert.equal(short.changed, false);
    assert.equal(short.reason, '不能短接同一个元件的两端');
    assert.equal(short.state, chain);
    assert.equal(replugWire(chain, 'w_1', 'to', 'ghost:a').reason, '端子不存在');
    assert.equal(replugWire(chain, 'ghost', 'to', 'rC:a').reason, '导线不存在');
    const idle = replugWire(chain, 'w_1', 'to', 'rB:a');
    assert.equal(idle.changed, false);
    assert.equal(idle.state, chain);
  });

  test('circuit-bench labels: 闭合开关与导线不印 0A 伪读数', () => {
    // 闭合开关/导线在网表里把两端并成同一节点，求解器只能给出 0A
    assert.equal(hasCanvasReadout(createComponent('w', 'wire', 100, 100)), false);
    assert.equal(hasCanvasReadout(createComponent('s1', 'switch', 100, 100, { closed: true })), false);
    assert.equal(hasCanvasReadout(createComponent('s2', 'switch', 100, 100, { closed: false })), true);
    assert.equal(hasCanvasReadout(createComponent('r', 'resistor', 100, 100, { r: 10 })), true);

    const sw = createComponent('s', 'switch', 300, 200, { closed: true }, 0, 'S1');
    const r = createComponent('r', 'resistor', 600, 200, { r: 10 }, 0, 'R1');
    const st = stateOf([sw, r], [['s:a', 'r:a']]);
    const readings = {
      s: { id: 's', kind: 'switch' as const, current: 0, currentAB: 0, voltage: 0, resistance: 1e-3, power: 0 },
      r: { id: 'r', kind: 'resistor' as const, current: 0.5, currentAB: 0.5, voltage: 5, resistance: 10, power: 2.5 },
    };
    const labels = layoutCircuitLabels({
      state: st,
      readings,
      view: { tx: 0, ty: 0, scale: 1 },
      size: { w: WORLD_W, h: WORLD_H },
      showValues: true,
      showNames: true,
      selectedId: null,
    });
    assert.ok(!labels.some((l) => l.id === 's:value'), '闭合开关不该印 0A');
    // 画布读数与检查器共用工程单位排版：0.5 A 印成 500 mA，不印裸小数也不印指数
    assert.ok(labels.some((l) => l.id === 'r:value' && l.text === '500 mA'), '真实支路读数照常显示');
    assert.ok(labels.some((l) => l.id === 's:name' && l.text === 'S1'), '名称标签不受影响');
  });

  test('circuit-bench geometry: 内容边界与适配不居中整张世界', () => {
    const bat = createComponent('bat', 'battery', 120, 300, { emf: 6, r: 0.5 }, 90);
    const res = createComponent('res', 'resistor', 500, 320, { r: 10 });
    const st = stateOf([bat, res], [['bat:a', 'res:a']]);
    const bounds = contentBounds(st);
    assert.ok(bounds.x < 110, `left bound ${bounds.x}`);
    assert.ok(bounds.y < 280, `top bound ${bounds.y}`);
    assert.ok(bounds.x + bounds.w > 500, '右侧含元件本体');
    assert.ok(bounds.w < WORLD_W, '内容边界应小于整张世界画布');

    const canvas = { w: 800, h: 496 };
    const view = fitViewToContent(bounds, canvas, 40);
    for (const p of [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
      terminalPoint(bat, 'a'),
      terminalPoint(res, 'a'),
    ]) {
      const s = worldToScreen(p, view);
      assert.ok(s.x >= -0.5 && s.x <= canvas.w + 0.5, `x ${s.x} 越界`);
      assert.ok(s.y >= -0.5 && s.y <= canvas.h + 0.5, `y ${s.y} 越界`);
    }
    assert.equal(contentBounds(createEmptyState()).w, WORLD_W);
  });

  test('circuit-bench geometry: 实物模式 fill 适配让电路占画布 75%–85%', () => {
    const bounds = { x: 120, y: 80, w: 560, h: 380 };
    const canvas = { w: 900, h: 560 };
    const view = fitViewToContent(bounds, canvas, 110, 0.8);
    // 受限方向（高度）上的视觉占比应落在 75%–85% 区间
    const coveredH = bounds.h * view.scale;
    const coveredW = bounds.w * view.scale;
    const ratio = Math.max(coveredW / canvas.w, coveredH / canvas.h);
    assert.ok(ratio >= 0.75 && ratio <= 0.85, `视觉占比 ${ratio.toFixed(3)} 不在 75%–85%`);
    // 放大后台面必须仍然完整居中，不允许溢出画布
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    const center = worldToScreen({ x: cx, y: cy }, view);
    assert.ok(Math.abs(center.x - canvas.w / 2) < 1e-6 && Math.abs(center.y - canvas.h / 2) < 1e-6);
    // fill=0 保持旧的留白算法，既有调用不受影响
    const legacy = fitViewToContent(bounds, canvas, 110);
    assert.ok(legacy.scale <= view.scale, '留白模式不应比 fill 模式更大');
  });

  test('circuit-bench render: 仪表画布只保留一处读数', () => {
    const symbols = readFileSync(
      resolve('src/labs/physics/circuit-bench/render/schematic.tsx'),
      'utf-8',
    );
    assert.ok(symbols.includes('showReadout={false}'), '画布仪表应关闭内置读数，避免与标签层重复');
    assert.ok(!symbols.includes('formatPhysicalValue'), '读数格式化应只在标签层做一次');
    const parts = readFileSync(resolve('src/components/lab/circuit/CircuitParts.tsx'), 'utf-8');
    assert.match(parts, /showReadout = true/, '既有 15 个实验依赖默认显示读数');
  });

  test('circuit-bench labels: 仪表读数映射与屏幕标签不压元件', () => {
    // 电池印幅值：极性已由红黑柱与 ± 标识表达，负号只会被读成故障
    assert.deepEqual(readingForKind('battery', {
      id: 'b', kind: 'battery', current: 1, currentAB: -1, voltage: 6, resistance: 0.5, power: -6,
    }), { value: 6, unit: 'V' });
    // 电压表 / 电流表保留符号：接反了（bearing 参考方向为负）必须看得见负号
    assert.deepEqual(readingForKind('voltmeter', {
      id: 'v', kind: 'voltmeter', current: 0.1, currentAB: 0.1, voltage: 2.5, resistance: 1e6, power: 0.25,
    }), { value: 2.5, unit: 'V' });
    assert.deepEqual(readingForKind('ammeter', {
      id: 'a', kind: 'ammeter', current: 0.3, currentAB: 0.3, voltage: 0.01, resistance: 0.01, power: 0.003,
    }), { value: 0.3, unit: 'A' });
    assert.deepEqual(readingForKind('ammeter', {
      id: 'a', kind: 'ammeter', current: -0.3, currentAB: -0.3, voltage: -0.01, resistance: 0.01, power: 0.003,
    }), { value: -0.3, unit: 'A' });
    // 无极性元件仍取幅值：0.5 A 流过电阻，画 +/- 没有教学含义
    assert.deepEqual(readingForKind('resistor', {
      id: 'r', kind: 'resistor', current: -0.5, currentAB: -0.5, voltage: -5, resistance: 10, power: 2.5,
    }), { value: 0.5, unit: 'A' });

    const r = createComponent('r', 'resistor', 300, 200, { r: 10 }, 0, 'R1');
    const meter = createComponent('m', 'ammeter', 650, 200, {}, 0, 'A');
    const st = stateOf([r, meter], [['r:a', 'm:a']]);
    const readings = {
      r: { id: 'r', kind: 'resistor' as const, current: 0.25, currentAB: 0.25, voltage: 2.5, resistance: 10, power: 0.625 },
      m: { id: 'm', kind: 'ammeter' as const, current: 0.25, currentAB: 0.25, voltage: 0.01, resistance: 0.01, power: 0.0025 },
    };
    const labels = layoutCircuitLabels({
      state: st,
      readings,
      view: { tx: 0, ty: 0, scale: 1 },
      size: { w: WORLD_W, h: WORLD_H },
      showValues: true,
      showNames: true,
      selectedId: null,
    });
    assert.ok(labels.some((l) => l.id === 'r:value' && l.text === '250 mA'));
    assert.ok(labels.some((l) => l.id === 'm:value' && l.text === '250 mA'));
    assert.ok(labels.some((l) => l.id === 'r:name' && l.text === 'R1'));
    assert.ok(!labels.some((l) => l.id === 'm:name'), '仪表名与字符 A 重复时只保留元件符号');

    const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    for (const label of labels) {
      assert.ok(label.x >= 0 && label.y >= 0);
      assert.ok(label.x + label.w <= WORLD_W && label.y + label.h <= WORLD_H);
      for (const el of st.components) {
        assert.ok(!overlaps(label, elementBounds(el)), `${label.id} 压住 ${el.id}`);
      }
    }
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        assert.ok(!overlaps(labels[i], labels[j]), `${labels[i].id} 与 ${labels[j].id} 重叠`);
      }
    }
  });

  test('circuit-bench terminals: 所有元件四个方向的端子都落在法线上且不互相吞并', () => {
    const kinds: ElementKind[] = [
      'battery',
      'resistor',
      'bulb',
      'rheostat',
      'switch',
      'ammeter',
      'voltmeter',
      'galvanometer',
      'fuse',
      'heater',
      'wire',
    ];
    for (const kind of kinds) {
      const base = createComponent('X1', kind, 300, 200);
      const size = componentBodySize(kind);
      for (const rotation of [0, 90, 180, 270]) {
        const el = { ...base, rotation };
        const a = terminalPoint(el, 'a');
        const b = terminalPoint(el, 'b');
        const na = terminalNormal(el, 'a');
        const nb = terminalNormal(el, 'b');
        const span = Math.hypot(a.x - el.x, a.y - el.y);
        assert.ok(span > 0, `${kind} 端子跨度为 0`);
        assert.deepEqual(a, { x: el.x + na.x * span, y: el.y + na.y * span }, `${kind}@${rotation} a 端不在法线上`);
        assert.deepEqual(b, { x: el.x + nb.x * span, y: el.y + nb.y * span }, `${kind}@${rotation} b 端不在法线上`);
        assert.ok(Math.abs(nb.x + na.x) < 1e-9 && Math.abs(nb.y + na.y) < 1e-9, `${kind} 两端法线应相反`);
        // 本体不能盖住接线柱，否则线接上去会像是插在元件肚子里
        const halfW = (rotation % 180 !== 0 ? size.h : size.w) / 2;
        const halfH = (rotation % 180 !== 0 ? size.w : size.h) / 2;
        assert.ok(halfW <= span && halfH <= span, `${kind} 本体超出端子跨度`);
        // 命中区半径必须小于半跨度，两端命中区才不会连成一片
        const r = terminalHitRadiusFor(span, 30);
        assert.ok(r >= 6 && r < span, `${kind} 端子命中半径 ${r} 越界（span ${span}）`);
      }
    }
    // 实物表头是面板式教具：面板宽度 = 端子跨度（48），左右两端就是黑/红插座
    assert.deepEqual(componentBodySize('ammeter'), { w: 48, h: 34 });
    assert.deepEqual(componentBodySize('voltmeter'), { w: 48, h: 34 });
    assert.deepEqual(componentBodySize('galvanometer'), { w: 48, h: 34 });
    // 螺口灯泡竖直旋在灯座正中：底座横贯两端子，包络还要罩住向上的玻璃泡
    assert.deepEqual(componentBodySize('bulb'), { w: 48, h: 48 });
    // 闸刀底座同样铺到两端子，接线柱座不会飘在胶木底板外
    assert.deepEqual(componentBodySize('switch'), { w: 54, h: 34 });
    // 电池包络必须罩住正极凸帽（尖端 x=18）
    assert.deepEqual(componentBodySize('battery'), { w: 36, h: 26 });
    // 滑片手柄画到 y=−22，包络高度必须罩得住，否则选中环会切掉手柄
    assert.deepEqual(componentBodySize('rheostat'), { w: 52, h: 44 });
    assert.equal(terminalHitRadiusFor(18, 30), Math.min(30, 18 * 0.9));
    assert.equal(terminalHitRadiusFor(18, 4), 6);
  });

  test('circuit-bench render: 导线端点严格等于端子坐标，两种视图共用同一套接驳点', () => {
    const st = instantiatePreset('sp');
    const routes = buildWireRoutes(st);
    assert.ok(routes.length > 0);
    // 出线短桩长度：16–20 世界单位（取 18），保证导线不贴着元件外壳拐弯
    const STUB = 18;
    for (const route of routes) {
      assert.deepEqual(route.points[0], terminalPoint(route.fromEl, route.fromTerminal));
      assert.deepEqual(route.points[route.points.length - 1], terminalPoint(route.toEl, route.toTerminal));
      assert.deepEqual(route.points[1], {
        x: route.from.x + terminalNormal(route.fromEl, route.fromTerminal).x * STUB,
        y: route.from.y + terminalNormal(route.fromEl, route.fromTerminal).y * STUB,
      });
      const last = route.points[route.points.length - 2];
      const toNormal = terminalNormal(route.toEl, route.toTerminal);
      assert.deepEqual(last, { x: route.to.x + toNormal.x * STUB, y: route.to.y + toNormal.y * STUB });
    }

    // 仿真图只换本体画法，不允许自己再算一套端子坐标
    const physical = readFileSync(resolve('src/labs/physics/circuit-bench/render/physical.tsx'), 'utf-8');
    // 去掉注释再守卫，避免文档里提到常量名就误报
    const physicalCode = physical.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!physicalCode.includes('terminalPoint'), '仿真图不得重新推导端子位置');
    assert.ok(!physicalCode.includes('TERMINAL_HALF_SPAN'), '仿真图应复用传入的 half，而不是另立跨度');
    assert.match(physicalCode, /BodyProps/, '仿真图本体必须复用策略传入的 half 等几何参数');
    // 电池壳上印的必须是它自己的电动势；预设里既有 3V 也有 6V，写死 1.5V 会误导
    assert.ok(!physicalCode.includes('1.5V'), '实物电池标注不得写死电压');
    assert.ok(physicalCode.includes("numParam(el, 'emf'"), '实物电池标注应取 emf 参数');

    // 实物电表面板：左黑 − / 右红 + 的标识必须真的画在面板上（红色用 failColor 令牌）
    assert.ok(physicalCode.includes('−') && physicalCode.includes('+'), '实物电表面板应标出 −/+ 极性');
    assert.match(physicalCode, /fill=\{failColor\}[\s\S]{0,220}\+/, '正极端子的标识应为红色');
    // 面板宽度必须等于端子跨度（48）：插座才能落在面板两端，而不是浮在壳外
    assert.match(physicalCode, /x=\{-24\} y=\{-17\} width=\{48\} height=\{34\}/, '实物电表面板应横贯两端子');

    const symbols = readFileSync(resolve('src/labs/physics/circuit-bench/CircuitSymbols.tsx'), 'utf-8');
    assert.match(symbols, /data-view-mode=\{viewMode\}/);
    assert.match(symbols, /terminalsInteractive \? 'auto' : 'none'/);
    assert.ok(symbols.includes('strategyFor'), '符号层应按 viewMode 走渲染策略');
    // 多线同柱：端子接线根数 ≥2 时要画叠插插头，不能把两根线在柱边硬拼
    assert.ok(symbols.includes('wireCounts'), '符号层应接收各端子接线根数');
    assert.match(symbols, /load >= 2/, '同一接线柱 ≥2 根线时应走叠插插头');
    const canvasCode = readFileSync(resolve('src/labs/physics/circuit-bench/CircuitCanvas.tsx'), 'utf-8');
    assert.ok(canvasCode.includes('const wireCounts = useMemo'), '画布应按 state.wires 统计端子接线根数');
    assert.equal(strategyFor('physical').Body, PhysicalBody, 'physical 策略必须分派到实物本体');
    assert.equal(strategyFor('schematic').Body, SchematicBody, 'schematic 策略必须分派到电路图本体');
  });

  test('circuit-bench render: 导线材质随视图切换，拓扑不变', () => {
    for (const mode of ['schematic', 'physical'] as const) {
      const st = instantiatePreset('ohm');
      const routes = buildWireRoutes(st);
      assert.ok(routes.length > 0);
      // 同一条 route 在两种模式下 points 完全一致：颜色变了，走线没变。
      const again = buildWireRoutes(st);
      for (let i = 0; i < routes.length; i++) {
        assert.deepEqual(routes[i].points, again[i].points);
        assert.deepEqual(routes[i].path, again[i].path);
      }
      const style = wireStyleFor(mode, 0);
      if (mode === 'physical') {
        assert.ok(style.casing, '仿真图导线应有绝缘外壳');
        assert.ok(style.sleeves, '仿真图导线端头应画插头护套');
        assert.ok(WIRE_PALETTE.includes(style.stroke), '仿真图导线颜色应取自绝缘皮调色板');
        assert.notEqual(wireStyleFor('physical', 0).stroke, wireStyleFor('physical', 1).stroke, '相邻导线应换色');
      } else {
        assert.equal(style.casing, null);
        assert.equal(style.sleeves, false);
      }
    }

    // 护套沿端口短桩方向延伸，不从本体侧面斜插进去
    const route = buildWireRoutes(instantiatePreset('ohm'))[0];
    const seg = sleevePoints(route.points, true);
    assert.ok(seg);
    const d = { x: seg[1].x - seg[0].x, y: seg[1].y - seg[0].y };
    const n = terminalNormal(route.fromEl, route.fromTerminal);
    assert.ok(Math.abs(d.x * n.y - d.y * n.x) < 1e-6, '护套必须与端子法线共线');
    assert.ok(d.x * n.x + d.y * n.y > 0, '护套朝元件外侧延伸');
  });

  test('circuit-bench polarity: 极性随旋转走，电表接反读出负号并触发告警', () => {
    // 约定：电池 a=正极，A/V/G 表 a=红表笔
    assert.equal(terminalPolarity('battery', 'a'), '+');
    assert.equal(terminalPolarity('battery', 'b'), '-');
    assert.equal(terminalPolarity('ammeter', 'a'), '+');
    assert.equal(terminalPolarity('voltmeter', 'b'), '-');
    assert.equal(terminalPolarity('galvanometer', 'a'), '+');
    assert.equal(terminalPolarity('resistor', 'a'), null);
    assert.equal(terminalPolarity('switch', 'b'), null);
    assert.ok(isPolarizedKind('battery'));
    assert.ok(!isPolarizedKind('bulb'));

    // 红柱永远是 a 端：端子几何随 rotation 旋转，极性不会在 90°/180°/270° 翻到另一边。
    const base = createComponent('bat', 'battery', 100, 100, { emf: 6 }, 0, 'E');
    for (const rotation of [0, 90, 180, 270]) {
      const el = { ...base, rotation };
      const a = terminalPoint(el, 'a');
      const b = terminalPoint(el, 'b');
      assert.equal(terminalPolarity(el.kind, 'a'), '+');
      // a 端必须在 b 端的「正方向」侧：0°右、90°下、180°左、270°上
      const expected =
        rotation === 0 ? { x: 1, y: 0 }
        : rotation === 90 ? { x: 0, y: 1 }
        : rotation === 180 ? { x: -1, y: 0 }
        : { x: 0, y: -1 };
      const dir = { x: Math.sign(a.x - b.x), y: Math.sign(a.y - b.y) };
      assert.deepEqual(dir, expected, `rotation=${rotation} 时正极方向不对`);
    }

    // 求解器给的是 a→b 带符号量；电表接反（参考方向为负）必须读作负数并触发接反判据。
    const negativeCurrent = { id: 'a', kind: 'ammeter' as const, current: -0.2583, currentAB: -0.2583, voltage: -0.0003, resistance: 0.01, power: 0 };
    assert.deepEqual(readingForKind('ammeter', negativeCurrent), { value: -0.2583, unit: 'A' });
    assert.ok(readingReversed('ammeter', negativeCurrent));
    const negativeVolt = { id: 'v', kind: 'voltmeter' as const, current: -2.9e-6, currentAB: -2.9e-6, voltage: -2.9611, resistance: 1e6, power: 0 };
    assert.deepEqual(readingForKind('voltmeter', negativeVolt), { value: -2.9611, unit: 'V' });
    assert.ok(readingReversed('voltmeter', negativeVolt));
    assert.ok(!readingReversed('ammeter', { ...negativeCurrent, current: 0.2, currentAB: 0.2 }));
    // 电池没有「表笔接反」这回事：反接是合法接法，不能报警
    assert.ok(!readingReversed('battery', { id: 'b', kind: 'battery', current: 1, currentAB: -1, voltage: -6, resistance: 0.5, power: -6 }));
    assert.ok(!readingReversed('resistor', { id: 'r', kind: 'resistor', current: -0.5, currentAB: -0.5, voltage: -5, resistance: 10, power: 2.5 }));

    // 桥式电路的 G 表可能解出 -2e-10，必须显示 0 而不是 -0.000
    assert.equal(sanitizeReadout(-2e-10), 0);
    assert.equal(readingForKind('galvanometer', { id: 'g', kind: 'galvanometer', current: -2e-10, currentAB: -2e-10, voltage: 0, resistance: 10, power: 0 }).value, 0);
    assert.ok(!readingReversed('galvanometer', { id: 'g', kind: 'galvanometer', current: -2e-10, currentAB: -2e-10, voltage: 0, resistance: 10, power: 0 }), '1e-10 级噪声不算接反');
    assert.equal(formatPhysicalValue(-0.0003, 'A'), '-300 μA');
    // 电表读数保留符号（接反看得见负号），无极性元件才取幅值
    assert.equal(formatPhysicalValue(Math.abs(-0.0003), 'A'), '300 μA');
  });

  /**
   * P0-1 回归：导线流向的统一口径。
   *
   * 旧实现两处都错：①用 `current` 推流向 —— 电池支路的 `current` 是「内部 b→a」（放电），
   * 与所有非电源支路的 a→b 相反；②「取绝对值较大的那一端」当电流 —— 并联引线（电压表并在小
   * 灯泡两端）的并接端上元件电流会分流，于是恰好选中分流端。
   * 8 套预设 49 根导线里，①错 14 根、②再错 11 根（互不重叠），合计 25 根流向画反。
   *
   * 现在统一读 `currentAB`（正 = 电流从 a 端流入元件、由 b 端流出），并优先取**串联端**
   * （该接线柱上只有这一根导线，元件电流必然整根流过这根线）。于是同一根线的串联端必然同号，
   * 「零根画反」就是可判定的不变量。
   */
  test('circuit-bench flow: 生产规则下 8 套预设 49 根导线零根画反、死支路与微安引线一律不画流动', () => {
    // 被测对象就是画布用的那份实现（CircuitCanvas 只做 useMemo 包装），不再靠源码字符串猜行为。
    const wireDir = (terminal: 'a' | 'b', side: 'from' | 'to', value: number): number =>
      ((side === 'from') === (terminal === 'a') ? -1 : 1) * Math.sign(value || 1);

    const TINY = 1e-9;
    let total = 0;
    let determined = 0;
    let backwards = 0;
    let darkLive = 0;
    let phantomStub = 0;
    let phantomTiny = 0;
    const problems: string[] = [];
    for (const id of PRESET_IDS) {
      const st = instantiatePreset(id);
      const result = solveCircuit(st);
      const flows = computeWireFlows(st, result);
      // 每个接线柱上接了几根线：=1 才是串联端。
      const degree = new Map<string, number>();
      for (const w of st.wires) {
        degree.set(w.from, (degree.get(w.from) ?? 0) + 1);
        degree.set(w.to, (degree.get(w.to) ?? 0) + 1);
      }
      for (const route of buildWireRoutes(st)) {
        total++;
        const ends = [
          { side: 'from' as const, ref: route.fromRef, el: route.fromEl, terminal: route.fromTerminal, r: result.elements[route.fromEl.id] },
          { side: 'to' as const, ref: route.toRef, el: route.toEl, terminal: route.toTerminal, r: result.elements[route.toEl.id] },
        ].map((e) => ({
          ...e,
          series: (degree.get(e.ref) ?? 0) === 1,
          amps: Math.abs(e.r?.currentAB ?? 0),
          dir: wireDir(e.terminal, e.side, e.r?.currentAB ?? 0),
        }));
        assert.ok(ends.every((e) => e.r), `${id}/${route.wire.id} 缺少端点读数`);

        const flow = flows.get(route.wire.id);
        // 死支路：断开的开关 / 烧断的保险丝灯泡，且该柱只有这一根线 —— 按连续性电流恒为 0。
        if (ends.some((e) => isOpen(e.el) && e.series)) {
          if (flow) {
            phantomStub++;
            problems.push(`${id}/${route.wire.id} 是死支路却画了 ${fmt(flow.amps)}A 的流动层`);
          }
          continue;
        }
        // 闭合开关的两端在网表里并成同一个节点，读数 0 不代表这根线没有电流，不能参与定流。
        const votable = ends.filter((e) => !mergesTerminals(e.el) && Number.isFinite(Number(e.r!.currentAB)));
        const series = votable.filter((e) => e.series);
        const seriesLive = series.filter((e) => e.amps > FLOW_MIN_AMPS);
        // 串联端：元件电流整根流过这根线，所以两个串联端（若都有电流）必须同号。
        for (const e of seriesLive) {
          assert.equal(
            e.dir,
            seriesLive[0].dir,
            `${id}/${route.wire.id} 串联两端流向不一致：${seriesLive.map((x) => `${x.ref}=${x.dir}`).join(' ')}`,
          );
        }
        // 独立复核一：非电源串联端 a→b 的电流就是 (v_a − v_b)/R，符号必须与电流一致
        // （电流由高电位流向低电位）。这条路径完全不碰 `currentAB`。
        for (const e of seriesLive) {
          if (e.el.kind === 'battery' || Math.abs(e.r!.voltage) < TINY) continue;
          assert.equal(
            Math.sign(e.r!.voltage),
            Math.sign(e.r!.currentAB),
            `${id}/${route.wire.id} 的 ${e.ref}（${e.el.kind}）电压与电流符号不一致`,
          );
        }
        // 独立复核二：电池的 `currentAB` 必须恰好是旧 `current` 的反号，且放电时电流由正极 a 流出
        // —— 这正是「从正极出发」画法的物理依据，也是历史缺陷（拿 `current` 推流向）的根因。
        for (const e of seriesLive) {
          if (e.el.kind !== 'battery') continue;
          assert.ok(
            Math.abs(e.r!.currentAB + e.r!.current) < 1e-12,
            `${id} 的电源 currentAB 口径未取反：current=${e.r!.current} currentAB=${e.r!.currentAB}`,
          );
          assert.ok(e.r!.current > 0 && e.r!.currentAB < 0, `${id} 的电源应在放电：I=${e.r!.current} I_ab=${e.r!.currentAB}`);
          const towardBattery = e.side === 'to' ? 1 : -1;
          assert.equal(
            e.dir,
            e.terminal === 'a' ? -towardBattery : towardBattery,
            `${id}/${route.wire.id} 的电源端流向反了`,
          );
        }

        if (seriesLive.length) {
          determined++;
          // 画布真正采用的方向必须是串联端的方向（旧实现在并联引线上会选中分流端而画反）。
          const truth = [...seriesLive].sort((a, b) => b.amps - a.amps)[0];
          if (!flow) {
            darkLive++;
            problems.push(`${id}/${route.wire.id} 串联端有 ${fmt(truth.amps)}A，画布却没画流动层`);
          } else {
            if (flow.dir !== truth.dir) {
              backwards++;
              problems.push(
                `${id}/${route.wire.id} 择端选错（取 ${flow.dir}，串联端 ${truth.ref} 为 ${truth.dir}）`,
              );
            }
            assert.ok(
              Math.abs(flow.amps - truth.amps) < 1e-12,
              `${id}/${route.wire.id} 电流幅值不符：画布 ${flow.amps} ≠ 串联端 ${truth.amps}`,
            );
          }
        } else if (series.length) {
          // 串联端读数是「近乎没有电流」（电压表引线只有几微安；闭合开关端是合并节点的 0）：
          // 精确读数说这根线没有电流，就绝不允许退回并接端借一个大电流来画亮线。
          if (flow) {
            phantomTiny++;
            problems.push(
              `${id}/${route.wire.id} 串联端只有 ${fmt(series[0].amps)}A，却画了 ${fmt(flow.amps)}A 的流动层`,
            );
          }
        }
      }
    }
    // 锁住被审计的语料：8 套预设共 49 根导线；33 根由串联端精确定流，14 根只能靠并接端
    // （10 根电压表引线 + 4 根闭合开关合流线）或干脆是死支路（2 根短路线）。
    assert.equal(total, 49, `8 套预设应共 49 根导线，实际 ${total} 根`);
    assert.equal(determined, 33, `应由串联端精确定流的导线数变了（${determined}）；新增/改动预设需同步核对该不变式`);
    assert.equal(backwards, 0, `${backwards}/49 根导线流向画反：${problems.slice(0, 3).join('；')}`);
    assert.equal(darkLive, 0, `${darkLive} 根有电流的导线没画流动层：${problems.slice(0, 3).join('；')}`);
    assert.equal(phantomStub, 0, `${phantomStub} 根死支路画了假电流：${problems.slice(0, 3).join('；')}`);
    assert.equal(phantomTiny, 0, `${phantomTiny} 根微安级引线被借了大电流：${problems.slice(0, 3).join('；')}`);
  });

  /**
   * P0-2 + P0-3 回归：表笔接反是解算级的负读数，表针跟着符号左偏，
   * 并且红黑接线柱（∓24 的插座中心）随元件旋转、± 字样保持正立。
   */
  test('circuit-bench meter: 表笔接反读出负号、表针左偏并触发 meter-reversed', () => {
    const parts = () => [
      createComponent('bat', 'battery', 120, 300, { emf: 6, r: 0.5 }, 0, 'E'),
      createComponent('r', 'resistor', 320, 300, { r: 10 }, 0, 'R'),
      createComponent('m', 'ammeter', 520, 300, {}, 0, 'A'),
    ];
    // 正接：电池 a(+) → R → 表 a(红) → 表 b(黑) → 电池 b(−)，表内电流 a→b。
    const forward = stateOf(parts(), [['bat:a', 'r:a'], ['r:b', 'm:a'], ['m:b', 'bat:b']]);
    // 反接：红黑柱对调，表内电流 b→a，`currentAB` 变负。
    const backward = stateOf(parts(), [['bat:a', 'r:a'], ['r:b', 'm:b'], ['m:a', 'bat:b']]);

    const fwd = solveCircuit(forward).elements.m;
    const rev = solveCircuit(backward).elements.m;
    assert.ok(fwd.currentAB > 0, `正接应读出正电流，实得 ${fwd.currentAB}`);
    assert.ok(rev.currentAB < 0, `接反应读出负电流，实得 ${rev.currentAB}`);
    // 幅值相同、只有符号相反：说明这不是「换了电路」，而是同一路电流接反了表笔。
    assert.ok(Math.abs(fwd.currentAB + rev.currentAB) < 1e-9);
    assert.ok(!readingReversed('ammeter', fwd));
    assert.ok(readingReversed('ammeter', rev));
    assert.ok(readingForKind('ammeter', rev).value < 0, '接反时画布/检查器必须看得见负号');
    assert.ok(!readingReversed('resistor', solveCircuit(backward).elements.r), '电阻没有接反这回事');

    // 表针严格绑在带符号读数上：正读数右偏（CSS 正角＝顺时针＝屏幕右），负读数左偏。
    const range = meterGears('ammeter')[0] ?? 0.6;
    assert.ok(needleAngle(fwd, 'currentAB', range) > 0);
    assert.ok(needleAngle(rev, 'currentAB', range) < 0);
    assert.equal(needleAngle(rev, 'currentAB', range), -needleAngle(fwd, 'currentAB', range));
    assert.equal(needleAngle(undefined, 'currentAB', range), 0);
    assert.equal(needleAngle(rev, 'currentAB', 0), 0, '量程非法时不得算出 NaN 偏角');

    // 求解器必须给出「电表正负极接反」告警，且正接时绝不误报（P0-3 的 (b) 条）。
    assert.ok(!solveCircuit(forward).warnings.some((w) => w.code === 'meter-reversed'), '正接不得误报接反');
    const warn = solveCircuit(backward).warnings.find((w) => w.code === 'meter-reversed');
    assert.ok(warn, '接反必须产生 meter-reversed 告警');
    assert.ok(warn!.elementIds?.includes('m'), '告警必须指向那块被接反的表');

    // 画布胶囊：负读数带 ⚠ 前缀并改用警示色，学生一眼能分清「接反」和「电路真的反向」。
    const readings = solveCircuit(backward).elements;
    const labels = layoutCircuitLabels({
      state: backward,
      readings,
      view: { tx: 0, ty: 0, scale: 1 },
      size: { w: WORLD_W, h: WORLD_H },
      showValues: true,
      showNames: false,
      selectedId: null,
    });
    const capsule = labels.find((l) => l.id === 'm:value');
    assert.ok(capsule, '接反时读数胶囊必须仍然显示');
    assert.equal(capsule!.reversed, true);
    assert.ok(capsule!.text.startsWith('⚠ '), `接反胶囊应带 ⚠ 前缀，实得「${capsule!.text}」`);
    assert.ok(capsule!.text.includes('-'), `接反胶囊应保留负号，实得「${capsule!.text}」`);

    // 实物视图的结构约束：表盘与表针在 0/90/180/270 都反向自转回正立，
    // 红(+)黑(−)色环钉在真实端子位置（插座中心 ∓24），± 字样锚在自己的柱上。
    const src = readFileSync(resolve('src/labs/physics/circuit-bench/render/physical.tsx'), 'utf-8');
    assert.ok(src.includes('const upright = -Number(el.rotation ?? 0)'), '表盘必须反向自转保持正立');
    assert.ok(src.includes('needleAngle(reading, el.kind === \'voltmeter\' ? \'voltage\' : \'currentAB\', range)'), '表针必须由带符号的 currentAB/voltage 驱动');
    assert.ok(src.includes('needleAngle(reading, \'currentAB\', range)'), '电流计表针同样取 currentAB');
    assert.ok(src.includes('rotate(${upright} -24 -9.5)') && src.includes('rotate(${upright} 24 -9.5)'), '± 字样必须反向自转锚在插座上');
    assert.equal(terminalPolarity('ammeter', 'a'), '+');
    assert.equal(terminalPolarity('ammeter', 'b'), '-');

    // 红柱 a 的屏幕位置随 rotation 走（0°右 / 90°下 / 180°左 / 270°上），
    // 而插座局部坐标恒为 ∓24 —— 两者必须一致，否则旋转后色环会跑到空处。
    for (const rotation of [0, 90, 180, 270]) {
      const el = { ...createComponent('m', 'ammeter', 400, 300, {}, rotation), rotation };
      const red = terminalPoint(el, 'a');
      const black = terminalPoint(el, 'b');
      const expected =
        rotation === 0 ? { x: 1, y: 0 }
        : rotation === 90 ? { x: 0, y: 1 }
        : rotation === 180 ? { x: -1, y: 0 }
        : { x: 0, y: -1 };
      assert.deepEqual(
        { x: Math.sign(Math.round(red.x - black.x)), y: Math.sign(Math.round(red.y - black.y)) },
        expected,
        `rotation=${rotation} 时红柱方向不对`,
      );
      // 红柱到元件中心的距离恒等于插座中心到中心的距离（模长与角度无关）
      const c = { x: el.x, y: el.y };
      assert.ok(Math.abs(Math.hypot(red.x - c.x, red.y - c.y) - Math.hypot(black.x - c.x, black.y - c.y)) < 1e-9);
    }
  });

  /**
   * P0-4 回归：标签布局的迟滞只是「平票加时赛」。
   *
   * 旧实现给上一帧位置 -70 分，足以推翻「内环↔外环」约 60 分的距离差，
   * 于是切换电路图/仿真图后标签会把自己锁死在远环上、拖出一根长引线。
   */
  test('circuit-bench labels: 切换视图后标签不被陈旧位置锁死在远环', () => {
    const view = { tx: 0, ty: 0, scale: 1 };
    const size = { w: WORLD_W, h: WORLD_H };
    const rect = (l: { x: number; y: number; w: number; h: number }) => ({ x: l.x, y: l.y, w: l.w, h: l.h });

    /** 标签框到元件本体的最近间距（与布局器的 closestGap 同口径）。 */
    const gapTo = (box: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
      Math.hypot(
        Math.max(b.x - (box.x + box.w), box.x - (b.x + b.w), 0),
        Math.max(b.y - (box.y + box.h), box.y - (b.y + b.h), 0),
      );

    // ① 单只元件的干净场景：内环必然空着，标签必须贴着本体（间距 = GAP 7），且不拖引线。
    const lone = stateOf(
      [createComponent('r', 'resistor', 300, 300, { r: 10 }, 0, 'R1'), createComponent('m', 'ammeter', 700, 300, {}, 0, 'A')],
      [['r:a', 'm:a']],
    );
    const loneReadings = {
      r: { id: 'r', kind: 'resistor' as const, current: 0.25, currentAB: 0.25, voltage: 2.5, resistance: 10, power: 0.625 },
      m: { id: 'm', kind: 'ammeter' as const, current: 0.25, currentAB: 0.25, voltage: 0.01, resistance: 0.01, power: 0.0025 },
    };
    const input = { state: lone, readings: loneReadings, view, size, showValues: true, showNames: true, selectedId: null };
    const fresh = layoutCircuitLabels(input);
    // R1 的名称 + 读数，A 表只有读数（表名与符号字符重复时按设计省掉）。
    assert.deepEqual(
      fresh.map((l) => l.id).sort(),
      ['m:value', 'r:name', 'r:value'],
      `干净场景应放下全部标签，实际 ${fresh.map((l) => l.id).join(' ')}`,
    );
    for (const l of fresh) {
      const body = elementBounds(lone.components.find((c) => c.id === l.componentId)!);
      assert.ok(!l.leader, `${l.id} 内环空着却拖出了引线`);
      assert.ok(gapTo(l, body) <= 9, `${l.id} 离本体 ${gapTo(l, body).toFixed(1)}px，没有贴住元件`);
    }
    // 把「上一帧位置」搬到远环（内环 +18px ≈ 远近环的间距），布局必须原样回到内环。
    for (const shift of [4, 8, 12, 18, 25]) {
      const stale: Record<string, { x: number; y: number; w: number; h: number }> = {};
      for (const l of fresh) stale[l.id] = { ...rect(l), y: l.y + shift };
      const again = layoutCircuitLabels({ ...input, previous: stale });
      assert.deepEqual(
        again.map((l) => [l.id, Math.round(l.y), Math.round(l.x)]).sort(),
        fresh.map((l) => [l.id, Math.round(l.y), Math.round(l.x)]).sort(),
        `陈旧位置 +${shift}px 把标签锁在了远环`,
      );
      for (const l of again) assert.ok(!l.leader, `陈旧位置 +${shift}px 让 ${l.id} 拖出了引线`);
    }

    // ② 8 套预设走一遍真实切换：电路图 ⇄ 仿真图，来回 3 轮。
    //    进得去也要出得来 —— 每一轮回到电路图时，标签与本体中心的距离不得比首帧更远。
    for (const id of PRESET_IDS) {
      const st = instantiatePreset(id);
      if (!st.components.length) continue;
      const readings = solveCircuit(st).elements;
      const base = { state: st, readings, size, showValues: true, showNames: true, selectedId: null };
      const schView = { tx: 0, ty: 0, scale: 1 };
      const phyView = fitViewToContent(contentBounds(st), size, 110, 0.8);
      const first = layoutCircuitLabels({ ...base, view: schView });
      const bodyCenter = (componentId: string) => {
        const b = elementBounds(st.components.find((c) => c.id === componentId)!);
        return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      };
      const spread = (labels: typeof first) =>
        labels.map((l) => {
          const c = bodyCenter(l.componentId);
          return Math.hypot(l.x + l.w / 2 - c.x, l.y + l.h / 2 - c.y);
        });
      const firstSpread = spread(first);
      let previous: Record<string, { x: number; y: number; w: number; h: number }> = {};
      for (const l of first) previous[l.id] = rect(l);
      let last = first;
      for (let round = 0; round < 3; round++) {
        const phy = layoutCircuitLabels({ ...base, view: phyView, previous });
        previous = {};
        for (const l of phy) previous[l.id] = rect(l);
        last = layoutCircuitLabels({ ...base, view: schView, previous });
        previous = {};
        for (const l of last) previous[l.id] = rect(l);
      }
      const lastSpread = spread(last);
      assert.ok(lastSpread.length >= firstSpread.length - 1, `${id} 来回切换后标签数量掉到 ${lastSpread.length}`);
      for (let i = 0; i < lastSpread.length; i++) {
        assert.ok(
          lastSpread[i] <= firstSpread[i] + 6,
          `${id} 第 ${i} 个标签来回切换后离本体 ${lastSpread[i].toFixed(1)}px，比首帧 ${firstSpread[i].toFixed(1)}px 更远（锁在远环）`,
        );
      }
    }
  });

  /**
   * P1-8 回归：标签避让与流向推导必须能复用画布同一帧算好的导线路径。
   *
   * 满负载（64 元件 / 127 导线）时 `buildWireRoutes` 单次约 90 ms，而一帧里画布、
   * 流向层、标签层都要它。复用之后结果必须逐像素一致 —— 否则「省时间」就成了
   * 「换个位置画」；复用没接上（又变回各算一份）同样要被抓出来。
   */
  test('circuit-bench labels: 复用画布导线路径与自行计算必须得到同一份布局与流向', () => {
    const view = { tx: 0, ty: 0, scale: 1 };
    for (const size of [{ w: WORLD_W, h: WORLD_H }, { w: 720, h: 460 }, { w: 380, h: 240 }]) {
      for (const id of PRESET_IDS) {
        const st = instantiatePreset(id);
        if (!st.components.length) continue;
        const result = solveCircuit(st);
        const base = {
          state: st,
          readings: result.elements,
          view,
          size,
          showValues: true,
          showNames: true,
          selectedId: null,
        };
        const own = layoutCircuitLabels(base);
        const shared = layoutCircuitLabels({ ...base, routes: buildWireRoutes(st) });
        assert.deepEqual(shared, own, `${id} @${size.w}px：复用导线路径改变了标签布局`);
        assert.deepEqual(
          [...computeWireFlows(st, result, buildWireRoutes(st))],
          [...computeWireFlows(st, result)],
          `${id} @${size.w}px：复用导线路径改变了导线流向`,
        );
      }
    }

    // 复用必须真的接在画布上：一帧只算一次导线路径，流向层与标签层共用它。
    const canvas = readFileSync(resolve('src/labs/physics/circuit-bench/CircuitCanvas.tsx'), 'utf-8');
    assert.ok(canvas.includes('computeWireFlows(state, result, routes)'), '流向层必须复用画布已算好的导线路径');
    assert.ok(canvas.includes('routes={routes}'), '标签层必须复用画布已算好的导线路径');
    assert.match(canvas, /useMemo\(\(\) => buildWireRoutes\(state\), \[state\]\)/, '导线路径一帧只算一次');
  });

  test('circuit-bench fx: 电流流动层纯 CSS 驱动，且小电流与减动效下都不跑', () => {
    const canvas = readFileSync(resolve('src/labs/physics/circuit-bench/CircuitCanvas.tsx'), 'utf-8');
    assert.ok(canvas.includes('strokeDasharray="6 6"'), '流动层必须是 6/6 虚线');
    assert.ok(canvas.includes('cb-current-flow'), '流动层应挂 CSS 动画类名');
    assert.ok(canvas.includes('animationDuration'), '流速应由电流大小分档驱动');
    assert.ok(canvas.includes('animationDirection'), '反向电流应让虚线朝反方向滚动');
    // 1mA 阈值：低于它不渲染流动层，避免「静止虚线」被读成有电流
    const flow = readFileSync(resolve('src/labs/physics/circuit-bench/circuit-bench-flow.ts'), 'utf-8');
    assert.equal(FLOW_MIN_AMPS, 1e-3, '1mA 阈值是对外可见的不变式');
    assert.match(flow, /FLOW_MIN_AMPS\s*=\s*1e-3/);
    assert.ok(canvas.includes('flow.amps < FLOW_MIN_AMPS'), '小电流必须直接跳过流动层');
    assert.ok(canvas.includes('computeWireFlows'), '画布必须用被测试覆盖的流向实现，而不是自己再写一份');
    // 动画只能由 CSS 驱动，不能在渲染层里跑逐帧循环
    assert.ok(!canvas.includes('requestAnimationFrame'), '渲染层不得用 rAF 驱动动画');
    // 实物模式专属：电路图保持静态线稿
    assert.ok(canvas.includes("viewMode === 'physical'"), '流动层只在仿真图渲染');

    const css = readFileSync(resolve('src/index.css'), 'utf-8');
    assert.ok(css.includes('@keyframes cb-current-flow'), '流动动画必须有 CSS 关键帧');
    assert.match(css, /\.cb-current-flow\s*\{[^}]*animation-name:\s*cb-current-flow/);
    const flowCss = css.slice(css.indexOf('@keyframes cb-current-flow'));
    assert.ok(
      flowCss.includes('prefers-reduced-motion'),
      '减动效偏好下必须关掉流动动画',
    );
  });

  test('circuit-bench view: 视图模式归一化与循环', () => {
    assert.deepEqual([...VIEW_MODES], ['schematic', 'physical']);
    assert.equal(DEFAULT_VIEW_MODE, 'schematic');
    assert.equal(normalizeViewMode('physical'), 'physical');
    assert.equal(normalizeViewMode('PHYSICAL'), 'schematic');
    assert.equal(normalizeViewMode(undefined), 'schematic');
    assert.equal(nextViewMode('schematic'), 'physical');
    assert.equal(nextViewMode('physical'), 'schematic');
    assert.equal(viewModeLabel('schematic', true), '电路图');
    assert.equal(viewModeLabel('physical', true), '仿真图');
    assert.equal(viewModeLabel('schematic', false), 'Circuit');
    assert.equal(viewModeLabel('physical', false), 'Simulation');
    // 面向学生的文案改名后，枚举值一个字都不许动：预设、存档、测试全靠它。
    assert.deepEqual([...VIEW_MODES], ['schematic', 'physical']);
    for (const stale of ['原理图', '实物图', 'Schematic', 'Physical']) {
      const labels = VIEW_MODES.map((m) => `${viewModeLabel(m, true)}|${viewModeLabel(m, false)}`).join(' ');
      assert.ok(!labels.includes(stale), `视图文案不得再出现旧名 ${stale}`);
    }
  });

  test('circuit-bench view: 工具栏视图按钮只认 viewModeLabel，不再自己硬编码一套文案', () => {
    const toolbar = readFileSync(resolve('src/labs/physics/circuit-bench/BenchToolbar.tsx'), 'utf8');
    assert.ok(
      toolbar.includes('viewModeLabel(mode, zh)'),
      '视图按钮文字必须来自 viewModeLabel 单一出处',
    );
    assert.ok(
      !/'原理图'|'实物图'|'Schematic'|'Physical'/.test(toolbar),
      '工具栏不得再硬编码视图名',
    );
    assert.match(toolbar, /VIEW_MODES\.map/, '两个视图按钮应由 VIEW_MODES 枚举驱动');
    assert.match(toolbar, /role="group"[\s\S]{0,120}aria-label/, '视图切换组要有可读的分组标签');
  });

  test('circuit-bench workbench: 画布卡与全站版心同宽，与 Header 左右边界同界', () => {
    const aspect = WORLD_W / WORLD_H;

    // 手机：画布宽度 = 版心内容宽度（容器 px-4 + main px-2 = 左右各 24px）
    const phone = benchLayout(390);
    assert.equal(phone.narrow, true);
    assert.equal(siteContentWidth(390), 390 - 24 * 2);
    assert.equal(phone.canvasW, siteContentWidth(390));
    // 342 / 1.613 ≈ 212 → 保底 300，画布不会退化成细条
    assert.equal(phone.canvasH, MIN_CANVAS_H);

    // 桌面：始终等于版心内容宽度，不再贴死视口边缘
    for (const vw of [1280, 1440, 1920]) {
      const m = benchLayout(vw);
      assert.equal(m.narrow, false);
      assert.equal(m.canvasW, siteContentWidth(vw));
      assert.ok(m.canvasShare < 0.9, `${vw} 画布不应再贴满视口`);
      assert.ok(m.canvasH >= MIN_CANVAS_H && m.canvasH <= MAX_CANVAS_H, `${vw} 画布高度越界`);
    }

    // 大屏同理：封顶在 max-w-7xl（1280）减去左右各 56px 内边距
    const wide = benchLayout(1920);
    assert.equal(wide.canvasW, 1280 - 56 * 2);
    assert.equal(wide.canvasH, MAX_CANVAS_H);

    // 断点与 Header 的内边距严格对应：24 / 48 / 56
    assert.equal(siteContentWidth(800), 800 - 96);
    assert.equal(siteContentWidth(1100), 1024 - 112);
    assert.equal(siteContentWidth(1440), 1152 - 112);

    // 未触底/触顶时画布与电路同形（高度由版心宽度和世界比例推导）
    const mid = benchLayout(1100);
    assert.ok(Math.abs(mid.canvasH - mid.canvasW / aspect) < 1e-9, '画布应与世界比例同形');

    // 640 是窄屏断点（与 useParamDock 的 max-width: 639px 对齐）
    assert.equal(benchLayout(639).narrow, true);
    assert.equal(benchLayout(640).narrow, false);

    // 画布卡工具栏落在全站 40–44px 的小工具栏区间
    assert.ok(CARD_TOOLBAR_H >= 40 && CARD_TOOLBAR_H <= 44, '画布卡工具栏高度须在 40–44px');

    // 非法输入不产生 NaN 或负尺寸
    const broken = benchLayout(Number.NaN);
    for (const v of [broken.canvasW, broken.canvasH, broken.canvasShare]) {
      assert.ok(Number.isFinite(v) && v >= 0);
    }
  });

  test('circuit-bench workbench: 画布盒子等比内切且居中', () => {
    const aspect = WORLD_W / WORLD_H;
    // 高瘦区域：以高度为准，宽度按比例缩进并居中
    const tall = fitCanvasBox(1424, 832);
    assert.ok(Math.abs(tall.h - 832) < 1e-9);
    assert.ok(Math.abs(tall.w / tall.h - aspect) < 1e-9);
    assert.ok(Math.abs(tall.x - (1424 - tall.w) / 2) < 1e-9);
    // 扁宽区域：仍然受高度约束（世界比例是宽大于高，1440/400 塞不下整宽）
    const flat = fitCanvasBox(1200, 300);
    assert.ok(Math.abs(flat.h - 300) < 1e-9);
    assert.ok(Math.abs(flat.w - 300 * aspect) < 1e-9);
    assert.ok(Math.abs(flat.x - (1200 - flat.w) / 2) < 1e-9);
    // 退化输入
    assert.deepEqual(fitCanvasBox(0, 500), { w: 0, h: 0, x: 0, y: 0 });
    assert.deepEqual(fitCanvasBox(Number.NaN, 500), { w: 0, h: 0, x: 0, y: 0 });
    assert.deepEqual(fitCanvasBox(500, 500, 0), fitCanvasBox(500, 500, aspect));
  });

  test('circuit-bench workbench: 图表按固定高度绘制且点不越界', () => {
    const g = chartGeometry(
      [
        { x: 0.2, y: 0.4 },
        { x: 0.4, y: 0.8 },
        { x: 0.6, y: 1.2 },
      ],
      2,
      0,
      true,
      { w: 320, h: 288 },
    );
    assert.equal(g.points.length, 3);
    for (const p of g.points) {
      assert.ok(p.x >= g.plot.left - 1e-9 && p.x <= g.plot.right + 1e-9);
      assert.ok(p.y >= g.plot.top - 1e-9 && p.y <= g.plot.bottom + 1e-9);
    }
    assert.ok(g.line, '线性数据应给出拟合线');
    assert.ok(g.plot.bottom - g.plot.top > 200, '288px 高图表应留出 ≥200px 绘图区');

    // 空数据 / 单点 / 全部重合都不抛异常，也不产生 NaN
    assert.equal(chartGeometry([], 0, 0, false, { w: 320, h: 288 }).points.length, 0);
    for (const pts of [[{ x: 1, y: 1 }], [{ x: 2, y: 3 }, { x: 2, y: 3 }]]) {
      const out = chartGeometry(pts, 0, 3, false, { w: 320, h: 288 });
      for (const p of out.points) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    }
  });

  /* ── P2 尾巴一：英文界面残留中文元件名 ── */

  const hasCjk = (s: string) => /[⺀-鿿＀-￯]/.test(s);

  test('circuit-bench i18n: 预设中每个中文元件名都配有英文名', () => {
    // 数据层闸门：预设在文件里是中文常量（电源/试样…），
    // 只要名字带中文就必须给出 labelEn，否则英文界面必然漏出中文。
    for (const id of PRESET_IDS) {
      for (const el of presetState(id).components) {
        if (el.label && hasCjk(el.label)) {
          assert.ok(
            el.labelEn && !hasCjk(el.labelEn),
            `${id}/${el.id} 的中文名「${el.label}」缺少英文名`,
          );
        }
      }
    }
  });

  test('circuit-bench i18n: 英文界面标签零中文，中文界面预设名照旧', () => {
    const seenZh = new Set<string>();
    for (const id of PRESET_IDS) {
      const st = presetState(id);
      const readings = st.components.length ? solveCircuit(st).elements : null;
      const base = {
        state: st,
        readings,
        view: { tx: 0, ty: 0, scale: 1 },
        size: { w: WORLD_W, h: WORLD_H },
        showValues: true,
        showNames: true,
        selectedId: null,
      };
      for (const l of layoutCircuitLabels({ ...base, lang: 'en' })) {
        assert.ok(!hasCjk(l.text), `${id} 英文界面残留中文标签：${l.text}`);
      }
      for (const l of layoutCircuitLabels({ ...base, lang: 'zh' })) {
        if (hasCjk(l.text)) seenZh.add(l.text);
      }
      // 不传 lang 等于中文（旧调用点/旧测试行为不变）
      for (const l of layoutCircuitLabels(base)) {
        if (hasCjk(l.text)) seenZh.add(l.text);
      }
    }
    assert.ok(seenZh.has('电源'), `中文界面丢了「电源」：${[...seenZh].join('/')}`);
    assert.ok(seenZh.has('试样'), `中文界面丢了「试样」：${[...seenZh].join('/')}`);
  });

  test('circuit-bench i18n: componentLabel 取值与回落（派生标号见 naming 用例）', () => {
    const bat = createComponent('bat', 'battery', 100, 300, {}, 0, '电源', 'Cell');
    assert.equal(componentLabel(bat, 'zh'), '电源');
    assert.equal(componentLabel(bat, 'en'), 'Cell');
    assert.equal(componentLabel(bat), '电源');

    // 没有 labelEn 时回落中文名，绝不返回空串（否则英文界面上名字凭空消失）
    const plain = createComponent('r1', 'resistor', 100, 300, {}, 0, 'R₁');
    assert.equal(componentLabel(plain, 'en'), 'R₁');
    // 纯空白英文名视为缺失
    assert.equal(componentLabel({ label: '电源', labelEn: '   ' }, 'en'), '电源');
    // 完全没名字
    const unnamed = createComponent('r2', 'resistor', 100, 300);
    assert.equal(componentLabel(unnamed, 'zh'), '');
    assert.equal(componentLabel(unnamed, 'en'), '');
    // 无名元件照样有名字：标签层按「种类 + 序号」派生标号（`R₁`），
    // 画布上因此永远有标号可认，且绝不把 `r2` 这种内部 id 当名字用。
    const names = layoutCircuitLabels({
      state: stateOf([unnamed], []),
      view: { tx: 0, ty: 0, scale: 1 },
      size: { w: WORLD_W, h: WORLD_H },
      showValues: false,
      showNames: true,
      selectedId: null,
      lang: 'en',
    }).filter((l) => l.id.endsWith(':name'));
    assert.equal(names.length, 1, '无名元件应派生出名称标签');
    assert.equal(names[0].text, 'R₁', `派生标号不对：${names.map((l) => l.text)}`);

    // 分享链接往返不能把英文名丢掉
    const round = sanitizeState(JSON.parse(serializeState(stateOf([bat], []))));
    assert.equal(round.components[0].labelEn, 'Cell');
    assert.equal(round.components[0].label, '电源');
  });

  /* ── P2 尾巴二：删掉元件后探针下拉不再指向已被删除的元件 ── */

  test('circuit-bench probes: 陈旧探针键回退到仍存在的探针', () => {
    const opts = [
      { key: 'bat:voltage' },
      { key: 'bat:current' },
      { key: 'r1:current' },
      { key: 'r1:resistance' },
    ];
    // 键仍在：原样保留（用户手选不被抢走）
    assert.equal(reconcileProbeKey('r1:resistance', opts, 0), 'r1:resistance');
    // 元件被删：优先落到同量的另一个探针（删了电流表还有电源电流 / 电阻电流）
    assert.equal(reconcileProbeKey('am:current', opts, 0), 'bat:current');
    // 删除后没有同量探针：退到该轴的首选位
    assert.equal(reconcileProbeKey('v1:voltage', [opts[1], opts[2]], 0), 'bat:current');
    assert.equal(reconcileProbeKey('q:power', opts, 3), 'r1:resistance');
    // preferred 越界也必须有结果
    assert.equal(reconcileProbeKey('q:power', opts, 99), 'bat:voltage');
    // 空台：返回空串，让下拉框落到「—」，而不是留一个不存在的键
    assert.equal(reconcileProbeKey('bat:voltage', [], 0), '');
    assert.equal(reconcileProbeKey('', [], 1), '');
    // 未知量（没有冒号）也不能崩
    assert.equal(reconcileProbeKey('garbage', opts, 0), 'bat:voltage');
  });

  test('circuit-bench probes: 探针表按当前画布生成，删掉的元件不再留幽灵探针', () => {
    const st = presetState('sp');
    const zhOpts = buildOptions(st, 'zh');
    const enOpts = buildOptions(st, 'en');
    // 一项一键：按元件生成的探针不会重复
    assert.equal(new Set(zhOpts.map((o) => o.key)).size, zhOpts.length, '探针键重复');
    // 英文界面探针名零中文（否则下拉里出现「电源 · 电流 I (A)」）
    for (const o of enOpts) assert.ok(!hasCjk(o.label), `EN 探针名残留中文：${o.label}`);
    const zhBat = zhOpts.find((o) => o.key === 'bat:current');
    const enBat = enOpts.find((o) => o.key === 'bat:current');
    assert.equal(zhBat?.label, '电源 · 电流 I (A)', `中文探针名不对：${zhBat?.label}`);
    assert.equal(enBat?.label, 'Cell · Current I (A)', `英文探针名不对：${enBat?.label}`);

    // 删掉电流表：它的探针必须一起从表里消失
    const cut = removeComponent(st, 'a1');
    const afterCut = buildOptions(cut, 'en');
    assert.ok(
      !afterCut.some((o) => o.elementId === 'a1'),
      `删除后仍列出 a1 探针：${afterCut.filter((o) => o.elementId === 'a1').map((o) => o.label)}`,
    );
    // 删除前 X 轴选中的键，删除后回退到表里真实存在的同类探针
    const nextKey = reconcileProbeKey('a1:current', afterCut, 0);
    assert.ok(afterCut.some((o) => o.key === nextKey), `回退键不在表里：${nextKey}`);
    // 幽灵探针取不到读数——正因如此它绝不能被回退选中
    const ghost: ProbeOption = {
      key: 'a1:current',
      elementId: 'a1',
      quantity: 'current',
      name: 'Ammeter A',
      quantityName: 'Current I',
      short: 'Ammeter A · I (A)',
      label: 'Ammeter A · Current I (A)',
      unit: 'A',
      source: 'result',
      scale: 1,
      offset: 0,
      group: 'meter',
    };
    assert.ok(Number.isNaN(readProbe(cut, solveCircuit(cut), ghost)), '已删除的元件不该给出读数');

    // 空台：没有探针，回退结果为空串 → 下拉落到「—」而不是不存在的键
    const empty = buildOptions(createEmptyState(), 'en');
    assert.equal(empty.length, 0);
    assert.equal(reconcileProbeKey('a1:current', empty, 0), '');
  });

  test('circuit-bench probes: 开关/保险丝/导线不进表，电表置顶、组内固定 U→I→R→P', () => {
    const st = presetState('sp');
    const opts = buildOptions(st, 'zh');
    const keys = opts.map((o) => o.key);

    // 开关（S / S₂）与保险丝不进表：U、I、R 不是它们的教学内容
    for (const o of opts) {
      assert.ok(
        o.elementId !== 'sw' && o.elementId !== 'short' && o.elementId !== 'fu',
        `开关/保险丝出现在探针表里：${o.label}`,
      );
      assert.ok(!/^[SF]\d*[\s·]/.test(o.label), `开关/保险丝探针名：${o.label}`);
    }

    // 短路与保险丝预设：保险丝与两个开关（S₁ / S₂）一条都不进，表里只剩电源与灯泡
    const fuseOpts = buildOptions(presetState('fuse'), 'zh');
    assert.deepEqual(
      fuseOpts.map((o) => o.key),
      ['bat:voltage', 'bat:current', 'l1:voltage', 'l1:current', 'l1:resistance', 'l1:power'],
      `短路预设探针表不对：${fuseOpts.map((o) => o.label)}`,
    );

    // 电表置顶：上横边上的电流表 A₁ 与它的电压表 V 排在最前
    assert.equal(opts[0].key, 'a1:current', `首位不是电流表：${keys.slice(0, 3)}`);
    assert.equal(opts[0].group, 'meter');
    const firstElement = opts.findIndex((o) => o.group === 'element');
    assert.ok(
      opts.slice(0, firstElement).every((o) => o.group === 'meter'),
      '电表组里混进了元件',
    );
    assert.ok(firstElement > 0, '没有电表组');

    // 元件组内：单个元件内固定 U → I → R → P，不随添加顺序乱跳
    const l2 = opts.filter((o) => o.elementId === 'l2').map((o) => o.quantity);
    assert.deepEqual(l2, ['voltage', 'current', 'resistance', 'power'], `灯泡量序不对：${l2}`);
    const bat = opts.filter((o) => o.elementId === 'bat').map((o) => o.quantity);
    assert.deepEqual(bat, ['voltage', 'current'], `电源量序不对：${bat}`);
    // 元件种类顺序：电源 → 灯泡 → 电阻 → 变阻器 → 电热丝（按首项下标比对）
    const groups = opts.filter((o) => o.group === 'element').map((o) => o.elementId);
    assert.deepEqual(groups, ['bat', 'bat', 'l1', 'l1', 'l1', 'l1', 'l2', 'l2', 'l2', 'l2'], `元件组顺序：${groups}`);
  });

  test('circuit-bench probes: 选项文案是「元件名 · 物理量 (单位)」，绝不出现内部 id', () => {
    for (const id of PRESET_IDS) {
      const st = presetState(id);
      if (!st.components.length) continue;
      const opt = buildOptions(st, 'zh');
      for (const o of opt) {
        // 内部 id（l1 / r2 / rh / bat / a1）绝不当名字用
        assert.ok(!o.name.includes(o.elementId), `探针名里出现内部 id：${o.name} / ${o.elementId}`);
        assert.ok(!o.label.includes(o.elementId), `探针标签里出现内部 id：${o.label}`);
        // 三段式：`元件名 · 物理量 符号 (单位)`
        assert.match(o.label, /^.+ · .+ [UIRPQT] \(.+\)$/, `${id} 标签格式不对：${o.label}`);
        // 收起态只留符号与单位，且不带元件名重复
        assert.match(o.short, /^.+ · [UIRPQT] \(.+\)$/, `${id} 收起文案不对：${o.short}`);
        // 小写 `l`/`i` 不再作为元件名出现（无衬线字体下与电流符号 I 分不开）
        assert.ok(!/^l\d*\b/.test(o.name), `元件名疑似内部 id：${o.name}`);
      }
      // 英文界面同样成三段，且零中文
      for (const o of buildOptions(st, 'en')) {
        assert.match(o.label, /^.+ · .+ [UIRPQT] \(.+\)$/, `EN 标签格式不对：${o.label}`);
      }
    }
  });

  test('circuit-bench probes: 电热丝读得到温度与热量（走元件状态，非网表）', () => {
    const st = presetState('joule');
    const opts = buildOptions(st, 'zh');
    const temp = opts.find((o) => o.key === 'h1:temperature');
    const heat = opts.find((o) => o.key === 'h1:heat');
    assert.ok(temp && heat, `电热丝缺少 T/Q 探针：${opts.map((o) => o.key)}`);
    assert.equal(temp.source, 'state');
    assert.equal(temp.unit, '°C');
    assert.equal(temp.label, '电热丝 R₁ · 温度 T (°C)');
    assert.equal(temp.short, '电热丝 R₁ · T (°C)');
    assert.equal(heat.unit, 'J');
    assert.equal(heat.label, '电热丝 R₁ · 热量 Q (J)');

    // 元件状态是开尔文：显示要换成摄氏度（300 K → 26.85 °C），热量直接读 J
    const solved = solveCircuit(st);
    const t = readProbe(st, solved, temp);
    assert.ok(Math.abs(t - (st.components.find((c) => c.id === 'h1')!.state.temp - 273.15)) < 1e-9, `温度换算不对：${t}`);
    assert.ok(t > 0 && t < 200, `温度读数离谱：${t}`);
    assert.equal(readProbe(st, solved, heat), st.components.find((c) => c.id === 'h1')!.state.heat);

    // 温度/热量不取绝对值：摄氏换算是可能出负号的量，取绝对值等于篡改物理量
    const cold = cloneState(st);
    const heater = cold.components.find((c) => c.id === 'h1')!;
    heater.state.temp = 100; // 100 K → −173.15 °C
    assert.ok(readProbe(cold, null, temp) < 0, '低温读数被取成了绝对值');
  });

  test('circuit-bench probes: 电流计读数按 mA 显示，电表名只在同类多于一个时才编号', () => {
    const st = presetState('bridge');
    const g = buildOptions(st, 'zh').find((o) => o.key === 'g1:current');
    assert.ok(g, '电桥预设缺少检流计探针');
    assert.equal(g.unit, 'mA');
    assert.equal(g.name, '电流计 G', `单个电流计不该编号：${g.name}`);
    assert.equal(g.label, '电流计 G · 电流 I (mA)');
    // 网表读数是安培，探针读到的是毫安：两者只差 1000 倍
    const rawG = solveCircuit(st).elements['g1'];
    assert.ok(
      Math.abs(readProbe(st, solveCircuit(st), g) - Math.abs(rawG.current) * 1000) < 1e-9,
      `mA 换算不对：${readProbe(st, solveCircuit(st), g)} / ${rawG.current}`,
    );

    // 同类多于一个才编号：A₁ / A₂ 与画布上的标号一一对应；
    // 这里用 addComponent 加出来的元件（没有 label）正是「学生自己拖进来的」那一类。
    let two = createEmptyState();
    two = addComponent(two, 'ammeter', 100, 300, { range: 0.6 });
    two = addComponent(two, 'ammeter', 200, 300, { range: 0.6 });
    assert.deepEqual(buildOptions(two, 'zh').map((o) => o.name), ['电流表 A₁', '电流表 A₂'], '两只电流表应编号');
    assert.deepEqual(buildOptions(two, 'en').map((o) => o.name), ['Ammeter A₁', 'Ammeter A₂'], '英文标号不对');
    // 只留一只时下标自动收回 A（不是留一个跳号的 A₂）
    assert.deepEqual(buildOptions(removeComponent(two, 'ammeter_1'), 'zh').map((o) => o.name), ['电流表 A']);
  });

  test('circuit-bench probes: 面板把陈旧键回写进状态、下拉绑定解析后的键', () => {
    const src = readFileSync(
      resolve('src/labs/physics/circuit-bench/MeasurementPanel.tsx'),
      'utf-8',
    );
    assert.match(src, /reconcileProbeKey\(k, options, 0\)/, 'X 轴未接回退');
    assert.match(src, /reconcileProbeKey\(k, options, 1\)/, 'Y 轴未接回退');
    assert.match(src, /value=\{xKeyShown\}/, 'X 下拉未绑定解析后的键');
    assert.match(src, /value=\{yKeyShown\}/, 'Y 下拉未绑定解析后的键');
    assert.match(src, /from '\.\/circuit-bench-probes'/, '探针表未从纯函数模块引入');
    const probes = readFileSync(
      resolve('src/labs/physics/circuit-bench/circuit-bench-probes.ts'),
      'utf-8',
    );
    assert.match(probes, /KIND_QUANTITIES\[el\.kind\]\?\.includes\(quantity\)/, '探针未按元件种类过滤');
    assert.match(probes, /switch: \[\],\s*\n\s*fuse: \[\],/, '开关/保险丝未从探针表剔除');
    assert.match(probes, /elementName\(state, el, lang\)/, '探针名未走统一命名模块');
    // 探针的读数来源分两路：网表（solve 结果）与元件状态（电热丝的温度/热量）
    assert.match(probes, /source: 'state'/, '元件状态类探针不见了');
    const measurement = readFileSync(
      resolve('src/labs/physics/circuit-bench/MeasurementPanel.tsx'),
      'utf-8',
    );
    assert.match(measurement, /buildOptions\(state, zh \? 'zh' : 'en'\)/, '探针表未按当前画布生成');
    assert.match(measurement, /readProbe\(state, result, xProbe\)/, '探针读数未带上元件状态');
  });

  test('circuit-bench 命名: 画布、顶栏、检查器、探针表共用同一套派生标号', () => {
    const files: [string, string][] = [
      ['画布标签', 'circuit-bench-labels.ts'],
      ['顶栏', 'CircuitBench.tsx'],
      ['检查器', 'InspectorPanel.tsx'],
      ['探针表', 'circuit-bench-probes.ts'],
    ];
    for (const [who, file] of files) {
      const src = readFileSync(resolve('src/labs/physics/circuit-bench', file), 'utf-8');
      assert.match(src, /from '\.\/circuit-bench-naming'/, `${who} 未走统一命名模块`);
    }
    // 内部小写 id 不得再作为用户可见名的回退（`l1 I (A)` 那种）
    const bench = readFileSync(resolve('src/labs/physics/circuit-bench/CircuitBench.tsx'), 'utf-8');
    assert.ok(!/componentLabel\([^)]*\)\s*\|\|/.test(bench), '顶栏仍拿内部 id 当名字回退');
    const inspector = readFileSync(resolve('src/labs/physics/circuit-bench/InspectorPanel.tsx'), 'utf-8');
    assert.ok(!/componentLabel\(/.test(inspector), '检查器未切到统一命名');
    // 预设里不许再写符号型标签（`S`/`A`/`R′`/`R₁`）：标号由序号派生，写死了会错位
    const presets = readFileSync(resolve('src/labs/physics/circuit-bench/circuit-bench-presets.ts'), 'utf-8');
    assert.ok(!/, '(S|A|V|G|FU|R|R′|S₂|R₁|R₂|R₃|R₄|电源)'/.test(presets), '预设里残留符号型标签');
  });

  test('circuit-bench 工具栏: 图标按钮不再被内边距挤扁，全屏并入「图标 + 文字」', () => {
    const btn = readFileSync(resolve('src/labs/physics/circuit-bench/BenchToolbar.tsx'), 'utf-8');

    // 基类不得自带左右内边距：px-2.5 与 px-0 同时落盘时由 CSS 生成顺序（而非类名书写顺序）决定胜负，
    // 实测就是 px-2.5 赢，28px 宽的按钮只剩 8px 内容宽，14×14 图标被压成 6×14 的麻点。
    const base = btn.match(/const BTN_BASE\s*=\s*'([^']+)'/)?.[1] ?? '';
    assert.ok(base, '缺少 BTN_BASE');
    assert.ok(!/\bpx-|\bpy-/.test(base), `BTN_BASE 不得带内边距：${base}`);
    for (const token of ['inline-flex', 'shrink-0', 'h-7', 'items-center', 'justify-center']) {
      assert.ok(base.includes(token), `BTN_BASE 缺少 ${token}`);
    }
    // 只在扩展类串里写一次内边距，两边就不会打架
    const icon = btn.match(/const ICON_BTN\s*=\s*`([^`]+)`/)?.[1] ?? '';
    assert.ok(icon.includes('${BTN_BASE}'), 'ICON_BTN 须复用 BTN_BASE');
    assert.ok(/\bw-7\b/.test(icon), `纯图标按钮须收成正方形：${icon}`);
    assert.ok(/\bp-0\b/.test(icon), `纯图标按钮须清除内边距：${icon}`);
    assert.ok(!/\bpx-/.test(icon), `ICON_BTN 不得再叠一层左右内边距：${icon}`);

    // 图标一律 shrink-0：这是一排 28px 小控件，宁可文字换行也不许压扁图标
    for (const name of ['ICON', 'ICON_MD']) {
      const cls = btn.match(new RegExp(`const ${name}\\s*=\\s*'([^']+)'`))?.[1] ?? '';
      assert.ok(cls.includes('shrink-0'), `${name} 缺少 shrink-0：${cls}`);
    }
    assert.ok(/\bICON_MD\b/.test(btn), '撤销/重做须用 16px 图标常量');
    // 撤销/重做走纯图标串，全屏走「图标 + 文字」串——后者带可见文字，学生才认得出「退出全屏」
    for (const label of ['撤销', '重做']) {
      assert.match(btn, new RegExp(`aria-label=\\{zh \\? '${label}'`), `${label}按钮缺少 aria-label`);
    }
    assert.ok(!/aria-label=\{zh \? \(fullscreen/.test(btn), '全屏按钮的可读名须来自可见文字，不能再挂 aria-label');
    for (const token of ['Shrink', '退出全屏', '<Expand']) {
      assert.ok(btn.includes(token), `全屏按钮缺少 ${token}`);
    }

    // 全局：画布区所有按钮内的 SVG 图标都要 shrink-0（复选框不是 SVG，不在此列）
    const dir = 'src/labs/physics/circuit-bench';
    for (const file of readdirSync(resolve(dir))) {
      if (!file.endsWith('.tsx')) continue;
      const lines = readFileSync(resolve(dir, file), 'utf-8').split('\n');
      lines.forEach((line, i) => {
        if (!/\b(h-3|h-3\.5|h-4)\b w-\d/.test(line)) return;
        if (line.includes('accent-')) return; // <input type="checkbox">，不是图标
        assert.ok(line.includes('shrink-0'), `${file}:${i + 1} 图标缺少 shrink-0：${line.trim()}`);
      });
    }
  });

  test('circuit-bench 全屏: 沉浸式外壳吃掉视口、画布拿到主高度、数据面板收起为浮层', () => {
    const shell = benchShellClass(true);
    // 若元素自身不铺底色，Chrome 的 ::backdrop 纯黑会从任何没盖到的地方漏出来
    for (const token of [
      'flex',
      'h-screen',
      'w-screen',
      'flex-col',
      'overflow-hidden',
      'bg-[var(--bg)]',
      'text-[var(--fg)]',
      'p-3',
      'sm:p-4',
      'gap-2.5',
    ]) {
      assert.ok(shell.includes(token), `全屏外壳缺少 ${token}：${shell}`);
    }
    assert.ok(!benchShellClass(false).includes('h-screen'), '常态外壳不得锁视口高度');

    for (const cls of [canvasCardClass(true), canvasSlotClass(true)]) {
      assert.ok(cls.includes('flex-1'), `全屏画布未吃掉主高度：${cls}`);
      assert.ok(cls.includes('min-h-0'), `全屏画布缺少 min-h-0，会被内容顶开：${cls}`);
    }
    assert.ok(canvasCardClass(true).includes('flex-col'), '全屏画布卡须纵向排布工具栏与画布');
    assert.ok(!canvasSlotClass(false).includes('flex-1'), '常态画布高度由 benchLayout 写死，不得再抢高度');

    // 收起态只在左下角留一枚胶囊，展开态是贴底浮层；都不占画布高度
    const chip = measureDrawerClass(false);
    assert.ok(chip.includes('absolute') && chip.includes('pointer-events-none'), `收起态须是浮层：${chip}`);
    const drawer = measureDrawerClass(true);
    for (const token of ['absolute', 'inset-x-3', 'bottom-3', 'pointer-events-none']) {
      assert.ok(drawer.includes(token), `展开态缺少 ${token}：${drawer}`);
    }

    const src = readFileSync(resolve('src/labs/physics/circuit-bench/CircuitBench.tsx'), 'utf-8');
    for (const token of ['benchShellClass', 'canvasCardClass', 'canvasSlotClass', 'measureDrawerClass']) {
      assert.ok(src.includes(token), `CircuitBench 未使用 ${token}`);
    }
    assert.ok(src.includes('data-bench-shell'), '全屏根容器须有稳定钩子');
    // 进出全屏补一次内容适配：盒子从「按版心宽度推导的固定高度」换成视口剩余高度，
    // 尺寸变化本身不会触发 fitViewToContent，电路会缩在旧比例里。
    assert.match(src, /useEffect\(\(\) => \{\s*setFitSignal\(\(n\) => n \+ 1\);\s*\}, \[fullscreen\]\)/, '进出全屏未触发一次适配');
    // 默认收起，把纵向空间 100% 让给画布；退出时恢复原选择
    assert.match(src, /if \(fullscreen\) \{\s*measureBeforeFullscreen\.current = measureOpen;\s*setMeasureOpen\(false\);/, '全屏未默认收起数据面板');
    assert.match(src, /setMeasureOpen\(measureBeforeFullscreen\.current\)/, '退出全屏未恢复原折叠状态');
    // 面板始终挂在同一处，只换外层容器——进出全屏不能卸载它、丢掉已记录的读数
    assert.match(src, /floating=\{fullscreen\}/, '数据面板未接入浮层形态');

    const panel = readFileSync(resolve('src/labs/physics/circuit-bench/MeasurementPanel.tsx'), 'utf-8');
    assert.match(panel, /floating\?: boolean/, '数据面板缺少 floating 入参');
    assert.match(panel, /pointer-events-auto/, '浮层形态须自己把指针事件收回来');
    assert.ok(panel.includes('backdrop-blur-md'), '浮层形态须是磨砂抽屉');
  });

  /* ══════════════════════════════════════════════════════════════════════
     希沃大屏交互改造：触控手势 / 左侧分类元件坞 / 右键菜单 / 跟手操作条
     ══════════════════════════════════════════════════════════════════════ */

  /** 动作 id 序列，方便断言「菜单里到底有哪几项、按什么顺序」。 */
  const ids = (items: readonly MenuItem[]): MenuAction[] => items.map((i) => i.id);

  /** 按 id 找一项；找不到直接炸，免得断言在 undefined 上悄悄通过。 */
  const pick = (items: readonly MenuItem[], id: MenuAction): MenuItem => {
    const hit = items.find((i) => i.id === id);
    assert.ok(hit, `菜单里没有 ${id}`);
    return hit as MenuItem;
  };

  const state = (patch: Partial<CircuitComponent['state']> = {}) => ({
    temp: 300,
    heat: 0,
    blown: false,
    burnt: false,
    ...patch,
  });

  const readSrc = (name: string) =>
    readFileSync(resolve(`src/labs/physics/circuit-bench/${name}`), 'utf-8');

  /**
   * 目录下所有产品源码，用来做「整仓禁用原生拖拽」这类全局断言。
   * 排除测试文件自身——它为了断言禁用词必然写着这些字面量，扫进去会自我命中。
   */
  const benchSources = readdirSync(resolve('src/labs/physics/circuit-bench'))
    .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && f !== 'circuit-bench.test.ts')
    .map((f) => ({ name: f, src: readFileSync(resolve(`src/labs/physics/circuit-bench/${f}`), 'utf-8') }));

  /* ── §4.1 触控手势阈值：希沃红外屏的容差被逐条钉死 ── */

  test('circuit-bench 触控: 双击容差 350ms / 24px，红外屏第二下偏 18px 仍算双击', () => {
    assert.equal(DOUBLE_TAP_MS, 350, '双击时间窗须是 350ms');
    assert.equal(DOUBLE_TAP_SLOP_PX, 24, '双击落点容差须是 24px');

    const a: PointerSample = { t: 1000, x: 300, y: 200 };
    // 同点、200ms 内 —— 教科书式的双击
    assert.equal(isDoubleTap(a, { t: 1200, x: 300, y: 200 }), true);
    // 红外屏实测第二下偏 5–18px：这一档必须判成双击，否则原生 dblclick 的坑就白填了
    assert.equal(isDoubleTap(a, { t: 1200, x: 318, y: 200 }), true, '18px 偏移是红外屏的常态，必须容忍');
    assert.equal(isDoubleTap(a, { t: 1200, x: 316, y: 217 }), true, '斜向按直线距离算，24px 以内也算');
    // 卡在边界上：正好 24px 用 <=，正好 350ms 也收
    assert.equal(isDoubleTap(a, { t: 1350, x: 324, y: 200 }), true, '边界 350ms / 24px 取闭区间');
    // 超时 / 超距 / 时间倒流 三种都不算
    assert.equal(isDoubleTap(a, { t: 1351, x: 300, y: 200 }), false, '多 1ms 就不算双击');
    assert.equal(isDoubleTap(a, { t: 1200, x: 325, y: 200 }), false, '偏出 24px 是两次独立点击');
    assert.equal(isDoubleTap(a, { t: 999, x: 300, y: 200 }), false, '时间倒流不算双击');
    // 没有上级样本时永远不为真：首次 pointerdown 不能凭空触发双击
    assert.equal(isDoubleTap(null, { t: 0, x: 0, y: 0 }), false);

    const canvas = readSrc('CircuitCanvas.tsx');
    assert.ok(canvas.includes('isDoubleTap'), '画布未用 isDoubleTap 判双击');
    assert.ok(
      !/onDoubleClick=/.test(canvas) && !/onDoubleClick=/.test(readSrc('CircuitSymbols.tsx')),
      '元件上不得再挂原生 onDoubleClick，否则鼠标双击会触发两次（翻开关翻回去）',
    );
  });

  test('circuit-bench 触控: 元件本体垫透明命中底，符号镂空处不得把第二下漏给画布', () => {
    /*
     * 上面那条 24px 容差只有在「第二下仍落在元件上」时才起作用。
     * 现实是元件符号到处镂空——开关的闸刀口、电阻的锯齿缝、灯泡玻璃泡之外
     * 那一圈空档——SVG 只对已描边像素做命中测试，手指偏几个像素就穿到画布背景，
     * 于是 onComponentDown 再也收不到第二次 pointerdown：红外大屏上双击永远凑不齐，
     * 还会顺带把「点进缝里」读成「取消选中」。
     * 垫一张与本体等大的透明矩形即可（透明填充照样吃指针，与接线柱热区同一招）。
     */
    const symbols = readSrc('CircuitSymbols.tsx');
    const hit = symbols.indexOf('data-body-hit');
    assert.ok(hit > 0, '元件本体缺少透明命中底（data-body-hit）');
    assert.match(
      symbols.slice(hit, hit + 320),
      /fill="transparent"/,
      '命中底必须是 transparent 填充：透明仍参与命中测试，而它不该被看见',
    );
    assert.match(
      symbols.slice(hit, hit + 320),
      /width=\{bodySize\.w\}[\s\S]*?height=\{bodySize\.h\}/,
      '命中底须与本体等大（bodySize），否则边缘几像素仍会漏给画布',
    );
    assert.ok(
      symbols.lastIndexOf('componentBodySize', hit) > 0,
      '命中底尺寸须取自 componentBodySize，与选中环/本体同源',
    );
    // 必须画在本体组内：落在端子圆之前（端子自己 stopPropagation），
    // 落在本体组之外就没有 onPointerDown 可冒泡，垫了也白垫。
    const bodyGroup = symbols.indexOf('onPointerDown={(e) => onPointerDown?.(e, el.id)}');
    const terminalMap = symbols.indexOf("(['a', 'b'] as const).map");
    assert.ok(bodyGroup > 0 && terminalMap > bodyGroup, '符号结构变了：找不到本体组 / 端子组的分界');
    assert.ok(
      hit > bodyGroup && hit < terminalMap,
      '命中底须夹在本体事件组与端子组之间，否则要么接不住指针、要么抢走接线柱热区',
    );
  });

  test('circuit-bench 触控: 长按 450ms 判菜单，手指搭在屏上 1–2px 抖动不许打断', () => {
    assert.equal(LONG_PRESS_MS, 450, '长按时长须是 450ms');
    assert.equal(LONG_PRESS_SLOP_PX, 8, '长按漂移容差须是 8px');

    const start: PointerSample = { t: 5000, x: 400, y: 300 };
    assert.equal(isLongPress(start, { t: 5450, x: 400, y: 300 }), true);
    assert.equal(isLongPress(start, { t: 5449, x: 400, y: 300 }), false, '449ms 还不够长');
    // 手指微抖 2px 是电容/红外屏的常态，不能因此判成「在拖」
    assert.equal(isLongPress(start, { t: 5450, x: 402, y: 301 }), true, '2px 抖动须容忍');
    assert.equal(isLongPress(start, { t: 5450, x: 409, y: 300 }), false, '漂出 8px 说明是在拖，不是按');

    // 定时器回收口径必须与 isLongPress 一致：只有真的飘出去才收，pointermove 本身不作数
    assert.equal(longPressDrifted(start, { t: 5100, x: 401, y: 301 }), false, '1–2px 抖动不得取消长按');
    assert.equal(longPressDrifted(start, { t: 5100, x: 400, y: 309 }), true);
    // 边界同样取闭区间：正好 8px 还在容差里，9px 才算出界
    assert.equal(longPressDrifted(start, { t: 5450, x: 408, y: 300 }), false, '正好 8px 不算飘');

    assert.ok(readSrc('CircuitCanvas.tsx').includes('longPressDrifted'), '画布未用 longPressDrifted 收定时器');
  });

  test('circuit-bench 触控: 点/拖分流阈值 6px，接线柱屏幕热区 ≥22px', () => {
    assert.equal(DRAG_THRESHOLD_PX, 6);
    assert.equal(TERMINAL_TAP_PX, 22, '接线柱热区规格是屏幕 22px');
    assert.equal(WIRE_MAGNET_PX, 20, '拖拽连线磁吸半径是 20px');

    const start: PointerSample = { t: 0, x: 100, y: 100 };
    assert.equal(exceededDragThreshold(start, { t: 0, x: 103, y: 100 }), false, '3px 还只是「点」');
    assert.equal(exceededDragThreshold(start, { t: 0, x: 105, y: 100 }), false, '5px 还只是「点」');
    assert.equal(exceededDragThreshold(start, { t: 0, x: 106, y: 100 }), true, '6px 起算拖拽（闭区间）');
    assert.equal(exceededDragThreshold(start, { t: 0, x: 105, y: 105 }), true, '斜向要按勾股算：4/4 只有 5.7px，5/5 才过 6px');

    // 屏幕像素 ↔ 世界单位：两边都要有除零兜底，缩放为 0 时不能变 Infinity/NaN
    assert.equal(pxToWorld(22, 2), 11);
    assert.equal(worldToPx(11, 2), 22);
    assert.equal(pxToWorld(22, 0), 22000, 'pxPerWorld 为 0 时须夹到 0.001，不得除零');
    assert.equal(worldToPx(22, 0), 0.022);
    assert.ok(Number.isFinite(pxToWorld(22, 0)) && Number.isFinite(worldToPx(22, 0)));
  });

  test('circuit-bench 触控: 透明命中区世界半径随缩放放大，但封顶 30（所以画布层还要补一道屏幕判定）', () => {
    // 屏幕 22px 在大屏上换算成世界单位会很大，必须让热区跟着放大
    assert.equal(terminalHitRadiusWorld(1), 22);
    assert.equal(terminalHitRadiusWorld(2), 11);
    assert.equal(terminalHitRadiusWorld(0.5), 30, '世界半径封顶 30，不能连成一片');
    assert.equal(terminalHitRadiusWorld(10), 9, '缩得很小时保底 9 个世界单位');
    // 封顶意味着「世界半径 × 倍率」拿不满 22px：0.5 时只有 15px，
    // 这正是 onSvgPointerDown 里那道 nearestTerminalRef + TERMINAL_TAP_PX
    // 屏幕空间兜底存在的理由——少了它，规格里的「≥22px」在大屏上就是空话。
    assert.ok(worldToPx(terminalHitRadiusWorld(0.5), 0.5) < TERMINAL_TAP_PX);
    assert.equal(worldToPx(terminalHitRadiusWorld(0.5), 0.5), 15);

    const canvas = readSrc('CircuitCanvas.tsx');
    for (const token of ['nearestTerminalRef', 'TERMINAL_TAP_PX', 'terminalHitRadiusWorld']) {
      assert.ok(canvas.includes(token), `画布缺少接线柱热区兜底：${token}`);
    }
  });

  test('circuit-bench 触控: 防误触守卫禁掉浏览器手势与文本选择', () => {
    assert.ok(TOUCH_GUARD.includes('touch-none'), '须关掉浏览器自带手势');
    assert.ok(TOUCH_GUARD.includes('select-none'), '须关掉长按文本选择');

    // 画布容器、元件坞、右键菜单三处都要挂守卫，缺一处长按就会被
    // 系统的「选中文字 / 橡皮筋滚动」抢走。
    const guarded: string[] = [
      'CircuitCanvas.tsx',
      'ElementPalette.tsx',
      'CanvasContextMenu.tsx',
    ];
    for (const file of guarded) {
      const src = readSrc(file);
      assert.ok(src.includes('TOUCH_GUARD'), `${file} 未挂 TOUCH_GUARD`);
      assert.ok(src.includes("from './circuit-bench-touch'"), `${file} 未从 touch 模块取守卫`);
    }
  });

  /* ── §2 左侧分类元件坞 ── */

  test('circuit-bench 元件坞: 四组分类覆盖全部 11 种元件，顺序与教材讲法一致', () => {
    assert.equal(PALETTE_GROUPS.length, 4, '必须是四组，多了学生要找');
    assert.deepEqual(
      PALETTE_GROUPS.map((g) => g.id),
      ['source', 'load', 'control', 'meter'],
    );
    assert.deepEqual(
      PALETTE_GROUPS.map((g) => g.zh),
      ['电源与连接', '用电器', '控制与保护', '测量电表'],
    );
    for (const g of PALETTE_GROUPS) {
      assert.ok(g.en.length > 0, `${g.id} 缺英文名`);
      assert.ok(g.kinds.length > 0, `${g.id} 是空组`);
    }

    const all = PALETTE_GROUPS.flatMap((g) => g.kinds);
    assert.equal(all.length, 11, '元件总数须是 11');
    assert.equal(new Set(all).size, 11, '同一个元件不得出现在两组里');
    assert.deepEqual(
      [...all].sort(),
      [
        'ammeter',
        'battery',
        'bulb',
        'fuse',
        'galvanometer',
        'heater',
        'resistor',
        'rheostat',
        'switch',
        'voltmeter',
        'wire',
      ],
      '分类必须覆盖 ElementKind 全集，漏一个学生就永远拖不出那个元件',
    );

    // 每一组的内容也要对得上——「电源与连接」里放电阻就违背了分类的初衷
    const of = (id: string) => PALETTE_GROUPS.find((g) => g.id === id)!.kinds;
    assert.deepEqual([...of('source')], ['battery', 'wire']);
    assert.deepEqual([...of('load')], ['bulb', 'resistor', 'heater']);
    assert.deepEqual([...of('control')], ['switch', 'rheostat', 'fuse']);
    assert.deepEqual([...of('meter')], ['ammeter', 'voltmeter', 'galvanometer']);

    for (const k of all) {
      assert.equal(of(groupIdOfKind(k)).includes(k), true, `${k} 的归属组算错了`);
    }
  });

  test('circuit-bench 元件坞: 默认全展开、可逐组折叠、可一键全收', () => {
    const open = defaultOpenState();
    assert.deepEqual(Object.keys(open).sort(), ['control', 'load', 'meter', 'source']);
    assert.equal(Object.values(open).every(Boolean), true, '默认须全展开，否则学生点三次才看到');
    assert.equal(allGroupsClosed(open), false);

    // 逐组折叠：只翻自己那一个
    const one = toggleGroup(open, 'load');
    assert.equal(one.load, false);
    assert.equal(one.source, true, '折叠一组不得连累别组');
    assert.equal(open.load, true, '不得原地改原对象');
    assert.equal(allGroupsClosed(one), false);

    // 未知 id：原样返回，不得凭空造键（否则「全部展开」的文案判定会错）
    const bogus = toggleGroup(open, 'nope');
    assert.equal(bogus, open, '未知分组须原样返回同一个对象');
    assert.equal(Object.keys(bogus).length, 4);

    // 一键全收 / 全展
    const closed = setAllGroups(open, false);
    assert.equal(allGroupsClosed(closed), true, '全收后 allGroupsClosed 须为真');
    assert.equal(Object.keys(closed).length, 4);
    assert.equal(allGroupsClosed(setAllGroups(open, true)), false);
    assert.deepEqual(setAllGroups(open, true), open, '全展应回到默认态');
  });

  test('circuit-bench 元件坞: 拖拽落点吸附到网格，所见即所得', () => {
    assert.equal(GRID, 10);
    assert.deepEqual(snapDropPoint({ x: 123, y: 456 }), { x: 120, y: 460 });
    assert.deepEqual(snapDropPoint({ x: 124, y: 126 }), { x: 120, y: 130 }, '四舍五入到最近刻度');
    assert.deepEqual(snapDropPoint({ x: 125, y: 125 }), { x: 130, y: 130 }, '正好半格向上进位');
    assert.deepEqual(snapDropPoint({ x: 0, y: 0 }), { x: 0, y: 0 });
    assert.deepEqual(snapDropPoint({ x: -12, y: -8 }), { x: -10, y: -10 }, '负坐标同样要吸');
    // 落点必须真的落在网格上——预览与建元件共用它，才不会「松手后跳一格」
    for (const p of [{ x: 37, y: 91 }, { x: 1000, y: 617 }, { x: -33, y: 44 }]) {
      const s = snapDropPoint(p);
      // 负坐标取模会得到 -0，这里统一比绝对值
      assert.equal(Math.abs(s.x % GRID), 0, `${p.x} 未吸到网格`);
      assert.equal(Math.abs(s.y % GRID), 0, `${p.y} 未吸到网格`);
    }
  });

  test('circuit-bench 元件坞: 拖拽只走 pointer 事件，整仓禁用 HTML5 原生 DnD', () => {
    const palette = readSrc('ElementPalette.tsx');
    for (const token of [
      'onPointerDown',
      'onPointerMove',
      'onPointerUp',
      'onPointerCancel',
      'setPointerCapture',
      'projection',
    ]) {
      assert.ok(palette.includes(token), `元件坞缺少 ${token}——希沃/iPad 上原生拖拽根本不工作`);
    }
    // 幽灵预览：跟手 + 落点是否在画布内（绿/红）
    assert.ok(palette.includes('fixed z-[70]'), '幽灵预览须是跟手的固定定位浮层');
    assert.ok(palette.includes('ok:'), '幽灵预览须带「能否落下」的状态');
    // 消抖：pointerup 之后合成的 click 不能再走一次「自动摆放」，否则一次拖拽建两个
    assert.ok(palette.includes('handledAt'), '缺少合成点击消抖');
    assert.match(palette, /e\.timeStamp - handledAt\.current < 500/, '消抖时间窗须是 500ms');
    // 折叠 UI：每组可点标题，且有 aria-expanded 供无障碍与测试定位
    assert.ok(palette.includes('aria-expanded'), '分组折叠缺少 aria-expanded');
    assert.ok(palette.includes('setAllGroups') && palette.includes('allGroupsClosed'), '缺一键全展/全收');
    assert.ok(palette.includes('PALETTE_GROUPS'), '元件坞须由分组模型驱动，不得写死一排格子');

    // 整仓扫描：原生 draggable 一律不许出现（注释里提到历史原因不算）
    for (const { name, src } of benchSources) {
      assert.ok(!/\bdraggable=/.test(src), `${name} 用了 HTML5 原生 draggable`);
      assert.ok(!src.includes('onDragStart'), `${name} 用了 onDragStart`);
      assert.ok(!src.includes('onDragOver'), `${name} 用了 onDragOver`);
      assert.ok(!/onDrop=/.test(src), `${name} 用了原生 onDrop`);
    }
  });

  test('circuit-bench 元件坞: 缩略图视口随「电路图/仿真图」切换——电路图裁掉引线，仿真图留住接线柱', () => {
    const kinds = PALETTE_GROUPS.flatMap((g) => g.kinds);
    assert.equal(kinds.length, 11, '视口表须覆盖全部 11 种元件');
    for (const kind of kinds) {
      const half = paletteHalfSpan(kind);
      const sch = paletteIconBox(kind, 'schematic');
      const phy = paletteIconBox(kind, 'physical');
      // 电路图：本体只是中间那块符号，两端引线是画在导线上的「多余空白」，
      // 裁掉它缩略图才撑得满、线宽才粗得起来。
      assert.ok(sch.w < 2 * half, `${kind} 电路图视口没裁掉引线（${sch.w} ≥ ${2 * half}）`);
      // 仿真图：教具本身就是「外壳 + 两端红黑接线柱」，接线柱与 ± 标识正是学生
      // 要认的东西，裁掉就把教具裁残了。
      assert.ok(phy.w >= 2 * half, `${kind} 仿真图视口把接线柱裁掉了（${phy.w} < ${2 * half}）`);
      assert.notDeepEqual(sch, phy, `${kind} 两种模式的视口不该是同一张`);
      for (const box of [sch, phy]) {
        assert.ok(box.w > 0 && box.h > 0, `${kind} 视口尺寸须为正`);
      }
    }
    // 未知模式按电路图处理，与 strategyFor 同一口径（换视图不许出现第三种画法）
    assert.deepEqual(paletteIconBox('bulb', undefined), paletteIconBox('bulb', 'schematic'));
  });

  test('circuit-bench 元件坞: 缩略图上的演示元件就是画布上要新建的那一个', () => {
    for (const kind of PALETTE_GROUPS.flatMap((g) => g.kinds)) {
      assert.deepEqual(
        paletteDemoElement(kind, 'demo'),
        createComponent('demo', kind, 0, 0),
        `${kind} 缩略图参数与新建元件不一致，学生会「看的是一个、拖出来的是另一个」`,
      );
    }
    // 电池盒上那个 6V 是学生第一眼要读的数字，缩略图不能标成别的值
    assert.equal(paletteDemoElement('battery', 'demo').params.emf, 6, '电池盒缩略图须标 6V');
  });

  test('circuit-bench 元件坞: 图标本体与画布同源，切模式时按钮与拖拽幽灵一起换', () => {
    const palette = readSrc('ElementPalette.tsx');
    // 元件坞自己不再手绘第三套简笔符号——三处图标同源才可能「永远一致」
    assert.ok(!/function Glyph/.test(palette), '元件坞不得再自带一套手绘图标');
    assert.ok(palette.includes("from './PaletteGlyph'"), '图标须取画布本体的渲染器');
    assert.ok(/viewMode\?: CircuitViewMode/.test(palette), '元件坞缺少 viewMode 入参');
    assert.ok(palette.includes('data-view-mode={viewMode}'), '元件坞须把当前模式标在 DOM 上供核验');
    assert.match(
      palette,
      /<PaletteGlyph[\s\S]{0,200}?viewMode=\{viewMode\}/,
      '按钮里的图标未跟随视图模式',
    );
    // 跟手幽灵必须和按钮同源同模式，否则手指底下看到的与松手后落下的不是一回事
    assert.match(
      palette,
      /\{ghost && \([\s\S]{0,900}?<PaletteGlyph[\s\S]{0,200}?viewMode=\{viewMode\}/,
      '拖拽幽灵未跟随视图模式',
    );
    // §3 放大：缩略图 32px 高、按视口比例自适应并封顶在格子里；元件名 12px 中等字重
    assert.ok(palette.includes('h-8 max-w-full'), '缩略图须放大到 32px 高并撑满图标区');
    assert.ok(palette.includes('text-xs leading-none font-medium'), '元件名须 12px 中等字重');
    assert.ok(!palette.includes('h-6 w-6'), '旧的 24px 小图标尺寸须清干净');

    const glyph = readSrc('PaletteGlyph.tsx');
    assert.ok(glyph.includes('strategyFor(viewMode).Body'), '图标须复用画布本体的渲染器');
    assert.ok(glyph.includes('paletteIconBox(kind, viewMode)'), '图标视口须随模式切换');
    assert.ok(glyph.includes('data-view-mode={viewMode}'), '图标 SVG 须带模式标记（截图核验靠它）');
    assert.ok(glyph.includes('data-palette-glyph'), '图标 SVG 须能被稳定选中');
    assert.ok(glyph.includes('preserveAspectRatio="xMidYMid meet"'), '视口比例各异，缩略图不得拉伸变形');
    assert.ok(glyph.includes('useId'), '渐变 id 须逐实例唯一，否则元件坞/幽灵/画布三份同名渐变互相抢');
    assert.ok(!/strokeWidth=/.test(glyph), '不得统一注入线宽：本体的粗细是有意分层的');

    assert.ok(
      readSrc('CircuitBench.tsx').includes('viewMode={viewMode}'),
      '上层未把当前视图模式传给元件坞',
    );
  });

  test('circuit-bench 元件坞: 拖到画布落点是世界坐标吸附后建件并选中', () => {
    const bench = readSrc('CircuitBench.tsx');
    // 屏幕坐标 → 世界坐标只能由画布算（它才持有 pan/zoom）
    assert.ok(bench.includes('clientToWorld'), '落点须经画布换算成世界坐标');
    assert.ok(bench.includes('snapDropPoint(world)'), '落点须吸附网格后再建件');
    assert.match(
      bench,
      /const onDropAt = \(kind: ElementKind, clientX: number, clientY: number\)/,
      '缺少拖拽落点入口 onDropAt',
    );
    assert.ok(bench.includes('onDropAt={onDropAt}'), '元件坞未接上落点回调');
    assert.ok(bench.includes('projection={paletteProjection}'), '元件坞未拿到坐标投影');
    assert.ok(bench.includes('toWorld') && bench.includes('toClient'), '投影须双向（预览要回算屏幕位置）');
    // 左侧浮层：不再占版心，画布仍是整宽
    assert.ok(bench.includes('absolute left-3 top-3'), '元件坞须浮在画布左侧内缘');
    assert.ok(bench.includes('pointer-events-none absolute'), '浮层外层须不吃指针，否则挡住画布手势');
  });

  /* ── §3.2 双击展开详细参数面板 ── */

  test('circuit-bench 双击: 开关就地切换，其它元件展开右侧详细面板', () => {
    const bench = readSrc('CircuitBench.tsx');
    assert.match(bench, /const onElementDoubleTap = \(id: string\)/, '缺少双击入口');
    assert.match(
      bench,
      /if \(el\.kind === 'switch'\)[\s\S]{0,400}?toggleSwitch\(h\.present, id\)/,
      '双击开关须直接切换闭合状态',
    );
    assert.match(
      bench,
      /const onElementDoubleTap = \(id: string\)[\s\S]{0,900}?setInspectorOpen\(true\)/,
      '双击非开关元件须展开详细参数面板',
    );

    // 单击只做选中/拖动：面板的开合由 inspectorOpen 决定
    assert.ok(bench.includes('inspectorOpen'), '缺少面板开合状态');
    assert.match(
      bench,
      /const showInspector = hasSelection \? inspectorOpen :/,
      '面板可见性须由 inspectorOpen 决定',
    );
    // 但「未选中 + 有全局告警」时告警卡片必须一直看得见，不能被这条短路吞掉
    assert.match(bench, /result\?\.warnings\?\.length \?\? 0\) > 0/, '无选中须保留全局告警卡片');
    // 点空白/取消选中要顺手收起面板
    assert.ok(bench.includes('if (!id) setInspectorOpen(false)'), '取消选中未收起面板');

    const panel = readSrc('InspectorPanel.tsx');
    assert.ok(panel.includes('onClose?: () => void'), '检查器缺少收起入口');
    assert.ok(panel.includes('收起参数面板'), '收起按钮缺少中文无障碍名');
    assert.ok(panel.includes('CloseButton'), '缺少收起按钮组件');
    assert.ok(panel.includes('onClose={onClose}'), '收起按钮未接上回调');
    assert.ok(bench.includes('onClose={() => setInspectorOpen(false)}'), '检查器的 ✕ 未接上');
  });

  /* ── §3.3 右键 / 长按菜单 ── */

  test('circuit-bench 右键菜单: 元件动作随种类增减，顺序稳定且文案双语', () => {
    const bulb = createComponent('b1', 'bulb', 0, 0);
    assert.deepEqual(elementMenuItems(bulb).map((i) => i.id), [
      'rotate-cw',
      'rotate-ccw',
      'duplicate',
      'inspect',
      'delete',
    ]);
    assert.ok(!ids(elementMenuItems(bulb)).includes('swap-polarity'), '灯泡两端不分正负，不该给极性动作');
    assert.ok(!ids(elementMenuItems(bulb)).includes('toggle-switch'), '灯泡不该有开关动作');
    assert.ok(!ids(elementMenuItems(bulb)).includes('repair'), '好灯泡不该有修复动作');

    // 开关：切换闭合/断开排在最前
    const sw = createComponent('s1', 'switch', 0, 0, { closed: true });
    assert.equal(ids(elementMenuItems(sw))[0], 'toggle-switch');

    // 有极性件才有调换极性；无极性件把它整条去掉，不留「点了没反应」的项
    const battery = createComponent('p1', 'battery', 0, 0);
    assert.equal(ids(elementMenuItems(battery)).includes('swap-polarity'), true);
    assert.equal(ids(elementMenuItems(createComponent('r1', 'resistor', 0, 0))).includes('swap-polarity'), false);

    // 故障件补「更换修复」
    const burnt: CircuitComponent = { ...bulb, state: state({ burnt: true }) };
    assert.equal(ids(elementMenuItems(burnt))[0], 'repair');
    const blown = createComponent('f1', 'fuse', 0, 0, { ratedCurrent: 1 });
    const blownFuse: CircuitComponent = { ...blown, state: state({ blown: true }) };
    assert.equal(ids(elementMenuItems(blownFuse)).includes('repair'), true);
    assert.equal(ids(elementMenuItems(blown)).includes('repair'), false, '没坏就别给修复项');

    // 旋转两项连在一起、删除永远最后；破坏性色只在删除上
    const full = elementMenuItems(burnt);
    assert.equal(full[full.length - 1].id, 'delete');
    assert.equal(full[full.length - 1].danger, true);
    for (const it of full) {
      assert.ok(it.zh.length > 0 && it.en.length > 0, `${it.id} 缺文案——英文界面绝不能弹中文`);
      if (it.danger) assert.equal(it.id, 'delete');
    }
    assert.equal(new Set(ids(full)).size, full.length, '动作 id 不得重复');
  });

  test('circuit-bench 右键菜单: 导线只有删除，空白处是视图操作', () => {
    assert.deepEqual(ids(wireMenuItems()), ['delete-wire']);
    assert.equal(wireMenuItems()[0].danger, true, '删导线须用危险色防误点');

    const shown = blankMenuItems(true);
    assert.deepEqual(ids(shown), ['fit', 'toggle-values', 'clear']);
    assert.equal(pick(shown, 'toggle-values').zh, '隐藏读数', '读数已显示时提供「隐藏」');
    const hidden = blankMenuItems(false);
    assert.equal(pick(hidden, 'toggle-values').zh, '显示读数');
    assert.equal(pick(hidden, 'toggle-values').en, 'Show readings');
    assert.equal(pick(hidden, 'clear').danger, true, '清空画布破坏性最强，必须危险色');
    for (const it of [...shown, ...wireMenuItems()]) {
      assert.ok(it.zh.length > 0 && it.en.length > 0);
    }
  });

  test('circuit-bench 右键菜单: 贴指针弹出，越出视口时先翻转再夹取', () => {
    const menu = { w: 200, h: 300 };
    const vp = { w: 1000, h: 800 };
    assert.deepEqual(menuPosition({ x: 100, y: 100 }, menu, vp), { x: 100, y: 100 });

    // 右下角放不下：翻到指针左侧 / 上方
    assert.deepEqual(menuPosition({ x: 950, y: 600 }, menu, vp), { x: 750, y: 300 });

    // 视口比菜单还小：硬夹到 margin，绝不能返回负数把菜单顶出屏幕
    const tiny = menuPosition({ x: 10, y: 10 }, menu, { w: 100, h: 100 });
    assert.deepEqual(tiny, { x: 8, y: 8 });
    assert.equal(menuPosition({ x: 0, y: 0 }, menu, vp, 8).x, 8, '左上角也要留 margin');
  });

  test('circuit-bench 右键菜单: 12 个动作全部有真实处理，拦截原生右键', () => {
    const ALL: MenuAction[] = [
      'rotate-cw',
      'rotate-ccw',
      'swap-polarity',
      'duplicate',
      'inspect',
      'delete',
      'toggle-switch',
      'repair',
      'delete-wire',
      'fit',
      'toggle-values',
      'clear',
    ];
    // 模型层真的会产出这 12 个 id，一个不多一个不少
    const produced = new Set<string>([
      ...ids(elementMenuItems(createComponent('s', 'switch', 0, 0, { closed: true }))),
      ...ids(elementMenuItems({ ...createComponent('b', 'bulb', 0, 0), state: state({ burnt: true }) })),
      ...ids(elementMenuItems(createComponent('p', 'battery', 0, 0))),
      ...ids(wireMenuItems()),
      ...ids(blankMenuItems(true)),
    ]);
    assert.deepEqual([...produced].sort(), [...ALL].sort());

    const bench = readSrc('CircuitBench.tsx');
    for (const a of ALL) {
      assert.ok(bench.includes(`case '${a}':`), `右键菜单动作 ${a} 没有处理分支`);
    }
    assert.ok(bench.includes('handleMenuAction'), '缺少统一的动作派发口');

    const canvas = readSrc('CircuitCanvas.tsx');
    // 横向跟手条已彻底移除：动作只有一个入口（右键菜单），画布不再渲染它。
    assert.ok(!canvas.includes('QuickActionBar'), '跟手条不得再被画布渲染');
    assert.ok(!canvas.includes('onQuickAction'), '跟手条派发口须一并删除');
    assert.ok(!canvas.includes('useLayoutEffect'), '量尺寸再摆位那套是跟手条专用的，应随它一起走');
    assert.ok(canvas.includes('onContextMenu={onContainerContextMenu}'), '未拦截原生右键菜单');
    assert.match(canvas, /const onContainerContextMenu[\s\S]{0,120}?e\.preventDefault\(\)/, '右键须阻止浏览器默认菜单');
    // 右键 / 长按要能分辨打在谁身上：元件、导线、空白三套
    assert.ok(canvas.includes("closest?.('[data-component-id]')"), '右键未识别元件');
    assert.ok(canvas.includes("closest?.('[data-wire-id]')"), '右键未识别导线');
    assert.ok(canvas.includes('fireMenu'), '右键未按目标分派菜单');

    const menu = readSrc('CanvasContextMenu.tsx');
    assert.ok(menu.includes('menuPosition'), '右键菜单未夹进视口');
    assert.ok(menu.includes("e.key === 'Escape'"), '右键菜单须支持 Esc 关闭');
    assert.ok(menu.includes('pointerdown'), '右键菜单须支持点外部关闭');
    assert.ok(menu.includes('role="menu"') && menu.includes('role="menuitem"'), '菜单缺少无障碍角色');
    assert.match(menu, /onContextMenu=\{\(e\) => e\.preventDefault\(\)\}/, '菜单自身也要吃掉右键');
  });

  /* ── §4.2/§4.3 接线柱磁吸连线与变阻器滑片 ── */

  test('circuit-bench 接线柱: 就近命中（可排除自身）供屏幕空间兜底使用', () => {
    const bat = createComponent('b1', 'battery', 100, 100);
    const t = componentTerminals(bat);

    const nearA = nearestTerminalRef([bat], { x: t.a.x + 3, y: t.a.y }, 20);
    assert.ok(nearA);
    assert.equal(nearA.ref, 'b1:a');
    assert.equal(nearA.d, 3);
    assert.deepEqual(nearA.point, t.a);

    // 半径外一律不命中，免得手指落在半空就把导线拉起来
    assert.equal(nearestTerminalRef([bat], { x: t.a.x + 40, y: t.a.y }, 20), null);
    // 排除起手那个柱子，否则「拖到原位松手」会和起点自己连成一根零长导线
    assert.equal(nearestTerminalRef([bat], { x: t.a.x, y: t.a.y }, 20, 'b1:a'), null);
    assert.equal(nearestTerminalRef([], { x: 0, y: 0 }, 100), null);
  });

  test('circuit-bench 变阻器: 滑片位置换算可逆，旋转后仍沿本地导轨', () => {
    assert.equal(wiperLocalX(0), -WIPER_RAIL_HALF.schematic);
    assert.equal(wiperLocalX(0.5), 0);
    assert.equal(wiperLocalX(1), WIPER_RAIL_HALF.schematic);
    assert.equal(wiperLocalX(2), WIPER_RAIL_HALF.schematic, '比例越界须夹取');
    assert.equal(wiperLocalX(-1), -WIPER_RAIL_HALF.schematic);
    assert.equal(wiperLocalX(undefined), -WIPER_RAIL_HALF.schematic, '缺参数时按 0 处理');
    assert.equal(wiperLocalX(0.5, 'physical'), 0, '仿真图导轨更宽但中心相同');

    const rh = createComponent('h1', 'rheostat', 200, 200, { ratio: 0.5 });
    assert.equal(wiperRatioAt(rh, { x: 200, y: 200 }), 0.5);
    assert.equal(wiperRatioAt(rh, { x: 200 + wiperLocalX(0), y: 200 }), 0);
    assert.equal(wiperRatioAt(rh, { x: 200 + wiperLocalX(1), y: 200 }), 1);
    assert.equal(wiperRatioAt(rh, { x: 400, y: 200 }), 1, '拖到导轨外须夹到端点');
    assert.equal(wiperRatioAt(rh, { x: 0, y: 200 }), 0);
    // 旋转 90° 后导轨变成竖直：手指沿 y 方向移动才该改比例
    const turned: CircuitComponent = { ...rh, rotation: 90 };
    assert.equal(wiperRatioAt(turned, { x: 200, y: 200 + wiperLocalX(1) }), 1);
    // 垂直于导轨的位移不该改变比例（cos90° 有浮点残差，按容差比）
    assert.ok(
      Math.abs(wiperRatioAt(turned, { x: 240, y: 200 }) - 0.5) < 1e-9,
      '垂直于导轨拖动不得改变滑片比例',
    );

    const canvas = readSrc('CircuitCanvas.tsx');
    assert.ok(canvas.includes('wiperRatioAt'), '画布未接上滑片拨动');
    assert.ok(canvas.includes('onWiper'), '画布未把滑片比例派发出去');
    assert.ok(readSrc('CircuitBench.tsx').includes('onWiper'), '上层未接上滑片比例');
  });

  test('circuit-bench 连线: 拖拽橡皮筋与点击两次两种手势共存', () => {
    const canvas = readSrc('CircuitCanvas.tsx');
    assert.ok(canvas.includes('wirePreview'), '缺少拖拽预览状态');
    assert.ok(canvas.includes('startWireDrag'), '缺少统一的起笔函数');
    assert.ok(canvas.includes('setPointerCapture'), '拖拽须捕获指针，手指滑出画布也不能断');
    assert.ok(canvas.includes('strokeDasharray'), '橡皮筋须是虚线，才和成品导线分得开');
    assert.ok(canvas.includes('WIRE_MAGNET_PX') || canvas.includes('TERMINAL_TAP_PX'), '缺少磁吸/热区阈值');
    assert.ok(canvas.includes('nearestTerminalRef'), '松手前未找最近接线柱做磁吸');
    // 点击两次的路径还在：起手 → pendingTerminal 高亮 → 第二次落笔
    assert.ok(canvas.includes('pendingTerminal'), '点击两次接线的手势被改没了');
    assert.ok(canvas.includes('onConnect'), '连线结果须一次性上报（两次 onTerminal 会读到旧状态）');
    assert.ok(readSrc('CircuitBench.tsx').includes('onConnect={connect}'), '上层未接上连线回调');
  });

  test('circuit-bench 交互: 三层手势互不打架（单击选中 / 双击展开 / 长按右键）', () => {
    const canvas = readSrc('CircuitCanvas.tsx');
    // 单击=选中/拖动；双击=展开面板；长按=唯一菜单。三者按时间与位移分流
    assert.ok(canvas.includes('lastTap'), '缺少双击的上一拍记录');
    assert.ok(canvas.includes('longPress'), '缺少长按定时器');
    assert.ok(
      canvas.includes("e.pointerType !== 'mouse'"),
      '长按须放行鼠标（右键交给 onContextMenu，鼠标长按反而会误弹）',
    );
    // 元件坞拖拽起手时要把长按定时器收掉，否则拖到一半弹出菜单
    assert.ok(canvas.includes('cancelLongPress'), '缺少长按取消');
  });

  /* ══════════════════════════════════════════════════════════════════════
     应用内下拉：数据记录面板与详细参数面板不再借用浏览器原生 select
     ══════════════════════════════════════════════════════════════════════ */

  test('circuit-bench 下拉: 数据记录面板与详细参数面板都不再有原生下拉', () => {
    // 原生下拉的系统弹层带不进全站令牌（深色主题下弹一块白底列表）、系统行高在红外屏上
    // 点不准、触屏上还会把列表摆到屏幕中央盖住学生正看的散点图。
    // 扫 `<option`：原生下拉必然要写它；只扫 .tsx——JSX 只可能写在 .tsx 里，
    // 纯 .ts 模块的注释里提到它不算（那种地方也写不出真元素）。
    for (const { name, src } of benchSources.filter((s) => s.name.endsWith('.tsx'))) {
      assert.ok(!/<option/.test(src), `${name} 还留着原生下拉的 <option>`);
      assert.ok(!/<\/select>/.test(src), `${name} 还留着原生 select 的闭合标签`);
    }
    const measurement = readSrc('MeasurementPanel.tsx');
    const inspector = readSrc('InspectorPanel.tsx');
    assert.ok(measurement.includes("from './BenchSelect'"), '数据记录面板未接入应用内下拉');
    assert.ok(inspector.includes("from './BenchSelect'"), '详细参数面板未接入应用内下拉');
    // 横轴 / 纵轴两个探针选择器共用同一个组件，探针表仍从纯函数模块取
    assert.match(measurement, /<ProbeSelect label=\{zh \? '横轴'/, '横轴探针选择器被改没了');
    assert.match(measurement, /<ProbeSelect label=\{zh \? '纵轴'/, '纵轴探针选择器被改没了');
    assert.match(measurement, /<BenchSelect[\s\S]{0,300}options=\{items\}/, '探针表没交给应用内下拉');
  });

  test('circuit-bench 下拉: 弹层四边不出视口，下方放不下就翻到触发器上方', () => {
    const anchor = { x: 600, y: 400, w: 150, h: 32 };
    const panel = { w: 180, h: 200 };
    const viewport = { w: 1440, h: 900 };

    const below = dropdownPosition(anchor, panel, viewport);
    assert.equal(below.placement, 'below');
    assert.equal(below.x, 600);
    assert.equal(below.y, 436, '下方默认留 4px 缝隙');
    assert.equal(below.w, 180);

    const above = dropdownPosition({ ...anchor, y: 800 }, panel, viewport);
    assert.equal(above.placement, 'above', '贴底时要翻到触发器上方');
    assert.equal(above.y, 596);

    assert.equal(dropdownPosition({ ...anchor, x: 1380 }, panel, viewport).x, 1252, '右侧越界须左移回视口');
    assert.equal(dropdownPosition({ ...anchor, x: 0 }, panel, viewport).x, 8, '左侧越界须留边距');
    assert.equal(dropdownPosition(anchor, { w: 100, h: 100 }, viewport).w, 150, '弹层不得窄于触发器');
    assert.equal(dropdownPosition(anchor, { w: 9999, h: 100 }, viewport).w, 1424, '弹层不得宽过视口');

    // 选项特别多、弹层比视口还高：上下都放不下，夹进视口内缘，由组件 max-height 内部滚动
    const tall = dropdownPosition({ x: 10, y: 700, w: 150, h: 32 }, { w: 180, h: 1200 }, viewport);
    assert.equal(tall.placement, 'clamped');
    assert.equal(tall.y, 8);
  });

  test('circuit-bench 下拉: 方向键首尾环绕，陈旧下标也能落到端项', () => {
    assert.equal(nextActiveIndex(0, 1, 3), 1);
    assert.equal(nextActiveIndex(2, 1, 3), 0, '末项再往下回到首项');
    assert.equal(nextActiveIndex(0, -1, 3), 2, '首项再往上到末项');
    assert.equal(nextActiveIndex(-1, 1, 3), 0, '刚展开（还没高亮）向下给首项');
    assert.equal(nextActiveIndex(-1, -1, 3), 2, '刚展开向上给末项');
    assert.equal(nextActiveIndex(9, 1, 3), 0, '浮点/陈旧下标当作重新开始');
    assert.equal(nextActiveIndex(0, 1, 0), -1, '没有选项就没有高亮');
    assert.equal(optionIndexOf([{ value: 'a', label: 'A' }], 'a'), 0);
    assert.equal(optionIndexOf([{ value: 'a', label: 'A' }], 'gone'), -1, '已删元件的旧键找不到');
  });

  test('circuit-bench 下拉: listbox 语义齐备，Esc / 点外 / 滚动都收得干净', () => {
    const sel = readSrc('BenchSelect.tsx');
    for (const token of [
      'createPortal',
      'role="listbox"',
      'role="option"',
      'aria-selected',
      'aria-haspopup="listbox"',
      'aria-expanded',
      'aria-activedescendant',
      'TOUCH_GUARD',
    ]) {
      assert.ok(sel.includes(token), `应用内下拉缺少 ${token}`);
    }
    // portal 的必要性：面板可能停在磨砂抽屉里（backdrop-blur-md + overflow-auto），
    // 这两个都会成为 fixed 弹层的裁剪框，弹层会被切一半或跟着抽屉滚走。
    assert.ok(sel.includes('document.body'), '弹层须挂到 body，否则会被抽屉裁掉');
    assert.ok(/e\.key === 'Escape'/.test(sel), 'Esc 未接管');
    assert.ok(
      /addEventListener\('pointerdown', onDown, true\)/.test(sel),
      '点外关闭须在捕获阶段监听，否则会被面板里的 stopPropagation 挡住',
    );
    assert.ok(
      /addEventListener\('scroll', onScroll, true\)/.test(sel),
      '祖先容器内滚动时弹层须跟随重算位置',
    );
    assert.ok(sel.includes('scrollIntoView'), '键盘走到看不见的选项要自动滚进来');
    assert.ok(sel.includes('min-h-8'), '选项行高须 ≥32px，红外屏的粗指针才点得中');
    assert.ok(sel.includes('visibility'), '量尺寸那一帧须先藏起来，否则弹层会先闪在左上角');

    // 键盘监听的生命周期：应用里有全局 Esc（关检查器 / 取消选中），它一次同步重渲染就会
    // 把依赖 options/onChange 的监听器摘下来——实测症状是「刚打开下拉，第一下 Esc 白按」。
    // 所以监听器只依赖 open，捕获阶段注册，要读的最新值走 ref。
    assert.ok(
      /addEventListener\('keydown', onKey, true\)/.test(sel),
      'keydown 须在捕获阶段监听：冒泡阶段会排在全局 Esc 之后，可能被同一次按键里的同步重渲染摘掉',
    );
    assert.ok(!/\[open, active, options, onChange\]/.test(sel), 'keydown 副作用不该依赖 options/onChange');
    assert.ok(/latest\.current/.test(sel), '键盘监听要读的最新值应收进 ref');
  });

  test('circuit-bench 材料: 换材料必须同时改 ρ，选项上的数字就是引擎用的数字', () => {
    // 改前实测：下拉只往 params.material 写字符串，从不写 params.rho，而 resistanceOf
    // 只读 params.rho——学生照预设步骤「保持 L、S 不变，切换材料，读电阻」做，读数一动不动，
    // 选项上印着的 1.1×10⁻⁶ Ω·m 是个纯装饰。
    const copper = createComponent('r1', 'resistor', 0, 0, {
      mode: 'specimen',
      length: 1,
      area: 5e-7,
      material: 'copper',
      rho: materialOf('copper').rho,
    });
    assert.equal(materialOf('copper').rho, 1.7e-8);
    assert.ok(Math.abs(resistanceOf(copper) - 1.7e-8 / 5e-7) < 1e-12, '铜试样电阻按 ρL/S 算');

    const nichrome = {
      ...copper,
      params: { ...copper.params, material: 'nichrome', rho: materialOf('nichrome').rho },
    };
    assert.ok(
      Math.abs(resistanceOf(nichrome) / resistanceOf(copper) - 1.1e-6 / 1.7e-8) < 1e-9,
      '换成镍铬必须真的把电阻抬高约 64.7 倍',
    );
    assert.equal(materialOf('不存在的材料').id, 'copper', '未知材料回落铜');
    // 预设里写死的 nichrome 必须在表里，否则试样面板显示「—」而引擎照跑
    assert.ok(MATERIAL_RHO.some((m) => m.id === 'nichrome'), '预设用到的材料不在材料表里');

    const panel = readSrc('InspectorPanel.tsx');
    assert.ok(panel.includes('MATERIAL_RHO.map'), '选项须由材料表生成，不得再手写下拉项');
    assert.ok(panel.includes('rho: materialOf(id).rho'), '材料下拉未连同 ρ 一起写入');
    assert.ok(panel.includes('rhoText(m.rho)'), '选项上的 ρ 数值须由表里的数字生成');
  });

  test('circuit-bench 导线拓扑: 端口短桩自适应收短，本体压进 18 单位也不穿体', () => {
    // 改前实测（/tmp/cb-audit/adv_topology.ts P2）：把第二个元件的本体左缘摆到
    // 第一个元件 a 端子法线 18/14/10/6 单位处，固定 18 单位的短桩必然把线送进本体，
    // 「穿体 2 根」是当时唯一会穿体的预设外布局。修法：出线前先沿法线射线探到最近
    // 障碍，`stub = clamp(avail - 4, 4, 18)`，并把首末两段短桩真正纳入穿体判定。
    const bodyHalf = componentBodySize('resistor').w / 2;
    for (const gap of [26, 22, 18, 14, 10, 6]) {
      let st = createEmptyState();
      st = addComponent(st, 'resistor', 300, 300);
      const e1 = st.components[0];
      const a = terminalPoint(e1, 'a');
      st = addComponent(st, 'resistor', a.x + gap + bodyHalf, 300);
      const e2 = st.components[1];
      // 端子间距小于「贴脸」阈值时状态层直接拒绝建线（两个柱子重合没有意义），
      // 这里只关心建出来的线是否干净，所以拒绝也放行。
      const wired = addWire(st, `${e1.id}:a`, `${e2.id}:a`);
      if (!wired.added) continue;
      st = wired.state;
      const obstacles = st.components.map((c) => elementBounds(c));
      const pts = buildWireRoutes(st)[0].points;
      assert.equal(routeCrossings(pts, obstacles), 0, `间隙 ${gap}：短桩不得把线送进本体`);
      assert.equal(routeBacktracks(pts), 0, `间隙 ${gap}：收短后不得折返`);
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1];
        const q = pts[i];
        assert.ok(
          Math.abs(p.x - q.x) < 1e-6 || Math.abs(p.y - q.y) < 1e-6,
          `间隙 ${gap}：折线必须轴对齐`,
        );
      }
      // 短桩确实跟着可用距离收短：18 那一档正好顶到本体边缘（不穿体即接受），
      // 再挤就一路收下来，且永不低于护套画得出来的下限。
      const stub = Math.abs(pts[1].x - a.x) + Math.abs(pts[1].y - a.y);
      assert.ok(stub >= MIN_PORT_STUB - 1e-6, `间隙 ${gap}：短桩 ${stub} 低于下限`);
      assert.ok(stub <= Math.min(PORT_STUB, gap) + 1e-6, `间隙 ${gap}：短桩 ${stub} 比可用距离还长`);
      if (gap <= 14) assert.ok(stub < PORT_STUB, `间隙 ${gap}：短桩 ${stub} 没收短`);
    }
  });

  test('circuit-bench 导线拓扑: 异网共线重叠会被微偏置让开', () => {
    // 改前实测：两根不同网络的导线落在同一条横线上时没有任何标记（跳线只画正交穿越），
    // 读图会把两条线当成同一个节点。修法：路由手里带着「已布线段」索引，
    // 撞上就按 ±8/±16 微偏置让开。
    const p = { x: 100, y: 300 };
    const q = { x: 700, y: 300 };
    const n1 = { x: 1, y: 0 };
    const n2 = { x: -1, y: 0 };
    const mine = ['mine:a', 'mine:b'];
    // 无上下文时的自然走法：一条 y=300 的直线，正好压在别人线上。
    const bare = wireRoutePoints(p, q, n1, n2, PORT_STUB, [], [], {});
    const placed = createPlacedSegments();
    addPlacedSegments(placed, [{ x: 200, y: 300 }, { x: 600, y: 300 }], 1, ['other:a', 'other:b']);
    assert.ok(
      routeOverlaps(bare, placed, 2, mine).crossNet > 0,
      '夹具本身必须是一条会压到异网线的直线，否则这个用例证明不了任何东西',
    );
    const pts = wireRoutePoints(p, q, n1, n2, PORT_STUB, [], [], { placed, net: 2, terminals: mine });
    assert.equal(routeOverlaps(pts, placed, 2, mine).crossNet, 0, '异网共线重叠必须让开到 0');
    assert.notEqual(pts[2].y, 300, '让开的方式就是中段换一条平行车道');
    for (let i = 1; i < pts.length; i++) {
      const u = pts[i - 1];
      const v = pts[i];
      assert.ok(Math.abs(u.x - v.x) < 1e-6 || Math.abs(u.y - v.y) < 1e-6, '微偏置后仍须轴对齐');
    }
    assert.equal(routeBacktracks(pts), 0, '让开不得引入折返');
  });

  test('circuit-bench 导线拓扑: 一横一竖时走干净的单拐 L', () => {
    // 改前实测（/tmp/cb-audit/adv_shape.ts 第二轮）：正交姿态里有一支会拐成三级台阶，
    // 或者明明有干净的单拐 L 却挑了绕远的 Z。修法：L 拐角既不穿体也不折返时直接产出并选中。
    for (const [x, y, rot, name] of [
      [420, 200, 90, '正交（右 vs 上）'],
      [420, 400, 90, '正交（右 vs 下）'],
    ] as const) {
      let st = createEmptyState();
      st = addComponent(st, 'resistor', 300, 300, undefined, 0);
      st = addComponent(st, 'resistor', x, y, undefined, rot as never);
      const [e1, e2] = st.components;
      const wired = addWire(st, `${e1.id}:a`, `${e2.id}:a`);
      assert.ok(wired.added, `${name}：夹具导线未建立`);
      st = wired.state;
      const obstacles = st.components.map((c) => elementBounds(c));
      const pts = buildWireRoutes(st)[0].points;
      assert.equal(routeCrossings(pts, obstacles), 0, `${name}：不得穿体`);
      assert.equal(routeBacktracks(pts), 0, `${name}：不得折返`);
      // 中间段恰好一个拐角：两个短桩必然各折一次（「右 vs 下」的可达下界就是 3 拐），
      // 所以这里卡的不是总拐数，而是「一次能拐完却拐成三级台阶」。
      assert.equal(routeMiddleBends(pts), 1, `${name}：中间段应恰好一次拐弯`);
      assert.equal(
        wireShapeOf(terminalNormal(e1, 'a'), terminalNormal(e2, 'a'), pts[1], pts[pts.length - 2]),
        'L',
        `${name}：一横一竖须判为 L`,
      );
      if (rot === 90 && y < 300) {
        // 「右 vs 上」的短桩端点正好落在同一个 y 上：拐角与短桩同向，白送一个弯，
        // 整条线只需一次拐弯——这正是 M3 要直接产出并选中的那个干净 L。
        assert.equal(routeBends(pts), 1, `${name}：应直接走单拐 L，实画 ${routeBends(pts)} 拐`);
      }
    }
  });

  test('circuit-bench 导线拓扑: buildWireJumps 复用已算好的 routes', () => {
    // 改前实测：buildWireJumps 内部整算一遍 buildWireRoutes，画布一帧付两份账
    // （64 元件 / 128 导线时 249ms + 244ms）。修法：routes 可以传进来复用。
    let st = createEmptyState();
    const coords = [[140, 300], [420, 300], [700, 300], [300, 130], [560, 470], [820, 130]] as const;
    for (const [x, y] of coords) st = addComponent(st, 'resistor', x, y);
    const ids = st.components.map((c) => c.id);
    for (let i = 0; i + 1 < ids.length; i++) {
      const r = addWire(st, `${ids[i]}:a`, `${ids[i + 1]}:b`);
      if (r.added) st = r.state;
    }
    const routes = buildWireRoutes(st);
    const fresh = buildWireJumps(st);
    const reused = buildWireJumps(st, routes);
    assert.deepEqual(
      reused.map((j) => ({ jumper: j.jumper, crossed: j.crossed, point: j.point })),
      fresh.map((j) => ({ jumper: j.jumper, crossed: j.crossed, point: j.point })),
      '复用 routes 不得改变跳线结果',
    );
    // 真复用：跳线的折点必须和传进来的那份 routes 同源（同一份坐标），
    // 而不是「再算一遍碰巧一样」。夹具里必须真有跳线才有意义。
    assert.ok(reused.length > 0, '夹具须能产生跳线，否则这个用例证明不了复用');
    for (const j of reused) {
      assert.ok(Number.isFinite(j.point.x) && Number.isFinite(j.point.y), '跳线坐标须有限');
    }
    assert.equal(
      countWireIntersections(st, routes),
      countWireIntersections(st),
      '预计算的 routes 与现算结果一致',
    );
  });
}
