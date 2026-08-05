/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 交互几何 SVG 组件：圆的性质探究（垂径定理 / 圆周角定理 / 直径对直角）。
 *
 * 三种模式共享同一 SVG 画布，通过 mode 切换几何配置。
 * 可拖动点约束在圆周上，角度/长度实时显示。
 *
 * 视觉纪律：只用 --fg / --muted / --border / --accent / --accent-light / --error。
 */

import { useCallback, useRef, useState, type PointerEvent } from 'react';

/* ── 布局常量 ── */

const CX = 250;
const CY = 200;
const R = 160;
const VIEWBOX = '0 0 500 440';
const HIT_R = 18; // 拖拽点点击半径（触屏友好，≥36px 命中区）

/* ── 几何工具函数 ── */

function angleToSvg(angle: number): { x: number; y: number } {
  return { x: CX + R * Math.cos(angle), y: CY - R * Math.sin(angle) };
}

function svgToAngle(svgX: number, svgY: number): number {
  return Math.atan2(CY - svgY, svgX - CX);
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/** 三点夹角（顶点在 b） */
function angleBetween(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
): number {
  const v1x = ax - bx;
  const v1y = ay - by;
  const v2x = cx - bx;
  const v2y = cy - by;
  const dot = v1x * v2x + v1y * v2y;
  const mag = Math.sqrt(v1x * v1x + v1y * v1y) * Math.sqrt(v2x * v2x + v2y * v2y);
  return Math.acos(Math.max(-1, Math.min(1, dot / mag)));
}

/** 两线段交点 */
function lineIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number,
): { x: number; y: number } | null {
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-10) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}

/** 弧度 → 度（保留 1 位小数） */
function toDeg(rad: number): string {
  return (rad * 180 / Math.PI).toFixed(1) + '°';
}

/* ── 模式类型 ── */

export type CircleMode = 'chord' | 'inscribed' | 'thales';

interface InteractiveCircleProps {
  mode: CircleMode;
  /** 垂径模式：弦端点 A 角度 */
  chordAngleA?: number;
  chordAngleB?: number;
  /** 圆周角模式：弧端点 B、C，动点 P */
  inscribedAngleB?: number;
  inscribedAngleC?: number;
  inscribedAngleP?: number;
  /** 直径直角模式：动点 C */
  thalesAngleC?: number;
  onChange?: (key: string, value: number) => void;
}

