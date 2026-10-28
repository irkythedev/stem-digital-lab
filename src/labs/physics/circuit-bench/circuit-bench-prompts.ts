/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 预设探究支架（启发式提示词工程）
 *
 * 导读卡片里那一列「启发追问」胶囊不是 FAQ：它们按课标科学探究的四阶段
 * （假设论证 / 变量控制 / 异常诊断 / 模型反思）逐条写给**学生自己想**的支架，
 * 每个预设都有一套专属题目，题目本身只指向「看哪两个量、比什么、趋势如何」，
 * 把结论留给学生——与系统提示词的探究型立场（`buildSystemPrompt` 第二节）同一条口径。
 *
 * 为什么单独一个模块：
 * ① 文案是教学资产，不该埋在 JSX 里——换题、改口径只动这一处；
 * ② `circuit-bench-presets.ts` 的预设是**电路结构**，其字段被测试逐条钉死
 *    （objective / principle / steps / probes），探究问题另起一张表，互不牵制；
 * ③ 中英成对存放，任一语言缺失时整条丢弃（宁缺勿滥，不出现半句话）。
 *
 * 术语归属：`stage` 用四阶段的枚举，`tag` 是胶囊上的方括号标识。两者不必同名——
 * 例如「图像分析」属于模型反思一环，「危害剖析」属于假设论证一环；
 * 方括号里给学生看的是他自己在做的动作，`stage` 是给 AI 的定位（见 socraticPersona）。
 */
import { getPreset } from './circuit-bench-presets';

/** 课标科学探究四阶段：假设与论证 → 控制变量 → 故障诊断 → 模型反思。 */
export type InquiryStage = 'hypothesis' | 'variables' | 'diagnosis' | 'model';

/** 四阶段的中英说法：给 AI 的上下文与胶囊的 title 共用同一份，不各写一套。 */
export const STAGE_LABEL: Record<InquiryStage, { zh: string; en: string }> = {
  hypothesis: { zh: '假设与论证', en: 'Hypothesis & argument' },
  variables: { zh: '变量控制', en: 'Controlled variables' },
  diagnosis: { zh: '故障诊断', en: 'Fault diagnosis' },
  model: { zh: '模型反思', en: 'Model reflection' },
};

export interface InquiryPrompt {
  /** 属于四阶段的哪一环（定位用；展示上只作为 title 提示） */
  stage: InquiryStage;
  /** 胶囊前缀标识，如 [假设论证] */
  tag: { zh: string; en: string };
  zh: string;
  en: string;
}

export interface PresetInquiry {
  /** 本实验要用的公式（LaTeX，不含 $）：导读的「核心物理规律」一节直接渲染 */
  formulas: string[];
  prompts: InquiryPrompt[];
}

/** 标签速查：同一个标识只写一次，八套预设共用，避免同一动作两种叫法。 */
const TAG = {
  hypothesis: { zh: '假设论证', en: 'Hypothesis' },
  variables: { zh: '变量控制', en: 'Variables' },
  diagnosis: { zh: '异常诊断', en: 'Fault finding' },
  model: { zh: '模型反思', en: 'Model check' },
  graph: { zh: '图像分析', en: 'Graph reading' },
  micro: { zh: '微观机理', en: 'Micro-mechanism' },
  derive: { zh: '原理推导', en: 'Derivation' },
  measure: { zh: '测量精髓', en: 'Measurement craft' },
  hazard: { zh: '危害剖析', en: 'Hazard analysis' },
  safety: { zh: '安全反思', en: 'Safety reasoning' },
  everyday: { zh: '生活反思', en: 'Everyday link' },
  design: { zh: '实验设计', en: 'Experiment design' },
  equivalent: { zh: '等效建模', en: 'Equivalent model' },
  control: { zh: '控制变量', en: 'Controlled variables' },
  checkup: { zh: '电路体检', en: 'Circuit check-up' },
  invent: { zh: '创新设计', en: 'Design task' },
} as const;

function p(
  stage: InquiryStage,
  tag: { zh: string; en: string },
  zh: string,
  en: string,
): InquiryPrompt {
  return { stage, tag, zh, en };
}

/**
 * 八套预设的探究支架。键与 `CIRCUIT_PRESETS` 的 id 一一对应；
 * 缺项由 `presetInquiry` 兜底（自由实验台那两条是通用的，任何电路都用得上）。
 */
