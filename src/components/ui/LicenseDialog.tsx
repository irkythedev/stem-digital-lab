/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AGPL-3.0 协议全文弹窗：点击遮罩或关闭按钮消失，免页面跳转。
 * 在欢迎弹窗与页脚复用，/license 路由页保留独立访问。
 */
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLockBodyScroll } from '../../lib/use-lock-body-scroll';
import { AGPL_LICENSE_TEXT } from '../../lib/license-text';

interface LicenseDialogProps {
  onClose: () => void;
}

export default function LicenseDialog({ onClose }: LicenseDialogProps) {
  useLockBodyScroll(true);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="AGPL-3.0 License">
      {/* 遮罩：点击关闭 */}
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden="true" />
      {/* 弹窗卡片 */}
      <div className="relative z-10 w-full max-w-2xl max-h-[80vh] flex flex-col bg-[var(--bg)] border border-[var(--border)] shadow-[0_8px_24px_rgba(0,0,0,0.15)]">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div>
            <h1 className="text-xs font-bold mono-font tracking-widest">AGPL-3.0</h1>
            <p className="text-[0.625rem] mono-font text-[var(--muted)]">
              GNU Affero General Public License, Version 3, 19 November 2007
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -m-1.5 text-[var(--muted)] hover:text-[var(--fg)] text-lg leading-none"
          >×</button>
        </div>
        {/* 协议全文（滚动） */}
        <pre className="flex-1 overflow-y-auto text-[0.6875rem] leading-relaxed whitespace-pre-wrap break-words font-mono p-4">
          {AGPL_LICENSE_TEXT}
        </pre>
      </div>
    </div>,
    document.body
  );
}