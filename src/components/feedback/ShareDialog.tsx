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
}

export default function ShareDialog({ url, onClose, title, text }: ShareDialogProps) {
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

  return (
    <div
      className="fixed bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-xs border border-[var(--border)] bg-[var(--bg)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
      role="dialog"
      aria-label={t.share}
    >
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
              className="border border-[var(--fg)] px-4 py-2 text-xs text-[var(--fg)] hover:bg-[var(--accent-light)]"
            >
              {t.share}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="border border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]"
          >
            {copied ? `✓ ${t.copied}` : t.copyLink}
          </button>
          {copyFailed && (
            <p className="text-xs text-[var(--error)] serif-font" role="alert">⚠ {t.copyFailed}</p>
          )}
        </div>
      </div>
    </div>
  );
}
