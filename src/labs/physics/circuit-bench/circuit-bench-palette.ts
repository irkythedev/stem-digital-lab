/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 左侧元件坞的分类模型（纯函数）
 *
 * 元件按物理教具的用途分成四组（电源与连接 / 用电器 / 控制与保护 / 测量电表），
 * 与教材「电路组成」的讲法一致，学生找元件是「回想它在电路里干什么」，
 * 不是在一排十一个格子里扫视。分组本身、折叠状态与拖拽落点换算都放这里，
 * 组件只负责画。
 */
import { GRID, snap } from './circuit-bench-geometry';
import type { ElementKind } from './circuit-bench-core';

export interface PaletteGroup {
  id: string;
  zh: string;
  en: string;
  kinds: ElementKind[];
}

/** 四组元件的权威定义；顺序即面板上的先后（电源在最上，电表在最下）。 */
export const PALETTE_GROUPS: readonly PaletteGroup[] = [
  { id: 'source', zh: '电源与连接', en: 'Supply & wiring', kinds: ['battery', 'wire'] },
  { id: 'load', zh: '用电器', en: 'Loads', kinds: ['bulb', 'resistor', 'heater'] },
  { id: 'control', zh: '控制与保护', en: 'Control & protection', kinds: ['switch', 'rheostat', 'fuse'] },
  { id: 'meter', zh: '测量电表', en: 'Meters', kinds: ['ammeter', 'voltmeter', 'galvanometer'] },
];

export type PaletteOpenState = Record<string, boolean>;

/**
 * 默认全展开：分组是为了「找得到」，不是为了「点三次才看到」。
 * 折叠是为了把画布腾出来，需要时学生自己收。
 */
export function defaultOpenState(): PaletteOpenState {
  return Object.fromEntries(PALETTE_GROUPS.map((g) => [g.id, true]));
}

/** 逐个分组折叠/展开。未知 id 原样返回，不会凭空造出一个键。 */
export function toggleGroup(state: PaletteOpenState, id: string): PaletteOpenState {
  if (!(id in state)) return state;
  return { ...state, [id]: !state[id] };
}

/** 一键全部展开 / 全部收起。 */
export function setAllGroups(state: PaletteOpenState, open: boolean): PaletteOpenState {
  return Object.fromEntries(Object.keys(state).map((id) => [id, open]));
}

/** 是否所有分组都收起了——用于把「全部展开/收起」按钮的文案切对。 */
export function allGroupsClosed(state: PaletteOpenState): boolean {
  return Object.values(state).every((v) => !v);
}

/** 某个元件属于哪一组（用于拖拽时的高亮提示，找不到就是第一组）。 */
export function groupIdOfKind(kind: ElementKind): string {
  return PALETTE_GROUPS.find((g) => g.kinds.includes(kind))?.id ?? PALETTE_GROUPS[0].id;
}

/**
 * 拖拽落点：屏幕坐标 → 世界坐标 → 吸附到网格。
 * 拖拽预览与真正建元件都走这一个函数，所见即所得，不会出现
 * 「松手后元件跳到旁边一格」。
 */
export function snapDropPoint(world: { x: number; y: number }): { x: number; y: number } {
  return { x: snap(world.x, GRID), y: snap(world.y, GRID) };
}
