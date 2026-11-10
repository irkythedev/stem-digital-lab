/**
 * AI 回答「净版复制」清洗：把画面上的 KaTeX / 追问尾巴转换为可读纯文本。
 * 纯函数，零 DOM；复制按钮负责剪贴板兼容，本模块只负责内容。
 */

const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '−': '⁻',
};

function unicodeSubscript(value: string): string {
  return [...value].map((c) => SUB[c] ?? c).join('');
}
function unicodeSuperscript(value: string): string {
  return [...value].map((c) => SUP[c] ?? c).join('');
}

/** 复制只处理最终正文：任何残留的隐藏思考标签都先剔除，绝不进入剪贴板。 */
function stripThinkingTags(text: string): string {
  let out = text.replace(/<(think|thinking|reasoning)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  out = out.replace(/<(think|thinking|reasoning)\b[^>]*>[\s\S]*$/gi, '');
  out = out.replace(/<\/\s*(think|thinking|reasoning)\s*>/gi, '');
  return out;
}

function stripWrappers(text: string): string {
  let out = text;
  // \mathrm{...} / \text{...} / \mathbf{...}（允许一层内部花括号，兼容 SO_4^{2-}）
  const WRAP = /\\(?:mathrm|text|textrm|mathbf|mathit|operatorname)\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  // 嵌套可能不止一轮；最多展开几轮，避免异常输入死循环。
  for (let i = 0; i < 4; i++) {
    const next = out.replace(WRAP, '$1');
    if (next === out) break;
    out = next;
  }
  return out;
}

function replaceFrac(text: string): string {
  // 简单一层分式：单字符分子/分母保留紧凑写法，其它加括号防止歧义。
  return text.replace(/\\(?:dfrac|tfrac|frac)\{([^{}]+)\}\{([^{}]+)\}/g, (_m, a: string, b: string) =>
    a.length === 1 && b.length === 1 ? `${a}/${b}` : `(${a})/(${b})`,
  );
}

function replaceSupSub(text: string): string {
  let out = text;
  // \overset{+2}{Ca} -> Ca(+2价)
  out = out.replace(/\\overset\{([^{}]+)\}\{([^{}]+)\}/g, (_m, v: string, base: string) => `${base}(${v}价)`);
  // 先处理带花括号的上下标，再处理裸的 _2 / ^2
  out = out.replace(/_\{([^{}]+)\}/g, (_m, v: string) => unicodeSubscript(v));
  out = out.replace(/\^\{([^{}]+)\}/g, (_m, v: string) => unicodeSuperscript(v));
  out = out.replace(/_([0-9])/g, (_m, v: string) => unicodeSubscript(v));
  out = out.replace(/\^([0-9+\-−])/g, (_m, v: string) => unicodeSuperscript(v));
  // 中文修饰下标：F_浮 / R_总 -> F浮 / R总
  return out.replace(/_([\u4e00-\u9fff]+)/g, '$1');
}

function replaceSymbols(text: string): string {
  return text
    .replace(/\\rho/g, 'ρ')
    .replace(/\\eta/g, 'η')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\pi/g, 'π')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\mu/g, 'μ')
    .replace(/\\Omega/g, 'Ω')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\le/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\triangle/g, '△')
    .replace(/\\angle/g, '∠')
    .replace(/\\perp/g, '⊥')
    .replace(/\\parallel/g, '∥')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '');
}

/** 去除末尾「可以继续了解 / Further questions / You can also explore」及 3 条追问。 */
function stripFollowUps(text: string): string {
  const marker = text.search(/\n\s*(?:可以继续了解|可以继续了解[:：]|Further questions[:：]?|You can also explore[:：]?)/i);
  return marker >= 0 ? text.slice(0, marker) : text;
}

/** 把 AI 回答原文转换为干净、可读的纯文本，用于剪贴板。 */
export function formatAiAnswerForClipboard(rawText: string): string {
  if (!rawText) return '';
  let out = stripFollowUps(stripThinkingTags(rawText));
  // AI 常把 LaTeX 写成 \\\(（双反斜杠）；先归一化，再剥离外壳。
  out = out.replace(/\\\\/g, '\\');
  out = out.replace(/\*\*/g, '');
  out = out.replace(/\\(?:\(|\)|\[|\])/g, '');
  out = replaceFrac(out);
  out = stripWrappers(out);
  out = replaceSupSub(out);
  out = replaceSymbols(out);
  // 清理因去包裹留下的空格与空行
  out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return out;
}
