/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 顶部导航栏：品牌标识 + 语言切换 + 主题切换。
 * 从原 App.tsx 抽出，状态改由全局 useApp() 提供。
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon, Monitor , Sparkles, CircleCheck, WifiOff } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { useAiContext } from '../../lib/ai-context';
import { APP_VERSION } from '../../lib/changelog';
import { useVersionCheck } from '../../lib/use-version-check';
import VersionDialog from '../feedback/VersionDialog';
import OfflinePackPanel from '../feedback/OfflinePackPanel';
import { useOfflinePack } from '../../lib/use-offline-pack';
import type { ThemeMode } from '../../lib/app-context';

export default function Header() {
  const { t, lang, setLang, themeMode, setThemeMode, isOffline } = useApp();
  const { open: aiOpen, setOpen: setAiOpen, configured: aiConfigured } = useAiContext();
  const [showVersion, setShowVersion] = useState(false);
  const [showPack, setShowPack] = useState(false);
  // 离线教学包状态：只在「下载中 / 已就绪」时于顶栏露出徽标，平时不占位置
  const { status: packStatus, progress: packProgress, running: packRunning } = useOfflinePack();
  const [toast, setToast] = useState(false);

  // 显示"正在刷新"toast 2 秒
  const showToast = () => {
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  };

  // 有新版本：等新 SW 真正接管（controllerchange）→ 只刷新一次
  // 刷新时机的唯一正确判据是「控制器换人了」：安装中静候、不设短兜底打断，
  // 无待接管的新 SW 时说明当前控制者就是服务端最新版，此时刷新必定拿到新版。
  const handleRefresh = () => {
    showToast();
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      window.location.reload();
      return;
    }
    let done = false;
    const reload = () => {
      if (done) return;
      done = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
    navigator.serviceWorker
      .getRegistration()
      .then(async (reg) => {
        if (!reg) { reload(); return; }
        // 新 SW 正在安装 / 待接管：静候接管事件，不用定时器抢刷
        if (reg.installing || reg.waiting) return;
        await reg.update().catch(() => { /* 检查失败：下面按无待更新处理 */ });
        if (!reg.installing && !reg.waiting) reload();
      })
      .catch(reload);
    // 仅极端慢网兜底（实测预缓存约 2.74MB，正常几秒内接管）
    setTimeout(reload, 90000);
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
    <header className="flex justify-between items-center w-full pb-3 sm:pb-3.5 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:pt-[calc(0.875rem+env(safe-area-inset-top,0px))] border-b border-[var(--border)]/70 transition-colors duration-[var(--dur-base)]">
      <Link to="/" className="flex items-center gap-2 group p-1 -m-1 rounded-lg hover:bg-[var(--accent-light)]/50 transition-colors tap-area" aria-label={t.brandName}>
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
                e.preventDefault();
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
        <span className="hidden sm:inline text-[0.625rem] mono-font uppercase tracking-wider text-[var(--fg)] group-hover:opacity-70 transition-opacity">
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
          className="hidden sm:flex items-center gap-1.5 self-end mb-0.5 text-[0.625rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
        >
          <span className="relative">
            v{APP_VERSION}
            {hasUpdate && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
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
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 border border-[var(--border)]/80 bg-[var(--card-bg)] px-3.5 py-2 rounded-xl text-[0.6875rem] text-[var(--fg)] shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 update-dot" aria-hidden="true" />
          {lang === 'zh' ? '正在刷新到最新版本…' : 'Refreshing to latest version…'}
        </div>
      )}

      <div className="flex items-center gap-1.5 sm:gap-3 text-[0.6875rem] mono-font uppercase tracking-wider">
        {/* 离线教学包：仅下载中 / 已就绪时出现 */}
        {(packRunning || packStatus?.isFull) && (
          <button
            type="button"
            onClick={() => setShowPack(true)}
            aria-label={t.offlinePack.entry}
            title={t.offlinePack.entryHint}
            className="relative flex items-center justify-center p-2 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors tap-area"
          >
            {packRunning ? (
              <span className="text-[0.5rem] mono-font font-bold text-[var(--fg)]">
                {Math.round(((packProgress?.bytes ?? 0) / Math.max(1, packProgress?.totalBytes ?? 1)) * 100)}%
              </span>
            ) : (
              <CircleCheck className="w-3.5 h-3.5 text-green-600" />
            )}
          </button>
        )}

        {/* AI Assistant entry */}
        <button
          type="button"
          onClick={() => setAiOpen(!aiOpen)}
          aria-label={isOffline ? t.offlineAi.hint : lang === 'zh' ? 'AI 学习助手' : 'AI assistant'}
          title={isOffline ? t.offlineAi.hint : lang === 'zh' ? 'AI 学习助手' : 'AI assistant'}
          className={`relative flex items-center justify-center p-2 rounded-lg hover:bg-[var(--accent-light)] transition-colors tap-area ${isOffline ? 'text-[var(--muted)]' : 'text-[var(--fg)]'}`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {isOffline ? (
            <WifiOff className="absolute bottom-1 right-1 w-2.5 h-2.5 text-[var(--error)]" aria-hidden="true" />
          ) : (
            !aiConfigured && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--error)]" aria-hidden="true" />
            )
          )}
        </button>

        {/* Language Switcher (single toggle button) */}
        <button
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          aria-label="Switch language"
          title={lang === 'zh' ? 'EN' : '中文'}
          className="inline-flex items-center justify-center leading-none px-2.5 py-1.5 rounded-lg text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors tap-area"
        >
          {lang === 'zh' ? '中文' : 'EN'}
        </button>

        <div className="w-px h-3 bg-[var(--border)]/70" aria-hidden="true" />

        {/* Theme Mode Switcher (single cycle button) */}
        <button
          onClick={cycleTheme}
          title={t[themeMode]}
          aria-label={t[themeMode]}
          className="flex items-center justify-center p-2 rounded-lg text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors tap-area"
        >
          <ThemeIcon className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-3 bg-[var(--border)]/70" aria-hidden="true" />

        {/* Guide link */}
        <Link
          to="/guide"
          className="inline-flex items-center justify-center leading-none px-2 py-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors tap-area"
        >
          {t.guide}
        </Link>
      </div>
      {showVersion && <VersionDialog onClose={() => setShowVersion(false)} />}
      {showPack && <OfflinePackPanel onClose={() => setShowPack(false)} />}
    </header>
  );
}
