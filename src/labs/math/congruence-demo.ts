/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 全等演示剧本：两段刚体叠合 + SSA 轨迹/双解淡入。
 *
 * 位姿语义：toScreen 先绕局部 A 旋转，再平移到 tx/ty。
 * 因此「平移对齐 A」= tx/ty 取 REF_POSE、rot 保留 HOME_POSE.rot；
 * 第二步只改 rot 到 0，就是「绕 A 旋转」。
 */
import type { DemoStep } from '../../components/lab/use-auto-timeline';

export interface Pose {
  tx: number;
  ty: number;
  rot: number;
}

/** 基准三角形的位置（固定） */
export const REF_POSE: Pose = { tx: 70, ty: 300, rot: 0 };
/** 待判定三角形的初始位姿（右移 + 旋转，让「叠合」这个动作有意义） */
export const HOME_POSE: Pose = { tx: 340, ty: 300, rot: -0.4 };
/** 第一步只平移：A 先落到基准 A，三角形仍带初始旋转 */
export const ALIGNED_POSE: Pose = { tx: REF_POSE.tx, ty: REF_POSE.ty, rot: HOME_POSE.rot };

export interface PoseDemoData {
  /** 该步起始位姿 */
  from: Pose;
  /** 该步结束位姿；onFrame 用 easeInOutQuad 在两者之间插值 */
  to: Pose;
  overlayed: boolean;
}

/** 位姿线性插值：tx/ty/rot 同步，避免平移与旋转不同步 */
export function lerpPose(from: Pose, to: Pose, t: number): Pose {
  return {
    tx: from.tx + (to.tx - from.tx) * t,
    ty: from.ty + (to.ty - from.ty) * t,
    rot: from.rot + (to.rot - from.rot) * t,
  };
}

export const POSE_STEPS: DemoStep<PoseDemoData>[] = [
  {
    id: 'pose-home',
    animationDuration: 300,
    dwellDuration: 600,
    data: { from: HOME_POSE, to: HOME_POSE, overlayed: false },
    caption: { zh: '先看两个三角形：形状相同，位置不同', en: 'Two triangles: same shape, different position' },
  },
  {
    id: 'pose-align',
    animationDuration: 500,
    dwellDuration: 600,
    data: { from: HOME_POSE, to: ALIGNED_POSE, overlayed: false },
    caption: { zh: '第一步：平移，让 A 与 A′ 重合', en: 'Step 1: translate so A meets A′' },
  },
  {
    id: 'pose-rotate',
    animationDuration: 500,
    dwellDuration: 800,
    data: { from: ALIGNED_POSE, to: REF_POSE, overlayed: true },
    caption: { zh: '第二步：绕 A 旋转，看三条边是否完全贴合', en: 'Step 2: rotate about A; do all sides fit?' },
  },
  {
    id: 'pose-hold',
    animationDuration: 1,
    dwellDuration: 600,
    data: { from: REF_POSE, to: REF_POSE, overlayed: true },
    caption: { zh: '完全重合 = 全等；合不上 = 反例', en: 'Perfect fit = congruent; miss = counterexample' },
  },
];

export interface SsaDemoData {
  branch: 0 | 1;
  /** 是否显示「以 C 为圆心、a 为半径」的轨迹圆 */
  locus: boolean;
}

/** 「放回原位」：单步 500ms，从当前 pose 缓动回 HOME_POSE */
export const BACK_STEPS: DemoStep<null>[] = [
  {
    id: 'pose-back',
    animationDuration: 500,
    dwellDuration: 300,
    data: null,
    caption: { zh: '放回原位', en: 'Move back to the start' },
  },
];

export const SSA_STEPS: DemoStep<SsaDemoData>[] = [
  {
    id: 'ssa-first',
    animationDuration: 300,
    dwellDuration: 500,
    data: { branch: 0, locus: false },
    caption: { zh: '第一解：同样满足 a、b、∠A', en: 'First solution: same a, b, ∠A' },
  },
  {
    id: 'ssa-locus',
    animationDuration: 600,
    dwellDuration: 600,
    data: { branch: 0, locus: true },
    caption: { zh: '以 C 为圆心、a 为半径画弧：B 的可能位置', en: 'Arc centred at C with radius a: possible B positions' },
  },
  {
    id: 'ssa-second',
    animationDuration: 400,
    dwellDuration: 700,
    data: { branch: 1, locus: true },
    caption: { zh: '第二解：B 换到另一个交点，形状不同', en: 'Second solution: B at the other intersection' },
  },
  {
    id: 'ssa-hold',
    animationDuration: 400,
    dwellDuration: 700,
    data: { branch: 1, locus: true },
    caption: { zh: '两个解都满足 SSA，却并不全等——所以 SSA 不能判定', en: 'Both satisfy SSA but are not congruent — SSA fails' },
  },
];
