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

interface ShareDialogProps {
  url: string;
  onClose: () => void;
}

export default function ShareDialog({ url, onClose }: ShareDialogProps) {
  const { t } = useApp();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t.shareTitle, text: t.shareText, url });
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
          <button type="button" onClick={onClose} className="text-xs mono-font text-[var(--muted)] hover:text-[var(--fg)]">×</button>
        </div>

        {/* 二维码 */}
        <div className="flex flex-col items-center gap-2">
          <div className="bg-white p-2 rounded">
            <QRCodeSVG value={url} size={160} level="M" marginSize={2} />
          </div>
          <p className="text-xs text-[var(--muted)]">{t.qrScanHint}</p>
        </div>

        {/* 按钮 */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleNativeShare}
            className="border border-[var(--fg)] px-4 py-2 text-xs text-[var(--fg)] hover:bg-[var(--accent-light)]"
          >
            {t.share}
          </button>
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
