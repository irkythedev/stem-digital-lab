/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学探究 · 一次函数 y = kx + b 三幕式探究（人教版 八下第 19 章）
 *
 * 幕 1 预测：给定 y = 2x - 3，先猜图像形状 / 与 y 轴交点，再揭示
 * 幕 2 探索：控制变量卡（k 斜率 / b 截距 / 特殊点 / 实际建模）+ 钉住曲线 + 观察笔记
 * 幕 3 结论：k 决定倾斜方向与陡缓，b 决定与 y 轴交点
 *
 * 复用组件：CoordPlane、ExploreStage、LabIcon（一次函数用直线图标）。
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import { ChevronRight, Minus, Pin, Plus, RotateCcw } from 'lucide-react';
import { setLabState, setPageQuestion } from '../../lib/ai-dynamic-questions';
import { useCriticalDetent } from '../../lib/detent-feedback';

const K_DETENTS = [-1, 1] as const;
const ZERO_DETENT = [0] as const;
import { Check, X } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { useAiContext } from '../../lib/ai-context';
import PredictionStamp from '../../components/lab/PredictionStamp';
import ParamSlider from '../../components/lab/ParamSlider';
import ToggleSwitch from '../../components/lab/ToggleSwitch';
import CoordPlane, { type CoordCurve, type CoordMarker, type CoordOverlay, mathMinus } from '../../components/lab/CoordPlane';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import ConcludeNextActions from '../../components/lab/ConcludeNextActions';
import Formula from '../../components/ui/Formula';
import StageNav from '../../components/lab/StageNav';
import ParamDock from '../../components/lab/ParamDock';
import MathCanvasStage from '../../components/lab/MathCanvasStage';
import { LinearIcon } from '../../components/ui/LabIcon';
import { slopeTriangle } from './linear-core';
import { boolParam, enumParam, numParam, readUrlParams, useLabUrlSync } from '../../lib/lab-url-state';

type Stage = 'predict' | 'explore' | 'conclude';

/** 预测题：图像倾斜方向 */
type PredictSlope = 'up' | 'down' | 'flat' | null;
type PredictIntercept = 'pos' | 'neg' | 'zero' | null;

/** 采样一次函数：x ∈ [-4, 4]，y = kx + b */
function sampleLinear(k: number, b: number, xMin = -4, xMax = 4): [number, number][] {
  const pts: [number, number][] = [];
  // 索引乘法取点；区间可随全画布视窗扩展，末点仍精确落在 xMax。
  const span = Math.max(0.05, xMax - xMin);
  const N = Math.round(span / 0.05);
  const step = span / Math.max(1, N);
  for (let i = 0; i <= N; i++) {
    const x = xMin + i * step;
    pts.push([x, k * x + b]);
  }
  return pts;
}

/** 拉平表达式为 "y = kx + b" */
function exprOf(k: number, b: number): string {
  if (k === 0) return mathMinus(`y = ${b}`);
  const kPart = k === 1 ? 'x' : k === -1 ? '-x' : `${k}x`;
  if (b === 0) return mathMinus(`y = ${kPart}`);
  return mathMinus(`y = ${kPart} ${b > 0 ? `+ ${b}` : `- ${Math.abs(b)}`}`);
}

/** 函数类型标注：一次函数 / 正比例函数（特例）/ 常函数（非一次函数） */
function fnTypeLabel(k: number, b: number): { zh: string; en: string } | null {
  if (k === 0) return { zh: '常函数（k = 0，不是一次函数）', en: 'Constant function (k = 0, not a linear function)' };
  if (b === 0) return { zh: '正比例函数（一次函数的特例）', en: 'Direct-proportion function (special case of linear)' };
  return { zh: '一次函数', en: 'Linear function' };
}

/** 把实验内使用的 Unicode 表达式转成 KaTeX LaTeX（仅用于展示层）。 */
function texExpr(expr: string): string {
  return expr.replace(/²/g, '^2').replace(/−/g, '-');
}

