/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学式 / 化学符号 → 中文朗读口径（供 latexToSpeech 的化学上下文预处理器使用）。
 *
 * 为什么需要它：系统提示词（ai-config.ts:304/344）明确要求「化学式与元素符号用 \mathrm{}」，
 * 而 latex-speech.ts 里原有的化学特调（CHEM_ZH 表）只在**裸写法**下命中，且没有任何
 * \mathrm{} / \text{} 解包分支 —— 于是 \mathrm{H_2O} 走「未知命令安全降级」原样吐出
 * `H_2O` 进 TTS，60 条化合物表事实上成了死代码（审计实测 28 例）。
 *
 * 判定为什么必须保守：数学/物理公式里大量出现元素符号形状的字母（I=U/R 的 U、I；
 * P=UI 的 U、I；E=mc² 的 C…），只看「有没有大写字母」会把物理公式误判成化学式。
 * 因此只在两种强信号下判定为化学上下文：
 *   · 出现化学专有命令（\xrightarrow / ↑ / ↓）—— 数学物理从不使用；
 *   · \mathrm{} 里是「多元素式 / 带括号的原子团 / 命中化合物表或离子表」。
 *     而 \mathrm{V}、\mathrm{N} 这类**单元素符号**（恰恰是物理单位）一律不判为化学。
 */

/** 化学 token 长度上限（见 isChemInner 里的回溯说明） */
const MAX_CHEM_LEN = 32;

/** 元素符号 → 中文名。收录 1–56 号（初中/高中全部用得到的范围）与常见重元素。 */
const ELEM_ZH: Record<string, string> = {
  H: '氢', He: '氦', Li: '锂', Be: '铍', B: '硼', C: '碳', N: '氮', O: '氧', F: '氟', Ne: '氖',
  Na: '钠', Mg: '镁', Al: '铝', Si: '硅', P: '磷', S: '硫', Cl: '氯', Ar: '氩', K: '钾', Ca: '钙',
  Sc: '钪', Ti: '钛', V: '钒', Cr: '铬', Mn: '锰', Fe: '铁', Co: '钴', Ni: '镍', Cu: '铜', Zn: '锌',
  Ga: '镓', Ge: '锗', As: '砷', Se: '硒', Br: '溴', Kr: '氪', Rb: '铷', Sr: '锶', Y: '钇', Zr: '锆',
  Nb: '铌', Mo: '钼', Tc: '锝', Ru: '钌', Rh: '铑', Pd: '钯', Ag: '银', Cd: '镉', In: '铟', Sn: '锡',
  Sb: '锑', Te: '碲', I: '碘', Xe: '氙', Cs: '铯', Ba: '钡',
  W: '钨', Pt: '铂', Au: '金', Hg: '汞', Pb: '铅',
};

/**
 * 离子 → 中文名。键为**归一化形式**（去掉 `_` 与花括号，保留 `^`），
 * 例如 `Fe^{3+}` → `Fe^3+`、`SO_4^{2-}` → `SO4^2-`。
 */
const ION_ZH: Record<string, string> = {
  'H^+': '氢离子', 'OH^-': '氢氧根离子', 'Na^+': '钠离子', 'K^+': '钾离子', 'Ag^+': '银离子',
  'NH4^+': '铵根离子', 'Cl^-': '氯离子', 'HCO3^-': '碳酸氢根离子', 'NO3^-': '硝酸根离子',
  'MnO4^-': '高锰酸根离子', 'O^2-': '氧离子', 'S^2-': '硫离子',
  'Ca^2+': '钙离子', 'Mg^2+': '镁离子', 'Zn^2+': '锌离子', 'Ba^2+': '钡离子', 'Cu^2+': '铜离子',
  'Fe^2+': '亚铁离子', 'Fe^3+': '铁离子', 'Al^3+': '铝离子',
  'SO4^2-': '硫酸根离子', 'CO3^2-': '碳酸根离子', 'SO3^2-': '亚硫酸根离子',
  'SiO3^2-': '硅酸根离子', 'PO4^3-': '磷酸根离子',
};

