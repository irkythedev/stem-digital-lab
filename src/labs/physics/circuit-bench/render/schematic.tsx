/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 电路图本体（schematic）
 *
 * 黑白教科书线稿：所有符号在本地坐标里按「a 端在右」水平绘制，由外层 g 旋转。
 * 灯泡 / 保险丝 / 电表复用既有 textbook line-art 零件，其余为两端口简图。
 * 本体只画外壳，绝不重算接线柱（±half 由调用方按 TERMINAL_HALF_SPAN 传入）。
 */
import { FixedMeter, Fuse } from '../../../../components/lab/circuit/CircuitParts';
import { wiperLocalX } from '../circuit-bench-geometry';
import type { CircuitComponent } from '../circuit-bench-core';
import { HEAT_STROKE_STYLE, heatLevel, heatStroke } from './heat';
import type { BodyProps } from './types';

function numParam(el: CircuitComponent, key: string, fallback: number): number {
  const v = Number(el.params[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export function SchematicBody({ el, half, stroke, reading }: BodyProps) {
  const power = reading?.power ?? 0;
  const burnt = el.kind === 'bulb' && el.state.burnt;
  const blown = el.kind === 'fuse' && el.state.blown;

  switch (el.kind) {
    case 'bulb': {
      const rated = numParam(el, 'ratedPower', 3);
      const glow = burnt ? 0 : Math.min(1, power / Math.max(0.2, rated));
      const lit = glow > 0.02;
      // 灯丝颜色与仿真图（physical.tsx）逐字相同：冷态金属灰、点亮暖黄 #ffb84d。
      // 同一只灯泡在两套视图里给出两个温度印象，是最容易被学生当成「两个实验」的失误。
      const filament = lit ? '#ffb84d' : 'var(--muted)';
      return (
        <g>
          <line x1={-half} y1={0} x2={-12} y2={0} stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />
          <line x1={12} y1={0} x2={half} y2={0} stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />
          {/* 国标发光记号：玻璃泡外缘四道短射线（左上/右上/左下/右下）。
              不再铺半透明暖色光晕盘——那层盘在黑白线稿里读成「糊了一块黄」，
              还会盖住紧贴灯泡的导线与读数标签；射线是标准画法，且只占 5 个世界单位。
              射线颜色走 --cb-flow 令牌而不是写死暖黄：#ffb84d 在白卡上只有 1.75:1，
              把「亮 / 不亮」这条信息压到 3:1 门槛以下；--cb-flow 是仓库里唯一一对
              亮暗两套都 ≥3:1 的琥珀色（浅 #d97706 4.62、暗 #ffd166 11.0）。
              它画的「电流流动虚线」只在仿真图出现，与这里的射线**永不同屏**，
              所以不会变成第二种「一号两义」。 */}
          {lit &&
            [45, 135, 225, 315].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const c = Math.cos(rad);
              const s = Math.sin(rad);
              return (
                <line
                  key={deg}
                  x1={c * 14.5}
                  y1={s * 14.5}
                  x2={c * 19.5}
                  y2={s * 19.5}
                  stroke="var(--cb-flow)"
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  opacity={0.35 + 0.65 * glow}
                  style={{ transition: 'opacity 0.3s ease-out' }}
                />
              );
            })}
          {/* 玻璃泡：点亮时留一层很淡的暖色，熄灭回卡片底 */}
          <circle
            cx={0}
            cy={0}
            r={12}
            fill={lit ? 'rgba(255, 205, 110, 0.18)' : 'var(--card-bg)'}
            stroke={stroke}
            strokeWidth={1.5}
            style={{ transition: 'fill 0.3s ease-out' }}
          />
          {/* 灯丝：教科书「圆内 X」形 */}
          <line
            x1={-3.96}
            y1={-3.96}
            x2={3.96}
            y2={3.96}
            stroke={filament}
            strokeWidth={1.3}
            style={{ transition: 'stroke 0.3s ease-out' }}
          />
          <line
            x1={3.96}
            y1={-3.96}
            x2={-3.96}
            y2={3.96}
            stroke={filament}
            strokeWidth={1.3}
            style={{ transition: 'stroke 0.3s ease-out' }}
          />
        </g>
      );
    }
    case 'battery':
      return (
        <g stroke={stroke} strokeWidth={1.7} strokeLinecap="round">
          <line x1={6} y1={-13} x2={6} y2={13} />
          <line x1={-6} y1={-7} x2={-6} y2={7} />
          <line x1={-half} y1={0} x2={-6} y2={0} />
          <line x1={6} y1={0} x2={half} y2={0} />
          {/* 长板在 a 侧：与 buildCircuitSystem 里 emf 注入的 a=正极保持一致。
              符号反向自转：竖放的电源（rotation=90）若让「+」跟着转，
              会读成一道斜杠，学生认不出哪端是正极。 */}
          <text
            x={13}
            y={-10}
            fontSize={9}
            fill="var(--muted)"
            fontFamily="var(--f-mono)"
            stroke="none"
            transform={`rotate(${-Number(el.rotation ?? 0)} 13 -10)`}
          >
            +
          </text>
          <text
            x={-13}
            y={-10}
            textAnchor="end"
            fontSize={9}
            fill="var(--muted)"
            fontFamily="var(--f-mono)"
            stroke="none"
            transform={`rotate(${-Number(el.rotation ?? 0)} -13 -10)`}
          >
            −
          </text>
        </g>
      );
    case 'resistor':
      return (
        <g stroke={stroke} strokeWidth={1.3} fill="var(--card-bg)">
          <line x1={-half} y1={0} x2={-18} y2={0} />
          <rect x={-18} y={-7} width={36} height={14} rx={1} />
          <line x1={18} y1={0} x2={half} y2={0} />
        </g>
      );
    case 'rheostat': {
      // 滑片跟着 `params.ratio` 走：学生拨滑片 / 拖参数滑杆时，图上的三角箭头
      // 必须真的左右移动，否则「变阻器在变阻」这件事在图上完全看不出来。
      const wx = wiperLocalX(el.params.ratio, 'schematic');
      return (
        <g stroke={stroke} strokeWidth={1.2} fill="none">
          <line x1={-half} y1={0} x2={-19} y2={0} />
          <rect x={-19} y={-6} width={38} height={12} rx={1} fill="var(--card-bg)" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={i} x1={-14 + i * 6} y1={-6} x2={-14 + i * 6} y2={6} stroke="var(--muted)" strokeWidth={0.6} />
          ))}
          <line x1={19} y1={0} x2={half} y2={0} />
          <path d={`M ${wx - 2} -13 L ${wx + 2} -6 L ${wx - 2} -6 Z`} fill={stroke} stroke="none" />
          <line x1={wx} y1={-13} x2={wx} y2={-18} stroke={stroke} />
        </g>
      );
    }
    case 'switch':
      return (
        <g stroke={stroke} strokeWidth={1.5} strokeLinecap="round">
          <line x1={-half} y1={0} x2={-14} y2={0} />
          <line x1={14} y1={0} x2={half} y2={0} />
          <circle cx={-14} cy={0} r={2.4} fill="var(--card-bg)" />
          <circle cx={14} cy={0} r={2.4} fill="var(--card-bg)" />
          <line
            x1={-14}
            y1={0}
            x2={el.params.closed === false ? 8 : 14}
            y2={el.params.closed === false ? -16 : 0}
            style={{ transition: 'all 0.18s ease-out' }}
          />
        </g>
      );
    case 'fuse':
      // 熔断时玻璃管里的熔丝由 `Fuse` 自己断成两截（中间 6 个单位的空档），
      // 这里不再叠一个压在线上的红叉：那个叉正好横跨断口，在放大后读成
      // 一根搭回去的导线，把「已经断路」这件事又抹掉了。整根变暗 + 真断口
      // 两个线索已经足够，且互相不矛盾。
      return (
        <g className={blown ? 'opacity-50' : undefined}>
          <line x1={-half} y1={0} x2={-10} y2={0} stroke={stroke} strokeWidth={1.3} />
          <line x1={10} y1={0} x2={half} y2={0} stroke={stroke} strokeWidth={1.3} />
          <Fuse x={0} y={0} blown={blown} />
        </g>
      );
    case 'heater':
      // 发热丝的颜色由**功率**驱动（I²R），不是由温度：模型里的电热丝热容
      // 只有 9.2 J/K，焦耳定律预设下升温约 0.43 K/s，拿温度当渲染输入的话
      // 屏幕上永远是一根冷丝。冷态是金属灰，通电后渐变为橙→炽红，
      // 200ms 过渡让「调大电流」这件事在图上有连续的反馈。
      return (
        <g stroke={stroke} strokeWidth={1.3} fill="var(--card-bg)">
          <line x1={-half} y1={0} x2={-21} y2={0} />
          <rect x={-21} y={-10} width={42} height={20} rx={2} />
          <path
            d="M -15 5 q 3 -11 6 0 q 3 11 6 0 q 3 -11 6 0"
            fill="none"
            stroke={heatStroke(heatLevel(power))}
            strokeWidth={1.1}
            style={HEAT_STROKE_STYLE}
          />
          <line x1={21} y1={0} x2={half} y2={0} />
        </g>
      );
    case 'wire':
      return <line x1={-half} y1={0} x2={half} y2={0} stroke={stroke} strokeWidth={2} strokeLinecap="round" />;
    case 'ammeter':
    case 'voltmeter':
      return (
        <g>
          {/* 引线必须接到表壳边缘（±8），留 1 个单位的缝会在放大后看着像断线 */}
          <line x1={-half} y1={0} x2={-8} y2={0} stroke={stroke} strokeWidth={1.3} />
          <line x1={8} y1={0} x2={half} y2={0} stroke={stroke} strokeWidth={1.3} />
          {/* 表盘反向自转回正：表壳是正方形，端子在 ±x 不变，但竖起来的「A」
              会读成一个横折，学生第一眼认不出这是电流表。 */}
          <g transform={`rotate(${-Number(el.rotation ?? 0)})`}>
            <FixedMeter
              x={0}
              y={0}
              glyph={el.kind === 'ammeter' ? 'A' : 'V'}
              reading=""
              unit=""
              label={undefined}
              showReadout={false}
            />
          </g>
        </g>
      );
    case 'galvanometer':
      return (
        <g>
          <line x1={-half} y1={0} x2={-10} y2={0} stroke={stroke} strokeWidth={1.3} />
          <line x1={10} y1={0} x2={half} y2={0} stroke={stroke} strokeWidth={1.3} />
          <circle cx={0} cy={0} r={10} fill="var(--card-bg)" stroke={stroke} strokeWidth={1.2} />
          <text
            x={0}
            y={4}
            textAnchor="middle"
            fontSize={11}
            fill={stroke}
            fontFamily="var(--f-mono)"
            transform={`rotate(${-Number(el.rotation ?? 0)} 0 4)`}
          >
            G
          </text>
        </g>
      );
    default:
      return <circle cx={0} cy={0} r={12} fill="var(--card-bg)" stroke={stroke} />;
  }
}
