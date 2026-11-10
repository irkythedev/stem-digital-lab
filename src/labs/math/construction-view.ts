/**
 * ConstructionLab 的画布取景：按「已知点 + 标准解关键交点」包围盒设定比例尺。
 *
 * 关键原则：
 * - 不再用固定 S=24 把 AB 缩成约 100px；
 * - 取景只依赖每个任务的标准解（不随自由作图实时变化），避免作图时镜头跳动；
 * - 允许辅助圆的非关键外弧被 SVG `<clipPath>` 裁切；
 * - 只保证已知点和关键交点（含标准解交点）落在 600×380 宽画布 24px 安全边距内。
 */
import { buildScene, type Cons, type TaskDef } from './construction-core';
import { CONSTRUCTION_DEMO } from './construction-demo';

export const CONSTRUCTION_VIEW_W = 600;
export const CONSTRUCTION_VIEW_H = 380;
export const CONSTRUCTION_VIEW_MARGIN = 24;

export interface ConstructionView {
  s: number;
  cx: number;
  cy: number;
}

/** 计算某任务的固定取景；无标准解时退回已知点包围盒。 */
export function constructionViewForTask(task: TaskDef): ConstructionView {
  const pts = task.givens.map((p) => ({ x: p.x, y: p.y }));
  const cons: Cons[] = [];
  for (const step of CONSTRUCTION_DEMO[task.id] ?? []) {
    const scene = buildScene(task.givens, [...cons, step.data.cons]);
    pts.push(...scene.points.map((p) => ({ x: p.x, y: p.y })));
    cons.push(step.data.cons);
  }
  if (pts.length === 0) return { s: 24, cx: CONSTRUCTION_VIEW_W / 2, cy: CONSTRUCTION_VIEW_H / 2 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const s = Math.min(
    (CONSTRUCTION_VIEW_W - (CONSTRUCTION_VIEW_MARGIN + 1) * 2) / spanX,
    (CONSTRUCTION_VIEW_H - (CONSTRUCTION_VIEW_MARGIN + 1) * 2) / spanY,
  );
  const cxMath = (minX + maxX) / 2;
  const cyMath = (minY + maxY) / 2;
  return {
    s,
    cx: CONSTRUCTION_VIEW_W / 2 - cxMath * s,
    cy: CONSTRUCTION_VIEW_H / 2 + cyMath * s,
  };
}