/**
 * 初中常见化合物 → 中文名（教学口径，教材/中考标准名）。**本表是单一事实源**，
 * latex-speech.ts 通过 chemToSpeech 复用，不再各自维护一份。
 * 注意：H₂O 读「水」而非「一氧化二氢」（后者是网络梗，教材不用）。
 * 键 = 归一化形式（H_2O → H2O、Ca(OH)_2 → CaOH2）。
 */
export const CHEM_ZH: Record<string, string> = {
  H2O: '水', H2O2: '过氧化氢', O2: '氧气', H2: '氢气', N2: '氮气', Cl2: '氯气',
  CO2: '二氧化碳', CO: '一氧化碳', SO2: '二氧化硫', SO3: '三氧化硫', NO: '一氧化氮', NO2: '二氧化氮',
  NH3: '氨气', CH4: '甲烷',
  HCl: '盐酸', H2SO4: '硫酸', HNO3: '硝酸', H2CO3: '碳酸',
  NaOH: '氢氧化钠', CaOH2: '氢氧化钙', KOH: '氢氧化钾', NH4OH: '氨水',
  CaO: '氧化钙', CuO: '氧化铜', MgO: '氧化镁', FeO: '氧化亚铁', Fe2O3: '氧化铁', Fe3O4: '四氧化三铁',
  Al2O3: '氧化铝', ZnO: '氧化锌', MnO2: '二氧化锰',
  NaCl: '氯化钠', KCl: '氯化钾', CaCl2: '氯化钙', FeCl2: '氯化亚铁', FeCl3: '氯化铁', AgCl: '氯化银',
  BaCl2: '氯化钡', CuCl2: '氯化铜',
  Na2CO3: '碳酸钠', NaHCO3: '碳酸氢钠', CaCO3: '碳酸钙', BaCO3: '碳酸钡',
  Na2SO4: '硫酸钠', CuSO4: '硫酸铜', BaSO4: '硫酸钡', CaSO4: '硫酸钙', FeSO4: '硫酸亚铁',
  Fe2SO43: '硫酸铁', Al2SO43: '硫酸铝',
  KMnO4: '高锰酸钾', K2MnO4: '锰酸钾',
  KNO3: '硝酸钾', AgNO3: '硝酸银', CuNO3: '硝酸铜', CuNO32: '硝酸铜', NaNO3: '硝酸钠', CaNO32: '硝酸钙',
  NH4Cl: '氯化铵', KH2PO4: '磷酸二氢钾',
};

/** 多元素式（≥2 段元素符号叠写，如 H2O、Fe3O4） */
const MULTI_ELEM = /^[A-Z][a-z]?\d*(?:[A-Z][a-z]?\d*)+$/;
/**
 * 化学式本体：元素符号 + 可选下标，可含括号原子团（Ca(OH)_2、Al_2(SO_4)_3）。
 * 三条正则各写一份字面量、**不做字符串拼接**：此前用模板串拼 FORMULA_SRC 时，
 * `\\(` 在「JS 字符串 → 正则」两跳转义里漂移成捕获组 `(`，replace 回调参数整体错位
 * （第 2 个参数拿到内层分组而不是数字），症状是「离子与括号式静默不转换，单元素却被替换」。
 * 字面量正则没有这层风险：正则里的 `\\x` 就是「一个反斜杠 + x」。
 */
