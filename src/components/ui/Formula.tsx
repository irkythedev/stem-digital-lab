/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 公式渲染组件：用 KaTeX 精确排版 LaTeX 公式（上标/下标/分式/根式/希腊字母等）。
 * - 按需使用：仅在需要公式的场合调用，不强制整站采用。
 * - SSR 安全：renderToString 在服务端即可输出排版后的 HTML。
 * - 颜色继承自主题（index.css 中 .katex { color: inherit }），自动适配深浅色。
 * KaTeX 的全局 CSS 在 src/main.tsx 引入一次。
 */
import { useMemo } from 'react';
import katex from 'katex';

interface FormulaProps {
  /** LaTeX 源码，如 "a^2 + b^2 = c^2" */
  tex: string;
  /** 独立成行（display mode，居中）还是行内 */
  block?: boolean;
  className?: string;
  /** 列表渲染 key（声明以放行 JSX key，不参与组件逻辑） */
  key?: string | number;
}

export default function Formula({ tex, block = false, className = '' }: FormulaProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { throwOnError: false, displayMode: block });
    } catch {
      // 极端情况下退回原文，避免渲染崩溃
      return tex;
    }
  }, [tex, block]);

  return block ? (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
