/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学探究 · 割圆术（人教版 九上「圆」拓展 · 刘徽割圆术）
 *
 * 幕 1 预测：内接正六边形周长比圆周长短还是长？边数翻倍会怎样？会不会超过圆周长？
 * 幕 2 探索：拖「边数」滑块（3→192，翻倍式递进）+ 一键翻倍，实时看
 *        内接 / 外切正多边形对圆周与圆面积的逼近，读数表把「多边形算得 / 圆的值 / 差」并排。
 * 幕 3 结论：四道逼近判断题，对照自己的观察记录。
 *
 * 复用：ParamSlider、ExploreStage、StageNav；画布为自绘 SVG（零第三方依赖）。
 * 半径固定 r = 1：圆周长 2π、圆面积 π，于是「周长 ÷ 直径」本身就是 π 的估计值。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, Play, RotateCcw, X } from 'lucide-react';
import { setLabState, setPageQuestion } from '../../lib/ai-dynamic-questions';
import { useApp } from '../../lib/app-context';
import { boolParam, enumParam, numParam, readUrlParams, useLabUrlSync } from '../../lib/lab-url-state';
import { useIsDesktopLab } from '../../components/lab/useIsDesktopLab';
import ParamDock from '../../components/lab/ParamDock';
import ParamSlider from '../../components/lab/ParamSlider';
import ToggleSwitch from '../../components/lab/ToggleSwitch';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import StageNav from '../../components/lab/StageNav';
import CanvasSurface, { CanvasZoomControls } from '../../components/lab/CanvasSurface';
import LabStageShell from '../../components/lab/LabStageShell';
import DemoHud, { DEMO_HUD_COPY } from '../../components/lab/demo-hud';
import { useAutoTimeline } from '../../components/lab/use-auto-timeline';
import {
  PI,
  type Pt,
  inArea,
  inGap,
  inPerimeter,
  inVertices,
  outArea,
  outPerimeter,
  outVertices,
  piBounds,
  piFromPerimeter,
} from './polygon-pi-core';
import { POLYGON_DEMO } from './polygon-pi-demo';

type Stage = 'predict' | 'explore' | 'conclude';
type PredictAnswer = 'a' | 'b' | 'c' | null;
type QuizKey = 'q1' | 'q2' | 'q3' | 'q4';

const CHECK_ICON = <Check className="inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em]" aria-hidden="true" />;
const X_ICON = <X className="inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em]" aria-hidden="true" />;

/* ────────────────────────── 画布映射 ────────────────────────── */

const VIEW_W = 600;
const VIEW_H = 380;
/** 1 数学单位（半径）= 多少 SVG 像素；主圆直径占画布高度约 79% */
const S = 150;
const CX = 300;
const CY = 190;
/** 半径固定为 1 */
const R = 1;
/** 割圆局部放大镜：聚焦主圆正上方，显示内外接与圆周的夹逼缝隙 */
const LOUPE_R = 64;
const LOUPE_ZOOM = 8;
const LOUPE_X = VIEW_W - 76;
const LOUPE_Y = 76;

