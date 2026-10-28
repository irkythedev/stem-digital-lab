/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 动态预置问题：把实验当下的读数插进「问 AI」的问题模板。
 *
 * 为什么需要它：本站没有自由输入框，学生能问的问题由页面决定；静态文案只能跟着「页面 / 条目」走，
 * 插进当前读数之后，问题才能跟着学生此刻这一步的数据走——这是这种形态下唯一可行的「因材施问」。
 *
 * 三条硬约束：
 *   ① 任一插值缺失就不生成该条（绝不输出半句话、undefined 或 NaN）；
 *   ② 只指向「观察 / 比较 / 趋势」，不指向结论（与系统提示词的探究型立场一致）；
 *   ③ 拿不到动态问题就回退静态文案，调用方无需分支。
 *
 * 试点实验：ohm（欧姆定律）/ lens（凸透镜成像）/ lever（杠杆）。其余实验返回空数组，行为与改造前一致。
 */

export interface DynamicQuestion {
  /** 取出的读数，供测试断言与后续扩展（如界面上标注「基于你当前读数」） */
  values: Record<string, number | string>;
  zh: string;
  en: string;
  /** reading = 看读数；compare = 比两个读数；trend = 看变化趋势 */
  requires?: 'reading' | 'compare' | 'trend';
}

export type DynamicQuestionBuilder = (state: Record<string, unknown>) => DynamicQuestion[];

