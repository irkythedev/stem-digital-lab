/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学纯函数单元测试（注册模块）。
 *
 * **本文件是「注册模块」，不是可独立运行的测试入口**：它只导出
 * `registerMathPureTests(test)`，由同目录的 `math-pure.entry.test.ts` 在顶层调用
 * 完成登记，并由该入口自己的 `runAll()` 执行与汇总。直接
 * `npx tsx src/labs/math/math-pure.test.ts` 只会求值模块，不注册、不执行、不打印
 * Results——因此 `npm test` 里登记的是 `math-pure.entry.test.ts`，不是本文件。
 *
 * 收录范围：只放**不依赖引擎初始化、DOM、localStorage、全局 setup 或模块级共享
 * 状态**的纯计算用例。依赖 `loadOhmEngine` 的 stem-engine 门面对拍、依赖 React
 * 组件模块与源码扫描的题库守卫，仍留在 smoke.test.ts 原位（原因见
 * docs/testing/math-pure-tests-extraction-batch-2.md 第 2 节）。
 *
 * 用例名、断言、期望值与迁移前 smoke.test.ts 逐字一致；套件名由入口提供。
 */
import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';

import { quadraticY, sampleQuadratic } from './quadratic-core';

type TestFn = (name: string, fn: () => unknown) => void;

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
      '请运行 `npx tsx src/labs/math/math-pure.entry.test.ts`（或 `npm test`）。',
  );
  process.exit(1);
}
