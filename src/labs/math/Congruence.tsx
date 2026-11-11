/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学探究 · 三角形全等判定（人教版 八上第 12 章）
 *
 * 幕 1 预测：给定几种「已知相等元素」，先猜哪些能保证全等（不判对错）
 * 幕 2 探索：选一组条件 → 系统按这些条件重新画一个三角形 → 点「叠合」
 *        能重合就是全等，重合不了就是反例。SSA 里点「另一个解」
 *        会拿出同样满足条件、形状却不同的第三个三角形。
 * 幕 3 结论：四道判定题，对照自己的预测与观察记录
 *
 * 复用组件：ExploreStage（任务卡 + 笔记）、lab/ 下的设计令牌与触控尺寸规范。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Play, Check, Layers, RotateCcw, X } from 'lucide-react';
import { setLabState, setPageQuestion } from '../../lib/ai-dynamic-questions';
import { useApp } from '../../lib/app-context';
import { useIsDesktopLab } from '../../components/lab/useIsDesktopLab';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import ParamDock from '../../components/lab/ParamDock';
import StageNav from '../../components/lab/StageNav';
import CanvasSurface, { CanvasZoomControls } from '../../components/lab/CanvasSurface';
import LabStageShell from '../../components/lab/LabStageShell';
import DemoHud, { DEMO_HUD_COPY } from '../../components/lab/demo-hud';
import { easeInOutQuad, easeOutCubic, useAutoTimeline } from '../../components/lab/use-auto-timeline';
import { enumParam, numParam, readUrlParams, useLabUrlSync } from '../../lib/lab-url-state';
import {
  type ConditionId,
  type Tri,
  buildByCondition,
  congruentSides,
  measure,
  referenceFor,
  vertexGaps,
} from './congruence-core';
import { BACK_STEPS, HOME_POSE, POSE_STEPS, REF_POSE, SSA_STEPS, lerpPose, type Pose } from './congruence-demo';

type Stage = 'predict' | 'explore' | 'conclude';
type PredictAnswer = 'yes' | 'maybe' | 'no' | null;

const CHECK_ICON = <Check className="inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em]" aria-hidden="true" />;
const X_ICON = <X className="inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em]" aria-hidden="true" />;

/* ------------------------------ 画布几何 ------------------------------ */

const VIEW_W = 580;
const VIEW_H = 360;
/** 1 个数学单位 = 多少 SVG 像素 */
const SCALE = 28;

function toScreen(p: { x: number; y: number }, pose: Pose): { x: number; y: number } {
  const qx = p.x * SCALE;
  const qy = -p.y * SCALE;
  const c = Math.cos(pose.rot);
  const s = Math.sin(pose.rot);
  return { x: pose.tx + qx * c - qy * s, y: pose.ty + qx * s + qy * c };
}

