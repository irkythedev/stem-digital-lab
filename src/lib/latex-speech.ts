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

const FRAC_A = 'frac-a';
const FRAC_B = 'frac-b';

/**
 * 初中常见化合物 → 中文名（教学口径，教材/中考标准名）。
 * 注意：H₂O 读「水」而非「一氧化二氢」（后者是网络梗，教材不用）。
 * 匹配规则：先做整式归一（H_2O → H2O），再查表；未命中回退符号念法。
 */
const CHEM_ZH: Record<string, string> = {
  H2O: '水',
  H2O2: '过氧化氢',
  O2: '氧气',
  H2: '氢气',
  N2: '氮气',
  Cl2: '氯气',
  CO2: '二氧化碳',
  CO: '一氧化碳',
  SO2: '二氧化硫',
  SO3: '三氧化硫',
  NO: '一氧化氮',
  NO2: '二氧化氮',
  NH3: '氨气',
  CH4: '甲烷',
  HCl: '盐酸',
  H2SO4: '硫酸',
  HNO3: '硝酸',
  H2CO3: '碳酸',
  NaOH: '氢氧化钠',
  CaOH2: '氢氧化钙',
  KOH: '氢氧化钾',
  NH4OH: '氨水',
  CaO: '氧化钙',
  CuO: '氧化铜',
  MgO: '氧化镁',
  FeO: '氧化亚铁',
  Fe2O3: '氧化铁',
  Fe3O4: '四氧化三铁',
  Al2O3: '氧化铝',
  ZnO: '氧化锌',
  MnO2: '二氧化锰',
  NaCl: '氯化钠',
  KCl: '氯化钾',
  CaCl2: '氯化钙',
  FeCl2: '氯化亚铁',
  FeCl3: '氯化铁',
  AgCl: '氯化银',
  Na2CO3: '碳酸钠',
  NaHCO3: '碳酸氢钠',
  CaCO3: '碳酸钙',
  BaCO3: '碳酸钡',
  Na2SO4: '硫酸钠',
  CuSO4: '硫酸铜',
  BaSO4: '硫酸钡',
  CaSO4: '硫酸钙',
  KMnO4: '高锰酸钾',
  K2MnO4: '锰酸钾',
  KNO3: '硝酸钾',
  AgNO3: '硝酸银',
  CuNO3: '硝酸铜',
  CuNO32: '硝酸铜',
  BaCl2: '氯化钡',
  CuCl2: '氯化铜',
  NaNO3: '硝酸钠',
  CaNO32: '硝酸钙',
  NH4Cl: '氯化铵',
  FeSO4: '硫酸亚铁',
  Fe2SO43: '硫酸铁',
  Al2SO43: '硫酸铝',
  KH2PO4: '磷酸二氢钾',
};

