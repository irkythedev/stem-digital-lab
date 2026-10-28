/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 触控手势判定（纯函数）
 *
 * 教室里的希沃（Seewo）红外/电容交互大屏不是精密的指点设备：快速双击时
 * 第二下会偏 5–18px，浏览器原生的 `dblclick` 因此根本不触发；长按也会因为
 * 手指微抖而在 8px 内飘。所有阈值集中在这里，手势识别一律走
 * `pointerdown/pointermove/pointerup` 自己判，不依赖原生 dblclick / HTML5 DnD。
 *
 * 这里只有纯判定逻辑，没有 React、没有 DOM：阈值可以被单测逐条钉死。
 */

/** 两次 pointerdown 间隔小于它，且落点足够近，就当成双击。 */
export const DOUBLE_TAP_MS = 350;
/** 双击容差：红外屏快速连点实测偏移 5–18px，给到 24px 才稳。 */
export const DOUBLE_TAP_SLOP_PX = 24;
/** 长按触发右键菜单的按住时长。 */
export const LONG_PRESS_MS = 450;
/** 长按期间的允许漂移；超过就说明是在拖，不是按。 */
export const LONG_PRESS_SLOP_PX = 8;
/** 从元件坞按下到开始拖拽的位移阈值（同时用于「点」与「拖」的分流）。 */
export const DRAG_THRESHOLD_PX = 6;

/** 接线柱的屏幕命中半径：手指目标 ≥22px，桌面端鼠标也够宽松。 */
export const TERMINAL_TAP_PX = 22;
/** 拖拽连线时，目标接线柱的磁吸半径（屏幕像素）。 */
export const WIRE_MAGNET_PX = 20;

/** 触控层统一的防误触守卫：禁掉浏览器手势与文本选择。 */
export const TOUCH_GUARD = 'touch-none select-none';

export interface PointerSample {
  /** `event.timeStamp`；同一台设备同一套时间轴。 */
  t: number;
  x: number;
  y: number;
}

function within(a: PointerSample, b: PointerSample, slop: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= slop;
}

/**
 * 双击判定：上一次 pointerdown 之后 `DOUBLE_TAP_MS` 内、`DOUBLE_TAP_SLOP_PX` 内
 * 的第二次 pointerdown 即算双击。红外屏的偏差由 slop 兜住。
 */
export function isDoubleTap(prev: PointerSample | null, next: PointerSample): boolean {
  if (!prev) return false;
  const dt = next.t - prev.t;
  if (dt < 0 || dt > DOUBLE_TAP_MS) return false;
  return within(prev, next, DOUBLE_TAP_SLOP_PX);
}

/** 长按判定：按住超过 `LONG_PRESS_MS`，且整段漂移没超过 `LONG_PRESS_SLOP_PX`。 */
export function isLongPress(start: PointerSample, now: PointerSample): boolean {
  return now.t - start.t >= LONG_PRESS_MS && within(start, now, LONG_PRESS_SLOP_PX);
}

/**
 * 长按期间已经飘出容差——说明手指在拖，不是在按，定时器要立刻收掉。
 *
 * 注意不能用「只要收到 pointermove 就取消」：手指搭在电容/红外屏上不动时
 * 仍会持续产生 1–2px 的抖动事件，那样长按永远触发不了。
 */
export function longPressDrifted(start: PointerSample, now: PointerSample): boolean {
  return !within(start, now, LONG_PRESS_SLOP_PX);
}

/** 位移是否已越过拖拽阈值（点/拖分流）。 */
export function exceededDragThreshold(start: PointerSample, now: PointerSample): boolean {
  return Math.hypot(now.x - start.x, now.y - start.y) >= DRAG_THRESHOLD_PX;
}

/**
 * 屏幕像素 → 世界单位。画布按世界比例内切，CSS 像素与世界单位是固定倍率，
 * 所以「屏幕热区 ≥22px」这种要求必须先换算再拿去和世界坐标比距离。
 */
export function pxToWorld(px: number, pxPerWorld: number): number {
  return px / Math.max(0.001, pxPerWorld);
}

/** 世界单位 → 屏幕像素。 */
export function worldToPx(world: number, pxPerWorld: number): number {
  return world * Math.max(0.001, pxPerWorld);
}

/**
 * 接线柱命中半径（世界单位）：目标屏幕半径 22px，且不少于 9 个世界单位，
 * 上限 30——再大同一元件两端的热区就会连成一片。
 *
 * 注意这只是「透明命中区」要的世界半径。SVG 里真画出来的那个圈还要过
 * `terminalHitRadiusFor` 的半跨度上限（half×0.9，标准元件算下来约 19.8），
 * 光靠它够不到 22px，所以画布层另有一道屏幕空间的判定
 * （`nearestTerminalRef` + `TERMINAL_TAP_PX`），两者合起来才满足
 * 「屏幕热区 ≥22px」。
 */
export function terminalHitRadiusWorld(pxPerWorld: number): number {
  return Math.min(30, Math.max(9, pxToWorld(TERMINAL_TAP_PX, pxPerWorld)));
}
