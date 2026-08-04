/**
 * 本地反馈面板：实验反馈与项目反馈共用，不上传网络。
 * 以右下角浮动卡片形式呈现（行业常见做法）。
 */
import { useState } from 'react';
import { useApp } from '../../lib/app-context';
import { makeFeedbackId, saveFeedback, type FeedbackCategory, type FeedbackRating, type FeedbackType } from '../../lib/feedback';

interface FeedbackPanelProps {
  type: FeedbackType;
  labId?: string;
  onClose: () => void;
}

const categories: FeedbackCategory[] = ['content', 'interaction', 'visual', 'language', 'bug', 'suggestion'];

const labels = {
  zh: {
    experimentTitle: '实验反馈', projectTitle: '项目反馈',
    question: '你的反馈主要关于什么？', rating: '这部分内容对你有帮助吗？',
    helpful: '有帮助', neutral: '一般', notHelpful: '没帮助',
    message: '补充说明（可选）', placeholder: '写下问题、建议或发现……',
    submit: '保存反馈', close: '关闭', saved: '反馈已保存在本机',
    categories: { content: '内容', interaction: '交互', visual: '视觉', language: '语言', bug: '问题', suggestion: '建议' },
  },
  en: {
    experimentTitle: 'Experiment feedback', projectTitle: 'Project feedback',
    question: 'What is your feedback about?', rating: 'Was this helpful?',
    helpful: 'Helpful', neutral: 'Neutral', notHelpful: 'Not helpful',
    message: 'Additional note (optional)', placeholder: 'Write a problem, idea, or observation…',
    submit: 'Save feedback', close: 'Close', saved: 'Feedback saved on this device',
    categories: { content: 'Content', interaction: 'Interaction', visual: 'Visual', language: 'Language', bug: 'Problem', suggestion: 'Suggestion' },
  },
} as const;

export default function FeedbackPanel({ type, labId, onClose }: FeedbackPanelProps) {
  const { lang } = useApp();
  const l = labels[lang];
  const [rating, setRating] = useState<FeedbackRating | undefined>();
  const [selected, setSelected] = useState<FeedbackCategory[]>([]);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);

  const toggleCategory = (category: FeedbackCategory) => {
    setSelected((prev) => prev.includes(category) ? prev.filter((x) => x !== category) : [...prev, category]);
  };

  const submit = () => {
    saveFeedback({ id: makeFeedbackId(), type, labId, rating, categories: selected, message: message.trim(), language: lang, createdAt: new Date().toISOString() });
    setSaved(true);
  };

  return (
    <div
      className="fixed bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm border border-[var(--border)] bg-[var(--bg)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
      role="dialog"
      aria-label={type === 'experiment' ? l.experimentTitle : l.projectTitle}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-widest mono-font uppercase">// {type === 'experiment' ? l.experimentTitle : l.projectTitle}</h2>
          <button type="button" onClick={onClose} className="text-xs mono-font text-[var(--muted)] hover:text-[var(--fg)]">{l.close} ×</button>
        </div>
        {saved ? (
          <div className="flex items-center justify-between text-sm text-[var(--fg)]"><span>✓ {l.saved}</span><button type="button" onClick={onClose} className="text-xs underline">{l.close}</button></div>
        ) : (
          <>
            {type === 'experiment' && <div><p className="mb-1.5 text-xs text-[var(--muted)]">{l.rating}</p><div className="flex gap-2">{(['helpful', 'neutral', 'not-helpful'] as FeedbackRating[]).map((r) => <button key={r} type="button" onClick={() => setRating(r)} className={`border px-3 py-1.5 text-xs ${rating === r ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{r === 'helpful' ? l.helpful : r === 'neutral' ? l.neutral : l.notHelpful}</button>)}</div></div>}
            <div><p className="mb-1.5 text-xs text-[var(--muted)]">{l.question}</p><div className="flex flex-wrap gap-2">{categories.map((category) => <button key={category} type="button" onClick={() => toggleCategory(category)} className={`border px-3 py-1.5 text-xs ${selected.includes(category) ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{l.categories[category]}</button>)}</div></div>
            <label className="block text-xs text-[var(--muted)]">{l.message}<textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={l.placeholder} rows={2} className="mt-1.5 w-full resize-y border border-[var(--border)] bg-transparent p-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--fg)]" /></label>
            <button type="button" onClick={submit} className="border border-[var(--fg)] px-4 py-2 text-xs text-[var(--fg)] hover:bg-[var(--accent-light)]">{l.submit}</button>
          </>
        )}
      </div>
    </div>
  );
}
