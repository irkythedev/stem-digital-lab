/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 科目详情页：展示该科目的标题、查表工具与实验列表（网格卡片）。
 * 依据路由参数 /subject/:subjectId 渲染对应科目；
 * 实验列表由 labs 注册表动态填充，卡片徽标来自 LabMeta.meta（可选，缺省时自动退化）。
 */
import { Link, useParams } from 'react-router-dom';
import type { ComponentType } from 'react';
import BackLink from '../components/layout/BackLink';
import { Calculator, Gauge, Sigma } from 'lucide-react';
import { useApp } from '../lib/app-context';
import { subjects, type SubjectId } from '../lib/subjects';
import { labCategories, regularLabsForSubject, toolsForSubject, labHref } from '../lib/labs';
import StatusTag from '../components/ui/StatusTag';
import SubjectHeading from '../components/layout/SubjectHeading';
import { FormulaIcon, PeriodicTableIcon } from '../components/ui/LabIcon';
import { EngineChip } from '../components/lab/EngineBadge';
import { getEngineTooltip } from '../components/lab/engine-copy';
import { usePageMeta } from '../lib/use-page-meta';

/** 卡片外壳：细描边 + 圆角 + 卡面底色（跟随深浅色令牌）；悬停轻微上浮并点亮边框 */
const CARD_CLS =
  'group flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-5 ' +
  'transition-[border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] ' +
  'hover:-translate-y-0.5 hover:border-[var(--fg)] focus-visible:border-[var(--fg)]';

/** 卡片右上角徽标：极简等宽小标签 */
const BADGE_CLS =
  'rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[0.625rem] leading-none mono-font text-[var(--muted)]';

/** 卡片底部指示箭头（悬停右移） */
const ARROW_CLS =
  'mono-font text-[var(--muted)] transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-hover:translate-x-1';

/** 工具卡片：静态查表工具与注册表里的专业工具台统一成同一形态 */
interface ToolCard {
  to: string;
  icon: ComponentType<{ className?: string }>;
  name: { zh: string; en: string };
  desc: { zh: string; en: string };
  /** 专业工具台（如电学工作台）：徽标显示 BETA，其余显示「查表」 */
  pro?: boolean;
}

/** 查表工具（固定路由；名称与描述同 vite.config.ts 的 GEO 产物口径） */
const TOOLS: Record<string, ToolCard[]> = {
  math: [
    {
      to: '/math-formulas',
      icon: Sigma,
      name: { zh: '数学公式速查', en: 'Math Formulas' },
      desc: { zh: '代数 / 几何 / 函数 / 统计公式整理', en: 'Algebra, geometry, functions and statistics formulas' },
    },
  ],
  physics: [
    {
      to: '/physics-constants',
      icon: Gauge,
      name: { zh: '物理常量速查', en: 'Physics Constants' },
      desc: { zh: '常用物理常量一览', en: 'Common physics constants at a glance' },
    },
    {
      to: '/physics-formulas',
      icon: Calculator,
      name: { zh: '物理公式速查', en: 'Physics Formulas' },
      desc: { zh: '电学 / 力学 / 光学公式整理', en: 'Electricity, mechanics and optics formulas' },
    },
  ],
  chemistry: [
    {
      to: '/chemistry-formulas',
      icon: FormulaIcon,
      name: { zh: '化学式与化合价', en: 'Chemical Formulas' },
      desc: { zh: '价态速查 · 十字交叉生成 · 由式反推 · 6 类练习', en: 'Valence reference, cross-rule builder, solver and practice' },
      pro: true,
    },
    {
      to: '/periodic-table',
      icon: PeriodicTableIcon,
      name: { zh: '元素周期表', en: 'Periodic Table' },
      desc: { zh: '118 元素 · 实物照片 · 读音（男 / 女声）· 中考跟读', en: '118 elements, photos, pronunciation (male/female voice), recite mode' },
    },
  ],
};

