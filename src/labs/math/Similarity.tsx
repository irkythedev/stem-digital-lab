/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学探究 · 相似与位似（人教版 九下第 27 章）
 *
 * 幕 1 预测：k 翻倍时面积变几倍？k = −1 的像在哪？位似图形一定相似吗？
 * 幕 2 探索：拖动位似中心 O、拖动三角形顶点、拉 k 滑块（含负值），
 *        实时看对应点连线是否都过 O、边长比 / 周长比 / 面积比怎样跟着变。
 * 幕 3 结论：四道比值与位置判断题，对照自己的观察记录。
 *
 * 复用：ParamSlider、ExploreStage、StageNav；拖拽沿用 InteractiveCircle 的
 * createSVGPoint + getScreenCTM 反投影 + setPointerCapture 范式。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Check, RotateCcw, X } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { setLabState, setPageQuestion } from '../../lib/ai-dynamic-questions';
import { mathMinus } from '../../components/lab/CoordPlane';
import { useApp } from '../../lib/app-context';
import { boolParam, enumParam, numParam, readUrlParams, useLabUrlSync } from '../../lib/lab-url-state';
import { useIsDesktopLab } from '../../components/lab/useIsDesktopLab';
import ParamDock from '../../components/lab/ParamDock';
import ParamSlider from '../../components/lab/ParamSlider';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import StageNav from '../../components/lab/StageNav';
import CanvasSurface, { CanvasZoomControls } from '../../components/lab/CanvasSurface';
import ToggleSwitch from '../../components/lab/ToggleSwitch';
import LabStageShell from '../../components/lab/LabStageShell';
import DemoHud, { DEMO_HUD_COPY } from '../../components/lab/demo-hud';
import { easeInOutQuad, useAutoTimeline } from '../../components/lab/use-auto-timeline';
import {
  type Pt,
  type Tri,
  area,
  areaRatio,
  areCollinear,
  clampPt,
  dist,
  homothetic,
  perimeter,
  perimeterRatio,
} from './similarity-core';
import { SIMILARITY_DEMO } from './similarity-demo';

type Stage = 'predict' | 'explore' | 'conclude';
type PredictAnswer = 'a' | 'b' | 'c' | null;
type Handle = 'O' | 'A' | 'B' | 'C';
type QuizKey = 'q1' | 'q2' | 'q3' | 'q4';

const CHECK_ICON = <Check className="inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em]" aria-hidden="true" />;
const X_ICON = <X className="inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em]" aria-hidden="true" />;

/* ────────────────────────── 画布映射 ────────────────────────── */

const VIEW_W = 580;
const VIEW_H = 360;
/** 1 数学单位 = 多少 SVG 像素 */
const S = 88;
/** 数学原点在画布上的位置 */
const CX = 290;
const CY = 180;
const X_MIN = -3.2;
const X_MAX = 3.2;
const Y_MIN = -1.95;
const Y_MAX = 1.95;
/** 透明命中圈半径（触屏友好） */
const HIT_R = 26;

const toS = (p: Pt) => ({ x: CX + p.x * S, y: CY - p.y * S });
const toM = (sp: { x: number; y: number }) => ({ x: (sp.x - CX) / S, y: (CY - sp.y) / S });

