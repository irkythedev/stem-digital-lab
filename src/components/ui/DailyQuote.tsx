/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 首页「每日科学」板块：随机展示科学名言/成就与考点速记（自然混合，无类型切换）。
 * - 当天固定一条（按日期取模，同日不重复，有「每日一题」仪式感）
 * - 「换一条」按钮临时随机重抽（刷新后回到当天固定）
 * - 小故事：桌面折叠展开；移动端直接展示前 3 行，仅在文本被截断时显示「阅读完整故事」，
 *   点击弹完整故事浮窗（减少二级折叠，且避免"点了内容一样"的尴尬）
 * 数据：名言来自 src/lib/quotes.ts，考点速记来自 src/lib/daily-tips.ts。
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { SCIENCE_QUOTES, type ScienceQuote } from '../../lib/quotes';
import { DAILY_TIPS, type DailyTip } from '../../lib/daily-tips';

interface DailyQuoteProps {
  lang: 'zh' | 'en';
}

/** 合并内容池：名言（含成就条目） + 考点速记——自然混合 */
type DailyEntry = { kind: 'quote'; data: ScienceQuote } | { kind: 'tip'; data: DailyTip };
const POOL: DailyEntry[] = [
  ...SCIENCE_QUOTES.map((q) => ({ kind: 'quote' as const, data: q })),
  ...DAILY_TIPS.map((t) => ({ kind: 'tip' as const, data: t })),
];

/** 当天固定索引：按本地日期天数取模（避免 UTC 时区偏移） */
function dayIndex(): number {
  const now = new Date();
  const localDay = Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000);
  return localDay % POOL.length;
}

