/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 考考你错题集「学情概览」——纯本地聚合层（无网络、无支付、确定性）。
 *
 * 作用：把 QuizHistoryEntry[] 翻译成学生可读的学习诊断：
 * - 科目正确率条（快速看哪科弱）；
 * - 薄弱知识点 TOP（按错题频次与正确率排序）；
 * - 错误类型归类（超时未答 / 概念混淆 / 犹豫答错 / 过快答错 / 其他）；
 * - 最近 vs 整体正确率趋势；
 * - 供 AI 归纳用的错题清单文本（可测、可截断）。
 *
 * 全部为纯函数，输入条目、输出结构，便于单测与复用。阈值（中位数倍数）标注为
 * 可调常量，后续可在真实数据上微调。
 */
import type { QuizHistoryEntry } from './quiz-history';

/** 错误归类标签（中文/英文由 UI 层映射，此处仅用内部 token） */
export type ErrorKind = 'timeout' | 'confuse' | 'slow' | 'fast' | 'plain';

/** 单个错误归于哪一类：多数情况由 `classifyErrorKind` 判定，`counts` 用于概念混淆频次判定 */
export function classifyErrorKind(e: QuizHistoryEntry): ErrorKind {
  if (e.correct) return 'plain'; // 未用：正确题不进入错误归类，防御性返回
  if (e.timedOut) return 'timeout';
  return 'plain';
}

/** 求一组数字的中位数（用于慢/快阈值；mutation-free，输入为空返回 0） */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface TopicStat {
  /** 知识点（清洗为不带括号后缀的短名） */
  topic: string;
  subject: string;
  total: number;
  wrong: number;
  /** 正确率 0-100（四舍五入） */
  rate: number;
}

export interface SubjectStat {
  subject: string;
  total: number;
  correct: number;
  /** 正确率 0-100（四舍五入） */
  rate: number;
}

export interface ErrorKindStat {
  timeout: number;
  confuse: number;
  slow: number;
  fast: number;
  plain: number;
}

export interface QuizOverview {
  total: number;
  correct: number;
  wrong: number;
  /** 整体正确率 0-100 */
  rate: number;
  subjects: SubjectStat[];
  /** 薄弱知识点 TOP（按错误数降序、再按正确率升序），最多 `limit` 个 */
  weakTopics: TopicStat[];
  errorKinds: ErrorKindStat;
  /** 最近 N 条 vs 全部正确率；不足 N 条或全记录为空时为 null */
  trend: { recentRate: number; overallRate: number; recentCount: number } | null;
}

/** 知识点清洗：去掉括号及其中内容（如「凸透镜成像（考点）」→「凸透镜成像」） */
function cleanTopic(topic: string | undefined, subject?: string): string {
  if (!topic) return subject || '未分类';
  const cleaned = topic.replace(/[（(].*?[）)]/g, '').trim();
  return cleaned || subject || '未分类';
}

/** 慢/快阈值：慢 = 用时 ≥ 该科中位数 ×2；快 = 用时 ≤ 该科中位数 ×0.5 */
export const SLOW_MULT = 2;
export const FAST_MULT = 0.5;
/** 概念混淆：同「科目+知识点」下，错题选中同一干扰项（pickedIdx）≥ 2 次即视为反复混淆 */
export const CONFUSE_MIN_COUNT = 2;

/**
 * 判定一批错题的错误类型归类（慢/快阈值按所属科目独立计算，快慢项都基于各自经时）。
 * @param entries 输入的作答记录（应为当前筛选范围内的记录，可含正确题——正确题不计入分类）
 */
export function computeErrorKinds(entries: QuizHistoryEntry[]): ErrorKindStat {
  const stat: ErrorKindStat = { timeout: 0, confuse: 0, slow: 0, fast: 0, plain: 0 };
  const wrongs = entries.filter((e) => !e.correct);
  if (wrongs.length === 0) return stat;

  // 慢/快阈值按科目取经时中位数
  const bySubject = new Map<string, number[]>();
  for (const e of wrongs) {
    if (e.elapsedMs && e.elapsedMs > 0 && !e.timedOut) {
      const subj = e.subject || '未分类';
      const arr = bySubject.get(subj) ?? [];
      arr.push(e.elapsedMs);
      bySubject.set(subj, arr);
    }
  }
  const medBySubject = new Map<string, number>();
  for (const [subj, arr] of bySubject) {
    medBySubject.set(subj, median(arr));
  }

  // 概念混淆频次：同(科目+知识点)下重复选同一干扰项
  const pickCount = new Map<string, number>();
  for (const e of wrongs) {
    if (e.pickedIdx == null || e.pickedIdx < 0) {
      const key = `${e.subject}|${e.topic}|absent`;
      pickCount.set(key, (pickCount.get(key) ?? 0) + 1);
      continue;
    }
    const key = `${e.subject}|${e.topic}|${e.pickedIdx}`;
    pickCount.set(key, (pickCount.get(key) ?? 0) + 1);
  }

  for (const e of wrongs) {
    if (e.timedOut) {
      stat.timeout++;
      continue;
    }
    // 概念混淆：同科同知识点重复选中同一干扰项
    const pickKey = e.pickedIdx != null && e.pickedIdx >= 0
      ? `${e.subject}|${e.topic}|${e.pickedIdx}`
      : `${e.subject}|${e.topic}|absent`;
    if ((pickCount.get(pickKey) ?? 0) >= CONFUSE_MIN_COUNT) {
      stat.confuse++;
      continue;
    }
    const med = medBySubject.get(e.subject || '未分类') ?? 0;
    const ms = e.elapsedMs ?? 0;
    if (med > 0 && ms >= med * SLOW_MULT) {
      stat.slow++;
    } else if (med > 0 && ms > 0 && ms <= med * FAST_MULT) {
      stat.fast++;
    } else {
      stat.plain++;
    }
  }
  return stat;
}

