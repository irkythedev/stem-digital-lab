/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 物理实验 · 浮力（阿基米德原理）三幕式探究（苏科版 九上第9章）
 *
 * 幕 1 预测：猜下沉的物体是否受浮力 / 浮力与什么有关
 * 幕 2 探索：弹簧测力计挂着石块浸入液体，滑块调浸入体积 / 液体密度，观察示数变化
 * 幕 3 结论：F浮 = G − F示数 = ρ液 g V排
 *
 * 教材依据：ch09「学生实验 探究影响浮力大小的因素」+「活动 9.8 下沉的物体是否受到浮力」
 */
import { useMemo, useState } from 'react';
import AskAiButton from '../../components/ai/AskAiButton';
import { useApp } from '../../lib/app-context';
import ParamSlider from '../../components/lab/ParamSlider';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import Formula from '../../components/ui/Formula';

type Stage = 'predict' | 'explore' | 'conclude';

/** 预测题 */
type PredictQ1 = 'yes' | 'no' | null;
type PredictQ2 = 'vol' | 'den' | 'mass' | null;

/** 液体密度表（教材参考值，g 取 10 N/kg） */
const LIQUIDS = [
  { id: 'water', zh: '水', en: 'Water', rho: 1000 },
  { id: 'brine', zh: '浓盐水', en: 'Brine', rho: 1200 },
  { id: 'alcohol', zh: '酒精', en: 'Alcohol', rho: 800 },
];

/** 浮力计算：F浮 = ρ液 g V排 */
function buoyancy(rho: number, vSubRatio: number): number {
  // V排 = 石块体积(固定) × 浸入比例；G 取 10N/kg，石块体积取 1×10^-4 m³
  const V = 1e-4 * vSubRatio;
  return rho * 10 * V;
}

