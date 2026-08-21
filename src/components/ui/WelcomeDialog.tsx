/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 首开欢迎弹窗：首次访问时展示项目介绍（参赛作品 / 板块 / AI 助手 / 维护开源 / 反馈 / 其他作品）。
 * 底部可勾选「以后不显示」→ localStorage 永久跳过；不勾选关闭 → 仅本次会话不再弹。
 *
 * 实现纪律：
 *  - createPortal 挂到 body（遮罩父级若带 transform 会成为 containing block，必须 portal）
 *  - 书本化视觉：var 变量自适应明暗主题，无渐变阴影
 *  - Esc 关闭 + 焦点落在主按钮；prefers-reduced-motion 无动画
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Calculator, FolderKanban, Mail, MessageSquare, X } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import SubjectIcon from './SubjectIcon';
import { APP_VERSION } from '../../lib/changelog';

/* 项目主页 icon（与 Footer 同一套 SVG） */
const GITEE_PATH =
  'M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .982.796 1.778 1.778 1.778h6.015c.982 0 1.778-.796 1.778-1.778v-2.37a.594.594 0 0 1 .593-.593h1.482a.594.594 0 0 1 .593.593v2.37c0 2.29-1.856 4.148-4.148 4.148H9.777c-2.29 0-4.148-1.857-4.148-4.148v-5.63c0-2.29 1.857-4.148 4.148-4.148h8.297z';
const GITHUB_PATH =
  'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12';

