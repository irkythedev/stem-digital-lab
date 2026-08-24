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
    <div className="border border-[var(--border)] p-4">
      {title && (
        <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-3">
          // {title}
        </h3>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-baseline justify-between gap-2">
            <dt className="text-[0.6875rem] text-[var(--muted)] mono-font">{m.label}</dt>
            <dd
              className={`text-[0.8125rem] mono-font ${
                m.highlight ? 'font-bold text-[var(--fg)]' : 'text-[var(--fg)]'
              }`}
            >
              {m.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
