/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 简单状态标签：方括号 + 等宽字体，如 [算法构建中]。
 */
import type { ReactNode } from 'react';

interface StatusTagProps {
  children: ReactNode;
  className?: string;
}

export default function StatusTag({ children, className = '' }: StatusTagProps) {
  return (
    <span className={`text-[11px] font-bold text-[var(--fg)] mono-font ${className}`}>
      [{children}]
    </span>
  );
}
