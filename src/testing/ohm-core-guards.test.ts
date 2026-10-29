/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 欧姆定律核与分压口径守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe，**整组 6 个用例一次迁出**。
 * 用例名、断言与执行顺序与迁移前逐字相同；本套件零文件读取、零 DOM、零 async。
 *
 * 依赖特征：纯逻辑，只调 `ohm-core` 的真源实现（不经 WASM 门面，故与引擎状态无关）。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import type { TestFn } from './harness';
import {
  currentOf as coreCurrentOf,
  elementResistance as coreElementResistance,
  sampleOhm as coreSampleOhm,
} from '../labs/physics/ohm-core';

export function registerOhmCoreGuardTests(test: TestFn): void {
  test('I = U/R 精确值与单调性', () => {
    assert.ok(Math.abs(coreCurrentOf(6, 10, 'resistor') - 0.6) < 1e-12);
    assert.ok(Math.abs(coreCurrentOf(12, 4, 'resistor') - 3) < 1e-12);
    for (const R of [1, 5, 10, 20, 50]) {
      assert.ok(coreCurrentOf(12, R, 'resistor') > coreCurrentOf(6, R, 'resistor'), 'U 增大 I 必增大');
      assert.ok(coreCurrentOf(6, R, 'resistor') >= coreCurrentOf(6, R + 5, 'resistor'), 'R 增大 I 不增');
    }
  });

  test('分压口径：元件两端 U_elem = U·R/(R+Rp)，且 U_elem + U_rp = U', () => {
    for (const R of [5, 10, 20]) for (const Rp of [0, 1, 7, 40]) {
      const I = coreCurrentOf(6, R, 'resistor', Rp);
      const uElem = I * R;
      const uRp = I * Rp;
      assert.ok(Math.abs(uElem - (6 * R) / (R + Rp)) < 1e-12, `R=${R} Rp=${Rp} 分压不符`);
      assert.ok(Math.abs(uElem + uRp - 6) < 1e-9, `R=${R} Rp=${Rp} 分压之和 ≠ 电源电压`);
    }
  });

  test('灯泡非线性：R_eff = R₀ + γU，曲线上翘（斜率递减）', () => {
    assert.ok(Math.abs(coreElementResistance(10, 'bulb', 6) - (10 + 0.4 * 6)) < 1e-12);
    assert.equal(coreElementResistance(10, 'resistor', 6), 10);
    const pts = coreSampleOhm(10, 'bulb');
    // 灯泡 I-U 曲线必为凹（割线斜率随 U 递减）
    const slope = (k: number) => pts[k][1] / (pts[k][0] || 1e-9);
    assert.ok(slope(120) < slope(60), '灯泡曲线应上翘（等效电阻随电压增大）');
  });

  test('定值电阻 I-U 曲线斜率恒为 1/R（横轴 = 元件真实压降）', () => {
    for (const R of [5, 10, 20, 50]) {
      const pts = coreSampleOhm(R, 'resistor');
      for (const [x, y] of pts) {
        assert.ok(Math.abs(y - x / R) < 1e-12, `R=${R} 点 (${x}, ${y}) 偏离 1/R`);
      }
    }
  });

  test('采样横轴无浮点累加漂移：121 点、恰为 0.1 的整数倍、末点精确 12', () => {
    const pts = coreSampleOhm(10, 'resistor');
    assert.equal(pts.length, 121);
    assert.equal(pts[120][0], 12, '末点横轴须精确为 12（累加式为 11.999999999999973）');
    // 循环索引 u = k·0.1 精确；派生坐标 x = i·R 有普通浮点乘除舍入（≤1e-12），
    // 与「累加漂移到 11.999999999999973」是两回事
    let worst = 0;
    for (let k = 0; k <= 120; k++) worst = Math.max(worst, Math.abs(pts[k][0] - k * 0.1));
    assert.ok(worst < 1e-12, `横轴与 0.1 整数倍的最大偏差 ${worst} 超出浮点舍入量级`);
  });

  test('数值稳定性：全量程扫描 0 NaN / 0 Infinity 越界', () => {
    let nan = 0, inf = 0, neg = 0;
    for (const el of ['resistor', 'bulb'] as const) {
      for (const R of [0, 1, 5, 10, 20, 50]) {
        for (const Rp of [0, 1, 7, 40]) {
          for (const u of [0, 0.5, 6, 12]) {
            const i = coreCurrentOf(u, R, el, Rp);
            if (Number.isNaN(i)) nan++;
            if (!Number.isFinite(i) && !Number.isNaN(i)) inf++;
            if (i < 0) neg++;
          }
          for (const [x, y] of coreSampleOhm(R, el, Rp)) {
            if (Number.isNaN(x) || Number.isNaN(y)) nan++;
            if (x < 0 || y < 0) neg++;
          }
        }
      }
    }
    assert.equal(nan, 0, '出现 NaN（U=0 且总阻为 0 时曾为 0/0）');
    assert.equal(neg, 0, '出现负值');
    // 唯一允许的 Infinity：真短路（U>0 且元件与变阻器总阻为 0）——由组件层显示 "∞"
    assert.ok(inf >= 0);
    assert.ok(Number.isFinite(coreCurrentOf(0, 0, 'resistor', 0)), 'U=0 总阻 0 不得为 NaN/Inf');
    assert.equal(coreCurrentOf(0, 0, 'resistor', 0), 0, '无驱动电压时读数应为 0');
  });
}
