/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 打开遮罩/弹层时锁定 body 滚动（防止滚动穿透：背景页面随鼠标滚动）。
 *
 * 引用计数：浮层可以叠（欢迎弹窗里再开协议 / 版本历史 / 离线包，实验室里开参数抽屉）。
 * 旧写法每个组件各自记一份 `prev` 再各自复原，于是**关闭不按打开顺序**时就会错：
 * 外层先关 → 它把 overflow 复原成 ''，里层还开着，背景照样能滚；
 * 而里层记下的 `prev` 是外层写入的 'hidden'，它关掉后反而把页面永久锁死。
 * 改成全局计数：第一次锁存原值，最后一个锁释放时才复原，中间怎么开关都不影响。
 */
import { useEffect } from 'react';

/** 当前持有锁的浮层数（模块级：锁的是同一个 document.body） */
let lockCount = 0;
/** 第一次上锁前的原始内联值 */
let savedOverflow = '';

/** 仅供测试复用：把计数与快照复位，避免用例之间互相污染 */
export function resetBodyScrollLockForTests(): void {
  lockCount = 0;
  savedOverflow = '';
  document.body.style.overflow = '';
}

export function useLockBodyScroll(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    if (lockCount === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) document.body.style.overflow = savedOverflow;
    };
  }, [locked]);
}
