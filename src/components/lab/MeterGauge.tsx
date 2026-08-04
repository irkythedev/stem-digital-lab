/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 模拟表盘（老式学生电流表/电压表）：半圆刻度 + 指针。
 * 指针偏转 ∝ value/max，CSS transform 过渡平滑摆动，零依赖。
 *
 * 用法：与 MeterProbe 联动——探针吸附测点后，把该测点数值传给 value；
 * value=null 表示表笔悬空（指针回零，读数显示 —）。
 */
interface MeterGaugeProps {
  /** 当前读数；null = 悬空 */
  value: number | null;
  /** 量程（满偏值），刻度按 0 / max/2 / max 标注 */
  max: number;
  /** 单位：A / V */
  unit: 'A' | 'V';
  /** 当前测点名称（表盘下方小字） */
  label: string;
}

const CX = 50;
const CY = 70;
const R_OUT = 44; // 外弧半径
const R_MAJOR = 39; // 主刻度内端
const R_MINOR = 41.5; // 细分刻度内端
const R_LABEL = 29; // 刻度数字位置
const NEEDLE = 36; // 指针长

/** 极坐标 → 画布坐标（SVG y 向下，角度按 0°=右、90°=上、180°=左） */
const polar = (r: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY - r * Math.sin(rad)];
};

/** 上半圆弧路径（左 → 右） */
const arcPath = `M ${CX - R_OUT} ${CY} A ${R_OUT} ${R_OUT} 0 0 1 ${CX + R_OUT} ${CY}`;

export default function MeterGauge({ value, max, unit, label }: MeterGaugeProps) {
  const v = value ?? 0;
  const deg = 180 - (Math.min(v, max) / max) * 180; // 0 → 左端零位，max → 右端满偏
  const mid = max / 2;
  // 指针颜色：电流表红 / 电压表蓝（专业仪表惯例），明暗主题由 CSS 变量适配
  const needleColor = unit === 'A' ? 'var(--meter-a)' : 'var(--meter-v)';

  // 主刻度 0..10 格；每主格 2 细分（细分只画奇数位，偶数位即主刻度）
  const majors = Array.from({ length: 11 }, (_, i) => i);
  const minors = Array.from({ length: 10 }, (_, i) => i * 2 + 1);

  return (
    <div className="flex w-[100px] flex-col items-center gap-0.5">
      <svg width={100} height={88} viewBox="0 0 100 88" role="img" aria-label={`${unit} 表盘`} className="shrink-0">
        {/* 外弧 */}
        <path d={arcPath} fill="none" stroke="var(--border)" strokeWidth="1.2" />
        {/* 细分刻度 */}
        {minors.map((i) => {
          const [x1, y1] = polar(R_MINOR, 180 - i * 9);
          const [x2, y2] = polar(R_OUT, 180 - i * 9);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--border)" strokeWidth="0.8" />;
        })}
        {/* 主刻度 */}
        {majors.map((i) => {
          const [x1, y1] = polar(R_MAJOR, 180 - i * 18);
          const [x2, y2] = polar(R_OUT, 180 - i * 18);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--fg)" strokeWidth="1" />;
        })}
        {/* 刻度数字：0 / max/2 / max（沿弧线内侧排列） */}
        <text x={polar(R_LABEL, 180)[0]} y={polar(R_LABEL, 180)[1] + 4} textAnchor="middle" fontSize="8" fill="var(--muted)" fontFamily="var(--f-mono)">
          0
        </text>
        <text x={polar(R_LABEL, 90)[0]} y={polar(R_LABEL, 90)[1] + 3} textAnchor="middle" fontSize="8" fill="var(--muted)" fontFamily="var(--f-mono)">
          {String(mid)}
        </text>
        <text x={polar(R_LABEL, 0)[0]} y={polar(R_LABEL, 0)[1] + 4} textAnchor="middle" fontSize="8" fill="var(--muted)" fontFamily="var(--f-mono)">
          {String(max)}
        </text>
        {/* 指针（含尾部平衡杆），CSS transform 过渡；旋转取反：刻度极坐标逆时针、CSS rotate 顺时针 */}
        <g
          style={{
            transform: `rotate(${-deg}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transformBox: 'view-box',
            transition: 'transform 0.2s ease-out',
          }}
        >
          <line x1={CX - 8} y1={CY} x2={CX} y2={CY} stroke={needleColor} strokeWidth="1.4" />
          <line x1={CX} y1={CY} x2={CX + NEEDLE} y2={CY} stroke={needleColor} strokeWidth="1.6" />
        </g>
        {/* 中心轴 */}
        <circle cx={CX} cy={CY} r="2.6" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.2" />
      </svg>
      <p className="mono-font text-[13px] leading-tight text-[var(--fg)]">
        {value === null ? (
          '—'
        ) : (
          <>
            {value.toFixed(unit === 'A' ? 2 : 1)}
            <span className="ml-1 text-[9px] leading-tight text-[var(--muted)]">{unit}</span>
          </>
        )}
      </p>
      <p className="text-[10px] mono-font leading-tight text-[var(--muted)]">{label}</p>
    </div>
  );
}
