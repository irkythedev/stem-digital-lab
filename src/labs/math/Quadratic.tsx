/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学探究 · 二次函数 y = ax² + bx + c 三幕式探究（人教版 九上第 22 章）
 *
 * 幕 1 预测：给定 y = -2x² + 3，先猜开口方向 / 顶点 / 与 y 轴交点，再揭示图像
 * 幕 2 探索：控制变量卡（a / b / c 各自隔离）+ 钉住曲线对比 + 观察笔记
 * 幕 3 结论：学生总结 a、b、c 各自的作用，对照预测与观察记录
 *
 * 复用组件：CoordPlane（坐标系）、ExploreStage（任务卡+笔记）、ConclusionStage（结论）。
 */
import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import AskAiButton from '../../components/ai/AskAiButton';
import AskQuizButton from '../../components/ai/AskQuizButton';
import { useApp } from '../../lib/app-context';
import ParamSlider from '../../components/lab/ParamSlider';
import CoordPlane, { type CoordCurve, type CoordMarker } from '../../components/lab/CoordPlane';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import Formula from '../../components/ui/Formula';
import StageNav from '../../components/lab/StageNav';

type Stage = 'predict' | 'explore' | 'conclude';

/** 预测题：开口方向 */
type PredictOpen = 'up' | 'down' | null;
/** 预测题：顶点是最高还是最低 */
type PredictVertex = 'max' | 'min' | null;
/** 预测题：与 y 轴交点正负 */
type PredictIntercept = 'pos' | 'neg' | 'zero' | null;

/** 采样一条二次函数曲线：x ∈ [-4, 4]，步长 0.05 */
function sampleQuadratic(a: number, b: number, c: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let x = -4; x <= 4.0001; x += 0.05) {
    pts.push([x, a * x * x + b * x + c]);
  }
  return pts;
}

/** 拉平二次函数表达式为 "y = ax² + bx + c" */
function exprOf(a: number, b: number, c: number): string {
  const parts: string[] = [];
  if (a !== 0) parts.push(a === 1 ? 'x²' : a === -1 ? '-x²' : `${a}x²`);
  if (b !== 0) parts.push(b > 0 ? (parts.length ? `+ ${b}x` : `${b}x`) : `- ${Math.abs(b)}x`);
  if (c !== 0 || parts.length === 0) parts.push(c > 0 ? (parts.length ? `+ ${c}` : `${c}`) : `- ${Math.abs(c)}`);
  if (parts.length === 0) return 'y = 0';
  return `y = ${parts.join(' ')}`;
}

