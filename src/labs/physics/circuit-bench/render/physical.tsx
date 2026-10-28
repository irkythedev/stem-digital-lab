/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 仿真图本体（physical）
 *
 * 与电路图共用同一套本地坐标：a 端仍在 +x、b 端仍在 −x，端子跨度由
 * TERMINAL_HALF_SPAN 决定。这里只把「本体长什么样」换掉，绝不碰接线柱位置，
 * 所以两种视图下导线端点、命中区、网表完全一致。
 *
 * 尺度：实物教具比教科书线稿大一圈（约 1.35–1.5x），端子在 core 里同步外扩，
 * 因此放大后的电池盒 / 闸刀座 / 灯头 / 表头仍然把接线柱留在壳外。
 *
 * 动效只用 CSS 的 transform / opacity / stroke-dashoffset：
 * - 灯丝光晕：基础半径写死，功率只映射到 transform: scale 与 opacity ——
 *   每帧改 `r` 会触发几何重排，缩放走合成层才不会掉帧；熄灯后 200ms 余热消退；
 * - 发热丝：功率映射笔触颜色，冷灰 → 炽红 200ms 过渡；
 * - 表针：读数映射角度，阻尼过渡模拟真表打表；超量程打到 42° 极限位；
 * - 闸刀：绕转轴旋转 0.2s，闭合瞬间落到刀座上。
 * 不跑 requestAnimationFrame，也不因动画触发 React 重渲染。
 *
 * 有极性元件（电池、A/V/G 表）的「+ / 红柱」永远是 a 端；端子坐标随 rotation
 * 一起旋转，因此 90°/180°/270° 下红柱不会跑到负极那边，读数也不会无故翻负。
 */
import type { CSSProperties } from 'react';

import { wiperLocalX } from '../circuit-bench-geometry';
import { meterGearLabel, meterGears, snapMeterRange } from '../circuit-bench-core';
import type { CircuitComponent, ElementKind, ElementReading } from '../circuit-bench-core';
import { HEAT_STROKE_STYLE, heatLevel, heatStroke } from './heat';
import type { BodyProps } from './types';

export type PhysicalBodyProps = BodyProps;

