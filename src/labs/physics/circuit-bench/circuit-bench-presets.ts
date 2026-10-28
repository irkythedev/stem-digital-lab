/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · M1 八个教材实验预设
 *
 * 坐标约定：画布世界坐标 1000×620，rotation=0 时 a 端在右、b 端在左，
 * rotation=90 时 a 端在下、b 端在上。
 *
 * 所有预设都遵循同一套「教科书矩形」骨架：
 * - 左竖边 x≈160：上方开关、下方电源，两者都竖放（rotation=90）；
 * - 上横边 y=150：用电器横放（rotation=0），电流自右向左流过；串联电流表也正立在这条梁上，
 *   红柱（a 端）朝右迎着来流、黑柱（b 端）朝左出流，符合「左黑右红」的教具规范；
 * - 右竖边 x≈830：只走导线，回到电源正极；
 * - 并联电压表缩在上横边上方的外圈支路，取「门」形引线，折点落在被测元件短桩端点上。
 * 这样任意两根「不同电气网络」的导线都不会交叉或共线重叠，
 * 预设加载后就是一张干净的教科书电路图，详见 circuit-bench.test.ts 的验收断言。
 *
 * 每个预设都保证「加载即可读」：开关闭合、滑动变阻器有限流、灯泡不会一上电就烧。
 * 学生仍可在自由实验台里任意改线；预设只是起点，不是锁死的动画。
 */
import { createComponent, settleSimulation, type BenchState, type CircuitComponent } from './circuit-bench-core';
import { createEmptyState } from './circuit-bench-state';
import type { ParamBag } from './circuit-bench-core';

export interface CircuitPreset {
  id: string;
  title: { zh: string; en: string };
  subtitle: { zh: string; en: string };
  grade: { zh: string; en: string };
  objective: { zh: string; en: string };
  principle: { zh: string; en: string };
  /** M1：先看什么、再动什么、最后记录什么 */
  steps: { zh: string; en: string }[];
  /** 记录面板的快捷探针：元件 + 量 + 单位 */
  probes: { elementId: string; quantity: 'current' | 'voltage' | 'power' | 'resistance'; unit: string }[];
  /** 空白实验台没有预设电路 */
  blank?: boolean;
}

type C = CircuitComponent;

/**
 * 建元件。`label` 只用来放**描述性**名字（预设里的「试样」/「Specimen」）：
 * `S` / `A` / `V` / `R′` / `R₁` 这类符号型标签一律不写——画布与数据记录里的
 * `灯泡 L₁`、`电流表 A₂` 由 circuit-bench-naming 按种类与序号派生，
 * 写死了反而会跟序号错位（学生删掉 L₁ 后，剩下的那只还挂着 L₂ 的名字）。
 */
function c(
  id: string,
  kind: C['kind'],
  x: number,
  y: number,
  params: ParamBag = {},
  rotation = 0,
  label?: string,
  labelEn?: string,
): C {
  return createComponent(id, kind, x, y, params, rotation, label, labelEn);
}

function w(from: string, to: string, waypoints?: { x: number; y: number }[]) {
  return waypoints ? { from, to, waypoints } : { from, to };
}

function stateOf(
  components: C[],
  wires: { from: string; to: string; waypoints?: { x: number; y: number }[] }[],
): BenchState {
  return {
    v: 1,
    components,
    wires: wires.map((x, i) => ({ id: `w_${i + 1}`, from: x.from, to: x.to, ...(x.waypoints ? { waypoints: x.waypoints } : {}) })),
  };
}

