/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI token 用量累计统计 —— 纯浏览器本地持久化（localStorage）。
 *
 * 数据结构：按模型 × 日期 两级分桶。
 *   { [model]: { [YYYY-MM-DD]: tokens } }
 * 每日总量与全期模型总量都是**推导值**，不单独存储：
 *   - 每日总量 = 该日各模型求和；
 *   - 模型总量 = 该模型各日期求和（tokenUsageModelTotal）。
 *
 * 与 AI 助手会话内实时用量（usage，内存态）互补：
 * - 会话内：面板底部显示当前会话 ≈N tokens（关闭面板即清）；
 * - 本模块：跨会话累计每个模型每天用掉的 token 数，可算合并总数，
 *   也可按日期下钻（buildDailyBars 供堆叠柱总览与日期树列表复用）。
 *
 * 保留窗口：写入时按 RETENTION_DAYS 天 FIFO 修剪（pruneTokenUsage），
 * 日期键不会无限增长，避免吃满与反馈队列 / 答题历史共享的浏览器配额。
 *
 * 兼容迁移：v1 扁平格式 { model: total }（无日期维度）读入时归入
 * 「before」历史桶，避免旧数据丢失。该桶**没有日期**，不得进入时间轴，
 * 由 buildDailyBars 汇总为 legacyTokens 单列展示。
 *
 * 口径：token 由 estimateTokens 估算 —— 汉字 / 全角符号 1 字 ≈ 1 token，
 * 其余 4 字符 ≈ 1 token（见 ai-config.ts）。仅作量级参考，不等同于服务商
 * 账单。数据仅存本机浏览器，不触网。
 */

const STORAGE_KEY = 'stem-ai-token-usage';

/** 每日用量保留窗口（天）。超出即 FIFO 丢弃，防止日期键无限增长。 */
export const RETENTION_DAYS = 90;

/** 堆叠柱参与分色的模型上限（第 6 名及以后合并为「其他」）。 */
export const CHART_MODEL_LIMIT = 5;

/** 按模型 × 日期分桶的用量数据（日期键格式 YYYY-MM-DD） */
export type TokenUsageData = Record<string, Record<string, number>>;

/** 本地日期键（YYYY-MM-DD，浏览器时区） */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 读取累计统计（损坏/异常返回空对象，绝不拖垮面板） */
export function loadTokenUsage(): TokenUsageData {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: TokenUsageData = {};
    for (const [model, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number') {
        // 旧扁平格式迁移：无日期维度 → 归入「before」历史桶
        out[model] = { before: v };
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[model] = v as Record<string, number>;
      }
      // 其他异常值忽略
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * 按保留窗口修剪日期键（纯函数，便于单测）。
 * 保留 [today - (retainDays - 1), today] 闭区间内的日期；
 * 「before」桶没有日期，永久保留（旧版本的一次性历史值）。
 */
export function pruneTokenUsage(
  usage: TokenUsageData,
  today: Date,
  retainDays: number = RETENTION_DAYS,
): TokenUsageData {
  const span = Math.max(1, Math.floor(retainDays));
  const cutoff = dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (span - 1)));
  const out: TokenUsageData = {};
  for (const [model, days] of Object.entries(usage)) {
    const kept: Record<string, number> = {};
    for (const [day, tokens] of Object.entries(days)) {
      if (day === 'before' || day >= cutoff) kept[day] = tokens;
    }
    if (Object.keys(kept).length > 0) out[model] = kept;
  }
  return out;
}

/** 累加一次请求的 token 消耗（按模型 + 当天分桶；模型名空用 'unknown'） */
export function addTokenUsage(model: string | undefined, tokens: number): void {
  if (typeof window === 'undefined') return;
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  const key = (model || 'unknown').trim() || 'unknown';
  const now = new Date();
  const usage = loadTokenUsage();
  const day = dayKey(now);
  usage[key] = usage[key] || {};
  usage[key][day] = (usage[key][day] ?? 0) + Math.round(tokens);
  const pruned = pruneTokenUsage(usage, now);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // 存储满等异常：静默放弃（统计失败不影响功能）
  }
}

/** 某个模型的累计总数（各日期之和） */
export function tokenUsageModelTotal(model: string, usage: TokenUsageData): number {
  const days = usage[model] ?? {};
  return Object.values(days).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
}

/** 合并总数（所有模型 × 所有日期之和） */
export function tokenUsageTotal(usage: TokenUsageData): number {
  return Object.values(usage).reduce(
    (sum, days) => sum + Object.values(days).reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0),
    0,
  );
}

