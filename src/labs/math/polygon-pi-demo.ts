/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 刘徽割圆演播：n 按 3→6→12→24→48→96→192 倍增。
 * n 是离散整数，不做伪连续；平滑交给 CSS 过渡与夹逼条。
 */
import type { DemoStep } from '../../components/lab/use-auto-timeline';

export interface PolygonDemoData {
  n: number;
  showOuter?: boolean;
}

export const POLYGON_DEMO: DemoStep<PolygonDemoData>[] = [
  {
    id: 'n3',
    animationDuration: 1,
    dwellDuration: 700,
    data: { n: 3 },
    caption: { zh: '正三角形：内接，从下方逼近圆', en: 'Equilateral triangle: inscribed, approaching from below' },
  },
  {
    id: 'n6',
    animationDuration: 1,
    dwellDuration: 700,
    data: { n: 6, showOuter: true },
    caption: { zh: '正六边形：同时打开外切，两边夹住圆', en: 'Hexagon: turn on the circumscribed polygon to squeeze the circle' },
  },
  {
    id: 'n12',
    animationDuration: 1,
    dwellDuration: 700,
    data: { n: 12 },
    caption: { zh: '正十二边形：割之弥细', en: '12-gon: finer and finer' },
  },
  {
    id: 'n24',
    animationDuration: 1,
    dwellDuration: 700,
    data: { n: 24 },
    caption: { zh: '正二十四边形：所失弥少', en: '24-gon: the loss shrinks' },
  },
  {
    id: 'n48',
    animationDuration: 1,
    dwellDuration: 700,
    data: { n: 48 },
    caption: { zh: '正四十八边形：夹逼区间继续收窄', en: '48-gon: the squeeze narrows further' },
  },
  {
    id: 'n96',
    animationDuration: 1,
    dwellDuration: 700,
    data: { n: 96 },
    caption: { zh: '正九十六边形：刘徽得到 π ≈ 3.14', en: "96-gon: Liu Hui's π ≈ 3.14" },
  },
  {
    id: 'n192',
    animationDuration: 1,
    dwellDuration: 900,
    data: { n: 192 },
    caption: { zh: '正一百九十二边形：越来越接近圆', en: '192-gon: closer and closer to the circle' },
  },
];

/** 演示用的倍增子序列；不要直接用 N_STEPS（含 4/8/16/32，顶点集合会换一套） */
export const POLYGON_DEMO_NS = [3, 6, 12, 24, 48, 96, 192] as const;
