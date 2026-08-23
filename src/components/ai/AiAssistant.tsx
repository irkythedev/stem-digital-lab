/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 学习助手（Header 入口，右上角面板）——单轮问答 + 链式追问，不保留历史。
 *
 * 合规设计：
 * - 无对话历史存储（不写 localStorage/sessionStorage）——数据留存问题从根上消除；
 * - 单轮问答：每次提问独立，仅「继续问」时携带上一轮问答作为参考（内存态，关页即清）；
 * - 首次使用：先阅读使用须知，点「我同意并继续」才进入设置（两步流程）；
 * - 用户自带 API Key（仅存本机 localStorage），本站不提供、不记录；
 * - 自动注入当前页面知识（AiContext）到系统提示词，避免 AI 自由发挥；
 * - 免责声明常驻：AI 生成内容仅供参考，请以教材和老师讲解为准。
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BookOpen, ChevronDown, Coins, Eye, EyeOff, Scale, Settings, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { labMap } from '../../lib/labs';
import { useAiContext } from '../../lib/ai-context';
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
  if (idx === -1) return { body: text, recs: [] };
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
  const location = useLocation();
  const { open, setOpen, configured, setConfigured, aiCtx, ask, setAsk } = useAiContext();
  const [config, setConfig] = useState<AiConfig | null>(() => loadAiConfig());
  const [view, setView] = useState<'terms' | 'settings' | 'chat'>('terms');
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
  // 用量统计（估算）：会话累计 token 数 + 最近一轮输出速度（对话完成时更新，视觉低调）
  const [usage, setUsage] = useState<{ tokens: number; speed: number } | null>(null);
  // 同页内多轮问答历史（内存态，上限 20 条；关闭面板/切换页面时清空——对齐"关页即清"承诺）
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [pending, config]); // eslint-disable-line react-hooks/exhaustive-deps

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
          const outTokens = Math.round(received / 1.8);
          setUsage({
            tokens: baseTokens + promptTokens + outTokens,
            speed: Math.round(outTokens / elapsedSec),
          });
        },
        abortRef.current.signal,
      );
      const { body, recs: parsedRecs } = parseRecQuestions(full);
      setAnswer(body);
      setRecs(parsedRecs);
      lastExchange.current = { user: q, assistant: full };
      // 入历史（上限 HISTORY_MAX，超出丢最旧）
      setHistory((h) => [...h.slice(-(HISTORY_MAX - 1)), { user: q, assistant: full }]);
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
      { role: 'user', content: lang === 'zh' ? '请仅针对刚才讨论的主题，换一批给出 3 个不同的追问问题（每行一个，编号 1. 2. 3.，不要解释）' : 'Give 3 different follow-up questions on the topic just discussed (one per line, numbered 1. 2. 3., no explanation)' },
    ];
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

  // 面板位置：记忆的 pos 若超出当前视口（如桌面拖动保存后切到小屏/移动端），回退右上默认位置
  const safePos =
    pos && typeof window !== 'undefined' && pos.x >= 8 && pos.y >= 8 && pos.x < window.innerWidth - 120 && pos.y < window.innerHeight - 80
      ? pos
      : null;

  return (
    <div
      ref={panelRef}
      className="fixed z-50 w-[calc(100vw-2rem)] border border-[var(--border)] bg-[var(--bg)] shadow-[0_8px_24px_rgba(0,0,0,0.15)] flex flex-col"
      style={{
        width: Math.min(width, typeof window !== 'undefined' ? window.innerWidth - 16 : width),
        ...(height > 0 ? { height } : {}),
        ...(safePos ? { left: safePos.x, top: safePos.y } : { top: '3.5rem', right: '1rem' }),
      }}
      role="dialog"
      aria-label="AI assistant"
    >
      {/* 宽度拖拽把手（右侧边缘） */}
      <div
        className="absolute right-0 top-0 bottom-3 w-1.5 cursor-ew-resize touch-none z-10 hover:bg-[var(--fg)]/10 transition-colors"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        title={lang === 'zh' ? '拖拽调整宽度' : 'Drag to resize'}
      />
      {/* 右下角斜拉把手（同时调宽高） */}
      <div
        className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize touch-none z-20 flex items-end justify-end"
        onPointerDown={onCornerPointerDown}
        onPointerMove={onCornerPointerMove}
        onPointerUp={onCornerPointerUp}
        title={lang === 'zh' ? '斜拉调整宽高' : 'Drag corner to resize'}
      >
        <span className="w-2 h-2 border-r border-b border-[var(--muted)]" aria-hidden="true" />
      </div>
      {/* 保存成功 toast：面板顶部浮条 */}
      {savedToast && (
        <div className="absolute left-1/2 -translate-x-1/2 top-2.5 z-30 flex items-center gap-2 border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[11px] text-[var(--fg)] shadow-[0_4px_16px_rgba(0,0,0,0.12)] whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 update-dot" aria-hidden="true" />
          {lang === 'zh' ? '已保存 ✓' : 'Saved ✓'}
        </div>
      )}
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] cursor-move touch-none select-none"
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={onTitlePointerUp}
      >
        <h2 className="text-xs font-bold tracking-widest mono-font uppercase truncate max-w-[80%] inline-flex items-center gap-1.5">
          <span className="truncate">// {view === 'settings'
            ? (lang === 'zh' ? 'AI 设置' : 'Settings')
            : view === 'terms'
              ? (lang === 'zh' ? 'AI 学习助手' : 'AI Assistant')
              : (aiCtx.topic
                ? aiCtx.topic.replace(/[（(].*?[）)]/g, '') // 剥离年级等括号信息（如「实验（8-9 年级）」）
                : (pageSubject(location.pathname, lang) ?? (lang === 'zh' ? 'AI 学习助手' : 'AI Assistant')))}
          </span>
          <Sparkles className="w-3 h-3 shrink-0 text-[var(--fg)]" aria-hidden="true" />
        </h2>
        <div className="flex items-center gap-2">
          {config && (
            <button type="button" onClick={() => setView(view === 'chat' ? 'settings' : 'chat')}
              aria-label={view === 'chat' ? (lang === 'zh' ? '设置' : 'Settings') : (lang === 'zh' ? '返回对话' : 'Back to chat')}
              title={view === 'chat' ? (lang === 'zh' ? '设置' : 'Settings') : (lang === 'zh' ? '返回对话' : 'Back to chat')}
              className="text-[var(--muted)] hover:text-[var(--fg)]">
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" onClick={() => { resetConversation(); setOpen(false); setPending(null); }} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--fg)] text-lg leading-none">×</button>
        </div>
      </div>

      {view === 'terms' ? (
        /* ── 第一步：使用须知（先同意才能进入设置） ── */
        <div className="flex flex-col max-h-[60vh]">
          {/* 条款区：内容超高时独立滚动 */}
          <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-3">
          <p className="text-[11px] font-bold mono-font text-[var(--fg)] tracking-widest">
            {lang === 'zh' ? '使用须知' : 'Terms'}
          </p>
          <p className="border-l-4 border-l-[var(--error)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-3 py-2 text-[11px] text-[var(--error)] serif-font leading-relaxed">
            {lang === 'zh' ? '⚠ 使用 AI 助手前，请务必阅读并同意以下条款，再进行配置：' : '⚠ Please read and accept the terms below before configuring your AI service:'}
          </p>
          {pending && (
            <p className="text-[11px] text-[var(--fg)] serif-font leading-relaxed">
              {lang === 'zh' ? '您点击的问题将在配置完成后自动发送。' : 'Your question will be sent automatically once you finish the setup.'}
            </p>
          )}
          <div className="space-y-2 text-[11px] text-[var(--muted)] leading-relaxed">
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
        <div className="p-4 space-y-3 text-sm serif-font overflow-y-auto max-h-[60vh]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold mono-font text-[var(--fg)] tracking-widest">
              {lang === 'zh' ? 'AI 设置' : 'Settings'}
            </p>
            <button type="button" onClick={() => setView('terms')} className="text-[10px] mono-font text-[var(--muted)] underline hover:text-[var(--fg)]">
              {lang === 'zh' ? '查看须知' : 'View terms'}
            </button>
          </div>

          {/* 服务商预设 */}
          <div>
            <p className="text-[11px] mono-font text-[var(--muted)] mb-1.5">{lang === 'zh' ? '选择服务商' : 'Provider'}</p>
            <div className="flex flex-wrap gap-1.5">
              {AI_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProvider(p.id)}
                  className={`px-2 py-1 text-[11px] mono-font border transition-colors ${providerId === p.id ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            {provider.note && <p className="text-[10px] text-[var(--muted)] mt-1">{provider.note}</p>}
          </div>

          {/* 端点（自定义时显示） */}
          {providerId === 'custom' && (
            <div>
              <p className="text-[11px] mono-font text-[var(--muted)] mb-1">{lang === 'zh' ? 'Base URL（OpenAI 兼容）' : 'Base URL (OpenAI-compatible)'}</p>
              <input
                id="ai-custom-url"
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://your-proxy.example.com/v1 或完整端点 /chat/completions"
                className="w-full border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--fg)] outline-none focus:border-[var(--fg)]"
              />
            </div>
          )}

          {/* API Key */}
          <div>
            <p className="text-[11px] mono-font text-[var(--muted)] mb-1">{lang === 'zh' ? `API Key（${provider.name}）` : `API Key (${provider.name})`}</p>
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
            <p className="text-[11px] mono-font text-[var(--muted)] mb-1">
              {lang === 'zh' ? '模型' : 'Model'}
              {modelNote && <span className="ml-1.5 text-[10px] text-[var(--fg)]">({modelNote})</span>}
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
                  <p className="text-[10px] text-[var(--muted)] mt-1">
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
            <button type="button" onClick={clearAll} className="ml-auto inline-flex items-center gap-1 text-[11px] mono-font text-[var(--muted)] hover:text-[var(--fg)]">
              <Trash2 className="w-3 h-3" />
              {lang === 'zh' ? '清除全部' : 'Clear all'}
            </button>
          </div>
          {testResult && (
            <p className={`text-[11px] mono-font ${testResult.ok ? 'text-[var(--fg)]' : 'text-[var(--error)]'}`}>{testResult.msg}</p>
          )}
        </div>
      ) : (
        /* ── 由页面驱动 + AI 推荐追问（无自由输入） ── */
        <>
          <div ref={answerRef} className="flex-1 overflow-y-auto max-h-[42vh] min-h-[150px] p-3 space-y-2.5 text-sm serif-font">
            {history.length > 0 || answer || pending || busy ? (
              <>
                {/* 多轮历史（内存态，同页内可回看；关页/切页即清） */}
                {history.map((h, i) => (
                  <div key={i} className="space-y-1.5">
                    <p className="text-[10px] mono-font text-[var(--muted)]">{lang === 'zh' ? '问题' : 'Question'}: <InlineAnswer text={h.user} /></p>
                    <div className="text-left">
                      <div className="inline-block max-w-[95%] px-2.5 py-1.5 border border-[var(--border)] text-left text-xs leading-relaxed whitespace-pre-wrap ai-answer">
                        <AnswerRich text={h.assistant} />
                      </div>
                    </div>
                  </div>
                ))}
                {/* 当前轮（流式显示中） */}
                {(answer || pending || busy) && (
                  <>
                    <p className="text-[10px] mono-font text-[var(--muted)]">{lang === 'zh' ? '问题' : 'Question'}: <InlineAnswer text={pending || currentQuestion || ''} /></p>
                    <div className="text-left">
                      <div className="inline-block max-w-[95%] px-2.5 py-1.5 border border-[var(--border)] text-left text-xs leading-relaxed whitespace-pre-wrap ai-answer">
                        {answer ? <AnswerRich text={answer} /> : (lang === 'zh' ? '思考中…' : 'Thinking…')}
                      </div>
                    </div>
                  </>
                )}
                {error && (
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-[11px] text-[var(--error)] mono-font">{error}</p>
                    {/* 认证类错误：一键回设置修改配置 */}
                    {/authentication|invalid.*api|api key|401|403/i.test(error) && (
                      <button
                        type="button"
                        onClick={() => { setView('settings'); setError(null); }}
                        className="text-[11px] mono-font underline text-[var(--muted)] hover:text-[var(--fg)] shrink-0"
                      >
                        {lang === 'zh' ? '修改配置' : 'Fix config'}
                      </button>
                    )}
                  </div>
                )}
                {/* AI 推荐的追问（由 prompt 约束生成，内容可控；可翻页换一批） */}
                {!busy && recs.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[10px] mono-font text-[var(--muted)] mb-1.5">
                      {lang === 'zh' ? '可以继续了解：' : 'You can also explore:'}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {recs.slice(0, 3).map((q, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => askRecommended(q)}
                          className="text-left text-[11px] serif-font px-2.5 py-1.5 border border-[var(--border)] hover:border-[var(--fg)] transition-colors"
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
                        className="mt-1.5 text-[10px] mono-font text-[var(--muted)] underline hover:text-[var(--fg)] disabled:opacity-50"
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
                      className="inline-flex items-center gap-1.5 text-[11px] mono-font border border-[var(--border)] px-3 py-1.5 hover:border-[var(--fg)] transition-colors"
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
                <button type="button" onClick={() => { abortRef.current?.abort(); setBusy(false); }} className="text-[10px] mono-font text-[var(--muted)] hover:text-[var(--fg)] underline">
                  {lang === 'zh' ? '停止' : 'Stop'}
                </button>
              </div>
            )}
          </div>
          <div className="border-t border-[var(--border)] px-3 py-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[10px] text-[var(--muted)] leading-snug">
                {lang === 'zh' ? 'AI 内容仅供参考，以教材和老师讲解为准 · 问答暂不支持保存' : 'AI output is for reference — trust the textbook · Answers cannot be saved yet'}
              </p>
              {/* 当前模型名 + 用量统计（消耗起即显示，流式中 token 滚动增长） */}
              <p className="shrink-0 text-[9px] mono-font text-[var(--fg)]/80 tabular-nums whitespace-nowrap">
                {config?.model && <span className="mr-2">{config.model}</span>}
                {usage && <span>≈{usage.tokens.toLocaleString()} tokens{busy ? ' · 生成中…' : ` · ${usage.speed} t/s`}</span>}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
