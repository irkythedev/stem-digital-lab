/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 首页看板：Hero 标题区 + 三大科目切换 + 实验列表淡入淡出。
 *
 * 点击学科卡片 → 下方淡入对应实验列表（不跳转页面）。
 * 每个实验显示：LabIcon + 标题 + 一句话描述 + 点击进入。
 * 大屏 3 列，中屏 2 列，小屏 1 列。
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { subjectList, type SubjectId } from '../lib/subjects';
import { labsForSubject } from '../lib/labs';
import SubjectIcon from '../components/ui/SubjectIcon';

export default function HomePage() {
  const { t, lang } = useApp();
  const [activeSubject, setActiveSubject] = useState<SubjectId | null>(null);

  return (
    <main className="flex-1 flex flex-col my-10 px-2 sm:px-6">
      {/* Brand Main Title Header */}
      <div className="mb-10 flex flex-col items-start max-w-2xl">
        <h1 className="text-base font-bold tracking-widest uppercase mono-font mb-4 text-[var(--fg)]">
          {t.brandName}
        </h1>
        <p className="text-base sm:text-lg text-[var(--muted)] serif-font italic mb-4">{t.subtitle}</p>
        <p className="text-xs sm:text-sm text-[var(--muted)] mono-font tracking-wide">// {t.description}</p>
      </div>

      {/* ── 学科切换卡片 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full mb-8">
        {subjectList.map((subject) => {
          const meta = t.subjects[subject.id];
          const isActive = activeSubject === subject.id;
          return (
            <button
              key={subject.id}
              type="button"
              onClick={() => setActiveSubject(activeSubject === subject.id ? null : subject.id)}
              className={`group border-t pt-4 pb-5 flex flex-col text-left transition-all duration-300 ${
                isActive
                  ? 'border-[var(--fg)]'
                  : 'border-[var(--border)] hover:border-[var(--fg)] opacity-50 hover:opacity-100'
              }`}
            >
              <div className="h-12 flex items-center justify-start mb-3 text-[var(--fg)]">
                <SubjectIcon
                  subjectId={subject.id}
                  className="w-9 h-9 stroke-[1.0] transition-transform group-hover:-translate-y-1 duration-300"
                  glyphClassName="text-4xl transition-transform group-hover:-translate-y-1 duration-300"
                />
              </div>
              <span className="text-sm font-semibold tracking-wide text-[var(--fg)] serif-font mb-1.5">
                {meta.title}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[var(--muted)] mono-font mb-3">
                {lang === 'zh' ? subject.gradeZh : subject.gradeEn}
              </span>
              <div className="flex flex-col space-y-1">
                <span className="text-[11px] font-bold text-[var(--fg)] mono-font">[{meta.status}]</span>
                <span className="text-[11px] text-[var(--muted)] sans-font leading-relaxed">{meta.note}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── 实验列表（淡入淡出） ── */}
      <div className="relative min-h-[200px]">
        {subjectList.map((subject) => {
          const isActive = activeSubject === subject.id;
          const labs = labsForSubject(subject.id);
          return (
            <div
              key={subject.id}
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full transition-all duration-400 ${
                isActive
                  ? 'opacity-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 translate-y-2 pointer-events-none absolute inset-0'
              }`}
              aria-hidden={!isActive}
            >
              {labs.map((lab) => {
                const Icon = lab.icon;
                return (
                  <Link
                    key={lab.id}
                    to={`/lab/${lab.id}`}
                    className="group flex items-start gap-3 p-3 border border-[var(--border)] hover:border-[var(--fg)] transition-colors duration-200"
                  >
                    <div className="shrink-0 mt-0.5 text-[var(--fg)]">
                      <Icon className="w-7 h-7" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--fg)] serif-font mb-0.5">
                        {lab.name[lang as 'zh' | 'en']}
                      </span>
                      <span className="block text-[11px] text-[var(--muted)] sans-font leading-relaxed">
                        {lab.description[lang as 'zh' | 'en']}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </main>
  );
}
