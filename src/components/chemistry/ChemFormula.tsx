/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学式排版组件：元素符号正文 + 原子个数下标 + 离子电荷上标。
 *
 * 只使用 CSS 变量与项目既有字体类；数字统一 tabular-nums，避免 H₂O 与 H₂O₂
 * 切换时横向跳动。aria-label 传可朗读的化学名，屏幕阅读器不会逐个念下标。
 *
 * 三个渲染出口共用同一套 tokenizer，杜绝「大标题有下标、选项平写」的割裂：
 *   - `ChemFormula`：整块显示（带字号档位 / 可带电荷上标 / 可带元素分类高亮）；
 *   - `formulaNodes`：只产出 `<sub>` 片段、不带字号，供内联组合；
 *   - `FormulaText`：把叙述文字里夹带的 ASCII 化学式就地渲染成规范上下标。
 *
 * 元素分类高亮（克制策略）：
 *   - 默认常态：元素符号一律 `--fg`，绝不彩虹字；
 *   - 目标态（`targetSymbol`）：命中的元素给该分类的浅色底 + 同色底点缀线；
 *   - 悬停态：鼠标悬停任一元素时触发该元素分类的微光；
 *   - 每个元素都带 `title`（分类名），且上色只做辅助，信息不单靠颜色传递；
 *   - 浅色半透明底（alpha ≤ 0.10）叠在 --fg 正文上，对比度仍满足 WCAG AA。
 */
import { useMemo, useState, type ReactNode } from 'react';
import { elementBySymbol, type ElementCategory } from '../../lib/elements';
import { CAT_COLOR, CAT_ZH, CAT_EN } from '../../lib/element-categories';

export interface ChemFormulaProps {
  formula: string;
  /** 离子电荷，如 SO4²⁻ 传 −2；不传则不画上标。 */
  charge?: number;
  /** 字号档位。 */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** 屏幕阅读器朗读文本；缺省时用化学式本身。 */
  ariaLabel?: string;
  className?: string;
  /** 目标元素符号（如 'Fe'）：命中元素启用分类底色微光。 */
  targetSymbol?: string;
  /** 点击某个元素时的回调（原地打开元素详情抽屉）。仅在非按钮容器里开启，避免嵌套交互元素。 */
  onElementClick?: (symbol: string) => void;
  /** Tooltip / 无障碍朗读语言（分类名按此单语显示，不中英混排）。默认 zh。 */
  lang?: 'zh' | 'en';
}

const SIZE: Record<NonNullable<ChemFormulaProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-3xl',
};

/** 化学式片段：`sub` 为真表示这是原子个数下标。 */
export interface FormulaSegment {
  text: string;
  sub: boolean;
}

/**
 * 把化学式切成「正体 / 下标」片段。
 *
 * 数字默认是原子个数下标，但两类例外要保持正体：
 *   1. 前导化学计量数（`2H2O` 开头的 `2`）——式首数字；
 *   2. 结晶水系数（`CuSO4·5H2O` 里紧跟 `·` 的 `5`）。
 */
export function tokenizeFormula(formula: string): FormulaSegment[] {
  const segs: FormulaSegment[] = [];
  const re = /([A-Z][a-z]?)|(\d+)|([()·])/g;
  let last = 0;
  for (const match of formula.matchAll(re)) {
    if (match.index === undefined) continue;
    if (match.index > last) segs.push({ text: formula.slice(last, match.index), sub: false });
    const raw = match[0];
    const digit = match[2];
    if (digit) {
      const isCoefficient = match.index === 0 || formula[match.index - 1] === '·';
      segs.push({ text: raw, sub: !isCoefficient });
    } else {
      // 元素符号与 `( ) ·` 标点一律正体。
      segs.push({ text: raw, sub: false });
    }
    last = match.index + raw.length;
  }
  if (last < formula.length) segs.push({ text: formula.slice(last), sub: false });
  return segs;
}

const SUB_CLASS = 'text-[0.7em] leading-none relative -bottom-[0.22em]';
const SUP_CLASS = 'text-[0.65em] leading-none align-super relative -top-[0.25em] ml-[0.05em]';

/** 元素符号判定：两个字母以内、首字母大写。 */
const ELEMENT_TOKEN = /^[A-Z][a-z]?$/;

/** 类别名按语言取单语（Tooltip / 朗读不中英混排）。 */
function categoryLabel(cat: ElementCategory, lang: 'zh' | 'en' = 'zh'): string {
  return lang === 'en' ? CAT_EN[cat] : CAT_ZH[cat];
}