const copy = {
  zh: {
    prompt: '先预测，再自由探索，最后自己下结论。每一步都可以来回调整。',
    params: '参数', readout: '读数', reset: '重置',
    stagePredict: '预测', stageExplore: '探索', stageConclude: '结论',
    nextStage: '下一步 →', redoLabel: '再次实验',
    predictTitle: '预测',
    predictQuestion: '弹簧测力计挂着石块，石块重 G = 2 N。',
    predictQ1: '把石块浸入水中，虽然它会下沉，但弹簧测力计示数会？',
    predictQ1Yes: '变小（受浮力）',
    predictQ1No: '不变（不受浮力）',
    predictQ2: '浮力的大小可能与什么有关？',
    predictQ2Vol: '物体排开液体的体积',
    predictQ2Den: '液体的密度',
    predictQ2Mass: '物体本身的质量',
    predictDone: '已记录你的预测', predictHint: '两个都猜完，就可以揭示实验',
    revealLabel: '揭示实验 →',
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。拖动滑块或点任务卡，看到有意思的状态时记一条。',
    notePlaceholder: '写一句话：你观察到了什么？', recordLabel: '记一条观察',
    clearLabel: '清空记录', tryLabel: '试试这个',
    cards: [
      { title: '浸入体积', prompt: '固定液体为水，增大浸入体积：弹簧测力计示数怎么变？浮力呢？' },
      { title: '液体密度', prompt: '固定浸入体积，换不同液体（水/盐水/酒精）：浮力怎么变？' },
      { title: '下沉也受浮力', prompt: '观察：石块浸入水中即使下沉，示数也变小——说明它也受浮力。' },
      { title: '自由探索', prompt: '任意调浸入体积和液体，找找浮力变化的规律。' },
    ],
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，浮力大小由什么决定？',
    concludeHint: '选完三题，看看结论和你的观察是否一致',
    feedbackText:
      '浸在液体中的物体都受浮力（即使下沉的物体也受）。浮力大小 F浮 = ρ液 g V排，' +
      '与排开液体的体积和液体的密度有关，与物体本身的质量无关。' +
      '用弹簧测力计可测：F浮 = G − F示数。',
    tipsTitle: '考点速记',
    tips: [
      '下沉的物体也受浮力，方向竖直向上',
      'F浮 = ρ液 g V排（阿基米德原理），g 取 10 N/kg',
      '浮力与排开液体体积、液体密度有关，与物体质量无关',
      '弹簧测力计法：F浮 = G − F示数',
      '轮船漂浮：F浮 = G = 排水量×g',
    ],
    concludeQ1: '下沉的物体是否受浮力？',
    concludeQ1Yes: '受浮力',
    concludeQ1No: '不受浮力',
    concludeQ2: '浮力大小与排开液体体积的关系？',
    concludeQ2Prop: '排开体积越大，浮力越大',
    concludeQ2Inv: '排开体积越大，浮力越小',
    concludeQ3: '液体密度相同时，排开体积越大，浮力？',
    concludeQ3Up: '越大',
    concludeQ3Down: '越小',
  },
  en: {
    prompt: 'Predict first, explore freely, then draw your own conclusion. You can move back and forth at any time.',
    params: 'Parameters', readout: 'Readings', reset: 'Reset',
    stagePredict: 'Predict', stageExplore: 'Explore', stageConclude: 'Conclude',
    nextStage: 'Next →', redoLabel: 'Redo',
    predictTitle: 'Predict',
    predictQuestion: 'A stone hangs on a spring balance; its weight is G = 2 N.',
    predictQ1: 'Dip the stone in water. It sinks, but the spring-balance reading will?',
    predictQ1Yes: 'decrease (experiences buoyancy)',
    predictQ1No: 'stay the same (no buoyancy)',
    predictQ2: 'What may the buoyant force depend on?',
    predictQ2Vol: 'the volume of displaced liquid',
    predictQ2Den: 'the density of the liquid',
    predictQ2Mass: 'the mass of the object itself',
    predictDone: 'Your predictions are recorded', predictHint: 'Answer both to reveal the experiment',
    revealLabel: 'Reveal experiment →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Drag a slider or try a card, and note what you see.',
    notePlaceholder: 'Write one sentence: what did you observe?', recordLabel: 'Note it',
    clearLabel: 'Clear notes', tryLabel: 'Try it',
    cards: [
      { title: 'Submerged volume', prompt: 'Keep water, increase the submerged volume: how does the spring-balance reading change? The buoyant force?' },
      { title: 'Liquid density', prompt: 'Keep the volume, switch liquids (water/brine/alcohol): how does buoyancy change?' },
      { title: 'Sinking still feels buoyancy', prompt: 'Notice: even sinking in water, the reading drops — the stone feels buoyancy.' },
      { title: 'Free exploration', prompt: 'Adjust volume and liquid freely and look for the pattern of buoyancy.' },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what determines the buoyant force?',
    concludeHint: 'Answer all three questions, then check if your conclusion matches.',
    feedbackText:
      'Every object in a liquid experiences buoyancy (even sinking ones). The buoyant force F_b = ρ_liq g V_displaced, ' +
      'which depends on the displaced volume and the liquid density, not on the object\'s mass. ' +
      'With a spring balance: F_b = G − F_reading.',
    tipsTitle: 'Key Points',
    tips: [
      'Sinking objects also feel buoyancy, directed upward',
      'F_b = ρ_liq g V_displaced (Archimedes), g = 10 N/kg',
      'Buoyancy depends on displaced volume and liquid density, not object mass',
      'Spring-balance method: F_b = G − F_reading',
      'Floating ship: F_b = G = displaced weight',
    ],
    concludeQ1: 'Do sinking objects feel buoyancy?',
    concludeQ1Yes: 'Yes',
    concludeQ1No: 'No',
    concludeQ2: 'Buoyancy vs displaced volume?',
    concludeQ2Prop: 'More displaced volume → more buoyancy',
    concludeQ2Inv: 'More displaced volume → less buoyancy',
    concludeQ3: 'Same liquid, more displaced volume → buoyancy?',
    concludeQ3Up: 'increases',
    concludeQ3Down: 'decreases',
  },
};

type Lang = 'zh' | 'en';

const CORRECT_KEYS: Record<string, string[]> = {
  q1: ['yes'],
  q2: ['prop'],
  q3: ['up'],
};

export default function Buoyancy() {
  const { lang } = useApp();
  const c = copy[lang as Lang] ?? copy.zh;

  const [stage, setStage] = useState<Stage>('predict');
  const [vSub, setVSub] = useState(0.5); // 浸入体积比例 0-1
  const [liquidId, setLiquidId] = useState('water');
  const [predict1, setPredict1] = useState<PredictQ1>(null);
  const [predict2, setPredict2] = useState<PredictQ2>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [obsId, setObsId] = useState(0);
  const [concl, setConcl] = useState<{ q1: string | null; q2: string | null; q3: string | null }>({ q1: null, q2: null, q3: null });
  const [showFeedback, setShowFeedback] = useState(false);

  const predComplete = predict1 !== null && predict2 !== null;
  const concludeComplete = concl.q1 && concl.q2 && concl.q3;

  const G = 2; // 石块重 2N
  const liquid = LIQUIDS.find((l) => l.id === liquidId)!;
  const Fb = buoyancy(liquid.rho, vSub);
  const FReading = Math.max(0, G - Fb);

  function redoAll() {
    setStage('predict');
    setVSub(0.5);
    setLiquidId('water');
    setPredict1(null); setPredict2(null);
    setObservations([]); setObsId(0);
    setConcl({ q1: null, q2: null, q3: null });
    setShowFeedback(false);
  }

  function addObservation(note: string) {
    setObservations((prev) => [
      ...prev,
      {
        id: obsId,
        snapshot: [
          { label: '液体', value: liquid[lang as Lang] },
          { label: '浸入', value: `${(vSub * 100).toFixed(0)}%` },
          { label: '示数', value: `${FReading.toFixed(2)}N` },
          { label: 'F浮', value: `${Fb.toFixed(2)}N` },
        ],
        note,
      },
    ]);
    setObsId((p) => p + 1);
  }

  const cards: ExploreCard[] = useMemo(
    () =>
      c.cards.map((card) => ({
        key: card.title,
        title: card.title,
        prompt: card.prompt,
        tryLabel: c.tryLabel,
        tryIt: () => {
          if (card.title.includes('浸入体积') || card.title.includes('Submerged')) setVSub(0.8);
          else if (card.title.includes('液体密度') || card.title.includes('Liquid density')) { setLiquidId('brine'); setVSub(0.8); }
          else if (card.title.includes('下沉') || card.title.includes('Sinking')) setVSub(0.6);
          else { setLiquidId('water'); setVSub(0.4); }
        },
      })),
    [c],
  );

  function renderConcludeQ(key: string, question: string, options: { value: string; label: string }[], selected: string | null, onSelect: (v: string) => void) {
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
              cls += isSel ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]';
            }
            const prefix = showFeedback ? (isCorrect ? '✓ ' : isSel ? '✗ ' : '') : '';
            return (
              <button key={opt.value} type="button" onClick={() => onSelect(opt.value)} disabled={showFeedback}
                className={`${cls} ${showFeedback ? 'opacity-60 cursor-not-allowed' : ''}`}>
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
      <div className="flex items-center gap-3 text-[0.6875rem] mono-font tracking-widest">
        {(['predict', 'explore', 'conclude'] as Stage[]).map((s) => {
          const label = s === 'predict' ? c.stagePredict : s === 'explore' ? c.stageExplore : c.stageConclude;
          const isDone = s === 'predict' ? predComplete : s === 'explore' ? observations.length > 0 : concludeComplete;
          return (
            <button key={s} type="button" onClick={() => setStage(s)}
              className={`px-3 py-1.5 border transition-colors ${stage === s ? 'border-[var(--fg)] text-[var(--fg)]' : isDone ? 'border-[var(--border)] text-[var(--muted)]' : 'border-[var(--border)] text-[var(--muted)] opacity-50'}`}>
              {isDone && stage !== s ? `✓ ${label}` : label}
            </button>
          );
        })}
        <div className="ml-auto">
          <button type="button" onClick={redoAll} className="px-3 py-1.5 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg
)] transition-colors">{c.redoLabel}</button>
        </div>
      </div>
      {/* 问 AI：讲解本实验的原理与操作要点 */}
      <AskAiButton className="mt-2" question={lang === 'zh' ? '请讲解阿基米德原理：浮力与排开液体体积、液体密度有什么关系' : "Explain Archimedes' principle: how buoyancy depends on displaced volume and fluid density"} />


      {/* ── 实验示意 ── */}
      <div className="border border-[var(--border)] p-3">
        <svg viewBox="0 0 520 320" className="w-full" aria-label="浮力实验" strokeLinecap="round" strokeLinejoin="round">
          {/* 弹簧测力计外壳 */}
          <rect x="180" y="20" width="40" height="60" rx="3" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.2" />
          <text x="200" y="58" textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">{FReading.toFixed(1)}N</text>
          {/* 弹簧（拉伸随浮力：示数越小弹簧越长） */}
          <line x1="200" y1="80" x2="200" y2={80 + 40 * (1 - Fb / G)} stroke="var(--fg)" strokeWidth="1.5" />
          {/* 吊线 */}
          <line x1="200" y1={80 + 40 * (1 - Fb / G)} x2="200" y2="130" stroke="var(--fg)" strokeWidth="1" />
          {/* 石块 */}
          <rect x="188" y="130" width="24" height="22" fill="var(--muted)" opacity="0.7" stroke="var(--fg)" strokeWidth="1.2" />
          <text x="200" y="143" textAnchor="middle" fontSize="9" fill="var(--fg)" fontFamily="var(--f-mono)">G={G}N</text>
          {/* 液体容器 */}
          <path d="M100 200 H420 L420 300 H100 Z" fill="rgba(70,150,220,0.18)" stroke="var(--fg)" strokeWidth="1.2" />
          {/* 液面线 */}
          <line x1="100" y1="200" x2="420" y2="200" stroke="var(--fg)" strokeWidth="0.8" strokeDasharray="4 2" />
          {/* 石块浸入部分（随浸入比例，水位上升） */}
          <rect x="188" y={200 + (130 - 200) * vSub} width="24" height="22" fill="rgba(70,150,220,0.4)" stroke="var(--fg)" strokeWidth="1" />
          {/* 液体标注 */}
          <text x="110" y="285" fontSize="11" fill="var(--fg)" fontFamily="var(--f-mono)">{liquid[lang as Lang]}</text>
        </svg>
      </div>

      {/* ── 参数 ── */}
      <div className="border border-[var(--border)] p-4 space-y-3">
        <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.params}</h3>
        <ParamSlider label="浸入体积" value={vSub} min={0.1} max={1} step={0.1} onChange={setVSub} format={(v) => `${(v * 100).toFixed(0)}%`} />
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] mono-font uppercase tracking-widest text-[var(--muted)]">{lang === 'zh' ? '液体' : 'Liquid'}</span>
          {LIQUIDS.map((l) => (
            <button key={l.id} type="button" onClick={() => setLiquidId(l.id)}
              className={`text-xs mono-font px-2 py-1 border transition-colors ${liquidId === l.id ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}>
              {l[lang as Lang]}
            </button>
          ))}
        </div>
      </div>

      {/* ── 幕内容 ── */}
      {stage === 'predict' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.predictTitle}</h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{c.predictQuestion}</p>
          {renderConcludeQ('q1', c.predictQ1, [{ value: 'yes', label: c.predictQ1Yes }, { value: 'no', label: c.predictQ1No }], predict1 as string, (v) => setPredict1(v as PredictQ1))}
          {renderConcludeQ('q2', c.predictQ2, [{ value: 'vol', label: c.predictQ2Vol }, { value: 'den', label: c.predictQ2Den }, { value: 'mass', label: c.predictQ2Mass }], predict2 as string, (v) => setPredict2(v as PredictQ2))}
          {predComplete ? (
            <button type="button" onClick={() => setStage('explore')} className="text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors">✓ {c.predictDone} — {c.revealLabel}</button>
          ) : (
            <p className="text-xs text-[var(--muted)] serif-font italic">{c.predictHint}</p>
          )}
        </div>
      )}

      {stage === 'explore' && (
        <ExploreStage
          cards={cards}
          observations={observations}
          onAddObservation={addObservation}
          onClearObservations={() => { setObservations([]); setObsId(0); }}
          notePlaceholder={c.notePlaceholder}
          recordLabel={c.recordLabel}
          clearLabel={c.clearLabel}
          emptyLabel={c.exploreEmpty}
          title={c.exploreTitle}
        />
      )}

      {stage === 'conclude' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.concludeTitle}</h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{c.concludeQuestion}</p>
          {renderConcludeQ('q1', c.concludeQ1, [{ value: 'yes', label: c.concludeQ1Yes }, { value: 'no', label: c.concludeQ1No }], concl.q1, (v) => setConcl((p) => ({ ...p, q1: v })))}
          {renderConcludeQ('q2', c.concludeQ2, [{ value: 'prop', label: c.concludeQ2Prop }, { value: 'inv', label: c.concludeQ2Inv }], concl.q2, (v) => setConcl((p) => ({ ...p, q2: v })))}
          {renderConcludeQ('q3', c.concludeQ3, [{ value: 'up', label: c.concludeQ3Up }, { value: 'down', label: c.concludeQ3Down }], concl.q3, (v) => setConcl((p) => ({ ...p, q3: v })))}
          {concludeComplete && !showFeedback && (
            <button type="button" onClick={() => setShowFeedback(true)} className="text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors">{c.concludeHint}</button>
          )}
          {showFeedback && (
            <div className="border-l-2 border-[var(--fg)] pl-3 space-y-2">
              <p className="text-sm serif-font text-[var(--fg)] leading-relaxed">{c.feedbackText}</p>
              <h4 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.tipsTitle}</h4>
              <ul className="space-y-1">{c.tips.map((tip, i) => <li key={i} className="text-xs text-[var(--fg)] serif-font leading-relaxed flex gap-2"><span className="text-[var(--muted)] mono-font shrink-0">{i + 1}.</span>{tip}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
