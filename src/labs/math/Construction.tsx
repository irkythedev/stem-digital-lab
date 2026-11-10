/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学探究 · 尺规作图（人教版 七上–八上「基本作图」）
 *
 * 幕 1 预测：没有刻度怎么保证"到两端等距"？需要几个圆？
 * 幕 2 探索：只能做两件事——直尺过两点作直线、圆规以某点为心过另一点作圆；
 *            交点自动生成，撤销/重来靠重放。四关目标（垂直平分线 / 中点 / 角平分线 /
 *            过点作垂线），判定看几何命题，步数只作参考显示、不评星。
 * 幕 3 结论：四题，对照自己作出来的图。
 *
 * 复用：ExploreStage、StageNav；画布自绘 SVG。
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Compass, Play, RotateCcw, Ruler, Undo2, X } from 'lucide-react';
import { setLabState, setPageQuestion } from '../../lib/ai-dynamic-questions';
import { useApp } from '../../lib/app-context';
import { enumParam, numParam, readUrlParams, useLabUrlSync } from '../../lib/lab-url-state';
import { useIsDesktopLab } from '../../components/lab/useIsDesktopLab';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import StageNav from '../../components/lab/StageNav';
import CanvasSurface, { CanvasZoomControls } from '../../components/lab/CanvasSurface';
import LabStageShell from '../../components/lab/LabStageShell';
import DemoHud, { DEMO_HUD_COPY } from '../../components/lab/demo-hud';
import { useAutoTimeline } from '../../components/lab/use-auto-timeline';
import {
  type Cons,
  type Pt,
  type TaskDef,
  type Witness,
  EPS_PT,
  TASKS,
  buildScene,
  dist,
  midOf,
  previewIntersections,
  projectOnLine,
  validateCons,
} from './construction-core';
import { CONSTRUCTION_DEMO } from './construction-demo';
import { constructionViewForTask } from './construction-view';

type Stage = 'predict' | 'explore' | 'conclude';
type PredictAnswer = 'a' | 'b' | 'c' | null;
type QuizKey = 'q1' | 'q2' | 'q3' | 'q4';
type Tool = 'ruler' | 'compass';

const CHECK_ICON = <Check className="inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em]" aria-hidden="true" />;
const X_ICON = <X className="inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em]" aria-hidden="true" />;

/* ────────────────────────── 画布映射 ────────────────────────── */

const VIEW_W = 600;
const VIEW_H = 380;
/** 基础像素比例；实际每关由 constructionViewForTask 按关键点包围盒覆盖设置 */
const BASE_S = 24;
let S = BASE_S;
let CX = 300;
let CY = 190;
/** 命中半径：鼠标 22px / 触屏 28px；触屏判定点上移 28px，避开指腹 */
const HIT_R_MOUSE = 22;
const HIT_R_TOUCH = 28;
const TOUCH_OFFSET = 28;

const toS = (p: Pt) => ({ x: CX + p.x * S, y: CY - p.y * S });
const toMath = (px: number, py: number): Pt => ({ x: (px - CX) / S, y: (CY - py) / S });

/** 几何标记文字光晕：与 CoordPlane.TEXT_HALO 同口径，但不在本文件引入坐标系组件 */
const MARK_HALO = {
  stroke: 'var(--card-bg)',
  strokeWidth: 3,
  paintOrder: 'stroke' as const,
  strokeLinejoin: 'round' as const,
};

/** 过两点画穿整个画布的直线（靠 SVG viewBox 裁切） */
function extendedLine(a: Pt, b: Pt) {
  const sa = toS(a);
  const sb = toS(b);
  const dx = sb.x - sa.x;
  const dy = sb.y - sa.y;
  const l = Math.hypot(dx, dy) || 1;
  const ext = 3000;
  return {
    x1: sa.x - (dx / l) * ext,
    y1: sa.y - (dy / l) * ext,
    x2: sb.x + (dx / l) * ext,
    y2: sb.y + (dy / l) * ext,
  };
}

/** 屏幕空间直角：两条数学方向先转屏幕增量，再归一化，最后乘像素 size */
function markRightAngle(p: Pt, u: Pt, v: Pt, size = 9) {
  const c = toS(p);
  const ux = u.x;
  const uy = -u.y;
  const vx = v.x;
  const vy = -v.y;
  const ul = Math.hypot(ux, uy) || 1;
  const vl = Math.hypot(vx, vy) || 1;
  const p1 = `${c.x + (ux / ul) * size},${c.y + (uy / ul) * size}`;
  const p2 = `${c.x + (ux / ul) * size + (vx / vl) * size},${c.y + (uy / ul) * size + (vy / vl) * size}`;
  const p3 = `${c.x + (vx / vl) * size},${c.y + (vy / vl) * size}`;
  return <polyline points={`${p1} ${p2} ${p3}`} fill="none" stroke="var(--accent)" strokeWidth={1.6} pointerEvents="none" />;
}

/** 等长刻度：在 center 处画一道垂直于 dir 的短线 */
function markTick(center: Pt, dir: Pt, half = 5) {
  const c = toS(center);
  const ux = dir.x;
  const uy = -dir.y;
  const l = Math.hypot(ux, uy) || 1;
  const nx = -uy / l;
  const ny = ux / l;

  return (
    <line
      x1={c.x - nx * half} y1={c.y - ny * half}
      x2={c.x + nx * half} y2={c.y + ny * half}
      stroke="var(--accent)" strokeWidth={1.6} strokeLinecap="round" pointerEvents="none"
    />
  );
}

/** 归一化到 (-π, π] */
const normAngle = (a: number): number => {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x <= -Math.PI) x += Math.PI * 2;
  return x;
};

/** 以 center 为圆心、rPx 为像素半径，从 from 扫到 to 的短弧（数学角，逆时针为正） */
function markArc(center: Pt, rPx: number, from: number, to: number) {
  const d = normAngle(to - from);
  const c = toS(center);
  const n = 20;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = from + (d * i) / n;
    pts.push(`${c.x + rPx * Math.cos(t)},${c.y - rPx * Math.sin(t)}`);
  }
  return <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth={1.6} strokeLinecap="round" pointerEvents="none" />;
}

/**
 * 过关几何标记：把「命题成立」翻译成教材式图形语言。
 * 只画见证对象（witness），不重复判定；所有颜色走 --accent。
 */
