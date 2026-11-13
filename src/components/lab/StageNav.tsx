/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 三幕式探究步骤条（Predict → Explore → Conclude）
 * 32px 一体化工程步进条：左侧三阶段为主视觉，右侧「下一步」为内嵌次级动作。
 */

import { Check, RotateCcw } from 'lucide-react';

export type Stage = 'predict' | 'explore' | 'conclude';

interface StageNavProps {
  stage: Stage;
  setStage: (stage: Stage) => void;
  stageOrder?: Stage[];
  labels: {
    predict: string;
    explore: string;
    conclude: string;
    /** 下一步文案：必填，避免漏传时静默显示英文 */
    next: string;
    redo?: string;
  };
  onNext?: () => void;
  onRedo?: () => void;
  isDone?: {
    predict?: boolean;
    explore?: boolean;
    conclude?: boolean;
  };
  className?: string;
}

export default function StageNav({
  stage,
  setStage,
  stageOrder = ['predict', 'explore', 'conclude'],
  labels,
  onNext,
  onRedo,
  isDone,
}: StageNavProps) {
  const stageIdx = stageOrder.indexOf(stage);
  const getLabel = (s: Stage) => labels[s];

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else if (stageIdx < stageOrder.length - 1) {
      setStage(stageOrder[stageIdx + 1]);
    }
  };

  return (
    <div
      data-stage-nav="true"
      data-legacy-height="min-h-[34px]"
      className={`stage-shell inline-flex h-8 w-fit max-w-full select-none items-center rounded-lg border border-[var(--border)] bg-[var(--panel-bg)]/70 p-0.5 text-xs max-sm:flex max-sm:w-full`}
    >
      <div className="stage-rail flex min-w-0 flex-1 items-center gap-0.5 sm:gap-1">
        {stageOrder.map((s, i) => {
          const active = stage === s;
          const done = isDone ? isDone[s] : false;
          const text = getLabel(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              aria-current={active ? 'step' : undefined}
              className={`compact lab-control-28 inline-flex h-7 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-[6px] px-1.5 font-medium transition-all touch-manipulation sm:flex-none sm:px-3 ${
                active
                  ? 'bg-[var(--fg)] text-[var(--card-bg)] shadow-2xs'
                  : 'bg-transparent text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              <span className="font-mono text-[10px] opacity-65">{i + 1}</span>
              {done && !active ? <Check className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
              <span className="truncate">{text}</span>
            </button>
          );
        })}
      </div>

      <span className="mx-0.5 h-4 w-px shrink-0 bg-[var(--border)]" aria-hidden="true" />

      <div className="stage-act flex shrink-0 items-center">
        <button
          type="button"
          onClick={handleNext}
          disabled={stageIdx >= stageOrder.length - 1}
          className={`compact lab-control-28 inline-flex h-7 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-[6px] px-2.5 text-xs font-medium transition-colors ${
            stageIdx >= stageOrder.length - 1
              ? 'pointer-events-none text-[var(--muted)] opacity-35'
              : 'text-[var(--muted)] hover:bg-[var(--card-bg)] hover:text-[var(--fg)]'
          }`}
        >
          {labels.next}
        </button>
      </div>
      {/* 兼容既有 onRedo API：结论阶段的重做入口仍保留给实验内部使用；此条不增加视觉高度。 */}
      {onRedo && stageIdx >= stageOrder.length - 1 ? (
        <button
          type="button"
          onClick={onRedo}
          title={labels.redo}
          aria-label={labels.redo}
          className="compact lab-control-28 ml-0.5 hidden h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-[var(--muted)] transition-colors hover:bg-[var(--card-bg)] hover:text-[var(--fg)] sm:inline-flex"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
