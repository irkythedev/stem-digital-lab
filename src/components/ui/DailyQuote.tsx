/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 首页「每日科学」板块：随机展示科学名人名言与故事。
 * - 当天固定一条（按日期取模，同日不重复，有「每日一题」仪式感）
 * - 「换一条」按钮临时随机重抽（刷新后回到当天固定）
 * - 小故事默认折叠，点击展开
 * 数据来自 src/lib/quotes.ts（国内/华人科学家为主，内容经合规审核）。
 */
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { SCIENCE_QUOTES, type ScienceQuote } from '../../lib/quotes';

interface DailyQuoteProps {
  lang: 'zh' | 'en';
}

/** 当天固定索引：按本地日期天数取模（避免 UTC 时区偏移） */
function dayIndex(): number {
  const now = new Date();
  const localDay = Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000);
  return localDay % SCIENCE_QUOTES.length;
}

export default function DailyQuote({ lang }: DailyQuoteProps) {
  const [idx, setIdx] = useState(dayIndex);
  const [showStory, setShowStory] = useState(false);
  const q: ScienceQuote = SCIENCE_QUOTES[idx];

  const shuffle = () => {
    let next = Math.floor(Math.random() * SCIENCE_QUOTES.length);
    if (next === idx) next = (next + 1) % SCIENCE_QUOTES.length;
    setIdx(next);
    setShowStory(false);
  };

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
          {lang === 'zh' ? '换一条' : 'Shuffle'}
        </button>
      </div>

      <blockquote className="border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-5 sm:py-4">
        {q.quote ? (
          <p className="text-xs sm:text-base serif-font italic text-[var(--fg)] leading-relaxed">
            {lang === 'zh' ? q.quote.zh : q.quote.en}
          </p>
        ) : (
          <p className="text-xs sm:text-base serif-font text-[var(--fg)] leading-relaxed">
            {lang === 'zh' ? q.achievement?.zh : q.achievement?.en}
          </p>
        )}
        <footer className="mt-2.5 flex items-center gap-2 text-[11px] mono-font text-[var(--muted)]">
          <span className="font-bold text-[var(--fg)]">— {lang === 'zh' ? q.person.zh : q.person.en}</span>
          <span aria-hidden="true">·</span>
          <span>{lang === 'zh' ? q.field.zh : q.field.en}</span>
          <span aria-hidden="true">·</span>
          <span>{lang === 'zh' ? q.era.zh : q.era.en}</span>
        </footer>

        {/* 小故事（折叠） */}
        <div className="mt-3 border-t border-[var(--border)] pt-2.5">
          {showStory ? (
            <>
              <p className="text-xs text-[var(--muted)] serif-font leading-relaxed">
                {lang === 'zh' ? q.story.zh : q.story.en}
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
      </blockquote>
    </div>
  );
}
