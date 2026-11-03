/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学式与化合价页 · 同标签页会话快照
 *
 * 背景：页内点选元素 / 切换模式属于微交互，不应回写 URL（见页面注释）。
 * 但「周期表 → 化学页」是核心教学动线，刷新或同标签页返回时若回到默认速查，
 * 学生会丢掉刚建立的学习上下文。因此用 sessionStorage 做一层**不进入地址栏**的恢复：
 *   - 生命周期 = 当前标签页，关闭即失效；
 *   - 不跨窗口、不跨设备、不进入分享链接；
 *   - 只存可序列化的模式与选择，不存瞬时 UI（详情抽屉、练习作答等）。
 *
 * 入参优先级：URL 深链 > sessionStorage > 默认值（见页面 initial 计算）。
 * 存储内容可能被旧版本或用户手工污染，读取时统一复用 URL 解析器校验，
 * 避免符号 / 离子 / 化学式出现第二套规则。
 */
import {
  CHEM_MODES,
  formatIonRef,
  parseChemistryQuery,
  type ChemMode,
  type IonRef,
} from './formula-core';

export const CHEM_SESSION_KEY = 'stem:chemistry-formulas:state:v1';

export interface ChemSessionState {
  mode: ChemMode;
  symbol: string | null;
  cation: IonRef | null;
  anion: IonRef | null;
  solverFormula: string;
}

const DEFAULT_SOLVER_FORMULA = 'Fe2O3';
/** 与 parseChemistryQuery 对 ?formula= 的约束保持一致。 */
const FORMULA_RE = /^[A-Za-z0-9()·]{1,40}$/;
const SYMBOL_RE = /^[A-Z][a-z]?$/;

/** sessionStorage 在隐私模式 / 存储被禁用时可能直接抛错；拿不到就退化为纯内存态。 */
function getSessionStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * 把存储里的原始字符串解析成可信状态；任何字段不合法都返回 null（回退默认值）。
 */
export function parseChemSessionState(raw: string | null): ChemSessionState | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  const record = data as Record<string, unknown>;
  if (!CHEM_MODES.includes(record.mode as ChemMode)) return null;

  // 复用 URL 解析器：symbol / ion / formula 的校验规则只维护一份。
  const query = new URLSearchParams();
  query.set('mode', String(record.mode));

  if (typeof record.symbol === 'string' && SYMBOL_RE.test(record.symbol)) {
    query.set('symbol', record.symbol);
  }
  if (record.cation && typeof record.cation === 'object') {
    const ion = record.cation as Partial<IonRef>;
    if (typeof ion.formula === 'string' && Number.isFinite(ion.charge)) {
      query.set('cation', formatIonRef(ion as IonRef));
    }
  }
  if (record.anion && typeof record.anion === 'object') {
    const ion = record.anion as Partial<IonRef>;
    if (typeof ion.formula === 'string' && Number.isFinite(ion.charge)) {
      query.set('anion', formatIonRef(ion as IonRef));
    }
  }
  if (typeof record.solverFormula === 'string' && FORMULA_RE.test(record.solverFormula)) {
    query.set('formula', record.solverFormula);
  }

  const parsed = parseChemistryQuery(query);
  return {
    mode: parsed.mode,
    symbol: parsed.symbol,
    cation: parsed.cation,
    anion: parsed.anion,
    solverFormula: parsed.formula ?? DEFAULT_SOLVER_FORMULA,
  };
}

export function loadChemSessionState(): ChemSessionState | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    return parseChemSessionState(storage.getItem(CHEM_SESSION_KEY));
  } catch {
    return null;
  }
}

export function saveChemSessionState(state: ChemSessionState): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(CHEM_SESSION_KEY, JSON.stringify(state));
  } catch {
    // 配额已满或隐私模式：静默失败，页面仍以纯内存态正常工作。
  }
}
