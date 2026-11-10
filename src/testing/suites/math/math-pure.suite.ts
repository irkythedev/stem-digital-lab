/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学纯函数单元测试（注册模块）。
 *
 * **本文件是「注册模块」，不是可独立运行的测试入口**：它只导出
 * `registerMathPureTests(test)`，由同目录的 `math-pure.test.ts` 在顶层调用
 * 完成登记，并由该入口自己的 `runAll()` 执行与汇总。直接
 * `npx tsx src/testing/suites/math/math-pure.suite.ts` 只会求值模块，不注册、不执行、不打印
 * Results——因此 `npm test` 里登记的是 `math-pure.test.ts`，不是本文件。
 *
 * 收录范围：只放**不依赖引擎初始化、DOM、localStorage、全局 setup 或模块级共享
 * 状态**的纯计算用例。依赖 `loadOhmEngine` 的 stem-engine 门面对拍、依赖 React
 * 组件模块与源码扫描的题库守卫，仍留在 smoke.test.ts 原位（原因见
 * 内部分批迁移记录第 2 节）。
 *
 * 用例名、断言、期望值与迁移前 smoke.test.ts 逐字一致；套件名由入口提供。
 */
import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';

import { quadraticY, sampleQuadratic, symPair } from '../../../labs/math/quadratic-core';
import { inverseRectArea, inverseTriangleArea } from '../../../labs/math/inverse-core';
import { slopeTriangle } from '../../../labs/math/linear-core';
import { easeInOutQuad, easeOutCubic, linear, stepEndElapsed, timelineAt, type DemoStep } from '../../../components/lab/use-auto-timeline';
import { POSE_STEPS, REF_POSE, SSA_STEPS } from '../../../labs/math/congruence-demo';
import { SIMILARITY_DEMO } from '../../../labs/math/similarity-demo';
import { POLYGON_DEMO, POLYGON_DEMO_NS } from '../../../labs/math/polygon-pi-demo';
import { piBounds, inVertices, outVertices } from '../../../labs/math/polygon-pi-core';
import { homothetic, type Tri } from '../../../labs/math/similarity-core';
import { referenceFor, buildByCondition, measure } from '../../../labs/math/congruence-core';
import { HOME_POSE } from '../../../labs/math/congruence-demo';
import { TASKS, buildScene, isSolved, type Cons } from '../../../labs/math/construction-core';
import { CONSTRUCTION_DEMO } from '../../../labs/math/construction-demo';
import { constructionViewForTask } from '../../../labs/math/construction-view';
import { boolParam, buildLabSearch, enumParam, numParam } from '../../../lib/lab-url-state';

type TestFn = (name: string, fn: () => unknown) => void;

function assertSafeBox(
  pts: { x: number; y: number }[],
  w: number,
  h: number,
  pad = 24,
): void {
  for (const p of pts) {
    assert.ok(p.x >= pad && p.x <= w - pad, `x=${p.x.toFixed(2)} 超出 [${pad},${w - pad}]`);
    assert.ok(p.y >= pad && p.y <= h - pad, `y=${p.y.toFixed(2)} 超出 [${pad},${h - pad}]`);
  }
}

