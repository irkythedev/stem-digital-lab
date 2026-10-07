/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * token 用量弹窗：从设置页「累计用量」的明细按钮点开。
 *
 * 结构（纯图形仪表盘，无列表、无滚动区）：
 *   ① 原生 SVG 堆叠柱总览（按模型分色 / 断档日发丝短横条 / 7-14-30 天窗口）
 *   ② 图表下方常驻「固定高度读数条」——刻意不做浮动 tooltip：投影稳定、零抖动、零裁切。
 *      悬停或点柱给「日期 · 合计 ≈N · 各模型 ≈绝对值 (百分比)」；未选中时回落最近一个有记录的日子，
 *      打开即有价值，不出现空读数。
 *   ③ 分色图例（全期模型总量收进 title，避免窄屏折行）
 *   before 桶没有日期，一律不进时间轴，作为底部独立脚注。
 *
 * 面板高度随内容自适应：max-h + overflow-y-auto 只作「极矮视口」的兜底，正常视口下永不出现滚动条。
 * 纯展示本地 localStorage 数据，不触网；视觉沿用弹窗样式（CSS 变量）。
 */
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../../lib/use-lock-body-scroll';
import { buildDailyBars, tokenUsageModelTotal, tokenUsageTotal, type TokenUsageData } from '../../lib/token-usage';
import { translations } from '../../lib/i18n';
import TokenUsageChart, { OTHER_COLOR } from './TokenUsageChart';

interface TokenUsageDialogProps {
  usage: TokenUsageData;
  onClose: () => void;
  lang: 'zh' | 'en';
}

/** 可选统计窗口（天）。14 天在 360px 屏节距 ≈21px，是触控最舒服的密度。 */
const WINDOWS = [7, 14, 30] as const;

/** 窗口默认值：桌面 30 天、窄屏 14 天（与设计报告的柱宽/节距测算一致） */
function defaultWindowDays(): number {
  if (typeof window === 'undefined') return 14;
  return window.innerWidth >= 640 ? 30 : 14;
}

