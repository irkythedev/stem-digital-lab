/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 实验级图标：区分于科目图标（SubjectIcon），表示具体实验的主题。
 * 数学函数类：抛物线（二次函数）、双曲线（反比例函数）。
 * 视觉纪律：1px 描边、currentColor、极简，与全站 line 风格一致。
 */
export interface LabIconProps {
  className?: string;
}

/** 抛物线 y = ax²（二次函数） */
export function ParabolaIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 21 C 7 4, 17 4, 22 21" />
    </svg>
  );
}

/** 双曲线 y = k/x（反比例函数，一、三象限对角两支，关于原点中心对称） */
export function HyperbolaIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 第一象限支（按 y=k/x, k=9 计算：从贴 y 轴高处弯到贴 x 轴右侧） */}
      <path d="M12.8,1.4 13.1,3.6 13.3,5.0 13.5,6.0 13.7,6.8 13.9,7.3 14.2,7.8 14.4,8.2 14.6,8.5 14.8,8.8 15.0,9.0 15.2,9.2 15.5,9.4 15.7,9.5 15.9,9.7 16.1,9.8 16.3,9.9 16.5,10.0 16.8,10.1 17.0,10.2 17.2,10.3 17.4,10.3 17.6,10.4 17.8,10.5 18.1,10.5 18.3,10.6 18.5,10.6 18.7,10.7 18.9,10.7 19.1,10.7 19.4,10.8 19.6,10.8 19.8,10.8 20.0,10.9 20.2,10.9 20.4,10.9 20.7,11.0 20.9,11.0 21.1,11.0 21.3,11.0 21.5,11.1 21.7,11.1 22.0,11.1 22.2,11.1 22.4,11.1" />
      {/* 第三象限支（关于原点中心对称，对角分布） */}
      <path d="M11.2,22.6 10.9,20.4 10.7,19.0 10.5,18.0 10.3,17.2 10.1,16.7 9.8,16.2 9.6,15.8 9.4,15.5 9.2,15.2 9.0,15.0 8.8,14.8 8.5,14.6 8.3,14.5 8.1,14.3 7.9,14.2 7.7,14.1 7.5,14.0 7.2,13.9 7.0,13.8 6.8,13.7 6.6,13.7 6.4,13.6 6.2,13.5 5.9,13.5 5.7,13.4 5.5,13.4 5.3,13.3 5.1,13.3 4.9,13.3 4.6,13.2 4.4,13.2 4.2,13.2 4.0,13.1 3.8,13.1 3.6,13.1 3.3,13.0 3.1,13.0 2.9,13.0 2.7,13.0 2.5,12.9 2.3,12.9 2.0,12.9 1.8,12.9 1.6,12.9" />
    </svg>
  );
}

/** 欧姆定律：电路中的电阻（矩形 + 两端引脚） */
export function OhmIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12 H7" />
      <path d="M17 12 H21" />
      <rect x="7" y="8" width="10" height="8" />
    </svg>
  );
}

/** 酸碱中和：锥形瓶 + 液面（滴管示意） */
export function NeutralizationIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 锥形瓶轮廓 */}
      <path d="M8 3 H16" />
      <path d="M9 3 V10 L5 19 Q5 21 7 21 H17 Q19 21 19 19 L15 10 V3" />
      {/* 液面 */}
      <path d="M9.6 11 H14.4 L17 19 Q17 20 16 20 H8 Q7 20 7 19 Z" fill="currentColor" opacity="0.25" />
      {/* 胶头滴管（胶帽 + 管身 + 尖嘴）插在瓶口 */}
      <circle cx="12" cy="1.5" rx="1.5" ry="1.1" fill="currentColor" opacity="0.4" />
      <line x1="12" y1="2.5" x2="12" y2="9" />
      <path d="M11.6 9 L12.4 9 L12 10.4" />
      {/* 正滴下的液滴 */}
      <circle cx="12" cy="11.2" r="0.9" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

/** 一次函数：上升直线（y = kx + b） */
export function LinearIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 20 L21 4" />
      <circle cx="3" cy="20" r="1.4" fill="currentColor" />
    </svg>
  );
}

