/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 顶部导航栏：品牌标识 + 语言切换 + 主题切换。
 * 从原 App.tsx 抽出，状态改由全局 useApp() 提供。
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon, Monitor , Sparkles } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { useAiContext } from '../../lib/ai-context';
import { APP_VERSION } from '../../lib/changelog';
import { useVersionCheck } from '../../lib/use-version-check';
import VersionDialog from '../feedback/VersionDialog';
import type { ThemeMode } from '../../lib/app-context';

export default function Header() {
  const { t, lang, setLang, themeMode, setThemeMode } = useApp();
  const { open: aiOpen, setOpen: setAiOpen, configured: aiConfigured } = useAiContext();
  const [showVersion, setShowVersion] = useState(false);
  const [toast, setToast] = useState(false);

  // 显示"正在刷新"toast 2 秒
  const showToast = () => {
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  };

  // 有新版本：下载新 SW → 事件驱动等待接管 → 刷新一次到位（桌面版本号绿点 / 移动端 logo 绿点共用）
  const handleRefresh = () => {
    showToast();
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      let reloaded = false;
      const onceReload = () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', onceReload, { once: true });
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          if (!reg) { onceReload(); return; }
          if (!reg.waiting && !reg.installing) {
            // 尚无新 SW：触发检查下载
            reg.update().catch(() => onceReload());
          }
          // waiting / installing 已存在：sw 自带 skipWaiting，
          // install 完成后自动 activate → controllerchange 驱动刷新
        })
        .catch(() => onceReload());
      // 长兜底仅作慢网保险（8.6MB 预缓存正常 10s 内完成，20s 足够）
      setTimeout(onceReload, 20000);
    } else {
      window.location.reload();
    }
  };

  // 检测是否有新版本：对比远端 version.json 与本版本号（hook 内 fetch 失败则静默忽略）
  const { hasUpdate } = useVersionCheck();

  // 单按钮循环切换：system → light → dark
  const themeOrder: ThemeMode[] = ['system', 'light', 'dark'];
  const ThemeIcon = themeMode === 'system' ? Monitor : themeMode === 'light' ? Sun : Moon;
  const cycleTheme = () => {
    const idx = themeOrder.indexOf(themeMode);
    setThemeMode(themeOrder[(idx + 1) % themeOrder.length]);
  };

  return (
    <header className="flex justify-between items-center w-full py-4 border-b border-[var(--border)] transition-colors duration-200">
      <Link to="/" className="flex items-center gap-2 group" aria-label={t.brandName}>
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
          {/* 移动端更新绿点：有新版时显示在 logo 右上角（桌面用版本号旁的绿点） */}
          {hasUpdate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRefresh();
              }}
              title={t.updateAvailable}
              aria-label={t.updateAvailable}
              className="sm:hidden absolute -top-1 -right-1 group/dot"
            >
              <span className="block w-1.5 h-1.5 rounded-full bg-green-500 update-dot" />
              <span className="absolute inset-0 rounded-full bg-green-500/50 update-dot-halo" />
            </button>
          )}
        </span>
        <span className="hidden sm:inline text-[10px] mono-font uppercase tracking-wider text-[var(--fg)] group-hover:opacity-70 transition-opacity">
          STEM DIGITAL LAB
        </span>
        {/* 版本号：点击弹出版本历史；有更新时显示绿色呼吸灯圆点，点击圆点刷新到新版本 */}
        {/* 注意：按钮嵌在品牌区 <Link to="/"> 内，必须阻止冒泡，否则会同时跳回首页 */}
        {/* 版本号（桌面显示；移动端隐藏——移动端仅在有新版时于 logo 右上角显示绿点） */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowVersion((v) => !v);
          }}
          title={t.versionTitle.replace('{version}', APP_VERSION)}
          aria-label={t.versionAria}
          className="hidden sm:flex items-center gap-1.5 self-end mb-0.5 text-[10px] mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
        >
          <span className="relative">
            v{APP_VERSION}
            {hasUpdate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefresh();
                }}
                title={t.updateAvailable}
                aria-label={t.updateAvailable}
                className="absolute -right-2.5 top-1/2 -translate-y-1/2 group/dot"
              >
                <span className="block w-1.5 h-1.5 rounded-full bg-green-500 update-dot" />
                <span className="absolute inset-0 rounded-full bg-green-500/50 update-dot-halo" />
              </button>
            )}
          </span>
        </button>
      </Link>

      {/* 刷新状态 toast：右上角 */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[11px] text-[var(--fg)] shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 update-dot" aria-hidden="true" />
          {lang === 'zh' ? '正在刷新到最新版本…' : 'Refreshing to latest version…'}
        </div>
      )}

      <div className="flex items-center gap-2 sm:gap-4 text-[11px] mono-font uppercase tracking-wider">
        {/* AI Assistant entry（版本号在左侧品牌区，此处无绿点遮挡） */}
        <button
          type="button"
          onClick={() => setAiOpen(!aiOpen)}
          aria-label={lang === 'zh' ? 'AI 学习助手' : 'AI assistant'}
          title={lang === 'zh' ? 'AI 学习助手' : 'AI assistant'}
          className="relative flex items-center justify-center px-2 py-2 text-[var(--fg)] transition-colors hover:opacity-70"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {!aiConfigured && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--error)]" aria-hidden="true" />
          )}
        </button>

        {/* Language Switcher (single toggle button) */}
        <button
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          aria-label="Switch language"
          title={lang === 'zh' ? 'EN' : '中文'}
          className="px-2 py-2 transition-colors text-[var(--fg)] hover:opacity-70"
        >
          {lang === 'zh' ? '中文' : 'EN'}
        </button>

        <div className="w-px h-3 bg-[var(--border)]" aria-hidden="true" />

        {/* Theme Mode Switcher (single cycle button) */}
        <button
          onClick={cycleTheme}
          title={t[themeMode]}
          aria-label={t[themeMode]}
          className="flex items-center justify-center px-2 py-2 text-[var(--fg)] transition-colors hover:opacity-70"
        >
          <ThemeIcon className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-3 bg-[var(--border)]" aria-hidden="true" />

        {/* Guide link */}
        <Link
          to="/guide"
          className="px-1 py-2 text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
        >
          {t.guide}
        </Link>
      </div>
      {showVersion && <VersionDialog onClose={() => setShowVersion(false)} />}
    </header>
  );
}
