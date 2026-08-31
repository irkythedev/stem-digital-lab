/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 学习助手（Header 入口，右上角面板）——单轮问答 + 链式追问 + 本地历史。
 *
 * 隐私说明：
 * - 对话历史仅存用户本机浏览器（localStorage，上限 100 条，可随时清除）——数据不触网、不上传、不中转，清除浏览器数据即一并清除；
 * - 单轮问答：每次提问独立，仅「继续问」时携带上一轮问答作为参考（内存态，关页即清）；
 * - 同页会话（内存态，上限 20 条）随页面/主题切换清空；持久化历史独立保留、可查看；
 * - 首次使用：先阅读使用须知，点「我同意并继续」才进入设置（两步流程）；
 * - 用户自带 API Key（仅存本机 localStorage），本站不提供、不记录；
 * - 自动注入当前页面知识（AiContext）到系统提示词，避免 AI 自由发挥；
 * - 免责声明常驻：AI 生成内容仅供参考，请以教材和老师讲解为准。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, ChevronDown, CircleX, Coins, Copy, Eye, EyeOff, GraduationCap, History, Pause, Play, Scale, Settings, ShieldCheck, Sparkles, Square, Trash2, TriangleAlert, Volume2 } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';
import { useApp } from '../../lib/app-context';
import { useSpeak } from '../../lib/use-speak';
import { getTtsVoice } from '../../lib/tts-config';
import { labMap } from '../../lib/labs';
import { useAiContext } from '../../lib/ai-context';
import { buildQuizPrompt, buildQuizSummaryPrompt } from '../../lib/ai-config';
import { parseQuizBatch, parseQuizQuestion, type QuizQuestion } from '../../lib/ai-quiz';
import { clearHistory, listHistory, saveHistory, relativeTime, type AiHistoryEntry } from '../../lib/ai-history';
import { clearQuizHistory, listQuizHistory, saveQuizHistory, wrongQuizHistory, type QuizHistoryEntry } from '../../lib/quiz-history';
import { buildQuizRecordsForSummary, computeQuizOverview } from '../../lib/quiz-summary';
import AnswerRich, { InlineAnswer } from './AnswerRich';
import {
  AI_PROVIDERS, buildSystemPrompt, clearAiConfig, estimateTokens, fetchModels, isNetworkError, loadAiConfig, normalizeBaseUrl, saveAiConfig, streamChat,
  type AiConfig, type AiProvider, type QuizAngle,
} from '../../lib/ai-config';

/** 当前页面 → 主题提示（注入系统提示词） */
function pageSubject(pathname: string, lang: 'zh' | 'en'): string | undefined {
  const zh = lang === 'zh';
  if (pathname.startsWith('/lab/')) {
    const id = pathname.split('/')[2];
    const lab = labMap[id];
    if (lab) return zh ? `${lab.name.zh}实验` : `${lab.name.en} lab`;
    return zh ? '物理化学实验' : 'science lab';
  }
  if (pathname.startsWith('/math-formulas')) return zh ? '数学公式速查' : 'Math formulas';
  if (pathname.startsWith('/physics-formulas')) return zh ? '物理公式速查' : 'Physics formulas';
  if (pathname.startsWith('/physics-constants')) return zh ? '物理常量速查' : 'Physics constants';
  if (pathname.startsWith('/periodic-table')) return zh ? '元素周期表' : 'Periodic table';
  if (pathname.startsWith('/subject/math')) return zh ? '初中数学' : 'Middle-school math';
  if (pathname.startsWith('/subject/physics')) return zh ? '初中物理（苏科版）' : 'Middle-school physics (Su-Ke)';
  if (pathname.startsWith('/subject/chemistry')) return zh ? '初中化学' : 'Middle-school chemistry';
  return undefined;
}

/** 空状态快捷提问：按页面类型生成贴合措辞的问题（实验→原理与操作；工具→内容与用法；学科/首页不显示） */
function quickAsk(pathname: string, lang: 'zh' | 'en'): { q: string; label: string } | null {
  const zh = lang === 'zh';
  // 实验页：实验有原理与操作步骤，措辞贴切
  if (pathname.startsWith('/lab/')) {
    const lab = labMap[pathname.split('/')[2]];
    if (!lab) return null;
    const name = zh ? lab.name.zh : lab.name.en;
    return zh
      ? { q: `请讲解${name}实验的原理与操作要点`, label: `试试问：讲解${name}实验` }
      : { q: `Explain the principle and key steps of the ${name} lab`, label: `Ask: explain the ${name} lab` };
  }
  // 工具页：介绍内容与使用方法
  const tools: { prefix: string; zh: string; en: string }[] = [
    { prefix: '/periodic-table', zh: '元素周期表', en: 'Periodic Table' },
    { prefix: '/physics-constants', zh: '物理常量速查', en: 'Physics Constants' },
    { prefix: '/physics-formulas', zh: '物理公式速查', en: 'Physics Formulas' },
    { prefix: '/math-formulas', zh: '数学公式速查', en: 'Math Formulas' },
  ];
  const tool = tools.find((t) => pathname.startsWith(t.prefix));
  if (tool) {
    return zh
      ? { q: `请介绍${tool.zh}的内容与使用方法`, label: `试试问：${tool.zh}怎么用` }
      : { q: `Introduce ${tool.en}: its contents and how to use it`, label: `Ask: how to use ${tool.en}` };
  }
  // 学科页 / 首页 / 其他：无具体内容可讲，不显示快捷提问
  return null;
}

/** 兜底提取：从回答中提取疑似问句（不依赖「可以继续了解」marker），供追问推荐 */
function extractQuestionLines(text: string): string[] {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^\s*[-•*·\d.、)）]+\s*/, '').trim())
    .filter((l) => l.length >= 4 && l.length <= 60)
    .filter(
      (l) =>
        /[？?]\s*$/.test(l) || // 以问号结尾
        /^(什么是|为什么|如何|怎样|怎么|请|能否|能不能|是不是|有没有|会不|which|what|why|how|can|is|are|do|does|would|could)/i.test(l),
    );
  return [...new Set(lines)].slice(0, 6);
}

/** 最后防线：按当前主题生成本地追问模板（任何模型都保证追问不断供） */
function fallbackRecTemplates(topic: string | undefined, lang: 'zh' | 'en'): string[] {
  const t = topic?.trim();
  if (lang === 'zh') {
    const base = t ? `「${t}」` : '这个知识点';
    return [`${base}的常见考点有哪些？`, `${base}容易在哪里出错？`, `${base}在生活中有哪些应用？`];
  }
  const base = t ?? 'this topic';
  return [
    `What are the key points about ${base}?`,
    `What mistakes are common with ${base}?`,
    `How is ${base} used in daily life?`,
  ];
}

/** 从回答文本解析「推荐追问」：正文 + 推荐问题列表 */
function parseRecQuestions(text: string): { body: string; recs: string[] } {
  // 1. 精确 marker（中英）——字符串匹配优先
  const markers = ['可以继续了解：', 'You can also explore:'];
  let idx = -1;
  let markerLen = 0;
  for (const m of markers) {
    const found = text.lastIndexOf(m);
    if (found !== -1) {
      idx = found;
      markerLen = m.length;
      break;
    }
  }
  // 2. 变体回退（AI 可能输出近似格式：无冒号、换说法、英文变体）
  if (idx === -1) {
    const variant = text.match(
      /(?:可以继续了解|你可以继续了解|还想了解|You (?:may|can) also (?:explore|ask|check)|Follow[- ]?up questions?)[:：]?/g,
    );
    if (variant && variant.length > 0) {
      const v = variant[variant.length - 1];
      idx = text.lastIndexOf(v);
      markerLen = v.length;
    }
  }
  if (idx === -1) {
    // 第 2 级兜底：模型没按格式输出 marker，但回答里可能带问句 → 提取作追问（不依赖模型遵守格式）
    return { body: text, recs: extractQuestionLines(text) };
  }
  const recs = text
    .slice(idx + markerLen)
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[.、)\]]?\s*/, '').trim())
    .filter((l) => l && l.length > 2)
    .slice(0, 6);
  return { body: text.slice(0, idx).trim(), recs };
}