const copy = {
  zh: {
    prompt: '先预测，再自由探索，最后自己下结论。每一步都可以来回调整。',
    params: '参数',
    readout: '当前函数',
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
    predictQ1: '开口朝哪个方向？',
    predictUp: '向上（∪）',
    predictDown: '向下（∩）',
    predictQ2: '顶点是最高点还是最低点？',
    predictMax: '最高点',
    predictMin: '最低点',
    predictQ3: '图像与 y 轴的交点在？',
    predictPos: '正半轴（0 上方）',
    predictNeg: '负半轴（0 下方）',
    predictZero: '正好在原点',
    predictDone: '已记录你的预测',
    predictHint: '三个都猜完，就可以揭示图像',
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
    pinnedEmpty: '（未钉住。钉住后可与当前曲线对比）',
    cards: [
      {
        title: 'a 的魔法（开口）',
        prompt: '固定 b=0、c=0，只改 a：a 从 1 变到 2，图像开口变宽还是变窄？a 变负数呢？',
      },
      {
        title: 'b 的移动（对称轴）',
        prompt: '固定 a=1、c=0，只改 b：b 从 0 变到 2，图像整体往左还是往右移？',
      },
      {
        title: 'c 的平移（上下）',
        prompt: '固定 a=1、b=0，只改 c：c 从 0 变到 3，图像往哪移？',
      },
      {
        title: '自由探索',
        prompt: '任意拖动 a、b、c，钉住几条曲线对比，找找规律。',
      },
    ],
    // 幕3 结论
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，a、b、c 各自起什么作用？',
    concludeSkipHint: '还没在预测幕猜过开口/顶点/交点——建议先回预测幕完成预测，再做结论会更有意义。',
    tipsTitle: '考点速记',
    tips: [
      '二次函数 y=ax²+bx+c：a 决定开口方向（a>0 向上）与宽窄（|a| 越大越窄）。',
      '对称轴 x=-b/2a，顶点 (-b/2a, (4ac-b²)/4a)；c 是与 y 轴交点。',
      '平移规律：y=a(x-h)²+k 中 h 左右平移、k 上下平移（左加右减、上加下减）。',
      '求与 x 轴交点：令 y=0 解一元二次方程；Δ=b²-4ac 判断交点个数。',
      '实际应用：最大面积/利润问题常转化为求顶点纵坐标。',
      '忽略空气阻力且 g 近似恒定时，竖直抛体高度 h(t) = -½gt² + v₀t + h₀，是二次函数。',
      '代数推导（顶点公式配方法）：y=ax²+bx+c = a(x+b/2a)² + (4ac-b²)/4a。由平方项 a(x+b/2a)²≥0（a>0 时）或 ≤0（a<0 时），可知对称轴 x=-b/2a，顶点在对称轴上，且 a>0 有最小值、a<0 有最大值——这是顶点纵坐标的代数依据。',
      '与一元二次方程的关系：y=ax²+bx+c 与 x 轴交点即方程 ax²+bx+c=0 的根。',
    ],
    concludeQ1: 'a 的正负决定：',
    concludeQ1Up: '开口方向（正→向上）',
    concludeQ1Down: '开口方向（负→向下）',
    concludeQ1None: '没有作用',
    concludeQ2: '|a| 越大：',
    concludeQ2Narrow: '开口越窄',
    concludeQ2Wide: '开口越宽',
    concludeQ2None: '无影响',
    concludeQ3: 'b 变化：',
    concludeQ3Shift: '使对称轴左右移动（x=-b/2a）',
    concludeQ3Stretch: '使图像上下伸缩',
    concludeQ3None: '无影响',
    concludeQ4: 'c 决定：',
    concludeQ4Intercept: '与 y 轴交点位置',
    concludeQ4Vertex: '顶点的 x 坐标',
    concludeQ4None: '无影响',
    concludeHint: '选完四个，看看结论和你的观察是否一致',
    feedbackTitle: '反馈',
    feedbackText:
      'a 的正负决定开口方向，|a| 决定开口宽窄，b 使图像左右平移（对称轴 x=-b/2a），c 决定图像与 y 轴的交点 (0, c)。你的观察记录验证了这些规律。',
  },
  en: {
    prompt: 'Predict first, explore freely, then draw your own conclusion. You can move back and forth at any time.',
    params: 'Parameters',
    readout: 'Current function',
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
    predictQ1: 'Which way does it open?',
    predictUp: 'Upward (∪)',
    predictDown: 'Downward (∩)',
    predictQ2: 'Is the vertex a maximum or minimum?',
    predictMax: 'Maximum',
    predictMin: 'Minimum',
    predictQ3: 'Where does the graph cross the y-axis?',
    predictPos: 'Positive side (above 0)',
    predictNeg: 'Negative side (below 0)',
    predictZero: 'Exactly at the origin',
    predictDone: 'Your predictions are recorded',
    predictHint: 'Answer all three to reveal the graph',
    revealLabel: 'Reveal graph →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Drag the sliders or try a card, and note what you see.',
    notePlaceholder: 'Write one sentence: what did you observe?',
    recordLabel: 'Note it',
    clearLabel: 'Clear notes',
    tryLabel: 'Try it',
    pinLabel: 'Pin this curve',
    unpinLabel: 'Unpin',
    pinnedTitle: 'Pinned curves',
    pinnedEmpty: '(nothing pinned — pin curves to compare with the current one)',
    cards: [
      {
        title: 'a: the opening',
        prompt: 'Fix b=0, c=0 and change only a: from 1 to 2, does the parabola get narrower or wider? What if a becomes negative?',
      },
      {
        title: 'b: the axis shift',
        prompt: 'Fix a=1, c=0 and change only b: from 0 to 2, does the graph shift left or right?',
      },
      {
        title: 'c: the vertical slide',
        prompt: 'Fix a=1, b=0 and change only c: from 0 to 3, which way does the graph move?',
      },
      {
        title: 'Free exploration',
        prompt: 'Drag a, b, c freely, pin a few curves and look for the pattern.',
      },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what does each of a, b, c do?',
    concludeSkipHint: "You haven't predicted opening/vertex/intercept yet — go back to the Predict stage first.",
    tipsTitle: 'Key Points',
    tips: [
      'Quadratic y=ax²+bx+c: a decides opening direction (a>0 up) and width (larger |a|, narrower).',
      'Axis of symmetry x=-b/2a; vertex (-b/2a, (4ac-b²)/4a); c is the y-intercept.',
      'Shifts: in y=a(x-h)²+k, h shifts horizontally, k vertically.',
      'x-intercepts: set y=0 and solve; Δ=b²-4ac decides how many.',
      'Applications: max area/profit problems reduce to finding the vertex y.',
      'Ignoring air resistance with approximately constant g, vertical projectile height h(t) = -½gt² + v₀t + h₀ is quadratic.',
      'Algebraic derivation (completing the square): y=ax²+bx+c = a(x+b/2a)² + (4ac-b²)/4a. Since a(x+b/2a)²≥0 (a>0) or ≤0 (a<0), the axis is x=-b/2a, the vertex lies on it, and a>0 gives a minimum / a<0 a maximum — the algebraic basis for the vertex y-coordinate.',
      'A graph x-intercept is a root of the equation ax²+bx+c=0.',
    ],
    concludeQ1: 'The sign of a decides:',
    concludeQ1Up: 'opening direction (positive → up)',
    concludeQ1Down: 'opening direction (negative → down)',
    concludeQ1None: 'nothing',
    concludeQ2: 'Larger |a| makes the parabola:',
    concludeQ2Narrow: 'narrower',
    concludeQ2Wide: 'wider',
    concludeQ2None: 'no effect',
    concludeQ3: 'Changing b shifts the graph:',
    concludeQ3Shift: 'left/right (the axis moves)',
    concludeQ3Stretch: 'up/down stretch',
    concludeQ3None: 'no effect',
    concludeQ4: 'c decides:',
    concludeQ4Intercept: 'the y-intercept (0, c)',
    concludeQ4Vertex: 'the x-coordinate of the vertex',
    concludeQ4None: 'no effect',
    concludeHint: 'Answer all four, then see if your conclusion matches your observations',
    feedbackTitle: 'Feedback',
    feedbackText:
      'The sign of a decides the opening direction, |a| decides the width, b shifts the graph horizontally (axis x=-b/2a), and c sets the y-intercept (0, c). Your observations confirm these rules.',
  },
};

/** 预测目标函数：y = -2x² + 3（开口向下、最高点、y 轴正半轴） */
const TARGET_A = -2;
const TARGET_B = 0;
const TARGET_C = 3;

/** 顶点式平移动画演示步骤：y=(x-h)²+k 展开为 y=ax²+bx+c（a=1, b=-2h, c=h²+k）。
 *  按教材「配方法 → 顶点式」思路：先右移 h，再上移 k，曲线用已有插值动画平滑变形 + 顶点/对称轴实时跟随。 */
const TRANSLATE_STEPS: { a: number; b: number; c: number; zh: string; en: string }[] = [
  { a: 1, b: 0, c: 0, zh: 'y = x²（基准）', en: 'y = x² (base)' },
  { a: 1, b: -2, c: 1, zh: 'y = (x−1)² 右移 1', en: 'y = (x−1)² right 1' },
  { a: 1, b: -2, c: 3, zh: 'y = (x−1)²+2 再上移 2', en: 'y = (x−1)²+2 up 2' },
];

export default function Quadratic() {
  const { lang } = useApp();
  const t = copy[lang];

  const [stage, setStage] = useState<Stage>('predict');
  // 预测幕：暂存对目标函数的三个猜测；全部回答后揭示图像
  const [predOpen, setPredOpen] = useState<PredictOpen>(null);
  const [predVertex, setPredVertex] = useState<PredictVertex>(null);
  const [predIntercept, setPredIntercept] = useState<PredictIntercept>(null);
  const [revealed, setRevealed] = useState(false);
  // 探索幕：当前参数（初始 = 预测目标函数 y=-2x²+3，揭示后所见即所测）+ 钉住曲线 + 观察记录
  const [a, setA] = useState(TARGET_A);
  const [b, setB] = useState(TARGET_B);
  const [c, setC] = useState(TARGET_C);
  const [pinned, setPinned] = useState<{ id: number; a: number; b: number; c: number }[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  // 结论幕：四组结论（a 正负 / |a| / b / c 的作用），全部选完才算完成
  const [conclusion, setConclusion] = useState<{
    q1: 'up' | 'down' | 'none' | null;
    q2: 'narrow' | 'wide' | 'none' | null;
    q3: 'shift' | 'stretch' | 'none' | null;
    q4: 'intercept' | 'vertex' | 'none' | null;
  }>({ q1: null, q2: null, q3: null, q4: null });

  const correctKeys = { q1: 'up', q2: 'narrow', q3: 'shift', q4: 'intercept' } as const;
  const conclusionComplete =
    conclusion.q1 !== null && conclusion.q2 !== null && conclusion.q3 !== null && conclusion.q4 !== null;

  const predComplete = predOpen !== null && predVertex !== null && predIntercept !== null;

  const currentCurve: CoordCurve = useMemo(
    () => ({
      id: 'main',
      points: sampleQuadratic(a, b, c),
      label: exprOf(a, b, c),
    }),
    [a, b, c],
  );

  const pinnedCurves: CoordCurve[] = pinned.map((p) => ({
    id: `pin${p.id}`,
    points: sampleQuadratic(p.a, p.b, p.c),
    dashed: true,
    label: exprOf(p.a, p.b, p.c),
  }));

  const curves = [currentCurve, ...pinnedCurves];

  // Manim 式标注：对称轴虚线 + 顶点（随 a/b/c 实时移动）；a = 0 退化为直线时不标
  const markers = useMemo<CoordMarker[]>(() => {
    if (Math.abs(a) < 1e-9) return [];
    const r1 = (v: number) => Math.round(v * 10) / 10;
    const h = -b / (2 * a);
    const k = a * h * h + b * h + c;
    return [
      { key: 'axis', vline: { x: h, label: `x=${r1(h)}`, color: 'var(--accent)' } },
      { key: 'vertex', dot: { x: h, y: k, label: `(${r1(h)}, ${r1(k)})`, color: 'var(--accent)' } },
    ];
  }, [a, b, c]);

  const reset = () => {
    setA(TARGET_A);
    setB(TARGET_B);
    setC(TARGET_C);
  };

  const redoAll = () => {
    setStage('predict');
    setPredOpen(null);
    setPredVertex(null);
    setPredIntercept(null);
    setRevealed(false);
    reset();
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
          { label: 'a', value: String(a) },
          { label: 'b', value: String(b) },
          { label: 'c', value: String(c) },
          { label: 'f(x)', value: exprOf(a, b, c) },
        ],
        note,
      },
    ]);
  };

  const cards: ExploreCard[] = [
    {
      key: 'card-a',
      title: t.cards[0].title,
      prompt: t.cards[0].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setA(2);
        setB(0);
        setC(0);
      },
    },
    {
      key: 'card-b',
      title: t.cards[1].title,
      prompt: t.cards[1].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setA(1);
        setB(2);
        setC(0);
      },
    },
    {
      key: 'card-c',
      title: t.cards[2].title,
      prompt: t.cards[2].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setA(1);
        setB(0);
        setC(3);
      },
    },
    {
      key: 'card-free',
      title: t.cards[3].title,
      prompt: t.cards[3].prompt,
      tryLabel: t.tryLabel,
      tryIt: reset,
    },
  ];

  const isPinned = pinned.some((p) => p.a === a && p.b === b && p.c === c);

  const stageOrder: Stage[] = ['predict', 'explore', 'conclude'];
  const stageIdx = stageOrder.indexOf(stage);

  const targetCurve: CoordCurve = {
    id: 'target',
    points: sampleQuadratic(TARGET_A, TARGET_B, TARGET_C),
    label: exprOf(TARGET_A, TARGET_B, TARGET_C),
  };

  return (
    <div className="flex flex-col space-y-6">

      <div className="flex justify-center py-2">
        <Formula tex="y = ax^2 + bx + c" block className="text-lg" />
      </div>

      {/* 幕导航 */}
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
      {/* AI 工具行：问 AI + 考考你 并排 */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <AskAiButton question={lang === 'zh' ? '请讲解二次函数 y=ax²+bx+c 中 a、b、c 三个参数分别对抛物线有什么影响' : 'Explain how a, b, c in y=ax²+bx+c affect the parabola'} />
        <AskQuizButton />
      </div>


      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        {/* 左列：坐标系（预测幕未揭示时隐藏）+ 读数 */}
        <div className="flex flex-col space-y-6">
          {stage === 'predict' && !revealed ? (
            <div className="border border-[var(--border)] p-6 flex flex-col items-center justify-center min-h-[240px] gap-2">
              <p className="text-[0.6875rem] mono-font uppercase tracking-widest text-[var(--muted)]">
                {t.predictTitle}
              </p>
              <p className="text-sm serif-font text-[var(--fg)]">
                {t.predictQuestion} <Formula tex={`y = ${TARGET_A}x^2 + ${TARGET_C}`} />
              </p>
              <p className="text-xs text-[var(--muted)] serif-font italic">{t.predictQuestion2}</p>
            </div>
          ) : (
            <CoordPlane curves={curves} markers={markers} xMin={-4} xMax={4} ariaLabel={`y = ax² + bx + c graph`} xLabel="x" yLabel="y" />
          )}

          <div className="border border-[var(--border)] p-4">
            <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-2">
              // {t.readout}
            </h3>
            <p className="text-sm mono-font text-[var(--fg)]">{exprOf(a, b, c)}</p>
            </div>

            {/* 顶点式平移动画（Manim 式：逐步平移，不自动播放；曲线平滑变形 + 顶点/对称轴实时跟随） */}
            <div className="border border-[var(--border)] p-3">
            <div className="text-[0.6875rem] mono-font uppercase tracking-widest text-[var(--muted)] mb-2">
              {lang === 'zh' ? '// 顶点式平移' : '// Vertex translation'}
            </div>
            <div className="flex flex-wrap gap-2">
              {TRANSLATE_STEPS.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setA(s.a);
                    setB(s.b);
                    setC(s.c);
                  }}
                  className={`px-2.5 py-1.5 text-xs mono-font border transition-colors ${
                    a === s.a && b === s.b && c === s.c
                      ? 'border-[var(--fg)] text-[var(--fg)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
                  }`}
                >
                  {lang === 'zh' ? s.zh : s.en}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[0.6875rem] mono-font text-[var(--muted)]">
              {lang === 'zh'
                ? '依次点击，观察抛物线如何平移：对称轴 x=h、顶点 (h,k) 跟着走，这正是配方法→顶点式的直观过程'
                : 'Click through to watch the parabola translate: the axis x=h and vertex (h,k) follow — the picture behind completing the square'}
            </p>
            </div>
        </div>

        {/* 右列：参数 + 三幕 */}
        <div className="flex flex-col space-y-6">
          <div className="border border-[var(--border)] p-4 space-y-4">
            <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
              // {t.params}
            </h3>
            <ParamSlider label="a" value={a} min={-5} max={5} step={0.1} onChange={setA} format={(v) => v.toFixed(1)} />
            <ParamSlider label="b" value={b} min={-6} max={6} step={0.1} onChange={setB} format={(v) => v.toFixed(1)} />
            <ParamSlider label="c" value={c} min={-6} max={6} step={0.1} onChange={setC} format={(v) => v.toFixed(1)} />
            <button
              type="button"
              onClick={reset}
              className="text-xs mono-font uppercase underline text-[var(--muted)] hover:text-[var(--fg)]"
            >
              {t.reset}
            </button>
          </div>

          {/* 幕1 预测 */}
          {stage === 'predict' && (
            <div className="border border-[var(--border)] p-4 space-y-4">
              <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                // {t.predictTitle}
              </h3>
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
                {t.predictQuestion} <Formula tex={`y = ${TARGET_A}x^2 + ${TARGET_C}`} />
              </p>

              {/* 开口方向 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.predictQ1}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      ['up', t.predictUp],
                      ['down', t.predictDown],
                    ] as [PredictOpen, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPredOpen(v)}
                      className={`text-center text-xs px-3 py-2 border rounded-lg transition-colors whitespace-nowrap ${
                        predOpen === v ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 顶点 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.predictQ2}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      ['max', t.predictMax],
                      ['min', t.predictMin],
                    ] as [PredictVertex, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPredVertex(v)}
                      className={`text-center text-xs px-3 py-2 border rounded-lg transition-colors whitespace-nowrap ${
                        predVertex === v ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 与 y 轴交点 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.predictQ3}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['pos', t.predictPos],
                      ['neg', t.predictNeg],
                      ['zero', t.predictZero],
                    ] as [PredictIntercept, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPredIntercept(v)}
                      className={`text-center text-xs px-3 py-2 border rounded-lg transition-colors whitespace-nowrap ${
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
                  className="text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors"
                >
                  ✓ {t.predictDone} — {t.revealLabel}
                </button>
              ) : (
                <p className="text-xs text-[var(--muted)] serif-font italic">{t.predictHint}</p>
              )}
            </div>
          )}

          {/* 幕2 探索 */}
          {stage === 'explore' && (
            <div className="space-y-6">
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
              />

              {/* 钉住曲线对比 */}
              <div className="border border-[var(--border)] p-4 space-y-3">
                <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                  // {t.pinnedTitle}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    if (isPinned) {
                      setPinned((prev) => prev.filter((p) => !(p.a === a && p.b === b && p.c === c)));
                    } else {
                      setPinned((prev) => [...prev, { id: prev.length + 1, a, b, c }]);
                    }
                  }}
                  className={`text-xs mono-font px-2 py-1 border transition-colors ${
                    isPinned
                      ? 'border-[var(--muted)] text-[var(--muted)]'
                      : 'border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)]'
                  }`}
                >
                  {isPinned ? t.unpinLabel : t.pinLabel}
                </button>
                {pinned.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] serif-font italic">{t.pinnedEmpty}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {pinned.map((p) => (
                      <span key={p.id} className="text-[0.6875rem] mono-font px-1.5 py-0.5 border border-[var(--border)] text-[var(--muted)]">
                        {exprOf(p.a, p.b, p.c)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 幕3 结论（四组选择） */}
          {stage === 'conclude' && (
            <div className="border border-[var(--border)] p-4 space-y-4">
              <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                // {t.concludeTitle}
              </h3>
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
                      ['up', t.concludeQ1Up],
                      ['down', t.concludeQ1Down],
                      ['none', t.concludeQ1None],
                    ] as ['up' | 'down' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q1 === v;
                    const correct = correctKeys.q1 === v;
                    const showFeedback = conclusion.q1 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q1: v }))}
                        className={`text-center text-xs px-2.5 py-2 border rounded-lg transition-colors whitespace-nowrap ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                              : 'border-[var(--error)] text-[var(--error)]'
                            : showFeedback && correct
                              ? 'border-[var(--muted)] text-[var(--muted)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {selected && (correct ? '✓ ' : '✗ ')}
                        {showFeedback && !selected && correct && '✓ '}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q2: |a| */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ2}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['narrow', t.concludeQ2Narrow],
                      ['wide', t.concludeQ2Wide],
                      ['none', t.concludeQ2None],
                    ] as ['narrow' | 'wide' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q2 === v;
                    const correct = correctKeys.q2 === v;
                    const showFeedback = conclusion.q2 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q2: v }))}
                        className={`text-center text-xs px-2.5 py-2 border rounded-lg transition-colors whitespace-nowrap ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                              : 'border-[var(--error)] text-[var(--error)]'
                            : showFeedback && correct
                              ? 'border-[var(--muted)] text-[var(--muted)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {selected && (correct ? '✓ ' : '✗ ')}
                        {showFeedback && !selected && correct && '✓ '}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q3: b */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ3}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['shift', t.concludeQ3Shift],
                      ['stretch', t.concludeQ3Stretch],
                      ['none', t.concludeQ3None],
                    ] as ['shift' | 'stretch' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q3 === v;
                    const correct = correctKeys.q3 === v;
                    const showFeedback = conclusion.q3 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q3: v }))}
                        className={`text-center text-xs px-2.5 py-2 border rounded-lg transition-colors whitespace-nowrap ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                              : 'border-[var(--error)] text-[var(--error)]'
                            : showFeedback && correct
                              ? 'border-[var(--muted)] text-[var(--muted)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {selected && (correct ? '✓ ' : '✗ ')}
                        {showFeedback && !selected && correct && '✓ '}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q4: c */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ4}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['intercept', t.concludeQ4Intercept],
                      ['vertex', t.concludeQ4Vertex],
                      ['none', t.concludeQ4None],
                    ] as ['intercept' | 'vertex' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q4 === v;
                    const correct = correctKeys.q4 === v;
                    const showFeedback = conclusion.q4 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q4: v }))}
                        className={`text-center text-xs px-2.5 py-2 border rounded-lg transition-colors whitespace-nowrap ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                              : 'border-[var(--error)] text-[var(--error)]'
                            : showFeedback && correct
                              ? 'border-[var(--muted)] text-[var(--muted)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {selected && (correct ? '✓ ' : '✗ ')}
                        {showFeedback && !selected && correct && '✓ '}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {conclusionComplete ? (
                <p className="text-xs mono-font text-[var(--fg)]">✓ {t.concludeHint}</p>
              ) : (
                <p className="text-xs text-[var(--muted)] serif-font italic">{t.concludeHint}</p>
              )}
            </div>
          )}

          {/* 完成态 */}
          {stage === 'conclude' && conclusionComplete && (
            <div className="border border-[var(--fg)] p-4 space-y-2">
              <p className="text-sm font-bold mono-font text-[var(--fg)]">✓ {t.stageDone}</p>
              <p className="text-xs text-[var(--muted)] serif-font leading-relaxed">{t.feedbackText}</p>
              <button
                type="button"
                onClick={redoAll}
                className="group inline-flex items-center gap-1.5 text-xs mono-font uppercase text-[var(--fg)] hover:opacity-70"
              >
                <RotateCcw className="w-3.5 h-3.5 opacity-70 group-hover:rotate-[-45deg] transition-transform duration-200" />
                <span>{t.redoLabel}</span>
              </button>
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
  );
}
