/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 学习助手配置：用户自行配置 API Key（本站不提供、不代购、不收取费用）。
 *
 * 隐私说明：
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
      `6. 回答简明，先给结论再解释，可适当举例；正文控制在 300 字以内，给追问段留足空间。\n` +
      `7. 数学公式必须用 LaTeX 书写：行内公式用 \\(...\\) 包裹（如 \\(y=ax^2+bx+c\\)），独立成行的公式用 \\[...\\] 包裹，便于渲染；\n` +
      `8. 当公式首次出现时，紧随其后用括号补充一句该公式的中文口语读法，例如：\\(v=\\frac{s}{t}\\)（即 v 等于 s 除以 t）、\\(H_2O\\)（即水）；口语读法帮助朗读功能准确发音，只补充不重复讲解；\n` +
      `9. 回答末尾必须另起一行，原样输出一行「可以继续了解：」（不得省略、不得改写为其他措辞），随后给出 3-5 个与本题相关、适合初中生的追问问题（每行一个，编号 1. 2. 3.）。这一追问段是必选项：即使回答很短也一定要给；若内容较多，请控制正文篇幅以保证追问段完整输出。` +
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
    '6. Be concise: conclusion first, then explanation with examples; keep the body under 300 words so the follow-up section fits.\n' +
    '7. Write math formulas in LaTeX: inline formulas wrapped in \\(...\\) (e.g. \\(y=ax^2+bx+c\\)), display formulas in \\[...\\] — this is required so they render properly.\n' +
    '8. When a formula first appears, add a short parenthetical spoken-language reading right after it, e.g. \\(v=\\frac{s}{t}\\) (that is, v equals s divided by t) or \\(H_2O\\) (that is, water). This helps the read-aloud feature pronounce it correctly; add the reading only, do not re-explain.\n' +
    '9. End with the exact line "You can also explore:" (do not omit or rephrase it), followed by 3-5 follow-up questions about this topic suitable for middle-schoolers (one per line, numbered 1. 2. 3.). This section is mandatory: even very short answers must include it. Keep the answer concise so the follow-up section fits.' +
    ref
  );
}

/** 出题角度 */
export type QuizAngle = 'basic' | 'advanced' | 'tricky';

/** 出题练习系统提示词：基于当前页面知识批量出单选题（学生作答后本地判分） */
export function buildQuizPrompt(
  lang: 'zh' | 'en',
  subjectHint?: string,
  knowledge?: string,
  count = 5,
  angle: QuizAngle = 'basic',
  timeLimitSec = 0,
): string {
  const subject = subjectHint || '';
  const ref = knowledge
    ? `\n以下是当前页面实际包含的知识点，必须围绕它出题（禁止超出页面与初中教材范围；若知识不足，出最贴近的教材基础题）：\n${knowledge}`
    : '';
  const angleZh = angle === 'basic' ? '基础知识' : angle === 'advanced' ? '进阶提升' : '易混淆辨析';
  const angleDescZh = angle === 'basic'
    ? '侧重核心概念、公式与定义，难度基础'
    : angle === 'advanced'
      ? '侧重综合应用、多步推导与变式，难度进阶'
      : '侧重易混概念与常见错误选项的辨析（如正比与反比、串联与并联、物理量与单位）';
  const angleEn = angle === 'basic' ? 'basic knowledge' : angle === 'advanced' ? 'advanced application' : 'easy-to-confuse concepts';
  const angleDescEn = angle === 'basic'
    ? 'core concepts, formulas and definitions, basic difficulty'
    : angle === 'advanced'
      ? 'integrated application, multi-step reasoning and variants, advanced difficulty'
      : 'distinguish easily-confused concepts and common wrong options (e.g. direct vs inverse proportion, series vs parallel, quantity vs unit)';
  const timeHint = timeLimitSec > 0
    ? (lang === 'zh' ? `每题限时 ${timeLimitSec} 秒，题目应能在限时内读完并作答` : `Each question has a ${timeLimitSec}-second time limit; keep it answerable within the limit`)
    : (lang === 'zh' ? '' : '');
  if (lang === 'zh') {
    return (
      '你是「数理化数字实验室」的初中数理化出题老师，面向初中生（7-9 年级）。' +
      `请严格按以下格式出 ${count} 道单选题（不要多出也不要少出）：\n` +
      `1. 题目必须围绕当前页面知识点${subject ? `（当前主题：${subject}）` : ''}，角度为「${angleZh}」（${angleDescZh}）；\n` +
      `2. 每道题四个选项 A. B. C. D.，其中只有一个正确，正确项要唯一且无歧义；\n` +
      `3. 输出格式严格为（每道题一组，组间用空行分隔，字段名与分隔符原样输出）：\n` +
      `【第1题】\n【题目】题干（含必要的公式，公式用 LaTeX 行内 \\(...\\) 包裹，如 \\(y=ax^2+bx+c\\)）\nA. 选项内容\nB. 选项内容\nC. 选项内容\nD. 选项内容\n【答案】X（X 为正确选项的字母 A/B/C/D，只输出字母）\n【解析】为什么选 X，以及其他选项错在哪（面向初中生，简明，公式用 LaTeX）\n\n` +
      `【第2题】\n（以此类推，共 ${count} 题）\n` +
      `4. 题目和选项中的公式首次出现时，用括号补充中文口语读法（如 \\(I=\\frac{U}{R}\\)（即 I 等于 U 除以 R）），帮助朗读准确发音；\n` +
      `5. 答案必须基于教材口径（数学人教版、物理苏科版、化学人教版），不确定就选最有把握的教材结论；\n` +
      `6. 语言适合未成年人，健康积极。\n` +
      `7. 各题考察不同侧面，避免题目重复或仅替换数字、选项顺序。\n` +
      (timeHint ? timeHint + '\n' : '') +
      ref
    );
  }
  return (
    'You are the quiz teacher of "STEM Digital Lab" for middle-school students (grades 7-9).' +
    ` Create EXACTLY ${count} single-choice questions following this strict format (no more, no fewer):\n` +
    '1. Each question must be based on the current page knowledge' +
    (subject ? ` (current topic: ${subject})` : '') +
    `, angle: ${angleEn} (${angleDescEn}), at middle-school difficulty.\n` +
    '2. Four options A. B. C. D. per question, exactly one correct and unambiguous.\n' +
    '3. Output format, one group per question separated by a blank line, keep the field names verbatim:\n' +
    'IMPORTANT: you MUST use these exact Chinese field markers 【第1题】【题目】【答案】【解析】 exactly as shown - do NOT translate or rephrase them, even though the instructions are in English.\n' +
    '【第1题】\n【题目】question text (formulas in inline LaTeX \\(...\\), e.g. \\(y=ax^2+bx+c\\))\nA. option\nB. option\nC. option\nD. option\n【答案】X (X is the correct letter A/B/C/D, output only the letter)\n【解析】why X is correct and why the others are wrong (concise, middle-school level, formulas in LaTeX)\n\n' +
    '【第2题】\n(and so on, exactly ' + count + ' questions)\n' +
    '4. When a formula first appears, add a short parenthetical spoken reading right after it (e.g. \\(I=U/R\\) (that is, I equals U over R)) so the read-aloud feature pronounces it correctly.\n' +
    '5. Follow textbook standards: PEP for math and chemistry, Su-Ke edition for physics; if unsure, pick the most defensible textbook conclusion.\n' +
    '6. Keep language kid-friendly and positive.\n' +
    '7. Each question must test a different aspect - do NOT repeat questions or just swap numbers/option order between them.\n' +
    (timeHint ? timeHint + '\n' : '') +
    ref
  );
}

