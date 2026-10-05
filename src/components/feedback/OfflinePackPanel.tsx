/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 离线教学包面板：说清体积与内容，一键把元素照片、读音与架构图存到本机。
 * 下载中显示进度、可暂停，关掉面板下载也会继续（状态在 use-offline-pack.ts 里）。
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleCheck, Download, HardDrive, Trash2 } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { useLockBodyScroll } from '../../lib/use-lock-body-scroll';
import { formatSize } from '../../lib/offline-pack';
import { useOfflinePack } from '../../lib/use-offline-pack';

export default function OfflinePackPanel({ onClose }: { onClose: () => void }) {
  const { lang, t } = useApp();
  const c = t.offlinePack;
  const { status, progress, running, failedCount, start, stop, clear } = useOfflinePack();
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState(false);

  useLockBodyScroll(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const closeLabel = lang === 'zh' ? '关闭' : 'Close';
  /** 文案模板里的 {size} {n} 等占位替换 */
  const fill = (tpl: string, map: Record<string, string | number>) =>
    tpl.replace(/\{(\w+)\}/g, (_, key: string) => String(map[key] ?? ''));

  const groupCount = (id: string) => status?.groups.find((g) => g.id === id)?.count ?? 0;
  const totalBytes = status?.totalBytes ?? 0;
  const doneBytes = running && progress ? progress.bytes : status?.cachedBytes ?? 0;
  const doneCount = running && progress ? progress.done : status?.cachedCount ?? 0;
  const totalCount = progress?.total ?? status?.totalCount ?? 0;
  const pct = Math.round((doneBytes / Math.max(1, totalBytes)) * 100);
  const isFull = !!status?.isFull;
  const missing = Math.max(0, totalCount - doneCount);

  const lead = fill(c.lead, {
    photos: groupCount('photos'),
    audio: groupCount('audio'),
    diagrams: groupCount('diagrams'),
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={c.title}
    >
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative flex max-h-[85dvh] w-full max-w-md flex-col border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
          <h2 className="t-h2 flex items-center gap-2 font-bold tracking-widest">
            <HardDrive className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
            {c.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
            className="p-1.5 -m-1.5 text-lg leading-none text-[var(--muted)] hover:text-[var(--fg)]"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          {!status ? (
            <p className="text-xs serif-font text-[var(--muted)]">…</p>
          ) : !status.supported ? (
            <p className="text-xs serif-font leading-relaxed text-[var(--muted)]">
              {status.reason === 'insecure' ? c.insecure : c.unsupported}
            </p>
          ) : isFull ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-bold text-[var(--fg)]">
                <CircleCheck className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                {c.readyTitle}
              </p>
              <p className="text-xs serif-font leading-relaxed text-[var(--muted)]">
                {fill(c.readyLead, { size: formatSize(totalBytes) })}
              </p>
            </div>
          ) : (
            <p className="text-xs serif-font leading-relaxed text-[var(--muted)]">{lead}</p>
          )}

          {!isFull && status?.supported && (
            <p className="border-l-2 border-[var(--border)] pl-2.5 text-[0.6875rem] leading-relaxed text-[var(--muted)]">
              {c.excluded}
            </p>
          )}

          {(running || (progress && !isFull)) && (
            <div className="space-y-2">
              <div className="h-1.5 w-full bg-[var(--border)]/40">
                <div
                  className="h-full bg-[var(--accent)] transition-[width] duration-[var(--dur-base)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.6875rem] mono-font text-[var(--muted)]">
                  {fill(c.progress, {
                    done: doneCount,
                    total: totalCount,
                    bytes: formatSize(doneBytes),
                    totalBytes: formatSize(totalBytes),
                  })}
                </span>
                {running ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="shrink-0 border border-[var(--border)] px-2 py-1 text-[0.6875rem] mono-font text-[var(--muted)] transition-colors hover:border-[var(--fg)] hover:text-[var(--fg)]"
                  >
                    {c.stop}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={start}
                    className="shrink-0 border border-[var(--border)] px-2 py-1 text-[0.6875rem] mono-font text-[var(--fg)] transition-colors hover:border-[var(--fg)]"
                  >
                    {c.resume}
                  </button>
                )}
              </div>
              {failedCount > 0 && !running && (
                <p className="text-[0.6875rem] leading-relaxed text-[var(--error)]">{fill(c.partial, { n: failedCount })}</p>
              )}
            </div>
          )}

          {cleared && <p className="text-[0.6875rem] text-[var(--muted)]">{c.cleared}</p>}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
          <span className="text-[0.625rem] mono-font uppercase tracking-wider text-[var(--muted)]">
            {fill(c.sizeLabel, { size: formatSize(totalBytes) })}
          </span>
          <div className="flex items-center gap-2">
            {isFull && status?.supported && (
              <button
                type="button"
                onClick={() => {
                  if (!confirming) { setConfirming(true); return; }
                  setConfirming(false);
                  setCleared(true);
                  void clear();
                }}
                className="inline-flex items-center gap-1.5 border border-[var(--border)] px-3 py-2 text-[0.6875rem] text-[var(--muted)] transition-colors hover:border-[var(--error)] hover:text-[var(--error)] sm:px-2.5 sm:py-1.5"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {confirming ? c.clearConfirm : c.clear}
              </button>
            )}
            {!isFull && status?.supported && !running && (
              <button
                type="button"
                onClick={start}
                className="tap-primary inline-flex items-center gap-1.5 border border-[var(--border)] px-4 py-2.5 text-xs font-bold text-[var(--fg)] transition-colors hover:border-[var(--fg)] sm:px-3 sm:py-1.5"
              >
                <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {c.start}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
