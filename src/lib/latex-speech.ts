/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * LaTeX → 中文口语 转换器（供 TTS 朗读用）。
 *
 * 背景：AI 回答按系统提示词用 \(...\) / \[...\] 输出 LaTeX 公式，
 * cleanTextForTTS 原先只匹配 $...$ 并整体删成「公式省略。」，
 * 导致 \(...\) 里的 \frac \sqrt ^ _ 等命令原样进 TTS，合成器念英文命令字符。
 *
 * 本模块把常用初中 LaTeX 转成朗读友好的口语：
 *   \frac{a}{b}        → b 分之 a
 *   a^2 / a^{12}       → a 的平方 / a 的 12 次方
 *   x_1 / H_2O         → x 一 / H 二 O（下标数字直接读中文数字）
 *   \sqrt{4}           → 根号 4
 *   \times \cdot \div  → 乘以 / 乘以 / 除以
 *   \pi \rho \theta    → 派 / 柔 / 西塔（ρ 读 róu 是初中惯例「柔」）
 *   \Delta \neq \leq   → 德耳塔 / 不等于 / 小于等于
 *   未知命令            → 去掉反斜杠读原词（安全降级，绝不崩溃）
 */

import { CHEM_ZH, detectChem, chemPrePass, normChem } from './chem-speech';

const FRAC_A = 'frac-a';
const FRAC_B = 'frac-b';


/** 化学式归一：H_2O → H2O；Ca(OH)_2 → CaOH2（括号组展开）；下标数字后接元素符号时补空格拆词 */
export function normalizeChemFormula(raw: string): { normalized: string; spoken: string } {
  const normalized = normChem(raw);
  const spoken = normalized
    .replace(/([A-Za-z])(\d)/g, '$1 $2 ')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return { normalized, spoken };
}

/**
 * 尝试把一段可能是化学式的文本（如 H_2O、NaOH）转成中文名。
 * 若命中 CHEM_ZH 返回中文名；否则返回 null（调用方回退符号念法）。
 */
export function chemToSpeech(tex: string): string | null {
  const { normalized } = normalizeChemFormula(tex);
  return CHEM_ZH[normalized] ?? null;
}

/** 命令 → 口语 查表（命令名不带反斜杠） */
const CMD_ZH: Record<string, string> = {
  pi: '派',
  rho: '柔',
  theta: '西塔',
  alpha: '阿尔法',
  beta: '贝塔',
  gamma: '伽马',
  Delta: '德耳塔',
  delta: '德耳塔',
  lambda: '兰姆达',
  eta: '伊塔',
  mu: '谬',
  Omega: '欧米伽',
  omega: '欧米伽',
  sigma: '西格马',
  tau: '套',
  phi: '斐',
  times: '乘以',
  cdot: '乘以',
  div: '除以',
  pm: '正负',
  neq: '不等于',
  leq: '小于等于',
  geq: '大于等于',
  approx: '约等于',
  propto: '正比于',
  to: '趋向',
  rightarrow: '趋向',
  Rightarrow: '推出',
  leftarrow: '趋向',
  infty: '无穷',
  sum: '求和',
  int: '积分',
  mid: '满足',
  log: '对数',
  ln: '自然对数',
  sin: '正弦',
  cos: '余弦',
  tan: '正切',
  '%': '百分之',
  ' ': ' ',
  ',': '，',
  ';': '，',
  '!': '阶乘',
  '\\': '反斜杠',
};

/**
 * 裸 Unicode 符号 → 口语（与 \cmd 命令走同一查表语义，覆盖 AI 直接输出 unicode 符号的情况）。
 * 注意：| 与 ∣（U+2223）不在此表——绝对值有专门的配对处理（见主循环）。
 */
const UNI_ZH: Record<string, string> = {
  '<': '小于',
  '>': '大于',
  '≤': '小于等于',
  '≥': '大于等于',
  '≠': '不等于',
  '≈': '约等于',
  '±': '正负',
  '×': '乘以',
  '÷': '除以',
  '·': '乘以',
  'π': '派',
  'ρ': '柔',
  'θ': '西塔',
  'α': '阿尔法',
  'β': '贝塔',
  'γ': '伽马',
  'Δ': '德耳塔',
  'δ': '德耳塔',
  'λ': '兰姆达',
  'η': '伊塔',
  'μ': '谬',
  'Ω': '欧米伽',
  'ω': '欧米伽',
  'σ': '西格马',
  'τ': '套',
  'φ': '斐',
  '√': '根号',
  '°': '度',
  '²': '平方',
  '³': '立方',
  '∞': '无穷',
};

const UNI_EN: Record<string, string> = {
  '<': ' less than ',
  '>': ' greater than ',
  '≤': ' less than or equal to ',
  '≥': ' greater than or equal to ',
  '≠': ' not equal to ',
  '≈': ' approximately equal to ',
  '±': ' plus or minus ',
  '×': ' times ',
  '÷': ' divided by ',
  '·': ' times ',
  'π': ' pi ',
  'ρ': ' rho ',
  'θ': ' theta ',
  'α': ' alpha ',
  'β': ' beta ',
  'γ': ' gamma ',
  'Δ': ' delta ',
  'δ': ' delta ',
  'λ': ' lambda ',
  'μ': ' mu ',
  'Ω': ' omega ',
  'ω': ' omega ',
  'σ': ' sigma ',
  'τ': ' tau ',
  'φ': ' phi ',
  '√': ' square root of ',
  '°': ' degrees ',
  '²': ' squared ',
  '³': ' cubed ',
  '∞': ' infinity ',
};

/**
 * 朗读模式：math（默认，数学口径）/ physics（物理公式口径）。
 * physics 模式仅对中文生效：把 \\frac{A}{B} 读成「A 与 B 之比」、并把初中物理量符号替换成中文量名
 * （v→速度、s→路程…）。数学模式行为完全不变。英文界面不启用量名替换（Aria 读不了中文量名）。
 */
export type SpeechMode = 'math' | 'physics';

/**
 * 物理量符号表（latexToSpeech 内部使用，避免依赖数据文件造成耦合）。
 * 键 = 符号名（命令名 rho/eta/lambda 或裸字母，区分大小写）；值 = 中文量名。
 * 仅当某公式上下文中该符号确为此量时才生效——由调用方（physicsSymbols）按公式裁剪，
 * 本表只是「候选全集」，供无逐公式映射时兜底（如 AI 自由公式）。
 */
const PHYS_ZH: Record<string, string> = {
  rho: '密度',
  eta: '机械效率',
  lambda: '波长',
  // 裸字母兜底（多义字母不在此列，避免误读）
  m: '质量',
  V: '体积',
  p: '压强',
  W: '功',
  P: '功率',
  Q: '热量',
  I: '电流',
  U: '电压',
  R: '电阻',
  G: '重力',
  T: '周期',
  u: '物距',
};

