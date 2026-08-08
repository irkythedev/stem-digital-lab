/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 物理常量数据（初中苏科版）。
 * 依据：physics_kb references/formula_sheet.md + key_concepts.md 提炼，
 * 数值对照教材附录。category: mech 力学 / thermal 热学 / optics 光学 /
 * elec 电学 / sound 声学。
 */
export type ConstantCategory = 'mech' | 'thermal' | 'optics' | 'sound' | 'elec';

export interface PhysicalConstant {
  /** 符号/简称（卡片主显示） */
  symbol: string;
  name: { zh: string; en: string };
  /** 数值（卡片副显示） */
  value: string;
  /** 单位 */
  unit: string;
  category: ConstantCategory;
  /** 物理意义（一句话） */
  meaning: { zh: string; en: string };
  /** 典型应用场景 */
  usage: { zh: string; en: string };
  /** 对应教材章节（中文） */
  chapter: string;
  /** 关联实验 id（可选） */
  labId?: string;
}

export const CONSTANT_CATEGORY_ZH: Record<ConstantCategory, string> = {
  mech: '力学',
  thermal: '热学',
  optics: '光学',
  elec: '电学',
  sound: '声学',
};

export const CONSTANT_CATEGORY_EN: Record<ConstantCategory, string> = {
  mech: 'Mechanics',
  thermal: 'Thermal',
  optics: 'Optics',
  elec: 'Electricity',
  sound: 'Sound',
};

