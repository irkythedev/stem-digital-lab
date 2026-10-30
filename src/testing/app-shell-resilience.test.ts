/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 应用外壳韧性回归：动态 chunk 失败的自救边界 + 反馈队列自动补传接线。
 *
 * 两个模块都把浏览器事件/计时器作为注入项，因此这里用假事件源和假存储
 * 验证**可观察行为**（是否刷新、是否补传、卸载后是否还响应），不再断言
 * 源码里存在某个字符串。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { repoPath } from './repo-paths';
import {
  installPreloadRecovery,
  PRELOAD_RELOAD_COOLDOWN_MS,
} from '../lib/preload-recovery';
import { installFeedbackAutoFlush } from '../lib/feedback-auto-flush';
import {
  cachedKeyOf,
  countCachedEntries,
  isPrecacheComplete,
  parsePrecacheManifest,
  precacheCacheKey,
  ringStateFor,
} from '../lib/update-progress';

/** 源码守卫统一走 repoPath()：不依赖 process.cwd() */
const readSrc = (p: string, enc: BufferEncoding = 'utf8') => readFileSync(repoPath(p), enc);

/** 极简事件源：记录监听器，测试里手动 dispatch。 */
class FakeEventSource {
  private listeners = new Map<string, Set<EventListener>>();

  addEventListener = (type: string, listener: EventListener): void => {
    const set = this.listeners.get(type) ?? new Set<EventListener>();
    set.add(listener);
    this.listeners.set(type, set);
  };

  removeEventListener = (type: string, listener: EventListener): void => {
    this.listeners.get(type)?.delete(listener);
  };

  dispatch(type: string, event: Event = new Event(type, { cancelable: true })): Event {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }

  count(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

function makeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => { data.set(key, value); },
    data,
  };
}

