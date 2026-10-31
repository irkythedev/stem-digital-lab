/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * useQuizSession —— AI 面板的刷题域（组卷 / 答题判分 / 解析 / 错题统计）。
 *
 * P1 阶段一产物：状态与处理器**逐字**从 AiAssistant.tsx 搬移（未改一个字符），
 * 只把「外部依赖」显式化为 deps 参数、「对外接口」显式化为返回值。
 * 不持有 view 状态机、不做跨域编排（clearAll 仍在主组件，遵守单一状态机）。
 * 出题记录写回历史域由主组件注入（setQuizHistoryData），本 Hook 只管一轮会话的生命周期。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStable } from '../panels/panel-shared';
import {
  CHAIN_MAX_TOKENS, QUIZ_SENTINEL, buildFillJudgePrompt, buildQuizPrompt, classifyChatFailure,
  classifyStreamOutcome, estimateTokens, logPromptIssue, streamChat, streamChatWithRecovery, stripThinkingFromHistory,
  type AiConfig, type QuizAngle, type QuizQType,
} from '../../../lib/ai-config';
import { formatLabState, getLabState, labIdFromPath } from '../../../lib/ai-dynamic-questions';
import { dedupeQuizQuestions, judgeFillAnswer, parseJudgeVerdict, parseQuizBatchChecked, shuffleOptions, type QuizQuestion } from '../../../lib/ai-quiz';
import { listQuizHistory, saveQuizHistory, type QuizHistoryEntry } from '../../../lib/quiz-history';
import { addTokenUsage } from '../../../lib/token-usage';
import { pageSubject } from '../page-subject';
import type { Language, Translation } from '../../../lib/i18n';

type AiView = 'terms' | 'settings' | 'chat' | 'history' | 'quiz';

/** 主组件注入的外部依赖 */
export interface QuizSessionDeps {
  config: AiConfig | null;
  /** 对话是否在流式中：出题按钮的禁用条件与对话共用一个 busy */
  busy: boolean;
  lang: Language;
  t: Translation;
  isOffline: boolean;
  /** 路由位置：出题与记录都用它取当前页面锚点 */
  location: { pathname: string; search: string };
  /** 当前页面知识锚点（与「问 AI」共用同一份实时状态） */
  aiCtx: { topic?: string; knowledge?: string; live?: string };
  /** 页面「考考你」入口的自增信号 */
  quizSignal: number;
  /** 会话级用量：与对话视图共用（出题也计入） */
  usage: { tokens: number; speed: number } | null;
  setUsage: (u: { tokens: number; speed: number } | null) => void;
  /** 跨会话累计 token 用量（出题后刷新设置页展示） */
  refreshTokenUsage: () => void;
  flashToast: (ok: boolean, msg: string) => void;
  /** 作答记录写回历史域（错题集） */
  setQuizHistoryData: (rows: QuizHistoryEntry[]) => void;
  setView: (v: AiView) => void;
}

