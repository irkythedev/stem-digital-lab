/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI token 用量累计统计 —— 纯浏览器本地持久化（localStorage）。
 *
 * 数据结构：按模型 × 日期 两级分桶。
 *   { [model]: { [YYYY-MM-DD]: tokens } }
 *
 * 与 AI 助手会话内实时用量（usage，内存态）互补：
 * - 会话内：面板底部显示当前会话 ≈N tokens（关闭面板即清）；
 * - 本模块：跨会话累计每个模型每天用掉的 token 数，可算合并总数，
 *   也支持按日期下钻（树状图：模型 → 日期 → 用量）。
 *
 * 兼容迁移：v1 扁平格式 { model: total }（无日期维度）读入时归入
 * 「before」历史桶，避免旧数据丢失。
 *
 * 口径：用 estimateTokens（1 token ≈ 1.8 字符）估算，仅作量级参考，
 * 不等同于服务商账单。数据仅存本机浏览器，不触网。
 */
import { estimateTokens } from './ai-config';

const STORAGE_KEY = 'stem-ai-token-usage';

/** 按模型 × 日期分桶的用量数据（日期键格式 YYYY-MM-DD） */
export type TokenUsageData = Record<string, Record<string, number>>;

/** 本地日期键（YYYY-MM-DD，浏览器时区） */
function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

/** 累加一次请求的 token 消耗（按模型 + 当天分桶；模型名空用 'unknown'） */
export function addTokenUsage(model: string | undefined, tokens: number): void {
  if (typeof window === 'undefined') return;
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  const key = (model || 'unknown').trim() || 'unknown';
  const usage = loadTokenUsage();
  const day = todayKey();
  usage[key] = usage[key] || {};
  usage[key][day] = (usage[key][day] ?? 0) + Math.round(tokens);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
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

/** 便捷估算文本 token 数（复用 ai-config 的 estimateTokens，语义明确） */
export function tokensForText(text: string): number {
  return estimateTokens(text);
}
