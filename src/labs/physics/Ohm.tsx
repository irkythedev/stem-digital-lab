/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 物理实验 · 欧姆定律 I = U/R 三幕式探究（苏科版 九上）
 *
 * 幕 1 预测：给定电路 R=10Ω，猜 I-U 图像形状，再揭示
 * 幕 2 探索：控制变量卡（R 固定变 U / U 固定变 R / 特殊点 / 自由）+ 钉住 I-U 曲线 + 观察笔记
 * 幕 3 结论：I 与 U 成正比、I 与 R 成反比，综合得 I = U/R
 *
 * 复用组件：CoordPlane（I-U 图像）、ExploreStage（任务卡+笔记）、LabIcon。
 */
import { useMemo, useState, type MouseEvent } from 'react';
import AskAiButton from '../../components/ai/AskAiButton';
import { useApp } from '../../lib/app-context';
import ParamSlider from '../../components/lab/ParamSlider';
import CoordPlane, { type CoordCurve } from '../../components/lab/CoordPlane';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import MeterProbe, { type MeasurableWire, type MeasurableComp, type MeterTarget } from '../../components/lab/MeterProbe';
import MeterGauge from '../../components/lab/MeterGauge';
import { Bulb, Rheostat } from '../../components/lab/circuit/CircuitParts';
import CircuitTooltip from '../../components/lab/circuit/CircuitTooltip';
import { GrabIcon } from '../../components/ui/LabIcon';
import Formula from '../../components/ui/Formula';

type Stage = 'predict' | 'explore' | 'conclude';

/** 预测题：I-U 图像形状 */
type PredictShape = 'line' | 'curve' | 'flat' | 'drop' | null;

/** 元件类型：定值电阻（线性）或小灯泡（电阻随温度/电压升高，非线性） */
type ElementType = 'resistor' | 'bulb';

/** 灯泡模型：钨丝电阻随电压（温度）升高，R_eff = R₀ + γ·U */
const BULB_GAMMA = 0.4; // Ω/V

/** 元件动态电阻：定值电阻 = R，灯泡 = R₀ + γ·U（钨丝升温） */
function elementResistance(r: number, element: ElementType, u: number): number {
  return element === 'bulb' ? r + BULB_GAMMA * u : r;
}

/**
 * 采样 I-U 曲线：U 为电源电压 ∈ [0, 12]。
 * 返回 [元件两端电压 U_elem, 电流 I]——横轴严格用元件真实压降（伏安法口径），
 * 定值电阻斜率 = 1/R，与结论口径一致；变阻器 Rp 参与分压不影响横轴语义。
 */
function sampleOhm(r: number, element: ElementType, rp = 0): [number, number][] {
  // 元件短路（R=0 相当于导线）：I-U 图像无有效关系，返回空曲线
  if (element === 'resistor' && r === 0) return [];
  const pts: [number, number][] = [];
  for (let u = 0; u <= 12.0001; u += 0.1) {
    const i = element === 'bulb' ? u / (r + BULB_GAMMA * u + rp) : u / (r + rp);
    pts.push([i * elementResistance(r, element, u), i]);
  }
  return pts;
}

/** 电路读数：给定电源电压 U、元件 R、元件类型、串联变阻器 Rp，I（A） */
function currentOf(u: number, r: number, element: ElementType, rp = 0): number {
  if (element === 'bulb') return u / (r + BULB_GAMMA * u + rp);
  return u / (r + rp);
}

