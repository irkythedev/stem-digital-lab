/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 科目详情页：展示该科目的标题、说明与（建设中）实验列表。
 * 依据路由参数 /subject/:subjectId 渲染对应科目；
 * P0 阶段实验列表为占位，后续由 labs 注册表填充。
 */
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { subjects, type SubjectId } from '../lib/subjects';
import { labsForSubject } from '../lib/labs';
import StatusTag from '../components/ui/StatusTag';
import UnderConstruction from '../components/ui/UnderConstruction';
import SubjectHeading from '../components/layout/SubjectHeading';

export default function SubjectPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const { t, lang } = useApp();

  const subject = subjectId ? subjects[subjectId as SubjectId] : undefined;

  if (!subject) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center my-16 px-2 sm:px-6 text-center">
        <h1 className="text-2xl serif-font text-[var(--fg)] mb-4">{t.pageNotFound}</h1>
        <Link to="/" className="text-xs mono-font text-[var(--muted)] underline">
          {t.backToHome}
        </Link>
      </main>
    );
  }

  const meta = t.subjects[subject.id];
  const labList = labsForSubject(subject.id);

  return (
    <main className="flex-1 flex flex-col my-10 px-2 sm:px-6">
      <Link to="/" className="text-xs mono-font text-[var(--muted)] underline hover:text-[var(--fg)]">
        ← {t.backHome}
      </Link>

      <div className="mt-5 mb-10">
        <SubjectHeading
          subjectId={subject.id}
          name={meta.title}
          caption={lang === 'zh' ? subject.gradeZh : subject.gradeEn}
        />
      </div>

      {/* 化学工具：元素周期表 */}
      {subject.id === 'chemistry' && (
        <section className="mb-8">
          <h2 className="text-sm font-bold tracking-widest text-[var(--fg)] mono-font mb-4">
            // {lang === 'zh' ? '工具' : 'Tools'}
          </h2>
          <Link
            to="/periodic-table"
            className="group flex items-center justify-between border-t border-b border-[var(--border)] py-5 transition-colors hover:border-[var(--fg)]"
          >
            <span className="flex items-center gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-5 h-5 text-[var(--muted)] transition-colors group-hover:text-[var(--fg)]" aria-hidden="true">
                {/* 简易周期表网格图标 */}
                <rect x="3" y="3" width="18" height="18" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
                <line x1="8" y1="3" x2="8" y2="21" />
                <line x1="13" y1="3" x2="13" y2="21" />
                <line x1="18" y1="3" x2="18" y2="21" />
              </svg>
              <span className="text-sm font-semibold tracking-wide text-[var(--fg)] serif-font">
                {lang === 'zh' ? '元素周期表' : 'Periodic Table'}
              </span>
            </span>
            <span className="text-[var(--muted)] mono-font transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </section>
      )}

      {/* 实验列表（来自注册表，未注册科目显示建设中占位） */}
      <section className="mb-8">
        <h2 className="text-sm font-bold tracking-widest text-[var(--fg)] mono-font mb-4">
          // {t.labs}
        </h2>
        {labList.length ? (
          <div className="border-t border-[var(--border)]">
            {labList.map((lab) => (
              <Link
                key={lab.id}
                to={`/lab/${lab.id}`}
                className="group flex items-center justify-between border-b border-[var(--border)] py-5 transition-colors hover:border-[var(--fg)]"
              >
                <span className="flex items-center gap-3">
                  <lab.icon className="w-5 h-5 text-[var(--muted)] transition-colors group-hover:text-[var(--fg)]" />
                  <span className="text-sm font-semibold tracking-wide text-[var(--fg)] serif-font">
                    {lab.name[lang]}
                  </span>
                </span>
                <span className="text-[var(--muted)] mono-font transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border-t border-[var(--border)] pt-4 pb-6 flex flex-col space-y-1.5">
            <StatusTag>{t.underConstruction}</StatusTag>
            <span className="text-[11px] text-[var(--muted)] sans-font leading-relaxed">
              {t.labUnderConstruction}
            </span>
          </div>
        )}
      </section>

      <UnderConstruction />
    </main>
  );
}
