/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 元素分类 → 配色 / 名称的唯一事实源。
 *
 * 周期表页与化学式组件共用这一份，避免「两处各写一套色值」跑偏：
 *   - `CAT_COLOR`：低饱和度、浅色半透明填充 + 同色系边框（深浅主题通用，
 *     填充 alpha ≤ 0.10，正文始终用 var(--fg)，与半透明底的对比度≥ AA 正文 4.5:1）；
 *   - `CAT_ZH` / `CAT_EN`：类别名，用于 Tooltip 与无障碍文本标注（禁止纯靠颜色传递信息）。
 */
import type { ElementCategory } from './elements';

export interface CategoryStyle {
  /** 同色系边框 / 底点缀线（分类标识色） */
  border: string;
  /** 正文色：保持全站主色，不随分类变色（保证 AA 对比与克制） */
  text: string;
  /** 半透明柔和底色 */
  bg: string;
}

/** 类别 → 配色（与元素周期表同一份 Token） */
export const CAT_COLOR: Record<ElementCategory, CategoryStyle> = {
  metal: { border: '#C71D23', text: 'var(--fg)', bg: 'rgba(199,29,35,0.08)' }, // 金属：红
  nonmetal: { border: '#2f7d4f', text: 'var(--fg)', bg: 'rgba(47,125,79,0.09)' }, // 非金属：绿
  noble: { border: '#3d6bb3', text: 'var(--fg)', bg: 'rgba(61,107,179,0.10)' }, // 稀有气体：蓝
  metalloid: { border: '#8a6d1f', text: 'var(--fg)', bg: 'rgba(138,109,31,0.10)' }, // 类金属：黄褐
};

/** 类别中文名 */
export const CAT_ZH: Record<ElementCategory, string> = {
  metal: '金属元素',
  nonmetal: '非金属元素',
  noble: '稀有气体',
  metalloid: '类金属',
};

/** 类别英文名 */
export const CAT_EN: Record<ElementCategory, string> = {
  metal: 'Metal',
  nonmetal: 'Non-metal',
  noble: 'Noble gas',
  metalloid: 'Metalloid',
};

/** 取双语类别名（默认中文在前，便于中文 Tooltip 阅读）。 */
export function categoryBilingual(cat: ElementCategory): string {
  return `${CAT_ZH[cat]} / ${CAT_EN[cat]}`;
}
