/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 错题历史持久化守卫（注册模块，不含执行入口）。
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
  QUIZ_HISTORY_LIMIT, clearQuizHistory, listQuizHistory, saveQuizHistory, wrongQuizHistory, type QuizHistoryEntry,
} from '../lib/quiz-history';

export function registerQuizHistoryStorageTests(test: TestFn): void {
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
  const entry = (i: number, correct: boolean): Omit<QuizHistoryEntry, 'id' | 'ts'> => ({
    path: '/lab/quadratic',
    subject: '数学',
    topic: '二次函数',
    question: `题目${i}`,
    options: ['a', 'b', 'c', 'd'],
    answerIdx: 0,
    pickedIdx: correct ? 0 : 2,
    correct,
    model: 'm',
  });

  test('save then load returns entries', () => {
    installMockWindow();
    try {
      saveQuizHistory(entry(1, true));
      const list = listQuizHistory();
      assert.equal(list.length, 1);
      assert.equal(list[0].question, '题目1');
      assert.equal(list[0].correct, true);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('explanation round-trips and is optional (legacy data)', () => {
    installMockWindow();
    try {
      saveQuizHistory({ ...entry(1, false), explanation: 'u>2f 时成倒立缩小实像，照相机原理。' });
      const withExpl = listQuizHistory()[0];
      assert.equal(withExpl.explanation, 'u>2f 时成倒立缩小实像，照相机原理。');
      // 旧数据无 explanation：读取不报错、字段为 undefined
      saveQuizHistory(entry(2, true));
      const legacy = listQuizHistory().find((e) => e.question === '题目2')!;
      assert.equal(legacy.explanation, undefined);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('wrongQuizHistory returns only wrong entries', () => {
    installMockWindow();
    try {
      saveQuizHistory(entry(1, true));
      saveQuizHistory(entry(2, false));
      saveQuizHistory(entry(3, false));
      const wrong = wrongQuizHistory();
      assert.equal(wrong.length, 2);
      assert.ok(wrong.every((e) => !e.correct));
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('keeps newest 100, drops oldest beyond limit', () => {
    installMockWindow();
    try {
      for (let i = 0; i < QUIZ_HISTORY_LIMIT + 5; i++) saveQuizHistory(entry(i, i % 2 === 0));
      const list = listQuizHistory();
      assert.equal(list.length, QUIZ_HISTORY_LIMIT);
      assert.ok(list.some((e) => e.question === `题目${QUIZ_HISTORY_LIMIT + 4}`));
      assert.ok(!list.some((e) => e.question === '题目0'));
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('clear empties the store', () => {
    installMockWindow();
    try {
      saveQuizHistory(entry(1, true));
      clearQuizHistory();
      assert.equal(listQuizHistory().length, 0);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });
}