const DEFAULT_O: Pt = { x: 0, y: 0 };
const DEFAULT_TRI: Tri = { A: { x: -1.5, y: 0.3 }, B: { x: 1.4, y: 0.8 }, C: { x: 1.1, y: -0.8 } };

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
    perimeterShort: '周长',
    areaShort: '面积',
    readout: '位似变换',
    // 幕 1
    predictTitle: '预测',
    predictQuestion: '把位似比 k 从 1 调到 2，图形的面积会变成原来的几倍？',
    predictQuestion2: '先别动手，凭直觉猜三个：',
    predictQ1: 'k 从 1 到 2，面积变成原来的',
    predictQ2: 'k = −1 时，像在哪里？',
    predictQ3: '两个位似图形一定相似吗？',
    predQ1a: '2 倍',
    predQ1b: '4 倍',
    predQ1c: '不变',
    predQ2a: '与原图完全重合',
    predQ2b: '在 O 的另一侧，与原图等大',
    predQ2c: '缩成一个点',
    predQ3a: '一定相似',
    predQ3b: '不一定',
    predQ3c: '一定不相似',
    predictDone: '已记录你的预测',
    predictHint: '三题都猜完，就可以动手验证',
    revealLabel: '开始验证 →',
    // 幕 2
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。拖一拖 O 或顶点、改一改 k，看到有意思的状态时记一条。',
    notePlaceholder: '写一句话：你观察到了什么？',
    recordLabel: '记一条观察',
    clearLabel: '清空记录',
    tryLabel: '试试这个',
    cards: [
      {
        title: '面积是几倍？',
        prompt: '把 k 从 1 一点点拉到 2，看面积比怎么变：是翻一倍，还是变成四倍？',
      },
      {
        title: '负的位似比',
        prompt: '把 k 拉到 −1，像跑到哪一侧去了？大小变了吗？再试试 k = −1.5。',
      },
      {
        title: '拖一拖中心 O',
        prompt: '拖动位似中心 O：三条对应点的连线还都过 O 吗？图形大小会变吗？',
      },
      {
        title: '拖顶点，自由探索',
        prompt: '拖动 A、B、C 改变原三角形，看周长比与面积比是否只跟 k 有关。',
      },
    ],
    kLabel: '位似比 k',
    demoStart: '演示位似',
    centerLabel: '位似中心 O',
    dragHint: '画布上的 O、A、B、C 都可以直接拖动',
    kZeroNote: 'k = 0 时像缩成位似中心一个点，面积比与周长比都没有意义。',
    ratioTitle: '量一量',
    perimeterRatio: '周长比',
    areaRatio: '面积比',
    sideRatio: 'A′B′ / AB',
    expected: '理论值',
    measured: '实测',
    collinearOk: '三条对应点连线都过 O',
    collinearBad: '有连线不过 O',
    // 幕 3
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，下面四道题你怎么答？',
    concludeQ1: '位似比为 k 时，位似图形与原图的周长比是：',
    concludeQ2: '位似比为 k 时，面积比是：',
    concludeQ3: '位似图形中，对应点与位似中心的关系是：',
    concludeQ4: 'k < 0 时，像相当于把原图：',
    concludeQ1A: 'k',
    concludeQ1B: 'k²',
    concludeQ1C: '|k|',
    concludeQ2A: 'k²',
    concludeQ2B: '|k|',
    concludeQ2C: 'k',
    concludeQ3A: '三点共线只在 k > 0 时成立',
    concludeQ3B: '对应点的连线都经过位似中心',
    concludeQ3C: '对应点的连线互相平行',
    concludeQ4A: '绕 O 旋转 180° 再按 |k| 缩放',
    concludeQ4B: '关于 x 轴翻折后平移',
    concludeQ4C: '只平移，不改变大小',
    concludeHint: '四题都答完，看看结论和观察记录对不对得上',
    feedbackTitle: '反馈',
    feedbackText:
      '位似图形一定相似：对应边比与周长比都等于 |k|，面积比等于 k²，而且每一对对应点与位似中心 O 共线。k < 0 时像落在 O 的另一侧，等价于先绕 O 旋转 180° 再按 |k| 缩放。',
    tipsTitle: '考点速记',
    tips: [
      '位似比 k：周长比 = |k|，面积比 = k²（面积比是周长比的平方）。',
      '位似图形一定相似，但相似图形不一定位似。',
      '判断位似：每一对对应点的连线都经过同一个点（位似中心）。',
      'k < 0 表示像与像心分居中心两侧，常与 180° 旋转一起考。',
    ],
    ariaCanvas: '画布上可拖动位似中心 O 与三角形三个顶点；实线为原三角形，强调色为位似像。',
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
    perimeterShort: 'perim.',
    areaShort: 'area',
    readout: 'Homothety',
    predictTitle: 'Predict',
    predictQuestion: 'If the homothety ratio k goes from 1 to 2, how many times larger does the area become?',
    predictQuestion2: 'Before experimenting, guess these three:',
    predictQ1: 'k from 1 to 2 turns the area into',
    predictQ2: 'When k = −1, where is the image?',
    predictQ3: 'Are two homothetic figures always similar?',
    predQ1a: '2×',
    predQ1b: '4×',
    predQ1c: 'unchanged',
    predQ2a: 'exactly on top of the original',
    predQ2b: 'on the other side of O, same size',
    predQ2c: 'shrunk to a single point',
    predQ3a: 'always similar',
    predQ3b: 'not necessarily',
    predQ3c: 'never similar',
    predictDone: 'Predictions saved',
    predictHint: 'Answer all three to start testing',
    revealLabel: 'Start testing →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Drag O or a vertex, change k, then record what you notice.',
    notePlaceholder: 'One line: what did you observe?',
    recordLabel: 'Record',
    clearLabel: 'Clear',
    tryLabel: 'Try this',
    cards: [
      { title: 'How many times the area?', prompt: 'Drag k from 1 up to 2 and watch the area ratio: double, or four times?' },
      { title: 'A negative ratio', prompt: 'Set k = −1: which side does the image go? Does its size change? Try k = −1.5 too.' },
      { title: 'Drag the centre O', prompt: 'Drag O: do all three vertex-joins still pass through O? Does the size change?' },
      { title: 'Drag vertices, explore freely', prompt: 'Move A, B, C to reshape the original; check that the perimeter and area ratios depend only on k.' },
    ],
    kLabel: 'ratio k',
    demoStart: 'Play homothety',
    centerLabel: 'centre O',
    dragHint: 'O, A, B and C can all be dragged on the canvas',
    kZeroNote: 'At k = 0 the image collapses onto the centre, so neither ratio is meaningful.',
    ratioTitle: 'Measurements',
    perimeterRatio: 'Perimeter ratio',
    areaRatio: 'Area ratio',
    sideRatio: 'A′B′ / AB',
    expected: 'theory',
    measured: 'measured',
    collinearOk: 'All three vertex-joins pass through O',
    collinearBad: 'Some join misses O',
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, answer these four:',
    concludeQ1: 'With ratio k, the perimeter ratio of image to original is:',
    concludeQ2: 'With ratio k, the area ratio is:',
    concludeQ3: 'In homothetic figures, corresponding points and the centre are:',
    concludeQ4: 'When k < 0, the image is the original:',
    concludeQ1A: 'k',
    concludeQ1B: 'k²',
    concludeQ1C: '|k|',
    concludeQ2A: 'k²',
    concludeQ2B: '|k|',
    concludeQ2C: 'k',
    concludeQ3A: 'collinear only when k > 0',
    concludeQ3B: 'joined to the centre by lines through one point',
    concludeQ3C: 'joined by parallel lines',
    concludeQ4A: 'rotated 180° about O, then scaled by |k|',
    concludeQ4B: 'reflected in the x-axis and translated',
    concludeQ4C: 'translated without changing size',
    concludeHint: 'Answer all four, then compare with your observations',
    feedbackTitle: 'Feedback',
    feedbackText:
      'Homothetic figures are always similar: side and perimeter ratios equal |k|, the area ratio is k², and every pair of corresponding points lines up with the centre O. For k < 0 the image sits on the opposite side of O — the same as rotating 180° about O and scaling by |k|.',
    tipsTitle: 'Key points',
    tips: [
      'Ratio k: perimeter ratio = |k|, area ratio = k² (the area ratio is the square of the perimeter ratio).',
      'Homothetic figures are similar, but similar figures need not be homothetic.',
      'Test for homothety: every pair of corresponding points is joined by a line through one common point.',
      'k < 0 puts image and original on opposite sides — often paired with a 180° rotation in exam questions.',
    ],
    ariaCanvas: 'Drag the centre O and the triangle vertices. Solid lines are the original triangle, the accent colour is its homothetic image.',
  },
};

