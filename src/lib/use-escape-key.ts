/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 浮层 Esc 键关闭：全站统一的键盘退出路径，与「点击遮罩关闭」互补。
 *
 * 背景：审计发现 15 个浮层里只有 4 个自带 Escape 处理，也没有全局兜底，
 * 键盘用户被困在弹窗里。抽成共享 hook 后各浮层只加一行，语义一致、行为一致。
 *
 * 叠层规则（见 overlay-stack.ts）：浮层打开时压栈，Esc **只交给栈顶那个**。
 * 这样「欢迎弹窗 → 版本历史」按一次 Esc 只退一层，而不是一次关掉一摞。
 *
 * 注意：只挂 window 上的 keydown，不吞事件（不 preventDefault / stopPropagation），
 * 以免影响浮层内输入框自身的 Escape 行为（如清空建议列表）。
 *
 * 回调放 ref、effect 只依赖 `enabled`：否则父组件每次渲染传来一个新箭头函数，
 * 就会「出栈再压栈」—— 一个正在重渲染的下层浮层会把自己顶到最上面，
 * 抢走本该属于上层的那一次 Esc。
 */
import { useEffect, useRef } from 'react';
import { isTopOverlay, popOverlay, pushOverlay } from './overlay-stack';

export function useEscapeKey(onEscape: () => void, enabled = true) {
  const handlerRef = useRef(onEscape);
  useEffect(() => {
    handlerRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!enabled) return;
    const id = Symbol('overlay');
    pushOverlay(id);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!isTopOverlay(id)) return;
      handlerRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      popOverlay(id);
    };
  }, [enabled]);
}

export default useEscapeKey;
