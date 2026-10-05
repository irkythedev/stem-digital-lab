/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 版本历史面板：点击 Header 版本号弹出，展示面向用户的更新记录。
 */
import { useState } from 'react';
import { HardDrive } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import OfflinePackPanel from './OfflinePackPanel';
import { useOfflinePack } from '../../lib/use-offline-pack';
import { CHANGELOG } from '../../lib/changelog';

interface VersionDialogProps {
  onClose: () => void;
}

export default function VersionDialog({ onClose }: VersionDialogProps) {
  const { lang, t } = useApp();
  const { status: packStatus } = useOfflinePack();
  const [showPack, setShowPack] = useState(false);
  const closeLabel = lang === 'zh' ? '关闭' : 'Close';
  const title = t.changelogTitle;
  return (
    <div
      className="fixed top-16 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm border border-[var(--border)] bg-[var(--bg)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
      role="dialog"
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
          <button type="button" onClick={onClose} aria-label={closeLabel} title={closeLabel} className="p-1.5 -m-1.5 text-lg leading-none text-[var(--muted)] hover:text-[var(--fg)]">×</button>
        </div>
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
                ? '✓'
                : `${packStatus?.cachedCount ?? 0}/${packStatus?.totalCount ?? 0}`}
          </span>
        </button>
        {showPack && <OfflinePackPanel onClose={() => setShowPack(false)} />}

        <div className="space-y-4 max-h-[50vh] overflow-y-auto">
          {CHANGELOG.map((entry) => (
            <div key={entry.version} className="border-t border-[var(--border)] pt-3">
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-xs font-bold mono-font text-[var(--fg)]">v{entry.version}</span>
                <span className="text-[0.625rem] mono-font text-[var(--muted)]">{entry.date}</span>
              </div>
              <ul className="space-y-1">
                {(lang === 'zh' ? entry.zh : entry.en).map((line, i) => {
                  // 前缀标签（[新增]/[优化]/[修复]）加粗显示
                  const m = line.match(/^(\[[^\]]+\])\s*(.*)$/);
                  return (
                    <li key={i} className="flex gap-2 text-xs serif-font leading-relaxed text-[var(--muted)]">
                      <span className="text-[var(--border)] shrink-0">•</span>
                      <span>
                        {m ? (
                          <>
                            <strong className="text-[var(--fg)] font-bold">{m[1]}</strong>{' '}
                            {m[2]}
                          </>
                        ) : (
                          line
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
