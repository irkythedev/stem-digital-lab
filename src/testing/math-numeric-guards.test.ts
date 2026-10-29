/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学模块数值稳定性守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe 残留部分，**整组 3 个用例一次迁出**。
 * 用例名、断言、正则、错误消息与执行顺序与迁移前逐字相同；1 处 `readFileSync('src/…')`
 * 改走 `readSrc()` → `repoPath()`。
 *
 * 依赖特征：零 DOM、零 async、零全局改造；只调数学/绘图的纯函数与常量的数值断言。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { repoPath } from './repo-paths';
import * as CP2 from '../components/lab/CoordPlane';
import * as IC from '../components/lab/InteractiveCircle';
import * as QC from '../labs/math/quadratic-core';

export function registerMathNumericGuardTests(test: TestFn): void {
  /** 读仓库内源码：参数保持仓库相对路径，错误消息里的文件标识也不变。 */
  const readSrc = (p: string, enc: BufferEncoding = 'utf8') => readFileSync(repoPath(p), enc);
  const read = (path: string) => readSrc(path, 'utf8');
  const CORE = './labs/math/quadratic-core';

  test('二次采样：末点精确落在 +4，点距恒等（无浮点累加漂移）', () => {
    const pts = QC.sampleQuadratic(1, 0, 0);
    const n = Math.round((QC.SAMPLE_MAX - QC.SAMPLE_MIN) / QC.SAMPLE_STEP);
    assert.strictEqual(pts.length, n + 1, `采样点数应为 ${n + 1}`);
    assert.strictEqual(pts[0][0], -4, '首点应为 -4');
    assert.strictEqual(pts[pts.length - 1][0], 4, '末点必须精确为 +4（旧实现漂移为 3.9999999999999396）');
    // 点距恒为 0.05（索引乘法下仅剩 ulp 级差异；浮点累加会漂移到 0.05000000000000071 等并逐段累积）
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i][0] - pts[i - 1][0];
      assert.ok(Math.abs(d - 0.05) < 1e-12, `第 ${i} 段点距 ${d} 偏离 0.05`);
    }
    // 采样点与索引乘法公式逐点一致
    pts.forEach(([x, y], k) => {
      assert.strictEqual(x, -4 + k * 0.05, '第 k 点 x 应为 -4 + k·0.05');
      assert.ok(Math.abs(y - (x * x)) < 1e-12, 'y 应为 x²');
    });
    // 旧模式必须已被移除
    const coreSrc = read('src/labs/math/quadratic-core.ts');
    const facadeSrc = read('src/labs/physics/stem-engine.ts');
    assert.doesNotMatch(coreSrc, /x \+= 0\.05/, 'quadratic-core 仍在浮点累加');
    assert.doesNotMatch(facadeSrc, /x \+= 0\.05/, '门面 stem-engine 仍在浮点累加（真正运行的是它）');
    // 反比例与一次函数两支同样不得累加
    assert.doesNotMatch(read('src/labs/math/Inverse.tsx'), /x \+= 0\.05/, 'Inverse 仍在浮点累加');
    assert.doesNotMatch(read('src/labs/math/Linear.tsx'), /x \+= 0\.05/, 'Linear 仍在浮点累加');
  });

  // 「判别式与实根」已拆为独立入口（纯计算，仅依赖 quadratic-core）：
  // src/labs/math/math-stability.entry.test.ts。不要在此重新注册。
  // 本套件其余用例依赖源码扫描或 React 组件模块，保留原位。

  test('圆几何退化：动点重合 / 零长向量不得产出 NaN 夹角', () => {
    // 签名：(ax,ay,bx,by,cx,cy)，顶点在 b
    assert.strictEqual(IC.angleBetween(0, 0, 0, 0, 0, 0), 0, '零长向量夹角须为 0 而非 NaN');
    assert.strictEqual(IC.angleBetween(1, 1, 1, 1, 2, 2), 0, '单侧零长向量同样不得 NaN');
    assert.ok(Number.isFinite(IC.angleBetween(1, 0, 0, 0, 0, 1)), '直角顶点须有限');
    // 全域退化扫描：任何重合组合都必须有限且在 [0, π]
    const pts = [[0, 0], [1, 0], [0, 1], [-1, -1], [2, 2]];
    for (const [ax, ay] of pts) for (const [bx, by] of pts) for (const [cx, cy] of pts) {
      const ang = IC.angleBetween(ax, ay, bx, by, cx, cy);
      assert.ok(Number.isFinite(ang), `退化组合 (${ax},${ay})(${bx},${by})(${cx},${cy}) 产生 NaN 夹角`);
      assert.ok(ang >= 0 && ang <= Math.PI + 1e-12, '夹角越界');
    }
    // 直径所对圆周角 = 90°（Thales）：C 在单位圆上，AB 为直径
    for (const t of [0.3, 1.1, 2.4, 3.9, 5.5]) {
      const cx = Math.cos(t), cy = Math.sin(t);
      const ang = IC.angleBetween(-1, 0, cx, cy, 1, 0);
      assert.ok(Math.abs(ang - Math.PI / 2) < 1e-9, `C=(${cx.toFixed(3)},${cy.toFixed(3)}) 处圆周角应为 90°`);
    }
    // 垂径：圆心到弦的垂足与两端等距（AE = EB），弦退化到直径/零弦时仍成立
    for (const half of [0, 0.5, 1, 12]) {
      assert.ok(Math.abs(IC.dist(-half, 0, 0, 0) - IC.dist(0, 0, half, 0)) < 1e-12, `半弦 ${half} 时 AE ≠ EB`);
    }
    // 平行线不得返回交点（|d| < 1e-10 → null）
    assert.strictEqual(IC.lineIntersect(0, 0, 1, 0, 0, 1, 1, 1), null, '平行线须无交点');
    const ix = IC.lineIntersect(0, 0, 2, 2, 0, 2, 2, 0);
    assert.ok(ix !== null && Number.isFinite(ix.x) && Number.isFinite(ix.y), '非平行必须有有限交点');
  });

  // 「题库注册表：值与文案键成对、正解在值域内、渲染顺序与注册表一致」已拆为独立入口
  // （源码守卫，路径基准改为从模块位置推导）：
  // src/labs/math/math-question-bank-guards.entry.test.ts。不要在此重新注册。
  // 本套件其余用例依赖源码扫描或 React 组件模块，保留原位。

  // 「数学模块零 ✓/✗ 判分字形」已拆为独立入口（源码守卫，路径基准改为从模块位置推导）：
  // src/labs/math/math-source-guards.entry.test.ts。不要在此重新注册。
  // 本套件其余用例依赖源码扫描或 React 组件模块，保留原位。

  test('坐标渲染：负号使用学术减号 U+2212，且只用设计令牌', () => {
    const cp = read('src/components/lab/CoordPlane.tsx');
    assert.match(cp, /export const mathMinus/, '缺 mathMinus 工具');
    assert.strictEqual(CP2.mathMinus(-3), '\u22123', '负数须渲染为 U+2212');
    assert.strictEqual(CP2.mathMinus('(-2, 3)'), '(\u22122, 3)', '坐标文本须整体替换');
    assert.strictEqual(CP2.mathMinus(4), '4', '正数不受影响');
    // 刻度与标注都过格式化
    assert.match(cp, /\{mathMinus\(v\)\}/, '刻度未过 mathMinus');
    assert.match(cp, /\{mathMinus\(m\.dot\.label\)\}/, '点标注未过 mathMinus');

    /* ---- 网格双层化 / 光晕 / 贴轴：行为级契约（2026-10 坐标系审计）---- */
    // 细网格：目标 8~10 格（旧版按「7 条刻度」反推，Quadratic 只剩 4×3 格，像渔网）
    assert.equal(CP2.fineStep(8), 1, 'x 范围 8 的细网格步长须为 1（旧版 2 → 只有 4 格）');
    assert.equal(CP2.fineStep(41), 5, 'y 范围 41 的细网格步长须为 5（旧版 10 → 只有 3 格）');
    for (const [range, want] of [[8, 8], [41, 8], [68, 6], [2.4, 9.6]] as const) {
      const cells = range / CP2.fineStep(range);
      assert.ok(cells >= want * 0.95, `range=${range} 细网格仅 ${cells.toFixed(1)} 格，低于 ${want}`);
    }
    // 主网格（带数字）必须是细网格整数倍，且标签条数收口到 ≤6（否则数字互相压）
    for (const range of [8, 41, 68, 2.4, 40]) {
      const fine = CP2.fineStep(range);
      const major = CP2.majorStepFor(range, fine);
      assert.ok(Math.abs(major / fine - Math.round(major / fine)) < 1e-9, `range=${range} 主网格不是细网格整数倍`);
      assert.ok(range / major <= 6.5, `range=${range} 主网格 ${(range / major).toFixed(1)} 格，标签会挤`);
    }
    // 光晕必须走令牌，不得写死色值（深色主题下会露出白边）
    assert.equal(CP2.TEXT_HALO.stroke, 'var(--card-bg)', '光晕描边须用 --card-bg 令牌');
    assert.equal(CP2.TEXT_HALO.paintOrder, 'stroke', '光晕须把描边画在填充之前');
    const haloUses = (cp.match(/\{\.\.\.TEXT_HALO\}/g) ?? []).length;
    assert.ok(haloUses >= 6, `刻度/原点/标注/轴名/图例都要挂光晕（实测 ${haloUses} 处）`);
    // 刻度贴轴：不得再钉在画布底边（旧版 H-PAD.bottom+15 与 y=0 相差 290px）
    assert.doesNotMatch(cp, /y=\{H - PAD\.bottom \+ 15\}/, 'x 刻度不得再钉在画布底边');
    assert.match(cp, /const xTickY = clamp\(zeroY \+ 15/, 'x 刻度须贴在 x 轴下方');
    assert.match(cp, /const yTickX = Math\.max\(zeroX - 6/, 'y 刻度须贴在 y 轴左侧');
    // 图例：不得再用字符破折号冒充线型；底板宽度必须动态
    assert.ok(!cp.includes("'— '") && !cp.includes("'- - '"), '图例不得再用 — / - - 字符冒充线型');
    assert.match(cp, /<line\s+x1=\{legendX \+ 6\}/, '图例须用真实 <line> 画线型');
    assert.match(cp, /Math\.max\(\s*120,\s*\.\.\.curves\.map/, '图例底板宽度须按最长标签动态撑开（旧版写死 125px，长系数溢出 40px）');
    // 越界防护：特征点在绘图区外时整条不画（旧版会把半截虚线画到画布外）
    assert.match(cp, /const inPlotX = \(px: number\)/, '须有越界判定');
    // 点标注落位：Quadratic 必须按开口方向传 place（否则文字被抛物线横穿）
    const qd = read('src/labs/math/Quadratic.tsx');
    assert.match(qd, /place: a < 0 \? 'above' : 'below'/, '顶点/交点标注须按开口方向避让');
    // 反比例：与坐标轴重合的渐近线不得再叠虚线
    const inv = read('src/labs/math/Inverse.tsx');
    assert.match(inv, /noLine: true/, '与坐标轴重合的渐近线须 noLine（否则轴线被虚线打断）');

    for (const f of ['src/components/lab/CoordPlane.tsx', 'src/labs/math/Circle.tsx', 'src/labs/math/Inverse.tsx',
      'src/labs/math/Linear.tsx', 'src/labs/math/Quadratic.tsx']) {
      assert.doesNotMatch(read(f), /#[0-9a-fA-F]{3,6}\b/, `${f} 出现硬编码色值`);
    }
  });
}
