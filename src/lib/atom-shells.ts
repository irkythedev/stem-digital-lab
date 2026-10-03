/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 原子结构示意图（玻尔模型）的电子层几何。
 *
 * 教学语义：每一层的点数量必须等于该层真实电子数，不得截断。
 * 教材上的核外电子排布图就是把 18、32 个点全部画出来的；若把内层电子数
 * 截到 8（最外层稳定结构），会与同一面板「电子层排布」栏写着的真实排布
 * 自相矛盾，属科学事实错误。
 *
 * 几何可行性（对全部 118 个元素逐一验算）：
 * - 最紧的一层是第 7 周期元素的第 4 层（32 个电子，该层半径 42.5），
 *   点间距 8.34、点直径 5.2，余隙 3.14 单位，不粘连；
 * - 最外沿 66.6 < 画布半高 75，不裁切。
 * 因此点数不被几何限制，点半径只需按密度做视觉微调（见 dotRadiusFor）。
 *
 * 本模块为纯函数，供 PeriodicTable 组件与 smoke 测试共用。
 */

/** 画布与核心（viewBox 180 × 150，核居中） */
export const ATOM_VIEW = { w: 180, h: 150, cx: 90, cy: 75 } as const;

/** 核与第一层轨道之间的空隙（留出感应区，否则第一层与核重合、难以触发） */
const INNER_GAP = 8;

/** 最外层轨道半径上限（画布半高 75 以内留白，允许最外层轻微贴近边界） */
const MAX_R = 64;

/** 核半径：随原子序数位数自适应，三位数时加大核、缩小字号，避免文字出格 */
export function coreRadiusFor(n: number): number {
  return String(n).length >= 3 ? 16 : 13;
}

/**
 * 点半径：按该层电子数做密度微调。
 * - ≤ 8：2.6（原值，最外层/前两层观感不变）
 * - 9~18：2.2
 * - > 18：1.9（32 电子层收细，环上更均匀，避免视觉糊成一圈）
 * 依据是实算余隙：即使全部维持 2.6 也不重叠，收细是观感优化而非必需。
 */
export function dotRadiusFor(count: number): number {
  if (count <= 8) return 2.6;
  if (count <= 18) return 2.2;
  return 1.9;
}

export interface ShellDot {
  x: number;
  y: number;
}

export interface ShellLayout {
  /** 该层轨道半径 */
  r: number;
  /** 该层点半径 */
  dotR: number;
  /** 该层真实电子数 */
  count: number;
  /** 按真实电子数均匀铺满整圈的点位 */
  dots: ShellDot[];
}

/**
 * 计算各电子层的轨道半径与点位。
 *
 * @param shells 电子层排布（自内向外，例如 Fe 为 [2, 8, 14, 2]）
 * @param coreR  核半径（由 coreRadiusFor 给出，仅影响首层起点与层间距）
 */
export function shellLayout(shells: number[], coreR: number): ShellLayout[] {
  const { cx, cy } = ATOM_VIEW;
  const layers = shells.length;
  const maxR = Math.min(MAX_R, coreR + 51);
  // 层间距：核缘到 maxR 之间均分，任何层数（1~7）都不溢出
  const step = layers > 1 ? (maxR - coreR - INNER_GAP) / (layers - 1) : 0;

  return shells.map((count, i) => {
    const r = coreR + INNER_GAP + (layers > 1 ? i * step : 0);
    const dots: ShellDot[] = [];
    // 真实电子数逐个铺满整圈（起点在正上方 -90°）
    for (let k = 0; k < count; k++) {
      const a = (k / count) * 2 * Math.PI - Math.PI / 2;
      dots.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    return { r, dotR: dotRadiusFor(count), count, dots };
  });
}
