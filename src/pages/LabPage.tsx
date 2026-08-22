/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 通用实验详情页骨架。
 * 依据路由参数 /lab/:labId 从实验注册表读取实验并渲染其组件；
 * 未注册 / 未知的 labId 渲染建设中占位。
 */
import { Link, useParams } from 'react-router-dom';
import { House    } from 'lucide-react';;;;
import { useEffect, useMemo } from 'react';
import { useApp } from '../lib/app-context';
import { labMap } from '../lib/labs';
import { useAiContext } from '../lib/ai-context';
import AskAiButton from '../components/ai/AskAiButton';
import { subjects } from '../lib/subjects';
import UnderConstruction from '../components/ui/UnderConstruction';
import ShareInline from '../components/share/ShareInline';
import { usePageMeta, learningResourceLd } from '../lib/use-page-meta';

export default function LabPage() {
  const { labId } = useParams<{ labId: string }>();
  const { t, lang } = useApp();

  const lab = labId ? labMap[labId] : undefined;
  const { setAiCtx } = useAiContext();
  // 路由级 meta：标题/描述 + LearningResource 结构化数据（L3 GEO）
  const pageMeta = useMemo(() => {
    if (!lab) return null;
    const url = `https://stem.irky.dev/lab/${lab.id}`;
    return {
      title: `${lab.name[lang]} - ${t.brandName}`,
      description: lang === 'zh'
        ? `${lab.name.zh}实验：${lab.description.zh}。在线交互探究，无需登录，免费使用。`
        : `${lab.name.en} lab: ${lab.description.en}. Interactive, no login, free to use.`,
      jsonLd: learningResourceLd({
        name: lang === 'zh' ? lab.name.zh : lab.name.en,
        description: lang === 'zh' ? lab.description.zh : lab.description.en,
        url,
        educationalLevel: lang === 'zh'
          ? `初中 ${subjects[lab.subjectId].gradeZh}`
          : `Grades ${subjects[lab.subjectId].gradeEn}`,
      }),
    };
  }, [lab, lang, t.brandName]);
  usePageMeta(pageMeta);
  // AI 上下文：注入当前实验的名称/描述/章节
  useEffect(() => {
    if (lab) {
            const grade = subjects[lab.subject as keyof typeof subjects]?.gradeZh ?? '';
      setAiCtx({
        topic: `${lab.name.zh}实验（${grade}）`,
        knowledge: `${lab.name.zh}实验（${lab.subject === 'physics' ? '苏科版' : '人教版'}）：${lab.description.zh}。`,
      });
    }
    return () => setAiCtx({});
  }, [lab, setAiCtx]);

  if (!lab) {
    return (
      <main className="flex-1 flex flex-col my-16 px-2 sm:px-6">
        <div className="mb-8">
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)] mono-font">
            / lab / {labId ?? 'unknown'}
          </span>
          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight serif-font mt-2 mb-2 text-[var(--fg)]">
            {t.underConstruction}
          </h1>
          <p className="text-sm text-[var(--muted)] serif-font italic">{t.labUnderConstruction}</p>
        </div>

        <UnderConstruction />

        <div className="mt-10">
          <Link to="/" className="text-xs mono-font text-[var(--muted)] underline">
            ← {t.backHome}
          </Link>
        </div>
      </main>
    );
  }

  const Lab = lab.component;

  return (
    <main className="flex-1 flex flex-col my-10 px-2 sm:px-6">
      {/* 面包屑导航：返回学科（主）+ 首页（图标） */}
      <nav className="flex items-center gap-3 text-xs mono-font">
        <Link
          to={subjects[lab.subjectId].path}
          className="text-[var(--muted)] underline hover:text-[var(--fg)]"
        >
          ← {lang === 'zh' ? `返回${t.subjects[lab.subjectId].title}` : `Back to ${t.subjects[lab.subjectId].title}`}
        </Link>
        <Link
          to="/"
          aria-label={t.homeIcon}
          title={t.homeIcon}
          className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors inline-flex items-center"
        >
          <House className="w-3.5 h-3.5" />
        </Link>
      </nav>

      <div className="mt-5 mb-8">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 shrink-0 flex items-center justify-center text-[var(--fg)]">
            <lab.icon className="w-10 h-10" />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight serif-font text-[var(--fg)]">
              {lab.name[lang]}
              <span className="ml-3 text-[11px] uppercase tracking-widest text-[var(--muted)] mono-font align-middle">
                {lang === 'zh' ? subjects[lab.subjectId].gradeZh : subjects[lab.subjectId].gradeEn}
              </span>
              <ShareInline
                title={lang === 'zh' ? `${lab.name.zh} · ${t.shareTitle}` : `${lab.name.en} · ${t.shareTitle}`}
                text={lang === 'zh'
                  ? t.shareLabZh.replace('{name}', lab.name.zh).replace('{desc}', lab.description.zh)
                  : t.shareLabEn.replace('{name}', lab.name.en).replace('{desc}', lab.description.en)}
              />

            </h1>
          </div>
        </div>
      </div>

      <p className="mb-5 text-xs serif-font italic text-[var(--muted)]">{lang === 'zh' ? '建议流程：先预测，再自由探索，最后完成结论。你可以随时返回任意阶段。' : 'Suggested flow: predict, explore freely, then conclude. You can revisit any stage at any time.'}</p>
      <Lab />
    </main>
  );
}