/**
 * 物理单位读法表（physics 模式 + zh 生效）。判歧规则：紧跟数字的字母 = 单位，不是变量
 * （110W→「110 瓦」而非「110 功」；220V→「220 伏特」）。多字符优先于单字符。
 * 导出供 use-speak 的散文正则共用同一张表，避免两处漂移。
 */
export const PHYS_UNIT_ZH: Record<string, string> = {
  // 多字符（长匹配优先）
  kWh: '千瓦时', 'kW·h': '千瓦时', 'kW\\cdoth': '千瓦时',
  min: '分钟',
  kg: '千克',
  Hz: '赫兹',
  mA: '毫安',
  cm: '厘米',
  mm: '毫米',
  km: '千米',
  mL: '毫升',
  // 单字符
  V: '伏特',
  A: '安培',
  W: '瓦',
  J: '焦耳',
  N: '牛顿',
  Ω: '欧',
  m: '米',
  s: '秒',
  g: '克',
  h: '小时',
  t: '吨',
  Pa: '帕斯卡',
  '℃': '摄氏度',
};

/** 单位表按长度降序的键列表（供散文正则做最长匹配） */
export const PHYS_UNIT_KEYS_SORTED = Object.keys(PHYS_UNIT_ZH).sort((a, b) => b.length - a.length);

/**
 * 物理模式下，主循环前先折叠「符号 + \text{下标}」这类带修饰的物理量为整词。
 * 中文语序是「修饰语 + 量名」（液体密度），线性循环里 base 先于 sub 处理无法干净拼接，
 * 故用有界查表覆盖 PHYSICS_FORMULAS 实际出现的形态（非整公式查表，AI 自由公式仍走通用规则）。
 */
const PHYS_COMPOUND_ZH: Array<[RegExp, string]> = [
  [/F_\\text\{浮\}/g, '浮力'],
  [/G_\\text\{排\}/g, '排开液重'],
  [/V_\\text\{排\}/g, '排开体积'],
  [/\\rho_\\text\{液\}/g, '液体密度'],
  [/F_\\text\{示\}/g, '弹簧测力计示数'],
  [/W_\\text\{有\}/g, '有用功'],
  [/W_\\text\{总\}/g, '总功'],
  [/Q_\\text\{放\}/g, '放出热量'],
  [/Q_\\text\{吸\}/g, '吸收热量'],
  [/E_\\text\{k\}/g, '动能'],
  [/E_\\text\{p\}/g, '势能'],
];

/** 从 start 位置开始，找到与「当前开启竖线」配对的闭合竖线下标（返回闭合标记之后的位置）。
 * 支持嵌套：内部再遇 \lvert / \left| 时深度+1，遇 \rvert / \right| / 裸 | 时深度-1。
 * 找不到配对返回 -1（调用方降级处理）。
 */
function findMatchingAbsClose(tex: string, start: number): number {
  let depth = 0;
  for (let j = start; j < tex.length; j++) {
    const ch = tex[j];
    if (ch === '\\') {
      const m = tex.slice(j).match(/^\\([a-zA-Z]+|.)/);
      if (m) {
        const cmd = m[1];
        const after = j + m[0].length;
        // \lvert / \left| 开启嵌套；\rvert / \right| 闭合；\vert 与裸 | 同等待遇（闭合）
        if (cmd === 'lvert' || (cmd === 'left' && tex[after] === '|')) {
          depth++;
          j = after - 1;
          continue;
        }
        if (cmd === 'rvert' || (cmd === 'right' && tex[after] === '|')) {
          depth--;
          if (depth < 0) return after;
          j = after - 1;
          continue;
        }
        if (cmd === 'vert') {
          if (depth === 0) return after;
          depth--;
          j = after - 1;
          continue;
        }
        j = after - 1;
        continue;
      }
      j++;
      continue;
    }
    if (ch === '|' || ch === '∣') {
      if (depth === 0) return j + 1;
      depth--;
      continue;
    }
  }
  return -1;
}

/** 带一个参数组的命令族（\text{..} \mathrm{..} …）：扫描时须连同其 {..} 一并纳入 */
const ONE_ARG_COMMANDS =
  /^(text|textrm|textsf|texttt|mathrm|mathbf|mathit|mathsf|mathcal|boldsymbol|operatorname|mbox|hbox)$/;

/**
 * 扫描原语（Phase 1）：从 `start` 起读一个「参数组」或单个 token，**纯函数**——
 * 不修改任何外部游标，返回读到的文本与下一个位置，调用方自己决定是否推进。
 *
 * 规则（与重构前逐字节一致）：
 * - 先跳过前导空白；
 * - `{...}`：按花括号深度匹配，返回内部文本（不含外层花括号）；
 * - `\cmd`：连同命令名一起返回；若命令属于「带一个参数组」族（\text \mathrm …），
 *   把紧随其后的 `{...}` 一并纳入（否则 `^`/`_` 后只吞一个反斜杠，剩余字母会被逐字读）；
 * - 其它：返回单个字符。
 */
export function readGroupAt(tex: string, start: number): { text: string; next: number } {
  const n = tex.length;
  let i = start;
  while (i < n && /\s/.test(tex[i])) i++;
  if (i >= n) return { text: '', next: i };
  if (tex[i] === '{') {
    i++;
    const from = i;
    let depth = 1;
    while (i < n && depth > 0) {
      if (tex[i] === '{') depth++;
      else if (tex[i] === '}') depth--;
      if (depth > 0) i++;
    }
    const inner = tex.slice(from, i);
    return { text: inner, next: i + 1 };
  }
  if (tex[i] === '\\') {
    const cm = tex.slice(i).match(/^\\([a-zA-Z]+|.)/);
    if (cm) {
      const cmdName = cm[1];
      let end = i + cm[0].length;
      if (ONE_ARG_COMMANDS.test(cmdName)) {
        while (end < n && /\s/.test(tex[end])) end++;
        if (tex[end] === '{') {
          let depth = 0;
          let j = end;
          for (; j < n; j++) {
            if (tex[j] === '{') depth++;
            else if (tex[j] === '}') {
              depth--;
              if (depth === 0) {
                j++;
                break;
              }
            }
          }
          end = j;
        }
      }
      return { text: tex.slice(i, end), next: end };
    }
  }
  return { text: tex[i], next: i + 1 };
}

/**
 * 扫描原语（Phase 1）：读一个 LaTeX 命令名及其起始位置。
 * 返回 `null` 表示该位置不是一条可识别的命令（例如末尾孤立反斜杠）。
 */
export function readCommandAt(
  tex: string,
  start: number,
): { name: string; text: string; next: number } | null {
  if (tex[start] !== '\\') return null;
  const m = tex.slice(start).match(/^\\([a-zA-Z]+|.)/);
  if (!m) return null;
  return { name: m[1], text: m[0], next: start + m[0].length };
}


