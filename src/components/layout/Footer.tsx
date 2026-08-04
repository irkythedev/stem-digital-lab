/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 页脚：作者信息 + Gitee 外链 + 版权。
 * 从原 App.tsx 抽出。
 */
import { useApp } from '../../lib/app-context';

export default function Footer() {
  const { t } = useApp();

  return (
    <footer className="w-full py-6 border-t border-[var(--border)] flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-[var(--muted)] mono-font uppercase tracking-wider transition-colors duration-200">
      <div className="flex flex-col sm:flex-row items-center sm:space-x-3 text-center sm:text-left">
        <span className="font-bold text-[var(--fg)]">{t.author}</span>
        <span className="hidden sm:inline text-[var(--border)]" aria-hidden="true">
          /
        </span>
        <span>{t.authorRole}</span>
      </div>

      <div className="flex items-center space-x-6">
        <a
          href="https://gitee.com/K4Ricky2Win"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1.5 text-[var(--fg)] opacity-70 hover:opacity-100 transition-opacity"
          title="Gitee Project"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="flex-shrink-0"
            aria-label="Gitee Logo"
          >
            <path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .982.796 1.778 1.778 1.778h6.015c.982 0 1.778-.796 1.778-1.778v-2.37a.594.594 0 0 1 .593-.593h1.482a.594.594 0 0 1 .593.593v2.37c0 2.29-1.856 4.148-4.148 4.148H9.777c-2.29 0-4.148-1.857-4.148-4.148v-5.63c0-2.29 1.857-4.148 4.148-4.148h8.297z" />
          </svg>
          <span className="font-bold">{t.gitee}</span>
        </a>

        <span className="text-[var(--border)]" aria-hidden="true">
          /
        </span>
        <span>© 2026 STEM Lab</span>
      </div>
    </footer>
  );
}
