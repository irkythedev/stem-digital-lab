/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 反馈面板：实验反馈与项目反馈共用。
 * 提交时优先通过 Server酱推送到开发者微信（无后端，前端直连）；
 * 未配置或离线时保存在本机队列，联网后自动补传。以右下角浮动卡片形式呈现。
 */
import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { makeFeedbackId, saveFeedback, submitOneFeedback, loadFeedback, type FeedbackCategory, type FeedbackRating, type FeedbackType } from '../../lib/feedback';

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
    grade: '学校/年级/班级（可选）', gradePlaceholder: '如：能达中学 初三 3 班',
    name: '如何称呼你（可选）', namePlaceholder: '如：张同学 / 王老师',
    contact: '联系方式（可选）', contactPlaceholder: '手机号 / 微信 / 邮箱',
    privacyNote: '以上信息自愿填写，仅用于问题回访，不会公开展示',
    submit: '发送反馈', close: '关闭',
    sent: '感谢您的反馈，已发送给开发者！',
    queued: '感谢您的反馈，已保存，联网后将自动发送',
    categories: { content: '内容', interaction: '交互', visual: '视觉', language: '语言', bug: '问题', suggestion: '建议' },
  },
  en: {
    experimentTitle: 'Experiment feedback', projectTitle: 'Project feedback',
    question: 'What is your feedback about?', rating: 'Was this helpful?',
    helpful: 'Helpful', neutral: 'Neutral', notHelpful: 'Not helpful',
    message: 'Additional note (optional)', placeholder: 'Write a problem, idea, or observation…',
    grade: 'School / Grade / Class (optional)', gradePlaceholder: 'e.g. Nengda Middle School, Grade 9, Class 3',
    name: 'How should we address you? (optional)', namePlaceholder: 'e.g. Zhang / Ms. Wang',
    contact: 'Contact info (optional)', contactPlaceholder: 'Phone / WeChat / Email',
    privacyNote: 'All fields above are optional, used only for follow-up replies, and never shown publicly.',
    submit: 'Send feedback', close: 'Close',
    sent: 'Thank you! Your feedback has been sent to the developer.',
    queued: 'Thank you! Your feedback has been saved and will be sent when online.',
    categories: { content: 'Content', interaction: 'Interaction', visual: 'Visual', language: 'Language', bug: 'Problem', suggestion: 'Suggestion' },
  },
} as const;

export default function FeedbackPanel({ type, labId, onClose }: FeedbackPanelProps) {
  const { lang } = useApp();
  const l = labels[lang];
  const [rating, setRating] = useState<FeedbackRating | undefined>();
  const [selected, setSelected] = useState<FeedbackCategory[]>([]);
  const [message, setMessage] = useState('');
  const [grade, setGrade] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<null | 'sent' | 'queued'>(null);

  const toggleCategory = (category: FeedbackCategory) => {
    setSelected((prev) => prev.includes(category) ? prev.filter((x) => x !== category) : [...prev, category]);
  };

  const submit = async () => {
    if (sending) return;
    setSending(true);
    const record = { id: makeFeedbackId(), type, labId, rating, categories: selected, message: message.trim(), language: lang, grade: grade.trim() || undefined, name: name.trim() || undefined, contact: contact.trim() || undefined, createdAt: new Date().toISOString() };
    saveFeedback(record);
    // 已配置云端时尝试立即直发；未配置则留在本地队列（页面加载时会自动补传）
    const sent = await submitOneFeedback(record);
    if (sent) {
      // 云端直达成功 → 从本地队列移除该条
      const rest = loadFeedback().filter((r) => r.id !== record.id);
      window.localStorage.setItem('stem-lab-feedback', JSON.stringify(rest));
    }
    setSending(false);
    setDone(sent ? 'sent' : 'queued');
  };

  return (
    <div
      className="fixed bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm border border-[var(--border)] bg-[var(--bg)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
      role="dialog"
      aria-label={type === 'experiment' ? l.experimentTitle : l.projectTitle}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest mono-font uppercase">
            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
            {type === 'experiment' ? l.experimentTitle : l.projectTitle}
          </h2>
          <button type="button" onClick={onClose} aria-label={l.close} title={l.close} className="p-1.5 -m-1.5 text-lg leading-none text-[var(--muted)] hover:text-[var(--fg)]">×</button>
        </div>
        {done ? (
          <div className="flex items-center justify-between gap-3 text-sm text-[var(--fg)]">
            <span>{done === 'sent' ? `✓ ${l.sent}` : `✓ ${l.queued}`}</span>
            <button type="button" onClick={onClose} className="text-xs underline shrink-0">{l.close}</button>
          </div>
        ) : (
          <>
            {type === 'experiment' && <div><p className="mb-1.5 text-xs text-[var(--muted)]">{l.rating}</p><div className="flex gap-2">{(['helpful', 'neutral', 'not-helpful'] as FeedbackRating[]).map((r) => <button key={r} type="button" onClick={() => setRating(r)} className={`border px-3 py-1.5 text-xs ${rating === r ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{r === 'helpful' ? l.helpful : r === 'neutral' ? l.neutral : l.notHelpful}</button>)}</div></div>}
            <div><p className="mb-1.5 text-xs text-[var(--muted)]">{l.question}</p><div className="flex flex-wrap gap-2">{categories.map((category) => <button key={category} type="button" onClick={() => toggleCategory(category)} className={`border px-3 py-1.5 text-xs ${selected.includes(category) ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{l.categories[category]}</button>)}</div></div>
            <label className="block text-xs text-[var(--muted)]">{l.message}<textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={l.placeholder} rows={2} className="mt-1.5 w-full resize-y border border-[var(--border)] bg-transparent p-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--fg)]" /></label>
            {/* 可选身份信息：年级/班级 + 联系方式（仅用于回访，用户自主决定填写） */}
            <label className="block text-xs text-[var(--muted)]">{l.grade}<input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder={l.gradePlaceholder} className="mt-1.5 w-full border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--fg)] outline-none focus:border-[var(--fg)]" /></label>
            {/* 称呼 + 联系方式：一行两列 */}
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-[var(--muted)]">{l.name}<input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={l.namePlaceholder} className="mt-1.5 w-full border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--fg)] outline-none focus:border-[var(--fg)]" /></label>
              <label className="block text-xs text-[var(--muted)]">{l.contact}<input type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder={l.contactPlaceholder} className="mt-1.5 w-full border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--fg)] outline-none focus:border-[var(--fg)]" /></label>
            </div>
            <p className="text-[0.625rem] text-[var(--muted)] opacity-70">{l.privacyNote}</p>
            <button type="button" onClick={submit} disabled={sending} className="border border-[var(--fg)] px-4 py-2 text-xs text-[var(--fg)] hover:bg-[var(--accent-light)] disabled:opacity-50">{sending ? (lang === 'zh' ? '发送中…' : 'Sending…') : l.submit}</button>
          </>
        )}
      </div>
    </div>
  );
}
