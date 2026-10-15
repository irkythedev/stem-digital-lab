/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 全站统一返回链接（Ghost Link）：ArrowLeft 图标 + 文字，**无下划线**。
 * 站内返回入口只保留这一种形态：顶栏 Logo 已承担回首页，故不再单独挂 ⌂ 小房子。
 * 间距规范 mt-3 mb-6：上方留呼吸、与下方主标题拉开层级（调用方若紧跟标题块，
 * 标题块的 mt-5 应一并去掉，避免双重外边距）。
 */
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface BackLinkProps {
  /** 目标：学科页（如 /subject/math）或首页 / */
  to: string;
  children: ReactNode;
  /** 追加类名（仅用于个别页面的额外定位，不用于覆盖间距令牌） */
  className?: string;
}

export default function BackLink({ to, children, className = '' }: BackLinkProps) {
  return (
    <Link
      to={to}
      className={`mt-3 mb-6 inline-flex items-center gap-1.5 text-xs mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors tap-area ${className}`}
    >
      <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
      {children}
    </Link>
  );
}
