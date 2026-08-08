/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 顶部导航栏：品牌标识 + 语言切换 + 主题切换。
 * 从原 App.tsx 抽出，状态改由全局 useApp() 提供。
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { APP_VERSION } from '../../lib/changelog';
import VersionDialog from '../feedback/VersionDialog';
import type { ThemeMode } from '../../lib/app-context';

export default function Header() {
  const { t, lang, setLang, themeMode, setThemeMode } = useApp();
  const [showVersion, setShowVersion] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [toast, setToast] = useState(false);

  // 显示"正在刷新"toast 2 秒
  const showToast = () => {
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  };

  // 检测是否有新版本：对比远端 version.json 与本版本号（fetch 失败则静默忽略）
  useEffect(() => {
    let cancelled = false;
    fetch('/version.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && typeof d.version === 'string' && d.version !== APP_VERSION) {
          setHasUpdate(true);
        }
      })
      .catch(() => { /* 网络/离线：忽略，不打扰 */ });
    return () => { cancelled = true; };
  }, []);

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
        </span>
        <span className="hidden sm:inline text-[10px] mono-font uppercase tracking-wider text-[var(--fg)] group-hover:opacity-70 transition-opacity">
          STEM DIGITAL LAB
        </span>
        {/* 版本号：点击弹出版本历史；有更新时显示绿色呼吸灯圆点，点击圆点刷新到新版本 */}
        {/* 注意：按钮嵌在品牌区 <Link to="/"> 内，必须阻止冒泡，否则会同时跳回首页 */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowVersion((v) => !v);
          }}
          title="v{APP_VERSION}"
          aria-label="version"
          className="flex items-center gap-1.5 text-[10px] mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
        >
          <span className="relative">
            v{APP_VERSION}
            {hasUpdate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  showToast();
                  // PWA 双刷新问题根因：旧 SW 是页面 controller，reload 由它服务会返回缓存旧页。
                  // 正确流程：reg.update() 触发新 SW 下载 → install(skipWaiting) → activate(clientsClaim)
                  // → controllerchange（新 SW 接管）→ 此刻 reload 才由新 SW 服务，一次到位。
                  let reloaded = false;
                  const doReload = () => {
                    if (reloaded) return;
                    reloaded = true;
                    window.location.reload();
                  };
                  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.addEventListener('controllerchange', doReload, { once: true });
                    navigator.serviceWorker
                      .getRegistration()
                      .then((reg) => (reg ? reg.update() : null))
                      .catch(() => { /* 更新失败：直接刷新兜底 */ })
                      .finally(() => setTimeout(doReload, 3000)); // 3s 兜底，避免永不触发卡死
                  } else {
                    doReload();
                  }
                }}
                title="有新版本，点击刷新"
                aria-label="有新版本，点击刷新"
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

      <div className="flex items-center space-x-4 text-[11px] mono-font uppercase tracking-wider">
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
