/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 学习助手配置：用户自行配置 API Key（本站不提供、不代购、不收取费用）。
 *
 * 合规与隐私设计：
 * - 预设仅限大陆可用服务商（OpenAI 兼容格式），外加自定义端点；
 * - API Key 仅存用户本机浏览器 localStorage，本站不采集、不存储、不中转；
 * - 对话由浏览器直接发送至用户所选服务商，本站无后端、不记录任何内容；
 * - 使用前须勾选「已阅读并同意」使用须知（强制知情同意）；
 * - 全部权责由用户与其所选 AI 服务商自行承担，与本站无关。
 */
export interface AiProvider {
  id: string;
  name: string;
  /** OpenAI 兼容端点（不含 /chat/completions） */
  baseUrl: string;
  models: string[];
  /** 提示（如 CORS 受限、免费额度等） */
  note?: string;
}

export const AI_PROVIDERS: AiProvider[] = [
  { id: 'deepseek', name: 'DeepSeek 深度求索', baseUrl: 'https://api.deepseek.com', models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-pro'] },
  { id: 'dashscope', name: '通义千问（阿里云）', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-turbo', 'qwen-long'] },
  { id: 'moonshot', name: 'Kimi（月之暗面）', baseUrl: 'https://api.moonshot.cn/v1', models: ['kimi-k3', 'kimi-k2.6', 'kimi-k2.7-code'] },
  { id: 'zhipu', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-flash', 'glm-4-plus', 'glm-4.5'] },
  {
    id: 'volcengine',
    name: '豆包（火山方舟）',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-seed-2-0-lite-260428', 'doubao-1-5-pro-32k-250115'],
    note: '浏览器直连可能受限；如无法连接，请改用自定义端点（自建代理）',
  },
  { id: 'custom', name: '自定义端点', baseUrl: '', models: [], note: '任意 OpenAI 兼容地址，一切权责由您自行承担' },
];

/** 字符数估算 token（1 token ≈ 1.8 字符，适用于中英混合文本） */
export function estimateTokens(text: string | number): number {
  return Math.round(String(text).length / 1.8) || 0;
}

/** 网络类错误判断：浏览器 fetch 失败的常见消息（含跨域/网络不可达） */
export function isNetworkError(msg: string): boolean {
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg);
}

/**
 * 端点归一化：兼容 Base URL（…/v1）与完整端点（…/v1/chat/completions），用户无感。
 * 安全：仅允许 http/https 协议（拒绝 javascript:/data: 等危险协议），并剥离 query 片段
 * （防止 `?x=1` 拼接 /models 时产生错误 URL）。
 */
export function normalizeBaseUrl(url: string): string {
  // 先剥离 query，再归一（顺序不能反：query 在末尾会挡住 /chat/completions 的 $ 锚点）
  const trimmed = url.trim().split('?')[0].replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
  if (!/^https?:\/\//i.test(trimmed)) return '';
  return trimmed;
}

export interface AiConfig {
  providerId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  /** 是否已勾选「已阅读并同意」使用须知 */
  agreed: boolean;
}

const STORAGE_KEY = 'stem-ai-config';

export function loadAiConfig(): AiConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AiConfig;
    // 配置完整才算有效：key / 端点 / 模型 / 同意 缺一不可，否则视为未配置（面板停在须知）
    // 端点再做一次协议白名单校验（防历史脏数据：javascript: 等危险协议直接作废）
    if (parsed && parsed.apiKey && parsed.model && parsed.agreed && /^https?:\/\//i.test(parsed.baseUrl)) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveAiConfig(config: AiConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/** 清除全部 AI 数据（key + 配置） */
export function clearAiConfig(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** 系统提示词：限定初中数理化学习辅助 + 教材口径 + 页面知识锚定 */
export function buildSystemPrompt(lang: 'zh' | 'en', subjectHint?: string, knowledge?: string): string {
  const subject = subjectHint || '';
  const ref = knowledge ? `\n以下是当前页面的实际内容，请基于它回答（若不足以回答，明确说明并建议查阅教材相关章节）：\n${knowledge}` : '';
  if (lang === 'zh') {
    return (
      '你是「数理化数字实验室」的初中数理化学习助手，面向初中生（7-9 年级）。' +
      `请严格遵守以下规则：\n` +
      `1. 仅回答初中数学、物理、化学相关的知识解释、概念辨析与解题思路${subject ? `，当前主题：${subject}` : ''}；\n` +
      `2. 教材口径：数学按人教版、物理按苏科版、化学按人教版；数学证明按教材推导思路，禁止循环论证；\n` +
      `3. 优先基于当前页面内容回答，不要超出页面与初中教材范围自由发挥；页面内容不足时明确说明；\n` +
      `4. 不回答医疗、法律、金融等非学习问题；拒绝生成违法违规、不健康内容；\n` +
      `5. 语言适合未成年人，积极健康；不确定的内容直接承认，禁止编造数值或结论，并提示以教材和老师讲解为准；\n` +
      `6. 回答简明，先给结论再解释，可适当举例。\n` +
      `7. 数学公式必须用 LaTeX 书写：行内公式用 \\(...\\) 包裹（如 \\(y=ax^2+bx+c\\)），独立成行的公式用 \\[...\\] 包裹，便于渲染；\n` +
      `8. 回答末尾另起一行，原样输出一行「可以继续了解：」（不得改写为其他措辞），随后给出 5 个与该知识点相关、适合初中生的追问问题（每行一个，编号 1. 2. 3. 4. 5.）。` +
      ref
    );
  }
  return (
    'You are the science learning assistant of "STEM Digital Lab" for middle-school students (grades 7-9).\n' +
    'Rules:\n' +
    '1. Answer only junior-high math / physics / chemistry questions (concepts, problem-solving).' +
    (subject ? ` Current topic: ${subject}.` : '') +
    '\n2. Follow textbook standards: PEP for math and chemistry, Su-Ke edition for physics; rigorous proofs, no circular reasoning.\n' +
    '3. Base your answer on the current page content below; do not freelance beyond the page and the middle-school textbooks; if the page is not enough, say so and point to the textbook chapter.' +
    '\n4. Decline non-study topics (medical, legal, financial) and any inappropriate content.\n' +
    '5. Keep language kid-friendly and positive; admit uncertainty instead of making up numbers or conclusions; refer to the textbook and teacher.\n' +
    '6. Be concise: conclusion first, then explanation with examples.\n' +
    '7. Write math formulas in LaTeX: inline formulas wrapped in \\(...\\) (e.g. \\(y=ax^2+bx+c\\)), display formulas in \\[...\\] — this is required so they render properly.\n' +
    '8. End with the exact line "You can also explore:" (do not rephrase it), followed by 5 follow-up questions suitable for middle-schoolers (one per line, numbered 1. 2. 3. 4. 5.).' +
    ref
  );
}

/** 拉取服务商实际可用模型列表（OpenAI 兼容 GET /models） */
export async function fetchModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const res = await fetch(`${normalizeBaseUrl(baseUrl)}/models`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as { data?: { id: string }[] };
  const ids = (j?.data ?? []).map((m) => m.id).filter(Boolean);
  return ids;
}

/** 流式请求 OpenAI 兼容 chat/completions，逐段回调 */
export async function streamChat(
  cfg: AiConfig,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const url = `${normalizeBaseUrl(cfg.baseUrl)}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages, stream: true }),
    signal,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message || j?.message || '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('no stream');
  const decoder = new TextDecoder();
  let full = '';
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const delta: string = json?.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        /* skip keep-alive or partial */
      }
    }
  }
  return full;
}
