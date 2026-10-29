/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 反馈队列持久化守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe，**整组 3 个用例一次迁出**。
 * 用例名、断言、错误消息与执行顺序与迁移前逐字相同；本套件零文件读取。
 *
 * 依赖特征：用例内用 `installMockWindow()` 装一个带假 `localStorage` 的 `globalThis.window`
 * （Feedback 那组还会替换 `globalThis.fetch` 防真实推送），每个用例在 `finally` 里
 * `restoreWindow()` 还原并清空内存表。套件自包含、不依赖前序用例残留；用例之间仍按原顺序
 * 串行执行（harness 的 `runAll()` 逐个 await），迁出未改变任何执行语义。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import type { TestFn } from './harness';
import {
  FEEDBACK_LIMIT, loadFeedback, removeFeedback, saveFeedback, type FeedbackRecord,
} from '../lib/feedback';

export function registerFeedbackQueueStorageTests(test: TestFn): void {
  const mem = new Map<string, string>();
  // 保留原 fetch 以便恢复；mock 成 500 响应，防止测试触发真实 Server酱推送
  const originalFetch = (globalThis as any).fetch;
  function installMockWindow() {
    (globalThis as any).fetch = async () => new Response('', { status: 500 });
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
        setItem: (k: string, v: string) => { mem.set(k, v); },
        removeItem: (k: string) => { mem.delete(k); },
      },
    };
  }
  function restoreWindow() {
    delete (globalThis as any).window;
    (globalThis as any).fetch = originalFetch;
  }
  const record = (i: number): FeedbackRecord => ({
    id: `fb-${i}`,
    type: 'project',
    categories: [],
    message: `反馈${i}`,
    language: 'zh',
    createdAt: new Date().toISOString(),
  });

  test('save then load returns the entry', () => {
    installMockWindow();
    try {
      saveFeedback(record(1));
      const list = loadFeedback();
      assert.equal(list.length, 1);
      assert.equal(list[0].message, '反馈1');
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('keeps newest 100, drops oldest beyond limit', () => {
    installMockWindow();
    try {
      for (let i = 0; i < FEEDBACK_LIMIT + 5; i++) saveFeedback(record(i));
      const list = loadFeedback();
      assert.equal(list.length, FEEDBACK_LIMIT);
      // 最新一条保留，最旧的 0~4 被丢弃
      assert.ok(list.some((r) => r.message === `反馈${FEEDBACK_LIMIT + 4}`));
      assert.ok(!list.some((r) => r.message === '反馈0'));
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('removeFeedback drops only the target record', () => {
    installMockWindow();
    try {
      saveFeedback(record(1));
      saveFeedback(record(2));
      saveFeedback(record(3));
      removeFeedback('fb-2');
      const list = loadFeedback();
      assert.equal(list.length, 2);
      assert.ok(list.some((r) => r.id === 'fb-1'));
      assert.ok(!list.some((r) => r.id === 'fb-2'));
      assert.ok(list.some((r) => r.id === 'fb-3'));
    } finally {
      mem.clear();
      restoreWindow();
    }
  });
}
