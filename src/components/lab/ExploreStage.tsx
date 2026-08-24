/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 三幕式探究 · 幕 2「探索」：任务卡引导（提示而非锁定）+ 观察笔记。
 * 学生操作完全自由；关键状态可「✎ 记一条观察」保存为轨迹。
 * 快照字段由父组件以 label/value 对传入，本组件与具体实验无关。
 * 与语言无关，全部文案由父级传入。
 */
import { useState } from 'react';

export interface Observation {
  id: number;
  /** 参数快照（父组件按实验定制） */
  snapshot: { label: string; value: string }[];
  /** 可选：是否满足该实验的核心关系（供结论幕做证据统计） */
  balanced?: boolean;
  note: string;
}

export interface ExploreCard {
  key: string;
  title: string;
  prompt: string;
  /** 「试试这个」快捷设置动作（不是完成判定） */
  tryIt: () => void;
  tryLabel: string;
}

interface ExploreStageProps {
  cards: ExploreCard[];
  observations: Observation[];
  onAddObservation: (note: string) => void;
  onClearObservations: () => void;
  notePlaceholder: string;
  recordLabel: string;
  clearLabel: string;
  emptyLabel: string;
  title: string;
  /** 记录按钮禁用（如电路断开时，I=0 无记录意义） */
  recordDisabled?: boolean;
  recordDisabledHint?: string;
}

export default function ExploreStage({
  cards,
  observations,
  onAddObservation,
  onClearObservations,
  notePlaceholder,
  recordLabel,
  clearLabel,
  emptyLabel,
  title,
  recordDisabled = false,
  recordDisabledHint,
}: ExploreStageProps) {
  const [activeCard, setActiveCard] = useState(0);
  const [note, setNote] = useState('');

  const submit = () => {
    if (recordDisabled) return;
    onAddObservation(note.trim());
    setNote('');
  };

  return (
    <div className="border border-[var(--border)] p-4 space-y-4">
      <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
        // {title}
      </h3>

      {/* 任务卡：引导提问，不锁定 */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {cards.map((card, i) => (
            <button
              key={card.key}
              type="button"
              onClick={() => setActiveCard(i)}
              className={`text-xs mono-font px-2 py-1 border transition-colors ${
                i === activeCard ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-sm serif-font font-medium text-[var(--fg)]">{cards[activeCard].title}</p>
          <p className="text-xs text-[var(--muted)] serif-font leading-relaxed">{cards[activeCard].prompt}</p>
          <button
            type="button"
            onClick={cards[activeCard].tryIt}
            className="text-xs mono-font px-2 py-1 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors"
          >
            {cards[activeCard].tryLabel}
          </button>
        </div>
      </div>

      {/* 观察笔记 */}
      <div className="pt-2 border-t border-[var(--border)] space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder={notePlaceholder}
            disabled={recordDisabled}
            className="flex-1 text-xs px-2 py-1.5 border border-[var(--border)] bg-transparent text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--fg)] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={submit}
            disabled={recordDisabled}
            className="text-xs mono-font px-2 py-1 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            ✎ {recordLabel}
          </button>
        </div>
        {recordDisabled && recordDisabledHint && (
          <p className="text-xs text-[var(--muted)] serif-font italic">{recordDisabledHint}</p>
        )}

        {observations.length === 0 ? (
          <p className="text-xs text-[var(--muted)] serif-font italic">{emptyLabel}</p>
        ) : (
          <div className="max-h-[240px] overflow-y-auto space-y-2">
            {observations.map((o) => (
              <div key={o.id} className="border border-[var(--border)] p-2 space-y-1">
                <p className="text-[0.6875rem] mono-font text-[var(--muted)]">
                  {o.snapshot.map((s) => `${s.label}=${s.value}`).join(' · ')}
                </p>
                {o.note && <p className="text-xs text-[var(--fg)] serif-font">“{o.note}”</p>}
              </div>
            ))}
            <div className="pt-1">
              <button
                type="button"
                onClick={onClearObservations}
                className="text-xs mono-font underline text-[var(--muted)] hover:text-[var(--fg)]"
              >
                {clearLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
