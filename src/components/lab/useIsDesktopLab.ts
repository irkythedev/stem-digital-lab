/**
 * 数学实验统一桌面断点：与 Quadratic/MathCanvasStage 保持一致（1024px）。
 * 只读 viewport，不引入布局副作用。
 */
import { useEffect, useState } from 'react';

export function useIsDesktopLab(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 1024px)');
    const sync = () => setIsDesktop(!!mq?.matches);
    sync();
    mq?.addEventListener?.('change', sync);
    return () => mq?.removeEventListener?.('change', sync);
  }, []);
  return isDesktop;
}