export default function WelcomeDialog({ onClose }: { onClose: (permanent: boolean) => void }) {
  const { t, lang } = useApp();
  const zh = lang !== 'en';
  const [dontShow, setDontShow] = useState(false);
  // 其他作品：点击后先确认（简介 + 提示），用户决定是否跳转外部站点
  const [pendingWork, setPendingWork] = useState<{ name: string; url: string; icon: string; desc?: string } | null>(null);
  const gotItRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const reduceMotion =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Esc 关闭；初始焦点落在主按钮
  useEffect(() => {
    gotItRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(dontShow);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dontShow]);

  // 确认条展开后确保在可视范围内（移动端内容区滚动场景；block:'nearest' 仅不可见时才滚动）
  useEffect(() => {
    if (!pendingWork) return;
    const raf = requestAnimationFrame(() => {
      confirmRef.current?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [pendingWork, reduceMotion]);

  const close = () => onClose(dontShow);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t.brandName}>
      {/* 遮罩（仅背景，不响应点击——只有「知道了」才关闭，防误触） */}
      <div
        className="absolute inset-0 bg-black/45"
        style={reduceMotion ? undefined : { animation: 'welcome-fade-in 0.3s ease' }}
        aria-hidden="true"
      />
      {/* 卡片：flex 纵向布局，内容区独立滚动，底部操作栏固定可见（移动端友好） */}
      <div
        className="relative w-full max-w-lg max-h-[85vh] flex flex-col border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
        style={reduceMotion ? undefined : { animation: 'welcome-rise-in 0.35s ease' }}
      >
        {/* 顶部条 */}
        <div className="flex-shrink-0 flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold mono-font tracking-widest">
              {t.brandName}
              <span className="ml-2 text-[10px] mono-font font-normal text-[var(--muted)] align-middle">v{APP_VERSION}</span>
            </h2>
            <p className="mt-1 text-[10px] leading-relaxed mono-font text-[var(--meter-v)] border-l-2 border-[var(--meter-v)] pl-2.5 flex flex-wrap items-center gap-x-1.5">
              <span>{t.welcomeTag}</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() =>
                  setPendingWork({
                    name: 'irky.dev',
                    url: 'https://irky.dev/',
                    icon: 'https://irky.dev/img/icons/pubg-helmet.png',
                    desc: t.authorHomeDesc,
                  })
                }
                title={t.viewAuthor}
                className="flex items-center gap-1 text-[var(--muted)] hover:text-[var(--meter-v)] transition-colors"
              >
                <img
                  src="https://irky.dev/img/icons/pubg-helmet.png"
                  alt=""
                  width="12"
                  height="12"
                  className="flex-shrink-0"
                />
                <span className="font-bold">{t.author}</span>
              </button>
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t.welcomeClose}
            title={t.welcomeClose}
            className="flex-shrink-0 text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-sm leading-relaxed serif-font">{t.welcomeIntro}</p>

          {/* 多端适配 */}
          <p className="text-xs leading-relaxed mono-font text-[var(--muted)] border-l-2 border-[var(--border)] pl-2.5">
            {t.welcomeDevices}
          </p>

          {/* 板块（标题图标与全站统一：学科用 SubjectIcon，工具用 Calculator） */}
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
            {[
              { title: zh ? '数学' : 'Math', desc: t.welcomeMath, icon: <SubjectIcon subjectId="math" glyphClassName="text-[13px] leading-none" /> },
              { title: zh ? '物理' : 'Physics', desc: t.welcomePhysics, icon: <SubjectIcon subjectId="physics" className="w-3.5 h-3.5" /> },
              { title: zh ? '化学' : 'Chemistry', desc: t.welcomeChemistry, icon: <SubjectIcon subjectId="chemistry" className="w-3.5 h-3.5" /> },
              { title: zh ? '工具' : 'Tools', desc: t.welcomeTools, icon: <Calculator className="w-3.5 h-3.5" /> },
            ].map((s, i) => (
              <div key={i}>
                <div className="flex items-center gap-1.5 text-[11px] mono-font font-bold tracking-widest text-[var(--fg)]">
                  {s.icon}
                  <span>{s.title}</span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{s.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-sm leading-relaxed serif-font">{t.welcomeAi}</p>
          <p className="text-sm leading-relaxed serif-font">
            {t.welcomeMaintainPrefix}
            <Link
              to="/license"
              onClick={close}
              title="AGPL-3.0"
              aria-label="AGPL-3.0"
              className="underline hover:opacity-70 mono-font"
            >
              AGPL-3.0
            </Link>
            {t.welcomeMaintainSuffix}
          </p>

          {/* 反馈 + 项目主页 icon */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mono-font text-[var(--muted)]">
            <Mail className="w-3.5 h-3.5" />
            <span>{t.welcomeFeedbackPrefix}</span>
            <a href="mailto:king4g@yeah.net" className="underline hover:text-[var(--fg)]">
              king4g@yeah.net
            </a>
            <span>{t.welcomeFeedbackBubble} <MessageSquare className="w-3.5 h-3.5 inline-block" aria-hidden="true" /></span>
            <span>{t.welcomeFeedbackIssue}</span>
            <a
              href="https://gitee.com/K4Ricky2Win/stem-digital-lab"
              target="_blank"
              rel="noopener noreferrer"
              title="Gitee"
              aria-label="Gitee project"
              className="text-[var(--muted)] hover:text-[#C71D23] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d={GITEE_PATH} />
              </svg>
            </a>
            <a
              href="https://github.com/irkythedev/stem-digital-lab"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub"
              aria-label="GitHub project"
              className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d={GITHUB_PATH} />
              </svg>
            </a>
          </div>

          {/* 其他作品（左起，点击确认后跳转）—— 参考页脚样式 */}
          <div className="flex flex-col gap-1.5 border-t border-[var(--border)] pt-3">
            <div className="flex flex-wrap items-center justify-start gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5 text-[var(--muted)]">
                <FolderKanban className="w-3.5 h-3.5" />
                <span className="text-[10px] mono-font uppercase tracking-wider">{t.moreWorks}</span>
              </span>
              {t.works.map((w) => (
                <button
                  key={w.url}
                  type="button"
                  onClick={() => setPendingWork(w)}
                  className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
                >
                  <img src={w.icon} alt="" width="14" height="14" className="flex-shrink-0" />
                  {w.name}
                </button>
              ))}
            </div>

            {/* 内联确认：点「其他作品」后在此展开，先看简介再决定是否跳转 */}
            {pendingWork && (
              <div ref={confirmRef} className="border border-[var(--border)] bg-[var(--accent-light)] px-3 py-2.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <img src={pendingWork.icon} alt="" width="16" height="16" className="flex-shrink-0" />
                  <span className="text-xs font-bold mono-font">{pendingWork.name}</span>
                </div>
                {pendingWork.desc && <p className="text-[11px] leading-relaxed text-[var(--muted)]">{pendingWork.desc}</p>}
                <p className="text-[10px] mono-font text-[var(--muted)] break-all">{pendingWork.url}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      window.open(pendingWork.url, '_blank', 'noopener,noreferrer');
                      setPendingWork(null);
                    }}
                    className="px-2.5 py-1 text-[11px] mono-font border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--card-bg)] transition-colors"
                  >
                    {zh ? '前往' : 'Open'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingWork(null)}
                    className="px-2.5 py-1 text-[11px] mono-font border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
                  >
                    {zh ? '取消' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部：勾选 + 知道了（固定可见，不随内容滚动） */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
          <label className="flex items-center gap-2 text-xs text-[var(--muted)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="accent-[var(--fg)] w-4 h-4"
            />
            {t.welcomeDontShow}
          </label>
          <button
            ref={gotItRef}
            type="button"
            onClick={close}
            className="px-5 py-2 text-sm mono-font border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors"
          >
            {t.welcomeGotIt}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
