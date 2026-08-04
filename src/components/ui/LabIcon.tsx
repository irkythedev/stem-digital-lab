/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
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