function SolvedMarks({ task, witness }: { task: TaskDef; witness: Witness }) {
  const given = (id: string) => task.givens.find((g) => g.id === id);
  if (task.id === 'midpoint') {
    const A = given('A');
    const B = given('B');
    if (!A || !B || witness.kind !== 'point') return null;
    const m = witness.p;
    return (
      <g pointerEvents="none">
        {markTick(midOf(A, m), { x: B.x - A.x, y: B.y - A.y })}
        {markTick(midOf(m, B), { x: B.x - A.x, y: B.y - A.y })}
        <text x={toS(m).x + 8} y={toS(m).y - 10} fontSize="11" fontWeight="600" fill="var(--accent)" fontFamily="var(--f-mono)" {...MARK_HALO}>M</text>
      </g>
    );
  }
  if (task.id === 'perp-bisector') {
    const A = given('A');
    const B = given('B');
    if (!A || !B || witness.kind !== 'line') return null;
    const m = witness.point ?? midOf(A, B);
    const ab = { x: B.x - A.x, y: B.y - A.y };
    const lineDir = { x: witness.b.x - witness.a.x, y: witness.b.y - witness.a.y };
    return (
      <g pointerEvents="none">
        {markRightAngle(m, ab, lineDir, 9)}
        {markTick(midOf(A, m), ab)}
        {markTick(midOf(m, B), ab)}
        <text x={toS(m).x - 10} y={toS(m).y + 18} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--accent)" fontFamily="var(--f-mono)" {...MARK_HALO}>M</text>
      </g>
    );
  }
  if (task.id === 'angle-bisector') {
    const O = given('O');
    const A = given('A');
    const B = given('B');
    if (!O || !A || !B || witness.kind !== 'line') return null;
    const a0 = Math.atan2(A.y - O.y, A.x - O.x);
    const a2 = Math.atan2(B.y - O.y, B.x - O.x);
    // 见证线是无限直线，方向可能取反；先把它折到内角平分线一侧，
    // 否则两段弧会画成「外角 + 大弧」，看起来不是两个相邻等角。
    const midAngle = a0 + normAngle(a2 - a0) / 2;
    let a1 = Math.atan2(witness.b.y - witness.a.y, witness.b.x - witness.a.x);
    if (Math.abs(normAngle(a1 - midAngle)) > Math.PI / 2) a1 += Math.PI;
    // 双半径错位：同半径两弧会连成一条大弧，看不出「两个相邻角」
    const r1 = 22;
    const r2 = 26;
    const mid1 = a0 + normAngle(a1 - a0) / 2;
    const mid2 = a1 + normAngle(a2 - a1) / 2;
    const os = toS(O);
    const tickAt = (ang: number, rPx: number) => {
      const p1 = { x: os.x + (rPx - 3) * Math.cos(ang), y: os.y - (rPx - 3) * Math.sin(ang) };
      const p2 = { x: os.x + (rPx + 3) * Math.cos(ang), y: os.y - (rPx + 3) * Math.sin(ang) };
      return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--accent)" strokeWidth={1.4} strokeLinecap="round" pointerEvents="none" />;
    };
    const lab1 = { x: os.x + (r1 + 12) * Math.cos(mid1), y: os.y - (r1 + 12) * Math.sin(mid1) };
    const lab2 = { x: os.x + (r2 + 12) * Math.cos(mid2), y: os.y - (r2 + 12) * Math.sin(mid2) };
    return (
      <g pointerEvents="none">
        {markArc(O, r1, a0, a1)}
        {markArc(O, r2, a1, a2)}
        {tickAt(mid1, r1)}
        {tickAt(mid2, r2)}
        <text x={lab1.x} y={lab1.y} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--accent)" fontFamily="var(--f-mono)" {...MARK_HALO}>α</text>
        <text x={lab2.x} y={lab2.y} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--accent)" fontFamily="var(--f-mono)" {...MARK_HALO}>α</text>
      </g>
    );
  }
  if (task.id === 'perp-through') {
    const A = given('A');
    const B = given('B');
    const P = given('P');
    if (!A || !B || !P || witness.kind !== 'line') return null;
    const F = witness.point ?? projectOnLine(P, A, B);
    const ab = { x: B.x - A.x, y: B.y - A.y };
    const lineDir = { x: witness.b.x - witness.a.x, y: witness.b.y - witness.a.y };
    const ps = toS(P);
    const fs = toS(F);
    return (
      <g pointerEvents="none">
        <line x1={ps.x} y1={ps.y} x2={fs.x} y2={fs.y} stroke="var(--muted)" strokeWidth={1.2} strokeDasharray="4 3" />
        {markRightAngle(F, ab, lineDir, 9)}
        <text x={fs.x + 8} y={fs.y - 10} fontSize="11" fontWeight="600" fill="var(--accent)" fontFamily="var(--f-mono)" {...MARK_HALO}>F</text>
      </g>
    );
  }
  return null;
}