const copy = {
  zh: {
    params: '参数',
    paramDock: '调节参数',
    paramDockClose: '收起参数',
    readout: '当前函数',
    guides: '辅助线',
    guidesOffHint: '辅助线已关闭：画布上的虚线与标注暂不显示，先自己看图判断。',
    reset: '重置',
    stagePredict: '预测',
    stageExplore: '探索',
    stageConclude: '结论',
    stageDone: '完成',
    nextStage: '下一步 →',
    redoLabel: '重新探究',
    // 幕1 预测
    predictTitle: '预测',
    predictQuestion: '看这个函数：',
    predictQuestion2: '先别急着看图像，猜一猜：',
    predictQ1: '图像从左到右是上升还是下降？',
    predictUp: '上升（k > 0）',
    predictDown: '下降（k < 0）',
    predictFlat: '水平（k = 0）',
    predictQ2: '图像与 y 轴的交点在？',
    predictInterceptPos: '正半轴（0 上方）',
    predictInterceptNeg: '负半轴（0 下方）',
    predictInterceptZero: '正好在原点',
    predictDone: '已记录你的预测',
    predictHint: '两个都猜完，就可以揭示图像',
    revealLabel: '揭示图像 →',
    // 幕2 探索
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。拖动滑块或点任务卡，看到有意思的状态时记一条。',
    notePlaceholder: '写一句话：你观察到了什么？',
    recordLabel: '记一条观察',
    clearLabel: '清空记录',
    tryLabel: '试试这个',
    pinLabel: '钉住这条曲线',
    unpinLabel: '取消钉住',
    pinnedTitle: '已钉住的曲线',
    pinnedCount: (n: number) => `已钉 ${n} 条`,
    clearPinned: '清除钉住',
    pinnedEmpty: '（未钉住。钉住不同 k 的直线，看倾斜变化）',
    cards: [
      {
        title: 'k 的魔法（斜率）',
        prompt: '固定 b=0，只改 k：k 从 1 变 2，直线变陡还是变缓？k 变负数呢？',
      },
      {
        title: 'b 的平移（截距）',
        prompt: '固定 k=1，只改 b：b 从 0 变 3，直线往哪移？与 y 轴交点怎么变？',
      },
      {
        title: '特殊点',
        prompt: '设 k=2、b=-3，看与 y 轴交点是不是 (0,-3)？x=1 时 y 是多少？',
      },
      {
        title: '实际建模',
        prompt: '出租车起步价 8 元（含 2km），之后每 km 2.5 元。费用 y 与里程 x 的关系是 y = 2.5x + 3（超过 2km 部分）。调 k、b 匹配这条线。',
      },
    ],
    // 幕3 结论
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，k 和 b 各自起什么作用？',
    concludeQ1: 'k 决定：',
    concludeQ1Slope: '直线的倾斜方向与陡缓',
    concludeQ1Shift: '直线的上下平移',
    concludeQ1None: '没有作用',
    concludeQ2: 'b 决定：',
    concludeQ2Intercept: '与 y 轴的交点 (0, b)',
    concludeQ2Slope: '直线的倾斜程度',
    concludeQ2None: '没有作用',
    concludeQ3: '|k| 越大：',
    concludeQ3Steep: '直线越陡',
    concludeQ3Flat: '直线越平缓',
    concludeQ3None: '无影响',
    concludeQ4: 'k > 0 时：',
    concludeQ4Up: 'y 随 x 的增大而增大（从左到右上升）',
    concludeQ4Down: 'y 随 x 的增大而减小（从左到右下降）',
    concludeQ4None: '无规律',
    concludeHint: '选完四个，看看结论和你的观察是否一致',
    feedbackText:
      '一次函数 y = kx + b：k 是斜率，决定直线的倾斜方向（k>0 上升、k<0 下降）与陡缓（|k| 越大越陡）；' +
      'b 是截距，决定直线与 y 轴的交点 (0, b)。实际问题中 k 常表示单位变化量、b 表示初始值。',
    concludeSkipHint: '还没在预测幕猜过倾斜方向——建议先回预测幕完成预测，再做结论会更有意义。',
    tipsTitle: '考点速记',
    tips: [
      '一次函数 y=kx+b：k 是斜率决定倾斜方向与陡缓，b 是截距决定与 y 轴交点 (0,b)。',
      '一次函数 y=kx+b（k≠0）；当 b=0 时是正比例函数 y=kx，正比例函数是一次函数的特殊情形。',
      'k>0 图像从左到右上升（增函数），k<0 下降（减函数）。',
      '实际问题中 k 常表示单位变化量（如每 km 单价），b 表示初始值（如起步价）。',
      '两条直线平行 ⇔ k 相等；重合 ⇔ k、b 都相等。',
      '求交点：令两函数值相等解方程；求与坐标轴交点：令 x=0 或 y=0。',
      '代数推导（证明增减性）：设 x₁<x₂，则 f(x₂)−f(x₁)=k(x₂−x₁)。若 k>0，差为正，图像上升（增函数）；若 k<0，差为负，图像下降（减函数）。',
    ],
  },
  en: {
    params: 'Parameters',
    paramDock: 'Adjust parameters',
    paramDockClose: 'Close',
    readout: 'Current function',
    guides: 'Guides',
    guidesOffHint: 'Guides are off: dashed reference lines and labels are hidden — read the graph yourself first.',
    reset: 'Reset',
    stagePredict: 'Predict',
    stageExplore: 'Explore',
    stageConclude: 'Conclude',
    stageDone: 'Done',
    nextStage: 'Next →',
    redoLabel: 'Redo',
    predictTitle: 'Predict',
    predictQuestion: 'Look at this function:',
    predictQuestion2: 'Before seeing the graph, guess:',
    predictQ1: 'Does the line rise or fall from left to right?',
    predictUp: 'Rises (k > 0)',
    predictDown: 'Falls (k < 0)',
    predictFlat: 'Horizontal (k = 0)',
    predictQ2: 'Where does the line cross the y-axis?',
    predictInterceptPos: 'Above 0 (positive)',
    predictInterceptNeg: 'Below 0 (negative)',
    predictInterceptZero: 'At the origin',
    predictDone: 'Your prediction is recorded',
    predictHint: 'Answer both to reveal the graph',
    revealLabel: 'Reveal graph →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Drag the sliders or try a card, and note what you see.',
    notePlaceholder: 'Write one sentence: what did you observe?',
    recordLabel: 'Note it',
    clearLabel: 'Clear notes',
    tryLabel: 'Try it',
    pinLabel: 'Pin this line',
    unpinLabel: 'Unpin',
    pinnedTitle: 'Pinned lines',
    pinnedCount: (n: number) => `${n} pinned`,
    clearPinned: 'Clear pinned',
    pinnedEmpty: '(nothing pinned — pin lines with different k and watch the slope change)',
    cards: [
      {
        title: 'k: the slope',
        prompt: 'Fix b=0 and change only k: from 1 to 2, does the line get steeper or flatter? What if k goes negative?',
      },
      {
        title: 'b: the intercept',
        prompt: 'Fix k=1 and change only b: from 0 to 3, which way does the line move? Where does it cross the y-axis?',
      },
      {
        title: 'Special points',
        prompt: 'Set k=2, b=-3. Does the line cross the y-axis at (0,-3)? What is y when x=1?',
      },
      {
        title: 'Real-world model',
        prompt: 'A taxi charges 8 yuan for the first 2 km, then 2.5 yuan per km. The fare y vs distance x is y = 2.5x + 3 (beyond 2 km). Match k and b to this line.',
      },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what do k and b do?',
    concludeQ1: 'k decides:',
    concludeQ1Slope: 'the slope direction and steepness',
    concludeQ1Shift: 'vertical shift of the line',
    concludeQ1None: 'nothing',
    concludeQ2: 'b decides:',
    concludeQ2Intercept: 'the y-intercept (0, b)',
    concludeQ2Slope: 'the steepness',
    concludeQ2None: 'nothing',
    concludeQ3: 'Larger |k| makes the line:',
    concludeQ3Steep: 'steeper',
    concludeQ3Flat: 'flatter',
    concludeQ3None: 'no effect',
    concludeQ4: 'When k > 0, the graph:',
    concludeQ4Up: 'rises left to right (increasing)',
    concludeQ4Down: 'falls left to right (decreasing)',
    concludeQ4None: 'no pattern',
    concludeHint: 'Answer all four, then see if your conclusion matches your observations',
    feedbackText:
      'For y = kx + b: k is the slope — it decides the direction (k>0 rises, k<0 falls) and steepness (larger |k|, steeper); ' +
      'b is the intercept — it decides where the line crosses the y-axis at (0, b). In real problems, k is often the rate of change and b the initial value.',
    concludeSkipHint: "You haven't predicted the slope direction yet — go back to the Predict stage first.",
    tipsTitle: 'Key Points',
    tips: [
      'Linear functions y=kx+b: k is the slope (direction & steepness), b is the y-intercept (0,b).',
      'Linear functions y=kx+b (k≠0); when b=0 it is a direct-proportion function y=kx, a special case of a linear function.',
      'k>0: rises left-to-right (increasing); k<0: falls (decreasing).',
      'In real problems k is often the unit rate (e.g. price per km), b the initial value (e.g. base fare).',
      'Two lines are parallel iff k is equal; identical iff k and b are both equal.',
      'To find intersections: set the two functions equal; for axis intercepts set x=0 or y=0.',
      'Algebraic derivation (prove monotonicity): let x₁<x₂, then f(x₂)−f(x₁)=k(x₂−x₁). If k>0 the difference is positive (increasing); if k<0 it is negative (decreasing).',
    ],
  },
};

/** 预测目标函数：y = 2x - 3（上升、截距 -3） */
const TARGET_K = 2;
const TARGET_B = -3;

const CHECK_ICON = <Check className="inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em]" aria-hidden="true" />;
const X_ICON = <X className="inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em]" aria-hidden="true" />;


/**
 * 题库注册表：选项顺序与判分答案的单一事实源。
 * 渲染侧按同一顺序排布；smoke 守卫解析源码断言二者一致（防「改了渲染忘了改注册表」）。
 */
export const OPTIONS = {
  q1: [['none', 'concludeQ1None'], ['slope', 'concludeQ1Slope'], ['shift', 'concludeQ1Shift']],
  q2: [['slope', 'concludeQ2Slope'], ['none', 'concludeQ2None'], ['intercept', 'concludeQ2Intercept']],
  q3: [['steep', 'concludeQ3Steep'], ['flat', 'concludeQ3Flat'], ['none', 'concludeQ3None']],
  q4: [['none', 'concludeQ4None'], ['up', 'concludeQ4Up'], ['down', 'concludeQ4Down']],
} as const;

/** 每题正确选项值（多解用数组）。 */
export const QUIZ_CORRECT: Record<string, string[]> = {
  q1: ['slope'],
  q2: ['intercept'],
  q3: ['steep'],
  q4: ['up'],
};

export default function Linear() {
  const { lang } = useApp();
  const { askAi } = useAiContext();
  const t = copy[lang];
  const initialUrl = readUrlParams();

  const [stage, setStage] = useState<Stage>(() => enumParam(initialUrl.get('stage'), ['predict', 'explore', 'conclude'] as const, 'predict'));
  const [stampClosed, setStampClosed] = useState(false);
  useEffect(() => { if (stage === 'explore') setStampClosed(false); }, [stage]);
  const [predSlope, setPredSlope] = useState<PredictSlope>(null);
  const [predIntercept, setPredIntercept] = useState<PredictIntercept>(null);
  const [revealed, setRevealed] = useState(false);
  const [k, setK] = useState(() => numParam(initialUrl.get('k'), TARGET_K, -5, 5));
  const [b, setB] = useState(() => numParam(initialUrl.get('b'), TARGET_B, -5, 5));
  useCriticalDetent(k, K_DETENTS);
  useCriticalDetent(b, ZERO_DETENT);
  const [pinned, setPinned] = useState<{ id: number; k: number; b: number }[]>([]);
  // 辅助线开关：控制画布上的虚线/标注层（反比例=渐近线，一次函数=与 y 轴交点）
  const [showGuides, setShowGuides] = useState(() => boolParam(initialUrl.get('guides'), true));
  const [isDesktop, setIsDesktop] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [viewCommand, setViewCommand] = useState({ factor: 1, reset: false, nonce: 0 });
  const zoomViewport = (factor: number) => setViewCommand((v) => ({ factor, reset: false, nonce: v.nonce + 1 }));
  const resetViewport = () => setViewCommand((v) => ({ factor: 1, reset: true, nonce: v.nonce + 1 }));
  useLabUrlSync({ stage, k, b, guides: showGuides }, { stage: 'predict', k: TARGET_K, b: TARGET_B, guides: true }, [stage, k, b, showGuides]);
  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 1024px)');
    const sync = () => setIsDesktop(!!mq?.matches);
    sync();
    mq?.addEventListener?.('change', sync);
    return () => mq?.removeEventListener?.('change', sync);
  }, []);
  const planeRef = useRef<HTMLDivElement>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [conclusion, setConclusion] = useState<{
    q1: 'slope' | 'shift' | 'none' | null;
    q2: 'intercept' | 'slope' | 'none' | null;
    q3: 'steep' | 'flat' | 'none' | null;
    q4: 'up' | 'down' | 'none' | null;
  }>({ q1: null, q2: null, q3: null, q4: null });

  /** 判分表：引用导出的注册表（单一事实源） */
  const correctKeys = QUIZ_CORRECT;
  const conclusionComplete =
    conclusion.q1 !== null && conclusion.q2 !== null && conclusion.q3 !== null && conclusion.q4 !== null;
  const predComplete = predSlope !== null && predIntercept !== null;
  const predictionCorrect = predSlope === 'up' && predIntercept === 'neg';
  const predictionSummary = predComplete
    ? (lang === 'zh'
        ? `${predSlope === 'up' ? '上升' : predSlope === 'down' ? '下降' : '水平'} · ${predIntercept === 'pos' ? '交 y 轴正半轴' : predIntercept === 'neg' ? '交 y 轴负半轴' : '过原点'}`
        : `${predSlope === 'up' ? 'rising' : predSlope === 'down' ? 'falling' : 'horizontal'} · ${predIntercept === 'pos' ? 'positive y-intercept' : predIntercept === 'neg' ? 'negative y-intercept' : 'through the origin'}`)
    : '';
  const showPredictionStamp = stage === 'explore' && predComplete && !stampClosed;
  const askWhy = () => askAi(lang === 'zh'
    ? `我在预测阶段选了「${predictionSummary}」，但实测结果与预测不一致。请结合当前实验读数和画布现象，先别直接给结论，告诉我应该观察或比较哪些量，才能找出差异的原因。`
    : `In the Predict stage I chose “${predictionSummary}”, but the measurement differs. Using the current readings and what is on the canvas, please do not give the conclusion directly — tell me which quantities to observe or compare to find why they differ.`);

  const sampleMin = isDesktop ? -14 : -4;
  const sampleMax = isDesktop ? 14 : 4;
  const currentCurve: CoordCurve = useMemo(
    () => ({
      id: 'main',
      points: sampleLinear(k, b, sampleMin, sampleMax),
      label: exprOf(k, b),
    }),
    [k, b, sampleMin, sampleMax],
  );

  const pinnedCurves: CoordCurve[] = pinned.map((p) => ({
    id: `pin${p.id}`,
    points: sampleLinear(p.k, p.b, sampleMin, sampleMax),
    dashed: true,
    label: exprOf(p.k, p.b),
  }));

  const curves = [currentCurve, ...pinnedCurves];

  // Manim 式标注：与 y 轴交点（截距点，随 b 上下移动）
  const markers = useMemo<CoordMarker[]>(
    (): CoordMarker[] => [
      {
        key: 'intercept',
        // 截距点正好在直线上：文字朝「直线不来的一侧」放——k>0 直线向右上走，文字放左上；
        // k<0 向左上走，文字放右上。否则文字必然被直线穿过（实测 (0,−3) 与 y=2x−3 相交）。
        dot: {
          x: 0, y: b, label: `(0, ${Math.round(b * 10) / 10})`, color: 'var(--accent)',
          side: k > 0 ? 'left' : 'right',
        },
      },
    ],
    [b, k],
  );

  /** 斜率阶梯：固定 Δx=1，直观显示「走 1 格、升 k 格」 */
  const slopeOverlays = useMemo<CoordOverlay[]>(() => {
    const tri = slopeTriangle(k, b);
    if (k === 0) {
      return [
        { kind: 'segment', x1: tri.x0, y1: tri.y0, x2: tri.x1, y2: tri.y0, dash: '4 3', color: 'var(--muted)' },
        { kind: 'label', x: 0.5, y: tri.y0, text: 'Δx = 1', place: 'below', color: 'var(--muted)' },
        { kind: 'label', x: 1, y: tri.y0, text: 'Δy = 0', place: 'above', color: 'var(--accent)' },
      ];
    }
    return [
      { kind: 'segment', x1: tri.x0, y1: tri.y0, x2: tri.x1, y2: tri.y0, dash: '4 3', color: 'var(--muted)' },
      { kind: 'segment', x1: tri.x1, y1: tri.y0, x2: tri.x1, y2: tri.y1, dash: '4 3', color: 'var(--accent)' },
      { kind: 'rightAngle', x: tri.x1, y: tri.y0, ux: -1, uy: 0, vx: 0, vy: Math.sign(k), size: 8, color: 'var(--muted)' },
      { kind: 'label', x: 0.5, y: tri.y0, text: 'Δx = 1', place: 'below', color: 'var(--muted)' },
      { kind: 'label', x: tri.x1, y: (tri.y0 + tri.y1) / 2, text: `Δy = ${mathMinus(tri.dy)}`, place: 'right', color: 'var(--accent)' },
    ];
  }, [k, b]);

  const reset = () => {
    setK(TARGET_K);
    setB(TARGET_B);
  };

  const redoAll = () => {
    setStage('predict');
    setPredSlope(null);
    setRevealed(false);
    setK(TARGET_K);
    setB(TARGET_B);
    setPinned([]);
    setObservations([]);
    setConclusion({ q1: null, q2: null, q3: null, q4: null });
  };

  const reveal = () => {
    setRevealed(true);
    setStage('explore');
  };

  const addObservation = (note: string) => {
    setObservations((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        snapshot: [
          { label: 'k', value: String(k) },
          { label: 'b', value: String(b) },
          { label: 'f(x)', value: exprOf(k, b) },
        ],
        note,
      },
    ]);
  };

  const cards: ExploreCard[] = [
    {
      key: 'card-k',
      title: t.cards[0].title,
      prompt: t.cards[0].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setK(2);
        setB(0);
      },
    },
    {
      key: 'card-b',
      title: t.cards[1].title,
      prompt: t.cards[1].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setK(1);
        setB(3);
      },
    },
    {
      key: 'card-point',
      title: t.cards[2].title,
      prompt: t.cards[2].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setK(2);
        setB(-3);
      },
    },
    {
      key: 'card-model',
      title: t.cards[3].title,
      prompt: t.cards[3].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setK(2.5);
        setB(3);
      },
    },
  ];

  const isPinned = pinned.some((p) => p.k === k && p.b === b);

  const stageOrder: Stage[] = ['predict', 'explore', 'conclude'];
  const stageIdx = stageOrder.indexOf(stage);

  // AI：实时状态登记（当前阶段 + 核心受控变量），供系统提示词与「问 AI」动态问句读取
  useEffect(() => {
    const xZero = k === 0 ? null : -b / k;
    setLabState('linear', {
      stage,
      k,
      b,
      slopeDy: k,
      revealed,
      ...(predSlope !== null && predIntercept !== null
        ? {
            predictionCorrect: predSlope === 'up' && predIntercept === 'neg',
            predictionSummary: `${predSlope === 'up' ? '上升' : predSlope === 'down' ? '下降' : '水平'} · ${predIntercept === 'pos' ? '交 y 轴正半轴' : predIntercept === 'neg' ? '交 y 轴负半轴' : '过原点'}`,
          }
        : {}),
      ...(xZero === null ? {} : { xZero }),
    });
  }, [stage, k, b, revealed, predSlope, predIntercept]);
  // 页面级「问 AI」问句：登记到页级注册表，点击标题旁入口时取用（动态实验含当前读数）
  useEffect(() => {
    setPageQuestion('linear', lang === 'zh' ? '改变 k 或 b 时，直线的倾斜方向、与坐标轴交点和图像读数怎样变化？' : 'As you change k or b, how do the line direction, axis intercepts and graph readings change?');
  }, [lang]);

  return (
    <MathCanvasStage
      variant={isDesktop ? 'sheet' : 'default'}
      title={lang === 'zh' ? '一次函数' : 'Linear Functions'}
      grade={lang === 'zh' ? '7-9 年级' : 'Grades 7-9'}
      backHref="/subject/math"
      backLabel={lang === 'zh' ? '返回数学' : 'Back to Math'}
      labId="linear"
      aiQuestion={lang === 'zh' ? '请讲解一次函数 y=kx+b 中 k 与 b 的几何意义' : 'Explain the geometric meaning of k and b in y=kx+b'}
      icon={<LinearIcon className="h-4 w-4" aria-hidden="true" />}
      shareTitle={lang === 'zh' ? '一次函数 · 数理化数字实验室' : 'Linear Functions · STEM Digital Lab'}
      center={
        <StageNav
          stage={stage}
          setStage={setStage}
          stageOrder={stageOrder}
          labels={{ predict: t.stagePredict, explore: t.stageExplore, conclude: t.stageConclude, next: t.nextStage, redo: t.redoLabel }}
          onRedo={redoAll}
          isDone={{ predict: predSlope !== null && predIntercept !== null, explore: observations.length > 0, conclude: Object.values(conclusion).every((v) => v !== null) }}
        />
      }
    >
    <div className="flex flex-col space-y-4 lg:contents">

      {/* 幕导航：移动端保留，桌面已移入 MathCanvasStage 一字页头 */}
      <div className="lg:hidden">
      <StageNav
        stage={stage}
        setStage={setStage}
        stageOrder={stageOrder}
        labels={{
          predict: t.stagePredict,
          explore: t.stageExplore,
          conclude: t.stageConclude,
          next: t.nextStage,
          redo: t.redoLabel,
        }}
        onRedo={redoAll}
        isDone={{
          predict: predSlope !== null && predIntercept !== null,
          explore: observations.length > 0,
          conclude: Object.values(conclusion).every((v) => v !== null),
        }}
      />
      </div>

      <div className="grid items-start gap-5 lg:contents lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* 左列：坐标系 + 读数 */}
        <div className={`flex flex-col space-y-4 lg:absolute lg:inset-y-0 lg:left-0 lg:z-0 lg:block lg:space-y-0 ${stage === 'conclude' ? 'lg:right-[460px] xl:right-[500px]' : inspectorOpen && stage === 'explore' ? 'lg:right-[330px]' : 'lg:right-0'} ${stage === 'predict' && !revealed ? 'hidden lg:block' : ''}`}>
          <div ref={planeRef} className="flex flex-col space-y-6 lg:block lg:h-full lg:space-y-0">
            <div className="overflow-hidden border border-[var(--border)] bg-[var(--card-bg)] max-sm:min-h-[440px] max-sm:max-h-[65dvh] lg:h-full lg:border-0 lg:bg-transparent">
              <div className={`hidden items-center justify-between border-b border-[var(--border)] bg-[var(--card-bg)] px-3 lg:flex lg:h-10 ${stage === 'predict' && !revealed ? 'lg:hidden' : ''}`}>
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 text-[0.5625rem] font-bold uppercase tracking-widest text-[var(--muted)] mono-font">// {t.readout}</span>
                  <span className="truncate text-sm text-[var(--fg)]"><Formula tex={texExpr(exprOf(k, b))} /></span>
                  <span className="truncate text-[0.5625rem] mono-font text-[var(--muted)]">{lang === 'zh' ? fnTypeLabel(k, b)?.zh : fnTypeLabel(k, b)?.en}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => zoomViewport(1.25)} aria-label={lang === 'zh' ? '缩小视口' : 'Zoom out'} className="compact flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]"><Minus className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => zoomViewport(0.8)} aria-label={lang === 'zh' ? '放大视口' : 'Zoom in'} className="compact flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]"><Plus className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={resetViewport} aria-label={lang === 'zh' ? '重置视口' : 'Reset view'} className="compact flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]"><RotateCcw className="h-3.5 w-3.5" /></button>
                  <ToggleSwitch label={t.guides} checked={showGuides} onChange={setShowGuides} compact />
                  {!inspectorOpen && <button type="button" onClick={() => setInspectorOpen(true)} aria-label={lang === 'zh' ? '参数' : 'Parameters'} className="ml-1 inline-flex h-7 items-center rounded border border-[var(--border)] px-2 text-[0.5625rem] mono-font text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]">« {lang === 'zh' ? '参数' : 'Parameters'}</button>}
                </div>
              </div>
              {stage === 'predict' && !revealed && (
                <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 p-4 sm:p-6 lg:hidden">
                  <p className="text-[0.6875rem] mono-font uppercase tracking-widest text-[var(--muted)]">
                    {t.predictTitle}
                  </p>
                  <p className="text-sm serif-font text-[var(--fg)]">
                    {t.predictQuestion} <Formula tex={`y = ${TARGET_K}x ${TARGET_B < 0 ? '-' : '+'} ${Math.abs(TARGET_B)}`} />
                  </p>
                  <p className="text-xs text-[var(--muted)] serif-font italic">{t.predictQuestion2}</p>
                </div>
              )}
              <div className={`${stage === 'predict' && !revealed ? 'hidden lg:block' : 'block'} lg:absolute lg:inset-x-0 lg:top-10 lg:bottom-0 lg:h-auto`}>
                <CoordPlane
                  curves={stage === 'predict' && !revealed ? [] : curves}
                  markers={stage === 'predict' && !revealed ? [] : (showGuides ? markers : [])}
                  overlays={stage === 'predict' && !revealed ? [] : (showGuides ? slopeOverlays : [])}
                  xMin={-4}
                  xMax={4}
                  yMin={-10}
                  yMax={10}
                  ariaLabel={`y = kx + b graph`}
                  xLabel="x"
                  yLabel="y"
                  framed={false}
                  viewWidth={isDesktop ? 920 : 640}
                  viewHeight={isDesktop ? 620 : 760}
                  fillContainer={isDesktop}
                  bleed={isDesktop}
                  clipContent={isDesktop}
                  squareGrid={isDesktop}
                  interactiveView={isDesktop}
                  zoomCommand={viewCommand}
                  showLegend={!isDesktop}
                  maxHeightClass={isDesktop ? 'lg:h-full lg:max-h-none min-h-[280px]' : 'max-sm:min-h-[440px] max-sm:max-h-[65dvh] max-h-[min(48vh,440px)]'}
                />
              </div>

              <div data-lab-toolbar="true" className={`mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-3 pb-2.5 pt-2 max-sm:h-9 max-sm:min-h-0 max-sm:items-center max-sm:gap-1 max-sm:px-2 max-sm:py-0 lg:hidden ${stage === 'predict' && !revealed ? 'hidden' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="shrink-0 text-[0.5625rem] font-bold uppercase tracking-widest text-[var(--muted)] mono-font">
                      // {t.readout}
                    </span>
                    <span className="min-w-0 truncate text-sm text-[var(--fg)]"><Formula tex={texExpr(exprOf(k, b))} /></span>
                  </div>
                  <p className={`mt-0.5 truncate text-[0.625rem] mono-font leading-snug ${k === 0 ? 'text-[var(--error)]' : 'text-[var(--muted)]'}`}>
                    {lang === 'zh' ? fnTypeLabel(k, b)?.zh : fnTypeLabel(k, b)?.en}
                  </p>
                </div>
                <ToggleSwitch label={t.guides} checked={showGuides} onChange={setShowGuides} compact />
                {!inspectorOpen && stage !== 'predict' && (
                  <button type="button" onClick={() => setInspectorOpen(true)} aria-label={lang === 'zh' ? '参数' : 'Parameters'} className="ml-1 inline-flex h-7 items-center rounded border border-[var(--border)] px-2 text-[0.5625rem] mono-font text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]">
                    « {lang === 'zh' ? '参数' : 'Parameters'}
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* 右列：参数 + 三幕 */}
        <div className={`flex flex-col space-y-4 ${stage === 'predict' ? 'lg:absolute lg:inset-0 lg:z-30 lg:flex lg:items-center lg:justify-center lg:bg-transparent lg:p-0' : stage === 'conclude' ? 'lg:absolute lg:inset-y-0 lg:right-0 lg:z-20 lg:w-[460px] xl:w-[500px] lg:overflow-y-auto lg:border-l lg:border-[var(--border)] lg:bg-[var(--card-bg)] lg:p-3.5 lg:space-y-3' : inspectorOpen ? 'lg:absolute lg:inset-y-0 lg:right-0 lg:z-20 lg:w-[330px] lg:overflow-y-auto lg:border-l lg:border-[var(--border)] lg:bg-[var(--card-bg)] lg:p-3.5 lg:space-y-3' : 'lg:hidden'}`}>
          {showPredictionStamp && (
            <div className="mb-3 hidden lg:block">
              <PredictionStamp correct={predictionCorrect} summary={predictionSummary} lang={lang} onAsk={askWhy} onClose={() => setStampClosed(true)} />
            </div>
          )}
          <div className={`${stage === 'predict' || stage === 'conclude' ? 'hidden' : 'hidden lg:flex'} shrink-0 items-center justify-between border-b border-[var(--border)] pb-2`}>
            <span className="text-[0.625rem] font-bold uppercase tracking-widest text-[var(--muted)] mono-font">// {lang === 'zh' ? '参数' : 'PARAMETERS'}</span>
            <button type="button" onClick={() => setInspectorOpen(false)} aria-label={lang === 'zh' ? '收起参数' : 'Collapse parameters'} className="inline-flex h-8 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded border border-[var(--border)] px-2 text-[0.5625rem] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
              <span>{lang === 'zh' ? '收起' : 'Collapse'}</span>
            </button>
          </div>
          <div className={stage === 'predict' ? 'hidden' : stage === 'conclude' ? 'lg:hidden' : ''}>
          <ParamDock disabled={stage === 'predict'}
            title={t.paramDock}
            closeLabel={t.paramDockClose}
            anchorRef={planeRef}
            summary={exprOf(k, b)}
          >
          {showPredictionStamp && (
            <div className="mb-3 lg:hidden">
              <PredictionStamp correct={predictionCorrect} summary={predictionSummary} lang={lang} onAsk={askWhy} onClose={() => setStampClosed(true)} />
            </div>
          )}
          <div className="border border-[var(--border)] p-4 space-y-4 lg:border-0 lg:p-0 lg:space-y-3">
            <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase lg:hidden">
              // {t.params}
            </h3>
            <ParamSlider label="k" value={k} min={-5} max={5} step={0.1} onChange={setK} format={(v) => mathMinus(v.toFixed(1))} />
            <ParamSlider label="b" value={b} min={-5} max={5} step={0.1} onChange={setB} format={(v) => mathMinus(v.toFixed(1))} />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
              <button
                type="button"
                onClick={reset}
                className="compact inline-flex items-center rounded px-1.5 py-1 text-xs mono-font uppercase text-[var(--muted)] hover:text-[var(--fg)] active:bg-[var(--accent-light)] transition-colors tap-area"
              >
                {t.reset}
              </button>
              <div className="flex flex-wrap items-center gap-1.5">
                {pinned.length > 0 && (
                  <span className="max-w-[22rem] truncate text-[0.625rem] mono-font tabular-nums text-[var(--muted)]">{lang === 'zh' ? '// 定格对照: ' : '// pinned: '}{exprOf(pinned[pinned.length - 1].k, pinned[pinned.length - 1].b)} → {exprOf(k, b)}</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (isPinned) {
                      setPinned((prev) => prev.filter((p) => !(p.k === k && p.b === b)));
                    } else {
                      setPinned((prev) => [...prev, { id: prev.length + 1, k, b }]);
                    }
                  }}
                  aria-pressed={isPinned}
                  className={`compact inline-flex min-h-[32px] items-center gap-1 rounded px-2 py-1 text-[0.625rem] mono-font leading-5 transition-colors ${
                    isPinned
                      ? 'border border-[var(--fg)] bg-[var(--accent-light)] text-[var(--fg)]'
                      : 'border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)]'
                  }`}
                >
                  <Pin
                    className="h-3.5 w-3.5 shrink-0 transition-transform duration-150"
                    style={{ transform: isPinned ? 'rotate(-45deg)' : 'none' }}
                    fill={isPinned ? 'currentColor' : 'none'}
                    aria-hidden="true"
                  /> {isPinned ? t.unpinLabel : t.pinLabel}
                </button>
                {pinned.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPinned([])}
                    aria-label={t.clearPinned}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--accent-light)]"
                  >
                    ×
                  </button>
                )}
              </div>
              {pinned.length > 0 && (
                <div className="flex flex-wrap gap-1 border-t border-[var(--border)] pt-1.5">
                  {pinned.map((p) => (
                    <span key={p.id} className="inline-flex max-w-full items-center rounded border border-[var(--border)] bg-[var(--accent-light)]/50 px-1.5 py-0.5 text-[0.5625rem] mono-font text-[var(--muted)]">
                      <span className="truncate">{exprOf(p.k, p.b)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          </ParamDock>
          </div>

          {/* 幕1 预测 */}
          {stage === 'predict' && (
            <div className="border border-[var(--border)] p-4 space-y-4 lg:max-h-[calc(100%-2rem)] lg:w-full lg:max-w-lg lg:overflow-y-auto lg:rounded-xl lg:border lg:bg-[var(--card-bg)]/95 lg:p-6 lg:shadow-sm lg:backdrop-blur-md">
              <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                // {t.predictTitle}
              </h3>
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
                {t.predictQuestion} <Formula tex={`y = ${TARGET_K}x ${TARGET_B < 0 ? '-' : '+'} ${Math.abs(TARGET_B)}`} />
              </p>

              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.predictQ1}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['up', t.predictUp],
                      ['down', t.predictDown],
                      ['flat', t.predictFlat],
                    ] as [PredictSlope, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPredSlope(v)}
                      className={`text-center text-xs px-3 py-2 border rounded-lg transition-colors min-h-[44px] whitespace-normal break-words leading-snug ${
                        predSlope === v ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.predictQ2}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['pos', t.predictInterceptPos],
                      ['neg', t.predictInterceptNeg],
                      ['zero', t.predictInterceptZero],
                    ] as [PredictIntercept, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPredIntercept(v)}
                      className={`text-center text-xs px-3 py-2 border rounded-lg transition-colors min-h-[44px] whitespace-normal break-words leading-snug ${
                        predIntercept === v ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {predComplete ? (
                <button
                  type="button"
                  onClick={reveal}
                  className="compact text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors"
                >
                  {CHECK_ICON} {t.predictDone} — {t.revealLabel}
                </button>
              ) : (
                <p className="text-xs text-[var(--muted)] serif-font italic">{t.predictHint}</p>
              )}
            </div>
          )}

          {/* 幕2 探索：钉住操作已收编进参数卡底栏 */}
          {stage === 'explore' && (
            <ExploreStage
              cards={cards}
              observations={observations}
              onAddObservation={addObservation}
              onClearObservations={() => setObservations([])}
              notePlaceholder={t.notePlaceholder}
              recordLabel={t.recordLabel}
              clearLabel={t.clearLabel}
              emptyLabel={t.exploreEmpty}
              title={t.exploreTitle}
              compact
            />
          )}

          {/* 幕3 结论（四组选择） */}
          {stage === 'conclude' && (
            <div className="border border-[var(--border)] p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                  // {t.concludeTitle}
                </h3>
                <button type="button" onClick={() => setStage('explore')} className="hidden shrink-0 items-center rounded border border-[var(--border)] px-2 py-1 text-[0.5625rem] mono-font text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] lg:inline-flex">
                  « {lang === 'zh' ? '返回探索调参' : 'Back to Explore'}
                </button>
              </div>
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{t.concludeQuestion}</p>

              {!predComplete && (
                <p className="text-xs text-[var(--muted)] serif-font italic border-l-2 border-[var(--border)] pl-2">
                  {t.concludeSkipHint}
                </p>
              )}

              {/* Q1: k */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ1}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['none', t.concludeQ1None],
                      ['slope', t.concludeQ1Slope],
                      ['shift', t.concludeQ1Shift],] as ['slope' | 'shift' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q1 === v;
                    const correct = correctKeys.q1.includes(v);
                    const showFeedback = conclusion.q1 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q1: v }))}
                        className={`text-center text-xs px-2.5 py-2 border rounded-lg transition-colors min-h-[44px] whitespace-normal break-words leading-snug ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                              : 'border-[var(--error)] text-[var(--error)]'
                            : showFeedback && correct
                              ? 'border-[var(--muted)] text-[var(--muted)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {selected && (correct ? CHECK_ICON : X_ICON)}
                        {showFeedback && !selected && correct && CHECK_ICON}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q2: b */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ2}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['slope', t.concludeQ2Slope],
                      ['none', t.concludeQ2None],
                      ['intercept', t.concludeQ2Intercept],] as ['intercept' | 'slope' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q2 === v;
                    const correct = correctKeys.q2.includes(v);
                    const showFeedback = conclusion.q2 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q2: v }))}
                        className={`text-center text-xs px-2.5 py-2 border rounded-lg transition-colors min-h-[44px] whitespace-normal break-words leading-snug ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                              : 'border-[var(--error)] text-[var(--error)]'
                            : showFeedback && correct
                              ? 'border-[var(--muted)] text-[var(--muted)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {selected && (correct ? CHECK_ICON : X_ICON)}
                        {showFeedback && !selected && correct && CHECK_ICON}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q3: |k| */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ3}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['steep', t.concludeQ3Steep],
                      ['flat', t.concludeQ3Flat],
                      ['none', t.concludeQ3None],] as ['steep' | 'flat' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q3 === v;
                    const correct = correctKeys.q3.includes(v);
                    const showFeedback = conclusion.q3 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q3: v }))}
                        className={`text-center text-xs px-2.5 py-2 border rounded-lg transition-colors min-h-[44px] whitespace-normal break-words leading-snug ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                              : 'border-[var(--error)] text-[var(--error)]'
                            : showFeedback && correct
                              ? 'border-[var(--muted)] text-[var(--muted)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {selected && (correct ? CHECK_ICON : X_ICON)}
                        {showFeedback && !selected && correct && CHECK_ICON}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q4: k>0 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ4}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['none', t.concludeQ4None],
                      ['up', t.concludeQ4Up],
                      ['down', t.concludeQ4Down],] as ['up' | 'down' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q4 === v;
                    const correct = correctKeys.q4.includes(v);
                    const showFeedback = conclusion.q4 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q4: v }))}
                        className={`text-center text-xs px-2.5 py-2 border rounded-lg transition-colors min-h-[44px] whitespace-normal break-words leading-snug ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                              : 'border-[var(--error)] text-[var(--error)]'
                            : showFeedback && correct
                              ? 'border-[var(--muted)] text-[var(--muted)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {selected && (correct ? CHECK_ICON : X_ICON)}
                        {showFeedback && !selected && correct && CHECK_ICON}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {conclusionComplete ? (
                <p className="text-xs mono-font flex items-center gap-1 text-[var(--fg)]">{CHECK_ICON} {t.concludeHint}</p>
              ) : (
                <p className="text-xs text-[var(--muted)] serif-font italic">{t.concludeHint}</p>
              )}
            </div>
          )}

          {/* 完成态 */}
          {stage === 'conclude' && conclusionComplete && (
            <div className="border border-[var(--fg)] p-4 space-y-2">
              <p className="text-sm font-bold mono-font flex items-center gap-1 text-[var(--fg)]">{CHECK_ICON} {t.stageDone}</p>
              <p className="text-xs text-[var(--muted)] serif-font leading-relaxed">{t.feedbackText}</p>
              <button
                type="button"
                onClick={redoAll}
                className="group inline-flex items-center gap-1.5 text-xs mono-font uppercase text-[var(--fg)] hover:opacity-70"
              >
                <RotateCcw className="w-3.5 h-3.5 opacity-70 group-hover:rotate-[-45deg] transition-transform duration-[var(--dur-base)]" />
                <span>{t.redoLabel}</span>
              </button>
              <ConcludeNextActions labId="linear" />
            </div>
          )}

          {/* 考点速记（深化记忆，言简意赅） */}
          {stage === 'conclude' && conclusionComplete && (
            <div className="border border-[var(--border)] p-4 space-y-2">
              <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                // {t.tipsTitle}
              </h3>
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
        </div>
      </div>
    </div>
    </MathCanvasStage>
  );
}
