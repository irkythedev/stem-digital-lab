/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * SettingsPanel —— AI 面板的设置页。
 *
 * P0 拆分产物：JSX **逐字**从 AiAssistant.tsx 搬移（未改一个字符），只把「读到的值」与「调用的动作」
 * 按域打包成 props。面板是纯展示：不持有业务状态、不发请求、不改 view 状态机；
 * DOM 结构 / className / 触屏热区 / .ai-* 规则与拆分前完全一致。
 * memo 导出：state 由父级按值 memo、actions 走 useStable（身份恒定）→ 父组件无关的 setState 不再触发本面板重渲。
 */

import { memo } from 'react';
import { AI_PROVIDERS, providerLabel, type AiProvider, type ThinkingEffort, type ThinkingNote } from '../../../lib/ai-config';
import { clearTokenUsage } from '../../../lib/token-usage';
import { type TtsConfig } from '../../../lib/tts-config';
import { resetTtsStatus } from '../../../lib/tts-status';
import { TTS_SAMPLE } from '../../../lib/use-tts-preview';
import BenchSelect from '../../ui/BenchSelect';
import ProviderIcon from '../../ui/ProviderIcon';
import TtsStatusBadge from '../TtsStatusBadge';
import { ExternalLink, EyeOff, Eye, ShieldCheck, ChevronDown, RefreshCw, Activity, Coins, LoaderCircle, Volume2, Trash2 } from 'lucide-react';

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

/** 档位一句话说明（界面上只留这一行，12px）。
 *  为什么砍掉原来那两段：档位的差别用一句话就说得清，而「当前下发 xxx」「深度思考烧 token」
 *  那几行要么是重复（成本已经在说明里），要么是诊断信息（属于排障，不属于日常设置）。 */
const TIER_HINT: Record<ThinkingEffort, { zh: string; en: string }> = {
  off: {
    zh: '禁用思考过程，极速响应，适合查速查表',
    en: 'Fastest replies — best for quick lookups',
  },
  standard: {
    zh: '适度启发引导，兼顾质量与响应速度（推荐）',
    en: 'Balanced — quality and speed (recommended)',
  },
  deep: {
    zh: '展开完整推理草稿，Token 消耗增加，适合大题推导',
    en: 'Full reasoning — more tokens, best for long problems',
  },
};

/**
 * 服务商品牌色：只在**悬停或已选**时点亮胶囊里的 logo，正文与文字色仍走 --muted / --fg。
 * 两张表都写完整字面量——Tailwind 静态扫描扫不到 `group-hover/x:text-[…]` 这类拼接。
 * 明暗两档在 index.css 里是 --brand-* 的两套取值，这里只引用令牌，不写 hex。
 */
const PROVIDER_BRAND_CLS: Record<string, string> = {
  deepseek: 'text-[var(--brand-deepseek)]',
  dashscope: 'text-[var(--brand-qwen)]',
  moonshot: 'text-[var(--brand-kimi)]',
  zhipu: 'text-[var(--brand-zhipu)]',
  volcengine: 'text-[var(--brand-doubao)]',
  custom: 'text-[var(--muted)]',
};

export interface SettingsPanelState {
  apiKey: any;
  config: any;
  customUrl: any;
  extraParamsOpen: any;
  extraParamsText: any;
  extraParamsValid: boolean;
  fetching: any;
  formMatchesSaved: any;
  groupedVoices: any;
  liveModels: any;
  maxTokensText: any;
  model: any;
  modelMenuOpen: any;
  modelNote: any;
  provider: AiProvider;
  providerId: any;
  selectedEffort: ThinkingEffort;
  sentDesc: any;
  setOpen: any;
  settingsTab: any;
  showKey: any;
  showTtsKey: any;
  testResult: any;
  testing: any;
  thinkingPlan: any;
  tokenUsageTotalCount: any;
  ttsCfg: any;
  ttsPreview: any;
  ttsStatus: any;
}