/** 化学式归一：H_2O → H2O；Ca(OH)_2 → CaOH2（括号组展开）；下标数字后接元素符号时补空格拆词 */
export function normalizeChemFormula(raw: string): { normalized: string; spoken: string } {
  const normalized = raw
    .replace(/_/g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '');
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

/**
 * 解析一段 LaTeX 源码为口语数组（递归处理嵌套命令）。
 * 输入不含 \( \) 包裹符；输出是朗读文本（无公式省略）。
 */
export function latexToSpeech(
  tex: string,
  lang: 'zh' | 'en' = 'zh',
  mode: SpeechMode = 'math',
  symbols?: Record<string, string>,
): string {
  if (lang === 'en') return latexToSpeechEn(tex);
  const phys = mode === 'physics'; // 物理口径：\\frac 读「之比」+ 物理量符号替换成中文量名
  // 量名解析：优先逐公式表（symbols，多义字母按公式消歧），其次候选全集（PHYS_ZH，兜底 AI 自由公式）
  const physName = (sym: string): string | undefined => symbols?.[sym] ?? PHYS_ZH[sym];
  // 归一化：\lvert / \rvert / \vert → 裸 |，统一由绝对值处理逻辑处理
  tex = tex.replace(/\\lvert|\\rvert|\\vert/g, '|');
  // °C 温度 → 摄氏度（避免 ° 读「度」+ C 读变量）
  tex = tex.replace(/°C/g, '摄氏度');
  // 物理模式：\text{单位} / \mathrm{单位} 转中文单位名（110\,\text{W} → 110\,瓦），
  // 主循环中文分支负责与数字间补空格；非单位内容（\text{浮} 等）不受影响
  if (phys) {
    tex = tex.replace(/(\\(?:text|mathrm|mbox|textrm)\{)([^{}]+)(\})/g, (m, head, inner, tail) =>
      PHYS_UNIT_ZH[inner] ? head + PHYS_UNIT_ZH[inner] + tail : m);
    // 细空格命令（\, \; \: \! \quad 等）→ 普通空格：数字与单位间的 \, 不应读成「逗号」
    tex = tex.replace(/\\[,;:!](?![a-zA-Z])/g, ' ');
  }
  // 物理模式：折叠带 \text 下标的复合物理量为整词（浮力/液体密度/有用功…）
  if (phys) {
    for (const [re, zh] of PHYS_COMPOUND_ZH) tex = tex.replace(re, zh);
  }
  const out: string[] = [];
  let i = 0;
  const n = tex.length;
  /** 上一个 push 的是否为单字母/单数字（用于变量间加空格，ax → a x） */
  let lastVar = false;
  /** 物理模式：上一个 push 是否为量名/字母/平方/之比结尾（乘积链插「乘以」的左条件） */
  let lastPhysFactor = false;
  /** 上一个 push 是否以数字结尾（字母紧随数字 → 单位，如 110W/220V） */
  let lastEndsDigit = false;
  /** 物理模式：数字后连续字母缓冲（单位串，如 UI 在 110 后 = 单位；遇非字母 flush） */
  let unitBuf = '';
  const flushUnitBuf = () => {
    if (!unitBuf) return;
    const zh = PHYS_UNIT_ZH[unitBuf];
    if (out.length > 0 && !/\s$/.test(out[out.length - 1])) out.push(' ');
    out.push(zh ?? unitBuf.split('').join(' '));
    unitBuf = '';
    lastPhysFactor = false; // 单位之后不再插「乘以」（「110 瓦 每 秒」不读乘）
  };
  /** 物理模式：量名/因子 token 的统一出口——乘积链补「乘以」+ 词间空格（数字→单位不插乘） */
  const pushPhysFactor = (zh: string) => {
    if (out.length > 0 && !/\s$/.test(out[out.length - 1])) out.push(' ');
    if (lastPhysFactor) out.push('乘以 ');
    out.push(zh);
    lastPhysFactor = true;
    lastEndsDigit = false;
  };

  // 化学式预处理：识别纯化学式 token（如 H_2O、NaOH、CO_2、Ca(OH)_2），查表转中文名。
  // 只在「该 token 是一个独立化学式」时替换（前后是空白/运算符/边界），避免误伤变量名如 x_1。
  // 策略：先尝试把当前段当作化学式整体匹配；命中则读中文名，未命中回退逐符号念法。
  const tryChemAt = (start: number): { spoken: string; consumed: number } | null => {
      // 化学式形态：元素符号（大写开头，可带小写）+ 可选下标数字，允许多元素连续
      const chemRe = /^(?:[A-Z][a-z]?)(?:_\d+)?(?:[A-Z][a-z]?(?:_\d+)?)*/;
      const m = tex.slice(start).match(chemRe);
      if (!m) return null;
      const token = m[0];
      // 单元素符号（O、C、H、Na、Fe 等）→ 不当作化学式
      if (/^[A-Z][a-z]?$/.test(token)) return null;
      // 前后边界：前一个字符不是字母数字，后一个不是字母（避免截取 aH₂O 中的 H₂O）
      const before = start > 0 ? tex[start - 1] : '';
      const after = start + token.length < n ? tex[start + token.length] : '';
      if (/[A-Za-z0-9]/.test(before)) return null;
      if (/[A-Za-z]/.test(after)) return null;
      const spoken = chemToSpeech(token);
      if (spoken === null) return null;
      return { spoken, consumed: token.length };
    };

  // 主循环中：遇到元素符号开头且可能是化学式时先尝试查表
  const tryChemAtCurrent = (): boolean => {
    const r = tryChemAt(i);
    if (r) {
      out.push(r.spoken);
      i += r.consumed;
      return true;
    }
    return false;
  };

  const readGroup = (): string => {
    // 跳过前导空格
    while (i < n && /\s/.test(tex[i])) i++;
    if (i >= n) return '';
    if (tex[i] === '{') {
      i++; // 跳过 {
      const start = i;
      let depth = 1;
      while (i < n && depth > 0) {
        if (tex[i] === '{') depth++;
        else if (tex[i] === '}') depth--;
        if (depth > 0) i++;
      }
      const inner = tex.slice(start, i);
      i++; // 跳过 }
      return inner;
    }
    // 命令：^ 或 _ 后紧跟 \text{..} / \frac{..}{..} 等命令时，须连同命令名及其参数组一起读，
    // 否则单字符分支只吞一个 '\'，剩余 "text{浮}" 被逐字母读成「t e x t浮」。
    if (tex[i] === '\\') {
      const cm = tex.slice(i).match(/^\\([a-zA-Z]+|.)/);
      if (cm) {
        const cmdName = cm[1];
        let end = i + cm[0].length; // 命令名之后
        // 带一个参数组的命令（\text \mathrm \mathbf \operatorname 等）：把 {..} 一并纳入
        const oneArg = /^(text|textrm|textsf|texttt|mathrm|mathbf|mathit|mathsf|mathcal|boldsymbol|mathsf|operatorname|mbox|hbox)$/;
        if (oneArg.test(cmdName)) {
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
        const seg = tex.slice(i, end);
        i = end;
        return seg;
      }
    }
    // 单字符
    const c = tex[i];
    i++;
    return c;
  };

  const readArg = (): string => {
    const g = readGroup();
    return g;
  };

  while (i < n) {
    const c = tex[i];

    // 物理模式：单位串遇到非字母字符 → 先结算（110W+、2m^3 等）
    if (phys && unitBuf && !/[A-Za-z]/.test(c)) flushUnitBuf();

    // 化学式优先：元素符号开头（大写）时先尝试整体查表（H_2O→水）
    if (/[A-Z]/.test(c) && tryChemAtCurrent()) {
      continue;
    }

    if (c === '\\') {
      // 命令
      const m = tex.slice(i).match(/^\\([a-zA-Z]+|.)/);
      if (!m) {
        i++;
        continue;
      }
      const cmd = m[1];
      i += m[0].length;

      // 特殊处理：\left( \right) —— 按朗读习惯，收尾读「括号」，开头轻声带过（不读「左」）。
      // 两个bug修复：\left[ 之前读裸 ASCII '['（:256），英文 \left/\right 被读成 "left/right"。
      if (cmd === 'left' || cmd === 'right') {
        if (tex[i] === '(' || tex[i] === '[' || tex[i] === '{' || tex[i] === '|') {
          if (cmd === 'right') {
            if (tex[i] === '{') out.push('花括号');
            else if (tex[i] === '[') out.push('右中括号');
            else if (tex[i] === '|') out.push('的绝对值');
            else out.push('括号');
          }
          // cmd === 'left': 只消费字符，不读（收尾括号承担语义）——注意保持 i 推进
          i++;
        }
        continue;
      }

      if (cmd === 'frac') {
        const a = readArg();
        const b = readArg();
        if (a && b) {
          // 物理模式：分子分母都是纯单位且不是当前语境的量名 → 读「每」（m/s → 米每秒）；
          // 量名守卫防止 \frac{m}{V}（密度）被单位表劫持成「米每伏特」
          const aSp = latexToSpeech(a, 'zh', mode, symbols);
          const bSp = latexToSpeech(b, 'zh', mode, symbols);
          const unitOf = (raw: string) => {
            const t = raw.trim();
            return phys && /^\d*[A-Za-zΩ℃]+$/.test(t) && physName(t) === undefined ? PHYS_UNIT_ZH[t] : undefined;
          };
          const aU = unitOf(a);
          const bU = unitOf(b);
          const frag = phys
            ? aU && bU
              ? `{${aU} 每 ${bU}}`
              : `{${aSp} 与 ${bSp} 之比}`
            : `{${bSp} 分之 ${aSp}}`;
          out.push(frag);
          lastVar = /[\dA-Za-z]$/.test(frag.replace(/[{}]/g, ''));
          lastPhysFactor = phys && /之比\}$/.test(frag); // 「…之比」可作乘积左因子（½ 之比 乘以 质量）
          lastEndsDigit = false;
        }
        continue;
      }

      if (cmd === 'sqrt') {
        // 可选次方根：\sqrt[n]{x} —— 先检测 [n] 再读 {x}（[n] 在前）
        let degree = '';
        if (tex[i] === '[') {
          const close = tex.indexOf(']', i);
          if (close !== -1) {
            degree = tex.slice(i + 1, close);
            i = close + 1;
          }
        }
        const inner = readArg();
        let frag: string;
        if (degree) {
          frag = `{${latexToSpeech(inner, 'zh', mode, symbols)} 的 ${degree} 次方根}`;
        } else {
          frag = `{根号 ${latexToSpeech(inner, 'zh', mode, symbols)}}`;
        }
        out.push(frag);
        lastVar = /[\dA-Za-z]$/.test(frag.replace(/[{}]/g, ''));
        continue;
      }

      if (cmd === 'cdot' || cmd === 'times') {
        out.push('乘以');
        lastPhysFactor = false; // 已有乘号，下一个因子不再插
        lastEndsDigit = false;
        continue;
      }

      if (cmd === 'space') {
        out.push(' ');
        continue;
      }

      if (cmd === 'text') {
        // \text{...} 是中文/英文说明文字，直接读内容（带下标的物理量已由 PHYS_COMPOUND_ZH 折叠；
        // 单位已由函数顶部转成中文单位名）
        const inner = readArg();
        if (phys && out.length > 0 && !/[\s，。]$/.test(out[out.length - 1])) out.push(' '); // 数字与单位名间补空格（220 伏特）
        out.push(inner);
        lastVar = false;
        lastEndsDigit = false;
        lastPhysFactor = false;
        continue;
      }

      if (cmd === 'mathrm' || cmd === 'operatorname' || cmd === 'mbox') {
        // \mathrm{kg} → 直接读内容（kg），不读 "mathrm" 命令名
        const inner = readArg();
        if (inner) {
          if (phys && out.length > 0 && !/[\s，。]$/.test(out[out.length - 1])) out.push(' ');
          out.push(inner);
          lastEndsDigit = false;
          lastPhysFactor = false;
        }
        continue;
      }

      // 物理模式：\Delta X → 「X变化量」（Δt → 温度变化量），整体读避免「德耳塔 温度」割裂
      if (phys && (cmd === 'Delta' || (cmd.length === 1 && cmd === 'Δ'))) {
        const arg = readGroup();
        const name = arg ? physName(arg) ?? arg : '';
        pushPhysFactor(`${name}变化量`);
        lastVar = false;
        continue;
      }
      // 查表
      const spoken = CMD_ZH[cmd];
      if (phys && physName(cmd) !== undefined) {
        // 物理模式：量符号（\rho→密度、\eta→机械效率、\lambda→波长）优先于音译
        pushPhysFactor(physName(cmd)!);
        lastVar = false;
      } else {
        // 物理模式：命令词前若紧跟变量字母，补空格（cm\Delta t → c m 德耳塔 t，避免 edge-tts 吞音黏连）
        // 仅物理模式生效——数学模式读法须逐字节不变
        if (phys && lastVar) out.push(' ');
        if (spoken !== undefined) {
          out.push(spoken);
        } else {
          // 未知命令：去掉反斜杠读原词（如 \\mathrm 后面跟的字母）
          out.push(cmd);
        }
        lastEndsDigit = false;
        lastPhysFactor = false;
      }
      continue;
    }

    // 绝对值：裸 | 或 ∣（U+2223）→ 找配对，读「X 的绝对值」
    if (c === '|' || c === '∣') {
      const closeAfter = findMatchingAbsClose(tex, i + 1);
      if (closeAfter !== -1) {
        const inner = tex.slice(i + 1, closeAfter - 1);
        out.push(`${latexToSpeech(inner, 'zh', mode, symbols)} 的绝对值`);
        i = closeAfter;
        lastVar = false;
        continue;
      }
      // 找不到配对（孤立竖线，如集合描述 {x | x>0}）：降级读「竖线」不读原字符
      out.push('竖线');
      i++;
      lastVar = false;
      continue;
    }

    if (c === '^') {
      // 上标
      i++;
      const sup = readGroup();
      if (!sup) continue;
      // 物理模式：单位 + 2/3 次方 → 前置修饰（米^3 → 立方米，厘米^2 → 平方厘米）
      if (phys && /^\d$/.test(sup) && (sup === '2' || sup === '3')) {
        const last = out[out.length - 1] ?? '';
        if (Object.values(PHYS_UNIT_ZH).includes(last)) {
          out[out.length - 1] = (sup === '2' ? '平方' : '立方') + last;
          continue;
        }
      }
      // 数字 → 中文读法：2=平方 3=立方 其他=n 次方
      const num = parseInt(sup, 10);
      if (/^\d+$/.test(sup)) {
        if (num === 2) out.push(' 平方');
        else if (num === 3) out.push(' 立方');
        else out.push(` ${sup} 次方`);
      } else {
        out.push(` 的 ${latexToSpeech(sup, 'zh', mode, symbols)} 次方`);
      }
      lastPhysFactor = phys; // 「电流 平方」可作乘积左因子（Q=I²Rt）
      continue;
    }

    if (c === '_') {
      // 下标
      i++;
      const sub = readGroup();
      if (!sub) continue;
      if (/^\d+$/.test(sub)) {
        // 下标数字：化学式 H_2O → H 二 O；数学 x_1 → x 一
        out.push(` ${subZhNum(sub)} `);
      } else {
        out.push(` 下标 ${latexToSpeech(sub, 'zh', mode, symbols)} `);
      }
      continue;
    }

    if (c === '{' || c === '}') {
      // 孤立花括号：跳过（组已由 readGroup 消费，这里是不成对的情况）
      i++;
      continue;
    }

    if (c === '~') {
      out.push(' ');
      i++;
      continue;
    }

    // 普通字符：数字保留原文，字母保留，运算符转口语
    // 运算符打断乘积链与「数字+字母=单位」判定：lastEndsDigit/lastPhysFactor 一律清零
    if (c === '=') { out.push('等于'); lastVar = false; lastEndsDigit = false; lastPhysFactor = false; }
    else if (c === '+') { out.push('加'); lastVar = false; lastEndsDigit = false; lastPhysFactor = false; }
    else if (c === '-') {
      // 区分负号与减号：看前一字符是否为完整操作数结尾。
      // 负号：-b、a=-b、(-b)、\{-b\}（前界为 开头/(/{/=/+/-/,/±）→ 负
      // 减号：a-b、2a-b、\frac12-b（前一字符是字母/数字/)/]/}）→ 减
      const prev = tex[i - 1];
      const prevIsOperand = prev ? /[A-Za-z0-9}\]\)]/.test(prev) : false;
      out.push(prevIsOperand ? '减' : '负');
      lastVar = false; lastEndsDigit = false; lastPhysFactor = false;
    }
    else if (c === '*') { out.push('乘以'); lastVar = false; lastEndsDigit = false; lastPhysFactor = false; }
    else if (c === '/') { out.push('除以'); lastVar = false; lastEndsDigit = false; lastPhysFactor = false; }
    else if (c === ',') { out.push('，'); lastVar = false; lastEndsDigit = false; lastPhysFactor = false; }
    else if (c === '.') { out.push('点'); lastVar = false; lastPhysFactor = false; } // 小数点不打断数字判定（0.5A → 5 后接 A = 单位）
    else if (c === '(') { lastVar = false; lastEndsDigit = false; lastPhysFactor = false; } // 开头括号轻声带过（收尾括号承担语义），与 \left 一致
    else if (c === ')') { out.push('括号'); lastVar = false; lastEndsDigit = false; lastPhysFactor = false; }
    else if (c === '[') { lastVar = false; lastEndsDigit = false; lastPhysFactor = false; }
    else if (c === ']') { out.push('右中括号'); lastVar = false; lastEndsDigit = false; lastPhysFactor = false; }
    else if (c === '%') { out.push('百分之'); lastVar = false; lastEndsDigit = false; lastPhysFactor = false; }
    else if (UNI_ZH[c] !== undefined) {
      // 裸 Unicode 符号（< > ≤ ≥ ≠ ± × ÷ · 希腊字母 等）→ 口语
      out.push(UNI_ZH[c]);
      lastVar = false; lastEndsDigit = false; lastPhysFactor = false;
    }
    else {
      // 字母/数字变量：若上一个也是单字母/单数字 → 加空格（ax → a x，避免 edge-tts 吞音）
      // 但连续数字不空格（27 → 27，不是 2 7）
      const isDigit = c >= '0' && c <= '9';
      const isVar = isDigit || /^[A-Za-z]$/.test(c);
      const prevEndsDigit = /\d$/.test(out[out.length - 1] ?? '');
      // 物理模式：数字后紧跟的字母 = 单位（110W→瓦、220V→伏特），连续字母攒进 unitBuf
      if (phys && /^[A-Za-z]$/.test(c) && (lastEndsDigit || unitBuf)) {
        unitBuf += c;
        i++;
        continue;
      }
      // 物理模式：字母变量命中量名表 → 读中文量名（数字不替换）
      if (phys && !isDigit && /^[A-Za-z]$/.test(c)) {
        const zh = physName(c);
        if (zh !== undefined) {
          flushUnitBuf(); // 先结算未 flush 的单位串（理论上到不了这里，防御性）
          pushPhysFactor(zh);
          lastVar = false;
          i++;
          continue;
        }
      }
      if (isDigit) flushUnitBuf(); // 数字打断单位串（110W2 之类，防御）
      // 物理模式：未命中量名表的拉丁字母（g、k 等常量/单位符号）也走因子通道，保持乘积链与空格
      if (phys && !isDigit && /^[A-Za-z]$/.test(c)) {
        pushPhysFactor(c);
        lastVar = false;
        i++;
        continue;
      }
      if (isVar && lastVar && !(isDigit && prevEndsDigit)) out.push(' ');
      // 物理模式：折叠产生的中文量名词（液体密度/排开体积…）也续接乘积链——
      // 词首（前一 token 非中文）且链未断时补「乘以」，词内字符不补
      if (phys && !isDigit && !/[A-Za-z]/.test(c) && !/\s/.test(c)) {
        const isCjk = /[\u4e00-\u9fff]/.test(c);
        const prevTok = out[out.length - 1] ?? '';
        if (isCjk) {
          if (lastPhysFactor && !/[\u4e00-\u9fff]$/.test(prevTok)) out.push('乘以 ');
          out.push(c);
          lastPhysFactor = true;
          i++;
          continue;
        }
      }
      out.push(c);
      lastVar = isVar;
      lastEndsDigit = isDigit;
      if (!/\s/.test(c)) lastPhysFactor = false; // 空白只是分隔符，不打断乘积链（I^2 R t → 电流 平方 乘以 电阻…）
    }
    i++;
  }

  if (phys) flushUnitBuf(); // 公式以单位收尾（110W）：循环内无字符触发 flush，此处兜底

  return spaceOutLatinVariables(
    out
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

function latexToSpeechEn(tex: string): string {
  // 归一化：\lvert / \rvert / \vert → 裸 |，统一由绝对值处理逻辑处理
  tex = tex.replace(/\\lvert|\\rvert|\\vert/g, '|');
  // °C 温度 → degrees Celsius（避免 ° 读 degrees + C 读变量）
  tex = tex.replace(/°C/g, ' degrees Celsius ');
  const out: string[] = [];
  let i = 0;
  const n = tex.length;

  const readGroup = (): string => {
    while (i < n && /\s/.test(tex[i])) i++;
    if (i >= n) return '';
    if (tex[i] === '{') {
      i++;
      const start = i;
      let depth = 1;
      while (i < n && depth > 0) {
        if (tex[i] === '{') depth++;
        else if (tex[i] === '}') depth--;
        if (depth > 0) i++;
      }
      const inner = tex.slice(start, i);
      i++;
      return inner;
    }
    const c = tex[i];
    i++;
    return c;
  };

  const readArg = () => readGroup();

  while (i < n) {
    const c = tex[i];

    if (c === '\\') {
      const m = tex.slice(i).match(/^\\([a-zA-Z]+|.)/);
      if (!m) {
        i++;
        continue;
      }
      const cmd = m[1];
      i += m[0].length;

      if (cmd === 'left' || cmd === 'right') {
        if (tex[i] === '(' || tex[i] === '[' || tex[i] === '{' || tex[i] === '|') {
          if (cmd === 'left' && tex[i] === '|') {
            // 绝对值：英文读法是前缀 absolute value of X → 左竖线读前缀，右竖线静默
            out.push(' absolute value of ');
          } else if (cmd === 'right' && tex[i] !== '|') {
            if (tex[i] === '{') out.push(' close brace ');
            else if (tex[i] === '[') out.push(' close bracket ');
            else out.push(' close parenthesis ');
          }
          // cmd === 'left': 只消费字符，不读（收尾括号承担语义）
          i++;
        }
        continue;
      }

      if (cmd === 'frac') {
        const a = readArg();
        const b = readArg();
        if (a && b) out.push(`${latexToSpeechEn(a)} over ${latexToSpeechEn(b)}`);
        continue;
      }
      if (cmd === 'sqrt') {
        // 可选次方根：\\sqrt[n]{x} —— 先检测 [n] 再读 {x}（[n] 在前）
        let degree = '';
        if (tex[i] === '[') {
          const close = tex.indexOf(']', i);
          if (close !== -1) {
            degree = tex.slice(i + 1, close);
            i = close + 1;
          }
        }
        const inner = readArg();
        if (degree) {
          if (degree === '3') {
            // 三次根 → cube root（标准数学读法，避免 "3th"）
            out.push(`cube root of ${latexToSpeechEn(inner)}`);
          } else if (degree === '4') {
            out.push(`fourth root of ${latexToSpeechEn(inner)}`);
          } else {
            const ord = /^\d+$/.test(degree) ? ordinalEn(parseInt(degree, 10)) : degree;
            out.push(`the ${ord} root of ${latexToSpeechEn(inner)}`);
          }
        } else {
          out.push(`square root of ${latexToSpeechEn(inner)}`);
        }
        continue;
      }
      if (cmd === 'cdot' || cmd === 'times') {
        out.push('times');
        continue;
      }
      if (cmd === 'text' || cmd === 'mathrm' || cmd === 'operatorname') {
        out.push(readArg());
        continue;
      }
      const spoken = CMD_EN[cmd];
      if (spoken !== undefined) out.push(spoken);
      else out.push(cmd);
      continue;
    }

    // 绝对值：裸 | 或 ∣（U+2223）→ 找配对，读「absolute value of X」
    if (c === '|' || c === '∣') {
      const closeAfter = findMatchingAbsClose(tex, i + 1);
      if (closeAfter !== -1) {
        const inner = tex.slice(i + 1, closeAfter - 1);
        out.push(` absolute value of ${latexToSpeechEn(inner)} `);
        i = closeAfter;
        continue;
      }
      // 找不到配对（孤立竖线）：读「vertical bar」降级
      out.push(' vertical bar ');
      i++;
      continue;
    }

    if (c === '^') {
      i++;
      const sup = readGroup();
      if (!sup) continue;
      if (/^\d+$/.test(sup)) {
        const num = parseInt(sup, 10);
        if (num === 2) out.push(' squared');
        else if (num === 3) out.push(' cubed');
        else out.push(` to the ${num}th power`);
      } else {
        out.push(` to the power of ${latexToSpeechEn(sup)}`);
      }
      continue;
    }

    if (c === '_') {
      i++;
      const sub = readGroup();
      if (!sub) continue;
      if (/^\d+$/.test(sub)) out.push(` sub ${sub} `);
      else out.push(` sub ${latexToSpeechEn(sub)} `);
      continue;
    }

    if (c === '{' || c === '}') {
      i++;
      continue;
    }
    if (c === '~') {
      out.push(' ');
      i++;
      continue;
    }

    if (c === '=') out.push(' equals ');
    else if (c === '+') out.push(' plus ');
    else if (c === '-') {
      const prev = tex[i - 1];
      const prevIsOperand = prev ? /[A-Za-z0-9}\]\)]/.test(prev) : false;
      out.push(prevIsOperand ? ' minus ' : ' negative ');
    }
    else if (c === '*') out.push(' times ');
    else if (c === '/') out.push(' over ');
    else if (c === ',') out.push(', ');
    else if (c === '.') out.push(' point ');
    else if (c === '(') { /* opening parenthesis: 轻声带过，收尾读 */ }
    else if (c === ')') out.push(' close parenthesis ');
    else if (c === '[') { /* opening bracket: 轻声带过，收尾读 */ }
    else if (c === ']') out.push(' close bracket ');
    else if (UNI_EN[c] !== undefined) {
      // 裸 Unicode 符号（< > ≤ ≥ ≠ ± × ÷ · 希腊字母 等）→ 口语
      out.push(UNI_EN[c]);
    }
    else out.push(c);
    i++;
  }

  return spaceOutLatinVariables(out.join('').replace(/\s{2,}/g, ' ').trim());
}
