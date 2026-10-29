/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * Token 用量堆叠柱守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe，**整组 6 个用例一次迁出**。
 * 用例名、断言与执行顺序与迁移前逐字相同；本套件零文件读取、零 DOM、零 async，
 * 除入口登记外无任何改写。
 *
 * 依赖特征：纯逻辑，只调 `buildDailyBars` 与配色函数。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import type { TestFn } from './harness';
import { OTHER_COLOR, segmentColor } from '../components/ui/TokenUsageChart';
import { CHART_MODEL_LIMIT, buildDailyBars, type TokenUsageData } from '../lib/token-usage';

export function registerTokenUsageBarsTests(test: TestFn): void {
  function usageOf(rows: [string, string, number][]): TokenUsageData {
    const out: TokenUsageData = {};
    for (const [model, day, tokens] of rows) {
      out[model] = out[model] ?? {};
      out[model][day] = (out[model][day] ?? 0) + tokens;
    }
    return out;
  }

  test('日历回填：断档日必须补齐为 hasRecord=false，横轴不丢日期', () => {
    const usage = usageOf([
      ['m1', '2026-10-01', 100],
      ['m1', '2026-10-04', 300],
    ]);
    const out = buildDailyBars(usage, 5, new Date(2026, 9, 5));
    assert.equal(out.bars.length, 5, '窗口 5 天必须生成 5 根柱（含断档日）');
    assert.deepEqual(
      out.bars.map((b) => b.day),
      ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'],
    );
    assert.deepEqual(out.bars.map((b) => b.hasRecord), [true, false, false, true, false]);
    assert.equal(out.bars[1].total, 0);
    assert.equal(out.bars[1].segments.length, 0);
  });

  test('共同 y 轴：柱高按窗口内最大日总量归一，分段高度之和等于柱高', () => {
    const usage = usageOf([
      ['a', '2026-10-01', 100],
      ['b', '2026-10-01', 300],
      ['a', '2026-10-02', 50],
    ]);
    const out = buildDailyBars(usage, 2, new Date(2026, 9, 2));
    assert.equal(out.maxDay, 400);
    assert.equal(out.bars[0].hPct, 100, '最大日必须满高');
    assert.equal(out.bars[1].hPct, 12.5, '50 / 400 = 12.5%');
    for (const bar of out.bars) {
      const sum = bar.segments.reduce((s, x) => s + x.hPct, 0);
      assert.ok(
        Math.abs(sum - bar.hPct) < 0.05,
        `分段高度之和(${sum})必须等于柱总高(${bar.hPct})，否则堆叠会露缝或溢出`,
      );
    }
  });

  test('before 桶不进时间轴：只汇总为 legacyTokens 单列脚注', () => {
    const usage = usageOf([['a', '2026-10-01', 100]]);
    usage.a.before = 5000;
    const out = buildDailyBars(usage, 3, new Date(2026, 9, 3));
    assert.equal(out.legacyTokens, 5000);
    assert.ok(!out.bars.some((b) => b.day === 'before'), 'before 不得成为时间轴上的一天');
    assert.ok(out.bars.every((b) => b.segments.every((s) => s.model !== 'before')));
    assert.equal(out.maxDay, 100, 'before 不参与 y 轴归一');
  });

  test('分色上限：第 6 名及以后合并为「其他」，其他段不占分类色', () => {
    const rows: [string, string, number][] = [];
    for (let i = 0; i < 8; i++) rows.push(['m' + i, '2026-10-01', 1000 - i * 10]);
    const out = buildDailyBars(usageOf(rows), 1, new Date(2026, 9, 1));
    assert.equal(out.models.length, CHART_MODEL_LIMIT);
    assert.equal(out.otherModels.length, 3);
    const seg = out.bars[0].segments.find((s) => s.isOther);
    assert.ok(seg, '必须存在「其他」合并段');
    assert.equal(seg.tokens, 950 + 940 + 930, '「其他」= 第 6/7/8 名（950+940+930）之和');
    assert.equal(out.bars[0].segments.length, 6, '5 个分色模型 + 1 个「其他」');
  });

  test('空数据：不崩、不产生 NaN', () => {
    const out = buildDailyBars({}, 4, new Date(2026, 9, 4));
    assert.equal(out.bars.length, 4);
    assert.equal(out.maxDay, 0);
    assert.ok(out.bars.every((b) => b.hPct === 0 && !b.hasRecord));
    assert.equal(out.legacyTokens, 0);
  });

  test('单模型回到 --accent，多模型走 --chart-N，其他段用中性灰', () => {
    const single = buildDailyBars(usageOf([['only', '2026-10-01', 123]]), 2, new Date(2026, 9, 2));
    assert.deepEqual(single.models, ['only']);
    assert.equal(single.otherModels.length, 0);
    assert.equal(
      segmentColor(0, single.models.length + (single.otherModels.length > 0 ? 1 : 0)),
      'var(--accent)',
      '单模型必须回到 --accent（与旧单色迷你条语言连续）',
    );
    assert.equal(segmentColor(0, 3), 'var(--chart-1)');
    assert.equal(segmentColor(2, 3), 'var(--chart-3)');
    assert.equal(OTHER_COLOR, 'var(--border-strong)');
  });
}
