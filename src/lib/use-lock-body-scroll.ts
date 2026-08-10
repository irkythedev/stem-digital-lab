/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 打开遮罩/弹层时锁定 body 滚动（防止滚动穿透：背景页面随鼠标滚动）。
 */
import { useEffect } from 'react';

export function useLockBodyScroll(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}
