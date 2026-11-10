/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 轻量自动演示时间轴（零第三方依赖）。
 *
 * 一个 rAF 循环同时驱动「第几步 + 步内进度」；暂停/继续/步进/速度/循环都是一等公民。
 * 减动效偏好为 reduce 时不启动 rAF：每步停留 600ms，进度直接落到 1（终态），
 * 与报告「跳过逐帧插值、直接瞬跳终态」的约定一致。
 *
 * 设计边界：
 * - 只负责时间，不碰几何；几何由调用方的 onStep / onFrame 决定。
 * - onFrame 每帧触发，调用方可写 ref（高频几何）或写 state（读数/HUD）。
 * - steps 视为只读；演示数据放各实验的 *-demo.ts，组件只做渲染。
 */
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../lib/use-prefers-reduced-motion';

export type Easing = (t: number) => number;

export const linear: Easing = (t) => t;

/** 标准 easeInOutQuad：0→0，0.5→0.5，1→1，且单调 */
export const easeInOutQuad: Easing = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/** 与 CoordPlane / Congruence 既有手感一致 */
export const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3);

export interface DemoStep<T> {
  id: string;
  /** 兼容旧数据：未填 animationDuration 时作为动画时长 */
  duration?: number;
  /** 几何展开时间（ms）；省略时回退 duration */
  animationDuration?: number;
  /** 动画完成后的静态观察时间（ms）；省略为 0 */
  dwellDuration?: number;
  data: T;
  caption: { zh: string; en: string };
}

export type DemoPhase = 'animate' | 'dwell' | 'done';

export interface TimelineFrame {
  index: number;
  /** 0..1，步内进度；dwell 阶段锁定为 1 */
  progress: number;
  phase: DemoPhase;
  done: boolean;
}

export type DemoMode = 'auto' | 'step';

export const animationDurationOf = <T,>(step: DemoStep<T>): number =>
  Math.max(1, step.animationDuration ?? step.duration ?? 1);

export const dwellDurationOf = <T,>(step: DemoStep<T>): number =>
  Math.max(0, step.dwellDuration ?? 0);

/** 第 index 步（含动画 + 驻留）结束时的累计毫秒 */
export function stepEndElapsed<T>(steps: readonly DemoStep<T>[], index: number): number {
  if (steps.length === 0) return 0;
  const end = Math.max(0, Math.min(steps.length - 1, index));
  let total = 0;
  for (let i = 0; i <= end; i++) total += animationDurationOf(steps[i]) + dwellDurationOf(steps[i]);
  return total;
}

/** 第 index 步开始时的累计毫秒 */
export function stepStartElapsed<T>(steps: readonly DemoStep<T>[], index: number): number {
  return index <= 0 ? 0 : stepEndElapsed(steps, index - 1);
}

/**
 * 纯函数：给定累计毫秒，返回当前步与步内进度。
 * 边界（空数组、0ms、恰好落在步边界、超过总时长）都可单测。
 */
export function timelineAt<T>(steps: readonly DemoStep<T>[], elapsedMs: number): TimelineFrame {
  if (steps.length === 0) return { index: 0, progress: 0, phase: 'done', done: true };
  let rest = Math.max(0, elapsedMs);
  for (let i = 0; i < steps.length; i++) {
    const anim = animationDurationOf(steps[i]);
    const dwell = dwellDurationOf(steps[i]);
    if (rest < anim) return { index: i, progress: rest / anim, phase: 'animate', done: false };
    rest -= anim;
    if (rest < dwell) return { index: i, progress: 1, phase: 'dwell', done: false };
    rest -= dwell;
  }
  return { index: steps.length - 1, progress: 1, phase: 'done', done: true };
}

export interface AutoTimelineOptions<T> {
  /** 循环播放；Similarity 的往复演示用 */
  loop?: boolean;
  /** 每步进入时回调（切换当前演示对象） */
  onStep?: (step: DemoStep<T>, index: number) => void;
  /** 每帧回调；高频几何优先写 ref，避免每帧重建场景 */
  onFrame?: (step: DemoStep<T>, index: number, progress: number, meta?: { snap?: boolean }) => void;
  onDone?: () => void;
}

