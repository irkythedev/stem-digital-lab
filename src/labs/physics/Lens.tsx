/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 物理实验 · 凸透镜成像规律三幕式探究（苏科版 八上第3章）
 *
 * 幕 1 预测：给定 f=10cm，猜 u=25cm / u=15cm / u=5cm 时的成像性质
 * 幕 2 探索：物距滑块自由调节，光屏自动定位，实时成像 + 光路图
 * 幕 3 结论：总结 u>2f / u=2f / f<u<2f / u<f 四种情况
 *
 * 复用组件：LensBench（光具座 SVG）、ExploreStage（任务卡+笔记）、ParamSlider。
 */
import { useMemo, useState } from 'react';
import { useApp } from '../../lib/app-context';
import ParamSlider from '../../components/lab/ParamSlider';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import LensBench from '../../components/lab/LensBench';
import Formula from '../../components/ui/Formula';

type Stage = 'predict' | 'explore' | 'conclude';

/** 预测题：成像性质 */
type PredictType = 'real-inv-sm' | 'real-inv-eq' | 'real-inv-lg' | 'virt-upr-lg' | 'no-image' | null;

/** 物理模型：像距 v = uf/(u-f) */
function imageV(u: number, f: number): number | null {
  const diff = u - f;
  if (Math.abs(diff) < 0.01) return null;
  return (u * f) / diff;
}

/** 成像类型描述 */
function imageDesc(u: number, f: number, lang: 'zh' | 'en'): string {
  const v = imageV(u, f);
  if (v === null) return lang === 'zh' ? '光屏上无清晰实像（平行光）' : 'No clear screen image (parallel rays)';
  if (v < 0) return lang === 'zh' ? '正立放大虚像' : 'Upright, magnified, virtual';
  const mag = v / u;
  if (Math.abs(mag - 1) < 0.01) return lang === 'zh' ? '倒立等大实像' : 'Inverted, same size, real';
  if (mag > 1) return lang === 'zh' ? '倒立放大实像' : 'Inverted, magnified, real';
  return lang === 'zh' ? '倒立缩小实像' : 'Inverted, reduced, real';
}