const toS = (p: Pt) => ({ x: CX + p.x * S, y: CY - p.y * S });

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
    readout: '割圆术',
    ariaCanvas: '半径为 1 的圆与它的内接正多边形，可切换边数比较周长与面积',
    // 幕 1
    predictTitle: '预测',
    predictQuestion: '在半径为 1 的圆里画一个内接正六边形，它的周长和圆的周长比，谁大？',
    predictQuestion2: '先别动手，凭直觉猜三个：',
    predictQ1: '内接正六边形（边长 1）的周长，比圆的周长 6.28 要',
    predictQ2: '边数从 6 一路翻倍，多边形看起来会',
    predictQ3: '边数翻倍到很大时，多边形周长会不会超过圆周长？',
    predQ1a: '短一点',
    predQ1b: '差不多相等',
    predQ1c: '长一点',
    predQ2a: '越来越像圆',
    predQ2b: '始终是明显的折线',
    predQ2c: '反而变回正方形',
    predQ3a: '会超过圆周长',
    predQ3b: '不会，只会越来越接近圆周长',
    predQ3c: '会先超过再退回来',
    predictHint: '三题都猜完，就可以动手验证',
    revealLabel: '开始验证 →',
    // 幕 2
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。拖一拖「边数」、打开外切多边形，看到有意思的状态时记一条。',
    notePlaceholder: '写一句话：你观察到了什么？',
    recordLabel: '记一条观察',
    clearLabel: '清空记录',
    tryLabel: '试试这个',
    cards: [
      { title: '边数翻倍', prompt: '从正六边形开始，一路点「边数翻倍」，盯住「差」那一列：它在怎么变？' },
      { title: 'π 的下界', prompt: '看「π 估计」那一列：它一直小于 3.14159 吗？离真值还差多少？' },
      { title: '内外夹逼', prompt: '打开外切正多边形，让一个从里面、一个从外面把圆周长夹住。' },
      { title: '刘徽的 96 边形', prompt: '直接跳到 n = 96，看看一千八百年前算出的 π 是多少。' },
    ],
    nLabel: '边数 n',
    demoStart: '连续推演',
    more: '更多说明',
    nValue: (n: number) => `n = ${n}`,
    doubleLabel: '边数翻倍',
    maxLabel: '已到最大边数',
    showOuter: '外切正多边形',
    showRadii: '半径辅助线',
    showLabels: '顶点标注',
    radiusNote: '半径 r = 1',
    polyNote: (n: number) => `正 ${n} 边形`,
    // 读数表
    ratioTitle: '读数对照',
    colItem: '量',
    colPoly: '多边形算得',
    colCircle: '圆的值',
    colGap: '差',
    rowPerimeter: '周长（内接）',
    rowPerimeterOut: '周长（外切）',
    rowArea: '面积（内接）',
    areaShort: '内接面积',
    rowPiEst: 'π 估计（周长 ÷ 直径）',
    squeezeText: (lo: string, hi: string) => `夹逼区间：π 就夹在 ${lo} 和 ${hi} 之间`,
    squeezeNote: '内接从里往上靠，外切从外往下压，边数越多两者越窄。',
    dragHint: '换边数不会改变图形的位置，只改变它离圆有多近。',
    // 幕 3
    concludeTitle: '结论',
    concludeQuestion: '用你自己量出来的数据回答：',
    concludeQ1: '半径为 1 的圆内接正六边形，周长和圆的周长 6.28 相比',
    concludeQ2: '边数一路翻倍下去，内接多边形的周长会',
    concludeQ3: '用正 96 边形周长算出的 π（周长 ÷ 直径）和真值 π 比',
    concludeQ4: '同时画内接和外切，边数增大时两个多边形的周长',
    cq1A: '短一些',
    cq1B: '正好相等',
    cq1C: '长一些',
    cq2A: '无限增大下去',
    cq2B: '先增大后减小',
    cq2C: '一直增大，但始终小于圆周长',
    cq3A: '略大一点',
    cq3B: '略小一点',
    cq3C: '正好相等',
    cq4A: '都从下方逼近圆周长',
    cq4B: '一个从下方、一个从上方，一起逼近圆周长',
    cq4C: '先靠近，后来又拉开',
    feedbackTitle: '判分说明',
    feedbackText:
      '内接正多边形的周长永远比圆周长短，边数越多越接近；外切正多边形的周长永远比圆周长长，也从另一侧接近。两条线把圆周长夹在中间，所以量出的 π 才越来越准——这就是刘徽的割圆术：用能算的直边，去逼近不能直接量的曲线。',
    tipsTitle: '考点速记',
    tips: [
      '内接正 n 边形周长 = 2n r sin(π/n)，面积 = (n/2) r² sin(2π/n)，边长 = 2r sin(π/n)。',
      '边数 n 越大，内接正多边形越接近圆：周长趋近 2πr，面积趋近 πr²。',
      '内接永远在圆内（偏小），外切永远在圆外（偏大），两面夹住才能估出 π。',
      '刘徽用正 96 边形得到 π ≈ 3.14；祖冲之把这个数精确到 3.1415926 与 3.1415927 之间。',
    ],
    concludeHint: '四题都答完，对照上面的读数表看你判断得对不对。',
    evMatch: '条已逼到 0.01 以内',
    evMiss: '条还差得多',
  },
  en: {
    stagePredict: 'Predict',
    stageExplore: 'Explore',
    stageConclude: 'Conclude',
    stageDone: 'Done',
    nextStage: 'Next →',
    redoLabel: 'Explore again',
    reset: 'Reset',
    paramDock: 'Adjust parameters',
    paramDockClose: 'Hide parameters',
    readout: 'Circle-Cutting',
    ariaCanvas: 'A circle of radius 1 with an inscribed regular polygon; change the number of sides to compare perimeter and area',
    predictTitle: 'Predict',
    predictQuestion: 'A regular hexagon is inscribed in a circle of radius 1. Which perimeter is larger?',
    predictQuestion2: 'Before you touch anything, guess all three:',
    predictQ1: 'The inscribed hexagon (side 1) has perimeter, compared with the circle 6.28,',
    predictQ2: 'Doubling the number of sides over and over makes the polygon',
    predictQ3: 'If you keep doubling the sides, can the perimeter exceed the circle?',
    predQ1a: 'a bit shorter',
    predQ1b: 'about equal',
    predQ1c: 'a bit longer',
    predQ2a: 'look more and more like a circle',
    predQ2b: 'stay a visibly broken line',
    predQ2c: 'turn back into a square',
    predQ3a: 'Yes, it will pass the circle',
    predQ3b: 'No, it only gets closer and closer',
    predQ3c: 'It overshoots, then comes back',
    predictHint: 'Answer all three to start testing',
    revealLabel: 'Test it →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Drag the side count, switch on the circumscribed polygon, and record what you notice.',
    notePlaceholder: 'One sentence: what did you notice?',
    recordLabel: 'Record',
    clearLabel: 'Clear',
    tryLabel: 'Try this',
    cards: [
      { title: 'Double the sides', prompt: 'Start from the hexagon, keep pressing “Double the sides”, and watch the gap column shrink.' },
      { title: 'Lower bound for π', prompt: 'Watch the π estimate: is it always below 3.14159? By how much?' },
      { title: 'Squeeze from both sides', prompt: 'Turn on the circumscribed polygon so one closes in from outside, one from inside.' },
      { title: "Liu Hui's 96-gon", prompt: 'Jump straight to n = 96 and see the π computed 1800 years ago.' },
    ],
    nLabel: 'Sides n',
    demoStart: 'Run squeeze',
    more: 'More',
    nValue: (n: number) => `n = ${n}`,
    doubleLabel: 'Double the sides',
    maxLabel: 'Largest side count reached',
    showOuter: 'Circumscribed polygon',
    showRadii: 'Radius lines',
    showLabels: 'Vertex labels',
    radiusNote: 'radius r = 1',
    polyNote: (n: number) => `regular ${n}-gon`,
    ratioTitle: 'Readouts',
    colItem: 'Quantity',
    colPoly: 'Polygon',
    colCircle: 'Circle',
    colGap: 'Gap',
    rowPerimeter: 'Perimeter (inscribed)',
    rowPerimeterOut: 'Perimeter (circumscribed)',
    rowArea: 'Area (inscribed)',
    areaShort: 'Inscribed area',
    rowPiEst: 'π estimate (P ÷ diameter)',
    squeezeText: (lo: string, hi: string) => `Squeeze interval: π lies between ${lo} and ${hi}`,
    squeezeNote: 'The inscribed polygon pushes up from inside, the circumscribed one presses down from outside.',
    dragHint: 'Changing the side count never moves the shape — only how close it hugs the circle.',
    concludeTitle: 'Conclude',
    concludeQuestion: 'Answer with the numbers you measured:',
    concludeQ1: 'For the inscribed hexagon in a circle of radius 1, the perimeter is',
    concludeQ2: 'Doubling the sides over and over, the inscribed perimeter will',
    concludeQ3: 'The π computed from a 96-gon (perimeter ÷ diameter) is',
    concludeQ4: 'With both polygons drawn, as n grows the two perimeters',
    cq1A: 'shorter',
    cq1B: 'exactly equal',
    cq1C: 'longer',
    cq2A: 'grow without bound',
    cq2B: 'grow then shrink',
    cq2C: 'always grow, but stay below the circle',
    cq3A: 'slightly too big',
    cq3B: 'slightly too small',
    cq3C: 'exactly right',
    cq4A: 'both approach from below',
    cq4B: 'one from below and one from above, closing in together',
    cq4C: 'come close and then separate again',
    feedbackTitle: 'Why',
    feedbackText:
      'An inscribed polygon always has a shorter perimeter than the circle, and gets closer as n grows; a circumscribed polygon always has a longer one and closes in from the other side. The circle is pinned between them, which is exactly why the measured π keeps improving — Liu Hui’s circle-cutting method: use straight edges you can compute to approach a curve you cannot measure directly.',
    tipsTitle: 'Key points',
    tips: [
      'Inscribed regular n-gon: side 2r sin(π/n), perimeter 2n r sin(π/n), area (n/2) r² sin(2π/n).',
      'As n grows the inscribed polygon approaches the circle: perimeter → 2πr, area → πr².',
      'Inscribed stays inside (too small), circumscribed stays outside (too big); you need both sides to pin down π.',
      'Liu Hui used a 96-gon to get π ≈ 3.14; Zu Chongzhi narrowed it to between 3.1415926 and 3.1415927.',
    ],
    concludeHint: 'Answer all four, then check them against the readout table.',
    evMatch: 'got within 0.01',
    evMiss: 'still far off',
  },
} as const;

