/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 输入法（IME）组合态判断。
 *
 * 中文/日文/韩文输入法在确认候选词时会发出 Enter keydown；如果自定义
 * Enter 处理器直接提交，会把尚未组合完成的文本提前发送。`isComposing`
 * 覆盖现代浏览器，`keyCode === 229` 兜住 Safari/WebKit 的事件顺序差异。
 */
export interface ImeKeyboardEventLike {
  isComposing?: boolean;
  keyCode?: number;
}

export function isComposingEvent(event: ImeKeyboardEventLike | null | undefined): boolean {
  return Boolean(event?.isComposing || event?.keyCode === 229);
}
