/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 顶部导航栏：品牌标识 + 语言切换 + 主题切换。
 * 从原 App.tsx 抽出，状态改由全局 useApp() 提供。
 */
import { Link } from 'react-router-dom';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import type { Language } from '../../lib/i18n';
import type { ThemeMode } from '../../lib/app-context';

export default function Header() {
  const { t, lang, setLang, themeMode, setThemeMode } = useApp();

  // 单按钮循环切换：system → light → dark
  const themeOrder: ThemeMode[] = ['system', 'light', 'dark'];
  const ThemeIcon = themeMode === 'system' ? Monitor : themeMode === 'light' ? Sun : Moon;
  const cycleTheme = () => {
    const idx = themeOrder.indexOf(themeMode);
    setThemeMode(themeOrder[(idx + 1) % themeOrder.length]);
  };

  return (
    <header className="flex justify-between items-center w-full py-4 border-b border-[var(--border)] transition-colors duration-200">
      <Link to="/" className="flex items-center group" aria-label={t.brandName}>
        <span className="relative w-5 h-5 text-[var(--fg)] shrink-0">
          {/* 三角（数学）— 上中 */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="absolute w-2 h-2 animate-tri-spin" style={{ top: 0, left: 6 }}
          >
            <path d="M3 20 L12 4 L21 20 Z" />
          </svg>
          {/* 方框（化学）— 左下 */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="absolute w-2 h-2 animate-sq-spin" style={{ top: 12, left: 0 }}
          >
            <rect x="4" y="4" width="16" height="16" />
          </svg>
          {/* 圆（物理）— 右下 */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="absolute w-2 h-2 animate-ci-spin" style={{ top: 12, left: 12 }}
          >
            <circle cx="12" cy="12" r="8" />
          </svg>
        </span>
      </Link>

      <div className="flex items-center space-x-4 text-[11px] mono-font uppercase tracking-wider">
        {/* Language Switcher */}
        <div className="flex items-center space-x-2" role="group" aria-label="Language selection">
          <button
            onClick={() => setLang('zh' as Language)}
            aria-pressed={lang === 'zh'}
            className={`transition-colors ${
              lang === 'zh' ? 'font-bold text-[var(--fg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            中文
          </button>
          <span className="text-[var(--border)]" aria-hidden="true">
            ｜
          </span>
          <button
            onClick={() => setLang('en' as Language)}
            aria-pressed={lang === 'en'}
            className={`transition-colors ${
              lang === 'en' ? 'font-bold text-[var(--fg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            EN
          </button>
        </div>

        <div className="w-px h-3 bg-[var(--border)]" aria-hidden="true" />

        {/* Theme Mode Switcher (single cycle button) */}
        <button
          onClick={cycleTheme}
          title={t[themeMode]}
          aria-label={t[themeMode]}
          className="flex items-center justify-center text-[var(--fg)] transition-colors hover:opacity-70"
        >
          <ThemeIcon className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-3 bg-[var(--border)]" aria-hidden="true" />

        {/* Guide link */}
        <Link
          to="/guide"
          className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
        >
          {t.guide}
        </Link>
      </div>
    </header>
  );
}