/** 分派上下文：一次朗读的全部可变状态（游标 + 输出 + 模式），显式传递而非闭包捕获 */
interface Ctx {
  /** 预处理之后的 LaTeX 源（化学口径 / 单位名替换已完成） */
  tex: string;
  /** 当前游标（由处理器推进） */
  i: number;
  /** 输出累积 */
  sp: Speaker;
  /** 物理口径（rac 读「之比」、量符号读量名） */
  phys: boolean;
  mode: SpeechMode;
  symbols?: Record<string, string>;
  /** 量名解析：优先逐公式表（多义字母按公式消歧），其次候选全集 */
  physName: (sym: string) => string | undefined;
}

type CmdHandler = (ctx: Ctx, cmd: string) => boolean;
type CharHandler = (ctx: Ctx, c: string) => void;

/** 递归入口：内层公式统一从这里下去 */
const recurse = (ctx: Ctx, inner: string): string => latexToSpeech(inner, 'zh', ctx.mode, ctx.symbols);

/** 读一个参数组（推进 ctx.i） */
const readGroup = (ctx: Ctx): string => {
  const r = readGroupAt(ctx.tex, ctx.i);
  ctx.i = r.next;
  return r.text;
};

/** 读一个参数组（语义别名：命令参数） */
const readArg = (ctx: Ctx): string => readGroup(ctx);

/**
 * 朗读输出的累积状态（Phase 2）。
 *
 * 收敛原先散落在 `latexToSpeech` 里的 5 个可变量（out / lastVar / lastPhysFactor /
 * lastEndsDigit / unitBuf）与两个闭包（flushUnitBuf / pushPhysFactor）：
 * 每个分派处理器只通过这个对象读写，跨分支的隐式耦合因此消失。
 * 三个 `last*` 标志的语义：
 * - lastVar：上一个 token 是单字母/单数字（变量间补空格，ax → a x）
 * - lastPhysFactor：上一个 token 可作乘积左因子（物理模式补「乘以」）
 * - lastEndsDigit：上一个 token 以数字结尾（紧随的字母按单位读，110W → 瓦）
 */
class Speaker {
  readonly out: string[] = [];
  lastVar = false;
  lastPhysFactor = false;
  lastEndsDigit = false;
  unitBuf = '';

  constructor(private readonly phys: boolean) {}

  /** 物理模式：数字后攒起来的字母串结算为单位名；未登记的单位逐字母空格读出 */
  flushUnit(): void {
    if (!this.unitBuf) return;
    const zh = PHYS_UNIT_ZH[this.unitBuf];
    if (this.out.length > 0 && !/\s$/.test(this.out[this.out.length - 1])) this.out.push(' ');
    this.out.push(zh ?? this.unitBuf.split('').join(' '));
    this.unitBuf = '';
    this.lastPhysFactor = false; // 单位之后不再插「乘以」（「110 瓦 每 秒」不读乘）
  }

  /** 物理模式：量名/因子 token 的统一出口——补词间空格 + 乘积链「乘以」（数字→单位不插乘） */
  pushFactor(zh: string): void {
    if (this.out.length > 0 && !/\s$/.test(this.out[this.out.length - 1])) this.out.push(' ');
    if (this.lastPhysFactor) this.out.push('乘以 ');
    this.out.push(zh);
    this.lastPhysFactor = true;
    this.lastEndsDigit = false;
  }

  /** 追加一段普通文本 */
  pushText(s: string): void {
    this.out.push(s);
  }

  /** 当前最后一个 token（无则空串） */
  get last(): string {
    return this.out[this.out.length - 1] ?? '';
  }
}

/**
 * 预处理流水线（Phase 5）：把开头的 6 步顺序敏感的替换收敛到一处。
 *
 * **顺序不可调换**——化学预处理必须早于物理模式：
 * 否则物理模式预处理产出的中文（「两个水分子生成两个氢分子」）会被物理因子逻辑
 * 当成乘积链，插成一串「乘以」（实测：两个水分子 乘以 生成 乘以 两个氢分子 乘以 和 乘以 氧气）。
 */
function preprocessLatex(
  tex: string,
  opts: { phys: boolean; chemCtx: boolean; physName: (sym: string) => string | undefined },
): string {
  const { phys, chemCtx } = opts;
  let out = tex;
  // 归一化：\lvert / \rvert / \vert → 裸 |，统一由绝对值处理逻辑处理
  out = out.replace(/\\lvert|\\rvert|\\vert/g, '|');
  // °C 温度 → 摄氏度（避免 ° 读「度」+ C 读变量）
  out = out.replace(/°C/g, '摄氏度');
  // 化学上下文预处理（解包 \mathrm{} / 反应符号 / 元素与离子 / 计量数）。
  // 位置在物理模式之前：化学模式下 \(\mathrm{V}\) 之类单位不参与化学口径，两条路径互不干扰。
  if (chemCtx) out = chemPrePass(out);
  if (phys) {
    // 物理模式：\text{单位} / \mathrm{单位} 转中文单位名（110\,\text{W} → 110\,瓦），
    // 主循环中文分支负责与数字间补空格；非单位内容（\text{浮} 等）不受影响
    out = out.replace(/(\\(?:text|mathrm|mbox|textrm)\{)([^{}]+)(\})/g, (m, head, inner, tail) =>
      PHYS_UNIT_ZH[inner] ? head + PHYS_UNIT_ZH[inner] + tail : m,
    );
    // 折叠带 \text 下标的复合物理量为整词（浮力/液体密度/有用功…）
    for (const [re, zh] of PHYS_COMPOUND_ZH) out = out.replace(re, zh);
  }
  // 细空格命令（\, \; \: \! \quad \qquad）→ 普通空格（修复 #1）。
  // 放在两种模式都生效的位置：数学模式下这些命令原本落到符号查表，\, 被读成全角逗号
  // （110\,\text{W} → 「110，W」），\! 更会被读成「阶乘」。间距命令在朗读里只该是停顿。
  out = out.replace(/\\[,;:!]|\\q?quad/g, ' ');
  return out;
}

/**
 * 化学式整体匹配（Phase 5：从闭包提为纯函数）。
 * 只在「该 token 是一个独立化学式」时命中（前后是空白/运算符/边界），避免误伤变量名如 x_1。
 */
function tryChemAt(tex: string, start: number): { spoken: string; consumed: number } | null {
  // 化学式形态：元素符号（大写开头，可带小写）+ 可选下标数字，允许多元素连续
  const chemRe = /^(?:[A-Z][a-z]?)(?:_\d+)?(?:[A-Z][a-z]?(?:_\d+)?)*/;
  const m = tex.slice(start).match(chemRe);
  // chemRe 以 [A-Z] 开头，而调用方只在当前字符是大写字母时进来 —— 原先的
  // `if (!m) return null;` 是不可达死代码（Phase 0 覆盖率也证实该分支从未命中），此处删除。
  const token = m![0];
  // 单元素符号（O、C、H、Na、Fe 等）→ 不当作化学式
  if (/^[A-Z][a-z]?$/.test(token)) return null;
  // 前后边界：前一个字符不是字母数字，后一个不是字母（避免截取 aH₂O 中的 H₂O）
  const before = start > 0 ? tex[start - 1] : '';
  const after = start + token.length < tex.length ? tex[start + token.length] : '';
  if (/[A-Za-z0-9]/.test(before)) return null;
  if (/[A-Za-z]/.test(after)) return null;
  const spoken = chemToSpeech(token);
  if (spoken === null) return null;
  return { spoken, consumed: token.length };
}