export const PRESET_INQUIRY: Record<string, PresetInquiry> = {
  /* 1 · 串并联：串联是主线，并联留给自由台对照 */
  sp: {
    formulas: ['I = I_1 = I_2', 'U = U_1 + U_2', 'R = R_1 + R_2'],
    prompts: [
      p(
        'hypothesis',
        TAG.hypothesis,
        '为什么串联电路各处电流都相等？如果串联两盏阻值相差很大的灯泡，电流还会处处相等吗？请用「水流通过粗细不同水管」的模型帮我深入分析。',
        'Why is the current the same at every point of a series circuit? If the two bulbs have very different resistances, is the current still equal everywhere? Help me reason with the "water flowing through pipes of different widths" model.',
      ),
      p(
        'diagnosis',
        TAG.diagnosis,
        '闭合开关后两灯都不亮，电压表测其中一盏灯两端示数接近电源电压（6V），为什么可以断定这盏灯断路？',
        'After closing the switch both bulbs stay dark, but the voltmeter across one bulb reads almost the whole supply voltage (6V). Why can I conclude that this bulb is broken (open circuit)?',
      ),
      p(
        'model',
        TAG.model,
        '并联电路中并联的支路越多，总电流越大、总电阻反而越小，从「横截面积变大」的等效模型上该如何理解？',
        'In a parallel circuit, more branches mean a larger total current but a smaller total resistance. How does the "wider cross-section" equivalent model explain this?',
      ),
    ],
  },

  /* 2 · 欧姆定律：控制变量是本实验的命门 */
  ohm: {
    formulas: ['I = \\frac{U}{R}', 'R = \\frac{U}{I}'],
    prompts: [
      p(
        'variables',
        TAG.variables,
        '探究「电流与电阻关系」时，每次更换更大阻值的定值电阻后，滑动变阻器的滑片应该向哪边移？为什么必须这么做？',
        'When studying how current depends on resistance, after replacing the fixed resistor with a larger one, which way should the rheostat slider move? Why is that adjustment unavoidable?',
      ),
      p(
        'hypothesis',
        TAG.hypothesis,
        '在探究「电流与电压关系」时，定值电阻能否替换为小灯泡？结合温度对电阻的影响谈谈为什么不行。',
        'When studying how current depends on voltage, could I replace the fixed resistor with a small bulb? Using what you know about how temperature affects resistance, explain why that spoils the experiment.',
      ),
      p(
        'diagnosis',
        TAG.diagnosis,
        '调节滑动变阻器滑片，发现电流表示数变大而电压表示数变小，是不是电压表接错了位置？接在了哪里？',
        'While adjusting the rheostat I see the ammeter reading grow but the voltmeter reading shrink. Is the voltmeter connected in the wrong place — and where would that be?',
      ),
    ],
  },

  /* 3 · 小灯泡伏安曲线：非线性是本题的全部意义 */
  iv: {
    formulas: ['R = \\frac{U}{I}', 'P = UI'],
    prompts: [
      p(
        'model',
        TAG.graph,
        '观察小灯泡绘制出的 I-U 图像，为什么它是一条向下弯曲的非线性曲线？切线斜率变化说明电阻发生了什么变化？',
        'Looking at the I–U graph my bulb produced: why is it a curve that bends downward instead of a straight line? What does the changing tangent slope tell me about the resistance?',
      ),
      p(
        'hypothesis',
        TAG.micro,
        '从金属导体内自由电子与做热振动的晶格碰撞角度，解释为什么温度升高会导致金属钨丝电阻增大？',
        'From the picture of free electrons colliding with a thermally vibrating lattice, explain why a hotter tungsten filament has a larger resistance.',
      ),
      p(
        'model',
        TAG.model,
        '测量小灯泡电阻时，能否将多次测得的电阻值求平均值作为灯泡的阻值？为什么这与定值电阻不同？',
        'When measuring a bulb’s resistance, may I average the values from several trials and call that "the" resistance? Why is that wrong for a bulb but right for a fixed resistor?',
      ),
    ],
  },

  /* 4 · 惠斯通电桥：零示法的精髓在于「不读表」 */
  bridge: {
    formulas: ['\\frac{R_1}{R_2} = \\frac{R_3}{R_x}'],
    prompts: [
      p(
        'hypothesis',
        TAG.derive,
        '电桥达到平衡状态（灵敏电流计指针指 0）时，为什么必有 R1/R2 = R3/Rx？请基于各支路电势降落推导平衡条件。',
        'When the bridge is balanced (galvanometer reads 0), why must R1/R2 = R3/Rx hold? Derive the balance condition from the potential drops along each branch.',
      ),
      p(
        'model',
        TAG.measure,
        '相比传统的伏安法，惠斯通电桥测量未知电阻具有极高的准确度，它在测量方法上消除了什么误差（提示：电表内阻影响）？',
        'Compared with the ordinary voltmeter–ammeter method, the Wheatstone bridge measures an unknown resistance very accurately. Which error has its method removed? (Hint: the meters’ own resistance.)',
      ),
    ],
  },

  /* 5 · 短路与保险丝：先算危害，再讲选材 */
  fuse: {
    formulas: ['I = \\frac{U}{R}', 'Q = I^2Rt'],
    prompts: [
      p(
        'hypothesis',
        TAG.hazard,
        '导线直接连在电源两极发生短路瞬间，结合 I=U/R 与 Q=I²Rt，为什么电流和导线发热量会呈几十倍爆炸式剧增？',
        'At the instant a wire shorts the two poles of the supply, use I=U/R together with Q=I²Rt to explain why the current and the heat in the wire can jump by tens of times.',
      ),
      p(
        'model',
        TAG.safety,
        '为什么保险丝必须选用电阻率较大、熔点较低的铅锑合金制成？绝对不能用铜丝或铁丝代替保险丝的原因是什么？',
        'Why must a fuse be made of a lead–antimony alloy with a fairly large resistivity and a low melting point? Why is replacing it with copper or iron wire outright dangerous?',
      ),
    ],
  },

  /* 6 · 焦耳定律：生活现象与实验选材各一条 */
  joule: {
    formulas: ['Q = I^2Rt', 'P = I^2R'],
    prompts: [
      p(
        'hypothesis',
        TAG.everyday,
        '电炉丝通电后热得发红，而连接电炉丝的铜导线却几乎不热。明明串联在同一电路中电流完全相同，为什么发热量差距如此悬殊？',
        'The heating element of an electric stove glows red, yet the copper wires feeding it stay cool. They are in series, so the current is exactly the same — why is the heat so different?',
      ),
      p(
        'variables',
        TAG.design,
        '实验中我们通过观察烧瓶内煤油温度计升高的示数来比较热量，为什么选用比热容较小的煤油而不是水？',
        'In the experiment we compare heat by watching how far the thermometer rises in the flask of kerosene. Why kerosene, with its small specific heat capacity, rather than water?',
      ),
    ],
  },

  /* 7 · 影响电阻大小的因素：长度/面积的等效模型 + 材料对比的控制变量 */
  rwire: {
    formulas: ['R = \\rho\\frac{L}{S}'],
    prompts: [
      p(
        'model',
        TAG.equivalent,
        '为什么导线越长电阻越大、横截面积越大电阻越小？如何用「多段导线串联」和「多根导线并联」来建立物理等效模型？',
        'Why does a longer wire have more resistance and a thicker one less? Build the equivalent model using "several wire segments in series" and "several wires in parallel".',
      ),
      p(
        'variables',
        TAG.control,
        '如何用手头仅有的滑动变阻器和电流表，科学设计实验来横向对比镍铬合金丝与锰铜合金丝的电阻率差异？',
        'With only a rheostat and an ammeter available, how would you design an experiment that fairly compares the resistivity of a nichrome wire with that of a manganin wire?',
      ),
    ],
  },

  /* 8 · 自由实验台：诊断 + 创新，通用兜底 */
  free: {
    formulas: ['I = \\frac{U}{R}', 'P = UI'],
    prompts: [
      p(
        'diagnosis',
        TAG.checkup,
        '我正在自由搭建电路，请充当电路诊断专家，引导我检查当前连接是否存在电源短路、电表反偏、量程超载或未接滑动变阻器限流等风险。',
        'I am building a circuit from scratch. Act as a circuit doctor and guide me through checking for a short across the supply, a meter connected backwards, an overloaded range, or a missing rheostat to limit the current.',
      ),
      p(
        'variables',
        TAG.invent,
        '我想利用手头的元件自制一个可调亮度的调光台灯或简易双挡电热毯，应该如何设计电路原理图？',
        'I want to build a dimmable desk lamp or a two-setting electric blanket from the parts on hand. How should I design the circuit diagram?',
      ),
    ],
  },
};

