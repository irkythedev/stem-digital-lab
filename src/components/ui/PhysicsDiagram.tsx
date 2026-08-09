/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 物理公式配图：按教科书（苏科版）绘制规范画的示意 SVG。
 * - gravity       重力 G=mg（物体 + 竖直向下重力箭头）
 * - pressure      压强 p=F/S（木块压桌面，F 与受力面积 S 标注）
 * - liquid-pressure 液体压强 p=ρgh（容器 + 深度 h 竖直标注）
 * - buoyancy      阿基米德原理（物体浸没 + 浮力箭头 + V排）
 * - lever         杠杆平衡 F₁l₁=F₂l₂（支点 + 两力 + 力臂虚线）
 * - lens          透镜成像 1/u+1/v=1/f（光轴 + 透镜 + 物像 + u/v）
 * - ohms-law      欧姆定律 I-U 图像（过原点直线，斜率 1/R）
 * - series/parallel 串并联电路（教科书元件符号）
 * 全部用 var() 主题色；线宽/符号对齐教科书规范。
 */
import { useApp } from '../../lib/app-context';

export type PhysicsDiagramType =
  | 'gravity' | 'pressure' | 'liquid-pressure' | 'buoyancy' | 'lever'
  | 'lens' | 'ohms-law' | 'series' | 'parallel';

interface PhysicsDiagramProps {
  type: PhysicsDiagramType;
  className?: string;
}

