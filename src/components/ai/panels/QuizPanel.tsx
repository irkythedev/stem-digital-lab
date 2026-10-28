/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * QuizPanel —— AI 面板的考考你页。
 *
 * P0 拆分产物：JSX **逐字**从 AiAssistant.tsx 搬移（未改一个字符），只把「读到的值」与「调用的动作」
 * 按域打包成 props。面板是纯展示：不持有业务状态、不发请求、不改 view 状态机；
 * DOM 结构 / className / 触屏热区 / .ai-* 规则与拆分前完全一致。
 * memo 导出：state 由父级按值 memo、actions 走 useStable（身份恒定）→ 父组件无关的 setState 不再触发本面板重渲。
 */

import { memo } from 'react';
import { type QuizAngle, type QuizQType } from '../../../lib/ai-config';
import AnswerRich, { InlineAnswer } from '../AnswerRich';
import { Mark } from './panel-shared';
import { RotateCcw, Timer, ShieldCheck } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';

export interface QuizPanelState {
  busy: any;
  config: any;
  fillAiJudge: any;
  fillJudging: any;
  quizDone: any;
  quizError: any;
  quizFillInput: any;
  quizIdx: any;
  quizLoading: any;
  quizQ: any;
  quizQuestions: any;
  quizSelected: any;
  quizSetup: any;
  quizStats: any;
  setupAngle: any;
  setupCount: any;
  setupQType: any;
  setupTimeLimit: any;
  timeLeft: any;
  usage: any;
}

export interface QuizPanelActions {
  loadQuizBatch: (overrideCount?: number, overrideAngle?: QuizAngle, overrideTimeLimit?: number, overrideQType?: QuizQType) => Promise<void>;
  nextQuiz: () => void;
  pickQuizOption: (idx: number) => void;
  resetQuiz: () => void;
  restartQuiz: () => void;
  setQuizFillInput: any;
  setSetupAngle: any;
  setSetupCount: any;
  setSetupQType: any;
  setSetupTimeLimit: any;
  setView: any;
  startQuiz: (count: number, angle: QuizAngle, timeLimit: number, qtype?: QuizQType) => void;
  submitFillAnswer: () => Promise<void>;
  toggleFillAiJudge: (v: boolean) => void;
}

interface QuizPanelProps {
  lang: 'zh' | 'en';
  state: QuizPanelState;
  actions: QuizPanelActions;
}

