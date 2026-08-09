/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 学习助手（Header 按钮触发，右上角面板）：
 * - 入口在 Header 右侧（版本号在左侧，无绿点遮挡问题）；
 * - 首次使用：先展示使用须知，点「我同意并继续」才进入配置表单（两步流程）；
 * - 用户自带 API Key（仅存本机 localStorage），本站不提供、不记录；
 * - 对话流式输出，会话记录仅存本机 sessionStorage（关页即清）；
 * - 自动注入当前页面知识（AiContext）到系统提示词，避免 AI 自由发挥；
 * - 免责声明常驻：AI 生成内容仅供参考，请以教材和老师讲解为准。
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Settings, Trash2 } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { labMap } from '../../lib/labs';
import { useAiContext } from '../../lib/ai-context';
import {
  AI_PROVIDERS, buildSystemPrompt, clearAiConfig, fetchModels, loadAiConfig, saveAiConfig, streamChat,
  type AiConfig, type AiProvider,
} from '../../lib/ai-config';

const SESSION_KEY = 'stem-ai-session';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

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
  const { open, setOpen, setConfigured, aiCtx } = useAiContext();
  const [config, setConfig] = useState<AiConfig | null>(() => loadAiConfig());
  const [view, setView] = useState<'terms' | 'settings' | 'chat'>('terms');
  const [providerId, setProviderId] = useState(AI_PROVIDERS[0].id);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(''); // 模型由测试连接后的实际列表决定，不预设
  /** 实际可用模型列表（测试连接成功后拉取）；空则用预设或手输 */
  const [liveModels, setLiveModels] = useState<string[]>([]);
  const [modelNote, setModelNote] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const provider: AiProvider = AI_PROVIDERS.find((p) => p.id === providerId) ?? AI_PROVIDERS[0];

  // 打开时：已配置 → 对话视图；未配置 → 须知视图（两步流程第一步）
  useEffect(() => {
    if (open) {
      setView(config ? 'chat' : 'terms');
      if (config) {
        const s = sessionStorage.getItem(SESSION_KEY);
        setMessages(s ? (JSON.parse(s) as ChatMsg[]) : []);
      }
    }
  }, [open, config]);

  // 消息列表自动滚底
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // 切换预设：自动带出模型列表
  const selectProvider = (id: string) => {
    setProviderId(id);
    setModel('');
    setLiveModels([]);
    setModelNote(null);
    setTestResult(null);
  };

  // 测试连接（成功则拉取实际模型列表）
  const testConnection = async () => {
    if (!apiKey.trim()) { setTestResult({ ok: false, msg: lang === 'zh' ? '请先填写 API Key' : 'Enter an API key first' }); return; }
    setTesting(true);
    setTestResult(null);
    const baseUrl = providerId === 'custom' ? (document.getElementById('ai-custom-url') as HTMLInputElement)?.value.trim() || '' : provider.baseUrl;
    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
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
        setTestResult({ ok: false, msg: (j?.error?.message || `HTTP ${res.status}`).slice(0, 80) });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: (e as Error).message.slice(0, 80) });
    }
    setTesting(false);
  };

  // 保存配置（已在第二步，同意已隐含）
  const save = () => {
    const baseUrl = providerId === 'custom' ? (document.getElementById('ai-custom-url') as HTMLInputElement)?.value.trim() || '' : provider.baseUrl;
    if (!apiKey.trim() || !baseUrl) { setTestResult({ ok: false, msg: lang === 'zh' ? '请填写 API Key 与端点地址' : 'Fill in API key and endpoint' }); return; }
    if (!model.trim()) { setTestResult({ ok: false, msg: lang === 'zh' ? '请填写或选择模型' : 'Choose or type a model' }); return; }
    const cfg: AiConfig = { providerId, apiKey: apiKey.trim(), baseUrl, model, agreed: true };
    saveAiConfig(cfg);
    setConfigured(true);
    setConfig(cfg);
    setView('chat');
    setMessages([]);
  };

  // 清除全部 AI 数据
  const clearAll = () => {
    clearAiConfig();
    sessionStorage.removeItem(SESSION_KEY);
    setConfigured(false);
    setConfig(null);
    setMessages([]);
    setView('terms');
    setApiKey('');
  };

  // 发送消息
  const send = async () => {
    const text = input.trim();
    if (!text || busy || !config) return;
    const next: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError(null);
    const assistant: ChatMsg = { role: 'assistant', content: '' };
    setMessages([...next, assistant]);
    abortRef.current = new AbortController();
    try {
      const full = await streamChat(
        config,
        [
          { role: 'system', content: buildSystemPrompt(lang, aiCtx.topic ?? pageSubject(location.pathname, lang), aiCtx.knowledge) },
          ...next.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ],
        (delta) => {
          assistant.content += delta;
          setMessages((prev) => [...prev.slice(0, -1), { ...assistant }]);
        },
        abortRef.current.signal,
      );
      assistant.content = full;
      setMessages((prev) => [...prev.slice(0, -1), { ...assistant }]);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify([...next, { role: 'assistant', content: full }]));
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('abort')) {
        // 用户主动停止：保留已生成的部分回答
        if (assistant.content) {
          setMessages((prev) => [...prev.slice(0, -1), { ...assistant }]);
          sessionStorage.setItem(SESSION_KEY, JSON.stringify([...next, { role: 'assistant', content: assistant.content }]));
        } else {
          setMessages((prev) => prev.slice(0, -1));
        }
      } else {
        setError((lang === 'zh' ? '请求失败：' : 'Request failed: ') + msg);
        setMessages((prev) => prev.slice(0, -1));
      }
    }
    setBusy(false);
  };

  const stop = () => abortRef.current?.abort();

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
            <p className="text-[11px] mono-font text-[var(--muted)] mb-1.5">{lang === 'zh' ? '选择服务商（仅限大陆可用）' : 'Provider (mainland China)'}</p>
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
              <input id="ai-custom-url" type="text" placeholder="https://your-proxy.example.com/v1" className="w-full border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--fg)] outline-none focus:border-[var(--fg)]" />
            </div>
          )}

          {/* API Key */}
          <div>
            <p className="text-[11px] mono-font text-[var(--muted)] mb-1">{lang === 'zh' ? `API Key（${provider.name}）` : `API Key (${provider.name})`}</p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--fg)] outline-none focus:border-[var(--fg)]"
            />
          </div>

          {/* 模型：仅显示测试连接后实际获取的模型，不预设 */}
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
                  value={liveModels.length > 0 && liveModels.includes(model) ? '' : model}
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
              {lang === 'zh' ? '保存并开始' : 'Save & start'}
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
        /* ── 对话视图 ── */
        <>
          <div ref={listRef} className="flex-1 overflow-y-auto max-h-[40vh] min-h-[160px] p-3 space-y-2.5 text-sm serif-font">
            {messages.length === 0 && (
              <p className="text-xs text-[var(--muted)] italic text-center pt-6">
                {lang === 'zh' ? '向 AI 提问数理化问题，如「为什么铁块会沉、轮船会浮？」' : 'Ask about math, physics or chemistry — e.g. "Why does iron sink but a ship floats?"'}
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                <div className={`inline-block max-w-[85%] px-2.5 py-1.5 border ${m.role === 'user' ? 'border-[var(--fg)]' : 'border-[var(--border)]'} text-left text-xs leading-relaxed whitespace-pre-wrap`}>
                  {m.content || '…'}
                </div>
              </div>
            ))}
            {error && <p className="text-[11px] text-[var(--error)] mono-font">{error}</p>}
          </div>
          <div className="border-t border-[var(--border)] p-2.5 space-y-1.5">
            <div className="flex items-end gap-1.5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                rows={2}
                placeholder={lang === 'zh' ? '输入问题…' : 'Ask a question…'}
                className="flex-1 border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--fg)] outline-none focus:border-[var(--fg)] resize-none"
              />
              {busy ? (
                <button type="button" onClick={stop} className="px-2.5 py-1.5 text-xs mono-font border border-[var(--border)] hover:border-[var(--fg)]">
                  {lang === 'zh' ? '停止' : 'Stop'}
                </button>
              ) : (
                <button type="button" onClick={() => void send()} className="px-2.5 py-1.5 text-xs mono-font border border-[var(--fg)] text-[var(--fg)]">
                  {lang === 'zh' ? '发送' : 'Send'}
                </button>
              )}
            </div>
            <p className="text-[10px] text-[var(--muted)] leading-relaxed">
              {lang === 'zh' ? 'AI 生成内容仅供参考，请以教材和老师讲解为准 · 对话仅存本机，关页即清' : 'AI output is for reference — trust the textbook · Chats stay on this device only'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
