/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 分享组件：一键分享（Web Share API）+ 二维码（qrcode.react，本地打包）+ 复制链接。
 * 自动降级：不支持 navigator.share 时提供复制链接。
 */
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../../lib/app-context';
import { isWechat } from '../../lib/is-wechat';

interface ShareDialogProps {
  url: string;
  onClose: () => void;
  /** 自定义分享标题；缺省用站点通用标题 */
  title?: string;
  /** 自定义分享正文；缺省用站点通用文案 */
  text?: string;
  /** 锚定模式：二维码从触发按钮位置弹出（popover），默认 false 为底部 sheet/卡片 */
  anchored?: boolean;
}

export default function ShareDialog({ url, onClose, title, text, anchored = false }: ShareDialogProps) {
  const { t } = useApp();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  // 微信内置浏览器检测：点右上角「···」即可转发，无需/不能程序化调起（与转发引导覆层共用 lib）
  const wechatBrowser = isWechat();

  const shareTitle = title || t.shareTitle;
  const shareText = text || t.shareText;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return; // 用户取消
      }
    }
    await handleCopy();
  };

  const handleCopy = async () => {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板 API 失败：降级用 execCommand
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setCopyFailed(true);
        setTimeout(() => setCopyFailed(false), 3000);
      }
    }
  };

  // 弹层内容（两种模式共用）
  const body = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-widest mono-font uppercase">// {t.share}</h2>
        <button type="button" onClick={onClose} aria-label={t.share} title={t.share} className="p-1.5 -m-1.5 text-lg leading-none text-[var(--muted)] hover:text-[var(--fg)]">×</button>
      </div>

      {/* 二维码 */}
      <div className="flex flex-col items-center gap-2">
        <div className="bg-white p-2 rounded">
          <QRCodeSVG value={url} size={160} level="M" marginSize={2} />
        </div>
        <p className="text-xs text-[var(--muted)]">
          {wechatBrowser ? t.wechatInnerHint : t.wechatOuterHint}
        </p>
      </div>

      {/* 按钮：仅支持 Web Share API 的浏览器显示「分享」主按钮，其余直接用「复制链接」 */}
      <div className="flex flex-col gap-2">
        {typeof navigator !== 'undefined' && navigator.share && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="border border-[var(--fg)] px-4 py-2 text-xs text-[var(--fg)] hover:bg-[var(--accent-light)] min-h-[40px] touch-manipulation"
          >
            {t.share}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="border border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] min-h-[40px] touch-manipulation"
        >
          {copied ? `✓ ${t.copied}` : t.copyLink}
        </button>
        {copyFailed && (
          <p className="text-xs text-[var(--error)] serif-font" role="alert">⚠ {t.copyFailed}</p>
        )}
      </div>
    </div>
  );

  // 锚定模式（anchored）：二维码从触发按钮位置向上弹出（popover，带指向箭头），
  // 需调用方用 relative 容器包裹；移动端与 PC 行为一致，均从按钮处弹出。
  if (anchored) {
    return (
      <>
        <div className="fixed inset-0 z-50" onClick={onClose} aria-hidden="true" />
        <div
          className="absolute bottom-full mb-2.5 left-0 sm:left-1/2 sm:-translate-x-1/2 z-[51] w-[min(18rem,calc(100vw-2rem))] max-h-[70dvh] overflow-y-auto overscroll-contain border border-[var(--border)] bg-[var(--bg)] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.18)] rounded-lg"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label={t.share}
        >
          <span
            className="hidden sm:block absolute left-1/2 -translate-x-1/2 top-full -mt-[5px] w-2.5 h-2.5 rotate-45 border-r border-b border-[var(--border)] bg-[var(--bg)]"
            aria-hidden="true"
          />
          {body}
        </div>
      </>
    );
  }

  // 默认模式：移动端底部 sheet / 桌面右下角卡片
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6 bg-black/40 sm:bg-transparent backdrop-blur-[1px] sm:backdrop-blur-none"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-xs border border-[var(--border)] bg-[var(--bg)] p-4 sm:p-5 shadow-[0_12px_32px_rgba(0,0,0,0.18)] rounded-t-xl sm:rounded-none pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t.share}
      >
        {body}
      </div>
    </div>
  );
}
