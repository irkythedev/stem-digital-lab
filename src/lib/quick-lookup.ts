/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 全局「/ 口袋速查台」索引与纯过滤逻辑。
 *
 * 只聚合本地已打包的数据，不发任何网络请求：
 * - src/lib/labs.ts            20 个实验 + 核心公式
 * - src/lib/physics-formulas.ts 物理公式
 * - src/lib/elements.ts         118 个元素
 * - src/lib/chemistry/valency.ts 教材常见物质与化合价
 *
 * 这里刻意保持纯函数、无 React/DOM 依赖，便于单测；组件的键盘/焦点行为在
 * QuickLookupModal.tsx 内。
 */
import { labs } from './labs';
import { PHYSICS_FORMULAS, PHYSICS_FORMULA_CATEGORY_ZH } from './physics-formulas';
import { ELEMENTS } from './elements';
import { TYPICAL_COMPOUNDS, VALENCE_ELEMENTS } from './chemistry/valency';

export type LookupKind = 'lab' | 'formula' | 'element' | 'compound';

export interface LookupItem {
  /** 稳定唯一键（kind:sourceId） */
  id: string;
  kind: LookupKind;
  title: { zh: string; en: string };
  /** 副标题：学科/公式/化合价等简短说明 */
  subtitle: { zh: string; en: string };
  /** 命中用的原始文本（小写后参与匹配） */
  search: string;
  /** 实验直达路由（仅 lab） */
  href?: string;
  /** KaTeX 源码（formula / compound） */
  tex?: string;
  /** 元素展示数据 */
  element?: { n: number; symbol: string; mass: number | null; valences: string };
}

const SUBJECT_LABEL: Record<string, { zh: string; en: string }> = {
  math: { zh: '数学', en: 'Math' },
  physics: { zh: '物理', en: 'Physics' },
  chemistry: { zh: '化学', en: 'Chemistry' },
};

/**
 * 实验名的拼音首字母/全拼提示。只覆盖高频入口，避免引入完整拼音库。
 * 搜索时与中文/英文/公式一起参与匹配。
 */
const LAB_ALIASES: Record<string, string> = {
  quadratic: 'erci hanshu ercihanshu parabola',
  inverse: 'fanbili hanshu fanbili hyperbola',
  linear: 'yici hanshu yicihanshu linear',
  ohm: 'oumu oumudinglv oumudingli',
  circuits: 'chuanglian binglian dianlu circuits',
  'circuit-bench': 'dianxue gongzuotai circuitbench',
  lens: 'toujing chengxiang lens',
  circle: 'yuan yuanzhoujiao circle',
  congruence: 'quandeng sanjiao congruence',
  similarity: 'xiangsi xiangsijiaoxing similarity',
  'polygon-pi': 'geyuan ge yuanzhoulv pi',
  construction: 'chiguizuotu construction',
  'mass-conservation': 'zhiliang shouheng massconservation',
  neutralization: 'zhonghe zhonghefanying neutralization',
  buoyancy: 'fuli fubai buoyancy',
  lever: 'gangan lever',
  pressure: 'yaqiang pressure',
  pulley: 'huailun pulley',
  electrolysis: 'dianjie dianjieshui electrolysis',
  'metal-activity': 'jinshu huodongxing metalactivity',
};

const VALENCE_BY_SYMBOL = new Map(VALENCE_ELEMENTS.map((e) => [e.symbol, e]));

function lower(s: string): string {
  return s.trim().toLowerCase();
}

function makeLabs(): LookupItem[] {
  return labs.map((lab) => {
    const subject = SUBJECT_LABEL[lab.subjectId] ?? { zh: lab.subjectId, en: lab.subjectId };
    const formula = lab.meta?.formula ?? '';
    return {
      id: `lab:${lab.id}`,
      kind: 'lab' as const,
      title: lab.name,
      subtitle: {
        zh: `${subject.zh}${formula ? ` · ${formula}` : ''}`,
        en: `${subject.en}${formula ? ` · ${formula}` : ''}`,
      },
      search: lower([
        lab.name.zh, lab.name.en, lab.description.zh, lab.description.en, formula,
        LAB_ALIASES[lab.id] ?? '', subject.zh, subject.en,
      ].join(' ')),
      href: lab.path ?? `/lab/${lab.id}`,
    };
  });
}

function makeFormulas(): LookupItem[] {
  return PHYSICS_FORMULAS.map((f) => {
    const cat = PHYSICS_FORMULA_CATEGORY_ZH[f.category];
    return {
      id: `formula:${f.id}`,
      kind: 'formula' as const,
      title: f.name,
      subtitle: { zh: `${cat} · ${f.formula}`, en: `${f.category} · ${f.formula}` },
      search: lower([f.name.zh, f.name.en, f.formula, f.label.zh, f.label.en, f.chapter, cat, f.labId ?? ''].join(' ')),
      tex: f.formula,
    };
  });
}

