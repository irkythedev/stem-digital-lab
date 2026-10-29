/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 右键菜单的内容模型（纯函数）
 *
 * 交互分三层，这里定义的是其中「有哪些动作」的那一层：
 * - 单击元件 → 只做选中 / 拖动（不弹任何悬浮条，操作条与菜单重复只会挡视线）
 * - 双击元件 → 右上角详细参数面板（不走这里）
 * - 右键 / 长按 450ms → 唯一的下拉菜单（`elementMenuItems` / `wireMenuItems` / `blankMenuItems`）
 *
 * 文案与动作 id 都由这里产出，组件只做「把 id 映射到图标并派发」，
 * 所以「右键开关必须有『切换闭合/断开』」这类要求可以逐条单测，不靠肉眼看界面。
 */
import type { CircuitComponent } from './circuit-bench-core';

export type MenuAction =
  | 'rotate-cw'
  | 'rotate-ccw'
  | 'swap-polarity'
  | 'duplicate'
  | 'inspect'
  | 'delete'
  | 'toggle-switch'
  | 'repair'
  | 'delete-wire'
  | 'fit'
  | 'toggle-values'
  | 'clear';

/** 图标名：组件把它映射到图标本体（多数是 lucide，`fit` 是内联自绘），模型层不依赖 React。 */
export type MenuIcon =
  | 'rotate-cw'
  | 'rotate-ccw'
  | 'swap'
  | 'copy'
  | 'sliders'
  | 'trash'
  | 'power'
  | 'wrench'
  | 'fit'
  | 'eye'
  | 'eraser';

export interface MenuItem {
  id: MenuAction;
  zh: string;
  en: string;
  icon: MenuIcon;
  /** 破坏性动作（删除 / 清空）用危险色，防误点。 */
  danger?: boolean;
}

/** 有极性接线的元件：调换极性对它才有物理意义。 */
export const POLAR_KINDS: readonly string[] = ['battery', 'ammeter', 'voltmeter', 'galvanometer'];

/**
 * 元件是不是「坏了」——烧毁的灯泡、熔断的保险丝要能一键更换。
 * 这两者的状态都靠 `el.state`，不看读数，跟求解结果无关。
 */
export function isFaulty(el: Pick<CircuitComponent, 'kind' | 'state'>): boolean {
  if (el.kind === 'bulb') return el.state.burnt === true;
  if (el.kind === 'fuse') return el.state.blown === true;
  return false;
}

function item(id: MenuAction, zh: string, en: string, icon: MenuIcon, danger = false): MenuItem {
  return danger ? { id, zh, en, icon, danger } : { id, zh, en, icon };
}

const ROTATE_CW = item('rotate-cw', '顺时针旋转 90°', 'Rotate 90° CW', 'rotate-cw');
const ROTATE_CCW = item('rotate-ccw', '逆时针旋转 90°', 'Rotate 90° CCW', 'rotate-ccw');
const SWAP = item('swap-polarity', '调换正负极性', 'Swap polarity', 'swap');
const DUPLICATE = item('duplicate', '复制一份', 'Duplicate', 'copy');
const INSPECT = item('inspect', '详细参数…', 'Detailed parameters…', 'sliders');
const DELETE = item('delete', '删除元件', 'Delete part', 'trash', true);
const TOGGLE_SWITCH = item('toggle-switch', '切换闭合 / 断开', 'Toggle open / close', 'power');
const REPAIR = item('repair', '更换修复', 'Replace / repair', 'wrench');

/**
 * 元件右键 / 长按菜单。开关补「切换闭合断开」，故障件补「更换修复」，
 * 有极性件才有「调换极性」——不给出用不上的动作，学生就不会白点。
 */
export function elementMenuItems(el: Pick<CircuitComponent, 'kind' | 'state'>): MenuItem[] {
  const items: MenuItem[] = [];
  if (el.kind === 'switch') items.push(TOGGLE_SWITCH);
  if (isFaulty(el)) items.push(REPAIR);
  items.push(ROTATE_CW, ROTATE_CCW);
  if (POLAR_KINDS.includes(el.kind)) items.push(SWAP);
  items.push(DUPLICATE, INSPECT, DELETE);
  return items;
}

/** 导线右键 / 长按菜单：只有「删除该导线」——导线没有可调参数。 */
export function wireMenuItems(): MenuItem[] {
  return [item('delete-wire', '删除该导线', 'Delete this wire', 'trash', true)];
}

/** 空白处右键 / 长按菜单：视图类操作，「显示/隐藏读数」是开关。 */
export function blankMenuItems(showValues: boolean): MenuItem[] {
  return [
    // 与工具条那颗按钮同一个动作，文案与图标都必须一字不差：「适配画布居中」这个
    // 只在菜单里出现的说法，会让人以为菜单能做的事比按钮多一件。
    item('fit', '适配画布', 'Fit to canvas', 'fit'),
    item(
      'toggle-values',
      showValues ? '隐藏读数' : '显示读数',
      showValues ? 'Hide readings' : 'Show readings',
      'eye',
    ),
    item('clear', '清空画布', 'Clear canvas', 'eraser', true),
  ];
}

/**
 * 右键菜单的落点：贴住指针，但四边都不许越出视口——菜单被屏幕边缘切掉一半，
 * 学生就点不到最后一项。放不下时先翻到指针左侧 / 上方，再退回硬夹取。
 */
export function menuPosition(
  pointer: { x: number; y: number },
  menu: { w: number; h: number },
  viewport: { w: number; h: number },
  margin = 8,
): { x: number; y: number } {
  const maxX = Math.max(margin, viewport.w - menu.w - margin);
  const maxY = Math.max(margin, viewport.h - menu.h - margin);
  const x = pointer.x + menu.w + margin > viewport.w ? pointer.x - menu.w : pointer.x;
  const y = pointer.y + menu.h + margin > viewport.h ? pointer.y - menu.h : pointer.y;
  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY),
  };
}
