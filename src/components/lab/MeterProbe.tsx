/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 可拖动电表探针（电流表/电压表）——自由放置版。
 * 拖动到导线任意位置测电流（虚线预览连接）；拖动到元件两端之间测电压（跨接）。
 * 不符合实验规范的接法明确拒绝：电流表并联元件（短路）、电压表串联导线（断路）。
 *
 * 交互：
 *  - pointerdown 开始拖拽，pointermove 实时判定目标并画虚线预览，pointerup 吸附/拒绝/弹回
 *  - 电流表：最近导线垂足 < SNAP_R → 合法，虚线连导线；靠近灯泡本体 → 短路拒绝
 *  - 电压表：元件两端距离均 < CROSS_R → 跨接合法，双虚线连两端；最近导线 < SNAP_R → 断路拒绝
 *  - 拒绝：红色 X 标记 + 探针描边变红，释放后弹回原位并触发 onError
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** 可测量导线：线段 + 电流归属（测到的物理量） */
export interface MeasurableWire {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** 该导线上的电流归属：'i0' | 'i1' | 'i2' */
  current: string;
}

/** 可跨接元件：两端感应点 + 吸附落点 + 电压归属 */
export interface MeasurableComp {
  id: string;
  kind: 'bulb' | 'battery' | 'bus';
  /** 垂直元件标记（电池等 sense 上下分布的元件，引线走水平平行双线；缺省按 sense 几何判断） */
  vertical?: boolean;
  /** 跨接判定端点（元件真实两端） */
  sense1: { x: number; y: number };
  sense2: { x: number; y: number };
  /** 吸附落点（电压表就位位置，即表盘测点） */
  land: { x: number; y: number };
  /** 电压归属：'v1' | 'v2' | 'u' | 'v-elem' | 'v-batt' */
  voltage: string;
  /** 灯泡本体（电流表短路判定用）；无 body 的元件（如电池）电流表可接其支路导线 */
  body?: { cx: number; cy: number; r: number };
}

/** 探针吸附目标（父组件状态） */
export interface MeterTarget {
  id: string;
  x: number;
  y: number;
}

interface MeterProbeProps {
  kind: 'current' | 'voltage';
  wires: MeasurableWire[];
  comps: MeasurableComp[];
  /** 吸附到目标（合法放置）；null = 表笔悬空（拖到空白处弹回） */
  onPlace: (target: MeterTarget | null) => void;
  /** 非法接法（电流表并元件 / 电压表串导线）——父组件给出提示文案 */
  onError: () => void;
  initial?: { x: number; y: number };
  /** 当前吸附目标（外部状态，决定是否亮起） */
  active?: MeterTarget | null;
  /** 字母显示：A / V */
  glyph?: string;
}

const SNAP_R = 26; // 导线吸附半径（垂足距离）
const CROSS_R = 42; // 电压表跨接判定半径（到两端距离的最大值）
const BODY_ERR_R = 8; // 电流表距灯泡本体的短路拒绝余量

/** 点到线段最近距离 + 垂足 */
const distToSegment = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { d: number; fx: number; fy: number } => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { d: Math.hypot(px - x1, py - y1), fx: x1, fy: y1 };
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)), fx: x1 + t * dx, fy: y1 + t * dy };
};

/** 拖拽中的预览/拒绝状态 */
type Hover =
  | { type: 'wire'; id: string; fx: number; fy: number }
  | { type: 'comp'; id: string }
  | { type: 'err' } // 拒绝：A 并元件 / V 串导线
  | null;

