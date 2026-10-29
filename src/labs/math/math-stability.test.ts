/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学数值稳定性测试（注册模块）。
 *
 * **本文件是「注册模块」，不是可独立运行的测试入口**：它只导出
 * `registerMathStabilityTests(test)`，由同目录的 `math-stability.entry.test.ts`
 * 在顶层调用完成登记，并由该入口自己的 `runAll()` 执行与汇总。直接
 * `npx tsx src/labs/math/math-stability.test.ts` 只会求值模块，不注册、不执行、
 * 不打印 Results——因此 `npm test` 里登记的是 `math-stability.entry.test.ts`。
 *
 * 收录范围：只放**纯计算**用例——不读源码文件、不导入 React 组件模块、不依赖
 * 引擎初始化 / 全局 setup / 模块级共享状态。原 `数学模块数值稳定性与题库守卫`
 * 套件中其余用例依赖 `readFileSync` 源码扫描（`read('src/...')`，依赖当前工作
 * 目录）或 React 组件模块（`InteractiveCircle.tsx` / `CoordPlane.tsx` 及其
 * `app-context`），按约束保留在 smoke.test.ts 原位；拆分依据见
 * docs/testing/math-stability-extraction-batch-3.md 第 2-3 节。
 *
 * 用例名、断言、期望值与迁移前 smoke.test.ts 逐字一致；套件名由入口提供，
 * 与迁移前同名（拆分后 smoke 与新入口各持有该套件的不同用例）。
 */
import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';

import * as QC from './quadratic-core';

type TestFn = (name: string, fn: () => unknown) => void;

export function registerMathStabilityTests(test: TestFn): void {
  /* ── 判别式与实根（纯计算：仅依赖 quadratic-core）── */

  test('判别式与实根：Δ<0 返回空数组（绝不 Math.sqrt 负数产出 NaN）', () => {
    assert.strictEqual(QC.discriminant(1, 0, 1), -4);
    assert.deepStrictEqual(QC.quadraticRoots(1, 0, 1), [], 'Δ<0 必须无实根且不产生 NaN');
    assert.deepStrictEqual(QC.quadraticRoots(1, 0, 0), [0], 'Δ=0 重根');
    const r = QC.quadraticRoots(1, -3, 2); // x²−3x+2 → 1, 2
    assert.ok(Math.abs(r[0] - 1) < 1e-12 && Math.abs(r[1] - 2) < 1e-12);
    assert.ok(r[0] <= r[1], '根须升序');
    // 全域扫描：任何系数下返回值都必须是有限数（杜绝 NaN / Infinity 进入坐标渲染）
    for (const a of [-3, -1, -0.5, 0, 0.5, 1, 3]) {
      for (const b of [-5, -1, 0, 1, 5]) {
        for (const c of [-5, -1, 0, 1, 5]) {
          for (const root of QC.quadraticRoots(a, b, c)) {
            assert.ok(Number.isFinite(root), `系数 a=${a} b=${b} c=${c} 产生非有限根 ${root}`);
          }
        }
      }
    }
    // a=0 退化：一次方程
    assert.deepStrictEqual(QC.quadraticRoots(0, 2, -4), [2]);
    assert.deepStrictEqual(QC.quadraticRoots(0, 0, 5), [], 'a=b=0 无解');
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
    'math-stability.test.ts 是注册模块，不是测试入口：它只导出 registerMathStabilityTests()。\n' +
      '请运行 `npx tsx src/labs/math/math-stability.entry.test.ts`（或 `npm test`）。',
  );
  process.exit(1);
}
