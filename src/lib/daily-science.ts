/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 「每日科学」唯一编排层：内容池合并、特殊日期彩蛋、当日选择与「翻一翻」洗牌。
 *
 * 设计边界：
 * - 底层数据仍由 `quotes.ts`（名人名言/成就）与 `daily-tips.ts`（考点速记）维护；
 * - 本文件只做「编排 + 纯逻辑」，不依赖 React、DOM、网络或随机数全局状态；
 * - 所有日期均按**本地时区**计算，避免 UTC 偏移导致「今天」错位；
 * - 特殊日期（纪念日/里程碑）100% 覆盖当日轮转，保证纪念内容不被随机池冲掉。
 *
 * 可独立单测的导出：
 * - `getDailyScienceEntry(date)`  当日条目（含 commemorative 元数据）
 * - `pickNextRandomEntry(...)`    「翻一翻」（最近 5 条不重复 + 同一人物不连续）
 */

import { SCIENCE_QUOTES, type ScienceQuote } from './quotes';
import { DAILY_TIPS, type DailyTip } from './daily-tips';

export type DailyEntry =
  | { kind: 'quote'; data: ScienceQuote }
  | { kind: 'tip'; data: DailyTip };

/** 合并后的展示池：名言/成就在前，考点速记在后。 */
export const DAILY_POOL: readonly DailyEntry[] = Object.freeze([
  ...SCIENCE_QUOTES.map((q) => ({ kind: 'quote' as const, data: q })),
  ...DAILY_TIPS.map((t) => ({ kind: 'tip' as const, data: t })),
]);

const QUOTE_INDEX = new Map<string, number>(
  DAILY_POOL.flatMap((entry, index) =>
    entry.kind === 'quote' ? [[entry.data.id, index] as const] : [],
  ),
);

export type CommemorativeKind = 'memorial' | 'milestone';

export interface SpecialDateRule {
  /** 公历 `MM-DD`（本地时区） */
  date: string;
  /** 必须指向 `SCIENCE_QUOTES` 中真实存在的 id */
  quoteId: string;
  kind: CommemorativeKind;
  badge: { zh: string; en: string };
}

/**
 * 特殊日期彩蛋表。
 *
 * 合规约定：
 * - `memorial`（缅怀）**只允许已故先驱**，且对应条目的 `era` 必须写明生卒年；
 * - 在世科学家只能作为 `milestone` 的关联人物，绝不进入 `memorial`；
 * - 文案庄重、克制，不使用感叹号、表情符号或未经权威定论的评价。
 */
export const SPECIAL_DATE_RULES: readonly SpecialDateRule[] = Object.freeze([
  // ── 已故巨匠忌日 / 诞辰缅怀 ──
  { date: '01-16', quoteId: 'yumin', kind: 'memorial', badge: { zh: '缅怀于敏先生', en: 'In memory of Yu Min' } },
  { date: '03-19', quoteId: 'chenjingrun', kind: 'memorial', badge: { zh: '缅怀陈景润先生', en: 'In memory of Chen Jingrun' } },
  { date: '04-28', quoteId: 'xuguangxian', kind: 'memorial', badge: { zh: '缅怀徐光宪先生', en: 'In memory of Xu Guangxian' } },
  { date: '05-07', quoteId: 'wuwenjun', kind: 'memorial', badge: { zh: '缅怀吴文俊先生', en: 'In memory of Wu Wenjun' } },
  { date: '05-22', quoteId: 'yuanlongping', kind: 'memorial', badge: { zh: '缅怀袁隆平先生', en: 'In memory of Yuan Longping' } },
  { date: '06-12', quoteId: 'hualuogeng', kind: 'memorial', badge: { zh: '缅怀华罗庚先生', en: 'In memory of Hua Luogeng' } },
  { date: '07-29', quoteId: 'dengjiaxian', kind: 'memorial', badge: { zh: '缅怀邓稼先先生', en: 'In memory of Deng Jiaxian' } },
  { date: '08-24', quoteId: 'zhangjian1', kind: 'memorial', badge: { zh: '缅怀张謇先生', en: 'In memory of Zhang Jian' } },
  { date: '08-26', quoteId: 'houdebang', kind: 'memorial', badge: { zh: '缅怀侯德榜先生', en: 'In memory of Hou Debang' } },
  { date: '10-31', quoteId: 'qiansen', kind: 'memorial', badge: { zh: '缅怀钱学森先生', en: 'In memory of Qian Xuesen' } },
  { date: '12-05', quoteId: 'guoyonghuai', kind: 'memorial', badge: { zh: '纪念郭永怀先生', en: 'In memory of Guo Yonghuai' } },

  // ── 科学里程碑日 ──
  { date: '03-14', quoteId: 'zuchongzhi', kind: 'milestone', badge: { zh: '国际数学日 · 圆周率日', en: 'International Day of Mathematics · Pi Day' } },
  { date: '04-24', quoteId: 'qiansen', kind: 'milestone', badge: { zh: '中国航天日', en: 'China Space Day' } },
  { date: '10-16', quoteId: 'dengjiaxian', kind: 'milestone', badge: { zh: '中国首颗原子弹爆炸成功纪念', en: 'Anniversary of China’s first atomic bomb test' } },
  { date: '10-05', quoteId: 'tu-youyou', kind: 'milestone', badge: { zh: '屠呦呦获诺贝尔生理学或医学奖纪念', en: 'Anniversary of Tu Youyou’s Nobel Prize in Physiology or Medicine' } },
]);

