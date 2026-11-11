/**
 * 几何实验的满铺画布协议。
 *
 * 只统一「工作台视觉 + 工具栏 + 画布外框 + 底栏 + 演示条」，
 * 不接管各实验自己的 SVG 几何内核。Congruence / Similarity 先作为样板接入。
 */
import { useId, type ReactNode } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';

export interface CanvasToolbarProps {
  titleSlot?: ReactNode;
  actionsSlot?: ReactNode;
  className?: string;
}

export function CanvasToolbar({ titleSlot, actionsSlot, className = '' }: CanvasToolbarProps) {
  return (
    <div data-canvas-toolbar="true" className={`flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b border-[var(--border)] px-2.5 py-1.5 text-xs mono-font sm:h-9 sm:flex-nowrap sm:gap-2 sm:px-3 sm:py-0 ${className}`}>
      <div className="flex w-full min-w-0 items-center gap-2 truncate text-[var(--fg)] sm:w-auto sm:flex-1">{titleSlot}</div>
      <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:shrink-0 sm:flex-nowrap">{actionsSlot}</div>
    </div>
  );
}

export interface CanvasZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  labels?: { zoomIn?: string; zoomOut?: string; reset?: string };
}

export function CanvasZoomControls({ onZoomIn, onZoomOut, onReset, labels }: CanvasZoomControlsProps) {
  const btn = 'compact inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--border)] bg-[var(--card-bg)] text-[var(--muted)] transition-colors hover:border-[var(--fg)] hover:text-[var(--fg)] active:bg-[var(--accent-light)]';
  return (
    <div className="inline-flex shrink-0 items-center gap-1" aria-label={labels?.zoomIn || 'zoom'}>
      <button type="button" className={btn} aria-label={labels?.zoomOut || '缩小'} onClick={onZoomOut}>
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button type="button" className={btn} aria-label={labels?.zoomIn || '放大'} onClick={onZoomIn}>
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button type="button" className={btn} aria-label={labels?.reset || '重置视口'} onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export interface CanvasFooterBarProps { children: ReactNode; className?: string; }
export function CanvasFooterBar({ children, className = '' }: CanvasFooterBarProps) {
  return <div className={`shrink-0 border-t border-[var(--border)] px-3 py-2 ${className}`}>{children}</div>;
}

export interface CanvasSurfaceProps {
  titleSlot?: ReactNode;
  actionsSlot?: ReactNode;
  children: ReactNode;
  footerBar?: ReactNode;
  /** 播放态 DemoHud，干净嵌入底部状态带 */
  hud?: ReactNode;
  active?: boolean;
  /** 画布底纹：工程细方格 / 点阵 / 关闭 */
  background?: 'grid' | 'dots' | 'none';
  showToolbar?: boolean;
  className?: string;
}

export default function CanvasSurface({
  titleSlot,
  actionsSlot,
  children,
  footerBar,
  hud,
  active = false,
  background = 'grid',
  showToolbar = true,
  className = '',
}: CanvasSurfaceProps) {
  const reactId = useId();
  const patternId = `canvas-surface-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <div className={`flex h-full min-h-[500px] w-full flex-1 flex-col overflow-hidden bg-[var(--card-bg)] max-sm:min-h-[440px] max-sm:max-h-[65dvh] lg:min-h-0 ${className}`}>
      {showToolbar ? <CanvasToolbar titleSlot={titleSlot} actionsSlot={actionsSlot} /> : null}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {background !== 'none' && (
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
            <defs>
              {background === 'grid' ? (
                <pattern id={patternId} width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M 24 0 H 0 V 24" fill="none" stroke="var(--border)" strokeOpacity="0.5" strokeWidth="0.8" />
                </pattern>
              ) : (
                <pattern id={patternId} width="22" height="22" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="0.8" fill="var(--border)" fillOpacity="0.75" />
                </pattern>
              )}
            </defs>
            <rect width="100%" height="100%" fill={`url(#${patternId})`} />
          </svg>
        )}
        <div className="absolute inset-0 touch-none">{children}</div>
      </div>
      {active && hud ? <div className="shrink-0 border-t border-[var(--border)] px-3 py-2">{hud}</div> : null}
      {footerBar ? <CanvasFooterBar>{footerBar}</CanvasFooterBar> : null}
    </div>
  );
}
