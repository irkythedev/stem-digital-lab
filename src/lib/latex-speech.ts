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
 * 从 start 位置开始，找到与「当前开启竖线」配对的闭合竖线下标（返回闭合标记之后的位置）。
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
export function latexToSpeech(tex: string, lang: 'zh' | 'en' = 'zh'): string {
  if (lang === 'en') return latexToSpeechEn(tex);
  // 归一化：\lvert / \rvert / \vert → 裸 |，统一由绝对值处理逻辑处理
  tex = tex.replace(/\\lvert|\\rvert|\\vert/g, '|');
  // °C 温度 → 摄氏度（避免 ° 读「度」+ C 读变量）
  tex = tex.replace(/°C/g, '摄氏度');
  const out: string[] = [];
  let i = 0;
  const n = tex.length;
  /** 上一个 push 的是否为单字母/单数字（用于变量间加空格，ax → a x） */
  let lastVar = false;

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
          const frag = `{${latexToSpeech(b, 'zh')} 分之 ${latexToSpeech(a, 'zh')}}`;
          out.push(frag);
          lastVar = /[\dA-Za-z]$/.test(frag.replace(/[{}]/g, ''));
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
          frag = `{${latexToSpeech(inner, 'zh')} 的 ${degree} 次方根}`;
        } else {
          frag = `{根号 ${latexToSpeech(inner, 'zh')}}`;
        }
        out.push(frag);
        lastVar = /[\dA-Za-z]$/.test(frag.replace(/[{}]/g, ''));
        continue;
      }

      if (cmd === 'cdot' || cmd === 'times') {
        out.push('乘以');
        continue;
      }

      if (cmd === 'space') {
        out.push(' ');
        continue;
      }

      if (cmd === 'text') {
        // \text{...} 是中文/英文说明文字，直接读内容
        const inner = readArg();
        out.push(inner);
        continue;
      }

      if (cmd === 'mathrm' || cmd === 'operatorname' || cmd === 'mbox') {
        // \mathrm{kg} → 直接读内容（kg），不读 "mathrm" 命令名
        const inner = readArg();
        if (inner) out.push(inner);
        continue;
      }

      // 查表
      const spoken = CMD_ZH[cmd];
      if (spoken !== undefined) {
        out.push(spoken);
      } else {
        // 未知命令：去掉反斜杠读原词（如 \\mathrm 后面跟的字母）
        out.push(cmd);
      }
      continue;
    }

    // 绝对值：裸 | 或 ∣（U+2223）→ 找配对，读「X 的绝对值」
    if (c === '|' || c === '∣') {
      const closeAfter = findMatchingAbsClose(tex, i + 1);
      if (closeAfter !== -1) {
        const inner = tex.slice(i + 1, closeAfter - 1);
        out.push(`${latexToSpeech(inner, 'zh')} 的绝对值`);
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
      // 数字 → 中文读法：2=平方 3=立方 其他=n 次方
      const num = parseInt(sup, 10);
      if (/^\d+$/.test(sup)) {
        if (num === 2) out.push(' 平方');
        else if (num === 3) out.push(' 立方');
        else out.push(` ${sup} 次方`);
      } else {
        out.push(` 的 ${latexToSpeech(sup, 'zh')} 次方`);
      }
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
        out.push(` 下标 ${latexToSpeech(sub, 'zh')} `);
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
    if (c === '=') { out.push('等于'); lastVar = false; }
    else if (c === '+') { out.push('加'); lastVar = false; }
    else if (c === '-') {
      // 区分负号与减号：看前一字符是否为完整操作数结尾。
      // 负号：-b、a=-b、(-b)、\{-b\}（前界为 开头/(/{/=/+/-/,/±）→ 负
      // 减号：a-b、2a-b、\frac12-b（前一字符是字母/数字/)/]/}）→ 减
      const prev = tex[i - 1];
      const prevIsOperand = prev ? /[A-Za-z0-9}\]\)]/.test(prev) : false;
      out.push(prevIsOperand ? '减' : '负');
      lastVar = false;
    }
    else if (c === '*') { out.push('乘以'); lastVar = false; }
    else if (c === '/') { out.push('除以'); lastVar = false; }
    else if (c === ',') { out.push('，'); lastVar = false; }
    else if (c === '.') { out.push('点'); lastVar = false; }
    else if (c === '(') { lastVar = false; } // 开头括号轻声带过（收尾括号承担语义），与 \left 一致
    else if (c === ')') { out.push('括号'); lastVar = false; }
    else if (c === '[') { lastVar = false; }
    else if (c === ']') { out.push('右中括号'); lastVar = false; }
    else if (c === '%') { out.push('百分之'); lastVar = false; }
    else if (UNI_ZH[c] !== undefined) {
      // 裸 Unicode 符号（< > ≤ ≥ ≠ ± × ÷ · 希腊字母 等）→ 口语
      out.push(UNI_ZH[c]);
      lastVar = false;
    }
    else {
      // 字母/数字变量：若上一个也是单字母/单数字 → 加空格（ax → a x，避免 edge-tts 吞音）
      // 但连续数字不空格（27 → 27，不是 2 7）
      const isDigit = c >= '0' && c <= '9';
      const isVar = isDigit || /^[A-Za-z]$/.test(c);
      const prevEndsDigit = /\d$/.test(out[out.length - 1] ?? '');
      if (isVar && lastVar && !(isDigit && prevEndsDigit)) out.push(' ');
      out.push(c);
      lastVar = isVar;
    }
    i++;
  }

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