function QuizPanelInner({ lang, state, actions }: QuizPanelProps) {
  const { busy, config, fillAiJudge, fillJudging, quizDone, quizError, quizFillInput, quizIdx, quizLoading, quizQ, quizQuestions, quizSelected, quizSetup, quizStats, setupAngle, setupCount, setupQType, setupTimeLimit, timeLeft, usage } = state;
  const { loadQuizBatch, nextQuiz, pickQuizOption, resetQuiz, restartQuiz, setQuizFillInput, setSetupAngle, setSetupCount, setSetupQType, setSetupTimeLimit, setView, startQuiz, submitFillAnswer, toggleFillAiJudge } = actions;
  return (
    <>
<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2.5">
            {!config ? (
              /* 未配置：提示先完成配置 */
              <div className="pt-6 text-center space-y-2">
                <p className="text-xs text-[var(--muted)] italic">
                  {lang === 'zh' ? '请先配置 AI 服务，再开始出题练习。' : 'Configure the AI service first to start quiz practice.'}
                </p>
                <button
                  type="button"
                  onClick={() => setView('settings')}
                  className="px-2.5 py-1 text-[0.6875rem] mono-font border border-[var(--fg)] text-[var(--fg)] transition-colors"
                >
                  {lang === 'zh' ? '去配置 →' : 'Configure →'}
                </button>
              </div>
            ) : !quizSetup ? (
              /* 出题设置面板 */
              <div className="space-y-3 pt-2">
                <p className="text-[0.6875rem] font-bold mono-font text-[var(--fg)] tracking-widest">
                  {lang === 'zh' ? '出题设置' : 'Quiz setup'}
                </p>
                {/* 题量 */}
                <div>
                  <p className="text-[0.625rem] mono-font text-[var(--muted)] mb-1.5">{lang === 'zh' ? '题量' : 'Questions'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[5, 10, 15].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSetupCount(n)}
                        className={`px-2.5 py-1 text-[0.6875rem] mono-font border transition-colors ${setupCount === n ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}
                      >
                        {n} {lang === 'zh' ? '题' : ''}
                      </button>
                    ))}
                  </div>
                </div>
                {/* 出题角度 */}
                <div>
                  <p className="text-[0.625rem] mono-font text-[var(--muted)] mb-1.5">{lang === 'zh' ? '出题角度' : 'Angle'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      ['basic', lang === 'zh' ? '基础知识' : 'Basic'],
                      ['advanced', lang === 'zh' ? '进阶提升' : 'Advanced'],
                      ['tricky', lang === 'zh' ? '易混淆辨析' : 'Tricky'],
                    ] as [QuizAngle, string][]).map(([angle, label]) => (
                      <button
                        key={angle}
                        type="button"
                        onClick={() => setSetupAngle(angle)}
                        className={`px-2.5 py-1 text-[0.6875rem] mono-font border transition-colors ${setupAngle === angle ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* 题型 */}
                <div>
                  <p className="text-[0.625rem] mono-font text-[var(--muted)] mb-1.5">{lang === 'zh' ? '题型' : 'Type'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['choice', 'fill', 'mixed'] as QuizQType[]).map((qt) => {
                      const label = qt === 'choice' ? (lang === 'zh' ? '单选' : 'Choice') : qt === 'fill' ? (lang === 'zh' ? '填空' : 'Fill-in') : (lang === 'zh' ? '混合' : 'Mixed');
                      return (
                        <button
                          key={qt}
                          type="button"
                          onClick={() => setSetupQType(qt)}
                          className={`px-2.5 py-1 text-[0.6875rem] mono-font border transition-colors ${setupQType === qt ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* AI 辅助判分（仅填空/混合题型时显示） */}
                {setupQType !== 'choice' && (
                  <div>
                    <label className="flex items-start gap-2 text-[0.625rem] mono-font text-[var(--muted)] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={fillAiJudge}
                        onChange={(e) => toggleFillAiJudge(e.target.checked)}
                        className="accent-[var(--fg)] w-3.5 h-3.5 mt-0.5"
                      />
                      <span>
                        {lang === 'zh' ? 'AI 辅助判分（填空题规则判错时，让 AI 再判断一次是否等价）' : 'AI-assisted grading (when rule grading fails on fill-in, ask AI to re-check equivalence)'}
                      </span>
                    </label>
                  </div>
                )}
                {/* 每题限时 */}
                <div>
                  <p className="text-[0.625rem] mono-font text-[var(--muted)] mb-1.5">{lang === 'zh' ? '每题限时（超时算错）' : 'Time limit per question (timeout = wrong)'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([[0, lang === 'zh' ? '不限时' : 'None'], [30, '30s'], [60, '60s'], [90, '90s']] as [number, string][]).map(([sec, label]) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setSetupTimeLimit(sec)}
                        className={`px-2.5 py-1 text-[0.6875rem] mono-font border transition-colors ${setupTimeLimit === sec ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startQuiz(setupCount, setupAngle, setupTimeLimit, setupQType)}
                  className="px-3 py-1.5 text-[0.6875rem] mono-font border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors"
                >
                  {lang === 'zh' ? '开始作答 →' : 'Start →'}
                </button>
              </div>
            ) : quizLoading ? (
              /* 出题中 */
              <div className="py-8 flex flex-col items-center gap-2">
                <ThinkingOrb state="shaping" size={20} theme="auto" />
                <p className="text-xs text-[var(--muted)] italic">{lang === 'zh' ? '正在出题…' : 'Creating questions…'}</p>
              </div>
            ) : quizError ? (
              /* 错误 */
              <div className="space-y-2">
                <p className="text-xs text-[var(--error)] mono-font">{quizError}</p>
                <button
                  type="button"
                  onClick={() => void loadQuizBatch()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[0.6875rem] mono-font leading-none rounded-md border border-[var(--border)]/80 bg-[var(--accent-light)] text-[var(--fg)] transition-colors hover:bg-[var(--accent-light)]/70 hover:border-[var(--border)] tap-area"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  {lang === 'zh' ? '重试' : 'Retry'}
                </button>
              </div>
            ) : quizDone ? (
              /* 本轮完成小结 */
              <div className="pt-6 text-center space-y-2.5">
                <p className="text-sm serif-font">
                  {lang === 'zh'
                    ? `本轮答对 ${quizStats.correct} / ${quizStats.total} 题`
                    : `This round: ${quizStats.correct} / ${quizStats.total} correct`}
                </p>
                {quizStats.total > 0 && (
                  <p className="text-[0.6875rem] mono-font text-[var(--muted)]">
                    {lang === 'zh'
                      ? `正确率 ${Math.round((quizStats.correct / quizStats.total) * 100)}%`
                      : `${Math.round((quizStats.correct / quizStats.total) * 100)}% accuracy`}
                  </p>
                )}
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={restartQuiz}
                    className="px-2.5 py-1 text-[0.6875rem] mono-font border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors"
                  >
                    {lang === 'zh' ? '再来一轮 →' : 'Another round →'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { resetQuiz(); setView('chat'); }}
                    className="px-2.5 py-1 text-[0.6875rem] mono-font border border-[var(--border)] hover:border-[var(--fg)] transition-colors"
                  >
                    {lang === 'zh' ? '返回问答' : 'Back to chat'}
                  </button>
                </div>
              </div>
            ) : quizQ && (
              /* 题目 */
              <div className="space-y-2.5">
                {/* 进度 + 倒计时 */}
                <div className="flex items-center justify-between text-[0.625rem] mono-font text-[var(--muted)]">
                  <span>
                    {lang === 'zh'
                      ? `第 ${quizIdx + 1} / ${quizQuestions.length} 题`
                      : `Q${quizIdx + 1} / ${quizQuestions.length}`}
                  </span>
                  {timeLeft !== null && timeLeft > 0 && (
                    <span className={timeLeft <= 5 ? 'text-[var(--error)] font-bold' : ''}>
                      <Timer className="mr-0.5 inline-block h-3 w-3 align-[-2px]" aria-hidden="true" />{timeLeft}s
                    </span>
                  )}
                </div>
                <p className="text-sm serif-font leading-relaxed">
                  <AnswerRich text={quizQ.question} />
                </p>
                {quizQ.type === 'fill' ? (
                  /* 填空题：输入框 + 提交 */
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={quizFillInput}
                        onChange={(e) => setQuizFillInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && quizSelected === null && !fillJudging) void submitFillAnswer(); }}
                        disabled={quizSelected !== null || fillJudging}
                        placeholder={lang === 'zh' ? '输入你的答案…' : 'Type your answer…'}
                        maxLength={60}
                        className="flex-1 rounded-md border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] outline-none focus:border-[var(--fg)] disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => void submitFillAnswer()}
                        disabled={quizSelected !== null || !quizFillInput.trim() || fillJudging}
                        className="px-3 py-1.5 text-[0.6875rem] mono-font border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors disabled:opacity-40"
                      >
                        {fillJudging ? (lang === 'zh' ? '判分中…' : 'Grading…') : (lang === 'zh' ? '提交' : 'Submit')}
                      </button>
                    </div>
                    {/* 答后反馈（填空） */}
                    {quizSelected !== null && (
                      <div className="border border-[var(--border)] px-2.5 py-2 space-y-1.5">
                        <p className={`text-[0.6875rem] mono-font font-bold ${quizSelected === 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                          {quizSelected === -1
                            ? <><Timer className="mr-1 inline-block h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />{lang === 'zh' ? '超时未作答' : 'Timed out'}</>
                            : quizSelected === 0
                              ? <><Mark ok className="mr-1" />{lang === 'zh' ? '回答正确' : 'Correct'}</>
                              : <><Mark ok={false} className="mr-1" />{lang === 'zh' ? `正确答案：${quizQ.fillAnswers.join(' 或 ')}` : `Correct answer: ${quizQ.fillAnswers.join(' or ')}`}</>}
                        </p>
                        {quizSelected !== -1 && quizFillInput && quizSelected !== 0 && (
                          <p className="text-[0.625rem] mono-font text-[var(--muted)]">
                            {lang === 'zh' ? `你的答案：${quizFillInput}` : `Your answer: ${quizFillInput}`}
                          </p>
                        )}
                        {quizQ.explanation && (
                          <div className="text-xs serif-font leading-relaxed">
                            <AnswerRich text={quizQ.explanation} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* 选择题：选项按钮 */
                  <div className="flex flex-col gap-1.5">
                    {quizQ.options.map((opt, idx) => {
                      const isPicked = quizSelected === idx;
                      const isAnswer = idx === quizQ.answerIdx;
                      let cls = 'border-[var(--border)] text-[var(--fg)] hover:border-[var(--fg)]';
                      if (quizSelected !== null && quizQ.answerIdx !== -1) {
                        // 答完：正确项高亮（即使学生没选它），错误选择标红
                        if (isAnswer) cls = 'border-[var(--success)] text-[var(--success)] font-bold';
                        else if (isPicked) cls = 'border-[var(--error)] text-[var(--error)]';
                        else cls = 'border-[var(--border)] text-[var(--muted)]';
                      }
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => pickQuizOption(idx)}
                          disabled={quizSelected !== null}
                          className={`text-left text-xs serif-font px-2.5 py-1.5 border transition-colors disabled:cursor-default ${cls}`}
                        >
                          <span className="mono-font text-[var(--muted)] mr-1.5">{String.fromCharCode(65 + idx)}.</span>
                          <InlineAnswer text={opt} />
                        </button>
                      );
                    })}
                  </div>
                )}
                {/* 答后反馈：对/错 + 解析（选择题；填空已在其输入框区内反馈） */}
                {quizQ.type === 'choice' && quizSelected !== null && quizQ.answerIdx !== -1 && (
                  <div className="border border-[var(--border)] px-2.5 py-2 space-y-1.5">
                    <p className={`text-[0.6875rem] mono-font font-bold ${quizSelected === quizQ.answerIdx ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                      {quizSelected === -1
                        ? <><Timer className="mr-1 inline-block h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />{lang === 'zh' ? '超时未作答' : 'Timed out'}</>
                        : quizSelected === quizQ.answerIdx
                          ? <><Mark ok className="mr-1" />{lang === 'zh' ? '回答正确' : 'Correct'}</>
                          : <><Mark ok={false} className="mr-1" />{lang === 'zh' ? `正确答案是 ${String.fromCharCode(65 + quizQ.answerIdx)}` : `Correct answer: ${String.fromCharCode(65 + quizQ.answerIdx)}`}</>}
                    </p>
                    {quizQ.explanation && (
                      <div className="text-xs serif-font leading-relaxed">
                        <AnswerRich text={quizQ.explanation} />
                      </div>
                    )}
                  </div>
                )}
                {/* 无标准答案（解析失败降级）：给出原样题目，不判分 */}
                {quizQ.type === 'choice' && quizSelected !== null && quizQ.answerIdx === -1 && (
                  <p className="text-[0.6875rem] text-[var(--muted)] italic">
                    {lang === 'zh' ? '本题未识别出标准答案，未计分。可点击「下一题」。' : 'No standard answer detected for this question, not scored. Try "Next question".'}
                  </p>
                )}
                {/* 操作：下一题 / 返回 */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={nextQuiz}
                    disabled={quizSelected === null || quizLoading}
                    className="px-2.5 py-1 text-[0.6875rem] mono-font border border-[var(--fg)] text-[var(--fg)] transition-colors disabled:opacity-40"
                  >
                    {lang === 'zh' ? '下一题 →' : 'Next question →'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { resetQuiz(); setView('chat'); }}
                    className="px-2.5 py-1 text-[0.6875rem] mono-font border border-[var(--border)] hover:border-[var(--fg)] transition-colors"
                  >
                    {lang === 'zh' ? '返回问答' : 'Back to chat'}
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* 免责条 + 模型/用量（与 AI 对话底部对齐；移动端单行截断） */}
          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--accent-light)] px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p
                className="flex items-center gap-1.5 min-w-0 flex-1 text-[0.625rem] text-[var(--muted)] leading-snug"
                title={lang === 'zh' ? '题目与解析由 AI 生成，仅供参考，请以教材和老师讲解为准' : 'Questions and explanations are AI-generated for reference, trust the textbook and your teacher'}
              >
                <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{lang === 'zh' ? '题目由 AI 生成，仅供参考' : 'AI-generated, for reference'}</span>
              </p>
              {/* 模型名 + 用量统计（与对话视图共用样式） */}
              <p className="shrink-0 flex items-center gap-2 mono-font tabular-nums whitespace-nowrap">
                {config?.model && <span className="text-[0.625rem] text-[var(--tech-blue)] font-semibold">{config.model}</span>}
                {usage && (
                  <span className="flex items-center gap-1 text-[var(--fg)]">
                    <span className="text-[0.6875rem]">≈{usage.tokens.toLocaleString()} tokens</span>
                    <span className="text-[0.6875rem] text-[var(--muted)]">{busy ? (lang === 'zh' ? '· 生成中…' : '· Generating…') : `· ${usage.speed} t/s`}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
    </>
  );
}

export default memo(QuizPanelInner);
