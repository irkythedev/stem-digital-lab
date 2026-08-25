/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 三幕式探究步骤条（Predict → Explore → Conclude）
 * iOS Segmented Control 风格胶囊组件：浅底托 + 激活白卡微投影 + 触控安全。
 */

import { RotateCcw } from 'lucide-react';

export type Stage = 'predict' | 'explore' | 'conclude';

interface StageNavProps {
  stage: Stage;
  setStage: (stage: Stage) => void;
  stageOrder?: Stage[];
  labels: {
    predict: string;
    explore: string;
    conclude: string;
    next?: string;
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
  className = '',
}: StageNavProps) {
  const stageIdx = stageOrder.indexOf(stage);

  const getLabel = (s: Stage) => {
    switch (s) {
      case 'predict':
        return labels.predict;
      case 'explore':
        return labels.explore;
      case 'conclude':
        return labels.conclude;
    }
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else if (stageIdx < stageOrder.length - 1) {
      setStage(stageOrder[stageIdx + 1]);
    }
  };

  return (
    <div className={`flex flex-wrap sm:flex-nowrap items-center gap-2.5 text-xs 2xl:text-sm mono-font tracking-wider ${className}`}>
      {/* iOS Segmented 胶囊外壳 */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--accent-light)] border border-[var(--border)]/70 shadow-xs">
        {stageOrder.map((s) => {
          const active = stage === s;
          const done = isDone ? isDone[s] : false;
          const text = getLabel(s);

          return (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              className={`min-h-[34px] px-3.5 py-1 rounded-lg font-medium transition-all duration-150 touch-manipulation select-none whitespace-nowrap ${
                active
                  ? 'bg-[var(--card-bg)] text-[var(--fg)] shadow-xs font-semibold'
                  : done
                  ? 'text-[var(--fg)] hover:text-[var(--fg)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {done && !active ? `✓ ${text}` : text}
            </button>
          );
        })}
      </div>

      {/* 右侧下一步 / 重置操作 */}
      <div className="ml-auto flex gap-2">
        {stageIdx < stageOrder.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="min-h-[36px] px-4 py-1.5 border border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 transition-all rounded-lg font-medium touch-manipulation select-none active:scale-95 shadow-xs whitespace-nowrap"
          >
            {labels.next || 'Next →'}
          </button>
        ) : onRedo ? (
          <button
            type="button"
            onClick={onRedo}
            className="group inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 border border-[var(--border)]/80 text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] transition-all rounded-lg touch-manipulation select-none active:scale-95 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 opacity-70 group-hover:rotate-[-45deg] transition-transform duration-200" />
            <span>{labels.redo || 'Redo'}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