/**
 * 错题集「AI 归纳」系统提示词：把本地错题清单交给 AI，生成面向初中生的学习诊断。
 * 仅输出学习策略与错因归类，不虚构学生未做过的知识点；纳入系统提示以约束口径。
 * 输入为 buildQuizRecordsForSummary() 产出的错题文本。
 */
export function buildQuizSummaryPrompt(
  lang: 'zh' | 'en',
  records: string,
  scopeLabel?: string,
): string {
  const scope = scopeLabel
    ? (lang === 'zh' ? `\n本次仅针对范围：${scopeLabel}。` : `\nThis covers the filtered scope: ${scopeLabel}.`)
    : '';
  if (lang === 'zh') {
    return (
      '你是「数理化数字实验室」的初中数理化学习诊断老师。' +
      `下面是该学生在考考你练习中的作答记录，请结合它们做一份学习诊断。${scope}\n` +
      '要求：\n' +
      '1. 只依据给定记录归纳，不要虚构学生没做过的知识点；记录不足就如实说明。\n' +
      '2. 指出最明显的薄弱知识点（错误最集中、正确率最低的 1-2 个），用初中生能懂的话说明可能的原因（概念没吃透/计算粗心/易混易错）。\n' +
      '3. 若记录里有「超时未答」「反复选同一个错误选项」这类特征，明确指出，并给出对应的复习建议。\n' +
      '4. 给出 2-3 条具体、可执行的复习建议（先补哪个，怎么补），以及 1 句鼓励。\n' +
      '5. 语言适合未成年人，积极健康、不打击；以教材和老师讲解为准。\n' +
      '6. 正文控制在 250 字以内，用 Markdown 分节（如「薄弱点」「建议」），公式或专有名词可简单说明。\n\n' +
      `学生的作答记录：\n${records}`
    );
  }
  return (
    'You are the learning-diagnosis teacher of "STEM Digital Lab" for middle-school students (grades 7-9).' +
    ' Here are the student\'s quiz answer records from the "Quiz me" practice. Make a learning diagnosis.' +
    scope + '\nRequirements:\n' +
    '1. Base your diagnosis only on the given records; do not invent topics the student never studied; if records are sparse, say so.\n' +
    '2. Point out the most obvious weak topics (the 1-2 with the most mistakes / lowest accuracy) and explain in kid-friendly terms the likely cause (concept unclear / careless / easy-to-confuse).\n' +
    '3. If you notice "timed out" or "repeatedly picking the same wrong option", call it out and give concrete review advice.\n' +
    '4. Give 2-3 specific, actionable review suggestions (which to review first and how) and one encouraging line.\n' +
    '5. Keep it kid-friendly, positive, and defer to the textbook and teacher.\n' +
    '6. Keep the body under 250 words, use Markdown sections (e.g. "Weak spots", "Suggestions"), and explain any jargon or formulas simply.\n\n' +
    `The student's answer records:\n${records}`
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
  maxTokens?: number,
): Promise<string> {
  const url = `${normalizeBaseUrl(cfg.baseUrl)}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      stream: true,
      // 输出上限：对话与出题分开设（对话 2000 保证追问段完整，出题 4000 保证末题不截断）
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    }),
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
