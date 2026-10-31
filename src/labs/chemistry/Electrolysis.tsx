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
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { setLabState, setPageQuestion } from '../../lib/ai-dynamic-questions';
import { useApp } from '../../lib/app-context';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import MicroAnimation from '../../components/lab/MicroAnimation';
import Formula from '../../components/ui/Formula';
import StageNav from '../../components/lab/StageNav';

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
    predictQ1O2: '氧气（使带火星木条复燃）',
    predictQ1H2: '氢气（能燃烧，点燃前验纯）',
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
      { title: '通电观察', prompt: '接通电源，看正极和负极各有多少气泡冒出、两侧液面下降得多快。' },
      { title: '体积比', prompt: '把两管气体收满，对照管身刻度读一读：负极与正极的气体体积比是多少？' },
      { title: '检验气体', prompt: '把两极的气体分别点燃、插入带火星木条：负极气体能燃烧，正极气体使木条复燃。' },
      { title: '微观本质', prompt: '看微观动画：水分子怎样分裂成原子，原子又怎样重新组合成 H₂ 和 O₂？' },
    ],
    microTitle: '微观本质',
    microShow: '展开微观动画', microHide: '收起微观动画',
    microHint: '展开后可以逐阶段看：分子结合态 → 旧键断裂成原子 → 原子重新组合成新分子。',
    focusHint: {
      power: '通电中：观察两极气泡多少，以及两侧液面下降的快慢（负极下降更快）。',
      ratio: '两管气体已收满：对照管身刻度读 H₂ 20 mL、O₂ 10 mL，体积比 H₂:O₂ = 2:1。',
      test: '检验气体：负极气体点燃产生淡蓝色火焰；正极气体使带火星木条复燃。',
      micro: '微观本质：水分子在通电条件下分裂成氢原子与氧原子，原子再重新组合成 H₂ 和 O₂。',
    },
    ratioTag: 'V(H₂) : V(O₂) = 2 : 1',
    levelDrop: '液面下降',
    testH2: '负极 H₂：燃烧，淡蓝色火焰',
    testO2: '正极 O₂：带火星木条复燃',
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，电解水说明了什么？',
    concludeHint: '选完三题，看看结论和你的观察是否一致',
    eqWater: '2\\mathrm{H_2O} \\xrightarrow{\\ \\text{通电}\\ } 2\\mathrm{H_2\\uparrow} + \\mathrm{O_2\\uparrow}',
    feedbackText:
      '电解水时，正极产生氧气、负极产生氢气，体积比 V(H₂):V(O₂) = 2:1。' +
      '这说明水由氢元素和氧元素组成，水在通电条件下分解为氢气和氧气（见下式）。',
    tipsTitle: '考点速记',
    tips: [
      '电解水：正极（O）产氧气，负极（H）产氢气，体积比 H₂:O₂ = 2:1',
      '负极产氢气（可燃，点燃前须检验纯度）；正极产氧气（能使带火星木条复燃）',
      '水由氢、氧两种元素组成（不能说成氢分子和氧分子）',
      '水在通电条件下分解，属于分解反应（方程式见下）',
      '分子在化学变化中可以再分，原子不能再分',
    ],
    concludeQ1: '正极产生的是什么气体？',
    concludeQ1O2: '氧气 O₂',
    concludeQ1H2: '氢气 H₂',
    concludeQ2: '负极产生的是什么气体？',
    concludeQ2H2: '氢气 H₂',
    concludeQ2O2: '氧气 O₂',
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
    predictQ1H2: 'Hydrogen (burns; test purity first)',
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
      { title: 'Power on', prompt: 'Turn on the power: how many bubbles appear at each electrode, and how fast do the two liquid levels fall?' },
      { title: 'Volume ratio', prompt: 'Let both tubes fill, then read the tube markings: what is the volume ratio of negative to positive?' },
      { title: 'Test gases', prompt: 'Ignite each gas and hold a glowing splint to it: the negative gas burns, the positive gas relights the splint.' },
      { title: 'Microscopic view', prompt: 'Watch the micro animation: how do water molecules split into atoms and recombine into H₂ and O₂?' },
    ],
    microTitle: 'Microscopic view',
    microShow: 'Show micro animation', microHide: 'Hide micro animation',
    microHint: 'Open it to step through: bound molecules → bonds break into atoms → atoms recombine into new molecules.',
    focusHint: {
      power: 'Powered on: watch how many bubbles form at each electrode and how fast the two levels fall (the negative side drops faster).',
      ratio: 'Both tubes are full: read the markings — H₂ 20 mL and O₂ 10 mL, so V(H₂):V(O₂) = 2:1.',
      test: 'Gas tests: the negative gas burns with a pale blue flame; the positive gas relights a glowing splint.',
      micro: 'Microscopic view: water molecules split into hydrogen and oxygen atoms, which recombine into H₂ and O₂.',
    },
    ratioTag: 'V(H₂) : V(O₂) = 2 : 1',
    levelDrop: 'level falls',
    testH2: 'Negative H₂: burns, pale blue flame',
    testO2: 'Positive O₂: relights a glowing splint',
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what does electrolysis of water show?',
    concludeHint: 'Answer all three questions, then check if your conclusion matches.',
    eqWater: '2\\mathrm{H_2O} \\xrightarrow{\\ \\text{electric current}\\ } 2\\mathrm{H_2\\uparrow} + \\mathrm{O_2\\uparrow}',
    feedbackText:
      'In electrolysis, oxygen forms at the positive electrode and hydrogen at the negative, with V(H₂):V(O₂) = 2:1. ' +
      'This shows water is made of hydrogen and oxygen; it decomposes into H₂ and O₂ when current passes (see the equation below).',
    tipsTitle: 'Key Points',
    tips: [
      'Electrolysis: positive (O) gives oxygen, negative (H) gives hydrogen, volume ratio H₂:O₂ = 2:1',
      'Negative H₂ burns; positive O₂ relights a glowing splint',
      'Water is made of hydrogen and oxygen elements (not H₂ and O₂ molecules)',
      'Water decomposes under an electric current — a decomposition reaction (equation below)',
      'Molecules can split in chemical change; atoms cannot',
    ],
    concludeQ1: 'Gas at the positive electrode?',
    concludeQ1O2: 'Oxygen gas (O₂)',
    concludeQ1H2: 'Hydrogen gas (H₂)',
    concludeQ2: 'Gas at the negative electrode?',
    concludeQ2H2: 'Hydrogen gas (H₂)',
    concludeQ2O2: 'Oxygen gas (O₂)',
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