/** 主循环中：遇到元素符号开头且可能是化学式时先尝试查表 */
function tryChemAtCurrent(ctx: Ctx): boolean {
  const r = tryChemAt(ctx.tex, ctx.i);
  if (!r) return false;
  ctx.sp.out.push(r.spoken);
  ctx.i += r.consumed;
  return true;
}

// ── 命令处理器（Phase 3）：每个只做一件事；返回 false 表示「不归我管」────────
/** \left( \right) —— 收尾读「括号」，开头轻声带过（不读「左」） */
const hLeftRight = (ctx: Ctx, cmd: string): boolean => {
  if (ctx.tex[ctx.i] === '(' || ctx.tex[ctx.i] === '[' || ctx.tex[ctx.i] === '{' || ctx.tex[ctx.i] === '|') {
    if (cmd === 'right') {
      if (ctx.tex[ctx.i] === '{') ctx.sp.out.push('花括号');
      else if (ctx.tex[ctx.i] === '[') ctx.sp.out.push('右中括号');
      else if (ctx.tex[ctx.i] === '|') ctx.sp.out.push('的绝对值');
      else ctx.sp.out.push('括号');
    }
    // cmd === 'left': 只消费字符，不读（收尾括号承担语义）——注意保持 ctx.i 推进
    ctx.i++;
  }
  return true;
};

/**
 * \frac 的单侧参数能否按「单位」读（修复 #2）。
 *
 * 返回中文单位名 + 是否显式包裹（\text/\mathrm）；undefined 表示这一侧不按单位读。
 * 三处守卫：
 * - 分子侧不做量名守卫——`m` 在量名表里是「质量」，但 m/s 必须读「米每秒」；
 * - 分母侧做量名守卫——`\frac{m}{V}` 的 V 是体积不是伏特，否则会被劫持成「米每伏特」；
 * - 分母侧另挡 `t`：单位表里 `t` 是「吨」，而初中公式里的 m/t 几乎总是质量与时间之比。
 */
function fracUnitPart(
  raw: string,
  physName: (sym: string) => string | undefined,
  side: 'num' | 'den',
): { zh: string; explicit: boolean } | undefined {
  const wrapped = raw.trim().match(/^\\(?:text|mathrm|mbox|textrm)\{([^{}]*)\}$/);
  const explicit = wrapped !== null;
  const body = (wrapped ? wrapped[1] : raw).trim();
  const pow = body.match(/^([A-Za-zΩ℃]+)\^\{?(\d+)\}?$/);
  const base = pow ? pow[1] : body;
  const isLatinUnit = /^[A-Za-zΩ℃]+$/.test(base);
  // 物理预处理已把 \text{m} 换成 \text{米}，故显式包裹时中文单位名也要认
  const isZhUnit = explicit && /^[\u4e00-\u9fff]+$/.test(base);
  if (!isLatinUnit && !isZhUnit) return undefined;
  const zhBase = PHYS_UNIT_ZH[base] ?? (isZhUnit && Object.values(PHYS_UNIT_ZH).includes(base) ? base : undefined);
  if (!zhBase) return undefined;
  // 量名守卫只挡「裸字母」：带指数的 m^3 只可能是单位，而裸 m 在分母上更像质量
  const bare = !pow;
  if (!explicit && side === 'den' && bare && (physName(base) !== undefined || base === 't')) return undefined;
  const exp = pow ? Number(pow[2]) : 1;
  if (exp === 1) return { zh: zhBase, explicit };
  // 平方/立方是前置修饰（立方米，不是米立方），与 hSuperscript 的单位读法一致
  if (exp === 2) return { zh: `平方${zhBase}`, explicit };
  if (exp === 3) return { zh: `立方${zhBase}`, explicit };
  return { zh: `${zhBase} 的 ${exp} 次方`, explicit };
}

/** \frac{a}{b}：物理模式读「每」或「之比」，数学模式读「b 分之 a」 */
const hFrac = (ctx: Ctx): boolean => {
  const a = readArg(ctx);
  const b = readArg(ctx);
  if (!a || !b) return true;
  // 物理模式：分子分母都判成单位 → 读「X 每 Y」（m/s → 米每秒，kg/m^3 → 千克每立方米）
  const aU = ctx.phys ? fracUnitPart(a, ctx.physName, 'num') : undefined;
  const bU = ctx.phys ? fracUnitPart(b, ctx.physName, 'den') : undefined;
  const compound = aU && bU;
  // 复合单位不需要逐字朗读分子分母，省掉两次递归
  const aSp = compound ? '' : recurse(ctx, a);
  const bSp = compound ? '' : recurse(ctx, b);
  const frag = compound
    ? `{${aU.zh} 每 ${bU.zh}}`
    : ctx.phys
      ? `{${aSp} 与 ${bSp} 之比}`
      : `{${bSp} 分之 ${aSp}}`;
  ctx.sp.out.push(frag);
  ctx.sp.lastVar = /[\dA-Za-z]$/.test(frag.replace(/[{}]/g, ''));
  ctx.sp.lastPhysFactor = ctx.phys && /之比\}$/.test(frag); // 「…之比」可作乘积左因子（½ 之比 乘以 质量）
  ctx.sp.lastEndsDigit = false;
  return true;
};

/** \sqrt{x} 与 \sqrt[n]{x}（先读 [n] 再读 {x}） */
const hSqrt = (ctx: Ctx): boolean => {
  let degree = '';
  if (ctx.tex[ctx.i] === '[') {
    const close = ctx.tex.indexOf(']', ctx.i);
    if (close !== -1) {
      degree = ctx.tex.slice(ctx.i + 1, close);
      ctx.i = close + 1;
    }
  }
  const inner = readArg(ctx);
  const frag = degree ? `{${recurse(ctx, inner)} 的 ${degree} 次方根}` : `{根号 ${recurse(ctx, inner)}}`;
  ctx.sp.out.push(frag);
  ctx.sp.lastVar = /[\dA-Za-z]$/.test(frag.replace(/[{}]/g, ''));
  return true;
};

/** \cdot 与 \times */
const hTimes = (ctx: Ctx): boolean => {
  ctx.sp.out.push('乘以');
  ctx.sp.lastPhysFactor = false; // 已有乘号，下一个因子不再插
  ctx.sp.lastEndsDigit = false;
  return true;
};

