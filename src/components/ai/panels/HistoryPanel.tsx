/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * HistoryPanel —— AI 面板的学习记录页（含错题卷与总结）。
 *
 * P0 拆分产物：JSX **逐字**从 AiAssistant.tsx 搬移（未改一个字符），只把「读到的值」与「调用的动作」
 * 按域打包成 props。面板是纯展示：不持有业务状态、不发请求、不改 view 状态机；
 * DOM 结构 / className / 触屏热区 / .ai-* 规则与拆分前完全一致。
 * memo 导出：state 由父级按值 memo、actions 走 useStable（身份恒定）→ 父组件无关的 setState 不再触发本面板重渲。
 */

import { memo } from 'react';
import { relativeTime } from '../../../lib/ai-history';
import { type PaperBlankLevel, type PaperSortMode } from '../../../lib/quiz-paper';
import AnswerRich, { InlineAnswer } from '../AnswerRich';
import { Mark } from './panel-shared';
import QuizPaperPrint from '../QuizPaperPrint';
import { ShieldCheck, ChevronDown, History, ArrowLeft, Check, CircleX, Copy, Trash2, Printer, Eye, Sparkles, GraduationCap } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface HistoryPanelState {
  aiCtx: any;
  config: any;
  confirmClearHist: any;
  confirmClearQuiz: any;
  copiedId: any;
  copyFailedId: any;
  expandedHistId: any;
  filteredHistory: any;
  filteredQuizHistory: any;
  hasFilter: boolean;
  hasQuizFilter: boolean;
  histPage: any;
  histPageCount: number;
  histSubjects: any;
  histTopics: any;
  historyTab: any;
  pagedHistory: any;
  pagedQuizHistory: any;
  paperData: any;
  paperOpen: any;
  paperOpts: any;
  paperPreview: any;
  persistHistory: any;
  quizExpandedId: any;
  quizHistoryData: any;
  quizOverview: any;
  quizOverviewOpen: any;
  quizPage: any;
  quizPageCount: number;
  quizScope: any;
  quizStatsData: any;
  quizSubjFilter: any;
  quizSubjects: any;
  quizSummaryConfirm: any;
  quizSummaryError: any;
  quizSummaryLoading: any;
  quizSummaryScopeLabel: any;
  quizSummaryText: any;
  quizTopicFilter: any;
  quizTopicMenuOpen: any;
  quizTopics: any;
  subjFilter: any;
  topicFilter: any;
  topicMenuOpen: any;
}

export interface HistoryPanelActions {
  backToPaperOptions: () => void;
  clearHistoryAll: () => void;
  clearQuizHistoryAll: () => void;
  closePaperPreview: () => void;
  copyAnswer: (id: string, text: string) => Promise<void>;
  exportPaper: (preview: boolean) => void;
  gotoHistoryPath: (path: string) => void;
  renderSpeakControls: (text: string, topic?: string) => Element;
  retryWrongQuestion: () => void;
  runQuizSummary: () => Promise<void>;
  setExpandedHistId: any;
  setHistPage: any;
  setHistoryTab: any;
  setPaperOpen: any;
  setPaperOpts: any;
  setPaperPreview: any;
  setQuizExpandedId: any;
  setQuizOverviewOpen: any;
  setQuizPage: any;
  setQuizScope: any;
  setQuizSubjFilter: any;
  setQuizSummaryConfirm: any;
  setQuizTopicFilter: any;
  setQuizTopicMenuOpen: any;
  setSubjFilter: any;
  setTopicFilter: any;
  setTopicMenuOpen: any;
  setView: any;
}

interface HistoryPanelProps {
  lang: 'zh' | 'en';
  state: HistoryPanelState;
  actions: HistoryPanelActions;
  refs: { quizTopicMenuRef: any; topicMenuRef: any };
}

