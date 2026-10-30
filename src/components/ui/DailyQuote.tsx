/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 首页「每日科学」板块：随机展示科学名言/成就与考点速记（自然混合，无类型切换）。
 * - 当天固定一条（按本地日期取模，同日不重复，有「每日一题」仪式感）
 * - 特殊日期（纪念日/科学里程碑）100% 覆盖当日轮转，并挂载工业铭牌边框
 * - 「翻一翻」临时随机重抽（最近 5 条不重复、同一人物不连续；刷新后回到当天固定）
 * - 小故事：桌面折叠展开；移动端直接展示前 3 行，仅在文本被截断时显示「阅读完整故事」，
 *   点击弹完整故事浮窗（减少二级折叠，且避免"点了内容一样"的尴尬）
 * 数据编排：src/lib/daily-science.ts；名言数据：src/lib/quotes.ts；考点速记：src/lib/daily-tips.ts。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RefreshCw, RotateCcw, X } from 'lucide-react';
import type { ScienceQuote } from '../../lib/quotes';
import {
  DAILY_POOL,
  getDailyScienceEntry,
  localDayKey,
  pickNextRandomEntry,
  type DailyScienceSelection,
} from '../../lib/daily-science';
import { useEscapeKey } from '../../lib/use-escape-key';

interface DailyQuoteProps {
  lang: 'zh' | 'en';
}

const SUBJECT_LABEL = {
  math: { zh: '数学', en: 'Math' },
  physics: { zh: '物理', en: 'Physics' },
  chemistry: { zh: '化学', en: 'Chemistry' },
} as const;

