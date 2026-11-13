/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 版本历史面板：点击 Header 版本号弹出，展示面向用户的更新记录。
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { HardDrive, CircleCheck, ChevronDown } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import OfflinePackPanel from './OfflinePackPanel';
import { useOfflinePack } from '../../lib/use-offline-pack';
import { CHANGELOG } from '../../lib/changelog';
import { useEscapeKey } from '../../lib/use-escape-key';
import { useFocusReturn } from '../../lib/use-focus-return';

interface VersionDialogProps {
  onClose: () => void;
  /** 从欢迎弹窗里打开：整层抬到宿主卡片之上，否则面板被宿主卡片（z-modal）盖住 */
  elevated?: boolean;
  /** 当前有新版时，在版本历史顶部提供直接更新入口 */
  hasUpdate?: boolean;
  updateBusy?: boolean;
  onUpdate?: () => void;
}

const CHECK_ICON = <CircleCheck className="inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em] text-[var(--success)]" aria-hidden="true" />;

export default function VersionDialog({ onClose, elevated = false, hasUpdate = false, updateBusy = false, onUpdate }: VersionDialogProps) {
  useEscapeKey(onClose);
  useFocusReturn(); // 关掉后焦点回到版本号按钮
  const { lang, t } = useApp();
  const { status: packStatus } = useOfflinePack();
  const [showPack, setShowPack] = useState(false);
  const closeLabel = lang === 'zh' ? '关闭' : 'Close';
  const title = t.changelogTitle;
  const recentEntries = CHANGELOG.slice(0, 3);
  const olderEntries = CHANGELOG.slice(3);

  /** 每一条日志：左侧微标签与右侧首行汉字锁定同一基线。 */
  const tagClass = (tag: string): string =>
    `lab-tag-micro inline-flex shrink-0 items-center justify-center rounded border px-1.5 py-0.5 text-[11px] font-normal leading-none bg-[var(--panel-bg)]/50 ${
      /修复|fix/i.test(tag)
        ? 'border-[var(--fg)]/25 text-[var(--fg)]'
        : 'border-[var(--border)] text-[var(--muted)]'
    }`;

  /** 最新版本为 Featured Card，历史条目保持轻量时间轴。 */
  const renderEntry = (entry: (typeof CHANGELOG)[number], featured = false, showDivider = true) => (
    <div
      key={entry.version}
      className={featured
        ? 'version-latest-card rounded-lg border border-[var(--border)] bg-[var(--panel-bg)]/30 p-3.5'
        : `px-1 ${showDivider ? 'border-t border-[var(--border)]/60' : ''} pt-3.5 opacity-80 transition-opacity hover:opacity-100`}
    >
      <div className="mb-2 flex items-baseline gap-2.5">
        <span className="text-xs font-bold mono-font text-[var(--fg)]">v{entry.version}</span>
        <span className="text-[0.625rem] mono-font text-[var(--muted)]">{entry.date}</span>
        {featured && (
          <span className="ml-auto rounded bg-[var(--fg)] px-2 py-0.5 text-[11px] font-medium text-[var(--card-bg)]">
            {lang === 'zh' ? '最新' : 'LATEST'}
          </span>
        )}
      </div>
      <ul className={featured ? 'space-y-2' : 'space-y-1'}>
        {(lang === 'zh' ? entry.zh : entry.en).map((line, i) => {
          const m = line.match(/^\[([^\]]+)\]\s*(.*)$/);
          const tag = m?.[1] ?? '';
          return (
            <li key={i} className="flex items-baseline gap-2.5 text-xs leading-5">
              {tag ? <span className={tagClass(tag)}>{tag}</span> : null}
              <span className={`min-w-0 leading-5 ${featured ? 'text-xs text-[var(--fg)]' : 'text-xs text-[var(--muted)]'}`}>
                {m ? m[2] : line}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return createPortal(
    /* 拦截层与面板必须处在同一个层叠上下文里才能保证「面板在遮罩之上」。
       平时包一层 `relative`（z-index:auto，不建上下文，行为与直接挂 body 一致）；
       从欢迎弹窗打开时再加 `z-modal-top`：建上下文并整体抬到宿主卡片之上。 */
    <div className={`relative ${elevated ? 'z-modal-top' : ''}`}>
      {/* 点外关闭：透明拦截层低于卡片（dropdown < tooltip），不会盖住弹层本身 */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={closeLabel}
        onClick={onClose}
        className="fixed inset-0 z-dropdown cursor-default bg-transparent"
      />
      <div
        className="fixed top-16 right-4 sm:right-6 z-tooltip w-[calc(100vw-2rem)] max-w-sm border border-[var(--border)] bg-[var(--card-bg)] p-4 text-[var(--fg)] shadow-2xl"
        role="dialog" aria-modal="true"
        aria-label="version"
      >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="t-h2 flex items-center gap-2 font-bold tracking-widest text-[var(--fg)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[var(--accent)]" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label={closeLabel} title={closeLabel} className="lab-control-28 h-7 w-7 rounded-md inline-flex items-center justify-center shrink-0 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] ghost-x transition-colors text-lg leading-none">×</button>
        </div>
        {hasUpdate && onUpdate && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--accent)]/50 bg-[var(--accent-light)]/60 px-2.5 py-2 text-[0.6875rem] text-[var(--fg)]">
            <span>{lang === 'zh' ? '有新版本可用，建议立即更新' : 'A new version is available — update now'}</span>
            <button
              type="button"
              disabled={updateBusy}
              onClick={onUpdate}
              className="shrink-0 rounded border border-[var(--accent)] px-2 py-1 mono-font text-[0.625rem] text-[var(--accent)] transition-colors hover:bg-[var(--card-bg)] disabled:cursor-progress disabled:opacity-60"
            >
              {updateBusy ? (lang === 'zh' ? '更新中…' : 'Updating…') : (lang === 'zh' ? '立即更新' : 'Update now')}
            </button>
          </div>
        )}

        {/* 离线教学包入口：放在更新日志上方，属于「应用级」设置 */}
        <button
          type="button"
          onClick={() => setShowPack(true)}
          title={t.offlinePack.entryHint}
          className="flex w-full items-center gap-2 border border-[var(--border)] px-2.5 py-2 text-[0.6875rem] text-[var(--muted)] transition-colors hover:border-[var(--fg)] hover:text-[var(--fg)]"
        >
          <HardDrive className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-left">{t.offlinePack.entry}</span>
          <span className="mono-font shrink-0">
            {packStatus && !packStatus.supported
              ? '—'
              : packStatus?.isFull
                ? CHECK_ICON
                : `${packStatus?.cachedCount ?? 0}/${packStatus?.totalCount ?? 0}`}
          </span>
        </button>
        {showPack && <OfflinePackPanel onClose={() => setShowPack(false)} elevated={elevated} />}

        <div className="space-y-3 max-h-[60dvh] overflow-y-auto pr-0.5">
          {recentEntries.map((entry, i) => renderEntry(entry, i === 0, i !== 1))}
          {olderEntries.length > 0 && (
            <details className="group border-t border-[var(--border)] pt-3">
              <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 text-[0.6875rem] mono-font text-[var(--muted)] transition-colors hover:text-[var(--fg)]">
                <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                <span>{lang === 'zh' ? `查看更早版本（${olderEntries.length}）` : `Older versions (${olderEntries.length})`}</span>
              </summary>
              <div className="mt-2 space-y-3">
                {olderEntries.map((entry) => renderEntry(entry))}
              </div>
            </details>
          )}
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
}