/** 判定标记图标：统一 Lucide 矢量图标与尺寸/对齐，禁用「对勾 / 叉号」文本字符充当图标（全站图标纪律） */
const MARK_CLS = 'inline-block w-3.5 h-3.5 align-middle mr-1';

/** 选项定义（value + 文案键），数组顺序即渲染顺序。
 *  顺序已打乱：正确项不再恒在首位，避免「总选第一项」蒙对。
 *  判题按 value 比对（CORRECT_KEYS），与渲染顺序解耦，故重排不影响正误判定。 */
export const OPTIONS = {
  predictQ1: [['h2', 'predictQ1H2'], ['o2', 'predictQ1O2']],
  predictQ2: [['ratio11', 'predictQ2Ratio11'], ['ratio12', 'predictQ2Ratio12'], ['ratio21', 'predictQ2Ratio21']],
  concludeQ1: [['o2', 'concludeQ1O2'], ['h2', 'concludeQ1H2']],
  concludeQ2: [['o2', 'concludeQ2O2'], ['h2', 'concludeQ2H2']],
  concludeQ3: [['ratio21', 'concludeQ3Ratio21'], ['ratio11', 'concludeQ3Ratio11'], ['ratio12', 'concludeQ3Ratio12']],
} as const;

/** 题号 → 判题正确值（供渲染与守卫共用的对照表） */
export const QUIZ_CORRECT: Record<string, string[]> = {
  predictQ1: ['o2'],
  predictQ2: ['ratio21'],
  concludeQ1: CORRECT_KEYS.q1,
  concludeQ2: CORRECT_KEYS.q2,
  concludeQ3: CORRECT_KEYS.q3,
};

