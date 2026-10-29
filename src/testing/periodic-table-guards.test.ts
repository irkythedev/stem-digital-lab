/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 周期表页面「离线包行内化 / 展台去硬包裹 / 3D 空间模型」回归守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的 `周期表：离线包行内化 / 展台去硬包裹 / 3D 空间模型` 套件，
 * **整组 17 个用例一次迁出**（16 个 `test` + 1 个 `testAsync`），用例名、断言、正则、
 * 错误消息、循环边界与执行顺序与迁移前逐字相同。
 *
 * 与迁移前唯一的差别是读仓库文件的路径基准：原来 21 处 `readFileSync('src/…')` 与
 * 2 处 `existsSync('src/…')` 由 `process.cwd()` 解析，现在改走 `readSrc()` / `readExists()`
 * → `repoPath()`，从本模块位置推导仓库根，因此在任意工作目录下运行结果一致。
 *
 * 关于「document / window / localStorage」：本套件对这些名字的引用**不是真实 DOM 依赖**，
 * 绝大多数是「读源码 + 正则断言」的字符串字面量（例如断言源码里出现
 * `typeof document !== 'undefined'`）。真正会动全局的只有两处运行时片段：
 * ①「⑩f」用假 `window.localStorage` + 假 `fetch` 跑一遍状态机，结束时还原 `window`；
 * ② 用 `Object.defineProperty(globalThis, 'navigator', …)` 造离线态，`finally` 里还原描述符。
 * 两者都自包含、先备份后还原，且套件内用例按源码顺序串行执行，因此可整组独立运行。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的 `test` / `testAsync`。
 */
import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { repoTarget, repoPath } from './repo-paths';
import { AI_PROVIDERS, providerLabel, type AiProvider } from '../lib/ai-config';
import {
  AI_POLL_BROKEN_MS, AI_POLL_HEALTHY_MS, AI_POLL_MAX_BREAK_MS, AI_STATUS_DETAIL, AI_STATUS_DOT, AI_STATUS_HOLLOW, AI_STATUS_LABEL, AI_STATUS_TTL_MS,
  aiCheckedAtLabel, aiConfigFingerprint, getAiStatus, isHollowStatus, isStatusFresh,
  nextPollDelayMs, pollAiStatus, refreshAiStatus, resetPollBackoff, verifyAiStatus,
} from '../lib/ai-status';
import {
  CAMERA_D, MAX_LAYERS, MIN_CLUSTER_FILL, NEUTRON_COLOR, NUCLEON_FILL, NUCLEON_MAX_PX, NUCLEON_MIN_PX,
  NUCLEUS_MAX_PX, NUCLEUS_MIN_PX, SHELL_TILTS, VISUAL_COUNT_CAP,
  fibonacciSphere, nucleusPoints, nucleonAlpha, nucleonScreenSizes, orbitRadius, project3, protonFlags, sortByDepth, visualCount,
} from '../lib/atom-3d';
import { ELEMENTS, type ElementInfo } from '../lib/elements';
import { PROVIDER_ICON_KEY } from '../components/ui/ProviderIcon';
import { LEGEND_DOT, SHELL_NAMES, groupDisplay, groupLabel } from '../pages/PeriodicTable';

