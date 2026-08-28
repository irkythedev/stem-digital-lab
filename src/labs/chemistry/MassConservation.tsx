/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学实验 · 质量守恒定律验证三幕式探究（人教版 九上第5单元）
 *
 * 三个方案对比：
 *   方案一：铜 + 氧气 → 氧化铜（密封，有气体参与）
 *   方案二：铁 + 硫酸铜 → 硫酸亚铁 + 铜（无气体参与）
 *   方案三：碳酸钠 + 盐酸 → 氯化钠 + 水 + CO₂↑（开放体系，质量减少）
 *
 * 幕 1 预测：三个方案分别猜质量变不变
 * 幕 2 探索：逐方案操作（加热/混合/称量），记录观察
 * 幕 3 结论：总结质量守恒定律 + 微观动画
 *
 * 复用组件：BalanceScale（天平）、MicroAnimation（微观动画）、ExploreStage。
 */
import { useMemo, useState } from 'react';
import AskAiButton from '../../components/ai/AskAiButton';
import { useApp } from '../../lib/app-context';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import BalanceScale from '../../components/lab/BalanceScale';
import MicroAnimation from '../../components/lab/MicroAnimation';

type Stage = 'predict' | 'explore' | 'conclude';

/** 预测题：质量变化 */
type PredictChange = 'same' | 'more' | 'less' | null;

/** 方案索引 */
type SchemeIdx = 0 | 1 | 2;

/** 方案状态 */
interface SchemeState {
  reacted: boolean;
  beforeMass: number;
  afterMass: number;
}

const SCHEME_INIT: SchemeState = { reacted: false, beforeMass: 100, afterMass: 100 };

