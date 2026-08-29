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
import { usePageMeta } from '../lib/use-page-meta';
import { Link, useNavigate } from 'react-router-dom';
import { Calculator, Gauge, Shuffle, Sigma } from 'lucide-react';
import DailyQuote from '../components/ui/DailyQuote';
import { useApp } from '../lib/app-context';
import { subjectList, type SubjectId } from '../lib/subjects';
import { labsForSubject, labs, labCategories, type LabCategoryId } from '../lib/labs';
import SubjectIcon from '../components/ui/SubjectIcon';
import { PeriodicTableIcon } from '../components/ui/LabIcon';

/**
 * 学科卡片「内容清单」按「项数」统一截断：显示前 3 项 + 省略号。
 * 三张卡片（数学/物理/化学）以同一「3 项概览 + …」形态呈现，显示范围一致。
 * 若该项内容不足 3 项，则原样完整显示（不加省略号）。
 * 以「·」作为项分隔符；hover（title）仍可查看完整清单。
 */
export function truncateNote(note: string, _maxLen?: number): string {
  const MAX_ITEMS = 3;
  // 按「·」拆成项（含中文与英文文案），忽略空项
  const items = note.split('·').map((s) => s.trim()).filter(Boolean);
  if (items.length < MAX_ITEMS) return note;
  return items.slice(0, MAX_ITEMS).join(' · ') + '…';
}

export default function HomePage() {
  const { t, lang } = useApp();
  // 路由级 meta（首页默认标题/描述，L3 GEO）
  usePageMeta({
    title: `${t.brandName} | STEM Digital Lab`,
    description: lang === 'zh'
      ? t.description + '。无需登录、中英双语、深浅主题，在线访问 https://stem.irky.dev'
      : t.description + '. No login, bilingual zh/en, light & dark themes — visit https://stem.irky.dev',
  });
  const navigate = useNavigate();
  const [activeSubject, setActiveSubject] = useState<SubjectId | null>(null);
  // 学科展开的领域分类 tab（默认第一个分类；切换学科时重置）
  const [activeCategory, setActiveCategory] = useState<LabCategoryId | null>(null);

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
    <main className="grow shrink-0 flex flex-col my-10 px-2 sm:px-6">
      {/* Brand Main Title Header（随机探索以页边注式小按钮缀于标题后） */}
      <div className="mb-6 sm:mb-10 flex flex-col items-start max-w-2xl">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 mb-2 sm:mb-4">
          <h1 className="text-base font-bold tracking-widest uppercase mono-font text-[var(--fg)]">
            {t.brandName}
          </h1>
          <button
            type="button"
            onClick={randomExplore}
            title={lang === 'zh' ? '随机进入一个实验或工具' : 'Jump to a random lab or tool'}
            className="inline-flex items-center gap-1 py-1 -my-1 text-[0.625rem] sm:text-[0.6875rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          >
            <Shuffle className="w-3 h-3" />
            {t.randomExplore}
          </button>
        </div>
        <p className="text-sm sm:text-lg text-[var(--muted)] serif-font italic mb-2 sm:mb-4">{t.subtitle}</p>
        <p className="text-[0.6875rem] sm:text-sm text-[var(--muted)] mono-font tracking-wide">// {t.description}</p>
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
                if (next) {
                  setActiveCategory(labCategories[next][0].id);
                  scrollToLabList();
                }
              }}
              className={`group relative border-t pt-2.5 pb-3 sm:pt-4 sm:pb-5 flex flex-col items-center text-center transition-[border-color,background-color,transform] duration-300 hover:z-10 hover:scale-[1.02] ${
                isActive
                  ? 'border-[var(--fg)]'
                  : 'border-[var(--border)] hover:border-[var(--fg)] hover:bg-[var(--fg)]/[0.04]'
              }`}
            >
              <div className="h-9 sm:h-12 flex items-center justify-center mb-1.5 sm:mb-3 text-[var(--fg)]">
                <SubjectIcon
                  subjectId={subject.id}
                  className="w-7 h-7 sm:w-9 sm:h-9 stroke-[1.0] transition-transform duration-300 group-hover:scale-110"
                  glyphClassName="text-3xl sm:text-4xl transition-transform duration-300 group-hover:scale-110"
                />
              </div>
              <span className="text-sm font-semibold tracking-wide text-[var(--fg)] serif-font mb-0.5 sm:mb-1.5">
                {meta.title}
              </span>
              <span className="text-[0.625rem] uppercase tracking-widest text-[var(--muted)] mono-font mb-1 sm:mb-3">
                {lang === 'zh' ? subject.gradeZh : subject.gradeEn}
              </span>
              {/* 内容清单：桌面显示（移动端隐藏），按「项数」统一截断为前 3 项 + 省略号，
                 三科卡片呈同一「3 项概览 + …」形态；hover（title）可看完整清单；min-h 保证三科卡片等高 */}
              <div className="hidden sm:flex flex-col space-y-1 min-h-[2.6rem]">
                <span title={meta.note} className="text-[0.6875rem] text-[var(--muted)] sans-font leading-relaxed">{truncateNote(meta.note)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── 实验列表（淡入淡出）：紧跟学科卡片，点击后即时可见；未展开时无占位高度 ── */}
      {/* overflow-hidden：未选中/非激活学科的实验卡片以 absolute inset-0 渲染，
         内容会溢出容器并撑高文档滚动区域（移动端页脚下方空白根因），裁剪隐藏内容 */}
      <div id="lab-list" className={`relative overflow-hidden ${activeSubject ? 'min-h-[200px]' : ''}`}>
        {subjectList.map((subject) => {
          const isActive = activeSubject === subject.id;
          const allLabs = labsForSubject(subject.id);
          const cats = labCategories[subject.id];
          // 领域过滤：按当前 tab；无 tab 时（防御）显示全部
          const shownLabs = activeCategory ? allLabs.filter((lab) => lab.category === activeCategory) : allLabs;
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
              {/* 领域分类 tab（≥2 类才显示；样式沿用书本化小标签，与电路样式切换按钮一致） */}
              {isActive && cats.length >= 2 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {cats.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={`text-xs mono-font px-2.5 py-1.5 sm:py-1 border transition-colors ${
                        activeCategory === cat.id
                          ? 'border-[var(--fg)] text-[var(--fg)]'
                          : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
                      }`}
                    >
                      {lang === 'zh' ? cat.zh : cat.en}
                    </button>
                  ))}
                </div>
              )}
              {/* 实验网格 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {shownLabs.map((lab) => {
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
                        <span className="block text-[0.6875rem] text-[var(--muted)] sans-font leading-relaxed">
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
                  <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-3">
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
                        <span className="block text-[0.6875rem] text-[var(--muted)] sans-font leading-relaxed">
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
                        <span className="block text-[0.6875rem] text-[var(--muted)] sans-font leading-relaxed">
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
                          <span className="block text-[0.6875rem] text-[var(--muted)] sans-font leading-relaxed">
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
                          <span className="block text-[0.6875rem] text-[var(--muted)] sans-font leading-relaxed">
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
