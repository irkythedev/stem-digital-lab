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
      aria-hidden="true"
    >
      <path d="M2 21 C 7 4, 17 4, 22 21" />
    </svg>
  );
}

/** 双曲线 y = k/x（反比例函数，两支关于原点对称） */
export function HyperbolaIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M20 4 C 13 10, 13 14, 20 20" />
      <path d="M4 4 C 11 10, 11 14, 4 20" />
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
      aria-hidden="true"
    >
      {/* 锥形瓶轮廓 */}
      <path d="M8 3 H16" />
      <path d="M9 3 V10 L5 19 Q5 21 7 21 H17 Q19 21 19 19 L15 10 V3" />
      {/* 液面 */}
      <path d="M9.6 11 H14.4 L17 19 Q17 20 16 20 H8 Q7 20 7 19 Z" fill="currentColor" opacity="0.25" />
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
      aria-hidden="true"
    >
      <path d="M3 6 H7" />
      <path d="M17 6 H21" />
      <rect x="7" y="4" width="10" height="4" />
      <path d="M7 12 H10" />
      <path d="M14 12 H17" />
      <rect x="10" y="10" width="4" height="4" />
      <path d="M3 18 H7" />
      <path d="M17 18 H21" />
      <rect x="7" y="16" width="10" height="4" />
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
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="2 2" />
    </svg>
  );
}

/** 质量守恒：天平符号 */
export function MassIcon({ className = '' }: LabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="12" x2="4" y2="18" />
      <line x1="20" y1="12" x2="20" y2="18" />
      <line x1="2" y1="18" x2="6" y2="18" />
      <line x1="18" y1="18" x2="22" y2="18" />
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
      strokeWidth="1.4"
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

/** 杠杆：水平平衡杆 + 中点三角支点 + 两端砝码用线悬挂在下方（探究杠杆平衡条件装置） */
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
      {/* 杠杆臂（带刻度的窄板） */}
      <rect x="3" y="7" width="18" height="2" rx="1" />
      <line x1="6" y1="7" x2="6" y2="8" />
      <line x1="18" y1="7" x2="18" y2="8" />
      {/* 支点：三角顶住杆中点 */}
      <polygon points="12,9 10,13.5 14,13.5" />
      {/* 左吊线 + 砝码（悬挂在杆下方） */}
      <line x1="6" y1="9" x2="6" y2="12" />
      <rect x="4.5" y="12" width="3" height="3.5" />
      {/* 右吊线 + 砝码（悬挂在杆下方，对称平衡） */}
      <line x1="18" y1="9" x2="18" y2="12" />
      <rect x="16.5" y="12" width="3" height="3.5" />
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
      {/* 支架横梁 + 竖杆 */}
      <line x1="5" y1="3" x2="19" y2="3" />
      <line x1="12" y1="3" x2="12" y2="6" />
      {/* 定滑轮（轮 + 轴） */}
      <circle cx="12" cy="9.5" r="3" />
      <circle cx="12" cy="9.5" r="0.8" />
      {/* 绳：从轮上绕过，两端下垂（示意绕绳） */}
      <path d="M9.3 8 q0 3 2.7 3 q2.7 0 2.7 -3" />
      {/* 重物挂在绳的一端 */}
      <line x1="12" y1="12.5" x2="12" y2="17" />
      <rect x="10" y="17" width="4" height="3" />
    </svg>
  );
}
