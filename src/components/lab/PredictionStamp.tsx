/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 「预测 vs 实测」认知印章（内嵌版）：标准流卡片，放在实验右侧控制栏最顶部。
 * 纸墨细框，不使用 fixed 浮层；数据由宿主实验传入，关闭与追问由宿主处理。
 */
import { Check } from 'lucide-react';

interface PredictionStampProps {
  correct: boolean;
  summary?: string;
  lang: 'zh' | 'en';
  onAsk: () => void;
  onClose: () => void;
}

export default function PredictionStamp({ correct, summary, lang, onAsk, onClose }: PredictionStampProps) {
  const zh = lang === 'zh';
  return (
    <div className="rounded-lg border border-[var(--fg)]/25 bg-[var(--panel-bg)]/50 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 mono-font text-[var(--fg)]">
          <span aria-hidden="true">// </span>
          {correct
            ? (zh ? <>预测验证：与实测完全吻合 <Check className="inline-block h-3 w-3 align-[-0.15em]" aria-hidden="true" /></> : <>Prediction confirmed: matches the measurement <Check className="inline-block h-3 w-3 align-[-0.15em]" aria-hidden="true" /></>)
            : (zh ? '认知冲突：实测结果与预测存在差异' : 'Cognitive conflict: the measurement differs from your prediction')}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={zh ? '关闭预测印章' : 'Close prediction stamp'}
          className="shrink-0 rounded p-0.5 text-[var(--muted)] hover:text-[var(--fg)]"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {summary ? (
        <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--muted)] mono-font">{summary}</p>
      ) : null}
      {!correct ? (
        <button
          type="button"
          onClick={onAsk}
          className="mt-2 inline-flex items-center gap-1 font-medium text-[var(--fg)] underline underline-offset-4 hover:opacity-75"
        >
          {zh ? '追问 AI 为什么 →' : 'Ask AI why →'}
        </button>
      ) : null}
    </div>
  );
}
