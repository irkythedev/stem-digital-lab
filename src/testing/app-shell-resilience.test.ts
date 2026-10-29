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
import type { TestFn } from './harness';
import {
  installPreloadRecovery,
  PRELOAD_RELOAD_COOLDOWN_MS,
} from '../lib/preload-recovery';
import { installFeedbackAutoFlush } from '../lib/feedback-auto-flush';

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
}
