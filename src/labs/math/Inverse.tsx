/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学探究 · 反比例函数 y = k/x 三幕式探究（人教版 九上第 26 章）
 *
 * 幕 1 预测：给定 y = 4/x，先猜图像所在象限，再揭示图像
 * 幕 2 探索：控制变量卡（k 正负 / |k| 大小 / 特殊点）+ 钉住曲线对比 + 观察笔记
 * 幕 3 结论：学生总结 k 正负、|k| 的作用，对照预测与观察记录
 *
 * 复用组件：CoordPlane（坐标系，segments 绘制双曲线两支）、ExploreStage、LabIcon。
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import { ChevronRight, Minus, Pin, Plus, RotateCcw } from 'lucide-react';
import { setLabState, setPageQuestion } from '../../lib/ai-dynamic-questions';
import { Check, X } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import ParamSlider from '../../components/lab/ParamSlider';
import ToggleSwitch from '../../components/lab/ToggleSwitch';
import CoordPlane, { type CoordCurve, type CoordMarker, type CoordOverlay, mathMinus } from '../../components/lab/CoordPlane';
import { boolParam, enumParam, numParam, readUrlParams, useLabUrlSync } from '../../lib/lab-url-state';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import ConcludeNextActions from '../../components/lab/ConcludeNextActions';
import Formula from '../../components/ui/Formula';
import StageNav from '../../components/lab/StageNav';
import ParamDock from '../../components/lab/ParamDock';
import MathCanvasStage from '../../components/lab/MathCanvasStage';
import { HyperbolaIcon } from '../../components/ui/LabIcon';
import EngineBadge from '../../components/lab/EngineBadge';
import { getEngineTooltip } from '../../components/lab/engine-copy';
import { loadOhmEngine, sampleInverse } from '../physics/stem-engine';
import { inverseY, inverseRectArea, inverseTriangleArea } from './inverse-core';

type Stage = 'predict' | 'explore' | 'conclude';

/** 预测题：k>0 时图像在哪些象限 */
type PredictQuadrant = 'i-iii' | 'ii-iv' | 'all' | 'none' | null;
type PredictQuadrantNeg = 'i-iii-neg' | 'ii-iv-neg' | 'all-neg' | 'none-neg' | null;

/** 把实验内使用的 Unicode 表达式转成 KaTeX LaTeX（仅用于展示层）。 */
function texExpr(expr: string): string {
  return expr.replace(/²/g, '^2').replace(/−/g, '-');
}

