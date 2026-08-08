/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 物理实验 · 滑轮三幕式探究（苏科版 九上第11章）
 *
 * 幕 1 预测：猜定滑轮/动滑轮是否省力
 * 幕 2 探索：定滑轮/动滑轮切换，观察拉起重物所需力
 * 幕 3 结论：定滑轮不省力改变方向，动滑轮最多省一半力
 *
 * 教材依据：ch11「活动 11.2 探究定滑轮和动滑轮的特点」
 */
import { useMemo, useState } from 'react';
import { useApp } from '../../lib/app-context';
import ParamSlider from '../../components/lab/ParamSlider';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import Formula from '../../components/ui/Formula';

type Stage = 'predict' | 'explore' | 'conclude';

type PredictQ1 = 'fixed' | 'moving' | null;

const copy = {
  zh: {
    prompt: '先预测，再自由探索，最后自己下结论。每一步都可以来回调整。',
    params: '参数', readout: '读数', reset: '重置',
    stagePredict: '预测', stageExplore: '探索', stageConclude: '结论',
    nextStage: '下一步 →', redoLabel: '再次实验',
    predictTitle: '预测',
    predictQuestion: '使用定滑轮和动滑轮，哪个更省力？',
    predictQ1: '动滑轮可以省多少力？',
    predictQ1Half: '最多省一半力',
    predictQ1None: '不省力',
    predictDone: '已记录你的预测', predictHint: '猜完，就可以揭示实验',
    revealLabel: '揭示实验 →',
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。切换滑轮类型或拖动滑块，看到有意思的状态时记一条。',
    notePlaceholder: '写一句话：你观察到了什么？', recordLabel: '记一条观察',
    clearLabel: '清空记录', tryLabel: '试试这个',
    cards: [
      { title: '定滑轮', prompt: '用定滑轮拉起重物，需要多大的力？方向呢？' },
      { title: '动滑轮', prompt: '用动滑轮拉起同一重物，需要多大的力？' },
      { title: '方向', prompt: '定滑轮改变了施力方向，动滑轮呢？' },
      { title: '自由探索', prompt: '切换滑轮类型，改变重物重量，找找规律。' },
    ],
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，定滑轮和动滑轮各有什么特点？',
    concludeHint: '选完两题，看看结论和你的观察是否一致',
    feedbackText:
      '使用定滑轮不能省力，但可以改变施力的方向；使用动滑轮最多可以省一半力，但不改变施力的方向。' +
      '定滑轮实质是等臂杠杆，动滑轮实质是省力杠杆（动力臂是阻力臂的两倍）。',
    tipsTitle: '考点速记',
    tips: [
      '定滑轮：不省力，但改变施力方向（等臂杠杆）',
      '动滑轮：最多省一半力，不改变方向（省力杠杆）',
      '定滑轮实质是等臂杠杆',
      '动滑轮实质是动力臂为阻力臂两倍的杠杆',
      '滑轮组：既能省力又能改变方向',
    ],
    concludeQ1: '定滑轮的特点？',
    concludeQ1Dir: '不省力，但改变方向',
    concludeQ1Save: '省一半力',
    concludeQ2: '动滑轮的特点？',
    concludeQ2Half: '最多省一半力，不改变方向',
    concludeQ2None: '不省力，改变方向',
  },
  en: {
    prompt: 'Predict first, explore freely, then draw your own conclusion. You can move back and forth at any time.',
    params: 'Parameters', readout: 'Readings', reset: 'Reset',
    stagePredict: 'Predict', stageExplore: 'Explore', stageConclude: 'Conclude',
    nextStage: 'Next →', redoLabel: 'Redo',
    predictTitle: 'Predict',
    predictQuestion: 'Between a fixed pulley and a movable pulley, which saves effort?',
    predictQ1: 'How much effort does a movable pulley save?',
    predictQ1Half: 'At most half',
    predictQ1None: 'None',
    predictDone: 'Your predictions are recorded', predictHint: 'Answer to reveal the experiment',
    revealLabel: 'Reveal experiment →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Switch the pulley type or drag the slider, and note what you see.',
    notePlaceholder: 'Write one sentence: what did you observe?', recordLabel: 'Note it',
    clearLabel: 'Clear notes', tryLabel: 'Try it',
    cards: [
      { title: 'Fixed pulley', prompt: 'Use a fixed pulley to lift the load — how much force is needed? What about direction?' },
      { title: 'Movable pulley', prompt: 'Use a movable pulley to lift the same load — how much force is needed?' },
      { title: 'Direction', prompt: 'A fixed pulley changes the pull direction; does a movable one?' },
      { title: 'Free exploration', prompt: 'Switch pulley type and change the load weight to find the pattern.' },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what are the features of fixed and movable pulleys?',
    concludeHint: 'Answer both questions, then check your conclusion.',
    feedbackText:
      'A fixed pulley does not save effort but changes the pull direction; a movable pulley saves at most half the effort but does not change direction. ' +
      'A fixed pulley is essentially a balance lever; a movable pulley is an effort-saving lever (effort arm is twice the load arm).',
    tipsTitle: 'Key Points',
    tips: [
      'Fixed pulley: no effort saved, but changes direction (balance lever)',
      'Movable pulley: saves at most half effort, no direction change (effort-saving lever)',
      'Fixed pulley is a balance lever',
      'Movable pulley is a lever with effort arm twice the load arm',
      'Pulley system: both saves effort and changes direction',
    ],
    concludeQ1: 'Feature of a fixed pulley?',
    concludeQ1Dir: 'No effort saved, but changes direction',
    concludeQ1Save: 'Saves half effort',
    concludeQ2: 'Feature of a movable pulley?',
    concludeQ2Half: 'Saves at most half effort, no direction change',
    concludeQ2None: 'No effort saved, changes direction',
  },
};

type Lang = 'zh' | 'en';

const CORRECT_KEYS: Record<string, string[]> = {
  q1: ['dir'],
  q2: ['half'],
};

export default function Pulley() {
  const { lang } = useApp();
  const c = copy[lang as Lang] ?? copy.zh;

  const [stage, setStage] = useState<Stage>('predict');
  const [type, setType] = useState<'fixed' | 'moving'>('fixed');
  const [G, setG] = useState(10); // 重物重量 N
  const [predict1, setPredict1] = useState<PredictQ1>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [obsId, setObsId] = useState(0);
  const [concl, setConcl] = useState<{ q1: string | null; q2: string | null }>({ q1: null, q2: null });
  const [showFeedback, setShowFeedback] = useState(false);

  const predComplete = predict1 !== null;
  const concludeComplete = concl.q1 && concl.q2;

  // 拉力：定滑轮 F=G，动滑轮 F=G/2（理想，不计滑轮重力）
  const F = type === 'fixed' ? G : G / 2;

  function redoAll() {
    setStage('predict');
    setType('fixed'); setG(10);
    setPredict1(null); setObservations([]); setObsId(0);
    setConcl({ q1: null, q2: null }); setShowFeedback(false);
  }

  function addObservation(note: string) {
    setObservations((prev) => [
      ...prev,
      {
        id: obsId,
        snapshot: [
          { label: lang === 'zh' ? '滑轮' : 'Pulley', value: type === 'fixed' ? (lang === 'zh' ? '定滑轮' : 'Fixed') : (lang === 'zh' ? '动滑轮' : 'Moving') },
          { label: 'G', value: `${G}N` },
          { label: 'F', value: `${F}N` },
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
          if (card.title.includes('定滑轮') || card.title.includes('Fixed')) setType('fixed');
          else if (card.title.includes('动滑轮') || card.title.includes('Movable')) setType('moving');
          else if (card.title.includes('方向') || card.title.includes('Direction')) setType('fixed');
          else { setType('fixed'); setG(10); }
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
      <div className="flex items-center gap-3 text-[11px] mono-font tracking-widest">
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
          <button type="button" onClick={redoAll} className="px-3 py-1.5 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] transition-colors">{c.redoLabel}</button>
        </div>
      </div>

      {/* ── 滑轮示意 ── */}
      <div className="border border-[var(--border)] p-3">
        <svg viewBox="0 0 520 320" className="w-full" aria-label="滑轮" strokeLinecap="round" strokeLinejoin="round">
          {/* 定滑轮：轮固定在上，绳绕轮，向下拉 */}
          {type === 'fixed' ? (
            <>
              {/* 定滑轮 */}
              <circle cx="200" cy="80" r="30" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.5" />
              <circle cx="200" cy="80" r="8" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1" />
              {/* 支架 */}
              <line x1="200" y1="50" x2="200" y2="30" stroke="var(--fg)" strokeWidth="1.5" />
              <line x1="160" y1="30" x2="240" y2="30" stroke="var(--fg)" strokeWidth="1.5" />
              {/* 绳：绕过滑轮，一端挂重物，另一端下拉 */}
              <path d="M200 110 V200" stroke="var(--fg)" strokeWidth="1.5" />
              <path d="M200 110 V200" stroke="var(--fg)" strokeWidth="1.5" />
              {/* 重物 */}
              <rect x="190" y="200" width="20" height="25" fill="var(--muted)" opacity="0.7" stroke="var(--fg)" strokeWidth="1" />
              <text x="200" y="216" textAnchor="middle" fontSize="9" fill="var(--fg)" fontFamily="var(--f-mono)">{G}N</text>
              {/* 拉力方向 */}
              <path d="M260 140 V90" stroke="var(--fg)" strokeWidth="1.5" markerEnd="url(#arrow)" />
              <text x="275" y="105" fontSize="12" fill="var(--fg)" fontFamily="var(--f-mono)">F={F}N</text>
            </>
          ) : (
            <>
              {/* 动滑轮：轮挂重物，向上拉 */}
              <circle cx="240" cy="110" r="30" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.5" />
              <circle cx="240" cy="110" r="8" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1" />
              {/* 重物挂轮下 */}
              <line x1="240" y1="140" x2="240" y2="175" stroke="var(--fg)" strokeWidth="1.5" />
              <rect x="230" y="175" width="20" height="25" fill="var(--muted)" opacity="0.7" stroke="var(--fg)" strokeWidth="1" />
              <text x="240" y="191" textAnchor="middle" fontSize="9" fill="var(--fg)" fontFamily="var(--f-mono)">{G}N</text>
              {/* 绳：一端固定上端，另一端向上拉（两段绳承重） */}
              <path d="M210 110 V40 H140 V110" stroke="var(--fg)" strokeWidth="1.5" />
              <path d="M270 110 V40" stroke="var(--fg)" strokeWidth="1.5" />
              <line x1="140" y1="40" x2="300" y2="40" stroke="var(--fg)" strokeWidth="1.5" />
              {/* 拉力方向 */}
              <path d="M270 30 V-10" stroke="var(--fg)" strokeWidth="1.5" />
              <text x="285" y="15" fontSize="12" fill="var(--fg)" fontFamily="var(--f-mono)">F={F}N</text>
            </>
          )}
        </svg>
      </div>

      {/* ── 参数 ── */}
      <div className="border border-[var(--border)] p-4 space-y-3">
        <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.params}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] mono-font uppercase tracking-widest text-[var(--muted)]">{lang === 'zh' ? '滑轮类型' : 'Pulley type'}</span>
          <button type="button" onClick={() => setType('fixed')} className={`text-xs mono-font px-2 py-1 border transition-colors ${type === 'fixed' ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}>{lang === 'zh' ? '定滑轮' : 'Fixed'}</button>
          <button type="button" onClick={() => setType('moving')} className={`text-xs mono-font px-2 py-1 border transition-colors ${type === 'moving' ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}>{lang === 'zh' ? '动滑轮' : 'Moving'}</button>
        </div>
        <ParamSlider label="G (N)" value={G} min={2} max={20} step={1} onChange={setG} format={(v) => `${v.toFixed(0)}N`} />
        <div className="text-sm mono-font text-[var(--fg)]">
          <span className="text-[var(--muted)]">G = </span>{G}N
          <span className="text-[var(--muted)]"> · F = </span>{F}N
          {type === 'moving' && <span className="text-[var(--muted)]">（省一半力）</span>}
        </div>
      </div>

      {/* ── 幕内容 ── */}
      {stage === 'predict' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.predictTitle}</h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{c.predictQuestion}</p>
          {renderConcludeQ('q1', c.predictQ1, [{ value: 'half', label: c.predictQ1Half }, { value: 'none', label: c.predictQ1None }], predict1 as string, (v) => setPredict1(v as PredictQ1))}
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
          <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.concludeTitle}</h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{c.concludeQuestion}</p>
          {renderConcludeQ('q1', c.concludeQ1, [{ value: 'dir', label: c.concludeQ1Dir }, { value: 'save', label: c.concludeQ1Save }], concl.q1, (v) => setConcl((p) => ({ ...p, q1: v })))}
          {renderConcludeQ('q2', c.concludeQ2, [{ value: 'half', label: c.concludeQ2Half }, { value: 'none', label: c.concludeQ2None }], concl.q2, (v) => setConcl((p) => ({ ...p, q2: v })))}
          {concludeComplete && !showFeedback && (
            <button type="button" onClick={() => setShowFeedback(true)} className="text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors">{c.concludeHint}</button>
          )}
          {showFeedback && (
            <div className="border-l-2 border-[var(--fg)] pl-3 space-y-2">
              <p className="text-sm serif-font text-[var(--fg)] leading-relaxed">{c.feedbackText}</p>
              <h4 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.tipsTitle}</h4>
              <ul className="space-y-1">{c.tips.map((tip, i) => <li key={i} className="text-xs text-[var(--fg)] serif-font leading-relaxed flex gap-2"><span className="text-[var(--muted)] mono-font shrink-0">{i + 1}.</span>{tip}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
