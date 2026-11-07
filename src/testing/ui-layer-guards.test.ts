/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * UI 审计回归（注册模块，不含执行入口）。
 *
 * 对应一轮 UI 审计里修掉的四类问题，每类至少一条用例守着，防止下次「重构掉头」：
 *   ① 更新链路：版本方向判定（回滚/陈旧清单不能点亮徽章）+ 硬重置只清应用外壳缓存，
 *      用户主动下载的离线教学包必须留着；
 *   ② 浮层层级：一个 Esc 只退一层（浮层栈），以及「模态里开模态」必须抬到宿主之上；
 *   ③ 滚动锁：引用计数，叠开的浮层按任意顺序关闭都不会把页面锁死或提前解锁；
 *   ④ 键盘可达：SVG 开关、参数滑块、圆周动点都必须能 Tab 到、能按键操作。
 *
 * 依赖特征：纯函数直接 import；组件属性这类「源码契约」用正则读文件断言，
 * 与既有 touch-target-guards / periodic-table-guards 同一套做法（零 DOM）。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { repoPath } from './repo-paths';
import { isTopOverlay, overlayStackDepth, popOverlay, pushOverlay } from '../lib/overlay-stack';
import { isVersionNewer, parseVersion } from '../lib/version-compare';
import { selectShellCachesToClear } from '../lib/use-app-update';