/* ── 1. 串并联（M1 先给串联主线，并联结构由自由实验台搭建） ── */
const spState = stateOf(
  [
    c('bat', 'battery', 160, 400, { emf: 6, r: 0.3 }, 90),
    c('sw', 'switch', 160, 220, { closed: true }, 90),
    c('l1', 'bulb', 400, 150, { ratedVoltage: 3.8, ratedPower: 1.14 }),
    c('l2', 'bulb', 660, 150, { ratedVoltage: 3.8, ratedPower: 1.14 }),
    // 电流表横放在上横边上、表盘正立：左黑（−）右红（+）的教具规范只有正立时才成立，
    // 而且上横边的电流方向是「自右向左」，正好从红柱流入、黑柱流出。
    // 把它从右竖边挪到梁上，还顺手消掉了电源到下框那段无意义的抬升折线。
    c('a1', 'ammeter', 530, 150, { range: 0.6, r: 0.001 }, 0),
    // 电压表正上方外圈支路：两支表笔分别在灯泡左右两侧竖直下行。
    c('v2', 'voltmeter', 660, 60, { range: 3, r: 1e6 }, 0),
  ],
  [
    // 电表按「红柱（a 端）接高电位、电流从红柱流入」接线：
    // 反接虽然拓扑等价，但指针会向左打、读数要靠绝对值修正，学生读到的
    // 永远是「这表怎么反了」。串联电流表正立时 a 在右，电流自上横边右端来，
    // 从红柱进、黑柱出；并联电压表同样让电流从 a 进、b 出，两只表都读正值。
    //
    // 走线按教科书画法固定：底边直线 / 右竖边 / 上横边 / 左竖边，
    // 每处只用 waypoints 指定「经过这里」，路由器不再自己找中分线。
    // 并联表的「门」形引线折点必须落在被并联元件短桩的**端点**（端子外 18），
    // 折点与短桩同值才不会在接线柱旁多画一级台阶级的折弯。
    w('bat:a', 'l2:a', [{ x: 830, y: 448 }, { x: 830, y: 150 }]),
    w('l2:b', 'a1:a'),
    w('a1:b', 'l1:a'),
    w('l1:b', 'sw:b', [{ x: 160, y: 150 }]),
    w('sw:a', 'bat:b'),
    // 电压表两根引线做成对称的「门」形：先横向出到外圈，再竖直下行接灯泡两端。
    w('v2:a', 'l2:a', [{ x: 702, y: 60 }, { x: 702, y: 150 }]),
    w('v2:b', 'l2:b', [{ x: 618, y: 60 }, { x: 618, y: 150 }]),
  ],
);

/* ── 2. 欧姆定律 ── */
const ohmState = stateOf(
  [
    c('bat', 'battery', 160, 400, { emf: 6, r: 0.5 }, 90),
    c('sw', 'switch', 160, 220, { closed: true }, 90),
    c('r1', 'resistor', 380, 150, { r: 10 }, 0),
    c('rh', 'rheostat', 640, 150, { maxR: 20, minR: 0, ratio: 0.6 }, 0),
    c('a1', 'ammeter', 510, 150, { range: 0.6 }, 0),
    c('v1', 'voltmeter', 380, 60, { range: 3 }, 0),
  ],
  [
    w('bat:a', 'rh:a', [{ x: 830, y: 448 }, { x: 830, y: 150 }]),
    w('rh:b', 'a1:a'),
    w('a1:b', 'r1:a'),
    w('r1:b', 'sw:b', [{ x: 160, y: 150 }]),
    w('sw:a', 'bat:b'),
    w('v1:a', 'r1:a', [{ x: 428, y: 60 }, { x: 428, y: 150 }]),
    w('v1:b', 'r1:b', [{ x: 332, y: 60 }, { x: 332, y: 150 }]),
  ],
);