/** \space（命令名就是空格本身也走这里：读不到词表就原样吐空格） */
const hSpace = (ctx: Ctx): boolean => {
  ctx.sp.out.push(' ');
  return true;
};

/** \text{...}：说明文字直接读（带下标的物理量已由 PHYS_COMPOUND_ZH 折叠，单位已由预处理转中文） */
const hText = (ctx: Ctx): boolean => {
  const inner = readArg(ctx);
  if (ctx.phys && ctx.sp.out.length > 0 && !/[\s，。]$/.test(ctx.sp.out[ctx.sp.out.length - 1])) ctx.sp.out.push(' '); // 数字与单位名间补空格（220 伏特）
  ctx.sp.out.push(inner);
  ctx.sp.lastVar = false;
  ctx.sp.lastEndsDigit = false;
  ctx.sp.lastPhysFactor = false;
  return true;
};

/** \mathrm{kg} / \operatorname{..} / \mbox{..}：直接读内容，不读命令名 */
const hMathrm = (ctx: Ctx): boolean => {
  const inner = readArg(ctx);
  if (!inner) return true;
  if (ctx.phys && ctx.sp.out.length > 0 && !/[\s，。]$/.test(ctx.sp.out[ctx.sp.out.length - 1])) ctx.sp.out.push(' ');
  ctx.sp.out.push(inner);
  ctx.sp.lastEndsDigit = false;
  ctx.sp.lastPhysFactor = false;
  return true;
};

/**
 * \Delta 后变量的读法（修复 #7）：Δt 是时间间隔、ΔT 是温度变化。
 * 与全局量名表刻意不同——表里 T 是「周期」、t 根本没有条目，
 * 直接照搬会读成「周期变化量」或原样的「t变化量」。
 */
const DELTA_PHYS_ZH: Record<string, string> = { t: '时间', T: '温度' };

/** 物理模式 \Delta X → 「X变化量」（Δt → 时间变化量）；非物理模式交回符号查表 */
const hDelta = (ctx: Ctx, cmd: string): boolean => {
  if (!ctx.phys) return false;
  if (!(cmd === 'Delta' || (cmd.length === 1 && cmd === 'Δ'))) return false;
  const arg = readGroup(ctx);
  const name = arg ? DELTA_PHYS_ZH[arg] ?? ctx.physName(arg) ?? arg : '';
  ctx.sp.pushFactor(`${name}变化量`);
  ctx.sp.lastVar = false;
  return true;
};

/** 其余命令：量符号优先读量名，其次音译表，最后去掉反斜杠读原词 */
const hSymbol = (ctx: Ctx, cmd: string): boolean => {
  if (ctx.phys && ctx.physName(cmd) !== undefined) {
    // 物理模式：量符号（\rho→密度、\eta→机械效率、\lambda→波长）优先于音译
    ctx.sp.pushFactor(ctx.physName(cmd)!);
    ctx.sp.lastVar = false;
    return true;
  }
  // 物理模式：命令词前若紧跟变量字母，补空格（cm\Delta t → c m 德耳塔 t，避免 edge-tts 吞音黏连）
  // 仅物理模式生效——数学模式读法须逐字节不变
  if (ctx.phys && ctx.sp.lastVar) ctx.sp.out.push(' ');
  const spoken = CMD_ZH[cmd];
  if (spoken !== undefined) ctx.sp.out.push(spoken);
  else ctx.sp.out.push(cmd); // 未知命令：去掉反斜杠读原词
  ctx.sp.lastEndsDigit = false;
  ctx.sp.lastPhysFactor = false;
  return true;
};

/** 命令分派表（Phase 3）：替代原先 9 段 if 链 */
const COMMANDS: Record<string, CmdHandler> = {
  left: hLeftRight,
  right: hLeftRight,
  frac: hFrac,
  sqrt: hSqrt,
  cdot: hTimes,
  times: hTimes,
  space: hSpace,
  text: hText,
  mathrm: hMathrm,
  operatorname: hMathrm,
  mbox: hMathrm,
  Delta: hDelta,
  'Δ': hDelta,
};

// ── 字符处理器（Phase 4）：每个只管一个字符族；ctx.i 的推进由处理器自己负责 ──────
/** 绝对值 |…|（含 U+2223）：有配对读「X 的绝对值」，孤立竖线降级读「竖线」 */
const hAbs = (ctx: Ctx): void => {
  const closeAfter = findMatchingAbsClose(ctx.tex, ctx.i + 1);
  if (closeAfter !== -1) {
    // 收尾不留空白：smoke 钉住「|x-2|<3 → x减2 的绝对值小于3」，与数字右操作数紧贴
    ctx.sp.out.push(`${recurse(ctx, ctx.tex.slice(ctx.i + 1, closeAfter - 1))} 的绝对值`);
    ctx.i = closeAfter;
    ctx.sp.lastVar = false;
    return;
  }
  // 找不到配对（孤立竖线，如集合描述 {x | x>0}）：降级读「竖线」不读原字符
  ctx.sp.out.push('竖线');
  ctx.i++;
  ctx.sp.lastVar = false;
};

/** 上标：物理模式单位 +2/3 读前置修饰（米^3 → 立方米），数字读平方/立方/n 次方 */
const hSuperscript = (ctx: Ctx): void => {
  ctx.i++;
  const sup = readGroup(ctx);
  if (!sup) return;
  if (ctx.phys && /^\d$/.test(sup) && (sup === '2' || sup === '3')) {
    const last = ctx.sp.last;
    if (Object.values(PHYS_UNIT_ZH).includes(last)) {
      ctx.sp.out[ctx.sp.out.length - 1] = (sup === '2' ? '平方' : '立方') + last;
      return;
    }
  }
  const num = parseInt(sup, 10);
  if (/^\d+$/.test(sup)) {
    if (num === 2) ctx.sp.out.push(' 平方');
    else if (num === 3) ctx.sp.out.push(' 立方');
    else ctx.sp.out.push(` ${sup} 次方`);
  } else {
    ctx.sp.out.push(` 的 ${recurse(ctx, sup)} 次方`);
  }
  ctx.sp.lastPhysFactor = ctx.phys; // 「电流 平方」可作乘积左因子（Q=I²Rt）
};

/** 下标：数字读中文数字（H_2O → H 二 O；x_1 → x 一），其余读「下标 X」 */
const hSubscript = (ctx: Ctx): void => {
  ctx.i++;
  const sub = readGroup(ctx);
  if (!sub) return;
  if (/^\d+$/.test(sub)) ctx.sp.out.push(` ${subZhNum(sub)} `);
  else ctx.sp.out.push(` 下标 ${recurse(ctx, sub)} `);
};

/** 孤立花括号：成对的组已由 readGroup 消费，这里只可能是落单的那个 */
const hBrace = (ctx: Ctx): void => {
  ctx.i++;
};

/** ~ 读作空格 */
const hTilde = (ctx: Ctx): void => {
  ctx.sp.out.push(' ');
  ctx.i++;
};