/** 未知 id 的兜底：自由台那两条本来就与具体电路无关，任何空台都用得上。 */
const FALLBACK = PRESET_INQUIRY.free;

/**
 * `preset.principle` 只是把 `formulas` 串读一遍的预设——卡片上两处并排会读成重复。
 *
 * 只列「纯复述」的：串并联的 principle 就是 I = I₁ = I₂、U = U₁ + U₂、R = R₁ + R₂ 这三条，
 * 公式块已经逐条排版，再念一遍纯属噪声。
 * 其余七套的 principle 都带了公式之外的东西，必须留着：欧姆定律是「U–I 图线过原点、斜率等于 R」，
 * 伏安特性是「灯丝电阻随温度升高」的因果，惠斯通电桥是「检流计无电流」的平衡判据，
 * 焦耳/保险丝是「串联时电阻越大发热越快」「短路时总电阻骤减」的结论，
 * 电阻定律是「材料、长度、横截面积共同决定电阻」，自由台是「先连回路再闭合开关」的操作要领。
 */
const PRINCIPLE_RESTATES_FORMULAS = new Set<string>(['sp']);

/** 该预设的 principle 是否已被公式块完全覆盖（是 → 浮卡不再重复这一行）。 */
export function principleIsRedundant(presetId: string): boolean {
  return PRINCIPLE_RESTATES_FORMULAS.has(presetId);
}

