/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 三幕式探究 · 幕 1「预测」：学生先对 a²+b² 与 c² 的关系作出猜想。
 * 不判对错，只记录猜想；探索阶段会实时对照「猜想 vs 现实」。
 */
export type Prediction = 'eq' | 'gt' | 'lt' | 'unsure';

interface PredictStageProps {
  prediction: Prediction | null;
  onPredict: (p: Prediction) => void;
  labels: {
    title: string;
    question: string;
    eq: string;
    gt: string;
    lt: string;
    unsure: string;
    done: string;
    hint: string;
  };
}

export default function PredictStage({ prediction, onPredict, labels }: PredictStageProps) {
  const options: { value: Prediction; label: string }[] = [
    { value: 'eq', label: labels.eq },
    { value: 'gt', label: labels.gt },
    { value: 'lt', label: labels.lt },
    { value: 'unsure', label: labels.unsure },
  ];

  return (
    <div className="border border-[var(--border)] p-4 space-y-4 rounded-sm">
      <h3 className="text-xs 2xl:text-sm font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
        // {labels.title}
      </h3>
      <p className="text-sm 2xl:text-base serif-font leading-relaxed text-[var(--fg)]">{labels.question}</p>

      <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label={labels.question}>
        {options.map((opt) => {
          const isSel = prediction === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSel}
              onClick={() => onPredict(opt.value)}
              className={`min-h-[44px] text-left text-sm 2xl:text-base px-3.5 py-2.5 border transition-all rounded-sm flex items-center justify-between touch-manipulation active:scale-[0.99] ${
                isSel
                  ? 'border-[var(--fg)] bg-[var(--accent-light)] text-[var(--fg)] font-medium shadow-xs'
                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
              }`}
            >
              <span>{opt.label}</span>
              {isSel && <span className="text-xs mono-font font-bold">●</span>}
            </button>
          );
        })}
      </div>

      {prediction ? (
        <p className="text-xs 2xl:text-sm mono-font text-[var(--fg)] font-medium">✓ {labels.done}</p>
      ) : (
        <p className="text-xs 2xl:text-sm text-[var(--muted)] serif-font italic">{labels.hint}</p>
      )}
    </div>
  );
}
