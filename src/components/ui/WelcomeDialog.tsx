/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 首开欢迎弹窗（双 Tab）：**实验室概览**（作品概览 / 板块 / AI 助手 / 开源与反馈 / 其他作品）
 * 与**快速上手指引**（四张能力卡片 + 单行提示，手机单列 / ≥sm 2×2）。
 * 首开自动弹出停在概览；Header 帮助入口传入 `initialTab='guide'` 直达上手指引。
 * 底部可勾选「以后不显示」→ localStorage 永久跳过；不勾选关闭 → 仅本次会话不再弹。
 *
 * 实现说明：
 *  - createPortal 挂到 body（遮罩父级若带 transform 会成为 containing block，必须 portal）
 *  - 视觉一律走 var 令牌：明暗主题由 html.dark / :root:not(.light) 切换，
 *    Tailwind 的 dark 前缀变体只认 prefers-color-scheme，手动切主题时会与站点脱节，故禁用
 *  - 无边界（borderless）块面：内容块用 --accent-light 半透明柔和填充 + rounded-xl，
 *    图标统一用圆形衬底；只有「外框、底栏分隔线、按钮」保留线框
 *  - 定高弹性：max-h-[85dvh] sm:max-h-[620px]，头/栏/底 flex-shrink-0 常驻，中间 flex-1 滚动
 *  - Esc 关闭 + 焦点落在主按钮；prefers-reduced-motion 无动画
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Atom, Calculator, Compass, GraduationCap, Library, Lightbulb, Mail, MonitorSmartphone, Printer, Shapes, Sparkles, X } from 'lucide-react';
import { GITHUB_PATH, GITEE_PATH, REPO_URLS } from '../../lib/brand-icons';
import { useApp } from '../../lib/app-context';
import { useLockBodyScroll } from '../../lib/use-lock-body-scroll';
import SubjectIcon from './SubjectIcon';
import LicenseDialog from './LicenseDialog';
import VersionDialog from '../feedback/VersionDialog';
import ExternalLinkConfirm from './ExternalLinkConfirm';
import { APP_VERSION } from '../../lib/changelog';
import { useVersionCheck } from '../../lib/use-version-check';

/** 欢迎弹窗的两个分区 */
type WelcomeTab = 'overview' | 'guide';

