/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 本地存储契约套件（注册模块，不含执行入口）。
 *
 * 为什么合并：AI 问答历史 / 考考你历史 / 反馈队列三套测试原本各自抄了一遍
 * 「装假 window → 灌 105 条 → 断言丢最旧 → 还原」，而真正不同的只有三处：
 *   - 读出的顺序：历史是「新→旧」（prepend），反馈队列是「旧→新」（append）；
 *   - 配额写满时：历史裁到 75% 再试一次；反馈只是静默放弃本次写入（队列本身不变）；
 *   - 读取校验：历史逐条过滤坏条目；反馈队列目前**没有**单条校验（见文件末尾说明）。
 * 把这三处差异写成 `StoreShape` 的字段，公共契约只描述一次，差异用参数表达。
 *
 * 夹具：`installStorage()`（fixtures/storage.ts）替代三份手写 mock，并新增了
 * `failOnWrite` —— 原来从未被执行过的配额重试分支，现在是一条正常用例。
 *
 * 本模块只接收注入的 `test`，不导入 harness 实现。
 */
import assert from 'node:assert';

import type { TestFn } from '../../harness';
import { installStorage } from '../../fixtures/storage';
import {
  HISTORY_LIMIT,
  HISTORY_STORAGE_KEY,
  clearHistory,
  listHistory,
  relativeTime,
  saveHistory,
  trimHistoryToLimit,
} from '../../../lib/ai-history';
import {
  QUIZ_HISTORY_LIMIT,
  QUIZ_HISTORY_STORAGE_KEY,
  clearQuizHistory,
  listQuizHistory,
  saveQuizHistory,
  trimQuizHistoryToLimit,
  wrongQuizHistory,
} from '../../../lib/quiz-history';
import {
  FEEDBACK_LIMIT,
  FEEDBACK_STORAGE_KEY,
  clearFeedback,
  flushFeedbackQueue,
  loadFeedback,
  removeFeedback,
  saveFeedback,
} from '../../../lib/feedback';

/** 一个 store 在公共契约里暴露的能力；差异全部收在这里，用例正文不再分叉。 */
interface StoreShape {
  /** 用例名前缀 */
  name: string;
  /** localStorage 键，用于直接注入脏数据 */
  key: string;
  /** 默认上限（未设置「保留上限」档位时） */
  limit: number;
  /** 读出的顺序：head = 新→旧；tail = 旧→新 */
  newestAt: 'head' | 'tail';
  /** 配额写失败时的行为：retry = 裁到 75% 后重试；drop = 静默放弃本次写入 */
  quota: 'retry' | 'drop';
  /** 读取时是否逐条校验结构 */
  filtersBadEntries: boolean;
  /** 写入第 i 条（id 由 store 生成，题干/正文带序号便于断言） */
  save: (i: number) => void;
  /** 按读出顺序返回各条的「标签」 */
  labels: () => string[];
  /** 第 i 条的标签，与 `save(i)` 对应 */
  label: (i: number) => string;
  /** 读出顺序的 id 与时间戳，用于断言生成字段与排序 */
  meta: () => Array<{ id: string; ts?: number }>;
  clear: () => void;
  /** 安全裁剪；反馈队列没有该 API */
  trim?: (limit: number) => { kept: number; removed: number };
  /** 一条结构合法的记录；`filtersBadEntries` 为 true 时用于坏条目过滤用例 */
  validRow?: () => Record<string, unknown>;
}