/* ── 3. 小灯泡伏安曲线 ── */
const ivState = stateOf(
  [
    c('bat', 'battery', 160, 400, { emf: 6, r: 0.1 }, 90),
    c('sw', 'switch', 160, 220, { closed: true }, 90),
    c('l1', 'bulb', 380, 150, { ratedVoltage: 3.8, ratedPower: 1.14 }),
    c('rh', 'rheostat', 640, 150, { maxR: 20, minR: 0, ratio: 1 }, 0),
    c('a1', 'ammeter', 500, 150, { range: 0.6 }, 0),
    c('v1', 'voltmeter', 380, 60, { range: 3 }, 0),
  ],
  [
    w('bat:a', 'rh:a', [{ x: 830, y: 448 }, { x: 830, y: 150 }]),
    w('rh:b', 'a1:a'),
    w('a1:b', 'l1:a'),
    w('l1:b', 'sw:b', [{ x: 160, y: 150 }]),
    w('sw:a', 'bat:b'),
    w('v1:a', 'l1:a', [{ x: 422, y: 60 }, { x: 422, y: 150 }]),
    w('v1:b', 'l1:b', [{ x: 338, y: 60 }, { x: 338, y: 150 }]),
  ],
);

/* ── 4. 惠斯通电桥 ── */
const bridgeState = stateOf(
  [
    c('bat', 'battery', 540, 540, { emf: 3, r: 0.2 }, 0),
    c('sw', 'switch', 300, 540, { closed: true }, 0),
    c('r1', 'resistor', 380, 180, { r: 10 }, 90),
    c('r2', 'resistor', 380, 420, { r: 10 }, 90),
    c('r3', 'resistor', 700, 180, { r: 20 }, 90),
    c('r4', 'resistor', 700, 420, { r: 20 }, 90),
    // 检流计横跨左右两个分压点：左柱 b、右柱 a。
    c('g1', 'galvanometer', 540, 300, { range: 0.05, r: 20 }, 0),
  ],
  [
    // 上节点（r1 顶 / r3 顶）经外圈立柱接电源正极，下节点经开关接负极。
    w('r1:b', 'r3:b'),
    w('r2:a', 'r4:a'),
    // 中间两个分压点：桥臂端点竖直汇到 y=300 的水平中线，再水平接入检流计，
    // 两根同节点导线在中线上重合，画面就是标准电桥的「工」字横担。
    w('r2:b', 'g1:b', [{ x: 380, y: 300 }]),
    w('r1:a', 'g1:b', [{ x: 380, y: 300 }]),
    w('r3:a', 'g1:a', [{ x: 700, y: 300 }]),
    w('r4:b', 'g1:a', [{ x: 700, y: 300 }]),
    // 电源正极沿最右侧立柱上行，避免从两组桥臂中间穿过。
    // 顶部折点取 R₃ b 端短桩的高度（b 端在 y=150，法线向上出 18 → y=132），
    // 折点与短桩同高才不会在接线柱旁多画一级台阶。
    w('bat:a', 'r3:b', [{ x: 740, y: 540 }, { x: 740, y: 132 }]),
    // 左下折点是开关 b 端短桩（端子 x=273，法线向左出 18 → 255），
    // 与短桩同列同高才不会在闸刀座旁边多出一级台阶。
    w('r2:a', 'sw:b', [{ x: 255, y: 468 }]),
    w('sw:a', 'bat:b'),
  ],
);

/* ── 5. 短路与保险丝 ── */
const fuseState = stateOf(
  [
    c('bat', 'battery', 160, 400, { emf: 6, r: 0.5 }, 90),
    c('sw', 'switch', 160, 220, { closed: true }, 90),
    c('fu', 'fuse', 400, 150, { ratedCurrent: 5, r: 0.05 }, 0),
    c('l1', 'bulb', 620, 150, { ratedVoltage: 6, ratedPower: 3 }),
    // 短接开关挂在灯泡下方，两根引线从灯泡两端竖直引出，不横穿主回路。
    c('short', 'switch', 620, 280, { closed: false }, 0),
  ],
  [
    w('sw:a', 'bat:b'),
    w('sw:b', 'fu:b', [{ x: 160, y: 150 }]),
    w('fu:a', 'l1:b'),
    // 右竖边就贴在短接支路外侧（x=720）下行接底边，再从电源下方回到下接线柱：
    // 外圈绕行但不横穿任何元件，也不必甩到画布最右侧再折回来。
    // 底边取电源 a 端短桩高度（端子 y=430，水平出 18 → 448），避免回折出尖刺。
    w('l1:a', 'bat:a', [{ x: 720, y: 150 }, { x: 720, y: 448 }, { x: 160, y: 448 }]),
    w('short:b', 'l1:b', [{ x: 554, y: 280 }, { x: 554, y: 150 }]),
    w('short:a', 'l1:a', [{ x: 686, y: 280 }, { x: 686, y: 150 }]),
  ],
);

