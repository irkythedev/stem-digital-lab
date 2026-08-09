/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 「问 AI」按钮：页面详情卡一键触发 AI 助手，预填当前内容的问题。
 * 复用：MathFormulas / PhysicsFormulas / PhysicalConstants / LabPage / PeriodicTable。
 */
import { Sparkles } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { useAiContext } from '../../lib/ai-context';

interface AskAiButtonProps {
  /** 预填问题（含当前内容上下文） */
  question: string;
  /** 自定义按钮文字；缺省用「问 AI / Ask AI」 */
  label?: string;
  /** 附加样式类（如间距） */
  className?: string;
}

export default function AskAiButton({ question, label, className = '' }: AskAiButtonProps) {
  const { lang } = useApp();
  const { askAi } = useAiContext();
  return (
    <button
      type="button"
      onClick={() => askAi(question)}
      className={`inline-flex items-center gap-1 text-xs mono-font underline hover:text-[var(--fg)] transition-colors ${className}`}
    >
      <Sparkles className="w-3 h-3" />
      {label ?? (lang === 'zh' ? '问 AI' : 'Ask AI')}
    </button>
  );
}
