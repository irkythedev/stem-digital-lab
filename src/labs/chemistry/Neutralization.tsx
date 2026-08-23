/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学实验 · 酸碱中和反应 pH 滴定三幕式探究（人教版 九下第十单元）
 *
 * 幕 1 预测：向 20mL 盐酸（0.1M）中逐滴加入 NaOH，猜 pH 变化趋势与恰好中和点
 * 幕 2 探索：控制变量卡（滴入量 / 酸浓度 / 指示剂 / 自由）+ 钉住 pH 曲线 + 观察笔记
 * 幕 3 结论：pH 变化规律、恰好中和时 pH=7、过量后 pH 继续变化
 *
 * 物理模型：强酸强碱滴定的简化浓度模型（HCl + NaOH），
 * 对等量点附近作视觉突跃处理；恰好中和时 pH≈7。
 * 视觉用烧杯液面颜色随 pH 渐变（石蕊/酚酞示意）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import AskAiButton from '../../components/ai/AskAiButton';
import { useApp } from '../../lib/app-context';
import ParamSlider from '../../components/lab/ParamSlider';
import CoordPlane, { type CoordCurve } from '../../components/lab/CoordPlane';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import Formula from '../../components/ui/Formula';

type Stage = 'predict' | 'explore' | 'conclude';

/** 预测题：pH 变化趋势 */
type PredictTrend = 'slow-fast' | 'linear' | 'flat' | 'up' | null;

/**
 * 计算滴定 pH：向 V0=20mL 浓度为 acidM 的 HCl 中滴入体积 v 的 NaOH（0.1M）。
 * 强酸强碱中和，简化模型：
 *  - 中和前：pH = -log10(剩余酸浓度)
 *  - 恰好中和（v = V0 * acidM / 0.1）：pH = 7
 *  - 过量：pH = 14 + log10(过量碱浓度)
 */
function phAt(acidM: number, v: number): number {
  const v0 = 20;
  const baseM = 0.1;
  const acidMol = acidM * v0; // 酸的毫摩尔
  const baseMol = baseM * v; // 加入碱的毫摩尔
  const total = v0 + v;
  if (baseMol < acidMol) {
    const h = (acidMol - baseMol) / total;
    return Math.max(0, -Math.log10(h));
  }
  if (Math.abs(baseMol - acidMol) < 1e-9) return 7;
  const oh = (baseMol - acidMol) / total;
  return Math.min(14, 14 + Math.log10(oh));
}

/** 采样 pH-滴入体积曲线：v ∈ [0, 40]，步长 0.2 */
function sampleTitration(acidM: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let v = 0; v <= 40.0001; v += 0.2) {
    pts.push([v, phAt(acidM, v)]);
  }
  return pts;
}

/** 中和点体积 */
function eqVolume(acidM: number): number {
  return (acidM * 20) / 0.1;
}

/** 液面高度 rAF 平滑插值（CSS 不支持 transition d 属性，用 JS 插值替代） */
function useLiquidY(target: number): number {
  const [y, setY] = useState(target);
  const rafRef = useRef<number>(0);
  const prevRef = useRef(target);

  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    prevRef.current = target;
    if (from === to) return;
    const start = performance.now();
    const dur = 300;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      setY(Math.round(from + (to - from) * e));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return y;
}

/** pH → 指示剂颜色（石蕊：红 → 蓝；简化 RGB 插值） */
function phColor(pH: number): string {
  const clamped = Math.max(0, Math.min(14, pH));
  // 从红 (235,85,85) 经紫 (170,105,170) 到蓝 (95,120,215)——加亮版，暗色主题下仍清晰
  const t = clamped / 14;
  const r = Math.round(235 - 140 * t);
  const g = Math.round(85 + 35 * t);
  const b = Math.round(85 + 130 * t);
  return `rgb(${r}, ${g}, ${b})`;
}

