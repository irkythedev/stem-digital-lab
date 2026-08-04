/**
 * 全局浮动反馈气泡：固定在右下角（行业常见做法）。
 * 根据当前路由自动切换类型——实验页 → 实验反馈（带 labId），其他页 → 项目反馈。
 */
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import FeedbackPanel from './FeedbackPanel';
import { useApp } from '../../lib/app-context';
import { labMap } from '../../lib/labs';
import type { FeedbackType } from '../../lib/feedback';

export default function FeedbackFab() {
  const [open, setOpen] = useState(false);
  const { lang } = useApp();
  const { pathname } = useLocation();

  // 实验页：/lab/:labId → 实验反馈；其余 → 项目反馈
  const labMatch = pathname.match(/^\/lab\/([^/]+)/);
  const labId = labMatch ? labMatch[1] : undefined;
  const type: FeedbackType = labId && labMap[labId] ? 'experiment' : 'project';

  const label = type === 'experiment'
    ? (lang === 'zh' ? '实验反馈' : 'Experiment feedback')
    : (lang === 'zh' ? '项目反馈' : 'Project feedback');

  return (
    <>
      {open && <FeedbackPanel type={type} labId={labId} onClose={() => setOpen(false)} />}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        title={label}
        aria-expanded={open}
        className="fixed bottom-5 right-4 sm:right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-colors hover:bg-[var(--accent-light)]"
      >
        <MessageSquare className="w-5 h-5" />
      </button>
    </>
  );
}
