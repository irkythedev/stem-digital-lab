/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 光具座 SVG 组件：凸透镜成像的交互可视化。
 * 渲染蜡烛、凸透镜、光屏、实像/虚像、两条特殊光线。
 *
 * 物理模型：v = uf/(u-f)，u=f 时不成像（平行光）。
 * 样式说明：只用 --fg / --muted / --border / --accent / --card-bg。
 */

import { useMemo } from 'react';
import { imageV } from '../../labs/physics/lens-core';
import { useApp } from '../../lib/app-context';

interface LensBenchProps {
  u: number;        // 物距 (cm)
  f: number;        // 焦距 (cm)
  showRays?: boolean;
}

/* ── 布局常量 ── */

const SCALE = 8;        // px/cm
/* u≈f 邻域像距会暴涨（实测 u=10.5cm → v=210cm、放大率 20×），按真实放大率绘制会得到
   720px 高的像并让光线冲出画布 → 绘制侧夹取；**读数 v 仍按公式如实显示**，不失真。 */
const IMG_H_MAX = 240;  // 绘制像高上限
const X_MIN = 24;       // 绘制左界（虚像位置同样会暴涨）
const LENS_X = 400;     // 透镜 x
const AXIS_Y = 150;     // 主光轴 y
const CANDLE_H = 36;    // 蜡烛体高 (px)
const FLAME_H = 18;     // 火焰高 (px)
const SCREEN_W = 6;     // 光屏宽
const SCREEN_H = 180;   // 光屏高
const CLAMP_MAX = 840;  // 光屏最大 x

/**
 * 光具座**可绘制量程**（像距，单位 cm）——即夹取边界反推的物理刻度带。
 * |v| 超出此带时像（或虚像）已被夹到导轨边缘，须给出「超出量程」学术提示；
 * 读数本身仍按公式如实显示（不失真），只是绘制位置不再可信。
 */
export const BENCH_V_MIN = (X_MIN - LENS_X) / SCALE;   // ≈ -47 cm
export const BENCH_V_MAX = (CLAMP_MAX - LENS_X) / SCALE; // ≈ +55 cm
export const isBeyondBench = (v: number | null): boolean =>
  v !== null && (v > BENCH_V_MAX || v < BENCH_V_MIN);