function numParam(el: CircuitComponent, key: string, fallback: number): number {
  const v = Number(el.params[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const metal = 'var(--muted)';
const failColor = 'var(--danger)';

/** 表针阻尼：0.25s 的回弹曲线，模拟真表上电时轻微打表。 */
const NEEDLE_STYLE: CSSProperties = {
  transformBox: 'fill-box',
  transformOrigin: '50% 100%',
  transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
};

/** 闸刀：绕左端转轴旋转，0.2s ease 落座。 */
const BLADE_STYLE: CSSProperties = {
  transformBox: 'fill-box',
  transformOrigin: '0% 100%',
  transition: 'transform 0.2s ease',
};

/**
 * 灯丝光晕的基准半径（世界单位）：玻璃泡半径 6.5 的约两倍，熄灯时刚好
 * 在泡外留一圈很淡的暖边；亮起来靠 scale 放大到 20（见 bulb 分支）。
 */
export const HALO_BASE_R = 12;

/**
 * 灯丝光晕：基础半径写死，功率只映射到 `scale` 与 `opacity` —— 两者都走合成层。
 * 早先是每帧算一个新 `r`，等于每帧重算几何、重排整棵子树，和「只动 opacity，
 * GPU 友好」的自我声明正好相反。基础半径的填充盒就是那颗圆，
 * 所以 `50% 50%` 恰好是泡心 (0,−23)，缩放不会把光晕拖歪。
 */
const HALO_STYLE: CSSProperties = {
  transformBox: 'fill-box',
  transformOrigin: '50% 50%',
  willChange: 'transform, opacity',
  transition: 'transform 200ms ease-out, opacity 200ms ease-out',
};

/** 满量程刻度位置（±40°）与超量程极限位（±42°）。 */
export const NEEDLE_FULL_DEG = 40;
export const NEEDLE_OVER_DEG = 42;
/** 超量程判定容差，与 core 的超量程告警同一口径（量程的 1.000001 倍）。 */
const OVER_TOLERANCE = 1.000001;

/**
 * 读数 → 表针偏角。`range` 是表盘量程：满量程打满 ±40°，**超量程再往外打到
 * ±42° 的极限位**——早先两边都夹在 40°，「刚好满偏」和「早就超了」在盘面上
 * 是同一幅画面，学生只能靠侧栏文字才知道表被撑住了。留出这 2° 的越界行程，
 * 再配上红色过载样式，指针顶到刻度假线之外一眼就能看出来。
 * 反向接入则向另一侧偏——比在表盘上写负号更像一块真表。
 *
 * 偏角**只由带符号读数决定**，与元件 rotation 无关：
 * 表盘外壳跟着元件转，但表盘（刻度 + 表针）整体反向自转 `upright = -rotation`
 * 回到正立，所以同一个正读数在任何角度都指屏幕右侧，接反了（读数为负）一律左偏。
 * 这正是学生的判读口径：右偏＝接对了，左偏＝表笔接反。
 *
 * 电流一律取 `currentAB`（正 = 由 a 端流向 b 端）：A/V/G 表的 a 端是红柱「+」，
 * 电流从 a 流入表内即正向接入，于是「红进黑出 → 右偏」自动成立。
 */
export function needleAngle(
  reading: ElementReading | undefined,
  quantity: 'current' | 'currentAB' | 'voltage',
  range: number,
): number {
  const limit = NEEDLE_OVER_DEG / NEEDLE_FULL_DEG;
  const t = Math.max(-limit, Math.min(limit, needleRatio(reading, quantity, range)));
  return t * NEEDLE_FULL_DEG;
}

/** 带符号读数 / 量程（未夹取）；量程非法或读数非有限值时按 0 处理。 */
export function needleRatio(
  reading: ElementReading | undefined,
  quantity: 'current' | 'currentAB' | 'voltage',
  range: number,
): number {
  const value = reading ? Number(reading[quantity]) : 0;
  if (!Number.isFinite(value) || range <= 0) return 0;
  return value / range;
}

/** 是否已越过满刻度（指针被顶到 42° 极限位）。 */
export function needleOverloaded(
  reading: ElementReading | undefined,
  quantity: 'current' | 'currentAB' | 'voltage',
  range: number,
): boolean {
  return Math.abs(needleRatio(reading, quantity, range)) > OVER_TOLERANCE;
}

/* ---------------------------------------------------------------- 表盘刻度 */

/**
 * A/V 表盘几何（面板本地坐标，转轴在 (0, 12)）。
 *
 * 排布照《学生电表》来：刻度弧在最外，短刻度线从弧线往里长；**刻度数字印在
 * 弧线外侧**，所以指针扫到满偏也压不住任何一位数字。两圈数字的半径差 4.2 ——
 * 4.4 号字的一行数字连行距约 3.2，留 4.2 才不会黏成一片。
 * 左端 −40°、右端 +40° 就是这块表的两个量程端点，弧线之外不再有刻度。
 */
const DIAL_PIVOT_Y = 12;
const DIAL_ARC_R = 12.4;
const DIAL_ROW_R = [19.2, 15.0];
/** 三等分刻度：0 / ⅓ / ⅔ / 满量程。两圈挡位（0.6 A 与 3 A、3 V 与 15 V）
 *  的量程比正好都是 5:1，所以两圈共用同一组角度。 */
const DIAL_MAIN_DEG = [-40, -40 / 3, 40 / 3, 40];
/** 等分之间的半格短刻度（只有刻度线，不带数字）。 */
const DIAL_MINOR_DEG = [-80 / 3, 0, 80 / 3];
const DIAL_TEXT_SIZE = 4.4;
/** SVG 的 `y` 是基线：抬 0.35em 才是「以点为中心」的字身。 */
const DIAL_TEXT_DY = 1.55;

/** 电流计圆表盘：转轴比 A/V 表低 2 个单位，圆面中心就是元件原点。 */
const G_DIAL_PIVOT_Y = 10;
const G_DIAL_ARC_R = 10.5;
/** 电流计是双向表：两侧每 10° 一道刻度，0 / ±20 / ±40 三道为主刻度。 */
const G_DIAL_DEG = [-40, -30, -20, -10, 0, 10, 20, 30, 40];

/** 极坐标 → 面板本地坐标。0° 指正上方，顺时针为正，与 CSS rotate 同向。 */
export function dialPoint(r: number, deg: number, pivotY = DIAL_PIVOT_Y): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: r * Math.sin(rad), y: pivotY - r * Math.cos(rad) };
}

/** 刻度弧路径：半径 r，从 from 扫到 to（度）。 */
export function dialArc(r: number, from: number, to: number, pivotY = DIAL_PIVOT_Y): string {
  const a = dialPoint(r, from, pivotY);
  const b = dialPoint(r, to, pivotY);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 ${to >= from ? 1 : 0} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/** 一道刻度线：从弧线（rOut）指向盘心方向（rIn）。 */
function dialTick(deg: number, rOut: number, rIn: number, pivotY = DIAL_PIVOT_Y) {
  const a = dialPoint(rOut, deg, pivotY);
  const b = dialPoint(rIn, deg, pivotY);
  return <line key={deg} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={0.9} stroke={metal} />;
}

/** 刻度数字：0.2 / 0.4 / 0.6 这类三分点不能印成 0.6000000000000001。 */
function tickLabel(v: number): string {
  return String(Number(v.toFixed(3)));
}

/**
 * 一圈刻度数字（整圈都描在一条弧上，字身始终保持水平正立）。
 * 活动的挡位满墨、另一圈压到 62% —— 两圈数字长得几乎一样，
 * 不给主次的话学生根本不知道读数该看哪一行。
 */
function dialRow(
  r: number,
  labels: string[],
  active: boolean,
  over: boolean,
  pivotY = DIAL_PIVOT_Y,
  degs: number[] = DIAL_MAIN_DEG,
) {
  return degs.map((deg, i) => {
    const p = dialPoint(r, deg, pivotY);
    return (
      <text
        key={deg}
        x={p.x}
        y={p.y + DIAL_TEXT_DY}
        textAnchor="middle"
        fontSize={DIAL_TEXT_SIZE}
        fill={active && over ? failColor : metal}
        fillOpacity={active ? 1 : 0.62}
        stroke="none"
        fontFamily="var(--f-mono)"
        data-dial-value={labels[i]}
      >
        {labels[i]}
      </text>
    );
  });
}

/**
 * 挡位 → 两圈刻度数字。数字串**宽**的那一圈放外圈：外圈半径大、横向余地足，
 * 「0.2」「15」这类三位/两位数字放在内圈会互相咬住。
 * 返回顺序即绘制顺序：`[0]` 外圈、`[1]` 内圈。
 */
function dialRows(kind: ElementKind, gear: number): Array<{ gear: number; labels: string[]; active: boolean }> {
  const gears = meterGears(kind) ?? [gear];
  const widest = (labels: string[]) => labels.reduce((m, s) => Math.max(m, s.length), 0);
  return gears
    .map((g) => ({
      gear: g,
      // 0 / ⅓ / ⅔ / 满量程：0.6 A 圈印 0 0.2 0.4 0.6，3 V 圈印 0 1 2 3。
      labels: [0, g / 3, (2 * g) / 3, g].map(tickLabel),
      active: g === gear,
    }))
    .sort((a, b) => widest(b.labels) - widest(a.labels));
}

export function PhysicalBody({ el, half, stroke, reading }: BodyProps) {
  const power = reading?.power ?? 0;
  const burnt = el.kind === 'bulb' && el.state.burnt;
  const blown = el.kind === 'fuse' && el.state.blown;
  /** 表盘反向自转的角度：让表壳随元件旋转、盘面始终正着看。 */
  const upright = -Number(el.rotation ?? 0);

  switch (el.kind) {
    case 'battery': {
      // 干电池：圆柱外壳 + 正极凸帽（凸帽在 a 侧）；电池上标的是它自己的电动势，
      // 不能写死 1.5V —— 预设里就有 3V / 6V 两种电源。
      const emf = numParam(el, 'emf', 6);
      const emfLabel = Number.isInteger(emf) ? String(emf) : emf.toFixed(1);
      return (
        <g stroke={stroke} strokeWidth={1.4} strokeLinecap="round">
          <line x1={-half} y1={0} x2={-15} y2={0} />
          <rect x={-15} y={-12.5} width={30} height={25} rx={3.5} fill="var(--card-bg)" />
          {/* 外壳高光/阴影，给一点圆柱感 */}
          <rect x={-15} y={-12.5} width={6} height={25} rx={3} fill={metal} stroke="none" opacity={0.18} />
          <rect x={9} y={-12.5} width={3} height={25} rx={1} fill={metal} stroke="none" opacity={0.12} />
          {/* 正极凸帽 + 环纹 */}
          <rect x={14} y={-6.5} width={4} height={13} rx={1.6} fill={metal} stroke="none" />
          <line x1={-10.5} y1={-12.5} x2={-10.5} y2={12.5} strokeWidth={0.8} stroke={metal} />
          <line x1={18} y1={0} x2={half} y2={0} />
          {/* 两端接线柱座（端子中心落在座子外沿），caps 用金属条引出。
              颜色跟着极性走：a 侧（+）红、b 侧（−）黑，和文字标识同色。 */}
          <rect x={-half} y={-4.5} width={6} height={9} rx={2} fill={stroke} stroke="none" opacity={0.7} />
          <rect x={half - 6} y={-4.5} width={6} height={9} rx={2} fill={failColor} stroke="none" opacity={0.9} />
          {/* 极性标识跟着端子走：a 侧红 +，b 侧黑 −；锚点正对各自接线柱座的中心 */}
          <text x={half - 3} y={-9.5} textAnchor="middle" fontSize={8} fill={failColor} stroke="none" fontFamily="var(--f-mono)" transform={`rotate(${upright} ${half - 3} -9.5)`}>
            +
          </text>
          <text x={-half + 3} y={-9.5} textAnchor="middle" fontSize={8} fill={stroke} stroke="none" fontFamily="var(--f-mono)" transform={`rotate(${upright} ${-half + 3} -9.5)`}>
            −
          </text>
          <text
            x={-0.5}
            y={4}
            textAnchor="middle"
            fontSize={9}
            fill={metal}
            stroke="none"
            fontFamily="var(--f-mono)"
            transform={`rotate(${upright} -0.5 4)`}
          >
            {emfLabel}V
          </text>
        </g>
      );
    }
    case 'bulb': {
      // 螺口灯泡：竖直旋进中间的绝缘灯座，玻璃泡朝上 —— 绝不横躺，导线也不许搭在玻璃泡上。
      // 底座是一块横贯两端子的胶木底板，两端各压一个金属接线柱：导线只落在
      // (±half, 0) 的接线柱上，再沿底板内部的金属引线走到灯座底部。
      // 灯座内部（被套筒遮住的部分）对应真实螺口的两个触点：一根引线接到
      // 灯头正下方的中心锡点，另一根接螺纹套侧面（外壳回路）；灯泡旋到底即接通。
      // 光晕亮度与铺开范围由实际功率映射（P = I²R）：开小灯是淡淡一圈暖色，
      // 满载才铺满玻璃泡外缘；熄灯时走 200ms 过渡，留一点余热。
      // 半径写死在 HALO_SCALE_R，功率只改 `scale`：每帧换 `r` 是改几何属性，
      // 会连带重算这颗圆的填充盒并触发子树重排；scale 只走合成层。
      // 取 scale = 1 + (2/3)·level 与原公式 12 + 8·level 在任意 level 上等值，
      // 所以这次只是换实现，观感一点没变（12 × (1 + ⅔·level) ≡ 12 + 8·level）。
      const rated = numParam(el, 'ratedPower', 3);
      const level = burnt ? 0 : Math.min(1, Math.sqrt(Math.max(0, power) / Math.max(0.2, rated)));
      const haloScale = 1 + (2 / 3) * level;
      const haloOpacity = 0.1 + 0.62 * level;
      const glowId = `cb-glow-${el.id}`;
      return (
        <g stroke={stroke} strokeWidth={1.4} strokeLinecap="round">
          <defs>
            <radialGradient id={glowId} gradientUnits="userSpaceOnUse" cx={0} cy={-23} r={HALO_BASE_R}>
              <stop offset="0%" stopColor="rgba(255, 222, 148, 0.95)" />
              <stop offset="45%" stopColor="rgba(255, 196, 92, 0.42)" />
              <stop offset="100%" stopColor="rgba(255, 176, 64, 0)" />
            </radialGradient>
          </defs>
          {/* 胶木底板：横贯两端子，接线柱落在它的两端。
              底板描边必须用低对比的金属灰，绝不能继承 --fg：底板宽度正好等于端子
              跨度，深色描边的上沿会从两个接线柱圆心之间横穿过去，看着像一根黑棒卡
              在柱子中间，下沿又像挂在元件下面的一副黑箍。 */}
          <rect
            x={-half}
            y={-6}
            width={half * 2}
            height={22}
            rx={4}
            fill={metal}
            fillOpacity={0.18}
            stroke={metal}
            strokeWidth={0.7}
            strokeOpacity={0.45}
          />
          <rect x={-half} y={-6} width={half * 2} height={3} rx={1.4} fill={metal} stroke="none" opacity={0.16} />
          {/* 底板内部走线：从两端接线柱各自走到灯座底部的两个触点（接头藏在套筒里），
              细而暗，压在底板上读成底座内部连线，而不是一根跨过底板的粗黑棒 */}
          <path d={`M ${-half + 3} 0 L -7 0 L -6 -4`} fill="none" strokeWidth={1.4} stroke={metal} strokeOpacity={0.7} />
          <path d={`M ${half - 3} 0 L 7 0 L 6 -4`} fill="none" strokeWidth={1.4} stroke={metal} strokeOpacity={0.7} />
          {/* 灯座套筒：灯泡从正上方竖直旋入 */}
          <rect x={-8.5} y={-10} width={17} height={6} rx={1.6} fill={metal} stroke="none" opacity={0.75} />
          <rect x={-8.5} y={-10} width={17} height={1.8} rx={0.9} fill="var(--card-bg)" stroke="none" opacity={0.3} />
          {/* 光晕：`r` 固定，功率只走 scale + opacity，两个属性都能留在合成层上，
              不产生每帧几何重排。渐变用的是 userSpaceOnUse，坐标系跟着元素自身的
              transform 一起缩放，所以泡心始终是渐变中心，光晕不会被拖歪。 */}
          <circle
            cx={0}
            cy={-23}
            r={HALO_BASE_R}
            fill={`url(#${glowId})`}
            opacity={haloOpacity}
            stroke="none"
            style={{ ...HALO_STYLE, transform: `scale(${haloScale})` }}
          />
          {/* 灯头（金属螺纹套）：下半截旋进灯座里，上半截露出螺纹 */}
          <rect x={-6} y={-16.5} width={12} height={7.5} rx={1.6} fill={metal} stroke="none" opacity={0.8} />
          {[-15, -13, -11].map((ty) => (
            <line key={ty} x1={-6} y1={ty} x2={6} y2={ty} stroke="var(--card-bg)" strokeWidth={1} />
          ))}
          {/* 玻璃泡：正坐在灯头上（下缘与螺纹套上沿相切），泡心 y=-23 */}
          <circle cx={0} cy={-23} r={6.5} fill="var(--card-bg)" />
          <circle
            cx={0}
            cy={-23}
            r={6.5}
            fill="rgba(255, 205, 110, 0.32)"
            opacity={level * 0.85}
            stroke="none"
            style={{ transition: 'opacity 200ms ease-out' }}
          />
          {/* 玻璃高光：一小段弧，让灯泡有体积而不是一块白饼 */}
          <path d="M -4.6 -26 A 5.6 5.6 0 0 1 -1.4 -28.5" fill="none" stroke="var(--card-bg)" strokeWidth={1.6} opacity={0.65} />
          {/* 灯丝：从灯头引上来，在泡内来回折两次，通电后变暖黄 */}
          <path
            d="M 0 -17 L 0 -21 L -2.5 -23 L 2.5 -25 L -2.5 -27 L 0 -28.5"
            fill="none"
            stroke={level > 0.1 ? '#ffb84d' : metal}
            strokeWidth={1.1}
            style={{ transition: 'stroke 200ms ease-out' }}
          />
          {/* 两端金属接线柱座 + 黄铜引线：端子中心正好落在座子外沿 */}
          <line x1={-half} y1={0} x2={-half + 3} y2={0} strokeWidth={2.4} stroke={metal} />
          <line x1={half - 3} y1={0} x2={half} y2={0} strokeWidth={2.4} stroke={metal} />
          <rect x={-half} y={-4.5} width={6} height={9} rx={2} fill={metal} stroke="none" opacity={0.55} />
          <rect x={half - 6} y={-4.5} width={6} height={9} rx={2} fill={metal} stroke="none" opacity={0.55} />
          {/* 烧毁的叉打在玻璃泡上（本体自己画，电路图那边才画在符号中心） */}
          {burnt && (
            <g stroke={failColor} strokeWidth={1.6} strokeLinecap="round">
              <line x1={-4.5} y1={-27.5} x2={4.5} y2={-19.5} />
              <line x1={4.5} y1={-27.5} x2={-4.5} y2={-19.5} />
            </g>
          )}
        </g>
      );
    }
    case 'resistor': {
      // 色环电阻：陶瓷管 + 四道色环
      return (
        <g stroke={stroke} strokeWidth={1.4}>
          <line x1={-half} y1={0} x2={-19} y2={0} />
          <rect x={-19} y={-8} width={38} height={16} rx={4} fill="var(--card-bg)" />
          <rect x={-19} y={-8} width={38} height={5.5} rx={2.6} fill={metal} stroke="none" opacity={0.16} />
          {/* 四道色环读作 1 0 ×100 ±5% = 1 kΩ —— 色环是**实物本身的颜色**，
              棕/黑/红/金必须写死，不能拿 --accent / --fg / --danger 去顶：
              那两个令牌在暗色主题里会翻成白与浅红，色环顺序一颠倒，学生按色环
              读出来的阻值就变了（黑环变白环 = 0 变 9）。 */}
          {[
            { x: -12.5, c: '#854d0e' },
            { x: -7.5, c: '#18181b' },
            { x: -2.5, c: '#b91c1c' },
            { x: 8, c: '#ca8a04' },
          ].map((band) => (
            <line key={band.x} x1={band.x} y1={-8} x2={band.x} y2={8} stroke={band.c} strokeWidth={3.2} />
          ))}
          <line x1={19} y1={0} x2={half} y2={0} />
          {/* 两端金属端帽：导线压在端帽上，不会直接扎进陶瓷管 */}
          <rect x={-21} y={-4.5} width={5} height={9} rx={2} fill={metal} stroke="none" opacity={0.6} />
          <rect x={16} y={-4.5} width={5} height={9} rx={2} fill={metal} stroke="none" opacity={0.6} />
        </g>
      );
    }
    case 'rheostat': {
      // 滑动变阻器实物：瓷筒 + 绕线 + 上方滑片。
      // 滑片（金属杆 + 手柄）跟着 `params.ratio` 在瓷筒上左右滑，和电路图上
      // 三角箭头的位置完全同步——两种视图读到的「接入阻值」必须看起来一样。
      const wx = wiperLocalX(el.params.ratio, 'physical');
      return (
        <g stroke={stroke} strokeWidth={1.4} fill="none">
          <line x1={-half} y1={0} x2={-25} y2={0} />
          <rect x={-25} y={-8.5} width={50} height={17} rx={2.5} fill="var(--card-bg)" />
          {Array.from({ length: 11 }, (_, i) => (
            <line
              key={i}
              x1={-21 + i * 4.2}
              y1={-7}
              x2={-21 + i * 4.2}
              y2={7}
              stroke={metal}
              strokeWidth={0.8}
            />
          ))}
          <line x1={wx} y1={-8.5} x2={wx} y2={-19} />
          <rect x={wx - 6} y={-22} width={12} height={3.4} rx={1.2} fill="var(--card-bg)" />
          <line x1={25} y1={0} x2={half} y2={0} />
          {/* 两端支架 + 接线柱座：端子落在瓷筒外侧的金属支架上 */}
          <rect x={-25} y={-10} width={5} height={20} rx={2} fill={metal} stroke="none" opacity={0.45} />
          <rect x={20} y={-10} width={5} height={20} rx={2} fill={metal} stroke="none" opacity={0.45} />
          <rect x={-half} y={-4.5} width={5} height={9} rx={2} fill={metal} stroke="none" opacity={0.55} />
          <rect x={half - 5} y={-4.5} width={5} height={9} rx={2} fill={metal} stroke="none" opacity={0.55} />
        </g>
      );
    }
    case 'switch': {
      // 闸刀开关：胶木底座 + 两个刀座 + 转轴刀片 + 绝缘手柄。
      // 底板左右对称，旋转 90° 后不会变成一根「贴在旁边的灰条」；
      // 刀座只画小方块，不画圆圈——接线柱本身已经有一圈金属环了。
      const closed = el.params.closed !== false;
      return (
        <g stroke={stroke} strokeWidth={1.5} strokeLinecap="round" fill="none">
          {/* 胶木底座横贯两端子：接线柱座落在底座上，导线不会搭到刀片或悬空 */}
          <rect
            x={-27}
            y={-12}
            width={54}
            height={24}
            rx={4}
            fill={metal}
            opacity={0.16}
            stroke={metal}
            strokeWidth={0.7}
            strokeOpacity={0.5}
          />
          {/* 两端刀座：矮金属方块，压在底板上；端子中心在方块外沿 */}
          <rect x={-27} y={-6.5} width={7.5} height={13} rx={1.6} fill={metal} stroke="none" opacity={0.5} />
          <rect x={19.5} y={-6.5} width={7.5} height={13} rx={1.6} fill={metal} stroke="none" opacity={0.5} />
          <line x1={-half} y1={0} x2={-23} y2={0} strokeWidth={2} stroke={metal} />
          <line x1={23} y1={0} x2={half} y2={0} strokeWidth={2} stroke={metal} />
          {/* 转轴 */}
          <circle cx={-18.5} cy={0} r={2.4} fill={metal} stroke="none" />
          {/* 刀片 + 绝缘手柄：几何按闭合位置绘制，断开时整组绕左端转轴旋转。
              组内包围盒的下沿正好是转轴 y=0，所以 transform-origin 用 0% 100%。 */}
          <g
            style={{
              ...BLADE_STYLE,
              transform: closed ? 'rotate(0deg)' : 'rotate(-38deg)',
            }}
          >
            <rect x={-18.5} y={-3} width={37} height={3} rx={1.2} fill={metal} stroke="none" />
            <rect x={14.5} y={-12} width={4} height={9} rx={1.6} fill={stroke} stroke="none" />
          </g>
        </g>
      );
    }
    case 'fuse': {
      // 玻璃管保险丝：两端金属帽 + 中间熔丝。
      // 熔断时必须**真的断开**：那根贯穿玻璃管的熔丝截成左右两截，中间留
      // 7 个世界单位的真空隙，断口上各凝一粒缩回的熔珠。早先是熔丝照旧
      // 从前帽连到后帽、只在旁边多打一个叉 —— 画面上熔丝仍然贯通，
      // 等于告诉学生「熔断了也还通着电」，与焦耳定律的因果正好相反。
      return (
        <g stroke={stroke} strokeWidth={1.4}>
          <line x1={-half} y1={0} x2={-15} y2={0} />
          <rect x={-15} y={-6} width={30} height={12} rx={6} fill="var(--card-bg)" />
          <rect x={-16} y={-6} width={4} height={12} rx={1.5} fill={metal} stroke="none" opacity={0.7} />
          <rect x={12} y={-6} width={4} height={12} rx={1.5} fill={metal} stroke="none" opacity={0.7} />
          {blown ? (
            <>
              <line x1={-9} y1={0} x2={-3.5} y2={0} strokeWidth={1.1} />
              <line x1={3.5} y1={0} x2={9} y2={0} strokeWidth={1.1} />
              <circle cx={-3.5} cy={0} r={1.5} fill={metal} stroke="none" />
              <circle cx={3.5} cy={0} r={1.5} fill={metal} stroke="none" />
            </>
          ) : (
            <line x1={-9} y1={0} x2={9} y2={0} strokeWidth={1.1} />
          )}
          <line x1={15} y1={0} x2={half} y2={0} />
          <rect x={-half} y={-4.5} width={5} height={9} rx={2} fill={metal} stroke="none" opacity={0.55} />
          <rect x={half - 5} y={-4.5} width={5} height={9} rx={2} fill={metal} stroke="none" opacity={0.55} />
        </g>
      );
    }
    case 'heater': {
      // 电热丝：底座 + 发热丝。丝的颜色由**功率**（I²R）驱动而不是温度：
      // 模型给这根丝的热容只有 9.2 J/K，焦耳定律预设（约 4 W）下升温约
      // 0.43 K/s，跑一分钟才升 26 K —— 拿温度当视觉阈值，屏幕上永远是一根冷丝。
      // 冷态是金属暗灰，通电后橙 → 炽红，200ms 过渡让「电流调大了」这件事
      // 在图上有连续反馈。
      return (
        <g stroke={stroke} strokeWidth={1.4} fill="none" strokeLinecap="round">
          <line x1={-half} y1={0} x2={-28} y2={0} />
          <rect x={-28} y={4} width={56} height={8} rx={2} fill={metal} stroke="none" opacity={0.35} />
          {/* 发热丝从一端接线柱一路折到另一端：路径首尾落在 x=±28（金属接线柱座的内沿），
              不留断头，读成一根真正压在瓷座上的镍铬丝。 */}
          <path
            d="M -28 0 L -21 -9 L -14 9 L -7 -9 L 0 9 L 7 -9 L 14 9 L 21 -9 L 28 0"
            stroke={heatStroke(heatLevel(power))}
            strokeWidth={1.8}
            style={HEAT_STROKE_STYLE}
          />
          <line x1={28} y1={0} x2={half} y2={0} />
          {/* 两端瓷座上的金属接线柱 */}
          <rect x={-half} y={-4.5} width={6} height={9} rx={2} fill={metal} stroke="none" opacity={0.55} />
          <rect x={half - 6} y={-4.5} width={6} height={9} rx={2} fill={metal} stroke="none" opacity={0.55} />
        </g>
      );
    }
    case 'wire': {
      // 导线：加粗线身 + 两端金属端头
      return (
        <g stroke={stroke} strokeWidth={3} strokeLinecap="round">
          <line x1={-half} y1={0} x2={half} y2={0} opacity={0.9} />
          <line x1={-half} y1={0} x2={-half + 5} y2={0} strokeWidth={5} stroke={metal} />
          <line x1={half - 5} y1={0} x2={half} y2={0} strokeWidth={5} stroke={metal} />
        </g>
      );
    }
    case 'ammeter':
    case 'voltmeter': {
      // 指针式仪表：面板式教具。面板宽度与端子跨度相同（±24），
      // 左右两端各一个香蕉插座——左黑「−」（b 端）、右红「+」（a 端），
      // 导线从面板边缘的插孔插入，而不是搭在塑料外壳顶面上。
      // 表盘反向自转回正，刻度与 A/V 字母始终正着看。
      // 插座的**颜色**必须跟着端子的实际位置走：座子画在本地 x=±24 处，
      // 而外壳整体被 rotate(rotation) 旋转，正好与 terminalOffsets 把 a 端
      // 送到 (h,0)→旋转后的位置完全一致，所以「红色红柱」永远是真 a 端，
      // 任何角度都不会出现「红柱接在负端」。
      const range = numParam(el, 'range', el.kind === 'voltmeter' ? 3 : 0.6);
      // 电压表看电压、电流表看电流。取数与判过载必须用同一个通道，
      // 否则会出现「表针打到 42° 极限位、盘面却不报警」这种半套状态。
      const quantity = el.kind === 'voltmeter' ? 'voltage' : 'currentAB';
      const angle = needleAngle(reading, el.kind === 'voltmeter' ? 'voltage' : 'currentAB', range);
      const ratio = needleRatio(reading, quantity, range);
      const over = Math.abs(ratio) > OVER_TOLERANCE;
      // 盘上印哪一挡：`snapMeterRange` 只认标准挡（0.6/3 A、3/15 V），
      // 于是「盘上印的数字」「表针量的量程」「核心判过载的阈值」是同一个数。
      const gear = snapMeterRange(el.kind, range) ?? range;
      const rows = dialRows(el.kind, gear);
      return (
        <g stroke={stroke} strokeWidth={1.4} strokeLinecap="round">
          {/* 面板随元件一起旋转：接线柱就在面板两端，转了也不会脱开 */}
          <rect x={-24} y={-17} width={48} height={34} rx={4} fill="var(--card-bg)" />
          <rect x={-24} y={-17} width={48} height={7} rx={3} fill={metal} stroke="none" opacity={0.16} />
          {/* 两端插座底座：端子中心压在这块金属座上，导线从座子插进来。
              左座（b 端）黑、右座（a 端）红，与「± / 红黑表笔」的教学约定一致。 */}
          <rect x={-27} y={-5} width={6} height={10} rx={2} fill={stroke} stroke="none" opacity={0.7} />
          <rect x={21} y={-5} width={6} height={10} rx={2} fill={failColor} stroke="none" opacity={0.9} />
          {/* 极性标识正对各自的插座圆心上沿，字体单独反向自转，任何角度都不倒头 */}
          <text x={-24} y={-9.5} textAnchor="middle" fontSize={7.5} fill={stroke} stroke="none" fontFamily="var(--f-mono)" transform={`rotate(${upright} -24 -9.5)`}>
            −
          </text>
          <text x={24} y={-9.5} textAnchor="middle" fontSize={7.5} fill={failColor} stroke="none" fontFamily="var(--f-mono)" transform={`rotate(${upright} 24 -9.5)`}>
            +
          </text>
          <g transform={`rotate(${upright})`} data-overload={over ? 'true' : undefined}>
            {/* 表盘窗口：上沿抬到 −13.5，给「量程名牌」留出一条带；
                两圈刻度数字印在刻度弧外侧，指针扫到满偏也压不住数字。 */}
            <rect x={-17} y={-13.5} width={34} height={29.5} rx={2} fill="none" stroke={metal} strokeWidth={0.7} opacity={0.4} />
            <text x={-15} y={-9} fontSize={6} fill={metal} stroke="none" fontFamily="var(--f-mono)">
              {el.kind === 'ammeter' ? 'A' : 'V'}
            </text>
            {/* 量程名牌：只印**当前挡位**（0.6 A / 3 V），过载时整块转成警示色 */}
            <text x={15} y={-9.4} textAnchor="end" fontSize={4.6} fill={over ? failColor : metal} stroke="none" fontFamily="var(--f-mono)">
              {meterGearLabel(el.kind, gear)}
            </text>
            <path d={dialArc(DIAL_ARC_R, -40, 40)} fill="none" strokeWidth={1.1} stroke={metal} />
            {DIAL_MAIN_DEG.map((deg) => dialTick(deg, DIAL_ARC_R, DIAL_ARC_R - 1.6))}
            {DIAL_MINOR_DEG.map((deg) => dialTick(deg, DIAL_ARC_R, DIAL_ARC_R - 0.9))}
            {rows.map((row, i) => (
              <g key={row.gear} data-dial-gear={row.gear} data-dial-active={row.active ? 'true' : undefined}>
                {dialRow(DIAL_ROW_R[i], row.labels, row.active, over)}
              </g>
            ))}
            {/* 过载：指针打到 42° 已越过 40° 的满偏刻度，再在那一端补一小段
                红色圆弧，把「已经出格」和「刚好满偏」在盘面上彻底分开 */}
            {over && (
              <path
                d={dialArc(DIAL_ARC_R, ratio > 0 ? 40 : -44, ratio > 0 ? 44 : -40)}
                fill="none"
                stroke={failColor}
                strokeWidth={1.7}
                opacity={0.85}
              />
            )}
            <g style={{ ...NEEDLE_STYLE, transform: `rotate(${angle}deg)` }}>
              <path d="M 0 12 L 0 2.5" strokeWidth={1.4} fill="none" stroke={over ? failColor : stroke} />
            </g>
            <circle cx={0} cy={12} r={1.8} fill={stroke} stroke="none" />
          </g>
        </g>
      );
    }
    case 'galvanometer': {
      // 灵敏电流计：方面板 + 圆形表盘，插座同样落在面板两端（左黑右红）
      const range = numParam(el, 'range', 0.05);
      const angle = needleAngle(reading, 'currentAB', range);
      const ratio = needleRatio(reading, 'currentAB', range);
      const over = Math.abs(ratio) > OVER_TOLERANCE;
      const gear = snapMeterRange(el.kind, range) ?? range;
      // 电流计只有一挡，盘上印的就是这一挡的对称满度值（±50 mA / ±5 mA）。
      // 挡位标签本来就是毫安，数字也印成毫安，学生不用在脑子里换算。
      const mag = tickLabel(gear * 1000);
      return (
        <g stroke={stroke} strokeWidth={1.4} strokeLinecap="round">
          <rect x={-24} y={-17} width={48} height={34} rx={4} fill="var(--card-bg)" />
          <rect x={-24} y={-17} width={48} height={7} rx={3} fill={metal} stroke="none" opacity={0.16} />
          <rect x={-27} y={-5} width={6} height={10} rx={2} fill={stroke} stroke="none" opacity={0.7} />
          <rect x={21} y={-5} width={6} height={10} rx={2} fill={failColor} stroke="none" opacity={0.9} />
          <text x={-24} y={-9.5} textAnchor="middle" fontSize={7.5} fill={stroke} stroke="none" fontFamily="var(--f-mono)" transform={`rotate(${upright} -24 -9.5)`}>
            −
          </text>
          <text x={24} y={-9.5} textAnchor="middle" fontSize={7.5} fill={failColor} stroke="none" fontFamily="var(--f-mono)" transform={`rotate(${upright} 24 -9.5)`}>
            +
          </text>
          <g transform={`rotate(${upright})`} data-overload={over ? 'true' : undefined}>
            {/* 圆形表盘：外圈只说明「这块表是圆的」，真刻度弧在圈里。
                半径 15 是为了让圈里同时容下刻度数字与左下角的单位注记。 */}
            <circle cx={0} cy={0} r={15} fill="none" stroke={metal} strokeWidth={0.7} opacity={0.4} />
            {/* `G` 抬到 −6.5：表盘下半圈要留给刻度弧与单位注记，
                字母原来正好压在弧线上，读数会被笔划切一刀 */}
            <text x={0} y={-6.5} textAnchor="middle" fontSize={9.5} fill={over ? failColor : metal} stroke="none" fontFamily="var(--f-mono)">
              G
            </text>
            <path d={dialArc(G_DIAL_ARC_R, -40, 40, G_DIAL_PIVOT_Y)} fill="none" strokeWidth={1.1} stroke={metal} />
            {G_DIAL_DEG.map((deg) => dialTick(deg, G_DIAL_ARC_R, G_DIAL_ARC_R - (deg % 20 === 0 ? 1.4 : 0.8), G_DIAL_PIVOT_Y))}
            {/* 双向表：零位在正中，两侧对称印 ±满度值，读数方向一眼可辨 */}
            {dialRow(12.6, [`-${mag}`, '0', `+${mag}`], true, over, G_DIAL_PIVOT_Y, [-40, 0, 40])}
            {/* 单位注记落在左下的空角：指针只扫过上半个扇面（±42°），
                转轴以下的区域永远没有指针经过，放单位既不挡读数也不挡针 */}
            <text x={-5.6} y={12} textAnchor="middle" fontSize={3.6} fill={over ? failColor : metal} stroke="none" fontFamily="var(--f-mono)">
              mA
            </text>
            {/* 过载：与 A/V 表同一条规矩 —— 指针越过 40° 满偏刻度，弧端补一截红色 */}
            {over && (
              <path
                d={dialArc(G_DIAL_ARC_R, ratio > 0 ? 40 : -44, ratio > 0 ? 44 : -40, G_DIAL_PIVOT_Y)}
                fill="none"
                stroke={failColor}
                strokeWidth={1.7}
                opacity={0.85}
              />
            )}
            <g style={{ ...NEEDLE_STYLE, transform: `rotate(${angle}deg)` }}>
              <path d="M 0 10 L 0 1.5" strokeWidth={1.4} fill="none" stroke={over ? failColor : stroke} />
            </g>
            <circle cx={0} cy={10} r={1.8} fill={stroke} stroke="none" />
          </g>
        </g>
      );
    }
    default:
      return (
        <g stroke={stroke} strokeWidth={1.4}>
          <line x1={-half} y1={0} x2={-12} y2={0} />
          <circle cx={0} cy={0} r={12} fill="var(--card-bg)" />
          <line x1={12} y1={0} x2={half} y2={0} />
        </g>
      );
  }
}
