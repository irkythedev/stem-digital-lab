/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 首页看板：Hero 标题区 + 三大科目切换 + 实验列表淡入淡出。
 *
 * 点击学科卡片 → 下方淡入对应实验列表（不跳转页面）。
 * 每个实验显示：LabIcon + 标题 + 一句话描述 + 点击进入。
 * 大屏 3 列，中屏 2 列，小屏 1 列。
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calculator, Gauge, Shuffle, Sigma } from 'lucide-react';
import DailyQuote from '../components/ui/DailyQuote';
import { useApp } from '../lib/app-context';
import { subjectList, type SubjectId } from '../lib/subjects';
import { labsForSubject, labs } from '../lib/labs';
import SubjectIcon from '../components/ui/SubjectIcon';
import { PeriodicTableIcon } from '../components/ui/LabIcon';

export default function HomePage() {
  const { t, lang } = useApp();
  const navigate = useNavigate();
  const [activeSubject, setActiveSubject] = useState<SubjectId | null>(null);

  // 随机探索：从全部实验 + 工具（周期表/物理常量/数学公式）中随机选一个进入
  const randomExplore = () => {
    const destinations: string[] = [
      ...labs.map((lab) => `/lab/${lab.id}`),
      '/periodic-table',
      '/physics-constants',
      '/math-formulas',
      '/physics-formulas',
    ];
    const pick = destinations[Math.floor(Math.random() * destinations.length)];
    navigate(pick);
  };

  // 展开学科时若实验列表不在视口内，平滑滚动到列表顶部（矮屏/长列表兜底）
  const scrollToLabList = () => {
    requestAnimationFrame(() => {
      const el = document.getElementById('lab-list');
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  return (
    <main className="flex-1 flex flex-col my-10 px-2 sm:px-6">
      {/* Brand Main Title Header */}
      <div className="mb-6 sm:mb-10 flex flex-col items-start max-w-2xl">
        <h1 className="text-base font-bold tracking-widest uppercase mono-font mb-2 sm:mb-4 text-[var(--fg)]">
          {t.brandName}
        </h1>
        <p className="text-sm sm:text-lg text-[var(--muted)] serif-font italic mb-2 sm:mb-4">{t.subtitle}</p>
        <p className="text-[11px] sm:text-sm text-[var(--muted)] mono-font tracking-wide">// {t.description}</p>
      </div>

      {/* ── 学科切换卡片 ── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6 w-full mb-6 sm:mb-8">
        {subjectList.map((subject) => {
          const meta = t.subjects[subject.id];
          const isActive = activeSubject === subject.id;
          return (
            <button
              key={subject.id}
              type="button"
              onClick={() => {
                const next = activeSubject === subject.id ? null : subject.id;
                setActiveSubject(next);
                if (next) scrollToLabList();
              }}
              className={`group border-t pt-2.5 pb-3 sm:pt-4 sm:pb-5 flex flex-col text-left transition-all duration-300 ${
                isActive
                  ? 'border-[var(--fg)]'
                  : 'border-[var(--border)] hover:border-[var(--fg)] opacity-60 hover:opacity-100'
              }`}
            >
              <div className="h-9 sm:h-12 flex items-center justify-start mb-1.5 sm:mb-3 text-[var(--fg)]">
                <SubjectIcon
                  subjectId={subject.id}
                  className="w-7 h-7 sm:w-9 sm:h-9 stroke-[1.0] transition-transform group-hover:-translate-y-1 duration-300"
                  glyphClassName="text-3xl sm:text-4xl transition-transform group-hover:-translate-y-1 duration-300"
                />
              </div>
              <span className="text-sm font-semibold tracking-wide text-[var(--fg)] serif-font mb-0.5 sm:mb-1.5">
                {meta.title}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[var(--muted)] mono-font mb-1 sm:mb-3">
                {lang === 'zh' ? subject.gradeZh : subject.gradeEn}
              </span>
              {/* 状态与说明：桌面显示，移动端隐藏（三列窄卡精简） */}
              <div className="hidden sm:flex flex-col space-y-1">
                <span className="text-[11px] text-[var(--muted)] sans-font leading-relaxed">{meta.note}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── 随机探索：随机进入某个实验/工具 ── */}
      <div className="flex justify-center w-full mb-8">
        <button
          type="button"
          onClick={randomExplore}
          className="inline-flex items-center justify-center gap-2.5 sm:gap-2 px-6 py-3 sm:px-5 sm:py-2 border border-[var(--border)] text-sm sm:text-xs mono-font text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--fg)] transition-colors"
        >
          <Shuffle className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          {t.randomExplore}
        </button>
      </div>

      {/* ── 实验列表（淡入淡出）：紧跟学科卡片，点击后即时可见；未展开时无占位高度 ── */}
      <div id="lab-list" className={`relative ${activeSubject ? 'min-h-[200px]' : ''}`}>
        {subjectList.map((subject) => {
          const isActive = activeSubject === subject.id;
          const labs = labsForSubject(subject.id);
          return (
            <div
              key={subject.id}
              className={`w-full transition-all duration-400 ${
                isActive
                  ? 'opacity-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 translate-y-2 pointer-events-none absolute inset-0'
              }`}
              aria-hidden={!isActive}
            >
              {/* 实验网格 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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

              {/* 工具区：数学 → 公式速查；物理 → 常量速查；化学 → 周期表（独立于实验） */}
              {(subject.id === 'math' || subject.id === 'physics' || subject.id === 'chemistry') && (
                <div className="mt-6">
                  <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-3">
                    // {lang === 'zh' ? '工具' : 'Tools'}
                  </h3>
                  {subject.id === 'math' && (
                    <Link
                      to="/math-formulas"
                      className="group flex items-start gap-3 p-3 border border-[var(--border)] hover:border-[var(--fg)] transition-colors duration-200 sm:max-w-md"
                    >
                      <div className="shrink-0 mt-0.5 text-[var(--fg)]">
                        <Sigma className="w-7 h-7" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--fg)] serif-font mb-0.5">
                          {lang === 'zh' ? '数学公式速查' : 'Math Formulas'}
                        </span>
                        <span className="block text-[11px] text-[var(--muted)] sans-font leading-relaxed">
                          {lang === 'zh' ? '核心公式一表全览，附口诀、易错点与应用' : 'Core formulas with mnemonics, pitfalls, and usage'}
                        </span>
                      </div>
                    </Link>
                  )}
                  {subject.id === 'chemistry' && (
                    <Link
                      to="/periodic-table"
                      className="group flex items-start gap-3 p-3 border border-[var(--border)] hover:border-[var(--fg)] transition-colors duration-200 sm:max-w-md"
                    >
                      <div className="shrink-0 mt-0.5 text-[var(--fg)]">
                        <PeriodicTableIcon className="w-7 h-7" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--fg)] serif-font mb-0.5">
                          {lang === 'zh' ? '元素周期表' : 'Periodic Table'}
                        </span>
                        <span className="block text-[11px] text-[var(--muted)] sans-font leading-relaxed">
                          {lang === 'zh' ? '118 个元素一表全览，支持检索与读音' : 'All 118 elements with search and pronunciation'}
                        </span>
                      </div>
                    </Link>
                  )}
                  {subject.id === 'physics' && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Link
                        to="/physics-constants"
                        className="group flex items-start gap-3 p-3 border border-[var(--border)] hover:border-[var(--fg)] transition-colors duration-200"
                      >
                        <div className="shrink-0 mt-0.5 text-[var(--fg)]">
                          <Gauge className="w-7 h-7" />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold text-[var(--fg)] serif-font mb-0.5">
                            {lang === 'zh' ? '物理常量速查' : 'Physics Constants'}
                          </span>
                          <span className="block text-[11px] text-[var(--muted)] sans-font leading-relaxed">
                            {lang === 'zh' ? '常用常量与典型数值一表全览，附物理意义与应用' : 'Common constants at a glance, with meaning and usage'}
                          </span>
                        </div>
                      </Link>
                      <Link
                        to="/physics-formulas"
                        className="group flex items-start gap-3 p-3 border border-[var(--border)] hover:border-[var(--fg)] transition-colors duration-200"
                      >
                        <div className="shrink-0 mt-0.5 text-[var(--fg)]">
                          <Calculator className="w-7 h-7" />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold text-[var(--fg)] serif-font mb-0.5">
                            {lang === 'zh' ? '物理公式速查' : 'Physics Formulas'}
                          </span>
                          <span className="block text-[11px] text-[var(--muted)] sans-font leading-relaxed">
                            {lang === 'zh' ? '核心公式分类速览，相关常量一键跳转' : 'Core formulas at a glance, with related constants linked'}
                          </span>
                        </div>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 每日科学：名人名言与故事（当天固定 + 可换一条） ── */}
      <DailyQuote lang={lang} />
    </main>
  );
}
