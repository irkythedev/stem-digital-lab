/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 三幕式探究 · 幕 3「结论」：学生自拟结论，系统对照「他的猜想 + 他的观察记录」，
 * 给出基于证据的反馈，而不是灌输标准答案。
 */
import type { Prediction } from './PredictStage';
import type { Observation } from './ExploreStage';

export type Conclusion = 'eq' | 'neq' | 'unsure';

interface ConclusionStageProps {
  prediction: Prediction | null;
  observations: Observation[];
  conclusion: Conclusion | null;
  onConclude: (c: Conclusion) => void;
  labels: {
    title: string;
    question: string;
    eq: string;
    neq: string;
    unsure: string;
    submit: string;
    feedbackTitle: string;
    feedbackText: string;
    predictionTitle: string;
    predictionEq: string;
    predictionGt: string;
    predictionLt: string;
    predictionUnsure: string;
    evidenceTitle: string;
    evidenceRight: string;
    evidenceWrong: string;
    evidenceNone: string;
  };
}

export default function ConclusionStage({
  prediction,
  observations,
  conclusion,
  onConclude,
  labels,
}: ConclusionStageProps) {
  const options: { value: Conclusion; label: string }[] = [
    { value: 'eq', label: labels.eq },
    { value: 'neq', label: labels.neq },
    { value: 'unsure', label: labels.unsure },
  ];

  const rightObs = observations.filter((o) => o.balanced);
  const wrongObs = observations.filter((o) => !o.balanced);

  return (
    <div className="border border-[var(--border)] p-4 space-y-4">
      <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
        // {labels.title}
      </h3>
      <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{labels.question}</p>

      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={labels.question}>
        {options.map((opt) => {
          const isSel = conclusion === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSel}
              onClick={() => onConclude(opt.value)}
              className={`text-left text-sm px-3 py-2 border transition-colors ${
                isSel ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {conclusion && (
        <div className="border-l-2 border-[var(--fg)] pl-3 space-y-3">
          {/* 对照：学生的猜想 */}
          <div>
            <p className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
              {labels.predictionTitle}
            </p>
            <p className="text-xs text-[var(--fg)] serif-font">
              {prediction === 'eq' && labels.predictionEq}
              {prediction === 'gt' && labels.predictionGt}
              {prediction === 'lt' && labels.predictionLt}
              {prediction === 'unsure' && labels.predictionUnsure}
              {prediction === null && '—'}
            </p>
          </div>

          {/* 对照：学生的观察记录（证据） */}
          <div>
            <p className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
              {labels.evidenceTitle}
            </p>
            {observations.length === 0 ? (
              <p className="text-xs text-[var(--muted)] serif-font italic">{labels.evidenceNone}</p>
            ) : (
              <div className="space-y-1">
                {rightObs.length > 0 && (
                  <p className="text-xs text-[var(--fg)] serif-font">
                    ✓ {rightObs.length} {labels.evidenceRight}
                  </p>
                )}
                {wrongObs.length > 0 && (
                  <p className="text-xs text-[var(--muted)] serif-font">
                    ✗ {wrongObs.length} {labels.evidenceWrong}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 反馈 */}
          <div>
            <p className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
              {labels.feedbackTitle}
            </p>
            <p className="text-xs text-[var(--fg)] serif-font leading-relaxed">{labels.feedbackText}</p>
          </div>
        </div>
      )}
    </div>
  );
}