/** 有限数校验：NaN / ±Infinity / 非数字一律视为缺失 */
function num(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** 与页面读数一致：保留 2 位小数（页面上就是 0.60A / 6.00V 这种口径） */
function f2(v: number): string {
  return v.toFixed(2);
}

/** 插值完整性：出现 undefined / NaN / null 直接丢弃这一条 */
function clean(q: DynamicQuestion): boolean {
  const s = `${q.zh}${q.en}`;
  return !!s && !/undefined|NaN|null/.test(s);
}

/**
 * 页级「问 AI」问句注册表：实验页把「此刻该问什么」登记进来（可含当前读数）。
 * 与 setLabState 同为易失注册表；区别是这里的值在**点击瞬间**才被读取，
 * 所以不需要订阅机制、也不会因为读数变化引起任何重渲染。
 */
const pageQuestions = new Map<string, string>();

export function setPageQuestion(labId: string, question: string): void {
  if (!labId || !question) return;
  pageQuestions.set(labId, question);
}

export function getPageQuestion(labId: string): string {
  return pageQuestions.get(labId) ?? '';
}

/**
 * 实时状态字段的类型：zh/en 名称 + 单位 + 布尔两态 + 枚举映射。
 *
 * `map` 是「内部码 → 人话」的唯一出处。没有它，TypeScript 的字面量类型
 * （`'bulb'` / `'chord'` / `'al-cuso4'` / 方案下标 `1`）会被原样塞进提示词，
 * 模型只能猜「bulb 大概是灯泡」「当前方案 1 是哪个方案」。未登记的值整条丢弃，
 * 与 clean() 的「绝不输出半句话」同一条纪律——宁可少一行，不给模型一行需要猜的。
 */
interface FieldDef {
  zh: string;
  en: string;
  unit?: string;
  bool?: { on: { zh: string; en: string }; off: { zh: string; en: string } };
  map?: Record<string, { zh: string; en: string }>;
}

/** 通用字段词表（跨实验同义的那些）。顺序即输出顺序（稳定）。 */
const FIELD_LABEL: Record<string, FieldDef> = {
  u: { zh: '电源电压', en: 'supply voltage', unit: 'V' },
  i: { zh: '电流读数', en: 'current', unit: 'A' },
  elemVoltage: { zh: '元件两端电压', en: 'voltage across the element', unit: 'V' },
  r: { zh: '定值电阻', en: 'fixed resistance', unit: 'Ω' },
  rp: { zh: '滑动变阻器', en: 'rheostat', unit: 'Ω' },
  switchOn: { zh: '开关', en: 'switch', bool: { on: { zh: '闭合', en: 'closed' }, off: { zh: '断开', en: 'open' } } },
  element: {
    zh: '当前元件',
    en: 'element',
    map: { resistor: { zh: '定值电阻', en: 'fixed resistor' }, bulb: { zh: '小灯泡', en: 'small bulb' } },
  },
  styleZh: { zh: '电路拓扑', en: 'topology' },
  styleEn: { zh: '电路拓扑', en: 'topology' },   // 英文语境下的取值来源，不进输出列表
  i0: { zh: '干路电流', en: 'main current', unit: 'A' },
  f: { zh: '焦距', en: 'focal length', unit: 'cm' },
  v: { zh: '像距', en: 'image distance', unit: 'cm' },
  m1: { zh: '左侧钩码', en: 'left weights' },
  d1: { zh: '左力臂', en: 'left arm' },
  m2: { zh: '右侧钩码', en: 'right weights' },
  d2: { zh: '右力臂', en: 'right arm' },
  balanced: { zh: '杠杆', en: 'lever', bool: { on: { zh: '平衡', en: 'balanced' }, off: { zh: '不平衡', en: 'not balanced' } } },
  k: { zh: 'k 值', en: 'k' },
  b: { zh: 'b 值', en: 'b' },
  a: { zh: 'a 值', en: 'a' },
  c: { zh: 'c 值', en: 'c' },
  circleMode: {
    zh: '当前定理',
    en: 'theorem',
    map: {
      chord: { zh: '垂径定理', en: 'Chord Theorem' },
      inscribed: { zh: '圆周角定理', en: 'Inscribed Angle' },
      thales: { zh: '直径对直角', en: "Thales' Theorem" },
    },
  },
  vSub: { zh: '浸入体积比例', en: 'submerged fraction' },
  liquidZh: { zh: '液体', en: 'liquid' },
  F: { zh: '压力', en: 'force', unit: 'N' },
  S: { zh: '受力面积', en: 'area', unit: 'cm²' },
  type: {
    zh: '滑轮类型',
    en: 'pulley type',
    map: { fixed: { zh: '定滑轮', en: 'fixed pulley' }, moving: { zh: '动滑轮', en: 'moving pulley' } },
  },
  G: { zh: '重物重力', en: 'load weight', unit: 'N' },
  activeScheme: {
    zh: '当前方案',
    en: 'current scheme',
    // 下标对齐界面上那张卡片的真实标题（MassConservation 的 schemes/cards 顺序）
    map: {
      '0': { zh: '铜与氧气（密封）', en: 'copper + oxygen (sealed)' },
      '1': { zh: '铁与硫酸铜', en: 'iron + copper sulfate' },
      '2': { zh: '碳酸钠与盐酸（开放）', en: 'sodium carbonate + hydrochloric acid (open)' },
    },
  },
  volume: { zh: '滴入液体积', en: 'titrant volume', unit: 'mL' },
  acidM: { zh: '酸的浓度', en: 'acid concentration' },
  power: { zh: '电源', en: 'power supply', bool: { on: { zh: '已接通', en: 'on' }, off: { zh: '未接通', en: 'off' } } },
  elapsed: { zh: '通电时长', en: 'elapsed', unit: 's' },
  react: {
    zh: '当前反应',
    en: 'reaction',
    map: {
      'al-cuso4': { zh: '铝与硫酸铜', en: 'aluminium + copper sulfate' },
      'cu-agno3': { zh: '铜与硝酸银', en: 'copper + silver nitrate' },
    },
  },
  done: { zh: '反应', en: 'reaction', bool: { on: { zh: '已发生', en: 'yes' }, off: { zh: '未发生', en: 'no' } } },
  polished: { zh: '金属丝', en: 'metal wire', bool: { on: { zh: '已打磨', en: 'polished' }, off: { zh: '未打磨', en: 'not polished' } } },
  stage: { zh: '当前阶段', en: 'stage' },
  presetZh: { zh: '实验预设', en: 'preset' },
  presetEn: { zh: '实验预设', en: 'preset' },   // 英文语境下的取值来源
  wires: { zh: '导线根数', en: 'wire count' },
  running: {
    zh: '仿真状态',
    en: 'simulation',
    bool: { on: { zh: '运行中', en: 'running' }, off: { zh: '已暂停', en: 'paused' } },
  },
};

/**
 * 分实验专用词表：命中即覆盖通用表里的同名字段。
 *
 * **为什么必须分域**：`u` 在 ohm 是「电源电压(V)」，在 lens 是「物距(cm)」。
 * 全局平铺时凸透镜实验会得到「电源电压 20V」——一个不存在于该实验的物理量，
 * 而学生画布上写的是物距。界面是对的、喂给模型的是错的，这是最坏的一类错误：
 * 模型会顺着这个错误量纲继续讲下去（审计实测输出）。
 */
const FIELD_LABEL_BY_LAB: Record<string, Record<string, FieldDef>> = {
  'circuit-bench': {
    // 实验台是多回路自由拓扑：这里报的是「整台实验」的主读数，不冒充某个元件两端电压。
    i: { zh: '电源干路电流', en: 'supply current', unit: 'A' },
    u: { zh: '电源电动势', en: 'supply EMF', unit: 'V' },
    p: { zh: '总功率', en: 'total power', unit: 'W' },
    r: { zh: '外电路等效电阻', en: 'external equivalent resistance', unit: 'Ω' },
    switchOn: {
      zh: '总开关',
      en: 'main switch',
      bool: { on: { zh: '闭合', en: 'closed' }, off: { zh: '断开', en: 'open' } },
    },
  },
  lens: {
    u: { zh: '物距', en: 'object distance', unit: 'cm' },
    f: { zh: '焦距', en: 'focal length', unit: 'cm' },
    v: { zh: '像距', en: 'image distance', unit: 'cm' },
  },
};

/** 该实验实际生效的词表：专用表覆盖通用表，顺序沿用通用表（输出稳定） */
function fieldLabelFor(labId: string | null | undefined): Record<string, FieldDef> {
  const own = labId ? FIELD_LABEL_BY_LAB[labId] : undefined;
  return own ? { ...FIELD_LABEL, ...own } : FIELD_LABEL;
}

const STAGE_TEXT: Record<string, { zh: string; en: string }> = {
  predict: { zh: '预测', en: 'Predict' },
  explore: { zh: '探索', en: 'Explore' },
  conclude: { zh: '结论', en: 'Conclude' },
};

/**
 * 把易失注册表里的实时状态压成一行人类可读文本，供**系统提示词**与**「考考你」出题提示词**共用。
 * 空状态返回空串（调用方直接拼接即可，无需分支）。
 * 刻意不复用 DYNAMIC_QUESTION_BUILDERS：那里是「问句」，这里要的是「陈述式上下文」。
 *
 * `labId` 是必需入参：同名字段在不同实验里含义不同（lens 的 u = 物距，ohm 的 u = 电源电压），
 * 只有实验自己知道该怎么念。省略 labId 会退化成通用表——那正是「电源电压 20V」的来源。
 */
export function formatLabState(
  labId: string | null | undefined,
  state: Record<string, unknown> | undefined | null,
  lang: 'zh' | 'en',
): string {
  if (!state) return '';
  const zh = lang === 'zh';
  const labels = fieldLabelFor(labId);
  const parts: string[] = [];
  const stage = state.stage;
  if (typeof stage === 'string' && STAGE_TEXT[stage]) {
    parts.push(zh ? `当前阶段：${STAGE_TEXT[stage].zh}` : `stage: ${STAGE_TEXT[stage].en}`);
  }
  for (const [key, def] of Object.entries(labels)) {
    if (key === 'stage') continue;
    const v = state[key];
    if (def.bool) {
      if (typeof v === 'boolean') {
        parts.push(zh ? `${def.zh}：${v ? def.bool.on.zh : def.bool.off.zh}` : `${def.en}: ${v ? def.bool.on.en : def.bool.off.en}`);
      }
      continue;
    }
    // 枚举：内部码必须先翻成人话。查不到就整条丢弃——把 'al-cuso4' 或下标 1 交给模型，
    // 等于让它猜，而猜错会顺着错误前提讲一整段（审计实测）。
    if (def.map) {
      const hit = typeof v === 'string' || typeof v === 'number' ? def.map[String(v)] : undefined;
      if (hit) parts.push(`${zh ? def.zh : def.en} ${zh ? hit.zh : hit.en}`);
      continue;
    }
    if (typeof v === 'number' && Number.isFinite(v)) parts.push(`${zh ? def.zh : def.en} ${Number.isInteger(v) ? v : f2(v)}${def.unit ?? ''}`);
    else if (typeof v === 'string' && v) {
      // 形如 liquidZh / styleZh 的字段：取值是中文，英文语境下必须改取同名 *En 孪生键。
      // 先剥掉 zh 后缀再拼 En —— 旧写法 `${key}En` 对 styleZh 会算成 styleZhEn，取不到值，
      // 于是英文提示词里漏出中文（实测「topology 串联三灯」「liquid 盐水」）。
      if (/Zh$/.test(key)) {
        const twin = state[`${key.replace(/Zh$/, '')}En`];
        if (zh) parts.push(`${def.zh} ${v}`);
        else if (typeof twin === 'string' && twin) parts.push(`${def.en} ${twin}`);
        // 英文语境但孪生键缺失：整条丢弃。把中文取值塞给英文提示词比少一行更糟。
        continue;
      }
      if (key !== 'styleEn') parts.push(`${zh ? def.zh : def.en} ${v}`);
    }
  }
  if (!parts.length) return '';
  return zh ? `【当前实验实时状态】${parts.join('；')}` : `[Live lab state] ${parts.join('; ')}`;
}

export const DYNAMIC_QUESTION_BUILDERS: Record<string, DynamicQuestionBuilder> = {
  /** 欧姆定律：u 电压 / r 定值电阻 / element（resistor|bulb）/ i 电流读数 */
  ohm: (s) => {
    const u = s.u;
    const i = s.i;
    const isBulb = s.element === 'bulb';
    if (!num(u) || !num(i)) return [];
    const part = isBulb ? '灯泡' : '定值电阻';
    const partEn = isBulb ? 'bulb' : 'fixed resistor';
    // 以下四项有则追加、无则跳过：让「刚闭合开关 / 刚拖过变阻器」这类动作也能被模型看见
    const extraZh: string[] = [];
    const extraEn: string[] = [];
    if (s.switchOn === false) { extraZh.push('开关断开（电路无电流）'); extraEn.push('switch open (no current)'); }
    if (num(s.elemVoltage)) { extraZh.push(`元件两端电压 ${f2(s.elemVoltage)}V`); extraEn.push(`voltage across the element ${f2(s.elemVoltage)}V`); }
    if (num(s.rp)) { extraZh.push(`滑动变阻器 ${f2(s.rp)}Ω`); extraEn.push(`rheostat ${f2(s.rp)}Ω`); }
    if (num(s.r)) { extraZh.push(`${part}阻值 ${f2(s.r)}Ω`); extraEn.push(`${partEn} resistance ${f2(s.r)}Ω`); }
    const tailExtraZh = extraZh.length ? `；${extraZh.join('、')}` : '';
    const tailExtraEn = extraEn.length ? `; ${extraEn.join(', ')}` : '';
    const tailZh = isBulb
      ? '同样的电压加在定值电阻上，电流读数更大，为什么灯泡的电流涨得慢？'
      : '我把电压调小一半，电流为什么会跟着一起变小？';
    const tailEn = isBulb
      ? 'At the same voltage the fixed resistor reads a larger current — why does the bulb current rise more slowly?'
      : 'If I halve the voltage, why does the current fall by half as well?';
    return [
      {
        values: { u, i, element: isBulb ? 'bulb' : 'resistor', ...(num(s.elemVoltage) ? { elemVoltage: s.elemVoltage } : {}), ...(num(s.rp) ? { rp: s.rp } : {}), ...(num(s.r) ? { r: s.r } : {}), ...(s.switchOn === false ? { switchOn: 0 } : {}) },
        zh: `<当前读数>电压 ${f2(u)}V，${part}电流 ${f2(i)}A${tailExtraZh}</当前读数>${tailZh}`,
        en: `<current_reading>voltage ${f2(u)}V, ${partEn} current ${f2(i)}A${tailExtraEn}</current_reading> ${tailEn}`,
        requires: 'compare',
      },
    ];
  },

  /**
   * 串并联电路：styleZh / styleEn 当前拓扑名、switchOn 干路开关、i0 干路电流、rList 各元件阻值。
   * 8 种拓扑共用本模板——模板只描述「看到了什么」，不描述「应该是什么」。
   */
  circuits: (s) => {
    const i0 = s.i0;
    const styleZh = typeof s.styleZh === 'string' ? s.styleZh : '';
    const styleEn = typeof s.styleEn === 'string' ? s.styleEn : '';
    const rList = Array.isArray(s.rList) ? (s.rList as unknown[]).filter(num) : [];
    if (!num(i0) || !styleZh || !rList.length) return [];
    const closed = s.switchOn === true;
    const rZh = rList.map((v) => `${(v as number).toFixed(0)}Ω`).join(' 与 ');
    const rEn = rList.map((v) => `${(v as number).toFixed(0)}Ω`).join(' and ');
    return [
      {
        values: { i0, switchOn: closed ? 1 : 0, elements: rList.length },
        zh: `<当前读数>拓扑「${styleZh}」、${closed ? '开关闭合' : '开关断开'}、各元件阻值 ${rZh}、干路电流 ${f2(i0)}A</当前读数>我这组连接里，电流的分配跟我预想的差在哪里？`,
        en: `<current_reading>topology "${styleEn || styleZh}", ${closed ? 'switch closed' : 'switch open'}, element resistances ${rEn}, main current ${f2(i0)}A</current_reading> Where does the current distribution here differ from what I expected?`,
        requires: 'compare',
      },
    ];
  },

  /** 浮力：vSub 浸入体积比例(0-1) / liquidZh|liquidEn 液体名 / rho 液体密度 */
  buoyancy: (s) => {
    const vSub = s.vSub;
    if (!num(vSub)) return [];
    const liquidZh = typeof s.liquidZh === 'string' ? s.liquidZh : '';
    const liquidEn = typeof s.liquidEn === 'string' ? s.liquidEn : '';
    const rho = num(s.rho) ? s.rho : null;
    if (!liquidZh) return [];
    const pct = Math.round(vSub * 100);
    const rhoZh = rho ? `（密度 ${rho} kg/m³）` : '';
    const rhoEn = rho ? ` (density ${rho} kg/m³)` : '';
    return [
      {
        values: { vSub, ...(rho ? { rho } : {}) },
        zh: `<当前读数>浸入体积约 ${pct}%、液体为${liquidZh}${rhoZh}</当前读数>把物体再往下按一些，弹簧测力计读数会怎么变？`,
        en: `<current_reading>submerged volume about ${pct}%, liquid: ${liquidEn || liquidZh}${rhoEn}</current_reading> If I push the object down a little more, what happens to the spring-scale reading?`,
        requires: 'trend',
      },
    ];
  },

  /** 压强：F 压力(N) / S 受力面积(cm²) */
  pressure: (s) => {
    const F = s.F;
    const area = s.S;
    if (!num(F) || !num(area)) return [];
    return [
      {
        values: { F, S: area },
        zh: `<当前读数>压力 ${f2(F)}N、受力面积 ${f2(area)}cm²</当前读数>保持压力不变、把受力面积减半，形变程度会怎样？`,
        en: `<current_reading>force ${f2(F)}N on area ${f2(area)}cm²</current_reading> Keep the force fixed and halve the area — what happens to the deformation?`,
        requires: 'trend',
      },
    ];
  },

  /** 滑轮：type 定/动滑轮 / G 重物重力(N) */
  pulley: (s) => {
    const G = s.G;
    const type = s.type === 'moving' ? 'moving' : s.type === 'fixed' ? 'fixed' : '';
    if (!num(G) || !type) return [];
    const zhKind = type === 'moving' ? '动滑轮' : '定滑轮';
    const enKind = type;
    return [
      {
        values: { G, type },
        zh: `<当前读数>当前用${zhKind}、重物 ${f2(G)}N</current_reading>换成另一种滑轮后，拉力和绳端移动距离各有什么变化？`,
        en: `<current_reading>${enKind} pulley, load ${f2(G)}N</current_reading> If I switch to the other pulley, how do the pull force and the rope distance change?`,
        requires: 'compare',
      },
    ];
  },

  /** 凸透镜成像：u 物距 / f 焦距 / v 像距（u 与 f 太近时 imageV 返回 null，此时不出题） */
  lens: (s) => {
    const u = s.u;
    const f = s.f;
    const v = s.v;
    if (!num(u) || !num(f) || !num(v)) return [];
    return [
      {
        values: { u, f, v },
        zh: `<当前读数>物距 ${f2(u)}cm、焦距 ${f2(f)}cm、像距 ${f2(v)}cm</当前读数>我把物体再往透镜靠近一点，像距为什么会变大？`,
        en: `<current_reading>object distance ${f2(u)}cm, focal length ${f2(f)}cm, image distance ${f2(v)}cm</current_reading> Why does the image distance grow when I move the object closer to the lens?`,
        requires: 'trend',
      },
    ];
  },

  /** 杠杆：m1/d1 左钩码数与格数、m2/d2 右钩码数与格数、balanced 是否平衡（页面显示「左 2×3 / 右 3×2」） */
  lever: (s) => {
    const m1 = s.m1;
    const d1 = s.d1;
    const m2 = s.m2;
    const d2 = s.d2;
    if (!num(m1) || !num(d1) || !num(m2) || !num(d2)) return [];
    const balanced = s.balanced === true;
    return [
      {
        values: { m1, d1, m2, d2, balanced: balanced ? 1 : 0 },
        zh: `<当前读数>左 ${m1}×${d1}，右 ${m2}×${d2}，杠杆${balanced ? '刚好平衡' : '往重的一边倾'}</当前读数>为什么比较这两个乘积就能判断平衡？`,
        en: `<current_reading>left ${m1}×${d1}, right ${m2}×${d2}, lever ${balanced ? 'balances' : 'tilts to the heavier side'}</current_reading> Why does comparing those two products tell us whether it balances?`,
        requires: 'compare',
      },
    ];
  },
};

/**
 * 对外唯一入口：有动态问题就放首位，静态文案留作兜底；调用方取 [0] 即可。
 * 拿不到动态问题（未注册的 lab / 读数缺失 / 模板不完整）时只返回静态文案，行为与改造前一致。
 */
export function getDynamicQuestions(
  labId: string,
  state: Record<string, unknown>,
  lang: 'zh' | 'en',
  fallback: string,
): string[] {
  const builder = DYNAMIC_QUESTION_BUILDERS[labId];
  if (!builder) return [fallback];
  const dyn = builder(state)
    .filter(clean)
    .map((q) => (lang === 'zh' ? q.zh : q.en))
    .filter((q) => !!q);
  return dyn.length > 0 ? [dyn[0], fallback] : [fallback];
}

/* ── 实验状态注册表（易失） ──
 * 用途：实验页把「当前阶段 + 读数」写进来，构造系统提示词时读取（阶段用于回答立场）。
 * 为什么不用 React context：滑块每动一格都会触发写入，放进 context 会让全局 AI 面板跟着重渲染；
 * 模块级 Map 写入不触发渲染，且只保存本次会话内的易失状态，不落任何持久化。
 */
const LAB_STATE = new Map<string, Record<string, unknown>>();

export function setLabState(labId: string, state: Record<string, unknown>): void {
  if (!labId) return;
  LAB_STATE.set(labId, state);
}

export function getLabState(labId: string): Record<string, unknown> | undefined {
  return labId ? LAB_STATE.get(labId) : undefined;
}

export function clearLabState(labId: string): void {
  LAB_STATE.delete(labId);
}

/**
 * 规范路径 → 实验 id（含已废弃但需继续可用的历史路径）。
 * 这里刻意不 import labs.ts：labs 会 import 全部实验组件，而实验组件又 import 本模块，
 * 形成环。规范路径数量很少，显式表比多一层模块依赖更稳。
 */
const CANONICAL_LAB_PATHS: Record<string, string> = {
  '/circuit-bench': 'circuit-bench',
  // 历史路径：电学工作台曾挂在 /physics/circuit-bench，路由保留兼容，AI 侧同步认它
  '/physics/circuit-bench': 'circuit-bench',
};

/** 从当前路径取实验 id（/lab/ohm → ohm，/circuit-bench → circuit-bench） */
export function labIdFromPath(pathname: string): string {
  const clean = (pathname || '').split('?')[0].split('#')[0].replace(/\/+$/, '');
  const canonical = CANONICAL_LAB_PATHS[clean];
  if (canonical) return canonical;
  const m = /\/lab\/([A-Za-z0-9_-]+)/.exec(pathname || '');
  return m ? m[1] : '';
}

/** 实验阶段 → 提示词里的中文/英文标签（三幕式：预测 / 探索 / 结论） */
export function stageLabel(stage: unknown, lang: 'zh' | 'en'): string {
  const key = typeof stage === 'string' ? stage : '';
  const zh: Record<string, string> = { predict: '预测', explore: '探索', conclude: '结论' };
  const en: Record<string, string> = { predict: 'predict', explore: 'explore', conclude: 'conclude' };
  const map = lang === 'zh' ? zh : en;
  return map[key] ?? '';
}