export function registerPeriodicTableTests(test: TestFn, testAsync: TestFn): void {
  /** 读仓库内源码：参数保持仓库相对路径，错误消息里的文件标识也不变。 */
  const readSrc = (p: string, enc: BufferEncoding = 'utf8') => readFileSync(repoPath(p), enc);
  /** 判断仓库内路径是否存在（相对路径照旧，基准换成仓库根；反向断言专用，不做存在性校验）。 */
  const readExists = (p: string) => existsSync(repoTarget(p));

  /** AI 面板源码全集：主文件 + 外置面板 + 共享件 + 全部 Hook（与 smoke 中的同名助手同义）。 */
  const AI_PANEL_FILES = [
    'src/components/ai/AiAssistant.tsx',
    'src/components/ai/panels/panel-shared.tsx',
    'src/components/ai/panels/TermsPanel.tsx',
    'src/components/ai/panels/SettingsPanel.tsx',
    'src/components/ai/panels/HistoryPanel.tsx',
    'src/components/ai/panels/QuizPanel.tsx',
    'src/components/ai/hooks/useAiSettings.ts',
    'src/components/ai/hooks/useQuizSession.ts',
    'src/components/ai/page-subject.ts',
  ];
  const readAiPanel = (): string => AI_PANEL_FILES.map((f) => readSrc(f)).join('\n');
  const pt = readSrc('src/pages/PeriodicTable.tsx', 'utf8');
  /** 取 [from, until) 之间的源码片段（体积与类名断言的统一取法） */
  const sliceTo = (from: string, until: string) => {
    const i = pt.indexOf(from);
    assert.ok(i > 0, `未找到锚点：${from}`);
    const j = pt.indexOf(until, i);
    assert.ok(j > i, `未找到闭合：${until}`);
    return pt.slice(i, j);
  };

  test('① 离线教学包已收敛为紧贴「中考跟读」的行内纯图标按钮', () => {
    const btn = sliceTo('onClick={() => setShowPack(true)}', '</button>');
    assert.match(btn, /title=\{/, '行内图标按钮须有 title 悬停提示');
    assert.match(btn, /t\.offlinePack\.entryHint/, 'title 须写明离线教学包的用途');
    assert.match(btn, /aria-label=\{t\.offlinePack\.entry\}/, '纯图标按钮须有 aria-label 兜底');
    assert.match(btn, /HardDrive className="w-4 h-4/, '图标须为紧凑尺寸 w-4 h-4');
    assert.doesNotMatch(btn, /border border-\[var\(--border\)\] px-2\.5 py-1\.5/, '不得再是带边框的实体按钮');
    assert.ok(btn.length < 800, `行内图标按钮片段 ${btn.length} 字符，疑似残留实体按钮`);
    const panel = pt.indexOf('recite-panel');
    const pack = pt.indexOf('onClick={() => setShowPack(true)}');
    assert.ok(panel > 0 && pack > panel, '离线包入口须移入跟读面板内部');
    assert.ok(pack < pt.indexOf('声音选择'), '离线包入口须紧贴「中考跟读」标题（位于声音选择之前）');
    assert.doesNotMatch(pt.slice(panel, pack), /flex flex-wrap items-center gap-2/, '不得再被独立整行容器包裹');
    assert.ok(
      pt.includes('{showPack && <OfflinePackPanel onClose={() => setShowPack(false)} />}'),
      '离线包弹窗触发逻辑须保持不变',
    );
  });

  test('② 中央展台容器无硬边框 / 重底色 / 投影 / 卡片壳', () => {
    const hero = sliceTo('col-start-3 col-end-13 row-start-1 row-end-4', '>');
    assert.doesNotMatch(hero, /border/, '展台容器不得含边框类');
    assert.doesNotMatch(hero, /bg-\[var\(--card-bg\)\]/, '展台容器不得含实体卡片底色');
    assert.doesNotMatch(hero, /shadow/, '展台容器不得含投影');
    assert.doesNotMatch(hero, /rounded/, '展台容器不得含圆角卡片壳');
    assert.doesNotMatch(hero, /overflow-hidden/, '展台容器不得含裁切');
    assert.match(hero, /relative/, '须保留 relative（两态叠层依赖）');
    assert.ok(pt.includes("heroFocus ? 'opacity-0' : 'opacity-100'"), '图例态须只做透明度过渡');
    assert.ok(pt.includes("heroFocus ? 'opacity-100' : 'opacity-0'"), '悬停/检索态须只做透明度过渡');
  });

  test('③ 详情卡支持 2D / 3D 切换且默认恒为 2D 课本规范', () => {
    assert.match(pt, /const \[atomMode, setAtomMode\] = useState<'2d' \| '3d'>\('2d'\)/, '默认视图须为 2D');
    assert.match(pt, /useEffect\(\(\) => \{ setAtomMode\('2d'\); \}, \[selected\?\.n\]\)/, '换元素须强制复位为 2D');
    // 控件形态（2026-10 改版）：由「左上整行双段控件」收敛为「图区外框右上角单个幽灵按钮」
    assert.match(pt, /data-atom-mode=\{atomMode\}/, '切换按钮须带 data-atom-mode（供渲染量测）');
    assert.match(pt, /absolute top-1 right-1 z-10/, '切换按钮须绝对定位于图区内部右上角，不占布局行');
    // 文案只描述「点下去会发生什么」，消除「2D 规范」既像状态标识又像操作按钮的歧义
    assert.ok(
      pt.includes("atomMode === '3d' ? (isZh ? '课本平面' : 'Flat view') : (isZh ? '3D 模型' : '3D model')"),
      '按钮文案须用动作语义（2D 态「3D 模型」/ 3D 态「课本平面」）',
    );
    for (const stale of ['3D 空间', '2D 规范', "'2D textbook'", "'3D space'"]) {
      assert.ok(!pt.includes(stale), `旧歧义文案「${stale}」须已清除`);
    }
    assert.doesNotMatch(pt, /role="group" aria-label=\{isZh \? '原子模型视图'/, '双段控件须已移除（不得再有 role=group 分段组）');
    assert.ok(pt.includes("// {isZh ? '原子结构示意图' : 'Bohr model'}"), '左上须只保留单行小标题「// 原子结构示意图」');
    assert.doesNotMatch(pt, /原子结构示意图（点击电子层查看电子数）/, '小标题不得再挂长括注（须收敛为单行）');
    assert.match(pt, /atomMode === '2d' \? \(/, '须按 atomMode 分支渲染');
    assert.match(pt, /<Atom3D[\s\S]{0,260}z=\{selected\.n\}/, 'Atom3D 须接收真实质子数 Z');
    assert.match(pt, /n=\{particleCount\(selected\)\.neutrons\}/, 'Atom3D 中子数须走 particleCount（与看板同源）');
    assert.match(pt, /highlight=\{layerHighlight\(selected\)\}/, '3D 须与电子层胶囊高亮联动');
    assert.ok(pt.includes('+{selected.n}'), '2D 核内「+Z」圈须仍在（中考必考画法，不得因引入 3D 而破坏）');
  });

  test('④ 3D 视图为原生 Canvas 2D，零外部 3D 库', () => {
    const comp = readSrc('src/components/lab/Atom3D.tsx', 'utf8');
    const math = readSrc('src/lib/atom-3d.ts', 'utf8');
    assert.match(comp, /getContext\('2d'\)/, '须为原生 Canvas 2D');
    // 组件与纯数学模块都不得出现 3D 库
    for (const [name, src] of [['Atom3D.tsx', comp], ['atom-3d.ts', math]] as const) {
      assert.doesNotMatch(src, /from\s+['"](three|@?babylonjs|@react-three\/[a-z-]+|zdog|o3d)/i, `${name} 不得引入外部 3D 库`);
      assert.doesNotMatch(src, /WebGL|THREE\.|createRenderer/, `${name} 不得走 WebGL / THREE 命名空间`);
    }
    const pkg = readSrc('package.json', 'utf8');
    assert.doesNotMatch(
      pkg,
      /"(three|@react-three\/[a-z-]+|@babylonjs\/[a-z-]+|babylonjs|zdog|o3d)"\s*:/,
      'package.json 不得出现 3D 库依赖',
    );
    // 斐波那契球面点阵：点数正确、逐点落在单位球面上、互不重合
    for (const count of [1, 2, 8, 118, 294]) {
      const pts = fibonacciSphere(count);
      assert.ok(pts.length === count, `fibonacciSphere(${count}) 点数应为 ${count}`);
      for (const p of pts) {
        if (count === 1) continue;
        const len = Math.hypot(p.x, p.y, p.z);
        assert.ok(Math.abs(len - 1) < 1e-6, `斐波那契点须在单位球面上：|p|=${len}`);
      }
      const uniq = new Set(pts.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`));
      assert.ok(uniq.size === count, `核内点阵不得重合（${uniq.size}/${count}）`);
    }
  });

  test('⑥ 核内点阵为离散球簇：质子/中子沿纬度混匀，绝不「上下半球拼接」', () => {
    // 旧实现的根因：斐波那契纬度 y=1-(2i+1)/A 随 i 单调，而「前 Z 个即质子」→ 质子全在北半球
    const cases: Array<[number, number, string]> = [[52, 24, 'Cr'], [294, 118, 'Og'], [4, 2, 'He'], [12, 6, 'C']];
    for (const [a, z, name] of cases) {
      const pts = nucleusPoints(a, z, 1);
      const p = pts.filter((x) => x.proton);
      const q = pts.filter((x) => !x.proton);
      const mean = (arr: typeof pts) => (arr.length ? arr.reduce((s, v) => s + v.y, 0) / arr.length : 0);
      const mp = mean(p), mq = mean(q);
      // y∈[-1,1]；半球拼接时质子/中子平均纬度会分别逼近 ±0.5（旧实现实测 +0.538 / −0.462）
      assert.ok(
        Math.abs(mp) < 0.3,
        `${name}: 质子平均纬度 ${mp.toFixed(3)} 偏北半球——「前 Z 个即质子」的实心半球拼接缺陷回归了`,
      );
      assert.ok(
        Math.abs(mq) < 0.3,
        `${name}: 中子平均纬度 ${mq.toFixed(3)} 偏南半球——同上`,
      );
      // 小样本（A<20）时均值噪声本就大，只在样本足够时才要求两者均值也接近
      if (a >= 20) {
        assert.ok(
          Math.abs(mp - mq) < 0.3,
          `${name}: 质子与中子的平均纬度差 ${Math.abs(mp - mq).toFixed(3)} 过大（>0.3 即出现上下分色）`,
        );
      }
    }
    // 等距取样：质子下标必须均匀铺满全程（否则又退化成「集中在某一半球」）
    for (const [count, protonN] of [[52, 24], [90, 36], [7, 3], [2, 1]] as const) {
      const flags = protonFlags(count, protonN);
      assert.ok(flags.length === count, `protonFlags 长度应为 ${count}`);
      assert.ok(flags.filter(Boolean).length === protonN, `质子数应为 ${protonN}`);
      const idx = flags.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
      // 等距布点：第 j 个质子落在 (j+0.5)/k 分位 → 首/末质子分别落在 1/(2k) 与 1−1/(2k) 分位附近。
      // 用 ceil(count/(2k)) 作容差，退化样本（count=2, k=1）也成立。
      const bin = Math.ceil(count / (2 * protonN));
      assert.ok(idx[0] <= bin, `首个质子下标 ${idx[0]} 越过第 1 个分位 ${bin}（南半球会缺质子）`);
      assert.ok(
        idx[idx.length - 1] >= count - 1 - bin,
        `末个质子下标 ${idx[idx.length - 1]} 未达倒数第 1 个分位（北半球会缺质子）`,
      );
      // 相邻质子下标差 ≥ 1（不重号）
      for (let i = 1; i < idx.length; i++) {
        assert.ok(idx[i] > idx[i - 1], `质子下标须严格递增：${idx[i - 1]} → ${idx[i]}`);
      }
    }
    // 体积填充：粒子半径经 cbrt 映射，故内层也有粒子（不是全部浮在球面）
    const pts = nucleusPoints(52, 24, 1);
    const radii = pts.map((p) => Math.hypot(p.x, p.y, p.z));
    assert.ok(Math.max(...radii) <= 1 + 1e-9, '核内粒子不得跑到球外');
    assert.ok(radii.filter((r) => r < 0.5).length >= 3, '应有若干粒子落在内核区（体积填充而非球面壳层）');
    const shellOnly = radii.filter((r) => r > 0.9).length;
    assert.ok(shellOnly < radii.length, '不得全部粒子都贴在球面上');
    // 无随机数：同参数两次调用必须完全一致（可测可复现）
    const again = nucleusPoints(52, 24, 1);
    assert.deepEqual(again.map((p) => `${p.x},${p.y},${p.z},${p.proton}`), pts.map((p) => `${p.x},${p.y},${p.z},${p.proton}`));
  });

  test('⑦ 核球/单球尺寸：单球恒在 2.2~3.5px，核球重元素落在 16~22px 且含缝隙', () => {
    // 轨道上限按「最内层轨道半径 × 0.4」给（组件即如此传参）
    const orbitLimit = (layers: number) => 0.4 * orbitRadius(0, layers) * 76;
    for (const a of [1, 2, 4, 7, 12, 24, 52, 118, 294]) {
      const count = visualCount(a);
      assert.ok(count <= VISUAL_COUNT_CAP, `A=${a} 视觉代表粒子数 ${count} 超过上限 ${VISUAL_COUNT_CAP}`);
      const s = nucleonScreenSizes(count, orbitLimit(4));
      assert.ok(
        s.nucleonR >= NUCLEON_MIN_PX - 1e-9 && s.nucleonR <= NUCLEON_MAX_PX + 1e-9,
        `A=${a} 单球半径 ${s.nucleonR.toFixed(2)}px 越出 [${NUCLEON_MIN_PX}, ${NUCLEON_MAX_PX}]px（过小会糊成一片、过大就成实心块）`,
      );
      if (a >= 40) {
        assert.ok(
          s.nucleusR >= NUCLEUS_MIN_PX - 1e-9 && s.nucleusR <= NUCLEUS_MAX_PX + 1e-9,
          `A=${a} 核球半径 ${s.nucleusR.toFixed(2)}px 越出 [${NUCLEUS_MIN_PX}, ${NUCLEUS_MAX_PX}]px`,
        );
      }
      assert.ok(s.nucleusR * 1.6 <= 76 * 2, `A=${a} 核球半径相对画布过大`);
    }
    // 单球越小 → 填充率不会反超「密堆积」；离散球簇的填充率必须显著低于实心（1.0）
    for (const a of [24, 52, 118, 294]) {
      const count = visualCount(a);
      const s = nucleonScreenSizes(count, orbitLimit(4));
      const fill = count * (s.nucleonR / s.nucleusR) ** 3;
      assert.ok(fill <= 0.62, `A=${a} 核内填充率 ${fill.toFixed(3)} 偏高，投影后会糊成实心色块（目标 ≈ ${NUCLEON_FILL}）`);
      assert.ok(fill >= MIN_CLUSTER_FILL - 1e-9, `A=${a} 核内填充率 ${fill.toFixed(3)} 过低，会看成几颗散珠`);
    }
    // 核球上限：无论轨道多小，核球都不得越过「最内层轨道 × 0.4」
    for (const layers of [1, 2, 4, 7]) {
      const limit = 0.4 * orbitRadius(0, layers) * 76;
      const s = nucleonScreenSizes(52, limit);
      assert.ok(s.nucleusR <= Math.max(NUCLEUS_MIN_PX, limit) + 1e-9, `layers=${layers} 核球越出最内层轨道的 40%`);
    }
    // 景深：近端不透明度 1.0，远端 0.66
    assert.ok(Math.abs(nucleonAlpha(-2, 2) - 1) < 1e-9, '核球近端（z=-R）不透明度须为 1.0');
    assert.ok(Math.abs(nucleonAlpha(2, 2) - 0.66) < 1e-9, '核球远端（z=+R）不透明度须为 0.66');
    assert.ok(Math.abs(nucleonAlpha(0, 2) - 0.83) < 1e-9, '核中心不透明度须为 0.83');
  });

  test('⑧ 绘制层：核子逐球独立渐变，杜绝「前 Z 个即质子」的实心拼贴', () => {
    const comp = readSrc('src/components/lab/Atom3D.tsx', 'utf8');
    assert.match(comp, /createRadialGradient/, '核子须逐球画径向渐变（同色球不改光影就会合并成实心色块）');
    assert.match(comp, /nucleusPoints/, '核点阵须走 nucleusPoints（体积填充 + 等距取样分配）');
    assert.match(comp, /nucleonAlpha/, '核子须带景深透明度（近 1.0 / 远 0.66）');
    assert.doesNotMatch(
      comp,
      /i < z \? 'proton' : 'neutron'/,
      '不得再按「前 Z 个即质子」分配——斐波那契纬度单调，这正是实心半球拼接的根因',
    );
    assert.doesNotMatch(comp, /coreRadius3D|nucleonRadius\b/, '不得再使用会糊成实心块的旧尺寸函数');
    // 核子与电子分开处理：电子保持扁平小点，核子走渐变
    assert.match(comp, /it\.kind === 'electron'/, '电子须与核子分支处理');
  });

  test('⑤ 透视与画家排序约定自洽，且卸载/切回时取消动画帧', () => {
    // 约定：depth 是「离相机的距离」，越大越远 → k 越小（近大远小）
    const near = project3({ x: 0, y: 0, z: -1 }, 0, 0, 100);
    const far = project3({ x: 0, y: 0, z: 1 }, 0, 0, 100);
    assert.ok(near.k > far.k, `近处透视因子 ${near.k.toFixed(3)} 须大于远处 ${far.k.toFixed(3)}（近大远小）`);
    assert.ok(Math.abs(project3({ x: 0, y: 0, z: 0 }, 0, 0, 100).k - 1) < 1e-9, 'z=0 时 k 须为 1');
    assert.ok(CAMERA_D > 1.5, '相机距离须大于轨道最大半径的 1.5 倍，避免透视分母过零');
    const order = sortByDepth([
      { depth: -0.9, id: 'near' }, { depth: 0.9, id: 'far' }, { depth: 0, id: 'mid' },
    ]).map((x) => x.id);
    assert.deepEqual(order, ['far', 'mid', 'near'], '画家算法须「远的先画」（从后往前）');
    assert.ok(SHELL_TILTS.length === 7 && MAX_LAYERS === 7, '轨道倾角表须覆盖 7 个电子层');
    for (let i = 0; i < MAX_LAYERS; i++) {
      const [tx, ty] = SHELL_TILTS[i];
      assert.ok(Math.abs(tx) <= 45 && Math.abs(ty) <= 45, `第 ${i} 层倾角过大，会与相邻层重合`);
    }
    for (let i = 1; i < 7; i++) {
      assert.ok(orbitRadius(i, 7) > orbitRadius(i - 1, 7), '轨道半径须自内向外严格递增');
    }
    // 防泄漏：卸载（切回 2D 或关闭弹窗）必须取消 rAF 并摘掉全部监听
    const src = readSrc('src/components/lab/Atom3D.tsx', 'utf8');
    assert.match(src, /cancelAnimationFrame\(raf\)/, '卸载时须 cancelAnimationFrame');
    assert.match(src, /removeEventListener\('pointermove'/, '卸载时须摘掉 window 上的 pointermove');
    assert.match(src, /removeEventListener\('pointercancel'/, '卸载时须摘掉 pointercancel');
    assert.match(src, /ro\.disconnect\(\)/, '卸载时须断开 ResizeObserver');
  });

  test('⑨ 微粒三联卡带形态互异的图例点，颜色与 3D 本体色同源', () => {
    assert.match(pt, /data-particle-dot=\{cell\.id\}/, '微粒卡片须带 data-particle-dot（供渲染量测）');
    assert.match(pt, /data-dot-shape=\{cell\.id === 'electron' \? 'ringed-dot' : 'sphere'\}/, '须标注图例形态（环点 / 微球）');
    for (const id of ['proton', 'neutron', 'electron']) {
      assert.ok(pt.includes(`id: '${id}'`), `微粒卡片须有 ${id} 稳定标识`);
    }
    // 三套绘制配方互异：核内两格是径向渐变微球（与 Atom3D 同一套配方），电子是「实心点 + 细环」
    assert.match(String(LEGEND_DOT.proton.background), /^radial-gradient\(/, '质子须为径向渐变微球');
    assert.match(String(LEGEND_DOT.neutron.background), /^radial-gradient\(/, '中子须为径向渐变微球');
    assert.ok(String(LEGEND_DOT.proton.background).includes('var(--accent)'), '质子球本体色须用 --accent（3D 质子球本体色）');
    assert.ok(String(LEGEND_DOT.neutron.background).includes(NEUTRON_COLOR), '中子球本体色须走 NEUTRON_COLOR 常量');
    assert.ok(!String(LEGEND_DOT.neutron.background).includes('var(--accent)'), '中子不得复用质子本体色');
    assert.ok(String(LEGEND_DOT.electron.background).includes('var(--fg)'), '电子点须用 --fg（2D/3D 电子点同填色）');
    assert.ok(LEGEND_DOT.electron.outline, '电子点须带细环线（环即轨道，形态与核内微球区分）');
    assert.ok(!String(LEGEND_DOT.electron.background).includes('radial-gradient'), '电子不得复用核内微球的球体配方');
    // 三类样式两两不同：防止退化成「三个同形换色圆点」（浅色主题下 --accent #000 与 --fg #111 仅差约 7% 亮度）
    assert.notDeepEqual(LEGEND_DOT.proton, LEGEND_DOT.neutron, '质子与中子图例不得同形同色');
    assert.notDeepEqual(LEGEND_DOT.proton, LEGEND_DOT.electron, '质子与核外电子图例不得雷同');
    assert.notDeepEqual(LEGEND_DOT.neutron, LEGEND_DOT.electron, '中子与核外电子图例不得雷同');
    // 单一事实源：3D 组件必须取同一中子色常量，两处不得各写一份
    const comp = readSrc('src/components/lab/Atom3D.tsx', 'utf8');
    assert.match(comp, /NEUTRON_COLOR/, 'Atom3D 须从同一常量取中子色');
    assert.doesNotMatch(comp, /'#d8cfc4'/, 'Atom3D 不得再硬写中子色（须走 NEUTRON_COLOR）');
    assert.equal(NEUTRON_COLOR, '#d8cfc4', '中子色常量值须保持淡暖灰白');
  });

  test('⑩ 电子层名第 5 层输出大写字母 O（并规避 mono 字体 O/0 同形误读）', () => {
    assert.deepEqual([...SHELL_NAMES], ['K', 'L', 'M', 'N', 'O', 'P', 'Q'], '层名须为 K L M N O P Q');
    assert.equal(SHELL_NAMES[4], 'O', '第 5 层须是大写字母 O');
    assert.notEqual(SHELL_NAMES[4], '0', '第 5 层不得是数字 0');
    for (const s of SHELL_NAMES) {
      assert.match(s, /^[A-Z]$/, `层名「${s}」须为单个拉丁大写字母`);
    }
    assert.ok(
      ELEMENTS.filter((e) => e.shells.length >= 5).length > 0,
      '须存在 5 层及以上的元素（否则本守卫覆盖不到第 5 层）',
    );
    // 字形反碰撞：Space Grotesk（--f-mono）的 O 与 0 逐像素同形（40px 下宽高同为 20×30、
    // 墨量 376 vs 375、仅 2.1% 抗锯齿噪声，且不支持 zero/ss01 斜杠零特性），
    // 故层名字母的两处渲染点都必须显式走 --f-serif（同尺寸 O/0 墨量比 1.58×）。
    const serifSpans = pt.match(/<span className="serif-font">\{SHELL_NAMES\[[a-z]+\]\}<\/span>/g) ?? [];
    assert.equal(serifSpans.length, 2, `层名字母须在两处渲染点都走 --f-serif（实测 ${serifSpans.length} 处）`);
    assert.match(pt, /O 与 0 逐像素同形/, '须保留字形碰撞成因注释（防后人「顺手」改回 mono）');
  });

  test('⑪ 118 元素族标签只用标准预组合罗马数字（U+2160–U+2167）', () => {
    const CANON = /^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧ][AB]?|0)$/;
    for (const e of ELEMENTS) {
      const { main } = groupDisplay(e, true);
      assert.match(main, CANON, `Z=${e.n} ${e.symbol} 族标签「${main}」不是标准预组合罗马数字`);
      assert.doesNotMatch(main, /[IVX]/, `族标签「${main}」含 ASCII 字母 I/V/X（应使用 Ⅰ~Ⅷ 预组合字符）`);
    }
    // 关键对照：主族 ⅥA、8/9/10 同属 Ⅷ、第 18 列沿用人教版「0 族」、副族 ⅢB
    assert.equal(groupLabel(16), 'ⅥA', '第 16 列须为 ⅥA');
    assert.equal(groupLabel(3), 'ⅢB');
    assert.equal(groupLabel(8), 'Ⅷ');
    assert.equal(groupLabel(9), 'Ⅷ');
    assert.equal(groupLabel(10), 'Ⅷ', '8/9/10 三列同属 Ⅷ 族');
    assert.equal(groupLabel(18), '0', '第 18 列须兼容人教版「0 族」');
    // 字形覆盖：Space Grotesk 不含 U+2165 → 会回退到不同源字体；族标签须走含该字形的 --f-serif
    assert.match(pt, /font-bold serif-font text-\[var\(--fg\)\] leading-tight">\{selGroup\?\.main/, '族标签须走 --f-serif（mono 缺罗马数字字形）');
    assert.match(pt, /font-semibold serif-font">\{heroData\.gd\.main\}/, '展台族标签同样须走 --f-serif');
  });

  test('⑫ 详情卡内解释性注释一律正体（斜体只留给强调/引文）', () => {
    // 弹窗内曾有三段长斜体小字（中子估算说明 / IUPAC 原子量 / 发现史免责），造成整屏斜体轰炸
    const from = pt.indexOf('可滚动内容主体');
    const to = pt.indexOf('问 AI：看完元素详情后可一键提问');
    assert.ok(from > 0 && to > from && to - from > 1000, '须能定位到详情卡滚动主体');
    assert.doesNotMatch(pt.slice(from, to), /italic/, '详情卡内不得再出现斜体小字（须为正体）');
    // 高中拓展改为紧凑通知徽章条（正体标签 + 无左侧长竖线）
    assert.ok(pt.includes("{lang === 'zh' ? '高中拓展' : 'Extension'}"), '高中拓展须改为徽章标签条');
    assert.doesNotMatch(
      pt,
      /border-l-2 border-\[var\(--border\)\] pl-2">\s*\{lang === 'zh'\s*\?\s*'高中拓展'/,
      '高中拓展不得再沿用左侧长竖线段落形态',
    );
  });

  test('⑬ 详情卡顶部锚定：切 Tab 时弹窗头部与 Tab 栏绝对静止', () => {
    // 根因：外框与 overlay 原为 items-center + 高度随内容变化 → 垂直居中重算导致整框上下跳。
    // 改前实测（1280×1100）：面板 top 66 → 172 → 66，跳幅 106px = 高度差 212px 的一半。
    const ov = pt.match(/className="fixed inset-0 z-50 flex ([^"]+)"/);
    assert.ok(ov, '须能定位弹窗 overlay');
    assert.match(ov[1], /items-start/, 'overlay 须顶部锚定（items-start），避免居中重算');
    assert.doesNotMatch(ov[1], /items-center/, 'overlay 不得垂直居中（内容高度变化会带动整框重排）');
    assert.match(ov[1], /overflow-y-auto/, 'overlay 须可滚动，兜底极矮视口');
    const panel = pt.match(/className="relative w-full max-w-sm sm:max-w-md ([^"]+)"/);
    assert.ok(panel, '须能定位弹窗外框');
    assert.match(
      panel[1],
      /max-h-\[calc\(100dvh-1rem\)\] sm:max-h-\[calc\(100dvh-2rem\)\]/,
      '外框 max-h 须与 overlay 的 p-2/p-4 对齐（顶边固定、底边仍留同距）',
    );
    assert.doesNotMatch(panel[1], /92dvh|88dvh/, '外框不得再用与 padding 脱钩的 92dvh / 88dvh');
    assert.match(panel[1], /flex flex-col/, '外框须为纵向 flex，内容区才能独立滚动');
    assert.match(pt, /flex-1 overflow-y-auto[^"]*space-y-3/, '内容区须 flex-1 承载剩余高度（头部与 Tab 栏不动）');
  });

  test('⑭ 检索栏无外框无静态标题，且类别图例不在 ≥sm 重复', () => {
    // ① 检索栏：无卡片包裹（无 card-bg / 无内边距），标题已移除
    assert.ok(
      !pt.includes('mb-5 border border-[var(--border)] bg-[var(--card-bg)] p-3 space-y-3'),
      '检索区卡片外框须已移除（不再有 border + card-bg + p-3 包裹）',
    );
    assert.ok(!pt.includes("{lang === 'zh' ? '检索元素' : 'Search'}"), '「检索元素」静态标题须已移除');
    assert.match(
      pt,
      /className="relative mb-3 sm:mb-5 w-full sm:max-w-xs border border-\[var\(--border-strong\)\] rounded-lg transition-colors focus-within:border-\[var\(--accent\)\]"/,
      '边框与聚焦态须由外层容器唯一定义（且不含 card-bg / 内边距）',
    );
    // ② 输入框：零边框零轮廓（边框交给外层），前置轻量 Search 图标；placeholder 与无障碍名保留
    assert.match(pt, /<Search\s[\s\S]{0,150}?absolute left-2\.5 top-1\/2 -translate-y-1\/2/, '输入框前须有轻量 Search 图标');
    const inputCls = (pt.match(/className="min-h-10 w-full ([^"]+)"/) ?? ['', ''])[1];
    assert.ok(inputCls.includes('border-none'), '内层 input 须 border-none');
    assert.ok(inputCls.includes('outline-none') && inputCls.includes('focus:ring-0'), '内层 input 须 outline-none + focus:ring-0');
    assert.doesNotMatch(inputCls, /(^|\s)border(\s|$)/, '内层 input 不得再带 border 宽度类（会与外层叠加成双层框）');
    assert.doesNotMatch(inputCls, /border-\[/, '内层 input 不得再带任意边框色类');
    assert.match(
      pt,
      /style=\{\{ outline: 'none' \}\}/,
      '须补内联 outline:none —— index.css 的全局 :focus-visible 在 @layer 之外会盖过分层 outline-none，光有工具类挡不住',
    );
    assert.match(pt, /placeholder=\{lang === 'zh' \? '输入元素符号或中文名，如 H \/ 氢'/, 'placeholder 提示须保留');
    assert.match(pt, /aria-label=\{lang === 'zh' \? '检索元素' : 'Search elements'\}/, '去掉可见标题后须补上无障碍名');
    // ③ 单层边框不变量：整个检索组件里「自带边框」的元素必须恰好一个（外层容器）
    const widget = pt.slice(
      pt.indexOf('relative mb-3 sm:mb-5 w-full sm:max-w-xs'),
      pt.indexOf('类别图例：只在 <640px 保留'),
    );
    assert.ok(widget.length > 120, '须能切出检索组件');
    const bordered = widget.match(/(?:^|\s)border(?=\s|")/g) ?? [];
    assert.equal(bordered.length, 1, `检索组件内自带边框的元素须恰 1 个（实测 ${bordered.length}）`);
    assert.doesNotMatch(widget, /border-\[var\(--border\)\]/, '检索组件内不得再出现 --border 边框（弱于 --border-strong，且会与外层叠加）');
    // ④ 类别图例：≥sm 唯一来源是中央展台；检索框下方那处只兜底小屏
    const searchLegend = pt.match(/className="mb-5 flex flex-wrap gap-4 text-\[0\.625rem\] mono-font text-\[var\(--muted\)\]([^"]*)"/);
    assert.ok(searchLegend, '须能定位检索框下方的兜底图例');
    assert.match(searchLegend[1], /sm:hidden/, '兜底图例须只在 <640px 出现（≥sm 与中央展台重复）');
    assert.ok(pt.includes("{isZh ? '分类图例' : 'LEGEND'}"), '中央展台须保留分类图例（≥sm 的唯一来源）');
    assert.match(
      pt,
      /pointer-events-none absolute left-\[28px\] right-\[3px\] top-0 hidden sm:grid/,
      '展台须在 <640px 折叠——这正是小屏仍需兜底图例的原因',
    );
    // 两份图例同源：都必须走 CAT_COLOR，不得各写一套色值
    const renders = pt.match(/Object\.keys\(CAT_COLOR\) as ElementInfo\['cat'\]\[\]\)\.map\(/g) ?? [];
    assert.equal(renders.length, 2, `类别图例须恰好两处渲染点且都走 CAT_COLOR（实测 ${renders.length} 处）`);
  });

  test('⑮ 检索命中驱动中央展台预览：与悬停共用同一套渲染', () => {
    // ① 焦点元素 = 悬停优先，无悬停退回检索命中
    assert.match(
      pt,
      /const searchPreview = queryLower \? \(exactSymbol \?\? ELEMENTS\.find\(\(e\) => matchN\(e\)\) \?\? null\) : null;/,
      '须有「检索驱动的展台预览目标」',
    );
    assert.match(pt, /const heroFocus = heroEl \?\? searchPreview;/, '展台焦点须为「悬停优先、否则退回检索命中」');
    // ② 展台渲染区只认 heroFocus：直接读 heroEl 会让检索态根本不出现在展台上
    //    切片起点必须取在展台覆层容器处（早于两态透明度三元），否则判定不到默认图例态
    const dashboard = pt.slice(pt.indexOf('pointer-events-none absolute left-[28px] right-[3px]'));
    assert.ok(dashboard.length > 2000, '须能定位展台渲染区');
    assert.match(dashboard, /\/\/ \{isZh \? '分类图例' : 'LEGEND'\}/, '切片须覆盖默认图例态');
    assert.doesNotMatch(dashboard, /\bheroEl\b/, '展台渲染区不得再直接引用 heroEl（须统一走 heroFocus）');
    assert.match(dashboard, /heroFocus \? 'opacity-0' : 'opacity-100'/, '默认图例态须以 heroFocus 判定');
    assert.match(dashboard, /heroData && heroFocus && \(/, '预览态须以 heroFocus 判定');
    // ③ 展台派生数据同样走 heroFocus；状态机仍保留 heroEl 存悬停
    assert.match(pt, /if \(!heroFocus\) return null;[\s\S]{0,40}const vt = valenceTendency\(heroFocus\)/, '展台派生数据须走 heroFocus');
    assert.match(pt, /const \[heroEl, setHeroEl\] = useState<ElementInfo \| null>\(null\)/, '悬停态存储须保留');
    assert.match(pt, /const previewOn = \(el: ElementInfo\) =>/, '悬停进入逻辑须保留');
    // ④ 行为级：复用页面同一套判定，验证「精确符号优先 / 否则按原子序数取首个命中」
    const pick = (q: string) => {
      const ql = q.trim().toLowerCase();
      if (!ql) return null;
      const exact = ELEMENTS.find((e) => e.symbol.toLowerCase() === ql);
      const hit = (e: ElementInfo) =>
        exact ? e.n === exact.n
          : e.symbol.toLowerCase().startsWith(ql) || e.zh.includes(ql) || e.en.toLowerCase().startsWith(ql);
      return exact ?? ELEMENTS.find(hit) ?? null;
    };
    assert.equal(pick(''), null, '空检索不得预览');
    assert.equal(pick('   '), null, '纯空白检索不得预览');
    assert.equal(pick('zzz'), null, '无命中不得预览');
    assert.equal(pick('H')?.n, 1, '「H」须精确命中氢（而非按前缀命中一堆 H 开头元素）');
    assert.equal(pick('fe')?.n, 26, '「fe」须精确命中铁');
    assert.equal(pick('He')?.n, 2, '「He」须精确命中氦');
    assert.equal(pick('氢')?.n, 1, '中文名须可命中氢');
    assert.equal(pick('氧')?.n, 8, '中文名须可命中氧');
    assert.equal(pick('Tellurium')?.n, 52, '英文名须可命中碲');
    // 前缀查询：按原子序数取首个命中（ELEMENTS 本身按 Z 升序）
    assert.ok((pick('c')?.n ?? 99) <= 6, `「c」应取 Z 最小的命中（实测 ${pick('c')?.symbol}）`);
  });

  // 异步用例优先用 testAsync 表达意图（运行器对两者一视同仁：返回 thenable 就会 await）。
  // 保持串行执行，避免并发用例互相替换 globalThis.fetch / window 造成随机失败。
  // ⑰ 侧边悬浮书签已废弃：AI 入口只留顶栏一处，横屏空间靠语言按钮的双断点腾出
  //    历史：AiSideTab 曾以 24×88 / 32×40 贴右常驻（滚动后页头消失，需要补一个常驻入口）。
  //    但它始终是页面右缘的异物——实测在 3 个实验里与「下一步 →」的右下角存在 5×10.6px 重叠。
  //    最终取舍：入口回归顶栏（页头滚走时用户本来也在阅读内容，不需要第二处唤起点）。
  test('⑰ 侧边书签不得回流：AI 入口仅顶栏一处，语言按钮按断点收成「中」', () => {
    const app = readSrc('src/App.tsx', 'utf8');
    const header = readSrc('src/components/layout/Header.tsx', 'utf8');
    const css = readSrc('src/index.css', 'utf8');
    // ① 组件文件与 hook 已删除，App 不再引用，CSS 不再留 selector
    assert.ok(!readExists('src/components/ai/AiSideTab.tsx'), 'AiSideTab.tsx 须已删除（不留死代码）');
    assert.ok(!readExists('src/lib/use-media-query.ts'), 'use-media-query.ts 仅服务于书签，须一并删除');
    assert.doesNotMatch(app, /AiSideTab/, 'App 不得再引用侧书签');
    assert.doesNotMatch(css, /ai-side-tab/, 'CSS 不得残留 .ai-side-tab 选择器');
    // ② AI 图标回归顶栏：整块挂载，移动端不得再隐藏
    assert.match(header, /<div className="relative flex items-center justify-center">/, 'AI 入口须恢复为整块常驻');
    assert.doesNotMatch(header, /relative hidden items-center justify-center sm:flex/, 'AI 入口不得再 hidden sm:flex');
    assert.match(header, /onClick=\{\(\) => setAiOpen\(!aiOpen\)\}/, '图标本体仍须开 AI 面板');
    // ③ 语言按钮双断点：移动端「中」，桌面「中文」；英文 EN 两档同形
    assert.match(
      header,
      /lang === 'zh' \? \(\s*<>\s*<span className="sm:hidden">中<\/span>\s*<span className="hidden sm:inline">中文<\/span>\s*<\/>\s*\) : \(\s*'EN'\s*\)/,
      '语言按钮须为「中 / 中文」双断点，英文恒 EN',
    );
    // ④ 互斥规则保留且只针对反馈气泡（书签那条 display:none 已随组件移除）
    assert.match(css, /html\.param-dock-open \.feedback-fab,\s*html\.ai-sheet-open \.feedback-fab \{[^}]*opacity: 0;[^}]*pointer-events: none/, '两种展开态须对反馈气泡用同一套淡出规则');
    const ai = readAiPanel();
    assert.match(ai, /cls\.add\('ai-sheet-open'\)/, 'AI 面板须继续把展开状态镜像到 <html>');
    // ⑤ 右簇仍是 gap-2 / sm:gap-4：5 个控件在 390 下单行
    assert.match(header, /gap-1\.5 sm:gap-4/, '顶栏右簇间距须为 gap-1.5 sm:gap-4（移动收紧、桌面冻结）');
    // ⑥ 返回链接移动端左对齐：`.tap-area` 的 justify-content:center 会把满宽盒里的内容居中
    //    （实测箭头落在 x=160，而标题图标在 x=24）。只能用 align-self 收窄盒宽——justify-*
    //    是未分层 CSS，工具类压不过它；`max-sm:` 前缀保证桌面盒宽与命中区一字未改。
    const back = readSrc('src/components/layout/BackLink.tsx', 'utf8');
    // 左缘规则取「盒对齐 x=24」：正文列、标题图标盒（w-12）、返回链接同一起点。
    // 不做墨迹补偿——15 个实验的图标墨迹在 31.3–42.3 之间浮动，单一 padding 对齐不了全部。
    assert.match(back, /tap-area max-sm:self-start sm:mt-3 sm:mb-6/, '返回链接须 max-sm:self-start（移动左对齐、桌面不变）');
    assert.doesNotMatch(back, /max-sm:pl-/, '不得用 padding 做逐实验的墨迹补偿（图形留白各不相同）');
    assert.match(back, /mt-2 mb-1 /, '返回链接移动端下外边距须收到 mb-1');
  });

  testAsync('⑯ 欢迎弹窗双 Tab、Header 帮助入口、AI 角标五态与多端响应式不变量', async () => {
    const wd = readSrc('src/components/ui/WelcomeDialog.tsx', 'utf8');
    const hd = readSrc('src/components/layout/Header.tsx', 'utf8');
    const app = readSrc('src/App.tsx', 'utf8');
    const i18n = readSrc('src/lib/i18n.ts', 'utf8');
    const panelSrc = readAiPanel();
    // ① 双 Tab 分段控件 + 初始分区入参（首开仍停在概览）
    assert.match(wd, /type WelcomeTab = 'overview' \| 'guide'/, '须定义两个分区');
    assert.match(wd, /initialTab = 'overview'/, '默认分区须为「实验室概览」（首开自动弹出）');
    assert.match(wd, /role="tablist"/, '须有 tablist');
    assert.match(wd, /data-welcome-tab=\{v\}/, 'Tab 须带 data-welcome-tab（供渲染量测）');
    assert.match(wd, /aria-selected=\{tab === v\}/, 'Tab 须带 aria-selected');
    // ② 弹性布局不变量：头 / Tab 栏 / 底栏常驻，内容区独立滚动
    //    高度上限用 dvh 而非 vh：移动端浏览器 UI 会伸缩，vh 会把底栏顶出屏幕
    assert.match(wd, /h-\[85dvh\] sm:h-\[620px\] flex flex-col/, '外框须为定高弹性约束（两页同高才能居中不跳位）');
    const shrink0 = wd.match(/flex-shrink-0/g) ?? [];
    assert.ok(shrink0.length >= 3, `顶部条 / Tab 栏 / 底栏须 flex-shrink-0 常驻（实测 ${shrink0.length} 处）`);
    // 垂直居中：外框已定为固定高度（两页同高），故居中不会重解位置；此前 max-h 下居中会顶动头部 98px
    assert.match(wd, /z-\[100\] flex items-center justify-center p-4/, 'overlay 须垂直居中');
    assert.doesNotMatch(wd, /items-start justify-center overflow-y-auto p-4/, 'overlay 不得再顶部锚定');
    // min-h 取 12rem：更大就可能在矮视口挤掉底栏（与「底栏永不越界」的要求冲突）
    assert.match(wd, /flex-1 overflow-y-auto[^"]*min-h-\[12rem\]/, '内容区须 flex-1 滚动 + 安全的 min-h');
    // ③ 4 条纵向流式导览行（微圆角图标徽标 + 标题 + 说明，含 hover 反馈）
    assert.match(wd, /flex items-center gap-3\.5 rounded-xl p-3 transition-colors hover:bg-\[var\(--accent-light\)\]\/50/, '导览须为纵向流式行');
    assert.match(wd, /h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-\[var\(--accent-light\)\]\/70/, '导览行须有微圆角图标徽标');
    for (let i = 1; i <= 4; i++) {
      assert.ok(wd.includes(`t.guideCard${i}Title`) && wd.includes(`t.guideCard${i}Desc`), `第 ${i} 条导览须齐备`);
    }
    // ③b 导览须横向覆盖三科，不得偏向单一学科（此前 4 条里 2 条都在讲元素周期表）
    const gdescs = i18n.match(/guideCard\dDesc:\s*'[^']*'/g) ?? [];
    assert.equal(gdescs.length, 8, `导览说明须 zh/en 各 4 条（实测 ${gdescs.length}）`);
    const zhDescs = gdescs.filter((s) => /[\u4e00-\u9fa5]/.test(s));
    for (const subj of ['数学', '物理', '化学']) {
      assert.ok(zhDescs.some((s) => s.includes(subj)), `导览须覆盖「${subj}」的玩法`);
    }
    assert.ok(
      zhDescs.some((s) => s.includes('预测') && s.includes('探索') && s.includes('结论')),
      '导览须交代「预测 → 探索 → 结论」三幕闭环',
    );
    const ptRows = gdescs.filter((s) => /周期表|periodic table/.test(s));
    // 同一条导览的 zh + en 各计一次 → 至多 1 条提及元素周期表（= 至多 2 条字符串）
    assert.ok(ptRows.length <= 2, `至多一条导览可提及元素周期表（实测 ${ptRows.length}/8 条命中）`);
    // ④ 触屏热区（本弹窗挂在 body 上，不吃 main button 的 40px 全局底线）
    //    移动端视觉减重：Tab 30px / 轨道 36px / 主按钮 36px + 12px 字；桌面（sm:）全部维持原样。
    //    Tab 挂 .tap-rail（上下各 +5px 透明扩区）而不是 .tap-area——后者把**视觉盒**撑到 40px，
    //    正是移动端「小字大壳」的来源；扩区必须落到伪元素上才只动命中不动版式。
    assert.match(wd, /tap-rail relative z-10 h-\[1\.875rem\] rounded-lg px-3 py-0 text-xs mono-font/, 'Tab 触屏须为 30px 视觉盒（命中由 .tap-rail 补）');
    assert.match(wd, /sm:h-9 sm:rounded-full sm:px-4 sm:py-1\.5/, 'Tab 桌面须维持 36px 胶囊（移动端减重不得外溢）');
    // 圆角同心：外轨 10px - 内边距 2px = 滑块 8px（内外同为 10px 时四角留白会显得挤）
    assert.match(wd, /rounded-\[0\.625rem\][^"]*p-0\.5 sm:rounded-full/, '轨道移动端圆角须为 10px');
    assert.doesNotMatch(wd, /tap-area relative z-10/, 'Tab 不得再用 .tap-area 撑高视觉盒');
    assert.match(wd, /w-11 h-11 text-\[var\(--muted\)\]/, '关闭 × 热区须 44×44');
    assert.match(wd, /transition-colors min-h-9 touch-manipulation rounded-md sm:min-h-11 sm:px-5 sm:text-sm/, '主按钮移动端 36px / 桌面 44px 两档');
    assert.match(wd, /gap-2 min-h-11 text-xs/, '「下次不再显示」须 ≥44px 热区');
    // ④b Tab：高级分段滑槽——轨道 + 等宽滑块（位移过渡），非孤悬灰块、非实心反色块
    assert.match(wd, /grid w-fit max-w-full grid-cols-2 items-center rounded-\[0\.625rem\] border border-\[var\(--border\)\]\/60 bg-\[var\(--accent-light\)\]\/60 p-0\.5 sm:rounded-full sm:p-1/, 'Tab 轨道须为等宽两格且移动端 36px');
    assert.match(wd, /absolute inset-y-0\.5 left-0\.5 w-\[calc\(50%-0\.125rem\)\] rounded-lg[^"]*sm:inset-y-1 sm:left-1 sm:w-\[calc\(50%-0\.25rem\)\] sm:rounded-full/, '须有等宽滑块（抬起面 + 位移过渡，桌面几何不变）');
    assert.match(wd, /transform: tab === 'overview' \? 'translateX\(0\)' : 'translateX\(100%\)'/, '滑块位移须由当前分区驱动');
    assert.doesNotMatch(wd, /bg-\[var\(--fg\)\] text-\[var\(--bg\)\]/, '激活 Tab 不得再用实心反色块');
    assert.doesNotMatch(wd, /flex-1 min-h-11/, 'Tab 不得再撑满整行（通栏）');
    // 明暗主题由 html.dark / :root:not(.light) 控制，Tailwind 的 dark 前缀变体只认 prefers-color-scheme
    // —— 手动切主题时会与站点脱节，故本文件禁用该变体（写法为 dark 前缀 + 冒号 + 工具类，中间无空格），一律走 var 令牌
    assert.doesNotMatch(wd, /dark:[^\s]/, '弹窗不得使用 dark 前缀变体（与手动主题切换脱节）');
    // ④c 定高弹性 + 去边框化 + 滚动安全
    assert.match(wd, /h-\[85dvh\] sm:h-\[620px\] flex flex-col/, '外框须为定高弹性约束（桌面封顶 620px）');
    // 滚动条落在 px-1 的外侧留白里；内容留白放在内层 mx-4，与外框 px-5 对齐（20px）
    assert.match(wd, /flex-1 overflow-y-auto px-1 pb-6 pt-1 min-h-\[12rem\]/, '内容区须 flex-1 滚动 + 外侧留白容下滚动条');
    assert.match(wd, /<div className="mx-4 space-y-3">/, '内容留白须放内层并与外框对齐');
    assert.match(wd, /border-t border-\[var\(--border\)\]\/60 px-5 pt-3/, '底栏须常驻且只留一条发丝分隔线');
    assert.doesNotMatch(wd, /border border-\[var\(--border\)\]\/70/, '内容块不得再挂灰色冷边框');
    assert.ok((wd.match(/rounded-xl bg-\[var\(--accent-light\)\]/g) ?? []).length >= 2, '内容块须用柔和填充（无灰边框）');
    // ④e 图标校准：学科徽标 36px 圆底 + 20px 图标（占比 55.6%）；π 与图标墨迹体量等重
    assert.match(
      wd,
      /h-9 w-9 shrink-0 items-center justify-center rounded-full border border-\[var\(--border\)\] bg-\[var\(--card-bg\)\] text-\[var\(--fg\)\] shadow-xs/,
      '学科徽标须为 36px 圆底 + 微投影 + 高对比字色',
    );
    assert.match(wd, /<div className="flex items-center gap-3">/, '徽标须与标题同行且中线对齐');
    assert.match(wd, /min-w-0 text-\[0\.6875rem\] mono-font font-bold tracking-widest/, '标题须紧跟徽标右侧');
    const w5 = wd.match(/className="w-5 h-5"/g) ?? [];
    assert.ok(w5.length >= 4, `学科/导览图标须统一 20px（实测 ${w5.length} 处）`);
    assert.match(wd, /subjectId="math" className="w-5 h-5"/, '数学图标须与物理/化学同为 20px 矢量图标');
    // 数学图标已从字体字形 π 换成 24 栅格矢量：字体字形横细竖粗、末端带弯钩，
    // 且字宽字重随字体与平台漂移，靠 font-bold 硬贴墨迹属补偿式对齐，三科永远凑不齐。
    const si = readSrc('src/components/ui/SubjectIcon.tsx', 'utf8');
    assert.doesNotMatch(si, /glyphClassName/, '学科图标不得再保留字体字形分支');
    assert.match(si, /viewBox="0 0 24 24"/, '数学图标须为 24 栅格矢量');
    assert.match(si, /strokeWidth=\{2\}/, '数学图标须为 2px 固定线宽');
    assert.match(si, /strokeLinecap="round"/, '数学图标须为圆头端点');
    // 物理动效（第二版）：轨道几何必须一动不动，运动落在「沿轨道跑的电子」上。
    // 第一版让两条轨道各自绕核反向自转——两环夹角连续变化，交叉点漂移、中心描边忽厚忽薄，
    // 36px 下像在扭动发糊，已废弃。这里锁死「不许回到逐环自转」。
    assert.doesNotMatch(si, /data-subject-part="orbit-[ab]"/, '原子轨道不得再分组自转（会破坏原子形态）');
    assert.match(si, /data-subject-part="electron-a"/, '每个环上须有一颗电子');
    assert.match(si, /data-subject-part="electron-b"/, '每个环上须有一颗电子');
    assert.match(si, /const ATOM_ORBIT_A = 'M20\.2 20\.2c/, '轨道路径须抽成常量');
    assert.match(si, /<path d=\{ATOM_ORBIT_A\}/, '轨道 <path> 须与电子共用同一路径常量');
    assert.match(
      si,
      /offsetPath: `path\("\$\{ATOM_ORBIT_A\}"\)`/,
      '电子须用 same-source 常量的 offset-path 定位（两份几何会漂移）',
    );
    assert.match(si, /opacity=\{0\}/, '电子默认不可见：非首页场景（弹窗/科目页/实验页）不得出现多余圆点');
    const cssSrc2 = readSrc('src/index.css', 'utf8');
    assert.match(cssSrc2, /@keyframes subject-electron-travel/, '电子行进须有 keyframes');
    assert.doesNotMatch(cssSrc2, /subject-orbit-cw|subject-orbit-ccw/, '逐环自转的关键帧须已删除');
    assert.match(cssSrc2, /electron-a'\] \{\s*opacity: 1;\s*animation: subject-electron-travel 2\.6s linear infinite;/, 'A 环电子 2.6s 正向');
    assert.match(cssSrc2, /electron-b'\] \{\s*opacity: 1;\s*animation: subject-electron-travel 3\.4s linear infinite reverse;/, 'B 环电子 3.4s 反向');
    assert.match(cssSrc2, /\[data-subject-part='electron-a'\],\s*\n\.home-subjects > button \[data-subject-part='electron-b'\] \{\s*opacity: 0;/, '电子默认 opacity 0（淡入而非突兀出现）');
    // 减动效：动效全关（π 描摹 / 电子行进 / 锥形瓶摆动）
    assert.match(
      cssSrc2,
      /\[data-subject-part='electron-a'\],\s*\n\s*\.home-subjects > button:hover \[data-subject-part='electron-b'\] \{\s*animation: none;/,
      '减动效下电子须停anim，不得留循环',
    );
    // ④d 底栏级底注：开源协议 / 作者 / 反馈 一行收敛 + 姊妹作品胶囊
    // 行距从 gap-y-2 提到 gap-y-4：这些链接挂着 ±8px 透明热区（tap-pad），
    // 窄屏换行时两行之间若只有 8px，上一行的下沿热区会压住下一行的上沿，
    // 实测 AGPL 与 mailto 相差 6px 时互相拦截、测得命中高只剩 21px（应为 32.5）。
    // 16px = 8+8 的最小不重叠间距。
    assert.match(wd, /justify-between gap-x-4 gap-y-4 px-0\.5 text-\[0\.6875rem\]/, '次级底注须为一行 justify-between，且换行行距 ≥16px');
    for (const k of ['welcomeLicenseLabel', 'welcomeFeedbackLabel']) {
      assert.ok(wd.includes(`t.${k}`), `底注须含 ${k}`);
    }
    assert.match(wd, /rounded-full bg-\[var\(--accent-light\)\]\/70 px-2\.5 py-1/, '姊妹作品须为紧凑胶囊');
    // 底注图标：邮箱带 Mail、Issue 只留 Gitee / GitHub 品牌图标（无夹字），姊妹作品带图标胶囊 + 数字角标
    assert.match(wd, /<Mail className="h-3 w-3 shrink-0"/, '邮箱前须有 Mail 图标');
    assert.match(wd, /<path d=\{GITEE_PATH\} \/>/, 'Issue 须带 Gitee 品牌图标');
    assert.match(wd, /<path d=\{GITHUB_PATH\} \/>/, '须带 GitHub 品牌图标');
    assert.doesNotMatch(wd, /welcomeFeedbackIssue/, '两个品牌图标之间不得再夹「Issue」文字');
    assert.doesNotMatch(i18n, /welcomeFeedbackIssue:/, 'i18n 不得再保留已被替换的 Issue 文案');
    assert.match(wd, /import \{ GITHUB_PATH, GITEE_PATH, ISSUE_URLS \} from '\.\.\/\.\.\/lib\/brand-icons'/, '品牌路径须走共享常量');
    assert.match(wd, /<Library className="h-3\.5 w-3\.5" aria-hidden="true" \/>/, '其他作品前须有作品集图标');
    // 作品名就紧跟在后，弹窗内不再挂数字角标（角标是页脚折叠入口才需要的计数提示）
    assert.doesNotMatch(wd, /min-w-\[0\.95rem\]/, '弹窗内的其他作品不得再挂数字角标');
    assert.doesNotMatch(wd, /bg-\[#C71D23\]/, '弹窗内不得出现品牌红角标');
    assert.match(wd, /<img src=\{w\.icon\} alt="" width="12" height="12" className="shrink-0 rounded-\[3px\] object-contain" \/>/, '姊妹作品胶囊须带图标');
    assert.doesNotMatch(wd, /welcomeMaintainPrefix|welcomeFeedbackBubbleA/, '多行开源/反馈大框须已彻底废除');
    // ⑤ Header 帮助入口串到 Tab 2
    assert.match(hd, /HelpCircle className="w-4 h-4"/, 'Header 须有 w-4 h-4 的 HelpCircle');
    assert.match(hd, /title=\{t.helpTitle\}/, '帮助按钮须有中英悬停 title');
    assert.match(hd, /onOpenGuide/, 'Header 须接收打开回调');
    assert.match(app, /setWelcomeTab\('guide'\)/, '帮助入口须把分区指到 guide');
    assert.match(app, /initialTab=\{welcomeTab\}/, 'App 须把分区传给弹窗');
    assert.match(app, /useState<'overview' \| 'guide'>\('overview'\)/, '初始分区须为 overview（首开不跳 Tab）');
    // ⑥ i18n 双语齐备 + 概览工具模块已同步 3D 能力
    for (const k of ['welcomeTabOverview', 'welcomeTabGuide', 'welcomeTabsAria', 'helpTitle', 'guideCard1Title', 'guideCard4Desc']) {
      const n = (i18n.match(new RegExp(`${k}:`, 'g')) ?? []).length;
      assert.equal(n, 2, `${k} 须 zh/en 各一份（实测 ${n}）`);
    }
    assert.ok(i18n.includes('3D 空间原子模型 · 实物展台 · 语音跟读'), '概览的工具模块文案须同步 3D 能力');
    assert.ok(i18n.includes('3D atom model · specimen dashboard · recite mode'), '英文概览同样须同步');
    // ⑥b 导语已移除：能力说明只在工具模块里讲一次，不得回潮成弹窗顶部的长段落
    assert.doesNotMatch(wd, /welcomeIntro/, '概览导语须已彻底移除（避免与四学科卡片重复）');
    assert.doesNotMatch(i18n, /welcomeIntro:/, 'i18n 不得再保留导语文案');
    for (const kw of ['微观 3D 空间原子模型', '实物展台', '语音跟读']) {
      assert.ok(i18n.includes(kw), `工具模块须包含关键能力「${kw}」`);
    }
    // ⑦ 指引页结构锁定为「4 张卡片 + 1 条底部提示」；多出来的重复块一律不得回潮
    assert.match(wd, /import \{[^}]*\bLightbulb\b[^}]*\} from 'lucide-react'/, '提示须用 Lucide Lightbulb');
    assert.ok(!/💡/.test(wd) && !/💡/.test(i18n), '不得用 Emoji 充当图标（项目仅用 Lucide）');
    assert.match(wd, /t\.guideTipLabel/, '须有单行提示');
    assert.match(wd, /t\.guideTipBody/, '须有单行提示正文');
    const stepRefs = (wd.match(/t\.guideStep\dTitle/g) ?? []).length;
    assert.equal(stepRefs, 0, `「探究方法」块须彻底删除（实测残留 ${stepRefs} 处引用）`);
    assert.doesNotMatch(wd, /guideMethodLabel/, '不得再渲染探究方法小标题');
    assert.doesNotMatch(i18n, /guideMethodLabel:|guideStep\d(Title|Desc):/, '不得再保留探究方法文案（导语已交代预测/探索/结论）');
    // ⑧ 事实口径 + 反重复：键盘说明不再出现在导览里（周期表详情卡自带 ← → 按钮），
    //    且不得再出现「全局方向键漫游」这类失实说法
    assert.doesNotMatch(i18n, /全局方向键/, '不得宣称周期表全局方向键漫游（实测仅详情卡内 ← →）');
    assert.doesNotMatch(i18n, /Arrow keys roam/, '英文同样不得宣称');
    const tipBodies = i18n.match(/guideTipBody:\s*'[^']*'/g) ?? [];
    assert.equal(tipBodies.length, 2, `单行提示须 zh/en 各一（实测 ${tipBodies.length}）`);
    for (const tb of tipBodies) {
      assert.ok(!tb.includes('← →') && !/Esc|Arrow|←|→/.test(tb), `底部提示不得复述键盘键位：${tb.slice(0, 40)}…`);
    }
    // 导览第三条 = 工具/速查行（不再单独占用一条讲周期表键盘）
    assert.match(i18n, /guideCard3Title: '可视化展台与速查'/, '第三条须为「可视化展台与速查」');
    assert.match(i18n, /guideCard3Title: 'Visual dashboards & references'/, '英文同名');
    // ⑨ 净化开发/技术机制词：防作弊、防 Bug 说明一律不得留在面向学生的文案里
    for (const bad of ['防作弊', 'anti-cheat', '首末位', '不环绕', '上一个读音', 'pronunciation', 'cancelled']) {
      assert.ok(!i18n.includes(bad), `文案不得出现机制/开发词「${bad}」`);
    }
    for (const k of ['guideCard1Title', 'guideCard4Desc', 'guideTipLabel', 'guideTipBody']) {
      const n = (i18n.match(new RegExp(`${k}:`, 'g')) ?? []).length;
      assert.equal(n, 2, `${k} 须 zh/en 各一份（实测 ${n}）`);
    }

    /* ⑩ AI 连通性状态机 + 顶栏角标（旧版四态守卫并入此处，不新增用例数）
       ─────────────────────────────────────────────────────────────────────
       这一节守的是「角标说的话必须为真」：
       - 结论有时效（checkedAt + 24h），过期必须降级，不许拿旧绿冒充当前状态；
       - 置绿只能靠真实证据（/models 命中当前模型 或 chat 探针 200），列出模型不算；
       - 探针先便宜后昂贵（先 /models，0 token），并发去重，页面加载不发请求；
       - 形状表确定性：待验证/验证中用空心环，实心只用于已有结论的状态。 */
    {
      // ⑩a Header：图标开面板、角标单独开卡片（必须是兄弟按钮，不能嵌套 button）
      assert.equal((hd.match(/data-ai-health-trigger/g) ?? []).length, 1, '角标须有唯一可点入口');
      assert.equal((hd.match(/data-ai-health-card/g) ?? []).length, 1, '健康卡片须唯一');
      assert.match(hd, /onClick=\{\(\) => setAiOpen\(!aiOpen\)\}/, '图标本体仍须开 AI 面板');
      assert.match(
        hd,
        /<\/button>\s*\{!isOffline && shownStatus !== 'unconfigured' && \(\s*<button/,
        '角标须是图标按钮的**兄弟**按钮（嵌套 <button> 非法），且未配置时不得渲染',
      );
      // 未配置不渲染角标：没配置不是故障，不该占一个告警色小点
      assert.match(hd, /shownStatus !== 'unconfigured' && \(/, '未配置须整块不渲染角标');
      // F1：角标要有 title（桌面悬停即得一句话；此前只有 aria-label，桌面零提示）
      assert.match(hd, /title=\{`\$\{HEALTH_TITLE\[shownStatus\]\[lang\]\} · \$\{aiCheckedAtLabel/, '角标须有动态 title（状态 + 上次检测）');
      // F2：标准 Badge —— 16×16 盒贴在字形右上角（压住一角），旧的「抬到 -26px 悬空」不得回归
      assert.match(
        hd,
        /absolute right-0 top-0 z-10 grid h-4 w-4 place-items-center rounded-full/,
        '角标须贴合成标准 Badge（16×16，落在图标右上角内）',
      );
      assert.doesNotMatch(hd, /-top-\[26px\]/, '旧的悬空 26px 定位不得回归（圆点会飘离图标）');
      // F3：角标不得盖住字形右上角**自己的那个点**。
      // Lucide Sparkles 在字形右上角本就有墨迹（一条十字短线，含描边约 x∈20.91..24.42、
      // y∈11.58..15.08，按钮坐标）。旧实现把圆点圆心放在字形拐角 (25,11) → 距该墨迹只有
      // 0.82px：圆点压掉 2.18px、2px 外环压掉 4.18px（桌面 1280 实测）。现改为右 1px / 上 2px
      // （圆心 (29,6)）：环外缘留 2.22px、圆点本体留 4.22px；两端都仍在 16×16 盒内 —— 盒未动，
      // 因此 header 高度不变（「不为了挪点而撑高顶栏」）。
      assert.match(hd, /translate-x-\[1px\] -translate-y-\[2px\]/, '角标圆点须让开字形右上角那条十字墨迹（右 1px / 上 2px）');
      assert.doesNotMatch(hd, /-translate-x-\[3px\]|translate-y-\[3px\]/, '旧的 -3/+3 内收会盖住图标自己的点，不得回归');
      assert.doesNotMatch(hd, /grid h-9 w-9 place-items-(end|center) rounded-full/, '命中盒不得再撑到 36×36（会吞掉图标中心）');
      // 几何不许吞掉图标中心：盒下沿 16 < 字形中心 18，图标中心仍归图标按钮
      assert.match(hd, /flex h-9 w-9 items-center justify-center rounded-lg/, '图标按钮须 36×36');
      // 形状与配色统一走 shownStatus（过期即降级的展示态），不再是裸 status：
      // 角标只要还读裸 status，「卡片写着已过期、角标却说已就绪」就会重现。
      assert.match(hd, /isHollowStatus\(shownStatus\) \?/, '形状须由状态机统一判定（isHollowStatus）');
      assert.match(hd, /AI_STATUS_HOLLOW\[shownStatus\]/, '空心环类名须来自 AI_STATUS_HOLLOW');
      assert.match(hd, /AI_STATUS_DOT\[shownStatus\]/, '实心点类名须来自 AI_STATUS_DOT');
      // 过期降级：valid/invalid 超出 24h TTL 后按「待验证」渲染，且不再复述过期原因。
      // verifying 刻意不参与降级——它沿用上一次的 checkedAt，那不是过期结论，
      // 若一并降级，「验证中」的呼吸环会被吞掉。
      assert.match(
        hd,
        /checkedStale && \(aiStatus\.status === 'valid' \|\| aiStatus\.status === 'invalid'\)/,
        '过期结论须降级为「待验证」（渲染期按 isStatusFresh 复核）',
      );
      assert.equal((hd.match(/AI_STATUS_LABEL\[shownStatus\]/g) ?? []).length, 1, '悬浮提示须用展示态');
      assert.match(hd, /!expiredConclusion && aiStatus\.detail !== ''/, '过期后不得复述 24 小时前的失败原因');
      // 过期判定在渲染期做，就必须有一次「到点重渲染」的触发，否则标签页开着不动的角标会一直停在旧绿
      assert.match(hd, /at \+ AI_STATUS_TTL_MS - Date\.now\(\)/, 'TTL 到点须一次性重渲染（定时器，不是轮询）');
      // 跨标签同步：storage 是唯一能听见「别的标签改了配置 / 写了新结论」的通道
      const statusSrc = readSrc('src/lib/ai-status.ts', 'utf8');
      assert.match(statusSrc, /addEventListener\('storage'/, '状态须跨标签同步（storage 事件）');
      assert.match(
        statusSrc,
        /refreshAiStatus\(m\.loadAiConfig\(\)\)/,
        '跨标签重算须复用 loadAiConfig（动态 import 断开 ai-config ↔ ai-status 环）',
      );
      // 会话级静默自检 + 轮询：没有它们，角标会停在旧结论上，用户还得出手动点「重新验证」
      assert.match(statusSrc, /export function runSessionProbe\(\): void/, '须导出会话自检入口（可测）');
      assert.match(statusSrc, /if \(isStatusFresh\(snapshot\.checkedAt\)\) return;/, '结论仍新鲜时不得联网');
      assert.match(statusSrc, /window\.sessionStorage\.getItem\(SESSION_PROBE_KEY\)/, '每标签页会话只探一次（sessionStorage 打标）');
      assert.match(statusSrc, /void verifyAiStatus\(cfg, \{ auto: true \}\)/, '自检须走 auto 探针（单次、无重试、失败不落盘）');
      assert.match(
        statusSrc,
        /typeof document !== 'undefined'[\s\S]{0,200}document\.readyState === 'complete'/,
        '自检须等 load 再跑，且只在真实浏览器里调度（测试环境不得被定时器偷偷联网）',
      );
      // 轮询：可见时定时重测，隐藏时不发；切回前台/网络恢复立即补测；静默不闪「验证中」
      assert.match(statusSrc, /export const AI_POLL_HEALTHY_MS = 5 \* 60 \* 1000/, '健康时轮询须为 5 分钟（稀疏）');
      assert.match(statusSrc, /export const AI_POLL_BROKEN_MS = 45 \* 1000/, '非健康时轮询须为 45 秒（勤快）');
      // 退避：坏状态不许用固定 45s 死磕用户端点（挂机一节课 ≈ 60 次失败请求）
      assert.match(statusSrc, /export const AI_POLL_MAX_BREAK_MS = 5 \* 60 \* 1000/, '退避须封顶 5 分钟');
      assert.match(statusSrc, /export function nextPollDelayMs\(\): number/, '退避须是可用纯函数（可测）');
      assert.match(statusSrc, /const factor = 2 \*\* Math\.min\(failedProbes, AI_POLL_BACKOFF_STEPS\)/, '退避须按 2 倍指数增长');
      assert.match(statusSrc, /export function resetPollBackoff\(\): void/, '退避须可复位');
      assert.match(statusSrc, /if \(!opts\?\.silent\) resetPollBackoff\(\)/, '手动验证须复位退避');
      assert.match(statusSrc, /if \(reason !== 'interval'\)[\s\S]{0,220}resetPollBackoff\(\)/, '切回前台/网络恢复须复位退避');
      assert.match(statusSrc, /if \(result === 'valid'\) failedProbes = 0/, '探到绿须复位退避');
      assert.match(statusSrc, /export async function pollAiStatus\(/, '须导出可测的轮询入口');
      assert.match(statusSrc, /navigator\.onLine === false\) return null/, '离线时不得轮询（会把「端点不通」与「整机没网」混成一个红点）');
      assert.match(statusSrc, /document\.visibilityState === 'visible'[\s\S]{0,80}pollAiStatus\('interval'\)/, '仅在页面可见时定时轮询');
      assert.match(statusSrc, /addEventListener\('visibilitychange'[\s\S]{0,120}pollAiStatus\('visible'\)/, '切回前台须立即补测');
      assert.match(statusSrc, /addEventListener\('online'[\s\S]{0,60}pollAiStatus\('online'\)/, '网络恢复须立即补测');
      assert.match(statusSrc, /if \(inFlight\) return null;/, '轮询不得与在途验证叠请求');
      assert.match(statusSrc, /if \(!opts\?\.silent\) emit\(\{ status: 'verifying'/, '轮询须静默：不得每隔几分钟闪一次「验证中」');
      assert.match(statusSrc, /verifyAiStatus\(cfg, \{ silent: true \}\)/, '轮询探测须用 silent 模式');
      // 卡片六项：状态标题 / 模型 / 端点 / 上次检测 / 重新验证 / 去设置，缺一项就等于把用户又推回设置页
      for (const kw of ['模型', 'Endpoint', '上次检测', '重新验证', '去设置']) {
        assert.ok(hd.includes(kw), `健康卡片须含「${kw}」`);
      }
      assert.match(hd, /verifyAiStatus\(loadAiConfig\(\)\)/, '「重新验证」须就地调用 verifyAiStatus（读已保存配置）');
      assert.match(hd, /disabled=\{aiStatus\.status === 'verifying'\}/, '验证中须禁用按钮，避免叠请求');
      assert.match(hd, /onClick=\{\(\) => \{ setShowHealth\(false\); openSettings\(\); \}\}/, '「去设置」须直接落到设置视图');
      assert.match(hd, /aiCheckedAtLabel\(aiStatus\.checkedAt, lang\)/, '须显示「多久以前检测」');
      assert.match(hd, /checkedStale &&/, '过期须显式标注（不能只显示「3 天前」让人误以为有效）');
      assert.match(hd, /AI_STATUS_DETAIL\[aiStatus\.detail\]\[lang\]/, 'invalid 须给出可排查的原因');

      // ⑩b AiAssistant：面板首开静默验证；列出模型绝不置绿
      assert.match(panelSrc, /verifyAiStatus\(config, \{ auto: true \}\)/, '面板首开须静默验证一次（auto 模式）');
      assert.match(panelSrc, /settingsSignal > 0/, '「去设置」信号须被面板消费');
      assert.doesNotMatch(
        panelSrc,
        /ids\.length > 0 && formMatchesSaved && config\) reportAiSuccess/,
        '获取模型成功后不得置绿：/models 只证明凭证与端点通，不证明模型能对话',
      );

      // ⑩g 服务商胶囊：去括号后缀 + 品牌微标 + 中英双标签 + 等高不折行
      // （并入本用例，不新增用例数）
      {
        const cfgSrc = readSrc('src/lib/ai-config.ts', 'utf8');
        const block = cfgSrc.slice(cfgSrc.indexOf('export const AI_PROVIDERS'), cfgSrc.indexOf('/** 服务商显示名的唯一取法'));
        // 名称行单独取：note 里合法的括号（如「（自建代理）」）不算违规
        const names = [...block.matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
        const namesEn = [...block.matchAll(/nameEn: '([^']+)'/g)].map((m) => m[1]);
        // 括号里塞公司名（阿里云 / 月之暗面 / 火山方舟）会让胶囊长短不齐、窄屏折行，
        // 且与旁边的品牌 logo 重复表达同一件事——名称行一律禁止括号。
        for (const n of names) {
          assert.doesNotMatch(n, /[（）()]/, `服务商中文名「${n}」不得含括号后缀`);
        }
        for (const bad of ['阿里云', '月之暗面', '火山方舟', '深度求索']) {
          assert.ok(!names.some((n) => n.includes(bad)), `服务商名称不得再含「${bad}」这类公司名`);
        }
        assert.equal(names.length, 6, `6 个服务商都须有中文名（实测 ${names.length}）`);
        assert.equal(namesEn.length, 6, '每个服务商都须有英文名（en-US 用商标写法）');
        for (const n of ['DeepSeek', '通义千问 Qwen', 'Kimi', '智谱 GLM', '豆包 Doubao', '自定义']) {
          assert.ok(names.includes(n), `中文名须为「${n}」`);
        }
        for (const n of ['DeepSeek', 'Qwen', 'Kimi', 'Zhipu GLM', 'Doubao']) {
          assert.ok(namesEn.includes(n), `英文名须为「${n}」`);
        }
        assert.match(cfgSrc, /export function providerLabel\(p: AiProvider, lang: 'zh' \| 'en'\): string/, '须有唯一的取名函数，避免两处各写一套');

        // 运行时不变式（源码断言抓不到这类错）：每个真实服务商的 id 都要能落到一个品牌标上。
        // 曾经踩过：图标表按品牌名建键（qwen/kimi/doubao），而 providerId 是平台名
        // （dashscope/moonshot/volcengine），查不到就静默退化成插头——界面"有图标"，全是同一个插头。
        for (const p of AI_PROVIDERS) {
          if (p.id === 'custom') continue;
          assert.ok(PROVIDER_ICON_KEY[p.id], `服务商 ${p.id} 缺品牌标映射（会静默退化成插头）`);
        }
        assert.equal(PROVIDER_ICON_KEY.dashscope, 'qwen', '通义千问的 id 是 dashscope，品牌标是 qwen');
        assert.equal(PROVIDER_ICON_KEY.moonshot, 'kimi', 'Kimi 的 id 是 moonshot，品牌标是 kimi');
        assert.equal(PROVIDER_ICON_KEY.volcengine, 'doubao', '豆包的 id 是 volcengine，品牌标是 doubao');
        assert.equal(PROVIDER_ICON_KEY.custom, undefined, '自定义端点没有品牌标，须走插头');
        // 中英取名：中文含中文前缀，英文是商标写法（且不再带括号）
        const byId = Object.fromEntries(AI_PROVIDERS.map((p) => [p.id, p as AiProvider]));
        assert.equal(providerLabel(byId.dashscope, 'zh'), '通义千问 Qwen');
        assert.equal(providerLabel(byId.dashscope, 'en'), 'Qwen');
        assert.equal(providerLabel(byId.zhipu, 'en'), 'Zhipu GLM');
        assert.equal(providerLabel(byId.volcengine, 'zh'), '豆包 Doubao');

        // 官方入口链接：跟着服务商走，且必须指向厂商自己的域名。
        // 为什么钉域名：这类链接最容易在"顺手补一个"时变成第三方教程站，
        // 而学生点进去要的是申请 Key 的地方，不是别人的博客。
        const DOC_HOSTS: Record<string, string> = {
          deepseek: 'platform.deepseek.com',
          dashscope: 'bailian.console.aliyun.com',
          moonshot: 'platform.moonshot.cn',
          zhipu: 'open.bigmodel.cn',
          volcengine: 'console.volcengine.com',
        };
        for (const [id, host] of Object.entries(DOC_HOSTS)) {
          const url = byId[id]?.docUrl;
          assert.ok(url, `服务商 ${id} 须有官方 Key 申请入口（docUrl）`);
          assert.ok(url.startsWith('https://'), `${id} 的 docUrl 必须是 https`);
          assert.ok(url.includes(host), `${id} 的 docUrl 须指向官方域名 ${host}（实测 ${url}）`);
        }
        assert.equal(byId.custom?.docUrl, undefined, '自定义端点没有官方入口，不得硬指一个官网');
        // 面板里必须真的渲染它（且新窗口打开、断开 opener）
        assert.match(panelSrc, /href=\{provider\.docUrl\}/, 'API Key 标签行须渲染官方入口');
        assert.match(panelSrc, /target="_blank"/, '官方入口须新窗口打开，不打断正在填的表单');
        assert.match(panelSrc, /rel="noopener noreferrer"/, '外链须断 opener');

        // 品牌微标：单色 currentColor、24 栅格、无 hex；自定义端点退化为插头
        const icoSrc = readSrc('src/components/ui/ProviderIcon.tsx', 'utf8');
        assert.match(icoSrc, /viewBox="0 0 24 24"/, '品牌标须为 24 栅格');
        assert.match(icoSrc, /fill="currentColor"/, '品牌标须继承文字色（不写死品牌色）');
        for (const id of ['deepseek', 'qwen', 'kimi', 'zhipu', 'doubao']) {
          assert.ok(icoSrc.includes('  ' + id + ': ['), `须内联 ${id} 的品牌标`);
        }
        // 智谱：官方现行标是几何折线 Z（z.ai 站内 logo / open.bigmodel.cn favicon 同一造型）。
        // lobehub 的 `zhipu.svg` 是旧版「点阵星簇」，现行品牌里没有这个东西，不得复活。
        assert.ok(icoSrc.includes('M12.105 2L9.927 4.953H.653L2.83 2h9.276z'), '智谱须用官方几何 Z 标（zai.svg 轮廓）');
        assert.ok(!icoSrc.includes('M9.671 5.365'), '智谱旧的点阵星簇标已废弃，不得再内联');
        assert.match(icoSrc, /<Plug /, '自定义端点无品牌标，须退化为插头而不是空白');
        assert.doesNotMatch(icoSrc, /#[0-9a-fA-F]{3,6}\b/, '品牌标不得硬写 hex 颜色（品牌色一律走 --brand-* 令牌）');
        // 品牌色：logo 默认仍继承 --muted，只在悬停 / 已选时点亮（令牌定义在 index.css，两套明暗取值）
        const cssBrand = readSrc('src/index.css', 'utf8');
        // 智谱官方标是纯黑白，所以它不染品牌色、直接继承 --fg；其余四家必须是实色
        for (const b of ['deepseek', 'qwen', 'kimi', 'doubao']) {
          assert.match(cssBrand, new RegExp(`--brand-${b}: #[0-9a-f]{6};`), `须定义 --brand-${b}（浅色实色）`);
        }
        assert.match(
          cssBrand,
          /--brand-zhipu: var\(--fg\);/,
          '智谱官方标是黑白，须继承 --fg 而不是编一个蓝（编出来会和另外三家蓝撞色）',
        );
        const brandDark = cssBrand.match(/html\.dark \{[\s\S]*?--brand-deepseek: (#[0-9a-f]{6})/)?.[1];
        const brandLight = cssBrand.match(/--brand-deepseek: (#[0-9a-f]{6})/)?.[1];
        assert.ok(brandDark && brandLight && brandDark !== brandLight, '品牌色须有暗色另一档（深蓝压暗底会发黑）');

        // 五个品牌色必须真的分得开。旧版是 #1766e9 / #3655ff / #3370ff 三条几乎同色的蓝
        // （色相跨度 13°），16px 下就是三块一样的方块——这里把跨度钉死，防回归。
        const hueOf = (hex: string) => {
          const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
          const mx = Math.max(...v);
          const mn = Math.min(...v);
          if (mx === mn) return 0;
          const d = mx - mn;
          const h = mx === v[0] ? (v[1] - v[2]) / d + (v[1] < v[2] ? 6 : 0) : mx === v[1] ? (v[2] - v[0]) / d + 2 : (v[0] - v[1]) / d + 4;
          return h * 60;
        };
        const lightBrands = ['deepseek', 'qwen', 'kimi', 'doubao'].map(
          (b) => cssBrand.match(new RegExp(`^  --brand-${b}: (#[0-9a-f]{6});`, 'm'))?.[1] as string,
        );
        assert.ok(lightBrands.every(Boolean), '四个实色品牌色须写在 :root 首列');
        const hues = lightBrands.map(hueOf);
        assert.ok(
          Math.max(...hues) - Math.min(...hues) >= 40,
          `品牌色色相跨度只有 ${Math.round(Math.max(...hues) - Math.min(...hues))}°，16px 下会糊成同一色：${lightBrands.join(' ')}`,
        );
        assert.match(panelSrc, /ai-provider-chip tap-ai-chip tap-area inline-flex h-7/, '胶囊须带 .ai-provider-chip 钩子（.tap-ai-chip 负责触屏减重）');
        assert.match(panelSrc, /data-brand=\{p\.id\}/, '胶囊须带 data-brand（悬停品牌色的唯一依据）');
        assert.match(panelSrc, /const PROVIDER_BRAND_CLS: Record<string, string> = \{/, '须有品牌色表（完整字面量）');
        // 悬停品牌色走普通 CSS（Tailwind group-hover 变体实测不生效）
        assert.match(cssBrand, /\[data-brand='deepseek'\]:hover svg \{ color: var\(--brand-deepseek\); \}/, '须按 data-brand 写悬停品牌色');
        assert.match(panelSrc, /active \? brand : ''/, '未选态图标不写颜色，交给继承 + 悬停规则');
        // 反例：图标上若写死 --muted，会与悬停规则同层竞争并把品牌色压死
        assert.doesNotMatch(panelSrc, /transition-colors \$\{active \? brand : 'text-\[var\(--muted\)\]'\}/, '未选态不得在图标上写死 --muted');

        // 胶囊：h-7 等高 + whitespace-nowrap 不折行 + rounded-full + 14px 图标
        assert.match(
          panelSrc,
          /inline-flex h-7 items-center justify-center gap-1\.5 whitespace-nowrap rounded-full border px-2\.5/,
          '服务商须为等高胶囊，且单行不折',
        );
        assert.match(panelSrc, /className=\{`h-4 w-4 shrink-0 transition-colors \$\{active \? brand/, '须渲染 16px 品牌标');
        assert.match(panelSrc, /<span>\{providerLabel\(p, lang\)\}<\/span>/, '胶囊文字须走 providerLabel');
        assert.match(panelSrc, /aria-pressed=\{active\}/, '胶囊须暴露选中态');
        assert.ok(panelSrc.includes('API Key (${providerLabel(provider, lang)})'), 'API Key 标签须带上当前服务商名');
        // 未激活 --muted / 激活 --fg：颜色只走令牌，随主题自适应
        assert.match(panelSrc, /border-transparent text-\[var\(--muted\)\]/, '未选中须用 --muted');
        assert.match(panelSrc, /bg-\[var\(--accent-light\)\] text-\[var\(--fg\)\] font-medium/, '选中须用 --fg 加粗');
      }

      // ⑩c 纯函数：时效判定（含未来时间戳）
      const now = Date.UTC(2026, 9, 20, 12, 0, 0);
      assert.equal(isStatusFresh(now - 1000, now), true, '刚刚检测过须算新鲜');
      assert.equal(isStatusFresh(now - AI_STATUS_TTL_MS, now), true, '恰好 24h 边界内仍算新鲜');
      assert.equal(isStatusFresh(now - AI_STATUS_TTL_MS - 1, now), false, '超过 24h 必须判过期');
      assert.equal(isStatusFresh(null, now), false, '从未检测不算新鲜');
      assert.equal(isStatusFresh(now + 60000, now), false, '未来时间戳不可信（改时钟/漂移）');
      assert.equal(AI_STATUS_TTL_MS, 24 * 60 * 60 * 1000, 'TTL 须为 24 小时');

      // ⑩d 形状/文案表：五态齐备，空心只给「结论未定」
      const statuses = ['unconfigured', 'configured', 'verifying', 'valid', 'invalid'] as const;
      for (const s of statuses) {
        assert.ok(AI_STATUS_LABEL[s]?.zh && AI_STATUS_LABEL[s]?.en, `状态 ${s} 须中英文案齐备`);
      }
      assert.equal(AI_STATUS_DOT.configured, '', '待验证不得再渲染实心点');
      // 未配置不再占角标：语义上是空态，不是故障（旧版用 --warn，浅色下与红难分）
      assert.equal(AI_STATUS_DOT.unconfigured, '', '未配置不得渲染角标');
      assert.ok(AI_STATUS_HOLLOW.configured.includes('border-2'), '待验证须为空心环（border-2）');
      assert.ok(AI_STATUS_HOLLOW.configured.includes('border-[var(--muted)]'), '空心环须走中性灰 --muted');
      assert.doesNotMatch(
        AI_STATUS_HOLLOW.configured + AI_STATUS_HOLLOW.verifying + AI_STATUS_DOT.unconfigured,
        /--warn/,
        '角标不得再用琥珀：浅色主题下与红仅差 21° 色相、1 单位明度，无法区分「未验证」与「不通」',
      );
      assert.ok(AI_STATUS_HOLLOW.verifying.includes('motion-safe:animate-pulse'), '验证中须有尊重 reduced-motion 的呼吸');
      assert.equal(isHollowStatus('configured'), true);
      assert.equal(isHollowStatus('verifying'), true);
      assert.equal(isHollowStatus('valid'), false, '已就绪须是实心（有确定结论）');
      assert.equal(isHollowStatus('invalid'), false);
      for (const d of ['auth', 'notfound', 'model', 'network', 'rejected', 'server', 'badurl'] as const) {
        assert.ok(AI_STATUS_DETAIL[d]?.zh && AI_STATUS_DETAIL[d]?.en, `原因码 ${d} 须中英文案齐备`);
      }

      // ⑩e 人话时间
      assert.equal(aiCheckedAtLabel(null, 'zh'), '从未检测');
      assert.equal(aiCheckedAtLabel(now - 30000, 'zh', now), '刚刚');
      assert.equal(aiCheckedAtLabel(now - 5 * 60000, 'zh', now), '5 分钟前');
      assert.equal(aiCheckedAtLabel(now - 3 * 3600000, 'zh', now), '3 小时前');
      assert.equal(aiCheckedAtLabel(now - 3 * 86400000, 'en', now), '3 d ago');

      // ⑩f 运行时：真实跑一遍状态机（假 window.localStorage + 假 fetch）
      const g = globalThis as unknown as { window?: unknown; fetch: typeof fetch };
      const store = new Map<string, string>();
      const fakeWindow = {
        localStorage: {
          getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
          setItem: (k: string, v: string) => { store.set(k, v); },
          removeItem: (k: string) => { store.delete(k); },
        },
      };
      const prevWindow = g.window;
      const realFetch = g.fetch;
      const calls: string[] = [];
      let bodies: string[] = [];
      const mkRes = (status: number, body: unknown = {}) =>
        ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;
      const cfg = {
        providerId: 'custom',
        apiKey: 'test-key-placeholder-0000',
        baseUrl: 'https://api.example.com/v1',
        model: 'm1',
        agreed: true,
      };
      await (async () => {
        try {
          g.window = fakeWindow;
          g.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
            calls.push(String(url));
            bodies.push(String(init?.body ?? ''));
            return mkRes(200, { data: [{ id: 'm1' }, { id: 'm2' }] });
          }) as typeof fetch;

          // 未配置：不发请求
          refreshAiStatus(null);
          assert.equal(getAiStatus().status, 'unconfigured');
          assert.equal(calls.length, 0, '未配置时不得发任何请求');

          // 配置齐全但无结论 → 待验证；refresh 本身不联网（零轮询）
          refreshAiStatus(cfg);
          assert.equal(getAiStatus().status, 'configured');
          assert.equal(getAiStatus().checkedAt, null);
          assert.equal(calls.length, 0, 'refreshAiStatus 不得联网');

          // 探针：/models 命中当前模型 → 0 token 置绿
          assert.equal(await verifyAiStatus(cfg), 'valid');
          assert.equal(calls.length, 1, '命中 /models 后不得再发 chat 探针');
          assert.match(calls[0], /\/models$/, '第一跳必须是 /models');
          const savedAt = getAiStatus().checkedAt;
          assert.ok(savedAt !== null && Math.abs(Date.now() - savedAt) < 5000, '置绿须记录 checkedAt');

          // 过期降级：25 小时前的结论必须回到待验证，但保留时间供卡片显示
          const fp = aiConfigFingerprint(cfg);
          store.set('stem-ai-status', JSON.stringify({
            fingerprint: fp, status: 'valid', checkedAt: Date.now() - 25 * 3600000, detail: '',
          }));
          refreshAiStatus(cfg);
          assert.equal(getAiStatus().status, 'configured', '超过 24h 的绿点必须降级');
          assert.ok(getAiStatus().checkedAt !== null, '降级后仍须保留上次检测时间');

          // 指纹变化（换模型）→ 旧结论立即作废
          store.set('stem-ai-status', JSON.stringify({ fingerprint: fp, status: 'valid', checkedAt: Date.now(), detail: '' }));
          refreshAiStatus({ ...cfg, model: 'm2' });
          assert.equal(getAiStatus().status, 'configured', '换模型后不得沿用旧结论');
          assert.equal(getAiStatus().checkedAt, null, '换配置后旧检测时间不再属于当前配置');

          // 端点不支持 /models（404）→ 降级 chat 探针，且探针必须 max_tokens=1
          calls.length = 0;
          bodies = [];
          let n = 0;
          g.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
            calls.push(String(url));
            bodies.push(String(init?.body ?? ''));
            n += 1;
            return n === 1 ? mkRes(404) : mkRes(200, { choices: [{ message: { content: 'p' } }] });
          }) as typeof fetch;
          assert.equal(await verifyAiStatus(cfg), 'valid', '/models 不支持时应由 chat 探针给出结论');
          assert.equal(calls.length, 2);
          assert.match(calls[1], /\/chat\/completions$/, '第二跳才是 chat 探针');
          assert.ok(bodies[1].includes('"max_tokens":1'), 'chat 探针必须 max_tokens=1（控成本）');

          // 鉴权失败（401）→ invalid/auth，且不再白跑 chat
          calls.length = 0;
          g.fetch = (async (url: string | URL | Request) => {
            calls.push(String(url));
            return mkRes(401);
          }) as typeof fetch;
          assert.equal(await verifyAiStatus(cfg), 'invalid');
          assert.equal(getAiStatus().detail, 'auth');
          assert.equal(calls.length, 1, '401 之后不得再发 chat 探针');

          // 429 → 不判死刑：回到待验证，且不写存档
          store.delete('stem-ai-status');
          g.fetch = (async () => mkRes(429)) as typeof fetch;
          assert.equal(await verifyAiStatus(cfg), 'configured', '限流是服务商此刻状态，不代表配置错');
          assert.equal(store.has('stem-ai-status'), false, '429 不得写入结论存档');

          // 并发去重：连点只发一次请求
          calls.length = 0;
          let release: (() => void) | null = null;
          const gate = new Promise<void>((res) => { release = () => res(); });
          g.fetch = (async (url: string | URL | Request) => {
            calls.push(String(url));
            await gate;
            return mkRes(200, { data: [{ id: 'm1' }] });
          }) as typeof fetch;
          const p1 = verifyAiStatus(cfg);
          const p2 = verifyAiStatus(cfg);
          assert.equal(getAiStatus().status, 'verifying', '验证期间须进入 verifying 态');
          (release as unknown as () => void)();
          const [r1, r2] = await Promise.all([p1, p2]);
          assert.equal(r1, r2, '并发调用须返回同一结论');
          assert.equal(calls.length, 1, '验证进行中再点不得叠请求');

          // 轮询：结论是红的时候，不该只在 24h 之后才重新判断（用户修好 Key 就得手动点）
          assert.equal(AI_POLL_HEALTHY_MS, 5 * 60 * 1000, '健康时轮询间隔 5 分钟');
          assert.equal(AI_POLL_BROKEN_MS, 45 * 1000, '非健康时轮询间隔 45 秒（否则修好了还得等到下一轮）');
          // 轮询走的是 loadAiConfig（读已保存配置），所以这份配置必须在存档里
          store.set('stem-ai-config', JSON.stringify(cfg));
          store.set('stem-ai-status', JSON.stringify({
            fingerprint: aiConfigFingerprint(cfg), status: 'invalid', checkedAt: Date.now() - 60000, detail: 'auth',
          }));
          refreshAiStatus(cfg);
          assert.equal(getAiStatus().status, 'invalid', '新鲜的红结论载入时照原样恢复');
          calls.length = 0;
          g.fetch = (async (url: string | URL | Request) => {
            calls.push(String(url));
            return mkRes(200, { data: [{ id: 'm1' }] });
          }) as typeof fetch;
          assert.equal(await pollAiStatus('interval'), 'valid', '轮询须把「红」自动纠正为「绿」');
          assert.equal(getAiStatus().status, 'valid');
          assert.equal(calls.length, 1, '轮询一次只发一个 /models（0 token）');
          assert.match(calls[0], /\/models$/, '轮询只走便宜的 /models，不得打 chat');
          assert.equal(nextPollDelayMs(), AI_POLL_HEALTHY_MS, '探到绿后间隔须回到 5 分钟');

          // 退避：连红不许死磕 45s（挂机一节课 ≈ 60 次失败请求），逐级翻倍并封顶 5 分钟
          resetPollBackoff();
          store.set('stem-ai-status', JSON.stringify({
            fingerprint: aiConfigFingerprint(cfg), status: 'invalid', checkedAt: Date.now() - 60000, detail: 'auth',
          }));
          refreshAiStatus(cfg);
          assert.equal(nextPollDelayMs(), AI_POLL_BROKEN_MS, '首次失败按 45s 起算');
          g.fetch = (async (url: string | URL | Request) => {
            calls.push(String(url));
            return mkRes(401);
          }) as typeof fetch;
          assert.equal(await pollAiStatus('interval'), 'invalid');
          assert.equal(nextPollDelayMs(), AI_POLL_BROKEN_MS * 2, '第 1 次失败后退到 90s');
          await pollAiStatus('interval');
          assert.equal(nextPollDelayMs(), AI_POLL_BROKEN_MS * 4, '第 2 次失败后退到 180s');
          await pollAiStatus('interval');
          assert.equal(nextPollDelayMs(), AI_POLL_MAX_BREAK_MS, '第 3 次失败后封顶 5 分钟');
          await pollAiStatus('interval');
          assert.equal(nextPollDelayMs(), AI_POLL_MAX_BREAK_MS, '封顶后不再增长');
          // 手动验证 = 有人在处理 → 复位回 45s
          g.fetch = (async () => mkRes(401)) as typeof fetch;
          await verifyAiStatus(cfg);
          assert.equal(nextPollDelayMs(), AI_POLL_BROKEN_MS, '手动验证须把退避复位到 45s');

          // 离线不得轮询：那会把「端点不通」与「整机没网」混成同一个红点
          // （Node 的 navigator 是只读 getter，必须用 defineProperty 才能换）
          calls.length = 0;
          const navDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
          Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
          try {
            assert.equal(await pollAiStatus('interval'), null, '离线时轮询须返回 null');
            assert.equal(calls.length, 0, '离线时一个请求都不许发');
          } finally {
            if (navDesc) Object.defineProperty(globalThis, 'navigator', navDesc);
            else delete (globalThis as { navigator?: unknown }).navigator;
          }
        } finally {
          g.fetch = realFetch;
          g.window = prevWindow;
          refreshAiStatus(null);
        }
      })();
    }
  });
}