const STORES: readonly StoreShape[] = [
  {
    name: 'AI 问答历史',
    key: HISTORY_STORAGE_KEY,
    limit: HISTORY_LIMIT,
    newestAt: 'head',
    quota: 'retry',
    filtersBadEntries: true,
    label: (i) => `问题${i}`,
    save: (i) =>
      saveHistory({
        path: '/lab/ohm',
        subject: '物理',
        topic: '欧姆定律',
        question: `问题${i}`,
        answer: `答案${i}`,
        model: 'm',
      }),
    labels: () => listHistory().map((e) => e.question),
    meta: () => listHistory().map((e) => ({ id: e.id, ts: e.ts })),
    clear: clearHistory,
    trim: trimHistoryToLimit,
    validRow: () => ({
      id: 'h1',
      ts: 1,
      path: '/lab/ohm',
      subject: '物理',
      topic: '欧姆定律',
      question: '问题1',
      answer: '答案1',
      model: 'm',
    }),
  },
  {
    name: '考考你历史',
    key: QUIZ_HISTORY_STORAGE_KEY,
    limit: QUIZ_HISTORY_LIMIT,
    newestAt: 'head',
    quota: 'retry',
    filtersBadEntries: true,
    label: (i) => `题目${i}`,
    save: (i) => saveQuizHistory(quizEntry(i, i % 2 === 0)),
    labels: () => listQuizHistory().map((e) => e.question),
    meta: () => listQuizHistory().map((e) => ({ id: e.id, ts: e.ts })),
    clear: clearQuizHistory,
    trim: trimQuizHistoryToLimit,
    validRow: () => ({
      id: 'q1',
      ts: 1,
      path: '/lab/quadratic',
      subject: '数学',
      topic: '二次函数',
      question: '题目1',
      options: ['a', 'b', 'c', 'd'],
      answerIdx: 0,
      pickedIdx: 0,
      correct: true,
      model: 'm',
    }),
  },
  {
    name: '反馈队列',
    key: FEEDBACK_STORAGE_KEY,
    limit: FEEDBACK_LIMIT,
    newestAt: 'tail',
    quota: 'drop',
    filtersBadEntries: false,
    label: (i) => `反馈${i}`,
    save: (i) => saveFeedback(feedbackRecord(i)),
    labels: () => loadFeedback().map((r) => r.message),
    meta: () => loadFeedback().map((r) => ({ id: r.id, ts: Date.parse(r.createdAt) })),
    clear: clearFeedback,
  },
];

/** 考考你记录的工厂（独立用例也要用）。 */
function quizEntry(i: number, correct: boolean) {
  return {
    path: '/lab/quadratic',
    subject: '数学',
    topic: '二次函数',
    question: `题目${i}`,
    options: ['a', 'b', 'c', 'd'],
    answerIdx: 0,
    pickedIdx: correct ? 0 : 2,
    correct,
    model: 'm',
  };
}

/** 反馈记录的工厂：id 固定，便于断言「只删目标」。 */
function feedbackRecord(i: number) {
  return {
    id: `fb-${i}`,
    type: 'project' as const,
    categories: [] as never[],
    message: `反馈${i}`,
    language: 'zh' as const,
    createdAt: new Date().toISOString(),
  };
}

/**
 * 先灌满 `limit` 条，再带着同一份数据重装一个「第 1 次写入必失败」的存储。
 *
 * `failOnWrite` 在安装时被复制进内部 Set，装好之后无法改，所以只能重装；
 * 重装时把上一份 mem 原样带过去，就得到「满队列 + 配额耗尽」的真实初态。
 */
function seededFullWithQuotaFailure(store: StoreShape) {
  const base = installStorage();
  try {
    for (let i = 0; i < store.limit; i++) store.save(i);
  } finally {
    base.restore();
  }
  return installStorage(Object.fromEntries(base.mem), { failOnWrite: [1] });
}

