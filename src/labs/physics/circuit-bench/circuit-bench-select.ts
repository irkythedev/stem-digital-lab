/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 应用内下拉的纯模型（弹层落点 + 键盘索引）
 *
 * 「数据记录」面板里的横轴/纵轴探针选择原先用浏览器原生 `<select>`，毛病是一整套的：
 * - 弹层由系统绘制，全站设计令牌（磨砂底、accent 高亮、圆角）一个也带不进去，
 *   深色主题下还会从系统弹出一块白底列表；
 * - 系统行高只有 20px 上下，希沃红外屏的粗指针点不准，长按还会被认成文本选择；
 * - 触屏上原生列表常被系统摆到屏幕中央，学生正盯着的散点图直接被盖住。
 *
 * 所以改成应用内自绘下拉。定位与键盘导航都做成不依赖 DOM 的纯函数，
 * 「往上翻还是往下翻」「首尾是否环绕」这类规则可以逐条单测，不靠肉眼看界面。
 */

/**
 * 下拉的一项。
 *
 * - `label`：弹层里那一行的主文案（左列，可被截断的那一半），如「灯泡 L₁」；
 * - `hint`：弹层里右侧的次要说明（`电压 U (V)`、ρ 数值），窄面板里也读得清；
 * - `short`：触发器上显示的紧凑文案（「灯泡 L₁ · U (V)」）。触发器只有一行宽度，
 *   把弹层里那两列原样塞进去必然被 truncate 成「灯泡 L₁ · 电…」；没给就退回 `label`。
 */
export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  short?: string;
}

/** 触发器的视口矩形（`getBoundingClientRect()` 的四个分量）。 */
export interface SelectBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SelectSize {
  w: number;
  h: number;
}

export interface SelectPlacement {
  x: number;
  y: number;
  /** 弹层宽度：至少与触发器同宽，且不出视口。 */
  w: number;
  placement: 'below' | 'above' | 'clamped';
}

/**
 * 弹层落点：优先贴在触发器下方，下面放不下就翻到上方，两边都放不下才硬夹进视口。
 *
 * 宽度取「内容宽」与「触发器宽」的较大者：比触发器窄的弹层看起来像掉了一块，
 * 比视口还宽则右边被切掉、横向滚不动，学生就点不到最后一列。
 */
export function dropdownPosition(
  anchor: SelectBox,
  panel: SelectSize,
  viewport: SelectSize,
  gap = 4,
  margin = 8,
): SelectPlacement {
  const maxW = Math.max(64, viewport.w - margin * 2);
  const w = Math.min(Math.max(panel.w, anchor.w), maxW);
  const maxX = Math.max(margin, viewport.w - w - margin);
  const x = Math.min(Math.max(margin, anchor.x), maxX);

  const below = anchor.y + anchor.h + gap;
  const above = anchor.y - gap - panel.h;
  if (below + panel.h + margin <= viewport.h) return { x, y: below, w, placement: 'below' };
  if (above >= margin) return { x, y: above, w, placement: 'above' };
  // 上下都塞不进（弹层比视口还高）：贴住视口内缘，由调用方给 max-height 再内部滚动。
  const maxY = Math.max(margin, viewport.h - panel.h - margin);
  return { x, y: Math.min(Math.max(margin, below), maxY), w, placement: 'clamped' };
}

/**
 * 上下键在选项间的落点，首尾环绕。
 *
 * 环绕是刻意的：探针少则两三个，学生按着不放时希望「一直往下走」能回到第一个，
 * 而不是卡在末项上（卡住会被当成键盘失灵）。`current` 落在 [-1, count) 之外
 * 时（刚展开还没高亮）按方向给首项或末项：向下给首项、向上给末项。
 */
export function nextActiveIndex(current: number, delta: number, count: number): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return delta < 0 ? count - 1 : 0;
  return (current + delta + count) % count;
}

/** 当前值在选项里的下标；值已经不在列表里（元件被删）时返回 -1。 */
export function optionIndexOf(options: readonly SelectOption[], value: string): number {
  return options.findIndex((o) => o.value === value);
}
