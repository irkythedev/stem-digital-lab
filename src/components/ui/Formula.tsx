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

/**
 * KaTeX 零信任渲染契约（安全边界，勿放宽）：
 * - `trust: false`（显式钉死）：禁用 `\href` / `\url` / `\htmlClass` / `\includegraphics`
 *   等 HTML 扩展，模型输出里若混入 `\href{javascript:...}{click}` 也只会渲染成纯文本，
 *   绝不生成可点击的 `<a>` 或任何带 `href` 的标签。
 * - `throwOnError: false`：坏公式（括号不闭合、未知命令等）降级为红色纯文本（`.katex-error`），
 *   而不是抛异常中断整棵 React 渲染树。
 * 本函数被导出，便于 `src/testing` 对其做独立安全断言。
 */
export function katexToHtml(tex: string, block = false): string {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode: block, trust: false });
  } catch {
    // 极端情况（如非字符串输入）退回纯文本，避免渲染崩溃
    return typeof tex === 'string' ? tex : '';
  }
}

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
  const html = useMemo(() => katexToHtml(tex, block), [tex, block]);

  return block ? (
    <div className={`overflow-x-auto max-w-full py-1 scrollbar-thin ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className={`inline-block max-w-full overflow-x-auto align-middle scrollbar-thin ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