export default function MeterProbe({
  kind,
  wires,
  comps,
  onPlace,
  onError,
  initial = { x: 120, y: 100 },
  active,
  glyph = kind === 'current' ? 'A' : 'V',
}: MeterProbeProps) {
  const [pos, setPos] = useState<{ x: number; y: number }>(initial);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<Hover>(null);
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);
  const probeRef = useRef<SVGGElement>(null);
  // 同步 ref：move 时写入，up 时立即读取（避免 setState 异步时序）
  const hoverRef = useRef<Hover>(null);

  // 外部状态变化（切串联/并联、重置）时同步探针位置到吸附测点
  useEffect(() => {
    if (dragging) return;
    if (active && (active.x !== pos.x || active.y !== pos.y)) {
      setPos({ x: active.x, y: active.y });
    }
  }, [dragging, active?.x, active?.y, pos.x, pos.y]);

  const startDrag = (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startY: e.clientY };
    setDragging(true);
    // 捕获指针：拖拽中指针移出探针也能继续跟随
    (e.currentTarget as SVGGElement).setPointerCapture?.(e.pointerId);
  };

  const toSvg = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = probeRef.current?.ownerSVGElement;
    if (!svg) return { x: pos.x, y: pos.y };
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return {
      x: ((clientX - rect.left) * vb.width) / rect.width,
      y: ((clientY - rect.top) * vb.height) / rect.height,
    };
  };

  /** 拖拽中判定：合法导线 / 合法跨接 / 拒绝（短路或断路） / 无目标 */
  const evaluate = (px: number, py: number): Hover => {
    // 最近导线垂足
    let bestWire: { id: string; d: number; fx: number; fy: number } | null = null;
    for (const w of wires) {
      const { d, fx, fy } = distToSegment(px, py, w.x1, w.y1, w.x2, w.y2);
      if (!bestWire || d < bestWire.d) bestWire = { id: w.id, d, fx, fy };
    }
    if (kind === 'current') {
      // 电流表：靠近灯泡本体 → 拒绝（并联元件会短路）
      for (const c of comps) {
        if (c.body && Math.hypot(px - c.body.cx, py - c.body.cy) - c.body.r < BODY_ERR_R) {
          return { type: 'err' };
        }
      }
      return bestWire && bestWire.d < SNAP_R
        ? { type: 'wire', id: bestWire.id, fx: bestWire.fx, fy: bestWire.fy }
        : null;
    }
    // 电压表：跨接优先
    let bestComp: { id: string; dMax: number } | null = null;
    for (const c of comps) {
      const dMax = Math.max(
        Math.hypot(px - c.sense1.x, py - c.sense1.y),
        Math.hypot(px - c.sense2.x, py - c.sense2.y)
      );
      if (!bestComp || dMax < bestComp.dMax) bestComp = { id: c.id, dMax };
    }
    if (bestComp && bestComp.dMax < CROSS_R) return { type: 'comp', id: bestComp.id };
    if (bestWire && bestWire.d < SNAP_R) return { type: 'err' }; // 电压表串导线
    return null;
  };

  const moveDrag = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    const p = toSvg(e.clientX, e.clientY);
    setPos(p);
    const h = evaluate(p.x, p.y);
    hoverRef.current = h;
    setHover(h);
  };

  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    const h = hoverRef.current;
    if (h?.type === 'wire') {
      const foot = { x: h.fx, y: h.fy };
      setPos(foot);
      onPlace({ id: h.id, ...foot });
    } else if (h?.type === 'comp') {
      const c = comps.find((x) => x.id === h.id);
      if (c) {
        setPos(c.land);
        onPlace({ id: c.id, x: c.land.x, y: c.land.y });
      } else {
        setPos(initial);
      }
    } else if (h?.type === 'err') {
      onError();
      setPos(initial);
    } else {
      setPos(initial);
      onPlace(null); // 拖到空白处：表笔悬空
    }
    hoverRef.current = null;
    setHover(null);
  };

  const isActive = !!active && !dragging;
  const hoverComp = hover?.type === 'comp' ? comps.find((c) => c.id === hover.id) : null;
  // 电压表吸附到元件两端：画两条实线连接（替代预画常显引线，体现"接上才显示"）
  const activeComp = kind === 'voltage' && active ? comps.find((c) => c.id === active.id) : null;

  // 引线：按元件方向自适应——
  // 水平元件（灯泡等，sense 左右分布）：垂直引出 → 门字形折入仪表左右边缘
  // 垂直元件（电池，sense 上下分布）：水平引出直连仪表左右边缘（避免引线穿电池本体）
  const PORT_OFF = 9;
  const isVerticalComp = (c: { sense1: { x: number; y: number }; sense2: { x: number; y: number }; vertical?: boolean }) =>
    c.vertical === true || (Math.abs(c.sense1.x - c.sense2.x) < 1 && Math.abs(c.sense1.y - c.sense2.y) > 1);
  const leadFrom = (side: 'left' | 'right', my: number, sx: number, sy: number, vertical: boolean) => {
    const mx = side === 'left' ? pos.x - PORT_OFF : pos.x + PORT_OFF;
    if (vertical) {
      // 垂直元件（电池）：正极接仪表左缘、负极接右缘，分接两侧避免仪表边框误视作短路线
      const mx = side === 'left' ? pos.x - PORT_OFF : pos.x + PORT_OFF;
      return `${sx},${sy} ${mx},${sy}`;
    }
    const myOff = side === 'left' ? my + 2 : my - 2;
    return `${sx},${sy} ${sx},${myOff} ${mx},${myOff}`;
  };
  const tNode = (cx: number, cy: number) => (
    <circle cx={cx} cy={cy} r="2.5" fill="var(--fg)" stroke="none" />
  );

  return (
    <>
      {/* 拖拽预览：虚线连接（viewBox 绝对坐标，在探针 g 之外） */}
      {dragging && hover?.type === 'wire' && (
        <g stroke="var(--fg)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" pointerEvents="none">
          <line x1={pos.x} y1={pos.y} x2={hover.fx} y2={hover.fy} />
          <circle
            cx={hover.fx}
            cy={hover.fy}
            r="2.5"
            fill="var(--card-bg)"
            stroke="var(--fg)"
            strokeDasharray="none"
            strokeWidth="1.2"
          />
        </g>
      )}
      {dragging && hover?.type === 'comp' && hoverComp && (
        <g stroke="var(--fg)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" pointerEvents="none">
          <polyline points={leadFrom('left', pos.y, hoverComp.sense1.x, hoverComp.sense1.y, isVerticalComp(hoverComp))} fill="none" />
          <polyline points={leadFrom('right', pos.y, hoverComp.sense2.x, hoverComp.sense2.y, isVerticalComp(hoverComp))} fill="none" />
          {tNode(hoverComp.sense1.x, hoverComp.sense1.y)}
          {tNode(hoverComp.sense2.x, hoverComp.sense2.y)}
        </g>
      )}
      {/* 拒绝预览：红色 X（非法接法，明确拒绝） */}
      {dragging && hover?.type === 'err' && (
        <g stroke="var(--error)" strokeWidth="1.6" pointerEvents="none">
          <line x1={pos.x - 5} y1={pos.y - 5} x2={pos.x + 5} y2={pos.y + 5} />
          <line x1={pos.x - 5} y1={pos.y + 5} x2={pos.x + 5} y2={pos.y - 5} />
        </g>
      )}
      {/* 已吸附：电压表并联连接线（实线，替代预画常显引线） */}
      {activeComp && (
        <g stroke="var(--fg)" strokeWidth="1.2" pointerEvents="none">
          <polyline points={leadFrom('left', pos.y, activeComp.sense1.x, activeComp.sense1.y, isVerticalComp(activeComp))} fill="none" />
          <polyline points={leadFrom('right', pos.y, activeComp.sense2.x, activeComp.sense2.y, isVerticalComp(activeComp))} fill="none" />
          {tNode(activeComp.sense1.x, activeComp.sense1.y)}
          {tNode(activeComp.sense2.x, activeComp.sense2.y)}
        </g>
      )}

      <g
        ref={probeRef}
        transform={`translate(${pos.x}, ${pos.y})`}
        className="cursor-grab"
        style={{ touchAction: 'none' }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* 透明触控命中区 60×44（覆盖接线孔，平板触控合格） */}
        <rect x="-30" y="-22" width="60" height="44" fill="transparent" />
        {/* 高亮：合法目标 */}
        {(hover?.type === 'wire' || hover?.type === 'comp') && (
          <rect x="-13" y="-13" width="26" height="26" rx="3" fill="none" stroke="var(--fg)" strokeWidth="1" strokeDasharray="3 2" />
        )}
        {/* 高亮：非法目标 */}
        {hover?.type === 'err' && (
          <rect x="-13" y="-13" width="26" height="26" rx="3" fill="none" stroke="var(--error)" strokeWidth="1.2" strokeDasharray="3 2" />
        )}
        {/* 中间矩形仪表符号：矩形内嵌 V/A（引线直接插进左右边缘 ±9，无外部接线孔） */}
        <rect x="-9" y="-9" width="18" height="18" rx="2" fill={isActive ? 'var(--accent-light)' : 'var(--bg)'} stroke={hover?.type === 'err' ? 'var(--error)' : 'var(--fg)'} strokeWidth="1.4" />
        <text x="0" y="4" textAnchor="middle" fontSize="12" fontWeight="bold" fill="var(--fg)" fontFamily="var(--f-mono)">{glyph}</text>
      </g>
    </>
  );
}
