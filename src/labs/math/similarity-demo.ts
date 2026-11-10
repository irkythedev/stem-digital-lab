/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 位似演播关键帧：k 从 1 → 2 → 1.5 → 0 → -1.5 → 1.5 → 1，循环。
 * 每步存 from/to，组件按 easeInOutQuad 插值；k=0 的停留用来展示「缩成一点」。
 */
import type { DemoStep } from '../../components/lab/use-auto-timeline';

export interface SimilarityDemoData {
  from: number;
  to: number;
}

export const SIMILARITY_DEMO: DemoStep<SimilarityDemoData>[] = [
  {
    id: 'k-hold',
    animationDuration: 1,
    dwellDuration: 700,
    data: { from: 1, to: 1 },
    caption: { zh: '从 k = 1 开始：像与原图重合', en: 'Start at k = 1: image coincides with original' },
  },
  {
    id: 'k-up',
    animationDuration: 1000,
    dwellDuration: 700,
    data: { from: 1, to: 2 },
    caption: { zh: 'k 增大到 2：对应点沿射线外移', en: 'k grows to 2: points move outward along rays' },
  },
  {
    id: 'k-down',
    animationDuration: 500,
    dwellDuration: 600,
    data: { from: 2, to: 1.5 },
    caption: { zh: '回到 k = 1.5：面积比是 k²', en: 'Back to k = 1.5: area ratio is k²' },
  },
  {
    id: 'k-zero',
    animationDuration: 500,
    dwellDuration: 700,
    data: { from: 1.5, to: 0 },
    caption: { zh: 'k 穿过 0：像缩成一点', en: 'k crosses 0: image collapses to a point' },
  },
  {
    id: 'k-negative',
    animationDuration: 1000,
    dwellDuration: 700,
    data: { from: 0, to: -1.5 },
    caption: { zh: 'k < 0：穿过 O 到另一侧，反向放大', en: 'k < 0: through O to the other side, reversed' },
  },
  {
    id: 'k-positive',
    animationDuration: 800,
    dwellDuration: 600,
    data: { from: -1.5, to: 1.5 },
    caption: { zh: '回到 k = 1.5：像又回到同侧', en: 'Back to k = 1.5: image returns to the same side' },
  },
  {
    id: 'k-loop',
    animationDuration: 500,
    dwellDuration: 500,
    data: { from: 1.5, to: 1 },
    caption: { zh: '回到 k = 1，准备下一轮', en: 'Back to k = 1 for the next loop' },
  },
];
