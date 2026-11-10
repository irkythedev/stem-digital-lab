/** 统一的 BETA 微徽章：学科卡片、工具卡片、实验卡片与详情页共用。 */
export default function BetaBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center rounded border border-[var(--border)] bg-[var(--panel-bg)] px-1.5 py-0.5 font-mono text-[10px] leading-none text-[var(--muted)] ${className}`}>
      BETA
    </span>
  );
}
