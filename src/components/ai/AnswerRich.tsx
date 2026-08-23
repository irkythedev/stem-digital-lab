/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 回答富文本渲染（数学格式适配）：
 *   - 块级公式 $$...$$ / \[...\] → KaTeX 块级渲染（独立成行居中）
 *   - 行内公式 $...$ / \(...\) → KaTeX 行内渲染
 *   - **加粗**、# 标题、- 列表、--- 分隔线、空行段落
 *   - 渲染失败的公式退回原文（KaTeX throwOnError:false），绝不崩溃
 * 复用现有 Formula 组件（KaTeX 全局 CSS 已在 main.tsx 引入）。
 */
import { useMemo, type ReactNode } from 'react';
import Formula from '../ui/Formula';

/** 块级公式：$$...$$ 或 \[...\]（可跨行） */
const BLOCK_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/g;
/** 行内 token：\(...\)、$...$、**加粗**（交替出现） */
const INLINE_RE = /(\\\([\s\S]*?\\\)|\$[^$\n]+?\$|\*\*[^*\n]+\*\*)/g;

function renderInline(text: string, keyBase: number): ReactNode[] {
  const parts = text.split(INLINE_RE);
  const out: ReactNode[] = [];
  parts.forEach((p, i) => {
    if (i % 2 === 1) {
      if (p.startsWith('\\(') && p.endsWith('\\)') && p.length > 4) {
        out.push(<Formula key={keyBase * 1000 + i} className="ai-answer-katex" tex={p.slice(2, -2)} />);
        return;
      }
      if (p.startsWith('$') && p.endsWith('$') && p.length > 2) {
        out.push(<Formula key={keyBase * 1000 + i} className="ai-answer-katex" tex={p.slice(1, -1)} />);
        return;
      }
      if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
        // 加粗内部可能嵌套公式（如 **\(a\) 的作用**），递归解析
        out.push(
          <strong key={keyBase * 1000 + i} className="font-bold">
            {renderInline(p.slice(2, -2), keyBase + i)}
          </strong>,
        );
        return;
      }
    }
    out.push(<span key={keyBase * 1000 + i}>{p}</span>);
  });
  return out;
}

/** 渲染一个非公式文本块（按行处理标题/列表/分隔线/段落） */
function renderBlock(text: string, keyBase: number): ReactNode[] {
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  let listBuf: string[] = [];
  let k = 0;
  const flushList = () => {
    if (listBuf.length > 0) {
      out.push(
        <ul key={keyBase * 100 + k++} className="list-disc pl-4 space-y-0.5 my-1">
          {listBuf.map((li, j) => (
            <li key={j}>{renderInline(li, keyBase + j)}</li>
          ))}
        </ul>,
      );
      listBuf = [];
    }
  };
  for (const raw of lines) {
    const t = raw.trim();
    if (t === '---') {
      flushList();
      out.push(<hr key={keyBase * 100 + k++} className="my-2 border-[var(--border)]" />);
      continue;
    }
    const heading = t.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushList();
      out.push(
        <p
          key={keyBase * 100 + k++}
          className={heading[1].length === 1 ? 'text-sm font-bold mt-1' : 'text-xs font-bold mt-1'}
        >
          {renderInline(heading[2], keyBase + k)}
        </p>,
      );
      continue;
    }
    const bullet = t.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      listBuf.push(bullet[1]);
      continue;
    }
    const numbered = t.match(/^\d+[.、)]\s+(.+)$/);
    if (numbered) {
      listBuf.push(numbered[1]);
      continue;
    }
    flushList();
    if (t === '') {
      out.push(<div key={keyBase * 100 + k++} className="h-2" />);
      continue;
    }
    out.push(
      <p key={keyBase * 100 + k++} className="min-h-[1em]">
        {renderInline(raw, keyBase + k)}
      </p>,
    );
  }
  flushList();
  return out;
}

/** AI 回答富文本渲染入口 */
export default function AnswerRich({ text }: { text: string }) {
  const nodes = useMemo(() => {
    const parts = text.split(BLOCK_RE);
    const out: ReactNode[] = [];
    parts.forEach((p, i) => {
      if (i % 2 === 1) {
        // 块级公式：去掉 $$ 或 \[ \] 包裹
        const tex = p.startsWith('$$') ? p.slice(2, -2) : p.slice(2, -2);
        out.push(<Formula key={i} block className="ai-answer-katex-block" tex={tex} />);
      } else {
        out.push(...renderBlock(p, i + 1));
      }
    });
    return out;
  }, [text]);
  return <>{nodes}</>;
}

/**
 * 行内富文本（用于问题行 / 推荐追问按钮等单行场景）：
 * 只处理行内公式 \(...\) / $...$ 与 **加粗**，不引入块级结构。
 */
export function InlineAnswer({ text }: { text: string }) {
  const nodes = useMemo(() => renderInline(text, 1), [text]);
  return <>{nodes}</>;
}
