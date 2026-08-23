/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 8 例经典电路图样式配置：串联 4 例（基础两灯 / 分压验证 / 滑动变阻器调光 / 三灯串联）
 * + 并联 4 例（基础两灯 / 家庭电路 / 三电流表 / 三灯并联）。
 *
 * 每例只声明「元件布局 + 物理参数 + 教学文案」，导线/电压引线/探针目标图（wires/comps）
 * 由统一生成器按拓扑（串联链 / 并联网）程序化产出，保证 8 例共享同一套物理与测量引擎。
 */
import type { MeasurableComp, MeasurableWire } from '../../components/lab/MeterProbe';

export type CircuitStyleId =
  | 'series2' // 串-1 两灯串联 + 总开关
  | 'seriesDiv' // 串-2 串联分压验证（V 表预置强调分压）
  | 'seriesRheo' // 串-3 滑动变阻器调光
  | 'series3' // 串-4 三灯串联
  | 'parallel2' // 并-1 两灯并联 + 干路/支路开关
  | 'parallelHouse' // 并-2 家庭电路（保险丝 + 支路独立开关）
  | 'parallelMeters' // 并-3 三电流表固定接线（A₀/A₁/A₂）
  | 'parallel3'; // 并-4 三灯并联

export type StyleElementKind = 'bulb' | 'rheostat' | 'fuse';

export interface StyleElement {
  kind: StyleElementKind;
  /** 阻值（Ω）：变阻器为初始值，运行时可调 */
  r: number;
  label: string;
  /** 串联：元件中心 x（y=60）；并联：忽略（支路 y 由 index 决定） */
  x: number;
}

export interface StyleCopy {
  zh: string;
  en: string;
}

/** 三幕文案（每例一套，言简意赅） */
export interface StyleCopySet {
  title: StyleCopy;
  /** 幕1 预测题 */
  predict: { question: StyleCopy; options: StyleCopy[]; hint: StyleCopy };
  /** 幕2 探索卡 */
  cards: { title: StyleCopy; prompt: StyleCopy }[];
  /** 幕3 结论单选（每项含 correctIndex 标注正确答案索引） */
  conclude: { question: StyleCopy; options: StyleCopy[]; correctIndex: number }[];
  /** 考点速记 */
  tips: StyleCopy[];
}

export interface StyleConfig {
  id: CircuitStyleId;
  kind: 'series' | 'parallel';
  /** 串联链元件（按序）；并联：每条支路一个元件 */
  elements: StyleElement[];
  /** 并联支路独立开关（S₁/S₂…） */
  branchSwitches: boolean;
  /** 干路保险丝（家庭电路） */
  fuse: boolean;
  /** 固定电表（并-3：干路 A₀ + 支路 A₁/A₂） */
  fixedMeters: boolean;
  /** 变阻器元件索引（串联时存在） */
  rheostatIndex?: number;
  copy: StyleCopySet;
}

/* ---------- 布局常量（viewBox 320×200） ---------- */
export const SVG_W = 320;
export const SVG_H = 220; // 200 → 220：三支路并联底部留充足间距
export const BATT_X = 40; // 电池竖线 x
export const SW_X1 = 60; // 总开关左触点
export const SW_X2 = 110; // 总开关右触点
export const NODE_X = 135; // 干路节点
export const RIGHT_X = 290; // 右端汇合/回线 x
export const RETURN_Y = 195; // 并联回流线 y（三支路底部留充足间距）
export const LAMP_R = 12;
/** 并联支路 y（2 支路 / 3 支路：75px 间距，保证「下方标签」与「上方电压表」互不遮挡） */
const BRANCH_YS_2 = [40, 140];
const BRANCH_YS_3 = [45, 120, 195];

/** 元件类型辅助 */
const isZeroR = (e: StyleElement) => e.kind === 'fuse';

