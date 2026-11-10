/**
 * 纸墨工程铭牌开关：Beta 实验预览的唯一入口。
 * 与卡片上的 [C++] / [查表] 使用同一微圆角标签语言。
 */
interface BetaToggleChipProps {
  showBeta: boolean;
  onChange: (next: boolean) => void;
  count: number;
  lang: 'zh' | 'en';
  className?: string;
}

export default function BetaToggleChip({ showBeta, onChange, count, lang, className = '' }: BetaToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={showBeta}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!showBeta);
      }}
      className={`h-7 px-2.5 rounded-md font-mono text-xs inline-flex items-center gap-2 cursor-pointer select-none transition-all ${
        showBeta
          ? 'border border-solid border-[var(--fg)] bg-[var(--panel-bg)] text-[var(--fg)] shadow-2xs'
          : 'border border-dashed border-[var(--border)] bg-transparent text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--fg)]'
      } ${className}`}
    >
      <span
        className={`px-1 py-0.5 text-[10px] leading-none rounded ${
          showBeta
            ? 'bg-[var(--fg)] text-[var(--card-bg)] font-semibold border border-transparent'
            : 'bg-[var(--panel-bg)] border border-[var(--border)] text-[var(--fg)]'
        }`}
      >
        BETA
      </span>
      <span>{lang === 'zh' ? (showBeta ? `实验已开启 (${count})` : `+${count} 实验`) : showBeta ? `Enabled (${count})` : `+${count} Labs`}</span>
      <span
        className={`w-1.5 h-1.5 rounded-full ${showBeta ? 'bg-[var(--fg)]' : 'border border-current opacity-60'}`}
        aria-hidden="true"
      />
    </button>
  );
}