const SPECIAL_DATE_INDEX = new Map<string, SpecialDateRule>(
  SPECIAL_DATE_RULES.map((rule) => [rule.date, rule]),
);

export interface CommemorativeMeta {
  kind: CommemorativeKind;
  date: string;
  badge: { zh: string; en: string };
  quoteId: string;
}

export interface DailyScienceSelection {
  /** 在 `DAILY_POOL` 中的下标 */
  index: number;
  entry: DailyEntry;
  /** 当天命中特殊日期时存在 */
  commemorative?: CommemorativeMeta;
}

/** 本地日期天数（1970-01-01 起），用于稳定轮转。 */
export function localDayNumber(date: Date = new Date()): number {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000);
}

/** 本地 `MM-DD`，例如 `10-31`。 */
export function localMonthDay(date: Date = new Date()): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 本地 `YYYY-MM-DD`，用于跨天检测。 */
export function localDayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${localMonthDay(date)}`;
}

function selectByIndex(index: number, commemorative?: CommemorativeMeta): DailyScienceSelection {
  return { index, entry: DAILY_POOL[index], ...(commemorative ? { commemorative } : {}) };
}

/**
 * 当日条目。
 *
 * 1) 本地 `MM-DD` 命中 `SPECIAL_DATE_RULES` → 100% 返回对应名言并附带纪念元数据；
 * 2) 否则按本地日期天数对池长度取模，保证同一天内刷新不变。
 */
export function getDailyScienceEntry(date: Date = new Date()): DailyScienceSelection {
  const rule = SPECIAL_DATE_INDEX.get(localMonthDay(date));
  if (rule) {
    const index = QUOTE_INDEX.get(rule.quoteId);
    if (index !== undefined) {
      return selectByIndex(index, {
        kind: rule.kind,
        date: rule.date,
        badge: rule.badge,
        quoteId: rule.quoteId,
      });
    }
    // 数据表配置错误时静默回退到常规轮转，页面不因彩蛋配置崩溃。
  }

  const poolSize = DAILY_POOL.length;
  if (poolSize === 0) {
    throw new Error('DAILY_POOL 为空：每日科学至少需要一条内容');
  }
  const index = ((localDayNumber(date) % poolSize) + poolSize) % poolSize;
  return selectByIndex(index);
}

/** 同一人物判定键：题目要求以 `person.zh` 为准（如张謇 4 条视为同一人）。 */
export function personKeyOf(index: number): string | null {
  const entry = DAILY_POOL[index];
  return entry?.kind === 'quote' ? entry.data.person.zh : null;
}

/**
 * 「翻一翻」下一张。
 *
 * 约束优先级（由严到宽，保证任何数据规模下都能返回）：
 * 1. 不等于当前条目、不在最近 `recentHistory` 中、且不与当前条目同一人物；
 * 2. 放宽人物约束（仍避开当前条目与最近历史）；
 * 3. 只避开当前条目；
 * 4. 兜底取下一项（池只有 1 条或历史覆盖全池时）。
 *
 * @param currentIndex 当前展示条目在 `DAILY_POOL` 中的下标
 * @param recentHistory 最近展示过的下标（新→旧）；组件保留最近 5 条
 * @param rng 可注入的随机源，便于单测确定性复现
 */
export function pickNextRandomEntry(
  currentIndex: number,
  recentHistory: readonly number[] = [],
  rng: () => number = Math.random,
): number {
  const poolSize = DAILY_POOL.length;
  if (poolSize === 0) {
    throw new Error('DAILY_POOL 为空：每日科学至少需要一条内容');
  }
  if (poolSize === 1) return 0;

  const normalizedCurrent = Number.isInteger(currentIndex)
    ? ((currentIndex % poolSize) + poolSize) % poolSize
    : -1;
  const recent = new Set(
    recentHistory.filter((i) => Number.isInteger(i) && i >= 0 && i < poolSize),
  );
  const currentPerson = normalizedCurrent >= 0 ? personKeyOf(normalizedCurrent) : null;

  const all = Array.from({ length: poolSize }, (_, i) => i);
  const tiers: Array<(i: number) => boolean> = [
    (i) => i !== normalizedCurrent && !recent.has(i) &&
      !(currentPerson !== null && personKeyOf(i) === currentPerson),
    (i) => i !== normalizedCurrent && !recent.has(i),
    (i) => i !== normalizedCurrent,
    () => true,
  ];

  for (const accept of tiers) {
    const candidates = all.filter(accept);
    if (candidates.length > 0) {
      const at = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
      return candidates[at];
    }
  }
  return (normalizedCurrent + 1) % poolSize;
}