export default function AiAssistant() {
  const { lang } = useApp();
  const { state: speakState, errorMsg, speak, pause, resume, stop: stopSpeak, waitingLong } = useSpeak();
  // 面板关闭时停止朗读（组件不卸载，需显式停止）
  const location = useLocation();
  const { open, setOpen, configured, setConfigured, aiCtx, ask, setAsk, quizSignal } = useAiContext();
  useEffect(() => {
    if (!open) {
      stopSpeak();
      quizAbortRef.current?.abort(); // 面板关闭时中止进行中的出题请求（P2）
    }
  }, [open, stopSpeak]);

  // 切换界面语言时停止朗读：正在播的回答绑定旧语言（voice 已在调用时确定），
  // 避免英文界面用英文 voice 读中文回答等混淆——切语言 = 朗读重新开始
  const prevLangRef = useRef(lang);
  useEffect(() => {
    if (prevLangRef.current === lang) return;
    prevLangRef.current = lang;
    stopSpeak();
  }, [lang, stopSpeak]);

  // 朗读控制条（历史条目与当前轮共用）
  const renderSpeakControls = (text: string) => (
    <div className="flex justify-end items-center gap-1 mt-1.5">
      <button
        type="button"
        onClick={() => {
          if (speakState === 'playing') pause();
          else if (speakState === 'paused') resume();
          else if (speakState === 'synthesizing') stopSpeak();
          else speak(text, getTtsVoice(lang), lang);
        }}
        title={
          speakState === 'playing' ? (lang === 'zh' ? '暂停朗读' : 'Pause')
            : speakState === 'paused' ? (lang === 'zh' ? '继续朗读' : 'Resume')
            : speakState === 'synthesizing' ? (lang === 'zh' ? '合成中' : 'Loading')
            : speakState === 'error' ? (lang === 'zh' ? '重试朗读' : 'Retry reading')
            : (lang === 'zh' ? '朗读回答' : 'Read aloud')
        }
        className={`inline-flex items-center justify-center transition-colors p-1.5 -m-1.5 ${
          speakState === 'synthesizing'
            ? (waitingLong ? 'text-[#d97706]' : 'text-[var(--muted)]')
            : 'text-[var(--muted)] hover:text-[var(--fg)]'
        }`}
      >
        {speakState === 'synthesizing' ? (
          /* 品牌三角方圆：合成中沿三角形路径循环移位（复用 Header 品牌动画）；等待超 4s 变暖色提示 */
          <span className="relative block w-5 h-5 speak-brand" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="absolute w-2 h-2 animate-tri-spin speak-tri" style={{ top: 0, left: 6 }}>
              <path d="M3 20 L12 4 L21 20 Z" />
            </svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="absolute w-2 h-2 animate-sq-spin speak-sq" style={{ top: 12, left: 0 }}>
              <rect x="4" y="4" width="16" height="16" />
            </svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="absolute w-2 h-2 animate-ci-spin speak-ci" style={{ top: 12, left: 12 }}>
              <circle cx="12" cy="12" r="8" />
            </svg>
          </span>
        ) : speakState === 'playing' ? <Pause className="w-4 h-4" />
          : speakState === 'paused' ? <Play className="w-4 h-4" />
          : <Volume2 className="w-4 h-4" />
        }
      </button>
      {/* 暂停后可停止（回到开头） */}
      {speakState === 'paused' && (
        <button
          type="button"
          onClick={stopSpeak}
          title={lang === 'zh' ? '停止朗读' : 'Stop'}
          className="inline-flex items-center text-[var(--muted)] hover:text-[var(--fg)] transition-colors p-1.5 -m-1.5"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
      )}
      {speakState === 'error' && errorMsg && (
        <span className="text-[0.5625rem] text-[var(--error)] mono-font ml-1" role="alert">
          {errorMsg}
        </span>
      )}
    </div>
  );
  const [config, setConfig] = useState<AiConfig | null>(() => loadAiConfig());
  const [view, setView] = useState<'terms' | 'settings' | 'chat' | 'history' | 'quiz'>('terms');
  const [providerId, setProviderId] = useState(AI_PROVIDERS[0].id);
  const [apiKey, setApiKey] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('');
  const [liveModels, setLiveModels] = useState<string[]>([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  // 模型下拉：点击外部关闭
  useEffect(() => {
    if (!modelMenuOpen) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [modelMenuOpen]);
  const [modelNote, setModelNote] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  // 保存成功 toast（面板内提示，2 秒自动消失）
  const [savedToast, setSavedToast] = useState(false);
  const savedToastTimer = useRef<number | null>(null);
  useEffect(() => () => { if (savedToastTimer.current) window.clearTimeout(savedToastTimer.current); }, []);
  // 复制状态：成功按钮上显示「已复制 ✓」，失败显示「复制失败」；2 秒后恢复
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFailedId, setCopyFailedId] = useState<string | null>(null);
  const copiedIdTimer = useRef<number | null>(null);
  useEffect(() => () => { if (copiedIdTimer.current) window.clearTimeout(copiedIdTimer.current); }, []);
  // 持久化问答历史（本地 localStorage，上限 100 条；展开项 / 清空二次确认）
  const [persistHistory, setPersistHistory] = useState<AiHistoryEntry[]>(() => listHistory());
  const [expandedHistId, setExpandedHistId] = useState<string | null>(null);
  const [confirmClearHist, setConfirmClearHist] = useState(false);
  // 历史筛选：科目 chips + 知识点下拉（内存态，关闭面板即重置）
  const [subjFilter, setSubjFilter] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [topicMenuOpen, setTopicMenuOpen] = useState(false);
  const topicMenuRef = useRef<HTMLDivElement | null>(null);
  // 考考你记录 tab 状态
  const [historyTab, setHistoryTab] = useState<'qa' | 'quiz'>('qa');
  const [quizHistoryData, setQuizHistoryData] = useState<QuizHistoryEntry[]>(() => listQuizHistory());
  const [quizSubjFilter, setQuizSubjFilter] = useState<string | null>(null);
  // 错题集范围：all = 全部记录 / wrong = 仅错题（默认仅错题，贴近错题集语义）
  const [quizScope, setQuizScope] = useState<'all' | 'wrong'>('wrong');
  // 知识点下拉：点击外部关闭
  useEffect(() => {
    if (!topicMenuOpen) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (topicMenuRef.current && !topicMenuRef.current.contains(e.target as Node)) {
        setTopicMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [topicMenuOpen]);
  // 历史筛选选项（动态提取）+ 过滤结果
  const histSubjects = useMemo(
    () => [...new Set(persistHistory.map((h) => h.subject).filter((s): s is string => !!s))],
    [persistHistory],
  );
  const histTopics = useMemo(
    () => [...new Set(persistHistory.map((h) => (h.topic || '').replace(/[（(].*?[）)]/g, '')).filter((t) => t.length > 0))].sort((a, b) => a.localeCompare(b, 'zh')),
    [persistHistory],
  );
  const filteredHistory = useMemo(
    () => persistHistory.filter((h) => {
      if (subjFilter && h.subject !== subjFilter) return false;
      if (topicFilter) {
        const t = (h.topic || '').replace(/[（(].*?[）)]/g, '');
        if (t !== topicFilter) return false;
      }
      return true;
    }),
    [persistHistory, subjFilter, topicFilter],
  );
  const hasFilter = subjFilter !== null || topicFilter !== null;
  // ── 考考你记录（错题集）筛选/统计：基于 quizHistoryData 派生 ──
  const quizSubjects = useMemo(
    () => [...new Set(quizHistoryData.map((e) => e.subject).filter((s): s is string => !!s))],
    [quizHistoryData],
  );
  const quizStatsData = useMemo(() => {
    const total = quizHistoryData.length;
    const correct = quizHistoryData.filter((e) => e.correct).length;
    const wrong = total - correct;
    const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { total, correct, wrong, rate };
  }, [quizHistoryData]);
  const filteredQuizHistory = useMemo(
    () => quizHistoryData.filter((e) => {
      if (quizSubjFilter && e.subject !== quizSubjFilter) return false;
      if (quizScope === 'wrong' && e.correct) return false;
      return true;
    }),
    [quizHistoryData, quizSubjFilter, quizScope],
  );
  // 学情概览：基于当前筛选范围（科目 × 仅错题/全部）的本地聚合
  // 趋势的 overall 取全量正确率（而非筛选后），使「仅错题」视图下 recent vs overall 仍有对比意义
  const quizOverview = useMemo(
    () => computeQuizOverview(filteredQuizHistory, 3, 10, quizStatsData.rate),
    [filteredQuizHistory, quizStatsData.rate],
  );
  // AI 归纳的输入文本（随筛选范围），无记录时为空串
  const quizSummaryRecords = useMemo(
    () => buildQuizRecordsForSummary(filteredQuizHistory, 30, 200),
    [filteredQuizHistory],
  );
  const wrongQuizList = useMemo(() => wrongQuizHistory(), [quizHistoryData]);
  // 错题展开项（复用 expandedHistId 语义不冲突，单独用 quizExpandedId）
  const [quizExpandedId, setQuizExpandedId] = useState<string | null>(null);
  // 清空错题二次确认
  const [confirmClearQuiz, setConfirmClearQuiz] = useState(false);
  const clearQuizHistoryAll = () => {
    if (!confirmClearQuiz) { setConfirmClearQuiz(true); return; }
    clearQuizHistory();
    setQuizHistoryData([]);
    setQuizExpandedId(null);
    setConfirmClearQuiz(false);
  };
  // 错题「再来一题」：回 quiz 视图，显示设置面板（基于当前页知识点重新自选出题）
  const retryWrongQuestion = () => {
    resetQuiz();
    setQuizExpandedId(null);
    setView('quiz');
  };
  // ── 错题集「AI 归纳」：把当前筛选范围的作答记录喂给 AI 生成学习诊断 ──
  const [quizSummaryText, setQuizSummaryText] = useState<string>('');
  const [quizSummaryLoading, setQuizSummaryLoading] = useState(false);
  const [quizSummaryError, setQuizSummaryError] = useState<string | null>(null);
  const [quizSummaryConfirm, setQuizSummaryConfirm] = useState(false); // 触网确认（AI 会被要求看错题）
  const quizSummaryAbortRef = useRef<AbortController | null>(null);
  // 当前筛选范围的中文/英文标签（用于 AI 告知范围）
  const quizSummaryScopeLabel = useMemo(() => {
    const parts: string[] = [];
    if (quizSubjFilter) parts.push(quizSubjFilter);
    parts.push(quizScope === 'wrong' ? (lang === 'zh' ? '错题' : 'wrong answers') : (lang === 'zh' ? '全部记录' : 'all records'));
    return parts.join(' · ');
  }, [quizSubjFilter, quizScope, lang]);
  /** 生成 AI 归纳（复用 streamChat；流式，展示累计文本） */
  const runQuizSummary = async () => {
    if (!config) return;
    if (!quizSummaryRecords) {
      setQuizSummaryError(lang === 'zh' ? '当前范围内没有作答记录可总结' : 'No answer records in the current scope to summarize');
      return;
    }
    setQuizSummaryConfirm(false);
    setQuizSummaryLoading(true);
    setQuizSummaryError(null);
    setQuizSummaryText('');
    quizSummaryAbortRef.current = new AbortController();
    const messages: { role: 'system' | 'user'; content: string }[] = [
      { role: 'system', content: buildQuizSummaryPrompt(lang, quizSummaryRecords, quizSummaryScopeLabel) },
      { role: 'user', content: lang === 'zh' ? '请根据以上作答记录生成学习诊断。' : 'Please generate a learning diagnosis from the records above.' },
    ];
    try {
      const t0 = performance.now();
      const baseTokens = usage?.tokens ?? 0;
      const promptTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
      let received = 0;
      const full = await streamChat(
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
        quizSummaryAbortRef.current.signal,
        1200, // 归纳输出上限（学习诊断 250 字以内，留足分节/公式余量）
      );
      setQuizSummaryText(full);
    } catch (e) {
      if (quizSummaryAbortRef.current && quizSummaryAbortRef.current.signal.aborted) return;
      const msg = (e as Error).message;
      const authFailed = /authentication|invalid.*api|api key|401|403/i.test(msg);
      setQuizSummaryError(
        isNetworkError(msg)
          ? (lang === 'zh' ? '网络无法访问该端点，请检查网络或改用预设服务商' : 'Cannot reach the endpoint. Check network or use a preset provider')
          : authFailed
            ? (lang === 'zh' ? 'API Key 无效或已失效，请点击右上角「设置」重新配置' : 'API key invalid or expired, open Settings to reconfigure')
            : (lang === 'zh' ? '生成失败：' : 'Failed: ') + msg,
      );
    } finally {
      setQuizSummaryLoading(false);
    }
  };
  /** 关闭面板时中止归纳流 */
  const closeQuizSummary = () => {
    quizSummaryAbortRef.current?.abort();
    setQuizSummaryText('');
    setQuizSummaryError(null);
    setQuizSummaryConfirm(false);
    setQuizSummaryLoading(false);
  };
  // ── 出题练习（Quiz）：批量出题（一次 N 题），本地判分，练习统计内存态 ──
  /** 出题设置（null = 尚未设置，显示设置面板） */
  const [quizSetup, setQuizSetup] = useState<{ count: number; angle: QuizAngle; timeLimit: number } | null>(null);
  /** 设置面板本地状态 */
  const [setupCount, setSetupCount] = useState(5);
  const [setupAngle, setSetupAngle] = useState<QuizAngle>('basic');
  const [setupTimeLimit, setSetupTimeLimit] = useState(0);
  /** 本批题目（一次生成，逐题作答） */
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  /** 当前题下标 */
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizSelected, setQuizSelected] = useState<number | null>(null); // 学生选的选项下标
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
    setQuizError(null);
    setQuizStats({ correct: 0, total: 0 });
    setQuizDone(false);
    clearTimer();
  };

  // 开始新一轮（用新的设置生成一批题）
  const startQuiz = (count: number, angle: QuizAngle, timeLimit: number) => {
    setQuizSetup({ count, angle, timeLimit });
    setQuizStats({ correct: 0, total: 0 });
    setQuizDone(false);
    setQuizQuestions([]);
    setQuizIdx(0);
    void loadQuizBatch(count, angle, timeLimit);
  };

  // 批量出题（一次生成 N 题，流式，复用 streamChat；结果走批量宽容解析）
  const loadQuizBatch = async (overrideCount?: number, overrideAngle?: QuizAngle, overrideTimeLimit?: number) => {
    if (!config) return;
    const count = overrideCount ?? quizSetup?.count ?? 5;
    const angle = overrideAngle ?? quizSetup?.angle ?? 'basic';
    const timeLimit = overrideTimeLimit ?? quizSetup?.timeLimit ?? 0;
    setQuizLoading(true);
    setQuizError(null);
    quizAbortRef.current = new AbortController();
    const messages: { role: 'system' | 'user'; content: string }[] = [
      { role: 'system', content: buildQuizPrompt(lang, aiCtx.topic ?? pageSubject(location.pathname, lang), aiCtx.knowledge, count, angle, timeLimit) },
      { role: 'user', content: lang === 'zh' ? `请按格式出 ${count} 道题。` : `Please create ${count} questions in the specified format.` },
    ];
    try {
      const t0 = performance.now();
      // 用量实时统计：与对话视图共用同一 usage state（会话级累计）
      const baseTokens = usage?.tokens ?? 0;
      const promptTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
      let received = 0;
      const full = await streamChat(
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
        4000, // 出题输出上限：保证批量末题不截断
      );
      const parsed = parseQuizBatch(full, count);
      if (parsed.length === 0) {
        setQuizError(lang === 'zh' ? '出题失败，请重试' : 'Failed to create questions, please retry');
        setQuizQuestions([]);
        setQuizLoading(false);
        return;
      }
      setQuizQuestions(parsed);
      setQuizIdx(0);
      setQuizLoading(false);
    } catch (e) {
      if (quizAbortRef.current && quizAbortRef.current.signal.aborted) return;
      const msg = (e as Error).message;
      const authFailed = /authentication|invalid.*api|api key|401|403/i.test(msg);
      setQuizError(
        isNetworkError(msg)
          ? (lang === 'zh' ? '网络无法访问该端点，请检查网络或改用预设服务商' : 'Cannot reach the endpoint. Check network or use a preset provider')
          : authFailed
            ? (lang === 'zh' ? 'API Key 无效或已失效，请点击右上角「设置」重新配置' : 'API key invalid or expired, open Settings to reconfigure')
            : (lang === 'zh' ? '出题失败：' : 'Failed: ') + msg,
      );
      setQuizLoading(false);
    }
  };

  // 记录一次作答到本地错题集（localStorage，独立于问答历史）
  const recordQuizAnswer = (q: QuizQuestion, picked: number, correct: boolean, timedOut: boolean, elapsedSec: number) => {
    saveQuizHistory({
      path: location.pathname + location.search,
      subject: pageSubject(location.pathname, lang) ?? '',
      topic: aiCtx.topic ?? pageSubject(location.pathname, lang) ?? '',
      question: q.question,
      options: q.options,
      answerIdx: q.answerIdx,
      pickedIdx: picked,
      correct,
      timeLimit: quizSetup?.timeLimit ?? 0,
      elapsedMs: Math.round(elapsedSec * 1000),
      timedOut,
      model: config?.model ?? '',
    });
    setQuizHistoryData(listQuizHistory());
  };

  // 学生选择答案：本地判分（AI 自带答案字母），计入统计；若解析失败（无选项）不判
  const pickQuizOption = (idx: number) => {
    if (quizSelected !== null || !quizQ) return;
    setQuizSelected(idx);
    clearTimer();
    if (quizQ.answerIdx === -1) return; // 无标准答案，不判分
    setQuizStats((s) => ({ correct: s.correct + (idx === quizQ.answerIdx ? 1 : 0), total: s.total + 1 }));
    recordQuizAnswer(quizQ, idx, idx === quizQ.answerIdx, false, quizSetup?.timeLimit ? quizSetup.timeLimit - (timeLeft ?? quizSetup.timeLimit) : 0);
  };

  // 超时：未作答视为答错
  const handleTimeout = () => {
    if (quizSelected !== null || !quizQ) return;
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
    if (quizSetup) startQuiz(quizSetup.count, quizSetup.angle, quizSetup.timeLimit);
  };

  const navigate = useNavigate();
  // 使用须知条款折叠（默认全部展开，标题点击收起/展开，避免长条款挤占滚动空间）
  const [collapsedTerms, setCollapsedTerms] = useState<boolean[]>([false, false, false, false]);
  const toggleTerm = (i: number) => setCollapsedTerms((c) => c.map((v, idx) => (idx === i ? !v : v)));
  // 由 AI 推荐驱动的追问：当前回答 / 推荐追问列表 / 待发问题 / 上一轮问答（内存）
  const [answer, setAnswer] = useState('');
  const [recs, setRecs] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // AI 思考等待秒数（仅用于「等待太久」的视觉变色提示，不显示数字；阈值与朗读一致 4s）
  const [aiElapsed, setAiElapsed] = useState(0);
  useEffect(() => {
    if (!busy) {
      setAiElapsed(0);
      return;
    }
    const t = setInterval(() => setAiElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  const aiWaitingLong = aiElapsed > 4;
  // 用量统计（估算）：会话累计 token 数 + 最近一轮输出速度（对话完成时更新，视觉低调）
  const [usage, setUsage] = useState<{ tokens: number; speed: number } | null>(null);
  // 同页内多轮问答历史（内存态，上限 20 条；关闭面板/切换页面时清空——对齐页面锚定设计；持久化历史独立保留在 localStorage）
  const [history, setHistory] = useState<{ user: string; assistant: string }[]>([]);
  const HISTORY_MAX = 20;
  const lastExchange = useRef<{ user: string; assistant: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const prevPathRef = useRef(location.pathname);
  // 统一清空对话内容（页面切换 / 关闭面板共用；不动配置与面板位置）
  const resetConversation = () => {
    abortRef.current?.abort();
    quizAbortRef.current?.abort(); // 同时中止进行中的出题请求（P1：切页 quiz 状态残留）
    setPending(null); // 关键：清掉待发问题，防止切页后旧问题在新页面自动发送
    setAnswer('');
    setRecs([]);
    setCurrentQuestion('');
    setError(null);
    setUsage(null);
    setBusy(false);
    setHistory([]);
    lastExchange.current = null;
    resetQuiz(); // 清 quiz 状态与统计（P1）
    // 切页/关面板时若停留在 quiz 视图，回到对话（新页面知识点不同，避免空 quiz 卡住）
    setView((v) => (v === 'quiz' ? 'chat' : v));
  };
  // 页面切换时清空对话内容（不与新页面知识锚定错位；保持面板打开与配置不变）
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = location.pathname;
    if (prev !== location.pathname) {
      resetConversation();
    }
  }, [location.pathname]);

  // 同页内知识主题变化（如公式页切换选中项）时清空对话——pathname 不变但 aiCtx 更新
  const prevTopicRef = useRef(aiCtx.topic);
  useEffect(() => {
    if (prevTopicRef.current !== aiCtx.topic) {
      resetConversation();
      prevTopicRef.current = aiCtx.topic;
    }
  }, [aiCtx.topic]);
  const answerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // 面板位置（标题栏拖动，localStorage 记忆 UI 偏好——非对话内容）
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem('stem-ai-pos');
      return raw ? (JSON.parse(raw) as { x: number; y: number }) : null;
    } catch {
      return null;
    }
  });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  // 面板宽度（右侧边缘拖拽调整，localStorage 记忆 UI 偏好；280–720px，默认 384）
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 384;
    try {
      const raw = window.localStorage.getItem('stem-ai-width');
      const w = raw ? parseInt(raw, 10) : 384;
      return Number.isFinite(w) ? Math.min(720, Math.max(280, w)) : 384;
    } catch {
      return 384;
    }
  });
  const widthRef = useRef(384);
  useEffect(() => { widthRef.current = width; }, [width]);
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);

  // 面板高度（右下角斜拉调整；0 = 内容自适应；localStorage 记忆 UI 偏好；200–720px）
  const [height, setHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const raw = window.localStorage.getItem('stem-ai-height');
      const h = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(h) ? Math.min(720, Math.max(200, h)) : 0;
    } catch {
      return 0;
    }
  });
  const heightRef = useRef(0);
  useEffect(() => { heightRef.current = height; }, [height]);
  const cornerRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  // 右下角对角拖拽：同时调整宽高（等比例手感由用户控制，不做强制比例）
  const onCornerPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    cornerRef.current = { startX: e.clientX, startY: e.clientY, startW: widthRef.current, startH: heightRef.current };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onCornerPointerMove = (e: React.PointerEvent) => {
    if (!cornerRef.current) return;
    const dx = e.clientX - cornerRef.current.startX;
    const dy = e.clientY - cornerRef.current.startY;
    const newW = Math.min(720, Math.max(280, cornerRef.current.startW + dx));
    const newH = Math.min(720, Math.max(200, cornerRef.current.startH + dy));
    setWidth(newW);
    setHeight(newH);
    setPos((prev) => {
      if (!prev) return prev;
      const maxX = window.innerWidth - newW - 8;
      const maxY = window.innerHeight - newH - 8;
      const nx = prev.x > maxX ? Math.max(8, maxX) : prev.x;
      const ny = prev.y > maxY ? Math.max(8, maxY) : prev.y;
      return nx !== prev.x || ny !== prev.y ? { x: nx, y: ny } : prev;
    });
  };
  const onCornerPointerUp = () => {
    if (!cornerRef.current) return;
    cornerRef.current = null;
    try {
      window.localStorage.setItem('stem-ai-width', String(widthRef.current));
      window.localStorage.setItem('stem-ai-height', String(heightRef.current));
    } catch { /* ignore */ }
  };

  const onResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startW: widthRef.current };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onResizePointerMove = (e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const delta = e.clientX - resizeRef.current.startX;
    const newW = Math.min(720, Math.max(280, resizeRef.current.startW + delta));
    setWidth(newW);
    // 面板右边缘超出视口时同步左移，保持整块可见
    setPos((prev) => {
      if (!prev) return prev;
      const maxX = window.innerWidth - newW - 8;
      return prev.x > maxX ? { ...prev, x: Math.max(8, maxX) } : prev;
    });
  };
  const onResizePointerUp = () => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    try {
      window.localStorage.setItem('stem-ai-width', String(widthRef.current));
    } catch { /* ignore */ }
  };

  const onTitlePointerDown = (e: React.PointerEvent) => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onTitlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const w = panelRef.current?.offsetWidth ?? 320;
    const h = panelRef.current?.offsetHeight ?? 420;
    const nx = Math.max(8, Math.min(e.clientX - dragRef.current.dx, window.innerWidth - w - 8));
    const ny = Math.max(8, Math.min(e.clientY - dragRef.current.dy, window.innerHeight - h - 8));
    setPos({ x: nx, y: ny });
  };
  const onTitlePointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    // 记录位置（UI 偏好，非敏感内容）
    try {
      window.localStorage.setItem('stem-ai-pos', JSON.stringify(pos));
    } catch { /* ignore */ }
  };

  const provider: AiProvider = AI_PROVIDERS.find((p) => p.id === providerId) ?? AI_PROVIDERS[0];

  // 打开时：已配置 → 对话视图；未配置 → 须知视图（两步流程第一步）
  // 例外：openQuiz 打开的面板已在 quizSignal effect 设过 view，不覆盖
  useEffect(() => {
    if (open) {
      if (quizOpenedRef.current) {
        quizOpenedRef.current = false;
        return;
      }
      setView(config ? 'chat' : 'terms');
    }
  }, [open, config]);

  // 进入设置视图时回填已保存配置（刷新/重开不丢 provider/key/端点/模型）
  useEffect(() => {
    if (view === 'settings' && config) {
      setProviderId(config.providerId);
      setApiKey(config.apiKey);
      if (config.providerId === 'custom') setCustomUrl(config.baseUrl);
      setModel(config.model);
      setTestResult(null);
    }
  }, [view]);

  // 页面「问 AI」触发：携带预填问题
  useEffect(() => {
    if (ask) {
      setPending(ask);
      setAsk('');
    }
  }, [ask, setAsk]);

  // pending 就绪后自动发送（已配置时）
  useEffect(() => {
    if (pending && config) {
      void sendQuestion(pending, false);
      setPending(null);
    }
  }, [pending, config]);

  // 回答区自动滚底（流式增量 + 新轮入历史时都滚到底部）
  useEffect(() => {
    answerRef.current?.scrollTo({ top: answerRef.current.scrollHeight, behavior: 'smooth' });
  }, [answer, history]);

  // 切换预设
  const selectProvider = (id: string) => {
    setProviderId(id);
    setModel('');
    setLiveModels([]);
    setModelNote(null);
    setTestResult(null);
    if (id !== 'custom') setCustomUrl('');
  };

  // 获取模型列表（同时验证连接）：优先 GET /models（无需模型名），失败时回退最小 chat 请求
  const testConnection = async () => {
    if (!apiKey.trim()) { setTestResult({ ok: false, msg: lang === 'zh' ? '请先填写 API Key' : 'Enter an API key first' }); return; }
    setTesting(true);
    setTestResult(null);
    const baseUrl = normalizeBaseUrl(providerId === 'custom' ? customUrl.trim() : provider.baseUrl);
    if (!baseUrl) { setTesting(false); setTestResult({ ok: false, msg: lang === 'zh' ? '端点地址无效（仅支持 http/https）' : 'Invalid endpoint URL (http/https only)' }); return; }
    try {
      // ① 优先获取模型列表（OpenAI 兼容 GET /models，无需 model 参数）
      let ids: string[] = [];
      let modelsErr: string | null = null;
      try {
        ids = await fetchModels(baseUrl, apiKey);
      } catch (e) {
        modelsErr = (e as Error).message;
      }
      if (ids.length > 0) {
        setLiveModels(ids);
        setModel(ids[0]);
        setModelNote(lang === 'zh' ? `已获取 ${ids.length} 个可用模型` : `${ids.length} models available`);
        setTestResult({ ok: true, msg: lang === 'zh' ? `连接成功 ✓ 已获取 ${ids.length} 个模型` : `Connected ✓ ${ids.length} models found` });
      } else {
        // ② /models 不可用或未返回列表 → 回退最小 chat 请求验证连接（使用当前模型或预设首个）
        const fallbackModel = model.trim() || provider.models[0] || '';
        if (!fallbackModel) {
          setLiveModels([]);
          setModelNote(lang === 'zh' ? '无法获取模型列表，可手输模型名' : 'Could not list models — type one manually');
          setTestResult({ ok: false, msg: lang === 'zh' ? '该端点未返回模型列表，请手动输入模型名' : 'No model list returned — type a model name manually' });
        } else {
          try {
            const res = await fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
              body: JSON.stringify({ model: fallbackModel, messages: [{ role: 'user', content: 'hi' }], max_tokens: 8 }),
            });
            if (res.ok) {
              setLiveModels([]);
              setModel(fallbackModel);
              setModelNote(modelsErr
                ? (lang === 'zh' ? '连接成功，但该端点未提供模型列表（可手输）' : 'Connected, but no model list from this endpoint (type one manually)')
                : (lang === 'zh' ? '服务商未返回模型列表，可手输模型名' : 'No models returned — type one manually'));
              setTestResult({ ok: true, msg: lang === 'zh' ? '连接成功 ✓（端点未提供模型列表，请手动输入模型名）' : 'Connected ✓ (no model list — type the model name manually)' });
            } else {
              const j = await res.json().catch(() => null);
              const detail = (j?.error?.message || `HTTP ${res.status}`).slice(0, 80);
              setTestResult({ ok: false, msg: detail });
            }
          } catch (e2) {
            const msg = (e2 as Error).message;
            setTestResult({
              ok: false,
              msg: isNetworkError(msg)
                ? (lang === 'zh' ? '无法访问该端点（网络不可达或浏览器直连被限制），请改用预设服务商或自建代理' : 'Cannot reach this endpoint (network or browser-direct restriction). Use a preset provider or your own proxy')
                : msg.slice(0, 80),
            });
          }
        }
      }
    } catch (e) {
      const msg = (e as Error).message;
      setTestResult({
        ok: false,
        msg: isNetworkError(msg)
          ? (lang === 'zh' ? '无法访问该端点（网络不可达或浏览器直连被限制），请改用预设服务商或自建代理' : 'Cannot reach this endpoint (network or browser-direct restriction). Use a preset provider or your own proxy')
          : msg.slice(0, 80),
      });
    }
    setTesting(false);
  };

  // 保存配置
  const save = () => {
    const baseUrl = normalizeBaseUrl(providerId === 'custom' ? customUrl.trim() : provider.baseUrl);
    if (!apiKey.trim() || !baseUrl) { setTestResult({ ok: false, msg: lang === 'zh' ? '请填写 API Key 与端点地址' : 'Fill in API key and endpoint' }); return; }
    if (!model.trim()) { setTestResult({ ok: false, msg: lang === 'zh' ? '请填写或选择模型' : 'Choose or type a model' }); return; }
    const cfg: AiConfig = { providerId, apiKey: apiKey.trim(), baseUrl, model, agreed: true };
    saveAiConfig(cfg);
    setConfigured(true);
    setConfig(cfg);
    setView('chat');
    // 保存成功 toast
    setSavedToast(true);
    if (savedToastTimer.current) window.clearTimeout(savedToastTimer.current);
    savedToastTimer.current = window.setTimeout(() => setSavedToast(false), 2000);
  };

  // 清除全部 AI 数据
  const clearAll = () => {
    resetConversation();
    resetQuiz(); // 清 quiz 状态与统计（P2：清全部后 quiz 不残留旧题/统计）
    clearAiConfig();
    setConfigured(false);
    setConfig(null);
    setView('terms');
    setProviderId(AI_PROVIDERS[0].id);
    setApiKey('');
    setCustomUrl('');
    setShowKey(false);
    setModel('');
    setLiveModels([]);
    setModelNote(null);
    setTesting(false);
    setTestResult(null);
    setSavedToast(false);
  };

  // 复制到剪贴板（带降级：优先 navigator.clipboard，降级隐藏 textarea + execCommand，覆盖 http 环境）
  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // 降级
      }
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  // 复制历史回答：成功显示「已复制 ✓」，失败显示「复制失败」；2 秒后恢复
  const copyAnswer = async (id: string, text: string) => {
    const ok = await copyToClipboard(text);
    if (copiedIdTimer.current) window.clearTimeout(copiedIdTimer.current);
    if (ok) {
      setCopiedId(id);
      setCopyFailedId(null);
    } else {
      setCopyFailedId(id);
      setCopiedId(null);
    }
    copiedIdTimer.current = window.setTimeout(() => {
      setCopiedId(null);
      setCopyFailedId(null);
    }, 2000);
  };

  // 清空持久化历史（只清历史，不动配置与当前会话）
  const clearHistoryAll = () => {
    if (!confirmClearHist) {
      setConfirmClearHist(true);
      return;
    }
    clearHistory();
    setPersistHistory([]);
    setExpandedHistId(null);
    setConfirmClearHist(false);
  };

  // 回到来源页（页面级跳转：pathname + 保留 query；topic 由页面从 URL/内部状态还原）
  const gotoHistoryPath = (path: string) => {
    setView('chat');
    navigate(path);
  };

  // 发送单轮问题（followUp=true 时携带上一轮问答作为上下文）
  const sendQuestion = async (text: string, followUp = false) => {
    const q = text.trim();
    if (!q || busy || !config) return;
    setCurrentQuestion(q); // 立即更新问题行（推荐追问也即时生效，不等回答完成）
    setAnswer('');
    setRecs([]);
    setError(null);
    setBusy(true);
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: buildSystemPrompt(lang, aiCtx.topic ?? pageSubject(location.pathname, lang), aiCtx.knowledge) },
    ];
    if (followUp && lastExchange.current) {
      messages.push({ role: 'user', content: lastExchange.current.user });
      messages.push({ role: 'assistant', content: lastExchange.current.assistant });
    }
    messages.push({ role: 'user', content: q });
    abortRef.current = new AbortController();
    const t0 = performance.now();
    // 用量实时统计：会话基准（本轮之前的累计）固定，prompt 一次计入，输出随流式滚动增长
    const baseTokens = usage?.tokens ?? 0;
    const promptTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    let received = 0;
    try {
      const full = await streamChat(
        config,
        messages,
        (delta) => {
          setAnswer((a) => a + delta);
          received += delta.length;
          const elapsedSec = Math.max(0.1, (performance.now() - t0) / 1000);
          const outTokens = estimateTokens(received);
          setUsage({
            tokens: baseTokens + promptTokens + outTokens,
            speed: Math.round(outTokens / elapsedSec),
          });
        },
        abortRef.current.signal,
        2000, // 对话输出上限：保证追问段完整
      );
      const { body, recs: parsedRecs } = parseRecQuestions(full);
      setAnswer(body);
      // 追问推荐三级兜底：①新解析优先 ②保留上一轮有效追问 ③本地主题模板（保证任何模型都不断供）
      const topic = aiCtx.topic ?? pageSubject(location.pathname, lang);
      setRecs((prev) => {
        if (parsedRecs.length > 0) return parsedRecs;
        if (prev.length > 0) return prev;
        return fallbackRecTemplates(topic, lang);
      });
      // 历史与追问上下文只存干净的 body（剥离「可以继续了解」追问段，避免回答内重复显示）
      lastExchange.current = { user: q, assistant: body };
      // 入历史（上限 HISTORY_MAX，超出丢最旧）
      setHistory((h) => [...h.slice(-(HISTORY_MAX - 1)), { user: q, assistant: body }]);
      // 持久化到本地（纯浏览器 localStorage，上限 100 条；仅存最终完整回答）
      saveHistory({
        path: location.pathname + location.search,
        subject: pageSubject(location.pathname, lang),
        topic: aiCtx.topic ?? pageSubject(location.pathname, lang),
        question: q,
        answer: body,
        model: config.model,
      });
      setPersistHistory(listHistory());
      // 回答已入历史，清空当前轮（避免同一内容在历史区和当前轮重复显示）
      setAnswer('');
      // 最终定格（与实时滚动值对齐，避免浮点误差）
      const elapsedSec = Math.max(0.1, (performance.now() - t0) / 1000);
      const outTokens = estimateTokens(full);
      setUsage({
        tokens: baseTokens + promptTokens + outTokens,
        speed: Math.round(outTokens / elapsedSec),
      });
    } catch (e) {
      // 使用 signal.aborted 判断（比字符串匹配可靠，兼容不同浏览器错误消息）
      if (abortRef.current && !abortRef.current.signal.aborted) {
        const msg = (e as Error).message;
        const authFailed = /authentication|invalid.*api|api key|401|403/i.test(msg);
        setError(
          isNetworkError(msg)
            ? (lang === 'zh' ? '网络无法访问该端点（不可达或浏览器直连被限制），请改用预设服务商或自建代理' : 'Cannot reach this endpoint (network or browser-direct restriction). Use a preset provider or your own proxy')
            : authFailed
              ? (lang === 'zh' ? 'API Key 无效或已失效，请点击右上角「设置」重新配置' : 'API key invalid or expired — open Settings to reconfigure')
              : (lang === 'zh' ? '请求失败：' : 'Request failed: ') + msg,
        );
      }
    }
    setBusy(false);
  };

  // 点击 AI 推荐的问题：携带上下文继续追问
  const askRecommended = (q: string) => {
    void sendQuestion(q, true);
  };

  // 「换一批」兜底：请求 AI 再给一批追问，只更新 recs（不产生新轮次，不动 answer/history）
  const [refreshingRecs, setRefreshingRecs] = useState(false);
  const refreshRecs = async () => {
    if (!config || busy || refreshingRecs) return;
    setRefreshingRecs(true);
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: buildSystemPrompt(lang, aiCtx.topic ?? pageSubject(location.pathname, lang), aiCtx.knowledge) },
    ];
    // 携带上一轮问答作为「刚才讨论的主题」上下文（与追问同模式，避免换一批飘回页面主题）
    if (lastExchange.current) {
      messages.push({ role: 'user', content: lastExchange.current.user });
      messages.push({ role: 'assistant', content: lastExchange.current.assistant });
    }
    messages.push({ role: 'user', content: lang === 'zh' ? '请仅针对刚才讨论的主题，换一批给出 3 个不同的追问问题（每行一个，编号 1. 2. 3.，不要解释）' : 'Give 3 different follow-up questions on the topic just discussed (one per line, numbered 1. 2. 3., no explanation)' });
    try {
      const t0 = performance.now();
      const full = await streamChat(config, messages, () => {}, undefined);
      // 宽松解析：优先 marker，无 marker 时整段按行拆
      const { recs: parsed } = parseRecQuestions(full);
      const lines = full.split('\n').map((l) => l.replace(/^\s*\d+[.、)]\s*/, '').trim()).filter((l) => l && l.length > 2);
      const next = parsed.length > 0 ? parsed : lines;
      if (next.length > 0) {
        setRecs(next);
      }
      // 用量统计：refreshRecs 也是消耗 token 的请求，计入会话累计
      const elapsedSec = Math.max(0.1, (performance.now() - t0) / 1000);
      const promptTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
      const outTokens = estimateTokens(full);
      setUsage((prev) => ({
        tokens: (prev?.tokens ?? 0) + promptTokens + outTokens,
        speed: Math.round(outTokens / elapsedSec),
      }));
    } catch {
      // 静默失败，保留现有追问
    }
    setRefreshingRecs(false);
  };

  if (!open) return null;

  // 移动端（<640px，含窄屏）：面板改为顶部锚定的近全宽卡片——忽略桌面拖拽/缩放记忆、隐藏缩放手柄、限制最大高度不超可视区
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  // 面板位置：记忆的 pos 若超出当前视口（如桌面拖动保存后切到小屏/移动端），回退右上默认位置；移动端一律顶部锚定
  const safePos =
    !isMobile && pos && typeof window !== 'undefined' && pos.x >= 8 && pos.y >= 8 && pos.x < window.innerWidth - 120 && pos.y < window.innerHeight - 80
      ? pos
      : null;

  return (
    <>
      {/* 移动端遮罩层：点击空白处安全关闭，同时给软键盘弹出提供稳定视口边界 */}
      {isMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
          onClick={() => { resetConversation(); setOpen(false); setPending(null); }}
          aria-hidden="true"
        />
      )}
      <div
        ref={panelRef}
        className={`fixed z-50 border border-[var(--border)] bg-[var(--bg)] shadow-[0_8px_24px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden ${
          isMobile
            ? 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl border-b-0 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]'
            : 'w-[calc(100vw-2rem)]'
        }`}
        style={{
          ...(!isMobile
            ? {
                width: Math.min(width, typeof window !== 'undefined' ? window.innerWidth - 16 : width),
                ...(height > 0 && view === 'chat' ? { height } : {}),
                ...(safePos ? { left: safePos.x, top: safePos.y } : { top: '3.5rem', right: '1rem' }),
              }
            : {}),
        }}
        role="dialog"
        aria-label="AI assistant"
      >
      {/* 宽度拖拽把手（右侧边缘；移动端隐藏，全宽卡片无需缩放） */}
      <div
        className={`absolute right-0 top-0 bottom-3 w-1.5 cursor-ew-resize touch-none z-10 hover:bg-[var(--fg)]/10 transition-colors${isMobile ? ' hidden' : ''}`}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        title={lang === 'zh' ? '拖拽调整宽度' : 'Drag to resize'}
      />
      {/* 右下角斜拉把手（同时调宽高；移动端隐藏） */}
      <div
        className={`absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize touch-none z-20 flex items-end justify-end${isMobile ? ' hidden' : ''}`}
        onPointerDown={onCornerPointerDown}
        onPointerMove={onCornerPointerMove}
        onPointerUp={onCornerPointerUp}
        title={lang === 'zh' ? '斜拉调整宽高' : 'Drag corner to resize'}
      >
        <span className="w-2 h-2 border-r border-b border-[var(--muted)]" aria-hidden="true" />
      </div>
      {/* 保存成功 toast：面板顶部浮条 */}
      {savedToast && (
        <div className="absolute left-1/2 -translate-x-1/2 top-2.5 z-30 flex items-center gap-2 border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[0.6875rem] text-[var(--fg)] shadow-[0_4px_16px_rgba(0,0,0,0.12)] whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 update-dot" aria-hidden="true" />
          {lang === 'zh' ? '已保存 ✓' : 'Saved ✓'}
        </div>
      )}
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] cursor-move touch-none select-none shrink-0"
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={onTitlePointerUp}
      >
        <h2 className="text-xs font-bold tracking-widest mono-font uppercase truncate max-w-[80%] inline-flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 shrink-0 text-[var(--fg)]" aria-hidden="true" />
          <span className="truncate">{view === 'settings'
            ? (lang === 'zh' ? 'AI 设置' : 'Settings')
            : view === 'terms'
              ? (lang === 'zh' ? 'AI 学习助手' : 'AI Assistant')
              : view === 'history'
                ? (lang === 'zh' ? '学习记录' : 'Learning Records')
                : view === 'quiz'
                  ? (lang === 'zh' ? '考考你' : 'Quiz')
                  : (aiCtx.topic
                    ? aiCtx.topic.replace(/[（(].*?[）)]/g, '') // 剥离年级等括号信息（如「实验（8-9 年级）」）
                    : (pageSubject(location.pathname, lang) ?? (lang === 'zh' ? 'AI 学习助手' : 'AI Assistant')))}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {/* 非对话视图：显示「返回」箭头（chat 视图显示设置入口） */}
          <button type="button" onClick={() => setView(view === 'chat' ? 'settings' : 'chat')}
            aria-label={view === 'chat' ? (lang === 'zh' ? '设置' : 'Settings') : (lang === 'zh' ? '返回' : 'Back')}
            title={view === 'chat' ? (lang === 'zh' ? '设置' : 'Settings') : (lang === 'zh' ? '返回对话' : 'Back to chat')}
            className="p-1.5 -m-1.5 text-[var(--muted)] hover:text-[var(--fg)]">
            {view === 'chat' ? <Settings className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
          </button>
          {/* 问答历史入口：仅对话视图显示（子视图由返回箭头回对话） */}
          {config && view === 'chat' && (
            <button type="button" onClick={() => { setView('history'); setExpandedHistId(null); }}
              aria-label={lang === 'zh' ? '问答历史' : 'History'}
              title={lang === 'zh' ? '问答历史' : 'History'}
              className="p-1.5 -m-1.5 text-[var(--muted)] hover:text-[var(--fg)]">
              <History className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" onClick={() => { resetConversation(); setOpen(false); setPending(null); }} aria-label="Close" className="p-1.5 -m-1.5 text-[var(--muted)] hover:text-[var(--fg)] text-sm leading-none">×</button>
        </div>
      </div>

      {view === 'terms' ? (
        /* ── 第一步：使用须知（先同意才能进入设置） ── */
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* 条款区：内容超高时独立滚动 */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 space-y-3">
          <p className="text-[0.6875rem] font-bold mono-font text-[var(--fg)] tracking-widest">
            {lang === 'zh' ? '使用须知' : 'Terms'}
          </p>
          <p className="flex items-start gap-1.5 border-l-4 border-l-[var(--error)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-3 py-2 text-[0.6875rem] text-[var(--error)] serif-font leading-relaxed">
            <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{lang === 'zh' ? '配置/使用 AI 助手前，请阅读并同意以下条款：' : 'Before configuring or using the AI assistant, please read and accept the terms below:'}</span>
          </p>
          {pending && (
            <p className="text-[0.6875rem] text-[var(--fg)] serif-font leading-relaxed">
              {lang === 'zh' ? '您点击的问题将在配置完成后自动发送。' : 'Your question will be sent automatically once you finish the setup.'}
            </p>
          )}
          <div className="space-y-2 text-[0.6875rem] text-[var(--muted)] leading-relaxed">
            {lang === 'zh' ? (
              <>
                <div>
                  <button type="button" onClick={() => toggleTerm(0)} className="flex w-full items-center gap-1.5 font-bold text-[var(--fg)] text-left"><Coins className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />1. 服务性质与费用<ChevronDown className={`w-3 h-3 ml-auto shrink-0 text-[var(--muted)] transition-transform ${collapsedTerms[0] ? '-rotate-90' : ''}`} /></button>

                  {!collapsedTerms[0] && (

                  <p>本站为纯前端静态页面，<strong className="font-bold text-[var(--fg)]">仅提供对话界面，不提供任何 AI 大模型服务</strong>，也不收取任何费用。您需自行注册并管理所选 AI 服务商的 API，相关费用由您与服务商结算。</p>

                  )}
                </div>
                <div>
                  <button type="button" onClick={() => toggleTerm(1)} className="flex w-full items-center gap-1.5 font-bold text-[var(--fg)] text-left"><ShieldCheck className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />2. 数据与隐私安全<ChevronDown className={`w-3 h-3 ml-auto shrink-0 text-[var(--muted)] transition-transform ${collapsedTerms[1] ? '-rotate-90' : ''}`} /></button>

                  {!collapsedTerms[1] && (

                  <p>您的 API Key 仅保存在您本机浏览器的本地存储中。本站<strong className="font-bold text-[var(--fg)]">无后端服务器，不采集、不存储、不中转</strong>任何密钥或对话内容。对话数据由您的浏览器直接发送至您所选的服务商。请妥善保管您的 API Key，防范泄露风险。</p>

                  )}
                </div>
                <div>
                  <button type="button" onClick={() => toggleTerm(2)} className="flex w-full items-center gap-1.5 font-bold text-[var(--fg)] text-left"><BookOpen className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />3. 学习辅助声明<ChevronDown className={`w-3 h-3 ml-auto shrink-0 text-[var(--muted)] transition-transform ${collapsedTerms[2] ? '-rotate-90' : ''}`} /></button>

                  {!collapsedTerms[2] && (

                  <p>本 AI 助手专为初中数理化学习辅助设计。AI 生成的内容存在不准确的可能，<strong className="font-bold text-[var(--fg)]">仅供参考，请务必以学校教材和任课老师的讲解为准</strong>。未成年人请在监护人的指导下配置和使用。</p>

                  )}
                </div>
                <div>
                  <button type="button" onClick={() => toggleTerm(3)} className="flex w-full items-center gap-1.5 font-bold text-[var(--fg)] text-left"><Scale className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />4. 合规与责任限制<ChevronDown className={`w-3 h-3 ml-auto shrink-0 text-[var(--muted)] transition-transform ${collapsedTerms[3] ? '-rotate-90' : ''}`} /></button>

                  {!collapsedTerms[3] && (

                  <p>请合法合规使用本工具，严禁用于生成或传播任何违法违规内容。由于网络环境或服务商跨域（CORS）限制导致的连接问题，本站无法干预。因使用本工具及所选 AI 服务产生的相关权责，<strong className="font-bold text-[var(--fg)]">由您与服务商自行承担</strong>。</p>

                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <button type="button" onClick={() => toggleTerm(0)} className="flex w-full items-center gap-1.5 font-bold text-[var(--fg)] text-left"><Coins className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />1. Service nature and fees<ChevronDown className={`w-3 h-3 ml-auto shrink-0 text-[var(--muted)] transition-transform ${collapsedTerms[0] ? '-rotate-90' : ''}`} /></button>

                  {!collapsedTerms[0] && (

                  <p>This site is a pure front-end static page that <strong className="font-bold text-[var(--fg)]">only provides the chat UI — no AI model service</strong>, no fees. You register and manage the API of your chosen provider yourself; fees are settled with that provider.</p>

                  )}
                </div>
                <div>
                  <button type="button" onClick={() => toggleTerm(1)} className="flex w-full items-center gap-1.5 font-bold text-[var(--fg)] text-left"><ShieldCheck className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />2. Data and privacy<ChevronDown className={`w-3 h-3 ml-auto shrink-0 text-[var(--muted)] transition-transform ${collapsedTerms[1] ? '-rotate-90' : ''}`} /></button>

                  {!collapsedTerms[1] && (

                  <p>Your API key stays only in your browser's local storage. This site <strong className="font-bold text-[var(--fg)]">has no backend — it never collects, stores or relays</strong> keys or conversations. Chat data goes straight from your browser to your chosen provider. Keep your key safe.</p>

                  )}
                </div>
                <div>
                  <button type="button" onClick={() => toggleTerm(2)} className="flex w-full items-center gap-1.5 font-bold text-[var(--fg)] text-left"><BookOpen className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />3. Learning aid only<ChevronDown className={`w-3 h-3 ml-auto shrink-0 text-[var(--muted)] transition-transform ${collapsedTerms[2] ? '-rotate-90' : ''}`} /></button>

                  {!collapsedTerms[2] && (

                  <p>This assistant is for middle-school science learning only. AI output may be inaccurate — <strong className="font-bold text-[var(--fg)]">for reference; always defer to the textbook and your teacher</strong>. Minors should configure and use it under a guardian's guidance.</p>

                  )}
                </div>
                <div>
                  <button type="button" onClick={() => toggleTerm(3)} className="flex w-full items-center gap-1.5 font-bold text-[var(--fg)] text-left"><Scale className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />4. Compliance and liability<ChevronDown className={`w-3 h-3 ml-auto shrink-0 text-[var(--muted)] transition-transform ${collapsedTerms[3] ? '-rotate-90' : ''}`} /></button>

                  {!collapsedTerms[3] && (

                  <p>Use this tool lawfully; never generate or spread unlawful content. Connection issues caused by network or provider CORS restrictions are outside this site's control. Responsibility for using this tool and your chosen AI service <strong className="font-bold text-[var(--fg)]">lies with you and that provider</strong>.</p>

                  )}
                </div>
              </>
            )}
          </div>
          </div>
          {/* 同意按钮固定在底部（始终可见，不与条款一起滚动） */}
          <div className="shrink-0 px-4 pb-4 pt-2.5 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => setView('settings')}
            className="w-full px-3 py-2 text-xs mono-font border border-[var(--fg)] text-[var(--fg)] transition-colors"
          >
            {lang === 'zh' ? '我同意并继续 →' : 'I agree and continue →'}
          </button>
          </div>
        </div>
      ) : view === 'settings' ? (
        /* ── 第二步：配置表单（已同意） ── */
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 text-sm serif-font">
          <div className="flex items-center justify-between">
            <p className="text-[0.6875rem] font-bold mono-font text-[var(--fg)] tracking-widest">
              {lang === 'zh' ? 'AI 设置' : 'Settings'}
            </p>
            <button type="button" onClick={() => setView('terms')} className="text-[0.625rem] mono-font text-[var(--muted)] underline hover:text-[var(--fg)]">
              {lang === 'zh' ? '查看须知' : 'View terms'}
            </button>
          </div>

          {/* 服务商预设 */}
          <div>
            <p className="text-[0.6875rem] mono-font text-[var(--muted)] mb-1.5">{lang === 'zh' ? '选择服务商' : 'Provider'}</p>
            <div className="flex flex-wrap gap-1.5">
              {AI_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProvider(p.id)}
                  className={`px-2 py-1 text-[0.6875rem] mono-font border transition-colors ${providerId === p.id ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            {provider.note && <p className="text-[0.625rem] text-[var(--muted)] mt-1">{provider.note}</p>}
          </div>

          {/* 端点（自定义时显示） */}
          {providerId === 'custom' && (
            <div>
              <p className="text-[0.6875rem] mono-font text-[var(--muted)] mb-1">{lang === 'zh' ? 'Base URL（OpenAI 兼容）' : 'Base URL (OpenAI-compatible)'}</p>
              <input
                id="ai-custom-url"
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder={lang === 'zh' ? 'https://your-proxy.example.com/v1 或完整端点 /chat/completions' : 'https://your-proxy.example.com/v1 or full endpoint /chat/completions'}
                className="w-full border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--fg)] outline-none focus:border-[var(--fg)]"
              />
            </div>
          )}

          {/* API Key */}
          <div>
            <p className="text-[0.6875rem] mono-font text-[var(--muted)] mb-1">{lang === 'zh' ? `API Key（${provider.name}）` : `API Key (${provider.name})`}</p>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 pr-8 text-xs text-[var(--fg)] outline-none focus:border-[var(--fg)]"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? (lang === 'zh' ? '隐藏 Key' : 'Hide key') : (lang === 'zh' ? '显示 Key' : 'Show key')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)]"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* 模型：仅显示测试连接后实际获取的模型 */}
          <div>
            <p className="text-[0.6875rem] mono-font text-[var(--muted)] mb-1">
              {lang === 'zh' ? '模型' : 'Model'}
              {modelNote && <span className="ml-1.5 text-[0.625rem] text-[var(--fg)]">({modelNote})</span>}
            </p>
            {liveModels.length > 0 ? (
              <>
                <div ref={modelMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setModelMenuOpen((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--fg)] outline-none hover:border-[var(--fg)] focus:border-[var(--fg)] transition-colors"
                  >
                    <span className="truncate text-left">{model || (lang === 'zh' ? '选择模型…' : 'Select a model…')}</span>
                    <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-[var(--muted)] transition-transform ${modelMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {modelMenuOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-44 overflow-y-auto border border-[var(--border)] bg-[var(--bg)] shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                      {liveModels.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => { setModel(m); setModelMenuOpen(false); }}
                          className={`w-full text-left px-2.5 py-1.5 text-xs mono-font transition-colors ${
                            m === model
                              ? 'bg-[var(--accent-light)] text-[var(--fg)] font-bold border-l-2 border-l-[var(--accent)]'
                              : 'text-[var(--muted)] hover:bg-[var(--accent-light)] hover:text-[var(--fg)]'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  placeholder={lang === 'zh' ? '或手动输入模型名…' : 'or type a model name…'}
                  value={liveModels.includes(model) ? '' : model}
                  onChange={(e) => setModel(e.target.value.trim())}
                  className="mt-1.5 w-full border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--fg)] outline-none focus:border-[var(--fg)]"
                />
              </>
            ) : (
              <>
                <input
                  type="text"
                  placeholder={lang === 'zh' ? '点击「获取模型」自动列出可用模型，或手动输入…' : 'Click "Fetch models" to list available ones, or type…'}
                  value={model}
                  onChange={(e) => setModel(e.target.value.trim())}
                  className="w-full border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--fg)] outline-none focus:border-[var(--fg)]"
                />
                {!modelNote && (
                  <p className="text-[0.625rem] text-[var(--muted)] mt-1">
                    {lang === 'zh' ? '提示：点击「获取模型」，自动拉取该服务商实际可用的模型并填入' : 'Tip: click "Fetch models" to pull the provider\'s actual model list automatically'}
                  </p>
                )}
              </>
            )}
          </div>

          {/* 操作 */}
          <div className="flex items-center gap-2 pt-1">
            {config ? (
              <button type="button" onClick={() => setView('chat')} className="px-3 py-1.5 text-xs mono-font border border-[var(--border)] hover:border-[var(--fg)] transition-colors">
                {lang === 'zh' ? '返回对话' : 'Back to chat'}
              </button>
            ) : (
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs mono-font border border-[var(--border)] hover:border-[var(--fg)] transition-colors">
                {lang === 'zh' ? '关闭' : 'Close'}
              </button>
            )}
            <button type="button" onClick={testConnection} disabled={testing} className="px-3 py-1.5 text-xs mono-font border border-[var(--border)] hover:border-[var(--fg)] transition-colors disabled:opacity-50">
              {testing ? (lang === 'zh' ? '获取中…' : 'Fetching…') : lang === 'zh' ? '获取模型' : 'Fetch models'}
            </button>
            <button type="button" onClick={save} className="px-3 py-1.5 text-xs mono-font border border-[var(--fg)] text-[var(--fg)] transition-colors">
              {lang === 'zh' ? '保存' : 'Save'}
            </button>
            <button type="button" onClick={clearAll} className="ml-auto inline-flex items-center gap-1 text-[0.6875rem] mono-font text-[var(--muted)] hover:text-[var(--fg)]">
              <Trash2 className="w-3 h-3" />
              {lang === 'zh' ? '清除全部' : 'Clear all'}
            </button>
          </div>
          {testResult && (
            <p className={`text-[0.6875rem] mono-font ${testResult.ok ? 'text-[var(--fg)]' : 'text-[var(--error)]'}`}>{testResult.msg}</p>
          )}
        </div>
      ) : view === 'history' ? (
        /* ── 学习记录：问答历史 / 考考你记录（纯本地持久化）── */
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
                  className={`px-2 py-1 text-[0.6875rem] mono-font border transition-colors ${
                    subjFilter === null ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                  }`}
                >
                  {lang === 'zh' ? '全部' : 'All'}
                </button>
                {histSubjects.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSubjFilter(subjFilter === s ? null : s)}
                    className={`px-2 py-1 text-[0.6875rem] mono-font border transition-colors ${
                      subjFilter === s ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
                {hasFilter && (
                  <button
                    type="button"
                    onClick={() => { setSubjFilter(null); setTopicFilter(null); }}
                    className="ml-auto text-[0.625rem] mono-font text-[var(--muted)] underline hover:text-[var(--fg)]"
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
              filteredHistory.map((h) => (
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
                        {h.model ? <span className="text-[#1565c0]"> · {h.model}</span> : ''}
                      </span>
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--muted)] transition-transform ${expandedHistId === h.id ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {expandedHistId === h.id && (
                    <div className="border-t border-[var(--border)] px-2.5 py-2 space-y-1.5">
                      <p className="text-[0.625rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '回答' : 'Answer'}:</p>
                      <div className="text-left">
                        <div className="inline-block max-w-[95%] px-2.5 py-1.5 border border-[var(--border)] text-left text-xs leading-relaxed whitespace-pre-wrap ai-answer">
                          <AnswerRich text={h.answer} />
                          {renderSpeakControls(h.answer)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button type="button" onClick={() => gotoHistoryPath(h.path)}
                          title={lang === 'zh' ? '回到来源页' : 'Back to source page'}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] mono-font border border-[var(--border)] hover:border-[var(--fg)] transition-colors">
                          <ArrowLeft className="w-3 h-3" aria-hidden="true" />
                          {lang === 'zh' ? '回到来源页' : 'Back to source'}
                        </button>
                        <button type="button" onClick={() => void copyAnswer(h.id, h.answer)}
                          title={lang === 'zh' ? '复制回答' : 'Copy answer'}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] mono-font border transition-colors ${
                            copiedId === h.id
                              ? 'border-[var(--fg)] text-[var(--fg)]'
                              : copyFailedId === h.id
                                ? 'border-[var(--error)] text-[var(--error)]'
                                : 'border-[var(--border)] hover:border-[var(--fg)]'
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
          <div className="shrink-0 px-4 py-2.5 border-t border-[var(--border)] flex items-center justify-between">
            <span className="text-[0.625rem] text-[var(--muted)] mono-font">
              {lang === 'zh'
                ? (hasFilter ? `筛选出 ${filteredHistory.length} 条 / 共 ${persistHistory.length} 条` : `共 ${persistHistory.length} 条 · 自动保留最近 100 条`)
                : (hasFilter ? `${filteredHistory.length} of ${persistHistory.length} items` : `${persistHistory.length} items · keeps latest 100`)}
            </span>
            {persistHistory.length > 0 && (
              <button
                type="button"
                onClick={clearHistoryAll}
                className={`inline-flex items-center gap-1 text-[0.6875rem] mono-font transition-colors ${confirmClearHist ? 'text-[var(--error)] font-bold' : 'text-[var(--muted)] hover:text-[var(--error)]'}`}
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
              </span>
            </div>
            {/* 学情概览 + AI 归纳（基于当前筛选范围；仅在有记录时显示） */}
            {filteredQuizHistory.length > 0 && (
              <div className="shrink-0 px-3 pt-2">
                <div className="border border-[var(--border)] px-2.5 py-2 space-y-1.5">
                  {/* 本地概览：科目正确率 */}
                  <div className="text-[0.625rem] mono-font text-[var(--muted)] space-y-1">
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
                    {/* 薄弱知识点 TOP */}
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
                    {/* 错误类型 */}
                    {quizOverview.errorKinds.timeout + quizOverview.errorKinds.confuse + quizOverview.errorKinds.slow + quizOverview.errorKinds.fast > 0 && (
                      <div>
                        <span className="text-[var(--fg)]">{lang === 'zh' ? '类型' : 'Patterns'}:</span>{' '}
                        {quizOverview.errorKinds.timeout > 0 && <span className="mr-1.5">{lang === 'zh' ? `超时未答 ${quizOverview.errorKinds.timeout}` : `Timed out ${quizOverview.errorKinds.timeout}`}</span>}
                        {quizOverview.errorKinds.confuse > 0 && <span className="mr-1.5">{lang === 'zh' ? `易混反复错 ${quizOverview.errorKinds.confuse}` : `Repeated same wrong ${quizOverview.errorKinds.confuse}`}</span>}
                        {quizOverview.errorKinds.slow > 0 && <span className="mr-1.5">{lang === 'zh' ? `犹豫答错 ${quizOverview.errorKinds.slow}` : `Slow & wrong ${quizOverview.errorKinds.slow}`}</span>}
                        {quizOverview.errorKinds.fast > 0 && <span className="mr-1.5">{lang === 'zh' ? `过快答错 ${quizOverview.errorKinds.fast}` : `Too quick ${quizOverview.errorKinds.fast}`}</span>}
                      </div>
                    )}
                    {/* 趋势 */}
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
                  {/* AI 归纳：确认 → 生成 → 流式结果 */}
                  <div className="pt-1.5 border-t border-[var(--border)]/60">
                    <div className="flex items-center justify-end">
                      {!quizSummaryText && !quizSummaryLoading && (
                        <button
                          type="button"
                          onClick={() => setQuizSummaryConfirm(true)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] mono-font border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors disabled:opacity-50"
                          disabled={!config}
                        >
                          <Sparkles className="w-3 h-3" aria-hidden="true" />
                          {lang === 'zh' ? '让 AI 帮我总结' : 'Summarize with AI'}
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
                    </div>
                    {quizSummaryConfirm && (
                      <div className="pt-1.5 space-y-1.5">
                        <p className="text-[0.625rem] mono-font text-[var(--muted)] leading-snug">
                          <ShieldCheck className="w-3 h-3 inline-block mr-1 align-[-2px]" aria-hidden="true" />
                          {lang === 'zh'
                            ? `将把「${quizSummaryScopeLabel}」范围内的作答记录发送给你配置的 AI 服务商生成诊断，Key 仍在你本机、本站不记录。确定？`
                            : `This will send the ${quizSummaryScopeLabel} records to your configured AI provider to generate a diagnosis. Your key stays on-device; this site logs nothing. Proceed?`}
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
                            className="px-2 py-1 text-[0.625rem] mono-font border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] transition-colors"
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
                            {renderSpeakControls(quizSummaryText)}
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
            {/* 科目筛选 */}
            {quizSubjects.length > 0 && (
              <div className="shrink-0 px-3 pt-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuizSubjFilter(null)}
                  className={`px-2 py-1 text-[0.6875rem] mono-font border transition-colors ${quizSubjFilter === null ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}
                >
                  {lang === 'zh' ? '全部' : 'All'}
                </button>
                {quizSubjects.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setQuizSubjFilter(quizSubjFilter === s ? null : s)}
                    className={`px-2 py-1 text-[0.6875rem] mono-font border transition-colors ${quizSubjFilter === s ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {/* 记录列表 */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-2">
              {filteredQuizHistory.length === 0 ? (
                <div className="pt-8 text-center space-y-2">
                  <GraduationCap className="w-6 h-6 mx-auto text-[var(--muted)]" aria-hidden="true" />
                  <p className="text-xs text-[var(--muted)] italic">
                    {lang === 'zh' ? '暂无考考你记录。在实验、工具页做几道题就会自动保存在这里。' : 'No quiz records yet. Answer a few questions on lab or tool pages and they will be saved here.'}
                  </p>
                </div>
              ) : (
                filteredQuizHistory.map((e) => {
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
                              {e.correct ? '✓' : '✗'}
                            </span>
                            <span className="block text-xs serif-font leading-snug line-clamp-2"><InlineAnswer text={e.question} /></span>
                          </span>
                          <span className="block mt-0.5 text-[0.625rem] mono-font text-[var(--muted)]">
                            {relativeTime(e.ts, lang)}
                            {e.subject ? ` · ${e.subject}` : ''}
                            {e.topic && e.topic !== e.subject && !e.topic.includes(e.subject) ? ` · ${e.topic.replace(/[（(].*?[）)]/g, '')}` : ''}
                            {e.model ? <span className="text-[#1565c0]"> · {e.model}</span> : ''}
                          </span>
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--muted)] transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>
                      {expanded && (
                        <div className="border-t border-[var(--border)] px-2.5 py-2 space-y-1.5">
                          {/* 选项：正确答案高亮，我的错误选择标红 */}
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
                                  {isAnswer && <span className="ml-1 text-[0.625rem] mono-font text-[var(--success)]">{lang === 'zh' ? '✓ 正确答案' : '✓ Answer'}</span>}
                                  {isPicked && !e.correct && <span className="ml-1 text-[0.625rem] mono-font text-[var(--error)]">{lang === 'zh' ? '← 你的选择' : '← Your pick'}</span>}
                                </p>
                              );
                            })}
                          </div>
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
            <div className="shrink-0 px-4 py-2.5 border-t border-[var(--border)] flex items-center justify-between">
              <span className="text-[0.625rem] text-[var(--muted)] mono-font">
                {lang === 'zh' ? `共 ${quizStatsData.total} 条 · 自动保留最近 100 条` : `${quizStatsData.total} items · keeps latest 100`}
              </span>
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
        </div>
      ) : view === 'quiz' ? (
        /* ── 考考你：AI 批量出单选题，本地判分 ── */
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
                  onClick={() => startQuiz(setupCount, setupAngle, setupTimeLimit)}
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
                  className="px-2.5 py-1 text-[0.6875rem] mono-font border border-[var(--border)] hover:border-[var(--fg)] transition-colors"
                >
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
                      ⏱ {timeLeft}s
                    </span>
                  )}
                </div>
                <p className="text-sm serif-font leading-relaxed">
                  <AnswerRich text={quizQ.question} />
                </p>
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
                {/* 答后反馈：对/错 + 解析 */}
                {quizSelected !== null && quizQ.answerIdx !== -1 && (
                  <div className="border border-[var(--border)] px-2.5 py-2 space-y-1.5">
                    <p className={`text-[0.6875rem] mono-font font-bold ${quizSelected === quizQ.answerIdx ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                      {quizSelected === -1
                        ? (lang === 'zh' ? '⏱ 超时未作答' : '⏱ Timed out')
                        : quizSelected === quizQ.answerIdx
                          ? (lang === 'zh' ? '✓ 回答正确' : '✓ Correct')
                          : (lang === 'zh' ? `✗ 正确答案是 ${String.fromCharCode(65 + quizQ.answerIdx)}` : `✗ Correct answer: ${String.fromCharCode(65 + quizQ.answerIdx)}`)}
                    </p>
                    {quizQ.explanation && (
                      <div className="text-xs serif-font leading-relaxed">
                        <AnswerRich text={quizQ.explanation} />
                      </div>
                    )}
                  </div>
                )}
                {/* 无标准答案（解析失败降级）：给出原样题目，不判分 */}
                {quizSelected !== null && quizQ.answerIdx === -1 && (
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
                {config?.model && <span className="text-[0.625rem] text-[#1565c0] font-semibold">{config.model}</span>}
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
      ) : (
        /* ── 由页面驱动 + AI 推荐追问（无自由输入） ── */
        <>
          <div ref={answerRef} className="flex-1 overflow-y-auto overscroll-contain min-h-[150px] max-h-[60dvh] sm:max-h-[42dvh] p-3 space-y-2.5 text-sm serif-font">
            {history.length > 0 || answer || pending || busy ? (
              <>
                {/* 多轮历史（内存态，同页内可回看；关页/切页即清） */}
                {history.map((h, i) => (
                  <div key={i} className="space-y-1.5">
                    <p className="text-[0.625rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '问题' : 'Question'}: <InlineAnswer text={h.user} /></p>
                    <div className="text-left">
                      <div className="inline-block max-w-[95%] px-2.5 py-1.5 border border-[var(--border)] text-left text-xs leading-relaxed whitespace-pre-wrap ai-answer">
                        <AnswerRich text={h.assistant} />
                        {renderSpeakControls(h.assistant)}
                      </div>
                    </div>
                  </div>
                ))}
                {/* 当前轮（流式显示中） */}
                {(answer || pending || busy) && (
                  <>
                    <p className="text-[0.625rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '问题' : 'Question'}: <InlineAnswer text={pending || currentQuestion || ''} /></p>
                    <div className="text-left">
                      {/* 思考中：不显示方形边框（shaping 20px 精巧内联），明暗主题由库 auto 检测；等待>4s 变琥珀提示 */}
                      <div className={`inline-block max-w-[95%] px-2.5 py-1.5 ${answer ? 'border border-[var(--border)]' : ''} text-left text-xs leading-relaxed whitespace-pre-wrap ai-answer`}>
                        {answer ? (
                          <div style={{ animation: 'answer-fade-in 0.2s ease' }}>
                            <AnswerRich text={answer} />
                          </div>
                        ) : (
                          <div className="flex justify-center" aria-label={lang === 'zh' ? '思考中' : 'Thinking'}>
                            <ThinkingOrb
                              state="shaping"
                              size={20}
                              theme="auto"
                              style={{
                                transition: 'filter 0.6s ease',
                                ...(aiWaitingLong ? { filter: 'sepia(1) hue-rotate(-15deg) saturate(2.5)' } : {}),
                              }}
                            />
                          </div>
                        )}
                        {/* 朗读按钮：流式完成前不显示（busy 中）；完成后由历史区提供 */}
                        {answer && !busy && renderSpeakControls(answer)}
                      </div>
                    </div>
                  </>
                )}
                {error && (
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-[0.6875rem] text-[var(--error)] mono-font">{error}</p>
                    {/* 认证类错误：一键回设置修改配置 */}
                    {/authentication|invalid.*api|api key|401|403/i.test(error) && (
                      <button
                        type="button"
                        onClick={() => { setView('settings'); setError(null); }}
                        className="text-[0.6875rem] mono-font underline text-[var(--muted)] hover:text-[var(--fg)] shrink-0"
                      >
                        {lang === 'zh' ? '修改配置' : 'Fix config'}
                      </button>
                    )}
                  </div>
                )}
                {/* AI 推荐的追问（由 prompt 约束生成，内容可控；可翻页换一批） */}
                {!busy && recs.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[0.625rem] mono-font text-[var(--muted)] mb-1.5">
                      {lang === 'zh' ? '可以继续了解：' : 'You can also explore:'}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {recs.slice(0, 3).map((q, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => askRecommended(q)}
                          className="text-left text-[0.6875rem] serif-font px-2.5 py-1.5 border border-[var(--border)] hover:border-[var(--fg)] transition-colors"
                        >
                          <InlineAnswer text={q} />
                        </button>
                      ))}
                    </div>
                    {/* 换一批：每次请求 AI 重新生成 3 个不同追问（方案二，费 token 换质量） */}
                    {recs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void refreshRecs()}
                        className="mt-1.5 py-1 text-[0.625rem] mono-font text-[var(--muted)] underline hover:text-[var(--fg)] disabled:opacity-50"
                        disabled={refreshingRecs}
                      >
                        {refreshingRecs ? (lang === 'zh' ? '获取中…' : 'Loading…') : (lang === 'zh' ? '换一批' : 'More')}
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="pt-6 text-center space-y-2.5">
                <p className="text-xs text-[var(--muted)] italic">
                  {lang === 'zh'
                    ? '点击页面上的「问 AI」按钮，AI 会结合当前内容为您讲解'
                    : 'Tap "Ask AI" on a page — the assistant explains the current content'}
                </p>
                {/* 空状态快捷提问：当前在实验/工具页时一键发起（免去页面按钮跳转；按页面类型贴合措辞） */}
                {!busy && !answer && (() => {
                  const quick = quickAsk(location.pathname, lang);
                  if (!quick) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => void sendQuestion(quick.q)}
                      className="inline-flex items-center gap-1.5 text-[0.6875rem] mono-font border border-[var(--border)] px-3 py-1.5 hover:border-[var(--fg)] transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      {quick.label}
                    </button>
                  );
                })()}
              </div>
            )}
            {busy && (
              <div className="pt-1 flex justify-end">
                <button type="button" onClick={() => { abortRef.current?.abort(); setBusy(false); }} className="py-1 text-[0.625rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] underline">
                  {lang === 'zh' ? '停止' : 'Stop'}
                </button>
              </div>
            )}
          </div>
          {/* 考考你：AI 基于当前页面知识点出单选题（仅在实验/工具/科目等知识点页面显示） */}
          {!busy && config && pageSubject(location.pathname, lang) && (
            <div className="shrink-0 px-3 py-1.5 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => { resetQuiz(); setView('quiz'); }}
                className="inline-flex items-center gap-1.5 text-[0.6875rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
              >
                <GraduationCap className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                {lang === 'zh' ? '考考你' : 'Quiz'}
              </button>
            </div>
          )}
          <div className="border-t border-[var(--border)] bg-[var(--accent-light)] px-3 py-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <p
                className="flex items-center gap-1.5 min-w-0 flex-1 text-[0.625rem] text-[var(--muted)] leading-snug"
                title={lang === 'zh' ? 'AI 内容仅供参考，以教材和老师讲解为准 · 问答历史仅保存在本机浏览器，可随时清除' : 'AI output is for reference — trust the textbook · Chat history is stored only in your browser and can be cleared anytime'}
              >
                <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{lang === 'zh' ? 'AI 内容仅供参考' : 'AI output is for reference'}</span>
              </p>
              {/* 当前模型名（电压表蓝区分，加粗）+ 用量统计（数值加大，流式中 token 滚动增长） */}
              <p className="shrink-0 flex items-center gap-2 mono-font tabular-nums whitespace-nowrap">
                {config?.model && <span className="text-[0.625rem] text-[#1565c0] font-semibold">{config.model}</span>}
                {usage && (
                  <span className="flex items-center gap-1 text-[var(--fg)]">
                    <span className="text-[0.6875rem]">≈{usage.tokens.toLocaleString()} tokens</span>
                    <span className="text-[0.6875rem] text-[var(--muted)]">{busy ? (lang === 'zh' ? '· 生成中…' : '· Generating…') : `· ${usage.speed} t/s`}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
    </>
  );
}