export default function useQuizSession(deps: QuizSessionDeps) {
  const { config, busy, lang, t, isOffline, location, aiCtx, quizSignal, usage, setUsage, refreshTokenUsage, flashToast, setQuizHistoryData, setView } = deps;
  // ── 出题练习（Quiz）：批量出题（一次 N 题），本地判分，练习统计内存态 ──
  /** 出题设置（null = 尚未设置，显示设置面板） */
  const [quizSetup, setQuizSetup] = useState<{ count: number; angle: QuizAngle; timeLimit: number; qtype: QuizQType } | null>(null);
  /** 设置面板本地状态 */
  const [setupCount, setSetupCount] = useState(5);
  const [setupAngle, setSetupAngle] = useState<QuizAngle>('basic');
  const [setupTimeLimit, setSetupTimeLimit] = useState(0);
  const [setupQType, setSetupQType] = useState<QuizQType>('choice');
  /** AI 辅助判分开关（填空规则判错时兜底；localStorage 持久化，默认关） */
  const FILL_AI_JUDGE_KEY = 'stem-ai-fill-judge';
  const [fillAiJudge, setFillAiJudge] = useState<boolean>(() => {
    try { return window.localStorage.getItem(FILL_AI_JUDGE_KEY) === '1'; } catch { return false; }
  });
  const toggleFillAiJudge = (v: boolean) => {
    setFillAiJudge(v);
    try { window.localStorage.setItem(FILL_AI_JUDGE_KEY, v ? '1' : '0'); } catch { /* 静默 */ }
  };
  const [fillJudging, setFillJudging] = useState(false); // AI 判分中（按钮禁用）
  /** 本批题目（一次生成，逐题作答） */
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  /** 当前题下标 */
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizSelected, setQuizSelected] = useState<number | null>(null); // 学生选的选项下标
  const [quizFillInput, setQuizFillInput] = useState(''); // 填空输入
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizStats, setQuizStats] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });
  const [quizDone, setQuizDone] = useState(false); // 本轮结束（显示小结）
  const quizAbortRef = useRef<AbortController | null>(null);
  const quizOpenedRef = useRef(false); // 标记面板由 openQuiz 打开，open effect 不覆盖 view
  // 计时：每题限时倒计时（秒）
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const clearTimer = () => {
    if (timerRef.current !== null) { window.clearInterval(timerRef.current); timerRef.current = null; }
    setTimeLeft(null);
  };
  // 当前题 = 批量数组中的当前项
  const quizQ: QuizQuestion | null = quizQuestions[quizIdx] ?? null;

  // 页面级入口 openQuiz：自增信号 → 打开面板并进入 quiz 视图（显示设置面板）
  useEffect(() => {
    if (quizSignal > 0) {
      quizOpenedRef.current = true;
      resetQuiz();
      setView('quiz');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizSignal]);

  // 当前题变化时重置选择与计时
  useEffect(() => {
    setQuizSelected(null);
    setQuizFillInput('');
    clearTimer();
    if (quizQ && quizSetup && quizSetup.timeLimit > 0) {
      setTimeLeft(quizSetup.timeLimit);
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null || prev <= 1) {
            // 超时：判错
            if (prev !== null && prev <= 1 && quizSelected === null) {
              handleTimeout();
            }
            clearTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizIdx, quizQuestions]);

  const resetQuiz = () => {
    quizAbortRef.current?.abort();
    setQuizSetup(null);
    setQuizQuestions([]);
    setQuizIdx(0);
    setQuizLoading(false);
    setQuizSelected(null);
    setQuizFillInput('');
    setQuizError(null);
    setQuizStats({ correct: 0, total: 0 });
    setQuizDone(false);
    clearTimer();
  };

  // 开始新一轮（用新的设置生成一批题）
  const startQuiz = (count: number, angle: QuizAngle, timeLimit: number, qtype: QuizQType = 'choice') => {
    setQuizSetup({ count, angle, timeLimit, qtype });
    setQuizStats({ correct: 0, total: 0 });
    setQuizDone(false);
    setQuizQuestions([]);
    setQuizIdx(0);
    void loadQuizBatch(count, angle, timeLimit, qtype);
  };

  // 批量出题（一次生成 N 题，流式，复用 streamChat；结果走批量宽容解析）
  const loadQuizBatch = async (overrideCount?: number, overrideAngle?: QuizAngle, overrideTimeLimit?: number, overrideQType?: QuizQType) => {
    if (!config) return;
    const count = overrideCount ?? quizSetup?.count ?? 5;
    const angle = overrideAngle ?? quizSetup?.angle ?? 'basic';
    const timeLimit = overrideTimeLimit ?? quizSetup?.timeLimit ?? 0;
    const qtype = overrideQType ?? quizSetup?.qtype ?? 'choice';
    setQuizLoading(true);
    setQuizError(null);
    quizAbortRef.current = new AbortController();
    const messages: { role: 'system' | 'user'; content: string }[] = [
      { role: 'system', content: buildQuizPrompt(
        lang,
        aiCtx.topic ?? pageSubject(location.pathname, lang),
        // 「考考你」与「问 AI」读同一份实时状态：出题也能落到学生此刻的读数上
        [
          aiCtx.knowledge,
          aiCtx.live,
          formatLabState(labIdFromPath(location.pathname), getLabState(labIdFromPath(location.pathname)), lang),
        ].filter(Boolean).join('\n'),
        count, angle, timeLimit, qtype,
      ) },
      { role: 'user', content: lang === 'zh' ? `请围绕当前页面知识点（${aiCtx.topic ?? pageSubject(location.pathname, lang) ?? '当前主题'}）按格式出 ${count} 道题。` : `Please create ${count} questions in the specified format, based on the current page knowledge (${aiCtx.topic ?? pageSubject(location.pathname, lang) ?? 'current topic'}).` },
    ];
    try {
      const t0 = performance.now();
      // 用量实时统计：与对话视图共用同一 usage state（会话级累计）
      const baseTokens = usage?.tokens ?? 0;
      const promptTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
      let received = 0;
      const { result: res, recovered } = await streamChatWithRecovery(
        config,
        messages,
        (delta) => {
          received += delta.length;
          const elapsedSec = Math.max(0.1, (performance.now() - t0) / 1000);
          const outTokens = estimateTokens(received);
          setUsage({
            tokens: baseTokens + promptTokens + outTokens,
            speed: Math.round(outTokens / elapsedSec),
          });
        },
        quizAbortRef.current.signal,
        // 默认不下发上限：出题对思考型模型同样会被思考吃满预算，护栏交给下面的完整性校验 + 一次修复
        CHAIN_MAX_TOKENS.quiz,
        undefined,
        'quiz',
      );
      if (recovered) flashToast(true, lang === 'zh' ? '已自动降低思考并重试' : 'Retried with reduced thinking');
      const full = stripThinkingFromHistory(res.text);
      const outcome = classifyStreamOutcome(res);
      // 跨会话累计 token（出题请求 = prompt + 实际输出）
      addTokenUsage(config?.model, promptTokens + estimateTokens(full));
      refreshTokenUsage();
      let parsed = parseQuizBatchChecked(full, count);
      if (parsed.reason) {
        logPromptIssue('quiz-parse', `${parsed.reason}${outcome === 'limit' ? '（端点已按输出上限截断）' : outcome === 'cut' ? '（连接被中途切断）' : ''}`);
        // 一次修复重试：只回灌上一次输出的尾部，要求补出缺失题目（无对话窗口，学生无法自己重来）
        try {
          const repair = await streamChat(
            config,
            [
              messages[0],
              { role: 'assistant', content: stripThinkingFromHistory(full.slice(-2000)) },
              {
                role: 'user',
                content: lang === 'zh'
                  ? `上一次输出${parsed.reason}。请只补出缺失的题目，沿用同一格式与字段名，写完输出 ${QUIZ_SENTINEL}；直接从缺失的【第N题】开始输出，不要输出任何寒暄或解释前缀；不要重复已出过的考点（已出：${parsed.items.map((q) => q.question.slice(0, 12)).join('、') || '无'}）。`
                  : `The previous answer ${parsed.reason}. Output ONLY the missing questions in the same format and field names, then print ${QUIZ_SENTINEL}; start directly with the missing question number — no greeting or explanation prefix; do not repeat topics already covered (${parsed.items.map((q) => q.question.slice(0, 12)).join(', ') || 'none'}).`,
              },
            ],
            () => {},
            quizAbortRef.current.signal,
            CHAIN_MAX_TOKENS.quiz,
            undefined,
            'quiz',
          );
          const merged = parseQuizBatchChecked(`${full}\n${repair.text}`, count);
          if (merged.items.length > parsed.items.length) parsed = merged;
        } catch {
          logPromptIssue('quiz-repair', '修复重试失败，按首次结果继续');
        }
      }
      // 去重（重试最容易产出重复题）+ 选项洗牌（正确项位置交给代码，不交给模型）
      const items = dedupeQuizQuestions(parsed.items).slice(0, count).map((q) => shuffleOptions(q));
      if (items.length === 0) {
        // 空/无法解析一律给分类文案：空正文（思考吃满预算）与普通失败对学生是两种提示
        setQuizError(full.trim() ? t.aiError.other : t.aiError.empty);
        setQuizQuestions([]);
        setQuizLoading(false);
        return;
      }
      // 题数不足必须让学生知道：静默少给几题会被当成「系统只出这么多题」
      if (items.length < count) {
        flashToast(false, lang === 'zh'
          ? `模型只给出 ${items.length}/${count} 题（输出被截断），可重新出题`
          : `The model produced only ${items.length}/${count} questions (output cut off) — try again`);
      }
      setQuizQuestions(items);
      setQuizIdx(0);
      setQuizLoading(false);
    } catch (e) {
      if (quizAbortRef.current && quizAbortRef.current.signal.aborted) return;
      // 与对话链路同一套分类：英文原文只进开发者日志，学生看到的是中文分类文案
      const classified = classifyChatFailure(e, { offline: isOffline });
      if (classified.raw) logPromptIssue('quiz-error', classified.raw);
      setQuizError(t.aiError[classified.kind]);
      setQuizLoading(false);
    }
  };

  // 记录一次作答到本地错题集（localStorage，独立于问答历史）
  const recordQuizAnswer = (q: QuizQuestion, picked: number, correct: boolean, timedOut: boolean, elapsedSec: number, userAnswer?: string) => {
    saveQuizHistory({
      path: location.pathname + location.search,
      subject: pageSubject(location.pathname, lang) ?? '',
      topic: aiCtx.topic ?? pageSubject(location.pathname, lang) ?? '',
      question: q.question,
      options: q.options,
      answerIdx: q.answerIdx,
      pickedIdx: picked,
      correct,
      type: q.type,
      fillAnswers: q.type === 'fill' ? q.fillAnswers : undefined,
      userAnswer: q.type === 'fill' ? (userAnswer ?? '') : undefined,
      explanation: q.explanation || undefined,
      timeLimit: quizSetup?.timeLimit ?? 0,
      elapsedMs: Math.round(elapsedSec * 1000),
      timedOut,
      model: config?.model ?? '',
    });
    setQuizHistoryData(listQuizHistory());
  };

  // 学生选择选项（单选题）：本地判分，计入统计；若解析失败（无选项）不判
  const pickQuizOption = (idx: number) => {
    if (quizSelected !== null || !quizQ || quizQ.type !== 'choice') return;
    setQuizSelected(idx);
    clearTimer();
    if (quizQ.answerIdx === -1) return; // 无标准答案，不判分
    setQuizStats((s) => ({ correct: s.correct + (idx === quizQ.answerIdx ? 1 : 0), total: s.total + 1 }));
    recordQuizAnswer(quizQ, idx, idx === quizQ.answerIdx, false, quizSetup?.timeLimit ? quizSetup.timeLimit - (timeLeft ?? quizSetup.timeLimit) : 0);
  };

  // 学生提交填空答案：judgeFillAnswer 归一化判分，规则判错时 AI 兜底
  const submitFillAnswer = async () => {
    if (quizSelected !== null || !quizQ || quizQ.type !== 'fill' || fillJudging) return;
    const input = quizFillInput.trim();
    if (!input) return; // 空输入不判（允许继续作答）
    const ruleCorrect = judgeFillAnswer(input, quizQ.fillAnswers);
    let finalCorrect = ruleCorrect;
    // 规则判错 + 开关开 + 有配置 + 答案长度合理 → AI 兜底判分
    // 长度上限：全站唯一的学生自由输入，超长既吃掉上下文、也把判分器暴露给「输入里写 Y」的玩法
    const answerForAi = input.slice(0, 200);
    if (!ruleCorrect && fillAiJudge && config && quizQ.fillAnswers.length > 0 && input.length <= 200) {
      setFillJudging(true);
      const { system, user } = buildFillJudgePrompt(lang, quizQ.question, answerForAi, quizQ.fillAnswers);
      try {
        const signal = new AbortController(); // 判分超时 20 秒（思考型模型需要先想再回一个字母）
        const timeoutId = setTimeout(() => signal.abort(), 20000);
        const res = await streamChat(
          config,
          [{ role: 'system', content: system }, { role: 'user', content: user }],
          () => {},
          signal.signal,
          CHAIN_MAX_TOKENS.judge,
          undefined,
          'judge', // 二值判分：强制极简思考（能关则关，不可关回落最低档）
        );
        clearTimeout(timeoutId);
        // 取第一个 Y/N，而不是首字符（解析见 ai-quiz.ts parseJudgeVerdict）
        if (parseJudgeVerdict(stripThinkingFromHistory(res.text))) finalCorrect = true;
        else if (!res.text.trim()) {
          // 空正文（思考吃满预算最常见）：判分不可用就保留规则判分结果——
          // 绝不能因为「AI 没回话」把学生答对的题判错（旧实现正是如此）
          logPromptIssue('fill-judge', `空正文（finish_reason=${res.finishReason}）：保留规则判分结果`);
        }
      } catch (e) {
        // AI 判分失败（网络/Key 超时等）：静默回退规则结果，不抛错、不卡 UI
        logPromptIssue('fill-judge', (e as Error).message);
      } finally {
        setFillJudging(false);
      }
    } else if (!ruleCorrect && fillAiJudge && config && input.length > 200) {
      logPromptIssue('fill-judge', `答案超长（${input.length} 字符）跳过 AI 兜底`);
    }
    setQuizSelected(finalCorrect ? 0 : -2); // 0 答对 / -2 答错（-1 保留给超时语义）
    clearTimer();
    setQuizStats((s) => ({ correct: s.correct + (finalCorrect ? 1 : 0), total: s.total + 1 }));
    recordQuizAnswer(quizQ, -1, finalCorrect, false, quizSetup?.timeLimit ? quizSetup.timeLimit - (timeLeft ?? quizSetup.timeLimit) : 0, input);
  };

  // 超时：未作答视为答错
  const handleTimeout = () => {
    if (quizSelected !== null || !quizQ) return;
    if (quizQ.type === 'fill') {
      setQuizSelected(-1); // -1 标记超时
      setQuizStats((s) => ({ correct: s.correct, total: s.total + 1 }));
      recordQuizAnswer(quizQ, -1, false, true, quizSetup?.timeLimit ?? 0, '');
      return;
    }
    if (quizQ.answerIdx === -1) return; // 无标准答案，不判
    setQuizSelected(-1); // -1 标记超时
    setQuizStats((s) => ({ correct: s.correct, total: s.total + 1 }));
    recordQuizAnswer(quizQ, -1, false, true, quizSetup?.timeLimit ?? 0);
  };

  // 下一题 / 本轮结束
  const nextQuiz = () => {
    clearTimer();
    setQuizSelected(null);
    if (quizIdx + 1 < quizQuestions.length) {
      setQuizIdx(quizIdx + 1);
    } else {
      setQuizDone(true);
    }
  };

  // 重新开始一轮（同设置再出一批）
  const restartQuiz = () => {
    if (quizSetup) startQuiz(quizSetup.count, quizSetup.angle, quizSetup.timeLimit, quizSetup.qtype);
  };
  const quizState = useMemo(() => ({ busy, config, fillAiJudge, fillJudging, quizDone, quizError, quizFillInput, quizIdx, quizLoading, quizQ, quizQuestions, quizSelected, quizSetup, quizStats, setupAngle, setupCount, setupQType, setupTimeLimit, timeLeft, usage }), [busy, config, fillAiJudge, fillJudging, quizDone, quizError, quizFillInput, quizIdx, quizLoading, quizQ, quizQuestions, quizSelected, quizSetup, quizStats, setupAngle, setupCount, setupQType, setupTimeLimit, timeLeft, usage]);
  const quizActions = useStable(() => ({ loadQuizBatch, nextQuiz, pickQuizOption, resetQuiz, restartQuiz, setQuizFillInput, setSetupAngle, setSetupCount, setSetupQType, setSetupTimeLimit, setView, startQuiz, submitFillAnswer, toggleFillAiJudge }));
  // ── 对外接口 ────────────────────────────────────────────────
  return {
    /** 面板两袋 */
    state: quizState,
    actions: quizActions,
    /** 清空本轮（主组件的 resetConversation / clearAll 复用） */
    resetQuiz,
    /** 在途出题请求：切页 / 关面板时由主组件显式中止 */
    abortRef: quizAbortRef,
    /** 刷题域信号守卫：主组件的 open 副作用读它 */
    openedRef: quizOpenedRef,
  };
}
