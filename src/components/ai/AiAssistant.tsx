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
import { createPortal } from 'react-dom';
import { ArrowLeft, BookOpen, Check, ChevronDown, CircleX, Coins, Copy, Eye, EyeOff, GraduationCap, History, List, Minus, Pause, Play, PlugZap, Printer, RotateCcw, Scale, Settings, ShieldCheck, Sparkles, Square, Trash2, TriangleAlert, Volume2, X, WifiOff} from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';
import { useApp } from '../../lib/app-context';
import { useSpeak } from '../../lib/use-speak';
import { symbolsForTopic } from '../../lib/physics-speech-symbols';
import { getTtsVoice } from '../../lib/tts-config';
import { labMap } from '../../lib/labs';
import { useAiContext } from '../../lib/ai-context';
import { QUIZ_SENTINEL, buildQuizPrompt, buildQuizSummaryPrompt, buildFillJudgePrompt, logPromptIssue } from '../../lib/ai-config';
import { getLabState, labIdFromPath, stageLabel } from '../../lib/ai-dynamic-questions';
import { parseQuizBatchChecked, dedupeQuizQuestions, shuffleOptions, parseJudgeVerdict, parseQuizQuestion, judgeFillAnswer, type QuizQuestion } from '../../lib/ai-quiz';
import { clearHistory, listHistory, saveHistory, relativeTime, type AiHistoryEntry } from '../../lib/ai-history';
import { clearQuizHistory, listQuizHistory, saveQuizHistory, wrongQuizHistory, type QuizHistoryEntry } from '../../lib/quiz-history';
import { buildQuizPaper, type QuizPaper, type PaperBlankLevel, type PaperSortMode } from '../../lib/quiz-paper';
import QuizPaperPrint from './QuizPaperPrint';
import { buildQuizRecordsForSummary, computeQuizOverview } from '../../lib/quiz-summary';
import { addTokenUsage, clearTokenUsage, loadTokenUsage, tokenUsageModelTotal, tokenUsageTotal, type TokenUsageData } from '../../lib/token-usage';
import AnswerRich, { InlineAnswer } from './AnswerRich';
import TokenUsageDialog from '../ui/TokenUsageDialog';
import {
  AI_PROVIDERS, buildSystemPrompt, clearAiConfig, estimateTokens, fetchModels, isNetworkError, loadAiConfig, normalizeBaseUrl, saveAiConfig, streamChat,
  effectiveThinkingEffort, thinkingPlanFor, keysByProviderOf, resolveThinkingDispatch, isTierLocked,
  type AiConfig, type AiProvider, type QuizAngle, type QuizQType, type ThinkingEffort, type ThinkingNote,
} from '../../lib/ai-config';

/** 思考强度三档（顺序即界面顺序）。「标准」不再标注「默认」：它现在会显式下发较低力度值，
 *  与部分服务商的默认（DeepSeek/百炼默认即高强度）并不相同。 */
const THINKING_TIERS: { id: ThinkingEffort; zh: string; en: string }[] = [
  { id: 'off', zh: '关闭', en: 'Off' },
  { id: 'standard', zh: '标准', en: 'Standard' },
  { id: 'deep', zh: '深度思考', en: 'Deep thinking' },
];

/** 档位不可用的原因文案（与 lib/ai-config 的 ThinkingNote 一一对应） */
const THINKING_NOTE: Record<ThinkingNote, { zh: string; en: string }> = {
  cannotDisable: {
    zh: '该模型始终进行推理，不支持关闭思考，因此「关闭」档不可选。',
    en: 'This model always reasons, so thinking cannot be turned off — the Off tier is disabled.',
  },
  alwaysThinksNoKnob: {
    zh: '该模型始终进行推理，也不提供力度调节。',
    en: 'This model always reasons and offers no effort control.',
  },
  noEffortTier: {
    zh: '该模型只支持开启或关闭思考，不提供力度档位。',
    en: 'This model only supports on/off; it has no effort tier.',
  },
  noThinkingSupport: {
    zh: '该模型不在深度思考支持范围内，未下发任何思考参数。',
    en: 'This model is not in the deep-thinking support list, so no thinking parameter is sent.',
  },
  unverified: {
    zh: '该模型的思考参数暂无官方依据，因此不下发任何相关字段。',
    en: 'No documented thinking parameter for this model, so none is sent.',
  },
  passthroughOnly: {
    zh: '自定义端点不预设思考参数，请用下方透传框自行指定。',
    en: 'Custom endpoints preset nothing — specify parameters in the passthrough box below.',
  },
};

/** 档位标签（按当前语言） */
function tierLabel(id: ThinkingEffort, lang: 'zh' | 'en'): string {
  const t = THINKING_TIERS.find((x) => x.id === id);
  return t ? (lang === 'zh' ? t.zh : t.en) : id;
}

/** 问答对的键：把本回合的思考草稿挂到对应历史气泡上（只存内存，不落盘） */
function turnKey(user: string, assistant: string): string {
  return `${user}\u0000${assistant}`;
}