/** 每题选项：[值, 文案键]，顺序即渲染顺序 */
export const OPTIONS = {
  q1: [['shorter', 'cq1A'], ['equal', 'cq1B'], ['longer', 'cq1C']],
  q2: [['unbounded', 'cq2A'], ['shrink', 'cq2B'], ['bounded', 'cq2C']],
  q3: [['bigger', 'cq3A'], ['smaller', 'cq3B'], ['exact', 'cq3C']],
  q4: [['bothBelow', 'cq4A'], ['squeeze', 'cq4B'], ['split', 'cq4C']],
} as const;

/** 每题正确选项值 */
export const QUIZ_CORRECT: Record<string, string[]> = {
  q1: ['shorter'],
  q2: ['bounded'],
  q3: ['smaller'],
  q4: ['squeeze'],
};

/** 固定域 [3.0, 3.3] 的夹逼条：band 随 lo/hi 收窄，π 刻度固定 */
function SqueezeBar({ lo, hi }: { lo: number; hi: number }) {
  const MIN = 3.0;
  const MAX = 3.3;
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const left = clamp01((lo - MIN) / (MAX - MIN));
  const right = clamp01((hi - MIN) / (MAX - MIN));
  const piLeft = clamp01((PI - MIN) / (MAX - MIN));

  return (
    <div className="space-y-1" role="img" aria-label={`π squeeze: ${lo.toFixed(5)} < π < ${hi.toFixed(5)}`}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="absolute inset-y-0 bg-[var(--accent)]/20 transition-[left,width] duration-300"
          style={{ left: `${left * 100}%`, width: `${Math.max(0.5, (right - left) * 100)}%` }}
        />
        <div className="absolute -top-0.5 h-3 border-l border-[var(--fg)]" style={{ left: `${piLeft * 100}%` }} />
      </div>
      <div className="flex justify-between text-[0.625rem] mono-font tabular-nums text-[var(--muted)]">
        <span>{lo.toFixed(5)}</span>
        <span>π</span>
        <span>{hi.toFixed(5)}</span>
      </div>
    </div>
  );
}

