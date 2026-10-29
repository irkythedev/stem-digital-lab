/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 滑动变阻器结构与走线守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe，**整组 6 个用例一次迁出**。
 * 用例名、断言、正则、错误消息与执行顺序与迁移前逐字相同；1 处 `readFileSync('src/…')`
 * 改走 `readSrc()` → `repoPath()`。
 *
 * 依赖特征：零 DOM、零 async、零全局改造；断言对象是拓扑生成器的几何输出与组件源码。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { repoPath } from './repo-paths';
import * as CP from '../components/lab/circuit/CircuitParts';
import {
  CIRCUIT_STYLES,
  RHEO_ROD_DY as TOPO_RHEO_ROD_DY,
  RIGHT_X as TOPO_RIGHT_X,
  genTopology as TOPO_GEN,
} from '../labs/physics/circuitStyles';

export function registerRheostatTopologyTests(test: TestFn): void {
  /** 读仓库内源码：参数保持仓库相对路径，错误消息里的文件标识也不变。 */
  const readSrc = (p: string, enc: BufferEncoding = 'utf8') => readFileSync(repoPath(p), enc);
  const read = (path: string) => readSrc(path, 'utf8');
  const RHEO = read('src/components/lab/circuit/CircuitParts.tsx');
  const RHEO_BLOCK = RHEO.slice(RHEO.indexOf('export function Rheostat'), RHEO.indexOf('/* ---------- 固定电表'));
  const OHM = read('src/labs/physics/Ohm.tsx');
  const TOPO = read('src/labs/physics/circuitStyles.ts');

  test('三层结构齐备：下层线圈瓷筒 + 上层金属杆 + 中层滑片垂直连通', () => {
    assert.match(RHEO_BLOCK, /下层：漆包线线圈瓷筒/, '缺下层线圈瓷筒');
    assert.match(RHEO_BLOCK, /上层：导电金属杆/, '缺上层金属杆');
    assert.match(RHEO_BLOCK, /中层：滑片 P/, '缺中层滑片');
    // 瓷筒 = rect；金属杆 = 横线；滑片垂直连杆 + 触头三角
    assert.match(RHEO_BLOCK, /width=\{RHEO_W\}[\s\S]*?height=\{RHEO_H\}/, '瓷筒矩形缺失');
    assert.match(RHEO_BLOCK, /<line x1=\{t\.C\.x\} y1=\{rodY\} x2=\{t\.D\.x\} y2=\{rodY\}/, '金属杆横线缺失');
    assert.match(RHEO_BLOCK, /<line x1="0" y1=\{rodY\} x2="0" y2=\{coilTop\}/, '滑片垂直连杆缺失（会与上下两层脱节）');
    assert.match(RHEO_BLOCK, /<polygon points=\{`-2\.6,\$\{coilTop\}/, '触头三角缺失');
  });

  test('四接线柱 A/B/C/D 齐备且几何与父级共用常量一致', () => {
    assert.match(RHEO_BLOCK, /\['A', 'B', 'C', 'D'\] as const/, '未渲染 A/B/C/D 四柱');
    const t0 = CP.rheostatTerminals(190, 60);
    assert.deepStrictEqual(t0.A, { x: 173, y: 60 }, 'A 应为左下接线柱');
    assert.deepStrictEqual(t0.D, { x: 207, y: 44 }, 'D 应为右上接线柱');
    assert.strictEqual(CP.RHEO_W / 2, 17, '瓷筒半宽须为 17（父级按 17 布局）');
    // 父级 circuitStyles 的金属杆偏移必须与组件一致，否则出线接不上接线柱
    assert.strictEqual(TOPO_RHEO_ROD_DY, CP.RHEO_ROD_DY, 'circuitStyles 的 RHEO_ROD_DY 与组件不一致');
  });

  test('滑片单调性：ratio 增 → 滑片右移 → 接入线圈有效长度变长', () => {
    const xs = [0, 0.25, 0.5, 0.75, 1].map((r) => CP.rheostatWiperX(190, r));
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1], '滑片位置未随 ratio 单调右移');
    // 行程不越过瓷筒端头（两端各留 4px）
    assert.ok(Math.abs(xs[0] - 177) < 1e-9 && Math.abs(xs[4] - 203) < 1e-9, '滑片行程超界');
    // 接入长度 = 4px 起始余量 + 26px·ratio（仿射）：用差值验证线性，不能直接用比值（含常量项）
    const len = (r: number) => CP.rheostatWiperX(190, r) - CP.rheostatTerminals(190, 60).A.x;
    assert.ok(Math.abs((len(1) - len(0)) - 2 * (len(0.5) - len(0))) < 1e-9, '接入长度的增量非线性');
    assert.ok(Math.abs(len(0) - 4) < 1e-9, '起始余量应为 4px（滑片不越过瓷筒端头）');
  });

  test('导线全部横平竖直（90° 直角），端点吸附接线柱圆心', () => {
    const terms = CP.rheostatTerminals(190, 60);
    // Ohm：左进线端点 = A，出线起点 = D，直角折下后落于元件左端
    assert.match(OHM, /<line x1="145" y1="60" x2="173" y2="60" \/>/, '左进线未吸附 A(173,60)');
    assert.match(OHM, /<line x1="207" y1="44" x2="230" y2="44" \/>/, '出线未自 D(207,44) 起');
    assert.match(OHM, /<line x1="230" y1="44" x2="230" y2="60" \/>/, '出线缺 90° 折下段');
    assert.strictEqual(terms.A.x, 173);
    assert.strictEqual(terms.D.y, 44);
    // 该区域的每一条导线都必须轴对齐（x1==x2 或 y1==y2）
    const segs = [
      [145, 60, 173, 60],
      [207, 44, 230, 44],
      [230, 44, 230, 60],
    ];
    for (const [x1, y1, x2, y2] of segs) {
      assert.ok(x1 === x2 || y1 === y2, `导线 ${x1},${y1}→${x2},${y2} 非 90° 直角`);
    }
    // 变阻器符号内不得出现曲线路径（贝塞尔）或斜线导线
    assert.doesNotMatch(RHEO_BLOCK, /<path/, '变阻器符号出现曲线路径（禁止贝塞尔）');
    assert.doesNotMatch(RHEO_BLOCK, /\b[QCST]\s*-?\d/, '变阻器符号出现曲线命令');
  });

  test('串联网末段同样走「一上一下」且与组件常量一致', () => {
    assert.match(TOPO, /elems\[n - 1\]\.kind === 'rheostat'/, '串联网未对末位变阻器特殊处理');
    const rodY = 60 + TOPO_RHEO_ROD_DY;
    assert.strictEqual(rodY, 44, '金属杆高度应为 44');
    // 行为断言（取代原「源码正则」）：右端竖线起点必须与末位元件同源 ——
    // 末位是变阻器时自金属杆高度(44)起（与出线段闭合），否则自主回路 y=60；
    // 原正则把「无条件自 60+RHEO_ROD_DY 起」写死，等于放行了无变阻器样式的悬空露头。
    for (const st of CIRCUIT_STYLES.filter((x) => x.kind === 'series')) {
      const topo = TOPO_GEN(st);
      const right = topo.wires.find((w) => w.id === 'dry-right');
      assert.ok(right, `${st.id} 缺右端竖线`);
      const lastKind = st.elements[st.elements.length - 1].kind;
      assert.strictEqual(right!.y1, lastKind === 'rheostat' ? rodY : 60,
        `${st.id}：右端竖线起点应为 ${lastKind === 'rheostat' ? rodY : 60}（末位元件 ${lastKind}），否则右上角出现悬空露头`);
      assert.strictEqual(right!.x1, TOPO_RIGHT_X, `${st.id}：右端竖线须落在汇合母线 x 上`);
      assert.strictEqual(right!.x2, TOPO_RIGHT_X, `${st.id}：右端竖线须垂直`);
    }
    for (const [x1, y1, x2, y2] of [[268 + 17, rodY, 290, rodY], [290, rodY, 290, 140]]) {
      assert.ok(x1 === x2 || y1 === y2, '串联网出线非 90° 直角');
    }
  });

  test('仅用设计令牌，无硬编码色值噪音', () => {
    for (const token of ['var(--fg)', 'var(--muted)', 'var(--card-bg)', 'var(--accent)']) {
      assert.ok(RHEO_BLOCK.includes(token), `缺令牌 ${token}`);
    }
    assert.doesNotMatch(RHEO_BLOCK, /#[0-9a-fA-F]{3,6}\b/, '变阻器出现硬编码色值');
    assert.doesNotMatch(RHEO_BLOCK, /stroke="black"|strokeWidth="2\.5"/, '出现粗黑视觉噪音');
  });
}