function triPath(t: Tri, pose: Pose): string {
  const a = toScreen(t.A, pose);
  const b = toScreen(t.B, pose);
  const c = toScreen(t.C, pose);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)} L ${c.x.toFixed(2)} ${c.y.toFixed(2)} Z`;
}

const copy = {
  zh: {
    stagePredict: '预测',
    stageExplore: '探索',
    stageConclude: '结论',
    stageDone: '完成',
    nextStage: '下一步 →',
    redoLabel: '重新探究',
    reset: '重置',
    paramDock: '调节参数',
    paramDockClose: '收起参数',
    readout: '当前条件',
    // 幕 1
    predictTitle: '预测',
    predictQuestion: '两个三角形的某些元素分别相等时，它们一定全等吗？',
    predictQuestion2: '先别做实验，凭直觉猜一猜：',
    predictQ1: '三条边分别相等',
    predictQ2: '两边和其中一边的对角分别相等',
    predictQ3: '两个直角三角形，斜边和一条直角边分别相等',
    predYes: '一定全等',
    predMaybe: '不一定全等',
    predNo: '一定不全等',
    predictDone: '已记录你的预测',
    predictHint: '三题都猜完，就可以动手验证',
    revealLabel: '开始验证 →',
    // 幕 2
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。换一组条件、点一次叠合，看到结果时记一条。',
    notePlaceholder: '写一句话：你观察到了什么？',
    recordLabel: '记一条观察',
    clearLabel: '清空记录',
    tryLabel: '试试这个',
    cards: [
      {
        title: '三边定形（SSS）',
        prompt: '只按三条边重新画一个三角形，点「叠合」——为什么它一定跑不掉？',
      },
      {
        title: '找 SSA 的反例',
        prompt: '换成 SSA，点「另一个解」：它还满足同样的条件吗？还能重合吗？',
      },
      {
        title: 'HL 的适用范围',
        prompt: '直角三角形里只给斜边和一条直角边，形状定死了吗？换到不是直角三角形的场合还行不行？',
      },
      {
        title: '自由探索',
        prompt: '六组条件挨个试一遍，把「能重合」与「合不上」各记一条。',
      },
    ],
    // 条件名与「已知什么」
    condLabel: '已知条件',
    cond: {
      sss: { name: 'SSS（边边边）', given: '三条边' },
      sas: { name: 'SAS（边角边）', given: '两边及其夹角' },
      asa: { name: 'ASA（角边角）', given: '两角及其夹边' },
      aas: { name: 'AAS（角角边）', given: '两角及其中一角的对边' },
      hl: { name: 'HL（斜边、直角边）', given: '斜边和一条直角边' },
      ssa: { name: 'SSA（边边角）', given: '两边及其中一边的对角' },
    },
    hlNote: 'HL 只适用于直角三角形，这一组条件换用直角三角形做基准。',
    overlayBtn: '叠合看看',
    resetPose: '放回原位',
    altSolutionBtn: '另一个解（同样满足 SSA）',
    ssaDemoBtn: '演示另一解',
    demoStart: '演示叠合',
    sameSolutionBtn: '回到第一个解',
    overlaying: '正在叠合…',
    matchOk: '完全重合 —— 两个三角形全等',
    matchFail: '没有重合 —— 满足同样的条件，形状却不同',
    gapAt: '差得最多的是',
    units: '个单位',
    // 测量表
    measureTitle: '量一量',
    side: '边',
    angle: '角',
    refCol: '基准 △ABC',
    candCol: '重画的 △A′B′C′',
    // 幕 3
    concludeTitle: '结论',
    concludeQuestion: '综合你的验证，下面四道题你怎么答？',
    concludeQ1: '下面哪一组不能作为判定两个三角形全等的依据？',
    concludeQ2: 'SSS 能判定全等，根本原因是：',
    concludeQ3: 'SSA 不能判定的原因是：',
    concludeQ4: 'HL 适用于：',
    concludeQ1A: 'ASA',
    concludeQ1B: 'SSA',
    concludeQ1C: 'SAS',
    concludeQ2A: '三条边确定后，三角形的形状和大小就唯一确定了',
    concludeQ2B: '两个三角形的面积相等',
    concludeQ2C: '两个三角形的周长相等',
    concludeQ3A: '两条边不能确定角度',
    concludeQ3B: '其中一边的对角一定比另一条边长',
    concludeQ3C: '满足条件的三角形可能有两个不同的形状',
    concludeQ4A: '任意两个直角三角形',
    concludeQ4B: '斜边和一条直角边分别相等的两个直角三角形',
    concludeQ4C: '两条直角边分别相等的两个直角三角形',
    concludeHint: '四题都答完，看看你的结论和观察记录对不对得上',
    feedbackTitle: '反馈',
    feedbackText:
      'SSS、SAS、ASA、AAS 和 HL 都能唯一确定三角形的形状，所以都是判定依据；SSA 之所以不行，是因为同一个角和两条边可能对应两个不同的三角形——你可以在探索里把「另一个解」叠上去亲眼看到它合不拢。',
    tipsTitle: '考点速记',
    tips: [
      '判定全等要找「三组元素」，其中至少要有一组边（SSA 是个陷阱：两边一对角不行）。',
      'HL 只用于直角三角形，且必须是斜边与一条直角边。',
      '写证明时对应顶点要按顺序写：△ABC ≌ △DEF 意味着 A↔D、B↔E、C↔F。',
      '「边边角」不能判定全等，常用来构造反例题。',
    ],
    ariaCanvas: '左侧是基准三角形，右侧是按所选条件重新画出的三角形；点叠合可看两者是否完全重合。',
    dragHint: '拖中心方块平移候选三角形，拖 A′ 旁的圆环旋转；也可以点叠合自动对齐。',
  },
  en: {
    stagePredict: 'Predict',
    stageExplore: 'Explore',
    stageConclude: 'Conclude',
    stageDone: 'Done',
    nextStage: 'Next →',
    redoLabel: 'Start over',
    reset: 'Reset',
    paramDock: 'Adjust parameters',
    paramDockClose: 'Hide parameters',
    readout: 'Condition',
    predictTitle: 'Predict',
    predictQuestion: 'If some corresponding parts of two triangles are equal, must they be congruent?',
    predictQuestion2: 'Before experimenting, guess:',
    predictQ1: 'All three sides equal',
    predictQ2: 'Two sides and a non-included angle equal',
    predictQ3: 'Two right triangles with equal hypotenuse and one leg',
    predYes: 'Always congruent',
    predMaybe: 'Not necessarily',
    predNo: 'Never congruent',
    predictDone: 'Predictions saved',
    predictHint: 'Answer all three to start testing',
    revealLabel: 'Start testing →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Switch conditions or overlap the triangles, then record what you see.',
    notePlaceholder: 'One line: what did you observe?',
    recordLabel: 'Record',
    clearLabel: 'Clear',
    tryLabel: 'Try this',
    cards: [
      { title: 'Three sides (SSS)', prompt: 'Rebuild a triangle from the same three sides, then overlap — why can it not escape?' },
      { title: 'Hunt the SSA counterexample', prompt: 'Switch to SSA and hit "the other solution": does it still meet the condition? Does it overlap?' },
      { title: 'Where HL applies', prompt: 'For right triangles, do hypotenuse plus one leg fix the shape? What if the triangle is not right-angled?' },
      { title: 'Free exploration', prompt: 'Try all six conditions and record one that overlaps and one that does not.' },
    ],
    condLabel: 'Given',
    cond: {
      sss: { name: 'SSS', given: 'three sides' },
      sas: { name: 'SAS', given: 'two sides and the included angle' },
      asa: { name: 'ASA', given: 'two angles and the included side' },
      aas: { name: 'AAS', given: 'two angles and a non-included side' },
      hl: { name: 'HL', given: 'hypotenuse and one leg' },
      ssa: { name: 'SSA', given: 'two sides and a non-included angle' },
    },
    hlNote: 'HL only applies to right triangles, so this condition uses a right triangle as the reference.',
    overlayBtn: 'Overlap them',
    resetPose: 'Move back',
    altSolutionBtn: 'The other solution (same SSA data)',
    ssaDemoBtn: 'Demo the other solution',
    demoStart: 'Play overlap',
    sameSolutionBtn: 'Back to the first solution',
    overlaying: 'Overlapping…',
    matchOk: 'Perfect fit — the triangles are congruent',
    matchFail: 'No fit — same data, different shape',
    gapAt: 'largest mismatch at',
    units: 'units',
    measureTitle: 'Measurements',
    side: 'side',
    angle: 'angle',
    refCol: 'reference △ABC',
    candCol: 'rebuilt △A′B′C′',
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on what you tested, answer these four:',
    concludeQ1: 'Which of these is NOT a valid congruence criterion?',
    concludeQ2: 'SSS works because:',
    concludeQ3: 'SSA fails because:',
    concludeQ4: 'HL applies to:',
    concludeQ1A: 'ASA',
    concludeQ1B: 'SSA',
    concludeQ1C: 'SAS',
    concludeQ2A: 'three sides fix the shape and size uniquely',
    concludeQ2B: 'the two triangles have equal area',
    concludeQ2C: 'the two triangles have equal perimeter',
    concludeQ3A: 'two sides cannot determine an angle',
    concludeQ3B: 'the non-included angle is always larger',
    concludeQ3C: 'the same data may fit two different triangles',
    concludeQ4A: 'any two right triangles',
    concludeQ4B: 'two right triangles with equal hypotenuse and one equal leg',
    concludeQ4C: 'two right triangles with both legs equal',
    concludeHint: 'Answer all four, then compare with your observations',
    feedbackTitle: 'Feedback',
    feedbackText:
      'SSS, SAS, ASA, AAS and HL each pin the triangle down uniquely, so they are valid criteria. SSA is not: one angle and two sides can fit two different triangles — switch to "the other solution" and overlap it to see it fail to fit.',
    tipsTitle: 'Key points',
    tips: [
      'A criterion needs three pairs of equal parts, and at least one pair must be sides (SSA is the trap: two sides and a non-included angle).',
      'HL is for right triangles only: hypotenuse plus one leg.',
      'Write corresponding vertices in order: △ABC ≅ △DEF means A↔D, B↔E, C↔F.',
      'SSA cannot prove congruence; it is the standard way to build counterexamples.',
    ],
    ariaCanvas: 'The reference triangle on the left, and a triangle rebuilt from the chosen condition on the right; overlap them to see whether they coincide.',
    dragHint: 'Drag the centre square to translate the candidate, or the ring at A′ to rotate; or press overlay to align automatically.',
  },
};

/** 题库注册表：选项顺序与判分答案的单一事实源（smoke 守卫解析本块） */
export const OPTIONS = {
  q1: [['asa', 'concludeQ1A'], ['ssa', 'concludeQ1B'], ['sas', 'concludeQ1C']],
  q2: [['unique', 'concludeQ2A'], ['area', 'concludeQ2B'], ['perimeter', 'concludeQ2C']],
  q3: [['angle', 'concludeQ3A'], ['longer', 'concludeQ3B'], ['twoShapes', 'concludeQ3C']],
  q4: [['any', 'concludeQ4A'], ['hypLeg', 'concludeQ4B'], ['legs', 'concludeQ4C']],
} as const;

/** 每题正确选项值（多解用数组） */
export const QUIZ_CORRECT: Record<string, string[]> = {
  q1: ['ssa'],
  q2: ['unique'],
  q3: ['twoShapes'],
  q4: ['hypLeg'],
};

const CONDITIONS: ConditionId[] = ['sss', 'sas', 'asa', 'aas', 'hl', 'ssa'];

export default function Congruence() {
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
  const [revealed, setRevealed] = useState(false);

  const [mode, setMode] = useState<ConditionId>(() => enumParam(initialUrl.get('cond')?.toLowerCase(), CONDITIONS, 'sss'));
  const [viewZoom, setViewZoom] = useState(1);
  const [branch, setBranch] = useState<0 | 1>(() => (numParam(initialUrl.get('alt'), 0, 0, 1) >= 1 ? 1 : 0));
  const [pose, setPose] = useState<Pose>(HOME_POSE);
  const [overlayed, setOverlayed] = useState(false);
  const [observations, setObservations] = useState<Observation[]>([]);
  useLabUrlSync({ stage, cond: mode.toUpperCase(), alt: branch }, { stage: 'predict', cond: 'SSS', alt: 0 }, [stage, mode, branch]);
  const [conclusion, setConclusion] = useState<Record<string, string | null>>({ q1: null, q2: null, q3: null, q4: null });

  // 演示态：与用户态彻底分离；退出演示不写回，接管时才写回
  const [demoPose, setDemoPose] = useState<Pose>(HOME_POSE);
  const [demoOverlayed, setDemoOverlayed] = useState(false);
  const [demoBranch, setDemoBranch] = useState<0 | 1>(0);
  const [demoLocus, setDemoLocus] = useState(false);
  const [demoSpeed, setDemoSpeed] = useState(1);

  // 窄屏抽屉展开时把画布滚回视口顶部
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const poseDragRef = useRef<null | {
    kind: 'move' | 'rotate';
    start: { x: number; y: number };
    pose: Pose;
    center: { x: number; y: number };
    startAngle: number;
  }>(null);
  const backFromRef = useRef<Pose>(HOME_POSE);
  const demoPoseRef = useRef<Pose>(HOME_POSE);
  const candidateGroupRef = useRef<SVGGElement>(null);
  const candidateLabelRefs = useRef<Record<'A' | 'B' | 'C', SVGTextElement | null>>({ A: null, B: null, C: null });

  const refTri = useMemo(() => referenceFor(mode), [mode]);

  // 两条时间轴互斥：位姿叠合 / SSA 双解
  const poseTimeline = useAutoTimeline(POSE_STEPS, {
    onFrame: (step, _index, progress, meta) => {
      const pose = lerpPose(step.data.from, step.data.to, easeInOutQuad(progress));
      demoPoseRef.current = pose;
      // 几何由候选组 transform / 标签坐标直写，不触发 React
      candidateGroupRef.current?.setAttribute(
        'transform',
        `translate(${pose.tx} ${pose.ty}) rotate(${(pose.rot * 180) / Math.PI})`,
      );
      if (candTri) {
        (['A', 'B', 'C'] as const).forEach((k) => {
          const q = toScreen(candTri[k], pose);
          const el = candidateLabelRefs.current[k];
          if (el) {
            el.setAttribute('x', String(q.x + (k === 'B' ? 6 : -16)));
            el.setAttribute('y', String(q.y + (k === 'C' ? -8 : 18)));
          }
        });
      }
      // 只在步末同步一次 React 读数/叠合态
      if (meta?.snap || progress > 0.98) {
        setDemoPose(pose);
        setDemoOverlayed(step.data.overlayed && progress > 0.98);
      }
    },
  });
  const ssaTimeline = useAutoTimeline(SSA_STEPS, {
    onStep: (step) => {
      setDemoBranch(step.data.branch);
      setDemoLocus(step.data.locus);
    },
  });
  const backTimeline = useAutoTimeline(BACK_STEPS, {
    onFrame: (_step, _index, progress) => {
      const from = backFromRef.current;
      const e = easeOutCubic(progress);
      setPose({
        tx: from.tx + (HOME_POSE.tx - from.tx) * e,
        ty: from.ty + (HOME_POSE.ty - from.ty) * e,
        rot: from.rot + (HOME_POSE.rot - from.rot) * e,
      });
    },
    onDone: () => setPose(HOME_POSE),
  });

  const displayPose = poseTimeline.active ? demoPose : pose;
  const displayBranch: 0 | 1 = ssaTimeline.active ? demoBranch : branch;
  const displayOverlayed = poseTimeline.active ? demoOverlayed : ssaTimeline.active ? false : overlayed;
  const activeTimeline = poseTimeline.active ? poseTimeline : ssaTimeline.active ? ssaTimeline : null;
  const activeTotal = poseTimeline.active ? POSE_STEPS.length : SSA_STEPS.length;

  const candTri = useMemo(
    () => (stage === 'predict' ? null : buildByCondition(mode, refTri, mode === 'ssa' ? displayBranch : 0)),
    [stage, mode, refTri, displayBranch],
  );
  const refM = useMemo(() => measure(refTri), [refTri]);
  const candM = useMemo(() => (candTri ? measure(candTri) : null), [candTri]);
  const isCongruent = candTri ? congruentSides(refTri, candTri) : false;
  const gaps = candTri ? vertexGaps(refTri, candTri) : null;

  /** 候选三角形的屏幕质心：平移手柄锚点 */
  const candCentroid = useMemo(() => {
    if (!candTri) return null;
    const pts = (['A', 'B', 'C'] as const).map((k) => toScreen(candTri[k], displayPose));
    return { x: (pts[0].x + pts[1].x + pts[2].x) / 3, y: (pts[0].y + pts[1].y + pts[2].y) / 3 };
  }, [candTri, displayPose]);

  /** 屏幕事件 → SVG viewBox 坐标 */
  const svgPoint = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const q = pt.matrixTransform(ctm.inverse());
    return { x: q.x, y: q.y };
  };

  const onPoseDown = (kind: 'move' | 'rotate') => (e: ReactPointerEvent<Element>) => {
    if (!candTri || !candCentroid) return;
    e.preventDefault();
    e.stopPropagation();
    const start = svgPoint(e.clientX, e.clientY);
    if (!start) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    poseDragRef.current = {
      kind,
      start,
      pose: displayPose,
      center: candCentroid,
      startAngle: Math.atan2(start.y - candCentroid.y, start.x - candCentroid.x),
    };
  };

  const onPoseMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = poseDragRef.current;
    if (!d) return;
    const p = svgPoint(e.clientX, e.clientY);
    if (!p) return;
    setOverlayed(false);
    backTimeline.stop();
    if (d.kind === 'move') {
      setPose({
        ...d.pose,
        tx: Math.max(16, Math.min(VIEW_W - 16, d.pose.tx + p.x - d.start.x)),
        ty: Math.max(16, Math.min(VIEW_H - 16, d.pose.ty + p.y - d.start.y)),
      });
    } else {
      const angle = Math.atan2(p.y - d.center.y, p.x - d.center.x);
      setPose({ ...d.pose, rot: d.pose.rot + angle - d.startAngle });
    }
  };

  const onPoseUp = () => {
    poseDragRef.current = null;
  };

  // AI：实时状态登记（当前条件 / SSA 分支 / 是否已叠合），供系统提示词与页头「问 AI」读取
  useEffect(() => {
    setLabState('congruence', {
      stage,
      mode,
      ...(mode === 'ssa' ? { branch: displayBranch } : {}),
      overlayed: displayOverlayed,
    });
  }, [stage, mode, displayBranch, displayOverlayed]);
  useEffect(() => {
    setPageQuestion('congruence', lang === 'zh'
      ? '改变两边的夹角或第三边时，哪些条件下三角形能完全重合？你观察到什么判定规律？'
      : 'As you change the included angle or the third side, when do the triangles coincide exactly? What congruence pattern do you observe?');
  }, [lang]);


  /** 换条件 / 换解：停掉演示，立刻回到初始位姿，避免残留上一轮的叠合状态 */
  const pickCondition = (m: ConditionId) => {
    poseTimeline.stop();
    ssaTimeline.stop();
    backTimeline.stop();
    setMode(m);
    setBranch(0);
    setPose(HOME_POSE);
    setOverlayed(false);
  };
  const pickBranch = (b: 0 | 1) => {
    poseTimeline.stop();
    ssaTimeline.stop();
    backTimeline.stop();
    setBranch(b);
    setPose(HOME_POSE);
    setOverlayed(false);
  };
  const overlay = () => {
    ssaTimeline.stop();
    backTimeline.stop();
    demoPoseRef.current = HOME_POSE;
    setDemoPose(HOME_POSE);
    poseTimeline.start();
  };
  const startSsaDemo = () => {
    poseTimeline.stop();
    backTimeline.stop();
    ssaTimeline.start();
  };
  const moveBack = () => {
    // 从「当前屏幕上的位姿」回位：演示中取 demoPose，否则取用户 pose
    const from = poseTimeline.active ? demoPose : pose;
    poseTimeline.stop();
    ssaTimeline.stop();
    backTimeline.stop();
    backFromRef.current = from;
    setOverlayed(false);
    backTimeline.start();
  };
  const takeover = () => {
    if (poseTimeline.active) {
      setPose(demoPoseRef.current);
      setOverlayed(demoOverlayed);
      poseTimeline.stop();
    }
    if (ssaTimeline.active) {
      setBranch(demoBranch);
      setOverlayed(false);
      ssaTimeline.stop();
    }
    backTimeline.stop();
  };
  const cycleSpeed = () => {
    const next = demoSpeed === 1 ? 1.5 : demoSpeed === 1.5 ? 0.5 : 1;
    setDemoSpeed(next);
    activeTimeline?.setSpeed(next);
  };

  const predComplete = pred.q1 !== null && pred.q2 !== null && pred.q3 !== null;
  const conclusionComplete = Object.values(conclusion).every((v) => v !== null);

  const addObservation = (note: string) => {
    setObservations((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        snapshot: [
          { label: lang === 'zh' ? '条件' : 'cond', value: t.cond[mode].name },
          { label: lang === 'zh' ? '已知' : 'given', value: t.cond[mode].given },
          { label: lang === 'zh' ? '叠合' : 'overlap', value: isCongruent ? (lang === 'zh' ? '重合' : 'fits') : lang === 'zh' ? '合不上' : 'misses' },
        ],
        balanced: isCongruent,
        note,
      },
    ]);
  };

  const cards: ExploreCard[] = [
    { key: 'card-sss', title: t.cards[0].title, prompt: t.cards[0].prompt, tryLabel: t.tryLabel, tryIt: () => pickCondition('sss') },
    { key: 'card-ssa', title: t.cards[1].title, prompt: t.cards[1].prompt, tryLabel: t.tryLabel, tryIt: () => pickCondition('ssa') },
    { key: 'card-hl', title: t.cards[2].title, prompt: t.cards[2].prompt, tryLabel: t.tryLabel, tryIt: () => pickCondition('hl') },
    {
      key: 'card-free',
      title: t.cards[3].title,
      prompt: t.cards[3].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => pickCondition('aas'),
    },
  ];

  const resetAll = () => {
    setStage('predict');
    setPred({ q1: null, q2: null, q3: null });
    setRevealed(false);
    poseTimeline.stop();
    ssaTimeline.stop();
    backTimeline.stop();
    setMode('sss');
    setBranch(0);
    setPose(HOME_POSE);
    setOverlayed(false);
    setObservations([]);
    setConclusion({ q1: null, q2: null, q3: null, q4: null });
  };

  const r1 = (v: number) => (Math.round(v * 10) / 10 || 0).toFixed(1);
  const r0 = (v: number) => String(Math.round(v) || 0);

  const textBox = (x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end') => {
    const w = Math.max(12, text.length * 7.2);
    const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
    return { left, right: left + w, top: y - 14, bottom: y + 3 };
  };
  const boxOverlap = (a: { left: number; right: number; top: number; bottom: number }, b: { left: number; right: number; top: number; bottom: number }) =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

  const refLabelInfos = useMemo(() => {
    return (['A', 'B', 'C'] as const).map((k) => {
      const p = toScreen(refTri[k], REF_POSE);
      return {
        k,
        x: p.x + (k === 'B' ? 6 : -14),
        y: p.y + (k === 'C' ? -8 : 16),
        anchor: (k === 'B' ? 'start' : 'end') as 'start' | 'end',
      };
    });
  }, [refTri]);

  const candidateLabelInfos = useMemo(() => {
    if (!candTri) return null;
    const occupied = refLabelInfos.map((r) => textBox(r.x, r.y, r.k, r.anchor));
    // 旋转弧线图标也是视觉障碍：将 A′ 处的图标包围盒膨胀 10px 后参与避让
    const aPoint = toScreen(candTri.A, displayPose);
    const iconHalf = 10;
    occupied.push({
      left: aPoint.x + 16 - iconHalf,
      right: aPoint.x + 16 + iconHalf,
      top: aPoint.y - 14 - iconHalf,
      bottom: aPoint.y - 14 + iconHalf,
    });
    const result: Record<'A' | 'B' | 'C', { x: number; y: number; anchor: 'start' | 'middle' | 'end' } | null> = {
      A: null, B: null, C: null,
    };
    for (const k of ['A', 'B', 'C'] as const) {
      const p = toScreen(candTri[k], displayPose);
      const same = toScreen(refTri[k], REF_POSE);
      if (displayOverlayed && Math.hypot(p.x - same.x, p.y - same.y) < 18) {
        result[k] = null; // 叠合后与基准同名顶点重合：隐藏重复的候选标签
        continue;
      }
      const text = `${k}′`;
      const slots = [
        { dx: 16, dy: -12, anchor: 'start' as const },
        { dx: -16, dy: -12, anchor: 'end' as const },
        { dx: 16, dy: 18, anchor: 'start' as const },
        { dx: -16, dy: 18, anchor: 'end' as const },
        { dx: 0, dy: -22, anchor: 'middle' as const },
        { dx: 0, dy: 24, anchor: 'middle' as const },
      ];
      let best = slots[0];
      let bestScore = Infinity;
      for (const slot of slots) {
        const box = textBox(p.x + slot.dx, p.y + slot.dy, text, slot.anchor);
        const score = occupied.reduce((sum, o) => sum + boxOverlap(box, o), 0);
        if (score < bestScore) {
          bestScore = score;
          best = slot;
        }
      }
      result[k] = { x: p.x + best.dx, y: p.y + best.dy, anchor: best.anchor };
      occupied.push(textBox(result[k]!.x, result[k]!.y, text, result[k]!.anchor));
    }
    return result;
  }, [candTri, displayPose, displayOverlayed, refLabelInfos, refTri]);

  const condList: { id: ConditionId; label: string }[] = CONDITIONS.map((id) => ({ id, label: t.cond[id].name }));

  const optionRow = (key: string, items: [string, string][]) => (
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
            className={`text-left text-xs px-3 py-2 border rounded-lg transition-colors min-h-[44px] leading-snug flex items-start gap-2 ${
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

  const demoHud = (
    <DemoHud
      active={!!activeTimeline}
      playing={activeTimeline?.playing ?? false}
      index={activeTimeline?.index ?? 0}
      total={activeTotal}
      progress={activeTimeline?.progress ?? 0}
      speed={demoSpeed}
      caption={activeTimeline?.step ? activeTimeline.step.caption[lang] : ''}
      labels={DEMO_HUD_COPY[lang]}
      onPlayPause={() => {
        if (!activeTimeline) return;
        if (activeTimeline.playing) activeTimeline.pause();
        else activeTimeline.resume();
      }}
      onPrev={() => activeTimeline?.prev()}
      onNext={() => activeTimeline?.next()}
      onSpeed={cycleSpeed}
      onExit={() => {
        poseTimeline.stop();
        ssaTimeline.stop();
      }}
      onTakeover={takeover}
      mode={activeTimeline?.mode ?? 'auto'}
      onMode={() => {
        const next = (activeTimeline?.mode ?? 'auto') === 'auto' ? 'step' : 'auto';
        poseTimeline.setMode(next);
        ssaTimeline.setMode(next);
      }}
    />
  );

  const measureBar = (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {t.readout}</h3>
        <p className="text-[0.625rem] mono-font text-[var(--fg)]">{t.cond[mode].name} <span className="text-[var(--muted)]">· {t.cond[mode].given}</span></p>
      </div>
      {mode === 'hl' && <p className="text-[0.6875rem] mono-font text-[var(--muted)] leading-relaxed">{t.hlNote}</p>}
      {displayOverlayed && (
        <p className={`text-xs serif-font leading-relaxed flex items-start gap-1.5 ${isCongruent ? 'text-[var(--fg)]' : 'text-[var(--muted)]'}`}>
          <span className="shrink-0 pt-0.5">{isCongruent ? CHECK_ICON : X_ICON}</span>
          <span>
            {isCongruent
              ? t.matchOk
              : lang === 'zh'
                ? `${t.matchFail}：${t.gapAt} ${gaps?.at}′，差 ${r1(gaps?.max ?? 0)} ${t.units}`
                : `${t.matchFail} — ${t.gapAt} ${gaps?.at}′ by ${r1(gaps?.max ?? 0)} ${t.units}`}
          </span>
        </p>
      )}
      <div className="border-t border-[var(--border)] pt-1">
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
          {([['a', 'BC'], ['b', 'CA'], ['c', 'AB']] as const).map(([k, name]) => (
            <div key={k} className="min-w-0 border border-[var(--border)] px-1.5 py-0">
              <p className="truncate text-[0.5rem] mono-font leading-none text-[var(--muted)]">{t.side} {k}={name}</p>
              <p className="text-[0.625rem] mono-font leading-none tabular-nums text-[var(--fg)]">
                {r1(refM[k])} <span className="text-[var(--muted)]">/ {candM ? r1(candM[k]) : '—'}</span>
              </p>
            </div>
          ))}
          {([['A', '∠A'], ['B', '∠B'], ['C', '∠C']] as const).map(([k, name]) => (
            <div key={k} className="min-w-0 border border-[var(--border)] px-1.5 py-0.5">
              <p className="truncate text-[0.5rem] mono-font leading-none text-[var(--muted)]">{t.angle} {name}</p>
              <p className="text-[0.625rem] mono-font leading-none tabular-nums text-[var(--fg)]">
                {r0(refM[k])}° <span className="text-[var(--muted)]">/ {candM ? `${r0(candM[k])}°` : '—'}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[0.55rem] mono-font leading-none text-[var(--muted)]">{t.dragHint}</p>
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

  const viewBox = (() => { const w = VIEW_W / viewZoom; const h = VIEW_H / viewZoom; return `${(VIEW_W - w) / 2} ${(VIEW_H - h) / 2} ${w} ${h}`; })();
  const resetViewport = () => { setViewZoom(1); setPose(HOME_POSE); setOverlayed(false); };

  return (
    <LabStageShell titleZh="三角形全等" titleEn="Triangle Congruence" labId="congruence" variant={isDesktop ? 'sheet' : 'default'}
      center={stageNav}>
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto">
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="lg:hidden shrink-0">{stageNav}</div>

      <div className="grid grid-cols-1 items-start gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* 左列：画布 + 读数 */}
        <div className={`contents lg:block lg:h-full lg:min-h-0 lg:min-w-0 lg:space-y-4`}>
          <div ref={canvasRef} className="min-w-0 order-1 lg:order-none lg:h-full">
            <CanvasSurface
              active={!!activeTimeline}
              hud={demoHud}
              showToolbar={stage !== 'predict'}
              titleSlot={<span className="truncate">{lang === 'zh' ? '判定条件' : 'Condition'} <strong>{t.cond[mode].name}</strong><span className="hidden sm:inline"> · {t.cond[mode].given}</span></span>}
              actionsSlot={<>
                {mode === 'ssa' && (
                  <button type="button" onClick={() => pickBranch(displayBranch === 0 ? 1 : 0)} className="compact inline-flex h-7 shrink-0 items-center rounded-full border border-[var(--border)] px-2 text-[0.625rem] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]">{displayBranch === 0 ? t.altSolutionBtn : t.sameSolutionBtn}</button>
                )}
                <button type="button" onClick={overlay} className="compact inline-flex h-7 shrink-0 items-center rounded-full border border-[var(--border)] px-2 text-[0.625rem] text-[var(--fg)] hover:bg-[var(--accent-light)]"><Play className="h-3 w-3" aria-hidden="true" /> {t.demoStart}</button>
                <CanvasZoomControls onZoomIn={() => setViewZoom((z) => Math.min(1.6, z + 0.1))} onZoomOut={() => setViewZoom((z) => Math.max(0.75, z - 0.1))} onReset={resetViewport} />
              </>}
              footerBar={stage === 'predict' ? undefined : measureBar}
            >
            <svg
              ref={svgRef}
              viewBox={viewBox}
              className="block h-full w-full"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={t.ariaCanvas}
              style={{ touchAction: 'none' }}
              onPointerMove={onPoseMove}
              onPointerUp={onPoseUp}
              onPointerCancel={onPoseUp}
              onPointerLeave={onPoseUp}
              onPointerDownCapture={(e) => {
                if (poseTimeline.active || ssaTimeline.active) {
                  e.preventDefault();
                  e.stopPropagation();
                  takeover();
                }
              }}
            >
              {/* 基准三角形 */}
              <path d={triPath(refTri, REF_POSE)} fill="var(--accent-light)" fillOpacity="0.35" stroke="var(--fg)" strokeWidth="1.6" strokeLinejoin="round" />
              {(['A', 'B', 'C'] as const).map((k, i) => {
                const p = toScreen(refTri[k], REF_POSE);
                const lp = refLabelInfos[i];
                return (
                  <g key={'ref' + k}>
                    <circle cx={p.x} cy={p.y} r="3.2" fill="var(--fg)" />
                    <text x={lp.x} y={lp.y} textAnchor={lp.anchor} fontSize="14" fill="var(--fg)" fontFamily="var(--f-mono)">
                      {k}
                    </text>
                  </g>
                );
              })}

              {/* 待判定三角形 */}
              {candTri && (
                <g>
                  {/* SSA 轨迹：以 C 为圆心、a 为半径；两个交点是 B 的两个离散位置 */}
                  {mode === 'ssa' && ssaTimeline.active && demoLocus && (
                    <g pointerEvents="none">
                      <circle
                        cx={toScreen(candTri.C, displayPose).x}
                        cy={toScreen(candTri.C, displayPose).y}
                        r={measure(candTri).a * SCALE}
                        fill="none"
                        stroke="var(--muted)"
                        strokeWidth="1"
                        strokeDasharray="5 4"
                        opacity="0.8"
                      />
                      {([0, 1] as const).map((b) => {
                        const t = buildByCondition('ssa', refTri, b);
                        if (!t) return null;
                        const p = toScreen(t.B, displayPose);
                        return <circle key={b} cx={p.x} cy={p.y} r="4" fill="var(--card-bg)" stroke="var(--accent)" strokeWidth="1.5" />;
                      })}
                    </g>
                  )}
                  <g
                    ref={candidateGroupRef}
                    transform={`translate(${displayPose.tx} ${displayPose.ty}) rotate(${(displayPose.rot * 180) / Math.PI})`}
                  >
                    <path
                      d={`M ${(candTri.A.x * SCALE).toFixed(2)} ${(-candTri.A.y * SCALE).toFixed(2)} L ${(candTri.B.x * SCALE).toFixed(2)} ${(-candTri.B.y * SCALE).toFixed(2)} L ${(candTri.C.x * SCALE).toFixed(2)} ${(-candTri.C.y * SCALE).toFixed(2)} Z`}
                      fill="var(--accent-light)"
                      fillOpacity="0.25"
                      stroke="var(--accent)"
                      strokeWidth="1.6"
                      strokeDasharray={displayOverlayed && isCongruent ? '0' : '6 4'}
                      strokeLinejoin="round"
                      style={!activeTimeline ? { cursor: 'grab', touchAction: 'none' } : undefined}
                      onPointerDown={!activeTimeline ? onPoseDown('move') : undefined}
                    />
                    {(['A', 'B', 'C'] as const).map((k) => (
                      <circle key={'canddot' + k} cx={candTri[k].x * SCALE} cy={-candTri[k].y * SCALE} r="3.2" fill="var(--accent)" />
                    ))}
                  </g>
                  {(['A', 'B', 'C'] as const).map((k) => {
                    const lp = candidateLabelInfos?.[k];
                    if (!lp) return null;
                    return (
                      <text
                        key={'candlabel' + k}
                        ref={(el) => { candidateLabelRefs.current[k] = el; }}
                        x={lp.x}
                        y={lp.y}
                        textAnchor={lp.anchor}
                        fontSize="13"
                        fill="var(--accent)"
                        fontFamily="var(--f-mono)"
                        pointerEvents="none"
                      >
                        {k}′
                      </text>
                    );
                  })}

                  {/* 直接操纵手柄：中心平移，A′ 圆环旋转；拖动即退出自动叠合态 */}
                  {!activeTimeline && candCentroid && (
                    <g role="group" aria-label={lang === 'zh' ? '候选三角形拖拽手柄' : 'Candidate triangle handles'}>
                      <circle
                        cx={candCentroid.x} cy={candCentroid.y} r="15"
                        fill="var(--card-bg)" stroke="var(--accent)" strokeWidth="1.4"
                        style={{ cursor: 'grab', touchAction: 'none' }}
                        onPointerDown={onPoseDown('move')}
                      />
                      <line x1={candCentroid.x - 7} y1={candCentroid.y} x2={candCentroid.x + 7} y2={candCentroid.y} stroke="var(--accent)" strokeWidth="1.2" pointerEvents="none" />
                      <line x1={candCentroid.x} y1={candCentroid.y - 7} x2={candCentroid.x} y2={candCentroid.y + 7} stroke="var(--accent)" strokeWidth="1.2" pointerEvents="none" />
                      {(() => {
                        const a = toScreen(candTri.A, displayPose);
                        return (
                          <>
                            <circle
                              cx={a.x} cy={a.y} r="12"
                              fill="transparent" stroke="var(--accent)" strokeWidth="1.2" strokeDasharray="3 2"
                              style={{ cursor: 'grab', touchAction: 'none' }}
                              onPointerDown={onPoseDown('rotate')}
                            />
                            <g transform={`translate(${a.x + 16} ${a.y - 14})`} pointerEvents="none">
                              <path d="M -4 2 A 5 5 0 1 1 4 0" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" />
                              <path d="M 4 0 L 2 -3 M 4 0 L 6 2" fill="none" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" />
                            </g>
                          </>
                        );
                      })()}
                    </g>
                  )}
                  {/* 叠合后仍未重合的顶点：连一条虚线说明差在哪 */}
                  {displayOverlayed && gaps && !isCongruent && (
                    <line
                      x1={toScreen(refTri[gaps.at], REF_POSE).x}
                      y1={toScreen(refTri[gaps.at], REF_POSE).y}
                      x2={toScreen(candTri[gaps.at], displayPose).x}
                      y2={toScreen(candTri[gaps.at], displayPose).y}
                      stroke="var(--muted)"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                  )}
                </g>
              )}
            </svg>

            </CanvasSurface>
          </div>

        </div>

        {/* 右列：条件选择 + 叠合控制 + 三幕 */}
        <div className={`contents lg:block lg:h-full lg:min-h-0 lg:min-w-0 lg:space-y-4 lg:overflow-y-auto`} style={stage === 'predict' ? { display: 'none' } : undefined}>
          <div className="min-w-0 order-2 lg:order-none">
          <ParamDock disabled={stage === 'predict'}
            title={t.paramDock}
            closeLabel={t.paramDockClose}
            anchorRef={canvasRef}
            summary={t.cond[mode].name}
          >
          <div className="border border-[var(--border)] p-4 space-y-3">
            <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {t.condLabel}</h3>
            <div className="grid grid-cols-2 gap-2">
              {condList.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={mode === c.id}
                  onClick={() => pickCondition(c.id)}
                  className={`min-h-[44px] rounded-lg border px-2 py-1.5 text-center text-xs transition-colors ${
                    mode === c.id
                      ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {mode === 'ssa' && (
              <>
                <button
                  type="button"
                  onClick={() => pickBranch(displayBranch === 0 ? 1 : 0)}
                  className="w-full min-h-[44px] rounded-lg border border-[var(--fg)] px-2 py-1.5 text-xs text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors flex items-center justify-center gap-1.5"
                >
                  <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                  {displayBranch === 0 ? t.altSolutionBtn : t.sameSolutionBtn}
                </button>
                <button
                  type="button"
                  onClick={startSsaDemo}
                  className="w-full min-h-[44px] rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
                >
                  {t.ssaDemoBtn}
                </button>
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={moveBack}
                className="min-h-[44px] rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                {t.resetPose}
              </button>
            </div>
          </div>
          </ParamDock>
          </div>

          <section className="min-w-0 order-4 space-y-4 lg:order-none">
          {/* 幕 1 预测 */}
          {stage === 'predict' && (
            <div className="border border-[var(--border)] p-4 space-y-4">
              <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {t.predictTitle}</h3>
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{t.predictQuestion}</p>
              <p className="text-xs text-[var(--muted)] serif-font">{t.predictQuestion2}</p>
              {(
                [
                  ['q1', t.predictQ1],
                  ['q2', t.predictQ2],
                  ['q3', t.predictQ3],
                ] as ['q1' | 'q2' | 'q3', string][]
              ).map(([key, question]) => (
                <div key={key} className="space-y-2">
                  <p className="text-xs font-bold text-[var(--fg)] mono-font">{question}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(
                      [
                        ['yes', t.predYes],
                        ['maybe', t.predMaybe],
                        ['no', t.predNo],
                      ] as [PredictAnswer, string][]
                    ).map(([v, label]) => (
                      <button
                        key={String(v)}
                        type="button"
                        onClick={() => setPred((prev) => ({ ...prev, [key]: v }))}
                        className={`text-center text-xs px-2 py-2 border rounded-lg transition-colors min-h-[44px] leading-snug ${
                          pred[key] === v
                            ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                            : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {predComplete && !revealed && (
                <button
                  type="button"
                  onClick={() => {
                    setRevealed(true);
                    setStage('explore');
                  }}
                  className="w-full min-h-[44px] rounded-lg border border-[var(--fg)] bg-[var(--fg)] px-3 py-2 text-xs font-semibold text-[var(--bg)] hover:opacity-90 transition-opacity"
                >
                  {t.revealLabel}
                </button>
              )}
              {!predComplete && <p className="text-[0.6875rem] mono-font text-[var(--muted)]">{t.predictHint}</p>}
            </div>
          )}

          {/* 幕 2 探索 */}
          {stage === 'explore' && (
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
          )}

          {/* 幕 3 结论 */}
          {stage === 'conclude' && (
            <div className="border border-[var(--border)] p-4 space-y-4">
              <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {t.concludeTitle}</h3>
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{t.concludeQuestion}</p>
              {(['q1', 'q2', 'q3', 'q4'] as const).map((key) => (
                <div key={key} className="space-y-2">
                  <p className="text-xs font-bold text-[var(--fg)] mono-font">{(t as unknown as Record<string, string>)['concludeQ' + key.slice(1)]}</p>
                  {optionRow(key, OPTIONS[key] as unknown as [string, string][])}
                </div>
              ))}
              {conclusionComplete && (
                <div className="border-l-2 border-[var(--fg)] pl-3 space-y-2">
                  <p className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">{t.feedbackTitle}</p>
                  <p className="text-xs serif-font leading-relaxed text-[var(--fg)]">{t.feedbackText}</p>
                  <p className="text-[0.6875rem] mono-font text-[var(--muted)]">
                    {lang === 'zh' ? '观察记录：' : 'Evidence: '}{observations.filter((o) => o.balanced).length} {lang === 'zh' ? '条重合' : 'fit'} / {observations.filter((o) => !o.balanced).length} {lang === 'zh' ? '条合不上' : 'miss'}
                  </p>
                </div>
              )}
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