/** 取某个预设的探究支架；语言缺失的条目整条丢弃，不输出半句话。 */
export function presetInquiry(presetId: string): PresetInquiry {
  return PRESET_INQUIRY[presetId] ?? FALLBACK;
}

/** 当前语言下的可用条目（缺该语言的条目不展示） */
export function promptText(prompt: InquiryPrompt, zh: boolean): string {
  const text = zh ? prompt.zh : prompt.en;
  return typeof text === 'string' ? text.trim() : '';
}

/** 胶囊上看的那一句话：中英都缺就不渲染（见 PresetBriefing） */
export function hasPromptText(prompt: InquiryPrompt): boolean {
  return promptText(prompt, true).length > 0 || promptText(prompt, false).length > 0;
}

/** 胶囊 title：说明这一问落在四阶段的哪一环。 */
export function stageHint(prompt: InquiryPrompt, zh: boolean): string {
  const stage = STAGE_LABEL[prompt.stage];
  return zh ? `科学探究 · ${stage.zh}` : `Scientific inquiry · ${stage.en}`;
}

/**
 * 发给 AI 的那句提问：带上预设名与方括号标识。
 *
 * 为什么要在提问里重复预设名：AI 侧的实时状态是粗粒度摘要，
 * 学生从「上一轮问答」点开追问时带着的上下文里并没有预设名，
 * 而「串联还是并联」「哪根是试样」直接决定它该引导什么。
 */
export function inquiryQuestion(prompt: InquiryPrompt, presetTitle: string, zh: boolean): string {
  const tag = zh ? prompt.tag.zh : prompt.tag.en;
  const text = promptText(prompt, zh) || promptText(prompt, !zh);
  return `【${presetTitle} · ${tag}】${text}`;
}

/**
 * 苏格拉底式启发系统的教学人设（注入 AI 的系统提示词，见 AiPageContext.persona）。
 *
 * 与 `buildSystemPrompt` 第三节「绝对禁止」有一处必须打通的张力：那里禁止向学生反问，
 * 因为面板上没有输入框，学生只能点预设问题、无法回话。所以这里的「追问」不是问句，
 * 而是**引导学生自己想的句子**（「先想一想：…」）——保留苏格拉底的引导方式，
 * 又不制造一个学生永远答不上的对话回合。校本口径见 `PRESET_INQUIRY` 的注释。
 */
export function socraticPersona(presetTitle: string, zh: boolean): string {
  if (zh) {
    return [
      `你是一位引导中学生进行科学探究的物理实验导师。当前实验为【${presetTitle}】。`,
      '请遵循苏格拉底启发法：严禁直接报出答案；先肯定并剖析用户的思考角度，再通过 1~2 个关键物理量或生活类比进行追问，引导学生自己推导并得出结论。',
      '注意：面板上没有输入框，学生无法回话——「追问」请写成引导学生自己想的句子（如「先想一想：电流在这两点之间是不是同一条通路」），不要写成等他回答的问句，也不要说「你明白了吗」。',
    ].join('\n');
  }
  return [
    `You are a physics lab mentor who leads middle-school students through scientific inquiry. The current experiment is "${presetTitle}".`,
    'Follow the Socratic method: never state the answer outright. First acknowledge and examine the student’s own reasoning, then probe with one or two key quantities or everyday analogies so the student derives the conclusion.',
    'Remember: this panel has no input box and the student cannot reply — phrase each probe as something for the student to think through ("First ask yourself whether …"), never as a question awaiting an answer, and never say "does that make sense?".',
  ].join('\n');
}

/** 预设名（当前语言），供提问前缀与人设共用。 */
export function presetTitleOf(presetId: string, zh: boolean): string {
  const title = getPreset(presetId).title;
  return zh ? title.zh : title.en;
}
