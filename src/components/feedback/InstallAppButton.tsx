/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * PWA 安装引导：
 * - 安卓 Chrome：监听 beforeinstallprompt，显示「安装应用」按钮
 * - iOS Safari：无安装事件，提供「添加到主屏幕」文字引导
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
  const [isIOS, setIsIOS] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // 检测 iOS
    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: boolean }).MSStream;
    setIsIOS(iOS);

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIosHint(true);
    }
  };

  // 安卓可安装：显示安装按钮
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

  // iOS：显示「添加到主屏幕」引导
  if (isIOS) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowIosHint((v) => !v)}
          className="underline hover:text-[var(--fg)] transition-colors"
        >
          {t.addToHome}
        </button>
        {showIosHint && (
          <span className="block max-w-[10rem] normal-case leading-snug">
            Safari → 分享 → 添加到主屏幕
          </span>
        )}
      </div>
    );
  }

  // 桌面浏览器：无安装提示，不显示
  return null;
}