/** 串并联电路：两条并联支路 + 电源 */
export function CircuitsIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 电源：正极长线 + 负极短线（竖式 · 左长右短） */}
      <line x1="2" y1="8.4" x2="6" y2="8.4" />
      <line x1="3" y1="15.6" x2="5" y2="15.6" />
      {/* 上支路：电源正极 → 上灯 */}
      <line x1="6" y1="8.4" x2="9.2" y2="8.4" />
      <circle cx="12" cy="8.4" r="2.8" />
      <path d="M10 6.4 L14 10.4 M14 6.4 L10 10.4" />
      <line x1="14.8" y1="8.4" x2="17" y2="8.4" />
      {/* 下支路：电源负极 → 下灯 */}
      <line x1="6" y1="15.6" x2="9.2" y2="15.6" />
      <circle cx="12" cy="15.6" r="2.8" />
      <path d="M10 13.6 L14 17.6 M14 13.6 L10 17.6" />
      <line x1="14.8" y1="15.6" x2="17" y2="15.6" />
      {/* 两路汇合点（并联闭合） */}
      <line x1="17" y1="8.4" x2="17" y2="15.6" />
    </svg>
  );
}

/** 凸透镜：双弧线透镜符号 */
export function LensIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4 Q 18 12 12 20" />
      <path d="M12 4 Q 6 12 12 20" />
    </svg>
  );
}

/** 圆：圆 + 圆心 + 直径 */
export function CircleIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="2 2" />
    </svg>
  );
}

/** 质量守恒：托盘天平（底座 + 中央立柱 + 顶端指针刻度 + 两侧吊挂托盘） */
export function MassIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 底座 + 中央立柱 */}
      <rect x="4" y="20" width="16" height="2" rx="1" />
      <line x1="12" y1="20" x2="12" y2="10" />
      {/* 横梁（左右两段，中间留指针位） */}
      <line x1="5" y1="9.5" x2="11" y2="9.5" />
      <line x1="13" y1="9.5" x2="19" y2="9.5" />
      {/* 中心轴点 */}
      <circle cx="12" cy="9.5" r="0.9" fill="currentColor" />
      {/* 顶端指针（干净竖线，避免小尺寸糊） */}
      <line x1="12" y1="9.5" x2="12" y2="4" />
      {/* 左右吊线 + 弧形托盘（微微上开口的浅槽） */}
      <line x1="5" y1="9.5" x2="5" y2="13.5" />
      <path d="M2.5 13.5 Q5 16 7.5 13.5" />
      <line x1="19" y1="9.5" x2="19" y2="13.5" />
      <path d="M16.5 13.5 Q19 16 21.5 13.5" />
    </svg>
  );
}

/** 拖动提示（抓取手势）：拖动表笔到测点 */
export function GrabIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 11.5V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4" />
      <path d="M14 10V8a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
      <path d="M10 9.9V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v5" />
      <path d="M6 14a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
      <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8 2 2 0 1 1 4 0" />
    </svg>
  );
}

/** 浮力：弹簧测力计 + 吊线 + 石块浸入水中（活动9.8 装置） */
export function BuoyancyIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 弹簧测力计壳 */}
      <rect x="9" y="2" width="6" height="10" rx="1" />
      {/* 弹簧 */}
      <path d="M12 12 v4 M10 16 q2 2 4 0" />
      {/* 吊线 + 石块 */}
      <line x1="12" y1="19" x2="12" y2="20.5" />
      <rect x="10" y="20.5" width="4" height="2" />
      {/* 水面（石块浸入） */}
      <path d="M3 21.5 h18" />
    </svg>
  );
}

/** 杠杆：阿基米德撬动地球——支点 + 杠杆，长臂端向下施力，短臂托起地球 */
export function LeverIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 杠杆：从长臂(低)斜向上到短臂(高)，顶住地球 */}
      <path d="M3.5 13.2 L16.8 8.8" />
      {/* 施力箭头 F（长臂端向下压） */}
      <path d="M3.5 13.2 V17 M2.3 15.2 L3.5 17 L4.7 15.2" />
      {/* 支点（三角，尖端顶住杆下方） */}
      <path d="M11.5 10.6 L10.3 14.3 L12.7 14.3 Z" />
      {/* 地球（短臂端托起）+ 地轴 */}
      <circle cx="18" cy="5.6" r="3.2" />
      <line x1="18" y1="2.4" x2="18" y2="8.8" />
      {/* 地面 */}
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

