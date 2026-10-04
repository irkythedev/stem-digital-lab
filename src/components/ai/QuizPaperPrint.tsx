/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 错题卷打印视图（A4）。
 *
 * 为什么必须 createPortal 到 document.body：
 * AI 面板用 transform: translate3d 实现拖动，而带 transform 的祖先会成为 containing block，
 * 把 fixed/absolute 子树困在面板内部——打印时会被裁切且随面板定位。项目已有三处同样处理
 * （WelcomeDialog / TokenUsageDialog / LicenseDialog），此处沿用同一约定。
 *
 * 屏幕端由 CSS 隐藏（#quiz-paper-root { display:none }），仅在 @media print 内显示；
 * 页面其余部分在打印时整体隐藏。文字与排版细节见 src/index.css 的打印块。
 */
import { createPortal } from 'react-dom';
import AnswerRich, { InlineAnswer } from './AnswerRich';
import type { QuizPaper, PaperItem } from '../../lib/quiz-paper';
import { OPTION_LABELS, canUseTwoColumnOptions } from '../../lib/quiz-paper';

interface QuizPaperPrintProps {
  paper: QuizPaper;
  lang: 'zh' | 'en';
  /** 生成日期（调用方格式化，便于确定性渲染与测试） */
  generatedAt: string;
  /** 预览模式：屏幕端以 A4 白纸呈现；打印输出不受影响（皮肤仅在 @media screen 生效） */
  preview?: boolean;
}

export default function QuizPaperPrint({ paper, lang, generatedAt, preview = false }: QuizPaperPrintProps) {
  const zh = lang !== 'en';

  /** 答案文本：填空按语言用「或 / or」连接多家写法，其余用模型给出的文本 */
  const answerTextOf = (it: PaperItem): string =>
    it.type === 'fill'
      ? it.fillAnswers.filter((x) => x && x.trim()).join(zh ? ' 或 ' : ' or ')
      : it.correctText;

  return createPortal(
    <div id="quiz-paper-root" lang={zh ? 'zh-CN' : 'en'} data-preview={preview ? 'on' : 'off'}>
      {/* 纸张层：屏幕预览时是一张 A4 白纸；打印时尺寸交给 @page（见 index.css） */}
      <div className="exam-sheet">
        {/* 卷头 */}
        <header className="exam-head">
          <h1 className="exam-title">
            {zh
              ? `${paper.subjects.join(' · ') || '综合'} 错题复习卷`
              : `${paper.subjects.join(' · ') || 'General'} mistake review paper`}
          </h1>
          <p className="exam-sub">
            {paper.topics.length > 0 && (
              <>
                {zh ? '知识点范围：' : 'Topics: '}
                {paper.topics.join(zh ? '、' : ', ')}
                {'　·　'}
              </>
            )}
            {zh ? `共 ${paper.total} 题` : `${paper.total} questions`}
            {'　·　'}
            {zh ? `生成于 ${generatedAt}` : `Generated ${generatedAt}`}
          </p>
          <div className="exam-idline">
            <span>{zh ? '姓名：' : 'Name:'}___________</span>
            <span>{zh ? '班级：' : 'Class:'}___________</span>
            <span>{zh ? '得分：' : 'Score:'}___________</span>
          </div>
          {paper.estimatedMinutes > 0 && (
            <p className="exam-hint">
              {zh
                ? `建议限时：约 ${paper.estimatedMinutes} 分钟（按题目本身限时估算）`
                : `Suggested time: about ${paper.estimatedMinutes} min (estimated from each question's own limit)`}
            </p>
          )}
        </header>

        {/* 分节与题目 */}
        {paper.sections.map((sec, si) => (
          <section key={`${sec.topic}-${si}`} className="exam-section">
            {sec.topic && <h2 className="exam-section-title">{sec.topic}</h2>}
            {sec.items.map((it) => {
              // 选项排布：短选项两列省纸；含公式或任一选项偏长则退回单列，避免横向挤压
              const twoCols = canUseTwoColumnOptions(it.type, it.options);
              return (
                <article key={it.no} className="exam-item">
                  <div className="exam-q">
                    <span className="exam-no">{it.no}.</span>
                    <span className="exam-stem">
                      <InlineAnswer text={it.question} />
                    </span>
                    {it.source && (
                      <span className="exam-src">{zh ? `来源：${it.source}` : `From: ${it.source}`}</span>
                    )}
                  </div>

                  {it.type === 'choice' && it.options.length > 0 && (
                    <ol className={`exam-options${twoCols ? '' : ' exam-options--single'}`}>
                      {it.options.map((opt, oi) => (
                        <li key={oi}>
                          <span className="exam-opt-label">{OPTION_LABELS[oi] ?? ''}.</span>
                          <span className="exam-opt-text">
                            <InlineAnswer text={opt} />
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}

                  {it.type === 'fill' && (
                    <p className="exam-fill-line">
                      {zh ? '答：' : 'Answer: '}
                      <span className="exam-underline" />
                    </p>
                  )}

                  {/* 演算留白（紧凑档为 0，不占位） */}
                  {it.blankMm > 0 && <div className="exam-work" style={{ height: `${it.blankMm}mm` }} aria-hidden="true" />}
                </article>
              );
            })}
          </section>
        ))}

        {/* 答案与解析：强制独立分页到文末 */}
        {paper.includeAnswers && paper.answers.length > 0 && (
          <section className="exam-answers">
            <h2 className="exam-answers-title">{zh ? '答案与解析' : 'Answers and explanations'}</h2>
            {paper.answers.map((it) => {
              const ans = answerTextOf(it);
              return (
                <div key={it.no} className="exam-answer">
                  <p className="exam-answer-line">
                    <span className="exam-no">{it.no}.</span>
                    <span className="exam-answer-text">{ans || (zh ? '（无标准答案）' : '(no answer key)')}</span>
                  </p>
                  {it.explanation && (
                    <div className="exam-answer-exp">
                      <AnswerRich text={it.explanation} />
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* 页脚：打印时固定于页面底部，随每页重复 */}
        <div className="exam-foot">
          {zh
            ? '本卷题目与解析由本地实验学情与启发模型生成，仅供查漏补缺；请以教材及任课老师指导为准。'
            : 'Questions and explanations here are generated locally from lab learning records and a hint model, for gap-filling only; follow your textbook and teacher.'}
        </div>
      </div>
    </div>,
    document.body,
  );
}
