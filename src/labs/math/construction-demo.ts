/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 尺规四关标准解演示剧本。
 *
 * 每步只引用「前一步及更早」已存在的点；当前步不进前缀场景，
 * 由 Construction.tsx 用前缀场景 + progress 单独绘制。
 *
 * ID 说明：x1_0 / x1_1 / x3_4 是 buildScene 当前实现自动生成的交点 ID。
 * 它们与「第几个对象、第几个交点」绑定；若 buildScene 顺序改变，终态测试会先失败。
 */
import type { DemoStep } from '../../components/lab/use-auto-timeline';
import type { Cons } from './construction-core';

export type ConstructionTool = 'ruler' | 'compass';

export interface ConstructionDemoData {
  cons: Cons;
  tool: ConstructionTool;
}

const circle = (c: string, p: string, caption: DemoStep<ConstructionDemoData>['caption']): DemoStep<ConstructionDemoData> => ({
  id: `circle-${c}-${p}`,
  animationDuration: 1000,
  dwellDuration: 700,
  data: { cons: { kind: 'circle', c, p }, tool: 'compass' },
  caption,
});

const line = (a: string, b: string, caption: DemoStep<ConstructionDemoData>['caption']): DemoStep<ConstructionDemoData> => ({
  id: `line-${a}-${b}`,
  animationDuration: 700,
  dwellDuration: 600,
  data: { cons: { kind: 'line', a, b }, tool: 'ruler' },
  caption,
});

export const CONSTRUCTION_DEMO: Record<string, DemoStep<ConstructionDemoData>[]> = {
  'perp-bisector': [
    circle('A', 'B', { zh: '以 A 为圆心、AB 为半径作圆', en: 'Circle centred at A through B' }),
    circle('B', 'A', { zh: '以 B 为圆心、BA 为半径作圆', en: 'Circle centred at B through A' }),
    line('x1_0', 'x1_1', { zh: '连接两圆交点：这就是 AB 的垂直平分线', en: 'Join the two intersections: the perpendicular bisector' }),
  ],
  midpoint: [
    circle('A', 'B', { zh: '先作两个等半径圆', en: 'Two equal-radius circles first' }),
    circle('B', 'A', { zh: '两圆交于两点', en: 'The circles meet at two points' }),
    line('x1_0', 'x1_1', { zh: '连接交点，得到垂直平分线', en: 'Join the intersections to get the perpendicular bisector' }),
    line('A', 'B', { zh: '再画 AB；它与垂直平分线的交点就是中点', en: 'Draw AB; its crossing with the bisector is the midpoint' }),
  ],
  'angle-bisector': [
    line('O', 'B', { zh: '先画直线 OB，作为角的一边', en: 'Draw line OB as one side of the angle' }),
    circle('O', 'A', { zh: '以 O 为圆心、OA 为半径作圆，截出等距点', en: 'Circle centred at O through A cuts equal distances' }),
    circle('A', 'x1_1', { zh: '以 A 为圆心、到截点的距离为半径作圆', en: 'Circle centred at A through the cut point' }),
    circle('x1_1', 'A', { zh: '以截点为圆心、同样半径再作圆', en: 'Circle centred at the cut point with the same radius' }),
    line('O', 'x3_4', { zh: '连接 O 与两圆交点：角平分线', en: 'Join O to the intersection: the angle bisector' }),
  ],
  'perp-through': [
    line('A', 'B', { zh: '先画已知直线 AB', en: 'Draw the given line AB' }),
    circle('P', 'A', { zh: '以 P 为圆心、PA 为半径作圆，交 AB 于另一点', en: 'Circle centred at P through A meets AB again' }),
    circle('A', 'x1_1', { zh: '以 A 为圆心、到新交点的距离为半径作圆', en: 'Circle centred at A through the new intersection' }),
    circle('x1_1', 'A', { zh: '以新交点为圆心、同样半径再作圆', en: 'Circle centred at the new intersection with the same radius' }),
    line('P', 'x3_4', { zh: '连接 P 与两圆交点：所求垂线', en: 'Join P to the intersection: the perpendicular' }),
  ],
};
