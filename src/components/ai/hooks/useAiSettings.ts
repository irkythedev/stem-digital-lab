/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * useAiSettings —— AI 面板的设置域（模型配置 / 连通性检测 / 语音朗读 / 思考强度）。
 *
 * P1 阶段一产物：状态与处理器**逐字**从 AiAssistant.tsx 搬移（未改一个字符），
 * 只把「外部依赖」显式化为 deps 参数、「对外接口」显式化为返回值。
 * 不持有 view 状态机、不做跨域编排（clearAll 仍在主组件，遵守单一状态机）。
 * 面板 props 的 state/actions/refs 三袋在本 Hook 内构造：state 按值 memo、actions 走 useStable（身份恒定），
 * 面板 React.memo 因此生效。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStable } from '../panels/panel-shared';
import {
  AI_PROVIDERS, clearAiConfig, effectiveThinkingEffort, fetchModels, isTierLocked, keysByProviderOf,
  loadAiConfig, normalizeBaseUrl, resolveThinkingDispatch, saveAiConfig, thinkingPlanFor,
  type AiConfig, type AiProvider, type ThinkingEffort,
} from '../../../lib/ai-config';
import { reportAiFailure, reportAiSuccess } from '../../../lib/ai-status';
import { groupLocalVoices, loadTtsConfig, saveTtsConfig, type LocalVoice, type TtsConfig } from '../../../lib/tts-config';
import { useTtsPreview } from '../../../lib/use-tts-preview';
import { useTtsStatus } from '../../../lib/tts-status';
import type { Language, Translation } from '../../../lib/i18n';

/** 面板视图（主组件的单一状态机，这里只作只读依赖） */
type AiView = 'terms' | 'settings' | 'chat' | 'history' | 'quiz';

/** 主组件注入的外部依赖：全部是「主组件持有」的东西，Hook 不自造 */
export interface AiSettingsDeps {
  lang: Language;
  t: Translation;
  /** 当前视图：语音页进入时做一次探测、设置页进入时回填表单 */
  view: AiView;
  setView: (v: AiView) => void;
  setOpen: (open: boolean) => void;
  setConfigured: (v: boolean) => void;
  /** 顶栏健康卡片「去设置」的自增信号 */
  settingsSignal: number;
  /** 跨域共用的轻量 Toast（设置域与刷题域共用同一个出口） */
  flashToast: (ok: boolean, msg: string) => void;
  /** 跨会话累计 token 用量：对话 / 出题 / 设置页共读同一份 */
  refreshTokenUsage: () => void;
  tokenUsageTotalCount: number;
  setShowTokenUsage: (v: boolean) => void;
}

