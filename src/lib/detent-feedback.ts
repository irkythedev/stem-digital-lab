/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 科学临界点「机械刻度感」微反馈。
 *
 * - 纯合成、零依赖：AudioContext 现场生成 3–5ms 的短促刻度音，增益 ≤0.04；
 * - 支持震动的设备同步 navigator.vibrate(6)；
 * - 120ms 节流：同一个临界点连续拖动不“机关枪”；
 * - SSR / 单测 / 无 AudioContext 环境安全 no-op；
 * - `detentCrossed` 为纯函数，临界点跨越判定可单测。
 */
import { useEffect, useRef } from 'react';

let audioCtx: AudioContext | null = null;
const lastAt = new Map<string, number>();

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === 'suspended') {
      // Safari/iOS 在未解锁时 resume() 可能 reject；必须吞掉，避免 unhandledrejection。
      try { void audioCtx.resume().catch(() => {}); } catch { /* 静默 */ }
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** 触发一次极轻的机械刻度音；`lock` 比 `tick` 略低、略长，表示“卡住/锁定”。 */
export function triggerDetentFeedback(kind: 'tick' | 'lock' = 'tick'): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const last = lastAt.get(kind) ?? 0;
  if (now - last < 120) return;
  lastAt.set(kind, now);

  try { navigator.vibrate?.(6); } catch { /* 静默 */ }

  const ctx = getCtx();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const dur = kind === 'lock' ? 0.005 : 0.0035;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const startFreq = kind === 'lock' ? 720 : 1180;
    const endFreq = kind === 'lock' ? 420 : 760;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.04, t + 0.0006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.001);
  } catch {
    /* 静默 */
  }
}

/**
 * 纯函数：从 prev 到 next 的这一步是否跨过了任一临界点。
 * - 初值（prev 为 null/undefined）不触发；
 * - 恰好落在点上（浮点容差内）也算；
 * - 大步长一次跨过多点只返回 true（调用方只触发一次）。
 */
export function detentCrossed(
  prev: number | null | undefined,
  next: number,
  points: readonly number[],
  epsilon = 1e-6,
): boolean {
  if (prev === null || prev === undefined) return false;
  if (!Number.isFinite(prev) || !Number.isFinite(next)) return false;
  if (Math.abs(prev - next) < epsilon) return false;

  return points.some((p) => {
    if (!Number.isFinite(p)) return false;
    const prevAt = Math.abs(prev - p) <= epsilon;
    const nextAt = Math.abs(next - p) <= epsilon;
    // 真正从一侧穿到另一侧；或从未在点上移动到点上（进入刻度）。
    const crossed = (prev < p && next > p) || (prev > p && next < p);
    const arriving = !prevAt && nextAt;
    // 从临界点“离开”不算跨越，避免初始值正好在刻度上时第一次拖动就误响。
    return crossed || arriving;
  });
}

/** 连续调参的临界点 Hook：只在值跨过临界点时触发一次，不打扰拖动本身。 */
export function useCriticalDetent(
  value: number,
  criticalPoints: readonly number[],
  options: { kind?: 'tick' | 'lock'; epsilon?: number } = {},
): void {
  const prevRef = useRef<number | null>(null);
  const kind = options.kind ?? 'tick';
  const epsilon = options.epsilon ?? 1e-6;
  useEffect(() => {
    if (detentCrossed(prevRef.current, value, criticalPoints, epsilon)) {
      triggerDetentFeedback(kind);
    }
    prevRef.current = value;
  }, [value, criticalPoints, kind, epsilon]);
}
