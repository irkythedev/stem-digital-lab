/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * PWA 安装环境检测。
 * 检测优先级：standalone（已作为独立应用运行）→ 内置 WebView（微信/钉钉/飞书/抖音等）
 * → iOS（Safari / 其他 WebKit 浏览器）→ Android → 桌面。
 * 纯函数、无状态，供安装入口与引导 Sheet 共用。
 *
 * WebView 判定（三期递进）：
 *   1) 已知国内 App 内置浏览器 UA 特征（微信/企业微信/QQ/钉钉/飞书/抖音/小红书/微博/头条/百度等）
 *   2) Android Chromium WebView 通用标识（UA 中独立 "wv" 标记）
 *   3) iOS 内置 WebView：WebKit 内核但既非 Safari 也非 Chrome/Firefox 的浏览器 UA
 */

export interface PwaEnv {
  /** 已作为独立 PWA 运行（display-mode: standalone | fullscreen | minimal-ui，或 iOS navigator.standalone） */
  isStandalone: boolean;
  /** 任意内置 WebView（微信 / QQ / 钉钉 / 飞书 / 抖音 / 小红书 / 微博等），均无法直接安装 PWA */
  isWebView: boolean;
  /** 微信 / 企业微信内置浏览器（文案可精确到「微信」） */
  isWechat: boolean;
  /** iOS 设备（iPad/iPhone/iPod，任意浏览器） */
  isIOS: boolean;
  /** iOS 内置 Safari（含 standalone）；iOS 上 Chrome/Firefox 同为 WebKit 但走系统分享菜单 */
  isIOSSafari: boolean;
  /** iOS 内置 WebView（非浏览器内核，如 iOS 微信/钉钉） */
  isIOSWebview: boolean;
  isAndroid: boolean;
  isDesktop: boolean;
  isChromium: boolean;
}

/** 已知 App 内置浏览器 UA 特征（国内常用；命中即视为无法安装 PWA 的 WebView） */
function isKnownAppWebView(ua: string): boolean {
  return (
    /MicroMessenger|wxwork/i.test(ua) || // 微信 / 企业微信
    (/QQ\//i.test(ua) && !/MQQBrowser/i.test(ua)) || // QQ 内置（排除独立 QQ 浏览器 MQQBrowser）
    /DingTalk/i.test(ua) || // 钉钉
    /Feishu|Lark/i.test(ua) || // 飞书
    /aweme|Douyin/i.test(ua) || // 抖音 / 抖音极速版
    /Xiaohongshu|RED\/?/i.test(ua) || // 小红书
    /Weibo/i.test(ua) || // 微博
    /Toutiao|NewsArticle/i.test(ua) || // 今日头条
    /BaiduApp|BaiduHD/i.test(ua) || // 百度 App
    /FBAN|FBAV|Instagram/i.test(ua) || // Facebook / Instagram
    /Line\/|Snapchat|Telegram|KakaoTalk/i.test(ua) // 其他常见
  );
}

export function detectPwaEnv(): PwaEnv {
  if (typeof window === 'undefined') {
    return {
      isStandalone: false, isWebView: false, isWechat: false, isIOS: false, isIOSSafari: false,
      isIOSWebview: false, isAndroid: false, isDesktop: true, isChromium: false,
    };
  }
  const ua = window.navigator.userAgent;
  const mq = (q: string) => window.matchMedia(q).matches;
  const standalone =
    mq('(display-mode: standalone)') ||
    mq('(display-mode: fullscreen)') ||
    mq('(display-mode: minimal-ui)') ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  // iPadOS 13+ 桌面 UA 伪装：触摸设备 + 无触屏 UA 标记时按 iPad 处理
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1 && !(window as unknown as { MSStream?: boolean }).MSStream);
  const isAndroid = /Android/i.test(ua);

  const isWechat = /MicroMessenger|wxwork/i.test(ua);
  // iOS 内置 Safari：iOS 且 UA 含 Safari/ 且非 Chrome/Firefox iOS
  const isIOSSafari = isIOS && /Safari\//i.test(ua) && !/CriOS|FxiOS/i.test(ua);
  // iOS 内置 WebView：iOS 但既非 Safari 也非 iOS Chrome/Firefox（无浏览器 UA 标识）
  const isIOSWebview = isIOS && !isIOSSafari && !/CriOS|FxiOS/i.test(ua);
  // Android Chromium WebView 通用标识（UA 中独立 "wv" 标记）
  const hasAndroidWv = /\bwv\b/i.test(ua);
  const isWebView = isWechat || isKnownAppWebView(ua) || isIOSWebview || hasAndroidWv;

  const isChromium = /Chrome|CriOS|Edg/i.test(ua);
  const isDesktop = !isIOS && !isAndroid;

  return { isStandalone: standalone, isWebView, isWechat, isIOS, isIOSSafari, isIOSWebview, isAndroid, isDesktop, isChromium };
}
