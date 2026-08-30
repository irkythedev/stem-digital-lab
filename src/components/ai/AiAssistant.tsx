/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 学习助手（Header 入口，右上角面板）——单轮问答 + 链式追问 + 本地历史。
 *
 * 合规设计：
 * - 对话历史仅存用户本机浏览器（localStorage，上限 100 条，可随时清除）——数据不触网、不上传、不中转，清除浏览器数据即一并清除；
 * - 单轮问答：每次提问独立，仅「继续问」时携带上一轮问答作为参考（内存态，关页即清）；
 * - 同页会话（内存态，上限 20 条）随页面/主题切换清空；持久化历史独立保留、可查看；
 * - 首次使用：先阅读使用须知，点「我同意并继续」才进入设置（两步流程）；
 * - 用户自带 API Key（仅存本机 localStorage），本站不提供、不记录；
 * - 自动注入当前页面知识（AiContext）到系统提示词，避免 AI 自由发挥；
 * - 免责声明常驻：AI 生成内容仅供参考，请以教材和老师讲解为准。
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, ChevronDown, CircleX, Coins, Copy, Eye, EyeOff, History, Pause, Play, Scale, Settings, ShieldCheck, Sparkles, Square, Trash2, TriangleAlert, Volume2 } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';
import { useApp } from '../../lib/app-context';
import { useSpeak } from '../../lib/use-speak';
import { getTtsVoice } from '../../lib/tts-config';
import { labMap } from '../../lib/labs';
import { useAiContext } from '../../lib/ai-context';
import { clearHistory, listHistory, saveHistory, relativeTime, type AiHistoryEntry } from '../../lib/ai-history';
import AnswerRich, { InlineAnswer } from './AnswerRich';
import {
  AI_PROVIDERS, buildSystemPrompt, clearAiConfig, estimateTokens, fetchModels, isNetworkError, loadAiConfig, normalizeBaseUrl, saveAiConfig, streamChat,
  type AiConfig, type AiProvider,
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
  const { open, setOpen, configured, setConfigured, aiCtx, ask, setAsk } = useAiContext();
  useEffect(() => {
    if (!open) stopSpeak();
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
  const [view, setView] = useState<'terms' | 'settings' | 'chat' | 'history'>('terms');
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
    setPending(null); // 关键：清掉待发问题，防止切页后旧问题在新页面自动发送
    setAnswer('');
    setRecs([]);
    setCurrentQuestion('');
    setError(null);
    setUsage(null);
    setBusy(false);
    setHistory([]);
    lastExchange.current = null;
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
  useEffect(() => {
    if (open) setView(config ? 'chat' : 'terms');
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
                ? (lang === 'zh' ? '问答历史' : 'Q&A History')
                : (aiCtx.topic
                  ? aiCtx.topic.replace(/[（(].*?[）)]/g, '') // 剥离年级等括号信息（如「实验（8-9 年级）」）
                  : (pageSubject(location.pathname, lang) ?? (lang === 'zh' ? 'AI 学习助手' : 'AI Assistant')))}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {config && (
            <button type="button" onClick={() => setView(view === 'chat' ? 'settings' : 'chat')}
              aria-label={view === 'chat' ? (lang === 'zh' ? '设置' : 'Settings') : (lang === 'zh' ? '返回对话' : 'Back to chat')}
              title={view === 'chat' ? (lang === 'zh' ? '设置' : 'Settings') : (lang === 'zh' ? '返回对话' : 'Back to chat')}
              className="p-1.5 -m-1.5 text-[var(--muted)] hover:text-[var(--fg)]">
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
          {config && (
            <button type="button" onClick={() => { setView(view === 'chat' ? 'history' : 'chat'); setExpandedHistId(null); }}
              aria-label={view === 'history' ? (lang === 'zh' ? '返回对话' : 'Back to chat') : (lang === 'zh' ? '问答历史' : 'History')}
              title={view === 'history' ? (lang === 'zh' ? '返回对话' : 'Back to chat') : (lang === 'zh' ? '问答历史' : 'History')}
              className="p-1.5 -m-1.5 text-[var(--muted)] hover:text-[var(--fg)]">
              <History className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" onClick={() => { resetConversation(); setOpen(false); setPending(null); }} aria-label="Close" className="p-1.5 -m-1.5 text-[var(--muted)] hover:text-[var(--fg)] text-lg leading-none">×</button>
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
        /* ── 问答历史：纯本地持久化（localStorage，上限 100 条）── */
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* 隐私提示（与免责条同视觉层级） */}
          <p className="shrink-0 px-4 pt-2.5 flex items-center gap-1.5 text-[0.625rem] text-[var(--muted)] leading-snug">
            <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
            {lang === 'zh' ? '仅保存在本机浏览器 · 可随时清除' : 'Stored only in your browser · clearable anytime'}
          </p>
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-2">
            {persistHistory.length === 0 ? (
              <div className="pt-8 text-center space-y-2">
                <History className="w-6 h-6 mx-auto text-[var(--muted)]" aria-hidden="true" />
                <p className="text-xs text-[var(--muted)] italic">
                  {lang === 'zh' ? '暂无历史问答。提问后会自动保存在本机。' : 'No history yet. Questions you ask will be saved on this device.'}
                </p>
              </div>
            ) : (
              persistHistory.map((h) => (
                <div key={h.id} className="border border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setExpandedHistId(expandedHistId === h.id ? null : h.id)}
                    className="w-full text-left px-2.5 py-2 flex items-start justify-between gap-2 hover:bg-[var(--accent-light)]/40 transition-colors"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs serif-font leading-snug line-clamp-2">{h.question}</span>
                      <span className="block mt-0.5 text-[0.625rem] mono-font text-[var(--muted)]">
                        {relativeTime(h.ts, lang)}
                        {h.subject ? ` · ${h.subject}` : ''}
                        {h.topic && h.topic !== h.subject && !h.topic.includes(h.subject) ? ` · ${h.topic.replace(/[（(].*?[）)]/g, '')}` : ''}
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
                          {copiedId === h.id ? (lang === 'zh' ? '已复制 ✓' : 'Copied ✓')
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
              {lang === 'zh' ? `共 ${persistHistory.length} 条 · 自动保留最近 100 条` : `${persistHistory.length} items · keeps latest 100`}
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
          <div className="border-t border-[var(--border)] bg-[var(--accent-light)] px-3 py-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[0.625rem] text-[var(--muted)] leading-snug">
                <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                {lang === 'zh' ? 'AI 内容仅供参考，以教材和老师讲解为准 · 问答历史仅保存在本机浏览器，可随时清除' : 'AI output is for reference — trust the textbook · Chat history is stored only in your browser and can be cleared anytime'}
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