/* ── 6. 焦耳定律 ── */
const jouleState = stateOf(
  [
    c('bat', 'battery', 160, 400, { emf: 6, r: 0.5 }, 90),
    c('sw', 'switch', 160, 220, { closed: true }, 90),
    c('a1', 'ammeter', 430, 150, { range: 3 }, 0),
    c('h1', 'heater', 620, 150, { r: 8, mass: 0.02, specificHeat: 460 }, 0),
    c('v1', 'voltmeter', 620, 60, { range: 15 }, 0),
  ],
  [
    w('bat:a', 'h1:a', [{ x: 830, y: 448 }, { x: 830, y: 150 }]),
    w('h1:b', 'a1:a'),
    w('a1:b', 'sw:b', [{ x: 160, y: 150 }]),
    w('sw:a', 'bat:b'),
    w('v1:a', 'h1:a', [{ x: 671, y: 60 }, { x: 671, y: 150 }]),
    w('v1:b', 'h1:b', [{ x: 569, y: 60 }, { x: 569, y: 150 }]),
  ],
);

/* ── 7. 影响电阻大小的因素（电阻定律试样） ── */
const rwireState = stateOf(
  [
    c('bat', 'battery', 160, 400, { emf: 6, r: 0.5 }, 90),
    c('sw', 'switch', 160, 220, { closed: true }, 90),
    c('r1', 'resistor', 380, 150, {
      r: 2.2,
      mode: 'specimen',
      rho: 1.1e-6,
      length: 1,
      area: 5e-7,
      material: 'nichrome',
    }, 0, '试样', 'Specimen'),
    c('rh', 'rheostat', 640, 150, { maxR: 20, minR: 0, ratio: 0.4 }, 0),
    c('a1', 'ammeter', 510, 150, { range: 3 }, 0),
    c('v1', 'voltmeter', 380, 60, { range: 3 }, 0),
  ],
  [
    w('bat:a', 'rh:a', [{ x: 830, y: 448 }, { x: 830, y: 150 }]),
    w('rh:b', 'a1:a'),
    w('a1:b', 'r1:a'),
    w('r1:b', 'sw:b', [{ x: 160, y: 150 }]),
    w('sw:a', 'bat:b'),
    w('v1:a', 'r1:a', [{ x: 428, y: 60 }, { x: 428, y: 150 }]),
    w('v1:b', 'r1:b', [{ x: 332, y: 60 }, { x: 332, y: 150 }]),
  ],
);