export default function InteractiveCircle({
  mode,
  chordAngleA = 2.5,
  chordAngleB = 3.8,
  inscribedAngleB = 0.5,
  inscribedAngleC = 2.0,
  inscribedAngleP = 3.0,
  thalesAngleC = 1.57,
  onChange,
}: InteractiveCircleProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  /* ── 当前角度状态（内部管理，同步到父级） ── */

  const [aAngle, setAAngle] = useState(chordAngleA);
  const [bAngle, setBAngle] = useState(chordAngleB);
  const [pAngle, setPAngle] = useState(inscribedAngleP);
  const [cAngleThales, setCAngleThales] = useState(thalesAngleC);

  /* ── 计算 SVG 坐标 ── */

  const a = angleToSvg(aAngle);
  const b = angleToSvg(bAngle);
  const p = angleToSvg(pAngle);
  const cT = angleToSvg(cAngleThales);

  // 圆周角模式：B、C 固定
  const bInsc = angleToSvg(inscribedAngleB);
  const cInsc = angleToSvg(inscribedAngleC);
  // Q 点（另一个圆周角顶点，固定）
  const qAngle = 4.5;
  const q = angleToSvg(qAngle);

  // 直径直角模式：A=0, B=π
  const aThales = angleToSvg(0);
  const bThales = angleToSvg(Math.PI);

  /* ── 垂径模式计算 ── */

  const chordMid = lineIntersect(a.x, a.y, b.x, b.y, CX, CY, CX + (b.y - a.y), CY - (b.x - a.x));
  const chordLen = dist(a.x, a.y, b.x, b.y);
  const halfChord = chordMid ? dist(chordMid.x, chordMid.y, a.x, a.y) : 0;
  const perpDist = chordMid ? dist(CX, CY, chordMid.x, chordMid.y) : 0;

  // 垂径（过圆心垂直于弦的直径）的两个端点
  const perpAngle = Math.atan2(CY - (chordMid?.y ?? CY), (chordMid?.x ?? CX) - CX);
  const perp1 = angleToSvg(perpAngle);
  const perp2 = angleToSvg(perpAngle + Math.PI);

  /* ── 圆周角模式计算 ── */

  const angleBPC = angleBetween(bInsc.x, bInsc.y, p.x, p.y, cInsc.x, cInsc.y);
  const angleBQC = angleBetween(bInsc.x, bInsc.y, q.x, q.y, cInsc.x, cInsc.y);

  /* ── 直径直角模式计算 ── */

  const angleACB = angleBetween(aThales.x, aThales.y, cT.x, cT.y, bThales.x, bThales.y);

  /* ── 拖拽处理 ── */

  const getSVGPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const svgPt = pt.matrixTransform(ctm.inverse());
    return svgPt;
  }, []);

  const handlePointerDown = useCallback((key: string) => (e: PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(key);
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragging) return;
    const svgPt = getSVGPoint(e.clientX, e.clientY);
    if (!svgPt) return;
    const newAngle = svgToAngle(svgPt.x, svgPt.y);

    switch (dragging) {
      case 'A':
        setAAngle(newAngle);
        onChange?.('chordAngleA', newAngle);
        break;
      case 'B':
        setBAngle(newAngle);
        onChange?.('chordAngleB', newAngle);
        break;
      case 'P':
        setPAngle(newAngle);
        onChange?.('inscribedAngleP', newAngle);
        break;
      case 'C':
        setCAngleThales(newAngle);
        onChange?.('thalesAngleC', newAngle);
        break;
    }
  }, [dragging, getSVGPoint, onChange]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  /* ── 渲染 ── */

  const isDragging = dragging !== null;

  return (
    <svg
      ref={svgRef}
      viewBox={VIEWBOX}
      className="w-full select-none touch-none max-h-[500px]"
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      aria-label={`圆的性质 - ${mode}`}
    >
      {/* 圆 */}
      <circle cx={CX} cy={CY} r={R}
        fill="none" stroke="var(--fg)" strokeWidth={1.5} />

      {/* 圆心 O */}
      <circle cx={CX} cy={CY} r={2.5} fill="var(--fg)" />
      <text x={CX + 6} y={CY - 6} fill="var(--fg)" fontSize={12} className="mono-font">O</text>

      {/* ── 垂径模式 ── */}
      {mode === 'chord' && (
        <g>
          {/* 弦 AB */}
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="var(--fg)" strokeWidth={1.5} />
          {/* 垂径 CD（过圆心垂直于弦的直径） */}
          <line x1={perp1.x} y1={perp1.y} x2={perp2.x} y2={perp2.y}
            stroke="var(--accent)" strokeWidth={1.2} strokeDasharray="5 3" />
          {/* 垂足 E */}
          {chordMid && (
            <>
              <circle cx={chordMid.x} cy={chordMid.y} r={2.5} fill="var(--accent)" />
              <text x={chordMid.x + 6} y={chordMid.y - 6}
                fill="var(--accent)" fontSize={12} className="mono-font">E</text>
              {/* 直角标记 */}
              <path d={`M ${chordMid.x + 6} ${chordMid.y} L ${chordMid.x + 6} ${chordMid.y - 6} L ${chordMid.x} ${chordMid.y - 6}`}
                fill="none" stroke="var(--muted)" strokeWidth={1} />
            </>
          )}
          {/* 标注 AE = EB */}
          {chordMid && (
            <>
              <text x={(a.x + chordMid.x) / 2} y={(a.y + chordMid.y) / 2 - 10}
                textAnchor="middle" fill="var(--muted)" fontSize={11} className="mono-font">
                AE = {halfChord.toFixed(1)}
              </text>
              <text x={(b.x + chordMid.x) / 2} y={(b.y + chordMid.y) / 2 - 10}
                textAnchor="middle" fill="var(--muted)" fontSize={11} className="mono-font">
                EB = {halfChord.toFixed(1)}
              </text>
              {/* 相等标记（小斜线） */}
              <line x1={(a.x + chordMid.x) / 2 - 4} y1={(a.y + chordMid.y) / 2 - 4}
                x2={(a.x + chordMid.x) / 2 + 4} y2={(a.y + chordMid.y) / 2 + 4}
                stroke="var(--muted)" strokeWidth={1.5} />
              <line x1={(b.x + chordMid.x) / 2 - 4} y1={(b.y + chordMid.y) / 2 - 4}
                x2={(b.x + chordMid.x) / 2 + 4} y2={(b.y + chordMid.y) / 2 + 4}
                stroke="var(--muted)" strokeWidth={1.5} />
            </>
          )}
          {/* 端点标签 */}
          <text x={a.x + 8} y={a.y - 4} fill="var(--fg)" fontSize={13} className="mono-font font-bold">A</text>
          <text x={b.x + 8} y={b.y - 4} fill="var(--fg)" fontSize={13} className="mono-font font-bold">B</text>
          <text x={perp1.x + 8} y={perp1.y - 4} fill="var(--accent)" fontSize={13} className="mono-font font-bold">C</text>
          <text x={perp2.x + 8} y={perp2.y - 4} fill="var(--accent)" fontSize={13} className="mono-font font-bold">D</text>
          {/* 数值显示 */}
          <text x={CX} y={CY + R + 30} textAnchor="middle" fill="var(--muted)" fontSize={12} className="mono-font">
            弦长 AB = {chordLen.toFixed(1)} &nbsp;|&nbsp; 圆心到弦距离 = {perpDist.toFixed(1)}
          </text>
          {halfChord > 0 && (
            <text x={CX} y={CY + R + 48} textAnchor="middle"
              fill={Math.abs(halfChord * 2 - chordLen) < 0.01 ? 'var(--fg)' : 'var(--muted)'}
              fontSize={13} className="mono-font">
              AE = EB = {halfChord.toFixed(1)} {Math.abs(halfChord * 2 - chordLen) < 0.01 ? '✓ 垂径定理成立' : ''}
            </text>
          )}
        </g>
      )}

      {/* ── 圆周角模式 ── */}
      {mode === 'inscribed' && (
        <g>
          {/* 弧 BC（高亮） */}
          <path d={(() => {
            // 画弧 BC（沿圆周从 B 到 C）
            const steps = 30;
            const startA = inscribedAngleB;
            const endA = inscribedAngleC;
            // 确保走短弧
            let diff = endA - startA;
            if (diff > Math.PI) diff -= 2 * Math.PI;
            if (diff < -Math.PI) diff += 2 * Math.PI;
            const pts: string[] = [];
            for (let i = 0; i <= steps; i++) {
              const t = i / steps;
              const a = startA + diff * t;
              const pt = angleToSvg(a);
              pts.push(`${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`);
            }
            return pts.join(' ');
          })()}
            fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" />

          {/* 弦 BP、PC */}
          <line x1={bInsc.x} y1={bInsc.y} x2={p.x} y2={p.y}
            stroke="var(--fg)" strokeWidth={1.2} />
          <line x1={p.x} y1={p.y} x2={cInsc.x} y2={cInsc.y}
            stroke="var(--fg)" strokeWidth={1.2} />
          {/* 弦 BQ、QC */}
          <line x1={bInsc.x} y1={bInsc.y} x2={q.x} y2={q.y}
            stroke="var(--muted)" strokeWidth={1} strokeDasharray="4 3" />
          <line x1={q.x} y1={q.y} x2={cInsc.x} y2={cInsc.y}
            stroke="var(--muted)" strokeWidth={1} strokeDasharray="4 3" />

          {/* 角度弧 ∠BPC */}
          <path d={(() => {
            const r = 30;
            const startAngle = Math.atan2(bInsc.y - p.y, bInsc.x - p.x);
            const endAngle = Math.atan2(cInsc.y - p.y, cInsc.x - p.x);
            const steps = 20;
            const pts: string[] = [];
            for (let i = 0; i <= steps; i++) {
              const t = i / steps;
              const a = startAngle + (endAngle - startAngle) * t;
              const x = p.x + r * Math.cos(a);
              const y = p.y + r * Math.sin(a);
              pts.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
            }
            return pts.join(' ');
          })()}
            fill="none" stroke="var(--accent)" strokeWidth={1.5} />

          {/* 角度弧 ∠BQC */}
          <path d={(() => {
            const r = 25;
            const startAngle = Math.atan2(bInsc.y - q.y, bInsc.x - q.x);
            const endAngle = Math.atan2(cInsc.y - q.y, cInsc.x - q.x);
            const steps = 20;
            const pts: string[] = [];
            for (let i = 0; i <= steps; i++) {
              const t = i / steps;
              const a = startAngle + (endAngle - startAngle) * t;
              const x = q.x + r * Math.cos(a);
              const y = q.y + r * Math.sin(a);
              pts.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
            }
            return pts.join(' ');
          })()}
            fill="none" stroke="var(--muted)" strokeWidth={1.2} strokeDasharray="3 2" />

          {/* 角度值标注 */}
          <text x={p.x + 20} y={p.y - 10} fill="var(--accent)" fontSize={12} className="mono-font font-bold">
            ∠BPC = {toDeg(angleBPC)}
          </text>
          <text x={q.x + 20} y={q.y - 10} fill="var(--muted)" fontSize={11} className="mono-font">
            ∠BQC = {toDeg(angleBQC)}
          </text>

          {/* 相等提示 */}
          {Math.abs(angleBPC - angleBQC) < 0.01 && (
            <text x={CX} y={CY + R + 30} textAnchor="middle"
              fill="var(--fg)" fontSize={13} className="mono-font">
              ∠BPC = ∠BQC = {toDeg(angleBPC)} ✓ 同弧所对圆周角相等
            </text>
          )}

          {/* 端点标签 */}
          <text x={bInsc.x + 8} y={bInsc.y - 4} fill="var(--fg)" fontSize={13} className="mono-font font-bold">B</text>
          <text x={cInsc.x + 8} y={cInsc.y - 4} fill="var(--fg)" fontSize={13} className="mono-font font-bold">C</text>
          <text x={q.x + 8} y={q.y - 4} fill="var(--muted)" fontSize={12} className="mono-font">Q</text>
        </g>
      )}

      {/* ── 直径直角模式 ── */}
      {mode === 'thales' && (
        <g>
          {/* 直径 AB */}
          <line x1={aThales.x} y1={aThales.y} x2={bThales.x} y2={bThales.y}
            stroke="var(--muted)" strokeWidth={1} strokeDasharray="4 3" />
          {/* 弦 AC、BC */}
          <line x1={aThales.x} y1={aThales.y} x2={cT.x} y2={cT.y}
            stroke="var(--fg)" strokeWidth={1.5} />
          <line x1={cT.x} y1={cT.y} x2={bThales.x} y2={bThales.y}
            stroke="var(--fg)" strokeWidth={1.5} />

          {/* 直角标记 */}
          <path d={(() => {
            const size = 14;
            const v1x = aThales.x - cT.x;
            const v1y = aThales.y - cT.y;
            const v1l = Math.sqrt(v1x * v1x + v1y * v1y);
            const u1x = v1x / v1l * size;
            const u1y = v1y / v1l * size;
            const v2x = bThales.x - cT.x;
            const v2y = bThales.y - cT.y;
            const v2l = Math.sqrt(v2x * v2x + v2y * v2y);
            const u2x = v2x / v2l * size;
            const u2y = v2y / v2l * size;
            const p1x = cT.x + u1x;
            const p1y = cT.y + u1y;
            const p2x = cT.x + u2x;
            const p2y = cT.y + u2y;
            return `M ${p1x} ${p1y} L ${p1x + u2x} ${p1y + u2y} L ${p2x} ${p2y}`;
          })()}
            fill="none" stroke="var(--accent)" strokeWidth={1.5} />

          {/* 角度值 */}
          <text x={cT.x + 20} y={cT.y - 10} fill="var(--accent)" fontSize={13} className="mono-font font-bold">
            ∠ACB = {toDeg(angleACB)}
          </text>

          {/* 90° 提示 */}
          {Math.abs(angleACB - Math.PI / 2) < 0.01 && (
            <text x={CX} y={CY + R + 30} textAnchor="middle"
              fill="var(--fg)" fontSize={13} className="mono-font">
              ∠ACB = 90° ✓ 直径所对圆周角为直角
            </text>
          )}

          {/* 端点标签 */}
          <text x={aThales.x + 8} y={aThales.y - 4} fill="var(--fg)" fontSize={13} className="mono-font font-bold">A</text>
          <text x={bThales.x - 20} y={bThales.y - 4} fill="var(--fg)" fontSize={13} className="mono-font font-bold">B</text>
        </g>
      )}

      {/* ── 可拖动点 ── */}
      {mode === 'chord' && (
        <>
          <circle cx={a.x} cy={a.y} r={HIT_R}
            fill="var(--card-bg)" stroke="var(--fg)" strokeWidth={2}
            style={{ cursor: 'grab' }}
            onPointerDown={handlePointerDown('A')} />
          <circle cx={b.x} cy={b.y} r={HIT_R}
            fill="var(--card-bg)" stroke="var(--fg)" strokeWidth={2}
            style={{ cursor: 'grab' }}
            onPointerDown={handlePointerDown('B')} />
        </>
      )}
      {mode === 'inscribed' && (
        <circle cx={p.x} cy={p.y} r={HIT_R}
          fill="var(--card-bg)" stroke="var(--accent)" strokeWidth={2}
          style={{ cursor: 'grab' }}
          onPointerDown={handlePointerDown('P')} />
      )}
      {mode === 'thales' && (
        <circle cx={cT.x} cy={cT.y} r={HIT_R}
          fill="var(--card-bg)" stroke="var(--fg)" strokeWidth={2}
          style={{ cursor: 'grab' }}
          onPointerDown={handlePointerDown('C')} />
      )}
    </svg>
  );
}
