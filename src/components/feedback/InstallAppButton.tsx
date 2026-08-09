/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * PWA 安装引导：按系统/浏览器差异化提示。
 * - Android / 桌面 Chrome·Edge（可安装）：监听 beforeinstallprompt，显示「安装应用」按钮
 * - iOS Safari：Safari → 分享 → 添加到主屏幕
 * - iOS Chrome/Firefox（同为 WebKit）：分享按钮 → 添加到主屏幕（系统分享菜单）
 * - Android 其他浏览器：浏览器菜单 → 添加到主屏幕
 * - 桌面 Firefox/Safari：浏览器菜单 → 安装应用
 * - 微信内置浏览器 / 已安装 standalone：不显示（PWA 安装不适用）
 */
import { useEffect, useState } from 'react';
import { useApp } from '../../lib/app-context';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallAppButton() {
  const { t } = useApp();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferredPrompt(null);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    const ua = window.navigator.userAgent;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // 系统 / 浏览器识别（UA）
  const ua = typeof window !== 'undefined' ? window.navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: boolean }).MSStream;
  const isAndroid = /Android/i.test(ua);
  const isWechat = /MicroMessenger/i.test(ua);
  const isIOSChrome = /CriOS/i.test(ua);
  const isIOSFirefox = /FxiOS/i.test(ua);
  const isIOSNonSafari = isIOS && (isIOSChrome || isIOSFirefox);
  const isChromium = /Chrome|CriOS|Edg/i.test(ua);
  const isDesktop = !isIOS && !isAndroid;

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else {
      setShowHint((v) => !v);
    }
  };

  // 已作为独立 PWA 运行：不显示任何安装入口
  if (isStandalone) return null;
  // 微信内置浏览器：不支持 PWA 安装，不显示
  if (isWechat) return null;

  // Android / 桌面 Chrome·Edge 可安装：显示安装按钮
  if (deferredPrompt) {
    return (
      <button
        type="button"
        onClick={handleInstall}
        className="underline hover:text-[var(--fg)] transition-colors"
      >
        {t.installApp}
      </button>
    );
  }

  // iOS：按 Safari / 其他浏览器给差异化「添加到主屏幕」引导
  if (isIOS) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={handleInstall}
          className="underline hover:text-[var(--fg)] transition-colors"
        >
          {t.addToHome}
        </button>
        {showHint && (
          <span className="block max-w-[10rem] normal-case leading-snug">
            {isIOSNonSafari ? t.addToHomeHintIOS : t.addToHomeHintSafari}
          </span>
        )}
      </div>
    );
  }

  // Android 非 Chrome（Firefox/UC/QQ 等，无原生安装事件）
  if (isAndroid) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={handleInstall}
          className="underline hover:text-[var(--fg)] transition-colors"
        >
          {t.addToHome}
        </button>
        {showHint && (
          <span className="block max-w-[10rem] normal-case leading-snug">
            {t.addToHomeHintAndroid}
          </span>
        )}
      </div>
    );
  }

  // 桌面非 Chromium（Firefox/Safari）：浏览器菜单 → 安装应用
  if (isDesktop && !isChromium) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={handleInstall}
          className="underline hover:text-[var(--fg)] transition-colors"
        >
          {t.installApp}
        </button>
        {showHint && (
          <span className="block max-w-[10rem] normal-case leading-snug">
            {t.installHintDesktop}
          </span>
        )}
      </div>
    );
  }

  // 其他（无安装途径）
  return null;
}