export default function DailyQuote({ lang }: DailyQuoteProps) {
  const [today, setToday] = useState<DailyScienceSelection>(() => getDailyScienceEntry());
  const [selection, setSelection] = useState<DailyScienceSelection>(today);
  const [recent, setRecent] = useState<number[]>([]);
  const [showStory, setShowStory] = useState(false);
  const [storyModal, setStoryModal] = useState(false);

  // Esc：两层浮层各自可退出（外链确认 / 故事弹窗）
  useEscapeKey(() => setStoryModal(false), storyModal);
  // 「翻一翻」图标翻转动画：每次点击递增 key 强制重挂载，触发一次性翻转
  const [flipKey, setFlipKey] = useState(0);
  // 移动端故事是否被截断（决定是否显示「阅读完整故事」按钮）
  const [storyClamped, setStoryClamped] = useState(false);
  const storyRef = useRef<HTMLParagraphElement>(null);
  // 彩蛋外链确认弹窗：点击 favicon 先确认再跳转
  const [pendingLink, setPendingLink] = useState<ScienceQuote['link'] | null>(null);
  useEscapeKey(() => setPendingLink(null), !!pendingLink);

  const entry = selection.entry;
  const commemorative = selection.commemorative;
  const q = entry.kind === 'quote' ? entry.data : null;
  const tip = entry.kind === 'tip' ? entry.data : null;
  const storyText = q ? (lang === 'zh' ? q.story.zh : q.story.en) : '';
  const plateClass = commemorative
    ? commemorative.kind === 'memorial'
      ? 'dq-quote--memorial'
      : 'dq-quote--milestone'
    : '';

  // 跨天检测：整页停留跨越午夜，或从后台切回时复核本地日期
  const dayKeyRef = useRef(localDayKey());
  useEffect(() => {
    const refreshIfNewDay = () => {
      const key = localDayKey();
      if (key === dayKeyRef.current) return;
      dayKeyRef.current = key;
      const next = getDailyScienceEntry();
      setToday(next);
      setSelection(next);
      setRecent([]);
      setShowStory(false);
      setStoryModal(false);
    };
    const timer = window.setInterval(refreshIfNewDay, 60_000);
    document.addEventListener('visibilitychange', refreshIfNewDay);
    window.addEventListener('focus', refreshIfNewDay);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfNewDay);
      window.removeEventListener('focus', refreshIfNewDay);
    };
  }, []);

  // 截断测量：ResizeObserver 响应窗口缩放、屏幕旋转与字体异步加载
  const measureStory = useCallback(() => {
    const el = storyRef.current;
    setStoryClamped(!!el && el.scrollHeight > el.clientHeight + 1);
  }, []);

  useLayoutEffect(() => {
    measureStory();
  }, [selection.index, lang, measureStory]);

  useEffect(() => {
    const el = storyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measureStory());
    observer.observe(el);
    return () => observer.disconnect();
  }, [selection.index, lang, measureStory]);

  const applySelection = (nextIndex: number) => {
    // 翻回当天彩蛋条目时恢复纪念元数据，普通条目则不带铭牌
    const nextCommemorative =
      today.commemorative && nextIndex === today.index ? today.commemorative : undefined;
    setSelection({
      index: nextIndex,
      entry: DAILY_POOL[nextIndex],
      ...(nextCommemorative ? { commemorative: nextCommemorative } : {}),
    });
    setFlipKey(k => k + 1);
    setShowStory(false);
    setStoryModal(false);
  };

  const shuffle = () => {
    setRecent((history) => [selection.index, ...history].slice(0, 5));
    applySelection(pickNextRandomEntry(selection.index, recent));
  };

  const restoreToday = () => {
    setRecent([]);
    applySelection(today.index);
  };

  const showRestore = Boolean(today.commemorative && today.index !== selection.index);

  const announceText = lang === 'zh'
    ? entry.kind === 'tip'
      ? `每日科学：${SUBJECT_LABEL[entry.data.subject].zh}考点速记`
      : `每日科学：${commemorative ? `${commemorative.badge.zh}，` : ''}${entry.data.person.zh}`
    : entry.kind === 'tip'
      ? `Daily Science: ${SUBJECT_LABEL[entry.data.subject].en} key point`
      : `Daily Science: ${commemorative ? `${commemorative.badge.en}, ` : ''}${entry.data.person.en}`;

  return (
    <div className="dq-root mb-8 w-full max-w-2xl mx-auto">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announceText}
      </div>

      <div className="dq-head flex items-center justify-between mb-2">
        <span className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
          // {lang === 'zh' ? '每日科学' : 'Daily Science'}
        </span>
        <div className="flex items-center gap-3">
          {showRestore && (
            <button
              type="button"
              onClick={restoreToday}
              className="compact inline-flex items-center gap-1.5 py-1 text-[0.6875rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              {lang === 'zh' ? '今日纪念' : "Today's memorial"}
            </button>
          )}
          <button
            type="button"
            onClick={shuffle}
            className="compact inline-flex items-center gap-1.5 py-1 text-[0.6875rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          >
            <RefreshCw key={flipKey} className="w-3 h-3 animate-daily-flip" />
            {lang === 'zh' ? '翻一翻' : 'Flip'}
          </button>
        </div>
      </div>

      {tip ? (
        /* 考点速记卡 */
        <blockquote className={`dq-quote border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-5 sm:py-4 ${plateClass}`}>
          <p className="text-xs sm:text-base serif-font text-[var(--fg)] leading-relaxed">
            {lang === 'zh' ? tip.zh : tip.en}
          </p>
          <footer className="mt-2.5 flex items-center gap-2 text-[0.6875rem] mono-font text-[var(--muted)]">
            <span className="font-bold text-[var(--fg)]">
              {SUBJECT_LABEL[tip.subject][lang]}
            </span>
            <span aria-hidden="true">·</span>
            <span>{lang === 'zh' ? '考点速记' : 'Key point'}</span>
          </footer>
        </blockquote>
      ) : (
        /* 名言 / 成就卡 */
        <blockquote className={`dq-quote border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-5 sm:py-4 ${plateClass}`}>
          {/* 纪念铭牌胶囊：仅特殊日期出现 */}
          {commemorative && (
            <div className="dq-badge mono-font">
              <span className="dq-badge-date">{commemorative.date.replace('-', '.')}</span>
              <span aria-hidden="true">·</span>
              <span>{lang === 'zh' ? commemorative.badge.zh : commemorative.badge.en}</span>
            </div>
          )}

          {q && q.quote ? (
            <p className="text-xs sm:text-base serif-font italic text-[var(--fg)] leading-relaxed">
              {lang === 'zh' ? q.quote.zh : q.quote.en}
            </p>
          ) : (
            <p className="text-xs sm:text-base serif-font text-[var(--fg)] leading-relaxed">
              {lang === 'zh' ? q?.achievement?.zh : q?.achievement?.en}
            </p>
          )}
          <footer className="mt-2.5 flex items-center gap-2 text-[0.6875rem] mono-font text-[var(--muted)]">
            <span className="font-bold text-[var(--fg)]">— {lang === 'zh' ? q?.person.zh : q?.person.en}</span>
            <span aria-hidden="true">·</span>
            <span>{lang === 'zh' ? q?.field.zh : q?.field.en}</span>
            <span aria-hidden="true">·</span>
            <span>{lang === 'zh' ? q?.era.zh : q?.era.en}</span>
            {/* 彩蛋外链：点击 favicon 先确认再跳转，文案完全由条目 link 提供 */}
            {q?.link && (
              <button
                type="button"
                onClick={() => setPendingLink(q.link)}
                title={lang === 'zh' ? q.link.title.zh : q.link.title.en}
                aria-label={lang === 'zh' ? q.link.title.zh : q.link.title.en}
                className="compact inline-flex items-center ml-1 text-[var(--muted)] hover:opacity-70 transition-opacity cursor-pointer"
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
                  className="mt-1 inline-block compact rounded px-1.5 py-1 text-[0.6875rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] active:bg-[var(--accent-light)] transition-colors"
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
                    className="mt-1.5 compact rounded px-1.5 py-1 text-[0.6875rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] active:bg-[var(--accent-light)] transition-colors"
                  >
                    {lang === 'zh' ? '收起' : 'Collapse'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowStory(true)}
                  className="compact rounded px-1.5 py-1 text-[0.6875rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] active:bg-[var(--accent-light)] transition-colors"
                >
                  {lang === 'zh' ? '▸ 人物小故事' : '▸ Story'}
                </button>
              )}
            </div>
          </div>
        </blockquote>
      )}

      {/* 外链确认弹窗：标题与说明均来自条目的 link 结构 */}
      {pendingLink && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label={lang === 'zh' ? '前往外部网站' : 'Open external site'}
          onClick={() => setPendingLink(null)}
        >
          <div
            className="w-full max-w-sm max-h-[90dvh] overflow-y-auto border border-[var(--border)] bg-[var(--bg)] p-4 sm:p-5 shadow-[var(--elev-lg)] rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xs font-bold tracking-widest mono-font uppercase text-[var(--fg)] mb-2">
              {lang === 'zh' ? '前往外部网站' : 'Open external site'}
            </h3>
            <p className="text-xs serif-font leading-relaxed text-[var(--fg)] mb-4">
              <span className="font-bold">{lang === 'zh' ? pendingLink.title.zh : pendingLink.title.en}</span>
              {pendingLink.desc && (
                <span className="mt-1 block text-[var(--muted)]">
                  {lang === 'zh' ? pendingLink.desc.zh : pendingLink.desc.en}
                </span>
              )}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingLink(null)}
                className="text-xs mono-font px-3 py-1.5 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] rounded-lg transition-colors touch-manipulation active:scale-95"
              >
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  window.open(pendingLink.url, '_blank', 'noopener');
                  setPendingLink(null);
                }}
                className="text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] rounded-lg transition-colors touch-manipulation active:scale-95"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label={lang === 'zh' ? '人物小故事' : 'Story'}
          onClick={() => setStoryModal(false)}
        >
          <div
            className="w-full max-w-sm max-h-[90dvh] overflow-y-auto border border-[var(--border)] bg-[var(--bg)] p-4 sm:p-5 shadow-[var(--elev-lg)] rounded-xl"
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
                className="h-7 w-7 rounded-md inline-flex items-center justify-center shrink-0 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] ghost-x transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs serif-font leading-relaxed text-[var(--fg)]">
              {storyText}
            </p>
            <p className="mt-2.5 text-[0.6875rem] mono-font text-[var(--muted)]">
              — {lang === 'zh' ? q.person.zh : q.person.en}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
