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
import type { TestFn } from '../../harness';
import { repoPath } from '../../repo-paths';
import * as CP2 from '../../../components/lab/CoordPlane';
import * as IC from '../../../components/lab/InteractiveCircle';
import * as QC from '../../../labs/math/quadratic-core';
import * as CG from '../../../labs/math/congruence-core';
import * as SIM from '../../../labs/math/similarity-core';
import * as PP from '../../../labs/math/polygon-pi-core';
import * as CN from '../../../labs/math/construction-core';
import { CONSTRUCTION_DEMO } from '../../../labs/math/construction-demo';

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
  // src/testing/suites/math/math-stability.test.ts。不要在此重新注册。
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
  // src/testing/suites/math/math-question-bank-guards.test.ts。不要在此重新注册。
  // 本套件其余用例依赖源码扫描或 React 组件模块，保留原位。

  // 「数学模块零 ✓/✗ 判分字形」已拆为独立入口（源码守卫，路径基准改为从模块位置推导）：
  // src/testing/suites/math/math-source-guards.test.ts。不要在此重新注册。
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

  test('四个几何核：SSA 二义性、位似比、割圆夹逼与尺规重放', () => {
    // 全等：SSA 的两支满足同一组条件但不是同一个三角形（判定确实失效）
    const ref = CG.refTriangle();
    const alt = CG.altSsaTriangle();
    assert.ok(alt, 'SSA 模糊情形应存在第二个解');
    const mr = CG.measure(ref);
    const ma = CG.measure(alt!);
    for (const m of [mr, ma]) {
      assert.ok(Math.abs(m.a - CG.REF_SSA.a) < 1e-9, 'SSA 解须满足 a = 4.5');
      assert.ok(Math.abs(m.b - CG.REF_SSA.b) < 1e-9, 'SSA 解须满足 b = 6');
      assert.ok(Math.abs(m.A - CG.REF_SSA.angleA) < 1e-9, 'SSA 解须满足 ∠A = 40°');
    }
    assert.strictEqual(CG.congruentSides(ref, alt!), false, 'SSA 两支三边不同，不得判为全等');
    for (const mode of ['sss', 'sas', 'asa', 'aas', 'hl'] as const) {
      const rebuilt = CG.buildByCondition(mode, CG.referenceFor(mode));
      assert.ok(rebuilt, `${mode} 应由基准三角形重构出解`);
      assert.ok(CG.congruentSides(CG.referenceFor(mode), rebuilt!), `${mode} 重构结果须与基准全等`);
    }

    // 相似：位似比与面积比，负 k 的像落在中心另一侧
    const o = { x: 0, y: 0 };
    const tri = { A: { x: 1, y: 0 }, B: { x: 0, y: 2 }, C: { x: 1, y: 2 } };
    const img = SIM.homothetic(o, tri, -1.5);
    assert.ok(Math.abs(SIM.perimeter(img) / SIM.perimeter(tri) - 1.5) < 1e-12, '周长比应为 |k|');
    assert.ok(Math.abs(SIM.area(img) / SIM.area(tri) - 2.25) < 1e-12, '面积比应为 k²');
    for (const key of ['A', 'B', 'C'] as const) {
      assert.ok(SIM.areCollinear(o, tri[key], img[key]), `${key} 与 O、${key}′ 须共线`);
      assert.ok(Math.sign(img[key].x) === -Math.sign(tri[key].x) || tri[key].x === 0, 'k<0 时像须在中心另一侧');
    }
    assert.ok(SIM.isHomothetic(o, tri, img), '由 homothetic 生成的像必须通过位似自检');

    // 割圆：内接 < π < 外切，边数翻倍时区间单调收紧
    let prevLo = -Infinity;
    let prevHi = Infinity;
    for (const n of PP.N_STEPS) {
      const { lo, hi, width } = PP.piBounds(n, 1);
      assert.ok(lo < PP.PI && PP.PI < hi, `n=${n} 时 ${lo} < π < ${hi} 不成立`);
      assert.ok(lo > prevLo, `n=${n} 内接估计未随边数增大`);
      assert.ok(hi < prevHi, `n=${n} 外切估计未随边数减小`);
      assert.ok(width > 0, `n=${n} 夹逼区间宽度应为正`);
      prevLo = lo;
      prevHi = hi;
    }
    assert.ok(Math.abs(PP.piBounds(96, 1).lo - 3.141031951) < 1e-6, 'n=96 内接 π 估计偏移');
    assert.ok(Math.abs(PP.piBounds(96, 1).hi - 3.1427146) < 1e-6, 'n=96 外切 π 估计偏移');
    assert.strictEqual(PP.nextStep(192), null, '最大边数后不得再翻倍');

    // 尺规：圆规两弧交点连线的重放结果应判定为垂直平分线
    const given = CN.TASK_PERP_BISECTOR.givens;
    const [A, B] = given;
    const scene = CN.buildScene(given, [
      { kind: 'circle', c: A.id, p: B.id },
      { kind: 'circle', c: B.id, p: A.id },
      { kind: 'line', a: 'x1_0', b: 'x1_1' },
    ]);
    assert.ok(scene.points.length >= 4, '两圆应产生两个交点');
    assert.strictEqual(scene.circles.length, 2, '应重放出两个圆');
    assert.strictEqual(scene.lines.length, 1, '应重放出一条直线');
    assert.strictEqual(CN.isSolved(CN.TASK_PERP_BISECTOR, scene), true, '两弧交点连线应判为 AB 的垂直平分线');
    assert.strictEqual(CN.isSolved(CN.TASK_MIDPOINT, scene), false, '该作图尚未作出中点，不得误判过关');
    assert.deepStrictEqual(CN.circleCircle({ x: 0, y: 0 }, 1, { x: 0, y: 0 }, 1), [], '同心圆无交点');
    assert.deepStrictEqual(CN.circleCircle({ x: 0, y: 0 }, 1, { x: 5, y: 0 }, 1), [], '相离圆无交点');
  });

  test('尺规见证与容差：witness 命中、近失拒绝、垂足与预览交点边界', () => {
    const givenPt = (p: CN.GivenPoint): CN.ScenePoint => ({ id: p.id, x: p.x, y: p.y, kind: 'given' });
    const lineScene = (points: CN.ScenePoint[], a: string, b: string): CN.Scene => ({
      points,
      lines: [{ id: 'l', a, b }],
      circles: [],
    });

    // 中垂线：见证线必须过中点，且 0.07 平移 / 0.04 rad 旋转都不能过关
    const t1 = CN.TASK_PERP_BISECTOR;
    const [A, B] = t1.givens;
    const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    const dir = { x: B.x - A.x, y: B.y - A.y };
    const len = Math.hypot(dir.x, dir.y);
    const normal = { x: -dir.y / len, y: dir.x / len };
    const basePts = [
      givenPt(A), givenPt(B),
      { id: 'M', x: mid.x, y: mid.y, kind: 'inter' as const },
      { id: 'N', x: mid.x + normal.x, y: mid.y + normal.y, kind: 'inter' as const },
    ];
    const ok = lineScene(basePts, 'M', 'N');
    assert.strictEqual(CN.isSolved(t1, ok), true, '过中点且垂直的线应过关');
    const w1 = t1.witness(ok);
    assert.ok(w1 && w1.kind === 'line' && w1.point, '中垂线应给出见证线');
    assert.ok(Math.hypot(w1.point!.x - mid.x, w1.point!.y - mid.y) < 1e-9, '见证点应是中点');

    // 平行移动要沿 AB 方向偏 0.07；沿法线移动只会把定义点挪到同一条线上，线并没有平移
    const along = { x: dir.x / len, y: dir.y / len };
    const shiftedPts = [
      givenPt(A), givenPt(B),
      { id: 'M', x: mid.x + along.x * 0.07, y: mid.y + along.y * 0.07, kind: 'inter' as const },
      { id: 'N', x: mid.x + along.x * 0.07 + normal.x, y: mid.y + along.y * 0.07 + normal.y, kind: 'inter' as const },
    ];
    assert.strictEqual(CN.isSolved(t1, lineScene(shiftedPts, 'M', 'N')), false, '平移 0.07 的线不得过关');

    const ang = 0.04;
    const rotated = {
      x: normal.x * Math.cos(ang) - normal.y * Math.sin(ang),
      y: normal.x * Math.sin(ang) + normal.y * Math.cos(ang),
    };
    const rotPts = [
      givenPt(A), givenPt(B),
      { id: 'M', x: mid.x, y: mid.y, kind: 'inter' as const },
      { id: 'N', x: mid.x + rotated.x, y: mid.y + rotated.y, kind: 'inter' as const },
    ];
    assert.strictEqual(CN.isSolved(t1, lineScene(rotPts, 'M', 'N')), false, '旋转 0.04 rad 的线不得过关');

    // 中点：见证点必须在中点
    const t2 = CN.TASK_MIDPOINT;
    const [A2, B2] = t2.givens;
    const m2 = { x: (A2.x + B2.x) / 2, y: (A2.y + B2.y) / 2 };
    const midScene: CN.Scene = {
      points: [givenPt(A2), givenPt(B2), { id: 'M', x: m2.x, y: m2.y, kind: 'inter' as const }],
      lines: [],
      circles: [],
    };
    assert.strictEqual(CN.isSolved(t2, midScene), true);
    assert.strictEqual(t2.witness(midScene)?.kind, 'point');

    // 角平分线：过 O 且沿内角平分线方向的线应过关
    const t3 = CN.TASK_ANGLE_BISECTOR;
    const [O, A3, B3] = t3.givens;
    const u1 = { x: A3.x - O.x, y: A3.y - O.y };
    const l1 = Math.hypot(u1.x, u1.y);
    const u2 = { x: B3.x - O.x, y: B3.y - O.y };
    const l2 = Math.hypot(u2.x, u2.y);
    const bis = { x: u1.x / l1 + u2.x / l2, y: u1.y / l1 + u2.y / l2 };
    const bl = Math.hypot(bis.x, bis.y);
    const angleScene: CN.Scene = {
      points: [
        givenPt(O), givenPt(A3), givenPt(B3),
        { id: 'X', x: O.x + bis.x / bl, y: O.y + bis.y / bl, kind: 'inter' as const },
      ],
      lines: [{ id: 'l', a: 'O', b: 'X' }],
      circles: [],
    };
    assert.strictEqual(CN.isSolved(t3, angleScene), true);

    // 过点作垂线：垂足必须在 AB 上，不能退化成 P
    const t4 = CN.TASK_PERP_THROUGH;
    const [A4, B4, P4] = t4.givens;
    const d4 = { x: B4.x - A4.x, y: B4.y - A4.y };
    const dl = Math.hypot(d4.x, d4.y);
    const n4 = { x: -d4.y / dl, y: d4.x / dl };
    const perpScene: CN.Scene = {
      points: [
        givenPt(A4), givenPt(B4), givenPt(P4),
        { id: 'Q', x: P4.x + n4.x, y: P4.y + n4.y, kind: 'inter' as const },
      ],
      lines: [{ id: 'l', a: 'P', b: 'Q' }],
      circles: [],
    };
    assert.strictEqual(CN.isSolved(t4, perpScene), true);
    const w4 = t4.witness(perpScene);
    assert.ok(w4 && w4.kind === 'line' && w4.point, '过点垂线应给出垂足');
    assert.ok(CN.distToLine(w4.point!, A4, B4) < 1e-9, '垂足必须落在 AB 上');
    assert.ok(Math.hypot(w4.point!.x - P4.x, w4.point!.y - P4.y) > 0.1, '垂足不能退化成 P');

    // 投影与预览交点
    assert.deepStrictEqual(CN.projectOnLine({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 2, y: 0 }), { x: 1, y: 0 });
    const circleScene = CN.buildScene(t1.givens, [{ kind: 'circle', c: 'A', p: 'B' }]);
    const pv = CN.previewIntersections(circleScene, { kind: 'line', a: 'A', b: 'B' });
    assert.strictEqual(pv.length, 1, '过圆心的线应只新增一个交点（另一个是已知的 B）');
    const pvDup = CN.previewIntersections(circleScene, { kind: 'circle', c: 'A', p: 'B' });
    assert.strictEqual(pvDup.length, 0, '重复圆不应预览出新交点');
  });

  test('自动演示守卫：减动效 Hook、HUD 不 fixed、四实验不裸 rAF', () => {
    const hook = readSrc('src/components/lab/use-auto-timeline.ts');
    assert.match(hook, /usePrefersReducedMotion/, '时间轴必须读减动效偏好');
    assert.match(hook, /REDUCED_STEP_MS/, '减动效分支必须有每步停留常量');

    const hud = readSrc('src/components/lab/demo-hud.tsx');
    assert.doesNotMatch(hud, /fixed bottom-/, 'HUD 不得 fixed，避免与 ParamDock 胶囊抢位');
    assert.match(hud, /CanvasDemoDock/, 'HUD 必须由画布卡容器 CanvasDemoDock 承载');
    assert.match(hud, /min-h-\[40px\]/, 'idle 演示胶囊必须有 40px 触控热区');
    assert.match(hud, /h-10 w-10/, 'HUD 主按钮必须有 40px 触控热区');

    for (const f of ['Congruence', 'Similarity', 'PolygonPi', 'Construction']) {
      const src = readSrc(`src/labs/math/${f}.tsx`);
      assert.doesNotMatch(src, /requestAnimationFrame/, `${f} 不得再保留裸 rAF；统一走 useAutoTimeline`);
    }
  });

  test('四关演示剧本：每一步合法，最后一步必须过关', () => {
    const expected: Record<string, number> = {
      'perp-bisector': 3,
      midpoint: 4,
      'angle-bisector': 5,
      'perp-through': 5,
    };
    for (const [taskId, steps] of Object.entries(CONSTRUCTION_DEMO)) {
      const task = CN.TASKS.find((t) => t.id === taskId);
      assert.ok(task, `${taskId}: 找不到对应 TaskDef`);
      assert.strictEqual(steps.length, expected[taskId], `${taskId}: 演示步数应为 ${expected[taskId]}`);
      const cons: CN.Cons[] = [];
      for (const [i, step] of steps.entries()) {
        const prefix = CN.buildScene(task!.givens, cons);
        const v = CN.validateCons(prefix, step.data.cons);
        assert.strictEqual(v.ok, true, `${taskId} 第 ${i + 1} 步不合法：${v.reason ?? ''}`);
        cons.push(step.data.cons);
      }
      const finalScene = CN.buildScene(task!.givens, cons);
      assert.ok(task!.witness(finalScene), `${taskId}: 演完最后一步仍未过关`);
    }
  });
}