export const CIRCUIT_PRESETS: CircuitPreset[] = [
  {
    id: 'sp',
    title: { zh: '串并联电路', en: 'Series & Parallel' },
    subtitle: { zh: '两只灯泡串联：电流处处相等，电压按电阻分配', en: 'Two bulbs in series: equal current, divided voltage' },
    grade: { zh: '苏科版 九上 · 电路初探', en: 'SJ · G9' },
    objective: { zh: '用电流表、电压表验证串联电路的电流与电压规律，再在自由实验台搭并联对照。', en: 'Verify series current and voltage rules, then build a parallel circuit in the sandbox.' },
    principle: { zh: '串联：I = I₁ = I₂，U = U₁ + U₂，R = R₁ + R₂。', en: 'Series: I = I₁ = I₂, U = U₁ + U₂, R = R₁ + R₂.' },
    steps: [
      { zh: '读两只灯泡的电压，比较 U₁ + U₂ 与电源电压。', en: 'Read both bulb voltages and compare their sum with the source voltage.' },
      { zh: '读电流表，比较两个灯泡所在位置的电流（同一支路）。', en: 'Read the ammeter; series current is the same everywhere.' },
      { zh: '在自由实验台把两只灯泡改成并联，比较干路与支路电流。', en: 'Rebuild as parallel in the sandbox and compare main and branch currents.' },
    ],
    probes: [
      { elementId: 'a1', quantity: 'current', unit: 'A' },
      { elementId: 'v2', quantity: 'voltage', unit: 'V' },
      { elementId: 'l2', quantity: 'power', unit: 'W' },
    ],
  },
  {
    id: 'ohm',
    title: { zh: '欧姆定律', en: "Ohm's Law" },
    subtitle: { zh: '改变滑动变阻器，读 U 与 I，作 U-I 图', en: 'Vary the rheostat, read U and I, plot U against I' },
    grade: { zh: '苏科版 九上 · 欧姆定律', en: 'SJ · G9' },
    objective: { zh: '保持 R 不变，探究导体中电流与两端电压的定量关系。', en: 'Keep R constant and find the quantitative I–U relationship.' },
    principle: { zh: 'I = U / R；U-I 图线是过原点的直线，斜率等于 R。', en: 'I = U/R; the U–I graph is a line through the origin with slope R.' },
    steps: [
      { zh: '记录当前 R 的电压与电流。', en: 'Record voltage and current for the fixed resistor.' },
      { zh: '把滑动变阻器从 0.2 拉到 1.0，每次记录一组数据。', en: 'Move the rheostat from 0.2 to 1.0, recording each setting.' },
      { zh: '在测量面板作 U-I 图，检查是否过原点并读斜率。', en: 'Plot U against I and check the origin and slope.' },
    ],
    probes: [
      { elementId: 'v1', quantity: 'voltage', unit: 'V' },
      { elementId: 'a1', quantity: 'current', unit: 'A' },
      { elementId: 'r1', quantity: 'resistance', unit: 'Ω' },
    ],
  },
  {
    id: 'iv',
    title: { zh: '小灯泡伏安曲线', en: 'Bulb I–V Curve' },
    subtitle: { zh: '灯丝温度变化，U-I 图线不再是直线', en: 'Filament heating bends the I–V curve' },
    grade: { zh: '苏科版 九上 · 欧姆定律拓展', en: 'SJ · G9 extension' },
    objective: { zh: '测量小灯泡在不同电压下的电流，认识非线性电阻。', en: 'Measure bulb current at several voltages and see non-ohmic behavior.' },
    principle: { zh: '灯丝 R 随温度升高而增大，所以 U 增大时 I 增长变慢。', en: 'Filament resistance rises with temperature, so current grows more slowly.' },
    steps: [
      { zh: '从低电压开始，每次升高约 0.3 V，等灯泡稳定后再记录。', en: 'Start low and raise by about 0.3 V; wait for the bulb to settle.' },
      { zh: '同时记录电压、电流，观察灯泡亮度。', en: 'Record voltage and current while watching brightness.' },
      { zh: '作 U-I 图；若用直线拟合，残差会偏大。', en: 'Plot U–I; a straight-line fit leaves visible residuals.' },
    ],
    probes: [
      { elementId: 'v1', quantity: 'voltage', unit: 'V' },
      { elementId: 'a1', quantity: 'current', unit: 'A' },
      { elementId: 'l1', quantity: 'resistance', unit: 'Ω' },
      { elementId: 'l1', quantity: 'power', unit: 'W' },
    ],
  },
  {
    id: 'bridge',
    title: { zh: '惠斯通电桥', en: 'Wheatstone Bridge' },
    subtitle: { zh: '调节比例臂，使检流计示数接近零', en: 'Trim the ratio arms until the galvanometer reads near zero' },
    grade: { zh: '高中必修三 · 电阻测量', en: 'High school · resistance measurement' },
    objective: { zh: '理解电桥平衡条件，用零示法测未知电阻。', en: 'Understand bridge balance and measure resistance by null detection.' },
    principle: { zh: '平衡时 R₁/R₂ = R₃/R₄，检流计无电流。', en: 'At balance R₁/R₂ = R₃/R₄ and no current flows through G.' },
    steps: [
      { zh: '读检流计示数，判断电流方向。', en: 'Read G and note the current direction.' },
      { zh: '微调 R₃ 的阻值，直到 G 示数接近零。', en: 'Adjust R₃ until G is near zero.' },
      { zh: '用平衡条件计算未知电阻。', en: 'Use the balance condition to compute the unknown.' },
    ],
    probes: [
      { elementId: 'g1', quantity: 'current', unit: 'A' },
      { elementId: 'r1', quantity: 'voltage', unit: 'V' },
      { elementId: 'r3', quantity: 'voltage', unit: 'V' },
    ],
  },
  {
    id: 'fuse',
    title: { zh: '短路与保险丝', en: 'Short Circuit & Fuse' },
    subtitle: { zh: '闭合 S₂ 短接灯泡，观察保险丝熔断', en: 'Close S₂ to short the bulb and watch the fuse blow' },
    grade: { zh: '苏科版 九上 · 家庭电路', en: 'SJ · G9 household circuits' },
    objective: { zh: '认识短路的危害与保险丝的保护作用。', en: 'See why short circuits are dangerous and how fuses protect.' },
    principle: { zh: '短路时总电阻骤减，I = U/R 急剧增大，保险丝按 I²Rt 熔断。', en: 'A short drops resistance, current surges, and the fuse melts by I²Rt.' },
    steps: [
      { zh: '先读灯泡正常发光时的电流。', en: 'Read the current with the bulb lit normally.' },
      { zh: '闭合 S₂（短接灯泡），观察电流与保险丝。', en: 'Close S₂ to short the bulb, then watch current and fuse.' },
      { zh: '熔断后更换保险丝，思考为什么不能用铜丝代替。', en: 'Replace the fuse and discuss why copper wire is unsafe.' },
    ],
    // 保险丝本身不进探针表（它的观测量是「熔断没有」，画布上已经画出来了），
    // 这个实验要记的是灯泡支路的 I 与 U：短接前后电流的跃变就是结论本身。
    probes: [
      { elementId: 'l1', quantity: 'current', unit: 'A' },
      { elementId: 'l1', quantity: 'voltage', unit: 'V' },
    ],
  },
  {
    id: 'joule',
    title: { zh: '焦耳定律', en: 'Joule’s Law' },
    subtitle: { zh: '改变电流与电阻，比较电热丝发热功率', en: 'Compare heating power as current and resistance change' },
    grade: { zh: '苏科版 九上 · 电热', en: 'SJ · G9 heating' },
    objective: { zh: '用 P = I²R 解释电流、电阻对发热功率的影响。', en: 'Explain how current and resistance affect heating power.' },
    principle: { zh: 'Q = I²Rt，P = I²R；串联时电阻越大发热越快。', en: 'Q = I²Rt, P = I²R; in series the larger resistance heats faster.' },
    steps: [
      { zh: '记录电热丝的电流、电压与功率。', en: 'Record heater current, voltage and power.' },
      { zh: '改变滑动变阻器，观察功率随电流的变化。', en: 'Adjust the rheostat and watch power change with current.' },
      { zh: '比较 I 变为 2 倍时，P 变为几倍。', en: 'Compare power when current doubles.' },
    ],
    probes: [
      { elementId: 'a1', quantity: 'current', unit: 'A' },
      { elementId: 'v1', quantity: 'voltage', unit: 'V' },
      { elementId: 'h1', quantity: 'power', unit: 'W' },
      { elementId: 'h1', quantity: 'resistance', unit: 'Ω' },
    ],
  },
  {
    id: 'rwire',
    title: { zh: '影响电阻大小的因素', en: 'Factors of Resistance' },
    subtitle: { zh: '改变材料、长度、横截面积，读试样电阻', en: 'Vary material, length and area; read specimen resistance' },
    grade: { zh: '苏科版 九上 · 电阻', en: 'SJ · G9 resistance' },
    objective: { zh: '用控制变量法研究 R 与 ρ、L、S 的关系。', en: 'Use controlled variables to study R vs rho, L and S.' },
    principle: { zh: 'R = ρL/S；材料、长度、横截面积共同决定电阻。', en: 'R = ρL/S.' },
    steps: [
      { zh: '保持 L、S 不变，切换材料，读电阻。', en: 'Keep L and S fixed and switch materials.' },
      { zh: '保持材料、S 不变，增大长度，读电阻。', en: 'Keep material and S fixed and increase length.' },
      { zh: '保持材料、L 不变，增大横截面积，读电阻。', en: 'Keep material and L fixed and increase area.' },
    ],
    probes: [
      { elementId: 'r1', quantity: 'resistance', unit: 'Ω' },
      { elementId: 'v1', quantity: 'voltage', unit: 'V' },
      { elementId: 'a1', quantity: 'current', unit: 'A' },
    ],
  },
  {
    id: 'free',
    title: { zh: '自由实验台', en: 'Free Bench' },
    subtitle: { zh: '空白画布：自己放元件、连导线、读数', en: 'Blank canvas: place parts, wire them, take readings' },
    grade: { zh: '任意年级 · 开放探究', en: 'Open inquiry' },
    objective: { zh: '从零搭建任意直流电路，验证自己的猜想。', en: 'Build any DC circuit from scratch and test your ideas.' },
    principle: { zh: '先连回路再闭合开关；电压表并联、电流表串联。', en: 'Close the loop before switching on; voltmeters in parallel, ammeters in series.' },
    steps: [
      { zh: '从左侧拖入电源、用电器和开关。', en: 'Place a source, a load and a switch from the palette.' },
      { zh: '点击「连线」，依次点两个接线柱。', en: 'Choose Wire and click two terminals in order.' },
      { zh: '闭合开关，读表并记录数据。', en: 'Close the switch, read the meters and record data.' },
    ],
    probes: [],
    blank: true,
  },
];

