/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 浮层栈：记录「当前打开了哪些浮层、最后打开的是哪一个」。
 *
 * 只解决一个具体的毛病 —— 一个 Esc 关掉一摞浮层。
 * 旧实现里每个浮层各自往 window 上挂一个 keydown，浏览器不区分楼层，一次按键
 * 所有监听器都会跑到：学生从欢迎弹窗里点开版本历史，按 Esc 的预期是「退回欢迎弹窗」，
 * 实际连欢迎弹窗一起没了（更糟的是 AI 面板开着时按 Esc，既关面板又把视图踢回聊天）。
 *
 * 语义就一条：**Esc 只交给最后压栈的那个浮层**（后进先出）。
 * 这里只做记账，不碰事件对象 —— 不 preventDefault / stopPropagation，
 * 浮层内输入框自己的 Esc（清空建议等）照旧能收到。
 *
 * 为什么是模块级数组而不是 React context：
 *   - 浮层都 portal 到 document.body，层级上互无父子关系，context 传不进去；
 *   - 键盘事件的判定是同步的，状态机放在 effect（异步）里会有一帧的错位。
 */

const stack: symbol[] = [];

/** 压栈（重复压同一个 id 会先摘掉旧位置，于是重新压到栈顶）。 */
export function pushOverlay(id: symbol): void {
  const at = stack.indexOf(id);
  if (at >= 0) stack.splice(at, 1);
  stack.push(id);
}

/** 出栈；不在栈里时静默返回（StrictMode 双挂载 / 条件卸载都会走到这里）。 */
export function popOverlay(id: symbol): void {
  const at = stack.indexOf(id);
  if (at >= 0) stack.splice(at, 1);
}

/** 是否栈顶：只有它该响应 Esc。空栈时恒为 false。 */
export function isTopOverlay(id: symbol): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id;
}

/** 当前打开的浮层数（测试与调试用，不参与运行时判定）。 */
export function overlayStackDepth(): number {
  return stack.length;
}
