/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 天平 SVG 组件：称量前后质量对比显示。
 * 并排显示两个天平（反应前 / 反应后），指针摆动 + 质量数值。
 *
 * 样式说明：只用 --fg / --muted / --border / --accent / --error。
 */
import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useApp } from '../../lib/app-context';

interface BalanceScaleProps {
  beforeMass: number;
  afterMass: number;
  /** 是否显示反应后（用于动画过渡） */
  showAfter?: boolean;
  /** 质量单位 */
  unit?: string;
}

const SCALE = 0.6;
const CX = 120;
const CY = 100;

/** 力臂半长（px）：托盘升降位移与横梁端点位移同源，均 = 力臂 × sinθ */
const ARM = 50;

/** 量程上限（度）：tiltDeg 与阻尼输出共用同一上限，确保指针绝不冲出分度盘 */
const MAX_DEG = 10;

/** 欠阻尼曲线的峰值系数：1 − e^(−4.2t)·cos(6.4πt) 在 t ≈ 0.146 处取到 **1.530154**（数值扫描实测）。
 *  单程 0 → 10° 的未钳位峰值即 ≈ 15.30°（超出目标 53%）；全域 ±10° 往返回转时最坏可达 20.60°。
 *  即「只把目标夹到 ±10°」并不能保证中间过程也在 ±10° 内，故必须在输出侧再夹一次
 *  （见 useDampedAngle）；这也贴合真实托盘天平的限位挡块。
 *  导出给守卫：断言该系数与数值扫描结果一致，且钳位确实承重。 */
export const OVERSHOOT = 1.530154;

/** 由质量差求横梁倾角（度）。delta>0 = 左盘（被测物）变轻 → 右盘（砝码端）下沉。
 *  SVG 中正角即左端抬起，与上述方向一致，故直接正向映射。 */
function tiltDeg(beforeMass: number, afterMass: number): number {
  const raw = (beforeMass - afterMass) * 1.6;
  return Math.max(-MAX_DEG, Math.min(MAX_DEG, raw));
}

/** 导出给守卫：阻尼插值的完整求值（与组件内同源），供「输出绝不越量程」的行为级断言使用 */
export function dampedAngleAt(from: number, to: number, t: number): number {
  const envelope = Math.exp(-4.2 * t);
  const raw = from + (to - from) * (1 - envelope * Math.cos(6.4 * Math.PI * t));
  return Math.max(-MAX_DEG, Math.min(MAX_DEG, raw));
}

/**
 * 欠阻尼二阶系统的角度过渡：1 − e^(−ζωt)·cos(ω_d t)。
 * 过冲两次后收敛，还原真实托盘天平指针的摆动衰减（非瞬时硬切）。
 * 偏好减动效时直接落到终值——全局 CSS 兜底管不到 rAF，必须在此判断。
 */
