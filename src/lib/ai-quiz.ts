/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 出题练习（Quiz）数据解析与判分：
 * - 解析：把 AI 按 buildQuizPrompt 输出的格式化单题解析为结构化对象。
 *   宽容解析：精确 marker 优先，变体回退，最后降级为「原样题目 + 无选项」。
 * - 判分：judgeFillAnswer 填空题三级归一化（数字容差 / 单位归一 / LaTeX 等价）。
 *
 * 题型：choice（四选一）与 fill（填空）。填空记录 options=[] 且 answerIdx=-1，
 * 与「解析失败」（options 非空但 answerIdx=-1）不冲突。
 */

export type QuizType = 'choice' | 'fill';

export interface QuizQuestion {
  /** 题干（可能含 LaTeX 公式）；填空题为含空位（____）的题干 */
  question: string;
  /** 选项（选择题 0-4 个；填空题为空数组） */
  options: string[];
  /** 正确选项下标（0-3；填空题恒 -1；选择题解析失败也为 -1） */
  answerIdx: number;
  /** 解析（为什么对/错） */
  explanation: string;
  /** 题型：choice / fill（老数据缺省按 options 长度回退为 choice） */
  type: QuizType;
  /** 填空题标准答案（可多个等价写法；选择题为空数组） */
  fillAnswers: string[];
}

/** 提取连续选项行（A./B./C./D. 或 A、B、… 开头），返回选项数组与消费到的下标 */
function extractOptions(lines: string[], from: number): { options: string[]; next: number } {
  const options: string[] = [];
  let i = from;
  while (i < lines.length && options.length < 4) {
    const line = lines[i].trim();
    const m = line.match(/^([A-Da-d])[.、)．:：]\s*(.*)$/);
    if (m) {
      const idx = m[1].toUpperCase().charCodeAt(0) - 65;
      // 允许跳过缺失的选项字母（如只有 B C D），但仍要尽量对齐 A B C D
      while (options.length < idx) options.push('');
      options.push(m[2].trim());
      i++;
    } else {
      break;
    }
  }
  return { options, next: i };
}

/** 判断答案文本是否为「选项字母」形式（A/B/C/D 单字母） */
function isChoiceLetter(text: string): boolean {
  return /^[A-Da-d]$/.test(text.trim());
}

/**
 * 把 AI 原始输出解析为 QuizQuestion（宽容失败降级）。
 * 答案段为 A-D 单字母 → 选择题；否则 → 填空题（fillAnswers 按「或/or」拆分）。
 */
export function parseQuizQuestion(raw: string): QuizQuestion {
  if (!raw || !raw.trim()) {
    return { question: '', options: [], answerIdx: -1, explanation: '', type: 'choice', fillAnswers: [] };
  }
  const text = raw.trim();
  // 按字段名切分（支持中文【】）
  const parts = text.split(/\n(?=【题目】|【答案】|【解析】|【类型】)/);
  let question = '';
  let answerRaw = '';
  let explanation = '';
  let typeRaw = '';
  let body = text; // 默认：整段作为题目区（解析失败兜底）

  for (const seg of parts) {
    if (seg.startsWith('【题目】')) {
      question = seg.slice('【题目】'.length).trim();
      body = seg;
    } else if (seg.startsWith('【答案】')) {
      answerRaw = seg.slice('【答案】'.length).trim();
    } else if (seg.startsWith('【解析】')) {
      explanation = seg.slice('【解析】'.length).trim();
    } else if (seg.startsWith('【类型】')) {
      typeRaw = seg.slice('【类型】'.length).trim();
    }
  }

  // 从 body 提取选项（跳过题干行）
  const bodyLines = body.split('\n');
  const { options, next } = extractOptions(bodyLines, 1);

  // 若 body 内选项不足 4 个，回退到全文本里找（AI 可能把选项和题干混排）
  let opts = options;
  if (opts.length < 4) {
    const { options: o2 } = extractOptions(text.split('\n'), 0);
    if (o2.length > opts.length) opts = o2;
  }

  // 题干里剥离选项行（AI 有时把选项写在题干行内，如 "请问...？A. ... B. ..."）
  const qLines = question.split('\n').filter((l) => !/^[A-Da-d][.、)．:：]/.test(l.trim()));
  question = qLines.join('\n').trim();

  // 题型判定：显式【类型】优先；否则按答案形态回退
  const answerLetter = isChoiceLetter(answerRaw) ? answerRaw.toUpperCase() : '';
  const type: QuizType =
    (typeRaw || '').toLowerCase().includes('填') || /fill/i.test(typeRaw)
      ? 'fill'
      : (typeRaw || '').toLowerCase().includes('单') || /choice|select/i.test(typeRaw)
        ? 'choice'
        : answerLetter
          ? 'choice'
          : 'fill';
  const answerIdx = answerLetter ? answerLetter.charCodeAt(0) - 65 : -1;

  // 填空答案拆分：按「或 / or / ｜ / |」分隔，trim + 去空
  const fillAnswers = type === 'fill'
    ? answerRaw.split(/\s*(?:或|或者|or|｜|\|)\s*/i)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 60)
    : [];

  return {
    question: question || text.slice(0, 200),
    options: opts.slice(0, 4),
    answerIdx: answerIdx >= 0 && answerIdx < 4 ? answerIdx : -1,
    explanation,
    type,
    fillAnswers,
  };
}

