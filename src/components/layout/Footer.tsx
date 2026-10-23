/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 页脚：作者信息 + 免责声明 + Gitee 外链 + 版权。
 * 从原 App.tsx 抽出。免责声明点击展开，Gitee 保留官方红色 icon 悬停显示项目地址。
 */
import { GITHUB_PATH, GITEE_PATH, ISSUE_URLS } from '../../lib/brand-icons';
import { useState } from 'react';
import { Share2, Library, Mail, Network } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import ShareDialog from '../feedback/ShareDialog';
import InstallAppButton from '../feedback/InstallAppButton';
import LicenseDialog from '../ui/LicenseDialog';
import ExternalLinkConfirm from '../ui/ExternalLinkConfirm';

export default function Footer() {
  const { t } = useApp();
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showWorks, setShowWorks] = useState(false);
  // AGPL-3.0 协议弹窗（点击遮罩/关闭消失，免页面跳转）
  const [showLicense, setShowLicense] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://stem.irky.dev/';

  // 运行架构页（public 下的静态页，线上路径 /architecture.html）：
  // 新标签打开完整查看器；带上当前主题，避免点开时明暗跳变。
  const archTheme = typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const archUrl = `/architecture.html?theme=${archTheme}`;

  return (
    <footer className="w-full border-t border-[var(--border)] py-6 text-[0.625rem] text-[var(--muted)] mono-font uppercase tracking-wider transition-colors duration-[var(--dur-base)]" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
      {/* 顶线满幅通栏：border 落在满宽 footer 上；内容由内层容器收回正文列（同 Header 算法） */}
      <div className="mx-auto flex w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl flex-col sm:flex-row justify-between items-center gap-4 px-6 sm:px-12 lg:px-14">
      <div className="flex flex-col sm:flex-row items-center gap-y-1 sm:gap-x-3 text-center sm:text-left">
        {/* 作者名 + 邮箱 icon：同行（移动端也保持同行，不换行）。
            leading-none 是这一行的关键：页脚继承了 tracking-wider + 10px 字号，
            默认行高会让「作者 / 分隔符 / 角色」三段的文字基线各差 1~2px；
            统一 leading-none + items-center 后三者中线对齐。 */}
        <span className="inline-flex items-center justify-center leading-none sm:justify-start gap-1.5">
          <a
            href="https://irky.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 leading-none hover:opacity-80 transition-opacity py-2 -my-2 tap-area"
            title="irky.dev"
          >
            <img
              src="/icons/pubg-helmet.png"
              alt="irky.dev favicon"
              width="14"
              height="14"
              className="flex-shrink-0"
            />
            <span className="font-bold text-[var(--fg)]">{t.author}</span>
          </a>
          {/* 邮箱：点击调起本地邮件客户端给作者发邮件 */}
          <a
            href="mailto:king4g@yeah.net"
            aria-label={t.emailAuthor}
            title={t.emailAuthor}
            className="inline-flex items-center leading-none text-[var(--muted)] hover:text-[var(--fg)] transition-colors p-1.5"
          >
            <Mail className="w-3.5 h-3.5" />
          </a>
        </span>
        <span className="hidden sm:inline-flex items-center self-center leading-none text-[var(--border)]" aria-hidden="true">
          /
        </span>
        <span className="inline-flex items-center gap-2 leading-none">
          <span>{t.authorRole}</span>
          {/* 其他作品：作品集图标 + 科技蓝角标，点击展开（与项目描述同行）。
              角标与 hover 动效写在 index.css（.footer-works-*），这里只挂钩子。 */}
          {t.works.length > 0 && (
          <span className="footer-works relative inline-flex items-center">
            <button
              type="button"
              onClick={() => setShowWorks((v) => !v)}
              aria-expanded={showWorks}
              aria-label={`${t.moreWorks} — ${t.moreWorksHint}`}
              className="tap-y flex items-center leading-none text-[var(--muted)] hover:text-[var(--fg)] transition-colors p-1.5"
            >
              {/* 角标锚定到图标（相对 16px 图标 -6px 贴角），避免相对按钮时随 p-1.5 悬空 */}
              <span className="footer-works-glyph relative inline-flex">
                <Library className="w-4 h-4" />
                <span className="footer-works-badge absolute -top-2.5 -right-1.5 flex h-[0.95rem] min-w-[1rem] items-center justify-center rounded-[0.25rem] px-1 text-[0.5rem] leading-none text-white mono-font">
                  {t.works.length}
                </span>
              </span>
            </button>
            {/* 浮层提示：展开作品集时收起——两者都定位在图标上方，同时出现会叠在一起 */}
            {!showWorks && (
              <span className="footer-works-tip" aria-hidden="true">{t.moreWorksHint}</span>
            )}
            {showWorks && (
              <span className="absolute right-0 sm:left-0 sm:right-auto bottom-full mb-2 z-20 flex flex-col gap-1.5 bg-[var(--bg)] border border-[var(--border)] p-2 shadow-[0_4px_16px_rgba(0,0,0,0.1)] w-max max-w-[min(16rem,calc(100vw-2rem))]">
                {t.works.map((w) => (
                  <a
                    key={w.url}
                    href={w.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--fg)] transition-colors leading-snug"
                  >
                    <img src={w.icon} alt="" width="14" height="14" className="flex-shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    <span className="normal-case tracking-normal">{w.name}</span>
                  </a>
                ))}
              </span>
            )}
          </span>
          )}
        </span>
      </div>

      <div className="flex flex-col items-center gap-1.5 text-center">
        {/* 顺序：文本项在前、图标项在后（纯文字 → 小图标，视觉过渡平滑）。
            安装引导按钮渲染为文字按钮，故并入文本组（在 AGPL-3.0 之后）。 */}
        <div className="flex items-center gap-5 sm:gap-4">
          <button
            type="button"
            onClick={() => setShowDisclaimer((v) => !v)}
            aria-expanded={showDisclaimer}
            className="tap-y inline-flex items-center justify-center min-h-[1.625rem] rounded px-1.5 py-1 hover:text-[var(--fg)] active:bg-[var(--accent-light)] transition-colors"
          >
            {t.disclaimerLabel}
          </button>
          <button
            type="button"
            onClick={() => setShowLicense(true)}
            title="AGPL-3.0"
            aria-label="AGPL-3.0"
            className="tap-y inline-flex items-center justify-center min-h-[1.625rem] rounded px-1.5 py-1 hover:text-[var(--fg)] active:bg-[var(--accent-light)] transition-colors"
          >
            {t.licenseLabel}
          </button>
          <InstallAppButton />
          {/* 运行架构：新标签打开脱敏后的架构演示页（完整查看器，非站内 iframe 裁剪版） */}
          <a
            href={archUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={t.architecture}
            aria-label={t.architecture}
            className="tap-icon flex items-center text-[var(--muted)] hover:text-[var(--fg)] transition-colors p-1.5"
          >
            <Network className="w-3.5 h-3.5" />
          </a>
          {/* 分享：icon + hover 显示「分享」；二维码从按钮位置向上弹出（anchored popover，移动端/PC 一致） */}
          <span className="relative">
            <button
              type="button"
              onClick={() => setShowShare(true)}
              title={t.share}
              aria-label={t.share}
              className="tap-icon flex items-center text-[var(--muted)] hover:text-[var(--fg)] transition-colors p-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            {showShare && <ShareDialog url={shareUrl} onClose={() => setShowShare(false)} anchored />}
          </span>
        </div>
        {showDisclaimer && (
          <span className="max-w-xs normal-case leading-snug">{t.disclaimer}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-4 sm:gap-x-2.5 sm:gap-y-1">
        <span>© 2026 STEM DIGITAL LAB</span>
        <ExternalLinkConfirm
          target={{ url: ISSUE_URLS.gitee, name: 'Gitee' }}
          hint={t.externalLinkHint}
          openLabel={t.externalLinkOpen}
          cancelLabel={t.externalLinkCancel}
          ariaLabel="Gitee project"
          className="tap-icon flex items-center text-[var(--muted)] hover:text-[#C71D23] transition-colors p-1.5"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="flex-shrink-0"
            aria-hidden="true"
          >
            <path d={GITEE_PATH} />
          </svg>
        </ExternalLinkConfirm>
        <ExternalLinkConfirm
          target={{ url: ISSUE_URLS.github, name: 'GitHub' }}
          hint={t.externalLinkHint}
          openLabel={t.externalLinkOpen}
          cancelLabel={t.externalLinkCancel}
          ariaLabel="GitHub project"
          className="tap-icon flex items-center text-[var(--muted)] hover:text-[var(--fg)] transition-colors p-1.5"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="flex-shrink-0"
            aria-hidden="true"
          >
            <path d={GITHUB_PATH} />
          </svg>
        </ExternalLinkConfirm>
      </div>
      </div>
      {showLicense && <LicenseDialog onClose={() => setShowLicense(false)} />}
    </footer>
  );
}