export function registerUiLayerGuardsTests(test: TestFn): void {
  const readSrc = (p: string, enc: BufferEncoding = 'utf8') => readFileSync(repoPath(p), enc);

  /* ── ① 版本方向 ── */

  test('parseVersion 只认 major.minor.patch，预发布后缀忽略、非法串返回 null', () => {
    assert.deepEqual(parseVersion('0.47.0'), [0, 47, 0]);
    assert.deepEqual(parseVersion('v1.2.3-beta.4'), [1, 2, 3]);
    assert.deepEqual(parseVersion('  10.0.12+build'), [10, 0, 12]);
    for (const bad of ['', 'latest', 'v1.2', '1.x.3', null as unknown as string]) {
      assert.equal(parseVersion(bad), null, `${String(bad)} 必须判为无法解析`);
    }
  });

  test('isVersionNewer 只认「远端严格更新」：回滚、相等、脏数据一律 false', () => {
    assert.equal(isVersionNewer('0.48.0', '0.47.0'), true);
    assert.equal(isVersionNewer('1.0.0', '0.99.99'), true);
    assert.equal(isVersionNewer('0.47.1', '0.47.0'), true);

    // 服务端回滚 / 边缘节点陈旧清单：徽章不能亮，否则点下去白清一次本机缓存
    assert.equal(isVersionNewer('0.46.9', '0.47.0'), false, '旧版本不许点亮更新徽章');
    assert.equal(isVersionNewer('0.47.0', '0.47.0'), false);
    assert.equal(isVersionNewer('', '0.47.0'), false);
    assert.equal(isVersionNewer('0.48.0', '0.47'), false, '本地解析失败宁可不提示');
  });

  test('硬重置只清应用外壳缓存：离线教学包（照片/音频/架构图）必须保留', () => {
    const keys = ['workbox-precache-v2-https://x/', 'element-photos', 'element-audio', 'architecture-assets', 'architecture-page', 'some-other'];
    const cleared = selectShellCachesToClear(keys);
    assert.deepEqual(cleared, ['workbox-precache-v2-https://x/', 'architecture-page']);
    for (const pack of ['element-photos', 'element-audio', 'architecture-assets']) {
      assert.ok(!cleared.includes(pack), `${pack} 是用户花流量下好的离线包，更新前端不该删它`);
    }
    assert.deepEqual(selectShellCachesToClear([]), []);
  });

  /* ── ② 浮层栈 ── */

  test('浮层栈 LIFO：只有最后压栈的那层响应 Esc', () => {
    const a = Symbol('a');
    const b = Symbol('b');
    assert.equal(overlayStackDepth(), 0);
    assert.equal(isTopOverlay(a), false, '空栈时任何层都不是栈顶');

    pushOverlay(a);
    assert.equal(isTopOverlay(a), true);
    pushOverlay(b);
    assert.equal(isTopOverlay(b), true);
    assert.equal(isTopOverlay(a), false, '下层不许抢这一次 Esc');
    assert.equal(overlayStackDepth(), 2);

    popOverlay(b);
    assert.equal(isTopOverlay(a), true, '上层退出后 Esc 交还下层');
    popOverlay(a);
    assert.equal(overlayStackDepth(), 0);
    popOverlay(a); // 重复出栈（StrictMode 清理）不抛错
    assert.equal(overlayStackDepth(), 0);
  });

  test('浮层栈：非栈顶出栈不影响栈顶，重复压栈会顶回最上面', () => {
    const a = Symbol('a');
    const b = Symbol('b');
    pushOverlay(a);
    pushOverlay(b);
    popOverlay(a); // 下层先卸载
    assert.equal(isTopOverlay(b), true, '下层卸载不得让上层失去 Esc');

    pushOverlay(a);
    assert.equal(isTopOverlay(a), true, '重新打开等于重新压栈');
    assert.equal(overlayStackDepth(), 2);
    popOverlay(a);
    popOverlay(b);
  });

  test('useEscapeKey 必须走栈顶判定，且回调放 ref（父组件重渲染不得把自己顶到栈顶）', () => {
    const src = readSrc('src/lib/use-escape-key.ts');
    assert.match(src, /isTopOverlay\(id\)/, 'Esc 处理必须先问「我是不是栈顶」');
    assert.match(src, /useRef\(onEscape\)/, '回调须存 ref');
    assert.match(src, /\}, \[enabled\]\);/, '注册 effect 只能依赖 enabled，不能依赖回调身份');
    // 不吞事件：浮层内输入框自己的 Esc（清空建议等）还要用。
    // 只看函数体（头部注释里正好写着这两条禁令，不能被自己误判）
    const body = src.slice(src.indexOf('export function useEscapeKey('));
    assert.ok(!/stopPropagation|preventDefault/.test(body), 'useEscapeKey 不许改写事件传播');
  });

  test('嵌套模态：欢迎弹窗里的协议/版本/离线包都要传 elevated，且 CSS 有 modal-top 这一档', () => {
    const css = readSrc('src/index.css');
    const overlayZ = Number(/(--z-overlay:\s*(\d+))/.exec(css)?.[2]);
    const modalZ = Number(/(--z-modal:\s*(\d+))/.exec(css)?.[2]);
    const modalTopZ = Number(/(--z-modal-top:\s*(\d+))/.exec(css)?.[2]);
    const toastZ = Number(/(--z-toast:\s*(\d+))/.exec(css)?.[2]);
    assert.ok(Number.isFinite(modalTopZ), '缺 --z-modal-top');
    assert.ok(modalTopZ > modalZ, '嵌套模态必须高于宿主模态，否则整层画在宿主卡片下面');
    assert.ok(modalTopZ < toastZ, '嵌套模态仍须低于全局 toast');
    assert.ok(overlayZ < modalZ);

    const welcome = readSrc('src/components/ui/WelcomeDialog.tsx');
    assert.match(welcome, /<LicenseDialog elevated/, '欢迎弹窗里的协议弹窗必须 elevated');
    assert.match(welcome, /<VersionDialog elevated/, '欢迎弹窗里的版本历史必须 elevated');

    for (const [file, needle] of [
      ['src/components/ui/LicenseDialog.tsx', "elevated ? 'z-modal-top' : 'z-overlay'"],
      ['src/components/feedback/OfflinePackPanel.tsx', "elevated ? 'z-modal-top' : 'z-overlay'"],
      ['src/components/feedback/VersionDialog.tsx', "elevated ? 'z-modal-top' : ''"],
    ] as const) {
      assert.ok(readSrc(file).includes(needle), `${file} 缺少 elevated 开关`);
    }
  });

  test('所有自管 Esc 的浮层都接入了浮层栈（AiAssistant / 导出错题卷 / 参数抽屉 / 健康卡片）', () => {
    for (const file of [
      'src/components/ai/AiAssistant.tsx',
      'src/components/ai/panels/HistoryPanel.tsx',
      'src/components/lab/ParamDock.tsx',
      'src/components/layout/Header.tsx',
      'src/components/feedback/OfflinePackPanel.tsx',
      'src/components/ui/WelcomeDialog.tsx',
    ]) {
      const src = readSrc(file);
      assert.match(src, /useEscapeKey\(/, `${file} 必须用共享 hook`);
      assert.ok(
        !/addEventListener\('keydown',[^)]*Escape/.test(src),
        `${file} 不许再自己挂 window keydown（一次 Esc 会关掉一摞浮层）`,
      );
    }
  });

  /* ── ③ 滚动锁 ── */

  test('useLockBodyScroll 必须是引用计数：最后一个锁释放才复原 overflow', () => {
    const src = readSrc('src/lib/use-lock-body-scroll.ts');
    assert.match(src, /let lockCount = 0/, '缺模块级计数');
    assert.match(src, /lockCount \+= 1/, '上锁必须计数');
    assert.match(src, /lockCount === 0\) document\.body\.style\.overflow = savedOverflow/, '只有归零才复原');
    // 旧写法：每个组件各自记 prev 各自复原 —— 关闭顺序一换就把页面锁死或提前解锁
    assert.ok(
      !/const prev = document\.body\.style\.overflow/.test(src),
      '不许再各记各的 prev',
    );
  });

  /* ── ④ 键盘可达 ── */

  test('电学开关（SVG）必须可 Tab、可 Enter/空格切换，并暴露按下态', () => {
    const src = readSrc('src/components/lab/circuit/CircuitParts.tsx');
    assert.match(src, /role="button"[\s\S]{0,400}tabIndex=\{0\}/, 'SVG 热区必须进 Tab 序');
    assert.match(src, /aria-pressed=\{on\}/, '开关状态要能被读屏读出');
    assert.match(src, /e\.key !== 'Enter' && e\.key !== ' '/, '缺 Enter/空格键处理');
    assert.match(src, /e\.preventDefault\(\);[\s\S]{0,60}onToggle\(\)/, '空格必须 preventDefault 再触发（否则页面跟着滚）');
  });

  test('参数滑块必须有可访问名：label htmlFor 与 input id 成对', () => {
    const src = readSrc('src/components/lab/ParamSlider.tsx');
    assert.match(src, /useId\(\)/, '同页多个滑块需要 useId 防撞');
    assert.match(src, /<label htmlFor=\{sliderId\}/, '标签必须绑定到输入框');
    assert.match(src, /id=\{sliderId\}/, '输入框必须有对应 id');
  });

  test('圆周动点必须能用方向键移动（role=slider + Arrow 键）', () => {
    const src = readSrc('src/components/lab/InteractiveCircle.tsx');
    assert.match(src, /role: 'slider' as const/, '动点须声明为 slider');
    assert.match(src, /'aria-valuenow'/, '须暴露当前角度');
    assert.match(src, /ArrowRight/, '缺方向键处理');
    assert.match(src, /\{\.\.\.pointA11y\('chordAngleA'/, '动点 A 未接入键盘属性');
    assert.match(src, /\{\.\.\.pointA11y\('inscribedAngleP'/, '动点 P 未接入键盘属性');
  });

  test('错题选项答完后保留键盘焦点（aria-disabled 而非 disabled）', () => {
    const src = readSrc('src/components/ai/panels/QuizPanel.tsx');
    assert.match(src, /aria-disabled=\{quizSelected !== null\}/, 'disabled 会把焦点踢回 body');
    assert.ok(!/(?<!aria-)disabled=\{quizSelected !== null\}/.test(src), '不许再整排 disabled');
    assert.match(src, /role="status" aria-live="polite"/, '判分反馈须有 live region');
  });
}