const copy = {
  zh: {
    params: '参数',
    paramDock: '调节参数',
    paramDockClose: '收起参数',
    probe: '探针 |x₀|',
    shape: '图形',
    shapeRect: '矩形',
    shapeTriangle: '三角形',
    area: '面积',
    readout: '当前函数',
    guides: '辅助线',
    guidesOffHint: '辅助线已关闭：画布上的虚线与标注暂不显示，先自己看图判断。',
    reset: '重置',
    // 幕导航
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
    predictQ1: 'k > 0 时，图像在哪两个象限？',
    predictQ1Iiii: '第一、第三象限',
    predictQ1Iiiv: '第二、第四象限',
    predictQ1All: '四个象限都有',
    predictQ1None: '不经过任何象限',
    predictQ2: 'k < 0 时，图像在哪两个象限？',
    predictQ2Iiii: '第一、第三象限',
    predictQ2Iiiv: '第二、第四象限',
    predictQ2All: '四个象限都有',
    predictQ2None: '不经过任何象限',
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
    pinnedEmpty: '（未钉住。钉住后可与当前曲线对比）',
    cards: [
      {
        title: 'k 的正负（象限）',
        prompt: '固定 k=1 再看 k=-1：图像所在象限变了吗？两支曲线分别在哪？',
      },
      {
        title: '|k| 的大小（远近）',
        prompt: 'k 从 1 变到 4：曲线离原点更近还是更远？形状变了吗？',
      },
      {
        title: '特殊点',
        prompt: 'k=4 时，x=1 对应 y=？x=2 呢？这些点都在曲线上吗？',
      },
      {
        title: '自由探索',
        prompt: '任意调 k（包括小数、负数），钉住几条曲线对比，找找规律。',
      },
    ],
    // 幕3 结论
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，k 的作用是什么？',
    concludeSkipHint: '还没在预测幕猜过象限分布——建议先回预测幕完成预测，再做结论会更有意义。',
    tipsTitle: '考点速记',
    tips: [
      '反比例函数 y=k/x（k≠0）：k>0 图像在一、三象限，k<0 在二、四象限。',
      '|k| 决定曲线离原点的远近，但形状不变（相似形）。',
      '两支曲线无限接近坐标轴但永不相交（渐近线）。',
      '图像上任意一点向两轴作垂线，与坐标轴围成的矩形面积为 |k|。',
      '反比例与一次函数结合求交点：联立方程求解。',
      '实际应用：压强与受力面积（p=F/S）、电阻与电流（U 固定时 I=U/R）。',
      '功 W 一定时，功率 P=W/t 与时间 t 成反比。',
      '代数推导（象限判定）：y=k/x，k>0 时 x 与 y 同号（同正或同负），故点在一、三象限；k<0 时 x 与 y 异号，在二、四象限。图像上任一点 (x,k/x) 向两轴作垂线，矩形面积 = |x·k/x| = |k|（定值），这是矩形面积为 |k| 的代数依据。',
    ],
    concludeQ1: 'k 的正负决定：',
    concludeQ1Quad: '图像所在象限',
    concludeQ1Shape: '曲线形状',
    concludeQ1None: '没有作用',
    concludeQ2: '|k| 越大：',
    concludeQ2Near: '曲线离原点越近',
    concludeQ2Far: '曲线离原点越远',
    concludeQ2None: '无影响',
    concludeQ3: '|k| 变化时曲线形状：',
    concludeQ3Same: '不变（相似形）',
    concludeQ3Diff: '改变',
    concludeQ3None: '无影响',
    concludeQ4: '图像与坐标轴：',
    concludeQ4NoCross: '永不相交（无限接近）',
    concludeQ4Cross: '会相交',
    concludeQ4None: '无影响',
    concludeHint: '选完四个，看看结论和你的观察是否一致',
    feedbackTitle: '反馈',
    feedbackText:
      'k 的正负决定双曲线所在的象限（k>0 在一、三象限，k<0 在二、四象限）；|k| 决定曲线离原点的远近，但形状不变；两支曲线都无限接近坐标轴但永不相交。',
  },
  en: {
    params: 'Parameters',
    paramDock: 'Adjust parameters',
    paramDockClose: 'Close',
    probe: 'Probe |x₀|',
    shape: 'Shape',
    shapeRect: 'Rectangle',
    shapeTriangle: 'Triangle',
    area: 'Area',
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
    predictQ1: 'When k > 0, which quadrants does the graph occupy?',
    predictQ1Iiii: 'Quadrants I and III',
    predictQ1Iiiv: 'Quadrants II and IV',
    predictQ1All: 'All four quadrants',
    predictQ1None: 'None',
    predictQ2: 'When k < 0, which quadrants does the graph occupy?',
    predictQ2Iiii: 'Quadrants I and III',
    predictQ2Iiiv: 'Quadrants II and IV',
    predictQ2All: 'All four quadrants',
    predictQ2None: 'None',
    predictDone: 'Your prediction is recorded',
    predictHint: 'Answer both to reveal the graph',
    revealLabel: 'Reveal graph →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Drag the slider or try a card, and note what you see.',
    notePlaceholder: 'Write one sentence: what did you observe?',
    recordLabel: 'Note it',
    clearLabel: 'Clear notes',
    tryLabel: 'Try it',
    pinLabel: 'Pin this curve',
    unpinLabel: 'Unpin',
    pinnedTitle: 'Pinned curves',
    pinnedCount: (n: number) => `${n} pinned`,
    clearPinned: 'Clear pinned',
    pinnedEmpty: '(nothing pinned — pin curves to compare with the current one)',
    cards: [
      {
        title: 'k: the quadrants',
        prompt: 'Look at k=1, then k=-1: do the quadrants change? Where are the two branches?',
      },
      {
        title: '|k|: the distance',
        prompt: 'Change k from 1 to 4: does the curve get closer to or farther from the origin? Does its shape change?',
      },
      {
        title: 'Special points',
        prompt: 'With k=4, what is y when x=1? When x=2? Are these points on the curve?',
      },
      {
        title: 'Free exploration',
        prompt: 'Try any k (decimals, negatives), pin a few curves and look for the pattern.',
      },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what does k do?',
    concludeSkipHint: "You haven't predicted the quadrants yet — go back to the Predict stage first.",
    tipsTitle: 'Key Points',
    tips: [
      'Inverse variation y=k/x (k≠0): k>0 in quadrants I & III, k<0 in II & IV.',
      '|k| decides the distance from the origin; the shape stays the same (similar).',
      'The two branches approach the axes infinitely but never cross them (asymptotes).',
      'The rectangle formed by any point and the axes has area |k|.',
      'To find intersections with a linear function, solve the equations together.',
      'For fixed work W, power P=W/t is inversely proportional to time t.',
      'Algebraic derivation (quadrant rule): y=k/x. If k>0 then x and y have the same sign, so points lie in quadrants I & III; if k<0 they differ, so II & IV. For any point (x, k/x), the rectangle with the axes has area = |x·k/x| = |k| (constant) — the algebraic basis for the |k| rectangle.',
    ],
    concludeQ1: 'The sign of k decides:',
    concludeQ1Quad: 'which quadrants the graph occupies',
    concludeQ1Shape: 'the shape of the curve',
    concludeQ1None: 'nothing',
    concludeQ2: 'Larger |k|:',
    concludeQ2Near: 'curve closer to the origin',
    concludeQ2Far: 'curve farther from the origin',
    concludeQ2None: 'no effect',
    concludeQ3: 'When |k| changes, the shape:',
    concludeQ3Same: 'stays the same (similar)',
    concludeQ3Diff: 'changes',
    concludeQ3None: 'no effect',
    concludeQ4: 'The graph and the axes:',
    concludeQ4NoCross: 'never intersect (approaches infinitely)',
    concludeQ4Cross: 'do intersect',
    concludeQ4None: 'no effect',
    concludeHint: 'Answer all four, then see if your conclusion matches your observations',
    feedbackTitle: 'Feedback',
    feedbackText:
      'The sign of k decides which quadrants the hyperbola occupies (k>0: I & III, k<0: II & IV); |k| decides how far the curve sits from the origin, but the shape stays the same; both branches approach the axes infinitely but never cross them.',
  },
};

/** 预测目标函数：y = 4/x */
const TARGET_K = 4;

const CHECK_ICON = <Check className="inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em]" aria-hidden="true" />;
const X_ICON = <X className="inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em]" aria-hidden="true" />;


/**
 * 题库注册表：选项顺序与判分答案的单一事实源。
 * 渲染侧按同一顺序排布；smoke 守卫解析源码断言二者一致（防「改了渲染忘了改注册表」）。
 */
export const OPTIONS = {
  q1: [['quad', 'concludeQ1Quad'], ['shape', 'concludeQ1Shape'], ['none', 'concludeQ1None']],
  q2: [['near', 'concludeQ2Near'], ['far', 'concludeQ2Far'], ['none', 'concludeQ2None']],
  q3: [['diff', 'concludeQ3Diff'], ['none', 'concludeQ3None'], ['same', 'concludeQ3Same']],
  q4: [['nocross', 'concludeQ4NoCross'], ['cross', 'concludeQ4Cross'], ['none', 'concludeQ4None']],
} as const;

/** 每题正确选项值（多解用数组）。 */
export const QUIZ_CORRECT: Record<string, string[]> = {
  q1: ['quad'],
  q2: ['far'],
  q3: ['same'],
  q4: ['nocross'],
};

export default function Inverse() {
  const { lang } = useApp();
  const t = copy[lang];
  const initialUrl = readUrlParams();
  const initialX0 = numParam(initialUrl.get('x0') ?? initialUrl.get('probeAbs'), 1, -4, 4);

  const [stage, setStage] = useState<Stage>(() => enumParam(initialUrl.get('stage'), ['predict', 'explore', 'conclude'] as const, 'predict'));
  const [predQuadrant, setPredQuadrant] = useState<PredictQuadrant>(null);
  const [predQuadrantNeg, setPredQuadrantNeg] = useState<PredictQuadrantNeg>(null);
  const [revealed, setRevealed] = useState(false);
  const [k, setK] = useState(() => numParam(initialUrl.get('k'), TARGET_K, -6, 6, { disallowZero: true }));
  const [pinned, setPinned] = useState<{ id: number; k: number }[]>([]);
  // 辅助线开关：控制画布上的虚线/标注层（反比例=渐近线，一次函数=与 y 轴交点）
  const [showGuides, setShowGuides] = useState(() => boolParam(initialUrl.get('guides'), true));
  const [probeAbs, setProbeAbs] = useState(() => Math.max(0.2, Math.abs(initialX0)));
  const [probeSide, setProbeSide] = useState<1 | -1>(() => (initialX0 < 0 ? -1 : 1));
  const [isDesktop, setIsDesktop] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [viewCommand, setViewCommand] = useState({ factor: 1, reset: false, nonce: 0 });
  const zoomViewport = (factor: number) => setViewCommand((v) => ({ factor, reset: false, nonce: v.nonce + 1 }));
  const resetViewport = () => setViewCommand((v) => ({ factor: 1, reset: true, nonce: v.nonce + 1 }));
  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 1024px)');
    const sync = () => setIsDesktop(!!mq?.matches);
    sync();
    mq?.addEventListener?.('change', sync);
    return () => mq?.removeEventListener?.('change', sync);
  }, []);
  const [shape, setShape] = useState<'rect' | 'triangle'>(() => enumParam(initialUrl.get('geom'), ['rect', 'tri'] as const, 'rect') === 'tri' ? 'triangle' : 'rect');
  const planeRef = useRef<HTMLDivElement>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  useLabUrlSync({ stage, k, x0: probeSide * probeAbs, geom: shape === 'rect' ? 'rect' : 'tri', guides: showGuides }, { stage: 'predict', k: TARGET_K, x0: 1, geom: 'rect', guides: true }, [stage, k, probeSide, probeAbs, shape, showGuides]);
  const [conclusion, setConclusion] = useState<{
    q1: 'quad' | 'shape' | 'none' | null;
    q2: 'near' | 'far' | 'none' | null;
    q3: 'same' | 'diff' | 'none' | null;
    q4: 'nocross' | 'cross' | 'none' | null;
  }>({ q1: null, q2: null, q3: null, q4: null });

  // 计算引擎（C++ WebAssembly / JS 回退）：默认 JS；mount 后异步尝试加载 WASM，失败静默回退
  const [engineKind, setEngineKind] = useState<'js' | 'wasm'>('js');
  useEffect(() => {
    let alive = true;
    loadOhmEngine().then((kind) => {
      if (alive) setEngineKind(kind);
    });
    return () => {
      alive = false;
    };
  }, []);

  /** 判分表：引用导出的注册表（单一事实源） */
  const correctKeys = QUIZ_CORRECT;
  const conclusionComplete =
    conclusion.q1 !== null && conclusion.q2 !== null && conclusion.q3 !== null && conclusion.q4 !== null;
  const predComplete = predQuadrant !== null && predQuadrantNeg !== null;

  const sampleMin = isDesktop ? -14 : -4;
  const sampleMax = isDesktop ? 14 : 4;
  const currentCurve: CoordCurve = useMemo(
    () => ({
      id: 'main',
      segments: sampleInverse(k, sampleMin, sampleMax),
      label: `y = ${k}/x`,
    }),
    // engineKind 进依赖：sampleInverse 按门面当前实现采样，WASM 加载完成后须重算
    [k, engineKind, sampleMin, sampleMax],
  );

  const pinnedCurves: CoordCurve[] = pinned.map((p) => ({
    id: `pin${p.id}`,
    segments: sampleInverse(p.k, sampleMin, sampleMax),
    dashed: true,
    label: `y = ${p.k}/x`,
  }));

  const curves = [currentCurve, ...pinnedCurves];

  // 探针：k<0 时落在左支；|x₀| 夹在采样缺口之外，避免点落在断点外
  const x0 = probeSide * probeAbs;
  const y0 = inverseY(k, x0);
  const area = shape === 'rect' ? inverseRectArea(k, x0) : inverseTriangleArea(k, x0);
  const fmt2 = (v: number) => mathMinus(Math.round(v * 100) / 100);

  const probeOverlays = useMemo<CoordOverlay[]>(() => {
    if (k === 0 || !Number.isFinite(y0)) return [];
    const out: CoordOverlay[] = [];
    if (shape === 'rect') {
      out.push({
        kind: 'rect', x: 0, y: 0, w: x0, h: y0,
        fill: 'var(--accent)', fillOpacity: 0.12,
        color: 'var(--accent)', dash: '4 3', width: 1.2,
      });
    } else {
      out.push({
        kind: 'polyline', points: [[0, 0], [x0, 0], [x0, y0]], close: true,
        fill: 'var(--accent)', fillOpacity: 0.12,
        color: 'var(--accent)', dash: '4 3', width: 1.2,
      });
      out.push({ kind: 'rightAngle', x: x0, y: 0, ux: -1, uy: 0, vx: 0, vy: Math.sign(y0) || 1, size: 7, color: 'var(--muted)' });
    }
    out.push(
      { kind: 'segment', x1: x0, y1: 0, x2: x0, y2: y0, dash: '3 3', color: 'var(--accent)' },
      { kind: 'segment', x1: 0, y1: y0, x2: x0, y2: y0, dash: '3 3', color: 'var(--accent)' },
      { kind: 'label', x: x0 * 1.45, y: y0 / 2, text: `S=${shape === 'rect' ? '|k|' : '|k|/2'}=${fmt2(area)}`, size: 10, color: 'var(--accent)' },
    );
    return out;
  }, [k, x0, y0, shape, area]);

  // 反比例的「渐近线」就是坐标轴本身（x=0 / y=0）：再叠一条虚线会在轴线上画出断续，
  // 看上去像轴被打断。故 noLine，只在轴端给出规范标注（x 端给 x=0，y 端给 y=0）。
  const markers = useMemo<CoordMarker[]>(() => {
    const marks: CoordMarker[] = [
      {
        key: 'asx',
        vline: { x: 0, label: lang === 'zh' ? '渐近线 x=0' : 'asymptote x=0', color: 'var(--muted)', noLine: true },
      },
      {
        key: 'asy',
        hline: { y: 0, label: lang === 'zh' ? '渐近线 y=0' : 'asymptote y=0', color: 'var(--muted)', noLine: true, labelPlace: 'left' },
      },
    ];
    if (k !== 0 && Number.isFinite(y0)) {
      marks.push({
        key: 'probe',
        dot: {
          x: x0, y: y0,
          label: `P(${fmt2(x0)}, ${fmt2(y0)})`,
          color: 'var(--accent)',
          place: k > 0 ? 'above' : 'below',
          side: x0 > 0 ? 'right' : 'left',
        },
      });
    }
    return marks;
  }, [lang, k, x0, y0]);

  const reset = () => setK(TARGET_K);

  const redoAll = () => {
    setStage('predict');
    setPredQuadrant(null);
    setRevealed(false);
    setK(TARGET_K);
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
          { label: 'f(x)', value: `${k}/x` },
        ],
        note,
      },
    ]);
  };

  const cards: ExploreCard[] = [
    {
      key: 'card-sign',
      title: t.cards[0].title,
      prompt: t.cards[0].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => setK(-1),
    },
    {
      key: 'card-size',
      title: t.cards[1].title,
      prompt: t.cards[1].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => setK(4),
    },
    {
      key: 'card-points',
      title: t.cards[2].title,
      prompt: t.cards[2].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => setK(4),
    },
    {
      key: 'card-free',
      title: t.cards[3].title,
      prompt: t.cards[3].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => setK(1.5),
    },
  ];

  const isPinned = pinned.some((p) => p.k === k);

  const stageOrder: Stage[] = ['predict', 'explore', 'conclude'];
  const stageIdx = stageOrder.indexOf(stage);

  // AI：实时状态登记（当前阶段 + 核心受控变量），供系统提示词与「问 AI」动态问句读取
  useEffect(() => {
    setLabState('inverse', { stage, k, probeX: x0, probeY: y0, probeArea: area });
  }, [stage, k, x0, y0, area]);
  // 页面级「问 AI」问句：登记到页级注册表，点击标题旁入口时取用（动态实验含当前读数）
  useEffect(() => {
    setPageQuestion('inverse', lang === 'zh' ? '改变 k 值或移动探针时，双曲线上的坐标与面积读数有什么规律？' : 'As you change k or move the probe, what pattern appears in the coordinates and area readings on the hyperbola?');
  }, [lang]);

  return (
    <MathCanvasStage
      variant={isDesktop ? 'sheet' : 'default'}
      title={lang === 'zh' ? '反比例函数' : 'Inverse Variation'}
      grade={lang === 'zh' ? '7-9 年级' : 'Grades 7-9'}
      backHref="/subject/math"
      backLabel={lang === 'zh' ? '返回数学' : 'Back to Math'}
      labId="inverse"
      aiQuestion={lang === 'zh' ? '请讲解反比例函数 y=k/x 中 k 值的意义' : 'Explain the meaning of k in y=k/x'}
      icon={<HyperbolaIcon className="h-4 w-4" aria-hidden="true" />}
      shareTitle={lang === 'zh' ? '反比例函数 · 数理化数字实验室' : 'Inverse Variation · STEM Digital Lab'}
      center={
        <StageNav
          stage={stage}
          setStage={setStage}
          stageOrder={stageOrder}
          labels={{ predict: t.stagePredict, explore: t.stageExplore, conclude: t.stageConclude, next: t.nextStage, redo: t.redoLabel }}
          onRedo={redoAll}
          isDone={{ predict: predComplete, explore: observations.length > 0, conclude: conclusionComplete }}
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
          predict: predComplete,
          explore: observations.length > 0,
          conclude: conclusionComplete,
        }}
      />
      </div>

      <div className="grid items-start gap-5 lg:contents lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* 左列：坐标系（预测幕未揭示时隐藏）+ 读数 */}
        <div className={`flex flex-col space-y-4 lg:absolute lg:inset-y-0 lg:left-0 lg:z-0 lg:block lg:space-y-0 ${stage === 'conclude' ? 'lg:right-[460px] xl:right-[500px]' : inspectorOpen && stage === 'explore' ? 'lg:right-[330px]' : 'lg:right-0'} ${stage === 'predict' && !revealed ? 'hidden lg:block' : ''}`}>
          <div ref={planeRef} className="flex flex-col space-y-6 lg:block lg:h-full lg:space-y-0">
            <div className="relative overflow-hidden border border-[var(--border)] bg-[var(--card-bg)] max-sm:min-h-[440px] max-sm:max-h-[65dvh] lg:h-full lg:border-0 lg:bg-transparent">
              <div data-canvas-toolbar="true" className={`hidden items-center justify-between border-b border-[var(--border)] bg-[var(--card-bg)] px-3 lg:flex lg:h-10 ${stage === 'predict' && !revealed ? 'lg:hidden' : ''}`}>
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 text-[0.5625rem] font-bold uppercase tracking-widest text-[var(--muted)] mono-font">// {t.readout}</span>
                  <span className="truncate text-sm text-[var(--fg)]"><Formula tex={`y = \\frac{${k}}{x}`} /></span>
                  <span className="truncate text-[0.5625rem] mono-font text-[var(--muted)]">{t.area}: {shape === 'rect' ? '|k|' : '|k|/2'} = {mathMinus(area)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <div className="grid grid-cols-2 gap-1">
                    {(['rect','triangle'] as const).map((v) => <button key={v} type="button" aria-pressed={shape === v} onClick={() => setShape(v)} className={`compact h-7 rounded border px-1.5 text-[0.5625rem] mono-font ${shape === v ? 'border-[var(--fg)] bg-[var(--accent-light)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{v === 'rect' ? t.shapeRect : t.shapeTriangle}</button>)}
                  </div>
                  <button type="button" onClick={() => zoomViewport(1.25)} aria-label={lang === 'zh' ? '缩小视口' : 'Zoom out'} className="compact flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]"><Minus className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => zoomViewport(0.8)} aria-label={lang === 'zh' ? '放大视口' : 'Zoom in'} className="compact flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]"><Plus className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={resetViewport} aria-label={lang === 'zh' ? '重置视口' : 'Reset view'} className="compact flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]"><RotateCcw className="h-3.5 w-3.5" /></button>
                  <ToggleSwitch label={t.guides} checked={showGuides} onChange={setShowGuides} compact />
                  {!inspectorOpen && <button type="button" onClick={() => setInspectorOpen(true)} aria-label={lang === 'zh' ? '参数' : 'Parameters'} className="ml-1 inline-flex h-7 items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--card-bg)] px-2 text-xs font-medium leading-none mono-font text-[var(--fg)] hover:border-[var(--fg)]/40">« {lang === 'zh' ? '参数' : 'Parameters'}</button>}
                </div>
              </div>
              {stage === 'predict' && !revealed && (
                <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 p-4 sm:p-6 lg:hidden">
                  <p className="text-[0.6875rem] mono-font uppercase tracking-widest text-[var(--muted)]">
                    {t.predictTitle}
                  </p>
                  <p className="text-sm serif-font text-[var(--fg)]">
                    {t.predictQuestion} <Formula tex={`y = \\frac{${TARGET_K}}{x}`} />
                  </p>
                  <p className="text-xs text-[var(--muted)] serif-font italic">{t.predictQuestion2}</p>
                </div>
              )}
              <div className={`${stage === 'predict' && !revealed ? 'hidden lg:block' : 'block'} lg:absolute lg:inset-x-0 lg:top-10 lg:bottom-0 lg:h-auto`}>
                <CoordPlane
                  curves={stage === 'predict' && !revealed ? [] : curves}
                  markers={stage === 'predict' && !revealed ? [] : (showGuides ? markers : [])}
                  overlays={stage === 'predict' && !revealed ? [] : (showGuides ? probeOverlays : [])}
                  xMin={-4}
                  xMax={4}
                  yMin={-10}
                  yMax={10}
                  ariaLabel={`y = k/x graph`}
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
                  draggablePoint={stage !== 'predict' ? { x: x0, y: y0, onDrag: (x) => { const a = Math.max(0.2, Math.min(4, Math.abs(x))); setProbeAbs(a); setProbeSide(x < 0 ? -1 : 1); } } : undefined}
                  showLegend={!isDesktop}
                  maxHeightClass={isDesktop ? 'lg:h-full lg:max-h-none min-h-[280px]' : 'max-sm:min-h-[440px] max-sm:max-h-[65dvh] max-h-[min(48vh,440px)]'}
                />
              </div>

              {stage !== 'predict' && Math.abs(x0) <= 0.3 && (
                <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-10 border border-[var(--border)] bg-[var(--card-bg)]/90 px-2 py-1 text-[0.625rem] mono-font leading-relaxed text-[var(--muted)]">
                  // {lang === 'zh' ? '渐近特征：x → 0 时曲线无限逼近 y 轴但永不相交' : 'Asymptote: as x → 0 the curve approaches the y-axis but never meets it'}
                </div>
              )}

              <div data-lab-toolbar="true" className={`mt-2 flex flex-col gap-1.5 border-t border-[var(--border)] px-3 pb-2.5 pt-2 max-sm:h-9 max-sm:min-h-0 max-sm:flex-row max-sm:items-center max-sm:gap-1 max-sm:px-2 max-sm:py-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2 lg:hidden ${stage === 'predict' && !revealed ? 'hidden' : ''}`}>
                <div className="min-w-0 w-full flex-1">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="shrink-0 text-[0.5625rem] font-bold uppercase tracking-widest text-[var(--muted)] mono-font">
                      // {t.readout}
                    </span>
                    <span className="min-w-0 truncate text-sm text-[var(--fg)]"><Formula tex={`y = \\frac{${k}}{x}`} /></span>
                  </div>
                  <p className="mt-0.5 truncate text-[0.625rem] mono-font leading-snug text-[var(--muted)]">
                    {t.area}: {shape === 'rect' ? '|k|' : '|k|/2'} = {mathMinus(area)}
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center justify-between gap-1.5 sm:w-auto sm:justify-start">
                  <div className="grid grid-cols-2 gap-1" role="group" aria-label={t.shape}>
                    {(['rect', 'triangle'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={shape === v}
                        onClick={() => setShape(v)}
                        className={`compact h-7 rounded border px-2 py-0 text-[0.625rem] mono-font transition-colors ${
                          shape === v
                            ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                            : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {v === 'rect' ? t.shapeRect : t.shapeTriangle}
                      </button>
                    ))}
                  </div>
                  <ToggleSwitch label={t.guides} checked={showGuides} onChange={setShowGuides} compact />
                  {!inspectorOpen && stage !== 'predict' && (
                    <button type="button" onClick={() => setInspectorOpen(true)} aria-label={lang === 'zh' ? '参数' : 'Parameters'} className="ml-1 inline-flex h-7 items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--card-bg)] px-2 text-xs font-medium leading-none mono-font text-[var(--fg)] hover:border-[var(--fg)]/40">
                      « {lang === 'zh' ? '参数' : 'Parameters'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* 右列：参数 + 三幕 */}
        <div className={`flex flex-col space-y-4 ${stage === 'predict' ? 'lg:absolute lg:inset-0 lg:z-30 lg:flex lg:items-center lg:justify-center lg:bg-transparent lg:p-0' : stage === 'conclude' ? 'lg:absolute lg:inset-y-0 lg:right-0 lg:z-20 lg:w-[460px] xl:w-[500px] lg:overflow-y-auto lg:border-l lg:border-[var(--border)] lg:bg-[var(--card-bg)] lg:p-3.5 lg:space-y-3' : inspectorOpen ? 'lg:absolute lg:inset-y-0 lg:right-0 lg:z-20 lg:w-[330px] lg:overflow-y-auto lg:border-l lg:border-[var(--border)] lg:bg-[var(--card-bg)] lg:p-3.5 lg:space-y-3' : 'lg:hidden'} `}>
          <div className={`${stage === 'predict' || stage === 'conclude' ? 'hidden' : 'hidden lg:flex'} shrink-0 items-center justify-between border-b border-[var(--border)] pb-2`}>
            <span className="text-[0.625rem] font-bold uppercase tracking-widest text-[var(--muted)] mono-font">// {lang === 'zh' ? '参数' : 'PARAMETERS'}</span>
            <button type="button" onClick={() => setInspectorOpen(false)} aria-label={lang === 'zh' ? '收起参数' : 'Collapse parameters'} className="inline-flex h-7 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded border border-[var(--border)] bg-[var(--card-bg)] px-2 text-xs font-medium leading-none text-[var(--fg)] hover:border-[var(--fg)]/40">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
              <span>{lang === 'zh' ? '收起' : 'Collapse'}</span>
            </button>
          </div>
          <div className={stage === 'predict' ? 'hidden' : stage === 'conclude' ? 'lg:hidden' : ''}>
          <ParamDock disabled={stage === 'predict'}
            title={t.paramDock}
            closeLabel={t.paramDockClose}
            anchorRef={planeRef}
            summary={`y = ${k}/x · |k| = ${Math.abs(k)}`}
          >
          <div className="border border-[var(--border)] p-4 space-y-4 lg:border-0 lg:p-0 lg:space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase lg:hidden">
                // {t.params}
              </h3>
              <EngineBadge kind={engineKind} title={getEngineTooltip(engineKind, 'formulas', lang)} />
            </div>
            <ParamSlider
              label="k"
              value={k}
              min={-6}
              max={6}
              step={0.1}
              onChange={(v) => setK(v === 0 ? (k > 0 ? 0.1 : -0.1) : v)}
              format={(v) => mathMinus(v.toFixed(1))}
            />
            <ParamSlider
              label={t.probe}
              value={probeAbs}
              min={0.2}
              max={4}
              step={0.1}
              onChange={setProbeAbs}
              format={(v) => mathMinus(v.toFixed(1))}
            />
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
                  <span className="text-[0.625rem] mono-font text-[var(--muted)]">{t.pinnedCount(pinned.length)}</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (isPinned) {
                      setPinned((prev) => prev.filter((p) => p.k !== k));
                    } else {
                      setPinned((prev) => [...prev, { id: prev.length + 1, k }]);
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
                      <span className="truncate">{`y = ${p.k}/x`}</span>
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
                {t.predictQuestion} <Formula tex={`y = \\frac{${TARGET_K}}{x}`} />
              </p>

              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.predictQ1}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      ['i-iii', t.predictQ1Iiii],
                      ['ii-iv', t.predictQ1Iiiv],
                      ['all', t.predictQ1All],
                      ['none', t.predictQ1None],
                    ] as [PredictQuadrant, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPredQuadrant(v)}
                      className={`text-center text-xs px-3 py-2 border rounded-lg transition-colors min-h-[44px] whitespace-normal break-words leading-snug ${
                        predQuadrant === v ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.predictQ2}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      ['ii-iv-neg', t.predictQ2Iiiv],
                      ['i-iii-neg', t.predictQ2Iiii],
                      ['all-neg', t.predictQ2All],
                      ['none-neg', t.predictQ2None],
                    ] as [PredictQuadrantNeg, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPredQuadrantNeg(v)}
                      className={`text-center text-xs px-3 py-2 border rounded-lg transition-colors min-h-[44px] whitespace-normal break-words leading-snug ${
                        predQuadrantNeg === v ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
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
                <button type="button" onClick={() => setStage('explore')} className="hidden h-7 shrink-0 items-center rounded border border-[var(--border)] bg-[var(--card-bg)] px-2 text-xs font-medium leading-none mono-font text-[var(--fg)] hover:border-[var(--fg)]/40 lg:inline-flex">
                  « {lang === 'zh' ? '返回探索调参' : 'Back to Explore'}
                </button>
              </div>
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{t.concludeQuestion}</p>

              {/* 软引导：预测未完成时提示（不硬锁，仍可作答） */}
              {!predComplete && (
                <p className="text-xs text-[var(--muted)] serif-font italic border-l-2 border-[var(--border)] pl-2">
                  {t.concludeSkipHint}
                </p>
              )}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ1}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['quad', t.concludeQ1Quad],
                      ['shape', t.concludeQ1Shape],
                      ['none', t.concludeQ1None],] as ['quad' | 'shape' | 'none', string][]
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

              {/* Q2: |k| */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ2}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['near', t.concludeQ2Near],
                      ['far', t.concludeQ2Far],
                      ['none', t.concludeQ2None],] as ['near' | 'far' | 'none', string][]
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

              {/* Q3: 形状 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ3}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['diff', t.concludeQ3Diff],
                      ['none', t.concludeQ3None],
                      ['same', t.concludeQ3Same],] as ['same' | 'diff' | 'none', string][]
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

              {/* Q4: 与坐标轴 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ4}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['nocross', t.concludeQ4NoCross],
                      ['cross', t.concludeQ4Cross],
                      ['none', t.concludeQ4None],] as ['nocross' | 'cross' | 'none', string][]
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
              <ConcludeNextActions labId="inverse" />
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