/** 清零全部统计（只清统计，不动配置与历史） */
export function clearTokenUsage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 静默
  }
}

/* ────────────────────────── 堆叠柱聚合（纯函数） ────────────────────────── */

/** 堆叠柱的一段（某个模型在某一天的用量） */
export interface UsageBarSegment {
  /** 模型 id；第 6 名及以后合并为 '__other__' */
  model: string;
  isOther: boolean;
  tokens: number;
  /** 相对「窗口内最大日总量」的高度百分比（可直接叠加成柱总高） */
  hPct: number;
  /** 占当日总量的比例百分比（仅用于读数条，不用于画高） */
  sharePct: number;
}

/** 堆叠柱的一根（一天） */
export interface UsageBar {
  day: string;
  /** false = 该日没有任何记录。注意：无记录 ≠ 用量为 0（当天没打开过 ≠ 没消耗） */
  hasRecord: boolean;
  total: number;
  hPct: number;
  segments: UsageBarSegment[];
}

/** 堆叠柱总览所需的全部派生数据 */
export interface DailyBars {
  windowDays: number;
  /** 参与分色的模型（按窗口内总量降序，≤ CHART_MODEL_LIMIT） */
  models: string[];
  /** 被合并进「其他」的模型 id */
  otherModels: string[];
  maxDay: number;
  /** before 桶合计（无日期，须单列脚注，不进时间轴） */
  legacyTokens: number;
  bars: UsageBar[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 把两级分桶数据聚合成连续日历上的堆叠柱（纯函数）。
 *
 * 关键点：
 * 1. **日历回填**：数据里只存在「有记录」的日期键，断档日根本不存在 →
 *    必须按 windowDays 从 today 往前生成连续日期，否则横轴会丢日期、时间失真。
 * 2. **共同 y 轴**：所有柱按同一个 maxDay 归一（不是每天各自归一到 100%），
 *    这样柱高可以横向比较；分段高度 hPct 相加即柱总高。
 * 3. **before 排除**：无日期桶只汇总为 legacyTokens，绝不混进时间轴。
 * 4. 分色上限 CHART_MODEL_LIMIT，其余合并为「其他」。
 */
export function buildDailyBars(
  usage: TokenUsageData,
  windowDays: number,
  today: Date = new Date(),
): DailyBars {
  const modelTotals = Object.entries(usage)
    .map(([model, days]) => ({
      model,
      total: Object.entries(days).reduce(
        (s, [d, n]) => (d === 'before' ? s : s + (Number.isFinite(n) ? n : 0)),
        0,
      ),
    }))
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total);

  const models = modelTotals.slice(0, CHART_MODEL_LIMIT).map((m) => m.model);
  const otherModels = modelTotals.slice(CHART_MODEL_LIMIT).map((m) => m.model);
  const legacyTokens = Object.values(usage).reduce(
    (s, days) => s + (Number.isFinite(days.before) ? days.before : 0),
    0,
  );

  const span = Math.max(1, Math.floor(windowDays));
  const days: string[] = [];
  for (let i = span - 1; i >= 0; i--) {
    days.push(dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)));
  }

  const bars: UsageBar[] = days.map((day) => {
    const segments: UsageBarSegment[] = models
      .map((model) => ({ model, tokens: usage[model]?.[day] ?? 0 }))
      .filter((s) => s.tokens > 0)
      .map((s) => ({ model: s.model, isOther: false, tokens: s.tokens, hPct: 0, sharePct: 0 }));
    const otherTokens = otherModels.reduce((s, m) => s + (usage[m]?.[day] ?? 0), 0);
    if (otherTokens > 0) {
      segments.push({ model: '__other__', isOther: true, tokens: otherTokens, hPct: 0, sharePct: 0 });
    }
    return {
      day,
      hasRecord: segments.length > 0,
      total: segments.reduce((s, x) => s + x.tokens, 0),
      hPct: 0,
      segments,
    };
  });

  const maxDay = bars.reduce((m, b) => Math.max(m, b.total), 0);
  for (const bar of bars) {
    bar.hPct = maxDay > 0 ? round2((bar.total / maxDay) * 100) : 0;
    for (const seg of bar.segments) {
      seg.hPct = maxDay > 0 ? round2((seg.tokens / maxDay) * 100) : 0;
      seg.sharePct = bar.total > 0 ? round1((seg.tokens / bar.total) * 100) : 0;
    }
  }

  return { windowDays: span, models, otherModels, maxDay, legacyTokens, bars };
}
