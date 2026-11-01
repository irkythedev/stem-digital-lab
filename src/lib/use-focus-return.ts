/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 浮层关闭后把焦点还给「打开它的那颗按钮」。
 *
 * 浏览器的默认行为只在**移除焦点所在的元素**时把焦点扔回 body ——
 * 模态弹窗自己把焦点抢走（或 portal 卸载）之后，键盘用户按下 Esc 回到页面，
 * 接下来按 Tab 是从地址栏之后重新开始，等于把位置丢了。
 *
 * 用法：在浮层组件里 `useFocusReturn()`，挂载时记下当前焦点，卸载时还回去。
 * 记下的元素若已不在文档里（比如整块内容被替换）就什么都不做，绝不 focus 到幽灵节点。
 */
import { useEffect } from 'react';

export function useFocusReturn(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const prev = document.activeElement as HTMLElement | null;
    return () => {
      if (!prev || typeof prev.focus !== 'function') return;
      if (!document.contains(prev)) return;
      // preventScroll：还焦点不该把背后的页面滚一下
      prev.focus({ preventScroll: true });
    };
  }, [enabled]);
}

export default useFocusReturn;