/**
 * 批量解析 AI 出题输出（buildQuizPrompt 的「第 N 题」分组格式）。
 * 按「【第N题】」或空行分组，对每组复用 parseQuizQuestion 的宽容解析；
 * 选择题要求 options≥2 且 answerIdx≥0；填空题要求 fillAnswers 非空。
 */
export function parseQuizBatch(raw: string, expectedCount?: number): QuizQuestion[] {
  if (!raw || !raw.trim()) return [];
  const text = raw.trim();
  // 1) 按【第N题】显式分组
  const marked = text.split(/\n(?=【第\d+题】)/).filter((s) => s.includes('【第'));
  // 2) 无显式标记时按空行分组（AI 可能省略编号）
  const grouped = marked.length > 0 ? marked : text.split(/\n\s*\n/).filter((s) => s.includes('【题目】'));
  const out: QuizQuestion[] = [];
  const isAcceptable = (q: QuizQuestion) => {
    if (!q.question) return false;
    if (q.type === 'fill') return q.fillAnswers.length > 0;
    return q.options.length >= 2 && q.answerIdx >= 0;
  };
  for (const group of grouped) {
    // 去掉「第N题」行本身
    const clean = group.replace(/^【第\d+题】\s*\n?/, '');
    const q = parseQuizQuestion(clean);
    if (isAcceptable(q)) out.push(q);
  }
  // 3) 兜底：分组解析不足时，尝试按【题目】出现次数切分整段
  if (out.length === 0 && text.includes('【题目】')) {
    const byField = text.split(/\n(?=【题目】)/).filter((s) => s.includes('【题目】'));
    for (const group of byField) {
      const q = parseQuizQuestion(group);
      if (isAcceptable(q)) out.push(q);
    }
  }
  return out;
}

/* ── 填空题判分：三级归一化 ── */

/** 常用初中数理化单位归一词典（英文 / 中文别名 → 规范形式） */
const UNIT_ALIASES: Record<string, string> = {
  // 电流 / 电压 / 电阻 / 电功率 / 电能
  a: 'A', amp: 'A', amps: 'A', ampere: 'A', 安: 'A', 安培: 'A',
  v: 'V', volt: 'V', volts: 'V', 伏: 'V', 伏特: 'V',
  ohm: 'Ω', ohms: 'Ω', 欧: 'Ω', 欧姆: 'Ω',
  w: 'W', watt: 'W', watts: 'W', 瓦: 'W', 瓦特: 'W',
  // 质量 / 长度 / 时间 / 温度 / 力 / 面积 / 体积
  kg: 'kg', 千克: 'kg', 公斤: 'kg',
  g: 'g', 克: 'g',
  mg: 'mg', 毫克: 'mg',
  m: 'm', 米: 'm',
  cm: 'cm', 厘米: 'cm',
  mm: 'mm', 毫米: 'mm',
  km: 'km', 千米: 'km',
  s: 's', sec: 's', secs: 's', second: 's', seconds: 's', 秒: 's',
  min: 'min', minute: 'min', minutes: 'min', 分: 'min', 分钟: 'min',
  h: 'h', hr: 'h', hour: 'h', hours: 'h', 时: 'h', 小时: 'h',
  '°c': '°C', '℃': '°C', 摄氏度: '°C',
  n: 'N', newton: 'N', newtons: 'N', 牛: 'N', 牛顿: 'N',
  'm2': 'm²', 'm^2': 'm²', 平方米: 'm²',
  'm3': 'm³', 'm^3': 'm³', 立方米: 'm³',
  l: 'L', 升: 'L', ml: 'mL', 毫升: 'mL',
};