function makeElements(): LookupItem[] {
  return ELEMENTS.map((el) => {
    const v = VALENCE_BY_SYMBOL.get(el.symbol);
    const valences = v ? v.valences.map((n) => (n > 0 ? `+${n}` : String(n))).join(' / ') : '';
    return {
      id: `element:${el.symbol}`,
      kind: 'element' as const,
      title: { zh: el.zh, en: el.en },
      subtitle: {
        zh: `Z=${el.n} · ${el.symbol}${valences ? ` · 化合价 ${valences}` : ''}`,
        en: `Z=${el.n} · ${el.symbol}${valences ? ` · valence ${valences}` : ''}`,
      },
      search: lower([el.symbol, el.zh, el.en, `z${el.n}`, String(el.n)].join(' ')),
      element: { n: el.n, symbol: el.symbol, mass: el.mass, valences },
    };
  });
}

const SUBSCRIPT_DIGITS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
};

/** 将化学式里字母/右括号后的数字转成 Unicode 下标；系数（开头数字）保持原样。 */
export function formatChemicalFormula(formula: string): string {
  // 不用 lookbehind：兼容较老的 iOS Safari；保留前一个字符再替换数字。
  return formula.replace(/([A-Za-z)])(\d+)/g, (_, head: string, digits: string) =>
    `${head}${[...digits].map((d) => SUBSCRIPT_DIGITS[d] ?? d).join('')}`,
  );
}

function makeCompounds(): LookupItem[] {
  return TYPICAL_COMPOUNDS.map((c) => ({
    id: `compound:${c.formula}`,
    kind: 'compound' as const,
    title: c.name,
    subtitle: { zh: `${formatChemicalFormula(c.formula)} · ${c.category.zh}`, en: `${formatChemicalFormula(c.formula)} · ${c.category.en}` },
    search: lower([c.formula, c.name.zh, c.name.en, c.category.zh, c.category.en].join(' ')),
    tex: c.formula,
  }));
}

export const LOOKUP_ITEMS: readonly LookupItem[] = [
  ...makeLabs(),
  ...makeFormulas(),
  ...makeCompounds(),
  ...makeElements(),
];

function scoreItem(item: LookupItem, needle: string, tokens: string[]): number {
  const titleZh = lower(item.title.zh);
  const titleEn = lower(item.title.en);
  let score = 0;

  if (titleZh === needle || titleEn === needle) score += 120;
  if (titleZh.startsWith(needle) || titleEn.startsWith(needle)) score += 80;
  if (titleZh.includes(needle) || titleEn.includes(needle)) score += 55;
  if (lower(item.search).includes(needle)) score += 25;

  if (item.kind === 'element' && item.element) {
    if (item.element.symbol.toLowerCase() === needle) score += 140;
    if (item.element.symbol.toLowerCase().startsWith(needle)) score += 50;
  }

  // 多词查询：每个词都要在 search 里出现，命中越多越高；缺词直接降为 0（避免噪声）
  if (tokens.length > 1) {
    const hay = lower(`${item.title.zh} ${item.title.en} ${item.search}`);
    for (const t of tokens) {
      if (!hay.includes(t)) return 0;
    }
    score += 20;
  }

  // 实验优先于元素，元素优先于公式/物质；同分时更贴近日常入口
  const weight = item.kind === 'lab' ? 12 : item.kind === 'element' ? 8 : 4;
  return score > 0 ? score + weight : 0;
}

/** 纯函数：按关键词过滤并排序；空查询返回分组前几条热门入口。 */
export function searchLookup(query: string, items: readonly LookupItem[] = LOOKUP_ITEMS): LookupItem[] {
  const needle = lower(query);
  if (!needle) {
    // 空查询：每类各取几条，首屏就能看到分组结构，而不是一整屏实验
    const pick = (kind: LookupKind, n: number) => items.filter((i) => i.kind === kind).slice(0, n);
    return [...pick('lab', 4), ...pick('formula', 3), ...pick('compound', 3), ...pick('element', 4)];
  }
  const tokens = needle.split(/\s+/).filter(Boolean);
  return items
    .map((item) => ({ item, score: scoreItem(item, needle, tokens) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.zh.localeCompare(b.item.title.zh, 'zh'))
    .slice(0, 32)
    .map((x) => x.item);
}

export function groupLookup(items: readonly LookupItem[]): Record<LookupKind, LookupItem[]> {
  return {
    lab: items.filter((i) => i.kind === 'lab'),
    formula: items.filter((i) => i.kind === 'formula'),
    compound: items.filter((i) => i.kind === 'compound'),
    element: items.filter((i) => i.kind === 'element'),
  };
}
