/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 元件库缩略图的紧致视口 + 演示元件（纯函数）
 *
 * 元件库图标不再是第三套手绘简笔符号，而是直接把画布上的**同一个本体**塞进一个
 * 按需裁切的小视口里。于是「元件库图标 ≡ 拖拽幽灵 ≡ 画布上的元件」三者天然一致，
 * 换个视图模式（电路图 / 仿真图）也不会有谁忘了跟着换。
 *
 * 视口怎么裁（这是本文件唯一的判断）：
 * - **电路图**：本体只是中间那块符号，两端长长的引线是画在导线上的「多余空白」。
 *   裁到符号本体，缩略图就几乎撑满图标区，线宽也随缩放一起变粗（1.3 → 约 1.8px）。
 * - **仿真图**：教具本身就是「外壳 + 两端红黑接线柱」的整体，接线柱和 ± 标识正是学生
 *   要认的东西，裁掉就把教具裁残了。所以只裁到端子跨度外侧一点，接线柱完整保留。
 *
 * 两张表都按「半跨度 TERMINAL_HALF_SPAN」为基准记账：电路图恒小于它（引线被裁掉），
 * 仿真图恒不小于它（接线柱必须留住）。这条不变式有单测兜着，改表改跑偏会立刻报错。
 */
import {
  TERMINAL_HALF_SPAN,
  createComponent,
  type CircuitComponent,
  type ElementKind,
} from './circuit-bench-core';
import type { CircuitViewMode } from './circuit-bench-view';

/** 缩略图视口（SVG userSpaceOnUse 单位，原点即元件中心）。 */
export interface IconBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 电路图：裁到符号本体（引线不要）。y 范围为不对称的元件（开关的翘刀、变阻器的滑片）
 * 单独记账，避免竖着的部件被削掉。
 */
const SCHEMATIC_ICON_BOX: Record<ElementKind, IconBox> = {
  battery: { x: -18, y: -15, w: 36, h: 30 },
  bulb: { x: -13, y: -13, w: 26, h: 26 },
  resistor: { x: -20, y: -9, w: 40, h: 18 },
  heater: { x: -22, y: -11, w: 44, h: 22 },
  switch: { x: -16, y: -18, w: 32, h: 24 },
  rheostat: { x: -21, y: -20, w: 42, h: 28 },
  fuse: { x: -12, y: -8, w: 24, h: 16 },
  ammeter: { x: -11, y: -11, w: 22, h: 22 },
  voltmeter: { x: -11, y: -11, w: 22, h: 22 },
  galvanometer: { x: -12, y: -12, w: 24, h: 24 },
  wire: { x: -14, y: -4, w: 28, h: 8 },
};

/** 仿真图：教具 + 两端接线柱 + 极性标识全留住（约等于端子跨度各外扩 1–2 单位）。 */
const PHYSICAL_ICON_BOX: Record<ElementKind, IconBox> = {
  battery: { x: -31, y: -14, w: 62, h: 28 },
  // 灯泡竖直旋在灯座上：玻璃泡在 y≈−23，底板下沿到 +16，纵向比横向长，视口跟着变高。
  bulb: { x: -26, y: -32, w: 52, h: 50 },
  resistor: { x: -30, y: -10, w: 60, h: 20 },
  heater: { x: -34, y: -11, w: 68, h: 24 },
  switch: { x: -28, y: -14, w: 56, h: 28 },
  rheostat: { x: -30, y: -24, w: 60, h: 35 },
  fuse: { x: -25, y: -8, w: 50, h: 16 },
  ammeter: { x: -28, y: -18, w: 56, h: 36 },
  voltmeter: { x: -28, y: -18, w: 56, h: 36 },
  galvanometer: { x: -28, y: -18, w: 56, h: 36 },
  wire: { x: -28, y: -4, w: 56, h: 8 },
};

const BOXES: Record<CircuitViewMode, Record<ElementKind, IconBox>> = {
  schematic: SCHEMATIC_ICON_BOX,
  physical: PHYSICAL_ICON_BOX,
};

/** 取该视图模式下的缩略图视口；未知模式按电路图处理（与 strategyFor 同一口径）。 */
export function paletteIconBox(kind: ElementKind, mode: CircuitViewMode | undefined): IconBox {
  return BOXES[mode === 'physical' ? 'physical' : 'schematic'][kind] ?? { x: -16, y: -16, w: 32, h: 32 };
}

/**
 * 缩略图用的演示元件：参数与初始状态**就是**画布上新建元件的那一套（createComponent），
 * 所以缩略图上标着「6V」的电池盒，拖进画布后也真的是 6V。
 *
 * `id` 必须逐实例唯一：仿真图的灯泡用 `cb-glow-${id}` 注册径向渐变，而 SVG 的 id
 * 是全文档唯一的——元件库、拖拽幽灵、画布上三份同名渐变会互相抢，灯就不亮了。
 */
export function paletteDemoElement(kind: ElementKind, id: string): CircuitComponent {
  return createComponent(id, kind, 0, 0);
}

/** 端子半跨度：缩略图与画布共用同一张表，本体不会因为缩略图而另算一套端子。 */
export function paletteHalfSpan(kind: ElementKind): number {
  return TERMINAL_HALF_SPAN[kind] ?? 22;
}