export function registerMathPureTests(test: TestFn): void {
  /* ── 二次函数采样 ── */

  test('quadraticY evaluates y = ax² + bx + c at x = 0 and x = 1', () => {
    assert.equal(quadraticY(-2, 0, 3, 0), 3);
    assert.equal(quadraticY(-2, 0, 3, 1), 1);
  });

  test('sampleQuadratic(1, 0, 0) spans x ∈ [-4, 4] with step 0.05', () => {
    const pts = sampleQuadratic(1, 0, 0);
    assert.ok(pts.length >= 160 && pts.length <= 162, `points = ${pts.length}`);
    assert.ok(Math.abs(pts[0][0] - -4) < 1e-9, `first x = ${pts[0][0]}`);
    const last = pts[pts.length - 1][0];
    assert.ok(Math.abs(last - 4) < 0.001, `last x = ${last}`);
    // 对称性：y = x² 在 x = ±2 处等值
    const at2 = pts.find((p) => Math.abs(p[0] - 2) < 1e-9);
    const atMinus2 = pts.find((p) => Math.abs(p[0] - -2) < 1e-9);
    assert.ok(at2 && atMinus2 && Math.abs(at2[1] - atMinus2[1]) < 1e-9);
  });

  test('sampleQuadratic(-2, 0, 3) has y ≈ 3 at x ≈ 0', () => {
    const pts = sampleQuadratic(-2, 0, 3);
    const near0 = pts.find((p) => Math.abs(p[0]) < 0.0001);
    assert.ok(near0, 'point at x ≈ 0 exists');
    assert.ok(Math.abs(near0[1] - 3) < 1e-9, `y at x≈0 = ${near0[1]}`);
  });

  test('slopeTriangle: Δx = 1, Δy = k, endpoint stays on the line', () => {
    const t = slopeTriangle(2, -3);
    assert.deepStrictEqual(t, { x0: 0, y0: -3, x1: 1, y1: -1, dx: 1, dy: 2 });
    assert.strictEqual(t.y1, 2 * t.x1 - 3, '阶梯终点必须落在 y = 2x − 3 上');
    const flat = slopeTriangle(0, 4);
    assert.strictEqual(flat.y1, 4, 'k = 0 时阶梯终点与起点同高');
    assert.strictEqual(flat.dy, 0);
  });

  test('symPair: same height, axis is the midpoint of the pair', () => {
    const s = symPair(-2, 0, 3, 1.5);
    assert.ok(s, 'a ≠ 0 时应有对称点');
    assert.ok(Math.abs(s!.y - -1.5) < 1e-9, 'P 与 P′ 必须同高');
    assert.ok(Math.abs((s!.x1 + s!.x2) / 2 - s!.axisX) < 1e-9, '对称轴必须垂直平分 PP′');
    assert.ok(Math.abs(s!.x1 - 1.5) < 1e-9 && Math.abs(s!.x2 - -1.5) < 1e-9);
    assert.strictEqual(symPair(0, 1, 2, 1), null, 'a = 0 不是抛物线，不得产出对称点');
  });

  test('timelineAt: animate / dwell / done phases and legacy duration fallback', () => {
    const steps: DemoStep<number>[] = [
      { id: 'a', animationDuration: 100, dwellDuration: 50, data: 1, caption: { zh: '', en: '' } },
      { id: 'b', animationDuration: 200, dwellDuration: 0, data: 2, caption: { zh: '', en: '' } },
    ];
    assert.deepStrictEqual(timelineAt([], 0), { index: 0, progress: 0, phase: 'done', done: true });
    assert.deepStrictEqual(timelineAt(steps, 0), { index: 0, progress: 0, phase: 'animate', done: false });
    assert.deepStrictEqual(timelineAt(steps, 50), { index: 0, progress: 0.5, phase: 'animate', done: false });
    assert.deepStrictEqual(timelineAt(steps, 100), { index: 0, progress: 1, phase: 'dwell', done: false });
    assert.deepStrictEqual(timelineAt(steps, 149), { index: 0, progress: 1, phase: 'dwell', done: false });
    assert.deepStrictEqual(timelineAt(steps, 150), { index: 1, progress: 0, phase: 'animate', done: false });
    assert.deepStrictEqual(timelineAt(steps, 250), { index: 1, progress: 0.5, phase: 'animate', done: false });
    assert.deepStrictEqual(timelineAt(steps, 350), { index: 1, progress: 1, phase: 'done', done: true });
    assert.deepStrictEqual(timelineAt(steps, 9999), { index: 1, progress: 1, phase: 'done', done: true });

    const legacy: DemoStep<number>[] = [{ id: 'legacy', duration: 100, data: 1, caption: { zh: '', en: '' } }];
    assert.deepStrictEqual(timelineAt(legacy, 50), { index: 0, progress: 0.5, phase: 'animate', done: false });
    assert.deepStrictEqual(timelineAt(legacy, 100), { index: 0, progress: 1, phase: 'done', done: true });
  });

  test('stepEndElapsed: animation + dwell accumulate; boundaries include dwell', () => {
    const steps: DemoStep<number>[] = [
      { id: 'a', animationDuration: 100, dwellDuration: 50, data: 1, caption: { zh: '', en: '' } },
      { id: 'b', animationDuration: 200, dwellDuration: 70, data: 2, caption: { zh: '', en: '' } },
      { id: 'c', duration: 80, data: 3, caption: { zh: '', en: '' } },
    ];
    assert.strictEqual(stepEndElapsed(steps, 0), 150);
    assert.strictEqual(stepEndElapsed(steps, 1), 420);
    assert.strictEqual(stepEndElapsed(steps, 2), 500);
    assert.strictEqual(stepEndElapsed(steps, 99), 500);
    assert.strictEqual(stepEndElapsed([], 0), 0);
  });

  test('easings: endpoints, midpoint and monotonicity', () => {
    for (const ease of [linear, easeInOutQuad, easeOutCubic]) {
      assert.strictEqual(ease(0), 0);
      assert.strictEqual(ease(1), 1);
      let prev = -1;
      for (let i = 0; i <= 20; i++) {
        const v = ease(i / 20);
        assert.ok(v >= prev - 1e-12, 'easing must be monotone');
        prev = v;
      }
    }
    assert.strictEqual(easeInOutQuad(0.5), 0.5);
  });

  test('congruence demo: final pose is REF_POSE and SSA includes locus + second branch', () => {
    const last = POSE_STEPS[POSE_STEPS.length - 1];
    assert.deepStrictEqual(last.data.to, REF_POSE);
    assert.strictEqual(last.data.overlayed, true);
    for (let i = 1; i < POSE_STEPS.length; i++) {
      assert.deepStrictEqual(POSE_STEPS[i].data.from, POSE_STEPS[i - 1].data.to, `pose step ${i} 必须从上一步终点开始`);
    }
    assert.ok(SSA_STEPS.some((s) => s.data.locus), 'SSA demo must show the locus arc');
    assert.strictEqual(SSA_STEPS[SSA_STEPS.length - 1].data.branch, 1);
  });

  test('similarity demo: continuous keyframes from 1 through 2, -1.5 and back to 1', () => {
    assert.strictEqual(SIMILARITY_DEMO[0].data.from, 1);
    assert.strictEqual(SIMILARITY_DEMO[SIMILARITY_DEMO.length - 1].data.to, 1);
    for (let i = 1; i < SIMILARITY_DEMO.length; i++) {
      assert.strictEqual(SIMILARITY_DEMO[i].data.from, SIMILARITY_DEMO[i - 1].data.to, `step ${i} must start where step ${i - 1} ended`);
    }
    const values = SIMILARITY_DEMO.flatMap((s) => [s.data.from, s.data.to]);
    assert.ok(values.includes(2) && values.includes(-1.5) && values.includes(0));
  });

  test('polygon demo: doubling sequence and monotonically shrinking squeeze width', () => {
    const ns = POLYGON_DEMO.map((s) => s.data.n);
    assert.deepStrictEqual(ns, [...POLYGON_DEMO_NS]);
    let prev = Infinity;
    for (const n of ns) {
      const width = piBounds(n).width;
      assert.ok(width < prev, `n=${n} squeeze width must shrink`);
      prev = width;
    }
  });

  test('bounds: Similarity demo image stays inside 580×360 with 24px margin', () => {
    const O = { x: 0, y: 0 };
    const tri: Tri = { A: { x: -1.5, y: 0.3 }, B: { x: 1.4, y: 0.8 }, C: { x: 1.1, y: -0.8 } };
    for (const step of SIMILARITY_DEMO) {
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const k = step.data.from + (step.data.to - step.data.from) * (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        const img = homothetic(O, tri, k);
        const pts = [O, ...Object.values(tri), ...Object.values(img)].map((p) => ({ x: 290 + p.x * 88, y: 180 - p.y * 88 }));
        assertSafeBox(pts, 580, 360);
      }
    }
  });

  test('bounds: PolygonPi inner vertices stay inside 600×380; outer allowed to clip below n=12', () => {
    for (const n of POLYGON_DEMO_NS) {
      const inner = inVertices(n, 1).map((p) => ({ x: 300 + p.x * 150, y: 190 - p.y * 150 }));
      assertSafeBox(inner, 600, 380);
      if (n >= 12) {
        const outer = outVertices(n, 1).map((p) => ({ x: 300 + p.x * 150, y: 190 - p.y * 150 }));
        assertSafeBox(outer, 600, 380);
      }
    }
  });

  test('bounds: Congruence pose and SSA locus stay inside 580×360 with 24px margin', () => {
    const ref = referenceFor('ssa');
    const cand = buildByCondition('ssa', ref, 1);
    assert.ok(cand, 'SSA 第二解必须存在');
    const a = measure(ref).a;
    const toS = (p: { x: number; y: number }, pose: { tx: number; ty: number; rot: number }) => {
      const qx = p.x * 28;
      const qy = -p.y * 28;
      const c = Math.cos(pose.rot);
      const s = Math.sin(pose.rot);
      return { x: pose.tx + qx * c - qy * s, y: pose.ty + qx * s + qy * c };
    };
    for (const pose of [HOME_POSE, REF_POSE]) {
      const pts = [...Object.values(ref), ...Object.values(cand!)].map((p) => toS(p, pose));
      assertSafeBox(pts, 580, 360);
      const c = toS(ref.C, pose);
      assertSafeBox([
        { x: c.x - a * 28, y: c.y - a * 28 },
        { x: c.x + a * 28, y: c.y + a * 28 },
      ], 580, 360);
    }
  });

  test('Construction four demo solutions actually reach the goal (solved === true)', () => {
    for (const task of TASKS) {
      const steps = CONSTRUCTION_DEMO[task.id] ?? [];
      const cons: Cons[] = steps.map((step) => step.data.cons);
      const scene = buildScene(task.givens, cons);
      assert.equal(isSolved(task, scene), true, `${task.id}: 标准尺规解必须满足目标判定`);
    }
  });

  test('bounds: Construction four demo solutions keep known/intersection points inside 600×380 after fit', () => {
    for (const task of TASKS) {
      const view = constructionViewForTask(task);
      assert.ok(view.s > 24, `${task.id}: 取景比例应大于旧固定 S=24（实际 ${view.s}）`);
      const steps = CONSTRUCTION_DEMO[task.id] ?? [];
      const cons: Cons[] = [];
      for (const step of steps) {
        const scene = buildScene(task.givens, [...cons, step.data.cons]);
        const pts = scene.points.map((p) => ({ x: view.cx + p.x * view.s, y: view.cy - p.y * view.s }));
        assertSafeBox(pts, 600, 380);
        // 辅助圆的外弧允许被 <clipPath> 裁切；这里只校验圆心在安全区，
        // 不再要求「整圆包围盒」也留在画布内（那会把 AB 重新压回约 100px）。
        for (const cir of scene.circles) {
          const c = scene.points.find((p) => p.id === cir.c);
          assert.ok(c, `${task.id}: 圆 ${cir.id} 的圆心不存在`);
          assertSafeBox([{ x: view.cx + c!.x * view.s, y: view.cy - c!.y * view.s }], 600, 380);
        }
        cons.push(step.data.cons);
      }
    }
  });

  test('lab URL: numParam clamps, rejects NaN/zero and aligns step', () => {
    assert.equal(numParam(null, 2, -5, 5), 2);
    assert.equal(numParam('abc', 2, -5, 5), 2);
    assert.equal(numParam('99', 2, -5, 5), 5);
    assert.equal(numParam('-99', 2, -5, 5), -5);
    assert.equal(numParam('0', 2, -5, 5, { disallowZero: true }), 2);
    assert.ok(Math.abs(numParam('1.24', 2, 0, 5, { step: 0.1 }) - 1.2) < 1e-9);
  });

  test('lab URL: enum/bool guards and default-value elision', () => {
    assert.equal(enumParam('ssa', ['sss', 'ssa'] as const, 'sss'), 'ssa');
    assert.equal(enumParam('bad', ['sss', 'ssa'] as const, 'sss'), 'sss');
    assert.equal(boolParam('1', false), true);
    assert.equal(boolParam('0', true), false);
    assert.equal(boolParam('bad', true), true);
    assert.equal(
      buildLabSearch({ stage: 'predict', k: 2, b: -3, guides: true }, { stage: 'predict', k: 2, b: -3, guides: true }),
      '',
    );
    assert.equal(buildLabSearch({ stage: 'explore', k: 3, guides: false }, { stage: 'predict', k: 2, guides: true }), 'stage=explore&k=3&guides=0');
  });

  test('inverse areas: rectangle = |k|, triangle = |k|/2, invariant in x', () => {
    for (const x of [0.2, 0.5, 1, 2, 4]) {
      assert.strictEqual(inverseRectArea(4, x), 4, `k=4, x=${x} 矩形面积应为 4`);
      assert.strictEqual(inverseRectArea(-4, x), 4, `k=-4, x=${x} 矩形面积应为 4`);
      assert.strictEqual(inverseTriangleArea(4, x), 2, `k=4, x=${x} 三角形面积应为 2`);
      assert.strictEqual(inverseTriangleArea(-4, x), 2, `k=-4, x=${x} 三角形面积应为 2`);
    }
    assert.ok(Number.isNaN(inverseRectArea(4, 0)), 'x=0 是定义域外，不得返回有限面积');
    assert.ok(Number.isNaN(inverseTriangleArea(4, 0)), 'x=0 是定义域外，不得返回有限面积');
  });
}

/* ── 入口契约守卫 ── */

/**
 * 本文件只登记用例，不执行。被直接 `tsx` 调用时没有任何人消费这些登记，
 * 进程会以退出码 0 静默结束——看起来「通过」，实际零用例。这里把这种情况
 * 变成显式失败，避免假绿。
 */
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  console.error(
    'math-pure.test.ts 是注册模块，不是测试入口：它只导出 registerMathPureTests()。\n' +
      '请运行 `npx tsx src/testing/suites/math/math-pure.test.ts`（或 `npm test`）。',
  );
  process.exit(1);
}