export default function WelcomeDialog({
  onClose,
  initialTab = 'overview',
}: {
  onClose: (permanent: boolean) => void;
  /** 初始激活的分区：首开自动弹出保持「实验室概览」；Header 帮助入口传入 'guide' */
  initialTab?: WelcomeTab;
}) {
  const { t, lang } = useApp();
  const zh = lang !== 'en';
  // 双 Tab：实验室概览 / 快速上手指引
  const [tab, setTab] = useState<WelcomeTab>(initialTab);
  // 模态弹窗打开期间锁定背景滚动（防止滚动穿透，与工具页详情弹窗一致）
  useLockBodyScroll(true);
  // AGPL-3.0 协议弹窗（点击遮罩/关闭消失，免页面跳转）
  const [showLicense, setShowLicense] = useState(false);
  // 版本历史弹窗 + 更新检测（与 Header 共用 hook）
  const [showVersion, setShowVersion] = useState(false);
  const { hasUpdate } = useVersionCheck();
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
    /* 垂直居中（items-center）。之所以现在可以居中：外框改用**定高** h-[85dvh] sm:h-[620px]，
       两页高度严格一致 → 切 Tab 时外框不重解位置（此前 max-h 下高度随内容变，居中会顶动头部 98px）。 */
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t.brandName}>
      {/* 遮罩（仅背景，不响应点击——只有「知道了」才关闭，防误触） */}
      <div
        className="absolute inset-0 bg-black/45"
        style={reduceMotion ? undefined : { animation: 'welcome-fade-in 0.3s ease' }}
        aria-hidden="true"
      />
      {/* 卡片：定高弹性约束（手机 85dvh / 桌面 680px，超高视口自动收敛）——两页同高、居中不跳位；
          680 让「实验室概览」在 PC 上无需内部滚动即可完整呈现，移动端仍走 85dvh 不变 */}
      <div
        className="relative w-full max-w-lg h-[85dvh] sm:h-[680px] sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] shadow-[var(--elev-lg)]"
        style={reduceMotion ? undefined : { animation: 'welcome-rise-in 0.35s ease' }}
      >
        {/* 顶部条：flex-shrink-0 常驻 */}
        <div className="flex-shrink-0 flex items-start justify-between gap-3 px-5 pt-4 pb-2.5">
          <div className="min-w-0">
            <h2 className="t-h2 font-bold mono-font tracking-widest">
              {t.brandName}
              {/* 版本号 + 更新提示（点击查看版本历史，与 Header 一致） */}
              <button
                type="button"
                onClick={() => setShowVersion(true)}
                title={t.versionTitle.replace('{version}', APP_VERSION)}
                aria-label={t.versionAria}
                className="tap-pad-10 ml-2 inline-flex items-center gap-1 text-[0.625rem] mono-font font-normal text-[var(--muted)] hover:text-[var(--fg)] align-middle transition-colors"
              >
                v{APP_VERSION}
                {hasUpdate && (
                  <span className="block w-1.5 h-1.5 rounded-full bg-green-500 update-dot" aria-hidden="true" />
                )}
              </button>
            </h2>
            <p className="mt-1 text-[0.625rem] leading-relaxed mono-font text-[var(--meter-v)] border-l-2 border-[var(--meter-v)] pl-2.5 flex flex-wrap items-center gap-x-1.5">
              <span>{t.welcomeTag}</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() =>
                  setPendingWork({
                    name: 'irky.dev',
                    url: 'https://irky.dev/',
                    icon: '/icons/pubg-helmet.png',
                    desc: t.authorHomeDesc,
                  })
                }
                title={t.viewAuthor}
                className="tap-pad flex items-center gap-1 text-[var(--muted)] hover:text-[var(--meter-v)] transition-colors"
              >
                <img
                  src="/icons/pubg-helmet.png"
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
            /* 触屏热区 ≥44×44：用 -m-2 抵消多出的盒尺寸，头部视觉高度不变 */
            className="-m-2 flex-shrink-0 flex items-center justify-center w-11 h-11 text-[var(--muted)] hover:text-[var(--fg)] transition-colors touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab：极简下划线（无大胶囊底槽，仅一条通栏底边） */}
        <div className="flex-shrink-0 px-5">
          <div className="flex gap-6 border-b border-[var(--border)] text-sm mb-2" role="tablist" aria-label={t.welcomeTabsAria}>
            {([
              ['overview', t.welcomeTabOverview],
              ['guide', t.welcomeTabGuide],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="tab"
                data-welcome-tab={v}
                aria-selected={tab === v}
                aria-controls={`welcome-panel-${v}`}
                onClick={() => setTab(v)}
                className={`pb-2 text-xs mono-font transition-colors touch-manipulation ${
                  tab === v
                    ? 'text-[var(--accent)] font-medium border-b-2 border-[var(--accent)]'
                    : 'text-[var(--muted)] hover:text-[var(--fg)] border-b-2 border-transparent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          id={`welcome-panel-${tab}`}
          role="tabpanel"
          /* 内容区独立纵向滚动：px-1 让滚动条贴外缘、不压卡片；pb-6 保证滚到底时末行文字完全露出；
             min-h 取 12rem——「矮视口也不会把底栏顶出去」的安全上限 */
          className="flex-1 overflow-y-auto px-1 pb-6 pt-0 min-h-[12rem]"
        >
          {/* 内容留白放在内层：mx-4 + 外层 px-1 = 20px，与头部/底栏的 px-5 对齐；滚动条落在外侧留白里 */}
          <div className="mx-4 space-y-3">
          {tab === 'overview' ? (
          <>
          {/* 多端适配 + 错题集与打印 + AI 助手：合为一块柔和填充，去掉左侧硬引用竖线 */}
          <div className="rounded-xl bg-[var(--accent-light)]/50 p-3.5 space-y-2">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--muted)]">
              <MonitorSmartphone className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{t.welcomeDevices}</span>
            </p>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--muted)]">
              <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{t.welcomeAi}</span>
            </p>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--muted)]">
              <Printer className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{t.welcomeQuiz}</span>
            </p>
          </div>

          {/* 四大板块：无边柔和填充 + 圆形图标底衬
              栅格：窄屏单列 → ≥sm 三列（三张学科卡各占一列，工具卡横跨整行）。
              早先是两列 + 工具卡跨两列，结果「化学」独占第二行左半、右边留白，
              而工具卡又被挤到第三行；三列后学科卡同排、工具卡自成一行，没有空档。
              图标校准：四科同为 24 栅格矢量图标，统一 20px + stroke-width 2（见 smoke 守卫 ④e） */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { title: zh ? '数学' : 'Math', desc: t.welcomeMath, icon: <SubjectIcon subjectId="math" className="w-5 h-5" /> },
              { title: zh ? '物理' : 'Physics', desc: t.welcomePhysics, icon: <SubjectIcon subjectId="physics" className="w-5 h-5" /> },
              { title: zh ? '化学' : 'Chemistry', desc: t.welcomeChemistry, icon: <SubjectIcon subjectId="chemistry" className="w-5 h-5" /> },
              { title: zh ? '工具' : 'Tools', desc: t.welcomeTools, icon: <Calculator className="w-5 h-5" /> },
            ].map((s, i) => (
              /* 工具卡横跨三列：它列的是六个入口，比单张学科卡长得多；只跨两列会在
                 第三列留空。窄屏单列时 col-span-3 无效，自然退回单列。 */
              <div key={i} className={`rounded-xl bg-[var(--accent-light)]/60 p-3${i === 3 ? ' sm:col-span-3' : ''}`}>
                {/* 徽标与标题同处一行 items-center → 两者中线严格对齐（此前徽标居中于整块，实测偏下 17~32px） */}
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card-bg)] text-[var(--fg)] shadow-xs"
                    aria-hidden="true"
                  >
                    {s.icon}
                  </span>
                  <div className="min-w-0 text-[0.6875rem] mono-font font-bold tracking-widest text-[var(--fg)]">{s.title}</div>
                </div>
                <p className="mt-2 text-[0.6875rem] leading-snug text-[var(--muted)]">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* 次级底注：协议 / 作者 / 反馈（邮箱带 Mail 图标、Issue 带 Gitee/GitHub 品牌图标）；姊妹作品为紧凑胶囊 */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-4 px-0.5 text-[0.6875rem] text-[var(--muted)]">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-4">
              <span>
                {t.welcomeLicenseLabel}
                <button
                  type="button"
                  onClick={() => setShowLicense(true)}
                  title="AGPL-3.0"
                  aria-label="AGPL-3.0"
                  className="tap-pad underline hover:text-[var(--fg)] mono-font transition-colors"
                >
                  AGPL-3.0
                </button>
              </span>
              <span aria-hidden="true" className="text-[var(--border)]">·</span>
              <span className="text-[var(--fg)]">{t.author}</span>
              <span aria-hidden="true" className="text-[var(--border)]">·</span>
              <span className="flex items-center gap-1.5">
                <span>{t.welcomeFeedbackLabel}</span>
                <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                <a href="mailto:king4g@yeah.net" className="tap-pad underline hover:text-[var(--fg)] transition-colors">king4g@yeah.net</a>
                <span aria-hidden="true" className="text-[var(--border)]">/</span>
              </span>
              {/* Issue 图标独立成组：13px 字形太小，p-2.5 -m-2.5 把命中盒撑到 33×33
                  而视觉与文档流不变；间距取 20px 是同尺寸下**零重叠**的下限
                  （33px 盒 + 25px 中心距 = 两侧各 8px 富余），12px 会产生 8px 重叠带。 */}
              <span className="flex items-center gap-5">
                {/* 项目仓库入口：只留品牌图标，图标自带外链确认 */}
                <ExternalLinkConfirm
                  target={{ url: REPO_URLS.gitee, name: 'Gitee' }}
                  hint={t.externalLinkHint}
                  openLabel={t.externalLinkOpen}
                  cancelLabel={t.externalLinkCancel}
                  ariaLabel="Gitee project"
                  className="tap-pad-sq flex items-center text-[var(--muted)] hover:text-[#C71D23] transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0" aria-hidden="true">
                    <path d={GITEE_PATH} />
                  </svg>
                </ExternalLinkConfirm>
                <ExternalLinkConfirm
                  target={{ url: REPO_URLS.github, name: 'GitHub' }}
                  hint={t.externalLinkHint}
                  openLabel={t.externalLinkOpen}
                  cancelLabel={t.externalLinkCancel}
                  ariaLabel="GitHub project"
                  className="tap-pad-sq flex items-center text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0" aria-hidden="true">
                    <path d={GITHUB_PATH} />
                  </svg>
                </ExternalLinkConfirm>
              </span>
            </span>

            {/* 姊妹作品：前置「作品集图标」（作品名就在后面，故不挂数字角标），后方为图标胶囊 */}
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-4">
              <span className="inline-flex shrink-0" title={t.moreWorks}>
                <Library className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              {t.works.map((w) => (
                <button
                  key={w.url}
                  type="button"
                  onClick={() => setPendingWork(w)}
                  className="tap-pad flex items-center gap-1.5 rounded-full bg-[var(--accent-light)]/70 px-2.5 py-1 transition-colors hover:bg-[var(--accent-light)]"
                >
                  <img src={w.icon} alt="" width="12" height="12" className="shrink-0 rounded-[3px] object-contain" />
                  {w.name}
                </button>
              ))}
            </span>
          </div>

          {/* 内联确认：点姊妹作品胶囊后在此展开，先看简介再决定是否跳转 */}
          {pendingWork && (
            <div ref={confirmRef} className="rounded-xl bg-[var(--bg)] p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <img src={pendingWork.icon} alt="" width="16" height="16" className="flex-shrink-0" />
                <span className="text-xs font-bold mono-font text-[var(--fg)]">{pendingWork.name}</span>
              </div>
              {pendingWork.desc && <p className="text-[0.6875rem] leading-relaxed">{pendingWork.desc}</p>}
              <p className="text-[0.625rem] mono-font break-all">{pendingWork.url}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    window.open(pendingWork.url, '_blank', 'noopener,noreferrer');
                    setPendingWork(null);
                  }}
                  className="px-2.5 py-1 text-[0.6875rem] mono-font border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors"
                >
                  {zh ? '前往' : 'Open'}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingWork(null)}
                  className="px-2.5 py-1 text-[0.6875rem] mono-font border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
                >
                  {zh ? '取消' : 'Cancel'}
                </button>
              </div>
            </div>
          )}
          </>
          ) : (
          <>
          {/* 快速上手指引 = 4 条纵向流式导览行 + 一行小字提示（每行只讲一件事） */}
          <div className="space-y-0.5">
            {([
              { icon: <Compass className="w-5 h-5" />, title: t.guideCard1Title, desc: t.guideCard1Desc },
              { icon: <Shapes className="w-5 h-5" />, title: t.guideCard2Title, desc: t.guideCard2Desc },
              { icon: <Atom className="w-5 h-5" />, title: t.guideCard3Title, desc: t.guideCard3Desc },
              { icon: <GraduationCap className="w-5 h-5" />, title: t.guideCard4Title, desc: t.guideCard4Desc },
            ]).map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-3.5 rounded-xl p-3 transition-colors hover:bg-[var(--accent-light)]/50"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-light)]/70 text-[var(--fg)]"
                  aria-hidden="true"
                >
                  {c.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-xs mono-font font-bold text-[var(--fg)]">{c.title}</div>
                  <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-[var(--muted)]">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 提示：一行精致小字 */}
          <p className="flex items-start gap-2 px-1 text-[0.625rem] leading-relaxed text-[var(--muted)]">
            <Lightbulb className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              <span className="mono-font font-bold tracking-widest text-[var(--fg)]">{t.guideTipLabel}</span>
              {zh ? '：' : ': '}
              {t.guideTipBody}
            </span>
          </p>
          </>
          )}
          </div>
        </div>

        {/* 底部操作栏：flex-shrink-0 常驻，小屏也不会被内容挤出可视区（单行布局，压低总高） */}
        <div
          className="flex-shrink-0 flex items-center justify-between gap-3 border-t border-[var(--border)]/60 px-5 pt-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <label className="flex items-center gap-2 min-h-11 text-xs text-[var(--muted)] cursor-pointer select-none">
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
                /* 桌面维持 44px；移动端收 36px + 12px 字，与左侧复选框文字同级，不再压过整条底栏。 */ 
            className="btn-solid shrink-0 px-4 py-2 text-xs mono-font font-bold border border-transparent transition-colors min-h-9 touch-manipulation rounded-md sm:min-h-11 sm:px-5 sm:text-sm"
          >
            {t.welcomeGotIt}
          </button>
        </div>
      </div>
      {showLicense && <LicenseDialog onClose={() => setShowLicense(false)} />}
      {showVersion && <VersionDialog onClose={() => setShowVersion(false)} />}
    </div>,
    document.body,
  );
}