const FORMULA_BODY = '(?:[A-Z][a-z]?_?\\d*|\\((?:[A-Z][a-z]?_?\\d*)+\\)_?\\d*)+';
/** 孤立化学式：前后都不能再是字母/数字/下划线/括号，避免从 CuSO_4 里截出 Cu */
const ISO_FORMULA_RE = new RegExp(`(?<![A-Za-z0-9_()])(${FORMULA_BODY})(?![A-Za-z0-9_()])`, 'g');
/** 离子：化学式 + 上标电荷 */
const ION_RE = new RegExp(`(${FORMULA_BODY})\\^\\{?(\\d*)([+-])\\}?`, 'g');
/** 计量数：前一个字符不能是字母/数字/下划线，否则 H_2O 里的 2 会被当成计量数 */
const COEFF_RE = new RegExp(`(?<![A-Za-z0-9_])(\\d{1,2})\\s*(${FORMULA_BODY})`, 'g');
/** 条件箭头：\xrightarrow{\ \text{通电}\ }（inner 允许一层嵌套花括号） */
const XARROW_RE = /\\x(?:right|left)arrow(?:\[[^\]]*\])?\{((?:[^{}]|\{[^{}]*\})*)\}/g;
/** \\mathrm{} / \\text{} 等包裹（inner 允许一层嵌套花括号，Fe^{3+} 才能被识别） */
const WRAP_RE = /\\(?:mathrm|text|textrm|mbox)\{((?:[^{}]|\{[^{}]*\})*)\}/g;

/** 归一化：去掉下标下划线、括号、花括号与空白（与 latex-speech 的 normalizeChemFormula 同口径） */
export function normChem(raw: string): string {
  return raw.replace(/[_\s]/g, '').replace(/[(){}]/g, '');
}

/** 化合物名 → 带「分子」后缀的读法（水 → 水分子；氧气 → 氧分子） */
export function compoundNameSpoken(norm: string): string | null {
  const name = CHEM_ZH[norm];
  if (!name) return null;
  return name.endsWith('气') ? `${name.slice(0, -1)}分子` : `${name}分子`;
}

/** 把一段化学 token 读成中文；无法识别返回 null（交回主循环逐符号念） */
export function chemTokenToSpeech(raw: string): string | null {
  const norm = normChem(raw);
  if (!norm || norm.length > MAX_CHEM_LEN) return null;
  // ① 离子：元素/原子团 + 上标电荷
  const ion = norm.match(/^([A-Z][a-z]?\d*(?:[A-Z][a-z]?\d*)*)\^(\d*)([+-])$/);
  if (ion) {
    const key = `${ion[1]}^${ion[2]}${ion[3]}`;
    if (ION_ZH[key]) return ION_ZH[key];
    // 表外离子：单元素 → 「某离子」（Mn^2+ → 锰离子）
    if (/^[A-Z][a-z]?$/.test(ion[1]) && ELEM_ZH[ion[1]]) return `${ELEM_ZH[ion[1]]}离子`;
    return null;
  }
  // ② 化合物表
  if (CHEM_ZH[norm]) return CHEM_ZH[norm];
  // ③ 单质：单个元素符号 → 元素中文名（Na → 钠、Fe → 铁）
  const bare = norm.match(/^([A-Z][a-z]?)(\d*)$/);
  if (bare && ELEM_ZH[bare[1]]) return ELEM_ZH[bare[1]];
  return null;
}

/**
 * \mathrm{} 里的内容是否「有化学意义」——detectChem 与解包共用同一判据，避免两处漂移。
 * 注意：单元素符号（V、N、P、S…）**不算**，它们正是物理单位。
 */