interface DecorateOpts {
  charge?: number;
  targetSymbol?: string;
  onElementClick?: (symbol: string) => void;
  hovered: string | null;
  lang?: 'zh' | 'en';
  setHovered?: (v: string | null | ((prev: string | null) => string | null)) => void;
}

/** 统一渲染：下标 / 元素符号（分类微光、目标态、可原地点击）/ 电荷上标。 */
function renderDecorated(formula: string, opts: DecorateOpts): ReactNode[] {
  const { charge, targetSymbol, onElementClick, hovered, lang = 'zh', setHovered } = opts;
  const out: ReactNode[] = [];
  let key = 0;
  for (const seg of tokenizeFormula(formula)) {
    if (!seg.text) continue;
    if (seg.sub) {
      out.push(
        <sub key={key++} className={SUB_CLASS}>
          {seg.text}
        </sub>,
      );
      continue;
    }
    const sym = seg.text;
    const info = ELEMENT_TOKEN.test(sym) ? elementBySymbol.get(sym) : undefined;
    if (info) {
      const style = CAT_COLOR[info.cat];
      // 严格互斥：一旦有悬停，仅悬停元素上色（覆盖目标态），绝不让目标元素与悬停元素同时着色。
      const active = hovered !== null ? hovered === sym : targetSymbol === sym;
      const deco = active
        ? { backgroundColor: style.bg, boxShadow: `inset 0 -0.12em 0 ${style.border}` }
        : undefined;
      const catName = categoryLabel(info.cat, lang);
      const title = `${sym} · ${catName}`;
      const cls = `rounded-[2px] transition-colors${onElementClick ? ' cursor-pointer' : ''}`;
      const handlers = {
        onMouseEnter: () => setHovered?.(sym),
        onMouseLeave: () => setHovered?.((h) => (h === sym ? null : h)),
      };
      if (onElementClick) {
        out.push(
          <button
            key={key++}
            type="button"
            onClick={() => onElementClick(sym)}
            className={`${cls} appearance-none border-0 bg-transparent p-0 text-inherit`}
            style={deco}
            title={title}
            aria-label={`${sym}${lang === 'en' ? ', ' : '，'}${catName}`}
            {...handlers}
          >
            {sym}
          </button>,
        );
      } else {
        out.push(
          <span key={key++} className={cls} style={deco} title={title} {...handlers}>
            {sym}
          </span>,
        );
      }
    } else {
      out.push(<span key={key++}>{sym}</span>);
    }
  }
  if (charge !== undefined) {
    const chargeText = `${Math.abs(charge) === 1 ? '' : Math.abs(charge)}${charge > 0 ? '+' : '−'}`;
    out.push(
      <sup key={key++} className={SUP_CLASS}>
        {chargeText}
      </sup>,
    );
  }
  return out;
}

/**
 * 把化学式渲染成 React 节点（原子个数走 `<sub>`），**不包裹字体/字号、不做分类高亮**，
 * 便于嵌进任意文本流（保留给旧调用点）。需要高亮时用 `ChemFormula` / `FormulaText`。
 */
export function formulaNodes(formula: string, charge?: number): ReactNode[] {
  return renderDecorated(formula, { charge, hovered: null, lang: 'zh' });
}

export default function ChemFormula({
  formula,
  charge,
  size = 'md',
  ariaLabel,
  className = '',
  targetSymbol,
  onElementClick,
  lang = 'zh',
}: ChemFormulaProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const targetInfo = targetSymbol ? elementBySymbol.get(targetSymbol) : undefined;
  const base = ariaLabel ?? (charge === undefined ? formula : `${formula} ${charge > 0 ? 'plus' : 'minus'} ${Math.abs(charge)}`);
  const label = targetInfo
    ? lang === 'en'
      ? `${base}; target element ${targetSymbol} (${categoryLabel(targetInfo.cat, lang)})`
      : `${base}；目标元素 ${targetSymbol}（${categoryLabel(targetInfo.cat, lang)}）`
    : base;
  const nodes = renderDecorated(formula, { charge, targetSymbol, onElementClick, hovered, lang, setHovered });

  if (onElementClick) {
    // 交互态：子元素各自是按钮，不能整块 aria-hidden，否则屏幕阅读器够不到。
    return (
      <span
        className={`mono-font tabular-nums whitespace-nowrap ${SIZE[size]} ${className}`}
        onMouseLeave={() => setHovered(null)}
      >
        {nodes}
      </span>
    );
  }

  return (
    <span
      className={`mono-font tabular-nums whitespace-nowrap ${SIZE[size]} ${className}`}
      aria-label={label}
      onMouseLeave={() => setHovered(null)}
    >
      <span aria-hidden="true">{nodes}</span>
    </span>
  );
}

