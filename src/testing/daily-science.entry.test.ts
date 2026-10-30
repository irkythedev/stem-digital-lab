/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 「每日科学」数据契约与编排逻辑守卫（独立入口）。
 *
 * 钉住四类硬指标：
 * 1. 数据契约：id 唯一、quote/achievement 至少一项、双语字段非空、subject 合法；
 * 2. 特殊日期：每个 quoteId 真实存在；memorial 只能指向已故先驱（era 含生卒年）；
 * 3. 日期触发：纪念日/里程碑 100% 命中，普通日期不得误挂 commemorative；
 * 4. 洗牌：最近 5 条不重复、同一人物不连续（含张謇 4 条场景）。
 *
 * 运行：npx tsx src/testing/daily-science.entry.test.ts
 */
import assert from 'node:assert/strict';
import { describe, runAll, test } from './harness';
import { SCIENCE_QUOTES } from '../lib/quotes';
import { DAILY_TIPS } from '../lib/daily-tips';
import {
  DAILY_POOL,
  SPECIAL_DATE_RULES,
  getDailyScienceEntry,
  localDayKey,
  localMonthDay,
  personKeyOf,
  pickNextRandomEntry,
} from '../lib/daily-science';

const NON_EMPTY = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

describe('每日科学（daily-science）', () => {
  test('数据契约：名言 id 唯一，quote/achievement 至少一项，双语字段完整', () => {
    const ids = new Set<string>();
    for (const q of SCIENCE_QUOTES) {
      assert.ok(NON_EMPTY(q.id), 'id 不得为空');
      assert.equal(ids.has(q.id), false, `id 重复：${q.id}`);
      ids.add(q.id);

      const hasQuote = NON_EMPTY(q.quote?.zh) && NON_EMPTY(q.quote?.en);
      const hasAchievement = NON_EMPTY(q.achievement?.zh) && NON_EMPTY(q.achievement?.en);
      assert.ok(hasQuote || hasAchievement, `${q.id} 必须至少有一条完整的 quote 或 achievement`);
      if (q.quote) assert.ok(hasQuote, `${q.id} 的 quote 必须中英双语非空`);
      if (q.achievement) assert.ok(hasAchievement, `${q.id} 的 achievement 必须中英双语非空`);

      for (const field of ['person', 'field', 'era', 'story'] as const) {
        assert.ok(NON_EMPTY(q[field]?.zh), `${q.id}.${field}.zh 不得为空`);
        assert.ok(NON_EMPTY(q[field]?.en), `${q.id}.${field}.en 不得为空`);
      }
      if (q.link) {
        assert.ok(NON_EMPTY(q.link.url) && NON_EMPTY(q.link.icon), `${q.id}.link 缺少 url/icon`);
        assert.ok(NON_EMPTY(q.link.title.zh) && NON_EMPTY(q.link.title.en), `${q.id}.link.title 必须双语`);
      }
    }
  });

  test('数据契约：考点速记 subject 合法且中英非空', () => {
    const subjects = new Set(['math', 'physics', 'chemistry']);
    for (const tip of DAILY_TIPS) {
      assert.ok(subjects.has(tip.subject), `非法 subject：${tip.subject}`);
      assert.ok(NON_EMPTY(tip.zh), '考点速记中文不得为空');
      assert.ok(NON_EMPTY(tip.en), '考点速记英文不得为空');
    }
    assert.ok(DAILY_TIPS.length >= 45, `考点速记应扩充至 45 条以上，当前 ${DAILY_TIPS.length}`);
    assert.ok(DAILY_POOL.length === SCIENCE_QUOTES.length + DAILY_TIPS.length, '展示池必须完整合并两层数据');
  });

  test('规模与结构：名言约 60 条，华人占比 ≥ 75%', () => {
    assert.ok(SCIENCE_QUOTES.length >= 58, `名言应扩充至约 60 条，当前 ${SCIENCE_QUOTES.length}`);
    const chinese = SCIENCE_QUOTES.filter((q) => q.isChinese).length;
    assert.ok(
      chinese / SCIENCE_QUOTES.length >= 0.75,
      `华人占比应 ≥ 75%，当前 ${((chinese / SCIENCE_QUOTES.length) * 100).toFixed(1)}%`,
    );
  });

  test('特殊日期映射：quoteId 必须真实存在', () => {
    const byId = new Map(SCIENCE_QUOTES.map((q) => [q.id, q]));
    const seenDates = new Set<string>();
    for (const rule of SPECIAL_DATE_RULES) {
      assert.match(rule.date, /^\d{2}-\d{2}$/, `日期键格式应为 MM-DD：${rule.date}`);
      assert.equal(seenDates.has(rule.date), false, `特殊日期重复：${rule.date}`);
      seenDates.add(rule.date);

      const quote = byId.get(rule.quoteId);
      assert.ok(quote, `${rule.date} 的 quoteId 不存在：${rule.quoteId}`);
      assert.ok(NON_EMPTY(rule.badge.zh) && NON_EMPTY(rule.badge.en), `${rule.date} badge 必须双语`);

      if (rule.kind === 'memorial') {
        assert.match(
          quote!.era.zh,
          /–\s*(18|19|20)\d{2}/,
          `${rule.date} 的缅怀条目必须写明生卒年（era 含「–卒年」）：${quote!.id} → ${quote!.era.zh}`,
        );
        assert.match(quote!.era.en, /(18|19|20)\d{2}/, `${quote!.id} 英文 era 应包含年份`);
      }
      if (rule.kind === 'milestone') {
        assert.ok(NON_EMPTY(quote!.person.zh), `${rule.date} 里程碑条目必须有可读人物`);
      }
    }
  });

  test('日期触发：纪念日与里程碑 100% 命中对应条目', () => {
    for (const rule of SPECIAL_DATE_RULES) {
      const [mm, dd] = rule.date.split('-').map(Number);
      const selection = getDailyScienceEntry(new Date(2026, mm - 1, dd));
      assert.equal(selection.entry.kind, 'quote', `${rule.date} 应返回名言条目`);
      assert.equal(selection.entry.kind === 'quote' ? selection.entry.data.id : '', rule.quoteId);
      assert.ok(selection.commemorative, `${rule.date} 必须附带 commemorative 元数据`);
      assert.equal(selection.commemorative!.kind, rule.kind);
      assert.equal(selection.commemorative!.date, rule.date);
    }
  });

  test('日期触发：10.31 钱学森、7.29 邓稼先等关键忌日确定性', () => {
    const oct31 = getDailyScienceEntry(new Date(2026, 9, 31));
    assert.equal(oct31.commemorative?.kind, 'memorial');
    assert.equal(oct31.commemorative?.quoteId, 'qiansen');
    assert.equal(oct31.entry.kind === 'quote' ? oct31.entry.data.person.zh : '', '钱学森');

    const jul29 = getDailyScienceEntry(new Date(2026, 6, 29));
    assert.equal(jul29.commemorative?.quoteId, 'dengjiaxian');
    assert.equal(jul29.entry.kind === 'quote' ? jul29.entry.data.person.zh : '', '邓稼先');

    const piDay = getDailyScienceEntry(new Date(2026, 2, 14));
    assert.equal(piDay.commemorative?.kind, 'milestone');
    assert.equal(piDay.commemorative?.quoteId, 'zuchongzhi');

    // 普通日期不得误挂纪念元数据
    const plain = getDailyScienceEntry(new Date(2026, 1, 1));
    assert.equal(plain.commemorative, undefined);
    assert.ok(plain.index >= 0 && plain.index < DAILY_POOL.length);
  });

  test('本地日期：MM-DD 与跨天键不受 UTC 偏移影响', () => {
    const date = new Date(2026, 9, 31, 23, 30);
    assert.equal(localMonthDay(date), '10-31');
    assert.equal(localDayKey(date), '2026-10-31');
    assert.equal(localDayKey(new Date(2026, 9, 31, 0, 5)), '2026-10-31');
  });

  test('洗牌：最近 5 条不重复、同一人物不连续（100 次连续调用）', () => {
    let current = 0;
    const history: number[] = [];
    for (let i = 0; i < 100; i++) {
      const next = pickNextRandomEntry(current, history);
      assert.ok(next >= 0 && next < DAILY_POOL.length, `越界下标：${next}`);
      assert.notEqual(next, current, '相邻两次不得抽到同一条目');
      for (const seen of history) {
        assert.notEqual(next, seen, '最近 5 条内不得重复');
      }
      const a = personKeyOf(current);
      const b = personKeyOf(next);
      if (a !== null && b !== null) {
        assert.notEqual(b, a, `同一人物不得连续：${a}`);
      }
      history.unshift(current);
      history.length = Math.min(history.length, 5);
      current = next;
    }
  });

  test('洗牌：张謇 4 条视为同一人物，不连续抽中', () => {
    const zhangjian = SCIENCE_QUOTES
      .map((q, index) => ({ id: q.id, index }))
      .filter(({ id }) => id.startsWith('zhangjian'));
    assert.equal(zhangjian.length, 4, '张謇应有 4 条彩蛋条目');

    for (const { index } of zhangjian) {
      for (let i = 0; i < 25; i++) {
        const next = pickNextRandomEntry(index, [], () => i / 25);
        assert.notEqual(next, index);
        assert.notEqual(personKeyOf(next), personKeyOf(index), '张謇各条目之间不得连续抽中');
      }
    }
  });
});

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);