export default function PhysicsDiagram({ type, className = '' }: PhysicsDiagramProps) {
  const { lang } = useApp();
  const FG = 'var(--fg)';
  const MUT = 'var(--muted)';
  const ACC = 'var(--accent)';
  const BG = 'var(--card-bg)';

  const labels: Record<PhysicsDiagramType, { zh: string; en: string }> = {
    gravity: { zh: '重力：物体受到竖直向下的重力 G = mg', en: 'Gravity: a downward weight G = mg on the object' },
    pressure: { zh: '压强：压力 F 垂直压在受力面积 S 上，p = F/S', en: 'Pressure: force F perpendicular on area S' },
    'liquid-pressure': { zh: '液体压强：深度 h 为从液面到该点的竖直距离', en: 'Liquid pressure: depth h is the vertical distance below the surface' },
    buoyancy: { zh: '阿基米德原理：浮力 F浮 等于排开液体所受重力', en: 'Archimedes: buoyancy equals the weight of displaced liquid' },
    lever: { zh: '杠杆平衡：F₁l₁ = F₂l₂，l 为支点到力的作用线的垂直距离', en: 'Lever balance: F₁l₁ = F₂l₂ with perpendicular arms' },
    lens: { zh: '凸透镜成像：物距 u、像距 v、焦距 f 满足 1/u + 1/v = 1/f', en: 'Lens: object distance u, image distance v, focal length f' },
    'ohms-law': { zh: '欧姆定律：I-U 图像是过原点的直线，斜率 = 1/R', en: 'Ohm\'s law: I-U graph is a straight line through the origin' },
    series: { zh: '串联电路：电流处处相等 I = I₁ = I₂', en: 'Series circuit: current is the same everywhere' },
    parallel: { zh: '并联电路：干路电流等于各支路电流之和', en: 'Parallel circuit: branch currents add to the total' },
  };

  const L = labels[type];

  // ── 重力：物体 + 竖直向下箭头 ──
  if (type === 'gravity') {
    return (
      <svg viewBox="0 0 300 170" className={className} role="img" aria-label={lang === 'zh' ? L.zh : L.en}>
        {/* 地面 */}
        <line x1="40" y1="140" x2="260" y2="140" stroke={FG} strokeWidth="1.4" />
        {/* 物体（矩形） */}
        <rect x="105" y="85" width="90" height="55" fill={BG} stroke={FG} strokeWidth="1.4" />
        {/* 重心点 */}
        <circle cx="150" cy="112" r="2.5" fill={FG} />
        {/* 重力箭头：从重心竖直向下 */}
        <line x1="150" y1="115" x2="150" y2="133" stroke={ACC} strokeWidth="1.4" />
        <path d="M150 136 l-3.5 -5.5 h7 Z" fill={ACC} />
        <text x="158" y="130" fontSize="13" fill={ACC} fontFamily="var(--f-serif)" fontStyle="italic">G</text>
        <text x="150" y="160" fontSize="10" fill={MUT} textAnchor="middle" fontFamily="var(--f-serif)">m</text>
      </svg>
    );
  }

  // ── 压强：木块压桌面 ──
  if (type === 'pressure') {
    return (
      <svg viewBox="0 0 300 170" className={className} role="img" aria-label={lang === 'zh' ? L.zh : L.en}>
        {/* 桌面 */}
        <line x1="40" y1="140" x2="260" y2="140" stroke={FG} strokeWidth="1.4" />
        {/* 木块 */}
        <rect x="100" y="85" width="100" height="55" fill={BG} stroke={FG} strokeWidth="1.4" />
        {/* 压力 F 竖直向下压木块顶部 */}
        <line x1="150" y1="62" x2="150" y2="80" stroke={ACC} strokeWidth="1.4" />
        <path d="M150 83 l-3.5 -5.5 h7 Z" fill={ACC} />
        <text x="158" y="76" fontSize="13" fill={ACC} fontFamily="var(--f-serif)" fontStyle="italic">F</text>
        {/* 受力面积 S（接触面双向箭头） */}
        <line x1="100" y1="152" x2="200" y2="152" stroke={MUT} strokeWidth="1" />
        <path d="M100 152 l5 -2.5 v5 Z" fill={MUT} />
        <path d="M200 152 l-5 -2.5 v5 Z" fill={MUT} />
        <text x="150" y="166" fontSize="11" fill={MUT} textAnchor="middle" fontFamily="var(--f-serif)" fontStyle="italic">S</text>
      </svg>
    );
  }

  // ── 液体压强：容器 + 深度 h ──
  if (type === 'liquid-pressure') {
    return (
      <svg viewBox="0 0 300 170" className={className} role="img" aria-label={lang === 'zh' ? L.zh : L.en}>
        {/* 容器（左右壁 + 底） */}
        <path d="M40 60 L40 140 L260 140 L260 60" fill="none" stroke={FG} strokeWidth="1.4" />
        {/* 液面 */}
        <line x1="40" y1="80" x2="260" y2="80" stroke={FG} strokeWidth="1.2" />
        {/* 液体（液面以下浅色填充） */}
        <path d="M44 84 L44 136 L256 136 L256 84 Z" fill="var(--accent-light)" opacity="0.35" />
        {/* 深度点（该点压强） */}
        <circle cx="185" cy="115" r="3" fill={ACC} />
        {/* 深度 h：液面到该点竖直虚线 + 箭头 */}
        <line x1="185" y1="83" x2="185" y2="112" stroke={MUT} strokeWidth="1" strokeDasharray="3 3" />
        <path d="M185 80 l-2.5 5 h5 Z" fill={MUT} />
        <path d="M185 115 l-2.5 -5 h5 Z" fill={MUT} />
        <text x="193" y="100" fontSize="12" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">h</text>
        <text x="150" y="52" fontSize="10" fill={MUT} textAnchor="middle" fontFamily="var(--f-serif)">{lang === 'zh' ? '液面' : 'surface'}</text>
      </svg>
    );
  }

  // ── 阿基米德原理：物体浸没 + F浮 + V排 ──
  if (type === 'buoyancy') {
    return (
      <svg viewBox="0 0 300 170" className={className} role="img" aria-label={lang === 'zh' ? L.zh : L.en}>
        {/* 容器 */}
        <path d="M40 50 L40 140 L260 140 L260 50" fill="none" stroke={FG} strokeWidth="1.4" />
        {/* 液面 */}
        <line x1="40" y1="70" x2="260" y2="70" stroke={FG} strokeWidth="1.2" />
        {/* 液体 */}
        <path d="M44 74 L44 136 L256 136 L256 74 Z" fill="var(--accent-light)" opacity="0.35" />
        {/* 物体（浸没的矩形） */}
        <rect x="120" y="85" width="70" height="45" fill={BG} stroke={FG} strokeWidth="1.4" />
        {/* 排开液体体积 V排（物体轮廓虚线框 = 排开部分） */}
        <rect x="120" y="85" width="70" height="45" fill="none" stroke={MUT} strokeWidth="0.9" strokeDasharray="3 3" />
        {/* 浮力箭头向上 */}
        <line x1="155" y1="132" x2="155" y2="112" stroke={ACC} strokeWidth="1.4" />
        <path d="M155 109 l-3.5 5.5 h7 Z" fill={ACC} />
        <text x="164" y="118" fontSize="12" fill={ACC} fontFamily="var(--f-serif)" fontStyle="italic">{lang === 'zh' ? 'F浮' : 'Fᵦ'}</text>
        {/* V排 标注 */}
        <text x="155" y="148" fontSize="11" fill={MUT} textAnchor="middle" fontFamily="var(--f-serif)" fontStyle="italic">V排</text>
      </svg>
    );
  }

  // ── 杠杆平衡：支点 + 两力 + 力臂 ──
  if (type === 'lever') {
    return (
      <svg viewBox="0 0 300 170" className={className} role="img" aria-label={lang === 'zh' ? L.zh : L.en}>
        {/* 杠杆（水平杆） */}
        <line x1="55" y1="85" x2="245" y2="85" stroke={FG} strokeWidth="3" />
        {/* 支点（三角） */}
        <path d="M150 85 L143 102 L157 102 Z" fill={FG} />
        <text x="162" y="100" fontSize="12" fill={FG} fontFamily="var(--f-serif)" fontStyle="italic">O</text>
        {/* F₁（左端向下） */}
        <line x1="85" y1="85" x2="85" y2="112" stroke={ACC} strokeWidth="1.4" />
        <path d="M85 115 l-3.5 -5.5 h7 Z" fill={ACC} />
        <text x="93" y="108" fontSize="12" fill={ACC} fontFamily="var(--f-serif)" fontStyle="italic">F₁</text>
        {/* F₂（右端向下） */}
        <line x1="215" y1="85" x2="215" y2="112" stroke={ACC} strokeWidth="1.4" />
        <path d="M215 115 l-3.5 -5.5 h7 Z" fill={ACC} />
        <text x="223" y="108" fontSize="12" fill={ACC} fontFamily="var(--f-serif)" fontStyle="italic">F₂</text>
        {/* 力臂 l₁（支点到 F₁ 作用线的垂直距离，虚线画在杠杆上方） */}
        <line x1="85" y1="72" x2="150" y2="72" stroke={MUT} strokeWidth="0.9" strokeDasharray="4 3" />
        <line x1="85" y1="72" x2="85" y2="85" stroke={MUT} strokeWidth="0.7" />
        <line x1="150" y1="72" x2="150" y2="85" stroke={MUT} strokeWidth="0.7" />
        <text x="116" y="66" fontSize="11" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">l₁</text>
        {/* 力臂 l₂ */}
        <line x1="150" y1="72" x2="215" y2="72" stroke={MUT} strokeWidth="0.9" strokeDasharray="4 3" />
        <line x1="215" y1="72" x2="215" y2="85" stroke={MUT} strokeWidth="0.7" />
        <text x="180" y="66" fontSize="11" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">l₂</text>
      </svg>
    );
  }

  // ── 透镜成像：光轴 + 透镜 + 物像 + u/v ──
  if (type === 'lens') {
    return (
      <svg viewBox="0 0 300 170" className={className} role="img" aria-label={lang === 'zh' ? L.zh : L.en}>
        {/* 光轴 */}
        <line x1="20" y1="85" x2="280" y2="85" stroke={FG} strokeWidth="1" />
        {/* 凸透镜符号（竖线 + 两端圆弧） */}
        <line x1="150" y1="55" x2="150" y2="115" stroke={FG} strokeWidth="1.6" />
        <path d="M150 55 q14 8 0 16 M150 71 q14 8 0 16" fill="none" stroke={FG} strokeWidth="1.2" />
        <path d="M150 99 q-14 -8 0 -16 M150 115 q-14 -8 0 -16" fill="none" stroke={FG} strokeWidth="1.2" />
        {/* 焦点 F 标注 */}
        <circle cx="150" cy="85" r="2" fill={MUT} />
        <text x="200" y="78" fontSize="10" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">F</text>
        <circle cx="200" cy="85" r="2" fill={MUT} />
        <text x="100" y="78" fontSize="10" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">F′</text>
        <circle cx="100" cy="85" r="2" fill={MUT} />
        {/* 物（左侧箭头，倒立像右侧） */}
        <line x1="65" y1="85" x2="65" y2="58" stroke={FG} strokeWidth="1.6" />
        <path d="M65 55 l-3 5 h6 Z" fill={FG} />
        <text x="56" y="52" fontSize="11" fill={FG} fontFamily="var(--f-serif)" fontStyle="italic">{lang === 'zh' ? '物' : 'obj'}</text>
        <line x1="235" y1="85" x2="235" y2="112" stroke={FG} strokeWidth="1.6" />
        <path d="M235 115 l-3 -5 h6 Z" fill={FG} />
        <text x="244" y="120" fontSize="11" fill={FG} fontFamily="var(--f-serif)" fontStyle="italic">{lang === 'zh' ? '像' : 'img'}</text>
        {/* u / v 标注 */}
        <line x1="65" y1="128" x2="150" y2="128" stroke={MUT} strokeWidth="0.8" />
        <text x="102" y="143" fontSize="11" fill={MUT} textAnchor="middle" fontFamily="var(--f-serif)" fontStyle="italic">u</text>
        <line x1="150" y1="128" x2="235" y2="128" stroke={MUT} strokeWidth="0.8" />
        <text x="188" y="143" fontSize="11" fill={MUT} textAnchor="middle" fontFamily="var(--f-serif)" fontStyle="italic">v</text>
      </svg>
    );
  }

  // ── 欧姆定律：I-U 图像（过原点直线） ──
  if (type === 'ohms-law') {
    const W = 320, H = 200;
    const pad = { left: 42, bottom: 34, top: 16, right: 16 };
    const plotW = W - pad.left - pad.right, plotH = H - pad.top - pad.bottom;
    const uMax = 12, iMax = 1.2;
    const sx = (u: number) => pad.left + (u / uMax) * plotW;
    const sy = (i: number) => pad.top + (1 - i / iMax) * plotH;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={lang === 'zh' ? L.zh : L.en}>
        {/* 坐标轴 */}
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke={FG} strokeWidth="1.2" />
        <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke={FG} strokeWidth="1.2" />
        {/* 轴箭头 */}
        <path d={`M${pad.left} ${pad.top} l-2.5 5 h5 Z`} fill={FG} />
        <path d={`M${pad.left + plotW} ${pad.top + plotH} l-5 -2.5 v5 Z`} fill={FG} />
        {/* 轴名 */}
        <text x={pad.left + plotW - 6} y={pad.top + plotH + 20} fontSize="10" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">U / V</text>
        <text x={pad.left + 8} y={pad.top + 8} fontSize="10" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">I / A</text>
        {/* 原点 O */}
        <text x={pad.left - 4} y={pad.top + plotH + 16} fontSize="9" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">O</text>
        {/* 过原点直线 I = U/R（R=10Ω） */}
        <line x1={sx(0)} y1={sy(0)} x2={sx(12)} y2={sy(1.2)} stroke={ACC} strokeWidth="1.6" />
        {/* 斜率标注 */}
        <text x={sx(3.2)} y={sy(0.42)} fontSize="11" fill={ACC} fontFamily="var(--f-serif)" fontStyle="italic">斜率 = 1/R</text>
        {/* 特征点 (U=6, I=0.6) */}
        <circle cx={sx(6)} cy={sy(0.6)} r="2.5" fill={ACC} />
        <line x1={sx(6)} y1={sy(0.6)} x2={sx(6)} y2={sy(0)} stroke={MUT} strokeWidth="0.7" strokeDasharray="3 3" />
        <text x={sx(6) - 6} y={sy(0) - 4} fontSize="9" fill={MUT} fontFamily="var(--f-mono)">6V</text>
      </svg>
    );
  }

  // ── 串联电路 ──
  if (type === 'series') {
    return (
      <svg viewBox="0 0 320 180" className={className} role="img" aria-label={lang === 'zh' ? L.zh : L.en}>
        {/* 串联回路：电源左侧 + 两电阻串联在顶部 */}
        <g stroke={FG} strokeWidth="1.2" fill="none">
          <line x1="40" y1="50" x2="40" y2="130" />
          <line x1="40" y1="50" x2="120" y2="50" />
          <line x1="200" y1="50" x2="280" y2="50" />
          <line x1="280" y1="50" x2="280" y2="130" />
          <line x1="280" y1="130" x2="40" y2="130" />
        </g>
        {/* 电池（教科书长短线） */}
        <g stroke={FG} strokeWidth="2">
          <line x1="22" y1="82" x2="58" y2="82" />
          <line x1="32" y1="96" x2="48" y2="96" />
        </g>
        {/* 电阻 R₁、R₂（教科书矩形） */}
        <rect x="120" y="43" width="40" height="14" fill={BG} stroke={FG} strokeWidth="1.2" />
        <text x="140" y="74" fontSize="10" fill={MUT} textAnchor="middle" fontFamily="var(--f-serif)" fontStyle="italic">R₁</text>
        <rect x="200" y="43" width="40" height="14" fill={BG} stroke={FG} strokeWidth="1.2" />
        <text x="220" y="74" fontSize="10" fill={MUT} textAnchor="middle" fontFamily="var(--f-serif)" fontStyle="italic">R₂</text>
        {/* 电流标注 */}
        <text x="160" y="40" fontSize="10" fill={ACC} textAnchor="middle" fontFamily="var(--f-serif)" fontStyle="italic">I</text>
        <text x="150" y="156" fontSize="10" fill={MUT} textAnchor="middle" fontFamily="var(--f-serif)">{lang === 'zh' ? '电流处处相等' : 'same I'}</text>
      </svg>
    );
  }

  // ── 并联电路 ──
  if (type === 'parallel') {
    return (
      <svg viewBox="0 0 320 180" className={className} role="img" aria-label={lang === 'zh' ? L.zh : L.en}>
        {/* 并联：电源左侧 + 两支路 */}
        <g stroke={FG} strokeWidth="1.2" fill="none">
          <line x1="40" y1="50" x2="40" y2="130" />
          <line x1="40" y1="50" x2="120" y2="50" />
          <line x1="200" y1="50" x2="280" y2="50" />
          <line x1="120" y1="50" x2="120" y2="130" />
          <line x1="280" y1="50" x2="280" y2="130" />
          <line x1="120" y1="130" x2="280" y2="130" />
          <line x1="40" y1="130" x2="120" y2="130" />
        </g>
        {/* 电池 */}
        <g stroke={FG} strokeWidth="2">
          <line x1="22" y1="82" x2="58" y2="82" />
          <line x1="32" y1="96" x2="48" y2="96" />
        </g>
        {/* 电阻 R₁（上支路）、R₂（下支路） */}
        <rect x="152" y="43" width="36" height="14" fill={BG} stroke={FG} strokeWidth="1.2" />
        <text x="170" y="34" fontSize="10" fill={MUT} textAnchor="middle" fontFamily="var(--f-serif)" fontStyle="italic">R₁</text>
        <rect x="152" y="123" width="36" height="14" fill={BG} stroke={FG} strokeWidth="1.2" />
        <text x="170" y="152" fontSize="10" fill={MUT} textAnchor="middle" fontFamily="var(--f-serif)" fontStyle="italic">R₂</text>
        {/* 电流标注 */}
        <text x="150" y="40" fontSize="10" fill={ACC} textAnchor="middle" fontFamily="var(--f-serif)" fontStyle="italic">I₁</text>
        <text x="150" y="120" fontSize="10" fill={ACC} textAnchor="middle" fontFamily="var(--f-serif)" fontStyle="italic">I₂</text>
        <text x="86" y="40" fontSize="10" fill={ACC} textAnchor="middle" fontFamily="var(--f-serif)" fontStyle="italic">I</text>
        <text x="80" y="160" fontSize="10" fill={MUT} textAnchor="middle" fontFamily="var(--f-serif)">{lang === 'zh' ? 'I = I₁ + I₂' : 'I = I₁ + I₂'}</text>
      </svg>
    );
  }

  return null;
}