/** 连续 ASCII 片段候选（字母/数字/括号/结晶水点）。 */
const FORMULA_RUN = /[A-Za-z0-9()·]+/g;
/** 合法化学式的 token 形状：元素符号 / 数字 / 括号 / 结晶水点。 */
const FORMULA_SHAPE = /^(?:[A-Z][a-z]?|\d+|[()·])+$/;

/** 判断一段连续 ASCII 是否像一个化学式（含数字/括号/结晶水点，且符号形状合法）。 */
function isFormulaLike(token: string): boolean {
  if (!/[A-Z]/.test(token)) return false; // 必须有元素符号，排除纯数字
  if (!/[0-9()·]/.test(token)) return false; // 必须有下标/括号/结晶水点，排除英文单词
  if (!FORMULA_SHAPE.test(token)) return false;
  return /^[A-Z(]/.test(token) || /^\d+[A-Z]/.test(token); // 元素/左括号开头，或「系数+元素」
}

/**
 * 内联化学式文本：把叙述里夹带的 `Fe2O3` / `(NH4)2SO4` / `SO4` 就地渲染成
 * 带规范 `<sub>` 的样式，并支持元素分类目标态/悬停微光（不渲染链接，避免与按钮嵌套）。
 * 已经是 Unicode 上下标（`Fe₂O₃`、`SO₄²⁻`）或普通中文的片段原样保留。
 */
export function FormulaText({
  text,
  className = '',
  targetSymbol,
  lang = 'zh',
}: {
  text: string;
  className?: string;
  targetSymbol?: string;
  lang?: 'zh' | 'en';
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  // 解析（正则分词 + 分类判定）只在 text / targetSymbol / lang / hovered 变化时执行：
  // 流式打字或父组件高频重渲染时 text 不变 → 直接复用上次的节点，正则零重复运行。
  const parts = useMemo<ReactNode[]>(() => {
    const acc: ReactNode[] = [];
    let last = 0;
    let key = 0;
    for (const m of text.matchAll(FORMULA_RUN)) {
      const token = m[0];
      const idx = m.index ?? 0;
      if (!isFormulaLike(token)) continue;
      if (idx > last) acc.push(text.slice(last, idx));
      acc.push(
        // 内联化学式沿用上下文字形家族（不强制 mono），让「Fe₂O₃ 中的 Fe」与中文同族、基线平滑。
        <span key={key++} className="tabular-nums whitespace-nowrap">
          {renderDecorated(token, { targetSymbol, hovered, lang, setHovered })}
        </span>,
      );
      last = idx + token.length;
    }
    if (last < text.length) acc.push(text.slice(last));
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, targetSymbol, lang, hovered]);
  return (
    <span className={className} onMouseLeave={() => setHovered(null)}>
      {parts}
    </span>
  );
}

export interface ValenceBadgeProps {
  valence: number;
  /** 中性（速查）、正确、错误三种语气；颜色仅用于练习反馈。 */
  tone?: 'neutral' | 'correct' | 'wrong';
  size?: 'sm' | 'md';
  className?: string;
}

const TONE: Record<NonNullable<ValenceBadgeProps['tone']>, string> = {
  neutral: 'border-[var(--border)] text-[var(--fg)] bg-[var(--card-bg)]',
  correct: 'border-[var(--success)] text-[var(--success)] bg-transparent',
  wrong: 'border-[var(--error)] text-[var(--error)] bg-transparent',
};

/** 化合价徽章：统一写作 +3 / −2（数字前符号，教材口径）。 */
export function ValenceBadge({ valence, tone = 'neutral', size = 'md', className = '' }: ValenceBadgeProps) {
  const text = valence > 0 ? `+${valence}` : `−${Math.abs(valence)}`;
  return (
    <span
      className={`inline-flex items-center justify-center border rounded-xs mono-font tabular-nums leading-none ${
        size === 'sm' ? 'text-[0.6875rem] px-1.5 py-0.5' : 'text-xs px-2 py-1'
      } ${TONE[tone]} ${className}`}
      aria-label={valence > 0 ? `正 ${valence} 价` : `负 ${Math.abs(valence)} 价`}
    >
      <span aria-hidden="true">{text}</span>
    </span>
  );
}