/** 全角 → 半角 + 大小写统一（用于无关紧要的比较） */
function normalizeCase(s: string): string {
  return s
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/。|．/g, '.');
}

/** 去除 LaTeX 格式符号（\ { } _ ^ 与命令），用于化学式等纯文本比较 */
function stripLatex(s: string): string {
  return s
    // 1) 先移除公式定界符 \( \) \[ \] $$
    .replace(/\\\(|\\\)|\\\[|\\\]|\$\$?/g, '')
    // 2) 将 \frac{a}{b} 转为 a/b（核心修复：用户 i=u/r 应匹配 I=U/R）
    .replace(/\\(?:frac|dfrac)\s*\{([^}]*)\}\s*\{([^}]*)\}/g, '$1/$2')
    // 3) 移除口语读法注释（（即...） 或 (that is, ...)），这些是 AI 出题时加的，不改变答案含义
    .replace(/[（(]即[^）)]*[）)]/g, '')
    .replace(/\(that is,[^)]*\)/gi, '')
    // 4) 移除其他 LaTeX 命令
    .replace(/\\(?:mathrm|text|rm|bf|mathit|displaystyle|cdot)\b(?:\s*\{[^}]*\})?/g, '')
    // 5) 移除花括号和反斜杠等符号
    .replace(/[\\{}_^]/g, '')
    // 6) 去空格，小写
    .replace(/\s+/g, '')
    .toLowerCase();
}

/** 从字符串中提取数值（支持小数 / 科学计数 / 分数 / 带单位），失败返回 null */
function extractNumber(s: string): number | null {
  const t = s.trim().toLowerCase();
  const frac = t.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/);
  if (frac && parseFloat(frac[2]) !== 0) return parseFloat(frac[1]) / parseFloat(frac[2]);
  const num = t.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);
  if (num) return parseFloat(num[0]);
  return null;
}

/** 从字符串末尾剥离单位（如 "0.5A" → 数值 0.5 + 单位 A），返回 [数值, 剩余串] */
function splitNumberUnit(s: string): { value: number | null; rest: string } {
  const t = s.trim();
  const m = t.match(/^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(.*)$/i);
  if (!m) return { value: null, rest: t };
  return { value: parseFloat(m[1]), rest: (m[2] || '').trim() };
}

/** 单位归一：别名词典 + 去空格/全半角，返回规范单位或原串 */
function normalizeUnit(u: string): string {
  if (!u) return '';
  const key = normalizeCase(u).replace(/\s+/g, '');
  return UNIT_ALIASES[key] ?? normalizeCase(u).replace(/\s+/g, '');
}

/** 判分填空答案：三级归一化（数字容差 / 单位归一 / LaTeX 与格式等价） */
export function judgeFillAnswer(studentInput: string, fillAnswers: string[]): boolean {
  const stu = (studentInput || '').trim();
  if (!stu || fillAnswers.length === 0) return false;
  return fillAnswers.some((ans) => judgeSingle(stu, ans.trim()));
}

/** 单条标准答案比较 */
function judgeSingle(stu: string, ans: string): boolean {
  if (!stu || !ans) return false;

  // 1) 数值容差：双方都是纯数字 / 分数 / 科学计数
  const stuNum = extractNumber(stu);
  const ansNum = extractNumber(ans);
  if (stuNum !== null && ansNum !== null && !hasAlphabeticAfterNumber(stu) && !hasAlphabeticAfterNumber(ans)) {
    return Math.abs(stuNum - ansNum) <= 1e-6;
  }

  // 2) 数字 + 单位：拆分数值与单位后分别比较
  const ss = splitNumberUnit(stu);
  const sa = splitNumberUnit(ans);
  if (ss.value !== null && sa.value !== null && Math.abs(ss.value - sa.value) <= 1e-6) {
    const u1 = normalizeUnit(ss.rest);
    const u2 = normalizeUnit(sa.rest);
    if (u1 === u2 && u1 !== '') return true;
  }

  // 3) LaTeX / 格式等价：去 LaTeX 符号、去空白、大小写不敏感
  return stripLatex(stu) === stripLatex(ans);
}

/** 判断字符串在数值后是否还带字母（用于阻止把 "0.5A" 与 "0.5" 误判为纯数值比较） */
function hasAlphabeticAfterNumber(s: string): boolean {
  return /[a-zа-я]|[A-Z]|°|℃/i.test(s.replace(/^\s*-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/, ''));
}