export interface AutoTimelineApi<T> {
  active: boolean;
  playing: boolean;
  index: number;
  step: DemoStep<T> | null;
  progress: number;
  phase: DemoPhase;
  mode: DemoMode;
  setMode: (mode: DemoMode) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  setSpeed: (speed: number) => void;
}

/** 减动效下每步的停留时长（不是插值时长） */
export const REDUCED_STEP_MS = 600;

export function useAutoTimeline<T>(
  steps: readonly DemoStep<T>[],
  opts: AutoTimelineOptions<T> = {},
): AutoTimelineApi<T> {
  const reduce = usePrefersReducedMotion();
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  // HUD/读数的低频镜像；真实进度在 progressRef，每帧更新但不触发 React
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<DemoPhase>('animate');
  const [mode, setModeState] = useState<DemoMode>('auto');

  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const rafRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef(0);
  const offsetRef = useRef(0);
  const speedRef = useRef(1);
  const activeRef = useRef(false);
  const playingRef = useRef(false);
  const indexRef = useRef(0);
  const progressRef = useRef(0);
  const lastIndexRef = useRef(0);
  const lastUiRef = useRef(0);
  const modeRef = useRef<DemoMode>('auto');
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;

  /** 每帧写 ref；只有换步或 80ms 节流点才触发 React */
  const setFrame = (i: number, p: number, force = false) => {
    progressRef.current = p;
    const now = performance.now();
    if (i !== indexRef.current) {
      indexRef.current = i;
      setIndex(i);
      // 换步必须同步一次进度，否则 HUD 会短暂保留上一步的 100%
      lastUiRef.current = now;
      setProgress(p);
    } else if (force || now - lastUiRef.current >= 80) {
      lastUiRef.current = now;
      setProgress(p);
    }
  };

  const emitStep = (i: number) => {
    const s = stepsRef.current[i];
    if (s) optsRef.current.onStep?.(s, i);
  };

  const emitFrame = (i: number, p: number, meta?: { snap?: boolean }) => {
    const s = stepsRef.current[i];
    if (s) optsRef.current.onFrame?.(s, i, p, meta);
  };

  const clearTimers = () => {
    cancelAnimationFrame(rafRef.current);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const finish = () => {
    playingRef.current = false;
    setPlaying(false);
    setPhase('done');
    optsRef.current.onDone?.();
  };

  /** 减动效：每步 600ms，直接落终态；不启动 rAF */
  const runReduced = (i: number) => {
    if (!activeRef.current) return;
    const s = stepsRef.current[i];
    if (!s) {
      finish();
      return;
    }
    lastIndexRef.current = i;
    setFrame(i, 1, true);
    setPhase('dwell');
    emitStep(i);
    emitFrame(i, 1, { snap: true });
    timerRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      if (i + 1 < stepsRef.current.length) runReduced(i + 1);
      else if (optsRef.current.loop) runReduced(0);
      else finish();
    }, REDUCED_STEP_MS);
  };

  const tick = (now: number) => {
    if (!playingRef.current) return;
    const elapsed = offsetRef.current + (now - startedAtRef.current) * speedRef.current;
    const f = timelineAt(stepsRef.current, elapsed);
    if (f.index !== lastIndexRef.current) {
      lastIndexRef.current = f.index;
      emitStep(f.index);
    }
    setFrame(f.index, f.progress);
    setPhase(f.phase);
    emitFrame(f.index, f.progress);

    // 单步模式：动画进入 dwell 的瞬间锁定 100% 终态并暂停，等待 Next
    if (modeRef.current === 'step' && f.phase === 'dwell') {
      const i = f.index;
      offsetRef.current = stepEndElapsed(stepsRef.current, i);
      setFrame(i, 1, true);
      setPhase('dwell');
      emitFrame(i, 1, { snap: true });
      playingRef.current = false;
      setPlaying(false);
      return;
    }

    if (f.done) {
      if (optsRef.current.loop && stepsRef.current.length > 0) {
        offsetRef.current = 0;
        startedAtRef.current = now;
        lastIndexRef.current = 0;
        setFrame(0, 0, true);
        emitStep(0);
        emitFrame(0, 0);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        finish();
      }
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const start = () => {
    clearTimers();
    if (stepsRef.current.length === 0) return;
    activeRef.current = true;
    playingRef.current = true;
    setActive(true);
    setPlaying(true);
    lastIndexRef.current = 0;
    setFrame(0, 0, true);
    setPhase('animate');
    emitStep(0);
    emitFrame(0, 0, { snap: true });
    if (reduceRef.current) {
      runReduced(0);
      return;
    }
    offsetRef.current = 0;
    startedAtRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  };

  const pause = () => {
    if (!activeRef.current || !playingRef.current) return;
    if (reduceRef.current) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    } else {
      const now = performance.now();
      offsetRef.current += (now - startedAtRef.current) * speedRef.current;
      cancelAnimationFrame(rafRef.current);
    }
    const i = indexRef.current;
    offsetRef.current = stepEndElapsed(stepsRef.current, i);
    setFrame(i, 1, true);
    setPhase('dwell');
    emitFrame(i, 1, { snap: true });
    playingRef.current = false;
    setPlaying(false);
  };

  const resume = () => {
    if (!activeRef.current || playingRef.current) return;
    // 单步模式在终态再次按播放：重播当前步，而不是直接跳到下一步
    if (modeRef.current === 'step' && progressRef.current >= 0.999) {
      const i = indexRef.current;
      offsetRef.current = stepStartElapsed(stepsRef.current, i);
      setFrame(i, 0, true);
      setPhase('animate');
      emitStep(i);
      emitFrame(i, 0, { snap: true });
    }
    playingRef.current = true;
    setPlaying(true);
    if (reduceRef.current) {
      runReduced(indexRef.current);
      return;
    }
    startedAtRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  };

  const stop = () => {
    clearTimers();
    activeRef.current = false;
    playingRef.current = false;
    setActive(false);
    setPlaying(false);
    setFrame(0, 0, true);
    setPhase('done');
    lastIndexRef.current = 0;
  };

  /** 手动步进：暂停自动播放，直接展示该步终态；再按播放从该步末尾继续 */
  const jumpTo = (i: number) => {
    const n = stepsRef.current.length;
    if (n === 0) return;
    const target = Math.max(0, Math.min(n - 1, i));
    clearTimers();
    playingRef.current = false;
    setPlaying(false);
    activeRef.current = true;
    setActive(true);
    lastIndexRef.current = target;
    // 手动步进展示的是「该步终态」；偏移量用统一的两段时长
    offsetRef.current = stepEndElapsed(stepsRef.current, target);
    startedAtRef.current = performance.now();
    setFrame(target, 1, true);
    setPhase('dwell');
    emitStep(target);
    emitFrame(target, 1, { snap: true });
  };

  const playStep = (i: number) => {
    const n = stepsRef.current.length;
    if (n === 0) return;
    const target = Math.max(0, Math.min(n - 1, i));
    clearTimers();
    activeRef.current = true;
    playingRef.current = true;
    setActive(true);
    setPlaying(true);
    lastIndexRef.current = target;
    offsetRef.current = stepStartElapsed(stepsRef.current, target);
    startedAtRef.current = performance.now();
    setFrame(target, 0, true);
    setPhase('animate');
    emitStep(target);
    emitFrame(target, 0, { snap: true });
    rafRef.current = requestAnimationFrame(tick);
  };

  const next = () => {
    if (modeRef.current === 'step' && indexRef.current < stepsRef.current.length - 1) {
      playStep(indexRef.current + 1);
      return;
    }
    jumpTo(indexRef.current + 1);
  };
  const prev = () => jumpTo(indexRef.current - 1);

  const setSpeed = (speed: number) => {
    const nextSpeed = Math.max(0.1, Math.min(4, speed));
    if (playingRef.current && !reduceRef.current) {
      const now = performance.now();
      offsetRef.current += (now - startedAtRef.current) * speedRef.current;
      startedAtRef.current = now;
    }
    speedRef.current = nextSpeed;
  };

  // 卸载时清掉 rAF / timer；演示组件卸载不应留下后台循环
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const setMode = (m: DemoMode) => {
    modeRef.current = m;
    setModeState(m);
  };

  return {
    active,
    playing,
    index,
    step: steps[index] ?? null,
    progress,
    phase,
    mode,
    setMode,
    start,
    pause,
    resume,
    stop,
    next,
    prev,
    setSpeed,
  };
}