/** 气泡粒子：从电极附近浮力上浮，触到所在管液面即破裂重置（绝不穿透液面进入气室） */
interface Bubble { id: number; x: number; r: number; y: number; v: number; }

/** 气泡初始横向位置与半径：负极（H₂ 侧）多且大，正极（O₂ 侧）少且小 */
const BUBBLE_SEEDS = [
  { x: 117, r: 1.6 }, { x: 124, r: 2.2 }, { x: 131, r: 1.4 }, { x: 139, r: 1.9 },
  { x: 261, r: 1.2 }, { x: 268, r: 1.6 }, { x: 276, r: 1.0 }, { x: 283, r: 1.3 },
];
const TUBE_BOTTOM = 100;   // 电极下端附近（气泡生成处）
const BUBBLE_ACC = 26;     // px/s²：浮力加速度
const BUBBLE_VMAX = 30;    // px/s：收尾速度
const LEFT_TUBE_X = 200;   // 分界：x < 200 属左管（负极）

function seedBubbles(): Bubble[] {
  return BUBBLE_SEEDS.map((s, i) => ({
    id: i, x: s.x, r: s.r,
    y: TUBE_BOTTOM - (i % 3) * 8,
    v: 3 + (i % 4) * 4,
  }));
}

/** 4 张探索卡的探究动作主题：必须互异（禁止「一律只 setPower(true)」），与 copy.cards 顺序一一对应 */
export const CARD_FOCUS = ['power', 'ratio', 'test', 'micro'] as const;
export type CardFocus = (typeof CARD_FOCUS)[number];

/** 刻度线位置（两管共用）：主/副交替，使学生能直接对照读数 */
export const TICK_YS = [56, 62, 68, 74, 80, 86, 92, 98];
/** 管口内沿 y：气体从管口开始积攒，故液面高度 = 管口 + 气柱高度 */
export const MOUTH_Y = 50;
/** H₂ 侧收满时的气柱高度（px，对应 20 mL）；O₂ 侧恰为其一半（18px ↔ 10 mL），
 *  使「H₂:O₂ = 2:1」在图上就是可量可读的真实几何，而不是只写在文字里 */
export const GAS_COL_MAX = 36;

/** 气柱高度（px）：H₂ 侧 : O₂ 侧 恒为 2:1，且收满时两端都落在刻度线上 */
export function gasColumn(elapsed: number): { h2: number; o2: number } {
  const e = Math.max(0, Math.min(1, elapsed));
  return { h2: GAS_COL_MAX * e, o2: (GAS_COL_MAX / 2) * e };
}

/** 电解水微观动画的粒子规格：探索幕与结论幕共用同一份定义，避免两处漂移。
 *  原子顺序保持不变——MicroAnimation 按原子顺序决定两翼分布（H₂O 的 O 必须在首位）。 */