export default function useAiSettings(deps: AiSettingsDeps) {
  const { lang, t, view, setView, setOpen, setConfigured, settingsSignal, flashToast, refreshTokenUsage, tokenUsageTotalCount, setShowTokenUsage } = deps;
  const [config, setConfig] = useState<AiConfig | null>(() => loadAiConfig());
  const [providerId, setProviderId] = useState(AI_PROVIDERS[0].id);
  const [apiKey, setApiKey] = useState('');
  /** 语音朗读配置（默认端侧离线；云端为使用者自配的可选扩展，仅存本机） */
  const [ttsCfg, setTtsCfg] = useState<TtsConfig>(() => loadTtsConfig());
  /** 系统可用语音（设置面板里选端侧发音人） */
  const [localVoices, setLocalVoices] = useState<LocalVoice[]>([]);
  const groupedVoices = groupLocalVoices(localVoices);
  /** 设置视图内的 Tab：model = 大模型设置（默认）；speech = 语音朗读。切换不触发保存 */
  const [settingsTab, setSettingsTab] = useState<'model' | 'speech'>('model');
  /** 原位试听（独立于朗读主链路：试听失败不静默换声） */
  const ttsPreview = useTtsPreview();
  /** 语音通道状态（就绪 / 已降级 / 连接异常）：供状态胶囊与试听按钮共用 */
  const { status: ttsStatus } = useTtsStatus();
  /**
   * 打开语音页即做一次轻量探测：未核验就展示「就绪」等于虚报状态，故初始为「未检测」，
   * 由这次真实合成把它变成就绪 / 降级 / 异常。probe 自取已保存配置，不依赖 ttsCfg（避免输入时反复探测）。
   */
  useEffect(() => {
    if (view !== 'settings' || settingsTab !== 'speech' || ttsStatus !== 'unknown') return;
    void ttsPreview.probe();
  }, [view, settingsTab, ttsStatus, ttsPreview]);
  /** 云端 TTS 的 API Key 明文/隐藏切换（与大模型设置的 showKey 同一范式） */
  const [showTtsKey, setShowTtsKey] = useState(false);
  const updateTts = (patch: Partial<TtsConfig>) =>
    setTtsCfg((prev) => {
      const next = { ...prev, ...patch };
      saveTtsConfig(next);
      return next;
    });
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
  /** 输出上限输入框（文本态：留空 = 不下发 max_tokens；只接受数字） */
  const [maxTokensText, setMaxTokensText] = useState('');
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
  const settingsOpenedRef = useRef(false); // 标记面板由顶栏健康卡片「去设置」打开，open effect 不覆盖 view

  // 顶栏健康卡片「去设置」：自增信号 → 打开面板并直接落到设置视图（不回须知页）
  useEffect(() => {
    if (settingsSignal > 0) {
      settingsOpenedRef.current = true;
      setView('settings');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsSignal]);


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

  // 进入设置视图时回填已保存配置（刷新/重开不丢 provider/key/端点/模型）
  useEffect(() => {
    // 系统语音列表：部分浏览器要等 voiceschanged 才有（语音包异步加载）
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const readVoices = () => setLocalVoices((window.speechSynthesis.getVoices() || []) as unknown as LocalVoice[]);
    readVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', readVoices);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', readVoices);
  }, []);

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
      setMaxTokensText(typeof config.maxOutputTokens === 'number' && config.maxOutputTokens > 0 ? String(config.maxOutputTokens) : '');
      setTestResult(null);
    }
  }, [view]);

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
      // 注意：列出模型**不置绿**。GET /models 只证明「凭证与端点通」，不证明当前选的模型能对话；
      // 早期版本在这里调用 reportAiSuccess，导致「列表拿到了、模型名却不存在」也显示已就绪（假绿）。
      // 置绿只有两条路：设置页「测试连接」的真实 200，或顶栏角标/面板首开的 verifyAiStatus。
      if (ids.length > 0) {
        setLiveModels(ids);
        setModel(ids[0]);
        setModelNote(lang === 'zh' ? `已获取 ${ids.length} 个可用模型` : `${ids.length} model${ids.length === 1 ? '' : 's'} available`);
        setTestResult({ ok: true, msg: lang === 'zh' ? `已列出 ${ids.length} 个模型，请再点「测试连接」确认能否对话` : `${ids.length} models listed — now use "Test connection"` });
        flashToast(true, lang === 'zh' ? `已获取 ${ids.length} 个模型` : `${ids.length} models fetched`);
      } else {
        setLiveModels([]);
        setModelNote(lang === 'zh' ? '该端点未返回模型列表，可手输模型名' : 'No model list — type a model name');
        setTestResult({ ok: false, msg: lang === 'zh' ? '该端点未返回模型列表，请手动输入模型名（仍可用「测试连接」验证能否对话）' : 'No model list returned — type a model name (you can still use "Test connection")' });
        flashToast(false, lang === 'zh' ? '该端点未返回模型列表' : 'No model list from this endpoint');
      }
    } catch (e) {
      if (formMatchesSaved && config) reportAiFailure(config, e);
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
        // 实战联动：表单与「已保存配置」一致时，这次成功就是当前生效配置的连通性证据。
        // 不一致（正在改配置还没保存）则不动状态——角标只对「生效中的配置」负责。
        if (formMatchesSaved && config) reportAiSuccess(config);
        setTestResult({ ok: true, msg: lang === 'zh' ? `连接成功：模型 ${probeModel} 可正常对话` : `Connected — ${probeModel} responds` });
        flashToast(true, lang === 'zh' ? '连接成功' : 'Connected');
      } else {
        if (formMatchesSaved && config) reportAiFailure(config, { status: res.status });
        const j = await res.json().catch(() => null);
        const detail = (j?.error?.message || `HTTP ${res.status}`).slice(0, 80);
        setTestResult({ ok: false, msg: detail });
        flashToast(false, lang === 'zh' ? '连接失败，详见下方说明' : 'Connection failed — see the message below');
      }
    } catch (e) {
      if (formMatchesSaved && config) reportAiFailure(config, e);
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
    // 输出上限：留空 = 不下发 max_tokens（思考型模型的思考也计入上限，填小了会挤出空白回答）
    const maxOutRaw = maxTokensText.trim();
    const maxOutNum = /^\d+$/.test(maxOutRaw) ? Number(maxOutRaw) : 0;
    const cfg: AiConfig = { providerId, apiKey: trimmedKey, baseUrl, model, agreed: true, thinkingEffort, keyByProvider: nextKeys, extraParamsText: providerId === 'custom' ? extraParamsText.trim() : undefined, maxOutputTokens: maxOutNum > 0 ? maxOutNum : undefined };
    saveAiConfig(cfg);
    setConfigured(true);
    setConfig(cfg);
    setView('chat');
    // 保存成功 toast
    setSavedToast(true);
    if (savedToastTimer.current) window.clearTimeout(savedToastTimer.current);
    savedToastTimer.current = window.setTimeout(() => setSavedToast(false), 2000);
  };

  // 清除本域全部 AI 配置（对话与刷题状态的清理由主组件的 clearAll 统一编排）
  const clearSettings = () => {
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
    setMaxTokensText('');
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
  const settingsState = useMemo(() => ({ apiKey, config, customUrl, extraParamsOpen, extraParamsText, extraParamsValid, fetching, formMatchesSaved, groupedVoices, liveModels, maxTokensText, model, modelMenuOpen, modelNote, provider, providerId, selectedEffort, sentDesc, setOpen, settingsTab, showKey, showTtsKey, testResult, testing, thinkingPlan, tokenUsageTotalCount, ttsCfg, ttsPreview, ttsStatus }), [apiKey, config, customUrl, extraParamsOpen, extraParamsText, extraParamsValid, fetching, formMatchesSaved, groupedVoices, liveModels, maxTokensText, model, modelMenuOpen, modelNote, provider, providerId, selectedEffort, sentDesc, setOpen, settingsTab, showKey, showTtsKey, testResult, testing, thinkingPlan, tokenUsageTotalCount, ttsCfg, ttsPreview, ttsStatus]);
  const settingsActions = useStable(() => ({ clearSettings, fetchModelList, modelMatches, refreshTokenUsage, save, selectProvider, setApiKey, setCustomUrl, setExtraParamsOpen, setExtraParamsText, setMaxTokensText, setModel, setModelMenuOpen, setSettingsTab, setShowKey, setShowTokenUsage, setShowTtsKey, setThinkingEffort, setView, testConnection, tierLocked, updateTts }));
  const settingsRefs = useMemo(() => ({ modelMenuRef }), [modelMenuRef]);
  // ── 对外接口 ────────────────────────────────────────────────
  return {
    /** 已保存的配置：对话 / 出题链路与主组件渲染都读它 */
    config,
    /** 「已保存」浮条（在主组件顶部渲染） */
    savedToast,
    /** 清空本域全部配置（跨域 clearAll 由主组件编排） */
    clearSettings,
    /** 面板三袋 */
    state: settingsState,
    actions: settingsActions,
    refs: settingsRefs,
    /** 设置域信号守卫：主组件的 open 副作用读它，避免覆盖已定视图 */
    openedRef: settingsOpenedRef,
    /** 供主组件其它链路复用（思考参数实发描述等） */
    sentDesc,
  };
}
