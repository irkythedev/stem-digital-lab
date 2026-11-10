/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 自动演示控制条（DemoHud）。
 *
 * 位置约定：由 CanvasDemoDock 放在「画布卡内部、SVG 之后」。
 * **不用 fixed / sticky**，避免和 ParamDock 的底部胶囊抢位。
 *
 * 触控：所有按钮 40×40；进度条只做视觉，caption 用 aria-live 播报。
 * 颜色只用 CSS 变量；不引入任何第三方动画库。
 */
import type { ReactNode } from 'react';
import { Pause, Play, ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface DemoHudLabels {
  title: string;
  play: string;
  pause: string;
  prev: string;
  next: string;
  speed: string;
  exit: string;
  takeover: string;
  auto: string;
  step: string;
}

export interface DemoHudProps {
  active: boolean;
  playing: boolean;
  index: number;
  total: number;
  progress: number;
  speed: number;
  caption: string;
  labels: DemoHudLabels;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSpeed: () => void;
  onExit: () => void;
  onTakeover: () => void;
  mode: 'auto' | 'step';
  onMode: () => void;
}

export const DEMO_HUD_COPY: Record<'zh' | 'en', DemoHudLabels> = {
  zh: {
    title: '自动演示',
    play: '播放',
    pause: '暂停',
    prev: '上一步',
    next: '下一步',
    speed: '切换速度',
    exit: '退出演示',
    takeover: '我来试试',
    auto: '连播',
    step: '步进',
  },
  en: {
    title: 'Auto demo',
    play: 'Play',
    pause: 'Pause',
    prev: 'Previous step',
    next: 'Next step',
    speed: 'Change speed',
    exit: 'Exit demo',
    takeover: 'Let me try',
    auto: 'Auto',
    step: 'Step',
  },
};

export interface CanvasDemoDockProps {
  active: boolean;
  idleLabel: string;
  onStart: () => void;
  children: ReactNode;
  hud: ReactNode;
  /** 兼容旧调用；已废弃 absolute corner，idle 永远进入底栏 */
  idlePlacement?: 'overlay' | 'footer';
  /** 画布专属顶栏（工具栏/标题）；位于 SVG 之上，绝不覆盖画布 */
  topBar?: ReactNode;
  /** 画布最大高度；Construction 样板用更高的工作台，其他几何保持默认 */
  maxHeightClass?: string;
  /** 与 viewBox 匹配的宽高比类，避免宽卡片产生 letterbox 死区 */
  aspectClass?: string;
  /** 画布卡底部状态条（与画布共用同一外框，不另开卡） */
  bottomBar?: ReactNode;
}

/**
 * 画布卡统一容器：上方是高度锁死的画布插槽，下方是固定 88px Gutter。
 * 未播放只显示右侧 40px 胶囊；播放中原地换成 DemoHud，Gutter 高度不变，避免页面抖动。
 * 严禁 fixed：它必须和 ParamDock 的底部胶囊保持物理隔离。
 */
export function CanvasDemoDock({
  active,
  idleLabel,
  onStart,
  children,
  hud,
  maxHeightClass = 'max-h-[min(39vh,380px)]',
  aspectClass,
  topBar,
  bottomBar,
}: CanvasDemoDockProps) {
  const idleClass =
    'inline-flex min-h-[40px] min-w-[40px] items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card-bg)]/92 px-3 text-[0.6875rem] mono-font text-[var(--fg)] shadow-[var(--elev-md)] backdrop-blur-md transition-colors active:bg-[var(--accent-light)]';
  const idleButton = (
    <button type="button" onClick={onStart} className={idleClass}>
      <Play className="h-3.5 w-3.5" aria-hidden="true" />
      {idleLabel}
    </button>
  );
  return (
    <div className="relative min-w-0 overflow-hidden border border-[var(--border)] bg-[var(--card-bg)]">
      {topBar ? (
        <div className="flex min-h-[48px] items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
          {topBar}
        </div>
      ) : null}
      <div className={`mx-auto w-full ${aspectClass ?? ''} ${maxHeightClass}`}>{children}</div>
      {active ? <div className="border-t border-[var(--border)] px-3 py-2">{hud}</div> : null}
      {!active && !bottomBar ? (
        <div className="flex min-h-[48px] items-center justify-end border-t border-[var(--border)] px-3 py-2">
          {idleButton}
        </div>
      ) : null}
      {bottomBar ? (
        active ? (
          <div className="border-t border-[var(--border)] px-3 py-2">{bottomBar}</div>
        ) : (
          <div className="flex min-h-[48px] flex-col items-stretch gap-2 border-t border-[var(--border)] px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 sm:max-w-[calc(100%-9.5rem)]">{bottomBar}</div>
            <div className="shrink-0 self-end sm:self-auto">{idleButton}</div>
          </div>
        )
      ) : null}
    </div>
  );
}

export default function DemoHud({
  active,
  playing,
  index,
  total,
  progress,
  speed,
  caption,
  labels,
  onPlayPause,
  onPrev,
  onNext,
  onSpeed,
  onExit,
  onTakeover,
  mode,
  onMode,
}: DemoHudProps) {
  if (!active) return null;
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));

  return (
    <div
      role="group"
      aria-label={labels.title}
      className="flex w-full min-w-0 flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]/92 p-1.5 shadow-[var(--elev-md)] backdrop-blur-md"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <button
          type="button"
          aria-label={playing ? labels.pause : labels.play}
          aria-pressed={playing}
          onClick={onPlayPause}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--fg)] transition-colors active:bg-[var(--accent-light)]"
        >
          {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
        </button>
        <button
          type="button"
          aria-label={labels.prev}
          onClick={onPrev}
          disabled={index <= 0}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-colors active:bg-[var(--accent-light)] disabled:opacity-35"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={labels.next}
          onClick={onNext}
          disabled={index >= total - 1}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-colors active:bg-[var(--accent-light)] disabled:opacity-35"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="shrink-0 text-[0.625rem] mono-font tabular-nums text-[var(--muted)]">
          {index + 1}/{total}
        </span>
        <button
          type="button"
          aria-label={labels.speed}
          onClick={onSpeed}
          className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full px-2 text-[0.625rem] mono-font tabular-nums text-[var(--muted)] transition-colors active:bg-[var(--accent-light)]"
        >
          {speed}×
        </button>
        <button
          type="button"
          aria-label={mode === 'auto' ? labels.auto : labels.step}
          aria-pressed={mode === 'step'}
          onClick={onMode}
          className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] px-2 text-[0.625rem] mono-font text-[var(--fg)] transition-colors active:bg-[var(--accent-light)]"
        >
          {mode === 'step' ? labels.step : labels.auto}
        </button>
        <button
          type="button"
          aria-label={labels.takeover}
          onClick={onTakeover}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-[var(--fg)] px-2.5 text-[0.625rem] mono-font text-[var(--fg)] transition-colors active:bg-[var(--accent-light)]"
        >
          {labels.takeover}
        </button>
        <button
          type="button"
          aria-label={labels.exit}
          onClick={onExit}
          className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-colors active:bg-[var(--accent-light)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p className="min-w-0 truncate px-1 text-[0.6875rem] mono-font text-[var(--fg)]" aria-live="polite">
        {caption}
      </p>

      <div className="h-0.5 w-full overflow-hidden rounded-full bg-[var(--border)]" aria-hidden="true">
        <div
          className="h-full bg-[var(--accent)] transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
