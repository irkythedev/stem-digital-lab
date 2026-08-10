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
import { BookOpen, Coins, Eye, EyeOff, Scale, Settings, ShieldCheck, Trash2 } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { labMap } from '../../lib/labs';
import { useAiContext } from '../../lib/ai-context';
import {
  AI_PROVIDERS, buildSystemPrompt, clearAiConfig, fetchModels, isNetworkError, loadAiConfig, normalizeBaseUrl, saveAiConfig, streamChat,
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
    .slice(0, 3);
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
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('');
  const [liveModels, setLiveModels] = useState<string[]>([]);
  const [modelNote, setModelNote] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  // 由 AI 推荐驱动的追问：当前回答 / 推荐追问列表 / 待发问题 / 上一轮问答（内存）
  const [answer, setAnswer] = useState('');
  const [recs, setRecs] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastExchange = useRef<{ user: string; assistant: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
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

  // 回答区自动滚底
  useEffect(() => {
    answerRef.current?.scrollTo({ top: answerRef.current.scrollHeight, behavior: 'smooth' });
  }, [answer]);

  // 切换预设
  const selectProvider = (id: string) => {
    setProviderId(id);
    setModel('');
    setLiveModels([]);
    setModelNote(null);
    setTestResult(null);
  };

  // 测试连接
  const testConnection = async () => {
    if (!apiKey.trim()) { setTestResult({ ok: false, msg: lang === 'zh' ? '请先填写 API Key' : 'Enter an API key first' }); return; }
    setTesting(true);
    setTestResult(null);
    const baseUrl = normalizeBaseUrl(providerId === 'custom' ? (document.getElementById('ai-custom-url') as HTMLInputElement)?.value.trim() || '' : provider.baseUrl);
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 8 }),
      });
      if (res.ok) {
        setTestResult({ ok: true, msg: lang === 'zh' ? '连接成功 ✓' : 'Connected ✓' });
        try {
          const ids = await fetchModels(baseUrl, apiKey);
          if (ids.length) {
            setLiveModels(ids);
            setModel(ids[0]);
            setModelNote(lang === 'zh' ? `已获取 ${ids.length} 个可用模型` : `${ids.length} models available`);
          } else {
            setModelNote(lang === 'zh' ? '服务商未返回模型列表，可手输模型名' : 'No models returned — type one manually');
          }
        } catch {
          setLiveModels([]);
          setModelNote(lang === 'zh' ? '无法获取模型列表，可手输模型名' : 'Could not list models — type one manually');
        }
      } else {
        const j = await res.json().catch(() => null);
        const detail = (j?.error?.message || `HTTP ${res.status}`).slice(0, 80);
        setTestResult({
          ok: false,
          msg:
            res.status === 404
              ? (lang === 'zh' ? '端点返回 404：请检查 API 地址是否正确（路径或版本可能有差异）' : 'Endpoint returned 404: check that the API URL is correct (path or version may differ)')
              : detail,
        });
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
    const baseUrl = normalizeBaseUrl(providerId === 'custom' ? (document.getElementById('ai-custom-url') as HTMLInputElement)?.value.trim() || '' : provider.baseUrl);
    if (!apiKey.trim() || !baseUrl) { setTestResult({ ok: false, msg: lang === 'zh' ? '请填写 API Key 与端点地址' : 'Fill in API key and endpoint' }); return; }
    if (!model.trim()) { setTestResult({ ok: false, msg: lang === 'zh' ? '请填写或选择模型' : 'Choose or type a model' }); return; }
    const cfg: AiConfig = { providerId, apiKey: apiKey.trim(), baseUrl, model, agreed: true };
    saveAiConfig(cfg);
    setConfigured(true);
    setConfig(cfg);
    setView('chat');
  };

  // 清除全部 AI 数据
  const clearAll = () => {
    clearAiConfig();
    setConfigured(false);
    setConfig(null);
    setView('terms');
    setApiKey('');
    lastExchange.current = null;
  };

  // 发送单轮问题（followUp=true 时携带上一轮问答作为上下文）
  const sendQuestion = async (text: string, followUp = false) => {
    const q = text.trim();
    if (!q || busy || !config) return;
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
    try {
      const full = await streamChat(config, messages, (delta) => setAnswer((a) => a + delta), abortRef.current.signal);
      const { body, recs: parsedRecs } = parseRecQuestions(full);
      setAnswer(body);
      setRecs(parsedRecs);
      lastExchange.current = { user: q, assistant: full };
    } catch (e) {
      const msg = (e as Error).message;
      if (!msg.includes('abort')) {
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

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="fixed z-50 w-[calc(100vw-2rem)] max-w-sm border border-[var(--border)] bg-[var(--bg)] shadow-[0_8px_24px_rgba(0,0,0,0.15)] flex flex-col"
      style={pos ? { left: pos.x, top: pos.y } : { top: '3.5rem', right: '1rem' }}
      role="dialog"
      aria-label="AI assistant"
    >
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] cursor-move touch-none select-none"
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={onTitlePointerUp}
      >
        <h2 className="text-xs font-bold tracking-widest mono-font uppercase">// {lang === 'zh' ? 'AI 学习助手' : 'AI Assistant'}</h2>
        <div className="flex items-center gap-2">
          {config && (
            <button type="button" onClick={() => setView(view === 'chat' ? 'settings' : 'chat')} aria-label="Settings" className="text-[var(--muted)] hover:text-[var(--fg)]">
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" onClick={() => { setOpen(false); setPending(null); }} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--fg)] text-lg leading-none">×</button>
        </div>
      </div>

      {view === 'terms' ? (
        /* ── 第一步：使用须知（先同意才能进入设置） ── */
        <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
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
                  <p className="flex items-center gap-1.5 font-bold text-[var(--fg)]"><Coins className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />1. 服务性质与费用</p>
                  <p>本站为纯前端静态页面，<strong className="font-bold text-[var(--fg)]">仅提供对话界面，不提供任何 AI 大模型服务</strong>，也不收取任何费用。您需自行注册并管理所选 AI 服务商的 API，相关费用由您与服务商结算。</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 font-bold text-[var(--fg)]"><ShieldCheck className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />2. 数据与隐私安全</p>
                  <p>您的 API Key 仅保存在您本机浏览器的本地存储中。本站<strong className="font-bold text-[var(--fg)]">无后端服务器，不采集、不存储、不中转</strong>任何密钥或对话内容。对话数据由您的浏览器直接发送至您所选的服务商。请妥善保管您的 API Key，防范泄露风险。</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 font-bold text-[var(--fg)]"><BookOpen className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />3. 学习辅助声明</p>
                  <p>本 AI 助手专为初中数理化学习辅助设计。AI 生成的内容存在不准确的可能，<strong className="font-bold text-[var(--fg)]">仅供参考，请务必以学校教材和任课老师的讲解为准</strong>。未成年人请在监护人的指导下配置和使用。</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 font-bold text-[var(--fg)]"><Scale className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />4. 合规与责任限制</p>
                  <p>请合法合规使用本工具，严禁用于生成或传播任何违法违规内容。由于网络环境或服务商跨域（CORS）限制导致的连接问题，本站无法干预。因使用本工具及所选 AI 服务产生的相关权责，<strong className="font-bold text-[var(--fg)]">由您与服务商自行承担</strong>。</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="flex items-center gap-1.5 font-bold text-[var(--fg)]"><Coins className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />1. Service nature and fees</p>
                  <p>This site is a pure front-end static page that <strong className="font-bold text-[var(--fg)]">only provides the chat UI — no AI model service</strong>, no fees. You register and manage the API of your chosen provider yourself; fees are settled with that provider.</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 font-bold text-[var(--fg)]"><ShieldCheck className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />2. Data and privacy</p>
                  <p>Your API key stays only in your browser's local storage. This site <strong className="font-bold text-[var(--fg)]">has no backend — it never collects, stores or relays</strong> keys or conversations. Chat data goes straight from your browser to your chosen provider. Keep your key safe.</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 font-bold text-[var(--fg)]"><BookOpen className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />3. Learning aid only</p>
                  <p>This assistant is for middle-school science learning only. AI output may be inaccurate — <strong className="font-bold text-[var(--fg)]">for reference; always defer to the textbook and your teacher</strong>. Minors should configure and use it under a guardian's guidance.</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 font-bold text-[var(--fg)]"><Scale className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />4. Compliance and liability</p>
                  <p>Use this tool lawfully; never generate or spread unlawful content. Connection issues caused by network or provider CORS restrictions are outside this site's control. Responsibility for using this tool and your chosen AI service <strong className="font-bold text-[var(--fg)]">lies with you and that provider</strong>.</p>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setView('settings')}
            className="w-full mt-1 px-3 py-2 text-xs mono-font border border-[var(--fg)] text-[var(--fg)] transition-colors"
          >
            {lang === 'zh' ? '我同意并继续 →' : 'I agree and continue →'}
          </button>
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
              <input id="ai-custom-url" type="text" placeholder="https://your-proxy.example.com/v1 或完整端点 /chat/completions" className="w-full border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--fg)] outline-none focus:border-[var(--fg)]" />
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
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--fg)] outline-none"
                >
                  {liveModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
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
                  placeholder={lang === 'zh' ? '测试连接成功后自动列出可用模型，或手动输入…' : 'Model list appears after a successful test, or type one…'}
                  value={model}
                  onChange={(e) => setModel(e.target.value.trim())}
                  className="w-full border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--fg)] outline-none focus:border-[var(--fg)]"
                />
                {!modelNote && (
                  <p className="text-[10px] text-[var(--muted)] mt-1">
                    {lang === 'zh' ? '提示：先「测试连接」，成功后自动列出该服务商实际可用的模型' : 'Tip: run "Test" first — available models are listed automatically'}
                  </p>
                )}
              </>
            )}
          </div>

          {/* 操作 */}
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={testConnection} disabled={testing} className="px-3 py-1.5 text-xs mono-font border border-[var(--border)] hover:border-[var(--fg)] transition-colors disabled:opacity-50">
              {testing ? (lang === 'zh' ? '测试中…' : 'Testing…') : lang === 'zh' ? '测试连接' : 'Test'}
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
            {answer || pending || busy ? (
              <>
                <p className="text-[10px] mono-font text-[var(--muted)]">{lang === 'zh' ? '问题' : 'Question'}: {pending || lastExchange.current?.user || ''}</p>
                <div className="text-left">
                  <div className="inline-block max-w-[95%] px-2.5 py-1.5 border border-[var(--border)] text-left text-xs leading-relaxed whitespace-pre-wrap">
                    {answer || (lang === 'zh' ? '思考中…' : 'Thinking…')}
                  </div>
                </div>
                {error && <p className="mt-1 text-[11px] text-[var(--error)] mono-font">{error}</p>}
                {/* AI 推荐的追问（由 prompt 约束生成，内容可控） */}
                {!busy && recs.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[10px] mono-font text-[var(--muted)] mb-1.5">
                      {lang === 'zh' ? '可以继续了解：' : 'You can also explore:'}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {recs.map((q, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => askRecommended(q)}
                          className="text-left text-[11px] serif-font px-2.5 py-1.5 border border-[var(--border)] hover:border-[var(--fg)] transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-[var(--muted)] italic text-center pt-6">
                {lang === 'zh'
                  ? '点击页面上的「问 AI」按钮，AI 会结合当前内容为您讲解'
                  : 'Tap "Ask AI" on a page — the assistant explains the current content'}
              </p>
            )}
            {busy && (
              <div className="pt-1 flex justify-end">
                <button type="button" onClick={() => abortRef.current?.abort()} className="text-[10px] mono-font text-[var(--muted)] hover:text-[var(--fg)] underline">
                  {lang === 'zh' ? '停止' : 'Stop'}
                </button>
              </div>
            )}
          </div>
          <div className="border-t border-[var(--border)] px-3 py-2">
            <p className="text-[10px] text-[var(--muted)] leading-relaxed">
              {lang === 'zh' ? 'AI 生成内容仅供参考，请以教材和老师讲解为准 · 问答不保存，关页即清 · 追问由 AI 推荐' : 'AI output is for reference — trust the textbook · Answers are not saved · Follow-ups are AI-recommended'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
