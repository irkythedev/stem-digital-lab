/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 通用读数区：一组 (label, value) 指标，可选高亮。
 * 与语言无关，文案由父级解析后传入。
 */
export interface Metric {
  label: string;
  value: string;
  highlight?: boolean;
}

interface ReadoutProps {
  title?: string;
  metrics: Metric[];
}

export default function Readout({ title, metrics }: ReadoutProps) {
  return (
    <div className="border border-[var(--border)]/80 bg-[var(--card-bg)] p-4 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      {title && (
        <h3 className="text-xs 2xl:text-sm font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-3">
          // {title}
        </h3>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {metrics.map((m) => {
          // 分离数值与单位（如 "12.5 V"、"0.60A"、"10Ω"、"100%" 等）
          const match = typeof m.value === 'string' ? m.value.match(/^([+-]?\d+(?:\.\d+)?)\s*([a-zA-ZΩμ%/°]+.*)?$/) : null;

          return (
            <div key={m.label} className="flex items-baseline justify-between gap-2">
              <dt className="text-xs 2xl:text-sm text-[var(--muted)] mono-font">{m.label}</dt>
              <dd
                className={`text-sm 2xl:text-base mono-font tabular-nums ${
                  m.highlight
                    ? 'font-bold text-[var(--fg)] bg-[var(--accent-light)] px-1.5 py-0.5 rounded-md'
                    : 'font-medium text-[var(--fg)]'
                }`}
              >
                {match ? (
                  <>
                    <span className="font-semibold">{match[1]}</span>
                    {match[2] && <span className="text-[0.6875rem] opacity-70 ml-0.5">{match[2]}</span>}
                  </>
                ) : (
                  m.value
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
