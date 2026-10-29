/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 媒体查询订阅（窄屏 / 触屏）
 *
 * 工作台有一批「必须由 JS 而不是 CSS 决定」的分支：
 *   - 画布取景要按 HUD 的真实停靠角预留净空（`HUD_BOX_CSS` 是像素常量，CSS 改不了）；
 *   - 窄屏浮层互斥是状态机，不是样式；
 *   - 提示文案要按输入能力换（触屏没有滚轮）。
 *
 * 判据一律复用全站既有原语：窄屏 = `use-param-dock.ts` 的 `NARROW_QUERY`，
 * 触屏 = `(hover: none)`（与 `index.css` 里 `.tap-area` / `.compact` 的触屏档同一媒体条件）。
 * 不新造断点，也不嗅探 UA。
 */
import { useSyncExternalStore } from 'react';

import { NARROW_QUERY } from '../../../lib/use-param-dock';

/** 触屏/无悬停设备：`index.css` 的触控热区档用的就是这条。 */
export const TOUCH_QUERY = '(hover: none)';

function subscribe(query: string, onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const mq = window.matchMedia(query);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function read(query: string): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
}

/** 订阅任意媒体查询；SSR 与首帧一律 false（与站点其他 hook 的降级口径一致）。 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () => read(query),
    () => false,
  );
}

/** 窄屏（<640px）：与 Tailwind `sm` 断点同界，与 ParamDock 同源。 */
export function useNarrow(): boolean {
  return useMediaQuery(NARROW_QUERY);
}

/** 无悬停/粗指针：触屏与希沃大屏。 */
export function useTouchOnly(): boolean {
  return useMediaQuery(TOUCH_QUERY);
}

/**
 * 竖屏平板（触屏 + 宽 ≤900px + 高 ≥700px）：导读卡放不下、改走「贴底抽屉」的那一档。
 *
 * 380×884 的浮卡在 768 宽的竖屏平板上会盖住 53% 的墨迹（审计 V4 ④ 可点 44.3%），
 * 而手机那套 `max-sm:` 只管到 639px。这里补的不是新断点，是三个既有条件的交集：
 *   · `hover: none` —— 与 `index.css` 的 `.tap-area` / `.compact` 触屏档同一媒体条件；
 *   · 宽 ≤900px —— 再宽就有横向余量，浮卡停角落不挡电路（1440/1280 桌面永不命中）；
 *   · 高 ≥700px —— 844×390 的横屏手机挡在外面，它那边浮卡只盖 61%，本来就够用。
 *
 * 与 `index.css` 里同一串媒体条件的样式块必须同步改：JS 决定「要不要吃内联位置 /
 * 要不要滚页面」，CSS 决定「长什么样」，两边判据一旦分叉就会出现「抽屉样式 +
 * 浮卡坐标」的错位。
 */
export const TABLET_SHEET_QUERY = '(hover: none) and (max-width: 900px) and (min-height: 700px)';

/** 竖屏平板：导读卡应当以贴底抽屉出现。 */
export function useTabletSheet(): boolean {
  return useMediaQuery(TABLET_SHEET_QUERY);
}

/**
 * 矮视口（横屏手机 / 上下分屏）：与 `index.css` 的
 * `(max-height: 520px) and (min-width: 640px)` 同一媒体条件，两边必须同步改。
 *
 * 844×390 上工作台是一整条长页面（实测 1364px），数据记录卡排在画布卡下方，
 * 收起钮停在 y≈777——不滚两屏根本够不到，审计 §4 直接判 OUT-OF-VIEWPORT。
 * 这一档把面板挪出页面流、改成贴底浮层（样式在 `index.css`），与窄屏 / 全屏
 * 同一副身子；这里只负责 JS 才能决定的那半件事：进这一档默认收起，
 * 免得一进实验台先盖住半块画布（与窄屏 `narrowMeasureChoice` 同一条理由）。
 *
 * `min-width: 640px` 是关键：手机竖屏（≤639）已经走 `max-sm:` 那套贴底抽屉，
 * 两条规则同时命中会互相打架；桌面高度也到不了 520px。
 */
export const SHORT_VIEWPORT_QUERY = '(max-height: 520px) and (min-width: 640px)';

/** 矮视口：数据记录应改成贴底浮层，且默认收起。 */
export function useShortViewport(): boolean {
  return useMediaQuery(SHORT_VIEWPORT_QUERY);
}
