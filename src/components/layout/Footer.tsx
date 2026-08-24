/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 页脚：作者信息 + 免责声明 + Gitee 外链 + 版权。
 * 从原 App.tsx 抽出。免责声明点击展开，Gitee 保留官方红色 icon 悬停显示项目地址。
 */
import { useState } from 'react';
import { Share2, Library, Mail } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import ShareDialog from '../feedback/ShareDialog';
import InstallAppButton from '../feedback/InstallAppButton';
import LicenseDialog from '../ui/LicenseDialog';

export default function Footer() {
  const { t } = useApp();
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showWorks, setShowWorks] = useState(false);
  // AGPL-3.0 协议弹窗（点击遮罩/关闭消失，免页面跳转）
  const [showLicense, setShowLicense] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://stem.irky.dev/';

  return (
    <footer className="w-full py-6 border-t border-[var(--border)] flex flex-col sm:flex-row justify-between items-center gap-4 text-[0.625rem] text-[var(--muted)] mono-font uppercase tracking-wider transition-colors duration-200" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
      <div className="flex flex-col sm:flex-row items-center sm:space-x-3 text-center sm:text-left">
        {/* 作者名 + 邮箱 icon：同行（移动端也保持同行，不换行） */}
        <span className="inline-flex items-center justify-center sm:justify-start gap-1.5">
          <a
            href="https://irky.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 hover:opacity-80 transition-opacity py-2 -my-2"
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
            className="inline-flex items-center text-[var(--muted)] hover:text-[var(--fg)] transition-colors p-1.5 -m-1.5"
          >
            <Mail className="w-3.5 h-3.5" />
          </a>
        </span>
        <span className="hidden sm:inline text-[var(--border)]" aria-hidden="true">
          /
        </span>
        <span className="inline-flex items-center gap-2">
          <span>{t.authorRole}</span>
          {/* 其他作品：作品集图标 + 圆角数字徽标，点击展开（与项目描述同行） */}
          {t.works.length > 0 && (
          <span className="relative">
            <button
              type="button"
              onClick={() => setShowWorks((v) => !v)}
              aria-expanded={showWorks}
              title={t.moreWorks}
              aria-label={t.moreWorks}
              className="relative flex items-center text-[var(--muted)] hover:text-[var(--fg)] transition-colors p-1.5 -m-1.5"
            >
              <Library className="w-4 h-4" />
              <span className="absolute -top-2 -right-2 min-w-[1rem] h-[0.95rem] px-1 flex items-center justify-center rounded-[0.25rem] bg-[#C71D23] text-white text-[0.5rem] mono-font leading-none">
                {t.works.length}
              </span>
            </button>
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
        <div className="flex items-center gap-4">
          {/* 分享：icon + hover 显示「分享」 */}
          <button
            type="button"
            onClick={() => setShowShare(true)}
            title={t.share}
            aria-label={t.share}
            className="flex items-center text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <InstallAppButton />
          <button
            type="button"
            onClick={() => setShowDisclaimer((v) => !v)}
            aria-expanded={showDisclaimer}
            className="underline hover:text-[var(--fg)] transition-colors"
          >
            {t.disclaimerLabel}
          </button>
          <button
            type="button"
            onClick={() => setShowLicense(true)}
            title="AGPL-3.0"
            aria-label="AGPL-3.0"
            className="underline hover:text-[var(--fg)] transition-colors"
          >
            {t.licenseLabel}
          </button>
        </div>
        {showDisclaimer && (
          <span className="max-w-xs normal-case leading-snug">{t.disclaimer}</span>
        )}
      </div>

      {showShare && <ShareDialog url={shareUrl} onClose={() => setShowShare(false)} />}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span>© 2026 STEM DIGITAL LAB</span>
        <a
          href="https://gitee.com/K4Ricky2Win/stem-digital-lab"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center text-[var(--muted)] hover:text-[#C71D23] transition-colors"
          title="https://gitee.com/K4Ricky2Win/stem-digital-lab"
          aria-label="Gitee project"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="flex-shrink-0"
          >
            <path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .982.796 1.778 1.778 1.778h6.015c.982 0 1.778-.796 1.778-1.778v-2.37a.594.594 0 0 1 .593-.593h1.482a.594.594 0 0 1 .593.593v2.37c0 2.29-1.856 4.148-4.148 4.148H9.777c-2.29 0-4.148-1.857-4.148-4.148v-5.63c0-2.29 1.857-4.148 4.148-4.148h8.297z" />
          </svg>
        </a>
        <a
          href="https://github.com/irkythedev/stem-digital-lab"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          title="https://github.com/irkythedev/stem-digital-lab"
          aria-label="GitHub project"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="flex-shrink-0"
          >
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
        </a>
      </div>
      {showLicense && <LicenseDialog onClose={() => setShowLicense(false)} />}
    </footer>
  );
}