export default function DailyQuote({ lang }: DailyQuoteProps) {
  const [idx, setIdx] = useState(dayIndex);
  const [showStory, setShowStory] = useState(false);
  const [storyModal, setStoryModal] = useState(false);
  // 移动端故事是否被截断（决定是否显示「阅读完整故事」按钮）
  const [storyClamped, setStoryClamped] = useState(false);
  const storyRef = useRef<HTMLParagraphElement>(null);
  // 彩蛋外链确认弹窗：点击 favicon 先确认再跳转
  const [pendingLink, setPendingLink] = useState<ScienceQuote['link'] | null>(null);
  const entry: DailyEntry = POOL[idx];

  // 渲染后测量：line-clamp-3 生效（scrollHeight > clientHeight）才算截断
  useLayoutEffect(() => {
    const el = storyRef.current;
    if (el) setStoryClamped(el.scrollHeight > el.clientHeight + 1);
  }, [idx, lang]);

  const shuffle = () => {
    let next = Math.floor(Math.random() * POOL.length);
    if (next === idx) next = (next + 1) % POOL.length;
    setIdx(next);
    setShowStory(false);
    setStoryModal(false);
  };

  const q = entry.kind === 'quote' ? entry.data : null;
  const tip = entry.kind === 'tip' ? entry.data : null;
  const storyText = q ? (lang === 'zh' ? q.story.zh : q.story.en) : '';

  return (
    <div className="mb-8 w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
          // {lang === 'zh' ? '每日科学' : 'Daily Science'}
        </span>
        <button
          type="button"
          onClick={shuffle}
          className="inline-flex items-center gap-1.5 text-[11px] mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          {lang === 'zh' ? '翻一翻' : 'Flip'}
        </button>
      </div>

      {tip ? (
        /* 考点速记卡 */
        <blockquote className="border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-5 sm:py-4">
          <p className="text-xs sm:text-base serif-font text-[var(--fg)] leading-relaxed">
            {lang === 'zh' ? tip.zh : tip.en}
          </p>
          <footer className="mt-2.5 flex items-center gap-2 text-[11px] mono-font text-[var(--muted)]">
            <span className="font-bold text-[var(--fg)]">
              {lang === 'zh'
                ? tip.subject === 'math' ? '数学' : tip.subject === 'physics' ? '物理' : '化学'
                : tip.subject === 'math' ? 'Math' : tip.subject === 'physics' ? 'Physics' : 'Chemistry'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{lang === 'zh' ? '考点速记' : 'Key point'}</span>
          </footer>
        </blockquote>
      ) : (
        /* 名言 / 成就卡 */
        <blockquote className="border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-5 sm:py-4">
          {q && q.quote ? (
            <p className="text-xs sm:text-base serif-font italic text-[var(--fg)] leading-relaxed">
              {lang === 'zh' ? q.quote.zh : q.quote.en}
            </p>
          ) : (
            <p className="text-xs sm:text-base serif-font text-[var(--fg)] leading-relaxed">
              {lang === 'zh' ? q?.achievement?.zh : q?.achievement?.en}
            </p>
          )}
          <footer className="mt-2.5 flex items-center gap-2 text-[11px] mono-font text-[var(--muted)]">
            <span className="font-bold text-[var(--fg)]">— {lang === 'zh' ? q?.person.zh : q?.person.en}</span>
            <span aria-hidden="true">·</span>
            <span>{lang === 'zh' ? q?.field.zh : q?.field.en}</span>
            <span aria-hidden="true">·</span>
            <span>{lang === 'zh' ? q?.era.zh : q?.era.en}</span>
            {/* 彩蛋外链：张謇条目引 100ye.irky.dev favicon，点击了解相关文博内容 */}
            {q?.link && (
              <button
                type="button"
                onClick={() => setPendingLink(q.link)}
                title={lang === 'zh' ? q.link.title.zh : q.link.title.en}
                aria-label={lang === 'zh' ? q.link.title.zh : q.link.title.en}
                className="inline-flex items-center ml-1 text-[var(--muted)] hover:opacity-70 transition-opacity cursor-pointer"
              >
                <img
                  src={q.link.icon}
                  alt=""
                  width="14"
                  height="14"
                  className="flex-shrink-0"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              </button>
            )}
          </footer>

          {/* 小故事：桌面折叠展开；移动端展示前 3 行，仅截断时显示「阅读完整故事」 */}
          <div className="mt-3 border-t border-[var(--border)] pt-2.5">
            {/* 移动端：line-clamp-3，仅实际截断时显示按钮 */}
            <div className="sm:hidden">
              <p ref={storyRef} className="text-xs text-[var(--muted)] serif-font leading-relaxed line-clamp-3">
                {storyText}
              </p>
              {storyClamped && (
                <button
                  type="button"
                  onClick={() => setStoryModal(true)}
                  className="mt-1 inline-block text-[11px] mono-font text-[var(--muted)] hover:text-[var(--fg)] underline"
                >
                  {lang === 'zh' ? '阅读完整故事 →' : 'Read full story →'}
                </button>
              )}
            </div>

            {/* 桌面：保留折叠展开 */}
            <div className="hidden sm:block">
              {showStory ? (
                <>
                  <p className="text-xs text-[var(--muted)] serif-font leading-relaxed">
                    {storyText}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowStory(false)}
                    className="mt-1.5 text-[11px] mono-font text-[var(--muted)] hover:text-[var(--fg)] underline"
                  >
                    {lang === 'zh' ? '收起' : 'Collapse'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowStory(true)}
                  className="text-[11px] mono-font text-[var(--muted)] hover:text-[var(--fg)] underline"
                >
                  {lang === 'zh' ? '▸ 人物小故事' : '▸ Story'}
                </button>
              )}
            </div>
          </div>
        </blockquote>
      )}

      {/* 彩蛋外链确认弹窗：确认后再跳转 100ye.irky.dev */}
      {pendingLink && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={lang === 'zh' ? '前往外部网站' : 'Open external site'}
          onClick={() => setPendingLink(null)}
        >
          <div
            className="w-full max-w-sm border border-[var(--border)] bg-[var(--bg)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xs font-bold tracking-widest mono-font uppercase text-[var(--fg)] mb-2">
              {lang === 'zh' ? '前往外部网站' : 'Open external site'}
            </h3>
            <p className="text-xs serif-font leading-relaxed text-[var(--fg)] mb-4">
              {lang === 'zh' ? '即将打开「百年回响 · 江海潮声」（100ye.irky.dev）——一个人，何以让一座城百年铭记。继续？' : 'This opens "100 Years Echo · Jianghai Tides" (100ye.irky.dev) — how can one man be remembered by a city for a century? Continue?'}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingLink(null)}
                className="text-xs mono-font px-2.5 py-1 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
              >
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  window.open(pendingLink.url, '_blank', 'noopener');
                  setPendingLink(null);
                }}
                className="text-xs mono-font px-2.5 py-1 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors"
              >
                {lang === 'zh' ? '前往 →' : 'Go →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 移动端完整故事浮窗（仅故事被截断时才可达） */}
      {storyModal && q && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={lang === 'zh' ? '人物小故事' : 'Story'}
          onClick={() => setStoryModal(false)}
        >
          <div
            className="w-full max-w-sm border border-[var(--border)] bg-[var(--bg)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold tracking-widest mono-font uppercase text-[var(--fg)]">
                {lang === 'zh' ? '人物小故事' : 'Story'}
              </h3>
              <button
                type="button"
                onClick={() => setStoryModal(false)}
                aria-label={lang === 'zh' ? '关闭' : 'Close'}
                className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs serif-font leading-relaxed text-[var(--fg)]">
              {storyText}
            </p>
            <p className="mt-2.5 text-[11px] mono-font text-[var(--muted)]">
              — {lang === 'zh' ? q.person.zh : q.person.en}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