/* ---------- 8 例配置 ---------- */
export const CIRCUIT_STYLES: StyleConfig[] = [
  {
    id: 'series2',
    kind: 'series',
    elements: [
      { kind: 'bulb', r: 10, label: 'R₁', x: 200 },
      { kind: 'bulb', r: 20, label: 'R₂', x: 260 },
    ],
    branchSwitches: false,
    fuse: false,
    fixedMeters: false,
    copy: {
      title: { zh: '两灯串联', en: 'Two bulbs in series' },
      predict: {
        question: { zh: '两个电阻 R₁=10Ω、R₂=20Ω 串联，谁更亮？', en: 'R₁=10Ω, R₂=20Ω in series — which bulb is brighter?' },
        options: [
          { zh: '一样亮', en: 'Same' },
          { zh: 'R₁ 那盏更亮', en: 'R₁ is brighter' },
          { zh: 'R₂ 那盏更亮', en: 'R₂ is brighter' },
        ],
        hint: { zh: '猜完，就可以揭示电路', en: 'After guessing, reveal the circuit' },
      },
      cards: [
        { title: { zh: '串联：电流处处相等', en: 'Series: current is the same' }, prompt: { zh: '闭合开关，两灯亮度不同但电流处处相等——串联电流只有一个值。', en: 'Close the switch. Bulbs differ in brightness but series current is one value everywhere.' } },
        { title: { zh: '分压规律', en: 'Voltage division' }, prompt: { zh: '用电压表测 R₁、R₂ 两端电压，看看 V₁+V₂ 和电源电压 U 的关系。', en: 'Measure V₁ and V₂ — how do they add up against U?' } },
      ],
      conclude: [
        { question: { zh: '串联电路中，电流关系是？', en: 'In series, the current relationship is?' }, options: [{ zh: '处处相等', en: 'Equal everywhere' }, { zh: '电阻大的电流大', en: 'Larger R → larger I' }], correctIndex: 0 },
        { question: { zh: '串联分压，电阻大的两端电压？', en: 'Voltage division: larger resistance gets?' }, options: [{ zh: '更大', en: 'More' }, { zh: '更小', en: 'Less' }], correctIndex: 0 },
      ],
      tips: [
        { zh: '串联电流处处相等：I = I₁ = I₂', en: 'Series current is equal everywhere: I = I₁ = I₂' },
        { zh: '串联分压：电阻越大分得电压越多（V=IR）', en: 'Voltage divides by resistance: larger R gets more V' },
        { zh: '串联总电阻 = 各电阻之和', en: 'Total series resistance = sum of all' },
      ],
    },
  },
  {
    id: 'seriesDiv',
    kind: 'series',
    elements: [
      { kind: 'bulb', r: 10, label: 'R₁', x: 200 },
      { kind: 'bulb', r: 20, label: 'R₂', x: 260 },
    ],
    branchSwitches: false,
    fuse: false,
    fixedMeters: false,
    copy: {
      title: { zh: '串联分压验证', en: 'Series voltage division' },
      predict: {
        question: { zh: 'R₁=10Ω、R₂=20Ω 串联，R₂ 两端电压 V₂ 与 R₁ 两端 V₁ 的关系是？', en: 'R₁=10Ω, R₂=20Ω in series. V₂ vs V₁?' },
        options: [
          { zh: 'V₂ = V₁', en: 'V₂ = V₁' },
          { zh: 'V₂ = 2V₁', en: 'V₂ = 2V₁' },
          { zh: 'V₂ = V₁/2', en: 'V₂ = V₁/2' },
        ],
        hint: { zh: '猜完，就可以揭示电路', en: 'After guessing, reveal the circuit' },
      },
      cards: [
        { title: { zh: '测 V₁ 和 V₂', en: 'Measure V₁ and V₂' }, prompt: { zh: '把电压表跨接在 R₁、R₂ 两端，记录 V₁、V₂ 和 U。', en: 'Place the voltmeter across R₁ and R₂, record V₁, V₂ and U.' } },
        { title: { zh: '验证 V₁+V₂=U', en: 'Verify V₁+V₂=U' }, prompt: { zh: '改变 U 和两个电阻，V₁+V₂ 是否始终等于 U？', en: 'Vary U and the resistors — does V₁+V₂ always equal U?' } },
      ],
      conclude: [
        { question: { zh: '串联电路中 V₁:V₂ 与 R₁:R₂ 的关系是？', en: 'In series, V₁:V₂ vs R₁:R₂?' }, options: [{ zh: '相等', en: 'Equal' }, { zh: '无关', en: 'Unrelated' }], correctIndex: 0 },
        { question: { zh: '分压公式是？', en: 'The divider formula is?' }, options: [{ zh: 'Vᵢ = U·Rᵢ/(R₁+R₂)', en: 'Vᵢ = U·Rᵢ/(R₁+R₂)' }, { zh: 'Vᵢ = U·(R₁+R₂)/Rᵢ', en: 'Vᵢ = U·(R₁+R₂)/Rᵢ' }], correctIndex: 0 },
      ],
      tips: [
        { zh: '串联分压：V₁:V₂ = R₁:R₂', en: 'Series division: V₁:V₂ = R₁:R₂' },
        { zh: 'V₁+V₂ = U（电源电压）', en: 'V₁+V₂ = U (supply)' },
        { zh: '分压公式 Vᵢ = U·Rᵢ/ΣR', en: 'Vᵢ = U·Rᵢ/ΣR' },
      ],
    },
  },
  {
    id: 'seriesRheo',
    kind: 'series',
    elements: [
      { kind: 'bulb', r: 10, label: '灯泡', x: 200 },
      { kind: 'rheostat', r: 15, label: 'R_p', x: 268 },
    ],
    branchSwitches: false,
    fuse: false,
    fixedMeters: false,
    rheostatIndex: 1,
    copy: {
      title: { zh: '滑动变阻器调光', en: 'Rheostat dimmer' },
      predict: {
        question: { zh: '串联电路里变阻器阻值 R_p 增大，灯泡会？', en: 'R_p increases in series — the bulb gets?' },
        options: [
          { zh: '变暗', en: 'Dimmer' },
          { zh: '变亮', en: 'Brighter' },
          { zh: '不变', en: 'Unchanged' },
        ],
        hint: { zh: '猜完，就可以揭示电路', en: 'After guessing, reveal the circuit' },
      },
      cards: [
        { title: { zh: '调光实验', en: 'Dimming experiment' }, prompt: { zh: '拖动 R_p 滑块，观察灯泡亮度与电流表读数的变化。', en: 'Drag the R_p slider — watch brightness and current.' } },
        { title: { zh: '变阻器的作用', en: 'Role of the rheostat' }, prompt: { zh: 'R_p 增大时电流怎么变？总电阻怎么变？', en: 'When R_p grows, how do current and total R change?' } },
      ],
      conclude: [
        { question: { zh: 'R_p 增大，电路总电流？', en: 'R_p increases — total current?' }, options: [{ zh: '减小', en: 'Decreases' }, { zh: '增大', en: 'Increases' }], correctIndex: 0 },
        { question: { zh: '滑动变阻器在这里的作用是？', en: 'The rheostat acts as?' }, options: [{ zh: '改变电路电流（调光）', en: 'Current control (dimming)' }, { zh: '保护灯泡不受温度影响', en: 'Thermal protection' }], correctIndex: 0 },
      ],
      tips: [
        { zh: '串联变阻器 R_p 增大 → 总电阻增大 → 电流减小 → 灯变暗', en: 'R_p up → total R up → I down → bulb dims' },
        { zh: '滑动变阻器通过改变接入电阻丝长度改变阻值', en: 'Rheostat changes R via wiper position' },
        { zh: '调光台灯就是串联变阻器原理', en: 'Dimmer lamps use series rheostats' },
      ],
    },
  },
  {
    id: 'series3',
    kind: 'series',
    elements: [
      { kind: 'bulb', r: 10, label: 'R₁', x: 175 },
      { kind: 'bulb', r: 20, label: 'R₂', x: 225 },
      { kind: 'bulb', r: 30, label: 'R₃', x: 275 },
    ],
    branchSwitches: false,
    fuse: false,
    fixedMeters: false,
    copy: {
      title: { zh: '三灯串联', en: 'Three bulbs in series' },
      predict: {
        question: { zh: 'R₁=10Ω、R₂=20Ω、R₃=30Ω 三灯串联，哪盏最亮？', en: 'R₁=10, R₂=20, R₃=30Ω in series — brightest?' },
        options: [
          { zh: 'R₁（最小电阻）', en: 'R₁ (smallest)' },
          { zh: 'R₂', en: 'R₂' },
          { zh: 'R₃（最大电阻）', en: 'R₃ (largest)' },
        ],
        hint: { zh: '猜完，就可以揭示电路', en: 'After guessing, reveal the circuit' },
      },
      cards: [
        { title: { zh: '三灯亮度排序', en: 'Brightness order' }, prompt: { zh: '闭合开关，比较三盏灯亮度，与电阻大小对应。', en: 'Close the switch and rank brightness vs resistance.' } },
        { title: { zh: '任一处断开', en: 'One break, all dark' }, prompt: { zh: '断开总开关，三盏灯是否同时熄灭？为什么？', en: 'Open the switch — do all three go dark? Why?' } },
      ],
      conclude: [
        { question: { zh: '串联三灯，最亮的是？', en: 'Brightest in series?' }, options: [{ zh: '电阻最大的', en: 'Largest R' }, { zh: '电阻最小的', en: 'Smallest R' }], correctIndex: 0 },
        { question: { zh: '串联电路中一处断开，其他用电器？', en: 'One break in series — others?' }, options: [{ zh: '全部停止工作', en: 'All stop' }, { zh: '继续工作', en: 'Keep working' }], correctIndex: 0 },
      ],
      tips: [
        { zh: '串联亮度 ∝ 功率 P=I²R：电流相同，R 大更亮', en: 'Series brightness ∝ P=I²R: same I, larger R brighter' },
        { zh: '串联一处断开全灭（一损俱损）', en: 'One break in series kills all' },
        { zh: '"一串灯"（如老式彩灯）就是串联', en: 'String lights are series circuits' },
      ],
    },
  },
  {
    id: 'parallel2',
    kind: 'parallel',
    elements: [
      { kind: 'bulb', r: 10, label: 'R₁', x: 200 },
      { kind: 'bulb', r: 20, label: 'R₂', x: 200 },
    ],
    branchSwitches: true,
    fuse: false,
    fixedMeters: false,
    copy: {
      title: { zh: '两灯并联', en: 'Two bulbs in parallel' },
      predict: {
        question: { zh: 'R₁=10Ω、R₂=20Ω 并联，谁更亮？', en: 'R₁=10Ω, R₂=20Ω in parallel — brighter?' },
        options: [
          { zh: '一样亮', en: 'Same' },
          { zh: 'R₁（小电阻）更亮', en: 'R₁ (smaller R)' },
          { zh: 'R₂（大电阻）更亮', en: 'R₂ (larger R)' },
        ],
        hint: { zh: '猜完，就可以揭示电路', en: 'After guessing, reveal the circuit' },
      },
      cards: [
        { title: { zh: '并联分流', en: 'Parallel branches' }, prompt: { zh: '测两支路电流 I₁、I₂ 和干路电流 I₀，找关系。', en: 'Measure I₁, I₂ and main current I₀.' } },
        { title: { zh: '支路独立', en: 'Branch independence' }, prompt: { zh: '断开 S₁，另一支路还亮吗？干路电流怎么变？', en: 'Open S₁ — does the other branch stay on?' } },
      ],
      conclude: [
        { question: { zh: '并联各支路电压？', en: 'Parallel branch voltages?' }, options: [{ zh: '都等于电源电压', en: 'All equal U' }, { zh: '按电阻分配', en: 'Divide by R' }], correctIndex: 0 },
        { question: { zh: '干路电流与支路电流关系？', en: 'Main vs branch currents?' }, options: [{ zh: 'I₀ = I₁+I₂', en: 'I₀ = I₁+I₂' }, { zh: 'I₀ = I₁ = I₂', en: 'I₀ = I₁ = I₂' }], correctIndex: 0 },
      ],
      tips: [
        { zh: '并联各支路电压相等：U = U₁ = U₂', en: 'Parallel branches share voltage: U=U₁=U₂' },
        { zh: '干路电流 = 各支路之和：I₀ = I₁+I₂', en: 'Main current = sum of branches: I₀=I₁+I₂' },
        { zh: '并联时电阻小的支路电流大、灯更亮', en: 'Smaller R branch: larger I, brighter' },
      ],
    },
  },
  {
    id: 'parallelHouse',
    kind: 'parallel',
    elements: [
      { kind: 'bulb', r: 484, label: 'R₁', x: 200 },
      { kind: 'bulb', r: 968, label: 'R₂', x: 200 },
    ],
    branchSwitches: true,
    fuse: true,
    fixedMeters: false,
    copy: {
      title: { zh: '家庭电路', en: 'Household circuit' },
      predict: {
        question: { zh: '家庭电路各用电器是串联还是并联？断开一盏灯（S₁），另一盏？', en: 'Household appliances: series or parallel? Open S₁ — the other lamp?' },
        options: [
          { zh: '并联，另一盏仍亮', en: 'Parallel — other stays on' },
          { zh: '串联，另一盏熄灭', en: 'Series — other goes off' },
        ],
        hint: { zh: '猜完，就可以揭示电路', en: 'After guessing, reveal the circuit' },
      },
      cards: [
        { title: { zh: '一坏照常', en: 'One fails, others work' }, prompt: { zh: '断开 S₁（模拟一盏灯坏了），另一盏灯和干路电流如何？', en: 'Open S₁ — what happens to the other lamp and main current?' } },
        { title: { zh: '火线与零线', en: 'Live & neutral' }, prompt: { zh: '家庭电路是交流电：电源标有火线 L、零线 N。保险丝接在火线上。', en: 'Household AC: the source shows live (L) and neutral (N); the fuse sits on the live wire.' } },
        { title: { zh: '保险丝', en: 'The fuse' }, prompt: { zh: '保险丝串在火线上，电流过大时熔断——它保护什么？', en: 'The fuse is in the live wire — what does it protect?' } },
      ],
      conclude: [
        { question: { zh: '家庭电路用电器是？', en: 'Household appliances are?' }, options: [{ zh: '并联', en: 'Parallel' }, { zh: '串联', en: 'Series' }], correctIndex: 0 },
        { question: { zh: '保险丝应接在？', en: 'The fuse goes in?' }, options: [{ zh: '干路（火线）', en: 'Main line (live)' }, { zh: '每个支路', en: 'Every branch' }], correctIndex: 0 },
      ],
      tips: [
        { zh: '家庭电路全部并联：各用电器独立工作', en: 'Household circuits are parallel: independent appliances' },
        { zh: '家庭电路为交流电（~），有火线 L、零线 N 与接地（地线 E）三线', en: 'Household AC (~) has live (L), neutral (N) and earth/ground (E) wires' },
        { zh: '保险丝（电阻大熔点低）串在火线上，电流过大熔断保护电路', en: 'Fuse (high R, low melting point) in the live wire breaks on overload' },
        { zh: '开关接在火线上，断开后电器不带电', en: 'Switches on the live wire' },
        { zh: '三孔插座多出的上孔接接地线，防止金属外壳带电触电', en: 'The third (upper) socket pin connects to earth — protects against electric shock' },
      ],
    },
  },
  {
    id: 'parallelMeters',
    kind: 'parallel',
    elements: [
      { kind: 'bulb', r: 10, label: 'R₁', x: 200 },
      { kind: 'bulb', r: 20, label: 'R₂', x: 200 },
    ],
    branchSwitches: true,
    fuse: false,
    fixedMeters: true,
    copy: {
      title: { zh: '三电流表测并联', en: 'Three ammeters in parallel' },
      predict: {
        question: { zh: '干路电流 A₀ 与支路电流 A₁、A₂ 的关系是？', en: 'Main ammeter A₀ vs branch A₁, A₂?' },
        options: [
          { zh: 'A₀ = A₁ + A₂', en: 'A₀ = A₁ + A₂' },
          { zh: 'A₀ = A₁ = A₂', en: 'A₀ = A₁ = A₂' },
        ],
        hint: { zh: '猜完，就可以揭示电路', en: 'After guessing, reveal the circuit' },
      },
      cards: [
        { title: { zh: '读三块表', en: 'Read three ammeters' }, prompt: { zh: '看 A₀、A₁、A₂ 的读数，验证 I₀=I₁+I₂。', en: 'Read A₀, A₁, A₂ — verify I₀=I₁+I₂.' } },
        { title: { zh: '改变电阻', en: 'Change resistors' }, prompt: { zh: '调 R₁，三块表读数如何联动变化？', en: 'Adjust R₁ — how do the three readings move?' } },
      ],
      conclude: [
        { question: { zh: '干路电流等于？', en: 'Main current equals?' }, options: [{ zh: '各支路之和', en: 'Sum of branches' }, { zh: '支路中的最大者', en: 'Largest branch' }], correctIndex: 0 },
        { question: { zh: '增大一条支路电阻，干路电流？', en: 'One branch R increases — main I?' }, options: [{ zh: '减小', en: 'Decreases' }, { zh: '不变', en: 'Unchanged' }], correctIndex: 0 },
      ],
      tips: [
        { zh: '电流表串联在支路/干路中', en: 'Ammeters go in series with the branch/main' },
        { zh: 'I₀ = I₁+I₂ 直接由三表验证', en: 'I₀=I₁+I₂ verified directly' },
        { zh: '支路电阻增大 → 该支路电流减小 → 干路减小', en: 'Branch R up → branch I down → main I down' },
      ],
    },
  },
  {
    id: 'parallel3',
    kind: 'parallel',
    elements: [
      { kind: 'bulb', r: 10, label: 'R₁', x: 200 },
      { kind: 'bulb', r: 20, label: 'R₂', x: 200 },
      { kind: 'bulb', r: 30, label: 'R₃', x: 200 },
    ],
    branchSwitches: true,
    fuse: false,
    fixedMeters: false,
    copy: {
      title: { zh: '三灯并联', en: 'Three bulbs in parallel' },
      predict: {
        question: { zh: 'R₁=10Ω、R₂=20Ω、R₃=30Ω 并联，哪盏最亮？', en: 'R₁=10, R₂=20, R₃=30Ω parallel — brightest?' },
        options: [
          { zh: 'R₁（最小电阻）', en: 'R₁ (smallest)' },
          { zh: 'R₃（最大电阻）', en: 'R₃ (largest)' },
          { zh: '一样亮', en: 'Same' },
        ],
        hint: { zh: '猜完，就可以揭示电路', en: 'After guessing, reveal the circuit' },
      },
      cards: [
        { title: { zh: '三灯亮度排序', en: 'Brightness order' }, prompt: { zh: '比较三灯亮度——并联时电压相同，亮度由什么决定？', en: 'Rank brightness — same U, what decides it?' } },
        { title: { zh: '支路越多', en: 'More branches' }, prompt: { zh: '三盏全亮时干路电流最大——总电阻最小。', en: 'All three on → largest main current, smallest total R.' } },
      ],
      conclude: [
        { question: { zh: '并联时最亮的是？', en: 'Brightest in parallel?' }, options: [{ zh: '电阻最小的', en: 'Smallest R' }, { zh: '电阻最大的', en: 'Largest R' }], correctIndex: 0 },
        { question: { zh: '并联总电阻与任一支路比？', en: 'Parallel total R vs any branch?' }, options: [{ zh: '更小', en: 'Smaller' }, { zh: '更大', en: 'Larger' }], correctIndex: 0 },
      ],
      tips: [
        { zh: '并联亮度 ∝ P=U²/R：电压相同，R 小更亮', en: 'Parallel brightness ∝ P=U²/R: same U, smaller R brighter' },
        { zh: '并联总电阻小于任一支路', en: 'Parallel total R < any branch' },
        { zh: '支路越多，干路电流越大', en: 'More branches → larger main current' },
      ],
    },
  },
];