export interface SettingsPanelActions {
  clearAll: () => void;
  fetchModelList: () => Promise<void>;
  modelMatches: (m: string) => boolean;
  refreshTokenUsage: () => any;
  save: () => void;
  selectProvider: (id: string) => void;
  setApiKey: any;
  setCustomUrl: any;
  setExtraParamsOpen: any;
  setExtraParamsText: any;
  setMaxTokensText: any;
  setModel: any;
  setModelMenuOpen: any;
  setSettingsTab: any;
  setShowKey: any;
  setShowTokenUsage: any;
  setShowTtsKey: any;
  setThinkingEffort: any;
  setView: any;
  testConnection: () => Promise<void>;
  tierLocked: (id: ThinkingEffort) => any;
  updateTts: (patch: Partial<TtsConfig>) => void;
}

interface SettingsPanelProps {
  lang: 'zh' | 'en';
  state: SettingsPanelState;
  actions: SettingsPanelActions;
  refs: { modelMenuRef: any };
}

function SettingsPanelInner({ lang, state, actions, refs }: SettingsPanelProps) {
  const { apiKey, config, customUrl, extraParamsOpen, extraParamsText, extraParamsValid, fetching, formMatchesSaved, groupedVoices, liveModels, maxTokensText, model, modelMenuOpen, modelNote, provider, providerId, selectedEffort, sentDesc, setOpen, settingsTab, showKey, showTtsKey, testResult, testing, thinkingPlan, tokenUsageTotalCount, ttsCfg, ttsPreview, ttsStatus } = state;
  const { clearAll, fetchModelList, modelMatches, refreshTokenUsage, save, selectProvider, setApiKey, setCustomUrl, setExtraParamsOpen, setExtraParamsText, setMaxTokensText, setModel, setModelMenuOpen, setSettingsTab, setShowKey, setShowTokenUsage, setShowTtsKey, setThinkingEffort, setView, testConnection, tierLocked, updateTts } = actions;
  const { modelMenuRef } = refs;
  return (
    <>
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-6 space-y-3 text-sm serif-font sm:pb-0">
          {/* 设置 Tab：大模型设置 / 语音朗读。两栏共享同一份配置状态，切换不需要重新保存 */}
          <div className="flex items-center gap-1 border-b border-[var(--border)]" role="tablist" aria-label={lang === 'zh' ? '设置分类' : 'Settings sections'}>
            {([['model', lang === 'zh' ? '大模型设置' : 'Model setup'], ['speech', lang === 'zh' ? '语音朗读' : 'Speech']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={settingsTab === id}
                onClick={() => setSettingsTab(id)}
                className={`tap-ai-tab tap-area -mb-px border-b-2 px-3 py-2 text-[0.6875rem] mono-font leading-none transition-colors ${settingsTab === id ? 'border-[var(--fg)] text-[var(--fg)] font-bold' : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {settingsTab === 'model' ? (
            <>
          {/* 服务商预设 */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-[0.6875rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '选择服务商' : 'Provider'}</p>
              <button type="button" onClick={() => setView('terms')} className="tap-ai-text shrink-0 rounded px-1 py-0.5 text-[0.625rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] active:bg-[var(--accent-light)] transition-colors">
                {lang === 'zh' ? '查看须知' : 'View terms'}
              </button>
            </div>
            {/* 服务商胶囊：固定高度 + 单行不折，品牌微标继承文字色（未选 --muted / 选中 --fg）。
                h-7 让 6 个胶囊在桌面严格等高；触屏仍由 .tap-area 撑到 40px 命中区，
                因为两者对所有胶囊同时生效，折行时行高依然整齐，不会出现"一个高一个矮"。 */}
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 sm:gap-y-1.5">
              {AI_PROVIDERS.map((p) => {
                const active = providerId === p.id;
                // 品牌色只在「悬停」或「已选」时点亮；默认随胶囊文字色（未选 --muted）。
                // 悬停色走 index.css 里按 data-brand 写的普通规则，**不用** Tailwind 的
                // group-hover 变体：实测该变体规则存在、svg 也能 matches 到，但计算色仍被
                // 继承/层级压住而不生效——这种"规则在、却不生效"的调试成本不值得付。
                // 图标自身不写 text-[--muted]（会与悬停色同层竞争），让它继承父级 currentColor。
                const brand = PROVIDER_BRAND_CLS[p.id] ?? PROVIDER_BRAND_CLS.custom;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectProvider(p.id)}
                    aria-pressed={active}
                    data-brand={p.id}
                    className={`ai-provider-chip tap-ai-chip tap-area inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[0.6875rem] leading-none mono-font transition-colors ${
                      active
                        ? 'border-[var(--fg)]/25 bg-[var(--accent-light)] text-[var(--fg)] font-medium'
                        : 'border-transparent text-[var(--muted)] hover:bg-[var(--accent-light)]/60 hover:text-[var(--fg)]'
                    }`}
                  >
                    <ProviderIcon
                      id={p.id}
                      className={`h-4 w-4 shrink-0 transition-colors ${active ? brand : ''}`}
                    />
                    <span>{providerLabel(p, lang)}</span>
                  </button>
                );
              })}
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
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--fg)] outline-none focus:border-[var(--fg)]"
              />
              <p className="mt-1 text-[0.625rem] leading-snug text-[var(--muted)]">
                {lang === 'zh'
                  ? '支持任意兼容 OpenAI 接口的端点。若连接局域网私有模型，请确保该服务端已开启 CORS 跨域访问。'
                  : 'Works with any OpenAI-compatible endpoint. For a private model on your LAN, make sure that server has CORS enabled.'}
              </p>
            </div>
          )}

          {/* API Key：标签行右侧带官方入口。链接跟着服务商走（docUrl 来自 AI_PROVIDERS），
              自定义端点没有 docUrl 就不显示——用户填的是别人家的端点，硬指一个官网等于编造。 */}
          <div>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <p className="text-[0.6875rem] mono-font text-[var(--muted)]">{`API Key (${providerLabel(provider, lang)})`}</p>
              {provider.docUrl && (
                <a
                  href={provider.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-0.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                >
                  {lang === 'zh' ? '获取 Key / 官方文档' : 'Get a key / docs'}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 pr-8 text-xs text-[var(--fg)] outline-none focus:border-[var(--fg)]"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? (lang === 'zh' ? '隐藏 Key' : 'Hide key') : (lang === 'zh' ? '显示 Key' : 'Show key')}
                className="tap-icon absolute right-2 top-1/2 -translate-y-1/2 rounded-md text-[var(--muted)] hover:text-[var(--fg)]"
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
                  placeholder={lang === 'zh' ? '可直接输入，或从下拉里选' : 'Type a name, or pick from the list'}
                  value={model}
                  onChange={(e) => setModel(e.target.value.trim())}
                  onClick={() => { if (liveModels.length > 0) setModelMenuOpen(true); }}
                  className="w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--bg)] py-1.5 pl-2 pr-7 text-xs text-[var(--fg)] outline-none focus:border-[var(--fg)]"
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
                  className="tap-icon absolute right-0.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${modelMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {modelMenuOpen && liveModels.length > 0 && (
                  <div
                    id="ai-model-listbox"
                    role="listbox"
                    className="absolute left-0 right-0 top-full mt-1 z-20 max-h-44 overflow-y-auto border border-[var(--border)] bg-[var(--bg)] shadow-[var(--elev-md)]"
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
              {/* 图标语义：这里是「重新拉一次清单」，不是「打开一个列表」——用 RefreshCw；
                  请求进行中让它自己转（motion-safe 下才转，减少动效偏好时保持静止）。 */}
              <button
                type="button"
                onClick={fetchModelList}
                disabled={fetching}
                aria-label={lang === 'zh' ? '获取模型' : 'Fetch models'}
                title={lang === 'zh' ? '列出该服务商实际可用的模型（不验证能否对话）' : 'List the models this provider offers (does not verify chat)'}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap max-sm:min-h-[34px] rounded-md border border-transparent px-2.5 py-1.5 text-[0.6875rem] mono-font text-[var(--muted)] transition-colors hover:bg-[var(--accent-light)] hover:text-[var(--fg)] disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 shrink-0 ${fetching ? 'motion-safe:animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {fetching ? (lang === 'zh' ? '获取中…' : 'Fetching…') : (lang === 'zh' ? '获取模型' : 'Fetch')}
              </button>
              {/* 图标语义：这里是「探一次对方活不活」，用 Activity（心跳波形）而不是插头——
                  插头已经是「自定义端点」的身份标（ProviderIcon 的 Plug 退化），两处都用插头会重复指认。 */}
              <button
                type="button"
                onClick={testConnection}
                disabled={testing}
                aria-label={lang === 'zh' ? '测试连接' : 'Test connection'}
                title={lang === 'zh' ? '发一次极小的对话请求，验证 Key / 端点 / 模型能否正常使用' : 'Send one tiny chat request to verify key, endpoint and model'}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap max-sm:min-h-[34px] rounded-md border border-transparent px-2.5 py-1.5 text-[0.6875rem] mono-font text-[var(--muted)] transition-colors hover:bg-[var(--accent-light)] hover:text-[var(--fg)] disabled:opacity-50"
              >
                <Activity
                  className={`h-3.5 w-3.5 shrink-0 ${testing ? 'motion-safe:animate-pulse' : ''}`}
                  aria-hidden="true"
                />
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
              <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-2 sm:gap-y-1.5">
                <span className="text-[0.625rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '常用：' : 'Common:'}</span>
                {provider.models.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModel(m)}
                    aria-pressed={modelMatches(m)}
                    className={`tap-ai-mini tap-area rounded-md px-2 py-0.5 text-[0.625rem] mono-font border transition-colors ${modelMatches(m)
                      ? 'border-[var(--fg)]/25 bg-[var(--accent-light)] text-[var(--fg)] font-medium'
                      : 'border-transparent text-[var(--muted)] hover:bg-[var(--accent-light)]/60 hover:text-[var(--fg)]'}`}
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
            {/* 整体分段滑槽：三档同槽，选中由背景滑块承托（不再用符号点表达状态） */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-[var(--accent-light)]/70 border border-[var(--border)]/60" role="group" aria-label={lang === 'zh' ? '思考强度' : 'Thinking effort'}>
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
                    className={`tap-ai-tier tap-area rounded-md px-2.5 py-1.5 text-[0.6875rem] mono-font leading-none border transition-colors ${selected
                      ? 'bg-[var(--card-bg)] text-[var(--fg)] font-medium border-[var(--border)]/50 shadow-xs'
                      : usable
                        ? 'text-[var(--muted)] border-transparent hover:text-[var(--fg)]'
                        : 'text-[var(--muted)] border-transparent opacity-40 cursor-not-allowed'}`}
                  >
                    {lang === 'zh' ? t.zh : t.en}
                  </button>
                );
              })}
            </div>
            {/* 单行动态说明：模型没有思考旋钮时，说「按服务商默认策略处理」，
                具体原因（哪一档不可用、是否透传）落到 title 里——排障时才需要的细节不该占版面。 */}
            <p
              className="mt-1 text-xs text-[var(--muted)] leading-snug"
              title={
                thinkingPlan?.note
                  ? THINKING_NOTE[thinkingPlan.note][lang === 'zh' ? 'zh' : 'en']
                  : sentDesc
                    ? (lang === 'zh' ? `本次下发 ${sentDesc}` : `Sending ${sentDesc}`)
                    : (lang === 'zh' ? '不下发思考参数' : 'No thinking parameter sent')
              }
            >
              {thinkingPlan?.note
                ? (lang === 'zh' ? '当前模型按服务商默认策略处理。' : 'This model follows its provider default policy.')
                : TIER_HINT[selectedEffort][lang === 'zh' ? 'zh' : 'en']}
            </p>
            {/* 输出上限（留空＝不下发 max_tokens）：思考型模型的思考也算进上限，填小了会挤出空白回答。
                那整段解释已收进 input 的 title——它是「填小了会怎样」的边界知识，不是每次都要读的正文。 */}
            <div className="mt-1.5 flex items-center gap-2">
              <label htmlFor="ai-max-out-tokens" className="shrink-0 text-xs text-[var(--muted)]">
                {lang === 'zh' ? '输出上限 (tokens)：' : 'Output limit (tokens):'}
              </label>
              <input
                id="ai-max-out-tokens"
                type="text"
                inputMode="numeric"
                value={maxTokensText}
                onChange={(e) => setMaxTokensText(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))}
                placeholder={lang === 'zh' ? '不限' : 'none'}
                title={
                  lang === 'zh'
                    ? '思考型模型（R1 / 思考版千问 / 本地模型）的思考也计入这个上限：填小了思考会吃满预算，回答就是空白。除非要控成本，建议留空。'
                    : 'Thinking models (R1 / thinking Qwen / local servers) count their reasoning against this limit — set it too low and the answer comes back blank. Leave it empty unless you need a cost cap.'
                }
                className="w-24 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 text-xs mono-font text-[var(--fg)] outline-none focus:border-[var(--fg)]"
              />
            </div>
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
                      className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs mono-font text-[var(--fg)] outline-none focus:border-[var(--fg)] resize-y"
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
                    className="rounded px-1 py-0.5 text-[0.625rem] mono-font text-[var(--muted)] hover:text-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)] active:bg-[color-mix(in_srgb,var(--error)_20%,transparent)] active:text-[var(--error)] transition-colors"
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
          </>
          ) : (
            <>
              {/* 引擎：默认端侧离线（零配置、断网可用）；云端为使用者自配的可选扩展。
                  通道状态胶囊与引擎栏标题同行右对齐：切换栏本身已占满面板宽度（实测需 473px、可用 350px），
                  胶囊与两个 Tab 按钮无法真正同行，故贴在标题行右端，窄屏自动换行、间距保持紧凑 */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 mb-1.5">
                  <p className="text-[0.6875rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '朗读引擎' : 'Speech engine'}</p>
                  <TtsStatusBadge />
                </div>
                <div className="inline-flex items-center p-0.5 rounded-lg bg-[var(--accent-light)]/70 border border-[var(--border)]/60" role="group" aria-label={lang === 'zh' ? '朗读引擎' : 'Speech engine'}>
                    {([['scf', lang === 'zh' ? '内置高质量语音（推荐，免配置）' : 'Built-in HD voice (recommended)'], ['cloud', lang === 'zh' ? '自定义云端' : 'Custom cloud']] as const).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={ttsCfg.engine === id}
                        onClick={() => { ttsPreview.stop(); updateTts({ engine: id }); resetTtsStatus(); }}
                        className={`tap-area rounded-md px-2.5 py-1.5 text-[0.6875rem] mono-font leading-none border transition-colors ${ttsCfg.engine === id ? 'bg-[var(--card-bg)] text-[var(--fg)] font-medium border-[var(--border)]/50 shadow-xs' : 'text-[var(--muted)] border-transparent hover:text-[var(--fg)]'}`}
                      >
                        {label}
                      </button>
                    ))}
                </div>
              </div>

              {ttsCfg.engine === 'scf' ? (
                <div className="space-y-2">
                  <p className="text-[0.625rem] mono-font text-[var(--muted)] leading-snug">
                    {lang === 'zh'
                      ? '内置高拟真语音（晓晓 / Aria 等自然音色）：免配置开箱即用，Windows / macOS / Linux / 移动端音色一致。'
                      : 'Built-in lifelike voices (Xiaoxiao / Aria and other natural voices): zero-config out of the box; the same voice on Windows, macOS, Linux and mobile.'}
                  </p>
                  <div className="flex items-center flex-wrap gap-2.5">
                    {(['zh', 'en'] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => void ttsPreview.preview(key, ttsCfg)}
                        aria-label={lang === 'zh' ? `试听内置${key === 'zh' ? '中文' : '英文'}语音` : `Preview built-in ${key === 'zh' ? 'Chinese' : 'English'}`}
                        title={TTS_SAMPLE[key]}
                        className={`tap-area inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[0.6875rem] mono-font transition-colors ${ttsPreview.activeKey === key ? 'border-[var(--fg)] text-[var(--fg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
                      >
                        {ttsPreview.activeKey === key && ttsStatus === 'probing'
                          ? <LoaderCircle className="w-3.5 h-3.5 shrink-0 animate-spin" aria-hidden="true" />
                          : <Volume2 className={`w-3.5 h-3.5 shrink-0 ${ttsPreview.activeKey === key ? 'update-dot' : ''}`} aria-hidden="true" />}
                        {ttsPreview.activeKey === key
                          ? (ttsStatus === 'probing'
                            ? (lang === 'zh' ? '检测中…' : 'Checking…')
                            : (lang === 'zh' ? '播放中…' : 'Playing…'))
                          : (lang === 'zh' ? `试听${key === 'zh' ? '中文' : '英文'}` : `Preview ${key === 'zh' ? 'Chinese' : 'English'}`)}
                      </button>
                    ))}
                  </div>
                  {ttsPreview.error && (
                    <p className="text-[0.625rem] text-[var(--error)] leading-snug" role="alert">{ttsPreview.error}</p>
                  )}
                  <div className="border-t border-[var(--border)]/60 pt-2">
                    <p className="text-[0.6875rem] mono-font text-[var(--muted)] mb-1">
                      {lang === 'zh' ? '回退语音（内置语音不可用时自动使用）' : 'Fallback voice (used automatically when the built-in voice is unavailable)'}
                    </p>
                    {(['zh', 'en'] as const).map((key) => {
                      const label = key === 'zh' ? (lang === 'zh' ? '中文发音人' : 'Chinese voice') : (lang === 'zh' ? '英文发音人' : 'English voice');
                      const value = key === 'zh' ? ttsCfg.localVoiceZh : ttsCfg.localVoiceEn;
                      return (
                        <div key={key} className="flex items-center gap-2.5 mb-1.5">
                          <span className="w-20 shrink-0 text-[0.625rem] mono-font text-[var(--muted)]">{label}</span>
                          <BenchSelect
                            size="setting"
                            className="sm:w-72 max-w-xs"
                            ariaLabel={label}
                            value={value}
                            onChange={(v) => updateTts(key === 'zh' ? { localVoiceZh: v } : { localVoiceEn: v })}
                            options={[
                              { value: '', label: lang === 'zh' ? '自动（按语言选择）' : 'Automatic (by language)' },
                              ...(key === 'zh' ? groupedVoices.zh : groupedVoices.en).map((v) => ({
                                value: v.voiceURI || v.name,
                                label: v.name,
                                hint: v.lang,
                              })),
                            ]}
                          />
                          <button
                            type="button"
                            onClick={() => void ttsPreview.preview(key, ttsCfg)}
                            aria-label={lang === 'zh' ? `试听${key === 'zh' ? '中文' : '英文'}发音人` : `Preview ${key === 'zh' ? 'Chinese' : 'English'} voice`}
                            title={TTS_SAMPLE[key]}
                            className={`tap-area inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[0.6875rem] mono-font transition-colors ${ttsPreview.activeKey === key ? 'border-[var(--fg)] text-[var(--fg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
                          >
                            {ttsPreview.activeKey === key && ttsStatus === 'probing'
                              ? <LoaderCircle className="w-3.5 h-3.5 shrink-0 animate-spin" aria-hidden="true" />
                              : <Volume2 className={`w-3.5 h-3.5 shrink-0 ${ttsPreview.activeKey === key ? 'update-dot' : ''}`} aria-hidden="true" />}
                            {ttsPreview.activeKey === key
                              ? (ttsStatus === 'probing'
                                ? (lang === 'zh' ? '检测中…' : 'Checking…')
                                : (lang === 'zh' ? '播放中…' : 'Playing…'))
                              : (lang === 'zh' ? '试听' : 'Preview')}
                          </button>
                        </div>
                      );
                    })}
                    <p className="text-[0.625rem] text-[var(--muted)] leading-snug">
                      {groupedVoices.zh.length + groupedVoices.en.length === 0
                        ? (lang === 'zh' ? '当前浏览器未提供系统语音包：内置语音失败时可能无声，建议先安装中文/英文语音。' : 'No system voices detected: install a Chinese/English voice pack for fallback.')
                        : (lang === 'zh' ? '自动模式优先挑选自然、拟真的系统音色。断网或云端异常时会静默改用这里的发音人，并提示「已切换为本地离线语音」。' : 'Automatic mode prefers natural, lifelike system voices. If cloud reading fails it switches silently to these voices.')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {([['endpoint', lang === 'zh' ? 'API 端点' : 'API endpoint', lang === 'zh' ? 'https://.../v1/audio/speech（填接口根地址亦可）' : 'https://.../v1/audio/speech (a base URL also works)', ttsCfg.endpoint, (v: string) => updateTts({ endpoint: v })],
                     ['apiKey', 'API Key', 'sk-…', ttsCfg.apiKey, (v: string) => updateTts({ apiKey: v })],
                     ['model', lang === 'zh' ? '模型（选填）' : 'Model (optional)', 'tts-1', ttsCfg.model, (v: string) => updateTts({ model: v })],
                     ['voice', lang === 'zh' ? '音色（选填）' : 'Voice (optional)', 'alloy', ttsCfg.voice, (v: string) => updateTts({ voice: v })]] as const).map(([key, label, ph, value, onChange]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 text-[0.625rem] mono-font text-[var(--muted)]">{label}</span>
                      <div className="relative flex-1 min-w-0">
                        <input
                          type={key === 'apiKey' ? (showTtsKey ? 'text' : 'password') : 'text'}
                          value={value}
                          onChange={(e) => onChange(e.target.value)}
                          placeholder={ph}
                          aria-label={label}
                          className={`min-h-9 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs mono-font text-[var(--fg)] outline-none focus:border-[var(--fg)] ${key === 'endpoint' ? 'w-full sm:w-96 max-w-md' : key === 'apiKey' ? 'w-full sm:w-96 max-w-md pr-8' : 'w-full sm:w-72 max-w-xs'}`}
                        />
                        {key === 'apiKey' && (
                          <button
                            type="button"
                            onClick={() => setShowTtsKey((v) => !v)}
                            aria-label={showTtsKey ? (lang === 'zh' ? '隐藏 Key' : 'Hide key') : (lang === 'zh' ? '显示 Key' : 'Show key')}
                            /* 刻意不用 tap-icon：锁定用例限定该标记只允许 2 处（密钥眼睛 + 模型下拉箭头）。
                               这里用 32×32 自身盒尺寸达到同等热区（图标仍 14px），视觉与范式保持一致 */
                            className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 text-[var(--muted)] hover:text-[var(--fg)]"
                          >
                            {showTtsKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center flex-wrap gap-2.5">
                    {(['zh', 'en'] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => void ttsPreview.preview(key, ttsCfg)}
                        aria-label={lang === 'zh' ? `试听云端${key === 'zh' ? '中文' : '英文'}` : `Preview cloud ${key === 'zh' ? 'Chinese' : 'English'}`}
                        title={TTS_SAMPLE[key]}
                        className={`tap-area inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[0.6875rem] mono-font transition-colors ${ttsPreview.activeKey === key ? 'border-[var(--fg)] text-[var(--fg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
                      >
                        {ttsPreview.activeKey === key && ttsStatus === 'probing'
                          ? <LoaderCircle className="w-3.5 h-3.5 shrink-0 animate-spin" aria-hidden="true" />
                          : <Volume2 className={`w-3.5 h-3.5 shrink-0 ${ttsPreview.activeKey === key ? 'update-dot' : ''}`} aria-hidden="true" />}
                        {ttsPreview.activeKey === key
                          ? (ttsStatus === 'probing'
                            ? (lang === 'zh' ? '检测中…' : 'Checking…')
                            : (lang === 'zh' ? '播放中…' : 'Playing…'))
                          : (lang === 'zh' ? `试听${key === 'zh' ? '中文' : '英文'}` : `Preview ${key === 'zh' ? 'Chinese' : 'English'}`)}
                      </button>
                    ))}
                  </div>
                  {ttsPreview.error && (
                    <p className="text-[0.625rem] text-[var(--error)] leading-snug" role="alert">{ttsPreview.error}</p>
                  )}
                  <p className="text-[0.625rem] text-[var(--muted)] leading-snug">
                    {lang === 'zh'
                      ? '兼容标准 /v1/audio/speech 协议；端点与 Key 仅存本机浏览器，调用与费用由使用者自理。朗读失败时仍会自动回退系统语音。'
                      : 'Compatible with the standard /v1/audio/speech API. Endpoint and key stay in this browser only; usage and cost are yours. Falls back to system speech on failure.'}
                  </p>
                </div>
              )}
            </>
          )}

        {/* 操作栏：吸底常驻——表单再长也不会把「保存」挤出可见范围 */}
          <div className="sticky bottom-0 z-10 -mx-4 px-4 pb-4 pt-2 space-y-1.5 bg-[var(--bg)] border-t border-[var(--border)]">
            <div className="flex items-center gap-2">
            {config ? (
              <button type="button" onClick={() => setView('chat')} className="tap-primary tap-ai-primary rounded-md px-3 py-1.5 text-xs mono-font border border-transparent text-[var(--muted)] transition-colors hover:bg-[var(--accent-light)] hover:text-[var(--fg)]">
                {lang === 'zh' ? '返回对话' : 'Back to chat'}
              </button>
            ) : (
              <button type="button" onClick={() => setOpen(false)} className="tap-primary tap-ai-primary rounded-md px-3 py-1.5 text-xs mono-font border border-transparent text-[var(--muted)] transition-colors hover:bg-[var(--accent-light)] hover:text-[var(--fg)]">
                {lang === 'zh' ? '关闭' : 'Close'}
              </button>
            )}
            <button type="button" onClick={save} className="tap-primary tap-ai-primary rounded-md px-3 py-1.5 text-xs mono-font font-bold border border-transparent bg-[var(--fg)] text-[var(--bg)] transition-colors hover:opacity-90">
              {lang === 'zh' ? '保存配置' : 'Save settings'}
            </button>
            {/* 文案必须与行为一致：这里只清「本机配置 + 当前会话 + 本轮测验」，
                持久化的问答历史与考考你记录（错题集）不在此列 —— 它们各自在「学习记录」里清。
                旧文案写「清除 AI 配置与记录」是谎报（点完历史仍在、点还亮着），已改。 */}
            <button type="button" onClick={clearAll} title={lang === 'zh' ? '清除本机保存的 API Key 与模型设置，重置当前对话与测验进度；问答历史与错题集请在「学习记录」中清空' : 'Removes the API key and model settings stored on this device and resets the current chat and quiz progress; clear Q&A history and the mistake set separately under Records'} className="ml-auto tap-area inline-flex items-center gap-1 text-[0.6875rem] mono-font text-[var(--muted)] transition-colors hover:text-[var(--fg)]">
              <Trash2 className="w-3 h-3" />
              {lang === 'zh' ? '清除 AI 配置' : 'Clear AI config'}
            </button>
            </div>
            {testResult && (
              <p className={`text-[0.6875rem] mono-font ${testResult.ok ? 'text-[var(--fg)]' : 'text-[var(--error)]'}`}>{testResult.msg}</p>
            )}
          </div>
        </div>
    </>
  );
}

export default memo(SettingsPanelInner);