export function registerAppShellResilienceTests(test: TestFn): void {
  /** 等探测 Promise 与后续 then 链跑完。 */
  const tick = () => new Promise<void>((resolve) => { setTimeout(resolve, 0); });

  test('preloadError online: reloads once, then cools down instead of looping', async () => {
    const target = new FakeEventSource();
    const storage = makeStorage();
    let now = 1_000;
    let reloads = 0;

    const uninstall = installPreloadRecovery({
      reload: () => { reloads += 1; },
      now: () => now,
      storage,
      isOnline: () => true,
      probeReachable: async () => true,
      addEventListener: target.addEventListener,
      removeEventListener: target.removeEventListener,
    });

    const first = target.dispatch('vite:preloadError');
    assert.equal(first.defaultPrevented, true, '决定刷新时应拦截错误');
    assert.equal(reloads, 0, '连通性探测完成前不得刷新');
    await tick();
    assert.equal(reloads, 1, '在线且探通应刷新一次');

    // 同一时间窗内的第二次失败：不刷新，把错误留给 ErrorBoundary。
    const second = target.dispatch('vite:preloadError');
    assert.equal(reloads, 1, '冷却期内不得再次刷新');
    assert.equal(second.defaultPrevented, false, '不刷新时不应吞掉错误');

    now += PRELOAD_RELOAD_COOLDOWN_MS;
    const third = target.dispatch('vite:preloadError');
    assert.equal(third.defaultPrevented, true);
    await tick();
    assert.equal(reloads, 2, '冷却结束后允许再次刷新');
    uninstall();
  });

  test('preloadError offline: navigator.onLine false never reloads', async () => {
    const target = new FakeEventSource();
    const storage = makeStorage();
    let online = false;
    let reloads = 0;

    const uninstall = installPreloadRecovery({
      reload: () => { reloads += 1; },
      now: () => 10_000,
      storage,
      isOnline: () => online,
      probeReachable: async () => true,
      addEventListener: target.addEventListener,
      removeEventListener: target.removeEventListener,
    });

    const offlineEvent = target.dispatch('vite:preloadError');
    await tick();
    assert.equal(reloads, 0, '离线刷新只会循环，必须禁止');
    assert.equal(offlineEvent.defaultPrevented, false, '离线时错误应交给 ErrorBoundary');

    online = true;
    target.dispatch('vite:preloadError');
    await tick();
    assert.equal(reloads, 1, '恢复网络后应允许一次刷新');
    uninstall();
  });

  test('preloadError with a false online flag: an unreachable probe blocks the reload', async () => {
    // 离线导航由 SW 返回页面后 navigator.onLine 可能误报 true：
    // 真正的连通性由探测决定，探不通就停在 ErrorBoundary，不能刷新。
    const target = new FakeEventSource();
    const storage = makeStorage();
    let reloads = 0;
    let probes = 0;

    const uninstall = installPreloadRecovery({
      reload: () => { reloads += 1; },
      now: () => 20_000,
      storage,
      isOnline: () => true,
      probeReachable: async () => { probes += 1; return false; },
      addEventListener: target.addEventListener,
      removeEventListener: target.removeEventListener,
    });

    target.dispatch('vite:preloadError');
    await tick();
    assert.equal(probes, 1, '必须真正探测一次');
    assert.equal(reloads, 0, '探不通时不得刷新');
    uninstall();
  });

  test('preloadError without storage: never auto-reloads (cannot guard a loop)', () => {
    const target = new FakeEventSource();
    let reloads = 0;
    let probes = 0;
    const uninstall = installPreloadRecovery({
      reload: () => { reloads += 1; },
      storage: null,
      isOnline: () => true,
      probeReachable: async () => { probes += 1; return true; },
      addEventListener: target.addEventListener,
      removeEventListener: target.removeEventListener,
    });

    const event = target.dispatch('vite:preloadError');
    assert.equal(reloads, 0);
    assert.equal(probes, 0, '不能被跨刷新的冷却保护时，连探测都不必做');
    assert.equal(event.defaultPrevented, false);
    uninstall();
  });

  test('preloadError listener is removed by cleanup', () => {
    const target = new FakeEventSource();
    let reloads = 0;
    let probes = 0;
    const uninstall = installPreloadRecovery({
      reload: () => { reloads += 1; },
      now: () => 1,
      storage: makeStorage(),
      isOnline: () => true,
      probeReachable: async () => { probes += 1; return true; },
      addEventListener: target.addEventListener,
      removeEventListener: target.removeEventListener,
    });
    assert.equal(target.count('vite:preloadError'), 1);
    uninstall();
    assert.equal(target.count('vite:preloadError'), 0);
    target.dispatch('vite:preloadError');
    assert.equal(probes, 0);
    assert.equal(reloads, 0);
  });

  test('feedback auto-flush: online and visible returns trigger, hidden/offline do not', () => {
    const target = new FakeEventSource();
    let online = true;
    let visibility = 'visible';
    let flushes = 0;

    const uninstall = installFeedbackAutoFlush(target, {
      isOnline: () => online,
      visibilityState: () => visibility,
      flush: () => { flushes += 1; },
    });

    target.dispatch('online');
    assert.equal(flushes, 1, '网络恢复应补传');

    online = false;
    target.dispatch('online');
    assert.equal(flushes, 1, '离线状态不应补传');

    online = true;
    visibility = 'hidden';
    target.dispatch('visibilitychange');
    assert.equal(flushes, 1, '页面隐藏时不应补传');

    visibility = 'visible';
    target.dispatch('visibilitychange');
    assert.equal(flushes, 2, '回到前台且在线应补传');

    uninstall();
  });

  test('feedback auto-flush: cleanup removes both listeners', () => {
    const target = new FakeEventSource();
    let flushes = 0;
    const uninstall = installFeedbackAutoFlush(target, {
      isOnline: () => true,
      visibilityState: () => 'visible',
      flush: () => { flushes += 1; },
    });
    assert.equal(target.count('online'), 1);
    assert.equal(target.count('visibilitychange'), 1);

    uninstall();
    assert.equal(target.count('online'), 0);
    assert.equal(target.count('visibilitychange'), 0);
    target.dispatch('online');
    target.dispatch('visibilitychange');
    assert.equal(flushes, 0);
  });

  test('feedback auto-flush: a throwing flush does not break the page', () => {
    const target = new FakeEventSource();
    const uninstall = installFeedbackAutoFlush(target, {
      isOnline: () => true,
      flush: () => { throw new Error('storage unavailable'); },
    });
    assert.doesNotThrow(() => target.dispatch('online'));
    uninstall();
  });

  /* ── 更新环的「真值」层 ──────────────────────────────────────────────
   * 预缓存安装没有进度事件，环的弧长只能建立在「新清单里已写入多少条」上。
   * 下面五条钉住的正是四条容易算错的规则（见 lib/update-progress.ts 抬头）。 */

  test('update progress: manifest parser reads both revisioned and null entries', () => {
    // 真实产物形态：多为 revision:null，少量带哈希，另有一种缺字段的写法
    const sw = 'define([],function(){precacheAndRoute(['
      + '{url:"a.png",revision:"bb69560bb91742b16df5dc6a1a08cb2e"},'
      + '{url:"assets/i-1.js",revision:null},'
      + '{url:"c.svg"},'
      + '{url:"a.png",revision:"dup"}'
      + '],{})});';
    const entries = parsePrecacheManifest(sw);
    assert.deepEqual(entries.map((e) => e.url), ['a.png', 'assets/i-1.js', 'c.svg'],
      '重复 URL 只算一条，三种 revision 形态都要解析出来');
    assert.equal(entries[0].revision, 'bb69560bb91742b16df5dc6a1a08cb2e');
    assert.equal(entries[1].revision, null, 'revision:null 必须解析成 null 而不是丢掉该条');
    assert.equal(entries[2].revision, null, '缺 revision 字段也要算一条');
    assert.deepEqual(parsePrecacheManifest('self.addEventListener("install",()=>{})'), [],
      '没有 precacheAndRoute 时返回空数组（调用方据此退回扫动弧，不编造分母）');
  });

  test('update progress: cache keys match workbox, bare URL for null revision', () => {
    assert.equal(precacheCacheKey({ url: 'a.png', revision: 'abc' }), 'a.png?__WB_REVISION__=abc');
    assert.equal(precacheCacheKey({ url: 'assets/i-1.js', revision: null }), 'assets/i-1.js',
      '带内容哈希的文件名没有查询串');
  });

  test('update progress: cached count normalizes absolute URLs and never matches by prefix', () => {
    assert.equal(cachedKeyOf('https://stem.irky.dev/assets/i-1.js'), 'assets/i-1.js');
    assert.equal(cachedKeyOf('/a.png?__WB_REVISION__=abc'), 'a.png?__WB_REVISION__=abc');
    assert.equal(cachedKeyOf('a.png'), 'a.png', '已经是相对形态时原样返回');
    const entries = [
      { url: 'a.png', revision: 'abc' },
      { url: 'assets/i-1.js', revision: null },
      { url: 'assets/i-2.js', revision: null },
    ];
    const cache = [
      'http://127.0.0.1:4199/a.png?__WB_REVISION__=abc',
      'https://stem.irky.dev/assets/i-1.js',
      'https://stem.irky.dev/assets/i-2.js.map', // 前缀相同但不同文件：不得算进去
    ];
    assert.equal(countCachedEntries(entries, cache), 2,
      '绝对 URL 要归一成 path/search；i-2.js.map 不能顶替 i-2.js');
    assert.equal(countCachedEntries(entries, [...cache, 'http://x/assets/i-2.js']), 3);
    assert.equal(isPrecacheComplete(entries, cache), false, '缺一条就不算完成');
  });

  test('update progress: completion is "every manifest key present", not done === total', () => {
    const entries = [
      { url: 'a.png', revision: 'new' },
      { url: 'b.js', revision: null },
    ];
    // 装完会回落：旧 revision 的条目还在缓存里，计数不等于总数也不能算完成
    const withStale = ['http://h/a.png?__WB_REVISION__=old', 'http://h/a.png?__WB_REVISION__=new', 'http://h/b.js'];
    assert.equal(countCachedEntries(entries, withStale), 2);
    assert.equal(isPrecacheComplete(entries, withStale), true, '新清单全命中即完成，哪怕还留着旧条目');
    assert.equal(isPrecacheComplete([], ['http://h/anything']), false, '空清单不构成「完成」');
  });

  test('update progress: phases without a denominator never claim a percentage', () => {
    const measured = { done: 30, total: 100 };
    assert.deepEqual(ringStateFor('idle', null), { mode: 'hidden' });
    assert.deepEqual(ringStateFor('checking', measured), { mode: 'indeterminate' },
      'checking 没有分母：即便手上有读数也不许画百分比');
    assert.deepEqual(ringStateFor('activating', measured), { mode: 'indeterminate' });
    assert.deepEqual(ringStateFor('downloading', null), { mode: 'indeterminate' });
    assert.deepEqual(ringStateFor('downloading', measured), { mode: 'determinate', ratio: 0.3 });
    assert.deepEqual(ringStateFor('clearing', { done: 1, total: 4 }), { mode: 'determinate', ratio: 0.25 });
    assert.deepEqual(ringStateFor('reloading', null), { mode: 'full' });
    // 越界与脏数据要夹住，不能让 dashoffset 变成负数或 NaN
    const over = ringStateFor('downloading', { done: 120, total: 100 });
    assert.equal(over.mode === 'determinate' && over.ratio, 1);
    const bad = ringStateFor('downloading', { done: Number.NaN, total: 100 });
    assert.equal(bad.mode, 'indeterminate', 'NaN 读数退回扫动弧');
    assert.deepEqual(ringStateFor('downloading', { done: 3, total: 0 }), { mode: 'indeterminate' },
      '分母为 0 时没有比例可画');
    // 基准：一次真实发版里清单 94 条只有 20 条的 revision 变了，其余 74 条本就在缓存里。
    // 不做基准扣减，弧会一起手就 79%（实测 dash 48→9 只用 40ms），读起来像假进度。
    assert.deepEqual(ringStateFor('downloading', { done: 76, total: 94, base: 74 }),
      { mode: 'determinate', ratio: 0.1 }, '弧只画本次更新还要做的量');
    assert.deepEqual(ringStateFor('downloading', { done: 94, total: 94, base: 94 }),
      { mode: 'determinate', ratio: 1 }, '清单全在缓存里时直接满环，不假装从 0 开始');
    assert.deepEqual(ringStateFor('downloading', { done: 70, total: 94, base: 74 }),
      { mode: 'determinate', ratio: 0 }, '读数低于基准（脏数据）不得画出负弧长');
  });

  test('update indicator: the floating phase toast is gone, the live region is not', () => {
    const header = readSrc('src/components/layout/Header.tsx', 'utf8');
    assert.doesNotMatch(header, /fixed top-4 right-4/, '阶段浮层不得回归（进度改在徽章本身上表达）');
    assert.match(header, /role="status" aria-live="polite" data-update-phase=\{phase\} className="sr-only"/,
      '必须保留 sr-only 的阶段播报：看得见的环替代不了看不见的 live region');
    assert.match(header, /update-ring-track[\s\S]{0,400}update-ring-arc/,
      '徽章忙时必须渲染进度环（轨道 + 弧）');
    assert.match(header, /strokeDashoffset=\{ring\.mode === 'determinate'/, '弧长须由 determinate 读数驱动');
    assert.match(header, /ringStateFor\(phase, progress\)/, '形态必须走 ringStateFor，不得就地另写一套映射');

    const hook = readSrc('src/lib/use-app-update.ts', 'utf8');
    assert.match(hook, /window\.clearInterval\(pollRef\.current\)/, '采样必须能停表');
    assert.ok(hook.includes("const names = (await caches.keys()).filter((n) => n.startsWith('workbox-precache'))"),
      '读的是 workbox 预缓存，不是其它缓存');
    assert.ok(hook.includes("parsePrecacheManifest(await res.text())"),
      '分母来自 sw.js 的新清单（不是当前缓存条目数）');
  });
}
