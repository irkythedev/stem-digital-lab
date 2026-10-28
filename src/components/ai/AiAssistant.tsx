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
import { ArrowDown, ChevronDown, ChevronUp, ChevronsDown, GraduationCap, History, Lightbulb, Minus, Pause, Play, RotateCcw, Settings, ShieldCheck, Sparkles, Square, TriangleAlert, Volume2, X, WifiOff, RotateCw } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';
import { useApp } from '../../lib/app-context';
import { useSpeak } from '../../lib/use-speak';
import TtsStatusBadge from './TtsStatusBadge';
import { symbolsForTopic } from '../../lib/physics-speech-symbols';
import { labFromPath, labMap } from '../../lib/labs';
import { useAiContext } from '../../lib/ai-context';
import { buildQuizSummaryPrompt, logPromptIssue } from '../../lib/ai-config';
import { formatLabState, getLabState, labIdFromPath, stageLabel } from '../../lib/ai-dynamic-questions';
import { clearHistory, isStoppedAnswer, listHistory, markStopped, markTruncated, saveHistory, stripStoppedMark, type AiHistoryEntry } from '../../lib/ai-history';
import { STICK_THRESHOLD, isNearBottom } from '../../lib/ai-scroll';
import { clearQuizHistory, listQuizHistory, wrongQuizHistory, type QuizHistoryEntry } from '../../lib/quiz-history';
import { buildQuizPaper, type QuizPaper, type PaperBlankLevel, type PaperSortMode } from '../../lib/quiz-paper';
import QuizPaperPrint from './QuizPaperPrint';
import { buildQuizRecordsForSummary, computeQuizOverview } from '../../lib/quiz-summary';
import { verifyAiStatus } from '../../lib/ai-status';
import { addTokenUsage, loadTokenUsage, tokenUsageTotal, type TokenUsageData } from '../../lib/token-usage';
import AnswerRich, { InlineAnswer, prettyScripts } from './AnswerRich';
import { Mark, useStable } from './panels/panel-shared';
import TermsPanel from './panels/TermsPanel';
import SettingsPanel from './panels/SettingsPanel';
import HistoryPanel from './panels/HistoryPanel';
import QuizPanel from './panels/QuizPanel';
import useAiSettings from './hooks/useAiSettings';
import useQuizSession from './hooks/useQuizSession';
import { pageSubject } from './page-subject';
import TokenUsageDialog from '../ui/TokenUsageDialog';
import ProviderIcon from '../ui/ProviderIcon';
import { buildSystemPrompt, countCjk, estimateTokens, streamChat, classifyChatFailure, EmptyAnswerError, CHAIN_MAX_TOKENS, classifyStreamOutcome, type ChatFailure } from '../../lib/ai-config';

/** 面板内的失败态：分类结果 + 本轮累计失败次数（≥3 时追加「检查网络」提示） */
type FailureState = ChatFailure & { attempts: number };

/**
 * 外壳皮肤：与同页「实验导读」浮卡（PresetBriefing）同一套圆角与悬浮层级。
 * 全站语言是 rounded-2xl + 大阴影 + 毛玻璃，AI 窗口此前是直角 + 浅阴影，两块浮层
 * 叠在一起时割裂；这里把两者对齐，并让 AI 窗口的层级高于导读卡（见下方 z 值）。
 * 背景用 --card-bg/95：不透明度过低时，底下的电路画布会从面板里透出来搅乱正文。
 * 移动端不吃这一套（近全宽抽屉贴底，改了会露出下方画布），单独留在分支里。
 */
const SHELL_SKIN =
  'rounded-2xl border border-[var(--border)] bg-[var(--card-bg)]/95 shadow-2xl backdrop-blur-md';

/** 历史刻度轨（minimap notches）单条短横：视觉 20×4，Hover 拉宽到 32 并转主题色。 */
const NOTCH_BASE =
  'h-1 w-5 rounded-full bg-[var(--border)] transition-all duration-200 group-hover/notch:w-8 group-hover/notch:bg-[var(--accent)]';
/** 当前正在查看的那一轮：常亮主题色 + 与 Hover 同宽（Hover 时不会缩回去）。 */
const NOTCH_ACTIVE = 'h-1 w-8 rounded-full bg-[var(--accent)] transition-all duration-200';

/** 问答对的键：把本回合的思考草稿挂到对应历史气泡上（只存内存，不落盘） */
function turnKey(user: string, assistant: string): string {
  return `${user}\u0000${assistant}`;
}