function isChemInner(inner: string): boolean {
  const raw = inner.trim();
  const norm = normChem(inner);
  if (!norm) return false;
  // 长度闸门：最长的初中化学式也就 Al_2(SO_4)_3 一类（≈12 字符），化学计量数+括号也不过 20。
  // 放行超长 inner 会让下面的嵌套量词正则出现 O(n²) 回溯——实测 \mathrm{AAAA…}：
  // 1000 字符 12ms、4000 字符 141ms、8000 字符 559ms（每次翻倍约 4 倍）。真实公式远低于阈值，
  // 但 AI 偶发把整段文字包进 \mathrm{} 时会白白卡住主线程。
  if (norm.length > MAX_CHEM_LEN) return false;
  if (CHEM_ZH[norm]) return true;                    // H2O / CuSO4 / NaOH
  if (MULTI_ELEM.test(norm)) return true;            // 多元素式
  if (/^[A-Z][a-z]?\d*(?:[A-Z][a-z]?\d*)*\^\d*[+-]$/.test(norm)) return true; // 离子
  if (/^[A-Z][a-z]?_?\d*\(/.test(raw)) return true;   // 带括号的原子团（normChem 抹掉了括号，必须看原文）
  // 两字母及以上的元素符号（Na/Fe/Cu/Zn/Ag/Mg/Al/Ca…）在 \mathrm{} 里只可能是化学；
  // 单字母元素符号（H/C/N/O/S/P/K/V/W/I/U）与物理单位同形（\mathrm{N} 牛顿、\mathrm{V} 伏特），
  // 一律留给物理单位路径，不判为化学。
  if (norm.length >= 2 && ELEM_ZH[norm]) return true;
  return false;
}

/** 判定一段公式是否为「化学上下文」——只认强信号，宁可漏判不可误判 */
export function detectChem(tex: string): boolean {
  if (/\\xrightarrow|\\xleftarrow|\\uparrow|\\downarrow|\\ce\{/.test(tex)) return true;
  for (const m of tex.matchAll(WRAP_RE)) if (isChemInner(m[1])) return true;
  return false;
}

/** 中文计量数（≤10 用汉字，更大保留阿拉伯数字 —— 「12 个」比「十二个」更像读法提示） */
const CN_NUM = ['', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十'];
function coeffZh(n: number): string {
  return n <= 10 ? CN_NUM[n] : String(n);
}

/**
 * 化学上下文预处理器：把公式串转成「接近中文口语」的串，再交回 latexToSpeech 主循环。
 * 顺序有硬依赖，不可调换：
 *   箭头 → 解包 → 条件箭头 → 离子 → 计量数 → 化学式 → 反应符号 → 空白命令。
 * （离子必须先于反应符号里的 `+` → 「和」，否则 H^+ 的加号会被当成反应物的连接词。）
 */
export function chemPrePass(tex: string): string {
  let s = tex;

  // ① 气体/沉淀箭头先行：\mathrm{H_2\uparrow} 要先清掉箭头，② 的解包判定才认得出 H_2 是化学式
  s = s.replace(/\\uparrow/g, '').replace(/\\downarrow/g, '沉淀');

  // ② 解包 \mathrm{} / \text{} / \textrm{} / \mbox{}：让化合物表重新可命中。
  //    只解「有化学意义」的组；\mathrm{mL}、\mathrm{kg} 这类单位原样保留，由主循环按既有路径处理。
  //    非化学组必须返回**原匹配串**，不能用 \mathrm{} 重写（否则 \text{通电} 会变成 \mathrm{通电}）。
  s = s.replace(WRAP_RE, (m, inner: string) => (isChemInner(inner) ? inner : m));

  // ③ 条件箭头：\xrightarrow{\ \text{通电}\ } → 「在通电条件下生成」
  s = s.replace(XARROW_RE, (_, cond: string) => {
    const c = cond
      .replace(WRAP_RE, '$1')
      .replace(/\\[ ,;:!]/g, ' ')
      .replace(/\s+/g, '')
      .trim();
    return c ? `在${c}条件下生成` : '生成';
  });

  // ④ 离子：H^+ / OH^- / Fe^{3+} / SO_4^{2-} …
  s = s.replace(ION_RE, (m, formula: string, charge: string, sign: string) =>
    chemTokenToSpeech(`${formula}^${charge}${sign}`) ?? m,
  );

  // ⑤ 计量数 + 化学式：2H_2O → 两个水分子；2Cu → 两个铜原子；2H_2 → 两个氢分子
  s = s.replace(COEFF_RE, (m, num: string, formula: string) => {
    const n = Number(num);
    if (!Number.isFinite(n) || n < 2) return m;
    const norm = normChem(formula);
    const comp = compoundNameSpoken(norm);
    if (comp) return `${coeffZh(n)}个${comp}`;
    const el = norm.match(/^([A-Z][a-z]?)(\d*)$/);
    if (el && ELEM_ZH[el[1]]) return `${coeffZh(n)}个${ELEM_ZH[el[1]]}原子`;
    return m;
  });

  // ⑥ 孤立化学式（含括号原子团）：Ca(OH)_2 → 氢氧化钙、Fe → 铁、O_2 → 氧气
  //    必须**孤立**匹配：CuSO_4 里不能把 Cu / S / O 拆出来单独换。
  s = s.replace(ISO_FORMULA_RE, (m, formula: string) => chemTokenToSpeech(formula) ?? m);

  // ⑦ 反应符号（仅化学上下文）：→ / = → 生成、+ → 和
  s = s.replace(/\\(?:rightarrow|longrightarrow|to|Longrightarrow|implies)(?![A-Za-z])/g, '生成');
  s = s.replace(/=/g, '反应生成').replace(/\+/g, '和');

  // ⑧ 清理残留的 LaTeX 空白命令，避免读成「逗号」
  s = s.replace(/\\[ ,;:!](?![A-Za-z])/g, ' ');

  return s;
}

/* ───────────────────────── 口语化数字 / 化合价 / 算式（初中口径） ───────────────────────── */

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const CN_UNITS = ['', '十', '百', '千'];

/** 0–9999 整数 → 中文读法：160 → 一百六十、80 → 八十、232 → 二百三十二。 */
export function intToChinese(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return '零';
  if (n < 0) return `负${intToChinese(-n)}`;
  if (n > 9999) return String(n);
  const digits = String(n);
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[i]);
    const pos = digits.length - 1 - i;
    if (d === 0) {
      if (out && !out.endsWith('零') && i < digits.length - 1) out += '零';
    } else {
      out += CN_DIGITS[d] + CN_UNITS[pos];
    }
  }
  out = out.replace(/零+$/, '').replace(/^一十/, '十');
  return out;
}

/** 化合价 → 口语：+3 → 正三价，−2 → 负二价（数值 1 保留「一」）。 */
export function valenceToSpeech(v: number): string {
  return `${v >= 0 ? '正' : '负'}${intToChinese(Math.abs(v))}价`;
}

/** 代数运算式 → 口语：2x + 3 × (−2) = 0 → 2x 加上 3 乘以 负2 等于 0。 */
export function expressionToSpeech(expr: string): string {
  return expr
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    // 先处理括号内的带符号数：(−2) → 负2、(＋3) → 正3，避免负号被当「减」
    .replace(/\(([+＋−-]?)(\d+)\)/g, (_m, sign: string, num: string) => `${sign ? (sign === '+' || sign === '＋' ? '正' : '负') : ''}${num}`)
    .replace(/\s*×\s*/g, ' 乘以 ')
    .replace(/\s*\+\s*/g, ' 加上 ')
    .replace(/\s*[−-]\s*/g, ' 减 ')
    .replace(/\s*=\s*/g, ' 等于 ')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 朗读前兜底：把 Mr / M_r / Mᵣ / `<i>M</i><sub>r</sub>` 一律拦成「相对分子质量」，
 * 避免语音引擎念成「Mister / M-R」；同时抹掉裸露的左右括号记号。
 */
export function sanitizeMrSpoken(text: string): string {
  return text
    .replace(/<i>\s*M\s*<\/i>\s*<sub>\s*r\s*<\/sub>/gi, '相对分子质量')
    .replace(/M\s*[_ᵣ]\s*r?/g, '相对分子质量')
    .replace(/\bM\s*r\b/g, '相对分子质量')
    .replace(/[()]/g, '');
}