/** 压强：钉子做腿的小桌压海绵（活动9.1 装置） */
export function PressureIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 重物（放在桌面上） */}
      <rect x="8" y="2" width="8" height="4" />
      {/* 桌面（小桌板） */}
      <line x1="5" y1="6" x2="19" y2="6" />
      {/* 钉子腿（细长，尖端触海绵） */}
      <line x1="7" y1="6" x2="7" y2="13" />
      <line x1="17" y1="6" x2="17" y2="13" />
      {/* 海绵（受压凹陷） */}
      <path d="M3 17 q5 -4 9 -2 q5 -2 9 2 v3 h-18 Z" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

/** 滑轮：支架 + 定滑轮 + 绳绕过轮、一端挂重物 */
export function PulleyIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 支架横梁 + 竖杆（横梁 → 轮轴） */}
      <line x1="5" y1="3" x2="19" y2="3" />
      <line x1="12" y1="3" x2="12" y2="10" />
      {/* 定滑轮（轮 + 轴） */}
      <circle cx="12" cy="10" r="3" />
      <circle cx="12" cy="10" r="0.8" />
      {/* 绳：贴着轮外缘轮槽（左垂 → 顶弧 → 右垂） */}
      <path d="M9 9.2 V17" />
      <path d="M15 9.2 V17" />
      <path d="M9 9.2 Q9 6.8 12 6.8 Q15 6.8 15 9.2" />
      {/* 重物挂在绳的左侧一端 */}
      <rect x="7" y="17" width="4" height="3" />
    </svg>
  );
}

/** 电解水：电解器 + 两试管 + 电极 + 气泡（正氧负氢 1:2） */
export function ElectrolysisIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 顶部电源（竖式电池：正极长线 + 负极短线） */}
      <line x1="6" y1="2" x2="9.8" y2="2" />
      <line x1="11.6" y1="2" x2="15.2" y2="2" />
      {/* L 型导线（电源两端 → 两电极顶端，导线不浸入液体） */}
      <path d="M7.9 2 V6 H10" />
      <path d="M14.4 2 V6 H18" />
      {/* 外部水槽（U 型杯，盛水容器） */}
      <path d="M3 7 V18 Q3 20 5 20 H19 Q21 20 21 18 V7" />
      {/* 两根等高试管（倒扣浸入水槽） */}
      <path d="M7 6 V14 Q7 16 9 16 H11 Q13 16 13 14 V6" />
      <path d="M15 6 V14 Q15 16 17 16 H19 Q21 16 21 14 V6" />
      {/* 液面线：左低（氢气多，留白大）右高（氧气少） */}
      <line x1="7" y1="12.5" x2="13" y2="12.5" />
      <line x1="15" y1="15" x2="21" y2="15" />
      {/* 两电极（伸入水中） */}
      <line x1="10" y1="6" x2="10" y2="13" />
      <line x1="18" y1="6" x2="18" y2="15.5" />
      {/* 气泡（负极多、正极少） */}
      <circle cx="9" cy="13" r="0.7" />
      <circle cx="11" cy="13.5" r="0.7" />
      <circle cx="18.5" cy="15" r="0.6" />
    </svg>
  );
}

/** 金属活动性：试管 + 金属丝 + 溶液（置换析出） */
export function MetalIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 试管（细长圆底） */}
      <path d="M8 3 v10 a4 4 0 0 0 8 0 V3" />
      <line x1="8" y1="4" x2="16" y2="4" />
      {/* 金属丝（微折线，伸入溶液） */}
      <path d="M12 3 l-0.6 5 l1.2 1.5 l-0.4 2" />
      {/* 溶液液面 */}
      <line x1="8.6" y1="12" x2="15.4" y2="12" strokeDasharray="2 1.5" />
      {/* 析出物（紧贴金属丝下半段，气泡/析出附着） */}
      <circle cx="11.8" cy="14.5" r="1" fill="currentColor" opacity="0.3" />
      <circle cx="12.6" cy="16" r="0.9" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

/** 元素周期表：经典"城堡"轮廓（左上高起、中间凹陷、右下延伸）+ 简易分隔线 */
export function PeriodicTableIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 城堡轮廓：上边从左上(3,4)起，中段凹陷(9,4→15,4)，下段延伸 */}
      <path d="M3 4 H9 V8 H15 V4 H21 V21 H3 Z" />
      {/* 周期内部分隔线 */}
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="14" x2="21" y2="14" />
      <line x1="8" y1="4" x2="8" y2="21" />
      <line x1="13" y1="4" x2="13" y2="21" />
      <line x1="18" y1="4" x2="18" y2="21" />
    </svg>
  );
}