/** 空状态快捷提问：按页面类型生成贴合措辞的问题（实验→原理与操作；工具→内容与用法；学科/首页不显示） */
function quickAsk(pathname: string, lang: 'zh' | 'en'): { q: string; label: string } | null {
  const zh = lang === 'zh';
  // 实验页：实验有原理与操作步骤，措辞贴切（含 /physics/circuit-bench 规范路径）
  const lab = labFromPath(pathname);
  if (lab) {
    const name = zh ? lab.name.zh : lab.name.en;
    return zh
      ? { q: `请讲解${name}实验的原理与操作要点`, label: `试试问：讲解${name}实验` }
      : { q: `Explain the principle and key steps of the ${name} lab`, label: `Ask: explain the ${name} lab` };
  }
  if (pathname.startsWith('/lab/')) return null;
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
  const { lang, t, isOffline } = useApp();
  const { state: speakState, errorMsg, notice: speakNotice, finishedText, speak, pause, resume, replay, stop: stopSpeak, waitingLong } = useSpeak();
  // 面板关闭时停止朗读（组件不卸载，需显式停止）
  const location = useLocation();
  const { open, setOpen, configured, setConfigured, aiCtx, ask, setAsk, quizSignal, settingsSignal } = useAiContext();

  /*
   * 跨域共用件（设置域与刷题域都读同一份）：轻量 Toast 出口 + 累计 token 用量 + 会话用量。
   * 留在主组件而非某个 Hook：谁都能写、谁都能读，放进任一侧都会造成两域互相依赖。
   */
  // 动作结果轻量 Toast（获取模型 / 测试连接）：即时反馈；完整报错仍留在下方结果行
  const [actToast, setActToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const actToastTimer = useRef<number | null>(null);
  useEffect(() => () => { if (actToastTimer.current) window.clearTimeout(actToastTimer.current); }, []);
  const flashToast = (ok: boolean, msg: string) => {
    setActToast({ ok, msg });
    if (actToastTimer.current) window.clearTimeout(actToastTimer.current);
    actToastTimer.current = window.setTimeout(() => setActToast(null), 2600);
  };
  // 用量统计（估算）：会话累计 token 数 + 最近一轮输出速度（对话完成时更新，视觉低调）
  const [usage, setUsage] = useState<{ tokens: number; speed: number } | null>(null);
  // 跨会话累计 token 用量（按模型 × 日期分桶，localStorage 持久化；设置页展示）
  const [tokenUsage, setTokenUsage] = useState<TokenUsageData>(() => loadTokenUsage());
  const refreshTokenUsage = () => setTokenUsage(loadTokenUsage());
  const tokenUsageTotalCount = tokenUsageTotal(tokenUsage);
  // token 用量明细弹窗（树状图：模型 → 日期）
  const [showTokenUsage, setShowTokenUsage] = useState(false);
  useEffect(() => {
    if (!open) {
      stopSpeak();
      quizAbortRef.current?.abort(); // 面板关闭时中止进行中的出题请求（P2）
    }
  }, [open, stopSpeak]);

  // 面板展开状态镜像到 <html>：反馈气泡与 AI 书签按 CSS 统一让位。
  // 和 ParamDock 的 html.param-dock-open 同一口径 —— 悬浮物互斥只认 <html> 类名，
  // 不在各组件里各写一套条件渲染（此前气泡靠 z-50 + DOM 顺序被面板 CTA 压住，属巧合而非规则）。
  useEffect(() => {
    const cls = document.documentElement.classList;
    if (open) cls.add('ai-sheet-open');
    else cls.remove('ai-sheet-open');
    return () => cls.remove('ai-sheet-open');
  }, [open]);

  // 切换界面语言时停止朗读：正在播的回答绑定旧语言（voice 已在调用时确定），
  // 避免英文界面用英文 voice 读中文回答等混淆——切语言 = 朗读重新开始
  const prevLangRef = useRef(lang);
  useEffect(() => {
    if (prevLangRef.current === lang) return;
    prevLangRef.current = lang;
    stopSpeak();
  }, [lang, stopSpeak]);

  // 朗读控制条（历史条目与当前轮共用）
  // topic 决定公式朗读口径：物理公式 topic → physics 模式 + 逐公式量名表（多义符号消歧）；其余走数学口径
  const renderSpeakControls = (text: string, topic?: string) => {
    const symbols = lang === 'zh' ? symbolsForTopic(topic) : null;
    const speechOpts = symbols ? { mode: 'physics' as const, symbols } : undefined;
    // finished 态只对刚播完的那条显示重播；其他条目保持普通朗读按钮（点了会朗读自己）
    const isReplay = speakState === 'finished' && finishedText === text;
    return (
    <div className="flex justify-end items-center gap-1 mt-1.5">
      <button
        type="button"
        onClick={() => {
          if (speakState === 'playing') pause();
          else if (speakState === 'paused') resume();
          else if (speakState === 'synthesizing') stopSpeak();
          else if (isReplay) replay();
          else speak(text, '', lang, speechOpts);
        }}
        title={
          speakState === 'playing' ? (lang === 'zh' ? '暂停朗读' : 'Pause')
            : speakState === 'paused' ? (lang === 'zh' ? '继续朗读' : 'Resume')
            : speakState === 'synthesizing' ? (lang === 'zh' ? '合成中' : 'Loading')
            : isReplay ? (lang === 'zh' ? '重新朗读' : 'Replay')
            : speakState === 'error' ? (lang === 'zh' ? '重试朗读' : 'Retry reading')
            : (lang === 'zh' ? '朗读回答' : 'Read aloud')
        }
        className={`tap-area inline-flex items-center justify-center transition-colors p-1.5 ${
          speakState === 'synthesizing'
            ? (waitingLong ? 'text-[var(--warn)]' : 'text-[var(--muted)]')
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
          : isReplay ? <RotateCcw className="w-4 h-4" />
          : <Volume2 className="w-4 h-4" />
        }
      </button>
      {/* 暂停后可停止（回到开头） */}
      {speakState === 'paused' && (
        <button
          type="button"
          onClick={stopSpeak}
          title={lang === 'zh' ? '停止朗读' : 'Stop'}
          className="tap-area inline-flex items-center text-[var(--muted)] hover:text-[var(--fg)] transition-colors p-1.5"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
      )}
      {speakState === 'error' && errorMsg && (
        <span className="text-[0.625rem] text-[var(--error)] mono-font ml-1" role="alert">
          {errorMsg}
        </span>
      )}
      {/* 云端不可用静默回落端侧时的克制提示（一行小字，不打断朗读） */}
      {speakNotice && speakState !== 'error' && (
        <span className="text-[0.625rem] text-[var(--muted)] mono-font ml-1">{speakNotice}</span>
      )}
    </div>
  );
  };
  const [view, setView] = useState<'terms' | 'settings' | 'chat' | 'history' | 'quiz'>('terms');

  /*
   * 设置域 Hook：模型配置 / 连通性检测 / 语音朗读 / 思考强度的状态与处理器全部内聚在 useAiSettings。
   * 主组件只做两件事：把跨域依赖注入进去、把返回的面板三袋透传给 SettingsPanel。
   */
  const aiSettings = useAiSettings({
    lang,
    t,
    view,
    setView,
    setOpen,
    setConfigured,
    settingsSignal,
    flashToast,
    refreshTokenUsage,
    tokenUsageTotalCount,
    setShowTokenUsage,
  });
  const {
    config,
    savedToast,
    clearSettings,
    state: settingsState,
    refs: settingsRefs,
    openedRef: settingsOpenedRef,
  } = aiSettings;

  // 局域网/本机端点：断网时仍值得一试（这类推理服务不依赖外网）
  const localEndpoint = /^https?:\/\/(127\.0\.0\.1|localhost|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(
    (config?.baseUrl ?? '').trim(),
  );
  // 复制状态：成功按钮上显示「已复制」+ 对勾图标，失败显示「复制失败」；2 秒后恢复
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
  // 问答历史 & 错题集共用：一页固定条数
  const PAGE_SIZE = 8;
  const [quizHistoryData, setQuizHistoryData] = useState<QuizHistoryEntry[]>(() => listQuizHistory());
  const [quizSubjFilter, setQuizSubjFilter] = useState<string | null>(null);
  // 错题集范围：all = 全部记录 / wrong = 仅错题（默认仅错题，贴近错题集语义）
  const [quizScope, setQuizScope] = useState<'all' | 'wrong'>('wrong');
  // 错题集知识点筛选（与问答历史一致；null = 全部知识点）
  const [quizTopicFilter, setQuizTopicFilter] = useState<string | null>(null);
  const [quizTopicMenuOpen, setQuizTopicMenuOpen] = useState(false);
  const quizTopicMenuRef = useRef<HTMLDivElement>(null);
  // 错题集知识点下拉：点击外部关闭
  useEffect(() => {
    if (!quizTopicMenuOpen) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (quizTopicMenuRef.current && !quizTopicMenuRef.current.contains(e.target as Node)) {
        setQuizTopicMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [quizTopicMenuOpen]);
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
  // 分页：一页固定 8 条；筛选条件变化时重置回第 1 页
  const [histPage, setHistPage] = useState(1);
  const histPageCount = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const pagedHistory = useMemo(
    () => filteredHistory.slice((histPage - 1) * PAGE_SIZE, histPage * PAGE_SIZE),
    [filteredHistory, histPage],
  );
  useEffect(() => {
    // 筛选结果变化 → 回到第 1 页；当前页超出总页数（删除/清空后）→ clamp
    setHistPage((p) => Math.min(p, Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE))));
  }, [filteredHistory.length]);
  useEffect(() => { setHistPage(1); }, [subjFilter, topicFilter]);
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
  // 错题集知识点选项（动态提取，清洗括号后缀 + 去重排序；与问答历史一致）
  const quizTopics = useMemo(
    () => [...new Set(quizHistoryData.map((e) => (e.topic || '').replace(/[（(].*?[）)]/g, '')).filter((t) => t.length > 0))].sort((a, b) => a.localeCompare(b, 'zh')),
    [quizHistoryData],
  );
  // 是否有生效的筛选（科目 × 知识点；「仅错题」是视图切换不算筛选）
  const hasQuizFilter = quizSubjFilter !== null || quizTopicFilter !== null;
  const filteredQuizHistory = useMemo(
    () => quizHistoryData.filter((e) => {
      if (quizSubjFilter && e.subject !== quizSubjFilter) return false;
      if (quizScope === 'wrong' && e.correct) return false;
      if (quizTopicFilter) {
        const t = (e.topic || '').replace(/[（(].*?[）)]/g, '');
        if (t !== quizTopicFilter) return false;
      }
      return true;
    }),
    [quizHistoryData, quizSubjFilter, quizScope, quizTopicFilter],
  );
  // 错题集分页：一页固定 8 条；筛选条件变化时重置回第 1 页
  const [quizPage, setQuizPage] = useState(1);
  const quizPageCount = Math.max(1, Math.ceil(filteredQuizHistory.length / PAGE_SIZE));
  const pagedQuizHistory = useMemo(
    () => filteredQuizHistory.slice((quizPage - 1) * PAGE_SIZE, quizPage * PAGE_SIZE),
    [filteredQuizHistory, quizPage],
  );
  useEffect(() => {
    setQuizPage((p) => Math.min(p, Math.max(1, Math.ceil(filteredQuizHistory.length / PAGE_SIZE))));
  }, [filteredQuizHistory.length]);
  useEffect(() => { setQuizPage(1); }, [quizSubjFilter, quizTopicFilter, quizScope]);
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

  // ── 错题卷导出（方案 A：配置弹窗 → 数据快照 → window.print()）──
  const [paperOpen, setPaperOpen] = useState(false);
  const [paperOpts, setPaperOpts] = useState<{
    includeAnswers: boolean;
    blankLevel: PaperBlankLevel;
    sortMode: PaperSortMode;
  }>({
    includeAnswers: false, // 默认不出答案：先让学生自己做一遍
    blankLevel: 'standard', // 默认标准 20mm 演算留白
    sortMode: 'topic', // 默认按知识点分组（薄弱点优先）
  });
  /** 打印快照：仅打印/预览期间挂载卷面；结束后清空，不常驻大块 DOM */
  const [paperData, setPaperData] = useState<{ paper: QuizPaper; generatedAt: string } | null>(null);
  /** 预览模式：先看版面再决定打印；与打印共用同一棵卷面 DOM */
  const [paperPreview, setPaperPreview] = useState(false);

  /** 溯源：把记录里的来源路径解析成实验名；解析不到就留空，绝不编造 */
  const paperSourceOf = (path: string): string => {
    const id = labIdFromPath(path);
    const lab = id ? labMap[id] : undefined;
    return lab ? (lang === 'zh' ? lab.name.zh : lab.name.en) : '';
  };

  /** 组卷：范围 = 当前筛选的全部记录（忽略每页 8 条的浏览分页）。
   *  preview=true 先进预览层；false 直接调起打印。两条动线共用同一棵卷面 DOM。 */
  const exportPaper = (preview: boolean) => {
    const paper = buildQuizPaper(filteredQuizHistory, paperOpts, paperSourceOf);
    if (paper.total === 0) return;
    setPaperOpen(false);
    setPaperPreview(preview);
    setPaperData({
      paper,
      generatedAt: new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-CA'),
    });
  };

  /** 预览层「返回修改」：回到配置弹窗，丢弃当前快照 */
  const backToPaperOptions = () => {
    setPaperPreview(false);
    setPaperData(null);
    setPaperOpen(true);
  };

  /** 关闭预览（Esc / 关闭按钮）：丢弃快照，不打印 */
  const closePaperPreview = () => {
    setPaperPreview(false);
    setPaperData(null);
  };

  // 预览层 Esc 关闭。
  // 必须用捕获阶段并阻断传播：面板自身也监听 Esc（会关掉整个面板），
  // 若在冒泡阶段处理，关预览的同时会把面板一起关掉，用户就丢了当前位置。
  useEffect(() => {
    if (!paperPreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      closePaperPreview();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [paperPreview]);

  // 打印生命周期：等字体就绪 → 解锁 body 滚动 → 调起打印 → 结束后复原并清快照。
  // 必须解锁：useLockBodyScroll 把 body.overflow 设为 hidden，不解开会裁切卷面。
  // 预览模式不触发打印；从预览点「打印」时把 paperPreview 置 false，本副作用随之重跑。
  useEffect(() => {
    if (!paperData || paperPreview) return;
    let disposed = false;
    let done = false;
    let fallback = 0;
    const prevOverflow = document.body.style.overflow;
    // 复原：滚动锁回滚 + 卸下临时卷面。三条路径（afterprint / 超时兜底 / print 抛错）共用，
    // 保证任何一条走到就只复原一次，body.overflow 与临时 DOM 都稳定回到原状。
    const finish = () => {
      if (disposed || done) return;
      done = true;
      if (fallback) window.clearTimeout(fallback);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('afterprint', finish);
      setPaperData(null);
    };
    const start = async () => {
      // KaTeX 字体未就绪就打印会掉字或错位，先等字体加载完（旧环境无该 API 则直接继续）
      try {
        await document.fonts?.ready;
      } catch {
        /* 忽略：字体 API 不可用不应阻断打印 */
      }
      if (disposed) return;
      document.body.style.overflow = '';
      window.addEventListener('afterprint', finish);
      // 兜底：部分浏览器/取消路径不派发 afterprint，1.5s 后强制复原，
      // 否则滚动锁会丢（面板打开时背景仍可滚动）且卷面常驻 DOM。
      // print() 在主流浏览器会阻塞主线程，故该计时实际从对话框关闭后才开始走。
      fallback = window.setTimeout(finish, 1500);
      try {
        window.print();
      } catch {
        // 打印被安全策略拦截等异常：立即复原，不把界面留在打印态
        finish();
      }
    };
    void start();
    return () => {
      disposed = true;
      if (fallback) window.clearTimeout(fallback);
      window.removeEventListener('afterprint', finish);
    };
  }, [paperData, paperPreview]);
  // 清空错题二次确认
  const [confirmClearQuiz, setConfirmClearQuiz] = useState(false);
  const clearQuizHistoryAll = () => {
    if (!confirmClearQuiz) { setConfirmClearQuiz(true); return; }
    clearQuizHistory();
    setQuizHistoryData([]);
    setQuizExpandedId(null);
    setQuizTopicFilter(null);
    setQuizTopicMenuOpen(false);
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
  // 学情概览：默认折叠（只显示一行摘要），点击展开完整详情——避免挤占筛选区
  const [quizOverviewOpen, setQuizOverviewOpen] = useState(false);
  const quizSummaryAbortRef = useRef<AbortController | null>(null);
  // 当前筛选范围的中文/英文标签（用于 AI 告知范围）
  const quizSummaryScopeLabel = useMemo(() => {
    const parts: string[] = [];
    if (quizSubjFilter) parts.push(quizSubjFilter);
    if (quizTopicFilter) parts.push(quizTopicFilter);
    parts.push(quizScope === 'wrong' ? (lang === 'zh' ? '错题' : 'wrong answers') : (lang === 'zh' ? '全部记录' : 'all records'));
    return parts.join(' · ');
  }, [quizSubjFilter, quizTopicFilter, quizScope, lang]);
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
      { role: 'user', content: lang === 'zh' ? '请仅依据上面给出的作答记录生成学习诊断，不要虚构记录里没有的内容。' : 'Please generate a learning diagnosis using ONLY the answer records above; do not invent anything not in the records.' },
    ];
    try {
      const t0 = performance.now();
      const baseTokens = usage?.tokens ?? 0;
      const promptTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
      let received = 0;
      const res = await streamChat(
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
        CHAIN_MAX_TOKENS.summary, // 诊断 250 字以内，但要给思考型模型留出思考余量（1200 会被思考吃光）
      );
      const full = res.text;
      // 空正文按失败处理：空白诊断会被当成「没有问题」而不是「这次没生成出来」
      if (classifyStreamOutcome(res) === 'empty') throw new EmptyAnswerError(res.finishReason);
      // 跨会话累计 token（归纳请求 = prompt + 实际输出）
      addTokenUsage(config?.model, promptTokens + estimateTokens(full));
      refreshTokenUsage();
      // 没写完必须标注：半句诊断看起来像结论，其实不完整（上限截断或连接被切断）
      setQuizSummaryText(classifyStreamOutcome(res) === 'ok' ? full : `${full}\n\n${t.aiError.truncatedNote}`);
    } catch (e) {
      if (quizSummaryAbortRef.current && quizSummaryAbortRef.current.signal.aborted) return;
      const classified = classifyChatFailure(e, { offline: isOffline });
      if (classified.raw) logPromptIssue('quiz-summary-error', classified.raw);
      setQuizSummaryError(t.aiError[classified.kind]);
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

  const navigate = useNavigate();
  // 使用须知条款折叠（默认全部展开，标题点击收起/展开，避免长条款挤占滚动空间）
  const [collapsedTerms, setCollapsedTerms] = useState<boolean[]>([false, false, false, false]);
  const toggleTerm = (i: number) => setCollapsedTerms((c) => c.map((v, idx) => (idx === i ? !v : v)));
  // 由 AI 推荐驱动的追问：当前回答 / 推荐追问列表 / 待发问题 / 上一轮问答（内存）
  const [answer, setAnswer] = useState('');
  // AI 思考草稿（部分模型才有）：本回合显示、不落盘；思考中自动展开，正文一开始自动折叠
  const [reasoning, setReasoning] = useState('');
  // 折叠状态：'live' = 当前轮，'h<i>' = 第 i 条历史（同一时刻只展开一个）
  const [openReasoningId, setOpenReasoningId] = useState<string | null>(null);
  // 本回合的思考草稿按问答对暂存在内存（不落盘）：回答入历史后当前轮会被清空，
  // 没有这份映射，思考过程就只能在流式那几秒里看到
  const [reasoningByTurn, setReasoningByTurn] = useState<Record<string, { text: string; sec: number }>>({});
  /**
   * 思考是否仍在推进（只对当前轮有意义）。
   * 不能拿 busy 代替：busy 覆盖「正文流式」整段，那时思考早结束了，灯泡会一直闪。
   * 故只在思考增量到达时置 true，正文首包 / 请求收尾时置 false。
   */
  const [reasoningStreaming, setReasoningStreaming] = useState(false);
  /** 思考草稿折叠区：默认折叠，标题写明它可能直接写出结论（与「探究型不给结论」的口径并存） */
  const renderReasoning = (text: string, sec: number, id: string) => {
    const open = openReasoningId === id;
    // 只有「当前轮 + 思考仍在推进」才呼吸；历史轮次永远是已完成的静态灯泡
    const thinking = id === 'live' && reasoningStreaming;
    /**
     * 秒数是否已定稿。sec 只在「首个正文 token 到达」时写入（且 ≥1），
     * 故 sec === 0 就代表「还在想 / 被中止在思考阶段」——此时任何秒数都是编的。
     */
    const settled = sec > 0;
    return (
      <div className="inline-block max-w-[95%] mb-1 rounded-md border border-[var(--border)]/60 bg-[var(--accent-light)]/40">
        <button
          type="button"
          onClick={() => setOpenReasoningId(open ? null : id)}
          className="tap-area w-full text-left inline-flex items-center gap-1 px-2.5 py-1.5 text-[0.625rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
        >
          {/* 呼吸灯：正在想＝琥珀黄 + 1.8s 呼吸；想完＝中性灰常亮静置。
              黄色走 --warn 令牌（浅色 #b45309 / 深色 #fbbf24），两套主题各自一档、不写死色值；
              呼吸用 index.css 的 .bulb-breathe（1→0.72，reduced-motion 下自动停），
              比 animate-pulse 的 1→0.5 更保色——后者在浅色主题下会把琥珀洗成浅金。
              两个分支写成互斥整串（而非叠加两个 text-* 类）：同权重任意值类谁生效取决于 CSS 顺序，
              不是 class 书写顺序。 */}
          <Lightbulb
            className={
              thinking
                ? 'h-3.5 w-3.5 shrink-0 text-[var(--warn)] bulb-breathe'
                : 'h-3.5 w-3.5 shrink-0 text-[var(--muted)]'
            }
            aria-hidden="true"
          />
          <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          {lang === 'zh'
            ? (settled
              /* 首包已到：秒数定稿，口径写「首字约」——它测的是「请求发出→首个正文字符」，
                 含网络与排队，不是纯思考时长，写「思考用时」属于夸大口径。 */
              ? `思考过程（首字约 ${sec}s · ${text.length} 字）：AI 的草稿，可能直接写出结论，也可能想错`
              /* 还在想：**绝不显示 0s**。此阶段秒数尚未定稿，写「约 0s」是在说谎，
                 而且与同一行正在增长的字数自相矛盾。改为语义化提示，进展感交给文字本身。 */
              : `思考过程（正在思考 · ${text.length} 字）：AI 的草稿，可能直接写出结论，也可能想错`)
            : (settled
              ? `Thinking (first token in ≈${sec}s · ${text.length} chars): AI draft — it may state the answer outright, or be wrong`
              : `Thinking (in progress · ${text.length} chars): AI draft — it may state the answer outright, or be wrong`)}
        </button>
        {open && (
          <div className="px-2.5 pb-2 pt-1 text-[0.6875rem] leading-relaxed whitespace-pre-wrap text-[var(--muted)] border-t border-[var(--border)]">
            {text}
          </div>
        )}
      </div>
    );
  };
  const [reasoningSec, setReasoningSec] = useState(0);
  const [recs, setRecs] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<FailureState | null>(null);
  // 本轮请求快照：重试必须「重放同一份 messages」，而不是按当前页面重新拼装
  // （否则学生失败后拖了滑块，重试会悄悄换成另一个问题）
  const attemptRef = useRef<{ q: string; followUp: boolean; messages: { role: 'system' | 'user' | 'assistant'; content: string }[] } | null>(null);
  // 同一轮连续失败次数（≥3 追加「检查网络」提示）
  const attemptsRef = useRef(0);
  // 429 倒计时（秒）：>0 时「重试」进入禁用态，倒计时结束仍需学生手动点
  const [retryCountdown, setRetryCountdown] = useState(0);
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
  // 同页内多轮问答历史（内存态，上限 20 条；关闭面板/切换页面时清空——对齐页面锚定设计；持久化历史独立保留在 localStorage）
  const [history, setHistory] = useState<{ user: string; assistant: string }[]>([]);
  const HISTORY_MAX = 20;
  /*
   * 历史刻度轨（minimap notches）：轮次 ≥2 之后，对话流里只留「正在看的那一轮」，
   * 其余收折成面板顶部的一条条短横 —— 二十问二十答的长文本全铺在流里，最新那条要翻
   * 五屏才看得见。三个状态各管一件事：
   *  · focusTurn   手动定位到第几轮（null = 跟随最新；新问题一来就回到 null）
   *  · peekTurn    Hover/聚焦哪条短横（决定气泡里的问题摘要）
   *  · historyExpanded  「展开历史」开关：习惯纵向通读的学生一键把全部轮次摊回流里
   */
  const [focusTurn, setFocusTurn] = useState<number | null>(null);
  const [peekTurn, setPeekTurn] = useState<number | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  // 刻度轨点击后要滚到的那一轮（收折态下它刚展开，下一帧才量得到位置）
  const turnRefs = useRef<(HTMLDivElement | null)[]>([]);
  // 点刻度那一次平滑滚动的收尾定时器（滚完要把 scroll-behavior 摘回 auto）
  const jumpScrollTimer = useRef<number | null>(null);
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
    setFailure(null);
    setRetryCountdown(0);
    attemptsRef.current = 0;
    attemptRef.current = null; // 切页/关面板后旧快照作废：不允许重试上一页的问题
    setUsage(null);
    setBusy(false);
    setHistory([]);
    // 刻度轨状态跟着会话一起归零：新页面只剩空对话，没有「第 3 轮」可定位
    setFocusTurn(null);
    setPeekTurn(null);
    setHistoryExpanded(false);
    turnRefs.current = [];
    lastExchange.current = null;
    resetQuiz(); // 清 quiz 状态与统计（P1）
    // 切页/关面板时若停留在 quiz 视图，回到对话（新页面知识点不同，避免空 quiz 卡住）
    setView((v) => (v === 'quiz' ? 'chat' : v));
  };
  /*
   * 清除全部 AI 数据 = 清对话 + 清刷题 + 清设置。三个域各自只清自己，
   * 跨域编排放在主组件：Hook 之间因此互不依赖，view 状态机也仍只有一处。
   */
  const clearAll = () => {
    resetConversation();
    quizSession.resetQuiz();
    clearSettings();
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
  // 吸底状态：ref 供滚动副作用即时读取（避免闭包过期），state 只负责「↓」按钮显隐
  const stickRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const syncStick = (next: boolean) => {
    if (stickRef.current === next) return;
    stickRef.current = next;
    setShowJump(!next);
  };
  // 流式光标相位：流式中显示；结束后留 220ms 让 200ms 淡出跑完再卸载
  const [caretPhase, setCaretPhase] = useState<'off' | 'on' | 'fading'>('off');
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

  // 面板高度（右下角斜拉调整；0 = 内容自适应；localStorage 记忆 UI 偏好；200–960px）
  const [height, setHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const raw = window.localStorage.getItem('stem-ai-height');
      const h = raw ? parseInt(raw, 10) : 0;
      // 0 = 没有记忆：不设显式上限，交给外层视口上限兜底（旧写法把 0 夹成 200，会裁掉页脚）
      if (!Number.isFinite(h) || h <= 0) return 0;
      // 记忆值同样是 200–960（与 maxPanelHeight 对齐，否则拖到 960 下次加载会被截回 720）
      return Math.min(960, Math.max(200, h));
    } catch {
      return 0;
    }
  });
  // 最小化（收起为胶囊）：UI 偏好，localStorage 记忆；移动端不启用
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return window.localStorage.getItem('stem-ai-collapsed') === '1'; } catch { return false; }
  });
  const setCollapsedPersisted = (v: boolean) => {
    setCollapsed(v);
    try { window.localStorage.setItem('stem-ai-collapsed', v ? '1' : '0'); } catch { /* 静默 */ }
  };
  // 收起 / 展开各自记一次「要对齐的右边缘与顶边」（胶囊与面板宽度差很多，任其贴左边会感觉乱跳）
  const edgeAnchorRef = useRef<{ right: number; top: number } | null>(null);
  const expandFromCapsule = () => {
    const r = panelRef.current?.getBoundingClientRect();
    if (r) edgeAnchorRef.current = { right: r.right, top: r.top };
    setCollapsedPersisted(false);
  };
  // 拖拽是否真的移动过（胶囊上「点击还原」与「拖动」靠它区分）
  const dragMovedRef = useRef(false);
  const heightRef = useRef(0);
  useEffect(() => { heightRef.current = height; }, [height]);
  // ── 拖拽 / 缩放：拖拽期间只写 DOM（不触发 React 重渲染、不逐帧回流），松手时单次结算 ──
  // 三个把手共用一份拖拽状态；pointermove 只更新「最近一次指针坐标」，真正的样式写入放在 rAF 帧里，
  // 因此一帧内无论收到多少 pointermove 都只写一次样式，也不会触发任何 setState。
  const dragStateRef = useRef<{
    kind: 'title' | 'width' | 'corner';
    startX: number; startY: number;
    startW: number; startH: number;
    baseLeft: number; baseTop: number;
    curW: number; curH: number;
    lastX: number; lastY: number;
    rafId: number | null;
  } | null>(null);
  const posRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => { posRef.current = pos; }, [pos]);
  useEffect(() => () => { const st = dragStateRef.current; if (st && st.rafId !== null) window.cancelAnimationFrame(st.rafId); }, []);

  // 拖拽期间禁用文本选区（鼠标快速滑动时指针会滑出把手，页面正文会被误选）
  // 两个 resize 把手上锁；pointerup / pointercancel / lostpointercapture 三重恢复，避免整页文字一直不可选
  const setDragSelectionLock = (on: boolean) => {
    try { document.body.style.userSelect = on ? 'none' : ''; } catch { /* 静默 */ }
  };
  const releaseDragSelectionLock = () => setDragSelectionLock(false);

  /** 位置夹取：至少 60px 留在视口内（外接屏拔除、窗口缩小后不会把面板丢到屏幕外） */
  const clampPos = (x: number, y: number) => ({
    x: Math.max(8, Math.min(x, Math.max(8, window.innerWidth - 60))),
    y: Math.max(8, Math.min(y, Math.max(8, window.innerHeight - 60))),
  });
  /** 尺寸上限：既服从用户记忆值，也不超过视口（否则面板底部会沉到屏幕外） */
  // 上限交给视口（原 720 硬顶在 1080p 上白白少给 288px）；留 960 只作超大屏的阅读行数约束
  const maxPanelHeight = (want: number) => Math.max(200, Math.min(960, want, window.innerHeight - 72));
  const maxPanelWidth = (want: number) => Math.max(280, Math.min(720, want, window.innerWidth - 16));

  /** 纯 DOM 写入：拖拽期间唯一改样式的地方（不碰 React state） */
  const applyDragStyles = () => {
    const st = dragStateRef.current;
    const el = panelRef.current;
    if (!st || !el) return;
    const dx = st.lastX - st.startX;
    const dy = st.lastY - st.startY;

    if (st.kind === 'title') {
      // 位移用 transform：只合成、不回流
      const target = clampPos(st.baseLeft + dx, st.baseTop + dy);
      el.style.transform = 'translate3d(' + Math.round(target.x - st.baseLeft) + 'px, ' + Math.round(target.y - st.baseTop) + 'px, 0)';
      return;
    }

    st.curW = maxPanelWidth(st.startW + dx);
    el.style.width = st.curW + 'px';
    if (st.kind === 'corner') {
      st.curH = maxPanelHeight(st.startH + dy);
      el.style.maxHeight = st.curH + 'px';
    }
  };

  /** 帧节流：一帧只写一次；多次 pointermove 自动合并（不堆积） */
  const scheduleDragStyles = () => {
    const st = dragStateRef.current;
    if (!st || st.rafId !== null) return;
    st.rafId = window.requestAnimationFrame(() => {
      const cur = dragStateRef.current;
      if (!cur) return;
      cur.rafId = null;
      applyDragStyles();
    });
  };

  const beginDrag = (kind: 'title' | 'width' | 'corner', e: React.PointerEvent) => {
    if (isMobile) return; // 移动端是底部抽屉，位置/尺寸都由 CSS 决定，不接受拖拽
    // 标题栏里还有设置/历史/关闭按钮：从按钮上按下时既不拖窗口、也不设置指针捕获——
    // 捕获一旦落在标题栏上，按钮的 click 会被吞掉（表现为「点了没反应」）
    if (kind === 'title') {
      const from = e.target as Element | null;
      if (from && from !== e.currentTarget) {
        const hit = from.closest('button, a, input, select, textarea, [role="button"]');
        // 只有「命中的按钮不是拖拽面本身」才让位：标题栏里的三个按钮会被命中 → 不拖；
        // 胶囊按钮本体就是拖拽面（其内部的图标/文字也在它里面）→ 照常拖
        if (hit && hit !== e.currentTarget) return;
      }
    }
    const el = panelRef.current;
    const rect = el?.getBoundingClientRect();
    if (!el || !rect) return;
    e.preventDefault();
    setDragSelectionLock(true);
    dragMovedRef.current = false;
    dragStateRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.width,
      startH: heightRef.current > 0 ? heightRef.current : rect.height,
      baseLeft: rect.left,
      baseTop: rect.top,
      curW: rect.width,
      curH: rect.height,
      lastX: e.clientX,
      lastY: e.clientY,
      rafId: null,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: React.PointerEvent) => {
    const st = dragStateRef.current;
    if (!st) return;
    st.lastX = e.clientX;
    st.lastY = e.clientY;
    if (Math.abs(e.clientX - st.startX) + Math.abs(e.clientY - st.startY) > 4) dragMovedRef.current = true;
    scheduleDragStyles();
  };

  /** 松手结算：只在这一刻写 React state 与 localStorage（整个拖拽过程中零 setState） */
  const endDrag = () => {
    releaseDragSelectionLock();
    const st = dragStateRef.current;
    const el = panelRef.current;
    dragStateRef.current = null;
    if (!st || !el) return;
    if (st.rafId !== null) { window.cancelAnimationFrame(st.rafId); st.rafId = null; }

    if (st.kind === 'title') {
      const target = clampPos(st.baseLeft + (st.lastX - st.startX), st.baseTop + (st.lastY - st.startY));
      // 先落到 left/top 再清 transform：视觉上连续，避免 React 重渲染前闪一下旧位置
      el.style.left = target.x + 'px';
      el.style.top = target.y + 'px';
      el.style.right = 'auto';
      el.style.transform = '';
      setPos(target);
      try { window.localStorage.setItem('stem-ai-pos', JSON.stringify(target)); } catch { /* 静默 */ }
      return;
    }

    // 宽度/高度：把最终值固化到内联样式（与即将写入的 state 一致，避免交回 React 时跳一下）
    el.style.width = st.curW + 'px';
    if (st.kind === 'corner') { el.style.maxHeight = st.curH + 'px'; }
    setWidth(st.curW);
    if (st.kind === 'corner') setHeight(st.curH);

    // 变大后右边缘可能越界：只在用户已有自定义位置时同步左移，默认右对齐无需处理
    const prev = posRef.current;
    if (prev) {
      const maxX = window.innerWidth - st.curW - 8;
      const nx = Math.max(8, Math.min(prev.x, Math.max(8, maxX)));
      if (nx !== prev.x) {
        el.style.left = nx + 'px';
        el.style.top = prev.y + 'px';
        el.style.right = 'auto';
        setPos({ x: nx, y: prev.y });
        try { window.localStorage.setItem('stem-ai-pos', JSON.stringify({ x: nx, y: prev.y })); } catch { /* 静默 */ }
      }
    }
    try {
      window.localStorage.setItem('stem-ai-width', String(st.curW));
      if (st.kind === 'corner') window.localStorage.setItem('stem-ai-height', String(st.curH));
    } catch { /* 静默 */ }
  };

  /** 捕获丢失/取消：拖拽中要结算，否则只解锁选区（避免整页文字一直不可选） */
  const endDragOrUnlock = () => {
    if (dragStateRef.current) endDrag();
    else releaseDragSelectionLock();
  };

  // 拖拽中若有其它原因触发重渲染（例如回答流式更新），React 会按旧 state 覆写内联样式；
  // 每次渲染后把拖拽中的样式再写一遍，保证拖拽视觉不被撤回。
  useEffect(() => { if (dragStateRef.current) applyDragStyles(); });

  // 打开时：已配置 → 对话视图；未配置 → 须知视图（两步流程第一步）
  // 例外：openQuiz / 顶栏「去设置」打开的面板已在各自 effect 设过 view，不覆盖
  useEffect(() => {
    if (open) {
      if (quizOpenedRef.current || settingsOpenedRef.current) {
        quizOpenedRef.current = false;
        settingsOpenedRef.current = false;
        return;
      }
      setView(config ? 'chat' : 'terms');
      // 面板首开即静默验证：configured（待验证）对用户是个死胡同——除了进设置页没有别的出路。
      // 用户打开面板就是想用了，此刻查一次成本最低；auto 模式只在结论缺失/过期时动手，
      // 已就绪且未过期不发任何请求（0 轮询纪律不变）。
      if (config) void verifyAiStatus(config, { auto: true });
    }
  }, [open, config]);

  // 页面「问 AI」触发：携带预填问题
  useEffect(() => {
    if (ask) {
      setPending(ask);
      setAsk('');
    }
  }, [ask, setAsk]);

  // pending 就绪后自动发送（已配置时）
  useEffect(() => {
    if (!pending) return;
    if (config) {
      void sendQuestion(pending, false);
      setPending(null);
    } else if (!open) {
      setOpen(true); // 未配置就把面板打开去配；问题保留，保存后自动发出
    }
  }, [pending, config, open, setOpen]);

  // 回答区自动滚底：只在「贴着底部」时跟随；用 auto 而不是 smooth ——
  // 流式每个 delta 都会滚一次，smooth 动画会被不断打断重启，反而更抖。
  useEffect(() => {
    const el = answerRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [answer, history, caretPhase]);

  // 流式光标相位：流式中显示，结束后留 220ms 让淡出跑完
  useEffect(() => {
    if (busy && answer) {
      setCaretPhase('on');
      return;
    }
    if (!answer) {
      setCaretPhase('off');
      return;
    }
    setCaretPhase('fading');
    const t = window.setTimeout(() => setCaretPhase('off'), 220);
    return () => window.clearTimeout(t);
  }, [busy, answer]);

  // 用户主动上滑（滚轮 / 触屏 / 键盘）立刻解锁吸底：必须抢在下一批 delta 之前，
  // 否则程序化滚底会把这一下手势吃掉——表现就是「怎么划都被拽回底部」。
  useEffect(() => {
    const el = answerRef.current;
    if (!el) return;
    let touchTop = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) syncStick(false);
    };
    const onTouchStart = () => {
      touchTop = el.scrollTop;
    };
    const onTouchMove = () => {
      if (el.scrollTop < touchTop - 2) syncStick(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'PageUp' || e.key === 'ArrowUp' || e.key === 'Home') syncStick(false);
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('keydown', onKey);
    };
  }, [open, view]);

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

  // 复制历史回答：成功显示「已复制」+ 对勾图标，失败显示「复制失败」；2 秒后恢复
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

  /** 系统提示词：带当前主题与实验阶段（阶段由实验页写入易失注册表，见 ai-dynamic-questions.ts） */
  const systemPromptForPage = () => {
    const labId = labIdFromPath(location.pathname);
    const lab = labId ? labMap[labId] : undefined;
    // 静态页面知识与实时读数**分开注入**：两者权威级不同，混在一个 <页面资料> 里会让
    // 模型把学生眼前的真实读数当「可选背景」，转而自己按公式算一个。
    const liveState = [aiCtx.live, formatLabState(labId, getLabState(labId), lang)]
      .filter(Boolean)
      .join('\n');
    return buildSystemPrompt(
      lang,
      aiCtx.topic ?? pageSubject(location.pathname, lang),
      aiCtx.knowledge,
      stageLabel(getLabState(labId)?.stage, lang),
      // 实验页用注册表里的学科判定（显示名里没有「物理」二字）；非实验页留给主题串回退
      lab ? lab.subjectId === 'physics' : undefined,
      liveState,
      // 页面人设（探究页的苏格拉底导师）：只改讲法，禁令仍以系统提示词第三节为准
      aiCtx.persona,
    );
  };

  // 发送单轮问题（followUp=true 时携带上一轮问答作为上下文）
  // pinned = 重试时重放的快照：直接用当时那份 messages，不重新拼装
  // （学生失败后若又拖了滑块，重新拼装会悄悄换成另一个问题）
  const sendQuestion = async (
    text: string,
    followUp = false,
    pinned?: { role: 'system' | 'user' | 'assistant'; content: string }[],
  ) => {
    expandFromCapsule(); // 有提问就把胶囊展开，否则学生看不到回答
    const q = text.trim();
    if (!q || busy) return;
    if (!config) {
      setOpen(true);
      flashToast(false, lang === 'zh' ? '请先在 AI 设置里保存配置' : 'Save your AI settings first');
      return;
    }
    setCurrentQuestion(q); // 立即更新问题行（推荐追问也即时生效，不等回答完成）
    // 新问题即最新一轮：刻度轨回到「跟随最新」，旧轮的 Hover 预览一并收起
    setFocusTurn(null);
    setPeekTurn(null);
    setAnswer('');
    setReasoning('');
    setReasoningStreaming(false);
    setOpenReasoningId('live');
    setReasoningSec(0);
    setRecs([]);
    setFailure(null);
    setRetryCountdown(0);
    if (!pinned) attemptsRef.current = 0; // 新问题重新计数；重试沿用本轮计数
    setBusy(true);
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = pinned
      ? pinned.map((m) => ({ ...m }))
      : [{ role: 'system', content: systemPromptForPage() }];
    if (!pinned && followUp && lastExchange.current) {
      messages.push({ role: 'user', content: lastExchange.current.user });
      // 中断过的回答在本地带 [已停止]/[stopped] 标记：发给模型前必须剥掉，
      // 否则人造标记会被当成正文回灌进上下文
      messages.push({ role: 'assistant', content: stripStoppedMark(lastExchange.current.assistant) });
    }
    if (!pinned) {
      messages.push({
        role: 'user',
        content: lang === 'zh' ? `<学生提问>${q}</学生提问>` : `<student_question>${q}</student_question>`,
      });
    }
    attemptRef.current = { q, followUp, messages: messages.map((m) => ({ ...m })) };
    abortRef.current = new AbortController();
    const t0 = performance.now();
    // 用量实时统计：会话基准（本轮之前的累计）固定，prompt 一次计入，输出随流式滚动增长
    const baseTokens = usage?.tokens ?? 0;
    const promptTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    let received = 0;
    let accLen = 0;   // 已收正文 + 思考的字符总数（增量累计，替代每 chunk 重扫全文）
    let accCjk = 0;   // 其中的 CJK / 全角字符数
    let accText = ''; // 已收正文（不含思考段）：中断时用它保全局部回答
    let firstContentAt = 0; // 首个正文 token 的时刻（用来算「思考了几秒」并自动折叠）
    let reasoningText = '';   // 本轮思考全文（闭包内累积，结束后挂到本轮问答对上）
    let reasoningSecLocal = 0;
    let reasoningStarted = false; // 呼吸灯只需置位一次：每个思考增量都 setState 是纯浪费
    try {
      const res = await streamChat(
        config,
        messages,
        (delta) => {
          if (!firstContentAt) {
            firstContentAt = performance.now();
            reasoningSecLocal = Math.max(1, Math.round((firstContentAt - t0) / 1000));
            setReasoningSec(reasoningSecLocal);
            setOpenReasoningId(null); // 正文开始 → 思考区自动折叠（默认不看）
            setReasoningStreaming(false); // 思考到此结束：灯泡停止呼吸（此后是正文在流）
          }
          setAnswer((a) => a + delta);
          accText += delta;
          received += delta.length;
          accLen += delta.length;
          accCjk += countCjk(delta);
          const elapsedSec = Math.max(0.1, (performance.now() - t0) / 1000);
          // 增量计数与 estimateTokens(全文) 完全等价，但每 chunk 只扫新增片段（旧实现 O(n²)）
          const outTokens = Math.round(accCjk + (accLen - accCjk) / 4);
          setUsage({
            tokens: baseTokens + promptTokens + outTokens,
            speed: Math.round(outTokens / elapsedSec),
          });
        },
        abortRef.current.signal,
        CHAIN_MAX_TOKENS.chat, // 默认不下发上限：思考型模型的思考算在 max_tokens 里，封顶会让正文一个字符都不出
        (r) => {
          // 思考增量：也算学生付费的输出，计入本轮用量（想得多=花得多，学生看得见）
          received += r.length;
          accLen += r.length;
          accCjk += countCjk(r);
          reasoningText += r;
          if (!reasoningStarted) {
            reasoningStarted = true;
            setReasoningStreaming(true); // 首个思考增量 → 灯泡开始呼吸
          }
          setReasoning((x) => x + r);
        },
      );
      const full = res.text;
      // 收尾判定与面板共用同一口径：empty=正文一个字都没有（当失败重试）；
      // limit/cut=正文有但没写完（留下并标注，给「继续生成」）；ok=正常收完
      const outcome = classifyStreamOutcome(res);
      // 正文为空一律按失败处理（无论端点是 length 还是 stop）：
      // 空回答绝不能当成功写进历史 / localStorage，否则学生只看到一个空白框、连重试都没有。
      if (outcome === 'empty') throw new EmptyAnswerError(res.finishReason);
      // 跨会话累计 token（本次请求 = prompt + 实际输出 + 思考增量：想得多花得多，口径与本轮显示一致）
      addTokenUsage(config?.model, promptTokens + Math.round(accCjk + (accLen - accCjk) / 4));
      refreshTokenUsage();
      const { body: rawBody, recs: parsedRecs } = parseRecQuestions(full);
      // 没写完的正文必须标注，并把「继续生成」入口交给学生（半句话看着像结论才是真问题）
      const body = outcome === 'ok' ? rawBody : markTruncated(rawBody, lang, outcome === 'cut' ? 'cut' : 'limit');
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
      // 思考草稿只留内存（本回合问答对为键；最多 20 轮、每轮截 4000 字），供历史气泡回看，不落盘
      if (reasoningText) {
        const key = turnKey(q, body);
        setReasoningByTurn((m) => {
          const next: Record<string, { text: string; sec: number }> = {
            ...m,
            [key]: { text: reasoningText.slice(0, 4000), sec: reasoningSecLocal },
          };
          const keys = Object.keys(next);
          for (const k of keys.slice(0, Math.max(0, keys.length - 20))) delete next[k];
          return next;
        });
      }
      // 回答已入历史，清空当前轮（避免同一内容在历史区和当前轮重复显示）
      setAnswer('');
      // 最终定格（与实时滚动值对齐，避免浮点误差；含思考增量，避免完成瞬间数字回落）
      const elapsedSec = Math.max(0.1, (performance.now() - t0) / 1000);
      const outTokens = Math.round(accCjk + (accLen - accCjk) / 4);
      setUsage({
        tokens: baseTokens + promptTokens + outTokens,
        speed: Math.round(outTokens / elapsedSec),
      });
    } catch (e) {
      // 中断也要保住成果：无论是点了「停止」还是网络断掉，只要已经收到正文，就把它
      // 当作一次「未完成」的问答留下来（标 [已停止]）——否则学生刚看到一半的内容
      // 会随面板关闭一起消失，追问也接不上。
      const kept = markStopped(accText, lang);
      if (kept) {
        lastExchange.current = { user: q, assistant: kept };
        setHistory((h) => [...h.slice(-(HISTORY_MAX - 1)), { user: q, assistant: kept }]);
        saveHistory({
          path: location.pathname + location.search,
          subject: pageSubject(location.pathname, lang),
          topic: aiCtx.topic ?? pageSubject(location.pathname, lang),
          question: q,
          answer: kept,
          model: config.model,
        });
        setPersistHistory(listHistory());
        setAnswer(''); // 已入历史：清空当前轮，避免同一内容在历史区与当前轮显示两遍
      }
      // 使用 signal.aborted 判断（比字符串匹配可靠，兼容不同浏览器错误消息）
      if (abortRef.current && !abortRef.current.signal.aborted) {
        // 分类归一：文案、是否给「重试」、429 是否先倒计时，全部由 kind 决定
        const classified = classifyChatFailure(e, { offline: isOffline });
        attemptsRef.current += 1;
        setFailure({ ...classified, attempts: attemptsRef.current });
      }
    }
    setReasoningStreaming(false); // 收尾兜底：失败/中止/正常结束一律停止呼吸
    setBusy(false);
  };

  /**
   * 重试上一轮：重放当时的 messages 快照（原地覆盖，不追加新轮次）。
   *
   * 失败轮从来不入 history / lastExchange，所以「原地覆盖」是天然的：
   * 清掉失败态、用同一份请求重发即可 —— 不会在历史里留下重复问答。
   */
  const retryLastAttempt = () => {
    const a = attemptRef.current;
    if (!a || busy) return;
    void sendQuestion(a.q, a.followUp, a.messages);
  };

  // 离线：联网恢复后自动重试一次（仅一次 —— 自动路径绝不无限重发，免得白烧 token）
  useEffect(() => {
    if (!failure || failure.kind !== 'offline') return;
    const onOnline = () => retryLastAttempt();
    window.addEventListener('online', onOnline, { once: true });
    return () => window.removeEventListener('online', onOnline);
  }, [failure]);

  // 429：按 Retry-After（缺省 5s）倒计时；倒计时结束仍需学生手动点，不自动发
  useEffect(() => {
    if (!failure || failure.kind !== 'rate_limit') {
      setRetryCountdown(0);
      return;
    }
    setRetryCountdown(failure.retryAfterSec && failure.retryAfterSec > 0 ? failure.retryAfterSec : 5);
    const timer = window.setInterval(() => {
      setRetryCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [failure]);

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
      { role: 'system', content: systemPromptForPage() },
    ];
    // 携带上一轮问答作为「刚才讨论的主题」上下文（与追问同模式，避免换一批飘回页面主题）
    if (lastExchange.current) {
      messages.push({ role: 'user', content: lastExchange.current.user });
      messages.push({ role: 'assistant', content: lastExchange.current.assistant });
    }
    messages.push({ role: 'user', content: lang === 'zh' ? '请仅针对刚才讨论的主题，换一批给出 3 个不同的学生视角独立追问（每行一个，编号 1. 2. 3.，不要解释；必须写明具体物理量、化学式或术语，严禁用「它」「这个」等指代，也不是确认类反问）' : 'Based only on the topic just discussed, give 3 new self-contained follow-up questions from a student\'s perspective (one per line, numbered 1. 2. 3., no explanation; name the specific quantity, formula or substance — no pronouns like "it" or "this", and no confirmation questions).' });
    try {
      const t0 = performance.now();
      const res = await streamChat(config, messages, () => {}, undefined, CHAIN_MAX_TOKENS.chat);
      const full = res.text;
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
      // 跨会话累计 token（换一批也是消耗 token 的请求）
      addTokenUsage(config?.model, promptTokens + outTokens);
      refreshTokenUsage();
    } catch {
      // 静默失败，保留现有追问
    }
    setRefreshingRecs(false);
  };

  /** 收起为胶囊：先记下当前面板右边缘，收起后由下方 effect 把胶囊右边缘对齐过去 */
  const collapseToCapsule = () => {
    const r = panelRef.current?.getBoundingClientRect();
    if (r) edgeAnchorRef.current = { right: r.right, top: r.top };
    setCollapsedPersisted(true);
  };

  /** 收起面板（关闭按钮与 Esc 共用同一套动作） */
  const closePanel = () => {
    resetConversation();
    setOpen(false);
    setPending(null);
  };

  // Esc：子视图先回对话，对话视图直接收起面板（与关闭按钮同语义）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (collapsed) { expandFromCapsule(); return; }
      if (view !== 'chat') { setView('chat'); return; }
      resetConversation();
      setOpen(false);
      setPending(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, view, collapsed]);

  // 收起 / 展开后对齐同一条右边缘：新版宽度只有渲染后才知道，所以放在渲染后的 effect 里量一次
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) return; // 移动端不启用胶囊
    const anchor = edgeAnchorRef.current;
    const el = panelRef.current;
    if (!anchor || !el) return;
    edgeAnchorRef.current = null;
    const w = el.getBoundingClientRect().width;
    const x = Math.max(8, Math.min(anchor.right - w, Math.max(8, window.innerWidth - w - 8)));
    const y = Math.max(8, Math.min(anchor.top, window.innerHeight - 60));
    setPos({ x, y });
    try { window.localStorage.setItem('stem-ai-pos', JSON.stringify({ x, y })); } catch { /* 静默 */ }
  }, [collapsed]);

  // ── 外置面板的域对象（P0 拆分）─────────────────────────────
  // state：按值 memo —— 身份只在面板真正读到的值变化时才变；
  // actions：useStable —— 身份恒定但闭包每次渲染刷新（否则 memo 每轮都被新对象击穿）。

  /*
   * 刷题域 Hook：组卷 / 判分 / 解析 / 统计内聚在 useQuizSession。
   * 作答记录写回历史域（setQuizHistoryData）与用量统计由主组件注入。
   */
  const quizSession = useQuizSession({
    config,
    busy,
    lang,
    t,
    isOffline,
    location,
    aiCtx,
    quizSignal,
    usage,
    setUsage,
    refreshTokenUsage,
    flashToast,
    setQuizHistoryData,
    setView,
  });
  const {
    state: quizState,
    actions: quizActions,
    resetQuiz,
    abortRef: quizAbortRef,
    openedRef: quizOpenedRef,
  } = quizSession;

  /*
   * 设置面板的动作袋：域内动作来自 useAiSettings；clearAll 横跨三个域，只能在主组件编排，
   * 故在此合并后再交给面板。面板读到的 props 形状与拆分前完全一致。
   */
  const settingsActions = useStable(() => ({ ...aiSettings.actions, clearAll }));

  const termsState = useMemo(() => ({ collapsedTerms, pending }), [collapsedTerms, pending]);
  const termsActions = useStable(() => ({ setView, toggleTerm }));
  const historyState = useMemo(() => ({ aiCtx, config, confirmClearHist, confirmClearQuiz, copiedId, copyFailedId, expandedHistId, filteredHistory, filteredQuizHistory, hasFilter, hasQuizFilter, histPage, histPageCount, histSubjects, histTopics, historyTab, pagedHistory, pagedQuizHistory, paperData, paperOpen, paperOpts, paperPreview, persistHistory, quizExpandedId, quizHistoryData, quizOverview, quizOverviewOpen, quizPage, quizPageCount, quizScope, quizStatsData, quizSubjFilter, quizSubjects, quizSummaryConfirm, quizSummaryError, quizSummaryLoading, quizSummaryScopeLabel, quizSummaryText, quizTopicFilter, quizTopicMenuOpen, quizTopics, subjFilter, topicFilter, topicMenuOpen }), [aiCtx, config, confirmClearHist, confirmClearQuiz, copiedId, copyFailedId, expandedHistId, filteredHistory, filteredQuizHistory, hasFilter, hasQuizFilter, histPage, histPageCount, histSubjects, histTopics, historyTab, pagedHistory, pagedQuizHistory, paperData, paperOpen, paperOpts, paperPreview, persistHistory, quizExpandedId, quizHistoryData, quizOverview, quizOverviewOpen, quizPage, quizPageCount, quizScope, quizStatsData, quizSubjFilter, quizSubjects, quizSummaryConfirm, quizSummaryError, quizSummaryLoading, quizSummaryScopeLabel, quizSummaryText, quizTopicFilter, quizTopicMenuOpen, quizTopics, subjFilter, topicFilter, topicMenuOpen]);
  const historyActions = useStable(() => ({ backToPaperOptions, clearHistoryAll, clearQuizHistoryAll, closePaperPreview, copyAnswer, exportPaper, gotoHistoryPath, renderSpeakControls, retryWrongQuestion, runQuizSummary, setExpandedHistId, setHistPage, setHistoryTab, setPaperOpen, setPaperOpts, setPaperPreview, setQuizExpandedId, setQuizOverviewOpen, setQuizPage, setQuizScope, setQuizSubjFilter, setQuizSummaryConfirm, setQuizTopicFilter, setQuizTopicMenuOpen, setSubjFilter, setTopicFilter, setTopicMenuOpen, setView }));
  const historyRefs = useMemo(() => ({ quizTopicMenuRef, topicMenuRef }), [quizTopicMenuRef, topicMenuRef]);

  if (!open) return null;

  // 移动端（<640px，含窄屏）：面板改为顶部锚定的近全宽卡片——忽略桌面拖拽/缩放记忆、隐藏缩放手柄、限制最大高度不超可视区
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  // 面板位置：记忆的 pos 若超出当前视口（如桌面拖动保存后切到小屏/移动端），回退右上默认位置；移动端一律顶部锚定
  // 挂载时夹取一次：外接屏拔除 / 窗口变小后，被记住的位置可能落在屏幕外，强制拉回可见区域
  const safePos =
    !isMobile && pos && typeof window !== 'undefined'
      ? clampPos(pos.x, pos.y)
      : null;



  /* ── 历史刻度轨（minimap notches）：轮次口径与定位 ── */
  // 「一轮」= 历史里已收尾的一轮，或正在流式显示的这一轮（有则算一轮）
  const liveTurn = !!(answer || pending || busy || failure);
  const turnCount = history.length + (liveTurn ? 1 : 0);
  const railOn = turnCount >= 2; // ≥2 轮才有「历史」可收折
  const folding = railOn && !historyExpanded;
  // 正在查看的那一轮：手动定位优先，否则跟随最新（流式中=流式区，空闲=最后一条历史）。
  // 流式那一轮取不到 turnRefs，所以定位只对历史条目生效，对不上任何条目 = 全部收折。
  const focusedIdx = focusTurn ?? (liveTurn ? history.length : Math.max(0, history.length - 1));
  const notchQuestion = (i: number) =>
    i < history.length ? history[i].user : pending || currentQuestion || '';
  const peekQuestion = peekTurn !== null ? notchQuestion(peekTurn) : '';

  /** 点刻度：切到该轮（收折态下即把它展开），并平滑滚到它。 */
  const jumpToTurn = (i: number) => {
    setFocusTurn(i);
    // 学生主动回看旧轮次 → 先解除吸底，免得下一段流式把视线又拽回底部
    syncStick(false);
    // 双 rAF：等「该轮展开」这次提交渲染完，位置才是最终值
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const box = answerRef.current;
        const el = turnRefs.current[i];
        if (!box || !el) return;
        // 平滑只给这一次「用户点击」——滚动容器平时必须是 auto：流式每来一个 delta
        // 都重启一次平滑动画会抖，也会吃掉用户手势。所以这里临时挂 scroll-behavior，
        // 滚完立刻摘掉；「减动效」偏好下全局的 `scroll-behavior: auto !important` 会压过它，
        // 自动退化成瞬时跳转。
        const prev = box.style.scrollBehavior;
        box.style.scrollBehavior = 'smooth';
        box.scrollTo({ top: Math.max(0, el.offsetTop - box.offsetTop - 4) });
        if (jumpScrollTimer.current) window.clearTimeout(jumpScrollTimer.current);
        jumpScrollTimer.current = window.setTimeout(() => {
          box.style.scrollBehavior = prev;
          jumpScrollTimer.current = null;
        }, 420);
      }),
    );
  };

  /** 刻度轨右侧开关：展开=全部轮次摊回对话流纵向通读；收起=只留最新一轮。 */
  const toggleHistory = () => {
    setHistoryExpanded((v) => !v);
    setFocusTurn(null);
    setPeekTurn(null);
  };

  return (
    <>
      {/* 移动端遮罩层：点击空白处安全关闭，同时给软键盘弹出提供稳定视口边界 */}
      {isMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-none sm:backdrop-blur-[1px]"
          onClick={() => { resetConversation(); setOpen(false); setPending(null); }}
          aria-hidden="true"
        />
      )}
      <div
        ref={panelRef}
        className={`fixed z-50 flex flex-col overflow-hidden ${
          isMobile
            ? 'ai-sheet inset-x-0 bottom-[var(--kb,0px)] max-h-[min(85dvh,var(--vvh,100dvh))] min-h-[min(62dvh,var(--vvh,100dvh))] rounded-t-xl border-b-0 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] border border-[var(--border)] bg-[var(--bg)] shadow-[0_8px_24px_rgba(0,0,0,0.15)]'
            : collapsed
              ? `w-auto ${SHELL_SKIN}`
              // 62dvh 保底只服务「对话视图」（防空会话塌到 221px）；用户拖过高度时同样让位。
              // 设置/条款/学习记录是表单视图：一律随内容紧凑包裹，否则高视口下会在吸底栏下方留大片死区
              //（1440 视口实测 184px；阈值 ≈ 62dvh 超过内容高 ≈ 视口 1145px）。
              : `${SHELL_SKIN} w-[calc(100vw-2rem)] max-h-[calc(100dvh-4.5rem)]${view === 'chat' && height === 0 ? ' min-h-[min(62dvh,calc(100dvh-4.5rem))]' : ''}`
        }`}
        style={{
          ...(!isMobile
            ? {
                ...(collapsed
                  ? {}
                  : {
                      width: Math.min(width, typeof window !== 'undefined' ? window.innerWidth - 16 : width),
                      // 记忆值作为「上限」而非写死高度：内容不足时面板收缩，超出时滚动、页脚始终贴底
                      ...(height > 0 && view === 'chat' ? { maxHeight: maxPanelHeight(height) } : {}),
                    }),
                ...(safePos ? { left: safePos.x, top: safePos.y } : { top: '3.5rem', right: '1rem' }),
              }
            : {}),
        }}
        role="dialog"
        aria-label="AI assistant"
      >
      {collapsed && !isMobile ? (
        /* ── 收起态：32px 胶囊（点击还原 / 可拖动 / 流式回答不中断） ── */
        <button
          type="button"
          onPointerDown={(e) => beginDrag('title', e)}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDragOrUnlock}
          onClick={() => { if (!dragMovedRef.current) expandFromCapsule(); }}
          title={lang === 'zh' ? '展开 AI 助手' : 'Expand'}
          className="flex h-8 max-w-[16rem] items-center gap-1.5 px-2.5 text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-move"
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate text-[0.6875rem] mono-font">{lang === 'zh' ? 'AI 助手' : 'AI Assistant'}</span>
          <ChevronDown className="w-3 h-3 shrink-0 -rotate-180" aria-hidden="true" />
        </button>
      ) : (
      <>
      {/* 宽度拖拽把手（右侧边缘；移动端隐藏，全宽卡片无需缩放） */}
      <div
        className={`absolute right-0 top-0 bottom-4 w-1.5 cursor-ew-resize touch-none z-10 hover:bg-[var(--fg)]/10 transition-colors${isMobile ? ' hidden' : ''}`}
        onPointerDown={(e) => beginDrag('width', e)}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDragOrUnlock}
        title={lang === 'zh' ? '拖拽调整宽度' : 'Drag to resize'}
      />
      {/* 右下角斜拉把手（同时调宽高；移动端隐藏） */}
      <div
        className={`absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize touch-none z-20 flex items-end justify-end${isMobile ? ' hidden' : ''}`}
        onPointerDown={(e) => beginDrag('corner', e)}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDragOrUnlock}
        title={lang === 'zh' ? '斜拉调整宽高' : 'Drag corner to resize'}
      >
        <span className="w-2 h-2 border-r border-b border-[var(--muted)]" aria-hidden="true" />
      </div>
      {/* 保存成功 toast：面板顶部浮条 */}
      {savedToast && (
        <div className="absolute left-1/2 -translate-x-1/2 top-2.5 z-30 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[0.6875rem] text-[var(--fg)] shadow-[0_4px_16px_rgba(0,0,0,0.12)] whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 update-dot" aria-hidden="true" />
          {lang === 'zh' ? '已保存' : 'Saved'}
          <Mark ok className="ml-1" />
        </div>
      )}
      {/* 动作结果轻量 Toast（获取模型 / 测试连接）：放第二行，避免与「已保存」重叠 */}
      {actToast && (
        <div className="absolute left-1/2 -translate-x-1/2 top-11 z-30 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[0.6875rem] text-[var(--fg)] shadow-[0_4px_16px_rgba(0,0,0,0.12)] whitespace-nowrap">
          <span className={`w-1.5 h-1.5 rounded-full ${actToast.ok ? 'bg-green-500' : 'bg-[var(--error)]'}`} aria-hidden="true" />
          {actToast.msg}
        </div>
      )}
      {/* 头部：rounded-t-2xl 与外层圆角同半径 —— 顶栏吃的是外壳底色，
          大圆角下靠 overflow-hidden 裁形；显式写上是为了将来给顶栏加底色时不会露直角。
          移动端是 rounded-t-xl 的贴底抽屉，别在这里给更大的半径。 */}
      <div
        className={`${isMobile ? '' : 'rounded-t-2xl '}flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] cursor-move touch-none select-none shrink-0`}
        onPointerDown={(e) => beginDrag('title', e)}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDragOrUnlock}
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
        <div className="-my-1.5 -mr-1 flex items-center gap-1">
          {/* 设置入口：仅对话视图显示。子视图不再挂左上角返回箭头 ——
              弹窗不是多级页面跳转，返回一律走底部左侧的「返回对话」，关闭只留右上角 ✕ */}
          {view === 'chat' && (
            <button type="button" onClick={() => setView('settings')}
              aria-label={lang === 'zh' ? '设置' : 'Settings'}
              title={lang === 'zh' ? '设置模型与接口' : 'Settings'}
              className="relative flex h-7 w-7 items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] ghost-x transition-colors cursor-pointer rounded-md">
              <Settings className="w-4 h-4" />
            </button>
          )}
          {/* 问答历史入口：仅对话视图显示（子视图回对话走底部左侧「返回对话」）。
              右上角的信息点表示「入口里有内容可看」。 */}
          {config && view === 'chat' && (
            <button type="button" onClick={() => { setView('history'); setExpandedHistId(null); }}
              aria-label={lang === 'zh' ? '问答历史' : 'History'}
              title={lang === 'zh' ? '问答历史与测验小结' : 'History'}
              className="relative flex h-7 w-7 items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] ghost-x transition-colors cursor-pointer rounded-md">
              <History className="w-4 h-4" />
              {/* 信息点（有内容可看）：口径覆盖入口指向的**两个 Tab**——问答历史与考考你记录，
                  任一非空才亮；都为空时整点不渲染（空入口不该挂点）。

                  配色用 --tech-blue（本应用的「AI/科技」强调色，页脚模型名、历史条目里的模型名
                  都用它），而不是原来的 --accent：后者浅色下是纯黑（墨色，语义空）、深色下翻成
                  纯白，读不出「有内容」；它还会和站内已有的**状态色**语境撞车。红/绿一律排除：
                  绿=可更新、红=出错，那是状态语义，挂在这里等于说「历史出问题了」。

                  点位离按钮角 2px（right-0.5/top-0.5）：History 字形是「圆环 + 左上箭头」，
                  外弧半径 6.67px。贴着角 4px 时点与外弧相切（实测仅 0.2px 缝，看着像糊在一起），
                  退到 2px 后有 3.1px 缝；点仍在 28×28 按钮内，不参与布局。 */}
              {(persistHistory.length > 0 || quizHistoryData.length > 0) && (
                <span className="absolute right-0.5 top-0.5 w-1.5 h-1.5 rounded-full bg-[var(--tech-blue)]" aria-hidden="true" />
              )}
            </button>
          )}
          {/* 分隔线：功能区与窗口控制区分离，避免「查历史」误触「关闭」 */}
          <span className="mx-0.5 h-3.5 w-px bg-[var(--border)]" aria-hidden="true" />
          {/* 窗口控制区：最小化 + 关闭（破坏性语义，隔离在右端并给红色反馈） */}
          <button type="button" onClick={collapseToCapsule}
            aria-label={lang === 'zh' ? '最小化' : 'Minimize'}
            title={lang === 'zh' ? '收起为胶囊（Esc 也可）' : 'Minimize'}
            className={`flex h-7 w-7 items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] ghost-x transition-colors cursor-pointer rounded-md${isMobile ? ' hidden' : ''}`}>
            <Minus className="w-4 h-4" />
          </button>
          <button type="button" onClick={closePanel}
            aria-label="Close" title={lang === 'zh' ? '关闭助手 (Esc)' : 'Close (Esc)'}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 active:bg-[var(--error)] active:text-white transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

            {/* 断网提示：公网接口要联网，局域网推理服务仍可一试（两种口吻分开写） */}
      {isOffline && (
        <p className="mx-4 mt-3 flex items-start gap-2 border-l-4 border-l-[var(--error)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-3 py-2 text-[0.6875rem] serif-font leading-relaxed text-[var(--fg)]">
          <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--error)]" aria-hidden="true" />
          <span>{localEndpoint ? t.offlineAi.localApi : t.offlineAi.publicApi}</span>
        </p>
      )}

      {view === 'terms' ? (
        /* ── 第一步：使用须知（先同意才能进入设置） ── */
        <TermsPanel lang={lang} state={termsState} actions={termsActions} />
      ) : view === 'settings' ? (
        /* ── 第二步：配置表单（已同意） ── */
        <SettingsPanel lang={lang} state={settingsState} actions={settingsActions} refs={settingsRefs} />
      ) : view === 'history' ? (
        /* ── 学习记录：问答历史 / 考考你记录（纯本地持久化）── */
        <HistoryPanel lang={lang} state={historyState} actions={historyActions} refs={historyRefs} />
      ) : view === 'quiz' ? (
        /* ── 考考你：AI 批量出单选题，本地判分 ── */
        <QuizPanel lang={lang} state={quizState} actions={quizActions} />
      ) : (
        /* ── 由页面驱动 + AI 推荐追问（无自由输入） ── */
        <>
          {/* 历史刻度轨：轮次 ≥2 才出现。每条短横是一轮问答——Hover 出问题摘要，
              点击把那一轮展开并滚过去；右侧「展开历史」把全部轮次摊回对话流纵读。
              放在滚动区之外（shrink-0）而不是 sticky 进流里：不必和正文抢 z 序，
              Hover 气泡也能安稳地浮在正文之上。 */}
          {railOn && (
            <div className="relative shrink-0 border-b border-[var(--border)]/70 px-3 py-1.5">
              <div className="flex items-center gap-2">
                <div
                  role="group"
                  aria-label={lang === 'zh' ? '历史问答刻度轨' : 'History notches'}
                  className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
                >
                  {Array.from({ length: turnCount }, (_, i) => {
                    const isFocus = i === focusedIdx;
                    const question = notchQuestion(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => jumpToTurn(i)}
                        onMouseEnter={() => setPeekTurn(i)}
                        onMouseLeave={() => setPeekTurn((p) => (p === i ? null : p))}
                        onFocus={() => setPeekTurn(i)}
                        onBlur={() => setPeekTurn((p) => (p === i ? null : p))}
                        // 不用原生 title：它要悬停 1 秒才出、样式也不可控，这里换成自绘气泡
                        aria-label={
                          lang === 'zh'
                            ? `第 ${i + 1} 轮：${question.slice(0, 40)}`
                            : `Turn ${i + 1}: ${question.slice(0, 40)}`
                        }
                        aria-current={isFocus ? 'true' : undefined}
                        /* 触屏用 .tap-y 把命中盒上下各撑 7px（短横视觉只有 4px 高）；
                           按钮自身 24px 高 + 左右各 4px 内边距，鼠标的命中区也够用 */
                        className="tap-y group/notch relative flex h-6 shrink-0 cursor-pointer items-center px-1"
                      >
                        <span className={isFocus ? NOTCH_ACTIVE : NOTCH_BASE} />
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={toggleHistory}
                  aria-expanded={historyExpanded}
                  className="tap-ai-text shrink-0 inline-flex items-center gap-1 rounded px-1 text-[0.625rem] mono-font leading-none text-[var(--muted)] transition-colors hover:bg-[var(--accent-light)] hover:text-[var(--fg)] cursor-pointer"
                >
                  {historyExpanded ? (
                    <ChevronUp className="w-3 h-3 shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-3 h-3 shrink-0" aria-hidden="true" />
                  )}
                  {historyExpanded
                    ? (lang === 'zh' ? '收起' : 'Collapse')
                    : (lang === 'zh' ? '展开历史' : 'Expand history')}
                </button>
              </div>
              {/* Hover 预览：该轮的问题摘要（回答不进气泡——气泡是「找哪一轮」的线索，不是预览全文） */}
              {peekTurn !== null && peekQuestion && (
                <div className="pointer-events-none absolute left-3 top-full z-20 mt-1 max-w-[calc(100%-1.5rem)] rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-2.5 py-1.5 text-[0.6875rem] leading-snug text-[var(--fg)] shadow-xl">
                  <span className="mono-font text-[var(--muted)]">Q: </span>
                  <span className="line-clamp-2">{peekQuestion}</span>
                </div>
              )}
            </div>
          )}
          {/* 移动端内层原 60dvh 会先于抽屉的 85dvh 到顶，白白浪费约 25% 的高度配额 */}
          <div
            ref={answerRef}
            onScroll={() => {
              const el = answerRef.current;
              if (!el) return;
              // 用户主动滚离底部 → 解锁；自己滚回底部 → 自动恢复跟随
              syncStick(isNearBottom(el.scrollTop, el.clientHeight, el.scrollHeight, STICK_THRESHOLD));
            }}
            className="flex-1 overflow-y-auto overscroll-contain min-h-[150px] max-h-none p-3 space-y-2.5 text-sm serif-font"
          >
            {/* 离底恢复入口：sticky + 零高度包裹 —— 悬浮在可视区右下角，不占布局、不遮正文 */}
            {showJump && (
              <div className="sticky bottom-0 z-10 flex h-0 justify-end pointer-events-none">
                <button
                  type="button"
                  onClick={() => {
                    const el = answerRef.current;
                    if (!el) return;
                    el.scrollTop = el.scrollHeight;
                    syncStick(true);
                  }}
                  title={lang === 'zh' ? '回到最新内容' : 'Jump to latest'}
                  aria-label={lang === 'zh' ? '回到最新内容' : 'Jump to latest'}
                  className="pointer-events-auto mb-1 mr-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card-bg)] text-[var(--fg)] shadow-[0_2px_10px_rgba(0,0,0,0.12)] transition-colors hover:bg-[var(--accent-light)] tap-area"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {history.length > 0 || answer || pending || busy || failure ? (
              <>
                {/* 多轮历史（内存态，同页内可回看；关页/切页即清） */}
                {history.map((h, i) =>
                  // 收折态下只渲染「正在查看的那一轮」，其余收进顶部刻度轨
                  //（短横 + Hover 问题摘要 + 点击定位就是它们的入口，不在流里堆叠长文本）
                  folding && i !== focusedIdx ? null : (
                  <div
                    key={i}
                    ref={(el) => {
                      turnRefs.current[i] = el;
                    }}
                    className="space-y-1.5"
                  >
                    <p className="text-[0.625rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '问题' : 'Question'}: <InlineAnswer text={h.user} /></p>
                    {reasoningByTurn[turnKey(h.user, h.assistant)] && (
                      <div className="text-left">
                        {renderReasoning(
                          reasoningByTurn[turnKey(h.user, h.assistant)].text,
                          reasoningByTurn[turnKey(h.user, h.assistant)].sec,
                          `h${i}`,
                        )}
                      </div>
                    )}
                    <div className="text-left">
                      <div className="inline-block max-w-[95%] min-w-0 break-words px-2.5 py-1.5 border border-[var(--border)] text-left text-xs leading-relaxed whitespace-pre-wrap ai-answer">
                        <AnswerRich text={h.assistant} />
                        {renderSpeakControls(h.assistant, aiCtx.topic)}
                      </div>
                    </div>
                    {/* 被中断的回答：给一个「继续生成」入口（复用 followUp 链路续写） */}
                    {isStoppedAnswer(h.assistant) && (
                      <button
                        type="button"
                        onClick={() => {
                          // 把上下文钉在这一轮（lastExchange 可能已指向别的轮次），
                          // 并剥掉中断标记，保证发给模型的正文是干净的
                          lastExchange.current = { user: h.user, assistant: stripStoppedMark(h.assistant) };
                          void sendQuestion(t.aiContinue.ask, true);
                        }}
                        disabled={busy}
                        className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[0.6875rem] mono-font leading-none rounded-md border border-[var(--border)]/80 bg-[var(--accent-light)] text-[var(--fg)] transition-colors hover:bg-[var(--accent-light)]/70 hover:border-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed tap-area"
                      >
                        <ChevronsDown className="h-3.5 w-3.5" aria-hidden="true" />
                        {t.aiContinue.label}
                      </button>
                    )}
                  </div>
                  )
                )}
                {/* 当前轮（流式显示中） */}
                {(answer || pending || busy || failure) && (
                  <>
                    <p className="text-[0.625rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '问题' : 'Question'}: <InlineAnswer text={pending || currentQuestion || ''} /></p>
                    {(answer || pending || busy) && (
                    <div className="text-left">
                      {/* AI 的思考草稿（部分模型才有）：默认折叠，思考中自动展开；拿不到就不渲染 */}
                      {reasoning && renderReasoning(reasoning, reasoningSec, 'live')}
                      <div className={`inline-block max-w-[95%] min-w-0 break-words px-2.5 py-1.5 ${answer ? 'border border-[var(--border)]' : ''} text-left text-xs leading-relaxed whitespace-pre-wrap ai-answer`}>
                        {answer ? (
                          <div style={{ animation: 'answer-fade-in 0.2s ease' }}>
                            <AnswerRich text={answer} caret={caretPhase !== 'off'} caretFading={caretPhase === 'fading'} />
                          </div>
                        ) : reasoning ? null : (
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
                        {answer && !busy && renderSpeakControls(answer, aiCtx.topic)}
                      </div>
                    </div>
                    )}
                  </>
                )}
                {/* 错误态：图标 + 文案 + 操作同处一行（横向流式），不再把重试另起一行留白 */}
                {failure && (
                  <div className="mt-1 rounded-md border border-[var(--border)]/60 bg-[var(--error)]/5 px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      {failure.kind === 'offline' ? (
                        <WifiOff className="h-3.5 w-3.5 shrink-0 text-[var(--error)]" aria-hidden="true" />
                      ) : (
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-[var(--error)]" aria-hidden="true" />
                      )}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-[0.6875rem] mono-font text-[var(--fg)]">{t.aiError[failure.kind]}</p>
                        {failure.kind === 'offline' && (
                          <p className="text-[0.625rem] mono-font text-[var(--muted)]">{t.aiError.offlineAuto}</p>
                        )}
                        {failure.raw && (
                          <p className="text-[0.625rem] mono-font text-[var(--muted)] break-all leading-snug">{failure.raw}</p>
                        )}
                        {failure.attempts >= 3 && (
                          <p className="text-[0.625rem] mono-font text-[var(--muted)]">{t.aiError.checkNetwork}</p>
                        )}
                      </div>
                      {/* 操作与文案同行（右侧）：视觉胶囊 28px，触屏由 tap-area 兜到 40px */}
                      {failure.retryable && (
                        <button
                          type="button"
                          onClick={() => retryLastAttempt()}
                          disabled={retryCountdown > 0 || busy}
                          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[0.6875rem] mono-font leading-none rounded-md border border-[var(--border)]/80 bg-[var(--accent-light)] text-[var(--fg)] transition-colors hover:bg-[var(--accent-light)]/70 hover:border-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed tap-area"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          {retryCountdown > 0 ? `${retryCountdown}${t.aiError.waiting}` : t.aiError.retry}
                        </button>
                      )}
                      {failure.kind === 'auth' && (
                        <button
                          type="button"
                          onClick={() => { setView('settings'); setFailure(null); }}
                          className="shrink-0 inline-flex items-center rounded px-1.5 py-1.5 text-[0.6875rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] active:bg-[var(--accent-light)] transition-colors tap-area"
                        >
                          {lang === 'zh' ? '修改配置' : 'Fix config'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {/* AI 推荐的追问（由 prompt 约束生成，内容可控；可翻页换一批） */}
                {!busy && recs.length > 0 && (
                  /* 追问区：宽度与上方回答正文框同口径（max-w-[95%]），左右边界对齐，不再向右撑满越界 */
                  <div className="pt-1.5 max-w-[95%]">
                    {/* 头部栏：左标题 + 右「换一批」同行两端对齐；原先「换一批」独占底部一行，白费一行高度 */}
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-[var(--muted)]">
                        {lang === 'zh' ? '可以继续了解' : 'Follow-up questions'}
                      </p>
                      {/* 换一批：每次请求 AI 重新生成 3 个不同追问（方案二，费 token 换质量） */}
                      <button
                        type="button"
                        onClick={() => void refreshRecs()}
                        disabled={refreshingRecs}
                        className="shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-1 text-[0.625rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] disabled:opacity-50 transition-colors tap-area"
                      >
                        <RotateCw className="h-3 w-3" aria-hidden="true" />
                        {refreshingRecs ? (lang === 'zh' ? '获取中…' : 'Loading…') : (lang === 'zh' ? '换一批' : 'More')}
                      </button>
                    </div>
                    {/* 追问条目：细描边交互卡片（与全站组件同族），右侧箭头明示可点击 */}
                    <div className="flex flex-col gap-1.5">
                      {recs.slice(0, 3).map((q, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => askRecommended(q)}
                          className="group flex w-full items-center justify-between gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-left text-xs leading-snug text-[var(--fg)] transition-colors hover:border-[var(--fg)] hover:bg-[var(--accent-light)] tap-area"
                        >
                          <span className="min-w-0"><InlineAnswer text={prettyScripts(q)} /></span>
                          <span aria-hidden="true" className="shrink-0 mono-font text-xs text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--fg)]">→</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="pt-6 text-center space-y-2.5">
                <p className="text-xs text-[var(--muted)] italic">
                  {lang === 'zh'
                    ? '点击页面上的「问 AI」按钮，AI 会结合当前内容讲解'
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
                <button type="button" onClick={() => { abortRef.current?.abort(); setBusy(false); }} className="rounded px-1 py-1 text-[0.625rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] active:bg-[var(--accent-light)] transition-colors">
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
                className="compact inline-flex items-center gap-1.5 py-1 text-[0.6875rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
              >
                <GraduationCap className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                {lang === 'zh' ? '考考你' : 'Quiz'}
              </button>
            </div>
          )}
          {/* 底部状态栏：rounded-b-2xl 让这块 --accent-light 底色自己贴合外壳圆角，
              不靠裁剪也能收干净（否则四角会留一条底色的直角边）。移动端底部是方的（border-b-0）。 */}
          <div className={`${isMobile ? '' : 'rounded-b-2xl '}border-t border-[var(--border)] bg-[var(--accent-light)] px-3 py-2 shrink-0`}>
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
        </>
      )}
      </>)}
    </div>
    {/* token 用量明细树状图（设置页「明细」点开；portal 到 body） */}
    {showTokenUsage && (
      <TokenUsageDialog usage={tokenUsage} lang={lang} onClose={() => setShowTokenUsage(false)} />
    )}
    </>
  );

}