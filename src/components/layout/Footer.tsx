/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 页脚：作者信息 + 免责声明 + Gitee 外链 + 版权。
 * 从原 App.tsx 抽出。免责声明点击展开，Gitee 保留官方红色 icon 悬停显示项目地址。
 */
import { useState } from 'react';
import { useApp } from '../../lib/app-context';
import ShareDialog from '../feedback/ShareDialog';
import InstallAppButton from '../feedback/InstallAppButton';

export default function Footer() {
  const { t } = useApp();
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://stem.irky.dev/';

  return (
    <footer className="w-full py-6 border-t border-[var(--border)] flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-[var(--muted)] mono-font uppercase tracking-wider transition-colors duration-200">
      <div className="flex flex-col sm:flex-row items-center sm:space-x-3 text-center sm:text-left">
        <a
          href="https://irky.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1.5 hover:opacity-80 transition-opacity"
          title="irky.dev"
        >
          <img
            src="https://irky.dev/img/icons/pubg-helmet.png"
            alt="irky.dev favicon"
            width="14"
            height="14"
            className="flex-shrink-0"
          />
          <span className="font-bold text-[var(--fg)]">{t.author}</span>
        </a>
        <span className="hidden sm:inline text-[var(--border)]" aria-hidden="true">
          /
        </span>
        <span>{t.authorRole}</span>
      </div>

      <div className="flex flex-col items-center gap-1.5 text-center">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowShare(true)}
            className="underline hover:text-[var(--fg)] transition-colors"
          >
            {t.share}
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
        </div>
        {showDisclaimer && (
          <span className="max-w-xs normal-case leading-snug">{t.disclaimer}</span>
        )}
      </div>

      {showShare && <ShareDialog url={shareUrl} onClose={() => setShowShare(false)} />}

      <div className="flex items-center space-x-6">
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

        <span className="text-[var(--border)]" aria-hidden="true">
          /
        </span>
        <span>© 2026 STEM DIGITAL LAB</span>
      </div>
    </footer>
  );
}