export function getPreset(id: string): CircuitPreset {
  return CIRCUIT_PRESETS.find((p) => p.id === id) ?? CIRCUIT_PRESETS[0];
}

export function presetState(id: string): BenchState {
  switch (id) {
    case 'sp':
      return cloneBench(spState);
    case 'ohm':
      return cloneBench(ohmState);
    case 'iv':
      return cloneBench(ivState);
    case 'bridge':
      return cloneBench(bridgeState);
    case 'fuse':
      return cloneBench(fuseState);
    case 'joule':
      return cloneBench(jouleState);
    case 'rwire':
      return cloneBench(rwireState);
    default:
      return createEmptyState();
  }
}

export function instantiatePreset(id: string): BenchState {
  const s = presetState(id);
  if (getPreset(id).blank) return s;
  // 0.8 s 让灯泡到达工作温度，避免一打开页面就是错误的冷态读数。
  return settleSimulation(s, 0.8).state;
}

function cloneBench(s: BenchState): BenchState {
  return {
    v: 1,
    components: s.components.map((c) => ({ ...c, params: { ...c.params }, state: { ...c.state } })),
    wires: s.wires.map((w) => ({ ...w })),
  };
}

export const PRESET_IDS = CIRCUIT_PRESETS.map((p) => p.id);
