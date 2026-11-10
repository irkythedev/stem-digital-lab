/**
 * 首页新手引导的状态与持久化。纯浏览器 localStorage；SSR/隐私模式安全降级。
 */
import { useCallback, useEffect, useState } from 'react';

export const ONBOARDING_STORAGE_KEY = 'stemlab:onboarding-v1';
export const ONBOARDING_START_EVENT = 'stemlab:start-onboarding-tour';
export const ONBOARDING_WELCOME_CLOSED_EVENT = 'stemlab:welcome-closed';
export const ONBOARDING_PENDING_KEY = 'stemlab:onboarding-pending';
export const ONBOARDING_STEP_EVENT = 'stemlab:onboarding-step';
export const ONBOARDING_TOTAL_STEPS = 4;
export const ONBOARDING_END_EVENT = 'stemlab:onboarding-end';

function canUseDom(): boolean {
  return typeof window !== 'undefined';
}

export function readOnboardingDone(): boolean {
  if (!canUseDom()) return false;
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboardingDone(): void {
  if (!canUseDom()) return;
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
  } catch {
    // 隐私模式等静默降级
  }
}

/** URL 级跳过，供现有 Playwright 审计/截图脚本使用；不污染 localStorage。 */
export function isOnboardingSkippedByUrl(): boolean {
  if (!canUseDom()) return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('tour') === '0' || params.get('skipTour') === '1';
  } catch {
    return false;
  }
}

export function clampOnboardingStep(step: number, total = ONBOARDING_TOTAL_STEPS): number {
  if (!Number.isFinite(step)) return 0;
  return Math.max(0, Math.min(total - 1, Math.trunc(step)));
}

export function nextOnboardingStep(step: number, direction: 1 | -1, total = ONBOARDING_TOTAL_STEPS): number {
  return clampOnboardingStep(step + direction, total);
}

export interface OnboardingTourState {
  active: boolean;
  step: number;
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  finish: () => void;
}

export function useOnboardingTour(enabled = true): OnboardingTourState {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  const start = useCallback(() => {
    try { window.sessionStorage.removeItem(ONBOARDING_PENDING_KEY); } catch { /* ignore */ }
    setStep(0);
    setActive(true);
  }, []);
  const finish = useCallback(() => {
    markOnboardingDone();
    setActive(false);
    setStep(0);
    try { window.dispatchEvent(new Event(ONBOARDING_END_EVENT)); } catch { /* ignore */ }
  }, []);
  const skip = finish;
  const next = useCallback(() => {
    if (step >= ONBOARDING_TOTAL_STEPS - 1) {
      markOnboardingDone();
      setActive(false);
      setStep(0);
      try { window.dispatchEvent(new Event(ONBOARDING_END_EVENT)); } catch { /* ignore */ }
      return;
    }
    setStep(step + 1);
  }, [step]);
  const prev = useCallback(() => setStep((current) => clampOnboardingStep(current - 1)), []);

  useEffect(() => {
    if (!enabled || !canUseDom()) return;
    const fromUrl = new URLSearchParams(window.location.search).get('tour') === '1';
    let pending = false;
    try {
      pending = window.sessionStorage.getItem(ONBOARDING_PENDING_KEY) === '1';
      if (pending && readOnboardingDone()) {
        window.sessionStorage.removeItem(ONBOARDING_PENDING_KEY);
        pending = false;
      }
    } catch { /* ignore */ }
    if (fromUrl) {
      start();
    } else if (isOnboardingSkippedByUrl()) {
      // 明确跳过：不自动弹，但仍允许 Header / WelcomeDialog 主动 start。
      try { window.sessionStorage.removeItem(ONBOARDING_PENDING_KEY); } catch { /* ignore */ }
    } else if (pending) {
      // WelcomeDialog 可能比首页懒加载 chunk 更早被关闭：用它跨组件/跨挂载顺序交接。
      start();
    } else {
      const onWelcomeClosed = () => {
        if (!readOnboardingDone()) start();
      };
      window.addEventListener(ONBOARDING_WELCOME_CLOSED_EVENT, onWelcomeClosed);
      const onManualStart = () => start();
      window.addEventListener(ONBOARDING_START_EVENT, onManualStart);
      return () => {
        window.removeEventListener(ONBOARDING_WELCOME_CLOSED_EVENT, onWelcomeClosed);
        window.removeEventListener(ONBOARDING_START_EVENT, onManualStart);
      };
    }
    // 手动重看即使 URL 跳过也允许
    const onManualStart = () => start();
    window.addEventListener(ONBOARDING_START_EVENT, onManualStart);
    return () => window.removeEventListener(ONBOARDING_START_EVENT, onManualStart);
  }, [enabled, start]);

  return { active, step, start, next, prev, skip, finish };
}