const copy = {
  zh: {
    prompt: '先预测，再自由探索，最后自己下结论。每一步都可以来回调整。',
    params: '参数',
    readout: '读数',
    reset: '重置',
    stagePredict: '预测',
    stageExplore: '探索',
    stageConclude: '结论',
    stageDone: '完成',
    nextStage: '下一步 →',
    redoLabel: '再次实验',
    // 幕1 预测
    predictTitle: '预测',
    predictQuestion: '凸透镜焦距 f = 10cm。',
    predictQuestion2: '先别急着看光路，猜一猜在不同物距下会成什么像：',
    predictQ1: 'u = 25cm（u > 2f）时，像的性质是？',
    predictQ1RealInvSm: '倒立缩小的实像',
    predictQ1RealInvEq: '倒立等大的实像',
    predictQ1RealInvLg: '倒立放大的实像',
    predictQ1VirtUprLg: '正立放大的虚像',
    predictQ2: 'u = 15cm（f < u < 2f）时，像的性质是？',
    predictQ2RealInvSm: '倒立缩小的实像',
    predictQ2RealInvEq: '倒立等大的实像',
    predictQ2RealInvLg: '倒立放大的实像',
    predictQ2VirtUprLg: '正立放大的虚像',
    predictQ3: 'u = 5cm（u < f）时，像的性质是？',
    predictQ3RealInvSm: '倒立缩小的实像',
    predictQ3RealInvLg: '倒立放大的实像',
    predictQ3VirtUprLg: '正立放大的虚像',
    predictQ3NoImage: '光屏上不能得到清晰实像（出射光近似平行）',
    predictDone: '已记录你的预测',
    predictHint: '三个都猜完，就可以揭示光路',
    revealLabel: '揭示光路 →',
    // 幕2 探索
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。拖动滑块或点任务卡，看到有意思的状态时记一条。',
    notePlaceholder: '写一句话：你观察到了什么？',
    recordLabel: '记一条观察',
    clearLabel: '清空记录',
    tryLabel: '试试这个',
    showRaysLabel: '显示光路图',
    hideRaysLabel: '隐藏光路图',
    cards: [
      {
        title: 'u > 2f（照相机）',
        prompt: '把物距调到 u > 20cm（如 25cm），观察光屏上的像：倒立还是正立？放大还是缩小？',
      },
      {
        title: 'u = 2f（测焦距）',
        prompt: '把物距调到 u = 20cm，观察像距 v 是多少？像的大小和物体比呢？',
      },
      {
        title: 'f < u < 2f（投影仪）',
        prompt: '把物距调到 10~20cm 之间（如 15cm），观察像的变化：比 u>2f 时大了还是小了？',
      },
      {
        title: 'u < f（放大镜）',
        prompt: '把物距调到 u < 10cm（如 5cm），光屏上还有像吗？从透镜另一侧看过去呢？',
      },
      {
        title: 'u = f（光屏上无清晰实像）',
        prompt: '把物距调到 u = 10cm，光屏上还有像吗？为什么？',
      },
      {
        title: '自由探索',
        prompt: '任意拖动物距滑块，观察成像变化规律。打开光路图看看光线是怎么走的。',
      },
    ],
    // 幕3 结论
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，凸透镜成像有什么规律？',
    concludeSkipHint: '还没在预测幕猜过——建议先回预测幕完成预测，再做结论会更有意义。',
    concludeHint: '选完四题，看看结论和你的观察是否一致',
    feedbackText:
      '凸透镜成像规律：u>2f 成倒立缩小实像（照相机），u=2f 成倒立等大实像（测焦距），' +
      'f<u<2f 成倒立放大实像（投影仪），u<f 成正立放大虚像（放大镜）。' +
      'u=f 时光屏上不能得到清晰实像，出射光近似平行。物距越小，像距越大，像也越大。',
    tipsTitle: '考点速记',
    tips: [
      'u>2f → 倒立缩小实像，f<v<2f（照相机原理）',
      'u=2f → 倒立等大实像，v=2f（可用于测焦距）',
      'f<u<2f → 倒立放大实像，v>2f（投影仪原理）',
      'u<f → 正立放大虚像（放大镜原理）',
      'u=f → 光屏上无清晰实像（出射光近似平行）',
      '物距越小，像距越大，像越大（成实像时）',
    ],
    concludeQ1: 'u > 2f 时成什么像？',
    concludeQ1RealInvSm: '倒立缩小实像',
    concludeQ1RealInvEq: '倒立等大实像',
    concludeQ1RealInvLg: '倒立放大实像',
    concludeQ1VirtUprLg: '正立放大虚像',
    concludeQ2: 'f < u < 2f 时成什么像？',
    concludeQ2RealInvSm: '倒立缩小实像',
    concludeQ2RealInvEq: '倒立等大实像',
    concludeQ2RealInvLg: '倒立放大实像',
    concludeQ2VirtUprLg: '正立放大虚像',
    concludeQ3: 'u < f 时成什么像？',
    concludeQ3RealInvSm: '倒立缩小实像',
    concludeQ3RealInvLg: '倒立放大实像',
    concludeQ3VirtUprLg: '正立放大虚像',
    concludeQ3NoImage: '光屏上不能得到清晰实像',
    concludeQ4: 'u = 2f 时像距 v 等于？',
    concludeQ4V2f: 'v = 2f',
    concludeQ4Vf: 'v = f',
    concludeQ4Vgt2f: 'v > 2f',
    concludeQ4Vltf: 'v < f',
  },
  en: {
    prompt: 'Predict first, explore freely, then draw your own conclusion. You can move back and forth at any time.',
    params: 'Parameters',
    readout: 'Readings',
    reset: 'Reset',
    stagePredict: 'Predict',
    stageExplore: 'Explore',
    stageConclude: 'Conclude',
    stageDone: 'Done',
    nextStage: 'Next →',
    redoLabel: 'Redo',
    predictTitle: 'Predict',
    predictQuestion: 'Convex lens f = 10cm.',
    predictQuestion2: 'Before seeing the light path, guess the image type at different object distances:',
    predictQ1: 'u = 25cm (u > 2f): what image forms?',
    predictQ1RealInvSm: 'Inverted, reduced, real',
    predictQ1RealInvEq: 'Inverted, same size, real',
    predictQ1RealInvLg: 'Inverted, magnified, real',
    predictQ1VirtUprLg: 'Upright, magnified, virtual',
    predictQ2: 'u = 15cm (f < u < 2f): what image forms?',
    predictQ2RealInvSm: 'Inverted, reduced, real',
    predictQ2RealInvEq: 'Inverted, same size, real',
    predictQ2RealInvLg: 'Inverted, magnified, real',
    predictQ2VirtUprLg: 'Upright, magnified, virtual',
    predictQ3: 'u = 5cm (u < f): what image forms?',
    predictQ3RealInvSm: 'Inverted, reduced, real',
    predictQ3RealInvLg: 'Inverted, magnified, real',
    predictQ3VirtUprLg: 'Upright, magnified, virtual',
    predictQ3NoImage: 'No clear image can be formed on the screen (emergent rays are approximately parallel)',
    predictDone: 'Your predictions are recorded',
    predictHint: 'Answer all three to reveal the light path',
    revealLabel: 'Reveal light path →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Drag the slider or try a card, and note what you see.',
    notePlaceholder: 'Write one sentence: what did you observe?',
    recordLabel: 'Note it',
    clearLabel: 'Clear notes',
    tryLabel: 'Try it',
    showRaysLabel: 'Show rays',
    hideRaysLabel: 'Hide rays',
    cards: [
      {
        title: 'u > 2f (camera)',
        prompt: 'Set u > 20cm (e.g. 25cm). Is the image on the screen inverted or upright? Magnified or reduced?',
      },
      {
        title: 'u = 2f (focal length)',
        prompt: 'Set u = 20cm. What is the image distance v? How does the image size compare to the object?',
      },
      {
        title: 'f < u < 2f (projector)',
        prompt: 'Set u between 10~20cm (e.g. 15cm). Is the image larger or smaller than at u>2f?',
      },
      {
        title: 'u < f (magnifier)',
        prompt: 'Set u < 10cm (e.g. 5cm). Is there an image on the screen? Look through the lens from the other side.',
      },
      {
        title: 'u = f (no clear screen image)',
        prompt: 'Set u = 10cm. Is there an image on the screen? Why?',
      },
      {
        title: 'Free exploration',
        prompt: 'Drag the slider freely and observe how the image changes. Turn on the ray diagram to see how light travels.',
      },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what are the rules of convex lens imaging?',
    concludeSkipHint: "You haven't made predictions yet — consider going back to the Predict stage first.",
    concludeHint: 'Answer all four questions, then check if your conclusion matches your observations.',
    feedbackText:
      'Convex lens rules: u>2f → inverted reduced real image (camera), u=2f → inverted same-size real image (focal length measurement), ' +
      'f<u<2f → inverted magnified real image (projector), u<f → upright magnified virtual image (magnifier). ' +
      'At u=f, no clear image can be formed on the screen because the emergent rays are approximately parallel. Smaller object distance → larger image distance → larger image (for real images).',
    tipsTitle: 'Key Points',
    tips: [
      'u>2f → inverted reduced real image, f<v<2f (camera)',
      'u=2f → inverted same-size real image, v=2f (measure focal length)',
      'f<u<2f → inverted magnified real image, v>2f (projector)',
      'u<f → upright magnified virtual image (magnifier)',
      'u=f → no clear screen image (emergent rays are approximately parallel)',
      'Smaller u → larger v → larger image (real images)',
    ],
    concludeQ1: 'u > 2f: what image?',
    concludeQ1RealInvSm: 'Inverted, reduced, real',
    concludeQ1RealInvEq: 'Inverted, same size, real',
    concludeQ1RealInvLg: 'Inverted, magnified, real',
    concludeQ1VirtUprLg: 'Upright, magnified, virtual',
    concludeQ2: 'f < u < 2f: what image?',
    concludeQ2RealInvSm: 'Inverted, reduced, real',
    concludeQ2RealInvEq: 'Inverted, same size, real',
    concludeQ2RealInvLg: 'Inverted, magnified, real',
    concludeQ2VirtUprLg: 'Upright, magnified, virtual',
    concludeQ3: 'u < f: what image?',
    concludeQ3RealInvSm: 'Inverted, reduced, real',
    concludeQ3RealInvLg: 'Inverted, magnified, real',
    concludeQ3VirtUprLg: 'Upright, magnified, virtual',
    concludeQ3NoImage: 'No clear real image can be formed on the screen',
    concludeQ4: 'u = 2f: image distance v = ?',
    concludeQ4V2f: 'v = 2f',
    concludeQ4Vf: 'v = f',
    concludeQ4Vgt2f: 'v > 2f',
    concludeQ4Vltf: 'v < f',
  },
};

type Lang = 'zh' | 'en';

/** 结论题正确选项 */
const CORRECT_KEYS: Record<string, string[]> = {
  q1: ['real-inv-sm'],
  q2: ['real-inv-lg'],
  q3: ['virt-upr-lg'],
  q4: ['v2f'],
};

export default function Lens() {
  const { lang } = useApp();
  const c = copy[lang as Lang] ?? copy.zh;

  const [stage, setStage] = useState<Stage>('predict');
  const [u, setU] = useState(25);
  const [showRays, setShowRays] = useState(false);
  const [predict1, setPredict1] = useState<PredictType>(null);
  const [predict2, setPredict2] = useState<PredictType>(null);
  const [predict3, setPredict3] = useState<PredictType>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [obsId, setObsId] = useState(0);
  const [conclude1, setConclude1] = useState<string | null>(null);
  const [conclude2, setConclude2] = useState<string | null>(null);
  const [conclude3, setConclude3] = useState<string | null>(null);
  const [conclude4, setConclude4] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const predComplete = predict1 !== null && predict2 !== null && predict3 !== null;
  const concludeComplete = conclude1 && conclude2 && conclude3 && conclude4;

  const f = 10;
  const v = useMemo(() => imageV(u, f), [u, f]);
  const desc = useMemo(() => imageDesc(u, f, lang as Lang), [u, f, lang]);

  function redoAll() {
    setStage('predict');
    setU(25);
    setShowRays(false);
    setPredict1(null);
    setPredict2(null);
    setPredict3(null);
    setObservations([]);
    setObsId(0);
    setConclude1(null);
    setConclude2(null);
    setConclude3(null);
    setConclude4(null);
    setShowFeedback(false);
  }

  function addObservation(note: string) {
    const snapshot = [
      { label: 'u', value: `${u.toFixed(1)} cm` },
      { label: 'v', value: v !== null ? `${v.toFixed(1)} cm` : '无清晰实像' },
      { label: '像', value: desc },
    ];
    setObservations((prev) => [
      ...prev,
      { id: obsId, snapshot, note },
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
          if (card.title.includes('u > 2f') || card.title.includes('u > 20cm')) setU(25);
          else if (card.title.includes('u = 2f') || card.title.includes('u = 20cm')) setU(20);
          else if (card.title.includes('f < u < 2f') || card.title.includes('u between')) setU(15);
          else if (card.title.includes('u < f') || card.title.includes('u < 10cm')) setU(5);
          else if (card.title.includes('u = f') || card.title.includes('u = 10cm')) setU(10);
        },
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
      <div className="flex items-center gap-3 text-[11px] mono-font tracking-widest">
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
              className={`px-3 py-1.5 border transition-colors ${
                stage === s
                  ? 'border-[var(--fg)] text-[var(--fg)]'
                  : isDone
                    ? 'border-[var(--border)] text-[var(--muted)]'
                    : 'border-[var(--border)] text-[var(--muted)] opacity-50'
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
            className="px-3 py-1.5 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] transition-colors"
          >
            {c.redoLabel}
          </button>
        </div>
      </div>

      {/* ── 光具座 ── */}
      <div className="border border-[var(--border)] p-3">
        <LensBench u={u} f={f} showRays={showRays} />
      </div>

      {/* ── 参数 ── */}
      <div className="border border-[var(--border)] p-4 space-y-3">
        <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
          // {c.params}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <ParamSlider
            label="u (cm)"
            value={u}
            min={2}
            max={40}
            step={0.5}
            onChange={setU}
            format={(v) => `${v.toFixed(1)} cm`}
          />
          <div className="flex items-center gap-4">
            <div className="text-sm mono-font text-[var(--fg)]">
              <span className="text-[var(--muted)]">f = </span>{f} cm
            </div>
            <div className="text-sm mono-font text-[var(--fg)]">
              <span className="text-[var(--muted)]">v = </span>
              {v !== null ? `${v.toFixed(1)} cm` : '—'}
            </div>
            <div className="text-sm mono-font text-[var(--fg)]">
              <span className="text-[var(--muted)]">{lang === 'zh' ? '像' : 'Image'}: </span>
              {desc}
            </div>
          </div>
        </div>
        {stage === 'explore' && (
          <button
            type="button"
            onClick={() => setShowRays((p) => !p)}
            className={`px-3 py-1.5 text-[11px] border transition-colors ${
              showRays
                ? 'border-[var(--fg)] text-[var(--fg)]'
                : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
            }`}
          >
            {showRays ? c.hideRaysLabel : c.showRaysLabel}
          </button>
        )}
      </div>

      {/* ── 幕内容 ── */}

      {stage === 'predict' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
            // {c.predictTitle}
          </h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
            {c.predictQuestion}
          </p>
          <p className="text-sm serif-font text-[var(--muted)]">
            {c.predictQuestion2}
          </p>

          {/* Q1: u=25cm */}
          <div className="space-y-2">
            <p className="text-sm serif-font text-[var(--fg)]">{c.predictQ1}</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {[
                { value: 'real-inv-sm', label: c.predictQ1RealInvSm },
                { value: 'real-inv-eq', label: c.predictQ1RealInvEq },
                { value: 'real-inv-lg', label: c.predictQ1RealInvLg },
                { value: 'virt-upr-lg', label: c.predictQ1VirtUprLg },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPredict1(opt.value as PredictType)}
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

          {/* Q2: u=15cm */}
          <div className="space-y-2">
            <p className="text-sm serif-font text-[var(--fg)]">{c.predictQ2}</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {[
                { value: 'real-inv-sm', label: c.predictQ2RealInvSm },
                { value: 'real-inv-eq', label: c.predictQ2RealInvEq },
                { value: 'real-inv-lg', label: c.predictQ2RealInvLg },
                { value: 'virt-upr-lg', label: c.predictQ2VirtUprLg },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPredict2(opt.value as PredictType)}
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

          {/* Q3: u=5cm */}
          <div className="space-y-2">
            <p className="text-sm serif-font text-[var(--fg)]">{c.predictQ3}</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {[
                { value: 'real-inv-sm', label: c.predictQ3RealInvSm },
                { value: 'real-inv-lg', label: c.predictQ3RealInvLg },
                { value: 'virt-upr-lg', label: c.predictQ3VirtUprLg },
                { value: 'no-image', label: c.predictQ3NoImage },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPredict3(opt.value as PredictType)}
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
      )}

      {stage === 'conclude' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
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
              { value: 'real-inv-sm', label: c.concludeQ1RealInvSm },
              { value: 'real-inv-eq', label: c.concludeQ1RealInvEq },
              { value: 'real-inv-lg', label: c.concludeQ1RealInvLg },
              { value: 'virt-upr-lg', label: c.concludeQ1VirtUprLg },
            ],
            conclude1,
            setConclude1,
          )}

          {renderConcludeQ(
            'q2',
            c.concludeQ2,
            [
              { value: 'real-inv-sm', label: c.concludeQ2RealInvSm },
              { value: 'real-inv-eq', label: c.concludeQ2RealInvEq },
              { value: 'real-inv-lg', label: c.concludeQ2RealInvLg },
              { value: 'virt-upr-lg', label: c.concludeQ2VirtUprLg },
            ],
            conclude2,
            setConclude2,
          )}

          {renderConcludeQ(
            'q3',
            c.concludeQ3,
            [
              { value: 'real-inv-sm', label: c.concludeQ3RealInvSm },
              { value: 'real-inv-lg', label: c.concludeQ3RealInvLg },
              { value: 'virt-upr-lg', label: c.concludeQ3VirtUprLg },
              { value: 'no-image', label: c.concludeQ3NoImage },
            ],
            conclude3,
            setConclude3,
          )}

          {renderConcludeQ(
            'q4',
            c.concludeQ4,
            [
              { value: 'v2f', label: c.concludeQ4V2f },
              { value: 'vf', label: c.concludeQ4Vf },
              { value: 'vgt2f', label: c.concludeQ4Vgt2f },
              { value: 'vltf', label: c.concludeQ4Vltf },
            ],
            conclude4,
            setConclude4,
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
              <div>
                <h4 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-2">
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
