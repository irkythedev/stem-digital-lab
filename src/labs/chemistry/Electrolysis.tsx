/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学实验 · 电解水（人教版 九上第四单元 课题2 水的组成）三幕式探究
 *
 * 幕 1 预测：猜电解水产生什么气体 / 两极气体体积比
 * 幕 2 探索：接通电源，观察正负极气泡、气体体积比、检验气体
 * 幕 3 结论：正氧负氢，体积比 H₂:O₂ = 2:1，水由氢氧元素组成
 *
 * 教材依据：ch04「水的组成及变化（电解水）」+ 微观动画
 */
import { useEffect, useMemo, useState } from 'react';
import AskAiButton from '../../components/ai/AskAiButton';
import { useApp } from '../../lib/app-context';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import MicroAnimation from '../../components/lab/MicroAnimation';
import Formula from '../../components/ui/Formula';

type Stage = 'predict' | 'explore' | 'conclude';

/** 预测题 */
type PredictQ1 = 'o2' | 'h2' | null;
type PredictQ2 = 'ratio21' | 'ratio11' | 'ratio12' | null;

const copy = {
  zh: {
    prompt: '先预测，再自由探索，最后自己下结论。每一步都可以来回调整。',
    params: '参数', readout: '观察', reset: '重置',
    stagePredict: '预测', stageExplore: '探索', stageConclude: '结论',
    nextStage: '下一步 →', redoLabel: '再次实验',
    predictTitle: '预测',
    predictQuestion: '电解器里装的是加少量硫酸钠的水（纯水几乎不导电，加硫酸钠可增强导电性），接通直流电，观察两极产生的气体。',
    predictQ1: '通电后，正极（接电源正极）产生的是什么气体？',
    predictQ1O2: '氧气（能使带火星木条复燃）',
    predictQ1H2: '氢气（能燃烧）',
    predictQ2: '正极与负极产生的气体体积比约是多少？',
    predictQ2Ratio21: '约 1 : 2',
    predictQ2Ratio11: '约 1 : 1',
    predictQ2Ratio12: '约 2 : 1',
    predictDone: '已记录你的预测', predictHint: '两个都猜完，就可以通电',
    revealLabel: '通电 →',
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。通电观察，或点任务卡，看到现象时记一条。',
    notePlaceholder: '写一句话：你观察到了什么？', recordLabel: '记一条观察',
    clearLabel: '清空记录', tryLabel: '试试这个',
    cards: [
      { title: '通电观察', prompt: '接通电源，看正极和负极各有气泡冒出，哪极气泡多？' },
      { title: '检验气体', prompt: '负极气体能燃烧（H₂），正极气体使带火星木条复燃（O₂）。' },
      { title: '体积比', prompt: '负极收集的气体体积约是正极的 2 倍（H₂:O₂ = 2:1）。' },
      { title: '自由探索', prompt: '观察两极气泡快慢、体积关系，思考水的组成。' },
    ],
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，电解水说明了什么？',
    concludeHint: '选完三题，看看结论和你的观察是否一致',
    feedbackText:
      '电解水时，正极产生氧气、负极产生氢气，体积比 V(H₂):V(O₂) = 2:1。' +
      '这说明水由氢元素和氧元素组成，水在通电条件下分解为氢气和氧气：' +
      '2H₂O →(通电) 2H₂↑ + O₂↑。',
    tipsTitle: '考点速记',
    tips: [
      '电解水：正极（O）产氧气，负极（H）产氢气，体积比 H₂:O₂ = 2:1',
      '负极产氢气（可燃，点燃前须检验纯度）；正极产氧气（能使带火星木条复燃）',
      '水由氢、氧两种元素组成（不能说成氢分子和氧分子）',
      '水通电分解：2H₂O → 2H₂↑ + O₂↑，分解反应',
      '分子在化学变化中可以再分，原子不能再分',
    ],
    concludeQ1: '正极产生的是什么气体？',
    concludeQ1O2: '氧气',
    concludeQ1H2: '氢气',
    concludeQ2: '负极产生的是什么气体？',
    concludeQ2H2: '氢气',
    concludeQ2O2: '氧气',
    concludeQ3: '正负两极气体体积比（H₂:O₂）约为？',
    concludeQ3Ratio21: '2 : 1',
    concludeQ3Ratio11: '1 : 1',
    concludeQ3Ratio12: '1 : 2',
  },
  en: {
    prompt: 'Predict first, explore freely, then draw your own conclusion. You can move back and forth at any time.',
    params: 'Parameters', readout: 'Observations', reset: 'Reset',
    stagePredict: 'Predict', stageExplore: 'Explore', stageConclude: 'Conclude',
    nextStage: 'Next →', redoLabel: 'Redo',
    predictTitle: 'Predict',
    predictQuestion: 'The cell holds water with a little sodium sulfate added (pure water barely conducts; the salt boosts conductivity). Turn on DC power and watch the gases at both electrodes.',
    predictQ1: 'What gas forms at the positive electrode?',
    predictQ1O2: 'Oxygen (relights a glowing splint)',
    predictQ1H2: 'Hydrogen (burns)',
    predictQ2: 'The volume ratio of gas at positive : negative is about?',
    predictQ2Ratio21: 'about 1 : 2',
    predictQ2Ratio11: 'about 1 : 1',
    predictQ2Ratio12: 'about 2 : 1',
    predictDone: 'Your predictions are recorded', predictHint: 'Answer both to start',
    revealLabel: 'Turn on →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Turn it on or try a card, and note what you see.',
    notePlaceholder: 'Write one sentence: what did you observe?', recordLabel: 'Note it',
    clearLabel: 'Clear notes', tryLabel: 'Try it',
    cards: [
      { title: 'Power on', prompt: 'Turn on the power: bubbles rise at both electrodes — which side has more?' },
      { title: 'Test gases', prompt: 'Negative gas burns (H₂); positive gas relights a glowing splint (O₂).' },
      { title: 'Volume ratio', prompt: 'The negative tube collects about 2× the gas of the positive (H₂:O₂ = 2:1).' },
      { title: 'Free exploration', prompt: 'Watch bubble rates and volumes; think about what water is made of.' },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what does electrolysis of water show?',
    concludeHint: 'Answer all three questions, then check if your conclusion matches.',
    feedbackText:
      'In electrolysis, oxygen forms at the positive electrode and hydrogen at the negative, with V(H₂):V(O₂) = 2:1. ' +
      'This shows water is made of hydrogen and oxygen; it decomposes into H₂ and O₂ when current passes: ' +
      '2H₂O → 2H₂↑ + O₂↑.',
    tipsTitle: 'Key Points',
    tips: [
      'Electrolysis: positive (O) gives oxygen, negative (H) gives hydrogen, volume ratio H₂:O₂ = 2:1',
      'Negative H₂ burns; positive O₂ relights a glowing splint',
      'Water is made of hydrogen and oxygen elements (not H₂ and O₂ molecules)',
      'Decomposition: 2H₂O → 2H₂↑ + O₂↑',
      'Molecules can split in chemical change; atoms cannot',
    ],
    concludeQ1: 'Gas at the positive electrode?',
    concludeQ1O2: 'Oxygen',
    concludeQ1H2: 'Hydrogen',
    concludeQ2: 'Gas at the negative electrode?',
    concludeQ2H2: 'Hydrogen',
    concludeQ2O2: 'Oxygen',
    concludeQ3: 'Volume ratio H₂ : O₂ is about?',
    concludeQ3Ratio21: '2 : 1',
    concludeQ3Ratio11: '1 : 1',
    concludeQ3Ratio12: '1 : 2',
  },
};

type Lang = 'zh' | 'en';

const CORRECT_KEYS: Record<string, string[]> = {
  q1: ['o2'],
  q2: ['h2'],
  q3: ['ratio21'],
};

export default function Electrolysis() {
  const { lang } = useApp();
  const c = copy[lang as Lang] ?? copy.zh;

  const [stage, setStage] = useState<Stage>('predict');
  const [power, setPower] = useState(false);
  const [predict1, setPredict1] = useState<PredictQ1>(null);
  const [predict2, setPredict2] = useState<PredictQ2>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [obsId, setObsId] = useState(0);
  const [concl, setConcl] = useState<{ q1: string | null; q2: string | null; q3: string | null }>({ q1: null, q2: null, q3: null });
  const [showFeedback, setShowFeedback] = useState(false);
  const [showMicro, setShowMicro] = useState(false);

  const predComplete = predict1 !== null && predict2 !== null;
  const concludeComplete = concl.q1 && concl.q2 && concl.q3;

  // 通电时间进度（模拟气泡积累，2:1 体积比）
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!power) return;
    const t = setInterval(() => {
      setElapsed((e) => (e >= 1 ? 1 : Math.min(1, e + 0.02)));
    }, 60);
    return () => clearInterval(t);
  }, [power]);

  // 氢气体积（负极）与氧气体积（正极），2:1
  const hVol = elapsed * 20; // 负极，刻度到 20
  const oVol = elapsed * 10; // 正极，刻度到 10

  function redoAll() {
    setStage('predict');
    setPower(false); setElapsed(0);
    setPredict1(null); setPredict2(null);
    setObservations([]); setObsId(0);
    setConcl({ q1: null, q2: null, q3: null });
    setShowFeedback(false); setShowMicro(false);
  }

  function addObservation(note: string) {
    setObservations((prev) => [
      ...prev,
      {
        id: obsId,
        snapshot: [
          { label: '电源', value: power ? (lang === 'zh' ? '通电' : 'On') : (lang === 'zh' ? '断开' : 'Off') },
          { label: 'H₂', value: `${hVol.toFixed(0)}` },
          { label: 'O₂', value: `${oVol.toFixed(0)}` },
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
          setPower(true);
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
          <button type="button" onClick={redoAll} className="px-3 py-1.5 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg
)] transition-colors">{c.redoLabel}</button>
        </div>
      </div>
      {/* 问 AI：讲解本实验的原理与操作要点 */}
      <AskAiButton className="mt-2" question={lang === 'zh' ? '请讲解电解水的实验现象：正负极各产生什么气体，体积比是多少' : 'Explain the electrolysis of water: which gas forms at each electrode and the 2:1 volume ratio'} />


      {/* ── 电解器示意 ── */}
      <div className="border border-[var(--border)] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.readout}</h3>
          <button
            type="button"
            onClick={() => setPower((p) => !p)}
            className={`px-3 py-1.5 text-[11px] border transition-colors ${
              power ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
            }`}
          >
            {power ? (lang === 'zh' ? '断开电源' : 'Turn off') : (lang === 'zh' ? '接通电源' : 'Turn on')}
          </button>
        </div>
        <svg viewBox="0 0 400 230" className="w-full" aria-label="电解水实验" strokeLinecap="round" strokeLinejoin="round">
          {/* ── 双管电解器：两支竖直玻璃管，底部水平连通（教材图4-17 结构） ── */}
          {/* 左管（负极，H₂ 多） */}
          <path d="M111 50 V105 H145 V50" fill="none" stroke="var(--fg)" strokeWidth="1.5" />
          {/* 右管（正极，O₂ 少） */}
          <path d="M255 50 V105 H289 V50" fill="none" stroke="var(--fg)" strokeWidth="1.5" />
          {/* 底部连通横管（左管 → 右管） */}
          <path d="M111 105 H289" fill="none" stroke="var(--fg)" strokeWidth="1.5" />
          {/* 管口沿 */}
          <line x1="105" y1="50" x2="117" y2="50" stroke="var(--fg)" strokeWidth="1.5" />
          <line x1="283" y1="50" x2="295" y2="50" stroke="var(--fg)" strokeWidth="1.5" />

          {/* 水（两支管 + 底部连通管，液面在 y=72） */}
          <path
            d="M113 72 H145 V104 H255 V72 H287 V104 H113 Z"
            fill="rgba(70,150,220,0.2)"
            stroke="none"
          />
          {/* 液面线 */}
          <line x1="111" y1="72" x2="289" y2="72" stroke="var(--fg)" strokeWidth="0.8" strokeDasharray="4 3" />

          {/* 收集的气体（管上部，无色留空，虚线标记体积；H₂ 侧高，O₂ 侧矮 = 2:1） */}
          {power && (
            <>
              {/* 负极 H₂：气体体积高 */}
              <path d="M113 72 V55 H143 V72" fill="none" stroke="rgba(120,220,160,0.5)" strokeWidth="1.2" strokeDasharray="3 2" />
              <text x="128" y="66" textAnchor="middle" fontSize="10" fill="var(--fg)" fontFamily="var(--f-mono)">H₂ {hVol.toFixed(0)}</text>
              {/* 正极 O₂：气体体积矮（约一半） */}
              <path d="M257 72 V60 H287 V72" fill="none" stroke="rgba(120,180,240,0.5)" strokeWidth="1.2" strokeDasharray="3 2" />
              <text x="272" y="68" textAnchor="middle" fontSize="10" fill="var(--fg)" fontFamily="var(--f-mono)">O₂ {oVol.toFixed(0)}</text>
            </>
          )}
          {!power && (
            <>
              <text x="128" y="66" textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="var(--f-mono)">H₂</text>
              <text x="272" y="66" textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="var(--f-mono)">O₂</text>
            </>
          )}

          {/* 电极（碳棒从管顶插入水中）：极性符号与正负极文字都标在管顶部电极上端（导线连接处），贴合"电极从顶部插入、导线在顶部接电源"的原理 */}
          {/* 左电极：负极(−)，产 H₂ 多 */}
          <line x1="128" y1="60" x2="128" y2="96" stroke="var(--fg)" strokeWidth="1.5" strokeLinecap="round" />
          <text x="128" y="42" textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--f-mono)">负极</text>
          <text x="128" y="56" textAnchor="middle" fontSize="15" fill="var(--fg)" fontFamily="var(--f-mono)" fontWeight="bold">−</text>
          {/* 右电极：正极(+)，产 O₂ 少 */}
          <line x1="272" y1="60" x2="272" y2="96" stroke="var(--fg)" strokeWidth="1.5" strokeLinecap="round" />
          <text x="272" y="42" textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--f-mono)">正极</text>
          <text x="272" y="56" textAnchor="middle" fontSize="15" fill="var(--fg)" fontFamily="var(--f-mono)" fontWeight="bold">+</text>

          {/* 气泡（通电时，负极多、正极少） */}
          {power && (
            <>
              <circle cx="122" cy="80" r="2" fill="var(--fg)" opacity="0.6" />
              <circle cx="134" cy="86" r="2.4" fill="var(--fg)" opacity="0.6" />
              <circle cx="125" cy="92" r="1.6" fill="var(--fg)" opacity="0.5" />
              <circle cx="266" cy="82" r="1.5" fill="var(--fg)" opacity="0.5" />
              <circle cx="278" cy="88" r="1.2" fill="var(--fg)" opacity="0.4" />
            </>
          )}

          {/* 电源导线：从电极顶端 → 沿管外向下 → 到下方直流电源（电源在电解器外，不浸水） */}
          <line x1="128" y1="45" x2="128" y2="22" stroke="var(--fg)" strokeWidth="1.2" />
          <line x1="128" y1="22" x2="200" y2="22" stroke="var(--fg)" strokeWidth="1.2" />
          <line x1="272" y1="45" x2="272" y2="14" stroke="var(--fg)" strokeWidth="1.2" />
          <line x1="272" y1="14" x2="200" y2="14" stroke="var(--fg)" strokeWidth="1.2" />

          {/* 直流电源符号（在电解器上方外侧，细长矩形 + 正负极） */}
          <rect x="188" y="10" width="24" height="18" fill="none" stroke="var(--fg)" strokeWidth="1.2" />
          <line x1="196" y1="10" x2="196" y2="20" stroke="var(--fg)" strokeWidth="1.5" />
          <line x1="204" y1="10" x2="204" y2="20" stroke="var(--fg)" strokeWidth="1.2" />
          <text x="204" y="6" textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--f-mono)">+</text>
          <text x="196" y="6" textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--f-mono)">−</text>
          <text x="200" y="38" textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--f-mono)">直流电源</text>
        </svg>
        <p className="text-xs text-[var(--muted)] serif-font italic">
          {power
            ? (lang === 'zh' ? '负极产 H₂，正极产 O₂，体积比约 2:1。' : 'Negative gives H₂, positive gives O₂, ratio about 2:1.')
            : (lang === 'zh' ? '点击「接通电源」观察两极气泡。' : 'Click "Turn on" to watch bubbles at both electrodes.')}
        </p>
      </div>

      {/* ── 幕内容 ── */}
      {stage === 'predict' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.predictTitle}</h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{c.predictQuestion}</p>
          {renderConcludeQ('q1', c.predictQ1, [{ value: 'o2', label: c.predictQ1O2 }, { value: 'h2', label: c.predictQ1H2 }], predict1 as string, (v) => setPredict1(v as PredictQ1))}
          {renderConcludeQ('q2', c.predictQ2, [{ value: 'ratio21', label: c.predictQ2Ratio21 }, { value: 'ratio11', label: c.predictQ2Ratio11 }, { value: 'ratio12', label: c.predictQ2Ratio12 }], predict2 as string, (v) => setPredict2(v as PredictQ2))}
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
          {renderConcludeQ('q1', c.concludeQ1, [{ value: 'o2', label: c.concludeQ1O2 }, { value: 'h2', label: c.concludeQ1H2 }], concl.q1, (v) => setConcl((p) => ({ ...p, q1: v })))}
          {renderConcludeQ('q2', c.concludeQ2, [{ value: 'h2', label: c.concludeQ2H2 }, { value: 'o2', label: c.concludeQ2O2 }], concl.q2, (v) => setConcl((p) => ({ ...p, q2: v })))}
          {renderConcludeQ('q3', c.concludeQ3, [{ value: 'ratio21', label: c.concludeQ3Ratio21 }, { value: 'ratio11', label: c.concludeQ3Ratio11 }, { value: 'ratio12', label: c.concludeQ3Ratio12 }], concl.q3, (v) => setConcl((p) => ({ ...p, q3: v })))}
          {concludeComplete && !showFeedback && (
            <button type="button" onClick={() => setShowFeedback(true)} className="text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors">{c.concludeHint}</button>
          )}
          {showFeedback && (
            <div className="border-l-2 border-[var(--fg)] pl-3 space-y-2">
              <p className="text-sm serif-font text-[var(--fg)] leading-relaxed">{c.feedbackText}</p>
              <h4 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.tipsTitle}</h4>
              <ul className="space-y-1">{c.tips.map((tip, i) => <li key={i} className="text-xs text-[var(--fg)] serif-font leading-relaxed flex gap-2"><span className="text-[var(--muted)] mono-font shrink-0">{i + 1}.</span>{tip}</li>)}</ul>

              {/* 微观动画（可控播放） */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMicro((p) => !p)}
                  className={`px-3 py-1.5 text-[11px] border transition-colors ${
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
                      { label: 'H₂O', atoms: [{ id: 'o1', label: 'O', color: '#ef5350' }, { id: 'h1', label: 'H', color: '#4fc3f7' }, { id: 'h2', label: 'H', color: '#4fc3f7' }] },
                      { label: 'H₂O', atoms: [{ id: 'o2', label: 'O', color: '#ef5350' }, { id: 'h3', label: 'H', color: '#4fc3f7' }, { id: 'h4', label: 'H', color: '#4fc3f7' }] },
                    ]}
                    products={[
                      { label: 'H₂', atoms: [{ id: 'h1', label: 'H', color: '#4fc3f7' }, { id: 'h2', label: 'H', color: '#4fc3f7' }] },
                      { label: 'H₂', atoms: [{ id: 'h3', label: 'H', color: '#4fc3f7' }, { id: 'h4', label: 'H', color: '#4fc3f7' }] },
                      { label: 'O₂', atoms: [{ id: 'o1', label: 'O', color: '#ef5350' }, { id: 'o2', label: 'O', color: '#ef5350' }] },
                    ]}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