const MICRO_REACTANTS = [
  { label: 'H₂O', atoms: [{ id: 'o1', label: 'O', color: '#ef5350' }, { id: 'h1', label: 'H', color: '#4fc3f7' }, { id: 'h2', label: 'H', color: '#4fc3f7' }] },
  { label: 'H₂O', atoms: [{ id: 'o2', label: 'O', color: '#ef5350' }, { id: 'h3', label: 'H', color: '#4fc3f7' }, { id: 'h4', label: 'H', color: '#4fc3f7' }] },
];
const MICRO_PRODUCTS = [
  { label: 'H₂', atoms: [{ id: 'h1', label: 'H', color: '#4fc3f7' }, { id: 'h2', label: 'H', color: '#4fc3f7' }] },
  { label: 'H₂', atoms: [{ id: 'h3', label: 'H', color: '#4fc3f7' }, { id: 'h4', label: 'H', color: '#4fc3f7' }] },
  { label: 'O₂', atoms: [{ id: 'o1', label: 'O', color: '#ef5350' }, { id: 'o2', label: 'O', color: '#ef5350' }] },
];

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
  /** 当前聚焦的探究主题：4 张探索卡各有互异的动作与视觉焦点（禁止一律只通电） */
  const [focus, setFocus] = useState<CardFocus | null>(null);
  /** 气体检验动画的播放序号：0 = 未检验；每次点击 +1 靠 key 重挂载重播 */
  const [gasTest, setGasTest] = useState(0);
  /** 探索幕的「微观本质」区域是否展开，以及滚动序号（重复点同一张卡也要重新滚回去） */
  const [microOpen, setMicroOpen] = useState(false);
  const [microEpoch, setMicroEpoch] = useState(0);
  const microRef = useRef<HTMLDivElement>(null);

  // 卡 4：等微观区域挂载后平滑滚动过去（减动效偏好下用即时滚动）
  useEffect(() => {
    if (microEpoch === 0) return;
    const el = microRef.current;
    if (!el) return;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  }, [microEpoch, microOpen]);

  const predComplete = predict1 !== null && predict2 !== null;
  const concludeComplete = Boolean(concl.q1 && concl.q2 && concl.q3);

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

  // 液面：气体自管口起算。收满时 H₂ 侧气柱 36px（20 mL）、O₂ 侧 18px（10 mL），
  // 比值恰为 2:1，且两侧液面分别落在刻度线 y=86 / y=68 上，可直接对照读数。
  const col = gasColumn(elapsed);
  const leftLevel = MOUTH_Y + col.h2;   // H₂ 侧液面
  const rightLevel = MOUTH_Y + col.o2;  // O₂ 侧液面
  const levelRef = useRef({ left: leftLevel, right: rightLevel });
  levelRef.current = { left: leftLevel, right: rightLevel };

  // 气泡粒子：浮力加速上浮 → 触到所在管当前液面即破裂重置，永不进入气室
  const [bubbles, setBubbles] = useState<Bubble[]>(seedBubbles);
  useEffect(() => {
    if (!power) { setBubbles(seedBubbles()); return; }
    // 偏好减动效时不做循环动画（全局 CSS 兜底管不到 rAF）
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { left, right } = levelRef.current;
      setBubbles((prev) =>
        prev.map((b) => {
          const surface = b.x < LEFT_TUBE_X ? left : right;
          const v = Math.min(BUBBLE_VMAX, b.v + BUBBLE_ACC * dt); // 浮力加速，受收尾速度约束
          const y = b.y - v * dt;
          // y 越小越靠上；够到液面即破裂并在电极附近重新生成，故 y 恒在液面之下
          return y - b.r <= surface + 1 ? { ...b, y: TUBE_BOTTOM, v: 3 } : { ...b, y, v };
        }),
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [power]);

  function redoAll() {
    setStage('predict');
    setPower(false); setElapsed(0);
    setPredict1(null); setPredict2(null);
    setObservations([]); setObsId(0);
    setConcl({ q1: null, q2: null, q3: null });
    setShowFeedback(false); setShowMicro(false);
    setFocus(null); setGasTest(0); setMicroOpen(false); setMicroEpoch(0);
    setBubbles(seedBubbles());
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
      c.cards.map((card, i) => {
        const f: CardFocus = CARD_FOCUS[i] ?? 'power';
        return {
          key: card.title,
          title: card.title,
          prompt: card.prompt,
          tryLabel: c.tryLabel,
          tryIt: () => {
            // 4 张卡各自动作不同：通电观察 / 体积比 / 检验气体 / 微观本质
            setPower(true);
            setFocus(f);
            if (f === 'ratio' || f === 'test') setElapsed(1); // 读数与检验都需要两管气体收满
            if (f === 'test') setGasTest((n) => n + 1);       // 递增序号 → key 重挂载重播
            if (f === 'micro') { setMicroOpen(true); setMicroEpoch((n) => n + 1); }
          },
        };
      }),
    [c],
  );

  /** 按 OPTIONS 定义的顺序生成选项（文案键 → 当前语言文案） */
  const opts = (key: keyof typeof OPTIONS) =>
    OPTIONS[key].map(([value, labelKey]) => ({
      value: value as string,
      label: (c as unknown as Record<string, string>)[labelKey],
    }));

  function renderQ(question: string, options: { value: string; label: string }[], selected: string | null, onSelect: (v: string) => void, correctKeys: string[]) {
    return (
      <div className="space-y-2">
        <p className="text-sm serif-font text-[var(--fg)]">{question}</p>
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
          {options.map((opt) => {
            const isSel = selected === opt.value;
            const isCorrect = correctKeys.includes(opt.value);
            let cls = 'text-left text-xs sm:text-sm px-3 py-2.5 border rounded-lg transition-colors ';
            if (showFeedback) {
              if (isSel && isCorrect) cls += 'border-[var(--fg)] bg-[var(--accent-light)] text-[var(--fg)] font-semibold';
              else if (isSel && !isCorrect) cls += 'border-[var(--error)] text-[var(--error)]';
              else if (!isSel && isCorrect) cls += 'border-[var(--border)] text-[var(--muted)]';
              else cls += 'border-[var(--border)] text-[var(--muted)] opacity-50';
            } else {
              cls += isSel ? 'border-[var(--fg)] bg-[var(--accent-light)] text-[var(--fg)] font-semibold' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]';
            }
            return (
              <button key={opt.value} type="button" onClick={() => onSelect(opt.value)} disabled={showFeedback}
                className={`${cls} ${showFeedback ? 'opacity-60 cursor-not-allowed' : ''}`}>
                {showFeedback && (isCorrect
                  ? <Check className={MARK_CLS} aria-hidden />
                  : isSel
                    ? <X className={MARK_CLS} aria-hidden />
                    : null)}{opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // AI：实时状态登记（当前阶段 + 核心受控变量），供系统提示词与「问 AI」动态问句读取
  useEffect(() => {
    setLabState('electrolysis', { stage, power, elapsed });
  }, [stage, power, elapsed]);
  // 页面级「问 AI」问句：登记到页级注册表，点击标题旁入口时取用（动态实验含当前读数）
  useEffect(() => {
    setPageQuestion('electrolysis', lang === 'zh' ? '请讲解电解水的实验现象：正负极各产生什么气体，体积比是多少' : 'Explain the electrolysis of water: which gas forms at each electrode and the 2:1 volume ratio');
  }, [lang]);

  return (
    <div className="space-y-6">
      {/* ── 幕导航 ── */}
      <StageNav
        stage={stage}
        setStage={setStage}
        labels={{
          predict: c.stagePredict,
          explore: c.stageExplore,
          conclude: c.stageConclude,
          next: c.nextStage,
          redo: c.redoLabel,
        }}
        onRedo={redoAll}
        isDone={{
          predict: predComplete,
          explore: observations.length > 0,
          conclude: concludeComplete,
        }}
      />

      {/* ── 电解器示意 ── */}
      <div className={`border p-3 space-y-2 transition-colors ${
        focus && focus !== 'micro' ? 'border-[var(--fg)]' : 'border-[var(--border)]'
      }`}>
        <div className="flex items-center justify-between">
          <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.readout}</h3>
          <button
            type="button"
            onClick={() => setPower((p) => !p)}
            className={`px-3 py-1.5 text-[0.6875rem] border transition-colors ${
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

          {/* ── 动态液面渲染（leftLevel / rightLevel 已在组件体内计算，供气泡液面截断共用） ── */}
          {(() => {
            return (
              <g>
                {/* 水（左支管 + 底部连通管 + 右支管） */}
                <path
                  d={`M 112 ${leftLevel} H 144 V 104 H 256 V ${rightLevel} H 288 V 104 H 112 Z`}
                  fill="rgba(70,150,220,0.22)"
                  stroke="none"
                />

                {/* 左管液面线 */}
                <line x1="112" y1={leftLevel} x2="144" y2={leftLevel} stroke="var(--fg)" strokeWidth="1.2" />
                {/* 右管液面线 */}
                <line x1="256" y1={rightLevel} x2="288" y2={rightLevel} stroke="var(--fg)" strokeWidth="1.2" />

                {/* 收集的气体（管上部无色留空区域）：H₂ 侧与 O₂ 侧 */}
                {power && (
                  <>
                    {/* 负极 H₂ 气室 */}
                    <rect x="113" y="50" width="30" height={Math.max(2, leftLevel - 50)} fill="rgba(120,220,160,0.15)" stroke="none" />
                    <text x="128" y={Math.max(48, leftLevel - 6)} textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--fg)" fontFamily="var(--f-mono)">
                      H₂ {hVol.toFixed(0)} mL
                    </text>

                    {/* 正极 O₂ 气室 */}
                    <rect x="257" y="50" width="30" height={Math.max(2, rightLevel - 50)} fill="rgba(120,180,240,0.15)" stroke="none" />
                    <text x="272" y={Math.max(48, rightLevel - 6)} textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--fg)" fontFamily="var(--f-mono)">
                      O₂ {oVol.toFixed(0)} mL
                    </text>
                  </>
                )}
                {!power && (
                  <>
                    <text x="128" y="66" textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="var(--f-mono)">H₂</text>
                    <text x="272" y="66" textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="var(--f-mono)">O₂</text>
                  </>
                )}
              </g>
            );
          })()}

          {/* 管身刻度：主刻度（长）/ 副刻度（短）交替，两管各 8 条，
              使 H₂:O₂ = 2:1 的体积比可直接在图上读出（管腔左 112–144 / 右 256–288） */}
          {TICK_YS.map((y, i) => (
            <g key={`tick-row-${y}`}>
              <line x1="113" y1={y} x2={i % 2 === 0 ? 127 : 120} y2={y}
                stroke="var(--fg)" strokeWidth={i % 2 === 0 ? 0.8 : 0.5} opacity={focus === 'ratio' ? 0.95 : 0.55} />
              <line x1="257" y1={y} x2={i % 2 === 0 ? 271 : 264} y2={y}
                stroke="var(--fg)" strokeWidth={i % 2 === 0 ? 0.8 : 0.5} opacity={focus === 'ratio' ? 0.95 : 0.55} />
            </g>
          ))}

          {/* 电极（碳棒从管顶插入水中）：极性符号与正负极文字都标在管顶部电极上端（导线连接处），贴合"电极从顶部插入、导线在顶部接电源"的原理 */}
          {/* 左电极：负极(−)，产 H₂ 多 */}
          <line x1="128" y1="60" x2="128" y2="96" stroke="var(--fg)" strokeWidth="1.5" strokeLinecap="round" />
          <text x="128" y="42" textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--f-mono)">{lang === 'zh' ? '负极' : 'Cathode'}</text>
          <text x="128" y="56" textAnchor="middle" fontSize="15" fill="var(--fg)" fontFamily="var(--f-mono)" fontWeight="bold">−</text>
          {/* 右电极：正极(+)，产 O₂ 少 */}
          <line x1="272" y1="60" x2="272" y2="96" stroke="var(--fg)" strokeWidth="1.5" strokeLinecap="round" />
          <text x="272" y="42" textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--f-mono)">{lang === 'zh' ? '正极' : 'Anode'}</text>
          <text x="272" y="56" textAnchor="middle" fontSize="15" fill="var(--fg)" fontFamily="var(--f-mono)" fontWeight="bold">+</text>

          {/* 气泡（通电时动态上浮：负极多且大、正极少且小；触到液面即破裂重置） */}
          {power &&
            bubbles.map((b) => (
              <circle key={b.id} cx={b.x} cy={b.y} r={b.r} fill="var(--fg)" opacity="0.55" />
            ))}

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
          <text x="200" y="38" textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--f-mono)">{lang === 'zh' ? '直流电源' : 'DC source'}</text>

          {/* ── 焦点图层：由探索卡的「试试这个」切换，四张卡各有一组互异的视觉焦点 ── */}

          {/* 焦点①「通电观察」：两侧液面下降指示（负极下降更快，对应 2:1 的气体收集量） */}
          {focus === 'power' && power && (
            <g>
              <path
                d={`M136 ${leftLevel + 3} V ${leftLevel + 11} M132.5 ${leftLevel + 8} L136 ${leftLevel + 12} L139.5 ${leftLevel + 8}`}
                fill="none" stroke="var(--fg)" strokeWidth="0.9"
              />
              <path
                d={`M264 ${rightLevel + 3} V ${rightLevel + 11} M260.5 ${rightLevel + 8} L264 ${rightLevel + 12} L267.5 ${rightLevel + 8}`}
                fill="none" stroke="var(--fg)" strokeWidth="0.9"
              />
              <text x="200" y="122" textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--f-mono)">
                {c.levelDrop}
              </text>
            </g>
          )}

          {/* 焦点②「体积比」：两管气柱高度的量程括号 + 2:1 结论标注（管身刻度同时由 0.55 提亮到 0.95） */}
          {focus === 'ratio' && (
            <g>
              <line x1="105" y1="50" x2="105" y2={leftLevel} stroke="var(--fg)" strokeWidth="0.9" />
              <line x1="105" y1="50" x2="110" y2="50" stroke="var(--fg)" strokeWidth="0.9" />
              <line x1="105" y1={leftLevel} x2="110" y2={leftLevel} stroke="var(--fg)" strokeWidth="0.9" />
              <line x1="295" y1="50" x2="295" y2={rightLevel} stroke="var(--fg)" strokeWidth="0.9" />
              <line x1="290" y1="50" x2="295" y2="50" stroke="var(--fg)" strokeWidth="0.9" />
              <line x1="290" y1={rightLevel} x2="295" y2={rightLevel} stroke="var(--fg)" strokeWidth="0.9" />
              <line x1="105" y1={leftLevel} x2="295" y2={rightLevel} stroke="var(--fg)" strokeWidth="0.7" strokeDasharray="3 2" />
              <text x="200" y="160" textAnchor="middle" fontSize="10.5" fontWeight="bold" fill="var(--fg)" fontFamily="var(--f-mono)">
                {c.ratioTag}
              </text>
            </g>
          )}

          {/* 焦点③「检验气体」：负极管口 H₂ 燃烧（淡蓝色火焰）；正极管口 O₂ 使带火星木条复燃。
              火焰取淡蓝为语义色（氢气燃烧现象），较深描边保证浅底上轮廓 ≥3:1；火星为火焰示意色。 */}
          {focus === 'test' && gasTest > 0 && (
            <g key={`gas-test-${gasTest}`}>
              <path d="M120 50 Q113 41 120 28 Q127 41 120 50 Z" fill="#a8ccff" stroke="#3f6fb5" strokeWidth="0.9">
                <title>{c.testH2}</title>
              </path>
              <path d="M120 47 Q116.5 41 120 34 Q123.5 41 120 47 Z" fill="#e8f3ff" stroke="none" />
              <text x="120" y="24" textAnchor="middle" fontSize="8.5" fill="var(--muted)" fontFamily="var(--f-mono)">H₂</text>

              <g>
                <title>{c.testO2}</title>
                <line x1="286" y1="52" x2="286" y2="32" stroke="var(--muted)" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="286" cy="31" r="3.2" fill="#c62828" opacity="0.85" />
                <circle cx="286" cy="31" r="1.5" fill="#ffd470" />
                <text x="286" y="24" textAnchor="middle" fontSize="8.5" fill="var(--muted)" fontFamily="var(--f-mono)">O₂</text>
              </g>
            </g>
          )}
        </svg>
        <p className="text-xs text-[var(--muted)] serif-font italic">
          {focus
            ? c.focusHint[focus]
            : power
              ? (lang === 'zh' ? '负极产 H₂，正极产 O₂，体积比约 2:1。' : 'Negative gives H₂, positive gives O₂, ratio about 2:1.')
              : (lang === 'zh' ? '点击「接通电源」观察两极气泡。' : 'Click "Turn on" to watch bubbles at both electrodes.')}
        </p>
      </div>

      {/* ── 幕内容 ── */}
      {stage === 'predict' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.predictTitle}</h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{c.predictQuestion}</p>
          {renderQ(c.predictQ1, opts('predictQ1'), predict1 as string, (v) => setPredict1(v as PredictQ1), QUIZ_CORRECT.predictQ1)}
          {renderQ(c.predictQ2, opts('predictQ2'), predict2 as string, (v) => setPredict2(v as PredictQ2), QUIZ_CORRECT.predictQ2)}
          {predComplete ? (
            <button type="button" onClick={() => setStage('explore')} className="inline-flex items-center gap-1.5 text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors">
              <Check className="w-3.5 h-3.5" aria-hidden />
              <span>{c.predictDone} — {c.revealLabel}</span>
            </button>
          ) : (
            <p className="text-xs text-[var(--muted)] serif-font italic">{c.predictHint}</p>
          )}
        </div>
      )}

      {stage === 'explore' && (
        <>
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

          {/* 焦点④「微观本质」：卡 4 会展开此区域并平滑滚动到此（border-transparent 常驻占位，避免高亮时布局跳动） */}
          <div
            ref={microRef}
            className={`border p-3 space-y-2 transition-colors ${
              focus === 'micro' ? 'border-[var(--fg)]' : 'border-transparent'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                // {c.microTitle}
              </h3>
              <button
                type="button"
                onClick={() => setMicroOpen((p) => !p)}
                className={`px-3 py-1.5 text-[0.6875rem] border transition-colors ${
                  microOpen
                    ? 'border-[var(--fg)] text-[var(--fg)]'
                    : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                }`}
              >
                {microOpen ? c.microHide : c.microShow}
              </button>
            </div>
            {microOpen
              ? <MicroAnimation reactants={MICRO_REACTANTS} products={MICRO_PRODUCTS} />
              : <p className="text-xs text-[var(--muted)] serif-font italic">{c.microHint}</p>}
          </div>
        </>
      )}

      {stage === 'conclude' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.concludeTitle}</h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{c.concludeQuestion}</p>
          {renderQ(c.concludeQ1, opts('concludeQ1'), concl.q1, (v) => setConcl((p) => ({ ...p, q1: v })), QUIZ_CORRECT.concludeQ1)}
          {renderQ(c.concludeQ2, opts('concludeQ2'), concl.q2, (v) => setConcl((p) => ({ ...p, q2: v })), QUIZ_CORRECT.concludeQ2)}
          {renderQ(c.concludeQ3, opts('concludeQ3'), concl.q3, (v) => setConcl((p) => ({ ...p, q3: v })), QUIZ_CORRECT.concludeQ3)}
          {concludeComplete && !showFeedback && (
            <button type="button" onClick={() => setShowFeedback(true)} className="compact text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors">{c.concludeHint}</button>
          )}
          {showFeedback && (
            <div className="border-l-2 border-[var(--fg)] pl-3 space-y-2">
              <p className="text-sm serif-font text-[var(--fg)] leading-relaxed">{c.feedbackText}</p>
              <Formula tex={c.eqWater} block className="text-[var(--fg)]" />
              <h4 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.tipsTitle}</h4>
              <ul className="space-y-1">{c.tips.map((tip, i) => <li key={i} className="text-xs text-[var(--fg)] serif-font leading-relaxed flex gap-2"><span className="text-[var(--muted)] mono-font shrink-0">{i + 1}.</span>{tip}</li>)}</ul>

              {/* 微观动画（可控播放） */}
              <div className="space-y-2 pt-2">
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
                  <MicroAnimation reactants={MICRO_REACTANTS} products={MICRO_PRODUCTS} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
