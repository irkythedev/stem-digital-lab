/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * PWA 安装引导入口。
 * 按环境提供差异化引导：原生安装面板 / 图文 Sheet（iOS 三步、WebView 去浏览器、浏览器菜单）。
 *
 * 决策树（自上而下）：
 *
 *  ① 显示判断（任一不满足则不显示按钮）
 *     - isStandalone（已安装）        → 不显示
 *     - 有 deferredPrompt            → 显示（原生安装）
 *     - isWebView（微信/钉钉/飞书等）→ 显示（引导去系统浏览器）
 *     - isIOS                        → 显示（添加到主屏幕三步）
 *     - isAndroid / isDesktop        → 显示（浏览器菜单引导）
 *     - 其余                         → 不显示
 *
 *  ② 按钮文案
 *     - 有 deferredPrompt → 「安装应用」（真的会弹原生安装）
 *     - isWebView         → 「安装指引」（实际是引导去浏览器）
 *     - isIOS             → 「添加到主屏幕」（准确描述动作）
 *     - 其他              → 「安装指引」（实际是菜单引导）
 *
 *  ③ 点击行为
 *     - 有 deferredPrompt → 原生安装弹窗 prompt()
 *     - isWechat          → wechat Sheet（「微信内…」精确文案）
 *     - isWebView（其他） → webview Sheet（通用文案）
 *     - isIOS             → ios Sheet（三步图文）
 *     - 其他              → menu Sheet（浏览器菜单）
 */
import { useEffect, useState } from 'react';
import { useApp } from '../../lib/app-context';
import { detectPwaEnv } from '../../lib/pwa-env';
import InstallGuideSheet, { type InstallGuideKind } from './InstallGuideSheet';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallAppButton() {
  const { t } = useApp();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [sheetKind, setSheetKind] = useState<InstallGuideKind | null>(null);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferredPrompt(null);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const env = detectPwaEnv();

  // ── ① 显示判断 ──
  if (env.isStandalone) return null; // 已安装：不显示
  const hasNativePrompt = !!deferredPrompt;
  const hasInstallPath =
    hasNativePrompt || env.isWebView || env.isIOS || env.isAndroid || env.isDesktop;
  if (!hasInstallPath) return null; // 无任何安装途径：不显示

  // ── ② 按钮文案 ──
  const buttonLabel = hasNativePrompt
    ? t.installApp
    : env.isWebView
      ? t.installGuide
      : env.isIOS
        ? t.addToHome
        : t.installGuide;

  // ── ③ 点击行为 ──
  const handleInstall = async () => {
    if (hasNativePrompt) {
      // 有原生安装事件 → 直接调起系统安装面板
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else if (env.isWebView) {
      // WebView → 引导去系统浏览器；微信/企业微信用精确文案，其他用通用文案
      setSheetKind(env.isWechat ? 'wechat' : 'webview');
    } else if (env.isIOS) {
      // iOS → 三步图文（分享 → 添加到主屏幕 → 添加）
      setSheetKind('ios');
    } else {
      // 其他无原生安装事件 → 浏览器菜单引导
      setSheetKind('menu');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className="underline hover:text-[var(--fg)] transition-colors"
      >
        {buttonLabel}
      </button>
      {sheetKind && (
        <InstallGuideSheet kind={sheetKind} onClose={() => setSheetKind(null)} />
      )}
    </>
  );
}