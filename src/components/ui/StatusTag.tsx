/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 简单状态标签：方括号 + 等宽字体，如 [探究中]。
 */
import type { ReactNode } from 'react';

interface StatusTagProps {
  children: ReactNode;
  className?: string;
}

export default function StatusTag({ children, className = '' }: StatusTagProps) {
  return (
    <span className={`text-[0.6875rem] font-bold text-[var(--fg)] mono-font ${className}`}>
      [{children}]
    </span>
  );
}
