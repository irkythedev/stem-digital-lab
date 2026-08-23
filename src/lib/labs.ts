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
import { ParabolaIcon, HyperbolaIcon, OhmIcon, NeutralizationIcon, LinearIcon, CircuitsIcon, LensIcon, CircleIcon, MassIcon, BuoyancyIcon, LeverIcon, PressureIcon, PulleyIcon, ElectrolysisIcon, MetalIcon } from '../components/ui/LabIcon';
import Quadratic from '../labs/math/Quadratic';
import Inverse from '../labs/math/Inverse';
import Linear from '../labs/math/Linear';
import Ohm from '../labs/physics/Ohm';
import Circuits from '../labs/physics/Circuits';
import Neutralization from '../labs/chemistry/Neutralization';
import Lens from '../labs/physics/Lens';
import Circle from '../labs/math/Circle';
import MassConservation from '../labs/chemistry/MassConservation';
import Buoyancy from '../labs/physics/Buoyancy';
import Lever from '../labs/physics/Lever';
import Pressure from '../labs/physics/Pressure';
import Pulley from '../labs/physics/Pulley';
import Electrolysis from '../labs/chemistry/Electrolysis';
import MetalActivity from '../labs/chemistry/MetalActivity';

export interface LabMeta {
  /** 路由 id，如 'quadratic' → /lab/quadratic */
  id: string;
  subjectId: SubjectId;
  name: { zh: string; en: string };
  /** 一句话描述（首页展示用） */
  description: { zh: string; en: string };
  /** 结构化实验知识（AI 助手系统提示词注入用：目的/操作/规律/考点） */
  aiKnowledge?: string;
  /** 实验级图标（区分于科目图标） */
  icon: ComponentType<LabIconProps>;
  component: ComponentType;
  /** 领域分类（首页学科展开 tab，按教材领域组织） */
  category: LabCategoryId;
}

/** 领域分类 id：函数/几何（数学）、电学/力学/光学（物理）、物质变化/金属与酸碱（化学） */
export type LabCategoryId =
  | 'function'
  | 'geometry'
  | 'electric'
  | 'mechanics'
  | 'optics'
  | 'matterChange'
  | 'metalAcid';

/** 各学科的分类顺序表（首页 tab 显示顺序；分类数 ≥2 时显示 tab 行） */
export const labCategories: Record<SubjectId, { id: LabCategoryId; zh: string; en: string }[]> = {
  math: [
    { id: 'function', zh: '函数', en: 'Functions' },
    { id: 'geometry', zh: '几何', en: 'Geometry' },
  ],
  physics: [
    { id: 'electric', zh: '电学', en: 'Electricity' },
    { id: 'mechanics', zh: '力学', en: 'Mechanics' },
    { id: 'optics', zh: '光学', en: 'Optics' },
  ],
  chemistry: [
    { id: 'matterChange', zh: '物质变化', en: 'Matter & Change' },
    { id: 'metalAcid', zh: '金属与酸碱', en: 'Metals & Acids/Bases' },
  ],
};