const copy = {
  zh: {
    prompt: '先预测，再自由探索，最后自己下结论。每一步都可以来回调整。',
    params: '参数',
    readout: '读数',
    reset: '重置',
    flaskLabel: '反应烧杯',
    stagePredict: '预测',
    stageExplore: '探索',
    stageConclude: '结论',
    stageDone: '完成',
    nextStage: '下一步 →',
    redoLabel: '再次实验',
    // 幕1 预测
    predictTitle: '预测',
    predictQuestion: '向 20mL 稀盐酸中逐滴加入氢氧化钠溶液，猜 pH 变化趋势与恰好中和点。',
    predictQuestion2: '先别急着看曲线，猜一猜：',
    predictQ1: 'pH 随滴入体积怎么变化？',
    predictSlowFast: '先缓慢后剧烈变化',
    predictLinear: '均匀线性变化',
    predictFlat: '几乎不变',
    predictUp: '一直上升',
    predictDone: '已记录你的预测',
    predictHint: '猜完，就可以揭示图像',
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
    pinnedEmpty: '（未钉住。钉住不同浓度的曲线，看突跃段变化）',
    cards: [
      {
        title: '滴入过程',
        prompt: '保持酸为稀盐酸，把滴入体积从 0 调到 40mL。pH 曲线长什么样？陡降段在哪？',
      },
      {
        title: '酸的浓度',
        prompt: '把酸从稀盐酸调成浓盐酸：曲线突跃段更陡还是更缓？中和点位置变了吗？',
      },
      {
        title: '恰好中和',
        prompt: '把滴入体积调到恰好中和点（稀盐酸时是 20mL），看 pH 是不是 7？',
      },
      {
        title: '自由探索',
        prompt: '任意调滴入量和浓度，钉住几条曲线对比，找找规律。',
      },
    ],
    // 幕3 结论
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，酸碱中和的规律是什么？',
    concludeSkipHint: '还没在预测幕猜过 pH 变化趋势——建议先回预测幕完成预测，再做结论会更有意义。',
    tipsTitle: '考点速记',
    tips: [
      '本实验采用强酸 HCl 与强碱 NaOH：H⁺ + OH⁻ → H₂O，等量点 pH≈7（中性）。',
      'pH 滴定曲线呈 S 形：中和前平缓、接近中和点剧烈突跃、过量后平缓。',
      '酸浓度越大，突跃越陡，所需碱液体积越大（恰好中和点右移）。',
      '酚酞变色范围约 8.2–10.0：碱性溶液呈粉红至红色，中性/酸性溶液无色。',
      '判断过量：中和后继续加碱 pH 升、加酸 pH 降，可用指示剂验证。',
    ],
    concludeQ1: 'pH 曲线的形状：',
    concludeQ1S: 'S 形（先平缓后陡降再平缓）',
    concludeQ1L: '直线',
    concludeQ1None: '无规律',
    concludeQ2: '恰好中和时：',
    concludeQ2Ph7: 'pH = 7（中性）',
    concludeQ2Ph0: 'pH = 0',
    concludeQ2None: '不会发生',
    concludeQ3: '酸的浓度越大：',
    concludeQ3Steep: '突跃段越陡，中和点体积越大',
    concludeQ3Mild: '突跃段越缓，中和点体积越小',
    concludeQ3None: '无影响',
    concludeQ4: '碱过量后：',
    concludeQ4Basic: 'pH 继续上升，溶液显碱性',
    concludeQ4Acid: 'pH 回落，溶液显酸性',
    concludeQ4None: '保持中性',
    concludeHint: '选完四个，看看结论和你的观察是否一致',
    feedbackText:
      '酸碱中和：H⁺ + OH⁻ → H₂O。pH 滴定曲线呈 S 形——中和前平缓下降、接近中和点时剧烈突跃、过量后平缓上升；' +
      '恰好中和时 pH=7；酸浓度越大突跃越陡、所需碱液越多。',
  },
  en: {
    prompt: 'Predict first, explore freely, then draw your own conclusion. You can move back and forth at any time.',
    params: 'Parameters',
    readout: 'Readings',
    reset: 'Reset',
    flaskLabel: 'Reaction flask',
    stagePredict: 'Predict',
    stageExplore: 'Explore',
    stageConclude: 'Conclude',
    stageDone: 'Done',
    nextStage: 'Next →',
    redoLabel: 'Redo',
    predictTitle: 'Predict',
    predictQuestion: 'Drip sodium hydroxide into 20mL of dilute hydrochloric acid. Predict the pH trend and the equivalence point.',
    predictQuestion2: 'Before seeing the curve, guess:',
    predictQ1: 'How does pH change with the volume added?',
    predictSlowFast: 'Slowly, then sharply',
    predictLinear: 'Uniformly (linear)',
    predictFlat: 'Almost unchanged',
    predictUp: 'Rises all the way',
    predictDone: 'Your prediction is recorded',
    predictHint: 'Answer to reveal the curve',
    revealLabel: 'Reveal curve →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Drag the sliders or try a card, and note what you see.',
    notePlaceholder: 'Write one sentence: what did you observe?',
    recordLabel: 'Note it',
    clearLabel: 'Clear notes',
    tryLabel: 'Try it',
    pinLabel: 'Pin this curve',
    unpinLabel: 'Unpin',
    pinnedTitle: 'Pinned curves',
    pinnedEmpty: '(nothing pinned — pin curves of different concentrations and watch the jump)',
    cards: [
      {
        title: 'The titration',
        prompt: 'Keep the acid dilute and raise the volume from 0 to 40mL. What does the pH curve look like? Where is the sharp drop?',
      },
      {
        title: 'Acid concentration',
        prompt: 'Raise the acid from dilute to concentrated: does the jump get steeper or milder? Does the equivalence point move?',
      },
      {
        title: 'At equivalence',
        prompt: 'Set the volume to the equivalence point (20mL for dilute acid). Is pH exactly 7?',
      },
      {
        title: 'Free exploration',
        prompt: 'Adjust volume and concentration freely, pin a few curves and look for the pattern.',
      },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what is the pattern of acid-base neutralization?',
    concludeSkipHint: "You haven't predicted the pH trend yet — go back to the Predict stage first.",
    tipsTitle: 'Key Points',
    tips: [
      'This experiment uses strong acid HCl and strong base NaOH: H⁺ + OH⁻ → H₂O; the equivalence point is approximately pH 7 (neutral).',
      'The titration curve is S-shaped: gentle before, sharp jump near equivalence, gentle after.',
      'A more concentrated acid gives a steeper jump and needs more base (equivalence shifts right).',
      'Phenolphthalein changes around pH 8.2–10.0: pink to red in basic solution, colorless in neutral or acidic solution.',
      'After equivalence, extra base raises pH and extra acid lowers it — check with an indicator.',
    ],
    concludeQ1: 'The pH curve looks like:',
    concludeQ1S: 'an S-shape (flat, sharp drop, flat again)',
    concludeQ1L: 'a straight line',
    concludeQ1None: 'no pattern',
    concludeQ2: 'At exact neutralization:',
    concludeQ2Ph7: 'pH = 7 (neutral)',
    concludeQ2Ph0: 'pH = 0',
    concludeQ2None: 'it never happens',
    concludeQ3: 'With a more concentrated acid:',
    concludeQ3Steep: 'the jump is steeper and the equivalence volume is larger',
    concludeQ3Mild: 'the jump is milder and the equivalence volume is smaller',
    concludeQ3None: 'no effect',
    concludeQ4: 'After adding excess base:',
    concludeQ4Basic: 'pH keeps rising — the solution is basic',
    concludeQ4Acid: 'pH falls back — the solution is acidic',
    concludeQ4None: 'stays neutral',
    concludeHint: 'Answer all four, then see if your conclusion matches your observations',
    feedbackText:
      'Neutralization: H⁺ + OH⁻ → H₂O. The titration curve is S-shaped — gentle before the equivalence point, a sharp jump near it, and gentle again after; ' +
      'pH = 7 at exact neutralization; a more concentrated acid gives a steeper jump and needs more base.',
  },
};

/** 预测目标：酸浓度 0.1M */
const TARGET_ACID = 0.1;

export default function Neutralization() {
  const { lang } = useApp();
  const t = copy[lang];

  const [stage, setStage] = useState<Stage>('predict');
  const [predTrend, setPredTrend] = useState<PredictTrend>(null);
  const [revealed, setRevealed] = useState(false);
  const [volume, setVolume] = useState(0);
  const [acidM, setAcidM] = useState(TARGET_ACID);
  const [pinned, setPinned] = useState<{ id: number; acidM: number }[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [conclusion, setConclusion] = useState<{
    q1: 's' | 'l' | 'none' | null;
    q2: 'ph7' | 'ph0' | 'none' | null;
    q3: 'steep' | 'mild' | 'none' | null;
    q4: 'basic' | 'acid' | 'none' | null;
  }>({ q1: null, q2: null, q3: null, q4: null });

  const correctKeys = { q1: 's', q2: 'ph7', q3: 'steep', q4: 'basic' } as const;
  const conclusionComplete =
    conclusion.q1 !== null && conclusion.q2 !== null && conclusion.q3 !== null && conclusion.q4 !== null;
  const predComplete = predTrend !== null;

  const ph = phAt(acidM, volume);
  const eqV = eqVolume(acidM);
  /** 烧杯液面 y：滴入 0mL → 104（低液位），40mL → 68（接近满），用 rAF 平滑插值 */
  const liquidY = useLiquidY(Math.round(104 - (Math.min(volume, 40) / 40) * 36));

  const currentCurve: CoordCurve = useMemo(
    () => ({
      id: 'main',
      points: sampleTitration(acidM),
      label: `酸 ${(acidM / 0.1).toFixed(1)}×`,
    }),
    [acidM],
  );

  const pinnedCurves: CoordCurve[] = pinned.map((p) => ({
    id: `pin${p.id}`,
    points: sampleTitration(p.acidM),
    dashed: true,
    label: `酸 ${(p.acidM / 0.1).toFixed(1)}×`,
  }));

  const curves = [currentCurve, ...pinnedCurves];

  const reset = () => {
    setVolume(0);
    setAcidM(TARGET_ACID);
  };

  const redoAll = () => {
    setStage('predict');
    setPredTrend(null);
    setRevealed(false);
    setVolume(0);
    setAcidM(TARGET_ACID);
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
          { label: 'V', value: `${volume.toFixed(1)}mL` },
          { label: '酸', value: `${(acidM / 0.1).toFixed(1)}×` },
          { label: 'pH', value: ph.toFixed(2) },
        ],
        note,
      },
    ]);
  };

  const cards: ExploreCard[] = [
    {
      key: 'card-titrate',
      title: t.cards[0].title,
      prompt: t.cards[0].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setAcidM(0.1);
        setVolume(30);
      },
    },
    {
      key: 'card-conc',
      title: t.cards[1].title,
      prompt: t.cards[1].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setAcidM(1);
        setVolume(0);
      },
    },
    {
      key: 'card-eq',
      title: t.cards[2].title,
      prompt: t.cards[2].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setAcidM(0.1);
        setVolume(20);
      },
    },
    {
      key: 'card-free',
      title: t.cards[3].title,
      prompt: t.cards[3].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setAcidM(0.5);
        setVolume(15);
      },
    },
  ];

  const isPinned = pinned.some((p) => p.acidM === acidM);

  const stageOrder: Stage[] = ['predict', 'explore', 'conclude'];
  const stageIdx = stageOrder.indexOf(stage);

  return (
    <div className="flex flex-col space-y-6">

      <div className="flex justify-center py-2">
        <Formula tex="\mathrm{H^+} + \mathrm{OH^-} \rightarrow \mathrm{H_2O}" block className="text-lg" />
      </div>

      {/* 幕导航 */}
      <div className="flex items-center gap-2 text-[11px] mono-font uppercase tracking-widest text-[var(--muted)]">
        {stageOrder.map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            <button
              type="button"
              onClick={() => setStage(s)}
              className={`transition-colors ${stage === s ? 'font-bold text-[var(--fg)]' : 'hover:text-[var(--fg)]'}`}
            >
              {s === 'predict' && t.stagePredict}
              {s === 'explore' && t.stageExplore}
              {s === 'conclude' && t.stageConclude}
            </button>
          </span>
        ))}
        <span className="ml-auto">
          {stageIdx < 2 ? (
            <button
              type="button"
              onClick={() => setStage(stageOrder[stageIdx + 1])}
              className="underline text-[var(--fg)] hover:opacity-70"
            >
              {t.nextStage}
            </button>
          ) : (
            <button
              type="button"
              onClick={redoAll}
              className="underline text-[var(--muted)] hover:text-[var(--fg)]"
            >
              {t.redoLabel} ↻
        </button>
          )}
        </span>
      </div>
      {/* 问 AI：讲解本实验的原理与操作要点 */}
      <AskAiButton className="mt-2" question={lang === 'zh' ? '请讲解酸碱中和反应的实质，以及滴定实验为什么在终点时 pH 会突跃' : 'Explain the essence of neutralization and why pH jumps at the titration endpoint'} />


      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        {/* 左列：烧杯 + pH 曲线 + 读数 */}
        <div className="flex flex-col space-y-6">
          {/* 烧杯 SVG：液面颜色随 pH 渐变 */}
          <div className="border border-[var(--border)] p-4">
            <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-2">
              // {t.flaskLabel}
            </h3>
            <svg viewBox="0 0 220 200" className="w-full h-auto max-h-[320px]" role="img" aria-label={t.flaskLabel} strokeLinecap="round" strokeLinejoin="round">
              {/* 液面高度随滴入体积上升：0mL→y=104，40mL→y=68（线性） */}
              {/* 烧杯壁（平底） */}
              <path d="M40 30 H180 V170 H40 Z" fill="none" stroke="var(--fg)" strokeWidth="1.2" />
              {/* 液面（颜色随 pH，高度随体积） */}
              <path
                d={`M44 ${liquidY} H176 V170 H44 Z`}
                fill={phColor(ph)}
                style={{ transition: 'fill 0.4s ease', opacity: 'var(--liquid-opacity, 0.35)' }}
              />
              {/* 液面刻度线（用 transform translateY 替代 y1/y2 过渡——SVG 几何属性不可 CSS 过渡） */}
              <line
                x1="44"
                y1="0"
                x2="176"
                y2="0"
                stroke={phColor(ph)}
                strokeWidth="1.5"
                style={{
                  transform: `translateY(${liquidY}px)`,
                  transformBox: 'view-box',
                  transition: 'transform 0.4s ease-out, stroke 0.4s ease',
                }}
              />
              {/* 滴管：胶头（橡胶乳头）+ 管身 + 尖嘴 */}
              <path d="M104 14 Q110 8 116 14 L116 20 L104 20 Z" fill="var(--fg)" opacity="0.3" />
              <line x1="110" y1="20" x2="110" y2="44" stroke="var(--fg)" strokeWidth="1.5" />
              <path d="M108 44 L112 44 L110 50 Z" fill="var(--fg)" />
              {/* 液滴：从滴管口下落（CSS 动画，无限循环，随滴入体积变化节奏） */}
              {volume > 0 && (
                <circle
                  className="titration-drop"
                  cx="110"
                  cy="46"
                  r="2.6"
                  fill={phColor(Math.min(14, ph + 1))}
                  opacity="0.9"
                />
              )}
              {/* pH 读数 */}
              <text x="110" y="196" textAnchor="middle" fontSize="12" fill="var(--fg)" fontFamily="var(--f-mono)">
                pH = {ph.toFixed(2)}
              </text>
              {/* 滴入体积 */}
              <text x="110" y="18" textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">
                + {volume.toFixed(1)} mL NaOH
              </text>
            </svg>
          </div>

          {/* pH-滴入体积曲线（预测幕未揭示时隐藏） */}
          {stage === 'predict' && !revealed ? (
            <div className="border border-[var(--border)] p-6 flex flex-col items-center justify-center min-h-[240px] gap-2">
              <p className="text-[11px] mono-font uppercase tracking-widest text-[var(--muted)]">
                {t.predictTitle}
              </p>
              <p className="text-sm serif-font text-[var(--fg)]">{t.predictQuestion}</p>
              <p className="text-xs text-[var(--muted)] serif-font italic">{t.predictQuestion2}</p>
            </div>
          ) : (
            <CoordPlane
              curves={curves}
              xMin={0}
              xMax={40}
              yMin={0}
              yMax={14}
              ariaLabel={`pH vs volume graph`}
              xLabel="V / mL"
              yLabel="pH"
            />
          )}

          {/* 读数 */}
          <div className="border border-[var(--border)] p-4">
            <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-2">
              // {t.readout}
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[11px] text-[var(--muted)] mono-font">V(NaOH)</p>
                <p className="text-sm mono-font text-[var(--fg)]">{volume.toFixed(1)} mL</p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--muted)] mono-font">c(HCl)</p>
                <p className="text-sm mono-font text-[var(--fg)]">{acidM.toFixed(1)} M</p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--muted)] mono-font">pH</p>
                <p className="text-sm mono-font text-[var(--fg)]">{ph.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-[11px] text-[var(--muted)] mono-font mt-2">
              {t.readout} · 中和点 {eqV.toFixed(1)} mL
            </p>
          </div>
        </div>

        {/* 右列：参数 + 三幕 */}
        <div className="flex flex-col space-y-6">
          <div className="border border-[var(--border)] p-4 space-y-4">
            <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
              // {t.params}
            </h3>
            <ParamSlider
              label="V (NaOH)"
              value={volume}
              min={0}
              max={40}
              step={0.5}
              onChange={setVolume}
              format={(v) => `${v.toFixed(1)}mL`}
            />
            <ParamSlider
              label="c (HCl)"
              value={acidM}
              min={0.1}
              max={2}
              step={0.1}
              onChange={setAcidM}
              format={(v) => `${(v / 0.1).toFixed(1)}×`}
            />
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
              <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                // {t.predictTitle}
              </h3>
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{t.predictQuestion}</p>

              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.predictQ1}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['slow-fast', t.predictSlowFast],
                      ['linear', t.predictLinear],
                      ['flat', t.predictFlat],
                      ['up', t.predictUp],
                    ] as [PredictTrend, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPredTrend(v)}
                      className={`text-left text-xs px-2 py-1.5 border transition-colors ${
                        predTrend === v ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
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
                <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                  // {t.pinnedTitle}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    if (isPinned) {
                      setPinned((prev) => prev.filter((p) => p.acidM !== acidM));
                    } else {
                      setPinned((prev) => [...prev, { id: prev.length + 1, acidM }]);
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
                      <span key={p.id} className="text-[11px] mono-font px-1.5 py-0.5 border border-[var(--border)] text-[var(--muted)]">
                        酸 {(p.acidM / 0.1).toFixed(1)}×
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
              <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
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
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['s', t.concludeQ1S],
                      ['l', t.concludeQ1L],
                      ['none', t.concludeQ1None],
                    ] as ['s' | 'l' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q1 === v;
                    const correct = correctKeys.q1 === v;
                    const showFeedback = conclusion.q1 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q1: v }))}
                        className={`text-left text-xs px-2 py-1.5 border transition-colors ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] text-[var(--fg)]'
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

              {/* Q2: 恰好中和 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ2}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['ph7', t.concludeQ2Ph7],
                      ['ph0', t.concludeQ2Ph0],
                      ['none', t.concludeQ2None],
                    ] as ['ph7' | 'ph0' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q2 === v;
                    const correct = correctKeys.q2 === v;
                    const showFeedback = conclusion.q2 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q2: v }))}
                        className={`text-left text-xs px-2 py-1.5 border transition-colors ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] text-[var(--fg)]'
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

              {/* Q3: 浓度影响 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ3}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['steep', t.concludeQ3Steep],
                      ['mild', t.concludeQ3Mild],
                      ['none', t.concludeQ3None],
                    ] as ['steep' | 'mild' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q3 === v;
                    const correct = correctKeys.q3 === v;
                    const showFeedback = conclusion.q3 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q3: v }))}
                        className={`text-left text-xs px-2 py-1.5 border transition-colors ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] text-[var(--fg)]'
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

              {/* Q4: 碱过量 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ4}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['basic', t.concludeQ4Basic],
                      ['acid', t.concludeQ4Acid],
                      ['none', t.concludeQ4None],
                    ] as ['basic' | 'acid' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q4 === v;
                    const correct = correctKeys.q4 === v;
                    const showFeedback = conclusion.q4 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q4: v }))}
                        className={`text-left text-xs px-2 py-1.5 border transition-colors ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] text-[var(--fg)]'
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
                className="text-xs mono-font uppercase underline text-[var(--fg)] hover:opacity-70"
              >
                {t.redoLabel} ↻
              </button>
            </div>
          )}

          {/* 考点速记（深化记忆，言简意赅） */}
          {stage === 'conclude' && conclusionComplete && (
            <div className="border border-[var(--border)] p-4 space-y-2">
              <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
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