/**
 * 综合概览：科目正确率条 + 薄弱知识点 TOP + 整体/最近趋势。
 * @param entries 输入的作答记录（含正确与错误，排序不分先后的最新在前即可）
 * @param weakLimit 薄弱知识点最多返回个数（默认 3）
 * @param trendWindow 趋势对比窗口（最近多少条，默认 10）
 * @param overallRateOverride 整体正确率覆盖（0-100）；用于「仅错题」等筛选视图下，
 *        trend 的 overall 应取全量正确率而非筛选后的（否则 recent 与 overall 同批无对比意义）。
 *        缺省 = entries 自身正确率。
 */
export function computeQuizOverview(
  entries: QuizHistoryEntry[],
  weakLimit = 3,
  trendWindow = 10,
  overallRateOverride?: number,
): QuizOverview {
  const total = entries.length;
  const correct = entries.filter((e) => e.correct).length;
  const wrong = total - correct;
  const rate = total > 0 ? Math.round((correct / total) * 100) : 0;

  // 科目
  const subjMap = new Map<string, { total: number; correct: number }>();
  for (const e of entries) {
    const subj = e.subject || '未分类';
    const prev = subjMap.get(subj) ?? { total: 0, correct: 0 };
    prev.total++;
    if (e.correct) prev.correct++;
    subjMap.set(subj, prev);
  }
  const subjects: SubjectStat[] = [...subjMap.entries()]
    .map(([subject, { total: t, correct: c }]) => ({
      subject,
      total: t,
      correct: c,
      rate: t > 0 ? Math.round((c / t) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // 薄弱知识点
  const topicMap = new Map<string, TopicStat>();
  for (const e of entries) {
    const topic = cleanTopic(e.topic, e.subject);
    const key = `${e.subject}|${topic}`;
    const prev = topicMap.get(key) ?? { topic, subject: e.subject || '未分类', total: 0, wrong: 0, rate: 0 };
    prev.total++;
    if (!e.correct) prev.wrong++;
    topicMap.set(key, prev);
  }
  const weakTopics: TopicStat[] = [...topicMap.values()]
    .map((st) => ({ ...st, rate: st.total > 0 ? Math.round(((st.total - st.wrong) / st.total) * 100) : 0 }))
    .filter((st) => st.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || a.rate - b.rate)
    .slice(0, weakLimit);

  // 趋势：最近 N 条 vs 全量正确率（全量正确率 = override 或 entries 自身）
  let trend: QuizOverview['trend'] = null;
  if (total > 0) {
    const recent = entries.slice(0, trendWindow);
    if (recent.length > 0) {
      const recentCorrect = recent.filter((e) => e.correct).length;
      const overall = rate;
      trend = {
        recentRate: Math.round((recentCorrect / recent.length) * 100),
        overallRate: overallRateOverride ?? overall,
        recentCount: recent.length,
      };
    }
  }

  const errorKinds = computeErrorKinds(entries);

  return { total, correct, wrong, rate, subjects, weakTopics, errorKinds, trend };
}

/** 供 AI 归纳用的错题清单文本（可截断，默认最多 30 条，每题题干+选项各截到指定长度） */
export function buildQuizRecordsForSummary(
  entries: QuizHistoryEntry[],
  limit = 30,
  perFieldChars = 200,
): string {
  if (entries.length === 0) return '';
  return entries.slice(0, limit).map((e, i) => {
    // 选项下标防御性 clamp：localStorage 数据可被篡改，越界/非法值统一回退（防 fromCharCode 产生怪字符/NUL）
    const safeIdx = (idx: number | undefined, fallback: string): string =>
      typeof idx === 'number' && Number.isFinite(idx) && idx >= 0 && idx <= 3 ? String.fromCharCode(65 + idx) : fallback;
    const picked = safeIdx(e.pickedIdx, '无');
    const answer = safeIdx(e.answerIdx, '未知');
    const trunc = (s: string) => (s.length > perFieldChars ? s.slice(0, perFieldChars) + '…' : s);
    const timeInfo = e.timedOut
      ? '（超时未答）'
      : e.timeLimit && e.timeLimit > 0
        ? `（限时 ${e.timeLimit}s，实际 ${Math.round((e.elapsedMs ?? 0) / 1000)}s）`
        : '';
    const optionText = e.options && e.options.length > 0
      ? `\n选项：${e.options.map((o) => trunc(o)).join('｜')}`
      : '';
    const explText = e.explanation ? `\n解析：${trunc(e.explanation)}` : '';
    return `【第${i + 1}题】${e.subject || ''}${e.topic ? ` · ${e.topic}` : ''}${timeInfo}\n题目：${trunc(e.question)}${optionText}\n你的选择：${picked} / 正确答案：${answer}${explText}`;
  }).join('\n\n');
}
