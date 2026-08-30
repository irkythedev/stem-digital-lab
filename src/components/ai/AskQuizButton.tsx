/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 「考考我」按钮（页面级出题练习入口）：打开 AI 面板并进入 quiz 视图。
 * 与 AskAiButton（问 AI）并列，复用同一上下文与视觉风格。
 */
import { GraduationCap } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { useAiContext } from '../../lib/ai-context';

interface AskQuizButtonProps {
  /** 自定义按钮文字；缺省用「考考我 / Quiz me」 */
  label?: string;
  /** 附加样式类（如间距） */
  className?: string;
}

export default function AskQuizButton({ label, className = '' }: AskQuizButtonProps) {
  const { lang } = useApp();
  const { openQuiz } = useAiContext();
  return (
    <button
      type="button"
      onClick={openQuiz}
      className={`inline-flex items-center gap-1 text-xs mono-font underline hover:text-[var(--fg)] transition-colors ${className}`}
    >
      <GraduationCap className="w-3 h-3" />
      {label ?? (lang === 'zh' ? '考考我' : 'Quiz me')}
    </button>
  );
}