function useDampedAngle(targetDeg: number): number {
  const [angle, setAngle] = useState(targetDeg);
  /** 当前「实际渲染值」：目标在动画在途时反转，必须从这里起算。
   *  若改存「上一个目标值」，新动画会把画面瞬间拽回那个目标 —— 实测单帧硬跳 4.85°。 */
  const currentRef = useRef(targetDeg);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = currentRef.current;
    const to = targetDeg;
    if (from === to) return;
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      currentRef.current = to;
      setAngle(to);
      return;
    }
    const dur = 1100;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      // 输出侧量程钳位：阻尼过冲可达目标的 1.52 倍，不夹就会冲出分度盘
      const next = dampedAngleAt(from, to, t);
      currentRef.current = next;
      setAngle(next);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetDeg]);

  return angle;
}
/** 天平底座 + 横梁 + 指针 + 托盘（横梁/指针绕支点偏转，托盘随倾角升降） */
function SingleScale({
  mass,
  label,
  accent,
  angle,
}: {
  mass: number;
  label: string;
  accent: string;
  /** 横梁倾角（度）：正角 = 左端抬起 / 右端（砝码端）下沉 */
  angle: number;
}) {
  const panY = CY + 30;
  const drop = Math.sin((angle * Math.PI) / 180) * ARM;

  return (
    <g>
      {/* 底座 */}
      <rect x={CX - 40} y={CY + 50} width={80} height={8} rx={2}
        fill="var(--muted)" opacity={0.3} />
      {/* 立柱 */}
      <rect x={CX - 3} y={CY - 10} width={6} height={62}
        fill="var(--muted)" opacity={0.4} />
      {/* 横梁 + 指针：绕支点整体旋转（指针固连横梁，随倾角偏转） */}
      <g transform={`rotate(${angle} ${CX} ${CY})`}>
        <line x1={CX - ARM} y1={CY} x2={CX + ARM} y2={CY}
          stroke="var(--fg)" strokeWidth={2.5} />
        <line x1={CX} y1={CY} x2={CX} y2={CY + 38}
          stroke={accent} strokeWidth={1.5} />
        <circle cx={CX} cy={CY} r={4} fill={accent} />
      </g>
      {/* 分度盘：指针可达域 = 臂长 × sin(量程) = 38 × sin(10°) ≈ 6.6px，刻度按此定标（±7px）。
          原先画到 ±12px 是「永不可达」的装饰——指针最大只到 6.6px，外侧刻度一辈子读不到。 */}
      <line x1={CX - 8} y1={CY + 40} x2={CX + 8} y2={CY + 40}
        stroke="var(--muted)" strokeWidth={0.8} opacity={0.65} />
      {[-7, -3.5, 0, 3.5, 7].map((dx) => (
        <line key={dx} x1={CX + dx} y1={CY + 40} x2={CX + dx} y2={CY + (dx === 0 ? 33 : 35)}
          stroke="var(--muted)" strokeWidth={dx === 0 ? 1 : 0.6} opacity={dx === 0 ? 0.9 : 0.55} />
      ))}
      {/* 左托盘（放被测物）—— 挂杆保持竖直，仅随倾角升降 */}
      <line x1={CX - ARM} y1={CY} x2={CX - ARM} y2={panY - drop}
        stroke="var(--muted)" strokeWidth={1.2} />
      <line x1={CX - 60} y1={panY - drop} x2={CX - 40} y2={panY - drop}
        stroke="var(--muted)" strokeWidth={1.5} />
      {/* 被测物（左盘） */}
      <rect x={CX - 56} y={panY - drop - 12} width={10} height={12} rx={1}
        fill="var(--fg)" opacity={0.4} />
      {/* 右托盘（放砝码） */}
      <line x1={CX + ARM} y1={CY} x2={CX + ARM} y2={panY + drop}
        stroke="var(--muted)" strokeWidth={1.2} />
      <line x1={CX + 40} y1={panY + drop} x2={CX + 60} y2={panY + drop}
        stroke="var(--muted)" strokeWidth={1.5} />
      {/* 砝码（右盘，叠放） */}
      <rect x={CX + 42} y={panY + drop - 14} width={12} height={6} rx={1}
        fill="var(--fg)" opacity={0.35} />
      <rect x={CX + 44} y={panY + drop - 8} width={8} height={8} rx={1}
        fill="var(--fg)" opacity={0.25} />
      {/* 质量数值 */}
      <text x={CX} y={CY + 80} textAnchor="middle"
        fill={accent} fontSize={14} className="mono-font font-bold">
        {mass.toFixed(1)}
      </text>
      {/* 标签 */}
      <text x={CX} y={CY + 95} textAnchor="middle"
        fill="var(--muted)" fontSize={10} className="mono-font">
        {label}
      </text>
    </g>
  );
}

export default function BalanceScale({
  beforeMass,
  afterMass,
  showAfter = false,
  unit = 'g',
}: BalanceScaleProps) {
  const { lang } = useApp();
  const equal = Math.abs(beforeMass - afterMass) < 0.01;
  // 反应前称量 = 平衡态（水平）；反应后称量 = 由质量差驱动的阻尼摆动
  const angle = useDampedAngle(showAfter ? tiltDeg(beforeMass, afterMass) : 0);

  return (
    <svg viewBox="0 0 360 200" className="w-full max-h-[350px]" aria-label={lang === 'zh' ? '天平' : 'Balance scale'}>
      {/* 反应前 */}
      <g transform={`translate(0, 0) scale(${SCALE})`}>
        <SingleScale mass={beforeMass} label={lang === 'zh' ? '反应前' : 'Before'} accent="var(--fg)" angle={0} />
      </g>

      {/* 箭头 */}
      <text x={180} y={70} textAnchor="middle"
        fill="var(--muted)" fontSize={18} className="mono-font">→</text>

      {/* 反应后 */}
      <g transform={`translate(180, 0) scale(${SCALE})`}
        style={{ opacity: showAfter ? 1 : 0.3, transition: 'opacity 0.5s' }}>
        <SingleScale
          mass={afterMass}
          label={lang === 'zh' ? '反应后' : 'After'}
          accent={equal ? 'var(--fg)' : 'var(--error)'}
          angle={angle}
        />
      </g>

      {/* 单位 */}
      <text x={180} y={185} textAnchor="middle"
        fill="var(--muted)" fontSize={10} className="mono-font">
        {unit}
      </text>

      {/* 质量变化提示：判定标记用 Lucide 矢量图标（全站图标纪律，禁用「对勾 / 叉号」文本字符充当图标） */}
      {showAfter && (
        <g>
          {equal
            ? <Check x={118} y={9} width={14} height={14} color="var(--fg)" aria-hidden />
            : <X x={118} y={9} width={14} height={14} color="var(--error)" aria-hidden />}
          <text x={137} y={20} textAnchor="start"
            fill={equal ? 'var(--fg)' : 'var(--error)'}
            fontSize={12} className="mono-font">
            {equal
              ? (lang === 'zh' ? '反应前后质量相等' : 'Mass conserved')
              : (lang === 'zh'
                ? `质量变化: ${(afterMass - beforeMass) > 0 ? '+' : ''}${(afterMass - beforeMass).toFixed(1)} ${unit}`
                : `Change: ${(afterMass - beforeMass) > 0 ? '+' : ''}${(afterMass - beforeMass).toFixed(1)} ${unit}`)}
          </text>
        </g>
      )}
    </svg>
  );
}