export default function LensBench({ u, f, showRays = false }: LensBenchProps) {
  const { t } = useApp();
  const v = useMemo(() => imageV(u, f), [u, f]);
  const mag = useMemo(() => (v !== null ? -v / u : 0), [u, v]);

  const candleX = LENS_X - u * SCALE;
  const isVirtual = v !== null && v < 0;
  const isNoImage = v === null;

  // 光屏 x（实像）
  const screenX = v !== null && v > 0
    ? Math.min(LENS_X + v * SCALE, CLAMP_MAX)
    : null;

  // 像高 & 缩放
  const imgH = v !== null ? Math.min(Math.abs(mag) * CANDLE_H, IMG_H_MAX) : 0; // 夹取：防像高溢出画布
  const imgS = imgH / CANDLE_H;

  // 虚像 x（同侧，v 为负）
  const virtualX = isVirtual ? Math.max(LENS_X + v * SCALE, X_MIN) : null; // 夹取：防虚像绘制到画布外

  // 蜡烛顶部（用于光线）
  const ctX = candleX;
  const ctY = AXIS_Y - CANDLE_H;

  // 像顶部
  const itX = isVirtual ? virtualX! : screenX!;
  const itY = isVirtual ? AXIS_Y - imgH : AXIS_Y + imgH;

  /* ── 渲染 ── */

  return (
    <svg viewBox="0 0 900 300" className="w-full" aria-label="光具座">
      {/* 主光轴 */}
      <line x1={30} y1={AXIS_Y} x2={870} y2={AXIS_Y}
        stroke="var(--muted)" strokeWidth={1} strokeDasharray="4 2" />

      {/* 焦点标记 */}
      {[-2, -1, 1, 2].map((n) => {
        const x = LENS_X + n * f * SCALE;
        const isF = Math.abs(n) === 1;
        const label = n === -2 ? '2F' : n === -1 ? 'F' : n === 1 ? "F'" : "2F'";
        const tickH = isF ? 10 : 7;
        return (
          <g key={n}>
            <line x1={x} y1={AXIS_Y - tickH} x2={x} y2={AXIS_Y + tickH}
              stroke={isF ? 'var(--fg)' : 'var(--muted)'} strokeWidth={isF ? 1.5 : 1} />
            <text x={x} y={AXIS_Y + (isF ? 24 : 20)}
              textAnchor="middle" fill={isF ? 'var(--fg)' : 'var(--muted)'}
              fontSize={isF ? 13 : 11} fontWeight={isF ? '600' : 'normal'} className="mono-font">{label}</text>
          </g>
        );
      })}

      {/* 光心 O */}
      <circle cx={LENS_X} cy={AXIS_Y} r={3} fill="var(--fg)" />
      <text x={LENS_X} y={AXIS_Y + 24} textAnchor="middle"
        fill="var(--fg)" fontSize={13} fontWeight="600" className="mono-font">O</text>

      {/* 凸透镜（双弧线） */}
      <path d={`M ${LENS_X} ${AXIS_Y - 60} Q ${LENS_X + 15} ${AXIS_Y} ${LENS_X} ${AXIS_Y + 60}`}
        fill="none" stroke="var(--fg)" strokeWidth={1.5} />
      <path d={`M ${LENS_X} ${AXIS_Y - 60} Q ${LENS_X - 15} ${AXIS_Y} ${LENS_X} ${AXIS_Y + 60}`}
        fill="none" stroke="var(--fg)" strokeWidth={1.5} />

      {/* ── 蜡烛 ── */}
      <g transform={`translate(${candleX}, ${AXIS_Y})`}>
        <rect x={-4} y={-CANDLE_H} width={8} height={CANDLE_H}
          fill="var(--fg)" opacity={0.85} />
        <line x1={0} y1={-CANDLE_H} x2={0} y2={-CANDLE_H - 2}
          stroke="var(--muted)" strokeWidth={1} />
        <ellipse cx={0} cy={-CANDLE_H - FLAME_H * 0.4}
          rx={3} ry={FLAME_H * 0.6} fill="#ff8c00" opacity={0.9} />
        <ellipse cx={0} cy={-CANDLE_H - FLAME_H * 0.35}
          rx={1.5} ry={FLAME_H * 0.4} fill="#ffd700" opacity={0.9} />
      </g>

      {/* ── 光屏 + 实像 ── */}
      {screenX !== null && (
        <g>
          <rect x={screenX - SCREEN_W / 2} y={AXIS_Y - SCREEN_H / 2}
            width={SCREEN_W} height={SCREEN_H}
            fill="var(--card-bg)" stroke="var(--border)" strokeWidth={1} />
          <line x1={screenX} y1={AXIS_Y + SCREEN_H / 2}
            x2={screenX} y2={AXIS_Y + SCREEN_H / 2 + 15}
            stroke="var(--muted)" strokeWidth={2} />
          {/* 倒立实像 */}
          {imgH > 0 && (
            <g transform={`translate(${screenX}, ${AXIS_Y})`}>
              <rect x={-4 * imgS} y={0} width={8 * imgS} height={imgH}
                fill="var(--fg)" opacity={0.5} />
              <ellipse cx={0} cy={imgH + FLAME_H * imgS * 0.4}
                rx={3 * imgS} ry={FLAME_H * imgS * 0.6}
                fill="#ff8c00" opacity={0.6} />
              <ellipse cx={0} cy={imgH + FLAME_H * imgS * 0.35}
                rx={1.5 * imgS} ry={FLAME_H * imgS * 0.4}
                fill="#ffd700" opacity={0.6} />
            </g>
          )}
        </g>
      )}

      {/* ── 虚像（正立，同侧，半透明虚线） ── */}
      {virtualX !== null && imgH > 0 && (
        <g transform={`translate(${virtualX}, ${AXIS_Y})`} opacity={0.5}>
          <rect x={-4 * imgS} y={-imgH} width={8 * imgS} height={imgH}
            fill="var(--fg)" stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 2" />
          <ellipse cx={0} cy={-imgH - FLAME_H * imgS * 0.4}
            rx={3 * imgS} ry={FLAME_H * imgS * 0.6}
            fill="#ff8c00" stroke="var(--muted)" strokeWidth={0.5} strokeDasharray="2 2" />
        </g>
      )}

      {/* ── 不成像提示 ── */}
      {isNoImage && (
        <text x={LENS_X + 60} y={AXIS_Y - 50}
          fill="var(--fg)" fontSize={15} fontWeight="600" className="mono-font">
          不成像（平行光）
        </text>
      )}

      {/* ── 两条特殊光线 ── */}
      {showRays && !isNoImage && (
        <g opacity={0.35}>
          {/* 光线1：平行于主光轴 → 过焦点 F' */}
          <line x1={ctX} y1={ctY} x2={LENS_X} y2={ctY}
            stroke="var(--accent)" strokeWidth={1.2} strokeDasharray="4 3" />
          {v !== null && v > 0 ? (
            <line x1={LENS_X} y1={ctY} x2={itX} y2={itY}
              stroke="var(--accent)" strokeWidth={1.2} />
          ) : (
            <>
              <line x1={LENS_X} y1={ctY}
                x2={LENS_X + f * SCALE * 2}
                y2={ctY + (AXIS_Y - ctY) * 2}
                stroke="var(--accent)" strokeWidth={1.2} />
              <line x1={LENS_X} y1={ctY} x2={virtualX!} y2={itY}
                stroke="var(--accent)" strokeWidth={1} strokeDasharray="3 3" />
            </>
          )}

          {/* 光线2：过光心 → 直线传播 */}
          <line x1={ctX} y1={ctY} x2={LENS_X} y2={AXIS_Y}
            stroke="var(--accent)" strokeWidth={1.2} />
          {v !== null && v > 0 ? (
            <line x1={LENS_X} y1={AXIS_Y} x2={itX} y2={itY}
              stroke="var(--accent)" strokeWidth={1.2} />
          ) : (
            <>
              {/* 右侧折射光线沿入射方向直线向右下延伸 */}
              <line x1={LENS_X} y1={AXIS_Y}
                x2={LENS_X + (LENS_X - ctX) * 2}
                y2={AXIS_Y + (AXIS_Y - ctY) * 2}
                stroke="var(--accent)" strokeWidth={1.2} />
              <line x1={LENS_X} y1={AXIS_Y} x2={virtualX!} y2={itY}
                stroke="var(--accent)" strokeWidth={1} strokeDasharray="3 3" />
            </>
          )}
        </g>
      )}

      {/* ── 物距 / 像距 标注 ── */}
      <text x={candleX + (LENS_X - candleX) / 2} y={AXIS_Y + 45}
        textAnchor="middle" fill="var(--fg)" fontSize={13} fontWeight="500" className="mono-font">
        u = {u.toFixed(1)} cm
      </text>
      {v !== null && v > 0 && (
        <text x={LENS_X + (screenX! - LENS_X) / 2} y={AXIS_Y + 45}
          textAnchor="middle" fill="var(--fg)" fontSize={13} fontWeight="500" className="mono-font">
          v = {v.toFixed(1)} cm
        </text>
      )}
      {isVirtual && (
        <text x={LENS_X + (virtualX! - LENS_X) / 2} y={AXIS_Y + 45}
          textAnchor="middle" fill="var(--fg)" fontSize={13} fontWeight="500" className="mono-font">
          |v| = {Math.abs(v!).toFixed(1)} cm
        </text>
      )}
      {/* 超程提示（导轨边缘）：像距超出光具座物理刻度带，绘制位置已夹取到边缘 */}
      {isBeyondBench(v) && (
        <text x={CLAMP_MAX} y={AXIS_Y - 10} textAnchor="end" fill="var(--error)" fontSize={11} className="mono-font">
          {t.lensOutOfBench}
        </text>
      )}
    </svg>
  );
}