const copy = {
  zh: {
    prompt: '先预测，再自由探索，最后自己下结论。每一步都可以来回调整。',
    reset: '重置',
    stagePredict: '预测',
    stageExplore: '探索',
    stageConclude: '结论',
    stageDone: '完成',
    nextStage: '下一步 →',
    redoLabel: '再次实验',
    // 幕1 预测
    predictTitle: '预测',
    predictQuestion: '在称量所包含的体系内，化学反应前后的总质量如何变化？',
    predictQuestion2: '先别急着做实验，猜一猜下面三个实验的结果：',
    predictQ1: '实验一：铜粉加热（与氧气反应），密封体系',
    predictQ1Same: '质量不变',
    predictQ1More: '质量变大',
    predictQ1Less: '质量变小',
    predictQ2: '实验二：铁钉放入硫酸铜溶液，无气体参与',
    predictQ2Same: '质量不变',
    predictQ2More: '质量变大',
    predictQ2Less: '质量变小',
    predictQ3: '实验三：碳酸钠与盐酸反应（有 CO₂ 气体生成），开放体系',
    predictQ3Same: '质量不变',
    predictQ3More: '质量变大',
    predictQ3Less: '质量变小',
    predictDone: '已记录你的预测',
    predictHint: '三个都猜完，就可以进入探索阶段做实验验证',
    revealLabel: '进入探索 →',
    // 幕2 探索
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。选择一个实验，点击操作按钮，观察天平变化后记一条。',
    notePlaceholder: '写一句话：你观察到了什么？',
    recordLabel: '记一条观察',
    clearLabel: '清空记录',
    tryLabel: '试试这个',
    scheme1: '实验一：铜 + 氧气',
    scheme2: '实验二：铁 + 硫酸铜',
    scheme3: '实验三：碳酸钠 + 盐酸',
    scheme1Desc: '实验一：铜粉在密封锥形瓶中加热，与氧气反应生成氧化铜。观察反应前后质量。',
    scheme2Desc: '实验二：铁钉放入硫酸铜溶液，铁表面析出红色铜，溶液变浅绿色。观察反应前后质量。',
    scheme3Desc: '实验三：碳酸钠与盐酸在烧杯中反应，产生 CO₂ 气体逸出。观察反应前后质量。',
    reactBtn: '开始反应',
    resetBtn: '重置实验',
    beforeMass: '反应前质量',
    afterMass: '反应后质量',
    scheme1Reacted: '铜粉变黑（CuO），气球先胀后缩',
    scheme2Reacted: '铁钉表面有红色铜析出，溶液变浅绿色',
    scheme3Reacted: '产生大量气泡，CO₂ 逸出，质量减少',
    scheme1Explain: '密封体系：铜与氧气反应生成氧化铜，气体未逸出，质量不变。',
    scheme2Explain: '无气体参与：铁与硫酸铜反应，所有物质都在容器内，质量不变。',
    scheme3Explain: '开放体系：生成的 CO₂ 气体逸出，质量减少。若在密封容器中，质量不变。',
    cards: [
      {
        title: '实验一：铜 + 氧气（密封）',
        prompt: '点击「开始反应」加热铜粉，观察锥形瓶中气球的变化。反应前后质量相等吗？',
      },
      {
        title: '实验二：铁 + 硫酸铜',
        prompt: '点击「开始反应」混合铁钉和硫酸铜溶液，观察颜色变化。反应前后质量相等吗？',
      },
      {
        title: '实验三：碳酸钠 + 盐酸（开放）',
        prompt: '点击「开始反应」混合碳酸钠和盐酸，观察气泡。反应前后质量相等吗？为什么？',
      },
    ],
    // 幕3 结论
    concludeTitle: '结论',
    concludeQuestion: '综合三个实验的探索，化学反应前后质量有什么规律？',
    concludeSkipHint: '还没在预测幕猜过——建议先回预测幕完成预测，再做结论会更有意义。',
    concludeHint: '选完三题，看看结论和你的观察是否一致',
    feedbackText:
      '质量守恒定律：参加化学反应的各物质的质量总和，等于反应后生成的各物质的质量总和。' +
      '微观本质：化学反应是原子重新组合的过程，原子的种类、数目、质量都不变。' +
      '有气体参与或生成的反应，必须在密闭容器中验证质量守恒。',
    tipsTitle: '考点速记',
    tips: [
      '质量守恒定律：在封闭体系中，参加反应的各物质质量总和 = 生成物质量总和；开放体系的称量值可能因气体逸出而减少。',
      '微观本质：原子种类不变、原子数目不变、原子质量不变。',
      '分子种类一定变（化学变化），分子数目可能变。',
      '有气体参与或生成 → 必须在密闭容器中验证。',
      '常见开放体系「质量减少」的陷阱：碳酸钠+盐酸（CO₂逸出）、镁条燃烧（MgO 部分散失）。',
      '质量守恒定律适用于一切化学变化，不适用于物理变化。',
    ],
    concludeQ1: '化学反应前后，物质的总质量？',
    concludeQ1Same: '不变',
    concludeQ1Change: '可能变',
    concludeQ1AlwaysChange: '一定变',
    concludeQ2: '有气体生成的反应，在开放体系中质量会？',
    concludeQ2Less: '减少（气体逸出）',
    concludeQ2Same: '不变',
    concludeQ2More: '增加',
    concludeQ3: '质量守恒的微观本质是？',
    concludeQ3Atom: '原子种类、数目、质量不变',
    concludeQ3Mol: '分子种类、数目不变',
    concludeQ3Energy: '能量守恒',
  },
  en: {
    prompt: 'Predict first, explore freely, then draw your own conclusion. You can move back and forth at any time.',
    reset: 'Reset',
    stagePredict: 'Predict',
    stageExplore: 'Explore',
    stageConclude: 'Conclude',
    stageDone: 'Done',
    nextStage: 'Next →',
    redoLabel: 'Redo',
    predictTitle: 'Predict',
    predictQuestion: 'Within the measured system, how does total mass change during a chemical reaction?',
    predictQuestion2: 'Before doing the experiments, guess the results for these three experiments:',
    predictQ1: 'Experiment 1: Heating copper powder with oxygen (sealed)',
    predictQ1Same: 'Mass stays the same',
    predictQ1More: 'Mass increases',
    predictQ1Less: 'Mass decreases',
    predictQ2: 'Experiment 2: Iron + copper sulfate solution (no gas)',
    predictQ2Same: 'Mass stays the same',
    predictQ2More: 'Mass increases',
    predictQ2Less: 'Mass decreases',
    predictQ3: 'Experiment 3: Sodium carbonate + HCl (CO₂ gas escapes, open)',
    predictQ3Same: 'Mass stays the same',
    predictQ3More: 'Mass increases',
    predictQ3Less: 'Mass decreases',
    predictDone: 'Your predictions are recorded',
    predictHint: 'Answer all three to enter the Explore stage',
    revealLabel: 'Enter Explore →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Select an experiment, click the reaction button, observe the balance, then note it.',
    notePlaceholder: 'Write one sentence: what did you observe?',
    recordLabel: 'Note it',
    clearLabel: 'Clear notes',
    tryLabel: 'Try it',
    scheme1: 'Experiment 1: Cu + O₂',
    scheme2: 'Experiment 2: Fe + CuSO₄',
    scheme3: 'Experiment 3: Na₂CO₃ + HCl',
    scheme1Desc: 'Experiment 1: Heating copper powder in a sealed flask with oxygen. Observe mass before and after.',
    scheme2Desc: 'Experiment 2: Iron nail in copper sulfate solution. Red copper deposits on iron, solution turns green. Observe mass.',
    scheme3Desc: 'Experiment 3: Sodium carbonate reacts with HCl in an open beaker. CO₂ gas escapes. Observe mass.',
    reactBtn: 'Start reaction',
    resetBtn: 'Reset experiment',
    beforeMass: 'Mass before',
    afterMass: 'Mass after',
    scheme1Reacted: 'Copper turns black (CuO), balloon inflates then deflates',
    scheme2Reacted: 'Red copper on iron surface, solution turns light green',
    scheme3Reacted: 'Bubbles form, CO₂ escapes, mass decreases',
    scheme1Explain: 'Sealed: Cu + O₂ → CuO, no gas escapes, mass unchanged.',
    scheme2Explain: 'No gas: Fe + CuSO₄ → FeSO₄ + Cu, all substances contained, mass unchanged.',
    scheme3Explain: 'Open: CO₂ gas escapes, mass decreases. In a sealed container, mass would be conserved.',
    cards: [
      {
        title: 'Experiment 1: Cu + O₂ (sealed)',
        prompt: 'Click "Start reaction" to heat copper. Observe the balloon. Does mass stay the same?',
      },
      {
        title: 'Experiment 2: Fe + CuSO₄',
        prompt: 'Click "Start reaction" to mix iron and copper sulfate. Observe color change. Does mass stay the same?',
      },
      {
        title: 'Experiment 3: Na₂CO₃ + HCl (open)',
        prompt: 'Click "Start reaction" to mix. Observe bubbles. Does mass stay the same? Why?',
      },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on the three experiments, what is the rule about mass in chemical reactions?',
    concludeSkipHint: "You haven't made predictions yet — consider going back to the Predict stage first.",
    concludeHint: 'Answer all three questions, then check your answers.',
    feedbackText:
      'Law of conservation of mass: the total mass of reactants equals the total mass of products. ' +
      'Microscopic explanation: chemical reactions rearrange atoms — the types, numbers, and masses of atoms remain unchanged. ' +
      'Reactions involving gases must be verified in a sealed container.',
    tipsTitle: 'Key Points',
    tips: [
      'Law of conservation of mass: in a closed system, mass of reactants = mass of products; an open system may show a decrease when gas escapes.',
      'Microscopic: atom types, numbers, and masses remain unchanged.',
      'Molecular types always change (chemical change), molecular numbers may change.',
      'Reactions with gases must be verified in a sealed container.',
      'Common trap: open systems lose mass (CO₂ escaping, MgO scattering).',
      'Conservation of mass applies to all chemical changes, not physical changes.',
    ],
    concludeQ1: 'Total mass during a chemical reaction:',
    concludeQ1Same: 'Stays the same',
    concludeQ1Change: 'May change',
    concludeQ1AlwaysChange: 'Always changes',
    concludeQ2: 'In an open system with gas produced, mass will:',
    concludeQ2Less: 'Decrease (gas escapes)',
    concludeQ2Same: 'Stay the same',
    concludeQ2More: 'Increase',
    concludeQ3: 'The microscopic basis of mass conservation:',
    concludeQ3Atom: 'Atom types, numbers, masses unchanged',
    concludeQ3Mol: 'Molecular types and numbers unchanged',
    concludeQ3Energy: 'Energy is conserved',
  },
};

type Lang = 'zh' | 'en';

const CORRECT_KEYS: Record<string, string[]> = {
  q1: ['same'],
  q2: ['less'],
  q3: ['atom'],
};

/** 方案反应后质量 */
const AFTER_MASSES: Record<SchemeIdx, number> = {
  0: 100,   // 密封，质量不变
  1: 100,   // 无气体，质量不变
  2: 95,    // CO₂ 逸出，质量减少
};

/** 方案反应现象描述 */
const REACTED_DESCS: Record<SchemeIdx, string[]> = {
  0: ['铜粉变黑（CuO）', '气球先胀后缩', '密封体系，质量不变'],
  1: ['铁钉表面有红色铜析出', '溶液由蓝色变浅绿色', '无气体参与，质量不变'],
  2: ['产生大量气泡', 'CO₂ 气体逸出', '开放体系，质量减少'],
};

export default function MassConservation() {
  const { lang } = useApp();
  const c = copy[lang as Lang] ?? copy.zh;

  const [stage, setStage] = useState<Stage>('predict');
  const [predict1, setPredict1] = useState<PredictChange>(null);
  const [predict2, setPredict2] = useState<PredictChange>(null);
  const [predict3, setPredict3] = useState<PredictChange>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [obsId, setObsId] = useState(0);
  const [conclude1, setConclude1] = useState<string | null>(null);
  const [conclude2, setConclude2] = useState<string | null>(null);
  const [conclude3, setConclude3] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showMicro, setShowMicro] = useState(false);

  // 方案状态
  const [activeScheme, setActiveScheme] = useState<SchemeIdx>(0);
  const [schemes, setSchemes] = useState<[SchemeState, SchemeState, SchemeState]>([
    { ...SCHEME_INIT },
    { ...SCHEME_INIT },
    { ...SCHEME_INIT },
  ]);

  const predComplete = predict1 !== null && predict2 !== null && predict3 !== null;
  const concludeComplete = conclude1 && conclude2 && conclude3;

  const curScheme = schemes[activeScheme];

  function redoAll() {
    setStage('predict');
    setPredict1(null);
    setPredict2(null);
    setPredict3(null);
    setObservations([]);
    setObsId(0);
    setConclude1(null);
    setConclude2(null);
    setConclude3(null);
    setShowFeedback(false);
    setShowMicro(false);
    setActiveScheme(0);
    setSchemes([
      { ...SCHEME_INIT },
      { ...SCHEME_INIT },
      { ...SCHEME_INIT },
    ]);
  }

  function handleReact() {
    setSchemes((prev) => {
      const next = [...prev] as [SchemeState, SchemeState, SchemeState];
      next[activeScheme] = {
        reacted: true,
        beforeMass: 100,
        afterMass: AFTER_MASSES[activeScheme],
      };
      return next;
    });
  }

  function handleResetScheme() {
    setSchemes((prev) => {
      const next = [...prev] as [SchemeState, SchemeState, SchemeState];
      next[activeScheme] = { ...SCHEME_INIT };
      return next;
    });
  }

  function addObservation(note: string) {
    const schemeLabel =
      activeScheme === 0 ? c.scheme1 : activeScheme === 1 ? c.scheme2 : c.scheme3;
    const snapshot = [
      { label: '实验', value: schemeLabel },
      { label: '反应前', value: `${curScheme.beforeMass.toFixed(1)} g` },
      { label: '反应后', value: `${curScheme.afterMass.toFixed(1)} g` },
    ];
    setObservations((prev) => [
      ...prev,
      { id: obsId, snapshot, note },
    ]);
    setObsId((p) => p + 1);
  }

  const cards: ExploreCard[] = useMemo(
    () =>
      c.cards.map((card, i) => ({
        key: card.title,
        title: card.title,
        prompt: card.prompt,
        tryLabel: c.tryLabel,
        tryIt: () => setActiveScheme(i as SchemeIdx),
      })),
    [c],
  );

  /* ── 结论题渲染 ── */

  function renderConcludeQ(
    key: string,
    question: string,
    options: { value: string; label: string }[],
    selected: string | null,
    onSelect: (v: string) => void,
  ) {
    const correctKeys = CORRECT_KEYS[key];
    return (
      <div className="space-y-2">
        <p className="text-sm serif-font text-[var(--fg)]">{question}</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {options.map((opt) => {
            const isSel = selected === opt.value;
            const isCorrect = correctKeys.includes(opt.value);
            let cls = 'text-left text-sm px-3 py-2 border transition-colors ';
            if (showFeedback) {
              if (isSel && isCorrect) cls += 'border-[var(--fg)] text-[var(--fg)]';
              else if (isSel && !isCorrect) cls += 'border-[var(--error)] text-[var(--error)]';
              else if (!isSel && isCorrect) cls += 'border-[var(--border)] text-[var(--muted)]';
              else cls += 'border-[var(--border)] text-[var(--muted)] opacity-50';
            } else {
              cls += isSel
                ? 'border-[var(--fg)] text-[var(--fg)]'
                : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]';
            }
            const prefix = showFeedback
              ? isCorrect
                ? '✓ '
                : isSel
                  ? '✗ '
                  : ''
              : '';
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSelect(opt.value)}
                disabled={showFeedback}
                className={`${cls} ${showFeedback ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {prefix}{opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── 幕导航 ── */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 text-xs 2xl:text-sm mono-font tracking-wider">
        {(['predict', 'explore', 'conclude'] as Stage[]).map((s) => {
          const label =
            s === 'predict'
              ? c.stagePredict
              : s === 'explore'
                ? c.stageExplore
                : c.stageConclude;
          const isDone =
            s === 'predict'
              ? predComplete
              : s === 'explore'
                ? observations.length > 0
                : concludeComplete;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              className={`min-h-[38px] px-3.5 py-1.5 border transition-all rounded-sm font-medium touch-manipulation active:scale-95 ${
                stage === s
                  ? 'border-[var(--fg)] bg-[var(--accent-light)] text-[var(--fg)] shadow-xs'
                  : isDone
                    ? 'border-[var(--border)] text-[var(--fg)]'
                    : 'border-[var(--border)] text-[var(--muted)] opacity-60'
              }`}
            >
              {isDone && stage !== s ? `✓ ${label}` : label}
            </button>
          );
        })}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={redoAll}
            className="min-h-[38px] px-3.5 py-1.5 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-all rounded-sm touch-manipulation active:scale-95"
          >
            {c.redoLabel}
          </button>
        </div>
      </div>
      {/* 问 AI：讲解本实验的原理与操作要点 */}
      <AskAiButton className="mt-2" question={lang === 'zh' ? '请讲解质量守恒定律的实质，以及本实验三个方案为什么要分别设计' : 'Explain the essence of conservation of mass and why this lab uses three designs'} />


      {/* ── 天平 ── */}
      <div className="border border-[var(--border)] p-3">
        <BalanceScale
          beforeMass={curScheme.beforeMass}
          afterMass={curScheme.afterMass}
          showAfter={curScheme.reacted}
        />
      </div>

      {/* ── 幕内容 ── */}

      {stage === 'predict' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
            // {c.predictTitle}
          </h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
            {c.predictQuestion}
          </p>
          <p className="text-sm serif-font text-[var(--muted)]">
            {c.predictQuestion2}
          </p>

          {/* Q1 */}
          <div className="space-y-2">
            <p className="text-sm serif-font text-[var(--fg)]">{c.predictQ1}</p>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {[
                { value: 'same', label: c.predictQ1Same },
                { value: 'more', label: c.predictQ1More },
                { value: 'less', label: c.predictQ1Less },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPredict1(opt.value as PredictChange)}
                  className={`text-left text-sm px-3 py-2 border transition-colors ${
                    predict1 === opt.value
                      ? 'border-[var(--fg)] text-[var(--fg)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Q2 */}
          <div className="space-y-2">
            <p className="text-sm serif-font text-[var(--fg)]">{c.predictQ2}</p>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {[
                { value: 'same', label: c.predictQ2Same },
                { value: 'more', label: c.predictQ2More },
                { value: 'less', label: c.predictQ2Less },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPredict2(opt.value as PredictChange)}
                  className={`text-left text-sm px-3 py-2 border transition-colors ${
                    predict2 === opt.value
                      ? 'border-[var(--fg)] text-[var(--fg)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Q3 */}
          <div className="space-y-2">
            <p className="text-sm serif-font text-[var(--fg)]">{c.predictQ3}</p>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {[
                { value: 'same', label: c.predictQ3Same },
                { value: 'more', label: c.predictQ3More },
                { value: 'less', label: c.predictQ3Less },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPredict3(opt.value as PredictChange)}
                  className={`text-left text-sm px-3 py-2 border transition-colors ${
                    predict3 === opt.value
                      ? 'border-[var(--fg)] text-[var(--fg)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {predComplete ? (
            <p className="text-sm text-[var(--muted)] serif-font">{c.predictDone}</p>
          ) : (
            <p className="text-sm text-[var(--muted)] serif-font">{c.predictHint}</p>
          )}

          {predComplete && (
            <button
              type="button"
              onClick={() => setStage('explore')}
              className="px-4 py-2 border border-[var(--fg)] text-[var(--fg)] text-sm hover:bg-[var(--fg)] hover:text-[var(--card-bg)] transition-colors"
            >
              {c.revealLabel}
            </button>
          )}
        </div>
      )}

      {stage === 'explore' && (
        <div className="space-y-4">
          {/* 方案切换 */}
          <div className="flex gap-2">
            {([0, 1, 2] as SchemeIdx[]).map((idx) => {
              const label = idx === 0 ? c.scheme1 : idx === 1 ? c.scheme2 : c.scheme3;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveScheme(idx)}
                  className={`px-3 py-1.5 text-[0.6875rem] border transition-colors ${
                    activeScheme === idx
                      ? 'border-[var(--fg)] text-[var(--fg)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* 方案描述 */}
          <div className="border border-[var(--border)] p-3 space-y-2">
            <p className="text-sm serif-font text-[var(--fg)]">
              {activeScheme === 0
                ? c.scheme1Desc
                : activeScheme === 1
                  ? c.scheme2Desc
                  : c.scheme3Desc}
            </p>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              {!curScheme.reacted ? (
                <button
                  type="button"
                  onClick={handleReact}
                  className="px-4 py-2 border border-[var(--fg)] text-[var(--fg)] text-sm hover:bg-[var(--fg)] hover:text-[var(--card-bg)] transition-colors"
                >
                  {c.reactBtn}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResetScheme}
                  className="px-4 py-2 border border-[var(--border)] text-[var(--muted)] text-sm hover:border-[var(--fg)] transition-colors"
                >
                  {c.resetBtn}
                </button>
              )}
            </div>

            {/* 反应容器可视化 */}
            <div className="pt-1">
              {activeScheme === 0 && (
                <svg viewBox="0 0 240 150" className="w-full max-w-[280px] mx-auto" aria-label="锥形瓶加热铜粉" strokeLinecap="round" strokeLinejoin="round">
                  {/* 锥形瓶 */}
                  <path d="M70 40 H170 L150 130 H90 Z" fill="none" stroke="var(--fg)" strokeWidth="1.2" />
                  <line x1="70" y1="40" x2="170" y2="40" stroke="var(--fg)" strokeWidth="1.2" />
                  {/* 铜粉（底部） */}
                  <rect x="96" y="120" width="48" height="10" fill={curScheme.reacted ? 'var(--cu-oxide)' : 'var(--cu-powder)'} opacity="0.8" />
                  {/* 气球（锥形瓶口） */}
                  <path d={curScheme.reacted
                    ? "M120 40 q-6 -14 6 -18 q12 2 6 18 Z" // 反应后气球鼓起
                    : "M120 40 q0 -6 6 -8 q6 2 6 8 Z"}
                    fill="none" stroke="var(--fg)" strokeWidth="1.2" />
                  {/* 火焰（加热） */}
                  {curScheme.reacted && (
                    <path d="M120 130 v10 M117 138 q-3 -6 0 -10 M123 138 q3 -6 0 -10" stroke="var(--accent)" strokeWidth="1.2" fill="none" />
                  )}
                  <text x="120" y="148" textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">Cu → CuO</text>
                </svg>
              )}

              {activeScheme === 1 && (
                <svg viewBox="0 0 240 150" className="w-full max-w-[280px] mx-auto" aria-label="铁钉浸硫酸铜" strokeLinecap="round" strokeLinejoin="round">
                  {/* 试管（圆底） */}
                  <path d="M105 40 v60 a30 30 0 0 0 60 0 V40" fill="none" stroke="var(--fg)" strokeWidth="1.2" />
                  <line x1="105" y1="42" x2="165" y2="42" stroke="var(--fg)" strokeWidth="1.2" />
                  {/* 溶液（蓝色→浅绿） */}
                  <path d="M107 70 V100 A28 28 0 0 0 163 100 V70 Z"
                    fill={curScheme.reacted ? 'rgba(120,170,110,0.4)' : 'rgba(60,120,220,0.4)'} stroke="none" />
                  <line x1="107" y1="70" x2="163" y2="70" stroke="var(--fg)" strokeWidth="0.8" strokeDasharray="3 2" />
                  {/* 铁钉 */}
                  <line x1="135" y1="42" x2="135" y2="95" stroke="#a0a6ad" strokeWidth="1.5" strokeLinecap="round" />
                  {/* 析出红铜（反应后） */}
                  {curScheme.reacted && (
                    <>
                      <circle cx="132" cy="82" r="2.4" fill="#e08a3c" />
                      <circle cx="139" cy="90" r="2.2" fill="#e08a3c" />
                      <circle cx="135" cy="96" r="2.6" fill="#e08a3c" />
                    </>
                  )}
                  <text x="135" y="148" textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">Fe + CuSO₄</text>
                </svg>
              )}

              {activeScheme === 2 && (
                <svg viewBox="0 0 240 150" className="w-full max-w-[280px] mx-auto" aria-label="碳酸钠与盐酸" strokeLinecap="round" strokeLinejoin="round">
                  {/* 烧杯 */}
                  <path d="M85 40 H155 V125 H85 Z" fill="none" stroke="var(--fg)" strokeWidth="1.2" />
                  {/* 溶液 */}
                  <rect x="86" y="70" width="68" height="54" fill="rgba(180,200,220,0.35)" stroke="none" />
                  <line x1="86" y1="70" x2="154" y2="70" stroke="var(--fg)" strokeWidth="0.8" strokeDasharray="3 2" />
                  {/* 气泡（反应后逸出） */}
                  {curScheme.reacted && (
                    <>
                      <circle cx="105" cy="80" r="2" fill="var(--fg)" opacity="0.6" />
                      <circle cx="125" cy="60" r="2.5" fill="var(--fg)" opacity="0.5" />
                      <circle cx="140" cy="50" r="2" fill="var(--fg)" opacity="0.4" />
                      <circle cx="115" cy="70" r="1.6" fill="var(--fg)" opacity="0.5" />
                      <circle cx="130" cy="82" r="1.4" fill="var(--fg)" opacity="0.4" />
                      <text x="135" y="35" textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">CO₂↑</text>
                    </>
                  )}
                  {!curScheme.reacted && <text x="120" y="110" textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">Na₂CO₃ + HCl</text>}
                </svg>
              )}
            </div>

            {/* 反应现象 */}
            {curScheme.reacted && (
              <div className="space-y-1 pt-2 border-t border-[var(--border)]">
                <p className="text-sm text-[var(--accent)] serif-font">
                  {REACTED_DESCS[activeScheme][0]}
                </p>
                <p className="text-sm text-[var(--accent)] serif-font">
                  {REACTED_DESCS[activeScheme][1]}
                </p>
                <p className="text-sm text-[var(--fg)] serif-font pt-1">
                  {activeScheme === 0
                    ? c.scheme1Explain
                    : activeScheme === 1
                      ? c.scheme2Explain
                      : c.scheme3Explain}
                </p>
              </div>
            )}
          </div>

          <ExploreStage
            cards={cards}
            observations={observations}
            onAddObservation={addObservation}
            onClearObservations={() => setObservations([])}
            notePlaceholder={c.notePlaceholder}
            recordLabel={c.recordLabel}
            clearLabel={c.clearLabel}
            emptyLabel={c.exploreEmpty}
            title={c.exploreTitle}
          />
        </div>
      )}

      {stage === 'conclude' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
            // {c.concludeTitle}
          </h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
            {c.concludeQuestion}
          </p>

          {!predComplete && (
            <p className="text-sm text-[var(--accent)] serif-font">{c.concludeSkipHint}</p>
          )}

          {renderConcludeQ(
            'q1',
            c.concludeQ1,
            [
              { value: 'same', label: c.concludeQ1Same },
              { value: 'change', label: c.concludeQ1Change },
              { value: 'always-change', label: c.concludeQ1AlwaysChange },
            ],
            conclude1,
            setConclude1,
          )}

          {renderConcludeQ(
            'q2',
            c.concludeQ2,
            [
              { value: 'less', label: c.concludeQ2Less },
              { value: 'same', label: c.concludeQ2Same },
              { value: 'more', label: c.concludeQ2More },
            ],
            conclude2,
            setConclude2,
          )}

          {renderConcludeQ(
            'q3',
            c.concludeQ3,
            [
              { value: 'atom', label: c.concludeQ3Atom },
              { value: 'mol', label: c.concludeQ3Mol },
              { value: 'energy', label: c.concludeQ3Energy },
            ],
            conclude3,
            setConclude3,
          )}

          {!showFeedback && concludeComplete && (
            <button
              type="button"
              onClick={() => setShowFeedback(true)}
              className="px-4 py-2 border border-[var(--fg)] text-[var(--fg)] text-sm hover:bg-[var(--fg)] hover:text-[var(--card-bg)] transition-colors"
            >
              {lang === 'zh' ? '查看反馈' : 'Check answers'}
            </button>
          )}

          {!concludeComplete && (
            <p className="text-sm text-[var(--muted)] serif-font">{c.concludeHint}</p>
          )}

          {showFeedback && (
            <div className="space-y-3 pt-2 border-t border-[var(--border)]">
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
                {c.feedbackText}
              </p>

              {/* 微观动画 */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowMicro((p) => !p)}
                  className={`px-3 py-1.5 text-[0.6875rem] border transition-colors ${
                    showMicro
                      ? 'border-[var(--fg)] text-[var(--fg)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                  }`}
                >
                  {showMicro
                    ? (lang === 'zh' ? '隐藏微观动画' : 'Hide micro animation')
                    : (lang === 'zh' ? '查看微观动画' : 'Show micro animation')}
                </button>
                {showMicro && (
                  <MicroAnimation
                    reactants={[
                      {
                        label: 'H₂',
                        atoms: [
                          { id: 'h1', label: 'H', color: '#4fc3f7' },
                          { id: 'h2', label: 'H', color: '#4fc3f7' },
                        ],
                      },
                      {
                        label: 'H₂',
                        atoms: [
                          { id: 'h3', label: 'H', color: '#4fc3f7' },
                          { id: 'h4', label: 'H', color: '#4fc3f7' },
                        ],
                      },
                      {
                        label: 'O₂',
                        atoms: [
                          { id: 'o1', label: 'O', color: '#ef5350' },
                          { id: 'o2', label: 'O', color: '#ef5350' },
                        ],
                      },
                    ]}
                    products={[
                      {
                        label: 'H₂O',
                        atoms: [
                          { id: 'h1', label: 'H', color: '#4fc3f7' },
                          { id: 'h2', label: 'H', color: '#4fc3f7' },
                          { id: 'o1', label: 'O', color: '#ef5350' },
                        ],
                      },
                      {
                        label: 'H₂O',
                        atoms: [
                          { id: 'h3', label: 'H', color: '#4fc3f7' },
                          { id: 'h4', label: 'H', color: '#4fc3f7' },
                          { id: 'o2', label: 'O', color: '#ef5350' },
                        ],
                      },
                    ]}
                  />
                )}
              </div>

              <div>
                <h4 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-2">
                  // {c.tipsTitle}
                </h4>
                <ul className="space-y-1">
                  {c.tips.map((tip, i) => (
                    <li key={i} className="text-sm serif-font text-[var(--fg)] pl-3 border-l border-[var(--border)]">
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