/* ── 当前页面 → 主题提示（注入系统提示词） ── */
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
  const { lang, t, isOffline } = useApp();
  const { state: speakState, errorMsg, finishedText, speak, pause, resume, replay, stop: stopSpeak, waitingLong } = useSpeak();
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
          else speak(text, getTtsVoice(lang), lang, speechOpts);
        }}
        title={
          speakState === 'playing' ? (lang === 'zh' ? '暂停朗读' : 'Pause')
            : speakState === 'paused' ? (lang === 'zh' ? '继续朗读' : 'Resume')
            : speakState === 'synthesizing' ? (lang === 'zh' ? '合成中' : 'Loading')
            : isReplay ? (lang === 'zh' ? '重新朗读' : 'Replay')
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
  };
  const [config, setConfig] = useState<AiConfig | null>(() => loadAiConfig());
  // 局域网/本机端点：断网时仍值得一试（这类推理服务不依赖外网）
  const localEndpoint = /^https?:\/\/(127\.0\.0\.1|localhost|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(
    (config?.baseUrl ?? '').trim(),
  );
  const [view, setView] = useState<'terms' | 'settings' | 'chat' | 'history' | 'quiz'>('terms');
  const [providerId, setProviderId] = useState(AI_PROVIDERS[0].id);
  const [apiKey, setApiKey] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('');
  // 思考强度档位（默认 standard：按模型能力表下发，模型不支持则不下发）
  const [thinkingEffort, setThinkingEffort] = useState<ThinkingEffort>('standard');
  // 各服务商各自保存的 Key：切服务商时按此回填，未配置过则为空（绝不复用上一家的 Key）
  const [keyByProvider, setKeyByProvider] = useState<Record<string, string>>({});
  // 自定义端点附加请求参数（JSON 文本，仅「自定义端点」显示与生效）
  const [extraParamsText, setExtraParamsText] = useState('');
  const [extraParamsOpen, setExtraParamsOpen] = useState(false);
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
  // 「获取模型」是独立动作，与「测试连接」互不阻塞：两者各有自己的 loading 态
  const [fetching, setFetching] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  // 在途闸门：fetching / testing 是异步 state，同一个 tick 内连点拦不住（状态还没重渲染），
  // 用 ref 做同步锁，请求返回前一律拦截后续点击，避免对限流严格的服务商打出重复请求。
  const fetchingRef = useRef(false);
  const testingRef = useRef(false);
  // 保存成功 toast（面板内提示，2 秒自动消失）
  const [savedToast, setSavedToast] = useState(false);
  const savedToastTimer = useRef<number | null>(null);
  useEffect(() => () => { if (savedToastTimer.current) window.clearTimeout(savedToastTimer.current); }, []);
  // 动作结果轻量 Toast（获取模型 / 测试连接）：即时反馈；完整报错仍留在下方结果行
  const [actToast, setActToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const actToastTimer = useRef<number | null>(null);
  useEffect(() => () => { if (actToastTimer.current) window.clearTimeout(actToastTimer.current); }, []);
  const flashToast = (ok: boolean, msg: string) => {
    setActToast({ ok, msg });
    if (actToastTimer.current) window.clearTimeout(actToastTimer.current);
    actToastTimer.current = window.setTimeout(() => setActToast(null), 2600);
  };
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
      // 跨会话累计 token（归纳请求 = prompt + 实际输出）
      addTokenUsage(config?.model, promptTokens + estimateTokens(full));
      refreshTokenUsage();
      setQuizSummaryText(full);
    } catch (e) {
      if (quizSummaryAbortRef.current && quizSummaryAbortRef.current.signal.aborted) return;
      const msg = (e as Error).message;
      const authFailed = /authentication|invalid.*api|api key|401|403/i.test(msg);
      setQuizSummaryError(
        isOffline
          ? t.offlineAi.failed
          : isNetworkError(msg)
          ? msg
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
      { role: 'system', content: buildQuizPrompt(lang, aiCtx.topic ?? pageSubject(location.pathname, lang), aiCtx.knowledge, count, angle, timeLimit, qtype) },
      { role: 'user', content: lang === 'zh' ? `请围绕当前页面知识点（${aiCtx.topic ?? pageSubject(location.pathname, lang) ?? '当前主题'}）按格式出 ${count} 道题。` : `Please create ${count} questions in the specified format, based on the current page knowledge (${aiCtx.topic ?? pageSubject(location.pathname, lang) ?? 'current topic'}).` },
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
      // 跨会话累计 token（出题请求 = prompt + 实际输出）
      addTokenUsage(config?.model, promptTokens + estimateTokens(full));
      refreshTokenUsage();
      let parsed = parseQuizBatchChecked(full, count);
      if (parsed.reason) {
        logPromptIssue('quiz-parse', parsed.reason);
        // 一次修复重试：只回灌上一次输出的尾部，要求补出缺失题目（无对话窗口，学生无法自己重来）
        try {
          const repair = await streamChat(
            config,
            [
              messages[0],
              { role: 'assistant', content: full.slice(-2000) },
              {
                role: 'user',
                content: lang === 'zh'
                  ? `上一次输出${parsed.reason}。请只补出缺失的题目，沿用同一格式与字段名，写完输出 ${QUIZ_SENTINEL}；不要重复已出过的考点（已出：${parsed.items.map((q) => q.question.slice(0, 12)).join('、') || '无'}）。`
                  : `The previous answer ${parsed.reason}. Output ONLY the missing questions in the same format and field names, then print ${QUIZ_SENTINEL}; do not repeat topics already covered (${parsed.items.map((q) => q.question.slice(0, 12)).join(', ') || 'none'}).`,
              },
            ],
            () => {},
            quizAbortRef.current.signal,
            2000,
          );
          const merged = parseQuizBatchChecked(`${full}\n${repair}`, count);
          if (merged.items.length > parsed.items.length) parsed = merged;
        } catch {
          logPromptIssue('quiz-repair', '修复重试失败，按首次结果继续');
        }
      }
      // 去重（重试最容易产出重复题）+ 选项洗牌（正确项位置交给代码，不交给模型）
      const items = dedupeQuizQuestions(parsed.items).slice(0, count).map((q) => shuffleOptions(q));
      if (items.length === 0) {
        setQuizError(lang === 'zh' ? '出题失败，请重试' : 'Failed to create questions, please retry');
        setQuizQuestions([]);
        setQuizLoading(false);
        return;
      }
      setQuizQuestions(items);
      setQuizIdx(0);
      setQuizLoading(false);
    } catch (e) {
      if (quizAbortRef.current && quizAbortRef.current.signal.aborted) return;
      const msg = (e as Error).message;
      const authFailed = /authentication|invalid.*api|api key|401|403/i.test(msg);
      setQuizError(
        isNetworkError(msg)
          ? msg
          : authFailed
            ? (lang === 'zh' ? 'API Key 无效或已失效，请点击右上角「设置」重新配置' : 'API key invalid or expired, open Settings to reconfigure')
            : (lang === 'zh' ? '出题失败：' : 'Failed: ') + msg,
      );
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
        const signal = new AbortController(); // 判分超时 8 秒
        const timeoutId = setTimeout(() => signal.abort(), 8000);
        const full = await streamChat(config, [{ role: 'system', content: system }, { role: 'user', content: user }], () => {}, signal.signal, 20);
        clearTimeout(timeoutId);
        // 取第一个 Y/N，而不是首字符（解析见 ai-quiz.ts parseJudgeVerdict）
        if (parseJudgeVerdict(full)) finalCorrect = true;
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
  /** 思考草稿折叠区：默认折叠，标题写明它可能直接写出结论（与「探究型不给结论」的口径并存） */
  const renderReasoning = (text: string, sec: number, id: string) => {
    const open = openReasoningId === id;
    return (
      <div className="inline-block max-w-[95%] mb-1 border border-[var(--border)]">
        <button
          type="button"
          onClick={() => setOpenReasoningId(open ? null : id)}
          className="w-full text-left px-2.5 py-1 text-[0.625rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
        >
          {open ? '▾ ' : '▸ '}
          {lang === 'zh'
            ? `思考过程（约 ${sec}s · ${text.length} 字）：AI 的草稿，可能直接写出结论，也可能想错`
            : `Thinking (≈${sec}s · ${text.length} chars): AI draft — it may state the answer outright, or be wrong`}
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
  // 跨会话累计 token 用量（按模型 × 日期分桶，localStorage 持久化；设置页展示）
  const [tokenUsage, setTokenUsage] = useState<TokenUsageData>(() => loadTokenUsage());
  const refreshTokenUsage = () => setTokenUsage(loadTokenUsage());
  const tokenUsageTotalCount = tokenUsageTotal(tokenUsage);
  // token 用量明细弹窗（树状图：模型 → 日期）
  const [showTokenUsage, setShowTokenUsage] = useState(false);
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


  const provider: AiProvider = AI_PROVIDERS.find((p) => p.id === providerId) ?? AI_PROVIDERS[0];

  // 当前模型的思考能力（模型为空时不判定，避免输入过程中闪烁）
  const thinkingPlan = model.trim() ? thinkingPlanFor(providerId, model) : null;
  // 实际生效的档位：所选档位在当前模型不可用时回落（标准优先）
  const activeEffort = effectiveThinkingEffort(providerId, model, thinkingEffort);
  // 只有「模型有可调档位、但缺这一档」才置灰；模型完全没有可调参数（未收录 / 自定义端点 /
  // 无可调项）时三档仍可点——保证点击永远有反馈，实际发不发由下方「本次下发」一行交代
  const tiersRestricted = !!thinkingPlan && thinkingPlan.available.length > 0;
  const tierLocked = (id: ThinkingEffort) => !!thinkingPlan && isTierLocked(thinkingPlan, id);
  const selectedEffort: ThinkingEffort = tiersRestricted ? (activeEffort ?? 'standard') : thinkingEffort;
  // 本次真正会下发的思考参数：与底层请求体共用同一个出口（resolveThinkingDispatch），
  // 因此留痕与实发逐字节一致——既含自定义端点的透传，也含非法档位的安全回落。
  const dispatch = resolveThinkingDispatch({ providerId, model, thinkingEffort, extraParamsText });
  const sentDesc = dispatch.summaryText;

  // 模型名匹配一律大小写不敏感：用户手输 QWEN-PLUS 也应命中常用气泡的 qwen-plus，
  // 否则「已选中的模型」看起来没有任何反馈。
  const modelMatches = (m: string) => m.trim().toLowerCase() === (model || '').trim().toLowerCase();

  // 自定义参数文本是否为「可用的 JSON 对象」（仅用于界面提示；非法时请求端同样忽略，不阻断）
  const extraParamsValid = (() => {
    const t = extraParamsText.trim();
    if (!t) return true;
    try {
      const v: unknown = JSON.parse(t);
      return !!v && typeof v === 'object' && !Array.isArray(v);
    } catch {
      return false;
    }
  })();

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
      const keys = keysByProviderOf(config);
      setKeyByProvider(keys);
      setProviderId(config.providerId);
      // Key 按服务商取：当前服务商没配置过就是空，绝不复用其他服务商的 Key
      setApiKey(keys[config.providerId] ?? '');
      if (config.providerId === 'custom') setCustomUrl(config.baseUrl);
      setModel(config.model);
      setThinkingEffort(config.thinkingEffort ?? 'standard');
      setExtraParamsText(config.extraParamsText ?? '');
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
    if (!pending) return;
    if (config) {
      void sendQuestion(pending, false);
      setPending(null);
    } else if (!open) {
      setOpen(true); // 未配置就把面板打开去配；问题保留，保存后自动发出
    }
  }, [pending, config, open, setOpen]);

  // 回答区自动滚底（流式增量 + 新轮入历史时都滚到底部）
  useEffect(() => {
    answerRef.current?.scrollTo({ top: answerRef.current.scrollHeight, behavior: 'smooth' });
  }, [answer, history]);

  // 切换预设
  const selectProvider = (id: string) => {
    setProviderId(id);
    // Key 跟着服务商走：该家没配置过就清空，绝不把上一家的 Key 留在输入框里
    setApiKey(keyByProvider[id] ?? '');
    setModel('');
    setLiveModels([]);
    setModelNote(null);
    setTestResult(null);
    setFetching(false);
    setTesting(false);
    if (id !== 'custom') setCustomUrl('');
  };

  /** 取端点（自定义用输入值，预设用服务商地址），返回 null 表示地址无效 */
  // 表单与「已保存配置」是否一致：不一致就明说，避免测试过了、提问却用旧配置
  const formMatchesSaved = useMemo(() => {
    if (!config) return false;
    const formUrl = normalizeBaseUrl(providerId === 'custom' ? customUrl.trim() : provider.baseUrl);
    return (
      config.providerId === providerId &&
      config.baseUrl === formUrl &&
      config.apiKey === apiKey.trim() &&
      config.model === model.trim() &&
      (config.thinkingEffort ?? 'standard') === thinkingEffort
    );
  }, [config, providerId, customUrl, provider.baseUrl, apiKey, model, thinkingEffort]);

  const resolveBaseUrl = (): string | null =>
    normalizeBaseUrl(providerId === 'custom' ? customUrl.trim() : provider.baseUrl) || null;

  // 【获取模型】只做一件事：GET /models 列出该家可用模型（该接口不需要模型名）。
  // 不验证「能否对话」——那是「测试连接」的职责，两者拆开才能分别诊断。
  const fetchModelList = async () => {
    if (fetchingRef.current) return; // 在途闸门：拦掉同一 tick 内的连点（状态尚未重渲染）
    if (!apiKey.trim()) { setTestResult({ ok: false, msg: lang === 'zh' ? '请先填写 API Key' : 'Enter an API key first' }); return; }
    const baseUrl = resolveBaseUrl();
    if (!baseUrl) { setTestResult({ ok: false, msg: lang === 'zh' ? '端点地址无效（仅支持 http/https）' : 'Invalid endpoint URL (http/https only)' }); return; }
    fetchingRef.current = true;
    setFetching(true);
    setTestResult(null);
    try {
      const ids = await fetchModels(baseUrl, apiKey);
      if (ids.length > 0) {
        setLiveModels(ids);
        setModel(ids[0]);
        setModelNote(lang === 'zh' ? `已获取 ${ids.length} 个可用模型` : `${ids.length} models available`);
        setTestResult({ ok: true, msg: lang === 'zh' ? `已列出 ${ids.length} 个模型 ✓ 请再点「测试连接」确认能否对话` : `${ids.length} models listed ✓ now use "Test connection"` });
        flashToast(true, lang === 'zh' ? `已获取 ${ids.length} 个模型` : `${ids.length} models fetched`);
      } else {
        setLiveModels([]);
        setModelNote(lang === 'zh' ? '该端点未返回模型列表，可手输模型名' : 'No model list — type a model name');
        setTestResult({ ok: false, msg: lang === 'zh' ? '该端点未返回模型列表，请手动输入模型名（仍可用「测试连接」验证能否对话）' : 'No model list returned — type a model name (you can still use "Test connection")' });
        flashToast(false, lang === 'zh' ? '该端点未返回模型列表' : 'No model list from this endpoint');
      }
    } catch (e) {
      const msg = (e as Error).message;
      setLiveModels([]);
      setTestResult({
        ok: false,
        msg: msg.slice(0, 80),
      });
      flashToast(false, lang === 'zh' ? '无法访问该端点' : 'Cannot reach the endpoint');
    } finally {
      // 成功/失败/异常都要释放闸门，避免异常路径把后续点击永久锁死
      fetchingRef.current = false;
      setFetching(false);
    }
  };

  // 【测试连接】只做一件事：发一次极小的 chat 请求，验证 Key / 端点 / 模型三者确实可用。
  // 与「获取模型」分开：有些端点不提供 /models 但能正常对话，只有真发一次才验证得住。
  // 注意：该动作会消耗极少量 token（由用户自己的 Key 承担）。
  const testConnection = async () => {
    if (testingRef.current) return; // 在途闸门：拦掉同一 tick 内的连点（状态尚未重渲染）
    if (!apiKey.trim()) { setTestResult({ ok: false, msg: lang === 'zh' ? '请先填写 API Key' : 'Enter an API key first' }); return; }
    const baseUrl = resolveBaseUrl();
    if (!baseUrl) { setTestResult({ ok: false, msg: lang === 'zh' ? '端点地址无效（仅支持 http/https）' : 'Invalid endpoint URL (http/https only)' }); return; }
    const probeModel = model.trim() || provider.models[0] || '';
    if (!probeModel) { setTestResult({ ok: false, msg: lang === 'zh' ? '请先选择或输入模型名，再测试连接' : 'Choose or type a model name first' }); return; }
    testingRef.current = true;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
        body: JSON.stringify({ model: probeModel, messages: [{ role: 'user', content: 'hi' }], max_tokens: 8 }),
      });
      if (res.ok) {
        setTestResult({ ok: true, msg: lang === 'zh' ? `连接成功 ✓ 模型 ${probeModel} 可正常对话` : `Connected ✓ ${probeModel} responds` });
        flashToast(true, lang === 'zh' ? '连接成功 ✓' : 'Connected ✓');
      } else {
        const j = await res.json().catch(() => null);
        const detail = (j?.error?.message || `HTTP ${res.status}`).slice(0, 80);
        setTestResult({ ok: false, msg: detail });
        flashToast(false, lang === 'zh' ? '连接失败，详见下方说明' : 'Connection failed — see the message below');
      }
    } catch (e) {
      const msg = (e as Error).message;
      setTestResult({
        ok: false,
        msg: msg.slice(0, 80),
      });
      flashToast(false, lang === 'zh' ? '无法访问该端点' : 'Cannot reach the endpoint');
    } finally {
      testingRef.current = false;
      setTesting(false);
    }
  };

  // 保存配置
  const save = () => {
    const baseUrl = normalizeBaseUrl(providerId === 'custom' ? customUrl.trim() : provider.baseUrl);
    if (!apiKey.trim() || !baseUrl) { setTestResult({ ok: false, msg: lang === 'zh' ? '请填写 API Key 与端点地址' : 'Fill in API key and endpoint' }); return; }
    if (!model.trim()) { setTestResult({ ok: false, msg: lang === 'zh' ? '请填写或选择模型' : 'Choose or type a model' }); return; }
    const trimmedKey = apiKey.trim();
    // Key 按服务商归档：本次填写的 Key 只记到当前服务商名下
    const nextKeys = { ...keyByProvider, [providerId]: trimmedKey };
    setKeyByProvider(nextKeys);
    const cfg: AiConfig = { providerId, apiKey: trimmedKey, baseUrl, model, agreed: true, thinkingEffort, keyByProvider: nextKeys, extraParamsText: providerId === 'custom' ? extraParamsText.trim() : undefined };
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
    setKeyByProvider({});
    setThinkingEffort('standard');
    setExtraParamsText('');
    setExtraParamsOpen(false);
    setLiveModels([]);
    setModelNote(null);
    setTesting(false);
    setFetching(false);
    setTestResult(null);
    setSavedToast(false);
    // 闸门一并复位：清空后再点「获取模型 / 测试连接」不应被残留锁挡住
    testingRef.current = false;
    fetchingRef.current = false;
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

  /** 系统提示词：带当前主题与实验阶段（阶段由实验页写入易失注册表，见 ai-dynamic-questions.ts） */
  const systemPromptForPage = () => {
    const labId = labIdFromPath(location.pathname);
    const lab = labId ? labMap[labId] : undefined;
    return buildSystemPrompt(
      lang,
      aiCtx.topic ?? pageSubject(location.pathname, lang),
      aiCtx.knowledge,
      stageLabel(getLabState(labId)?.stage, lang),
      // 实验页用注册表里的学科判定（显示名里没有「物理」二字）；非实验页留给主题串回退
      lab ? lab.subjectId === 'physics' : undefined,
    );
  };

  // 发送单轮问题（followUp=true 时携带上一轮问答作为上下文）
  const sendQuestion = async (text: string, followUp = false) => {
    expandFromCapsule(); // 有提问就把胶囊展开，否则学生看不到回答
    const q = text.trim();
    if (!q || busy) return;
    if (!config) {
      setOpen(true);
      flashToast(false, lang === 'zh' ? '请先在 AI 设置里保存配置' : 'Save your AI settings first');
      return;
    }
    setCurrentQuestion(q); // 立即更新问题行（推荐追问也即时生效，不等回答完成）
    setAnswer('');
    setReasoning('');
    setOpenReasoningId('live');
    setReasoningSec(0);
    setRecs([]);
    setError(null);
    setBusy(true);
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPromptForPage() },
    ];
    if (followUp && lastExchange.current) {
      messages.push({ role: 'user', content: lastExchange.current.user });
      messages.push({ role: 'assistant', content: lastExchange.current.assistant });
    }
    messages.push({
      role: 'user',
      content: lang === 'zh' ? `<学生提问>${q}</学生提问>` : `<student_question>${q}</student_question>`,
    });
    abortRef.current = new AbortController();
    const t0 = performance.now();
    // 用量实时统计：会话基准（本轮之前的累计）固定，prompt 一次计入，输出随流式滚动增长
    const baseTokens = usage?.tokens ?? 0;
    const promptTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    let received = 0;
    let firstContentAt = 0; // 首个正文 token 的时刻（用来算「思考了几秒」并自动折叠）
    let reasoningText = '';   // 本轮思考全文（闭包内累积，结束后挂到本轮问答对上）
    let reasoningSecLocal = 0;
    try {
      const full = await streamChat(
        config,
        messages,
        (delta) => {
          if (!firstContentAt) {
            firstContentAt = performance.now();
            reasoningSecLocal = Math.max(1, Math.round((firstContentAt - t0) / 1000));
            setReasoningSec(reasoningSecLocal);
            setOpenReasoningId(null); // 正文开始 → 思考区自动折叠（默认不看）
          }
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
        (r) => {
          // 思考增量：也算学生付费的输出，计入本轮用量（想得多=花得多，学生看得见）
          received += r.length;
          reasoningText += r;
          setReasoning((x) => x + r);
        },
      );
      // 跨会话累计 token（本次请求 = prompt + 实际输出 + 思考增量：想得多花得多，口径与本轮显示一致）
      addTokenUsage(config?.model, promptTokens + estimateTokens(received));
      refreshTokenUsage();
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
      const outTokens = estimateTokens(received);
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
          isOffline
            ? t.offlineAi.failed
            : isNetworkError(msg)
            ? msg
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
      { role: 'system', content: systemPromptForPage() },
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

  if (!open) return null;

  // 移动端（<640px，含窄屏）：面板改为顶部锚定的近全宽卡片——忽略桌面拖拽/缩放记忆、隐藏缩放手柄、限制最大高度不超可视区
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  // 面板位置：记忆的 pos 若超出当前视口（如桌面拖动保存后切到小屏/移动端），回退右上默认位置；移动端一律顶部锚定
  // 挂载时夹取一次：外接屏拔除 / 窗口变小后，被记住的位置可能落在屏幕外，强制拉回可见区域
  const safePos =
    !isMobile && pos && typeof window !== 'undefined'
      ? clampPos(pos.x, pos.y)
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
            ? 'inset-x-0 bottom-[var(--kb,0px)] max-h-[min(85dvh,var(--vvh,100dvh))] min-h-[min(62dvh,var(--vvh,100dvh))] rounded-t-xl border-b-0 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]'
            : collapsed
              ? 'w-auto'
              // 空会话也保底 62dvh，面板不再塌到 221px；只在用户拖过高度时让位（见下方 style 里的 maxHeight）
              : `w-[calc(100vw-2rem)] max-h-[calc(100dvh-4.5rem)]${height > 0 && view === 'chat' ? '' : ' min-h-[min(62dvh,calc(100dvh-4.5rem))]'}`
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
        <div className="absolute left-1/2 -translate-x-1/2 top-2.5 z-30 flex items-center gap-2 border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[0.6875rem] text-[var(--fg)] shadow-[0_4px_16px_rgba(0,0,0,0.12)] whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 update-dot" aria-hidden="true" />
          {lang === 'zh' ? '已保存 ✓' : 'Saved ✓'}
        </div>
      )}
      {/* 动作结果轻量 Toast（获取模型 / 测试连接）：放第二行，避免与「已保存」重叠 */}
      {actToast && (
        <div className="absolute left-1/2 -translate-x-1/2 top-11 z-30 flex items-center gap-2 border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[0.6875rem] text-[var(--fg)] shadow-[0_4px_16px_rgba(0,0,0,0.12)] whitespace-nowrap">
          <span className={`w-1.5 h-1.5 rounded-full ${actToast.ok ? 'bg-green-500' : 'bg-[var(--error)]'}`} aria-hidden="true" />
          {actToast.msg}
        </div>
      )}
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] cursor-move touch-none select-none shrink-0"
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
          {/* 功能区：设置/返回、历史（窄屏与子视图自适应） */}
          <button type="button" onClick={() => setView(view === 'chat' ? 'settings' : 'chat')}
            aria-label={view === 'chat' ? (lang === 'zh' ? '设置' : 'Settings') : (lang === 'zh' ? '返回' : 'Back')}
            title={view === 'chat' ? (lang === 'zh' ? '设置模型与接口' : 'Settings') : (lang === 'zh' ? '返回对话' : 'Back to chat')}
            className="relative flex h-7 w-7 items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors cursor-pointer">
            {view === 'chat' ? <Settings className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>
          {/* 问答历史入口：仅对话视图显示（子视图由返回箭头回对话）；有记录时挂一个小圆点 */}
          {config && view === 'chat' && (
            <button type="button" onClick={() => { setView('history'); setExpandedHistId(null); }}
              aria-label={lang === 'zh' ? '问答历史' : 'History'}
              title={lang === 'zh' ? '问答历史与测验小结' : 'History'}
              className="relative flex h-7 w-7 items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors cursor-pointer">
              <History className="w-4 h-4" />
              {persistHistory.length > 0 && (
                <span className="absolute right-1 top-1 w-1.5 h-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              )}
            </button>
          )}
          {/* 分隔线：功能区与窗口控制区分离，避免「查历史」误触「关闭」 */}
          <span className="mx-0.5 h-3.5 w-px bg-[var(--border)]" aria-hidden="true" />
          {/* 窗口控制区：最小化 + 关闭（破坏性语义，隔离在右端并给红色反馈） */}
          <button type="button" onClick={collapseToCapsule}
            aria-label={lang === 'zh' ? '最小化' : 'Minimize'}
            title={lang === 'zh' ? '收起为胶囊（Esc 也可）' : 'Minimize'}
            className={`flex h-7 w-7 items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors cursor-pointer${isMobile ? ' hidden' : ''}`}>
            <Minus className="w-4 h-4" />
          </button>
          <button type="button" onClick={closePanel}
            aria-label="Close" title={lang === 'zh' ? '关闭助手 (Esc)' : 'Close (Esc)'}
            className="flex h-7 w-7 items-center justify-center text-[var(--muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors cursor-pointer">
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
            className="tap-primary w-full px-3 py-2 text-xs mono-font border border-[var(--fg)] text-[var(--fg)] transition-colors"
          >
            {lang === 'zh' ? '我同意并继续 →' : 'I agree and continue →'}
          </button>
          </div>
        </div>
      ) : view === 'settings' ? (
        /* ── 第二步：配置表单（已同意） ── */
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-0 space-y-3 text-sm serif-font">
          {/* 服务商预设 */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-[0.6875rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '选择服务商' : 'Provider'}</p>
              <button type="button" onClick={() => setView('terms')} className="text-[0.625rem] mono-font text-[var(--muted)] underline hover:text-[var(--fg)] shrink-0">
                {lang === 'zh' ? '查看须知' : 'View terms'}
              </button>
            </div>
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
              <p className="mt-1 text-[0.625rem] leading-snug text-[var(--muted)]">
                {lang === 'zh'
                  ? '支持任意兼容 OpenAI 接口的端点。若连接局域网私有模型，请确保该服务端已开启 CORS 跨域访问。'
                  : 'Works with any OpenAI-compatible endpoint. For a private model on your LAN, make sure that server has CORS enabled.'}
              </p>
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
                className="tap-icon absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)]"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {/* 安全声明：只陈述事实（明文存于本机 localStorage），严禁「加密」等不实表述 */}
            <p className="mt-1 flex items-start gap-1 text-[0.625rem] text-[var(--muted)] leading-snug">
              <ShieldCheck className="mt-[1px] w-3 h-3 shrink-0" aria-hidden="true" />
              <span>
                {lang === 'zh'
                  ? '密钥仅保存在本机浏览器的本地存储（localStorage）中，请求直连您所选服务商端点，不上报任何开发者服务器。'
                  : 'The key is kept only in this browser\'s local storage (localStorage); requests go straight to the endpoint you chose and are never sent to any developer server.'}
              </span>
            </p>
          </div>

          {/* 模型：单行 Combobox（输入框内嵌 ▾）+ 获取模型 / 测试连接 + 常用气泡 */}
          <div>
            <p className="text-[0.6875rem] mono-font text-[var(--muted)] mb-1">
              {lang === 'zh' ? '模型' : 'Model'}
              {modelNote && <span className="ml-1.5 text-[0.625rem] text-[var(--fg)]">({modelNote})</span>}
            </p>
            {/* 单行：可输入下拉框 + 两个独立动作按钮（按钮在相对定位容器之外，不与浮层抢位置） */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Combobox：输入框与内嵌 ▾ 同属一个容器，浮层锚定其正下方；
                  value 直接绑定 model，默认即展示当前生效模型，可随时改写 */}
              <div ref={modelMenuRef} className="relative min-w-[3.5rem] flex-1">
                <input
                  type="text"
                  role="combobox"
                  aria-expanded={modelMenuOpen}
                  aria-controls="ai-model-listbox"
                  aria-autocomplete="list"
                  aria-label={lang === 'zh' ? '模型' : 'Model'}
                  placeholder={lang === 'zh' ? '可直接输入，或点 ▾ 选择' : 'Type a name, or click ▾ to pick'}
                  value={model}
                  onChange={(e) => setModel(e.target.value.trim())}
                  onClick={() => { if (liveModels.length > 0) setModelMenuOpen(true); }}
                  className="w-full min-w-0 border border-[var(--border)] bg-[var(--bg)] py-1.5 pl-2 pr-7 text-xs text-[var(--fg)] outline-none focus:border-[var(--fg)]"
                />
                {/* ▾ 内嵌在输入框右侧；未拉取到列表时禁用并说明原因 */}
                <button
                  type="button"
                  disabled={liveModels.length === 0}
                  onClick={() => setModelMenuOpen((v) => !v)}
                  aria-label={lang === 'zh' ? '展开已获取的模型列表' : 'Open the fetched model list'}
                  title={liveModels.length > 0
                    ? (lang === 'zh' ? '展开已获取的模型列表' : 'Open the fetched model list')
                    : (lang === 'zh' ? '先点「获取模型」拉取可用列表' : 'Click "Fetch models" first')}
                  className="tap-icon absolute right-0.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center text-[var(--muted)] transition-colors hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${modelMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {modelMenuOpen && liveModels.length > 0 && (
                  <div
                    id="ai-model-listbox"
                    role="listbox"
                    className="absolute left-0 right-0 top-full mt-1 z-20 max-h-44 overflow-y-auto border border-[var(--border)] bg-[var(--bg)] shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                  >
                    {liveModels.map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="option"
                        aria-selected={modelMatches(m)}
                        onClick={() => { setModel(m); setModelMenuOpen(false); }}
                        className={`w-full text-left px-2.5 py-1.5 text-xs mono-font transition-colors ${
                          modelMatches(m)
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
              <button
                type="button"
                onClick={fetchModelList}
                disabled={fetching}
                aria-label={lang === 'zh' ? '获取模型' : 'Fetch models'}
                title={lang === 'zh' ? '列出该服务商实际可用的模型（不验证能否对话）' : 'List the models this provider offers (does not verify chat)'}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap border border-[var(--border)] px-2 py-1.5 text-[0.6875rem] mono-font text-[var(--muted)] transition-colors hover:border-[var(--fg)] hover:text-[var(--fg)] disabled:opacity-50"
              >
                <List className="w-3 h-3" aria-hidden="true" />
                {fetching ? (lang === 'zh' ? '获取中…' : 'Fetching…') : (lang === 'zh' ? '获取模型' : 'Fetch')}
              </button>
              <button
                type="button"
                onClick={testConnection}
                disabled={testing}
                aria-label={lang === 'zh' ? '测试连接' : 'Test connection'}
                title={lang === 'zh' ? '发一次极小的对话请求，验证 Key / 端点 / 模型能否正常使用' : 'Send one tiny chat request to verify key, endpoint and model'}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap border border-[var(--border)] px-2 py-1.5 text-[0.6875rem] mono-font text-[var(--muted)] transition-colors hover:border-[var(--fg)] hover:text-[var(--fg)] disabled:opacity-50"
              >
                <PlugZap className="w-3 h-3" aria-hidden="true" />
                {testing ? (lang === 'zh' ? '测试中…' : 'Testing…') : (lang === 'zh' ? '测试连接' : 'Test')}
              </button>
            </div>
            <p className="text-[0.625rem] text-[var(--muted)] mt-1 leading-snug">
              {lang === 'zh'
                ? '「获取模型」列出该家可用模型；「测试连接」发一次极小请求验证能否对话（消耗极少量 token）。'
                : '"Fetch models" lists what the provider offers; "Test connection" sends one tiny request to confirm it replies (a few tokens).'}
            </p>
            {/* 常用气泡：数据源为当前服务商自己的模型清单，不联网也能填；与输入框内容完全一致时高亮 */}
            {provider.models.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[0.625rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '常用：' : 'Common:'}</span>
                {provider.models.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModel(m)}
                    aria-pressed={modelMatches(m)}
                    className={`px-1.5 py-0.5 text-[0.625rem] mono-font border transition-colors ${modelMatches(m)
                      ? 'border-[var(--fg)] text-[var(--fg)] bg-[var(--accent-light)] font-bold'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 思考强度：三档；可用档位由当前模型的能力表决定，不可用档位置灰并说明原因 */}
          <div>
            <p className="text-[0.6875rem] mono-font text-[var(--muted)] mb-1">{lang === 'zh' ? '思考强度' : 'Thinking effort'}</p>
            <div className="flex flex-wrap gap-1.5">
              {THINKING_TIERS.map((t) => {
                // 只有「模型有档位集合但缺这一档」才置灰；其余情况三档都可点，保证点击有反馈
                const usable = !tierLocked(t.id);
                const selected = usable && selectedEffort === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!usable}
                    aria-pressed={selected}
                    title={usable ? undefined : (lang === 'zh' ? '当前模型不支持该档位' : 'Not available for this model')}
                    onClick={() => setThinkingEffort(t.id)}
                    className={`px-2 py-1 text-[0.6875rem] mono-font border transition-colors ${selected
                      ? 'border-[var(--fg)] text-[var(--fg)] bg-[var(--accent-light)] font-bold'
                      : usable
                        ? 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        : 'border-[var(--border)] text-[var(--muted)] opacity-40 cursor-not-allowed'}`}
                  >
                    {selected ? '● ' : ''}{lang === 'zh' ? t.zh : t.en}
                  </button>
                );
              })}
            </div>
            {/* 留痕：当前档位 + 本次实际下发的参数（与请求体同源，永不与实际不一致） */}
            <p className="text-[0.625rem] mono-font text-[var(--fg)] mt-1 leading-snug">
              {sentDesc
                ? (lang === 'zh'
                    ? `当前：${tierLabel(dispatch.effort ?? selectedEffort, 'zh')} · 本次下发 ${sentDesc}`
                    : `Active: ${tierLabel(dispatch.effort ?? selectedEffort, 'en')} · sending ${sentDesc}`)
                : (lang === 'zh'
                    ? '当前模型本次不下发任何思考参数。'
                    : 'No thinking parameter is sent for this model.')}
            </p>
            {/* 成本提示（浅灰小字，不占操作位）：档位只影响思考深度，不改变「只给线索」的刚性约束 */}
            <p className="text-[0.625rem] text-[var(--muted)] mt-1 leading-snug">
              {lang === 'zh'
                ? '深度思考会给出更充分的启发线索，但 Token 消耗显著增加；自带 Key 请留意额度。'
                : 'Deep thinking gives fuller hints but consumes noticeably more tokens — watch your own key quota.'}
            </p>
            {/* 模型能力说明：不能关闭 / 无力度档 / 不在支持范围 / 自定义端点走透传 */}
            {thinkingPlan?.note && (
              <p className="text-[0.625rem] text-[var(--muted)] mt-0.5 leading-snug">
                {THINKING_NOTE[thinkingPlan.note][lang === 'zh' ? 'zh' : 'en']}
              </p>
            )}
            {providerId === 'custom' && (
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={() => setExtraParamsOpen((v) => !v)}
                  className="inline-flex items-center gap-1 text-[0.625rem] mono-font text-[var(--muted)] hover:text-[var(--fg)]"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${extraParamsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  {lang === 'zh' ? '自定义请求参数（JSON，选填）' : 'Custom request params (JSON, optional)'}
                </button>
                {extraParamsOpen && (
                  <>
                    <textarea
                      value={extraParamsText}
                      onChange={(e) => setExtraParamsText(e.target.value)}
                      rows={3}
                      placeholder={'{"reasoning_effort": "high"}'}
                      className="mt-1 w-full border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs mono-font text-[var(--fg)] outline-none focus:border-[var(--fg)] resize-y"
                    />
                    {!extraParamsValid && (
                      <p className="text-[0.625rem] text-[var(--error)] mt-0.5 leading-snug">
                        {lang === 'zh' ? 'JSON 格式无效，已忽略（不影响保存与提问）' : 'Invalid JSON — ignored (saving and asking still work)'}
                      </p>
                    )}
                    <p className="text-[0.625rem] text-[var(--muted)] mt-0.5 leading-snug">
                      {lang === 'zh'
                        ? '注意：部分模型在深度思考模式下会忽略 temperature 等采样参数（不报错，但不生效）。'
                        : 'Note: in deep-thinking mode some models ignore sampling parameters such as temperature (no error, just no effect).'}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 累计 token 用量（跨会话；一行总数，明细点开树状图） */}
          <div className="border border-[var(--border)] px-2.5 py-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.625rem] mono-font font-bold text-[var(--fg)] tracking-widest">
                {lang === 'zh' ? '累计用量' : 'Total usage'}
              </p>
              <span className="flex items-center gap-2">
                {tokenUsageTotalCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowTokenUsage(true)}
                    title={lang === 'zh' ? '查看每日用量明细' : 'View daily usage'}
                    aria-label={lang === 'zh' ? '用量明细' : 'Usage details'}
                    className="inline-flex items-center gap-0.5 text-[0.625rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
                  >
                    <Coins className="w-3 h-3" aria-hidden="true" />
                    {lang === 'zh' ? '明细' : 'Detail'}
                  </button>
                )}
                {tokenUsageTotalCount > 0 && (
                  <button
                    type="button"
                    onClick={() => { clearTokenUsage(); refreshTokenUsage(); }}
                    className="text-[0.625rem] mono-font text-[var(--muted)] underline hover:text-[var(--error)] transition-colors"
                  >
                    {lang === 'zh' ? '清零' : 'Reset'}
                  </button>
                )}
              </span>
            </div>
            <p className="text-[0.625rem] mono-font text-[var(--muted)] leading-snug">
              {tokenUsageTotalCount > 0
                ? (lang === 'zh'
                    ? `累计消耗 ≈ ${tokenUsageTotalCount.toLocaleString()} tokens（本地估算值，非服务商账单口径；实际计费以服务商后台为准）`
                    : `≈ ${tokenUsageTotalCount.toLocaleString()} tokens in total (local estimate, not the provider\'s billing figure — check your provider dashboard for actual charges)`)
                : (lang === 'zh' ? '还没有使用记录。对话、出题、AI 总结的消耗会累计在这里。' : 'No usage yet. Chat, quiz and AI-summary usage will accumulate here.')}
            </p>
          </div>

          {/* 配置是否已生效：未保存时明说，提问用的永远是已保存的那份 */}
        {!formMatchesSaved && (
          <p className="text-[0.625rem] leading-snug text-[var(--muted)] border border-[var(--border)] px-2 py-1.5">
            {config
              ? (lang === 'zh' ? '当前填写尚未保存：请点「保存」，否则提问仍使用上一次保存的配置。' : 'Unsaved changes: press Save, or asking will use the previously saved config.')
              : (lang === 'zh' ? '还没有保存过配置：先「测试连接」，确认可用后点「保存」。' : 'Nothing saved yet: run Test connection, then press Save.')}
          </p>
        )}
        {/* 操作栏：吸底常驻——表单再长也不会把「保存」挤出可见范围 */}
          <div className="sticky bottom-0 z-10 -mx-4 px-4 pb-4 pt-2 space-y-1.5 bg-[var(--bg)] border-t border-[var(--border)]">
            <div className="flex items-center gap-2">
            {config ? (
              <button type="button" onClick={() => setView('chat')} className="tap-primary px-3 py-1.5 text-xs mono-font border border-[var(--border)] hover:border-[var(--fg)] transition-colors">
                {lang === 'zh' ? '返回对话' : 'Back to chat'}
              </button>
            ) : (
              <button type="button" onClick={() => setOpen(false)} className="tap-primary px-3 py-1.5 text-xs mono-font border border-[var(--border)] hover:border-[var(--fg)] transition-colors">
                {lang === 'zh' ? '关闭' : 'Close'}
              </button>
            )}
            <button type="button" onClick={save} className="tap-primary px-3 py-1.5 text-xs mono-font font-bold border border-[var(--fg)] text-[var(--fg)] transition-colors hover:bg-[var(--fg)] hover:text-[var(--card-bg)]">
              {lang === 'zh' ? '保存' : 'Save'}
            </button>
            <button type="button" onClick={clearAll} title={lang === 'zh' ? '清除 AI 配置、问答历史与答题统计（错题集请在「学习记录」中单独清空）' : 'Clear AI config, chat history and quiz stats (clear the mistake set separately under Records)'} className="ml-auto inline-flex items-center gap-1 text-[0.6875rem] mono-font text-[var(--muted)] hover:text-[var(--fg)]">
              <Trash2 className="w-3 h-3" />
              {lang === 'zh' ? '清除 AI 配置与记录' : 'Clear AI data'}
            </button>
            </div>
            {testResult && (
              <p className={`text-[0.6875rem] mono-font ${testResult.ok ? 'text-[var(--fg)]' : 'text-[var(--error)]'}`}>{testResult.msg}</p>
            )}
          </div>
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
                          {renderSpeakControls(h.answer, h.topic)}
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
                        className="p-1.5 -m-1.5 text-[var(--muted)] hover:text-[var(--fg)] text-lg leading-none"
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
                              className={`px-1.5 py-0.5 text-[0.625rem] mono-font border transition-colors ${paperOpts.blankLevel === id ? 'border-[var(--fg)] text-[var(--fg)] bg-[var(--accent-light)] font-bold' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}
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
                              className={`px-1.5 py-0.5 text-[0.625rem] mono-font border transition-colors ${paperOpts.sortMode === id ? 'border-[var(--fg)] text-[var(--fg)] bg-[var(--accent-light)] font-bold' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}
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
                        className="tap-primary px-3 py-1.5 text-xs mono-font border border-[var(--border)] hover:border-[var(--fg)] transition-colors"
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
                    </>
                  )}
                  {hasQuizFilter && (
                    <button
                      type="button"
                      onClick={() => { setQuizSubjFilter(null); setQuizTopicFilter(null); }}
                      className="ml-auto text-[0.625rem] mono-font text-[var(--muted)] underline hover:text-[var(--fg)]"
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
                                    {isAnswer && <span className="ml-1 text-[0.625rem] mono-font text-[var(--success)]">{lang === 'zh' ? '✓ 正确答案' : '✓ Answer'}</span>}
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
                        className="flex-1 border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] outline-none focus:border-[var(--fg)] disabled:opacity-60"
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
                            ? (lang === 'zh' ? '⏱ 超时未作答' : '⏱ Timed out')
                            : quizSelected === 0
                              ? (lang === 'zh' ? '✓ 回答正确' : '✓ Correct')
                              : (lang === 'zh' ? `✗ 正确答案：${quizQ.fillAnswers.join(' 或 ')}` : `✗ Correct answer: ${quizQ.fillAnswers.join(' or ')}`)}
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
          {/* 移动端内层原 60dvh 会先于抽屉的 85dvh 到顶，白白浪费约 25% 的高度配额 */}
          <div ref={answerRef} className="flex-1 overflow-y-auto overscroll-contain min-h-[150px] max-h-none p-3 space-y-2.5 text-sm serif-font">
            {history.length > 0 || answer || pending || busy || error ? (
              <>
                {/* 多轮历史（内存态，同页内可回看；关页/切页即清） */}
                {history.map((h, i) => (
                  <div key={i} className="space-y-1.5">
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
                      <div className="inline-block max-w-[95%] px-2.5 py-1.5 border border-[var(--border)] text-left text-xs leading-relaxed whitespace-pre-wrap ai-answer">
                        <AnswerRich text={h.assistant} />
                        {renderSpeakControls(h.assistant, aiCtx.topic)}
                      </div>
                    </div>
                  </div>
                ))}
                {/* 当前轮（流式显示中） */}
                {(answer || pending || busy || error) && (
                  <>
                    <p className="text-[0.625rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '问题' : 'Question'}: <InlineAnswer text={pending || currentQuestion || ''} /></p>
                    {(answer || pending || busy) && (
                    <div className="text-left">
                      {/* AI 的思考草稿（部分模型才有）：默认折叠，思考中自动展开；拿不到就不渲染 */}
                      {reasoning && renderReasoning(reasoning, reasoningSec, 'live')}
                      <div className={`inline-block max-w-[95%] px-2.5 py-1.5 ${answer ? 'border border-[var(--border)]' : ''} text-left text-xs leading-relaxed whitespace-pre-wrap ai-answer`}>
                        {answer ? (
                          <div style={{ animation: 'answer-fade-in 0.2s ease' }}>
                            <AnswerRich text={answer} />
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
      </>)}
    </div>
    {/* token 用量明细树状图（设置页「明细」点开；portal 到 body） */}
    {showTokenUsage && (
      <TokenUsageDialog usage={tokenUsage} lang={lang} onClose={() => setShowTokenUsage(false)} />
    )}
    </>
  );
}