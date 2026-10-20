/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 顶栏 AI 图标的状态机（四态）：
 *   unconfigured 未配置 / configured 已配置待验证 / valid 已验证连通 / invalid 连接或鉴权异常
 *
 * 三条纪律：
 * - 零轮询：页面加载绝不自动 Ping（不替用户烧配额）。状态只由三件事推进——
 *   配置变更、用户主动「测试连接」、以及真实对话/出题的实战结果。
 * - 零泄漏：持久化只写「配置指纹」（provider + model + baseUrl + Key 的长度与首尾各两字符），
 *   不含 Key 本体，任何时刻都无法从存档里还原密钥。
 * - 零渲染耦合：本模块不依赖 ai-config 的运行时（只 import type，编译期擦除），
 *   因此 request 咽喉可以直接调它，UI 用 useAiStatus() 订阅。
 */
import { useSyncExternalStore } from 'react';
import type { AiConfig } from './ai-config';

export type AiStatus = 'unconfigured' | 'configured' | 'valid' | 'invalid';

export interface AiStatusSnapshot {
  status: AiStatus;
  /** valid 时用于提示文案的模型名（无则空串） */
  model: string;
}

const STORAGE_KEY = 'stem-ai-status';

/** 只持久化「已验证过的结论」：configured 是瞬时中间态，刷新后由指纹重新推导 */
interface Persisted {
  fingerprint: string;
  status: 'valid' | 'invalid';
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
    if (parsed && typeof parsed.fingerprint === 'string' && (parsed.status === 'valid' || parsed.status === 'invalid')) return parsed;
    return null;
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

let snapshot: AiStatusSnapshot = { status: 'unconfigured', model: '' };
const listeners = new Set<() => void>();

function emit(next: AiStatusSnapshot): void {
  if (next.status === snapshot.status && next.model === snapshot.model) return;
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

/** 订阅四态（useSyncExternalStore：外部 store + 并发渲染安全） */
export function useAiStatus(): AiStatusSnapshot {
  return useSyncExternalStore(subscribeAiStatus, getAiStatus, getAiStatus);
}

/**
 * 依当前配置重算状态（**不联网**）：
 * - Key 为空或配置不完整 → unconfigured
 * - 指纹与上次验证不一致（换了 Key/模型/端点）→ configured（旧结论作废，绝不冒充已验证）
 * - 指纹一致 → 直接恢复上次的 valid / invalid
 * 调用点：模块加载、配置保存、清除配置。切换页面不调用（没有新信息就不要改状态）。
 */
export function refreshAiStatus(cfg: AiConfig | null | undefined): void {
  const fingerprint = aiConfigFingerprint(cfg);
  const hasKey = !!((cfg?.apiKey || '').trim());
  if (!cfg || !fingerprint || !hasKey || !cfg.baseUrl || !cfg.model) {
    writePersisted(null);
    emit({ status: 'unconfigured', model: '' });
    return;
  }
  const saved = readPersisted();
  const restored: AiStatus = saved && saved.fingerprint === fingerprint ? saved.status : 'configured';
  emit({ status: restored, model: cfg.model });
}

/**
 * 实战成功（HTTP 200 / 流式首包到达）：这是唯一能证明「当前这套配置真能用」的证据，
 * 因此它优先于任何历史结论，直接置 valid 并落盘。
 */
export function reportAiSuccess(cfg: AiConfig | null | undefined): void {
  const fingerprint = aiConfigFingerprint(cfg);
  if (!fingerprint) return;
  writePersisted({ fingerprint, status: 'valid' });
  emit({ status: 'valid', model: cfg?.model || '' });
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
  if (classifyAiError(error) === 'abort') return;
  // 429 限流 / 5xx 服务端故障：说的是「服务商此刻给不给」，与「这套配置能不能用」无关。
  // 若一并置 invalid，学生会在服务商抽风时看到红的「连接异常」，反而误导排查方向。
  const status = (error as { status?: number } | null | undefined)?.status;
  if (typeof status === 'number' && status !== 401 && status !== 403 && status !== 404) return;
  const fingerprint = aiConfigFingerprint(cfg);
  if (!fingerprint) return;
  writePersisted({ fingerprint, status: 'invalid' });
  emit({ status: 'invalid', model: cfg?.model || '' });
}

/**
 * 四态文案（中英各一）。刻意不塞进 i18n.ts：这组文案与状态机同生共死，
 * 且 valid 态要插当前模型名，放在最近处才不会与 i18n 里的同名键说法漂移。
 */
export const AI_STATUS_LABEL: Record<AiStatus, { zh: string; en: string }> = {
  unconfigured: { zh: 'AI 助手（未配置）', en: 'AI Assistant (Not configured)' },
  configured: { zh: 'AI 助手（已配置，待验证）', en: 'AI Assistant (Configured, unverified)' },
  valid: { zh: 'AI 助手（已就绪 · {model}）', en: 'AI Assistant (Ready · {model})' },
  invalid: { zh: 'AI 助手（连接异常，点击检查配置）', en: 'AI Assistant (Connection error, click to check)' },
};

/**
 * 角标配色：**只用设计令牌**（--warn / --muted / --success / --error），
 * 不引 Tailwind 调色板色——调色板色在深色主题下不会随令牌自适应。
 * 逐态写全字面量类名：Tailwind 静态扫描扫不到拼接出来的类名。
 */
export const AI_STATUS_DOT: Record<AiStatus, string> = {
  unconfigured: 'bg-[var(--warn)]',
  configured: 'bg-[var(--muted)]',
  valid: 'bg-[var(--success)]',
  invalid: 'bg-[var(--error)]',
};

// 首帧就把四态算好（只读 localStorage，不联网）：避免「先闪一下未配置再变绿」。
// 这里刻意只读指纹存档、不 import ai-config 的 loadAiConfig（那会造成循环依赖），
// 真正的配置解析由 ai-context 在首帧渲染前调用 refreshAiStatus(loadAiConfig()) 完成。