/** 题库注册表：选项顺序与判分答案的单一事实源（smoke 守卫解析本块） */
export const OPTIONS = {
  q1: [['k', 'concludeQ1A'], ['k2', 'concludeQ1B'], ['absK', 'concludeQ1C']],
  q2: [['k2', 'concludeQ2A'], ['absK', 'concludeQ2B'], ['k', 'concludeQ2C']],
  q3: [['onlyPos', 'concludeQ3A'], ['throughO', 'concludeQ3B'], ['parallel', 'concludeQ3C']],
  q4: [['rot180', 'concludeQ4A'], ['flip', 'concludeQ4B'], ['translate', 'concludeQ4C']],
} as const;

/** 每题正确选项值 */
export const QUIZ_CORRECT: Record<string, string[]> = {
  q1: ['absK'],
  q2: ['k2'],
  q3: ['throughO'],
  q4: ['rot180'],
};

export default function Similarity() {
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

  const [o, setO] = useState<Pt>(DEFAULT_O);
  const [tri, setTri] = useState<Tri>(DEFAULT_TRI);
  const [k, setK] = useState(() => numParam(initialUrl.get('k'), 1.5, -2, 2.5));
  const [demoK, setDemoK] = useState(1.5);
  const [demoSpeed, setDemoSpeed] = useState(1);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [conclusion, setConclusion] = useState<Record<QuizKey, string | null>>({ q1: null, q2: null, q3: null, q4: null });

  const [viewZoom, setViewZoom] = useState(1);
  const [showRays, setShowRays] = useState(() => boolParam(initialUrl.get('rays'), true));
  useLabUrlSync({ stage, k, rays: showRays }, { stage: 'predict', k: 1.5, rays: true }, [stage, k, showRays]);
  const svgRef = useRef<SVGSVGElement>(null);
  const imgPathRef = useRef<SVGPathElement>(null);
  const imgVertexRefs = useRef<Record<'A' | 'B' | 'C', { dot: SVGCircleElement | null; label: SVGTextElement | null }>>({
    A: { dot: null, label: null }, B: { dot: null, label: null }, C: { dot: null, label: null },
  });
  const lastUiRef = useRef(0);
  const demoKRef = useRef(1.5);
  const imgPathDRef = useRef('');
  const imgPointRef = useRef<Record<'A' | 'B' | 'C', { x: number; y: number }>>({
    A: toS(tri.A), B: toS(tri.B), C: toS(tri.C),
  });
  // 窄屏抽屉展开时把画布滚回视口顶部
  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<Handle | null>(null);

  // 演示态与用户态分离：演示只改 demoK，退出不写回；接管才 setK(displayK)
  const timeline = useAutoTimeline(SIMILARITY_DEMO, {
    loop: true,
    onFrame: (step, _index, progress, meta) => {
      const { from, to } = step.data;
      const k = from + (to - from) * easeInOutQuad(progress);
      demoKRef.current = k;
      const nextImg = homothetic(o, tri, k);
      imgPathDRef.current = triPath(nextImg);
      imgPathRef.current?.setAttribute('d', imgPathDRef.current);
      (['A', 'B', 'C'] as const).forEach((key) => {
        const p = toS(nextImg[key]);
        imgPointRef.current[key] = p;
        const refs = imgVertexRefs.current[key];
        refs.dot?.setAttribute('cx', String(p.x));
        refs.dot?.setAttribute('cy', String(p.y));
        refs.label?.setAttribute('x', String(p.x + 7));
        refs.label?.setAttribute('y', String(p.y - 7));
      });
      // 读数/滑块只需 12.5Hz；几何已经由 ref 每帧直写
      const now = performance.now();
      if (meta?.snap || now - lastUiRef.current >= 80) {
        lastUiRef.current = now;
        setDemoK(k);
      }
    },
    onDone: () => setDemoK(SIMILARITY_DEMO[SIMILARITY_DEMO.length - 1].data.to),
  });
  const displayK = stage === 'predict' ? 1 : timeline.active ? demoK : k;

  const img = useMemo(() => homothetic(o, tri, displayK), [o, tri, displayK]);
  const triCenter = useMemo(() => {
    const a = toS(tri.A), b = toS(tri.B), c = toS(tri.C);
    return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
  }, [tri]);
  const imgCenter = useMemo(() => {
    const a = toS(img.A), b = toS(img.B), c = toS(img.C);
    return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
  }, [img]);
  const mergedPrime = Math.abs(displayK - 1) < 0.12;
  const placeVertexLabel = (p: { x: number; y: number }, center: { x: number; y: number }, text: string) => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    return {
      x: Math.max(6, Math.min(VIEW_W - 6, p.x + ux * 16)),
      y: Math.max(12, Math.min(VIEW_H - 4, p.y + uy * 16 + 4)),
      textAnchor: (ux > 0.2 ? 'start' : ux < -0.2 ? 'end' : 'middle') as 'start' | 'middle' | 'end',
      text,
    };
  };
  const pRatio = perimeter(tri) > 1e-9 ? perimeter(img) / perimeter(tri) : 0;
  const aRatio = area(tri) > 1e-9 ? area(img) / area(tri) : 0;
  const sideRatioVal = dist(tri.A, tri.B) > 1e-9 ? dist(img.A, img.B) / dist(tri.A, tri.B) : 0;
  const collinearOk = useMemo(
    () =>
      areCollinear(o, tri.A, img.A, 1e-6) &&
      areCollinear(o, tri.B, img.B, 1e-6) &&
      areCollinear(o, tri.C, img.C, 1e-6),
    [o, tri, img],
  );

  /** 屏幕坐标 → 数学坐标 */
  const svgPoint = (clientX: number, clientY: number): Pt | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return toM(p);
  };

  const onDown = (h: Handle) => (e: ReactPointerEvent<SVGElement>) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    draggingRef.current = h;
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const h = draggingRef.current;
    if (!h) return;
    const p = svgPoint(e.clientX, e.clientY);
    if (!p) return;
    const q = clampPt(p, X_MIN, X_MAX, Y_MIN, Y_MAX);
    if (h === 'O') setO(q);
    else setTri((prev) => ({ ...prev, [h]: q }));
  };
  const onUp = () => {
    draggingRef.current = null;
  };

  const startDemo = () => {
    lastUiRef.current = 0;
    demoKRef.current = 1;
    setDemoK(1);
    timeline.start();
  };
  const takeover = () => {
    if (!timeline.active) return;
    setK(demoKRef.current);
    timeline.stop();
  };
  const cycleSpeed = () => {
    const next = demoSpeed === 1 ? 1.5 : demoSpeed === 1.5 ? 0.5 : 1;
    setDemoSpeed(next);
    timeline.setSpeed(next);
  };
  const applyK = (v: number) => {
    timeline.stop();
    setK(v);
  };

  const predComplete = pred.q1 !== null && pred.q2 !== null && pred.q3 !== null;
  const conclusionComplete = (Object.keys(conclusion) as QuizKey[]).every((key) => conclusion[key] !== null);

  const addObservation = (note: string) => {
    setObservations((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        snapshot: [
          { label: 'k', value: displayK.toFixed(1) },
          { label: lang === 'zh' ? '周长比' : 'P-ratio', value: pRatio.toFixed(2) },
          { label: lang === 'zh' ? '面积比' : 'A-ratio', value: aRatio.toFixed(2) },
        ],
        balanced: Math.abs(aRatio - areaRatio(k)) < 1e-6,
        note,
      },
    ]);
  };

  const cards: ExploreCard[] = [
    { key: 'card-area', title: t.cards[0].title, prompt: t.cards[0].prompt, tryLabel: t.tryLabel, tryIt: () => applyK(2) },
    { key: 'card-neg', title: t.cards[1].title, prompt: t.cards[1].prompt, tryLabel: t.tryLabel, tryIt: () => applyK(-1) },
    { key: 'card-centre', title: t.cards[2].title, prompt: t.cards[2].prompt, tryLabel: t.tryLabel, tryIt: () => setO({ x: 2.5, y: 0.8 }) },
    {
      key: 'card-free',
      title: t.cards[3].title,
      prompt: t.cards[3].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setTri({ A: { x: -1.8, y: 0.8 }, B: { x: -0.2, y: 1.2 }, C: { x: -1.2, y: -0.5 } });
        applyK(1.2);
      },
    },
  ];

  const resetAll = () => {
    setStage('predict');
    setPred({ q1: null, q2: null, q3: null });
    setRevealed(false);
    setO(DEFAULT_O);
    setTri(DEFAULT_TRI);
    applyK(1.5);
    setObservations([]);
    setConclusion({ q1: null, q2: null, q3: null, q4: null });
  };

  const f2 = (v: number) => mathMinus((Math.round(v * 100) / 100).toFixed(2));
  const vertexKeys: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];

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

  const triPath = (tt: Tri) => {
    const a = toS(tt.A);
    const b = toS(tt.B);
    const c = toS(tt.C);
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)} L ${c.x.toFixed(2)} ${c.y.toFixed(2)} Z`;
  };

  useEffect(() => {
    setLabState('similarity', {
      stage,
      k: displayK,
      perimeterRatio: pRatio,
      areaRatio: aRatio,
      negative: displayK < 0,
    });
  }, [stage, displayK, pRatio, aRatio]);

  useEffect(() => {
    setPageQuestion('similarity', lang === 'zh'
      ? '改变位似比 k 时，像与原图的周长比和面积比分别有什么变化规律？'
      : 'As the homothety ratio k changes, how do the perimeter ratio and area ratio change?');
  }, [lang]);

  const demoHud = (
    <DemoHud
      active={timeline.active}
      playing={timeline.playing}
      index={timeline.index}
      total={SIMILARITY_DEMO.length}
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

  const measureBar = (
    <div className="min-w-0 space-y-1">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          [t.perimeterRatio, pRatio, perimeterRatio(displayK)],
          [t.areaRatio, aRatio, areaRatio(displayK)],
          [t.sideRatio, sideRatioVal, perimeterRatio(displayK)],
        ].map(([label, measured, expected]) => (
          <div key={String(label)} className="min-w-0 border border-[var(--border)] px-1.5 py-0.5">
            <p className="truncate text-[0.5rem] mono-font text-[var(--muted)]">{label}</p>
            <p className="text-xs mono-font tabular-nums text-[var(--fg)]">{f2(Number(measured))}</p>
            <p className="truncate text-[0.5rem] mono-font tabular-nums text-[var(--muted)]">{t.expected} {f2(Number(expected))}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.6875rem] mono-font" role="status">
        <span className={collinearOk ? 'text-[var(--muted)]' : 'text-[var(--danger)]'}>
          <span aria-hidden="true">{collinearOk ? CHECK_ICON : X_ICON}</span>{' '}
          {collinearOk ? t.collinearOk : t.collinearBad}
        </span>
        <span className="text-[var(--muted)]">{t.dragHint}</span>
      </div>
      {Math.abs(displayK) < 1e-9 && <p className="text-[0.6875rem] mono-font text-[var(--muted)] leading-relaxed">{t.kZeroNote}</p>}
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
  const resetViewport = () => { setViewZoom(1); setO(DEFAULT_O); setTri(DEFAULT_TRI); applyK(1.5); };

  return (
    <LabStageShell titleZh="相似与位似" titleEn="Similarity & Homothety" labId="similarity" variant={isDesktop ? 'sheet' : 'default'}
      center={stageNav}>
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto">
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="lg:hidden shrink-0">{stageNav}</div>

      <div className="grid grid-cols-1 items-start gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* 左列：可拖拽画布 + 比值读数 */}
        <div className={`contents lg:block lg:h-full lg:min-h-0 lg:min-w-0 lg:space-y-4`}>
          <div ref={canvasRef} className="min-w-0 order-1 lg:order-none lg:h-full">
            <CanvasSurface
              active={timeline.active}
              hud={demoHud}
              showToolbar={stage !== 'predict'}
              titleSlot={<span className="truncate">{lang === 'zh' ? '位似比' : 'Scale ratio'} <strong>k = {displayK.toFixed(2)}</strong><span className="hidden sm:inline"> · O ({f2(o.x)}, {f2(o.y)})</span></span>}
              actionsSlot={<>
                <ToggleSwitch compact label={lang === 'zh' ? '辅助射线' : 'Rays'} checked={showRays} onChange={setShowRays} />
                <button type="button" onClick={startDemo} className="compact inline-flex h-7 shrink-0 items-center rounded-full border border-[var(--border)] px-2 text-[0.625rem] text-[var(--fg)] hover:bg-[var(--accent-light)]"><Play className="h-3 w-3" aria-hidden="true" /> {t.demoStart}</button>
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
              onPointerDownCapture={(e) => {
                if (timeline.active) {
                  e.preventDefault();
                  e.stopPropagation();
                  takeover();
                }
              }}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onPointerLeave={onUp}
            >
              {/* 中心到各对应点的连线：位似的直观证据 */}
              {showRays && stage !== 'predict' && vertexKeys.map((key) => {
                const p0 = toS(o);
                const p1 = toS(img[key]);
                return (
                  <line
                    key={'join' + key}
                    x1={p0.x}
                    y1={p0.y}
                    x2={p1.x}
                    y2={p1.y}
                    stroke="var(--muted)"
                    strokeWidth="1"
                    strokeDasharray="4 3"
                    opacity="0.55"
                  />
                );
              })}

              {/* 位似像 */}
              <path ref={imgPathRef} d={timeline.active ? imgPathDRef.current : triPath(img)} fill="var(--accent-light)" fillOpacity="0.3" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" />
              {/* 原三角形 */}
              <path d={triPath(tri)} fill="var(--accent-light)" fillOpacity="0.15" stroke="var(--fg)" strokeWidth="1.8" strokeLinejoin="round" />

              {/* 顶点：透明大圈承接拖拽，实心小点只做视觉 */}
              {vertexKeys.map((key) => {
                const p = toS(tri[key]);
                const pi = timeline.active ? imgPointRef.current[key as 'A' | 'B' | 'C'] : toS(img[key]);
                return (
                  <g key={'v' + key}>
                    <circle cx={p.x} cy={p.y} r={HIT_R} fill="transparent" style={{ cursor: 'grab' }} onPointerDown={onDown(key)} />
                    <circle cx={p.x} cy={p.y} r="5" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="2" pointerEvents="none" />
                    {!timeline.active && (
                      <circle cx={p.x} cy={p.y} r="12" fill="none" stroke="var(--fg)" strokeWidth="1" strokeDasharray="3 2" opacity="0.65" pointerEvents="none" />
                    )}
                    {(() => {
                      const lp = placeVertexLabel(p, triCenter, mergedPrime ? `${key}(${key}′)` : key);
                      return (
                        <text x={lp.x} y={lp.y} textAnchor={lp.textAnchor} fontSize="13" fill="var(--fg)" fontFamily="var(--f-mono)" pointerEvents="none">
                          {lp.text}
                        </text>
                      );
                    })()}
                    <circle
                      ref={(el) => { imgVertexRefs.current[key as 'A' | 'B' | 'C'].dot = el; }}
                      cx={pi.x} cy={pi.y} r="4" fill="var(--accent)" pointerEvents="none"
                    />
                    {/* k≈0 时像缩成中心点 O，A′/B′/C′ 与 O 的标签会叠在一起；只留中心 O */}
                    {!mergedPrime && Math.abs(displayK) >= 0.08 && (() => {
                      const lp = placeVertexLabel(pi, imgCenter, `${key}′`);
                      return (
                        <text
                          ref={(el) => { imgVertexRefs.current[key as 'A' | 'B' | 'C'].label = el; }}
                          x={lp.x} y={lp.y} textAnchor={lp.textAnchor} fontSize="12" fill="var(--accent)" fontFamily="var(--f-mono)" pointerEvents="none"
                        >
                          {lp.text}
                        </text>
                      );
                    })()}
                  </g>
                );
              })}

              {/* 位似中心 O（可拖） */}
              <circle cx={toS(o).x} cy={toS(o).y} r={HIT_R} fill="transparent" style={{ cursor: 'grab' }} onPointerDown={onDown('O')} />
              {!timeline.active && (
                <circle cx={toS(o).x} cy={toS(o).y} r="12" fill="none" stroke="var(--fg)" strokeWidth="1" strokeDasharray="3 2" opacity="0.65" pointerEvents="none" />
              )}
              <rect
                x={toS(o).x - 4.5}
                y={toS(o).y - 4.5}
                width="9"
                height="9"
                fill="var(--fg)"
                transform={`rotate(45 ${toS(o).x} ${toS(o).y})`}
                pointerEvents="none"
              />
              <text x={toS(o).x + 10} y={toS(o).y + 16} fontSize="13" fill="var(--fg)" fontFamily="var(--f-mono)" pointerEvents="none">
                O
              </text>
            </svg>

            </CanvasSurface>
          </div>

        </div>

        {/* 右列：参数 + 三幕 */}
        <div className={`contents lg:block lg:h-full lg:min-h-0 lg:min-w-0 lg:space-y-4 lg:overflow-y-auto`} style={stage === 'predict' ? { display: 'none' } : undefined}>
          <div className="min-w-0 order-2 lg:order-none">
          <ParamDock
            title={t.paramDock}
            closeLabel={t.paramDockClose}
            anchorRef={canvasRef}
            summary={`k ${mathMinus(displayK.toFixed(1))} · ${t.perimeterShort} ${f2(pRatio)} · ${t.areaShort} ${f2(aRatio)}`}
          >
          <div className="border border-[var(--border)] p-4 space-y-3">
            <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {t.readout}</h3>
            <ParamSlider
              label={t.kLabel}
              value={displayK}
              min={-2}
              max={2}
              step={0.1}
              onChange={setK}
              onAdjustStart={takeover}
              format={(v) => mathMinus(v.toFixed(1))}
            />
            <p className="text-[0.6875rem] mono-font text-[var(--muted)] tabular-nums">
              {t.centerLabel} ({f2(o.x)}, {f2(o.y)})
            </p>
            <button
              type="button"
              onClick={() => {
                setO(DEFAULT_O);
                setTri(DEFAULT_TRI);
                applyK(1.5);
              }}
              className="inline-flex items-center rounded px-1.5 py-1 text-xs mono-font uppercase text-[var(--muted)] hover:text-[var(--fg)] active:bg-[var(--accent)] active:text-[var(--bg)] transition-colors tap-area"
            >
              {t.reset}
            </button>
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
                  ['q1', t.predictQ1, [t.predQ1a, t.predQ1b, t.predQ1c]],
                  ['q2', t.predictQ2, [t.predQ2a, t.predQ2b, t.predQ2c]],
                  ['q3', t.predictQ3, [t.predQ3a, t.predQ3b, t.predQ3c]],
                ] as ['q1' | 'q2' | 'q3', string, string[]][]
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
              {predComplete && !revealed && (
                <button
                  type="button"
                  onClick={() => {
                    setRevealed(true);
                    setStage('explore');
                  }}
                  className="w-full min-h-[40px] rounded-lg border border-[var(--fg)] bg-[var(--fg)] px-3 py-2 text-xs font-semibold text-[var(--bg)] hover:opacity-90 transition-opacity"
                >
                  {t.revealLabel}
                </button>
              )}
              {!predComplete && <p className="text-[0.6875rem] mono-font text-[var(--muted)]">{t.predictHint}</p>}
            </div>
          )}

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
                  <p className="text-[0.6875rem] mono-font text-[var(--muted)]">
                    {lang === 'zh' ? '观察记录：' : 'Evidence: '}
                    {observations.filter((ob) => ob.balanced).length} {lang === 'zh' ? '条符合 k²' : 'match k²'} /{' '}
                    {observations.filter((ob) => !ob.balanced).length} {lang === 'zh' ? '条不符' : 'do not'}
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
