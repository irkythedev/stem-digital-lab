/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 顶栏 AI 图标的状态机（五态，含瞬时的「验证中」）：
 *   unconfigured 未配置 / configured 待验证 / verifying 验证中 / valid 已就绪 / invalid 连接异常
 *
 * 四条纪律：
 * - 零轮询：页面加载绝不自动 Ping（不替用户烧配额）。验证只发生在两处——用户主动点击
 *   （角标卡片「重新验证」/ 设置页「测试连接」），以及「AI 面板首次打开」这一明确的使用意图。
 * - 结论有时效：valid / invalid 都带 checkedAt；超过 24 小时自动降级回 configured，
 *   配置指纹一变立即作废——旧结论不许冒充当前状态。
 * - 验证先便宜后昂贵：先 GET /models（0 token），拿不到结论才发一次 max_tokens=1 的 chat 探针。
 *   /models 成功**不再**置绿：它只证明「凭证与端点通」，不证明你选的模型能对话——那是 chat 探针的职责。
 * - 零泄漏：持久化只写「配置指纹」（provider + model + baseUrl + Key 的长度与首尾各两字符），
 *   不含 Key 本体，任何时刻都无法从存档里还原密钥。
 */
import { useSyncExternalStore } from 'react';
import type { AiConfig } from './ai-config';

export type AiStatus = 'unconfigured' | 'configured' | 'verifying' | 'valid' | 'invalid';

/** 结论有效期：超过即视为未知，降级回 configured 等下一次验证 */
export const AI_STATUS_TTL_MS = 24 * 60 * 60 * 1000;

/** 单次探针的超时：models 与 chat 共用，避免弱网下顶栏长时间停在「验证中」 */
export const AI_PROBE_TIMEOUT_MS = 8000;

/** invalid 的原因码（文案在 AI_STATUS_DETAIL 里分中英，避免把中文写进持久化存档） */
export type AiStatusDetail = '' | 'auth' | 'notfound' | 'model' | 'network' | 'rejected' | 'server' | 'badurl';

export interface AiStatusSnapshot {
  status: AiStatus;
  /** valid 时用于提示文案的模型名（无则空串） */
  model: string;
  /**
   * 最近一次**真实检测**的时间（ms）。从未检测过为 null。
   * 注意：过期降级回 configured 后仍保留它——健康卡片要据此显示「3 天前（已过期）」，
   * 抹掉等于让用户失去「上次什么时候验的」这条唯一线索。
   */
  checkedAt: number | null;
  /** invalid 的原因码（其余状态为空串） */
  detail: AiStatusDetail;
}

const STORAGE_KEY = 'stem-ai-status';

/** 只持久化「已验证过的结论」：configured / verifying 是瞬时态，刷新后由指纹重新推导 */
interface Persisted {
  fingerprint: string;
  status: 'valid' | 'invalid';
  checkedAt: number;
  detail: AiStatusDetail;
}

/** 参与指纹的字段（不含 Key 本体） */
interface FingerprintSource {
  providerId?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}

/**
 * 非敏感配置指纹：用 Key 的「长度 + 首两字符 + 末两字符」代替 Key 本身。
 * 足以发现「换过 Key / 换过模型 / 换过端点」，又不可能反推出密钥。
 */
export function aiConfigFingerprint(cfg: FingerprintSource | null | undefined): string {
  if (!cfg) return '';
  const key = (cfg.apiKey || '').trim();
  const keyHint = key ? [key.length, key.slice(0, 2), key.slice(-2)].join(':') : '';
  return [cfg.providerId || '', cfg.model || '', cfg.baseUrl || '', keyHint].join('|');
}

