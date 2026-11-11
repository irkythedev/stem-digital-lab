/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 「考考你」按钮（页面级出题练习入口）：打开 AI 面板并进入 quiz 视图。
 * 与 AskAiButton（问 AI）并列，复用同一上下文与视觉风格。
 */
import { GraduationCap } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { useAiContext } from '../../lib/ai-context';

interface AskQuizButtonProps {
  /** 自定义按钮文字；缺省用「考考你 / Quiz」 */
  label?: string;
  /** 附加样式类（如间距） */
  className?: string;
  /** 移动端紧凑头部：只保留图标，文字转为 tooltip / aria-label */
  iconOnly?: boolean;
}

export default function AskQuizButton({ label, className = '', iconOnly = false }: AskQuizButtonProps) {
  const { lang } = useApp();
  const { openQuiz } = useAiContext();
  const labelText = label ?? (lang === 'zh' ? '考考你' : 'Quiz');
  return (
    <button
      type="button"
      onClick={openQuiz}
      title={labelText}
      aria-label={labelText}
      className={`compact tap32 inline-flex items-center rounded text-xs mono-font hover:text-[var(--fg)] active:bg-[var(--accent-light)] transition-colors ${iconOnly ? 'h-7 w-7 justify-center px-0' : 'gap-1 px-1.5 py-1'} ${className}`}
    >
      <GraduationCap className="w-3 h-3" />
      {!iconOnly && labelText}
    </button>
  );
}