const copy = {
  zh: {
    prompt: '先预测，再自由探索，最后自己下结论。每一步都可以来回调整。',
    params: '参数',
    readout: '读数',
    reset: '重置',
    circuitLabel: '电路图',
    elementLabel: '元件',
    elementResistor: '定值电阻',
    elementBulb: '小灯泡',
    bulbModelHint: '小灯泡采用简化非线性模型：钨丝升温后电阻增大，因此 I-U 图像不再是直线；这用于展示趋势，不代表完整实验数据。',
    measureTitle: '测未知电阻',
    measureIntro: '这是一个未知电阻（阻值隐藏）。按伏安法操作：变阻器先调到最大（保护电路），闭合开关后逐渐调小，改变电阻两端电压；用电压表读数 V 和电流表读数 I 算出 R = V/I，多测几组取平均。',
    measureReveal: '揭示真实值',
    measureHidden: '? Ω',
    measureResult: '你的测量平均值',
    measureTrue: '真实阻值',
    switchLabel: '开关',
    // 电路元件公式浮层（SOP 教学增强）
    tipResistor: { formula: 'I = U / R', principle: '定值电阻阻值不变，电流与两端电压成正比（欧姆定律）' },
    tipBulb: { formula: 'R = U / I', principle: '灯丝电阻随温度升高而增大，是动态电阻（非线性元件）' },
    tipRheostat: { formula: 'Uₚ = I × Rₚ', principle: '滑动变阻器串联分压，改变元件两端电压（调压 + 保护电路）' },
    tipAmmeter: { formula: 'I = U / R', principle: '电流表串联在电路中，测量通过元件的电流' },
    tipVoltmeter: { formula: 'U = I × R', principle: '电压表并联在元件两端，测量元件两端的电压' },
    switchOn: '闭合',
    switchOff: '断开',
    switchOpenHint: '开关断开，电路中没有电流。合上开关再看读数。',
    recordDisabledHint: '开关断开，电路中没有电流，先合上开关再记录观察。',
    currentDirLabel: '电流方向（传统）：正极 → 负极',
    currentDirNote: '实际金属导体中是电子从负极流向正极，方向相反。',
    meterHint: '拖动电流表(A)到导线上测电流、电压表(V)到元件两端测电压',
    meterAmmeterErr: '电流表不能并联在元件两端——内阻极小会短路！应串在导线上。',
    meterVoltmeterErr: '电压表要并联在元件两端测电压，不能串在导线上。',
    stagePredict: '预测',
    stageExplore: '探索',
    stageConclude: '结论',
    stageDone: '完成',
    nextStage: '下一步 →',
    redoLabel: '再次实验',
    // 幕1 预测
    predictTitle: '预测',
    predictQuestion: '给定 R = 10Ω 的定值电阻，探究通过它的电流与它两端电压的关系。',
    predictQuestion2: '先别急着看图像，猜一猜：',
    predictQ1: '电流 I 与电压 U 的图像是什么形状？',
    predictLine: '一条过原点的直线',
    predictCurve: '一条弯曲的曲线',
    predictFlat: '水平直线（I 不变）',
    predictDrop: '下降的直线',
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
    pinnedEmpty: '（未钉住。钉住不同 R 的 I-U 曲线对比，斜率变化就浮现了）',
    cards: [
      {
        title: '探究一：电流与电压的关系',
        prompt: '保持 R=10Ω 不变，调节滑动变阻器使定值电阻两端电压逐次升高（如 1V、2V、3V），记录电流 I——I 与 U 是什么关系？',
      },
      {
        title: '探究二：电流与电阻的关系',
        prompt: '保持定值电阻两端电压（电压表读数）为 2.5V 不变：换用不同阻值的 R 后，调节滑动变阻器使电压表回到 2.5V，再记录电流 I。',
      },
      {
        title: '特殊点验证',
        prompt: '设 U=6V、R=10Ω，电流表读数是不是 0.60A？再看 U=6V、R=20Ω 呢？',
      },
      {
        title: '自由探索',
        prompt: '任意调 U、R，钉住几条 I-U 曲线对比，看看斜率藏着什么规律。',
      },
      {
        title: '测未知电阻',
        prompt: '切换到「测未知电阻」模式，隐藏阻值，用 U 和 I 的读数算出 R，多测几组取平均。',
      },
    ],
    // 幕3 结论
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，I、U、R 之间是什么关系？',
    concludeSkipHint: '还没在预测幕猜过 I-U 图像形状——建议先回预测幕完成预测，再做结论会更有意义。',
    concludeQ1: 'R 不变时，I 与 U：',
    concludeQ1Proportional: '成正比（U 翻倍，I 翻倍）',
    concludeQ1Inverse: '成反比（U 翻倍，I 减半）',
    concludeQ1None: '没关系',
    concludeQ2: 'U 不变时，I 与 R：',
    concludeQ2Inverse: '成反比（R 翻倍，I 减半）',
    concludeQ2Proportional: '成正比（R 翻倍，I 翻倍）',
    concludeQ2None: '没关系',
    concludeQ3: 'I-U 图像的斜率等于：',
    concludeQ3InvR: '1/R（R 越大越平缓）',
    concludeQ3R: 'R（R 越大越陡）',
    concludeQ3None: '没有意义',
    concludeQ4: '欧姆定律的表达式是：',
    concludeQ4IUR: 'I = U / R',
    concludeQ4UIR: 'U = I × R（等价变形）',
    concludeQ4None: 'I = U × R',
    concludeHint: '选完四个，看看结论和你的观察是否一致',
    feedbackText:
      '欧姆定律：导体中的电流 I 与它两端的电压 U 成正比，与它的电阻 R 成反比，即 I = U/R。' +
      'I-U 图像是一条过原点的直线，斜率 = 1/R——R 越大直线越平缓。',
    // 考点速记
    tipsTitle: '考点速记',
    tips: [
      '欧姆定律 I=U/R：电流与电压成正比、与电阻成反比（同一导体）；变形公式 U=IR、R=U/I。',
      'I-U 图像是过原点的直线，斜率 = 1/R；R 越大直线越平缓。',
      '伏安法测电阻：多测几组 U、I，分别算 R 再取平均，减小误差。',
      '小灯泡的电阻随温度升高而增大，所以它的 I-U 图像不是直线。',
      '滑动变阻器的作用：保护电路 + 改变电压，实现多次测量。',
      '电流通过电阻会发热（电流的热效应，焦耳定律 Q=I²Rt）：电流越大、电阻越大，发热越明显。',
      '不能将电源两极直接用导线相连（短路）：电流趋近无穷大，会烧坏电源甚至引发火灾。',
    ],
  },
  en: {
    prompt: 'Predict first, explore freely, then draw your own conclusion. You can move back and forth at any time.',
    params: 'Parameters',
    readout: 'Readings',
    reset: 'Reset',
    circuitLabel: 'Circuit',
    elementLabel: 'Element',
    elementResistor: 'Fixed resistor',
    elementBulb: 'Light bulb',
    bulbModelHint: 'The bulb uses a simplified nonlinear model: a hotter tungsten filament has higher resistance, so the I-U graph is not straight. This shows the trend, not complete experimental data.',
    measureTitle: 'Measure unknown resistance',
    measureIntro: 'This is an unknown resistor (value hidden). Voltmeter-ammeter method: start with the rheostat at maximum (protects the circuit), close the switch, then reduce it to vary the voltage. Compute R = V/I from V and I, repeat and average.',
    measureReveal: 'Reveal true value',
    measureHidden: '? Ω',
    measureResult: 'Your measured average',
    measureTrue: 'True resistance',
    switchLabel: 'Switch',
    tipResistor: { formula: 'I = U / R', principle: 'A fixed resistor keeps constant resistance; current is proportional to the voltage across it (Ohm\'s law)' },
    tipBulb: { formula: 'R = U / I', principle: 'Filament resistance rises with temperature — a dynamic (non-linear) element' },
    tipRheostat: { formula: 'Uₚ = I × Rₚ', principle: 'A rheostat divides voltage in series, controlling the voltage across the element (voltage control + circuit protection)' },
    tipAmmeter: { formula: 'I = U / R', principle: 'An ammeter connects in series and measures the current through the element' },
    tipVoltmeter: { formula: 'U = I × R', principle: 'A voltmeter connects in parallel and measures the voltage across the element' },
    switchOn: 'Closed',
    switchOff: 'Open',
    switchOpenHint: 'The switch is open — no current flows. Close it to read the meters.',
    recordDisabledHint: 'The switch is open — no current flows. Close it before noting an observation.',
    currentDirLabel: 'Conventional current: positive → negative',
    currentDirNote: 'In metal conductors, electrons actually flow from negative to positive — the opposite direction.',
    meterHint: 'Drag ammeter (A) onto a wire for current, voltmeter (V) across a component for voltage',
    meterAmmeterErr: 'An ammeter cannot be connected in parallel across a component — its tiny internal resistance would short-circuit it! It must be in series on a wire.',
    meterVoltmeterErr: 'A voltmeter must be connected in parallel across a component, not in series on a wire.',
    stagePredict: 'Predict',
    stageExplore: 'Explore',
    stageConclude: 'Conclude',
    stageDone: 'Done',
    nextStage: 'Next →',
    redoLabel: 'Redo',
    predictTitle: 'Predict',
    predictQuestion: 'Given a fixed resistor R = 10Ω, explore how the current through it depends on the voltage across it.',
    predictQuestion2: 'Before seeing the graph, guess:',
    predictQ1: 'What does the I vs U graph look like?',
    predictLine: 'A straight line through the origin',
    predictCurve: 'A curved line',
    predictFlat: 'A horizontal line (I constant)',
    predictDrop: 'A falling line',
    predictDone: 'Your prediction is recorded',
    predictHint: 'Answer to reveal the graph',
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
    pinnedEmpty: '(nothing pinned — pin I-U curves for different R and watch the slope change)',
    cards: [
      {
        title: 'Part 1: current vs voltage',
        prompt: 'Keep R=10Ω fixed. Adjust the rheostat so the voltage across the resistor rises step by step (e.g. 1V, 2V, 3V) and record I. How does I depend on U?',
      },
      {
        title: 'Part 2: current vs resistance',
        prompt: 'Keep the voltage across the resistor at 2.5V: after swapping in a different R, adjust the rheostat until the voltmeter reads 2.5V again, then record I.',
      },
      {
        title: 'Check a special point',
        prompt: 'Set U=6V, R=10Ω — is the ammeter reading 0.60A? What about U=6V, R=20Ω?',
      },
      {
        title: 'Free exploration',
        prompt: 'Adjust U and R freely, pin a few I-U curves and see what the slope hides.',
      },
      {
        title: 'Measure unknown resistance',
        prompt: 'Switch to "Measure unknown" mode: the resistance is hidden — derive R from U and I readings, repeat and average.',
      },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what is the relationship between I, U and R?',
    concludeSkipHint: "You haven't guessed the I-U shape in the Predict stage yet — go back and predict first, then draw your conclusion.",
    concludeQ1: 'With R fixed, I vs U:',
    concludeQ1Proportional: 'directly proportional (U doubles → I doubles)',
    concludeQ1Inverse: 'inversely proportional (U doubles → I halves)',
    concludeQ1None: 'unrelated',
    concludeQ2: 'With U fixed, I vs R:',
    concludeQ2Inverse: 'inversely proportional (R doubles → I halves)',
    concludeQ2Proportional: 'directly proportional (R doubles → I doubles)',
    concludeQ2None: 'unrelated',
    concludeQ3: 'The slope of the I-U graph equals:',
    concludeQ3InvR: '1/R (larger R → flatter line)',
    concludeQ3R: 'R (larger R → steeper line)',
    concludeQ3None: 'meaningless',
    concludeQ4: 'Ohm\u2019s law is:',
    concludeQ4IUR: 'I = U / R',
    concludeQ4UIR: 'U = I × R (equivalent form)',
    concludeQ4None: 'I = U × R',
    concludeHint: 'Answer all four, then see if your conclusion matches your observations',
    feedbackText:
      "Ohm's law: the current I through a conductor is directly proportional to the voltage U across it and inversely proportional to its resistance R, i.e. I = U/R. " +
      'The I-U graph is a straight line through the origin with slope 1/R — the larger R, the flatter the line.',
    // 考点速记
    tipsTitle: 'Key Points',
    tips: [
      "Ohm's law: I=U/R — current is proportional to voltage and inversely proportional to resistance (same conductor); equivalent forms U=IR and R=U/I.",
      'The I-U graph is a straight line through the origin; slope = 1/R — larger R, flatter line.',
      'To measure resistance: take several (U, I) pairs, compute R each time, then average to reduce error.',
      'A bulb\u2019s resistance rises with temperature, so its I-U graph is not a straight line.',
      'The sliding rheostat protects the circuit and changes the voltage for repeated measurements.',
    ],
  },
};

/** 预测目标：R = 10Ω */
const TARGET_R = 10;

export default function Ohm() {
  const { lang } = useApp();
  const t = copy[lang];

  const [stage, setStage] = useState<Stage>('predict');
  const [predShape, setPredShape] = useState<PredictShape>(null);
  const [revealed, setRevealed] = useState(false);
  const [u, setU] = useState(6);
  const [r, setR] = useState(TARGET_R);
  const [element, setElement] = useState<ElementType>('resistor');
  const [rp, setRp] = useState(40); // 滑动变阻器阻值；初始置最大（教科书：连接电路时滑片在最大阻值处，保护电路）
  /** 控制电压（探究二：换电阻后须调变阻器使电压回到此值）；null = 未启用 */
  const [targetV, setTargetV] = useState<number | null>(null);
  const [measureMode, setMeasureMode] = useState(false);
  const [rRevealed, setRRevealed] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);
  // 电路元件公式浮层（SOP 教学增强）：hover/focus 元件显示公式+代入+原理
  const [tip, setTip] = useState<{ x: number; y: number; formula: string; substitution: string; principle: string; name?: string } | null>(null);
  const showTip = (e: MouseEvent<SVGGElement>, t: Omit<NonNullable<typeof tip>, 'x' | 'y'>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.top + r.height / 2, ...t });
  };
  // 电流表串联在干路（电池与开关之间，远离变阻器）
  const [meterA, setMeterA] = useState<MeterTarget | null>({ id: 'dry-left', x: 67, y: 60 });
  const [meterV, setMeterV] = useState<MeterTarget | null>({ id: 'element', x: 250, y: 28 });
  const [meterErr, setMeterErr] = useState<string | null>(null);
  const [pinned, setPinned] = useState<{ id: number; r: number; element: ElementType; rp: number }[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [conclusion, setConclusion] = useState<{
    q1: 'prop' | 'inv' | 'none' | null;
    q2: 'inv' | 'prop' | 'none' | null;
    q3: 'invr' | 'r' | 'none' | null;
    q4: 'iur' | 'uir' | 'none' | null;
  }>({ q1: null, q2: null, q3: null, q4: null });

  // 结论正确答案
  const correctKeys = { q1: 'prop', q2: 'inv', q3: 'invr', q4: 'iur' } as const;
  const conclusionComplete =
    conclusion.q1 !== null && conclusion.q2 !== null && conclusion.q3 !== null && conclusion.q4 !== null;
  const predComplete = predShape !== null;

  const i = currentOf(u, r, element, rp);
  /** 短路：定值电阻 R=0（相当于导线）且变阻器 R_p=0 → 电源两极直接相连，电流趋近无穷大（防 NaN/防表盘溢出） */
  const shortCircuit = switchOn && element === 'resistor' && r === 0 && rp === 0 && u > 0;
  /** 有效电流：开关断开时为 0；短路时 i=∞ 不参与常规计算 */
  const effectiveI = switchOn && !shortCircuit ? i : 0;
  /** 元件两端电压：定值电阻 = I·R，灯泡 = I·(R₀+γU)；短路时元件两端电压为 0（被导线短接） */
  const elemVoltage = switchOn && !shortCircuit ? i * elementResistance(r, element, u) : 0;
  /** 元件发热（焦耳定律 Q∝I²）：电流越大发热越明显，短路时达最大 */
  const heat = shortCircuit ? 1 : Math.min(1, (effectiveI / 1.2) ** 2);

  const currentCurve: CoordCurve = useMemo(
    () => ({
      id: 'main',
      points: sampleOhm(r, element, rp),
      label: element === 'bulb' ? `灯泡 R₀=${r}Ω` : `R = ${r}Ω`,
    }),
    [r, element, rp],
  );

  const pinnedCurves: CoordCurve[] = pinned.map((p) => ({
    id: `pin${p.id}`,
    points: sampleOhm(p.r, p.element, p.rp),
    dashed: true,
    label:
      (p.element === 'bulb' ? `灯泡 R₀=${p.r}Ω` : `R = ${p.r}Ω`) +
      (p.rp > 0 ? ` (Rp=${p.rp}Ω)` : ''),
  }));

  const curves = [currentCurve, ...pinnedCurves];

  /** 可测量目标图：导线（电流归属）+ 元件（电压归属）——自由放置判定用 */
  const wires: MeasurableWire[] = [
    { id: 'dry-left', x1: 40, y1: 60, x2: 95, y2: 60, current: 'i0' },
    { id: 'dry-mid', x1: 145, y1: 60, x2: 173, y2: 60, current: 'i0' },
    { id: 'dry-rheo', x1: 207, y1: 60, x2: 230, y2: 60, current: 'i0' },
    { id: 'dry-right', x1: 270, y1: 60, x2: 270, y2: 140, current: 'i0' },
    { id: 'dry-bottom', x1: 270, y1: 140, x2: 40, y2: 140, current: 'i0' },
    { id: 'dry-batt-top', x1: 40, y1: 60, x2: 40, y2: 70, current: 'i0' },
    { id: 'dry-batt-bot', x1: 40, y1: 82, x2: 40, y2: 140, current: 'i0' },
  ];
  const comps: MeasurableComp[] = [
    { id: 'battery', kind: 'battery', sense1: { x: 22, y: 70 }, sense2: { x: 32, y: 82 }, land: { x: 40, y: 76 }, voltage: 'v-batt' },
    { id: 'element', kind: 'bulb', sense1: { x: 230, y: 60 }, sense2: { x: 270, y: 60 }, land: { x: 250, y: 28 }, voltage: 'v-elem', body: { cx: 250, cy: 60, r: 20 } },
  ];

  /** 表盘数值：探针当前吸附目标的物理量；悬空为 null（指针回零） */
  const gaugeValue = (kind: 'current' | 'voltage', target: MeterTarget | null): number | null => {
    if (!target) return null;
    if (kind === 'current') return shortCircuit ? null : effectiveI;
    // 元件两端电压断路时为 0（无电流无压降）；电池两端始终为 U
    const c = comps.find((x) => x.id === target.id);
    if (!c) return null;
    return c.voltage === 'v-elem' ? elemVoltage : u;
  };

  /** 表盘量程：电流表 0.6A / 3A 自动选档（真实学生表双量程），电压表 0-15V */
  const gaugeMax = (kind: 'current' | 'voltage', target: MeterTarget | null): number =>
    kind === 'current' ? ((gaugeValue(kind, target) ?? 0) <= 0.6 ? 0.6 : 3) : 15;

  /** 当前测点名称 */
  const gaugeLabel = (kind: 'current' | 'voltage'): string => {
    const target = kind === 'current' ? meterA : meterV;
    if (!target) return '—';
    if (kind === 'current') return '干路电流';
    const c = comps.find((x) => x.id === target.id);
    if (!c) return '—';
    return c.voltage === 'v-elem' ? '元件两端电压' : '电池电压';
  };

  const reset = () => {
    setU(6);
    setR(TARGET_R);
    setRp(40);
    setMeasureMode(false);
    setRRevealed(false);
    setTargetV(null);
    setMeterA({ id: 'dry-left', x: 67, y: 60 });
    setMeterV({ id: 'element', x: 250, y: 28 });
    setMeterErr(null);
  };

  const redoAll = () => {
    setStage('predict');
    setPredShape(null);
    setRevealed(false);
    setU(6);
    setR(TARGET_R);
    setRp(40);
    setElement('resistor');
    setMeasureMode(false);
    setRRevealed(false);
    setSwitchOn(true);
    setMeterA({ id: 'dry-left', x: 67, y: 60 });
    setMeterV({ id: 'element', x: 250, y: 28 });
    setMeterErr(null);
    setTargetV(null);
    setPinned([]);
    setObservations([]);
    setConclusion({ q1: null, q2: null, q3: null, q4: null });
  };

  const reveal = () => {
    setRevealed(true);
    setRp(0); // 揭示图像时归零变阻器：U 直接加在元件两端，横轴 0-12V 与预测题一致，斜率 = 1/R
    setStage('explore');
  };

  const addObservation = (note: string) => {
    setObservations((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        snapshot: [
          { label: 'U', value: `${u.toFixed(1)}V` },
          { label: 'V', value: `${elemVoltage.toFixed(2)}V` },
          { label: 'R', value: measureMode && !rRevealed ? t.measureHidden : `${r.toFixed(0)}Ω` },
          { label: 'I', value: `${effectiveI.toFixed(2)}A` },
          ...(!switchOn ? [{ label: '开关', value: t.switchOff }] : []),
        ],
        note,
      },
    ]);
  };

  const cards: ExploreCard[] = [
    {
      key: 'card-u',
      title: t.cards[0].title,
      prompt: t.cards[0].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setR(10);
        setU(4.5); // 学生电源 4.5V（三节干电池，初中常用）
        setRp(40); // 变阻器从最大开始，逐步调小使电压升至 1V→2V→3V
        setTargetV(null);
      },
    },
    {
      key: 'card-r',
      title: t.cards[1].title,
      prompt: t.cards[1].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setU(6); // 电源 6V
        setR(5);
        setRp(7); // V = 6·5/(5+7) = 2.5V（控制电压）
        setTargetV(2.5); // 教科书：换电阻后须调变阻器使电压回到 2.5V
      },
    },
    {
      key: 'card-point',
      title: t.cards[2].title,
      prompt: t.cards[2].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setU(6);
        setR(10);
        setRp(0); // 归零：U=6V、R=10Ω → I=0.60A 与提示一致
        setTargetV(null);
      },
    },
    {
      key: 'card-free',
      title: t.cards[3].title,
      prompt: t.cards[3].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setU(9);
        setR(30);
        setRp(40); // 自由探索保留变阻器，观察分压对斜率的影响
      },
    },
    {
      key: 'card-measure',
      title: t.cards[4].title,
      prompt: t.cards[4].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setElement('resistor');
        setMeasureMode(true);
        setRRevealed(false);
        setSwitchOn(true);
        setU(12);
        setR(15);
        setRp(40); // 教科书：闭合前变阻器调至最大阻值（保护电路），闭合后逐渐调小改变电压
        setTargetV(null);
      },
    },
  ];

  const isPinned = pinned.some((p) => p.r === r && p.element === element && p.rp === rp);

  const stageOrder: Stage[] = ['predict', 'explore', 'conclude'];
  const stageIdx = stageOrder.indexOf(stage);

  return (
    <div className="flex flex-col space-y-6">

      <div className="flex justify-center py-2">
        <Formula tex="I = \frac{U}{R}" block className="text-lg" />
      </div>

      {/* 幕导航 */}
      <div className="flex items-center gap-2 text-[0.6875rem] mono-font uppercase tracking-widest text-[var(--muted)]">
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
      <AskAiButton className="mt-2" question={lang === 'zh' ? '请讲解欧姆定律 I=U/R 的定量关系，以及实验中的操作要点' : "Explain Ohm's law I=U/R and the key steps of this experiment"} />


      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        {/* 左列：电路图 + I-U 图像 + 读数 */}
        <div className="flex flex-col space-y-6">
          {/* 电路图（SVG，极简线描） */}
          <div className="border border-[var(--border)] p-4">
            <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-2">
              // {t.circuitLabel}
            </h3>
            {/* 表盘：电路图上方（A/V 表显），指针跟随探针吸附测点 */}
            <div className="mb-2 flex items-start justify-center gap-6">
              <MeterGauge
                value={gaugeValue('current', meterA)}
                max={gaugeMax('current', meterA)}
                unit="A"
                label={gaugeLabel('current')}
              />
              <MeterGauge
                value={gaugeValue('voltage', meterV)}
                max={gaugeMax('voltage', meterV)}
                unit="V"
                label={gaugeLabel('voltage')}
              />
            </div>
            <svg viewBox="0 0 320 200" className="w-full h-auto" role="img" aria-label={t.circuitLabel} strokeLinecap="round" strokeLinejoin="round">
              {/* 导线 */}
              <g stroke="var(--fg)" strokeWidth="1.2" fill="none">
                {/* 左侧竖线（电池支路）：正极段(60→70) 与负极段(82→140)，电池符号填补 70-82 间隙 */}
                <line x1="40" y1="60" x2="40" y2="70" />
                <line x1="40" y1="82" x2="40" y2="140" />
                {/* 上导线（电池正极 → 开关S 左触点 95 → 右触点 145 → 滑动变阻器 → 元件）导线始终可见 */}
                <line x1="40" y1="60" x2="95" y2="60" />
                <line x1="145" y1="60" x2="173" y2="60" />
                <line x1="207" y1="60" x2="230" y2="60" />
                {/* 元件右端到下横线 + 回负极：导线始终可见，开关只断电流 */}
                <line x1="270" y1="60" x2="270" y2="140" />
                <line x1="270" y1="140" x2="40" y2="140" />
                {/* 电池支路竖线由电池符号补齐 70-82 间隙；电压表并联引线由探针吸附时动态绘制 */}
              </g>
              {/* 开关：可点击，闭合/断开切换 */}
              <g
                role="button"
                aria-label={`${t.switchLabel}: ${switchOn ? t.switchOn : t.switchOff}`}
                onClick={() => setSwitchOn((s) => !s)}
                className="cursor-pointer"
              >
                {/* 透明命中区：扩大触屏点击区域 */}
                <rect x="85" y="40" width="70" height="40" fill="transparent" />
                {/* 开关两端触点 */}
                <circle cx="95" cy="60" r="3" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.2" />
                <circle cx="145" cy="60" r="3" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.2" />
                {/* 刀片：闭合=水平接到右触点；断开=绕左触点大角度翘起（transform rotate 过渡） */}
                <line
                  x1="0"
                  y1="0"
                  x2="50"
                  y2="0"
                  stroke="var(--fg)"
                  strokeWidth="1.5"
                  style={{
                    transform: `translate(95px, 60px) rotate(${switchOn ? 0 : -60}deg)`,
                    transition: 'transform 0.18s ease-out',
                  }}
                />
              </g>
              {/* 电池：长线 + 短线（一长一短平行粗线），标注正负极 */}
              <g stroke="var(--fg)" strokeWidth="2">
                <line x1="22" y1="70" x2="58" y2="70" />
                <line x1="32" y1="82" x2="48" y2="82" />
              </g>
              {/* 正负极标注：电路图外圈，同一竖线垂直对齐（不前后错开） */}
              <text x="18" y="64" textAnchor="middle" fontSize="11" fill="var(--fg)" fontFamily="var(--f-mono)">
                +
              </text>
              <text x="18" y="90" textAnchor="middle" fontSize="11" fill="var(--fg)" fontFamily="var(--f-mono)">
                −
              </text>
              {/* 电流小点：沿回路流动（穿过元件），速度随有效电流；开关断开时消失 */}
              {effectiveI > 0.01 && (
                <g key={`flow-${effectiveI.toFixed(2)}-${switchOn}`} fill="var(--fg)" opacity="0.85">
                  {[0, 1.1].map((offset) => (
                    <circle key={offset} r="2.6">
                      <animateMotion
                        dur={`${Math.max(0.45, 2.2 / effectiveI).toFixed(2)}s`}
                        begin={`${offset}s`}
                        repeatCount="indefinite"
                        path="M40,60 H270 V140 H40 V60"
                      />
                    </circle>
                  ))}
                </g>
              )}
              {/* 遮挡电池区域的回流电流小点：长横（正极 70）与短横（负极 82）之间保持空白 */}
              <rect x={34} y={71} width={12} height={10} fill="var(--bg)" />
              {/* 滑动变阻器：串联在开关与元件之间（伏安法标准电路，调压+保护） */}
              <g
                tabIndex={0}
                onMouseEnter={(ev) => showTip(ev, { name: 'Rₚ 滑动变阻器', formula: t.tipRheostat.formula, substitution: `Uₚ = ${effectiveI.toFixed(2)}A × ${rp}Ω = ${(effectiveI * rp).toFixed(2)}V`, principle: t.tipRheostat.principle })}
                onMouseLeave={() => setTip(null)}
                onFocus={(ev) => showTip(ev, { name: 'Rₚ 滑动变阻器', formula: t.tipRheostat.formula, substitution: `Uₚ = ${effectiveI.toFixed(2)}A × ${rp}Ω = ${(effectiveI * rp).toFixed(2)}V`, principle: t.tipRheostat.principle })}
                onBlur={() => setTip(null)}
                className="outline-none"
              >
                <Rheostat x={190} y={60} value={rp} max={40} label={`R_p=${rp}Ω`} />
              </g>
              {/* 元件：定值电阻（矩形，发热随电流）或小灯泡（发光随电流） */}
              {element === 'bulb' ? (
                <>
                  {/* 灯泡连接线：导线（到 x=230/270）与灯泡边缘（x=236/264）之间补短接线 */}
                  <g stroke="var(--fg)" strokeWidth="1.2" fill="none">
                    <line x1="230" y1="60" x2="236" y2="60" />
                    <line x1="264" y1="60" x2="270" y2="60" />
                  </g>
                  <g
                    tabIndex={0}
                    onMouseEnter={(ev) => showTip(ev, { name: '灯泡', formula: t.tipBulb.formula, substitution: `R = ${elemVoltage.toFixed(2)}V ÷ ${effectiveI.toFixed(2)}A = ${elementResistance(r, element, u).toFixed(1)}Ω`, principle: t.tipBulb.principle })}
                    onMouseLeave={() => setTip(null)}
                    onFocus={(ev) => showTip(ev, { name: '灯泡', formula: t.tipBulb.formula, substitution: `R = ${elemVoltage.toFixed(2)}V ÷ ${effectiveI.toFixed(2)}A = ${elementResistance(r, element, u).toFixed(1)}Ω`, principle: t.tipBulb.principle })}
                    onBlur={() => setTip(null)}
                    className="outline-none"
                  >
                    <Bulb
                      cx={250}
                      cy={60}
                      r={14}
                      glow={Math.min(1, effectiveI / 1.2)}
                      label={element === 'bulb' ? `灯泡 R₀=${r}Ω` : undefined}
                      labelY={88}
                    />
                  </g>
                </>
              ) : (
                /* 定值电阻：细长矩形（与滑动变阻器同风格，两端接导线） */
                <g
                  tabIndex={0}
                  onMouseEnter={(ev) => showTip(ev, { name: `定值电阻 R=${r}Ω`, formula: t.tipResistor.formula, substitution: `I = ${elemVoltage.toFixed(2)}V ÷ ${r}Ω = ${effectiveI.toFixed(2)}A`, principle: t.tipResistor.principle })}
                  onMouseLeave={() => setTip(null)}
                  onFocus={(ev) => showTip(ev, { name: `定值电阻 R=${r}Ω`, formula: t.tipResistor.formula, substitution: `I = ${elemVoltage.toFixed(2)}V ÷ ${r}Ω = ${effectiveI.toFixed(2)}A`, principle: t.tipResistor.principle })}
                  onBlur={() => setTip(null)}
                  className="outline-none"
                >
                <rect
                  x="230"
                  y="53"
                  width="40"
                  height="14"
                  fill={heat > 0.12 ? `rgba(255, 140, 60, ${0.3 + 0.6 * heat})` : 'var(--muted)'}
                  fillOpacity={0.9}
                  style={{ transition: 'fill 0.3s ease-out' }}
                  stroke={heat > 0.5 ? '#e25822' : 'var(--fg)'}
                  strokeWidth="1.2"
                />
                </g>
              )}
              {/* 可拖动电表探针：电流表 A（自由放置到导线测电流）、电压表 V（跨接元件两端测电压） */}
              <MeterProbe
                kind="current"
                glyph="A"
                wires={wires}
                comps={comps}
                active={meterA}
                onPlace={(target) => {
                  setMeterA(target);
                  setMeterErr(null);
                }}
                onError={() => {
                  setMeterA(null);
                  setMeterErr(t.meterAmmeterErr);
                }}
                initial={{ x: 155, y: 140 }}
              />
              <g
                tabIndex={0}
                onMouseEnter={(ev) => showTip(ev, { name: '电压表 V', formula: t.tipVoltmeter.formula, substitution: `U = ${effectiveI.toFixed(2)}A × ${elementResistance(r, element, u).toFixed(1)}Ω = ${elemVoltage.toFixed(2)}V`, principle: t.tipVoltmeter.principle })}
                onMouseLeave={() => setTip(null)}
                onFocus={(ev) => showTip(ev, { name: '电压表 V', formula: t.tipVoltmeter.formula, substitution: `U = ${effectiveI.toFixed(2)}A × ${elementResistance(r, element, u).toFixed(1)}Ω = ${elemVoltage.toFixed(2)}V`, principle: t.tipVoltmeter.principle })}
                onBlur={() => setTip(null)}
                className="outline-none"
              >
              <MeterProbe
                kind="voltage"
                glyph="V"
                wires={wires}
                comps={comps}
                active={meterV}
                onPlace={(target) => {
                  setMeterV(target);
                  setMeterErr(null);
                }}
                onError={() => {
                  setMeterV(null);
                  setMeterErr(t.meterVoltmeterErr);
                }}
                initial={{ x: 250, y: 28 }}
              />
              </g>
            </svg>
            {tip && <CircuitTooltip x={tip.x} y={tip.y} formula={tip.formula} substitution={tip.substitution} principle={tip.principle} name={tip.name} />}
            {/* 开关状态提示 */}
            {!switchOn && (
              <p className="text-xs text-[var(--muted)] serif-font italic mt-2">{t.switchOpenHint}</p>
            )}
            {/* 拖拽测量提示 + 错误反馈 */}
            <p className="mt-1 flex items-center gap-1.5 text-[0.6875rem] mono-font text-[var(--muted)]">
              <GrabIcon className="h-3.5 w-3.5 shrink-0" />
              {t.meterHint}
            </p>
            {meterErr && (
              <p className="text-xs text-[var(--error)] serif-font mt-1" role="alert">
                ⚠ {meterErr}
              </p>
            )}
            {/* 电流方向标注 */}
            <p className="text-[0.6875rem] mono-font text-[var(--muted)] mt-1">
              {t.currentDirLabel}
              <span className="text-[var(--border)]"> · </span>
              {t.currentDirNote}
            </p>
          </div>

          {/* I-U 图像（预测幕未揭示时隐藏） */}
          {stage === 'predict' && !revealed ? (
            <div className="border border-[var(--border)] p-6 flex flex-col items-center justify-center min-h-[240px] gap-2">
              <p className="text-[0.6875rem] mono-font uppercase tracking-widest text-[var(--muted)]">
                {t.predictTitle}
              </p>
              <p className="text-sm serif-font text-[var(--fg)]">{t.predictQuestion}</p>
              <p className="text-xs text-[var(--muted)] serif-font italic">{t.predictQuestion2}</p>
            </div>
          ) : (
            <CoordPlane
              curves={curves}
              xMin={0}
              xMax={Math.max(2.4, Math.max(...curves.flatMap((c) => (c.points ?? []).map(([x]) => x))) + 0.4)}
              yMin={0}
              yMax={Math.max(2.4, ...curves.flatMap((c) => (c.points ?? []).map(([, y]) => y)))}
              ariaLabel={`I vs U graph`}
              xLabel="U / V"
              yLabel="I / A"
            />
          )}

          {/* 读数 */}
          <div className="border border-[var(--border)] p-4">
            <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-2">
              // {t.readout}
            </h3>
            <p className="text-[0.625rem] mono-font text-[var(--muted)] mb-2">
              {lang === 'zh' ? 'U 为电源电压，V 为元件两端电压（电压表读数）' : 'U is the supply voltage; V is across the element (voltmeter)'}
            </p>
            {/* 零电阻 / 短路警告（电流热效应与安全教学） */}
            {element === 'resistor' && r === 0 && (
              <p
                className={`text-[0.6875rem] mono-font mb-2 ${shortCircuit ? 'text-[var(--error)] font-bold' : 'text-[var(--error)]'}`}
                role="alert"
              >
                {shortCircuit
                  ? (lang === 'zh'
                      ? '⚠ 危险短路！R=0 且变阻器为 0，电源两极直接相连，电流趋近无穷大——会烧坏电源！请增大电阻或断开开关。'
                      : '⚠ Short circuit! R=0 and rheostat at 0 — the supply terminals are joined directly and the current becomes enormous. Increase R or open the switch!')
                  : (lang === 'zh'
                      ? '⚠ R=0 相当于导线：元件被短路，电流绕过它。若变阻器也为 0，将发生危险短路！'
                      : '⚠ R=0 acts as a wire: the element is short-circuited and current bypasses it. If the rheostat is also 0, this becomes a dangerous short!')}
              </p>
            )}
            {/* 控制电压提示（探究二：换电阻后调变阻器使电压回到设定值） */}
            {targetV !== null && (
              <p
                className={`text-[0.6875rem] mono-font mb-2 ${Math.abs(elemVoltage - targetV) > 0.05 ? 'text-[var(--error)]' : 'text-[var(--muted)]'}`}
                role={Math.abs(elemVoltage - targetV) > 0.05 ? 'alert' : undefined}
              >
                {Math.abs(elemVoltage - targetV) > 0.05
                  ? (lang === 'zh'
                      ? `⚠ 电压已改变（当前 ${elemVoltage.toFixed(2)}V），请调节滑动变阻器使电压表回到 ${targetV.toFixed(1)}V！`
                      : `⚠ Voltage changed (now ${elemVoltage.toFixed(2)}V) — adjust the rheostat back to ${targetV.toFixed(1)}V!`)
                  : (lang === 'zh'
                      ? `控制电压：${targetV.toFixed(1)}V（保持电压不变）`
                      : `Control voltage: ${targetV.toFixed(1)}V (keep it fixed)`)}
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-[0.6875rem] text-[var(--muted)] mono-font">U</p>
                <p className="text-sm mono-font text-[var(--fg)]">
                  {u.toFixed(1)}
                  <span className="ml-1 text-[0.625rem] text-[var(--muted)]">V</span>
                </p>
              </div>
              <div>
                <p className="text-[0.6875rem] text-[var(--muted)] mono-font">V</p>
                <p className="text-sm mono-font text-[var(--fg)]">
                  {elemVoltage.toFixed(2)}
                  <span className="ml-1 text-[0.625rem] text-[var(--muted)]">V</span>
                </p>
              </div>
              <div>
                <p className="text-[0.6875rem] text-[var(--muted)] mono-font">R</p>
                <p className="text-sm mono-font text-[var(--fg)]">
                  {measureMode && !rRevealed ? (
                    t.measureHidden
                  ) : (
                    <>
                      {r.toFixed(0)}
                      <span className="ml-1 text-[0.625rem] text-[var(--muted)]">Ω</span>
                    </>
                  )}
                </p>
              </div>
              <div>
                <p className="text-[0.6875rem] text-[var(--muted)] mono-font">I</p>
                <p className={`text-sm mono-font ${shortCircuit ? 'text-[var(--error)]' : 'text-[var(--fg)]'}`}>
                  {shortCircuit ? '∞' : effectiveI.toFixed(2)}
                  <span className="ml-1 text-[0.625rem] text-[var(--muted)]">A</span>
                </p>
              </div>
            </div>
            {/* 测未知电阻：用元件两端电压 V（电压表读数）÷ I 算平均 R——伏安法口径，变阻器分压不影响 */}
            {measureMode && observations.length > 0 && (
              <p className="text-[0.6875rem] mono-font text-[var(--muted)] mt-2">
                {t.measureResult}:{' '}
                {(
                  observations.reduce((acc, o) => {
                    const vVal = Number(o.snapshot.find((s) => s.label === 'V')?.value.replace('V', ''));
                    const iVal = Number(o.snapshot.find((s) => s.label === 'I')?.value.replace('A', ''));
                    return acc + (iVal > 0 ? vVal / iVal : 0);
                  }, 0) / observations.length
                ).toFixed(1)}
                Ω
              </p>
            )}
          </div>
        </div>

        {/* 右列：参数 + 三幕 */}
        <div className="flex flex-col space-y-6">
          <div className="border border-[var(--border)] p-4 space-y-4">
            <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
              // {t.params}
            </h3>

            {/* 元件切换 */}
            <div className="flex items-center gap-2">
              <span className="text-[0.6875rem] mono-font uppercase tracking-widest text-[var(--muted)]">
                {t.elementLabel}
              </span>
              {(
                [
                  ['resistor', t.elementResistor],
                  ['bulb', t.elementBulb],
                ] as [ElementType, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setElement(v);
                    setMeasureMode(false);
                    setRRevealed(false);
                  }}
                  className={`text-xs mono-font px-2 py-1 border transition-colors ${
                    element === v ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {element === 'bulb' && (
              <p className="text-xs text-[var(--muted)] serif-font italic">{t.bulbModelHint}</p>
            )}

            {/* 测未知电阻模式提示 */}
            {measureMode && (
              <div className="border border-[var(--border)] p-2 space-y-1">
                <p className="text-[0.6875rem] font-bold tracking-widest text-[var(--fg)] mono-font uppercase">
                  // {t.measureTitle}
                </p>
                <p className="text-xs text-[var(--muted)] serif-font leading-relaxed">{t.measureIntro}</p>
                {rRevealed && (
                  <p className="text-xs mono-font text-[var(--fg)]">
                    {t.measureTrue}: {r.toFixed(0)}Ω
                  </p>
                )}
              </div>
            )}

            <ParamSlider label="U" value={u} min={0} max={12} step={0.5} onChange={setU} format={(v) => `${v.toFixed(1)}V`} />
            <ParamSlider label="R_p" value={rp} min={0} max={40} step={1} onChange={setRp} format={(v) => `${v.toFixed(0)}Ω`} />
            <ParamSlider
              label={element === 'bulb' ? 'R₀' : 'R'}
              value={r}
              min={0}
              max={50}
              step={5}
              disabled={measureMode && !rRevealed}
              onChange={setR}
              format={(v) => (measureMode && !rRevealed ? t.measureHidden : `${v.toFixed(0)}Ω`)}
            />
            {measureMode && !rRevealed && (
              <button
                type="button"
                onClick={() => setRRevealed(true)}
                className="text-xs mono-font px-2 py-1 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors"
              >
                {t.measureReveal}
              </button>
            )}
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
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{t.predictQuestion}</p>

              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.predictQ1}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['line', t.predictLine],
                      ['curve', t.predictCurve],
                      ['flat', t.predictFlat],
                      ['drop', t.predictDrop],
                    ] as [PredictShape, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPredShape(v)}
                      className={`text-left text-xs px-2 py-1.5 border transition-colors ${
                        predShape === v ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
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
                recordDisabled={!switchOn}
                recordDisabledHint={t.recordDisabledHint}
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
                      setPinned((prev) => prev.filter((p) => p.r !== r || p.element !== element || p.rp !== rp));
                    } else {
                      setPinned((prev) => [...prev, { id: prev.length + 1, r, element, rp }]);
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
                        R = {p.r}Ω
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

              {/* Q1: I 与 U */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ1}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['prop', t.concludeQ1Proportional],
                      ['inv', t.concludeQ1Inverse],
                      ['none', t.concludeQ1None],
                    ] as ['prop' | 'inv' | 'none', string][]
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

              {/* Q2: I 与 R */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ2}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['inv', t.concludeQ2Inverse],
                      ['prop', t.concludeQ2Proportional],
                      ['none', t.concludeQ2None],
                    ] as ['inv' | 'prop' | 'none', string][]
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

              {/* Q3: 图像斜率 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ3}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['invr', t.concludeQ3InvR],
                      ['r', t.concludeQ3R],
                      ['none', t.concludeQ3None],
                    ] as ['invr' | 'r' | 'none', string][]
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

              {/* Q4: 表达式 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ4}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['iur', t.concludeQ4IUR],
                      ['uir', t.concludeQ4UIR],
                      ['none', t.concludeQ4None],
                    ] as ['iur' | 'uir' | 'none', string][]
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