/* ---------- 拓扑生成器 ---------- */

export interface GeneratedTopology {
  wires: MeasurableWire[];
  comps: MeasurableComp[];
  /** 电压表引线（画在电路图上） */
  /** 支路 y 坐标（并联） */
  branchYs: number[];
  /** 电流小点动画路径 */
  flowPaths: string[];
  /** 总开关位置 */
  masterSwitch: { x1: number; y1: number; x2: number; y2: number };
  /** 电路图所需 SVG 高度（三支路并联需加高；缺省用默认 SVG_H） */
  svgH?: number;
}

/** 串联链：元件 x 序列 → 导线/引线/wires/comps */
function genSeries(config: StyleConfig): GeneratedTopology {
  const elems = config.elements;
  const n = elems.length;
  const r = LAMP_R;
  const wires: MeasurableWire[] = [
    { id: 'dry-left', x1: BATT_X, y1: 60, x2: SW_X1, y2: 60, current: 'i0' },
    { id: 'dry-mid', x1: SW_X2, y1: 60, x2: NODE_X, y2: 60, current: 'i0' },
    { id: 'dry-batt-top', x1: BATT_X, y1: 60, x2: BATT_X, y2: 70, current: 'i0' },
    { id: 'dry-batt-bot', x1: BATT_X, y1: 82, x2: BATT_X, y2: 140, current: 'i0' },
    { id: 'dry-right', x1: RIGHT_X, y1: 60, x2: RIGHT_X, y2: 140, current: 'i0' },
    { id: 'dry-bottom', x1: RIGHT_X, y1: 140, x2: BATT_X, y2: 140, current: 'i0' },
  ];
  const comps: MeasurableComp[] = [
    { id: 'battery', kind: 'battery', sense1: { x: 72, y: 92 }, sense2: { x: 72, y: 108 }, land: { x: 72, y: 100 }, voltage: 'u' },
  ];
  // 元件间导线 + 每元件 V 引线
  let prevX = NODE_X;
  elems.forEach((e, i) => {
    // 变阻器符号宽 34（半宽 17），灯泡半径 12
    const half = e.kind === 'rheostat' ? 17 : r;
    const left = e.x - half;
    const right = e.x + half;
    wires.push({ id: `seg${i}`, x1: prevX, y1: 60, x2: left, y2: 60, current: 'i0' });
    // 灯泡两端 → 上方引线（横线 y=30，测点 (e.x, 30)）；变阻器只画一端（另一端在干路）
    if (e.kind === 'bulb') {
      comps.push({
        id: `e${i}`,
        kind: 'bulb',
        sense1: { x: left, y: 60 },
        sense2: { x: right, y: 60 },
        land: { x: e.x, y: 30 },
        voltage: `v${i + 1}`,
        body: { cx: e.x, cy: 60, r },
      });
    }
    prevX = right;
  });
  wires.push({ id: `seg${n}`, x1: prevX, y1: 60, x2: RIGHT_X, y2: 60, current: 'i0' });
  const path = `M40,60 H290 V140 H40 V60`;
  return {
    wires,
    comps,
    branchYs: [],
    flowPaths: [path],
    masterSwitch: { x1: SW_X1, y1: 60, x2: SW_X2, y2: 60 },
  };
}

