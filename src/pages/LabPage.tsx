/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 通用实验详情页骨架。
 * 依据路由参数 /lab/:labId 从实验注册表读取实验并渲染其组件；
 * 未注册 / 未知的 labId 渲染建设中占位。
 */
import { useLocation, useParams } from 'react-router-dom';
import BackLink from '../components/layout/BackLink';
import { Suspense, useEffect, useMemo } from 'react';
import { useApp } from '../lib/app-context';
import { translations } from '../lib/i18n';
import { labFromPath, labHref } from '../lib/labs';
import { useAiContext } from '../lib/ai-context';
import { subjects } from '../lib/subjects';
import UnderConstruction from '../components/ui/UnderConstruction';
import ShareInline from '../components/share/ShareInline';
import AskAiButton from '../components/ai/AskAiButton';
import AskQuizButton from '../components/ai/AskQuizButton';
import { usePageMeta, learningResourceLd } from '../lib/use-page-meta';

export default function LabPage() {
  const { labId } = useParams<{ labId: string }>();
  const location = useLocation();
  const { t, lang } = useApp();

  // 规范路径（/circuit-bench）与兼容路径（/lab/circuit-bench；/physics/circuit-bench 由路由跳转过来）解析到同一实验。
  const lab = labFromPath(location.pathname) ?? (labId ? labFromPath(`/lab/${labId}`) : undefined);
  const canonicalLabId = lab?.id ?? labId;
  const { setAiCtx } = useAiContext();
  // 路由级 meta：标题/描述 + 结构化数据。
  // 结构化讲解（FAQ / HowTo）已迁到 /learn/<id>，实验页不再宣称自己承载那份正文，
  // 因此这里固定用 LearningResource，也不再为本页额外加载内容 JSON。
  const pageMeta = useMemo(() => {
    if (!lab) return null;
    const url = `https://stem.irky.dev${labHref(lab)}`;
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
      const grade = subjects[lab.subjectId]?.gradeZh ?? '';
      // 合并而非覆盖：实验组件可能已经写入 live 实时摘要。
      setAiCtx((prev) => ({
        ...prev,
        topic: `${lab.name.zh}实验（${grade}）`,
        knowledge: `${lab.name.zh}实验（${lab.subjectId === 'physics' ? '苏科版' : '人教版'}）：${lab.description.zh}。${lab.aiKnowledge ? `\n${lab.aiKnowledge}` : ''}`,
      }));
    }
    return () => setAiCtx({});
  }, [lab, setAiCtx]);

  if (!lab) {
    return (
      <main className="grow shrink-0 flex flex-col my-[var(--sp-block)] px-2 sm:px-6">
        <div className="mb-8">
          <span className="text-[0.625rem] uppercase tracking-widest text-[var(--muted)] mono-font">
            / lab / {canonicalLabId ?? 'unknown'}
          </span>
          <h1 className="t-h1 font-medium serif-font mt-2 mb-2 text-[var(--fg)]">
            {t.underConstruction}
          </h1>
          <p className="text-sm text-[var(--muted)] serif-font italic">{t.labUnderConstruction}</p>
        </div>

        <UnderConstruction />

        <BackLink to="/">{t.backHome}</BackLink>
      </main>
    );
  }

  const Lab = lab.component;
  // 页头右侧状态徽标（可选）：工作台的 C++ / JS 计算核标识走标准动作簇末尾。
  const HeaderBadge = lab.headerBadge;

  // 页面级「问 AI」的兜底问句：实验自身若注册了更贴切的（含实时读数）问句，点击时以注册的为准
  const pageAiQuestion = lang === 'zh'
    ? `请讲解${lab.name.zh}实验的原理、操作要点与观察重点`
    : `Explain the ${lab.name.en} lab: its principle, key steps and what to observe`;

  return (
    <main className="grow shrink-0 flex flex-col mt-3 mb-[var(--sp-block)] px-2 sm:mt-[var(--sp-block)] sm:px-6">
      {/* 返回学科：Ghost Link（无下划线、无 ⌂ —— 回首页由顶栏 Logo 承担） */}
      <BackLink to={subjects[lab.subjectId].path}>
        {lang === 'zh' ? `返回${t.subjects[lab.subjectId].title}` : `Back to ${t.subjects[lab.subjectId].title}`}
      </BackLink>

      <div className="rise mb-3 sm:mb-8">
        {/* 第一行：图标 + 标题 + 年级眉标。
            眉标带 whitespace-nowrap（.t-eyebrow 里也有同名声明），永不被逐字拆开。 */}
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 shrink-0 flex items-center justify-center text-[var(--fg)]">
            <lab.icon className="w-10 h-10" />
          </div>
          <div className="flex min-w-0 flex-col items-start leading-tight">
            <h1 className="t-h1 font-medium serif-font text-[var(--fg)]">
              {lab.name[lang]}
              <span className="t-eyebrow ml-3 text-[var(--muted)] mono-font align-middle whitespace-nowrap">
                {lang === 'zh' ? subjects[lab.subjectId].gradeZh : subjects[lab.subjectId].gradeEn}
              </span>
            </h1>
          </div>
        </div>
        {/* 第二行：页面动作簇独占一行。
            此前它内联在 h1 的文本流里，390px 下被挤到标题下一行，与年级眉标的残片
            并排（「级 + 分享 + 问 AI + 考考你」）；工具页同病（「考考你」单独掉行）。
            抽成 flex 行后，顺序固定「分享 → 问 AI → 考考你」，对齐由 items-center 保证，
            间距只由一处 gap 给，不再各自带 ml-3 / ml-2。
            移动端 mt-1.5：这一行与标题同属一个语义块，桌面仍是 mt-3 的呼吸。 */}
        <div className="mt-1.5 flex flex-wrap items-center gap-3 sm:mt-3">
          <ShareInline
            title={lang === 'zh' ? `${lab.name.zh} · ${t.shareTitle}` : `${lab.name.en} · ${t.shareTitle}`}
            text={lang === 'zh'
              ? translations.zh.shareLabZh.replace('{name}', lab.name.zh).replace('{desc}', lab.description.zh)
              : translations.zh.shareLabEn.replace('{name}', lab.name.en).replace('{desc}', lab.description.en)}
          />
          <AskAiButton labId={lab.id} question={pageAiQuestion} />
          <AskQuizButton />
          {HeaderBadge && (
            <div className="ml-auto">
              <HeaderBadge />
            </div>
          )}
        </div>
      </div>

      {/* 建议流程：移动端 my-2（桌面保持 mb-5、无上边距），避免这句话上下各多出一段留白。
          工具台（meta.kind === 'tool'）没有三幕式阶段，不能继续提示「先预测…最后完成结论」——
          那句话会把自由工作台重新说成步骤锁定的实验。此处换成工具台自己的引导。 */}
      <p className="mt-2 mb-2 text-xs serif-font italic text-[var(--muted)] sm:mt-0 sm:mb-5">
        {lab.meta?.kind === 'tool'
          ? lang === 'zh'
            ? '自由工作台：加载预设或从空白开始，随时接线、读表、记录数据。所有操作都可撤销。'
            : 'Free workbench: start from a preset or a blank sheet, then wire, meter and record at will. Every action can be undone.'
          : lang === 'zh'
            ? '建议流程：先预测，再自由探索，最后完成结论。你可以随时返回任意阶段。'
            : 'Suggested flow: predict, explore freely, then conclude. You can revisit any stage at any time.'}
      </p>
      <Suspense
        fallback={
          <div className="py-24 text-center text-sm text-[var(--muted)] mono-font" aria-busy="true">
            …
          </div>
        }
      >
        <Lab />
      </Suspense>
    </main>
  );
}
