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
import { Eye, EyeOff, RotateCcw, Settings, Trash2 } from 'lucide-react';
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
  // 单轮问答：当前输入 / 当前回答 / 上一轮问答（链式追问，仅内存）
  const [input, setInput] = useState('');
  const [answer, setAnswer] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastExchange = useRef<{ user: string; assistant: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const answerRef = useRef<HTMLDivElement | null>(null);

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
      setInput(pending);
      void sendQuestion(pending);
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
      setAnswer(full);
      lastExchange.current = { user: q, assistant: full };
    } catch (e) {
      const msg = (e as Error).message;
      if (!msg.includes('abort')) {
        setError(
          isNetworkError(msg)
            ? (lang === 'zh' ? '网络无法访问该端点（不可达或浏览器直连被限制），请改用预设服务商或自建代理' : 'Cannot reach this endpoint (network or browser-direct restriction). Use a preset provider or your own proxy')
            : (lang === 'zh' ? '请求失败：' : 'Request failed: ') + msg,
        );
      }
    }
    setBusy(false);
  };

  const send = () => {
    void sendQuestion(input, true);
  };

  // 重新开始：清空上下文（新会话单轮）
  const restart = () => {
    lastExchange.current = null;
    setAnswer('');
    setInput('');
    setError(null);
  };

  if (!open) return null;

  return (
    <div
      className="fixed top-14 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm border border-[var(--border)] bg-[var(--bg)] shadow-[0_8px_24px_rgba(0,0,0,0.15)] flex flex-col"
      role="dialog"
      aria-label="AI assistant"
    >
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
        <h2 className="text-xs font-bold tracking-widest mono-font uppercase">// {lang === 'zh' ? 'AI 学习助手' : 'AI Assistant'}</h2>
        <div className="flex items-center gap-2">
          {config && (
            <button type="button" onClick={() => setView(view === 'chat' ? 'settings' : 'chat')} aria-label="Settings" className="text-[var(--muted)] hover:text-[var(--fg)]">
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--fg)] text-lg leading-none">×</button>
        </div>
      </div>

      {view === 'terms' ? (
        /* ── 第一步：使用须知（先同意才能进入设置） ── */
        <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
          <p className="text-[11px] font-bold mono-font text-[var(--fg)] tracking-widest">
            {lang === 'zh' ? '使用须知' : 'Terms'}
          </p>
          <ul className="text-[11px] text-[var(--muted)] leading-relaxed list-disc pl-4 space-y-1.5">
            {lang === 'zh' ? (
              <>
                <li>本站仅提供对话界面，不提供任何 AI 大模型服务、不收取任何费用。</li>
                <li>您需自行注册、购买并管理所选 AI 服务商的 API，费用由您与服务商结算。</li>
                <li>API Key 仅保存在您本机浏览器，本站不采集、不存储、不中转。</li>
                <li>对话由浏览器直接发送至所选服务商，本站无后端、不记录任何内容。</li>
                <li>AI 助手仅用于初中数理化学习辅助，生成内容仅供参考，请以教材和老师讲解为准。</li>
                <li>相关权责由您与所选 AI 服务商承担，与本站无关；请合理合法使用。</li>
              </>
            ) : (
              <>
                <li>This site only provides the chat UI — no AI service, no fees.</li>
                <li>Register, purchase and manage the API of your chosen provider yourself.</li>
                <li>Your API key stays in your browser only; this site never stores or relays it.</li>
                <li>Chats go directly to your provider; this site has no backend and logs nothing.</li>
                <li>The assistant is for middle-school science learning aid only; output is for reference — trust the textbook and your teacher.</li>
                <li>All responsibility lies with you and your chosen provider; use it lawfully.</li>
              </>
            )}
          </ul>
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
        /* ── 单轮问答视图（+ 链式追问，无历史存储） ── */
        <>
          <div ref={answerRef} className="flex-1 overflow-y-auto max-h-[40vh] min-h-[140px] p-3 text-sm serif-font">
            {answer || pending ? (
              <div className="text-left">
                <div className="inline-block max-w-[92%] px-2.5 py-1.5 border border-[var(--border)] text-left text-xs leading-relaxed whitespace-pre-wrap">
                  {answer || (lang === 'zh' ? '…' : '…')}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)] italic text-center pt-6">
                {lang === 'zh'
                  ? '点击页面上的「问 AI」按钮，或直接输入问题（如「为什么铁块会沉、轮船会浮？」）'
                  : 'Tap "Ask AI" on a page, or type a question (e.g. "Why does iron sink but a ship floats?")'}
              </p>
            )}
            {error && <p className="mt-2 text-[11px] text-[var(--error)] mono-font">{error}</p>}
            {/* 链式追问操作：继续问（携带上一轮）/ 重新开始（清空上下文） */}
            {answer && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-[var(--muted)]">
                  {lastExchange.current ? (lang === 'zh' ? '已带上一轮上下文' : 'Context from last turn kept') : ''}
                </span>
                <button type="button" onClick={restart} className="ml-auto inline-flex items-center gap-1 text-[10px] mono-font text-[var(--muted)] hover:text-[var(--fg)]">
                  <RotateCcw className="w-3 h-3" />
                  {lang === 'zh' ? '重新开始' : 'Restart'}
                </button>
              </div>
            )}
          </div>
          <div className="border-t border-[var(--border)] p-2.5 space-y-1.5">
            <div className="flex items-end gap-1.5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={2}
                maxLength={2000}
                placeholder={lang === 'zh' ? '输入问题…' : 'Ask a question…'}
                className="flex-1 border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--fg)] outline-none focus:border-[var(--fg)] resize-none"
              />
              {busy ? (
                <button type="button" onClick={() => abortRef.current?.abort()} className="px-2.5 py-1.5 text-xs mono-font border border-[var(--border)] hover:border-[var(--fg)]">
                  {lang === 'zh' ? '停止' : 'Stop'}
                </button>
              ) : (
                <button type="button" onClick={send} className="px-2.5 py-1.5 text-xs mono-font border border-[var(--fg)] text-[var(--fg)]">
                  {lang === 'zh' ? '提问' : 'Ask'}
                </button>
              )}
            </div>
            <p className="text-[10px] text-[var(--muted)] leading-relaxed">
              {lang === 'zh' ? 'AI 生成内容仅供参考，请以教材和老师讲解为准 · 问答不保存，关页即清' : 'AI output is for reference — trust the textbook · Answers are not saved'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