function HistoryPanelInner({ lang, state, actions, refs }: HistoryPanelProps) {
  const { aiCtx, config, confirmClearHist, confirmClearQuiz, copiedId, copyFailedId, expandedHistId, filteredHistory, filteredQuizHistory, hasFilter, hasQuizFilter, histPage, histPageCount, histSubjects, histTopics, historyTab, pagedHistory, pagedQuizHistory, paperData, paperOpen, paperOpts, paperPreview, persistHistory, quizExpandedId, quizHistoryData, quizOverview, quizOverviewOpen, quizPage, quizPageCount, quizScope, quizStatsData, quizSubjFilter, quizSubjects, quizSummaryConfirm, quizSummaryError, quizSummaryLoading, quizSummaryScopeLabel, quizSummaryText, quizTopicFilter, quizTopicMenuOpen, quizTopics, subjFilter, topicFilter, topicMenuOpen } = state;
  const { backToPaperOptions, clearHistoryAll, clearQuizHistoryAll, closePaperPreview, copyAnswer, exportPaper, gotoHistoryPath, renderSpeakControls, retryWrongQuestion, runQuizSummary, setExpandedHistId, setHistPage, setHistoryTab, setPaperOpen, setPaperOpts, setPaperPreview, setQuizExpandedId, setQuizOverviewOpen, setQuizPage, setQuizScope, setQuizSubjFilter, setQuizSummaryConfirm, setQuizTopicFilter, setQuizTopicMenuOpen, setSubjFilter, setTopicFilter, setTopicMenuOpen, setView } = actions;
  const { quizTopicMenuRef, topicMenuRef } = refs;
  return (
    <>
<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* 记录类型 tab */}
          <div className="shrink-0 flex items-center gap-1 px-3 pt-2.5 pb-1 border-b border-[var(--border)]/60">
            <button
              type="button"
              onClick={() => setHistoryTab('qa')}
              className={`px-2.5 py-1 text-[0.6875rem] mono-font transition-colors border-b-2 ${
                historyTab === 'qa' ? 'border-[var(--fg)] text-[var(--fg)] font-bold' : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {lang === 'zh' ? '问答历史' : 'Q&A'}
            </button>
            <button
              type="button"
              onClick={() => setHistoryTab('quiz')}
              className={`px-2.5 py-1 text-[0.6875rem] mono-font transition-colors border-b-2 ${
                historyTab === 'quiz' ? 'border-[var(--fg)] text-[var(--fg)] font-bold' : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {lang === 'zh' ? '错题集' : 'Mistakes'}
            </button>
          </div>
          {historyTab === 'qa' ? (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* 隐私提示（与免责条同视觉层级） */}
          <p className="shrink-0 px-4 pt-2.5 flex items-center gap-1.5 text-[0.625rem] text-[var(--muted)] leading-snug">
            <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
            {lang === 'zh' ? '仅保存在本机浏览器 · 可随时清除' : 'Stored only in your browser · clearable anytime'}
          </p>
          {/* 筛选：科目 chips + 知识点下拉（动态提取，空历史时隐藏） */}
          {persistHistory.length > 0 && (
            <div className="shrink-0 px-3 pt-2 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSubjFilter(null)}
                  className={`tap-area rounded-md px-2.5 py-1.5 text-[0.6875rem] mono-font border transition-colors ${
                    subjFilter === null ? 'border-[var(--fg)]/25 bg-[var(--accent-light)] text-[var(--fg)] font-medium' : 'border-transparent text-[var(--muted)] hover:bg-[var(--accent-light)]/60 hover:text-[var(--fg)]'
                  }`}
                >
                  {lang === 'zh' ? '全部' : 'All'}
                </button>
                {histSubjects.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSubjFilter(subjFilter === s ? null : s)}
                    className={`tap-area rounded-md px-2.5 py-1.5 text-[0.6875rem] mono-font border transition-colors ${
                      subjFilter === s ? 'border-[var(--fg)]/25 bg-[var(--accent-light)] text-[var(--fg)] font-medium' : 'border-transparent text-[var(--muted)] hover:bg-[var(--accent-light)]/60 hover:text-[var(--fg)]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
                {hasFilter && (
                  <button
                    type="button"
                    onClick={() => { setSubjFilter(null); setTopicFilter(null); }}
                    className="ml-auto rounded px-1 py-0.5 text-[0.625rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] active:bg-[var(--accent-light)] transition-colors"
                  >
                    {lang === 'zh' ? '清除筛选' : 'Clear filters'}
                  </button>
                )}
              </div>
              {histTopics.length > 0 && (
                <div ref={topicMenuRef} className="flex items-center gap-1.5">
                  <span className="text-[0.625rem] mono-font text-[var(--muted)] shrink-0">{lang === 'zh' ? '知识点' : 'Topic'}:</span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setTopicMenuOpen((v) => !v)}
                      className="w-40 max-w-full flex items-center justify-between gap-2 border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--fg)] outline-none hover:border-[var(--fg)] focus:border-[var(--fg)] transition-colors"
                    >
                      <span className="truncate text-left">{topicFilter ?? (lang === 'zh' ? '全部知识点' : 'All topics')}</span>
                      <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-[var(--muted)] transition-transform ${topicMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {topicMenuOpen && (
                      <div className="absolute left-0 top-full mt-1 z-20 w-40 max-h-44 overflow-y-auto border border-[var(--border)] bg-[var(--bg)] shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                        <button
                          type="button"
                          onClick={() => { setTopicFilter(null); setTopicMenuOpen(false); }}
                          className={`w-full text-left px-2.5 py-1.5 text-xs mono-font transition-colors ${
                            topicFilter === null
                              ? 'bg-[var(--accent-light)] text-[var(--fg)] font-bold border-l-2 border-l-[var(--accent)]'
                              : 'text-[var(--muted)] hover:bg-[var(--accent-light)] hover:text-[var(--fg)]'
                          }`}
                        >
                          <span className="block truncate">{lang === 'zh' ? '全部知识点' : 'All topics'}</span>
                        </button>
                        {histTopics.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => { setTopicFilter(t); setTopicMenuOpen(false); }}
                            className={`w-full text-left px-2.5 py-1.5 text-xs mono-font transition-colors ${
                              topicFilter === t
                                ? 'bg-[var(--accent-light)] text-[var(--fg)] font-bold border-l-2 border-l-[var(--accent)]'
                                : 'text-[var(--muted)] hover:bg-[var(--accent-light)] hover:text-[var(--fg)]'
                            }`}
                          >
                            <span className="block truncate">{t}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-2">
            {filteredHistory.length === 0 ? (
              <div className="pt-8 text-center space-y-2">
                <History className="w-6 h-6 mx-auto text-[var(--muted)]" aria-hidden="true" />
                <p className="text-xs text-[var(--muted)] italic">
                  {hasFilter
                    ? (lang === 'zh' ? '没有匹配的问答。试试清除筛选。' : 'No matching Q&A. Try clearing the filters.')
                    : (lang === 'zh' ? '暂无历史问答。提问后会自动保存在本机。' : 'No history yet. Questions you ask will be saved on this device.')}
                </p>
              </div>
            ) : (
              pagedHistory.map((h) => (
                <div key={h.id} className="border border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setExpandedHistId(expandedHistId === h.id ? null : h.id)}
                    className="w-full text-left px-2.5 py-2 flex items-start justify-between gap-2 hover:bg-[var(--accent-light)]/40 transition-colors"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs serif-font leading-snug line-clamp-2"><InlineAnswer text={h.question} /></span>
                      <span className="block mt-0.5 text-[0.625rem] mono-font text-[var(--muted)]">
                        {relativeTime(h.ts, lang)}
                        {h.subject ? ` · ${h.subject}` : ''}
                        {h.topic && h.topic !== h.subject && !h.topic.includes(h.subject) ? ` · ${h.topic.replace(/[（(].*?[）)]/g, '')}` : ''}
                        {h.model ? <span className="text-[var(--tech-blue)]"> · {h.model}</span> : ''}
                      </span>
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--muted)] transition-transform ${expandedHistId === h.id ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {expandedHistId === h.id && (
                    <div className="border-t border-[var(--border)] px-2.5 py-2 space-y-1.5">
                      <p className="text-[0.625rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '回答' : 'Answer'}:</p>
                      <div className="text-left">
                        <div className="inline-block max-w-[95%] min-w-0 break-words px-2.5 py-1.5 border border-[var(--border)] text-left text-xs leading-relaxed whitespace-pre-wrap ai-answer">
                          <AnswerRich text={h.answer} />
                          {renderSpeakControls(h.answer, h.topic)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button type="button" onClick={() => gotoHistoryPath(h.path)}
                          title={lang === 'zh' ? '回到来源页' : 'Back to source page'}
                          className="tap-area rounded-md inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] mono-font leading-none border border-transparent bg-[var(--accent-light)]/50 transition-colors hover:bg-[var(--accent-light)]">
                          <ArrowLeft className="w-3 h-3" aria-hidden="true" />
                          {lang === 'zh' ? '回到来源页' : 'Back to source'}
                        </button>
                        <button type="button" onClick={() => void copyAnswer(h.id, h.answer)}
                          title={lang === 'zh' ? '复制回答' : 'Copy answer'}
                          className={`tap-area rounded-md inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] mono-font leading-none border border-transparent transition-colors ${
                            copiedId === h.id
                              ? 'bg-[var(--accent-light)] text-[var(--fg)]'
                              : copyFailedId === h.id
                                ? 'bg-[var(--error)]/10 text-[var(--error)]'
                                : 'bg-[var(--accent-light)]/50 hover:bg-[var(--accent-light)]'
                          }`}>
                          {copiedId === h.id ? <Check className="w-3 h-3" aria-hidden="true" />
                            : copyFailedId === h.id ? <CircleX className="w-3 h-3" aria-hidden="true" />
                            : <Copy className="w-3 h-3" aria-hidden="true" />}
                          {copiedId === h.id ? (lang === 'zh' ? '已复制' : 'Copied')
                            : copyFailedId === h.id ? (lang === 'zh' ? '复制失败' : 'Copy failed')
                            : (lang === 'zh' ? '复制' : 'Copy')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          {/* 清空历史（只清历史，不动配置与当前会话；二次确认） */}
          <div className="shrink-0 px-4 py-2.5 border-t border-[var(--border)] flex items-center justify-between gap-2">
            <span className="text-[0.625rem] text-[var(--muted)] mono-font shrink-0">
              {lang === 'zh'
                ? (hasFilter ? `筛选出 ${filteredHistory.length} 条 / 共 ${persistHistory.length} 条` : `共 ${persistHistory.length} 条 · 自动保留最近 100 条`)
                : (hasFilter ? `${filteredHistory.length} of ${persistHistory.length} items` : `${persistHistory.length} items · keeps latest 100`)}
            </span>
            {/* 翻页：一页 8 条 */}
            {histPageCount > 1 && (
              <span className="flex items-center gap-1 mono-font text-[0.625rem] text-[var(--muted)]">
                <button
                  type="button"
                  onClick={() => setHistPage((p) => Math.max(1, p - 1))}
                  disabled={histPage <= 1}
                  aria-label={lang === 'zh' ? '上一页' : 'Previous page'}
                  className="px-1.5 py-0.5 border border-[var(--border)] text-[var(--fg)] hover:border-[var(--fg)] disabled:opacity-40 disabled:hover:border-[var(--border)] transition-colors"
                >‹</button>
                <span>{histPage} / {histPageCount}</span>
                <button
                  type="button"
                  onClick={() => setHistPage((p) => Math.min(histPageCount, p + 1))}
                  disabled={histPage >= histPageCount}
                  aria-label={lang === 'zh' ? '下一页' : 'Next page'}
                  className="px-1.5 py-0.5 border border-[var(--border)] text-[var(--fg)] hover:border-[var(--fg)] disabled:opacity-40 disabled:hover:border-[var(--border)] transition-colors"
                >›</button>
              </span>
            )}
            {persistHistory.length > 0 && (
              <button
                type="button"
                onClick={clearHistoryAll}
                className={`inline-flex items-center gap-1 text-[0.6875rem] mono-font transition-colors shrink-0 ${confirmClearHist ? 'text-[var(--error)] font-bold' : 'text-[var(--muted)] hover:text-[var(--error)]'}`}
              >
                <Trash2 className="w-3 h-3" />
                {confirmClearHist ? (lang === 'zh' ? '确认清空？' : 'Confirm clear?') : (lang === 'zh' ? '清空历史' : 'Clear history')}
              </button>
            )}
          </div>
          </div>
          ) : (
          /* ── 考考你记录：正确率统计 + 错题集（独立 localStorage） ── */
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* 统计概览 */}
            <div className="shrink-0 px-4 pt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.625rem] mono-font text-[var(--muted)]">
              <span>{lang === 'zh' ? `已答 ${quizStatsData.total} 题` : `${quizStatsData.total} answered`}</span>
              <span className={quizStatsData.correct > 0 ? 'text-[var(--fg)]' : ''}>{lang === 'zh' ? `答对 ${quizStatsData.correct}` : `${quizStatsData.correct} correct`}</span>
              {quizStatsData.wrong > 0 && <span className="text-[var(--error)]">{lang === 'zh' ? `答错 ${quizStatsData.wrong}` : `${quizStatsData.wrong} wrong`}</span>}
              {quizStatsData.total > 0 && <span>{lang === 'zh' ? `正确率 ${quizStatsData.rate}%` : `${quizStatsData.rate}% accuracy`}</span>}
              {/* 全部 / 仅错题切换 */}
              <span className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuizScope('wrong')}
                  className={`px-1.5 py-0.5 border transition-colors ${quizScope === 'wrong' ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-transparent text-[var(--muted)] hover:border-[var(--border)]'}`}
                >
                  {lang === 'zh' ? '仅错题' : 'Wrong'}
                </button>
                <button
                  type="button"
                  onClick={() => setQuizScope('all')}
                  className={`px-1.5 py-0.5 border transition-colors ${quizScope === 'all' ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-transparent text-[var(--muted)] hover:border-[var(--border)]'}`}
                >
                  {lang === 'zh' ? '全部' : 'All'}
                </button>
                {/* 导出错题卷：范围即当前筛选，忽略每页 8 条的浏览分页 */}
                <button
                  type="button"
                  onClick={() => setPaperOpen(true)}
                  disabled={filteredQuizHistory.length === 0}
                  title={lang === 'zh' ? '把当前筛选的错题排成 A4 复习卷，可直接打印或另存为 PDF' : 'Lay out the current mistakes as an A4 sheet you can print or save as PDF'}
                  className="tap-primary ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 border border-[var(--border)] text-[var(--muted)] transition-colors hover:border-[var(--fg)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Printer className="w-3 h-3" aria-hidden="true" />
                  {lang === 'zh' ? '导出错题卷' : 'Export paper'}
                </button>
              </span>
            </div>
            {/* 错题卷配置弹窗（方案 A：确认后生成快照并调起浏览器打印） */}
            {paperOpen &&
              createPortal(
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                  role="dialog"
                  aria-modal="true"
                  aria-label={lang === 'zh' ? '导出错题卷' : 'Export paper'}
                >
                  <div className="absolute inset-0 bg-black/45" onClick={() => setPaperOpen(false)} aria-hidden="true" />
                  <div className="relative z-10 flex flex-col w-full max-w-sm max-h-[85dvh] bg-[var(--bg)] border border-[var(--border)] shadow-[0_8px_24px_rgba(0,0,0,0.15)]">
                    <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                      <h2 className="text-xs font-bold mono-font tracking-widest">
                        {lang === 'zh' ? '导出错题卷' : 'EXPORT PAPER'}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setPaperOpen(false)}
                        aria-label={lang === 'zh' ? '关闭' : 'Close'}
                        title={lang === 'zh' ? '关闭' : 'Close'}
                        className="tap-area p-1.5 text-[var(--muted)] hover:text-[var(--fg)] text-lg leading-none"
                      >
                        ×
                      </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
                      <p className="text-[0.625rem] mono-font text-[var(--muted)] leading-snug">
                        {lang === 'zh'
                          ? `将导出当前筛选的全部 ${filteredQuizHistory.length} 题（忽略每页 8 条的浏览分页）`
                          : `Exports all ${filteredQuizHistory.length} records in the current filter (the 8-per-page view is ignored)`}
                      </p>
                      <label className="flex items-start gap-2 cursor-pointer text-xs serif-font">
                        <input
                          type="checkbox"
                          checked={paperOpts.includeAnswers}
                          onChange={(e) => setPaperOpts((o) => ({ ...o, includeAnswers: e.target.checked }))}
                          className="mt-0.5"
                        />
                        <span>{lang === 'zh' ? '含答案与解析（文末独立起页）' : 'Include answers and explanations (own page at the end)'}</span>
                      </label>
                      <div>
                        <p className="text-[0.6875rem] mono-font text-[var(--muted)] mb-1">{lang === 'zh' ? '演算留白' : 'Working space'}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {([
                            ['compact', '紧凑', 'Compact'],
                            ['standard', '标准 20mm', 'Standard 20mm'],
                            ['roomy', '宽松 35mm', 'Roomy 35mm'],
                          ] as [PaperBlankLevel, string, string][]).map(([id, zhLabel, enLabel]) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setPaperOpts((o) => ({ ...o, blankLevel: id }))}
                              className={`tap-area rounded-md px-2 py-0.5 text-[0.625rem] mono-font border transition-colors ${paperOpts.blankLevel === id ? 'border-[var(--fg)]/25 bg-[var(--accent-light)] text-[var(--fg)] font-medium' : 'border-transparent text-[var(--muted)] hover:bg-[var(--accent-light)]/60 hover:text-[var(--fg)]'}`}
                            >
                              {lang === 'zh' ? zhLabel : enLabel}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[0.6875rem] mono-font text-[var(--muted)] mb-1">{lang === 'zh' ? '排序方式' : 'Order'}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {([
                            ['topic', '按知识点分组', 'By topic'],
                            ['time', '按时间倒序', 'Newest first'],
                          ] as [PaperSortMode, string, string][]).map(([id, zhLabel, enLabel]) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setPaperOpts((o) => ({ ...o, sortMode: id }))}
                              className={`tap-area rounded-md px-2 py-0.5 text-[0.625rem] mono-font border transition-colors ${paperOpts.sortMode === id ? 'border-[var(--fg)]/25 bg-[var(--accent-light)] text-[var(--fg)] font-medium' : 'border-transparent text-[var(--muted)] hover:bg-[var(--accent-light)]/60 hover:text-[var(--fg)]'}`}
                            >
                              {lang === 'zh' ? zhLabel : enLabel}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-[var(--border)]">
                      <button
                        type="button"
                        onClick={() => setPaperOpen(false)}
                        className="tap-primary tap-ai-primary rounded-md px-3 py-1.5 text-xs mono-font border border-transparent text-[var(--muted)] transition-colors hover:bg-[var(--accent-light)] hover:text-[var(--fg)]"
                      >
                        {lang === 'zh' ? '取消' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={() => exportPaper(false)}
                        disabled={filteredQuizHistory.length === 0}
                        className="tap-primary ml-auto inline-flex items-center gap-1 px-3 py-1.5 text-xs mono-font border border-[var(--border)] text-[var(--muted)] transition-colors hover:border-[var(--fg)] hover:text-[var(--fg)] disabled:opacity-50"
                      >
                        <Printer className="w-3 h-3" aria-hidden="true" />
                        {lang === 'zh' ? '直接打印' : 'Print now'}
                      </button>
                      <button
                        type="button"
                        onClick={() => exportPaper(true)}
                        disabled={filteredQuizHistory.length === 0}
                        className="tap-primary inline-flex items-center gap-1 px-3 py-1.5 text-xs mono-font font-bold border border-[var(--fg)] text-[var(--fg)] transition-colors hover:bg-[var(--fg)] hover:text-[var(--bg)] disabled:opacity-50"
                      >
                        <Eye className="w-3 h-3" aria-hidden="true" />
                        {lang === 'zh' ? '预览' : 'Preview'}
                      </button>
                    </div>
                  </div>
                </div>,
                document.body,
              )}
            {/* 打印/预览卷面：仅在有快照时挂载（屏幕端由 CSS 控制显隐，打印时独占页面） */}
            {paperData && (
              <QuizPaperPrint
                paper={paperData.paper}
                lang={lang}
                generatedAt={paperData.generatedAt}
                preview={paperPreview}
              />
            )}
            {/* 预览工具栏：屏幕端浮在底部；打印时作为 body 子元素被打印样式整体隐藏 */}
            {paperData &&
              paperPreview &&
              createPortal(
                <div className="exam-preview-bar" role="toolbar" aria-label={lang === 'zh' ? '打印预览' : 'Print preview'}>
                  <span className="text-[0.6875rem] mono-font text-[var(--muted)]">
                    {lang === 'zh'
                      ? `预览 · 共 ${paperData.paper.total} 题${paperData.paper.includeAnswers ? ' · 含答案页' : ''}`
                      : `Preview · ${paperData.paper.total} questions${paperData.paper.includeAnswers ? ' · with answers' : ''}`}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={backToPaperOptions}
                      className="px-2.5 py-1 text-[0.6875rem] mono-font border border-[var(--border)] text-[var(--muted)] transition-colors hover:border-[var(--fg)] hover:text-[var(--fg)]"
                    >
                      {lang === 'zh' ? '返回修改' : 'Back'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaperPreview(false)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[0.6875rem] mono-font font-bold border border-[var(--fg)] text-[var(--fg)] transition-colors hover:bg-[var(--fg)] hover:text-[var(--bg)]"
                    >
                      <Printer className="w-3 h-3" aria-hidden="true" />
                      {lang === 'zh' ? '打印 / 另存为 PDF' : 'Print / Save as PDF'}
                    </button>
                    <button
                      type="button"
                      onClick={closePaperPreview}
                      aria-label={lang === 'zh' ? '关闭预览' : 'Close preview'}
                      title={lang === 'zh' ? '关闭预览（Esc）' : 'Close preview (Esc)'}
                      className="px-2 py-1 text-[0.6875rem] mono-font text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                    >
                      ×
                    </button>
                  </span>
                </div>,
                document.body,
              )}
            {/* 学情概览 + AI 归纳（默认折叠；仅在有记录时显示） */}
            {filteredQuizHistory.length > 0 && (
              <div className="shrink-0 px-3 pt-2">
                <div className="border border-[var(--border)] px-2.5 py-2 space-y-1.5">
                  {/* 折叠头部：标题 + 摘要 + AI 按钮（始终可见） */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setQuizOverviewOpen((v) => !v)}
                      className="inline-flex items-center gap-1 text-[0.625rem] mono-font font-bold text-[var(--fg)] hover:opacity-80 transition-opacity"
                    >
                      <span>{lang === 'zh' ? '学情概览' : 'Overview'}</span>
                      <ChevronDown className={`w-3 h-3 text-[var(--muted)] transition-transform ${quizOverviewOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                    {/* 折叠态摘要行 */}
                    {!quizOverviewOpen && quizOverview.weakTopics.length > 0 && (
                      <span className="text-[0.625rem] mono-font text-[var(--muted)] truncate">
                        {lang === 'zh' ? '薄弱点' : 'Weak'}: {quizOverview.weakTopics.map((t) => t.topic).join('、')}
                        {quizOverview.trend && ` | ${lang === 'zh' ? '趋势' : 'Trend'}: ${quizOverview.trend.recentRate}%`}
                      </span>
                    )}
                    {/* AI 按钮（始终可见） */}
                    <span className="ml-auto">
                      {!quizSummaryText && !quizSummaryLoading && !quizSummaryConfirm && (
                        <button
                          type="button"
                          onClick={() => setQuizSummaryConfirm(true)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] mono-font border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors disabled:opacity-50"
                          disabled={!config}
                        >
                          <Sparkles className="w-3 h-3" aria-hidden="true" />
                          {lang === 'zh' ? '让 AI 总结' : 'AI Summary'}
                        </button>
                      )}
                      {quizSummaryText && (
                        <button
                          type="button"
                          onClick={() => setQuizSummaryConfirm(true)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
                        >
                          <Sparkles className="w-3 h-3" aria-hidden="true" />
                          {lang === 'zh' ? '重新生成' : 'Regenerate'}
                        </button>
                      )}
                    </span>
                  </div>
                  {/* 展开内容：完整概览数据 */}
                  {quizOverviewOpen && (
                    <div className="text-[0.625rem] mono-font text-[var(--muted)] space-y-1 pt-1">
                      {quizOverview.subjects.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {quizOverview.subjects.map((s) => (
                            <span key={s.subject} className="flex items-center gap-1">
                              <span>{lang === 'zh' ? '科目正确率' : 'By subject'}（{s.subject}）</span>
                              <span className={s.rate >= 60 ? 'text-[var(--success)]' : 'text-[var(--error)]'}>{s.rate}%</span>
                              <span className="text-[var(--muted)] opacity-70">({s.correct}/{s.total})</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {quizOverview.weakTopics.length > 0 && (
                        <div>
                          <span className="text-[var(--fg)]">{lang === 'zh' ? '薄弱点' : 'Weak spots'}:</span>{' '}
                          {quizOverview.weakTopics.map((t, i) => (
                            <span key={t.topic} className="mr-1.5">
                              {i > 0 ? '、' : ''}
                              <span className="text-[var(--error)]">{t.topic}</span>
                              <span className="opacity-70">({lang === 'zh' ? '错' : '×'}{t.wrong})</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {quizOverview.errorKinds.timeout + quizOverview.errorKinds.confuse + quizOverview.errorKinds.slow + quizOverview.errorKinds.fast > 0 && (
                        <div>
                          <span className="text-[var(--fg)]">{lang === 'zh' ? '类型' : 'Patterns'}:</span>{' '}
                          {quizOverview.errorKinds.timeout > 0 && <span className="mr-1.5">{lang === 'zh' ? `超时未答 ${quizOverview.errorKinds.timeout}` : `Timed out ${quizOverview.errorKinds.timeout}`}</span>}
                          {quizOverview.errorKinds.confuse > 0 && <span className="mr-1.5">{lang === 'zh' ? `易混反复错 ${quizOverview.errorKinds.confuse}` : `Repeated same wrong ${quizOverview.errorKinds.confuse}`}</span>}
                          {quizOverview.errorKinds.slow > 0 && <span className="mr-1.5">{lang === 'zh' ? `犹豫答错 ${quizOverview.errorKinds.slow}` : `Slow & wrong ${quizOverview.errorKinds.slow}`}</span>}
                          {quizOverview.errorKinds.fast > 0 && <span className="mr-1.5">{lang === 'zh' ? `过快答错 ${quizOverview.errorKinds.fast}` : `Too quick ${quizOverview.errorKinds.fast}`}</span>}
                        </div>
                      )}
                      {quizOverview.trend && (
                        <div>
                          <span className="text-[var(--fg)]">{lang === 'zh' ? '趋势' : 'Trend'}:</span>{' '}
                          <span>
                            {lang === 'zh'
                              ? `最近 ${quizOverview.trend.recentCount} 题正确率 ${quizOverview.trend.recentRate}%（整体 ${quizOverview.trend.overallRate}%）${quizOverview.trend.recentRate >= quizOverview.trend.overallRate ? '，比整体上扬' : '，比整体回落'}`
                              : `Last ${quizOverview.trend.recentCount}: ${quizOverview.trend.recentRate}% overall ${quizOverview.trend.overallRate}%${quizOverview.trend.recentRate >= quizOverview.trend.overallRate ? ', better than overall' : ', below overall'}`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* AI 确认 / 加载 / 输出 / 错误（始终按状态渲染，不随概览折叠） */}
                  <div className={`${quizOverviewOpen ? 'pt-1.5 border-t border-[var(--border)]/60' : ''}`}>
                    {quizSummaryConfirm && (
                      <div className="pt-1.5 space-y-1.5">
                        <p className="text-[0.625rem] mono-font text-[var(--muted)] leading-snug">
                          <ShieldCheck className="w-3 h-3 inline-block mr-1 align-[-2px]" aria-hidden="true" />
                          {lang === 'zh'
                            ? `将把「${quizSummaryScopeLabel}」范围内的作答记录发给 AI 生成诊断。数据仅存你本机，AI 诊断仅供参考、可能有误，请以教材和老师讲解为准。确定？`
                            : `This will send the ${quizSummaryScopeLabel} records to the AI for a diagnosis. Your data stays on this device. AI output is for reference only and may be inaccurate — defer to your textbook and teacher. Proceed?`}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void runQuizSummary()}
                            disabled={quizSummaryLoading}
                            className="px-2 py-1 text-[0.625rem] mono-font border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors disabled:opacity-50"
                          >
                            {lang === 'zh' ? '生成' : 'Generate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuizSummaryConfirm(false)}
                            className="tap-area rounded-md px-2.5 py-1 text-[0.625rem] mono-font border border-transparent text-[var(--muted)] transition-colors hover:bg-[var(--accent-light)] hover:text-[var(--fg)]"
                          >
                            {lang === 'zh' ? '取消' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    )}
                    {quizSummaryLoading && (
                      <p className="pt-1.5 text-[0.625rem] mono-font text-[var(--muted)]">
                        <Sparkles className="w-3 h-3 inline-block mr-1 align-[-2px] animate-pulse" aria-hidden="true" />
                        {lang === 'zh' ? '正在总结…' : 'Summarizing…'}
                      </p>
                    )}
                    {quizSummaryText && (
                      <div className="pt-1.5">
                        <div className="text-left">
                          <div className="inline-block w-full px-2.5 py-1.5 border border-[var(--border)] text-left text-xs leading-relaxed ai-answer">
                            <AnswerRich text={quizSummaryText} />
                            {renderSpeakControls(quizSummaryText, aiCtx.topic)}
                          </div>
                        </div>
                      </div>
                    )}
                    {quizSummaryError && (
                      <p className="pt-1.5 text-[0.625rem] mono-font text-[var(--error)] leading-snug">
                        {lang === 'zh' ? '生成失败：' : 'Failed: '}{quizSummaryError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* 筛选：科目 chips + 知识点下拉（动态提取，与问答历史一致）*/}
            {(quizSubjects.length > 0 || hasQuizFilter) && (
              <div className="shrink-0 px-3 pt-2 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {quizSubjects.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setQuizSubjFilter(null)}
                        className={`tap-area rounded-md px-2.5 py-1.5 text-[0.6875rem] mono-font border transition-colors ${quizSubjFilter === null ? 'border-[var(--fg)]/25 bg-[var(--accent-light)] text-[var(--fg)] font-medium' : 'border-transparent text-[var(--muted)] hover:bg-[var(--accent-light)]/60 hover:text-[var(--fg)]'}`}
                      >
                        {lang === 'zh' ? '全部' : 'All'}
                      </button>
                      {quizSubjects.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setQuizSubjFilter(quizSubjFilter === s ? null : s)}
                          className={`tap-area rounded-md px-2.5 py-1.5 text-[0.6875rem] mono-font border transition-colors ${quizSubjFilter === s ? 'border-[var(--fg)]/25 bg-[var(--accent-light)] text-[var(--fg)] font-medium' : 'border-transparent text-[var(--muted)] hover:bg-[var(--accent-light)]/60 hover:text-[var(--fg)]'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </>
                  )}
                  {hasQuizFilter && (
                    <button
                      type="button"
                      onClick={() => { setQuizSubjFilter(null); setQuizTopicFilter(null); }}
                      className="ml-auto rounded px-1 py-0.5 text-[0.625rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] active:bg-[var(--accent-light)] transition-colors"
                    >
                      {lang === 'zh' ? '清除筛选' : 'Clear filters'}
                    </button>
                  )}
                </div>
                {quizTopics.length > 0 && (
                  <div ref={quizTopicMenuRef} className="flex items-center gap-1.5">
                    <span className="text-[0.625rem] mono-font text-[var(--muted)] shrink-0">{lang === 'zh' ? '知识点' : 'Topic'}:</span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setQuizTopicMenuOpen((v) => !v)}
                        className="w-40 max-w-full flex items-center justify-between gap-2 border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--fg)] outline-none hover:border-[var(--fg)] focus:border-[var(--fg)] transition-colors"
                      >
                        <span className="truncate text-left">{quizTopicFilter ?? (lang === 'zh' ? '全部知识点' : 'All topics')}</span>
                        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-[var(--muted)] transition-transform ${quizTopicMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {quizTopicMenuOpen && (
                        <div className="absolute left-0 top-full mt-1 z-20 w-40 max-h-44 overflow-y-auto border border-[var(--border)] bg-[var(--bg)] shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                          <button
                            type="button"
                            onClick={() => { setQuizTopicFilter(null); setQuizTopicMenuOpen(false); }}
                            className={`w-full text-left px-2.5 py-1.5 text-xs mono-font transition-colors ${
                              quizTopicFilter === null
                                ? 'bg-[var(--accent-light)] text-[var(--fg)] font-bold border-l-2 border-l-[var(--accent)]'
                                : 'text-[var(--muted)] hover:bg-[var(--accent-light)] hover:text-[var(--fg)]'
                            }`}
                          >
                            <span className="block truncate">{lang === 'zh' ? '全部知识点' : 'All topics'}</span>
                          </button>
                          {quizTopics.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => { setQuizTopicFilter(t); setQuizTopicMenuOpen(false); }}
                              className={`w-full text-left px-2.5 py-1.5 text-xs mono-font transition-colors ${
                                quizTopicFilter === t
                                  ? 'bg-[var(--accent-light)] text-[var(--fg)] font-bold border-l-2 border-l-[var(--accent)]'
                                  : 'text-[var(--muted)] hover:bg-[var(--accent-light)] hover:text-[var(--fg)]'
                              }`}
                            >
                              <span className="block truncate">{t}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* 记录列表 */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-2">
              {filteredQuizHistory.length === 0 ? (
                <div className="pt-8 text-center space-y-2">
                  <GraduationCap className="w-6 h-6 mx-auto text-[var(--muted)]" aria-hidden="true" />
                  <p className="text-xs text-[var(--muted)] italic">
                    {hasQuizFilter
                      ? (lang === 'zh' ? '没有匹配的记录。试试调整或清除筛选。' : 'No matching records. Try adjusting or clearing the filters.')
                      : (lang === 'zh' ? '暂无考考你记录。在实验、工具页做几道题就会自动保存在这里。' : 'No quiz records yet. Answer a few questions on lab or tool pages and they will be saved here.')}
                  </p>
                </div>
              ) : (
                pagedQuizHistory.map((e) => {
                  const expanded = quizExpandedId === e.id;
                  return (
                    <div key={e.id} className="border border-[var(--border)]">
                      <button
                        type="button"
                        onClick={() => setQuizExpandedId(expanded ? null : e.id)}
                        className="w-full text-left px-2.5 py-2 flex items-start justify-between gap-2 hover:bg-[var(--accent-light)]/40 transition-colors"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-0.5 text-[0.6875rem] mono-font font-bold ${e.correct ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                              <Mark ok={e.correct} />
                            </span>
                            <span className="block text-xs serif-font leading-snug line-clamp-2"><InlineAnswer text={e.question} /></span>
                          </span>
                          <span className="block mt-0.5 text-[0.625rem] mono-font text-[var(--muted)]">
                            {relativeTime(e.ts, lang)}
                            {e.subject ? ` · ${e.subject}` : ''}
                            {e.topic && e.topic !== e.subject && !e.topic.includes(e.subject) ? ` · ${e.topic.replace(/[（(].*?[）)]/g, '')}` : ''}
                            {e.model ? <span className="text-[var(--tech-blue)]"> · {e.model}</span> : ''}
                          </span>
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--muted)] transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>
                      {expanded && (
                        <div className="border-t border-[var(--border)] px-2.5 py-2 space-y-1.5">
                          {/* 选择题：选项 + 正确答案高亮，我的错误选择标红 */}
                          {(e.type !== 'fill') ? (
                            <div className="flex flex-col gap-1">
                              {e.options.map((opt, idx) => {
                                const isAnswer = idx === e.answerIdx;
                                const isPicked = idx === e.pickedIdx;
                                let cls = 'text-[var(--muted)]';
                                if (isAnswer) cls = 'text-[var(--success)] font-bold';
                                else if (isPicked && !e.correct) cls = 'text-[var(--error)]';
                                return (
                                  <p key={idx} className={`text-xs serif-font leading-relaxed ${cls}`}>
                                    <span className="mono-font text-[var(--muted)] mr-1.5">{String.fromCharCode(65 + idx)}.</span>
                                    <InlineAnswer text={opt} />
                                    {isAnswer && <span className="ml-1 inline-flex items-center gap-0.5 text-[0.625rem] mono-font text-[var(--success)]"><Mark ok />{lang === 'zh' ? '正确答案' : 'Answer'}</span>}
                                    {isPicked && !e.correct && <span className="ml-1 text-[0.625rem] mono-font text-[var(--error)]">{lang === 'zh' ? '← 你的选择' : '← Your pick'}</span>}
                                  </p>
                                );
                              })}
                            </div>
                          ) : (
                            /* 填空题：显示你的答案 vs 正确答案 */
                            <div className="space-y-1">
                              {e.fillAnswers && e.fillAnswers.length > 0 && (
                                <p className="text-xs serif-font leading-relaxed text-[var(--success)] font-bold">
                                  {lang === 'zh' ? '正确答案：' : 'Correct answer: '}
                                  {e.fillAnswers.join(lang === 'zh' ? ' 或 ' : ' or ')}
                                </p>
                              )}
                              {e.userAnswer && !e.correct && (
                                <p className="text-xs serif-font leading-relaxed text-[var(--error)]">
                                  {lang === 'zh' ? '你的答案：' : 'Your answer: '}<InlineAnswer text={e.userAnswer} />
                                </p>
                              )}
                            </div>
                          )}
                          {/* AI 解析讲解（旧数据无该字段则不显示） */}
                          {e.explanation && (
                            <div className="pt-1">
                              <p className="text-[0.625rem] mono-font font-bold text-[var(--fg)]">{lang === 'zh' ? '解析' : 'Explanation'}:</p>
                              <div className="text-xs serif-font leading-relaxed text-[var(--muted)]">
                                <AnswerRich text={e.explanation} />
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={retryWrongQuestion}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] mono-font border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors"
                            >
                              <GraduationCap className="w-3 h-3" aria-hidden="true" />
                              {lang === 'zh' ? '再来一题' : 'Try again'}
                            </button>
                            {!e.correct && (
                              <button
                                type="button"
                                onClick={() => void copyAnswer(e.id, e.question)}
                                title={lang === 'zh' ? '复制题目' : 'Copy question'}
                                className={`inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] mono-font border transition-colors ${
                                  copiedId === e.id ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] hover:border-[var(--fg)]'
                                }`}
                              >
                                {copiedId === e.id ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                                {copiedId === e.id ? (lang === 'zh' ? '已复制' : 'Copied') : (lang === 'zh' ? '复制题目' : 'Copy')}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {/* 清空记录（二次确认） */}
            <div className="shrink-0 px-4 py-2.5 border-t border-[var(--border)] flex items-center justify-between gap-2">
              <span className="text-[0.625rem] text-[var(--muted)] mono-font shrink-0">
                {lang === 'zh' ? `共 ${quizStatsData.total} 条 · 自动保留最近 100 条` : `${quizStatsData.total} items · keeps latest 100`}
              </span>
              {/* 翻页：一页 8 条 */}
              {quizPageCount > 1 && (
                <span className="flex items-center gap-1 mono-font text-[0.625rem] text-[var(--muted)]">
                  <button
                    type="button"
                    onClick={() => setQuizPage((p) => Math.max(1, p - 1))}
                    disabled={quizPage <= 1}
                    aria-label={lang === 'zh' ? '上一页' : 'Previous page'}
                    className="px-1.5 py-0.5 border border-[var(--border)] text-[var(--fg)] hover:border-[var(--fg)] disabled:opacity-40 disabled:hover:border-[var(--border)] transition-colors"
                  >‹</button>
                  <span>{quizPage} / {quizPageCount}</span>
                  <button
                    type="button"
                    onClick={() => setQuizPage((p) => Math.min(quizPageCount, p + 1))}
                    disabled={quizPage >= quizPageCount}
                    aria-label={lang === 'zh' ? '下一页' : 'Next page'}
                    className="px-1.5 py-0.5 border border-[var(--border)] text-[var(--fg)] hover:border-[var(--fg)] disabled:opacity-40 disabled:hover:border-[var(--border)] transition-colors"
                  >›</button>
                </span>
              )}
              {quizHistoryData.length > 0 && (
                <button
                  type="button"
                  onClick={clearQuizHistoryAll}
                  className={`inline-flex items-center gap-1 text-[0.6875rem] mono-font transition-colors ${confirmClearQuiz ? 'text-[var(--error)] font-bold' : 'text-[var(--muted)] hover:text-[var(--error)]'}`}
                >
                  <Trash2 className="w-3 h-3" />
                  {confirmClearQuiz ? (lang === 'zh' ? '确认清空？' : 'Confirm clear?') : (lang === 'zh' ? '清空记录' : 'Clear records')}
                </button>
              )}
            </div>
          </div>
          )}
          {/* 返回对话：子视图无左上角箭头后，返回由本栏左侧承担（与设置页同一形态） */}
          <div className="shrink-0 px-4 py-2.5 border-t border-[var(--border)] flex items-center">
            <button type="button" onClick={() => setView('chat')} className="tap-primary tap-ai-primary rounded-md px-3 py-1.5 text-xs mono-font border border-transparent text-[var(--muted)] transition-colors hover:bg-[var(--accent-light)] hover:text-[var(--fg)]">
              {lang === 'zh' ? '返回对话' : 'Back to chat'}
            </button>
          </div>
        </div>
    </>
  );
}

export default memo(HistoryPanelInner);