/** 运算符统一出口：清零乘积链与「数字+字母=单位」的判定；keepDigit 用于小数点 */
const hOperator = (ctx: Ctx, text: string, keepDigit = false): void => {
  // 只在「…的绝对值」这一名词短语后补空格（修复 #4）：|a|+|b| 原本读成
  // 「a 的绝对值加b 的绝对值」，字母被粘在中文运算符上。
  // 右操作数是数字时不补——「|x-2|<3 → 的绝对值小于3」是 smoke 钉住的既有读法。
  const next = ctx.tex[ctx.i + 1] ?? '';
  const spaced = /的绝对值\s*$/.test(ctx.sp.last) && /[A-Za-z|∣]/.test(next);
  ctx.sp.out.push(spaced ? ` ${text} ` : text);
  ctx.sp.lastVar = false;
  if (!keepDigit) ctx.sp.lastEndsDigit = false;
  ctx.sp.lastPhysFactor = false;
  ctx.i++;
};

/** 减号 vs 负号：前一字符是操作数结尾（字母/数字/)/]/}）→ 减，否则 → 负 */
const hMinus = (ctx: Ctx): void => {
  const prev = ctx.tex[ctx.i - 1];
  const prevIsOperand = prev ? /[A-Za-z0-9}\]\)]/.test(prev) : false;
  hOperator(ctx, prevIsOperand ? '减' : '负');
};

/** 左括号/左中括号：轻声带过（收尾括号承担语义），与 \left 一致 */
const hSilent = (ctx: Ctx): void => {
  ctx.sp.lastVar = false;
  ctx.sp.lastEndsDigit = false;
  ctx.sp.lastPhysFactor = false;
  ctx.i++;
};

// ── 默认分支（字母/数字变量）拆成四个单一职责函数 ──────────────────────
/** 物理模式：数字后紧跟的字母 = 单位（110W → 瓦），连续字母攒进缓冲 */
const handleUnitBuffer = (ctx: Ctx, c: string): boolean => {
  if (!(ctx.phys && /^[A-Za-z]$/.test(c) && (ctx.sp.lastEndsDigit || ctx.sp.unitBuf))) return false;
  ctx.sp.unitBuf += c;
  ctx.i++;
  return true;
};

/** 物理模式：字母命中量名表 → 读中文量名（数字不替换） */
const handlePhysName = (ctx: Ctx, c: string): boolean => {
  if (!(ctx.phys && /^[A-Za-z]$/.test(c))) return false;
  const zh = ctx.physName(c);
  if (zh === undefined) return false;
  ctx.sp.flushUnit(); // 先结算未 flush 的单位串（理论上到不了这里，防御性）
  ctx.sp.pushFactor(zh);
  ctx.sp.lastVar = false;
  ctx.i++;
  return true;
};

/** 物理模式：未命中量名表的拉丁字母（g、k 等常量/单位符号）也走因子通道，保持乘积链 */
const handleLatin = (ctx: Ctx, c: string, isDigit: boolean): boolean => {
  if (isDigit) ctx.sp.flushUnit(); // 数字打断单位串（110W2 之类，防御）
  if (!(ctx.phys && !isDigit && /^[A-Za-z]$/.test(c))) return false;
  ctx.sp.pushFactor(c);
  ctx.sp.lastVar = false;
  ctx.i++;
  return true;
};

/** 物理模式：折叠产生的中文量名词（液体密度/排开体积…）续接乘积链，词内字符不补「乘以」 */
const handleCjk = (ctx: Ctx, c: string, isDigit: boolean): boolean => {
  if (!(ctx.phys && !isDigit && !/[A-Za-z]/.test(c) && !/\s/.test(c))) return false;
  if (!/[\u4e00-\u9fff]/.test(c)) return false;
  if (ctx.sp.lastPhysFactor && !/[\u4e00-\u9fff]$/.test(ctx.sp.last)) ctx.sp.out.push('乘以 ');
  ctx.sp.out.push(c);
  ctx.sp.lastPhysFactor = true;
  ctx.i++;
  return true;
};

/** 默认分支入口：字母/数字变量（上一个也是单字符时补空格，ax → a x；连续数字不空格） */
const hDefault = (ctx: Ctx, c: string): void => {
  const isDigit = c >= '0' && c <= '9';
  const isVar = isDigit || /^[A-Za-z]$/.test(c);
  const prevEndsDigit = /\d$/.test(ctx.sp.last);
  if (handleUnitBuffer(ctx, c)) return;
  if (handlePhysName(ctx, c)) return;
  if (handleLatin(ctx, c, isDigit)) return;
  if (isVar && ctx.sp.lastVar && !(isDigit && prevEndsDigit)) ctx.sp.out.push(' ');
  if (handleCjk(ctx, c, isDigit)) return;
  ctx.sp.out.push(c);
  ctx.sp.lastVar = isVar;
  ctx.sp.lastEndsDigit = isDigit;
  if (!/\s/.test(c)) ctx.sp.lastPhysFactor = false;
  ctx.i++;
};

/** 字符分派表（Phase 4） */
const CHARS: Record<string, CharHandler> = {
  '|': hAbs,
  '∣': hAbs,
  '^': hSuperscript,
  _: hSubscript,
  '{': hBrace,
  '}': hBrace,
  '~': hTilde,
  '=': (ctx) => hOperator(ctx, '等于'),
  '+': (ctx) => hOperator(ctx, '加'),
  '-': hMinus,
  '*': (ctx) => hOperator(ctx, '乘以'),
  '/': (ctx) => hOperator(ctx, '除以'),
  ',': (ctx) => hOperator(ctx, '，'),
  '.': (ctx) => hOperator(ctx, '点', true), // 小数点不打断数字判定（0.5A → 5 后接 A = 单位）
  '(': hSilent,
  ')': (ctx) => hOperator(ctx, '括号'),
  '[': hSilent,
  ']': (ctx) => hOperator(ctx, '右中括号'),
  '%': (ctx) => hOperator(ctx, '百分之'),
};

/**
 * 解析一段 LaTeX 源码为口语数组（递归处理嵌套命令）。
 * 输入不含 \( \) 包裹符；输出是朗读文本（无公式省略）。
 *
 * 结构（Phase 5 收口后）：本函数只做四件事——判语种、建上下文、跑主循环、收尾；
 * 命令与字符的分派逻辑都在模块级的 COMMANDS / CHARS 表里。
 */