export const CONSTANTS: PhysicalConstant[] = [
  // ── 力学 ──
  {
    symbol: 'g',
    name: { zh: '重力常数', en: 'Gravitational acceleration' },
    value: '9.8',
    unit: 'N/kg',
    category: 'mech',
    meaning: { zh: '地球表面附近，质量为 1 kg 的物体受到约 9.8 N 的重力。', en: "Near Earth's surface, a 1 kg mass experiences about 9.8 N of gravity." },
    usage: { zh: '计算重力 G = mg；常取 10 N/kg 简化估算。', en: 'Compute weight G = mg; often rounded to 10 N/kg for estimates.' },
    chapter: '第八章 力',
    labId: 'pressure',
  },
  {
    symbol: 'ρ水',
    name: { zh: '水的密度', en: 'Density of water' },
    value: '1.0×10³',
    unit: 'kg/m³',
    category: 'mech',
    meaning: { zh: '1 m³ 的水质量为 1000 kg，也等于 1 g/cm³。', en: 'One cubic meter of water has a mass of 1000 kg; equals 1 g/cm³.' },
    usage: { zh: '浮力、液体压强计算；鉴别物质。', en: 'Buoyancy, liquid pressure; identifying substances.' },
    chapter: '第六章 物质的物理属性',
    labId: 'buoyancy',
  },
  {
    symbol: 'ρ酒精',
    name: { zh: '酒精的密度', en: 'Density of alcohol' },
    value: '0.8×10³',
    unit: 'kg/m³',
    category: 'mech',
    meaning: { zh: '比水小，故酒精浮于水面上。', en: 'Less than water, so alcohol floats on water.' },
    usage: { zh: '密度比较、浮沉条件判断。', en: 'Comparing densities, buoyancy conditions.' },
    chapter: '第六章 物质的物理属性',
    labId: 'buoyancy',
  },
  {
    symbol: 'ρ铁',
    name: { zh: '铁的密度', en: 'Density of iron' },
    value: '7.9×10³',
    unit: 'kg/m³',
    category: 'mech',
    meaning: { zh: '铁的密度约为水的 7.9 倍。', en: 'Iron is about 7.9 times as dense as water.' },
    usage: { zh: '质量体积换算；鉴别金属。', en: 'Mass-volume conversion; identifying metals.' },
    chapter: '第六章 物质的物理属性',
  },
  {
    symbol: 'ρ铜',
    name: { zh: '铜的密度', en: 'Density of copper' },
    value: '8.9×10³',
    unit: 'kg/m³',
    category: 'mech',
    meaning: { zh: '铜的密度大于铁。', en: 'Copper is denser than iron.' },
    usage: { zh: '金属鉴别、导线质量估算。', en: 'Identifying metals, wire mass estimates.' },
    chapter: '第六章 物质的物理属性',
  },
  {
    symbol: 'ρ铝',
    name: { zh: '铝的密度', en: 'Density of aluminum' },
    value: '2.7×10³',
    unit: 'kg/m³',
    category: 'mech',
    meaning: { zh: '约为铁的 1/3，轻金属。', en: 'About a third of iron—a light metal.' },
    usage: { zh: '航空材料选材依据。', en: 'Basis for aerospace material choices.' },
    chapter: '第六章 物质的物理属性',
  },
  {
    symbol: 'p₀',
    name: { zh: '标准大气压', en: 'Standard atmosphere' },
    value: '1.013×10⁵',
    unit: 'Pa',
    category: 'mech',
    meaning: { zh: '1 标准大气压约等于 760 mmHg 汞柱产生的压强。', en: 'About 760 mmHg of mercury column pressure.' },
    usage: { zh: '大气压相关计算；托里拆利实验。', en: 'Atmospheric pressure problems; Torricelli experiment.' },
    chapter: '第九章 压强和浮力',
    labId: 'pressure',
  },

  // ── 热学 ──
  {
    symbol: 'c水',
    name: { zh: '水的比热容', en: 'Specific heat of water' },
    value: '4.2×10³',
    unit: 'J/(kg·°C)',
    category: 'thermal',
    meaning: { zh: '1 kg 水温度升高 1 °C 需吸收 4.2×10³ J 热量。', en: 'Heating 1 kg of water by 1 °C needs 4.2×10³ J.' },
    usage: { zh: '热量计算 Q = cmΔt；解释沿海昼夜温差小。', en: 'Heat Q = cmΔt; explains mild coastal temperature swings.' },
    chapter: '第十二章 机械能和内能',
  },
  {
    symbol: 'c酒精',
    name: { zh: '酒精的比热容', en: 'Specific heat of alcohol' },
    value: '2.4×10³',
    unit: 'J/(kg·°C)',
    category: 'thermal',
    meaning: { zh: '约为水的 0.57 倍。', en: 'About 0.57 times that of water.' },
    usage: { zh: '热量计算、物质比较。', en: 'Heat calculations, comparisons.' },
    chapter: '第十二章 机械能和内能',
  },
  {
    symbol: 'c冰',
    name: { zh: '冰的比热容', en: 'Specific heat of ice' },
    value: '2.1×10³',
    unit: 'J/(kg·°C)',
    category: 'thermal',
    meaning: { zh: '冰的比热容约为水的一半。', en: 'Ice has about half the specific heat of water.' },
    usage: { zh: '冰水混合物的热量计算。', en: 'Heat problems with ice-water mixtures.' },
    chapter: '第十二章 机械能和内能',
  },
  {
    symbol: '0',
    name: { zh: '冰的熔点 / 水的凝固点', en: 'Melting point of ice' },
    value: '0 °C',
    unit: '',
    category: 'thermal',
    meaning: { zh: '标准大气压下，冰的熔点与水的凝固点都是 0 °C。', en: 'At 1 atm, ice melts and water freezes at 0 °C.' },
    usage: { zh: '物态变化判断；摄氏温标定义（冰水混合物 0 °C）。', en: 'Phase changes; Celsius scale definition.' },
    chapter: '第四章 物态变化',
  },
  {
    symbol: '100',
    name: { zh: '水的沸点', en: 'Boiling point of water' },
    value: '100 °C',
    unit: '',
    category: 'thermal',
    meaning: { zh: '标准大气压下水的沸点；气压越低沸点越低。', en: 'Water boils at 100 °C at 1 atm; lower pressure lowers the boiling point.' },
    usage: { zh: '沸腾条件；高原煮饭用高压锅。', en: 'Boiling conditions; pressure cookers at altitude.' },
    chapter: '第四章 物态变化',
  },
  {
    symbol: '−39',
    name: { zh: '水银的凝固点', en: 'Freezing point of mercury' },
    value: '−39 °C',
    unit: '',
    category: 'thermal',
    meaning: { zh: '水银温度计在 −39 °C 以下会凝固失效。', en: 'Mercury thermometers fail below −39 °C.' },
    usage: { zh: '温度计选型（寒冷地区用酒精温度计）。', en: 'Thermometer choice (alcohol in cold regions).' },
    chapter: '第四章 物态变化',
  },
  {
    symbol: '357',
    name: { zh: '水银的沸点', en: 'Boiling point of mercury' },
    value: '357 °C',
    unit: '',
    category: 'thermal',
    meaning: { zh: '水银的沸点远高于水的沸点。', en: 'Mercury boils far above water.' },
    usage: { zh: '水银温度计量程理解。', en: 'Understanding mercury thermometer range.' },
    chapter: '第四章 物态变化',
  },
  {
    symbol: '1064',
    name: { zh: '金的熔点', en: 'Melting point of gold' },
    value: '1064 °C',
    unit: '',
    category: 'thermal',
    meaning: { zh: '金的熔点较高，可用高温熔化。', en: 'Gold has a high melting point.' },
    usage: { zh: '金属熔点比较（教材常用例）。', en: 'Comparing metal melting points.' },
    chapter: '第四章 物态变化',
  },

  // ── 光学 ──
  {
    symbol: 'c',
    name: { zh: '真空中的光速', en: 'Speed of light in vacuum' },
    value: '3×10⁸',
    unit: 'm/s',
    category: 'optics',
    meaning: { zh: '光在真空中传播速度最快，约 3×10⁸ m/s；无线电、X 射线等电磁波在真空中速度相同。', en: 'Light travels fastest in vacuum, about 3×10⁸ m/s; radio, X-rays and all EM waves share this speed in vacuum.' },
    usage: { zh: '光年距离换算；激光测距；频率波长换算 c=λf。', en: 'Light-year conversions; laser ranging; c=λf.' },
    chapter: '第二章 光现象',
  },
  {
    symbol: 'v水',
    name: { zh: '水中的光速', en: 'Speed of light in water' },
    value: '2.25×10⁸',
    unit: 'm/s',
    category: 'optics',
    meaning: { zh: '光在介质中速度小于真空中（约为真空的 3/4）。', en: 'Light slows in media (about 3/4 of vacuum speed in water).' },
    usage: { zh: '解释光的折射（光速大的介质中角大）。', en: 'Explains refraction (larger angle in faster medium).' },
    chapter: '第三章 光的折射 透镜',
  },

  // ── 声学 ──
  {
    symbol: 'v声',
    name: { zh: '空气中的声速', en: 'Speed of sound in air' },
    value: '约 340',
    unit: 'm/s',
    category: 'sound',
    meaning: { zh: '15 °C 时空气中的声速约 340 m/s；固 > 液 > 气。', en: 'About 340 m/s in air at 15 °C; fastest in solids.' },
    usage: { zh: '雷电距离估算（看闪光到听雷声的秒数×340）。', en: 'Estimating storm distance (seconds × 340).' },
    chapter: '第一章 声现象',
  },

  // ── 电学 ──
  {
    symbol: 'U',
    name: { zh: '家庭电路电压', en: 'Household voltage' },
    value: '220 V',
    unit: '',
    category: 'elec',
    meaning: { zh: '我国家庭电路的电压为 220 V（交流电）。', en: 'Household mains in China is 220 V AC.' },
    usage: { zh: '家庭电路分析；用电器额定电压。', en: 'Household circuit analysis.' },
    chapter: '第十五章 电功和电热',
  },
  {
    symbol: 'U',
    name: { zh: '安全电压', en: 'Safety voltage' },
    value: '不高于 36 V',
    unit: '',
    category: 'elec',
    meaning: { zh: '对人体安全的电压是不高于 36 V。', en: 'Voltage safe for humans is no higher than 36 V.' },
    usage: { zh: '安全用电常识判断。', en: 'Electrical safety knowledge.' },
    chapter: '第十五章 电功和电热',
  },
  {
    symbol: 'U',
    name: { zh: '一节干电池电压', en: 'Dry cell voltage' },
    value: '1.5 V',
    unit: '',
    category: 'elec',
    meaning: { zh: '一节普通干电池的电压为 1.5 V。', en: 'A common dry cell provides 1.5 V.' },
    usage: { zh: '电池串联电压计算。', en: 'Series battery voltage.' },
    chapter: '第十三章 简单电路',
    labId: 'circuits',
  },
  {
    symbol: 'U',
    name: { zh: '蓄电池电压', en: 'Lead-acid cell voltage' },
    value: '约 2 V',
    unit: '',
    category: 'elec',
    meaning: { zh: '铅蓄电池每个单格约 2 V。', en: 'Each lead-acid cell is about 2 V.' },
    usage: { zh: '蓄电池电压理解。', en: 'Battery voltage understanding.' },
    chapter: '第十三章 简单电路',
  },
  {
    symbol: 'I',
    name: { zh: '手电筒电流', en: 'Flashlight current' },
    value: '约 0.1 A',
    unit: '',
    category: 'elec',
    meaning: { zh: '手电筒工作电流约 0.1 A（教材常见例）。', en: 'A flashlight draws about 0.1 A (common textbook example).' },
    usage: { zh: '电流数量级感知。', en: 'Sense of current magnitude.' },
    chapter: '第十三章 简单电路',
  },
  {
    symbol: 'I',
    name: { zh: '电冰箱电流', en: 'Refrigerator current' },
    value: '约 1 A',
    unit: '',
    category: 'elec',
    meaning: { zh: '电冰箱工作电流约 1 A。', en: 'A refrigerator draws about 1 A.' },
    usage: { zh: '电流数量级感知。', en: 'Sense of current magnitude.' },
    chapter: '第十三章 简单电路',
  },
  {
    symbol: 'I',
    name: { zh: '电饭煲电流', en: 'Rice cooker current' },
    value: '约 5 A',
    unit: '',
    category: 'elec',
    meaning: { zh: '电饭煲工作电流约 5 A。', en: 'A rice cooker draws about 5 A.' },
    usage: { zh: '电流数量级感知。', en: 'Sense of current magnitude.' },
    chapter: '第十三章 简单电路',
  },

  {
    symbol: 'f',
    name: { zh: '家庭电路频率', en: 'Mains frequency' },
    value: '50 Hz',
    unit: '',
    category: 'elec',
    meaning: { zh: '我国家庭交流电频率 50 Hz，每秒方向改变 100 次。', en: 'Chinese mains is 50 Hz; direction reverses 100 times/s.' },
    usage: { zh: '交流电频率理解。', en: 'Understanding AC frequency.' },
    chapter: '第十五章 电功和电热',
  },
];