export default function PolygonPi() {
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
  const [n, setN] = useState(() => numParam(initialUrl.get('n'), 6, 3, 192));
  const [viewZoom, setViewZoom] = useState(1);
  const [showOuter, setShowOuter] = useState(() => boolParam(initialUrl.get('outer'), false));
  const [showRadii, setShowRadii] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [demoN, setDemoN] = useState(3);
  const [demoPrevN, setDemoPrevN] = useState(3);
  const [demoShowOuter, setDemoShowOuter] = useState(false);
  const [demoSpeed, setDemoSpeed] = useState(1);
  useLabUrlSync({ stage, n, outer: showOuter }, { stage: 'predict', n: 6, outer: false }, [stage, n, showOuter]);
  const demoNRef = useRef(3);
  const polyRef = useRef<SVGGElement>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [conclusion, setConclusion] = useState<Record<QuizKey, string | null>>({ q1: null, q2: null, q3: null, q4: null });
  // 窄屏抽屉展开时把画布滚回视口顶部
  const canvasRef = useRef<HTMLDivElement>(null);

  // n 是离散整数：时间轴只负责「何时切下一档」，平滑交给 CSS/夹逼条
  const timeline = useAutoTimeline(POLYGON_DEMO, {
    onStep: (step) => {
      setDemoPrevN(demoNRef.current);
      demoNRef.current = step.data.n;
      setDemoN(step.data.n);
      if (step.data.showOuter) setDemoShowOuter(true);
    },
  });
  const displayN = timeline.active ? demoN : n;
  useEffect(() => { if (displayN >= 12) setShowOuter(true); }, [displayN]);
  const displayShowOuter = timeline.active ? demoShowOuter : showOuter;

  // 不销毁整组多边形：换 n 时只重启一次进场动画，避免 192 顶点重挂载暗闪
  useLayoutEffect(() => {
    const el = polyRef.current;
    if (!el) return;
    el.classList.remove('demo-poly-in');
    void el.getBoundingClientRect();
    el.classList.add('demo-poly-in');
  }, [displayN]);

  const innerP = inPerimeter(displayN, R);
  const innerA = inArea(displayN, R);
  const outerP = outPerimeter(displayN, R);
  const outerA = outArea(displayN, R);
  const piEst = piFromPerimeter(innerP, R);
  const gapP = inGap(displayN, R);
  const bounds = useMemo(() => piBounds(displayN, R), [displayN]);

  const innerPts = useMemo(() => inVertices(displayN, R).map(toS), [displayN]);
  const outerPts = useMemo(() => outVertices(displayN, R).map(toS), [displayN]);
  const prevPts = useMemo(() => inVertices(demoPrevN, R).map(toS), [demoPrevN]);
  const isNewVertex = (p: { x: number; y: number }) =>
    timeline.active && !prevPts.some((q) => Math.abs(q.x - p.x) < 0.5 && Math.abs(q.y - p.y) < 0.5);
  const circleR = R * S;
  // 聚焦“顶点到下一顶点”的圆弧中段，看到弦-弧-外切边的夹逼扇形，而不是顶点十字
  const loupeAngle = -PI / 2 + PI / displayN;
  const loupeFocus = { x: CX + Math.cos(loupeAngle) * circleR, y: CY - Math.sin(loupeAngle) * circleR };

  const pathOf = (pts: { x: number; y: number }[]) =>
    pts.length < 3 ? '' : `M ${pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')} Z`;

  const predComplete = pred.q1 !== null && pred.q2 !== null && pred.q3 !== null;
  const conclusionComplete = (Object.keys(conclusion) as QuizKey[]).every((key) => conclusion[key] !== null);

  const f = (v: number, d = 4) => v.toFixed(d);

  const takeover = () => {
    if (!timeline.active) return;
    setN(demoN);
    setShowOuter(demoShowOuter);
    timeline.stop();
  };
  const startDemo = () => {
    setDemoN(3);
    setDemoPrevN(3);
    setDemoShowOuter(false);
    demoNRef.current = 3;
    timeline.start();
  };
  const cycleSpeed = () => {
    const next = demoSpeed === 1 ? 1.5 : demoSpeed === 1.5 ? 0.5 : 1;
    setDemoSpeed(next);
    timeline.setSpeed(next);
  };
  const applyN = (value: number) => {
    timeline.stop();
    setN(Math.max(3, Math.min(192, Math.round(value))));
  };
  const nextDouble = displayN >= 192 ? null : Math.min(192, displayN * 2);

  const addObservation = (note: string) => {
    setObservations((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        snapshot: [
          { label: 'n', value: String(displayN) },
          { label: lang === 'zh' ? '内接周长' : 'P-in', value: f(innerP, 3) },
          { label: lang === 'zh' ? 'π 估计' : 'π est', value: f(piEst, 5) },
        ],
        balanced: gapP < 0.01,
        note,
      },
    ]);
  };

  const cards: ExploreCard[] = [
    {
      key: 'card-double',
      title: t.cards[0].title,
      prompt: t.cards[0].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => { const d = nextDouble; if (d !== null) applyN(d); },
    },
    { key: 'card-pi', title: t.cards[1].title, prompt: t.cards[1].prompt, tryLabel: t.tryLabel, tryIt: () => applyN(32) },
    {
      key: 'card-squeeze',
      title: t.cards[2].title,
      prompt: t.cards[2].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setShowOuter(true);
        applyN(12);
      },
    },
    {
      key: 'card-liu',
      title: t.cards[3].title,
      prompt: t.cards[3].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        applyN(96);
        setShowOuter(true);
      },
    },
  ];

  const resetAll = () => {
    setStage('predict');
    setPred({ q1: null, q2: null, q3: null });
    applyN(6);
    setShowOuter(false);
    setShowRadii(false);
    setShowLabels(false);
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


  const rows: { label: string; poly: string; circle: string; gap: string }[] = [
    { label: t.rowPerimeter, poly: f(innerP), circle: f(2 * PI), gap: f(gapP) },
    ...(showOuter ? [{ label: t.rowPerimeterOut, poly: f(outerP), circle: f(2 * PI), gap: f(outerP - 2 * PI) }] : []),
    { label: t.rowArea, poly: f(innerA), circle: f(PI), gap: f(PI - innerA) },
    { label: t.rowPiEst, poly: f(piEst, 5), circle: f(PI, 5), gap: f(PI - piEst, 5) },
  ];

  useEffect(() => {
    setLabState('polygon-pi', {
      stage,
      n: displayN,
      showOuter: displayShowOuter,
      piLo: bounds.lo,
      piHi: bounds.hi,
    });
  }, [stage, displayN, displayShowOuter, bounds]);

  useEffect(() => {
    setPageQuestion('polygon-pi', lang === 'zh'
      ? '改变边数 n 时，内接/外切正多边形周长与圆周长的差距怎样变化？你观察到什么规律？'
      : 'As n changes, how does the gap between the inscribed/circumscribed polygon perimeter and the circle change? What pattern do you observe?');
  }, [lang]);

  const demoHud = (
    <DemoHud
      active={timeline.active}
      playing={timeline.playing}
      index={timeline.index}
      total={POLYGON_DEMO.length}
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
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[0.6875rem] font-bold uppercase tracking-widest text-[var(--muted)] mono-font">// {t.ratioTitle}</span>
        <div className="min-w-0 flex-1"><SqueezeBar lo={bounds.lo} hi={bounds.hi} /></div>
      </div>
      <div className="grid min-w-[18rem] grid-cols-2 gap-x-3 gap-y-0.5 text-[0.5625rem] mono-font tabular-nums sm:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0 border border-[var(--border)] px-1.5 py-0.5 leading-tight">
            <span className="block truncate text-[0.45rem] text-[var(--muted)]">{row.label}</span>
            <span className="text-[var(--fg)]">{row.poly}</span>
            <span className="text-[var(--muted)]"> / {row.circle}</span>
            <span className="text-[var(--muted)]"> Δ{row.gap}</span>
          </div>
        ))}
      </div>
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
  const resetViewport = () => { setViewZoom(1); applyN(6); };

  return (
    <LabStageShell titleZh="割圆术" titleEn="Circle-Cutting (π)" labId="polygon-pi" variant={isDesktop ? 'sheet' : 'default'}
      center={stageNav}>
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto">
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="lg:hidden shrink-0">{stageNav}</div>

      <div className="grid grid-cols-1 items-start gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* 左列：画布 + 读数对照表 */}
        <div className={`contents lg:block lg:h-full lg:min-h-0 lg:min-w-0 lg:space-y-4`}>
          <div ref={canvasRef} className="min-w-0 order-1 lg:order-none lg:h-full">
            <CanvasSurface
              active={timeline.active}
              hud={demoHud}
              showToolbar={stage !== 'predict'}
              titleSlot={<span className="truncate">// {t.readout} <span className="text-[var(--muted)]">{lang === 'zh' ? '正' : 'Regular'} {displayN} {lang === 'zh' ? '边形' : 'gon'}<span className="hidden sm:inline"> · r = 1</span></span></span>}
              actionsSlot={<>
                <ToggleSwitch compact label={t.showOuter} checked={showOuter} onChange={setShowOuter} />
                <button type="button" onClick={startDemo} className="compact inline-flex h-7 shrink-0 items-center rounded-full border border-[var(--border)] px-2 text-[0.625rem] text-[var(--fg)] hover:bg-[var(--accent-light)]"><Play className="h-3 w-3" aria-hidden="true" /> {t.demoStart}</button>
                <CanvasZoomControls onZoomIn={() => setViewZoom((z) => Math.min(1.6, z + 0.1))} onZoomOut={() => setViewZoom((z) => Math.max(0.75, z - 0.1))} onReset={resetViewport} />
              </>}
              footerBar={stage === 'predict' ? undefined : measureBar}
            >
            <svg
              viewBox={viewBox}
              className="block h-full w-full"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={t.ariaCanvas}
              onPointerDownCapture={(e) => {
                if (timeline.active) {
                  e.preventDefault();
                  e.stopPropagation();
                  takeover();
                }
              }}
            >
              <defs>
                <clipPath id="polygon-loupe-clip">
                  <circle cx={LOUPE_X} cy={LOUPE_Y} r={LOUPE_R} />
                </clipPath>
              </defs>

              {/* 外切正多边形：从外面把圆夹住 */}
              {displayShowOuter && (
                <path d={pathOf(outerPts)} fill="none" stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="5 4" opacity="0.85" />
              )}

              {/* 圆本体 */}
              <circle cx={CX} cy={CY} r={circleR} fill="none" stroke="var(--fg)" strokeWidth="1.6" />

              {/* 半径辅助线 */}
              {showRadii &&
                innerPts.map((p, i) => (
                  <line key={'r' + i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="var(--muted)" strokeWidth="0.9" strokeDasharray="3 3" opacity="0.6" />
                ))}

              {/* 内接正多边形：key={displayN} 触发 demo-poly-in；新顶点脉冲 */}
              <g ref={polyRef} className="demo-poly-in" style={{ transformOrigin: `${CX}px ${CY}px` }}>
                <path d={pathOf(innerPts)} fill="var(--accent-light)" fillOpacity="0.22" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" />

                {innerPts.map((p, i) => (
                  <g key={'v' + i}>
                    {isNewVertex(p) && (
                      <circle className="demo-pulse" cx={p.x} cy={p.y} r={6} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
                    )}
                    <circle cx={p.x} cy={p.y} r={displayN > 32 ? 2 : 3} fill="var(--accent)" />
                    {showLabels && displayN <= 12 && (
                      <text x={p.x + 6} y={p.y - 6} fontSize="11" fill="var(--fg)" fontFamily="var(--f-mono)">
                        {String.fromCharCode(65 + i)}
                      </text>
                    )}
                  </g>
                ))}
              </g>

              {/* 局部放大镜：n≥12 后内外接缝隙只有几像素，靠 ×8 放大看清 */}
              {displayN >= 12 && (
                <g pointerEvents="none" role="img" aria-label={lang === 'zh' ? '局部放大：圆与内外接正多边形的夹逼缝隙' : 'Local magnifier: gap between circle and inscribed/circumscribed polygons'}>
                  <circle cx={LOUPE_X} cy={LOUPE_Y} r={LOUPE_R} fill="var(--card-bg)" opacity="0.96" />
                  <g clipPath="url(#polygon-loupe-clip)">
                    <g transform={`translate(${LOUPE_X} ${LOUPE_Y}) scale(${LOUPE_ZOOM}) translate(${-loupeFocus.x} ${-loupeFocus.y})`}>
                      <circle
                        cx={CX} cy={CY} r={circleR}
                        fill="none" stroke="var(--fg)" strokeWidth="2.6"
                        vectorEffect="non-scaling-stroke"
                      />
                      {displayShowOuter && (
                        <path
                          d={pathOf(outerPts)} fill="none" stroke="var(--muted)" strokeWidth="1.2"
                          strokeDasharray="5 4" vectorEffect="non-scaling-stroke"
                        />
                      )}
                      <path
                        d={pathOf(innerPts)} fill="none" stroke="var(--fg)" strokeOpacity="0.6" strokeWidth="1.4"
                        strokeDasharray="2 2" vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  </g>
                  <circle cx={LOUPE_X} cy={LOUPE_Y} r={LOUPE_R} fill="none" stroke="var(--accent)" strokeWidth="1.2" />
                  <rect
                    x={LOUPE_X - LOUPE_R + 8} y={LOUPE_Y + LOUPE_R - 24}
                    width="30" height="16" rx="8"
                    fill="var(--card-bg)" stroke="var(--border)" strokeWidth="1"
                  />
                  <text
                    x={LOUPE_X - LOUPE_R + 23} y={LOUPE_Y + LOUPE_R - 12}
                    textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)"
                  >
                    ×{LOUPE_ZOOM}
                  </text>
                  <g transform={`translate(${LOUPE_X - LOUPE_R + 8} ${LOUPE_Y + LOUPE_R + 3})`} fontSize="7" fill="var(--muted)" fontFamily="var(--f-mono)">
                    <line x1="0" y1="0" x2="9" y2="0" stroke="var(--muted)" strokeWidth="1" strokeDasharray="2 1" />
                    <text x="12" y="2">{lang === 'zh' ? '外' : 'outer'}</text>
                    <line x1="42" y1="0" x2="51" y2="0" stroke="var(--accent)" strokeWidth="1.5" />
                    <text x="54" y="2">{lang === 'zh' ? '圆' : 'arc'}</text>
                    <line x1="77" y1="0" x2="86" y2="0" stroke="var(--fg)" strokeWidth="1.2" />
                    <text x="89" y="2">{lang === 'zh' ? '内' : 'inner'}</text>
                  </g>
                </g>
              )}

              {/* 圆心 */}
              <circle cx={CX} cy={CY} r="3" fill="var(--fg)" />

            </svg>

            </CanvasSurface>
          </div>

        </div>

        {/* 右列：边数控制 + 三幕 */}
        <div className={`contents lg:block lg:h-full lg:min-h-0 lg:min-w-0 lg:space-y-4 lg:overflow-y-auto`} style={stage === 'predict' ? { display: 'none' } : undefined}>
          <div className="min-w-0 order-2 lg:order-none">
          <ParamDock disabled={stage === 'predict'}
            title={t.paramDock}
            closeLabel={t.paramDockClose}
            anchorRef={canvasRef}
            summary={`${t.nValue(displayN)} · ${f(bounds.lo, 4)}–${f(bounds.hi, 4)}`}
          >
          <div className="border border-[var(--border)] p-4 space-y-3">
            <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {t.readout}</h3>
            <ParamSlider
              label={t.nLabel}
              value={displayN}
              min={3}
              max={192}
              step={1}
              onChange={(v) => applyN(v)}
              onAdjustStart={takeover}
              format={() => t.nValue(displayN)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { const d = nextDouble; if (d !== null) applyN(d); }}
                disabled={nextDouble === null}
                className="inline-flex items-center rounded border border-[var(--fg)] bg-[var(--fg)] px-2.5 py-2 text-[0.6875rem] mono-font text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {nextDouble === null ? t.maxLabel : t.doubleLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  applyN(6);
                  setShowOuter(false);
                  setShowRadii(false);
                  setShowLabels(false);
                }}
                className="inline-flex items-center rounded px-1.5 py-2 text-[0.6875rem] mono-font uppercase text-[var(--muted)] hover:text-[var(--fg)] active:bg-[var(--accent)] active:text-[var(--bg)] transition-colors"
              >
                {t.reset}
              </button>
            </div>
            <details className="text-[0.625rem] mono-font text-[var(--muted)]">
              <summary className="min-h-[24px] cursor-pointer select-none">{t.more}</summary>
              <div className="flex flex-wrap gap-2 pt-1">
                <ToggleSwitch label={t.showOuter} checked={showOuter} onChange={setShowOuter} />
                <ToggleSwitch label={t.showRadii} checked={showRadii} onChange={setShowRadii} />
                <ToggleSwitch label={t.showLabels} checked={showLabels} onChange={setShowLabels} />
              </div>
            </details>
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
                  <p className="text-[0.6875rem] mono-font text-[var(--muted)] tabular-nums">
                    {lang === 'zh' ? '观察记录：' : 'Evidence: '}
                    {observations.filter((ob) => ob.balanced).length} {t.evMatch} / {observations.filter((ob) => !ob.balanced).length} {t.evMiss}
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
