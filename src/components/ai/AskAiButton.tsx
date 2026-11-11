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
import { getPageQuestion } from '../../lib/ai-dynamic-questions';

interface AskAiButtonProps {
  /** 预填问题（含当前内容上下文）；传了 labId 时作为兜底 */
  question: string;
  /**
   * 实验页专用的页级入口：点击瞬间从「页级问句注册表」取当前问句
   * （实验把带实时读数的问句登记在那里，见 ai-dynamic-questions.setPageQuestion）。
   */
  labId?: string;
  /** 自定义按钮文字；缺省用「问 AI / Ask AI」 */
  label?: string;
  /** 附加样式类（如间距） */
  className?: string;
  /** 移动端紧凑头部：只保留图标，文字转为 tooltip / aria-label */
  iconOnly?: boolean;
}

export default function AskAiButton({ question, labId, label, className = '', iconOnly = false }: AskAiButtonProps) {
  const { lang, t, isOffline } = useApp();
  const { askAi } = useAiContext();
  const labelText = label ?? (lang === 'zh' ? '问 AI' : 'Ask AI');
  return (
    <button
      type="button"
      onClick={() => askAi((labId ? getPageQuestion(labId) : '') || question)}
      disabled={isOffline}
      title={isOffline ? t.offlineAi.sendBlocked : labelText}
      aria-label={labelText}
      className={`compact tap32 inline-flex items-center rounded text-xs mono-font hover:text-[var(--fg)] active:bg-[var(--accent-light)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-[var(--muted)] ${iconOnly ? 'h-7 w-7 justify-center px-0' : 'gap-1 px-1.5 py-1'} ${className}`}
    >
      <Sparkles className="w-3 h-3" />
      {!iconOnly && labelText}
    </button>
  );
}
