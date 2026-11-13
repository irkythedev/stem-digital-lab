/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 三幕式终章完成后的轻量承接：考考你 + 下一实验。
 * 只负责导航/唤起，不改变各实验的结论判定逻辑。
 */
import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { useAiContext } from '../../lib/ai-context';
import { useApp } from '../../lib/app-context';

interface NextLab {
  href: string;
  zh: string;
  en: string;
}

const NEXT_LAB: Record<string, NextLab> = {
  quadratic: { href: '/lab/inverse', zh: '反比例函数', en: 'Inverse Function' },
  inverse: { href: '/lab/linear', zh: '一次函数', en: 'Linear Function' },
  linear: { href: '/lab/circle', zh: '圆的性质', en: 'Circle Properties' },
  circle: { href: '/lab/congruence', zh: '全等三角形', en: 'Congruent Triangles' },
  congruence: { href: '/lab/similarity', zh: '相似与位似', en: 'Similarity & Homothety' },
  similarity: { href: '/lab/polygon-pi', zh: '割圆术', en: 'Circle-Cutting' },
  'polygon-pi': { href: '/lab/construction', zh: '尺规作图', en: 'Ruler & Compass' },
  construction: { href: '/lab/quadratic', zh: '二次函数', en: 'Quadratic Function' },
};

export default function ConcludeNextActions({ labId }: { labId: string }) {
  const { lang } = useApp();
  const { openQuiz } = useAiContext();
  const next = NEXT_LAB[labId];
  const zh = lang === 'zh';
  const actionClass = 'compact inline-flex h-7 shrink-0 items-center gap-1 rounded border border-[var(--border)] px-2 text-[0.625rem] mono-font text-[var(--muted)] transition-colors hover:border-[var(--fg)] hover:text-[var(--fg)]';

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1" data-conclude-next-actions="true">
      <button type="button" onClick={openQuiz} className={actionClass}>
        <GraduationCap className="h-3 w-3 shrink-0" aria-hidden="true" />
        {zh ? '考考你' : 'Quiz'}
      </button>
      {next && (
        <Link to={next.href} className={actionClass}>
          {zh ? `下一实验：${next.zh}` : `Next: ${next.en}`}
          <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