export function registerStorageContractTests(test: TestFn): void {
  for (const store of STORES) {
    test(`${store.name}：save → list 往返保留内容与生成的元数据`, () => {
      const h = installStorage();
      try {
        store.save(1);
        assert.deepEqual(store.labels(), [store.label(1)]);
        const [row] = store.meta();
        assert.ok(typeof row.id === 'string' && row.id.length > 0, 'id 必须是非空字符串');
        assert.ok((row.ts ?? 0) > 0, 'ts 必须是有效时间戳');
      } finally {
        h.restore();
      }
    });

    test(`${store.name}：超出上限只丢最旧，最新一条必留`, () => {
      const h = installStorage();
      try {
        const overflow = 5;
        for (let i = 0; i < store.limit + overflow; i++) store.save(i);

        const labels = store.labels();
        assert.equal(labels.length, store.limit, `上限 ${store.limit} 条`);
        // 保留集合必须**恰好**是最新 limit 条：既不能多留，也不能多删。
        const kept = Array.from({ length: store.limit }, (_, k) => store.label(k + overflow));
        assert.deepEqual([...labels].sort(), [...kept].sort(), '保留的必须恰好是最新 limit 条');

        const newest = store.label(store.limit + overflow - 1);
        if (store.newestAt === 'head') {
          assert.equal(labels[0], newest, '最新一条位于列表头部');
        } else {
          assert.equal(labels[labels.length - 1], newest, '最新一条位于列表尾部');
        }

        const ts = store.meta().map((r) => r.ts ?? 0);
        for (let i = 1; i < ts.length; i++) {
          if (store.newestAt === 'head') assert.ok(ts[i - 1] >= ts[i], '时间应倒序');
          else assert.ok(ts[i - 1] <= ts[i], '时间应正序');
        }
      } finally {
        h.restore();
      }
    });

    if (store.quota === 'retry') {
      test(`${store.name}：配额首次抛错 → 裁到 75% 后重试成功`, () => {
        const h = seededFullWithQuotaFailure(store);
        try {
          assert.doesNotThrow(() => store.save(store.limit), '存储异常不得抛给 UI');

          const labels = store.labels();
          const expected = Math.max(1, Math.floor(store.limit * 0.75));
          assert.equal(labels.length, expected, `重试前应裁到 ${expected} 条`);
          assert.ok(labels.includes(store.label(store.limit)), '新记录必须进入重试批次');
          assert.ok(!labels.includes(store.label(0)), '裁剪丢的是最旧，不是最新');
        } finally {
          h.restore();
        }
      });
    } else {
      test(`${store.name}：配额首次抛错 → 静默降级，不抛给 UI、不改动既有队列`, () => {
        const h = seededFullWithQuotaFailure(store);
        try {
          assert.doesNotThrow(() => store.save(store.limit), '存储异常不得抛给 UI');

          const labels = store.labels();
          assert.equal(labels.length, store.limit, '写入失败时既有队列保持不变');
          assert.ok(!labels.includes(store.label(store.limit)), '新记录未落盘（本次写入被放弃）');
          assert.ok(labels.includes(store.label(0)), '最旧一条不得因写失败被误删');
        } finally {
          h.restore();
        }
      });
    }

    test(`${store.name}：坏 JSON / 非数组 → 空列表（不拖垮面板）`, () => {
      for (const raw of ['{{{ not json', '{"wrong":"shape"}', 'null', '42']) {
        const h = installStorage({ [store.key]: raw });
        try {
          assert.deepEqual(store.labels(), [], `原始值 ${raw} 应回退为空列表`);
        } finally {
          h.restore();
        }
      }
    });

    if (store.filtersBadEntries && store.validRow) {
      test(`${store.name}：坏条目逐条过滤，好条目保留`, () => {
        const good = store.validRow!();
        const h = installStorage({ [store.key]: JSON.stringify([{ id: 123 }, null, 42, good]) });
        try {
          assert.deepEqual(store.labels(), [store.label(1)], '一条坏数据不得拖垮整份列表');
        } finally {
          h.restore();
        }
      });
    }

    if (store.trim) {
      const trim = store.trim;

      test(`${store.name}：trim 到更小上限只删最旧，且幂等`, () => {
        const h = installStorage();
        try {
          for (let i = 0; i < 30; i++) store.save(i);

          assert.deepEqual(trim(10), { kept: 10, removed: 20 });
          const kept = Array.from({ length: 10 }, (_, k) => store.label(k + 20));
          assert.deepEqual([...store.labels()].sort(), [...kept].sort(), '仅保留最新 10 条');
          assert.deepEqual(trim(10), { kept: 10, removed: 0 }, '第二次不得再删（幂等）');
        } finally {
          h.restore();
        }
      });

      test(`${store.name}：trim 写入失败时报告未删除，原数据不变`, () => {
        const base = installStorage();
        try {
          for (let i = 0; i < 30; i++) store.save(i);
        } finally {
          base.restore();
        }
        const h = installStorage(Object.fromEntries(base.mem), { failOnWrite: [1] });
        try {
          const before = store.labels();
          assert.deepEqual(trim(10), { kept: 30, removed: 0 }, '写入失败时不得声称已裁剪');
          assert.deepEqual(store.labels(), before, '原数据必须原样保留');
        } finally {
          h.restore();
        }
      });
    }

    test(`${store.name}：clear 后列表为空`, () => {
      const h = installStorage();
      try {
        store.save(1);
        store.clear();
        assert.deepEqual(store.labels(), []);
      } finally {
        h.restore();
      }
    });
  }

  /* ── 以下是各 store 独有的场景：无法参数化，但迁移时必须原样保住 ── */

  test('AI 问答历史：相对时间 zh / en 文案', () => {
    const now = Date.now();
    assert.match(relativeTime(now - 30_000, 'zh'), /刚刚/);
    assert.match(relativeTime(now - 30_000, 'en'), /just now/);
    assert.match(relativeTime(now - 2 * 3_600_000, 'zh'), /2 小时前/);
    assert.match(relativeTime(now - 26 * 3_600_000, 'zh'), /昨天/);
  });

  test('考考你历史：explanation 往返保留，旧数据缺字段读取为 undefined', () => {
    const h = installStorage();
    try {
      saveQuizHistory({ ...quizEntry(1, false), explanation: 'u>2f 时成倒立缩小实像，照相机原理。' });
      assert.equal(listQuizHistory()[0].explanation, 'u>2f 时成倒立缩小实像，照相机原理。');

      saveQuizHistory(quizEntry(2, true));
      const legacy = listQuizHistory().find((e) => e.question === '题目2')!;
      assert.equal(legacy.explanation, undefined, '旧数据无该字段时不得报错');
    } finally {
      h.restore();
    }
  });

  test('考考你历史：wrongQuizHistory 只返回答错记录', () => {
    const h = installStorage();
    try {
      saveQuizHistory(quizEntry(1, true));
      saveQuizHistory(quizEntry(2, false));
      saveQuizHistory(quizEntry(3, false));
      const wrong = wrongQuizHistory();
      assert.equal(wrong.length, 2);
      assert.ok(wrong.every((e) => !e.correct));
    } finally {
      h.restore();
    }
  });

  test('反馈队列：removeFeedback 只删目标记录', () => {
    const h = installStorage();
    try {
      saveFeedback(feedbackRecord(1));
      saveFeedback(feedbackRecord(2));
      saveFeedback(feedbackRecord(3));
      removeFeedback('fb-2');
      const list = loadFeedback();
      assert.deepEqual(list.map((r) => r.id), ['fb-1', 'fb-3']);
    } finally {
      h.restore();
    }
  });

  test('反馈队列：空补传之后，新入队记录仍能被补传', async () => {
    // 回归：旧实现会把已完成的 Promise 留在 flushing，之后的补传直接复用它，
    // 新记录永远发不出去。这里必须用成功响应，否则「发出去了」与「没发」不可区分。
    const anyGlobal = globalThis as any;
    const originalFetch = anyGlobal.fetch;
    const h = installStorage();
    try {
      let posts = 0;
      anyGlobal.fetch = async () => {
        posts += 1;
        return new Response(JSON.stringify({ code: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      await flushFeedbackQueue();
      assert.equal(posts, 0, '空队列不应发出请求');

      saveFeedback(feedbackRecord(7));
      await flushFeedbackQueue();
      assert.equal(posts, 1, '空补传之后的新记录必须仍能补传');
      assert.equal(loadFeedback().length, 0, '发送成功后应出队');
    } finally {
      anyGlobal.fetch = originalFetch;
      h.restore();
    }
  });
}
