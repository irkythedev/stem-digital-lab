/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * token 用量树状图弹窗：从设置页「累计用量」的明细按钮点开。
 *
 * 组织方式与 model-usage dash 一致 —— 日期为第一维：
 *   日期 → 该日各模型用量（可展开/收起）
 * 顶部显示累计总数 + 每个模型的总计。
 * 纯展示本地 localStorage 数据，不触网；视觉沿用弹窗样式（CSS 变量）。
 */
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useLockBodyScroll } from '../../lib/use-lock-body-scroll';
import { tokenUsageModelTotal, tokenUsageTotal, type TokenUsageData } from '../../lib/token-usage';

interface TokenUsageDialogProps {
  usage: TokenUsageData;
  onClose: () => void;
  lang: 'zh' | 'en';
}

export default function TokenUsageDialog({ usage, onClose, lang }: TokenUsageDialogProps) {
  useLockBodyScroll(true);
  const zh = lang !== 'en';
  // 展开的日期集合（默认全部收起；点击日期行切换）
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleDay = (day: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const total = tokenUsageTotal(usage);
  // 模型总计（顶部汇总行，按用量降序）
  const modelTotals = useMemo(
    () => Object.entries(usage)
      .map(([model]) => ({ model, total: tokenUsageModelTotal(model, usage) }))
      .filter((m) => m.total > 0)
      .sort((a, b) => b.total - a.total),
    [usage],
  );

  // 按日期聚合：day → [{model, tokens}]，倒序（最新在前），「before」历史桶排最后
  const byDay = useMemo(() => {
    const map = new Map<string, { model: string; tokens: number }[]>();
    for (const [model, days] of Object.entries(usage)) {
      for (const [day, tokens] of Object.entries(days)) {
        if (!Number.isFinite(tokens) || tokens <= 0) continue;
        const arr = map.get(day) ?? [];
        arr.push({ model, tokens });
        map.set(day, arr);
      }
    }
    const dayKeys = [...map.keys()];
    dayKeys.sort((a, b) => (a === 'before' ? 1 : b === 'before' ? -1 : b.localeCompare(a)));
    return dayKeys.map((day) => ({
      day,
      dayTotal: map.get(day)!.reduce((s, x) => s + x.tokens, 0),
      models: map.get(day)!.sort((a, b) => b.tokens - a.tokens),
    }));
  }, [usage]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={zh ? 'token 用量明细' : 'Token usage details'}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md max-h-[80vh] flex flex-col bg-[var(--bg)] border border-[var(--border)] shadow-[0_8px_24px_rgba(0,0,0,0.15)]">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div>
            <h2 className="text-xs font-bold mono-font tracking-widest">{zh ? 'TOKEN 用量明细' : 'TOKEN USAGE'}</h2>
            <p className="text-[0.625rem] mono-font text-[var(--muted)]">
              {zh ? `累计 ≈ ${total.toLocaleString()} tokens` : `≈ ${total.toLocaleString()} tokens in total`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={zh ? '关闭' : 'Close'} title={zh ? '关闭' : 'Close'} className="p-1.5 -m-1.5 text-[var(--muted)] hover:text-[var(--fg)] text-lg leading-none">×</button>
        </div>
        {/* 模型总计（一行一个，紧凑） */}
        {modelTotals.length > 0 && (
          <div className="shrink-0 px-4 py-2 border-b border-[var(--border)]/60 flex flex-wrap gap-x-3 gap-y-1">
            {modelTotals.map(({ model, total: t }) => (
              <span key={model} className="text-[0.625rem] mono-font text-[var(--muted)]">
                {model}: <span className="text-[var(--fg)] tabular-nums">≈{t.toLocaleString()}</span>
              </span>
            ))}
          </div>
        )}
        {/* 日期树状列表（滚动） */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-1">
          {byDay.length === 0 && (
            <p className="py-8 text-center text-xs text-[var(--muted)] italic">
              {zh ? '还没有使用记录。对话、出题、AI 总结的消耗会按天累计在这里。' : 'No usage yet. Chat, quiz and AI-summary usage will accumulate here by day.'}
            </p>
          )}
          {byDay.map(({ day, dayTotal, models }) => {
            const open = expanded.has(day);
            return (
              <div key={day} className="border border-[var(--border)]">
                {/* 日期行 */}
                <button
                  type="button"
                  onClick={() => toggleDay(day)}
                  className="w-full flex items-center gap-1.5 px-2.5 py-2 text-left hover:bg-[var(--accent-light)]/40 transition-colors"
                >
                  <ChevronDown className={`w-3 h-3 shrink-0 text-[var(--muted)] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                  <span className="text-xs mono-font font-bold text-[var(--fg)]">{day === 'before' ? (zh ? '此前累计' : 'before') : day}</span>
                  <span className="ml-auto text-[0.625rem] mono-font text-[var(--muted)] tabular-nums shrink-0">≈{dayTotal.toLocaleString()}</span>
                </button>
                {/* 该日各模型用量（展开时） */}
                {open && (
                  <div className="border-t border-[var(--border)] px-2.5 py-1.5 space-y-1">
                    {models.map(({ model, tokens }) => (
                      <div key={model} className="flex items-center gap-2 text-[0.625rem] mono-font">
                        <span className="w-28 shrink-0 truncate text-[var(--muted)]">{model}</span>
                        <span className="flex-1 h-1.5 bg-[var(--border)]/40 rounded-full overflow-hidden">
                          <span
                            className="block h-full bg-[var(--accent)]"
                            style={{ width: `${Math.max(4, Math.round((tokens / dayTotal) * 100))}%` }}
                          />
                        </span>
                        <span className="text-[var(--fg)] tabular-nums shrink-0">≈{tokens.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
