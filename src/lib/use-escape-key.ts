/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 浮层 Esc 键关闭：全站统一的键盘退出路径，与「点击遮罩关闭」互补。
 *
 * 背景：审计发现 15 个浮层里只有 4 个自带 Escape 处理，也没有全局兜底，
 * 键盘用户被困在弹窗里。抽成共享 hook 后各浮层只加一行，语义一致、行为一致。
 *
 * 注意：只挂 window 上的 keydown，不吞事件（不 preventDefault / stopPropagation），
 * 以免影响浮层内输入框自身的 Escape 行为（如清空建议列表）。
 */
import { useEffect } from 'react';

export function useEscapeKey(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onEscape, enabled]);
}

export default useEscapeKey;
