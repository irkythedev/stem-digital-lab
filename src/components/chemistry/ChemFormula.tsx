/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学式排版组件：元素符号正文 + 原子个数下标 + 离子电荷上标。
 *
 * 只使用 CSS 变量与项目既有字体类，不写死颜色；数字统一 tabular-nums，
 * 避免 H₂O 与 H₂O₂ 在切换时横向跳动。aria-label 传可朗读的化学名，
 * 屏幕阅读器不会逐个念下标。
 */
import type { ReactNode } from 'react';

export interface ChemFormulaProps {
  formula: string;
  /** 离子电荷，如 SO4²⁻ 传 −2；不传则不画上标。 */
  charge?: number;
  /** 字号档位。 */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** 屏幕阅读器朗读文本；缺省时用化学式本身。 */
  ariaLabel?: string;
  className?: string;
}

const SIZE: Record<NonNullable<ChemFormulaProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-3xl',
};

function tokens(formula: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /([A-Z][a-z]?)|(\d+)|([()·])/g;
  let last = 0;
  let key = 0;
  for (const match of formula.matchAll(re)) {
    if (match.index === undefined) continue;
    if (match.index > last) out.push(formula.slice(last, match.index));
    const [raw, symbol, digit, punct] = match;
    if (symbol || punct) out.push(<span key={key++}>{raw}</span>);
    else if (digit) {
      out.push(
        <sub key={key++} className="text-[0.7em] leading-none align-baseline relative -bottom-[0.12em]">
          {digit}
        </sub>,
      );
    }
    last = match.index + raw.length;
  }
  if (last < formula.length) out.push(formula.slice(last));
  return out;
}

export default function ChemFormula({
  formula,
  charge,
  size = 'md',
  ariaLabel,
  className = '',
}: ChemFormulaProps) {
  const chargeText =
    charge === undefined
      ? ''
      : `${Math.abs(charge) === 1 ? '' : Math.abs(charge)}${charge > 0 ? '+' : '−'}`;

  return (
    <span
      className={`mono-font tabular-nums whitespace-nowrap ${SIZE[size]} ${className}`}
      aria-label={ariaLabel ?? (charge === undefined ? formula : `${formula} ${charge > 0 ? 'plus' : 'minus'} ${Math.abs(charge)}`)}
    >
      <span aria-hidden="true">
        {tokens(formula)}
        {charge !== undefined && (
          <sup className="text-[0.65em] leading-none align-super relative -top-[0.25em] ml-[0.05em]">
            {chargeText}
          </sup>
        )}
      </span>
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
