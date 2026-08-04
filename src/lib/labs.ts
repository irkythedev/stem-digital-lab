/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 实验注册表：集中登记所有实验（元信息 + 图标 + 组件），供路由与科目页消费。
 *
 * 新增实验流程：
 *   1) 在 src/labs/<subject>/<Name>.tsx 写好实验组件；
 *   2) 在此 import 并在 labs 数组登记（id、所属学科、中英文名、图标、组件）。
 * 系统会自动接入 /lab/:labId 路由与对应科目页的实验列表。
 *
 * 隐藏实验：从 labs 数组移除即可（文件保留在 src/labs/ 下）。
 * 当前隐藏：pythagorean（勾股定理）——实验流程已转向函数类三幕式探究。
 */
import type { ComponentType } from 'react';
import type { SubjectId } from './subjects';
import type { LabIconProps } from '../components/ui/LabIcon';
import { ParabolaIcon, HyperbolaIcon, OhmIcon, NeutralizationIcon, LinearIcon, CircuitsIcon, LensIcon, CircleIcon, MassIcon } from '../components/ui/LabIcon';
import Quadratic from '../labs/math/Quadratic';
import Inverse from '../labs/math/Inverse';
import Linear from '../labs/math/Linear';
import Ohm from '../labs/physics/Ohm';
import Circuits from '../labs/physics/Circuits';
import Neutralization from '../labs/chemistry/Neutralization';
import Lens from '../labs/physics/Lens';
import Circle from '../labs/math/Circle';
import MassConservation from '../labs/chemistry/MassConservation';

export interface LabMeta {
  /** 路由 id，如 'quadratic' → /lab/quadratic */
  id: string;
  subjectId: SubjectId;
  name: { zh: string; en: string };
  /** 一句话描述（首页展示用） */
  description: { zh: string; en: string };
  /** 实验级图标（区分于科目图标） */
  icon: ComponentType<LabIconProps>;
  component: ComponentType;
}

export const labs: LabMeta[] = [
  {
    id: 'quadratic',
    subjectId: 'math',
    name: { zh: '二次函数', en: 'Quadratic Functions' },
    description: { zh: '探究 a、b、c 对抛物线开口与位置的影响', en: 'Explore how a, b, c shape the parabola' },
    icon: ParabolaIcon,
    component: Quadratic,
  },
  {
    id: 'inverse',
    subjectId: 'math',
    name: { zh: '反比例函数', en: 'Inverse Variation' },
    description: { zh: '观察 k 值变化对双曲线形状与位置的影响', en: 'See how k changes the hyperbola' },
    icon: HyperbolaIcon,
    component: Inverse,
  },
  {
    id: 'linear',
    subjectId: 'math',
    name: { zh: '一次函数', en: 'Linear Functions' },
    description: { zh: '理解 k 与 b 如何决定直线的走向与截距', en: 'Understand how k and b define a line' },
    icon: LinearIcon,
    component: Linear,
  },
  {
    id: 'ohm',
    subjectId: 'physics',
    name: { zh: '欧姆定律', en: "Ohm's Law" },
    description: { zh: '探究电流与电压、电阻的定量关系', en: 'Explore I = U/R through interactive circuits' },
    icon: OhmIcon,
    component: Ohm,
  },
  {
    id: 'circuits',
    subjectId: 'physics',
    name: { zh: '串并联电路', en: 'Series & Parallel Circuits' },
    description: { zh: '对比串联与并联的电流、电压分配规律', en: 'Compare current and voltage in series vs parallel' },
    icon: CircuitsIcon,
    component: Circuits,
  },
  {
    id: 'lens',
    subjectId: 'physics',
    name: { zh: '凸透镜成像', en: 'Convex Lens Imaging' },
    description: { zh: '调节物距，观察倒立/正立、放大/缩小的像', en: 'Adjust object distance to see real and virtual images' },
    icon: LensIcon,
    component: Lens,
  },
  {
    id: 'circle',
    subjectId: 'math',
    name: { zh: '圆的性质', en: 'Circle Properties' },
    description: { zh: '拖拽验证垂径定理、圆周角定理与直径对直角', en: 'Drag to verify chord and inscribed angle theorems' },
    icon: CircleIcon,
    component: Circle,
  },
  {
    id: 'mass-conservation',
    subjectId: 'chemistry',
    name: { zh: '质量守恒定律', en: 'Conservation of Mass' },
    description: { zh: '三个方案对比验证化学反应前后质量不变', en: 'Three experiments proving mass is conserved' },
    icon: MassIcon,
    component: MassConservation,
  },
  {
    id: 'neutralization',
    subjectId: 'chemistry',
    name: { zh: '酸碱中和', en: 'Acid-Base Titration' },
    description: { zh: '滴定实验观察 pH 突跃与指示剂颜色变化', en: 'Titrate to see the pH jump and indicator color shift' },
    icon: NeutralizationIcon,
    component: Neutralization,
  },
];

/** id → 实验元信息 的快速索引。 */
export const labMap: Record<string, LabMeta> = Object.fromEntries(labs.map((lab) => [lab.id, lab]));

/** 取某科目下的实验列表（按注册顺序）。 */
export function labsForSubject(subjectId: SubjectId): LabMeta[] {
  return labs.filter((lab) => lab.subjectId === subjectId);
}