export function latexToSpeech(
  tex: string,
  lang: 'zh' | 'en' = 'zh',
  mode: SpeechMode = 'math',
  symbols?: Record<string, string>,
): string {
  if (lang === 'en') return latexToSpeechEn(tex);
  // 化学上下文优先：化学方程式只按化学口径读，不再套物理量名替换
  const chemCtx = detectChem(tex);
  const phys = mode === 'physics' && !chemCtx; // 物理口径：\frac 读「之比」+ 物理量符号替换成中文量名
  const physName = (sym: string): string | undefined => symbols?.[sym] ?? PHYS_ZH[sym];
  const ctx: Ctx = {
    tex: preprocessLatex(tex, { phys, chemCtx, physName }),
    i: 0,
    sp: new Speaker(phys),
    phys,
    mode,
    symbols,
    physName,
  };

  while (ctx.i < ctx.tex.length) {
    const c = ctx.tex[ctx.i];
    // 物理模式：单位串遇到非字母字符 → 先结算（110W+、2m^3 等）
    if (phys && ctx.sp.unitBuf && !/[A-Za-z]/.test(c)) ctx.sp.flushUnit();
    // 化学式优先：元素符号开头（大写）时先尝试整体查表（H_2O→水）
    if (/[A-Z]/.test(c) && tryChemAtCurrent(ctx)) continue;
    if (c === '\\') {
      // 命令：查表分派；未登记的交给符号查表（hSymbol 始终消费）
      const r = readCommandAt(ctx.tex, ctx.i);
      if (!r) {
        ctx.i++;
        continue;
      }
      ctx.i = r.next;
      const h = COMMANDS[r.name];
      if (!h || !h(ctx, r.name)) hSymbol(ctx, r.name);
      continue;
    }
    // 字符分派：先查表，再看裸 Unicode 符号，最后落到字母/数字默认分支
    const hc = CHARS[c];
    if (hc) {
      hc(ctx, c);
      continue;
    }
    if (UNI_ZH[c] !== undefined) {
      hOperator(ctx, UNI_ZH[c]);
      continue;
    }
    hDefault(ctx, c);
  }

  if (phys) ctx.sp.flushUnit(); // 公式以单位收尾（110W）：循环内无字符触发 flush，此处兜底
  return spaceOutLatinVariables(
    ctx.sp.out
      .join('')
      .replace(/\{/g, '')
      .replace(/\}/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}


/**
 * 朗读文本后处理：仅压缩多余空白（变量间空格已在 push 阶段处理）。
 * 保留字符串原样——\mathrm{kg}、equals 等整词一次 push，不应被拆分。
 */
export function spaceOutLatinVariables(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** 数字 → 中文读法（下标用） */
function subZhNum(s: string): string {
  const digits = '零一二三四五六七八九';
  return s
    .split('')
    .map((d) => digits[Number(d)] ?? d)
    .join('');
}

/** 英文模式：LaTeX → 英文口语 */
const CMD_EN: Record<string, string> = {
  pi: 'pi',
  rho: 'rho',
  theta: 'theta',
  alpha: 'alpha',
  beta: 'beta',
  Delta: 'delta',
  delta: 'delta',
  lambda: 'lambda',
  eta: 'eta',
  mu: 'mu',
  Omega: 'omega',
  omega: 'omega',
  sigma: 'sigma',
  tau: 'tau',
  phi: 'phi',
  times: 'times',
  cdot: 'times',
  div: 'divided by',
  pm: 'plus or minus',
  neq: 'not equal to',
  leq: 'less than or equal to',
  geq: 'greater than or equal to',
  approx: 'approximately equal to',
  propto: 'proportional to',
  to: 'tends to',
  rightarrow: 'tends to',
  Rightarrow: 'implies',
  leftarrow: 'tends to',
  infty: 'infinity',
  sum: 'sum of',
  int: 'integral of',
  mid: 'such that',
  log: 'log',
  ln: 'natural log',
  sin: 'sine',
  cos: 'cosine',
  tan: 'tangent',
};

/** 数字 → 英文序数词（1st/2nd/3rd/4th…；仅正整数） */
function ordinalEn(n: number): string {
  const abs = Math.abs(n);
  const lastTwo = abs % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  const last = abs % 10;
  if (last === 1) return `${n}st`;
  if (last === 2) return `${n}nd`;
  if (last === 3) return `${n}rd`;
  return `${n}th`;
}

/**
 * 英文预处理（Commit 2）：两处归一化，互相独立。
 * - \lvert / \rvert / \vert → 裸 |（统一由绝对值逻辑处理）
 * - °C → degrees Celsius（避免 ° 读 degrees + C 读变量）
 */
function preprocessLatexEn(tex: string): string {
  return tex.replace(/\\lvert|\\rvert|\\vert/g, '|').replace(/°C/g, ' degrees Celsius ');
}

/** 英文朗读的上下文（Commit 2）：与中文侧 Ctx 同形，但输出没有乘积链/单位缓冲，只留游标与输出 */
interface EnCtx {
  tex: string;
  i: number;
  out: string[];
}

type EnCmdHandler = (ctx: EnCtx, cmd: string) => boolean;
type EnCharHandler = (ctx: EnCtx, c: string) => void;

/**
 * 英文参数读取（Commit 2）。
 * 花括号组复用模块级 `readGroupAt`（消除英文侧重复的深度扫描）；
 * 但**反斜杠开头的参数保留英文侧的历史单字符语义**（bug-for-bug）：
 * 旧实现只吞掉反斜杠本身，剩余字母交给主循环读，因此 `\sqrt\frac{1}{2}` 读作
 * "square root of frac12" 而不是 "… of 12"。这条差异已记入既有怪癖清单，重构期间不改。
 */
const readEnArg = (ctx: EnCtx): string => {
  let j = ctx.i;
  while (j < ctx.tex.length && /\s/.test(ctx.tex[j])) j++;
  if (ctx.tex[j] === '\\') {
    ctx.i = j + 1;
    return '\\';
  }
  const r = readGroupAt(ctx.tex, j);
  ctx.i = r.next;
  return r.text;
};

/** 英文递归入口 */
const recurseEn = (ctx: EnCtx, inner: string): string => latexToSpeechEn(inner);

/** 追加一段固定文案并前进一个字符（运算符出口） */
const enPushOp = (ctx: EnCtx, text: string): void => {
  ctx.out.push(text);
  ctx.i++;
};

/** \left / \right：英文读法是后缀式（close parenthesis），左竖线读 absolute value 前缀 */
const enLeftRight: EnCmdHandler = (ctx, cmd) => {
  const ch = ctx.tex[ctx.i];
  if (ch === '(' || ch === '[' || ch === '{' || ch === '|') {
    if (cmd === 'left' && ch === '|') {
      // 英文读法是前缀 absolute value of X → 左竖线读前缀，右竖线静默
      ctx.out.push(' absolute value of ');
    } else if (cmd === 'right' && ch !== '|') {
      if (ch === '{') ctx.out.push(' close brace ');
      else if (ch === '[') ctx.out.push(' close bracket ');
      else ctx.out.push(' close parenthesis ');
    }
    // cmd === 'left': 只消费字符，不读（收尾括号承担语义）
    ctx.i++;
  }
  return true;
};

/** \frac{a}{b} → a over b */
const enFrac: EnCmdHandler = (ctx) => {
  const a = readEnArg(ctx);
  const b = readEnArg(ctx);
  if (a && b) ctx.out.push(`${recurseEn(ctx, a)} over ${recurseEn(ctx, b)}`);
  return true;
};

/** \sqrt[n]{x}：3 → cube root、4 → fourth root、其余数字走 ordinalEn、非数字原样 */
const enSqrt: EnCmdHandler = (ctx) => {
  let degree = '';
  if (ctx.tex[ctx.i] === '[') {
    const close = ctx.tex.indexOf(']', ctx.i);
    if (close !== -1) {
      degree = ctx.tex.slice(ctx.i + 1, close);
      ctx.i = close + 1;
    }
  }
  const body = recurseEn(ctx, readEnArg(ctx));
  if (!degree) ctx.out.push(`square root of ${body}`);
  else if (degree === '3') ctx.out.push(`cube root of ${body}`);
  else if (degree === '4') ctx.out.push(`fourth root of ${body}`);
  else {
    const ord = /^\d+$/.test(degree) ? ordinalEn(parseInt(degree, 10)) : degree;
    ctx.out.push(`the ${ord} root of ${body}`);
  }
  return true;
};

/** \cdot / \times */
const enTimes: EnCmdHandler = (ctx) => {
  ctx.out.push('times');
  return true;
};

/** \text / \mathrm / \operatorname：直接读内容 */
const enText: EnCmdHandler = (ctx) => {
  ctx.out.push(readEnArg(ctx));
  return true;
};

/** 其余命令：查 CMD_EN，未登记则去掉反斜杠读原词 */
const enSymbol: EnCmdHandler = (ctx, cmd) => {
  const spoken = CMD_EN[cmd];
  ctx.out.push(spoken !== undefined ? spoken : cmd);
  return true;
};

/** 英文命令分派表 */
const EN_COMMANDS: Record<string, EnCmdHandler> = {
  left: enLeftRight,
  right: enLeftRight,
  frac: enFrac,
  sqrt: enSqrt,
  cdot: enTimes,
  times: enTimes,
  text: enText,
  mathrm: enText,
  operatorname: enText,
};

/** 绝对值 |…|：配对读 absolute value of X，孤立竖线降级 vertical bar */
const enAbs: EnCharHandler = (ctx) => {
  const closeAfter = findMatchingAbsClose(ctx.tex, ctx.i + 1);
  if (closeAfter !== -1) {
    ctx.out.push(` absolute value of ${recurseEn(ctx, ctx.tex.slice(ctx.i + 1, closeAfter - 1))} `);
    ctx.i = closeAfter;
    return;
  }
  ctx.out.push(' vertical bar ');
  ctx.i++;
};

/** 上标：2 → squared、3 → cubed、其余数字 → to the Nth power、非数字 → to the power of X */
const enSuperscript: EnCharHandler = (ctx) => {
  ctx.i++;
  const sup = readEnArg(ctx);
  if (!sup) return;
  // 各分支都以空格收尾（修复 #5）：Q=I^2Rt 原本读成 "I squaredRt"，词被粘在一起
  if (/^\d+$/.test(sup)) {
    const num = parseInt(sup, 10);
    if (num === 2) ctx.out.push(' squared ');
    else if (num === 3) ctx.out.push(' cubed ');
    else ctx.out.push(` to the ${num}th power `);
  } else {
    ctx.out.push(` to the power of ${recurseEn(ctx, sup)} `);
  }
};

/** 下标：数字读 sub N，其余读 sub <读法> */
const enSubscript: EnCharHandler = (ctx) => {
  ctx.i++;
  const sub = readEnArg(ctx);
  if (!sub) return;
  ctx.out.push(/^\d+$/.test(sub) ? ` sub ${sub} ` : ` sub ${recurseEn(ctx, sub)} `);
};

/** { } 直接跳过（成对的组已由 readEnArg 消费） */
const enSkipBrace: EnCharHandler = (ctx) => {
  ctx.i++;
};

/** ~ 读作空格 */
const enTilde: EnCharHandler = (ctx) => {
  ctx.out.push(' ');
  ctx.i++;
};

/** 减号 vs 负号：前一字符是操作数结尾 → minus，否则 → negative */
const enMinus: EnCharHandler = (ctx) => {
  const prev = ctx.tex[ctx.i - 1];
  const prevIsOperand = prev ? /[A-Za-z0-9}\]\)]/.test(prev) : false;
  enPushOp(ctx, prevIsOperand ? ' minus ' : ' negative ');
};

