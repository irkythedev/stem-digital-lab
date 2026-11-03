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
import { useEscapeKey } from '../../lib/use-escape-key';
import { useFocusReturn } from '../../lib/use-focus-return';
import { AGPL_LICENSE_TEXT } from '../../lib/license-text';

interface LicenseDialogProps {
  onClose: () => void;
  /** 从另一个模态（欢迎弹窗）里打开：整层抬到宿主卡片之上，否则遮罩和卡片都被盖住 */
  elevated?: boolean;
}

export default function LicenseDialog({ onClose, elevated = false }: LicenseDialogProps) {
  useLockBodyScroll(true);
  useEscapeKey(onClose);
  useFocusReturn(); // 关掉后焦点回到「AGPL-3.0」那颗按钮

  return createPortal(
    <div
      className={`safe-overlay safe-overlay-4 fixed inset-0 ${elevated ? 'z-modal-top' : 'z-overlay'} flex items-center justify-center`}
      role="dialog"
      aria-modal="true"
      aria-label="AGPL-3.0 License"
    >
      {/* 遮罩：点击关闭 */}
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden="true" />
      {/* 弹窗卡片 */}
      <div className="relative z-modal w-full max-w-2xl max-h-full flex flex-col bg-[var(--bg)] border border-[var(--border)] shadow-[var(--elev-md)]">
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
            className="h-7 w-7 rounded-md inline-flex items-center justify-center shrink-0 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] ghost-x transition-colors text-lg leading-none"
          >×</button>
        </div>
        {/* 协议全文（滚动） */}
        <pre className="flex-1 overflow-y-auto text-[0.6875rem] leading-relaxed whitespace-pre-wrap break-words mono-font p-4">
          {AGPL_LICENSE_TEXT}
        </pre>
      </div>
    </div>,
    document.body
  );
}