export default function TokenUsageDialog({ usage, onClose, lang }: TokenUsageDialogProps) {
  useLockBodyScroll(true);
  const u = translations[lang].usage;
  const [windowDays, setWindowDays] = useState<number>(defaultWindowDays);
  // 当前读数日期（悬停或点柱驱动）。null = 用户未指定 → 回落最近一个有记录的日子
  const [pickDay, setPickDay] = useState<string | null>(null);

  const total = tokenUsageTotal(usage);
  // 堆叠柱总览（日历回填、共同 y 轴、before 排除都由纯函数负责）
  const daily = useMemo(() => buildDailyBars(usage, windowDays), [usage, windowDays]);
  const hasDated = daily.bars.some((b) => b.hasRecord);
  /** 最近一个有记录的柱（未选中时的默认读数；打开弹窗即有意义） */
  const latestBar = useMemo(() => [...daily.bars].reverse().find((b) => b.hasRecord) ?? null, [daily]);
  const activeBar = (pickDay ? daily.bars.find((b) => b.day === pickDay) : null) ?? latestBar;
  const drawn = daily.models.length + (daily.otherModels.length > 0 ? 1 : 0);
  // X 轴时间标尺（左 / 中 / 右）——只取日期的 MM-DD，避免柱子悬空
  const axisLabels = useMemo(() => {
    const all = daily.bars;
    if (all.length === 0) return ['', '', ''];
    const mmdd = (day: string) => (day.length >= 10 ? day.slice(5) : day);
    const mid = all[Math.floor((all.length - 1) / 2)];
    return [mmdd(all[0].day), mmdd(mid.day), mmdd(all[all.length - 1].day)];
  }, [daily]);

  // 读数条完整文案（含各模型绝对值与百分比），窄屏放不下时由 title 兜底
  const segmentText = (bar: NonNullable<typeof activeBar>) =>
    bar.hasRecord
      ? bar.segments
          .map((s) => `${s.isOther ? u.other : s.model} ≈${s.tokens.toLocaleString()} (${s.sharePct}%)`)
          .join(' · ')
      : u.noRecord;
  const readoutTitle = activeBar
    ? `${activeBar.day} · ${u.dayTotal} ≈${activeBar.total.toLocaleString()} · ${segmentText(activeBar)}`
    : u.hint;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={u.title}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md max-h-[88dvh] overflow-y-auto bg-[var(--bg)] border border-[var(--border)] shadow-[0_8px_24px_rgba(0,0,0,0.15)]">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div>
            <h2 className="t-h2 font-bold mono-font tracking-widest">{u.title}</h2>
            <p className="text-[0.625rem] mono-font text-[var(--muted)]">
              {u.totalPrefix}{total.toLocaleString()}{u.totalSuffix}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={u.close} title={u.close} className="p-1.5 -m-1.5 text-[var(--muted)] hover:text-[var(--fg)] text-lg leading-none">×</button>
        </div>

        {/* 堆叠柱总览（没有任何按天记录时不渲染空图，只留空态文案） */}
        {hasDated && (
          <div>
            <div className="flex items-center justify-between gap-2 px-3 pt-2">
              <p className="text-[0.625rem] mono-font text-[var(--muted)] truncate">
                {u.dailyTitle.replace('{n}', String(windowDays))}
              </p>
              <div className="shrink-0 inline-flex items-center gap-0 p-0.5 rounded-lg bg-[var(--accent-light)]/70 border border-[var(--border)]/60" role="group" aria-label={u.windowAria}>
                {WINDOWS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setWindowDays(d)}
                    aria-pressed={windowDays === d}
                    className={`tap-area rounded-md px-2.5 py-1.5 text-[0.6875rem] mono-font leading-none border transition-colors ${
                      windowDays === d
                        ? 'bg-[var(--card-bg)] text-[var(--fg)] font-medium border-[var(--border)]/50 shadow-xs'
                        : 'text-[var(--muted)] border-transparent hover:text-[var(--fg)]'
                    }`}
                  >
                    {d === 7 ? u.days7 : d === 14 ? u.days14 : u.days30}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-3 pt-1">
              <TokenUsageChart
                bars={daily.bars}
                models={daily.models}
                hasOther={daily.otherModels.length > 0}
                activeDay={activeBar?.day ?? null}
                onHover={setPickDay}
                onSelect={setPickDay}
                ariaLabel={u.a11yChart.replace('{n}', String(windowDays))}
              />
            </div>
            {/* X 轴时间标尺：左 / 中 / 右三点，避免柱子悬空（窄屏也只占一行 11px） */}
            {daily.bars.length >= 3 && (
              <div className="px-3 grid grid-cols-3 text-[0.625rem] mono-font text-[var(--muted)] tabular-nums">
                <span className="text-left">{axisLabels[0]}</span>
                <span className="text-center">{axisLabels[1]}</span>
                <span className="text-right">{axisLabels[2]}</span>
              </div>
            )}
            {/* 固定高度读数条：高度写死 → 悬停 / 切换窗口 / 换日都不抖动、不裁切 */}
            <div className="h-12 px-3 flex flex-col justify-center gap-0.5 overflow-hidden border-t border-[var(--border)]/60" title={readoutTitle} data-usage-readout="1">
              {activeBar ? (
                <>
                  <p className="text-[0.625rem] mono-font text-[var(--fg)] tabular-nums truncate">
                    {activeBar.day} · {u.dayTotal} ≈{activeBar.total.toLocaleString()}
                  </p>
                  <p className="text-[0.625rem] mono-font text-[var(--muted)] leading-snug">
                    {segmentText(activeBar)}
                  </p>
                </>
              ) : (
                <p className="text-[0.625rem] mono-font text-[var(--muted)] truncate">{u.hint}</p>
              )}
            </div>
            {/* 图例（只有多模型分色时才出现；单模型沿用 --accent，无需图例） */}
            {drawn > 1 && (
              <div className="px-3 py-1.5 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-[var(--border)]/60">
                {daily.models.map((model, i) => (
                  <span
                    key={model}
                    className="inline-flex items-center gap-1 text-[0.625rem] mono-font text-[var(--muted)]"
                    title={`${u.modelTotal}${tokenUsageModelTotal(model, usage).toLocaleString()}${u.totalSuffix}`}
                  >
                    <span aria-hidden="true" className="w-2 h-2 shrink-0 rounded-[2px]" style={{ background: `var(--chart-${i + 1})` }} />
                    {model}
                  </span>
                ))}
                {daily.otherModels.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[0.625rem] mono-font text-[var(--muted)]">
                    <span aria-hidden="true" className="w-2 h-2 shrink-0 rounded-[2px]" style={{ background: OTHER_COLOR }} />
                    {u.other}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* 空态：完全没有任何记录（连旧版本累计也没有）时才出现 */}
        {!hasDated && daily.legacyTokens === 0 && (
          <p className="px-4 py-8 text-center text-xs text-[var(--muted)] italic">{u.empty}</p>
        )}

        {/* before 脚注：无日期桶不进时间轴，只在此单列 */}
        {daily.legacyTokens > 0 && (
          <div className="px-3 py-1.5 border-t border-[var(--border)]/60">
            <p className="text-[0.625rem] mono-font text-[var(--muted)] leading-snug">
              {u.legacyPrefix}{daily.legacyTokens.toLocaleString()}{u.legacySuffix}
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