export const labs: LabMeta[] = [
  {
    id: 'quadratic',
    subjectId: 'math',
    name: { zh: '二次函数', en: 'Quadratic Functions' },
    description: { zh: '探究 a、b、c 对抛物线开口与位置的影响', en: 'Explore how a, b, c shape the parabola' },
    aiKnowledge: '实验目的：探究二次函数 y=ax²+bx+c 中 a、b、c 三个参数对抛物线的影响。操作要点：拖动滑块分别改变 a、b、c，观察图像变化；可切换顶点式平移演示（y=x² → y=(x-1)² → y=(x-1)²+2）。关键规律：a 决定开口方向与宽窄（a>0 开口向上、|a| 越大开口越窄）；b 影响对称轴位置（对称轴 x=-b/2a）；c 决定与 y 轴交点 (0,c)。考点：配方法化顶点式、顶点坐标公式、对称轴。',
    icon: ParabolaIcon,
    component: Quadratic,
    category: 'function',
  },
  {
    id: 'inverse',
    subjectId: 'math',
    name: { zh: '反比例函数', en: 'Inverse Variation' },
    description: { zh: '观察 k 值变化对双曲线形状与位置的影响', en: 'See how k changes the hyperbola' },
    aiKnowledge: '实验目的：观察反比例函数 y=k/x 中 k 值变化对双曲线形状与位置的影响。操作要点：拖动滑块改变 k，观察双曲线变化；图像关于原点对称，分居一、三象限（k>0）或二、四象限（k<0）。关键规律：|k| 越大曲线离原点越远；渐近线为 x=0 与 y=0。考点：反比例函数图像特征、k 的几何意义。',
    icon: HyperbolaIcon,
    component: Inverse,
    category: 'function',
  },
  {
    id: 'linear',
    subjectId: 'math',
    name: { zh: '一次函数', en: 'Linear Functions' },
    description: { zh: '理解 k 与 b 如何决定直线的走向与截距', en: 'Understand how k and b define a line' },
    aiKnowledge: '实验目的：理解一次函数 y=kx+b 中 k 与 b 如何决定直线的走向与截距。操作要点：拖动滑块分别改变 k、b，观察直线变化。关键规律：k 是斜率，k>0 直线上升、k<0 直线下降，|k| 越大越陡；b 是纵截距，直线与 y 轴交于 (0,b)。考点：两点法画直线、k 与 b 的几何意义、函数与方程。',
    icon: LinearIcon,
    component: Linear,
    category: 'function',
  },
  {
    id: 'ohm',
    subjectId: 'physics',
    name: { zh: '欧姆定律', en: "Ohm's Law" },
    description: { zh: '探究电流与电压、电阻的定量关系', en: 'Explore I = U/R through interactive circuits' },
    aiKnowledge: '实验目的：探究电流与电压、电阻的定量关系（欧姆定律 I=U/R）。操作要点：连接电路后调节滑动变阻器或电源电压，读取电流表与电压表示数；改变电阻重复测量。关键规律：导体电阻一定时电流与电压成正比；电压一定时电流与电阻成反比。考点：欧姆定律公式与变形、伏安法测电阻、串联分压并联分流。',
    icon: OhmIcon,
    component: Ohm,
    category: 'electric',
  },
  {
    id: 'circuits',
    subjectId: 'physics',
    name: { zh: '串并联电路', en: 'Series & Parallel Circuits' },
    description: { zh: '对比串联与并联的电流、电压分配规律', en: 'Compare current and voltage in series vs parallel' },
    aiKnowledge: '实验目的：对比串联与并联电路中电流、电压的分配规律。操作要点：分别连接串联、并联电路，点击开关控制通断，读取各支路电流表与电压表示数。关键规律：串联电路电流处处相等、总电压等于各用电器电压之和；并联电路各支路电压相等、干路电流等于各支路电流之和。考点：串并联电路特点、电路识别与画图。',
    icon: CircuitsIcon,
    component: Circuits,
    category: 'electric',
  },
  {
    id: 'lens',
    subjectId: 'physics',
    name: { zh: '凸透镜成像', en: 'Convex Lens Imaging' },
    description: { zh: '调节物距，观察倒立/正立、放大/缩小的像', en: 'Adjust object distance to see real and virtual images' },
    aiKnowledge: '实验目的：调节物距，观察凸透镜成像的倒立/正立、放大/缩小、实像/虚像规律。操作要点：移动蜡烛（物体）位置，观察光屏上像的变化；比较物距 u 与焦距 f、二倍焦距 2f 的关系。关键规律：u>2f 成倒立缩小实像（照相机）；f<u<2f 成倒立放大实像（投影仪）；u<f 成正立放大虚像（放大镜）。考点：凸透镜成像规律表、物近像远像变大。',
    icon: LensIcon,
    component: Lens,
    category: 'optics',
  },
  {
    id: 'circle',
    subjectId: 'math',
    name: { zh: '圆的性质', en: 'Circle Properties' },
    description: { zh: '拖拽验证垂径定理、圆周角定理与直径对直角', en: 'Drag to verify chord and inscribed angle theorems' },
    aiKnowledge: '实验目的：拖拽验证垂径定理、圆周角定理与直径所对圆周角为直角。操作要点：拖动圆上的点改变位置，观察线段与角度关系变化；验证 CD⊥AB 时 AE=EB（垂径定理）；同弧所对圆周角相等，∠BPC=∠BQC；直径所对圆周角 ∠BOC=180° 时对应圆周角为 90°。考点：垂径定理、圆周角定理及推论、弧弦圆心角关系。',
    icon: CircleIcon,
    component: Circle,
    category: 'geometry',
  },
  {
    id: 'mass-conservation',
    subjectId: 'chemistry',
    name: { zh: '质量守恒定律', en: 'Conservation of Mass' },
    description: { zh: '三个方案对比验证化学反应前后质量不变', en: 'Three experiments proving mass is conserved' },
    aiKnowledge: '实验目的：通过三个方案对比验证化学反应前后质量不变（质量守恒定律）。操作要点：分别在敞口/密闭/有气体生成的条件下进行反应，称量反应前后总质量。关键规律：化学反应前后原子种类、数目、质量不变，所以总质量守恒；有气体生成时须在密闭容器中称量。考点：质量守恒定律的实质、实验方案设计。',
    icon: MassIcon,
    component: MassConservation,
    category: 'matterChange',
  },
  {
    id: 'neutralization',
    subjectId: 'chemistry',
    name: { zh: '酸碱中和', en: 'Acid-Base Titration' },
    description: { zh: '滴定实验观察 pH 突跃与指示剂颜色变化', en: 'Titrate to see the pH jump and indicator color shift' },
    aiKnowledge: '实验目的：滴定实验观察酸碱中和过程中 pH 突跃与指示剂颜色变化。操作要点：向酸中滴加碱液（或反之），实时观察 pH 变化曲线与指示剂颜色；到达终点时 pH≈7。关键规律：中和反应 H⁺+OH⁻=H₂O；酚酞遇碱变红、遇酸不变色；pH 在终点附近发生突跃。考点：中和反应实质、pH 曲线、指示剂选择。',
    icon: NeutralizationIcon,
    component: Neutralization,
    category: 'metalAcid',
  },
  {
    id: 'buoyancy',
    subjectId: 'physics',
    name: { zh: '浮力', en: 'Buoyancy' },
    description: { zh: '探究阿基米德原理：浮力与排开液体体积、液体密度的关系', en: 'Explore Archimedes\' principle: buoyancy vs displaced volume and liquid density' },
    aiKnowledge: '实验目的：探究阿基米德原理——浮力与排开液体体积、液体密度的关系。操作要点：改变物体浸入液体的体积或更换液体，读取弹簧测力计示数变化。关键规律：F浮=ρ液gV排；浸没后排开体积不变，浮力不再随深度增大。考点：阿基米德原理、浮沉条件、浮力计算。',
    icon: BuoyancyIcon,
    component: Buoyancy,
    category: 'mechanics',
  },
  {
    id: 'lever',
    subjectId: 'physics',
    name: { zh: '杠杆', en: 'Levers' },
    description: { zh: '探究杠杆的平衡条件 F₁l₁=F₂l₂，认识省力/费力/等臂杠杆', en: 'Explore the lever balance condition F₁l₁=F₂l₂ and effort-saving/requiring levers' },
    aiKnowledge: '实验目的：探究杠杆平衡条件 F₁l₁=F₂l₂，认识省力/费力/等臂杠杆。操作要点：调节杠杆两端钩码数量与力臂，使杠杆平衡并记录数据。关键规律：动力×动力臂=阻力×阻力臂；l₁>l₂ 省力费距离（如撬棍），l₁<l₂ 费力省距离（如镊子），l₁=l₂ 等臂（如天平）。考点：杠杆平衡条件实验、三类杠杆识别。',
    icon: LeverIcon,
    component: Lever,
    category: 'mechanics',
  },
  {
    id: 'pressure',
    subjectId: 'physics',
    name: { zh: '压强', en: 'Pressure' },
    description: { zh: '探究压强 p=F/S 与压力、受力面积的关系', en: 'Explore pressure p=F/S vs force and contact area' },
    aiKnowledge: '实验目的：探究压强 p=F/S 与压力、受力面积的关系。操作要点：改变压力大小或受力面积，观察压强计/形变程度变化。关键规律：压力一定时受力面积越小压强越大；受力面积一定时压力越大压强越大。考点：压强定义式、增大减小压强的方法。',
    icon: PressureIcon,
    component: Pressure,
    category: 'mechanics',
  },
  {
    id: 'pulley',
    subjectId: 'physics',
    name: { zh: '滑轮', en: 'Pulleys' },
    description: { zh: '探究定滑轮与动滑轮的特点', en: 'Explore fixed and movable pulleys' },
    aiKnowledge: '实验目的：探究定滑轮与动滑轮的特点。操作要点：分别使用定滑轮、动滑轮提升重物，比较拉力与重物重力的关系及移动距离。关键规律：定滑轮不省力但改变力的方向；动滑轮省一半力但不改变方向、费距离；滑轮组兼顾两者。考点：滑轮与滑轮组特点、n 段绳子判断、机械效率。',
    icon: PulleyIcon,
    component: Pulley,
    category: 'mechanics',
  },
  {
    id: 'electrolysis',
    subjectId: 'chemistry',
    name: { zh: '电解水', en: 'Electrolysis of Water' },
    description: { zh: '电解水观察正氧负氢，体积比 2:1，探究水的组成', en: 'Electrolyze water to see O₂ and H₂ in a 2:1 ratio and explore water\'s composition' },
    aiKnowledge: '实验目的：电解水观察正氧负氢、体积比 2:1，探究水的组成。操作要点：接通直流电源，观察两电极产生气泡，比较正负极气体体积并检验气体。关键规律：正极产生氧气（使带火星木条复燃）、负极产生氢气（可点燃）；体积比 H₂:O₂=2:1；水由氢、氧元素组成。考点：电解水实验现象与结论、水的组成。',
    icon: ElectrolysisIcon,
    component: Electrolysis,
    category: 'matterChange',
  },
  {
    id: 'metal-activity',
    subjectId: 'chemistry',
    name: { zh: '金属活动性', en: 'Metal Activity' },
    description: { zh: '置换反应验证 Al > Cu > Ag 的金属活动性顺序', en: 'Use displacement reactions to verify the activity order Al > Cu > Ag' },
    aiKnowledge: '实验目的：通过置换反应验证 Al > Cu > Ag 的金属活动性顺序。操作要点：将铝片放入硫酸铜溶液、铜片放入硝酸银溶液，观察反应现象；设计对比实验排除干扰。关键规律：活动性强的金属能把弱的从其盐溶液中置换出来；Al>Cu>Ag。考点：金属活动性顺序应用、置换反应判断。',
    icon: MetalIcon,
    component: MetalActivity,
    category: 'metalAcid',
  },
];

/** id → 实验元信息 的快速索引。 */
export const labMap: Record<string, LabMeta> = Object.fromEntries(labs.map((lab) => [lab.id, lab]));

/** 取某科目下的实验列表（按注册顺序）。 */
export function labsForSubject(subjectId: SubjectId): LabMeta[] {
  return labs.filter((lab) => lab.subjectId === subjectId);
}
