/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 外部链接跳转确认（内联确认条，非模态弹窗）：
 * 点击外链按钮 → 在按钮下方展开确认条（显示目标地址 + 提示），
 * 用户点「前往」才真正跳转，点「取消」收起。
 *
 * 复用 WelcomeDialog「其他作品」的交互模式，抽成可复用组件，
 * Footer 与 WelcomeDialog 的 Gitee/GitHub 外链共用。
 * 触达场景：K12 站点，离开本站前明确告知（防误触 + 数据去向透明）。
 */
import { useRef, useState, type ReactNode } from 'react';

export interface ExternalLinkTarget {
  /** 跳转目标完整 URL（确认条里展示，供用户先看清楚） */
  url: string;
  /** 站点名（如 Gitee / GitHub），用于提示文案 */
  name: string;
}

interface ExternalLinkConfirmProps {
  target: ExternalLinkTarget;
  /** 触发按钮内容（图标/文字） */
  children: ReactNode;
  /** 提示文案（i18n 传入，含「即将离开本站」语义） */
  hint: string;
  /** 前往按钮文案 */
  openLabel: string;
  /** 取消按钮文案 */
  cancelLabel: string;
  /** 按钮 aria-label（如 "Gitee project"） */
  ariaLabel: string;
  className?: string;
}

export default function ExternalLinkConfirm({
  target,
  children,
  hint,
  openLabel,
  cancelLabel,
  ariaLabel,
  className,
}: ExternalLinkConfirmProps) {
  const [open, setOpen] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // 确认条展开后确保在可视范围内
      requestAnimationFrame(() => {
        confirmRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }
  };

  return (
    <span className="relative inline-flex flex-col items-start">
      <button
        type="button"
        onClick={toggle}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={className}
      >
        {children}
      </button>
      {open && (
        <div
          ref={confirmRef}
          role="status"
          className="absolute right-0 top-full mt-1.5 z-30 w-56 max-w-[85vw] border border-[var(--border)] bg-[var(--bg)] shadow-[0_8px_24px_rgba(0,0,0,0.12)] px-2.5 py-2 flex flex-col gap-1.5"
        >
          <p className="text-[0.6875rem] leading-snug text-[var(--fg)]">{hint}</p>
          <p className="text-[0.625rem] mono-font text-[var(--muted)] break-all">{target.url}</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => window.open(target.url, '_blank', 'noopener,noreferrer')}
              className="px-2.5 py-1 text-[0.625rem] mono-font border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors"
            >
              {openLabel}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-2.5 py-1 text-[0.625rem] mono-font border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
