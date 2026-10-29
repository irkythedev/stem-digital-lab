/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 问答历史持久化守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe，**整组 5 个用例一次迁出**。
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
  HISTORY_LIMIT, clearHistory, listHistory, relativeTime, saveHistory,
} from '../lib/ai-history';

export function registerAiHistoryStorageTests(test: TestFn): void {
  // 内存版 localStorage mock（Node 环境注入 window）
  const mem = new Map<string, string>();
  function installMockWindow() {
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
  }

  test('save then list returns the entry', () => {
    installMockWindow();
    try {
      saveHistory({ path: '/lab/ohm', subject: '物理', topic: '欧姆定律', question: '什么是电阻？', answer: '电阻是……', model: 'gpt-4o-mini' });
      const list = listHistory();
      assert.equal(list.length, 1);
      assert.equal(list[0].question, '什么是电阻？');
      assert.ok(list[0].id.length > 0);
      assert.ok(list[0].ts > 0);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('keeps newest 100, drops oldest beyond limit', () => {
    installMockWindow();
    try {
      for (let i = 0; i < 105; i++) {
        saveHistory({ path: '/', subject: '数学', topic: '一次函数', question: `问题${i}`, answer: `答案${i}`, model: 'm' });
      }
      const list = listHistory();
      assert.equal(list.length, HISTORY_LIMIT);
      // 最新一条保留，最旧的 0 被丢弃
      assert.ok(list.some((h) => h.question === '问题104'));
      assert.ok(!list.some((h) => h.question === '问题0'));
      // 时间倒序
      for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].ts >= list[i].ts);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('clear empties the store', () => {
    installMockWindow();
    try {
      saveHistory({ path: '/', subject: '数学', topic: '一次函数', question: 'q', answer: 'a', model: 'm' });
      clearHistory();
      assert.equal(listHistory().length, 0);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('corrupted data falls back to empty list', () => {
    installMockWindow();
    try {
      mem.set('stem-ai-history', '{{{ not json');
      assert.equal(listHistory().length, 0);
      mem.set('stem-ai-history', JSON.stringify({ wrong: 'shape' }));
      assert.equal(listHistory().length, 0);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('relativeTime formats zh and en', () => {
    const now = Date.now();
    assert.match(relativeTime(now - 30 * 1000, 'zh'), /刚刚/);
    assert.match(relativeTime(now - 30 * 1000, 'en'), /just now/);
    assert.match(relativeTime(now - 2 * 3600 * 1000, 'zh'), /2 小时前/);
    assert.match(relativeTime(now - 26 * 3600 * 1000, 'zh'), /昨天/);
  });
}