/** 左括号/左中括号：轻声带过，收尾读 */
const enSilent: EnCharHandler = (ctx) => {
  ctx.i++;
};

/** 默认：原样输出字符 */
const enDefault: EnCharHandler = (ctx, c) => {
  ctx.out.push(c);
  ctx.i++;
};

/** 英文字符分派表 */
const EN_CHARS: Record<string, EnCharHandler> = {
  '|': enAbs,
  '∣': enAbs,
  '^': enSuperscript,
  _: enSubscript,
  '{': enSkipBrace,
  '}': enSkipBrace,
  '~': enTilde,
  '=': (ctx) => enPushOp(ctx, ' equals '),
  '+': (ctx) => enPushOp(ctx, ' plus '),
  '-': enMinus,
  '*': (ctx) => enPushOp(ctx, ' times '),
  '/': (ctx) => enPushOp(ctx, ' over '),
  ',': (ctx) => enPushOp(ctx, ', '),
  '.': (ctx) => enPushOp(ctx, ' point '),
  '(': enSilent,
  ')': (ctx) => enPushOp(ctx, ' close parenthesis '),
  '[': enSilent,
  ']': (ctx) => enPushOp(ctx, ' close bracket '),
};

/**
 * 英文朗读（Commit 2 收口）：结构对齐中文侧——判语种由调用方做，这里只建上下文、跑主循环、收尾。
 * 命令与字符逻辑都在模块级的 EN_COMMANDS / EN_CHARS 表里；扫描复用 readGroupAt / readCommandAt。
 */
function latexToSpeechEn(tex: string): string {
  const ctx: EnCtx = { tex: preprocessLatexEn(tex), i: 0, out: [] };
  while (ctx.i < ctx.tex.length) {
    const c = ctx.tex[ctx.i];
    if (c === '\\') {
      const r = readCommandAt(ctx.tex, ctx.i);
      if (!r) {
        ctx.i++;
        continue;
      }
      ctx.i = r.next;
      const h = EN_COMMANDS[r.name];
      if (!h || !h(ctx, r.name)) enSymbol(ctx, r.name);
      continue;
    }
    const hc = EN_CHARS[c];
    if (hc) {
      hc(ctx, c);
      continue;
    }
    if (UNI_EN[c] !== undefined) {
      enPushOp(ctx, UNI_EN[c]);
      continue;
    }
    enDefault(ctx, c);
  }
  return spaceOutLatinVariables(ctx.out.join('').replace(/\s{2,}/g, ' ').trim());
}