const copy = {
  zh: {
    stagePredict: '预测',
    stageExplore: '探索',
    stageConclude: '结论',
    stageDone: '完成',
    nextStage: '下一步 →',
    redoLabel: '重新探究',
    reset: '重来',
    undo: '撤销',
    zoomIn: '放大',
    zoomOut: '缩小',
    fitView: '自适应视野',
    ariaCanvas: '尺规作图工作区：可拖选的已知点和交点，用直尺或圆规作图',
    toolRuler: '直尺',
    toolCompass: '圆规',
    toolHint: {
      ruler: '点两个点 → 画出过这两点的直线',
      compass: '先点圆心，再点圆上一点 → 画出圆',
    },
    pickOne: '已选 1 个点，再选一个',
    pickNone: '点一个点开始',
    steps: (n: number) => `已作 ${n} 步`,
    stepsNote: '（步数只作参考，不评分）',
    warnSame: '同一点不能连成线，也不能作圆',
    warnDup: '这条线（或这个圆）已经画过了',
    taskTitle: '作图目标',
    hintLabel: '提示',
    demoStart: '看一次示范',
    hintHide: '收起提示',
    solved: '作出来了：目标达成',
    notSolved: '目标还没达成，继续作',
    tasks: ['垂直平分线', '找中点', '角平分线', '过点作垂线'],
    goals: [
      '作出线段 AB 的垂直平分线（一条同时过 AB 中点、并且垂直于 AB 的直线）',
      '作出线段 AB 的中点',
      '作出 ∠AOB 的平分线（过 O、把角分成相等两半的直线）',
      '过直线 AB 外的点 P，作一条垂直于 AB 的直线',
    ],
    hints: [
      '分别以 A、B 为圆心，用 AB 的长作半径画两个圆。它们交于两点，把这两点连起来。',
      '先按上一关作出垂直平分线，再让直尺过 A、B 画一条直线；垂分线与它的交点就是中点。',
      '先画直线 OB，再以 O 为圆心、过 A 作圆，它与直线 OB 在射线方向上交出一点；以这一点和 A 为圆心互相作圆，把交点与 O 连起来。',
      '先画直线 AB，再以 P 为圆心、过 A 作圆，它与直线 AB 又交于一点；以 A 和这个点为圆心互相作圆，两弧交点连成的直线就是所求。',
    ],
    legendGiven: '已知点',
    legendInter: '交点',
    legendLine: '作出的直线',
    legendCircle: '作出的圆',
    // 幕 1
    predictTitle: '预测',
    predictQuestion: '直尺没有刻度、圆规也不能量长度。那怎么能保证"作出来的直线正好在 AB 的正中间"？',
    predictQuestion2: '先别动手，凭直觉猜三个：',
    predictQ1: '作出 AB 的垂直平分线，最少要先画几个圆？',
    predictQ2: '两个半径相等的圆，它们的交点一定',
    predictQ3: '只用一把没有刻度的直尺，能不能作出线段的中点？',
    predQ1a: '两个',
    predQ1b: '一个',
    predQ1c: '一个也不用',
    predQ2a: '落在连心线上',
    predQ2b: '到两个圆心的距离相等',
    predQ2c: '只有一个',
    predQ3a: '能，折一下就行',
    predQ3b: '能，量出长度取一半',
    predQ3c: '不能',
    predictHint: '三题都猜完，就可以动手作图',
    revealLabel: '开始作图 →',
    // 幕 2
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。作出一关、或发现有意思的现象时记一条。',
    notePlaceholder: '写一句话：你观察到了什么？',
    recordLabel: '记一条观察',
    clearLabel: '清空记录',
    tryLabel: '去作这一关',
    cards: [
      { title: '两个等半径的圆', prompt: '以 A、B 为圆心、AB 为半径各画一个圆：两个交点在哪里？它们到 A、B 的距离是多少？' },
      { title: '中点从哪冒出来', prompt: '作出垂直平分线后，再让直尺过 A、B 画一条直线——交点凭空出现，它就是中点。' },
      { title: '角平分线', prompt: '∠AOB 里，以 O 为圆心作一个圆，它把两条边截出两个等距的点。' },
      { title: '过线外一点作垂线', prompt: '已知直线 AB 和线外一点 P，怎么让一条直线既过 P 又垂直于 AB？' },
    ],
    // 幕 3
    concludeTitle: '结论',
    concludeQuestion: '用你自己作出来的图回答：',
    concludeQ1: '作出 AB 的垂直平分线，最少要先画几个圆？',
    concludeQ2: '以 A、B 为圆心、AB 为半径的两个圆的交点 P、Q，它们',
    concludeQ3: '为什么过 P、Q 的直线就是 AB 的垂直平分线？',
    concludeQ4: '只用一把没有刻度的直尺，能作出线段 AB 的中点吗？',
    cq1A: '两个（分别以 A、B 为圆心，半径相等）',
    cq1B: '一个就够',
    cq1C: '一个都不用',
    cq2A: '到 A 的距离等于 AB，到 B 的距离不确定',
    cq2B: '到 A、到 B 的距离都等于 AB，所以都在 AB 的垂直平分线上',
    cq2C: '只有一个点满足到 A、B 等距',
    cq3A: '因为 PQ 是圆的直径',
    cq3B: '因为 A、B 都在这条直线上',
    cq3C: '因为到 A、B 距离相等的点都在 AB 的垂直平分线上，而 P、Q 都到 A、B 等距',
    cq4A: '能，把直尺对着线段折一下',
    cq4B: '能，用直尺量出长度再取一半',
    cq4C: '不能，必须先用圆规作出垂直平分线，它与 AB 的交点才是中点',
    feedbackTitle: '判分说明',
    feedbackText:
      '圆规的作用只有一个：画出「到某点距离相等」的点的集合。两个等半径的圆相交，交点同时到两个圆心等距，于是它必然落在一条「到 A、B 等距」的直线上——那条直线就是 AB 的垂直平分线。所以尺规作图靠的不是刻度，而是圆把等距关系变成了看得见的位置。',
    tipsTitle: '考点速记',
    tips: [
      '五种基本作图：作一条线段等于已知线段、作一个角等于已知角、作角的平分线、作线段的垂直平分线、过一点作已知直线的垂线。',
      '直尺只能过两点画线（不能量长度），圆规只能以定点为圆心、定长为半径画圆——尺规作图的全部工具就这两条。',
      '线段垂直平分线上的点到线段两端距离相等；反过来，到两端距离相等的点都在这条垂直平分线上。',
      '角平分线上的点到角两边距离相等；作角平分线的本质仍是"作出到两边等距的点"。',
    ],
    concludeHint: '四题都答完，可以对照上面的作图结果再看一遍。',
    evSolved: '条记录时已过关',
    evOpen: '条记录时还没过关',
  },
  en: {
    stagePredict: 'Predict',
    stageExplore: 'Explore',
    stageConclude: 'Conclude',
    stageDone: 'Done',
    nextStage: 'Next →',
    redoLabel: 'Explore again',
    reset: 'Restart',
    undo: 'Undo',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fitView: 'Fit view',
    ariaCanvas: 'Ruler-and-compass workspace with given points and intersection points',
    toolRuler: 'Straightedge',
    toolCompass: 'Compass',
    toolHint: {
      ruler: 'Tap two points → draw the line through them',
      compass: 'Tap the centre, then a point on the circle → draw the circle',
    },
    pickOne: '1 point picked, pick one more',
    pickNone: 'Pick a point to start',
    steps: (n: number) => `${n} step${n === 1 ? '' : 's'} taken`,
    stepsNote: '(steps are reference only, not graded)',
    warnSame: 'A point cannot be joined to itself',
    warnDup: 'That line (or circle) already exists',
    taskTitle: 'Goal',
    hintLabel: 'Hint',
    demoStart: 'Show solution',
    hintHide: 'Hide hint',
    solved: 'Done — goal reached',
    notSolved: 'Goal not reached yet, keep going',
    tasks: ['Perp. bisector', 'Midpoint', 'Angle bisector', 'Perp. through point'],
    goals: [
      'Construct the perpendicular bisector of segment AB (a line through its midpoint, perpendicular to AB)',
      'Construct the midpoint of segment AB',
      'Construct the bisector of ∠AOB (a line through O splitting the angle in half)',
      'Construct the line through P perpendicular to line AB, where P is not on AB',
    ],
    hints: [
      'Draw a circle centred at A through B, and one centred at B through A. They meet at two points — join them.',
      'Construct the perpendicular bisector as before, then draw the line through A and B. Where they cross is the midpoint.',
      'Draw line OB, then a circle centred at O through A; it meets line OB again along ray OB. Circle from that point through A and from A through that point, then join O to an intersection.',
      'Draw line AB, then a circle centred at P through A; it meets line AB again at another point. Circles from A and from that point through each other; the line through their intersections is what you want.',
    ],
    legendGiven: 'given point',
    legendInter: 'intersection',
    legendLine: 'drawn line',
    legendCircle: 'drawn circle',
    predictTitle: 'Predict',
    predictQuestion: 'The straightedge has no scale and the compass cannot measure. How can you be sure the line lands exactly halfway along AB?',
    predictQuestion2: 'Before you touch anything, guess all three:',
    predictQ1: 'How many circles must be drawn first to get the perpendicular bisector of AB?',
    predictQ2: 'Two circles of equal radius must have intersection points that',
    predictQ3: 'Can a straightedge alone construct the midpoint of a segment?',
    predQ1a: 'Two',
    predQ1b: 'One',
    predQ1c: 'None',
    predQ2a: 'lie on the line joining the centres',
    predQ2b: 'are equally far from both centres',
    predQ2c: 'are only one in number',
    predQ3a: 'Yes, just fold it',
    predQ3b: 'Yes, measure and halve',
    predQ3c: 'No',
    predictHint: 'Answer all three to start constructing',
    revealLabel: 'Start constructing →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Record one when you finish a goal or notice something.',
    notePlaceholder: 'One sentence: what did you notice?',
    recordLabel: 'Record',
    clearLabel: 'Clear',
    tryLabel: 'Go to this goal',
    cards: [
      { title: 'Two equal circles', prompt: 'Circles at A and B, both of radius AB: where are the intersections, and how far are they from A and B?' },
      { title: 'Where the midpoint comes from', prompt: 'After the perpendicular bisector, draw the line through A and B — the crossing point appears, and it is the midpoint.' },
      { title: 'Angle bisector', prompt: 'Inside ∠AOB, a circle centred at O cuts both sides at two points equally far from O.' },
      { title: 'Perpendicular through a point', prompt: 'Given line AB and a point P off it, how do you get a line through P that is perpendicular to AB?' },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Answer from the figure you actually constructed:',
    concludeQ1: 'The perpendicular bisector of AB needs at least',
    concludeQ2: 'The intersections P and Q of equal circles at A and B',
    concludeQ3: 'Why is the line through P and Q the perpendicular bisector of AB?',
    concludeQ4: 'Can a straightedge alone construct the midpoint of AB?',
    cq1A: 'two circles (centred at A and B, equal radius)',
    cq1B: 'one circle',
    cq1C: 'no circle at all',
    cq2A: 'are AB from A, but not necessarily from B',
    cq2B: 'are AB from both A and B, so both lie on the perpendicular bisector of AB',
    cq2C: 'include only one point equally far from A and B',
    cq3A: 'because PQ is a diameter',
    cq3B: 'because A and B both lie on that line',
    cq3C: 'because every point equally far from A and B lies on the perpendicular bisector, and P, Q both qualify',
    cq4A: 'Yes, fold the straightedge against the segment',
    cq4B: 'Yes, measure the length and halve it',
    cq4C: 'No — you must first construct the perpendicular bisector with the compass; its crossing with AB is the midpoint',
    feedbackTitle: 'Why',
    feedbackText:
      'The compass does exactly one thing: it draws the set of points a fixed distance from a point. Two equal circles cross at points equidistant from both centres, so those points must lie on the line of points equidistant from A and B — that line is the perpendicular bisector. Ruler-and-compass work runs on visible equal distances, not on measurement.',
    tipsTitle: 'Key points',
    tips: [
      'Five basic constructions: copy a segment, copy an angle, bisect an angle, construct a perpendicular bisector, drop a perpendicular through a point.',
      'A straightedge only joins two points (no measuring); a compass only draws a fixed radius about a point — those two rules are the whole toolkit.',
      'Every point on the perpendicular bisector of AB is equidistant from A and B; conversely every point equidistant from A and B lies on it.',
      'Every point on an angle bisector is equidistant from the two sides; constructing it is still a matter of producing equidistant points.',
    ],
    concludeHint: 'Once all four are answered, compare them with the figure you built.',
    evSolved: 'recorded after solving',
    evOpen: 'recorded before solving',
  },
} as const;

/** 每题选项：[值, 文案键]，顺序即渲染顺序 */
export const OPTIONS = {
  q1: [['two', 'cq1A'], ['one', 'cq1B'], ['none', 'cq1C']],
  q2: [['nearA', 'cq2A'], ['bothEqual', 'cq2B'], ['onlyOne', 'cq2C']],
  q3: [['diameter', 'cq3A'], ['onLine', 'cq3B'], ['equidistant', 'cq3C']],
  q4: [['fold', 'cq4A'], ['measure', 'cq4B'], ['compass', 'cq4C']],
} as const;

/** 每题正确选项值 */
export const QUIZ_CORRECT: Record<string, string[]> = {
  q1: ['two'],
  q2: ['bothEqual'],
  q3: ['equidistant'],
  q4: ['compass'],
};

export default function Construction() {
  const { lang } = useApp();
  const isDesktop = useIsDesktopLab();
  const t = copy[lang];
  const initialUrl = readUrlParams();

  const [stage, setStage] = useState<Stage>(() => enumParam(initialUrl.get('stage'), ['predict', 'explore', 'conclude'] as const, 'predict'));
  const [pred, setPred] = useState<{ q1: PredictAnswer; q2: PredictAnswer; q3: PredictAnswer }>({
    q1: null,
    q2: null,
    q3: null,
  });
  const [taskIdx, setTaskIdx] = useState(() => Math.round(numParam(initialUrl.get('task') ?? initialUrl.get('taskId') ?? initialUrl.get('goal'), 1, 1, 4)) - 1);
  const [cons, setCons] = useState<Cons[]>([]);
  const [tool, setTool] = useState<Tool>(() => enumParam(initialUrl.get('tool'), ['compass', 'ruler'] as const, 'compass'));
  const [picked, setPicked] = useState<string[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ sx: number; sy: number; math: Pt; touch: boolean } | null>(null);
  const [camera, setCamera] = useState({ zoom: 1, tx: 0, ty: 0 });
  useLabUrlSync({ stage, task: taskIdx + 1, tool }, { stage: 'predict', task: 1, tool: 'compass' }, [stage, taskIdx, tool]);
  const [warn, setWarn] = useState<string | null>(null);
  const [hintOn, setHintOn] = useState(false);
  const [demoSpeed, setDemoSpeed] = useState(1);
  const demoProgressRef = useRef(0);
  const demoCircleRef = useRef<SVGCircleElement>(null);
  const demoPulseRef = useRef<SVGCircleElement>(null);
  const demoLineMainRef = useRef<SVGLineElement>(null);
  const demoLineLeftRef = useRef<SVGLineElement>(null);
  const demoLineRightRef = useRef<SVGLineElement>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [conclusion, setConclusion] = useState<Record<QuizKey, string | null>>({ q1: null, q2: null, q3: null, q4: null });

  const task = TASKS[taskIdx];
  useEffect(() => {
    setCamera({ zoom: 1, tx: 0, ty: 0 });
  }, [taskIdx]);
  // ConstructionLab：每关固定取景（已知点 + 标准解关键交点），不随自由作图实时缩放。
  // 辅助圆外弧允许被 <clipPath> 裁切；只保证关键点落在安全边距内。
  const view = constructionViewForTask(task);
  S = view.s;
  CX = view.cx;
  CY = view.cy;
  const givenCenter = useMemo(() => {
    const pts = task.givens.map(toS);
    if (pts.length === 0) return { x: CX, y: CY };
    return { x: pts.reduce((sum, p) => sum + p.x, 0) / pts.length, y: pts.reduce((sum, p) => sum + p.y, 0) / pts.length };
  }, [task]);
  const scene = useMemo(() => buildScene(task.givens, cons), [task, cons]);
  const witness = useMemo(() => task.witness(scene), [task, scene]);
  const solved = witness !== null;

  const demoSteps = useMemo(() => CONSTRUCTION_DEMO[task.id] ?? [], [task.id]);
  const timeline = useAutoTimeline(demoSteps, {
    onStep: () => { demoProgressRef.current = 0; },
    onFrame: (_step, _index, progress) => {
      demoProgressRef.current = progress;
      const mainP = Math.min(1, progress / 0.7);
      const extP = Math.max(0, (progress - 0.7) / 0.3);
      demoCircleRef.current?.setAttribute('stroke-dashoffset', String(1 - progress));
      demoPulseRef.current?.setAttribute('r', String(10 + 6 * Math.sin(Math.PI * progress)));
      demoPulseRef.current?.setAttribute('opacity', String(0.35 * (1 - progress)));
      demoLineMainRef.current?.setAttribute('stroke-dashoffset', String(1 - mainP));
      demoLineLeftRef.current?.setAttribute('stroke-dashoffset', String(1 - extP));
      demoLineRightRef.current?.setAttribute('stroke-dashoffset', String(1 - extP));
      demoLineLeftRef.current?.setAttribute('opacity', progress > 0.7 ? '0.75' : '0');
      demoLineRightRef.current?.setAttribute('opacity', progress > 0.7 ? '0.75' : '0');
    },
  });

  const demoPrefixCons = useMemo(
    () => demoSteps.slice(0, timeline.index).map((s) => s.data.cons),
    [demoSteps, timeline.index],
  );
  const demoPrefixScene = useMemo(
    () => buildScene(task.givens, demoPrefixCons),
    [task, demoPrefixCons],
  );
  const demoCurrent = timeline.active ? demoSteps[timeline.index] ?? null : null;
  const demoCurrentCons = demoCurrent?.data.cons ?? null;
  const demoCurrentScene = useMemo(
    () => (demoCurrentCons ? buildScene(task.givens, [...demoPrefixCons, demoCurrentCons]) : demoPrefixScene),
    [task, demoPrefixCons, demoCurrentCons, demoPrefixScene],
  );
  const demoNewPoints = useMemo(
    () => (demoCurrentCons ? previewIntersections(demoPrefixScene, demoCurrentCons) : []),
    [demoPrefixScene, demoCurrentCons],
  );
  const demoProgress = timeline.progress;
  const showDemoPoints = timeline.active && demoProgress > 0.55;
  const displayCircles = timeline.active ? demoPrefixScene.circles : scene.circles;
  const displayLines = timeline.active ? demoPrefixScene.lines : scene.lines;
  const displayPoints = timeline.active ? demoPrefixScene.points : scene.points;
  const demoWitness = useMemo(
    () => (timeline.active && demoCurrentCons && demoProgress > 0.95 ? task.witness(demoCurrentScene) : null),
    [timeline.active, demoCurrentCons, demoProgress, task, demoCurrentScene],
  );
  const shownWitness = timeline.active ? demoWitness : witness;
  const shownSolved = timeline.active ? demoWitness !== null : solved;

  const demoCircle = useMemo(() => {
    if (!demoCurrentCons || demoCurrentCons.kind !== 'circle') return null;
    const c = demoPrefixScene.points.find((p) => p.id === demoCurrentCons.c);
    const p = demoPrefixScene.points.find((q) => q.id === demoCurrentCons.p);
    return c && p ? { c, p, r: dist(c, p) } : null;
  }, [demoCurrentCons, demoPrefixScene]);

  const demoLine = useMemo(() => {
    if (!demoCurrentCons || demoCurrentCons.kind !== 'line') return null;
    const a = demoPrefixScene.points.find((p) => p.id === demoCurrentCons.a);
    const b = demoPrefixScene.points.find((p) => p.id === demoCurrentCons.b);
    if (!a || !b) return null;
    const sa = toS(a);
    const sb = toS(b);
    const dx = sb.x - sa.x;
    const dy = sb.y - sa.y;
    const l = Math.hypot(dx, dy) || 1;
    const ux = dx / l;
    const uy = dy / l;
    const ext = 3000;
    return {
      a: sa,
      b: sb,
      left: { x: sa.x - ux * ext, y: sa.y - uy * ext },
      right: { x: sb.x + ux * ext, y: sb.y + uy * ext },
    };
  }, [demoCurrentCons, demoPrefixScene]);

  const predComplete = pred.q1 !== null && pred.q2 !== null && pred.q3 !== null;
  const conclusionComplete = (Object.keys(conclusion) as QuizKey[]).every((key) => conclusion[key] !== null);

  const clearWork = () => {
    timeline.stop();
    setCons([]);
    setPicked([]);
    setWarn(null);
  };

  const switchTask = (i: number) => {
    setTaskIdx(i);
    clearWork();
    setHintOn(false);
  };

  const onPick = (id: string) => {
    setWarn(null);
    if (picked.includes(id)) {
      setPicked(picked.filter((p) => p !== id));
      return;
    }
    const next = [...picked, id];
    if (next.length < 2) {
      setPicked(next);
      return;
    }
    const [a, b] = next;
    const con: Cons = tool === 'ruler' ? { kind: 'line', a, b } : { kind: 'circle', c: a, p: b };
    const v = validateCons(scene, con);
    if (!v.ok) {
      setWarn(v.reason === 'dup' ? t.warnDup : t.warnSame);
      setPicked([]);
      return;
    }
    setCons([...cons, con]);
    setPicked([]);
  };

  /** 接管：把当前已演示到的步骤（含当前步）克隆进自由作图场景 */
  const takeover = () => {
    if (!timeline.active) return;
    const steps = demoSteps.slice(0, timeline.index + 1).map((s) => s.data.cons);
    setCons(steps);
    setTool(demoSteps[timeline.index]?.data.tool ?? tool);
    setPicked([]);
    setWarn(null);
    timeline.stop();
  };

  const startDemo = () => {
    if (demoSteps.length === 0) return;
    setPicked([]);
    setWarn(null);
    setHintOn(false);
    timeline.start();
  };

  const cycleSpeed = () => {
    const next = demoSpeed === 1 ? 1.5 : demoSpeed === 1.5 ? 0.5 : 1;
    setDemoSpeed(next);
    timeline.setSpeed(next);
  };

  /** 单层最近点：相同距离（±0.5px）时已知点优先，避免交点抢走端点 */
  const nearestPoint = (p: Pt, radiusPx: number): string | null => {
    let best: string | null = null;
    let bestD = radiusPx;
    const ps = toS(p);
    for (const pt of scene.points) {
      const sp = toS(pt);
      const d = Math.hypot(sp.x - ps.x, sp.y - ps.y);
      if (d < bestD - 0.5 || (Math.abs(d - bestD) <= 0.5 && pt.kind === 'given')) {
        bestD = d;
        best = pt.id;
      }
    }
    return best;
  };

  /** 把指针事件换成 SVG 内部坐标；触屏判定点上移 28px */
  const readPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const rawX = ((e.clientX - r.left) * VIEW_W) / r.width;
    const rawY = ((e.clientY - r.top) * VIEW_H) / r.height;
    const touch = e.pointerType === 'touch';
    // 先应用触屏判定偏移，再逆向 camera（translate + scale），保证缩放后仍 1:1 跟手
    const baseX = (rawX - camera.tx) / camera.zoom;
    const baseY = (rawY - (touch ? TOUCH_OFFSET : 0) - camera.ty) / camera.zoom;
    return { px: baseX, py: baseY, math: toMath(baseX, baseY), touch };
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (timeline.active) return;
    const p = readPointer(e);
    setPointer({ sx: p.px, sy: p.py, math: p.math, touch: p.touch });
    setHoverId(nearestPoint(p.math, (p.touch ? HIT_R_TOUCH : HIT_R_MOUSE) / camera.zoom));
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    // 首次触摸只接管，不落点；阻止冒泡，避免同一次触摸又被当成选点
    if (timeline.active) {
      e.preventDefault();
      e.stopPropagation();
      takeover();
      return;
    }
    const p = readPointer(e);
    setPointer({ sx: p.px, sy: p.py, math: p.math, touch: p.touch });
    const id = nearestPoint(p.math, (p.touch ? HIT_R_TOUCH : HIT_R_MOUSE) / camera.zoom);
    setHoverId(id);
    if (id) onPick(id);
  };

  const handlePointerLeave = () => {
    setPointer(null);
    setHoverId(null);
  };

  /** 触屏抬手后收起准星；鼠标保留 cursor 供虚线预览继续跟随 */
  const handlePointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') {
      setPointer(null);
      setHoverId(null);
    }
  };

  /** 选中第一个点后的预览：虚线幽灵 + 即将出现的交点小环 */
  const preview = useMemo(() => {
    if (picked.length !== 1 || !pointer) return null;
    const from = scene.points.find((p) => p.id === picked[0]);
    if (!from) return null;
    const hovered = hoverId && hoverId !== picked[0] ? scene.points.find((p) => p.id === hoverId) : null;
    const target = hovered ?? { id: '__cursor', x: pointer.math.x, y: pointer.math.y, kind: 'inter' as const };
    if (dist(from, target) < EPS_PT) return null;
    const tempScene = {
      ...scene,
      points: [...scene.points, { id: '__cursor', x: target.x, y: target.y, kind: 'inter' as const }],
    };
    const con: Cons = tool === 'ruler'
      ? { kind: 'line', a: from.id, b: '__cursor' }
      : { kind: 'circle', c: from.id, p: '__cursor' };
    return { from, target, pts: previewIntersections(tempScene, con) };
  }, [picked, pointer, hoverId, tool, scene]);

  const previewLine = preview && tool === 'ruler' ? extendedLine(preview.from, preview.target) : null;
  const previewCircle = preview && tool === 'compass'
    ? { c: toS(preview.from), r: dist(preview.from, preview.target) * S }
    : null;

  const addObservation = (note: string) => {
    setObservations((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        snapshot: [
          { label: lang === 'zh' ? '目标' : 'Goal', value: t.tasks[taskIdx] },
          { label: lang === 'zh' ? '步数' : 'Steps', value: String(cons.length) },
          { label: lang === 'zh' ? '交点数' : 'Points', value: String(scene.points.filter((p) => p.kind === 'inter').length) },
        ],
        balanced: solved,
        note,
      },
    ]);
  };

  const cards: ExploreCard[] = [
    { key: 'card-1', title: t.cards[0].title, prompt: t.cards[0].prompt, tryLabel: t.tryLabel, tryIt: () => switchTask(0) },
    { key: 'card-2', title: t.cards[1].title, prompt: t.cards[1].prompt, tryLabel: t.tryLabel, tryIt: () => switchTask(1) },
    { key: 'card-3', title: t.cards[2].title, prompt: t.cards[2].prompt, tryLabel: t.tryLabel, tryIt: () => switchTask(2) },
    { key: 'card-4', title: t.cards[3].title, prompt: t.cards[3].prompt, tryLabel: t.tryLabel, tryIt: () => switchTask(3) },
  ];

  const resetAll = () => {
    timeline.stop();
    setStage('predict');
    setPred({ q1: null, q2: null, q3: null });
    setTaskIdx(0);
    setCons([]);
    setPicked([]);
    setWarn(null);
    setHintOn(false);
    setObservations([]);
    setConclusion({ q1: null, q2: null, q3: null, q4: null });
  };

  const optionRow = (key: QuizKey) => {
    const items = OPTIONS[key] as unknown as [string, string][];
    return (
      <div className="grid grid-cols-1 gap-2">
        {items.map(([value, labelKey]) => {
          const chosen = conclusion[key] === value;
          const correct = (QUIZ_CORRECT[key] || []).includes(value);
          const answered = conclusion[key] !== null;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setConclusion((prev) => ({ ...prev, [key]: value }))}
              className={`text-left text-xs px-3 py-2 border rounded-lg transition-colors min-h-[40px] leading-snug flex items-start gap-2 ${
                chosen ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
              }`}
            >
              <span className="flex-1">{(t as unknown as Record<string, string>)[labelKey]}</span>
              {answered && chosen && (correct ? <span className="text-[var(--fg)]">{CHECK_ICON}</span> : <span className="text-[var(--muted)]">{X_ICON}</span>)}
            </button>
          );
        })}
      </div>
    );
  };

  const toolButton = (kind: Tool, Icon: typeof Ruler) => (
    <button
      type="button"
      role="radio"
      aria-checked={tool === kind}
      aria-label={kind === 'ruler' ? t.toolRuler : t.toolCompass}
      onClick={() => {
        setTool(kind);
        setPicked([]);
        setWarn(null);
      }}
      className={`compact inline-flex h-6 min-w-[40px] items-center justify-center gap-1.5 rounded-[5px] px-2 text-xs mono-font transition-colors ${
        tool === kind ? 'bg-[var(--fg)] font-medium text-[var(--card-bg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{kind === 'ruler' ? t.toolRuler : t.toolCompass}</span>
    </button>
  );

  /** 画布视口：以画布中心为锚点缩放；Fit 会把当前点与圆完整纳入视野。 */
  const zoomBy = (factor: number) => {
    setCamera((c) => {
      const nextZoom = Math.min(4, Math.max(0.22, c.zoom * factor));
      const qx = VIEW_W / 2;
      const qy = VIEW_H / 2;
      const tx = c.tx - qx * c.zoom * (nextZoom / c.zoom - 1);
      const ty = c.ty - qy * c.zoom * (nextZoom / c.zoom - 1);
      return { zoom: nextZoom, tx, ty };
    });
  };

  const fitCamera = () => {
    const pts = scene.points.map(toS);
    const boxes = pts.map((p) => ({ left: p.x, right: p.x, top: p.y, bottom: p.y }));
    for (const cir of scene.circles) {
      const c = scene.points.find((p) => p.id === cir.c);
      if (!c) continue;
      const s = toS(c);
      const r = cir.r * S;
      boxes.push({ left: s.x - r, right: s.x + r, top: s.y - r, bottom: s.y + r });
    }
    if (boxes.length === 0) {
      setCamera({ zoom: 1, tx: 0, ty: 0 });
      return;
    }
    const left = Math.min(...boxes.map((b) => b.left));
    const right = Math.max(...boxes.map((b) => b.right));
    const top = Math.min(...boxes.map((b) => b.top));
    const bottom = Math.max(...boxes.map((b) => b.bottom));
    const m = 26;
    const w = Math.max(1, right - left);
    const h = Math.max(1, bottom - top);
    const zoom = Math.min(4, Math.max(0.22, Math.min((VIEW_W - m * 2) / w, (VIEW_H - m * 2) / h)));
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    setCamera({ zoom, tx: VIEW_W / 2 - cx * zoom, ty: VIEW_H / 2 - cy * zoom });
  };


  const surfaceTitle = (
    <div className="flex min-w-0 items-center gap-1.5">
      <div className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-md border border-[var(--border)] bg-[var(--panel-bg)] p-0.5" role="radiogroup" aria-label={`${t.toolRuler} / ${t.toolCompass}`}>
        {toolButton('compass', Compass)}
        {toolButton('ruler', Ruler)}
      </div>
      <button type="button" onClick={() => { setCons(cons.slice(0, -1)); setPicked([]); setWarn(null); }} disabled={cons.length === 0} aria-label={t.undo} className="compact inline-flex h-7 shrink-0 items-center gap-1 rounded border border-[var(--border)] px-2 text-[0.625rem] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] disabled:opacity-40"><Undo2 className="h-3.5 w-3.5" aria-hidden="true" /><span className="hidden sm:inline">{t.undo}</span></button>
      <button type="button" onClick={clearWork} disabled={cons.length === 0} aria-label={t.reset} className="compact inline-flex h-7 shrink-0 items-center gap-1 rounded border border-[var(--border)] px-2 text-[0.625rem] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /><span className="hidden sm:inline">{t.reset}</span></button>
    </div>
  );
  const surfaceActions = (
    <>
      <button type="button" onClick={startDemo} className="compact inline-flex h-7 shrink-0 items-center rounded-full border border-[var(--border)] px-2 text-[0.625rem] text-[var(--fg)] hover:bg-[var(--accent-light)]"><Play className="h-3 w-3" aria-hidden="true" /> {t.demoStart}</button>
      <CanvasZoomControls onZoomIn={() => zoomBy(1.25)} onZoomOut={() => zoomBy(0.8)} onReset={fitCamera} />
    </>
  );

  useEffect(() => {
    setLabState('construction', {
      stage,
      task: taskIdx,
      steps: cons.length,
      solved,
    });
  }, [stage, taskIdx, cons, solved]);

  useEffect(() => {
    setPageQuestion('construction', lang === 'zh'
      ? '只用圆规和直尺（没有刻度）能作出哪些图形？你怎样验证作出的点确实满足条件？'
      : 'What can you construct with only a compass and straightedge (no scale)? How do you verify the constructed point really satisfies the condition?');
  }, [lang]);

  const demoHud = (
    <DemoHud
      active={timeline.active}
      playing={timeline.playing}
      index={timeline.index}
      total={demoSteps.length}
      progress={timeline.progress}
      speed={demoSpeed}
      caption={timeline.step ? timeline.step.caption[lang] : ''}
      labels={DEMO_HUD_COPY[lang]}
      onPlayPause={() => (timeline.playing ? timeline.pause() : timeline.resume())}
      onPrev={timeline.prev}
      onNext={timeline.next}
      onSpeed={cycleSpeed}
      onExit={timeline.stop}
      onTakeover={takeover}
      mode={timeline.mode}
      onMode={() => timeline.setMode(timeline.mode === 'auto' ? 'step' : 'auto')}
    />
  );

  const goalStrip = (
    <div className="flex min-w-0 items-center gap-2 text-[0.6875rem] mono-font">
      <span className="truncate font-semibold text-[var(--fg)]">{taskIdx + 1}. {t.tasks[taskIdx]}</span>
      <span className="shrink-0 text-[var(--muted)] tabular-nums">{t.steps(cons.length)}</span>
      <span className={`shrink-0 inline-flex items-center gap-1 ${shownSolved ? 'text-[var(--fg)] font-semibold' : 'text-[var(--muted)]'}`}>
        {shownSolved ? CHECK_ICON : null}{shownSolved ? t.solved : t.notSolved}
      </span>
      <button type="button" onClick={() => setHintOn((v) => !v)} aria-expanded={hintOn} className="shrink-0 min-h-[24px] px-1 text-[0.625rem] mono-font uppercase text-[var(--muted)] transition-colors hover:text-[var(--fg)]">{hintOn ? t.hintHide : t.hintLabel}</button>
      {hintOn && <span className="truncate text-[0.625rem] serif-font text-[var(--muted)]">{t.hints[taskIdx]}</span>}
      {picked.length === 1 && <span className="shrink-0 text-[0.625rem] mono-font text-[var(--accent)]">{t.pickOne}</span>}
      {warn && <span className="truncate text-[0.625rem] mono-font text-[var(--muted)]">{warn}</span>}
    </div>
  );

  const stageNav = (
    <StageNav
    stage={stage}
    setStage={(s) => setStage(s)}
    labels={{ predict: t.stagePredict, explore: t.stageExplore, conclude: t.stageConclude, next: t.nextStage, redo: t.redoLabel }}
    isDone={{ predict: predComplete, explore: observations.length > 0, conclude: conclusionComplete }}
    onNext={() => setStage(stage === 'predict' ? 'explore' : 'conclude')}
    onRedo={resetAll}
    />
  );

  return (
    <LabStageShell titleZh="尺规作图" titleEn="Ruler & Compass" labId="construction" variant={isDesktop ? 'sheet' : 'default'}
      center={stageNav}>
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto">
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="lg:hidden shrink-0">{stageNav}</div>

      <div className="grid grid-cols-1 items-start gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* 左列：作图区 + 工具栏 + 目标 */}
        <div className="contents lg:block lg:h-full lg:min-h-0 lg:min-w-0 lg:space-y-4">
          <div className="min-w-0 order-1 lg:order-none lg:h-full">
          <CanvasSurface
            active={timeline.active}
            hud={demoHud}
            showToolbar={stage !== 'predict'}
            titleSlot={surfaceTitle}
            actionsSlot={surfaceActions}
            footerBar={stage === 'predict' ? undefined : goalStrip}
          >
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="block h-full w-full"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={t.ariaCanvas}
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                cursor: hoverId ? 'pointer' : picked.length === 1 ? 'crosshair' : 'default',
                touchAction: 'manipulation',
              }}
            >
              <defs>
                <clipPath id="construction-canvas-clip">
                  <rect x="0" y="0" width={VIEW_W} height={VIEW_H} />
                </clipPath>
              </defs>
              <g clipPath="url(#construction-canvas-clip)">
              <g transform={`translate(${camera.tx} ${camera.ty}) scale(${camera.zoom})`}>
              {/* 作出的圆 */}
              {displayCircles.map((cir, i) => {
                const c = displayPoints.find((p) => p.id === cir.c);
                if (!c) return null;
                const s = toS(c);
                const age = displayCircles.length - 1 - i;
                const opacity = timeline.active ? 0.7 : solved ? 0.28 : Math.max(0.42, 0.85 - age * 0.12);
                const active = !timeline.active && picked.length === 1 && cir.c === picked[0];
                return (
                  <circle
                    key={cir.id}
                    cx={s.x} cy={s.y} r={cir.r * S}
                    fill="none"
                    stroke={active ? 'var(--accent)' : 'var(--muted)'}
                    strokeWidth={active ? 1.4 : 1.1}
                    strokeDasharray="5 4"
                    opacity={opacity}
                    pointerEvents="none"
                  />
                );
              })}

              {/* 作出的直线（画穿整个画布，靠 viewBox 裁切） */}
              {displayLines.map((ln) => {
                const a = displayPoints.find((p) => p.id === ln.a);
                const b = displayPoints.find((p) => p.id === ln.b);
                if (!a || !b) return null;
                const e = extendedLine(a, b);
                return (
                  <line
                    key={ln.id}
                    x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                    stroke="var(--accent)"
                    strokeWidth="1.25"
                    pointerEvents="none"
                  />
                );
              })}

              {/* 演示当前步：圆规扫掠 / 直尺先画 AB 再向两端延伸 */}
              {timeline.active && demoCircle && (
                <g pointerEvents="none">
                  <circle
                    ref={demoPulseRef}
                    cx={toS(demoCircle.c).x} cy={toS(demoCircle.c).y}
                    r={10 + 6 * Math.sin(Math.PI * demoProgressRef.current)}
                    fill="none" stroke="var(--accent)" strokeWidth="1"
                    opacity={0.35 * (1 - demoProgressRef.current)}
                  />
                  <circle
                    ref={demoCircleRef}
                    cx={toS(demoCircle.c).x} cy={toS(demoCircle.c).y}
                    r={demoCircle.r * S}
                    fill="none" stroke="var(--accent)" strokeWidth="1.6"
                    pathLength={1} strokeDasharray="1 1"
                    strokeDashoffset={1 - demoProgressRef.current}
                    transform={`rotate(-90 ${toS(demoCircle.c).x} ${toS(demoCircle.c).y})`}
                  />
                </g>
              )}
              {timeline.active && demoLine && (() => {
                const mainP = Math.min(1, demoProgressRef.current / 0.7);
                const extP = Math.max(0, (demoProgressRef.current - 0.7) / 0.3);
                return (
                  <g pointerEvents="none">
                    <line
                      ref={demoLineMainRef}
                      x1={demoLine.a.x} y1={demoLine.a.y} x2={demoLine.b.x} y2={demoLine.b.y}
                      stroke="var(--accent)" strokeWidth="1.6"
                      pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - mainP}
                    />
                    {demoProgressRef.current > 0.7 && (
                      <>
                        <line
                          ref={demoLineLeftRef}
                          x1={demoLine.a.x} y1={demoLine.a.y} x2={demoLine.left.x} y2={demoLine.left.y}
                          stroke="var(--accent)" strokeWidth="1.3" opacity={0.75}
                          pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - extP}
                        />
                        <line
                          ref={demoLineRightRef}
                          x1={demoLine.b.x} y1={demoLine.b.y} x2={demoLine.right.x} y2={demoLine.right.y}
                          stroke="var(--accent)" strokeWidth="1.3" opacity={0.75}
                          pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - extP}
                        />
                      </>
                    )}
                  </g>
                );
              })()}

              {/* 作图预览：虚线幽灵 + 即将出现的交点小环 */}
              {!timeline.active && preview && (
                <g pointerEvents="none">
                  {previewLine ? (
                    <line
                      x1={previewLine.x1} y1={previewLine.y1}
                      x2={previewLine.x2} y2={previewLine.y2}
                      stroke="var(--accent)" strokeWidth={1.1}
                      strokeDasharray="6 5" opacity={0.55}
                    />
                  ) : previewCircle ? (
                    <circle
                      cx={previewCircle.c.x} cy={previewCircle.c.y} r={previewCircle.r}
                      fill="none" stroke="var(--accent)" strokeWidth={1.1}
                      strokeDasharray="6 5" opacity={0.55}
                    />
                  ) : null}
                  {preview.pts.map((p, i) => {
                    const sp = toS(p);
                    return (
                      <circle
                        key={`pv${i}`} cx={sp.x} cy={sp.y} r={3}
                        fill="var(--card-bg)" stroke="var(--accent)" strokeWidth={1.4}
                      />
                    );
                  })}
                </g>
              )}

              {/* 已知线段 */}
              {task.segs.map(([pa, pb]) => {
                const a = task.givens.find((g) => g.id === pa);
                const b = task.givens.find((g) => g.id === pb);
                if (!a || !b) return null;
                const sa = toS(a);
                const sb = toS(b);
                return <line key={pa + pb} x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} stroke="var(--fg)" strokeWidth="2.4" strokeLinecap="round" pointerEvents="none" />;
              })}

              {shownWitness?.kind === 'line' && (() => {
                const e = extendedLine(shownWitness.a, shownWitness.b);
                return <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="var(--accent)" strokeWidth={3} opacity={0.9} pointerEvents="none" />;
              })()}
              {/* 点：命中由 svg 单层最近点判定，视觉点只做显示 */}
              {displayPoints.map((p) => {
                const s = toS(p);
                const isGiven = p.kind === 'given';
                const sel = !timeline.active && picked.includes(p.id);
                const isHover = !timeline.active && hoverId === p.id;
                const label = task.givens.find((g) => g.id === p.id)?.label;
                return (
                  <g key={p.id}>
                    {isHover && <circle cx={s.x} cy={s.y} r={8} fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity="0.75" pointerEvents="none" />}
                    {sel && <circle cx={s.x} cy={s.y} r={9.5} fill="none" stroke="var(--accent)" strokeWidth="2" pointerEvents="none" />}
                    {isGiven ? (
                      <rect x={s.x - 4} y={s.y - 4} width="8" height="8" fill="var(--fg)" transform={`rotate(45 ${s.x} ${s.y})`} pointerEvents="none" />
                    ) : (
                      <circle cx={s.x} cy={s.y} r="4" fill="var(--card-bg)" stroke="var(--accent)" strokeWidth="2" pointerEvents="none" />
                    )}
                    {label && (() => {
                      const dx = s.x - givenCenter.x;
                      const dy = s.y - givenCenter.y;
                      const len = Math.hypot(dx, dy) || 1;
                      const ux = dx / len;
                      const uy = dy / len;
                      const lx = s.x + ux * 15;
                      const ly = s.y + uy * 15 + 4;
                      const anchor = ux > 0.2 ? 'start' : ux < -0.2 ? 'end' : 'middle';
                      return (
                        <text x={lx} y={ly} textAnchor={anchor} fontSize="13" fill="var(--fg)" fontFamily="var(--f-mono)" pointerEvents="none">
                          {label}
                        </text>
                      );
                    })()}
                  </g>
                );
              })}

              {/* 演示新交点：progress > 0.55 才出现，脉冲环一次 */}
              {showDemoPoints && demoNewPoints.map((p, i) => {
                const sp = toS(p);
                return (
                  <g key={`dn${i}`} pointerEvents="none">
                    <circle className="demo-pulse" cx={sp.x} cy={sp.y} r={6} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
                    <circle cx={sp.x} cy={sp.y} r={3.2} fill="var(--card-bg)" stroke="var(--accent)" strokeWidth={1.6} />
                  </g>
                );
              })}

              {/* 结论高亮：见证线加粗 / 见证点实心 */}
              {shownWitness?.kind === 'point' && (
                <circle cx={toS(shownWitness.p).x} cy={toS(shownWitness.p).y} r={5} fill="var(--accent)" stroke="var(--card-bg)" strokeWidth={1.5} pointerEvents="none" />
              )}

              {/* 几何标记：⊥ / 等长刻度 / 防粘连等角弧 / 垂足虚线 */}
              {shownWitness && <SolvedMarks task={task} witness={shownWitness} />}

              {/* 触屏偏移准星：判定点在手指上方 28px */}
              {pointer?.touch && (
                <g pointerEvents="none">
                  <circle cx={pointer.sx} cy={pointer.sy} r={26} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.35} />
                  <line x1={pointer.sx - 6} y1={pointer.sy} x2={pointer.sx + 6} y2={pointer.sy} stroke="var(--accent)" strokeWidth={1.2} />
                  <line x1={pointer.sx} y1={pointer.sy - 6} x2={pointer.sx} y2={pointer.sy + 6} stroke="var(--accent)" strokeWidth={1.2} />
                </g>
              )}
              </g>
              </g>
            </svg>
          </CanvasSurface>
          </div>

        </div>

        {/* 右列：关卡切换 + 三幕 */}
        <div className="contents lg:block lg:h-full lg:min-h-0 lg:min-w-0 lg:space-y-4 lg:overflow-y-auto">
          <section className="min-w-0 order-2 lg:order-none">
            <div className="border border-[var(--border)] p-3 space-y-2">
              <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {t.taskTitle}</h3>
              <div className="grid grid-cols-2 gap-2">
                {t.tasks.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => switchTask(i)}
                    aria-pressed={taskIdx === i}
                    className={`min-h-[40px] rounded border px-2 py-1.5 text-[0.6875rem] mono-font leading-snug transition-colors ${
                      taskIdx === i ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                    }`}
                  >
                    {i + 1}. {label}
                  </button>
                ))}
              </div>
              <div className="border-t border-[var(--border)] pt-2">{goalStrip}</div>
              {stage === 'explore' && (
                <div className="border-t border-[var(--border)] pt-2">
                  <ExploreStage
                    compact
                    cards={cards}
                    observations={observations}
                    onAddObservation={addObservation}
                    onClearObservations={() => setObservations([])}
                    notePlaceholder={t.notePlaceholder}
                    recordLabel={t.recordLabel}
                    clearLabel={t.clearLabel}
                    emptyLabel={t.exploreEmpty}
                    title={t.exploreTitle}
                  />
                </div>
              )}
            </div>
          </section>

          <section className="min-w-0 order-4 space-y-4 lg:order-none">
          {stage === 'predict' && (
            <div className="border border-[var(--border)] p-4 space-y-4">
              <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {t.predictTitle}</h3>
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{t.predictQuestion}</p>
              <p className="text-xs text-[var(--muted)] serif-font">{t.predictQuestion2}</p>
              {(
                [
                  ['q1', t.predictQ1, [t.predQ1a, t.predQ1b, t.predQ1c]],
                  ['q2', t.predictQ2, [t.predQ2a, t.predQ2b, t.predQ2c]],
                  ['q3', t.predictQ3, [t.predQ3a, t.predQ3b, t.predQ3c]],
                ] as ['q1' | 'q2' | 'q3', string, readonly string[]][]
              ).map(([key, question, labels]) => (
                <div key={key} className="space-y-2">
                  <p className="text-xs font-bold text-[var(--fg)] mono-font">{question}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(['a', 'b', 'c'] as PredictAnswer[]).map((v, i) => (
                      <button
                        key={String(v)}
                        type="button"
                        onClick={() => setPred((prev) => ({ ...prev, [key]: v }))}
                        className={`text-center text-xs px-2 py-2 border rounded-lg transition-colors min-h-[40px] leading-snug ${
                          pred[key] === v
                            ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                            : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {labels[i]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {predComplete && (
                <button
                  type="button"
                  onClick={() => setStage('explore')}
                  className="w-full min-h-[40px] rounded-lg border border-[var(--fg)] bg-[var(--fg)] px-3 py-2 text-xs font-semibold text-[var(--bg)] hover:opacity-90 transition-opacity"
                >
                  {t.revealLabel}
                </button>
              )}
              {!predComplete && <p className="text-[0.6875rem] mono-font text-[var(--muted)]">{t.predictHint}</p>}
            </div>
          )}

          {stage === 'conclude' && (
            <div className="border border-[var(--border)] p-4 space-y-4">
              <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {t.concludeTitle}</h3>
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{t.concludeQuestion}</p>
              {(['q1', 'q2', 'q3', 'q4'] as QuizKey[]).map((key) => (
                <div key={key} className="space-y-2">
                  <p className="text-xs font-bold text-[var(--fg)] mono-font">{(t as unknown as Record<string, string>)['concludeQ' + key.slice(1)]}</p>
                  {optionRow(key)}
                </div>
              ))}
              {conclusionComplete && (
                <div className="border-l-2 border-[var(--fg)] pl-3 space-y-2">
                  <p className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">{t.feedbackTitle}</p>
                  <p className="text-xs serif-font leading-relaxed text-[var(--fg)]">{t.feedbackText}</p>
                  <p className="text-[0.6875rem] mono-font text-[var(--muted)] tabular-nums">
                    {lang === 'zh' ? '观察记录：' : 'Evidence: '}
                    {observations.filter((ob) => ob.balanced).length} {t.evSolved} / {observations.filter((ob) => !ob.balanced).length} {t.evOpen}
                  </p>
                </div>
              )}
              {conclusionComplete && <p className="text-[0.6875rem] mono-font text-[var(--muted)]">{t.concludeHint}</p>}
            </div>
          )}

          {stage === 'conclude' && conclusionComplete && (
            <div className="border border-[var(--border)] p-4 space-y-2">
              <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {t.tipsTitle}</h3>
              <ul className="space-y-1.5">
                {t.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-[var(--fg)] serif-font leading-relaxed flex gap-2">
                    <span className="text-[var(--muted)] mono-font shrink-0">{i + 1}.</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stage === 'conclude' && conclusionComplete && (
            <button
              type="button"
              onClick={resetAll}
              className="group inline-flex items-center gap-1.5 text-xs mono-font uppercase text-[var(--fg)] hover:opacity-70"
            >
              <RotateCcw className="w-3.5 h-3.5 opacity-70 group-hover:rotate-[-45deg] transition-transform duration-[var(--dur-base)]" />
              <span>{t.redoLabel}</span>
            </button>
          )}
          </section>
        </div>
      </div>
    </div>
    </div>
    </LabStageShell>
  );
}
