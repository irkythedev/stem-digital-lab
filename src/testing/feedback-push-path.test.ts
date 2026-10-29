/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 反馈推送路径守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的 `Feedback push path (one push per submission)` 套件，
 * **整组 7 个用例一次迁出**（全部是 `testAsync`）。用例名、断言、错误消息与**执行顺序**
 * 与迁移前逐字相同 —— 顺序是被测语义的一部分：模块级队列状态由前一例的残留驱动后一例，
 * 因此本模块内的用例必须串行执行（harness 的 `runAll()` 逐个 await，已满足）。
 *
 * 依赖特征：零文件读取；每个用例自行替换 `globalThis.fetch` 与 `globalThis.window`
 * （带假 `localStorage`），并在 `finally` 里还原，属进程内自包含替身。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import type { TestFn } from './harness';
import {
  FEEDBACK_MAX_ATTEMPTS, flushFeedbackQueue, loadFeedback, saveFeedback, submitFeedback, type FeedbackRecord,
} from '../lib/feedback';

export function registerFeedbackPushPathTests(test: TestFn, testAsync: TestFn): void {
  const mem = new Map<string, string>();
  const originalFetch = (globalThis as any).fetch;
  let pushCalls: string[] = [];

  const okRes = () => new Response(JSON.stringify({ code: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const failRes = () => new Response('', { status: 500 });
  /** 默认失败；用例内可改成成功/延迟，模拟真实链路 */
  let responder: () => Promise<Response> = async () => failRes();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  function install() {
    pushCalls = [];
    responder = async () => failRes();
    (globalThis as any).fetch = async (_url: unknown, init: any) => {
      pushCalls.push(String(init?.body ?? ''));
      return responder();
    };
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
        setItem: (k: string, v: string) => { mem.set(k, v); },
        removeItem: (k: string) => { mem.delete(k); },
      },
    };
  }
  function restore() {
    delete (globalThis as any).window;
    (globalThis as any).fetch = originalFetch;
  }
  const rec = (i: number): FeedbackRecord => ({
    id: `fb-${i}`,
    type: 'project',
    categories: [],
    message: `补传${i}`,
    language: 'zh',
    createdAt: '2026-09-10T03:20:00.000Z',
  });

  testAsync('saveFeedback 只入队不推送（补传时才发，杜绝一次提交两条）', async () => {
    install();
    try {
      responder = async () => okRes();
      saveFeedback(rec(1));
      assert.equal(pushCalls.length, 0, 'saveFeedback 不应触发推送');
      assert.equal(loadFeedback().length, 1);
      await flushFeedbackQueue();
      assert.equal(pushCalls.length, 1, '补传只应推一条');
      assert.equal(loadFeedback().length, 0);
    } finally {
      mem.clear();
      restore();
    }
  });

  testAsync('submitFeedback 一次提交恒定只推一条，成功后出队', async () => {
    install();
    try {
      responder = async () => okRes();
      const sent = await submitFeedback(rec(1));
      assert.equal(sent, true);
      assert.equal(pushCalls.length, 1, `一次提交应只推 1 条，实际 ${pushCalls.length}`);
      assert.equal(loadFeedback().length, 0);
    } finally {
      mem.clear();
      restore();
    }
  });

  testAsync('推送失败时保留记录并计数（不丢反馈）', async () => {
    install();
    try {
      const sent = await submitFeedback(rec(1));
      assert.equal(sent, false);
      assert.equal(pushCalls.length, 1);
      const list = loadFeedback();
      assert.equal(list.length, 1);
      assert.equal(list[0].attempts, 1);
    } finally {
      mem.clear();
      restore();
    }
  });

  testAsync('连续两次提交各推一条，队列不残留', async () => {
    install();
    try {
      responder = async () => { await sleep(15); return okRes(); };
      const [a, b] = await Promise.all([submitFeedback(rec(1)), submitFeedback(rec(2))]);
      assert.equal(a, true);
      assert.equal(b, true);
      assert.equal(pushCalls.length, 2);
      assert.equal(loadFeedback().length, 0);
    } finally {
      mem.clear();
      restore();
    }
  });

  testAsync('并发补传同一条只推一次（防止连点重复发送）', async () => {
    install();
    try {
      responder = async () => { await sleep(15); return okRes(); };
      saveFeedback(rec(1));
      await Promise.all([flushFeedbackQueue(), flushFeedbackQueue()]);
      assert.equal(pushCalls.length, 1);
      assert.equal(loadFeedback().length, 0);
    } finally {
      mem.clear();
      restore();
    }
  });

  testAsync('补传期间新提交失败的记录不会被覆盖丢失', async () => {
    install();
    try {
      saveFeedback(rec(0)); // 模拟上次离线残留
      let release: () => void = () => {};
      const gate = new Promise<void>((res) => { release = res; });
      let calls = 0;
      responder = async () => {
        calls++;
        if (calls === 1) { await gate; return okRes(); } // 第一条慢成功
        return failRes(); // 补传期间新提交的这条失败
      };
      const running = flushFeedbackQueue();
      await sleep(10); // 等补传进入第一条的 await
      const sent = await submitFeedback(rec(1));
      assert.equal(sent, false);
      release();
      await running;
      const list = loadFeedback();
      assert.equal(list.length, 1, '新记录应保留待重试，不能被快照覆盖');
      assert.equal(list[0].id, 'fb-1');
      assert.equal(list[0].attempts, 1);
    } finally {
      mem.clear();
      restore();
    }
  });

  testAsync('失败达到上限后丢弃该条（防止永久重复推送）', async () => {
    install();
    try {
      saveFeedback(rec(1));
      for (let i = 0; i < FEEDBACK_MAX_ATTEMPTS - 1; i++) await flushFeedbackQueue();
      assert.equal(loadFeedback().length, 1, '未达上限应保留');
      assert.equal(loadFeedback()[0].attempts, FEEDBACK_MAX_ATTEMPTS - 1);
      await flushFeedbackQueue(); // 第 MAX 次失败
      assert.equal(loadFeedback().length, 0, '达上限应丢弃');
    } finally {
      mem.clear();
      restore();
    }
  });
}