export default function SubjectPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const { t, lang } = useApp();
  const subjectMeta = subjectId ? subjects[subjectId as SubjectId] : undefined;
  usePageMeta(subjectMeta
    ? { title: `${t.subjects[subjectMeta.id].title} - ${t.brandName}` }
    : { title: `${t.pageNotFound} - ${t.brandName}` });

  const subject = subjectMeta;

  if (!subject) {
    return (
      <main className="grow shrink-0 flex flex-col items-center justify-center my-[var(--sp-block)] px-2 sm:px-6 text-center">
        <h1 className="text-2xl serif-font text-[var(--fg)] mb-4">{t.pageNotFound}</h1>
        <BackLink to="/">{t.backToHome}</BackLink>
      </main>
    );
  }

  const meta = t.subjects[subject.id];
  // 常规实验网格只放三幕式实验；专业工具台（meta.kind === 'tool'）归入「// 工具」栏
  const labList = regularLabsForSubject(subject.id);
  const categories = labCategories[subject.id] ?? [];
  const tools: ToolCard[] = [
    ...toolsForSubject(subject.id).map((lab) => ({
      to: labHref(lab),
      icon: lab.icon,
      name: lab.name,
      desc: lab.description,
      pro: true,
    })),
    ...(TOOLS[subject.id] ?? []),
  ];

  return (
    <main className="grow shrink-0 flex flex-col my-[var(--sp-block)] px-2 sm:px-6">
      <BackLink to="/">{t.backHome}</BackLink>

      <div className="mb-10">
        <SubjectHeading
          subjectId={subject.id}
          name={meta.title}
          caption={lang === 'zh' ? subject.gradeZh : subject.gradeEn}
        />
      </div>

      {/* 工具区：数学 → 公式速查；物理 → 电学工作台 + 常量 + 公式速查；化学 → 元素周期表 */}
      {tools.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold tracking-widest text-[var(--fg)] mono-font mb-4">
            // {lang === 'zh' ? '工具' : 'Tools'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {tools.map((tool) => (
              <Link key={tool.to} to={tool.to} className={CARD_CLS}>
                <div className="flex items-start justify-between gap-3">
                  <tool.icon className="w-5 h-5 shrink-0 text-[var(--muted)] transition-colors duration-[var(--dur-base)] group-hover:text-[var(--fg)]" />
                  <span className={tool.pro ? `${BADGE_CLS} border-[var(--fg)] text-[var(--fg)]` : BADGE_CLS}>
                    {tool.pro ? 'BETA' : lang === 'zh' ? '查表' : 'LOOKUP'}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold tracking-wide text-[var(--fg)] serif-font">
                  {tool.name[lang]}
                </h3>
                <p className="mt-1.5 mb-4 text-xs leading-relaxed text-[var(--muted)]">{tool.desc[lang]}</p>
                <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-3">
                  <span className="text-[0.6875rem] text-[var(--muted)]">{meta.title}</span>
                  <span aria-hidden className={ARROW_CLS}>→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 实验列表（来自注册表，未注册科目显示建设中占位） */}
      <section className="mb-8">
        <h2 className="text-sm font-bold tracking-widest text-[var(--fg)] mono-font mb-4">
          // {t.labs}
        </h2>
        {labList.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {labList.map((lab) => {
              const badge = lab.meta;
              const cat = categories.find((c) => c.id === lab.category);
              return (
                <Link key={lab.id} to={labHref(lab)} className={CARD_CLS}>
                  {/* 顶部行：学科图元 + 元信息徽标（C++ 计算核 / 教材定位） */}
                  <div className="flex items-start justify-between gap-3">
                    <lab.icon className="w-5 h-5 shrink-0 text-[var(--muted)] transition-colors duration-[var(--dur-base)] group-hover:text-[var(--fg)]" />
                    <span className="flex flex-wrap items-center justify-end gap-1.5">
                      {badge?.core && (
                        <EngineChip kind="wasm" title={getEngineTooltip('wasm', 'formulas', lang)} />
                      )}
                      {badge?.grade && <span className={BADGE_CLS}>{badge.grade[lang]}</span>}
                    </span>
                  </div>
                  {/* 主体：实验名 + 核心公式 + 一句话说明 */}
                  <h3 className="mt-3 text-lg font-semibold tracking-wide text-[var(--fg)] serif-font">
                    {lab.name[lang]}
                  </h3>
                  {badge?.formula && (
                    <p className="mt-1 text-sm mono-font text-[var(--fg)]">{badge.formula}</p>
                  )}
                  <p className="mt-1.5 mb-4 text-xs leading-relaxed text-[var(--muted)]">
                    {lab.description[lang]}
                  </p>
                  {/* 底部行：极淡的次级标签 + 指示箭头 */}
                  <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-3">
                    <span className="text-[0.6875rem] text-[var(--muted)]">
                      {cat ? `${cat[lang]} · ${lang === 'zh' ? '三幕探究' : 'Three stages'}` : ''}
                    </span>
                    <span aria-hidden className={ARROW_CLS}>→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="border-t border-[var(--border)] pt-4 pb-6 flex flex-col space-y-1.5">
            <StatusTag>{t.underConstruction}</StatusTag>
            <span className="text-[0.6875rem] text-[var(--muted)] sans-font leading-relaxed">
              {t.labUnderConstruction}
            </span>
          </div>
        )}
      </section>
    </main>
  );
}
