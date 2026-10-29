/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 元素详情卡（相邻导航 / 电子层胶囊 / 微粒看板）回归守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe，**整组 8 个用例一次迁出**。
 * 用例名、断言、正则、错误消息、循环边界与执行顺序与迁移前逐字相同；
 * 唯一差别是读源码的 1 处 `readFileSync('src/…')` 改走 `readSrc()` → `repoPath()`。
 *
 * 依赖特征：零 DOM、零 async、零全局改造；只读 `src/pages/PeriodicTable.tsx` 源码文本
 * 并调用该页面的纯函数（`neighborOf` / `groupDisplay` / `valenceTendency` …）。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的 `test`。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { repoPath } from './repo-paths';
import { ATOM_VIEW, coreRadiusFor, shellLayout } from '../lib/atom-shells';
import { ELEMENTS } from '../lib/elements';
import {
  SCROLL_FADE_MASK, SHELL_NAMES, VALENCE_LABEL, elementScope, fSeriesOf, groupDisplay, groupLabel,
  neighborOf, particleCount, valenceNote, valenceTendency,
} from '../pages/PeriodicTable';

export function registerPeriodicDetailCardTests(test: TestFn): void {
  /** 读仓库内源码：参数保持仓库相对路径，错误消息里的文件标识也不变。 */
  const readSrc = (p: string, enc: BufferEncoding = 'utf8') => readFileSync(repoPath(p), enc);
  const src = readSrc('src/pages/PeriodicTable.tsx', 'utf8');

  test('相邻元素导航：前一号 / 后一号成对，首末位自动禁用且不环绕', () => {
    // 边界：首末位
    assert.equal(neighborOf(1).prev, null, '#1 H 之前没有元素');
    assert.equal(neighborOf(1).next?.n, 2, '#1 H 的下一个是 #2 He');
    assert.equal(neighborOf(118).next, null, '#118 Og 之后没有元素');
    assert.equal(neighborOf(118).prev?.n, 117, '#118 Og 的上一个是 #117 Ts');
    // 用户点名的样例：#24 铬 ↔ #23 V / #25 Mn
    assert.equal(neighborOf(24).prev?.n, 23, '#24 铬的前一个是 #23');
    assert.equal(neighborOf(24).prev?.symbol, 'V', '#24 铬的前一个是 #23 V');
    assert.equal(neighborOf(24).next?.n, 25, '#24 铬的后一个是 #25');
    assert.equal(neighborOf(24).next?.symbol, 'Mn', '#24 铬的后一个是 #25 Mn');
    // 118 个元素全部成链：邻域必须严格按原子序数相邻（不得跳过 La/Ac 或错位）
    for (const e of ELEMENTS) {
      const { prev, next } = neighborOf(e.n);
      if (prev) assert.equal(prev.n, e.n - 1, `#${e.n} 的前一个必须是 #${e.n - 1}`);
      if (next) assert.equal(next.n, e.n + 1, `#${e.n} 的后一个必须是 #${e.n + 1}`);
    }
    // 源码级：触发器 / 禁用 / 方向键 / Z-of-118 指示
    assert.match(src, /neighborOf\(selected\.n\)/, '详情卡须用 neighborOf 取相邻元素');
    assert.match(src, /disabled=\{!prev\}/, '前一号按钮须在首位置禁用');
    assert.match(src, /disabled=\{!next\}/, '后一号按钮须在末位置禁用');
    assert.match(src, /e\.key === 'ArrowLeft'/, '须绑定 ← 方向键');
    assert.match(src, /e\.key === 'ArrowRight'/, '须绑定 → 方向键');
    assert.match(src, /ELEMENTS\.length/, '须显示「当前序数 / 总数」紧凑指示');
  });

  test('电子层胶囊：K/L/M/N 命名、由 shells 生成、默认高亮最外层', () => {
    assert.deepEqual([...SHELL_NAMES], ['K', 'L', 'M', 'N', 'O', 'P', 'Q'], '电子层名须为 K L M N O P Q');
    assert.match(src, /selected\.shells\.map\(\(cnt, i\)/, '胶囊须由 shells 数组生成（层数自适应）');
    assert.match(src, /SHELL_NAMES\[i\]/, '胶囊须带 K/L/M/N 层名');
    assert.match(src, /hoveredLayer \?\? pinnedLayer \?\? e\.shells\.length - 1/,
      '高亮优先级须为：悬停 > 点击锁定 > 默认最外层');
    assert.match(src, /setPinnedLayer\(pinnedLayer === i \? null : i\)/, '点击胶囊须锁定该层');
    assert.match(src, /bg-\[var\(--accent-light\)\]/, '胶囊须用微底；本仓无 --surface-sunken，须以 --accent-light 代替');
    assert.doesNotMatch(src, /surface-sunken/, '不得引用不存在的 --surface-sunken 令牌');
    // 层数自适应：每个元素都能在 K~Q 命名范围内生成等长胶囊
    for (const e of ELEMENTS) {
      assert.ok(
        e.shells.length >= 1 && e.shells.length <= SHELL_NAMES.length,
        `#${e.n} 的电子层数 ${e.shells.length} 超出 K~Q 命名范围`,
      );
    }
  });

  test('微粒三元组：质子 Z / 中子 N = round(A) − Z / 核外电子 Z', () => {
    assert.match(src, /Math\.round\(e\.massExact \?\? e\.mass \?\? e\.n\)/, '中子数须用 Math.round(A) − Z');
    // 行为级：初中铁律在全部 118 个元素上成立
    for (const e of ELEMENTS) {
      const pc = particleCount(e);
      assert.equal(pc.protons, e.n, `#${e.n} 质子数须等于原子序数`);
      assert.equal(pc.electrons, e.n, `#${e.n} 核外电子数须等于原子序数（原子整体呈电中性）`);
      assert.ok(pc.neutrons >= 0, `#${e.n} 中子数不得为负`);
      const a = Math.round(e.massExact ?? e.mass ?? e.n);
      assert.equal(pc.protons + pc.neutrons, a, `#${e.n} 须满足 A ≈ Z + N`);
      assert.ok(pc.neutrons <= 180, `#${e.n} 中子数 ${pc.neutrons} 明显偏离合理量级`);
    }
    // 抽查教科书经典：氢（氕）、氯、以及用户点名的铬
    assert.deepEqual(particleCount(ELEMENTS.find((e) => e.n === 1)!), { protons: 1, neutrons: 0, electrons: 1 }, '#1 氢（氕）：1 / 0 / 1');
    assert.deepEqual(particleCount(ELEMENTS.find((e) => e.n === 17)!), { protons: 17, neutrons: 18, electrons: 17 }, '#17 氯：17 / 18 / 17');
    assert.deepEqual(particleCount(ELEMENTS.find((e) => e.n === 24)!), { protons: 24, neutrons: 28, electrons: 24 }, '#24 铬：24 / 28 / 24');
    // 源码级：三元看板齐备
    for (const k of ['质子', '中子', '核外电子']) assert.ok(src.includes(k), `微粒看板须含「${k}」`);
    assert.ok(src.includes('核电荷数 = 质子数 = 核外电子数'), '须写出初中铁律');
  });

  test('保留教材画法：核内 +Z 与同心轨道圆环不得被替换成拟物小球', () => {
    assert.match(src, /\+{selected\.n}/, '原子核须保留 +Z（核电荷数）文字画法');
    assert.match(src, /<circle\s+cx=\{cx\} cy=\{cy\} r=\{r\} fill="none"/, '须保留同心轨道圆环');
    assert.match(src, /shellLayout\(selected\.shells, coreR\)/, '轨道几何须来自共享纯函数 shellLayout');
    assert.match(src, /ATOM_VIEW/, '须使用共享画布常量');
    assert.doesNotMatch(src, /radialGradient|linearGradient/, '原子结构图不得改用渐变拟物小球');
    // 行为级：核半径与各层几何在全部元素上都不越界、且点数等于真实电子数
    for (const e of ELEMENTS) {
      const coreR = coreRadiusFor(e.n);
      assert.ok(coreR >= 13 && coreR <= 16, `#${e.n} 核半径 ${coreR} 偏离既定区间`);
      const shells = shellLayout(e.shells, coreR);
      assert.equal(shells.length, e.shells.length, `#${e.n} 轨道数须等于电子层数`);
      shells.forEach((s, i) => {
        assert.equal(s.dots.length, e.shells[i], `#${e.n} 第 ${i + 1} 层点数须等于真实电子数（教材画法不得截断）`);
      });
      assert.ok(
        shells[shells.length - 1].r <= ATOM_VIEW.h / 2,
        `#${e.n} 最外层半径 ${shells[shells.length - 1].r} 越出画布`,
      );
    }
  });

  test('族标签与人教版写法 + 结构要点倾向', () => {
    assert.equal(groupLabel(1), 'ⅠA', '第 1 族须写作ⅠA');
    assert.equal(groupLabel(17), 'ⅦA', '卤素族须写作ⅦA');
    assert.equal(groupLabel(18), '0', '稀有气体族须写作 0 族');
    assert.equal(groupLabel(6), 'ⅥB', '#24 铬所在族须写作ⅥB');
    assert.equal(groupLabel(8), 'Ⅷ', '8/9/10 三列同属Ⅷ族');
    assert.equal(groupLabel(null), '—', 'f 区（无族）须优雅回退');
    // 行为级：最外层得失倾向（主族）——分区分流后返回值增加 scope 字段
    const na = ELEMENTS.find((e) => e.n === 11)!;
    const cl = ELEMENTS.find((e) => e.n === 17)!;
    const c6 = ELEMENTS.find((e) => e.n === 6)!;
    const ar = ELEMENTS.find((e) => e.n === 18)!;
    const he = ELEMENTS.find((e) => e.n === 2)!;
    assert.deepEqual(
      { outer: valenceTendency(na).outer, kind: valenceTendency(na).kind, count: valenceTendency(na).count },
      { outer: 1, kind: 'lose', count: 1 },
      '#11 钠：外层 1，易失 1',
    );
    assert.equal(valenceTendency(na).scope, 'main', '#11 钠须落在主族作用域');
    assert.deepEqual(
      { outer: valenceTendency(cl).outer, kind: valenceTendency(cl).kind, count: valenceTendency(cl).count },
      { outer: 7, kind: 'gain', count: 1 },
      '#17 氯：外层 7，易得 1',
    );
    assert.equal(valenceTendency(c6).kind, 'share', '#6 碳：外层 4，易共用电子');
    assert.equal(valenceTendency(ar).kind, 'stable', '#18 氩：外层 8，稳定结构');
    assert.equal(valenceTendency(he).kind, 'stable', '#2 氦：首层排满 2，稳定结构');
    for (const e of ELEMENTS) {
      const vt = valenceTendency(e);
      assert.equal(vt.outer, e.shells[e.shells.length - 1], `#${e.n} 最外层电子数须取末位`);
      assert.ok(
        ['lose', 'gain', 'share', 'stable', 'hydrogen', 'saturated', 'variable', 'lanthanide', 'polyvalent'].includes(vt.kind),
        `#${e.n} 倾向类型非法：${vt.kind}`,
      );
    }
  });

  test('外层倾向分区：副族/过渡与 f 区只给可变化合价，严禁硬套初中主族规律', () => {
    // 用户点名的三个过渡元素：一律不得输出 lose/gain，且必须落在 transition 作用域
    for (const n of [24, 26, 29]) {
      const e = ELEMENTS.find((x) => x.n === n)!;
      const vt = valenceTendency(e);
      assert.equal(vt.scope, 'transition', `#${n} ${e.symbol} 须判定为过渡元素`);
      assert.equal(vt.kind, 'variable', `#${n} ${e.symbol} 须输出「可变化合价」而非得失数`);
      assert.notEqual(vt.kind, 'lose', `#${n} 不得输出「易失」`);
      assert.notEqual(vt.kind, 'gain', `#${n} 不得输出「易得」`);
      assert.equal(vt.count, 0, `#${n} 不得给出得失电子个数`);
      const note = valenceNote(e, vt, true)!;
      assert.match(note, /可变化合价/, `#${n} 须说明可变化合价`);
      assert.match(note, /仅严格适用于主族/, `#${n} 须声明适用域边界`);
    }
    // #46 钯：外层 18 的经典特例 —— 既不作得失判定，也不得出现负数
    const pd = ELEMENTS.find((e) => e.n === 46)!;
    const pdV = valenceTendency(pd);
    assert.equal(pdV.outer, 18, '#46 钯最外层应为 18（2,8,18,18）');
    assert.equal(pdV.kind, 'saturated', '#46 钯须判为「外层已达饱和」');
    assert.equal(pdV.count, 0, '#46 钯不得出现负数电子数');
    assert.match(valenceNote(pd, pdV, true)!, /18 个电子/, '钯须说明 18 电子特例');
    // f 区（镧系/锕系）
    for (const n of [57, 71, 89, 103]) {
      const e = ELEMENTS.find((x) => x.n === n)!;
      const vt = valenceTendency(e);
      assert.equal(vt.scope, 'f', `#${n} 须判定为 f 区`);
      assert.equal(vt.kind, 'lanthanide', `#${n} 须输出镧系/锕系说明`);
      assert.notEqual(vt.kind, 'lose');
      assert.notEqual(vt.kind, 'gain');
    }
    // 全域硬不变量（118 元素逐个）
    for (const e of ELEMENTS) {
      const vt = valenceTendency(e);
      assert.ok(Number.isFinite(vt.count) && vt.count >= 0, `#${e.n} ${e.symbol} 得失电子数不得为负或非数：${vt.count}`);
      assert.equal(vt.outer, e.shells[e.shells.length - 1], `#${e.n} 最外层须取末位`);
      if (vt.kind === 'gain') {
        assert.ok(vt.count > 0 && vt.count <= 3, `#${e.n} 易得电子数须落在 1–3：${vt.count}`);
        assert.notEqual(e.cat, 'metal', `#${e.n} ${e.symbol} 是金属，绝不输出「易得电子」`);
        assert.equal(vt.scope, 'main', `#${e.n} 只有主族才允许输出得失判定`);
      }
      if (vt.kind === 'lose') assert.equal(vt.scope, 'main', `#${e.n} 只有主族才允许输出得失判定`);
      if (vt.kind === 'saturated') assert.ok(vt.outer > 8, `#${e.n} 只有外层 > 8 才可判为饱和`);
    }
    // 作用域与序号/列号的对应关系（118 元素）
    for (const e of ELEMENTS) {
      const expectScope = (e.n >= 57 && e.n <= 71) || (e.n >= 89 && e.n <= 103)
        ? 'f'
        : e.group !== null && e.group >= 3 && e.group <= 12 ? 'transition' : 'main';
      assert.equal(elementScope(e), expectScope, `#${e.n} ${e.symbol} 分区判定错误`);
    }
    // 氢：两性特例，不得按普通ⅠA 处理
    const h = ELEMENTS.find((e) => e.n === 1)!;
    const hV = valenceTendency(h);
    assert.equal(hV.kind, 'hydrogen', '#1 氢须为两性特例');
    assert.match(valenceNote(h, hV, true)!, /H⁻/, '氢须说明 H⁻');
    // 金属永不得 gain：Bi/Po/Mc/Lv 走多价态
    for (const n of [83, 84, 115, 116]) {
      const e = ELEMENTS.find((x) => x.n === n)!;
      const vt = valenceTendency(e);
      assert.equal(vt.kind, 'polyvalent', `#${n} ${e.symbol}（金属）须走多价态`);
      assert.equal(vt.count, 0);
    }
    // 短标签表齐备且与 kind 一一对应
    for (const k of ['lose', 'gain', 'share', 'stable', 'hydrogen', 'saturated', 'variable', 'lanthanide', 'polyvalent'] as const) {
      assert.ok(VALENCE_LABEL[k].zh && VALENCE_LABEL[k].en, `VALENCE_LABEL.${k} 中英文案都不得为空`);
    }
  });

  test('族标签展示：第 18 列兼顾 0 族与第 18 族，镧系/锕系显式激活系别', () => {
    const he = ELEMENTS.find((e) => e.n === 2)!;
    assert.equal(groupDisplay(he, true).main, '0', '第 18 列主标须为 0 族（人教版初中口径）');
    assert.match(groupDisplay(he, true).sub, /第 18 族/, '副标须给出「第 18 族」（新课标口径）');
    assert.match(groupDisplay(he, true).sub, /第 18 列/, '副标须保留列号');
    assert.equal(groupDisplay(he, false).sub, 'group 18 · column 18', '英文副标须同时给出 group 18');
    for (const e of ELEMENTS.filter((x) => x.group === 18)) {
      assert.equal(groupDisplay(e, true).main, '0', `#${e.n} 稀有气体主标须为 0`);
    }
    const la = ELEMENTS.find((e) => e.n === 57)!;
    const u = ELEMENTS.find((e) => e.n === 92)!;
    assert.equal(groupDisplay(la, true).main, 'ⅢB', '#57 镧主标须为ⅢB');
    assert.equal(groupDisplay(la, true).series, '镧系', '#57 须激活「镧系」徽章');
    assert.equal(groupDisplay(u, true).series, '锕系', '#92 须激活「锕系」徽章');
    assert.equal(groupDisplay(la, false).series, 'lanthanide', '英文系别徽章');
    for (let n = 57; n <= 71; n++) assert.equal(fSeriesOf(ELEMENTS.find((e) => e.n === n)!), 'lanthanide', `#${n} 须判为镧系`);
    for (let n = 89; n <= 103; n++) assert.equal(fSeriesOf(ELEMENTS.find((e) => e.n === n)!), 'actinide', `#${n} 须判为锕系`);
    for (const n of [21, 39, 72, 104, 118]) assert.equal(fSeriesOf(ELEMENTS.find((e) => e.n === n)!), null, `#${n} 不得判为 f 区`);
    assert.match(src, /groupDisplay\(selected, isZh\)/, '详情卡须用 groupDisplay 渲染族标签');
    assert.match(src, /\{selGroup\?\.series && \(/, '系别徽章须按系别条件渲染');
    // 中子标称修饰 + 诚实化说明
    assert.match(src, /N（估算）/, '中子格须标明为估算值');
    // 意图级断言（不锁死措辞）：中子数须显式标注为估算值，并点明「丰度加权平均 + 取整」的成因
    assert.match(src, /N（估算）|N \(est\.\)/, '中子数须在界面上标注为估算值');
    assert.match(src, /同位素丰度加权平均/, '须说明相对原子质量是同位素丰度的加权平均');
    assert.match(src, /³⁵Cl/, '须给出常见稳定同位素的取整实例（氯取 ³⁵Cl）');
    assert.match(src, /最长寿命核素/, '须说明放射性元素按最长寿命核素取质量数');
    // 学段分层提示（意图级：须点明「第 3 层可容纳 18 个电子」这一排布差异根因）
    assert.match(src, /\{selected\.n >= 21 && \(/, 'Z ≥ 21 须附学段分层提示');
    assert.match(src, /第 3 层最多容纳 18 个电子/, '提示须解释 21 号起的排布差异');
  });

  test('中央悬停展台：几何与真实格子同构、落位第 1~3 周期第 3~12 列、防抖回退齐备', () => {
    // 几何：左侧 28px（周期号 24 + 间距 4）、18 列等宽、4px 间隙、58px 行高 —— 与 flex 行逐列重合
    assert.match(src, /left-\[28px\] right-\[3px\] top-0 hidden sm:grid/, '展台覆层须按同一几何定位，并在移动端折叠');
    assert.match(src, /col-start-3 col-end-13 row-start-1 row-end-4/, '展台须占第 3~12 列、第 1~3 周期');
    assert.match(src, /gridTemplateColumns: 'repeat\(18, minmax\(0, 1fr\)\)'/, '须与 18 列网格同模板');
    assert.match(src, /gridTemplateRows: 'repeat\(3, 58px\)'/, '须与 58px 行高同模板');
    assert.match(src, /gap: '4px'/, '间隙须与 gap-1 一致');
    assert.match(src, /pointer-events-none/, '展台不得抢走格子的点击');
    assert.match(src, /aria-hidden="true"/, '展台为纯展示层，须对辅助技术隐藏');
    // 悬停响应与防抖
    assert.match(src, /onMouseEnter=\{\(\) => previewOn\(el\)\}/, '元素格须绑定 previewOn');
    assert.match(src, /onMouseLeave=\{previewOff\}/, '元素格须绑定 previewOff');
    assert.match(src, /const \[heroEl, setHeroEl\] = useState<ElementInfo \| null>\(null\)/, '须有 heroEl 状态');
    assert.match(src, /heroTimer\.current = window\.setTimeout\(\(\) => \{ setHeroEl\(null\)/, '离开后须延迟回退到默认态');
    assert.match(src, /if \(heroTimer\.current\) \{ window\.clearTimeout\(heroTimer\.current\); heroTimer\.current = null; \}/, '再次进入须取消回退（防闪烁）');
    // 内容：默认图例态 + 悬停预览态（实物图 / 身份 / 核心指标 / 微提示）
    assert.match(src, /\/\/ \{isZh \? '分类图例' : 'LEGEND'\}/, '默认态须含分类图例');
    assert.match(src, /element-images\/\$\{heroFocus\.n\}\.jpg/, '悬停态须复用百科实物标本图（按焦点的原子序数取图）');
    assert.match(src, /data-hero-fallback/, '无实物图须有优雅回退');
    assert.match(src, /点击元素格打开完整微观结构与百科故事/, '须有底部微提示');
    for (const k of ['相对原子质量', '周期', '电子层', '外层倾向']) {
      assert.ok(src.includes(k), `展台核心指标须含「${k}」`);
    }
    // 右边缘：蒙版条件化 + 呼吸边距
    assert.doesNotMatch(src, /className="fade-r-x/, '不得再无条件套用 .fade-r-x 蒙版');
    assert.match(src, /style=\{canScrollRight \? \{ maskImage: SCROLL_FADE_MASK/, '渐隐蒙版须按 canScrollRight 条件施加');
    assert.equal(
      SCROLL_FADE_MASK,
      'linear-gradient(to right, #000 calc(100% - 12px), transparent 100%)',
      '渐隐须收窄到 12px（原 28px 会吞掉整列边框）',
    );
    assert.match(src, /pr-\[3px\]/, '最右列须留 3px 呼吸边距');
  });
}