function readPersisted(): Persisted | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (!parsed || typeof parsed.fingerprint !== 'string') return null;
    if (parsed.status !== 'valid' && parsed.status !== 'invalid') return null;
    // 历史存档没有 checkedAt：无法判定新旧 → 当作过期（宁可多验一次，不可虚报就绪）
    if (typeof parsed.checkedAt !== 'number' || !Number.isFinite(parsed.checkedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(p: Persisted | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (p) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 隐私模式 / 配额满：状态退化为本次会话有效，不影响功能 */
  }
}

let snapshot: AiStatusSnapshot = { status: 'unconfigured', model: '', checkedAt: null, detail: '' };
const listeners = new Set<() => void>();

function emit(next: AiStatusSnapshot): void {
  if (
    next.status === snapshot.status &&
    next.model === snapshot.model &&
    next.checkedAt === snapshot.checkedAt &&
    next.detail === snapshot.detail
  ) return;
  snapshot = next;
  for (const l of listeners) l();
}

export function subscribeAiStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getAiStatus(): AiStatusSnapshot {
  return snapshot;
}

/** 订阅五态（useSyncExternalStore：外部 store + 并发渲染安全） */
export function useAiStatus(): AiStatusSnapshot {
  return useSyncExternalStore(subscribeAiStatus, getAiStatus, getAiStatus);
}

/**
 * 结论是否仍在有效期内（**纯函数**：契约测试可以直接喂时间戳，不受真实时钟影响）。
 * 时间戳落在未来（改系统时钟 / 漂移）一律按不可信处理，不放行。
 */
export function isStatusFresh(checkedAt: number | null, now: number = Date.now()): boolean {
  if (checkedAt === null || !Number.isFinite(checkedAt)) return false;
  const age = now - checkedAt;
  return age >= 0 && age <= AI_STATUS_TTL_MS;
}

/**
 * 依当前配置重算状态（**不联网**）：
 * - Key 为空或配置不完整 → unconfigured
 * - 指纹不一致（换了 Key/模型/端点）→ configured，旧结论作废，绝不冒充已验证
 * - 指纹一致但 checkedAt 超过 24 小时 → configured，但保留 checkedAt 供卡片显示「上次检测」
 * - 指纹一致且在有效期内 → 恢复上次的 valid / invalid
 * 调用点：模块加载、配置保存、清除配置。切换页面不调用（没有新信息就不要改状态）。
 */
export function refreshAiStatus(cfg: AiConfig | null | undefined): void {
  const fingerprint = aiConfigFingerprint(cfg);
  const hasKey = !!((cfg?.apiKey || '').trim());
  if (!cfg || !fingerprint || !hasKey || !cfg.baseUrl || !cfg.model) {
    writePersisted(null);
    emit({ status: 'unconfigured', model: '', checkedAt: null, detail: '' });
    return;
  }
  const saved = readPersisted();
  if (saved && saved.fingerprint === fingerprint) {
    if (isStatusFresh(saved.checkedAt)) {
      emit({ status: saved.status, model: cfg.model, checkedAt: saved.checkedAt, detail: saved.detail });
    } else {
      emit({ status: 'configured', model: cfg.model, checkedAt: saved.checkedAt, detail: '' });
    }
    return;
  }
  emit({ status: 'configured', model: cfg.model, checkedAt: null, detail: '' });
}

/**
 * 端点归一化：与 ai-config 的 normalizeBaseUrl 同规则。
 * 刻意复制这 5 行而不 import：本模块只允许 import type，否则 ai-config ↔ ai-status 形成
 * 运行时模块环（两文件互相 import 函数），打包/测试都可能踩 TDZ。
 */
function probeBase(url: string): string {
  const trimmed = (url || '').trim().split('?')[0].replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
  if (!/^https?:\/\//i.test(trimmed)) return '';
  return trimmed;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

async function readModelIds(res: Response): Promise<string[]> {
  try {
    const j = (await res.json()) as { data?: { id?: string }[] };
    return (j?.data ?? []).map((m) => m?.id ?? '').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * 探针（**会联网**）：先 GET /models（0 token），拿不到结论才降级为一次极小 chat 探针。
 * 返回 'configured' 表示「此刻给不出结论」（429/5xx/超时），**不写存档**——下次再试。
 */
async function probe(cfg: AiConfig): Promise<{ status: AiStatus; detail: AiStatusDetail }> {
  const base = probeBase(cfg.baseUrl);
  if (!base) return { status: 'invalid', detail: 'badurl' };
  const auth = { Authorization: `Bearer ${cfg.apiKey.trim()}` };
  const model = cfg.model.trim();

  try {
    const res = await fetchWithTimeout(`${base}/models`, { headers: auth }, AI_PROBE_TIMEOUT_MS);
    if (res.ok) {
      const ids = await readModelIds(res);
      // 模型在官方列表里 → 凭证、端点、模型三者都通，0 token 就能置绿
      if (ids.includes(model)) return { status: 'valid', detail: '' };
      // 列表非空但没有这个模型：网关常只暴露部分模型，**不据此判红**，以 chat 探针为准
      // 列表为空：同样不足以判绿，继续往下探
    } else if (res.status === 401 || res.status === 403) {
      return { status: 'invalid', detail: 'auth' };
    } else if (res.status !== 404 && res.status !== 405 && res.status !== 501) {
      // 429 限流 / 5xx 服务端故障 / 其它：说的是「服务商此刻给不给」，不是「配置对不对」
      return { status: 'configured', detail: 'server' };
    }
    // 404/405/501 = 该端点不支持 /models，落到 chat 探针
  } catch {
    // 网络不通 / 被拦截 / 超时：学生看得懂，也直接指向排查方向，不必再白跑一次 chat
    return { status: 'invalid', detail: 'network' };
  }

  try {
    const res = await fetchWithTimeout(
      `${base}/chat/completions`,
      {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        // max_tokens=1：只求一个 HTTP 结论，不替用户回答任何东西
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1, stream: false }),
      },
      AI_PROBE_TIMEOUT_MS,
    );
    if (res.ok) return { status: 'valid', detail: '' };
    if (res.status === 401 || res.status === 403) return { status: 'invalid', detail: 'auth' };
    if (res.status === 404) return { status: 'invalid', detail: 'notfound' };
    if (res.status === 400) return { status: 'invalid', detail: 'rejected' };
    return { status: 'configured', detail: 'server' };
  } catch {
    return { status: 'invalid', detail: 'network' };
  }
}

let inFlight: Promise<AiStatus> | null = null;

/**
 * 主动验证（**唯一会联网推进状态的方式**）。
 * - opts.auto=true（面板首开时的静默触发）：只在结论缺失/过期时动手；已就绪且未过期直接返回，
 *   因此反复开关面板不会反复发请求。
 * - 并发去重：验证进行中再次调用，复用同一个 Promise（连点角标不会叠请求）。
 */
export function verifyAiStatus(cfg: AiConfig | null | undefined, opts?: { auto?: boolean }): Promise<AiStatus> {
  const fingerprint = aiConfigFingerprint(cfg);
  const hasKey = !!((cfg?.apiKey || '').trim());
  if (!cfg || !fingerprint || !hasKey || !cfg.baseUrl || !cfg.model) {
    writePersisted(null);
    emit({ status: 'unconfigured', model: '', checkedAt: null, detail: '' });
    return Promise.resolve<AiStatus>('unconfigured');
  }
  if (opts?.auto && snapshot.status !== 'configured') return Promise.resolve(snapshot.status);
  if (inFlight) return inFlight;

  const model = cfg.model;
  const prevCheckedAt = snapshot.checkedAt;
  emit({ status: 'verifying', model, checkedAt: prevCheckedAt, detail: '' });

  inFlight = probe(cfg)
    .then((r) => {
      const checkedAt = r.status === 'configured' ? prevCheckedAt : Date.now();
      if ((r.status === 'valid' || r.status === 'invalid') && checkedAt !== null) {
        writePersisted({ fingerprint, status: r.status, checkedAt, detail: r.detail });
      }
      emit({ status: r.status, model, checkedAt, detail: r.detail });
      return r.status;
    })
    .catch(() => {
      emit({ status: 'configured', model, checkedAt: prevCheckedAt, detail: '' });
      return 'configured' as AiStatus;
    })
    .finally(() => { inFlight = null; });

  return inFlight;
}

/** 验证是否进行中（卡片据此禁用按钮，避免重复点击） */
export function isVerifying(): boolean {
  return inFlight !== null;
}

/**
 * 实战成功（HTTP 200 / 流式首包到达）：真实对话是比任何探针都硬的证据，
 * 因此它优先于历史结论，直接置 valid 并落盘（同时刷新 checkedAt）。
 */
export function reportAiSuccess(cfg: AiConfig | null | undefined): void {
  const fingerprint = aiConfigFingerprint(cfg);
  if (!fingerprint) return;
  const checkedAt = Date.now();
  writePersisted({ fingerprint, status: 'valid', checkedAt, detail: '' });
  emit({ status: 'valid', model: cfg?.model || '', checkedAt, detail: '' });
}

/** 失败归类：只有「用户主动中止」不算故障，其余一律视为无效配置 */
export function classifyAiError(error: unknown): 'abort' | 'auth' | 'notfound' | 'network' | 'other' {
  const e = error as { name?: string; status?: number } | null | undefined;
  if (e?.name === 'AbortError') return 'abort';
  const s = e?.status;
  if (s === 401 || s === 403) return 'auth';
  if (s === 404) return 'notfound';
  if (e?.name === 'TypeError') return 'network';
  return 'other';
}

/**
 * 实战失败：鉴权 401/403、模型 404、网络异常 → invalid。
 * 学生点「停止」产生的 AbortError **不改状态**——那是主动取消，不是连接故障。
 */
export function reportAiFailure(cfg: AiConfig | null | undefined, error?: unknown): void {
  const kind = classifyAiError(error);
  if (kind === 'abort') return;
  // 429 限流 / 5xx 服务端故障：说的是「服务商此刻给不给」，与「这套配置能不能用」无关。
  // 若一并置 invalid，学生会在服务商抽风时看到红的「连接异常」，反而误导排查方向。
  const status = (error as { status?: number } | null | undefined)?.status;
  if (typeof status === 'number' && status !== 401 && status !== 403 && status !== 404) return;
  const fingerprint = aiConfigFingerprint(cfg);
  if (!fingerprint) return;
  const checkedAt = Date.now();
  const detail: AiStatusDetail =
    kind === 'auth' ? 'auth' : kind === 'notfound' ? 'notfound' : kind === 'network' ? 'network' : '';
  writePersisted({ fingerprint, status: 'invalid', checkedAt, detail });
  emit({ status: 'invalid', model: cfg?.model || '', checkedAt, detail });
}

/**
 * 五态文案（中英各一）。刻意不塞进 i18n.ts：这组文案与状态机同生共死，
 * 且 valid 态要插当前模型名，放在最近处才不会与 i18n 里的同名键说法漂移。
 */
export const AI_STATUS_LABEL: Record<AiStatus, { zh: string; en: string }> = {
  unconfigured: { zh: 'AI 助手（未配置）', en: 'AI Assistant (Not configured)' },
  configured: { zh: 'AI 助手（待验证，点一下状态点）', en: 'AI Assistant (Unverified, click the dot)' },
  verifying: { zh: 'AI 助手（正在验证…）', en: 'AI Assistant (Verifying…)' },
  valid: { zh: 'AI 助手（已就绪 · {model}）', en: 'AI Assistant (Ready · {model})' },
  invalid: { zh: 'AI 助手（连接异常，点一下状态点）', en: 'AI Assistant (Connection error, click the dot)' },
};

/** invalid 的原因文案（健康卡片第二行） */
export const AI_STATUS_DETAIL: Record<Exclude<AiStatusDetail, ''>, { zh: string; en: string }> = {
  auth: { zh: '鉴权失败：Key 无效或无权限（401/403）', en: 'Auth failed: invalid key or no permission (401/403)' },
  notfound: { zh: '端点或模型不存在（404）', en: 'Endpoint or model not found (404)' },
  model: { zh: '服务商未提供该模型', en: 'The provider does not offer this model' },
  network: { zh: '网络不通或端点不可达', en: 'Network unreachable or endpoint down' },
  rejected: { zh: '请求被拒绝：模型名或参数不被接受（400）', en: 'Request rejected: model or parameters refused (400)' },
  server: { zh: '服务商暂时不可用（429/5xx）', en: 'Provider temporarily unavailable (429/5xx)' },
  badurl: { zh: '端点地址无效：只接受 http/https', en: 'Invalid endpoint: http/https only' },
};

/**
 * 角标配色：**只用设计令牌**（--warn / --muted / --success / --error），
 * 不引 Tailwind 调色板色——调色板色在深色主题下不会随令牌自适应。
 * 逐态写全字面量类名：Tailwind 静态扫描扫不到拼接出来的类名。
 *
 * 形状另有语义（见 AI_STATUS_HOLLOW）：实心 = 已有确定结论，空心 = 结论未定。
 */
export const AI_STATUS_DOT: Record<AiStatus, string> = {
  unconfigured: 'bg-[var(--warn)]',
  configured: '',
  verifying: '',
  valid: 'bg-[var(--success)]',
  invalid: 'bg-[var(--error)]',
};

/** 空心环：configured（待验证）与 verifying（验证中）——形状表不确定、颜色表健康度 */
export const AI_STATUS_HOLLOW: Record<'configured' | 'verifying', string> = {
  configured: 'border-2 border-[var(--warn)] bg-[var(--bg)]',
  verifying: 'border-2 border-[var(--muted)] bg-[var(--bg)] motion-safe:animate-pulse',
};

/** 该状态是否用空心环渲染（唯一定义，Header 与守卫共用） */
export function isHollowStatus(s: AiStatus): s is 'configured' | 'verifying' {
  return s === 'configured' || s === 'verifying';
}

/**
 * 「上次检测」的人话时间：卡片与悬浮提示共用。
 * 不做绝对时间（2026-10-20 14:03 这种）——用户关心的永远是「多久以前」。
 */
export function aiCheckedAtLabel(checkedAt: number | null, lang: 'zh' | 'en', now: number = Date.now()): string {
  if (checkedAt === null || !Number.isFinite(checkedAt)) return lang === 'zh' ? '从未检测' : 'Never checked';
  const diff = Math.max(0, now - checkedAt);
  const min = Math.floor(diff / 60000);
  if (min < 1) return lang === 'zh' ? '刚刚' : 'just now';
  if (min < 60) return lang === 'zh' ? `${min} 分钟前` : `${min} min ago`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return lang === 'zh' ? `${hour} 小时前` : `${hour} h ago`;
  const day = Math.floor(hour / 24);
  return lang === 'zh' ? `${day} 天前` : `${day} d ago`;
}

// 首帧就把状态算好（只读 localStorage，不联网）：避免「先闪一下未配置再变绿」。
// 这里刻意只读指纹存档、不 import ai-config 的 loadAiConfig（那会造成循环依赖），
// 真正的配置解析由 ai-context 在首帧渲染前调用 refreshAiStatus(loadAiConfig()) 完成。