/** 并联网：支路 y 序列 → 导线/引线/wires/comps */
function genParallel(config: StyleConfig): GeneratedTopology {
  const n = config.elements.length;
  const ys = n === 2 ? BRANCH_YS_2 : BRANCH_YS_3;
  // 三支路回流线下移至最下支路标签之下（标签 y=y+22，文字底≈+27）
  const returnY = n === 3 ? ys[ys.length - 1] + 34 : RETURN_Y;
  const svgH = n === 3 ? 260 : undefined;
  const r = LAMP_R;
  const wires: MeasurableWire[] = [
    { id: 'dry-left', x1: BATT_X, y1: 60, x2: SW_X1, y2: 60, current: 'i0' },
    { id: 'dry-mid', x1: SW_X2, y1: 60, x2: NODE_X, y2: 60, current: 'i0' },
    { id: 'dry-batt-top', x1: BATT_X, y1: 60, x2: BATT_X, y2: 70, current: 'i0' },
    { id: 'dry-batt-bot', x1: BATT_X, y1: 82, x2: BATT_X, y2: 140, current: 'i0' },
    { id: 'dry-right', x1: RIGHT_X, y1: ys[0], x2: RIGHT_X, y2: returnY, current: 'i0' },
    { id: 'dry-bottom', x1: RIGHT_X, y1: returnY, x2: BATT_X, y2: returnY, current: 'i0' },
    { id: 'p-neg-drop', x1: BATT_X, y1: returnY, x2: BATT_X, y2: 140, current: 'i0' },
  ];
  const comps: MeasurableComp[] = [
    { id: 'battery', kind: 'battery', sense1: { x: 72, y: 92 }, sense2: { x: 72, y: 108 }, land: { x: 72, y: 100 }, voltage: 'u' },
    // 右侧汇合母线两端 = 并联电路两端节点：电压表并联在此测电路两端电压（而非直接搭电源）
    { id: 'bus', kind: 'bus', sense1: { x: RIGHT_X, y: ys[0] }, sense2: { x: RIGHT_X, y: returnY }, land: { x: RIGHT_X - 18, y: (ys[0] + returnY) / 2 }, voltage: 'u' },
  ];
  ys.forEach((y, i) => {
    const cur = `i${i + 1}`;
    wires.push(
      { id: `p-node${i}`, x1: NODE_X, y1: 60, x2: NODE_X, y2: y, current: 'i0' },
      { id: `p-b${i}-left`, x1: NODE_X, y1: y, x2: 155, y2: y, current: cur },
      { id: `p-b${i}-mid`, x1: 180, y1: y, x2: 188, y2: y, current: cur },
      { id: `p-b${i}-right`, x1: 212, y1: y, x2: RIGHT_X, y2: y, current: cur },
    );
    const e = config.elements[i];
    if (e.kind === 'bulb') {
      const leadY = y - 34; // 引线横线在灯上方（留出清晰间距，避免仪表骑灯泡）
      comps.push({
        id: `e${i}`,
        kind: 'bulb',
        sense1: { x: 188, y },
        sense2: { x: 212, y },
        land: { x: 200, y: leadY },
        voltage: `v${i + 1}`,
        body: { cx: 200, cy: y, r },
      });
    }
  });
  const paths = ys.map((y) => `M40,60 H135 V${y} H290 V${returnY} H40 V60`);
  return {
    wires,
    comps,
    branchYs: ys,
    flowPaths: paths,
    masterSwitch: { x1: SW_X1, y1: 60, x2: SW_X2, y2: 60 },
    svgH,
  };
}

export function genTopology(config: StyleConfig): GeneratedTopology {
  return config.kind === 'series' ? genSeries(config) : genParallel(config);
}
