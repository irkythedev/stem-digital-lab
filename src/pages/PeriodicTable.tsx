/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学工具页 · 元素周期表
 *
 * 18 列标准周期表（7 周期 + 镧系/锕系独立两行），三色区分
 * 金属 / 非金属 / 稀有气体（类金属单独色系）。
 * 点击元素弹出详情卡：原子序数、符号、中英文名、相对原子质量、周期/族，
 * 并可用浏览器语音（Web Speech API）朗读中文名——免费、免登录、离线可用。
 *
 * 教材依据：ch03「元素周期表简介」——7 个横行 18 个纵列，金属/非金属/稀有气体
 * 用不同颜色区分，标出相对原子质量；元素周期表是学习和研究化学的重要工具。
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BackLink from '../components/layout/BackLink';
import { LoaderCircle, Pause, Play, Square, Volume2, X, HardDrive, CircleCheck, Search, ArrowLeft, ArrowRight, Box } from 'lucide-react';
import { useLockBodyScroll } from '../lib/use-lock-body-scroll';
import OfflinePackPanel from '../components/feedback/OfflinePackPanel';
import { useOfflinePack } from '../lib/use-offline-pack';
import { useApp } from '../lib/app-context';
import { useAiContext } from '../lib/ai-context';
import AskAiButton from '../components/ai/AskAiButton';
import AskQuizButton from '../components/ai/AskQuizButton';
import ShareInline from '../components/share/ShareInline';
import { usePageMeta, learningResourceLd } from '../lib/use-page-meta';
import { ELEMENTS, type ElementInfo } from '../lib/elements';
import { CAT_COLOR, CAT_ZH, CAT_EN } from '../lib/element-categories';
import { ATOM_VIEW, coreRadiusFor, shellLayout } from '../lib/atom-shells';
import { NEUTRON_COLOR } from '../lib/atom-3d';
import Atom3D from '../components/lab/Atom3D';
import { ValenceBadge } from '../components/chemistry/ChemFormula';
import ElementDetailSheet from '../components/elements/ElementDetailSheet';
import { parsePeriodicElementQuery } from '../lib/chemistry/formula-core';
import { valenceElementBySymbol } from '../lib/chemistry/valency';

/** 类别分类配色/名称统一来自 `lib/element-categories`（与化学式组件同源）。 */

/** 电子层名（初中教材用 K L M N O P Q，自内向外） */
export const SHELL_NAMES = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'] as const;

/** 相邻元素（按原子序数排序）：越界方向返回 null，供导航按钮禁用。
 *  纯函数，供详情卡渲染与 smoke 测试共用。 */
export function neighborOf(n: number): { prev: ElementInfo | null; next: ElementInfo | null } {
  const i = ELEMENTS.findIndex((e) => e.n === n);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? ELEMENTS[i - 1] : null,
    next: i < ELEMENTS.length - 1 ? ELEMENTS[i + 1] : null,
  };
}

/** 族标签（人教版习惯写法）：1→ⅠA、17→ⅦA、18→0（稀有气体族）、3→ⅢB … 8/9/10 同属Ⅷ族 */
const GROUP_ROMAN: Record<number, string> = {
  1: 'ⅠA', 2: 'ⅡA', 13: 'ⅢA', 14: 'ⅣA', 15: 'ⅤA', 16: 'ⅥA', 17: 'ⅦA', 18: '0',
  3: 'ⅢB', 4: 'ⅣB', 5: 'ⅤB', 6: 'ⅥB', 7: 'ⅦB', 8: 'Ⅷ', 9: 'Ⅷ', 10: 'Ⅷ', 11: 'ⅠB', 12: 'ⅡB',
};

/** 族的中文化标签；f 区（镧系/锕系）在本数据中 group 为 null */
export function groupLabel(group: number | null): string {
  if (group == null) return '—';
  return GROUP_ROMAN[group] ?? '—';
}

/** 微观粒子计数：质子 Z、核外电子 Z（原子整体呈电中性）、中子 N = round(A) − Z。
 *  依据初中铁律「核电荷数 = 质子数 = 核外电子数」「相对原子质量 ≈ 质子数 + 中子数」。
 *  相对原子质量取 IUPAC 标准原子量的四舍五入（≈ 最丰同位素质量数）；
 *  无稳定同位素的元素数据里存的就是质量数，取整后同样成立。 */
export function particleCount(e: ElementInfo): { protons: number; neutrons: number; electrons: number } {
  const a = Math.round(e.massExact ?? e.mass ?? e.n);
  return { protons: e.n, neutrons: Math.max(0, a - e.n), electrons: e.n };
}

/** 元素分区：初中「最外层得失规律」适用域的判据 */
export type ElementScope = 'main' | 'transition' | 'f';

/** 分区：主族（典型元素）/ 过渡（副族，d 电子参与成键）/ f 区（镧系锕系） */
export function elementScope(e: ElementInfo): ElementScope {
  if ((e.n >= 57 && e.n <= 71) || (e.n >= 89 && e.n <= 103)) return 'f';
  const g = e.group;
  return g !== null && g >= 3 && g <= 12 ? 'transition' : 'main';
}

/** 镧系 / 锕系（供族标签与分区提示使用）；group 数据把两者都记为第 3 列，需按序号判定 */
export function fSeriesOf(e: ElementInfo): 'lanthanide' | 'actinide' | null {
  if (e.n >= 57 && e.n <= 71) return 'lanthanide';
  if (e.n >= 89 && e.n <= 103) return 'actinide';
  return null;
}

export type ValenceKind =
  | 'lose' | 'gain' | 'share' | 'stable'
  | 'hydrogen' | 'saturated' | 'variable' | 'lanthanide' | 'polyvalent';

export interface ValenceInfo {
  outer: number;
  kind: ValenceKind;
  /** 仅 lose/gain 有意义，且恒 ≥ 0 */
  count: number;
  scope: ElementScope;
}

/** 最外层电子的得失倾向。
 *
 *  适用范围（学科硬边界）：初中「最外层 < 4 易失、> 4 易得、= 8 稳定」**仅严格适用于主族（典型）元素**。
 *  副族/过渡元素次外层 d 电子参与成键、具可变化合价；f 区（镧系/锕系）f 电子参与成键——对这两类
 *  只输出分区说明，绝不套用简单得失数（否则会出现 Cr「易失 1」、Fe「易失 2」这类误导）。
 *  硬保护：count 恒 ≥ 0（杜绝 Pd 出现过 gain -10）；最外层 > 8 时不得输出得失判定。
 */
export function valenceTendency(e: ElementInfo): ValenceInfo {
  const outer = e.shells[e.shells.length - 1] ?? 0;
  const scope = elementScope(e);
  // ① 全局硬保护：最外层超过 8（Pd 为 2,8,18,18 的经典例外）→ 不做得失判定
  if (outer > 8) return { outer, kind: 'saturated', count: 0, scope };
  // ② f 区（镧系/锕系）：f 电子参与成键，常见 +3 价
  if (scope === 'f') return { outer, kind: 'lanthanide', count: 0, scope };
  // ③ 副族/过渡：可变化合价，阻断单纯得失判定
  if (scope === 'transition') return { outer, kind: 'variable', count: 0, scope };
  // ④ 氢：既可失 1 个电子（H⁺）也可得 1 个电子（H⁻）
  if (e.n === 1) return { outer, kind: 'hydrogen', count: 1, scope };
  // ⑤ 稳定结构：外层 8，或首层排满 2（He）
  if (outer === 8 || (e.shells.length === 1 && outer === 2)) return { outer, kind: 'stable', count: 0, scope };
  // ⑥ 最外层 4：既不易得也不易失，通常与他人共用电子对（C、Si、Ge、Sn、Pb）
  if (outer === 4) return { outer, kind: 'share', count: 0, scope };
  // ⑦ 最外层 < 4：易失
  if (outer < 4) return { outer, kind: 'lose', count: outer, scope };
  // ⑧ 最外层 5~7：金属元素（Bi/Po/Mc/Lv 等）不适用非金属的得电子倾向，按多价态处理
  if (e.cat === 'metal') return { outer, kind: 'polyvalent', count: 0, scope };
  return { outer, kind: 'gain', count: Math.max(0, 8 - outer), scope };
}

/** 外层倾向的短标签（格子内用，控制在 6 字内避免窄格溢出） */
export const VALENCE_LABEL: Record<ValenceKind, { zh: string; en: string }> = {
  lose: { zh: '易失', en: 'lose' },
  gain: { zh: '易得', en: 'gain' },
  share: { zh: '共用电子', en: 'shares e⁻' },
  stable: { zh: '稳定结构', en: 'stable' },
  hydrogen: { zh: '两性 ±1', en: 'both ±1' },
  saturated: { zh: '外层饱和', en: 'full shell' },
  variable: { zh: '可变化合价', en: 'variable' },
  lanthanide: { zh: '常见 +3', en: 'usually +3' },
  polyvalent: { zh: '多价态', en: 'several' },
};

/** 适用域补充说明：主族返回 null；过渡/f 区必须声明「规律仅适用主族」，另含 H 与 Pd 两个特例 */
export function valenceNote(e: ElementInfo, vt: ValenceInfo, isZh: boolean): string | null {
  if (vt.kind === 'saturated') {
    return isZh
      ? '钯的最外层（第 4 层）已达 18 个电子（d 电子全充满）——经典特例，该层不参与简单得失。'
      : 'Palladium already holds 18 electrons in its outermost (4th) shell (a filled d subshell) — a classic exception where simple loss/gain does not apply.';
  }
  if (vt.scope === 'transition') {
    return isZh
      ? '过渡元素：次外层 d 电子参与成键，具可变化合价（如 Cr +3/+6、Fe +2/+3、Cu +1/+2）。初中「最外层得失」规律仅严格适用于主族元素。'
      : 'Transition element: second-outermost d electrons take part in bonding, so valences vary (Cr +3/+6, Fe +2/+3, Cu +1/+2). The junior-high outer-shell rule applies strictly to main-group elements.';
  }
  if (vt.scope === 'f') {
    return isZh
      ? '镧系/锕系：f 电子参与成键，常见 +3 价。初中「最外层得失」规律不适用。'
      : 'f-block (lanthanide/actinide): f electrons take part in bonding, usually +3. The junior-high outer-shell rule does not apply.';
  }
  if (vt.kind === 'hydrogen') {
    return isZh
      ? '氢既可失 1 个电子（H⁺），也可得 1 个电子（H⁻，如 NaH）——「最外层规律」的经典特例。'
      : 'Hydrogen can lose one electron (H⁺) or gain one (H⁻, as in NaH) — a classic exception to the outer-shell rule.';
  }
  if (vt.kind === 'polyvalent') {
    return isZh
      ? '该金属位于第 15/16 列，通常表现多价态（如 Bi +3/+5、Po +2/+4），不宜按非金属的「易得电子」描述。'
      : 'This metal sits in group 15/16 and shows several valences (Bi +3/+5, Po +2/+4); “gains electrons” wording does not fit a metal.';
  }
  return null;
}

/** 族标签的展示三元组：主标签（罗马/0）、副标签（列号或族号）、系别标记（镧系/锕系）
 *  —— 第 18 列兼顾人教版初中「0 族」与新课标「第 18 族」；镧系/锕系显式激活系别。 */
export function groupDisplay(e: ElementInfo, isZh: boolean): { main: string; sub: string; series: string | null } {
  const series = fSeriesOf(e);
  const g = e.group;
  const main = groupLabel(g);
  if (series) {
    return {
      main,
      sub: isZh ? `第 ${g ?? 3} 列` : `column ${g ?? 3}`,
      series: isZh ? (series === 'lanthanide' ? '镧系' : '锕系') : series,
    };
  }
  if (g === 18) return { main, sub: isZh ? '第 18 族 · 第 18 列' : 'group 18 · column 18', series: null };
  if (g === null) return { main, sub: isZh ? '镧系/锕系' : 'f-block', series: null };
  return { main, sub: isZh ? `第 ${g} 列` : `column ${g}`, series: null };
}

/** 主表横向滚动时的右端渐隐蒙版（仅在确实可向右滚动时施加；12px 只为提示，不吞掉列边框） */
export const SCROLL_FADE_MASK = 'linear-gradient(to right, #000 calc(100% - 12px), transparent 100%)';

/** 微粒图例色点的**绘制配方**（三种形态互异，不再只是三个同形圆点换色）。
 *
 *  核内微粒做成 3D 微球：径向渐变与 `Atom3D` 核子球**同一套配方**
 *  （白光高光偏左上 → 本体色 → 外缘压暗），故图例与 3D 视图里的球一一对应；
 *  质子深色、中子浅米色，明暗互为对应。
 *
 *  核外电子则**换形态**：实心微点 + 细环线（环即轨道），体现「轨道上绕行的轻子」，
 *  与核内「实体球」彻底拉开差距——本项目强调色 `--accent` 与正文色 `--fg` 在浅色主题下
 *  分别是 #000000 / #111111（亮度差约 7%），仅靠填色无法区分，必须靠形态。
 */
export const LEGEND_DOT: Record<'proton' | 'neutron' | 'electron', CSSProperties> = {
  proton: { background: 'radial-gradient(circle at 32% 30%, #fff 0%, var(--accent) 44%, rgba(8,6,4,0.62) 100%)' },
  neutron: { background: `radial-gradient(circle at 32% 30%, #fff 0%, ${NEUTRON_COLOR} 44%, rgba(8,6,4,0.62) 100%)` },
  electron: { background: 'var(--fg)', outline: '1px solid var(--muted)', outlineOffset: '2px' },
};

/** 中考必背连读预设（人教版教材）：元素名称与符号是中考必背内容 */
const RECITE_PRESETS: { id: string; zh: string; en: string; ns: number[] }[] = [
  {
    id: 'first20',
    zh: '前 20 号元素',
    en: 'First 20 elements',
    // 氢氦锂铍硼 碳氮氧氟氖 钠镁铝硅磷 硫氯氩钾钙
    ns: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  },
  {
    id: 'activity',
    zh: '金属活动性顺序',
    en: 'Activity series',
    // 钾钙钠镁铝 锌铁锡铅(氢) 铜汞银铂金
    ns: [19, 20, 11, 12, 13, 30, 26, 50, 82, 1, 29, 80, 47, 78, 79],
  },
  {
    id: 'common',
    zh: '常见元素',
    en: 'Common elements',
    // 20 号以后初中常见：锰 铁 铜 锌 银 碘 钡 汞 铅
    ns: [25, 26, 29, 30, 47, 53, 56, 80, 82],
  },
];

/** 跟读间隔选项（毫秒）——播放器设置 */
const GAP_OPTIONS = [1000, 1800, 2600];

export default function PeriodicTable() {
  const { t, lang } = useApp();
  // 路由级 meta：标题/描述 + LearningResource 结构化数据
  const pageMeta = useMemo(() => ({
    title: `${lang === 'zh' ? '元素周期表' : 'Periodic Table'} - ${t.brandName}`,
    description: lang === 'zh' ? '118 个化学元素的交互周期表：检索、实物照片、中英文读音（男/女声）、中考跟读模式。' : 'Interactive periodic table of 118 elements: search, real photos, Chinese pronunciation (male/female voice), recite mode.',
    // 工具页只声明自己的交互工具身份；完整讲解的 FAQ/HowTo 在 /learn/periodic-table
    jsonLd: learningResourceLd({
      name: lang === 'zh' ? '元素周期表' : 'Periodic Table',
      description: lang === 'zh'
        ? '118 个化学元素的交互周期表：检索、实物照片、中英读音与中考跟读。'
        : 'Interactive periodic table of 118 elements with search, real photos, pronunciation and recite mode.',
      url: 'https://stem.irky.dev/periodic-table',
      resourceType: lang === 'zh' ? '交互工具' : 'Interactive Tool',
    }),
  }), [lang, t.brandName]);
  usePageMeta(pageMeta);
  const [selected, setSelected] = useState<ElementInfo | null>(null);
  // 周期表深链：/periodic-table?element=Fe 或 ?symbol=Fe 自动选中并打开详情。
  const [searchParams] = useSearchParams();
  const initialSymbol = useMemo(() => parsePeriodicElementQuery(searchParams), []); // 只读首屏参数
  useEffect(() => {
    if (!initialSymbol) return;
    const el = ELEMENTS.find((e) => e.symbol.toLowerCase() === initialSymbol.toLowerCase());
    if (el) {
      setSelected(el);
      setTab('props');
    }
  }, [initialSymbol]);
  /** 该元素在初中化合价库中的条目；没有条目时详情卡不显示价态区。 */
  const valenceInfo = selected ? valenceElementBySymbol.get(selected.symbol) : undefined;
  /** 原子模型视图：默认恒为 2D 课本规范（中考必考画法）；换元素时强制回到 2D */
  const [atomMode, setAtomMode] = useState<'2d' | '3d'>('2d');
  useLockBodyScroll(!!selected);
  // 离线教学包：素材就在这一页，把入口放在最贴近的地方
  const [showPack, setShowPack] = useState(false);
  const { status: packStatus } = useOfflinePack();
  const { setAiCtx } = useAiContext();
  // AI 上下文：选中元素时注入
  useEffect(() => {
    if (selected) {
      const catZh = selected.cat === 'metal' ? '金属元素' : selected.cat === 'nonmetal' ? '非金属元素' : selected.cat === 'metalloid' ? '类金属元素' : '稀有气体元素';
      const shellsStr = selected.shells.join('、');
      setAiCtx({
        topic: `化学元素：${selected.zh}`,
        knowledge:
          `元素 ${selected.symbol}（中文名 ${selected.zh}，英文 ${selected.en}）：${catZh}，原子序数 ${selected.n}，` +
          `相对原子质量 ${selected.massExact ?? selected.mass ?? '未知'}，位于第 ${selected.period} 周期、第 ${selected.group ?? '?'} 族，` +
          `电子层排布为 ${shellsStr}。${selected.discovery?.zh ? `发现史：${selected.discovery.zh}` : ''}${selected.usage?.zh ? `常见用途：${selected.usage.zh}` : ''}`,
      });
    } else {
      // 未选中任何项时注入页面级知识（工具涵盖范围 + 使用方法）
      setAiCtx({
        topic: lang === 'zh' ? '元素周期表' : 'Periodic Table',
        knowledge: lang === 'zh' ? '元素周期表工具：118 个化学元素，支持按元素符号/中文名/英文名检索；点击元素查看原子序数、相对原子质量、电子层排布、发现史与常见用途；附中考跟读模式（男/女声读音）。' : 'Periodic table: all 118 elements, searchable by symbol / Chinese / English name; tap an element for atomic number, atomic mass, electron shells, discovery, and uses; includes a recite mode with male/female audio.',
      });
    }
    return () => setAiCtx({});
  }, [selected, setAiCtx]);
  const [query, setQuery] = useState('');
  // 读音按钮状态：idle 空闲 / loading 加载中 / playing 播放中（给用户明确反馈）
  const [speakState, setSpeakState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [tab, setTab] = useState<'props' | 'story'>('props');
  // 原子结构示意图：当前悬停/点击的电子层（显示该层电子数）
  const [hoveredLayer, setHoveredLayer] = useState<number | null>(null);
  /** 点击锁定的电子层（null = 未锁定，此时默认高亮最外层——初中核心考点） */
  const [pinnedLayer, setPinnedLayer] = useState<number | null>(null);
  /** 中央展台当前预览的元素（null = 默认图例 / 操作指引态） */
  const [heroEl, setHeroEl] = useState<ElementInfo | null>(null);
  const heroTimer = useRef<number | null>(null);
  // 元素实物照片：放大预览（null=未打开）
  const [photoZoom, setPhotoZoom] = useState(false);

  // 中考跟读（播放器）：设置（朗读次数/跟读间隔）+ 播放状态（预设、当前序号、暂停）
  const [reciteSetup, setReciteSetup] = useState<string | null>(null); // 正在选择设置的预设
  const [recite, setRecite] = useState<{ presetId: string; pos: number; paused: boolean } | null>(null);
  const [repeat, setRepeat] = useState(2); // 朗读次数
  const [gapIdx, setGapIdx] = useState(1); // 跟读间隔选项索引
  // 朗读音色：女声（默认）/ 男声；语言跟随界面（中文界面读中文、英文界面读英文）；localStorage 记忆选择
  const [voice, setVoice] = useState<'female' | 'male'>(() => {
    try {
      const v = window.localStorage.getItem('stem-pt-voice');
      if (v === 'male' || v === 'zh-m' || v === 'en-m') return 'male'; // 兼容旧版/中间态
      return 'female';
    } catch {
      return 'female';
    }
  });
  const voiceRef = useRef(voice);
  voiceRef.current = voice; // 渲染同步：跟读/朗读循环中随时可读最新选择
  // 音色 + 界面语言 → 音频后缀（中文女 '' / 中文男 '-m' / 英文女 '-e' / 英文男 '-em'）
  const voiceSuffix = (v: 'female' | 'male') =>
    v === 'male' ? (lang === 'zh' ? '-m' : '-em') : lang === 'zh' ? '' : '-e';
  const voiceText = (e: ElementInfo) => (lang === 'zh' ? e.zh : e.en);
  /** 男声缺失回退女声（同语言） */
  const voiceFallback = (v: 'female' | 'male'): 'female' | 'male' | null => (v === 'male' ? 'female' : null);
  const changeVoice = (v: 'female' | 'male') => {
    setVoice(v);
    try {
      window.localStorage.setItem('stem-pt-voice', v);
    } catch {
      // 隐私模式等场景静默失败，仅本次会话有效
    }
  };
  const reciteStop = useRef(false); // 停止标记
  const recitePaused = useRef(false); // 暂停标记
  const wakeRecite = useRef<(() => void) | null>(null); // 暂停唤醒函数
  const reciteAudio = useRef<HTMLAudioElement | null>(null); // 跟读音频（复用元素，微信 X5 需手势解锁后复用）
  const speakAudio = useRef<HTMLAudioElement | null>(null); // 单点朗读音频（独立元素，避免互相打断）
  const speakTimeout = useRef<number | null>(null); // 朗读状态复位兜底定时器

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);

  const checkTableScroll = () => {
    const el = tableScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 12);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 12);
  };

  useEffect(() => {
    checkTableScroll();
    const handleResize = () => checkTableScroll();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /** 详情卡打开时的键盘工效：← / → 在相邻元素间切换，Esc 关闭（输入框内不拦截） */
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (e.key === 'Escape') {
        if (photoZoom) setPhotoZoom(false);
        else setSelected(null);
        return;
      }
      const dir = e.key === 'ArrowLeft' ? 'prev' : e.key === 'ArrowRight' ? 'next' : null;
      if (!dir) return;
      // 边界判定用渲染时的 selected 即可；真正的推进交给函数式更新取「当前」值 ——
      // 闭包快照在同一 task 内连发方向键时不刷新，实测 20 次只前进 1 步。
      if (!neighborOf(selected.n)[dir]) return; // 首末位：保持停住，不做环绕
      e.preventDefault();
      // 切换前先停掉正在播放的读音（否则上一个元素的读音会残留）
      speakAudio.current?.pause();
      window.speechSynthesis?.cancel();
      if (speakTimeout.current) window.clearTimeout(speakTimeout.current);
      setSpeakState('idle');
      setSelected((prev) => (prev ? neighborOf(prev.n)[dir] ?? prev : prev));
      setPinnedLayer(null);
      setHoveredLayer(null);
      setPhotoZoom(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, photoZoom]);

  /** 换元素即把原子模型复位为 2D 课本规范：3D 只是「可选的空间补充」，不能成为默认视图 */
  useEffect(() => { setAtomMode('2d'); }, [selected?.n]);

  const isZh = lang === 'zh';

  /** 高亮电子层：悬停 > 点击锁定 > 默认最外层（打开详情即高亮最外层电子数——初中核心考点） */
  const layerHighlight = (e: ElementInfo) => hoveredLayer ?? pinnedLayer ?? e.shells.length - 1;

  /** 切换元素（相邻导航共用）：同步复位层高亮、照片放大与朗读状态 */
  const goTo = (target: ElementInfo) => {
    speakAudio.current?.pause();
    window.speechSynthesis?.cancel();
    if (speakTimeout.current) window.clearTimeout(speakTimeout.current);
    setSpeakState('idle');
    setSelected(target);
    setPinnedLayer(null);
    setHoveredLayer(null);
    setPhotoZoom(false);
  };

  // 检索：符号精确优先 / 否则符号前缀、中文包含、英文前缀（避免短查询过度匹配）
  const queryLower = query.trim().toLowerCase();
  const exactSymbol = queryLower ? ELEMENTS.find((e) => e.symbol.toLowerCase() === queryLower) : undefined;
  const matchN = (e: ElementInfo) => {
    if (!queryLower) return false;
    // 查询恰好等于某符号 → 只精确高亮该元素（如 "fe"→仅 Fe、"cu"→仅 Cu）
    if (exactSymbol) return e.n === exactSymbol.n;
    const sym = e.symbol.toLowerCase();
    return (
      sym.startsWith(queryLower) ||
      e.zh.includes(queryLower) ||
      e.en.toLowerCase().startsWith(queryLower)
    );
  };
  /** 检索驱动的展台预览目标：精确符号优先，否则按原子序数取首个命中（ELEMENTS 本身按 Z 升序）。
   *  **与悬停共用同一套展台渲染**，所以检索时的观感与把光标移到该元素格完全一致。 */
  const searchPreview = queryLower ? (exactSymbol ?? ELEMENTS.find((e) => matchN(e)) ?? null) : null;

  /** 中央展台：进入元素格立即切换（无延迟，快速划过也不掉帧）；
   *  离开网格后延迟 800ms 回退到默认图例态——期间再次进入任何格子即取消回退，避免闪烁。 */
  const previewOn = (el: ElementInfo) => {
    if (heroTimer.current) { window.clearTimeout(heroTimer.current); heroTimer.current = null; }
    setHeroEl(el);
  };
  const previewOff = () => {
    if (heroTimer.current) window.clearTimeout(heroTimer.current);
    heroTimer.current = window.setTimeout(() => { setHeroEl(null); heroTimer.current = null; }, 800);
  };
  useEffect(() => () => { if (heroTimer.current) window.clearTimeout(heroTimer.current); }, []);

  /** 展台焦点元素：**悬停优先**；光标不在网格上时退回检索命中。二者共用同一套展台渲染，
   *  故「搜索」与「悬停」在展台上是同一个效果，不是两套。 */
  const heroFocus = heroEl ?? searchPreview;

  /** 展台派生数据（无焦点元素时为 null）：质量文本 / 族展示三元组 / 外层倾向短标签 */
  const heroData = (() => {
    if (!heroFocus) return null;
    const vt = valenceTendency(heroFocus);
    return {
      vt,
      gd: groupDisplay(heroFocus, isZh),
      massText: heroFocus.radioactive
        ? String(heroFocus.mass)
        : heroFocus.massExact != null ? String(heroFocus.massExact) : String(heroFocus.mass ?? '—'),
      vLabel: VALENCE_LABEL[vt.kind][isZh ? 'zh' : 'en'] + (vt.kind === 'lose' || vt.kind === 'gain' ? ` ${vt.count}` : ''),
      shells: heroFocus.shells.join(', '),
    };
  })();

  /** 详情卡派生数据（与展台共用同一口径，避免两处漂移） */
  const selGroup = selected ? groupDisplay(selected, isZh) : null;
  const selValence = selected ? valenceTendency(selected) : null;
  const selValenceNote = selected && selValence ? valenceNote(selected, selValence, isZh) : null;

  /** 获取（惰性创建并复用）音频元素：微信内置浏览器只解锁用户手势触发过的元素，复用才能连续播放 */
  const getAudio = (ref: MutableRefObject<HTMLAudioElement | null>) => {
    if (!ref.current) {
      ref.current = new Audio();
      ref.current.preload = 'auto';
    }
    return ref.current;
  };

  /**
   * 播放元素读音：
   * 优先本地预生成 MP3（一致、离线、免语音包）；按音色选 中文女/中文男/英文女/英文男，
   * 男声/英文文件缺失时按回退链降级，再失败降级浏览器语音合成。
   */
  const speak = (e: ElementInfo) => {
    const audio = getAudio(speakAudio);
    let fallbackTried = false;
    // 点击立即进入加载态（本地 MP3 网络加载/解码需要时间，给用户明确反馈）
    setSpeakState('loading');
    const tryPlay = (src: string) => {
      audio.src = src;
      audio.play().catch(() => {
        if (speakTimeout.current) window.clearTimeout(speakTimeout.current);
        setSpeakState('idle');
      });
    };
    audio.oncanplaythrough = () => setSpeakState('playing');
    audio.onplaying = () => setSpeakState('playing');
    audio.onended = () => {
      if (speakTimeout.current) window.clearTimeout(speakTimeout.current);
      setSpeakState('idle');
    };
    audio.onerror = () => {
      // 文件缺失 → 男声回退女声（同语言），保证有声
      const fb = voiceFallback(voiceRef.current);
      if (fb && !fallbackTried) {
        fallbackTried = true;
        tryPlay(`/audio/${e.n}${voiceSuffix(fb)}.mp3`);
        return;
      }
      // 本地音频全部失败 → 降级 speechSynthesis（设备有对应语言语音包时仍可用）
      if (speakTimeout.current) window.clearTimeout(speakTimeout.current);
      setSpeakState('idle');
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(voiceText(e));
      u.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
      u.rate = 0.85;
      u.onstart = () => {
        setSpeakState('playing');
        // 降级分支同样设置兜底复位（个别设备语音合成不触发 onend）
        window.clearTimeout(speakTimeout.current);
        speakTimeout.current = window.setTimeout(() => setSpeakState('idle'), 4000);
      };
      u.onend = () => {
        if (speakTimeout.current) window.clearTimeout(speakTimeout.current);
        setSpeakState('idle');
      };
      u.onerror = () => {
        if (speakTimeout.current) window.clearTimeout(speakTimeout.current);
        setSpeakState('idle');
      };
      window.speechSynthesis.speak(u);
    };
    tryPlay(`/audio/${e.n}${voiceSuffix(voiceRef.current)}.mp3`);
    // 兜底：个别环境 onended 不触发（微信 X5 等），按音频时长估算后复位
    // MP3 均约 1.8s，此处取 4s 确保结束状态可靠复位
    window.clearTimeout(speakTimeout.current);
    speakTimeout.current = window.setTimeout(() => setSpeakState('idle'), 4000);
  };

  /** 播放单个 MP3，返回 Promise（播放结束 / 出错即 resolve）；复用同一音频元素（微信 X5 兼容） */
  const playMp3 = (n: number) =>
    new Promise<void>((resolve) => {
      const audio = getAudio(reciteAudio);
      // 防止上一个元素被 speak 抢占或加载异常导致 onended 永不触发：超时兜底
      const timer = window.setTimeout(() => resolve(), 8000);
      let fallbackTried = false;
      const trySrc = (src: string) => {
        audio.src = src;
        audio.play().catch(() => {
          window.clearTimeout(timer);
          resolve();
        });
      };
      audio.onended = () => {
        window.clearTimeout(timer);
        resolve();
      };
      audio.onerror = () => {
        // 文件缺失 → 按回退链降级（男→女，英文→中文女），连读不中断、不出无声
        const fb = voiceFallback(voiceRef.current);
        if (fb && !fallbackTried) {
          fallbackTried = true;
          trySrc(`/audio/${n}${voiceSuffix(fb)}.mp3`);
          return;
        }
        window.clearTimeout(timer);
        resolve(); // 本地全部缺失 → 静默跳过（不打断连读）
      };
      trySrc(`/audio/${n}${voiceSuffix(voiceRef.current)}.mp3`);
    });

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  /** 暂停时阻塞等待：直到继续（wake）或停止 */
  const waitIfPaused = () =>
    new Promise<void>((resolve) => {
      if (!recitePaused.current) return resolve();
      wakeRecite.current = () => {
        recitePaused.current = false;
        wakeRecite.current = null;
        resolve();
      };
    });

  /** 中考跟读（播放器）：按预设顺序连读，每元素读 repeat 遍，留跟读间隔；支持暂停/停止 */
  const startRecite = async (presetId: string) => {
    // 正在播同一预设 → 视为停止
    if (recite?.presetId === presetId) {
      stopRecite();
      return;
    }
    reciteStop.current = false;
    recitePaused.current = false;
    const preset = RECITE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setReciteSetup(null);
    setRecite({ presetId, pos: 1, paused: false });
    for (let i = 0; i < preset.ns.length; i++) {
      if (reciteStop.current) break;
      setRecite({ presetId, pos: i + 1, paused: false });
      const n = preset.ns[i];
      // 按设定次数朗读
      for (let r = 0; r < repeat; r++) {
        if (reciteStop.current) break;
        await waitIfPaused();
        if (reciteStop.current) break;
        await playMp3(n);
        // 多遍之间短暂停顿
        if (r < repeat - 1) {
          await sleep(250);
        }
      }
      if (reciteStop.current) break;
      // 跟读间隔（留时间让学生跟读）
      await waitIfPaused();
      if (reciteStop.current) break;
      await sleep(GAP_OPTIONS[gapIdx]);
    }
    if (!reciteStop.current) setRecite(null);
    reciteStop.current = false;
  };

  /** 停止跟读（清状态；保留音频元素实例，避免微信重新解锁问题） */
  const stopRecite = () => {
    reciteStop.current = true;
    if (wakeRecite.current) {
      wakeRecite.current();
    }
    if (reciteAudio.current) {
      reciteAudio.current.pause();
    }
    setRecite(null);
    setReciteSetup(null);
  };

  // 切换界面语言时停止正在进行的朗读/跟读：跟读循环的语言在启动时闭包绑定，
  // 切语言后显示与读音会脱节（显示英文名、读中文音）——语言切换 = 全部重新开始
  const prevLangRef = useRef(lang);
  useEffect(() => {
    if (prevLangRef.current === lang) return;
    prevLangRef.current = lang;
    stopRecite();
    if (speakAudio.current) speakAudio.current.pause(); // 停止单次朗读（正在播的段属旧语言）
    if (speakTimeout.current) window.clearTimeout(speakTimeout.current);
    setSpeakState('idle');
    window.speechSynthesis?.cancel(); // 降级语音合成也停
  }, [lang]);

  /** 暂停跟读 */
  const pauseRecite = () => {
    if (!recite) return;
    recitePaused.current = true;
    if (reciteAudio.current) reciteAudio.current.pause();
    setRecite({ ...recite, paused: true });
  };

  /** 继续跟读 */
  const resumeRecite = () => {
    if (!recite) return;
    if (wakeRecite.current) wakeRecite.current();
    else recitePaused.current = false;
    if (reciteAudio.current) reciteAudio.current.play().catch(() => {});
    setRecite({ ...recite, paused: false });
  };

  /** 主表 7 周期 + 镧系(6) + 锕系(7) */
  const mainRows = ELEMENTS.filter((e) => e.y <= 7);
  const lanthanides = ELEMENTS.filter((e) => e.period === 6 && e.y === 9);
  const actinides = ELEMENTS.filter((e) => e.period === 7 && e.y === 10);
  /** 检索无命中：与数学公式/物理公式/物理常量三页同构的空状态判据 */
  const noSearchMatch = !!queryLower && !ELEMENTS.some((e) => matchN(e));

  /** 跟读当前预设与元素（用于进度显示 + 格子高亮） */
  const recitePreset = recite ? RECITE_PRESETS.find((p) => p.id === recite.presetId) : undefined;
  const reciteEl =
    recite && recitePreset ? ELEMENTS.find((e) => e.n === recitePreset.ns[recite.pos - 1]) : undefined;

  /** 元素格子（教材样式：左上角核电荷数 + 符号 + 中文名 + 底部相对原子质量） */
  const renderCell = (el: ElementInfo) => {
    const color = CAT_COLOR[el.cat];
    const matched = queryLower ? matchN(el) : false;
    const reciting = !!recite && !!recitePreset && recitePreset.ns[recite.pos - 1] === el.n;
    return (
      <button
        key={`el-${el.n}`}
        type="button"
        onClick={() => { setSelected(el); setTab('props'); setHoveredLayer(null); setPinnedLayer(null); }}
        onMouseEnter={() => previewOn(el)}
        onMouseLeave={previewOff}
        onFocus={() => previewOn(el)}
        onBlur={previewOff}
        title={`${el.zh} ${el.symbol}`}
        aria-label={`${el.zh} ${el.symbol}`}
        className={`relative flex-1 h-[58px] flex flex-col border transition-all duration-[var(--dur-fast)] hover:-translate-y-0.5 hover:shadow-[var(--elev-sm)] hover:border-[var(--fg)] ${
          matched ? 'ring-2 ring-[var(--fg)]' : ''
        } ${reciting ? 'recite-active' : ''}`}
        style={{ borderColor: color.border, backgroundColor: color.bg }}
      >
        {/* 核电荷数（左上角） */}
        <span className="absolute top-0.5 left-1 text-[0.625rem] mono-font text-[var(--muted)] leading-none">
          {el.n}
        </span>
        {/* 符号（居中，醒目） */}
        <span className="flex-1 flex items-center justify-center text-[1rem] font-bold mono-font leading-none" style={{ color: color.text }}>
          {el.symbol}
        </span>
        {/* 中文名 */}
        <span className="text-center text-[0.75rem] serif-font leading-none mb-0.5 font-medium">{el.zh}</span>
        {/* 相对原子质量（底部，调大调浅） */}
        <span className="text-center text-[0.625rem] mono-font text-[var(--muted)] leading-none mb-0.5">
          {el.mass ?? ''}
        </span>
      </button>
    );
  };

  return (
    <main className="grow shrink-0 flex flex-col my-[var(--sp-block)] px-2 sm:px-6">
      {/* 返回学科：Ghost Link（无下划线、无 ⌂ —— 回首页由顶栏 Logo 承担） */}
      <BackLink to="/subject/chemistry">{lang === 'zh' ? '返回化学' : 'Back to Chemistry'}</BackLink>

      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight serif-font text-[var(--fg)]">
          {lang === 'zh' ? '元素周期表' : 'Periodic Table'}
        </h1>
        {/* 页面动作簇独占一行：此前内联在 h1 里，390px 下「考考你」会单独掉到第二行，
            被 h1 左缘 + ml-2 顶到 x=32。顺序与实验页统一为「分享 → 问 AI → 考考你」。 */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ShareInline
            title={lang === 'zh' ? '元素周期表 · 数理化数字实验室' : 'Periodic Table · STEM Digital Lab'}
            text={
              lang === 'zh'
                ? '118 个化学元素实物照片、中英读音与中考跟读模式，免费使用！'
                : '118 elements with real photos, Chinese & English pronunciation, and exam recitation mode. Free to use!'
            }
          />
          <AskAiButton
            question={lang === 'zh' ? '请介绍元素周期表的使用方法：如何检索元素、查看详情、听读音，以及中考跟读功能怎么用？' : 'Explain how to use the periodic table: how to search elements, view details, hear pronunciation, and use the exam recite mode.'}
          />
          <AskQuizButton />
        </div>
        <p className="mt-2 text-xs serif-font italic text-[var(--muted)]">
          {lang === 'zh'
            ? '元素周期表是学习和研究化学的重要工具。由俄国化学家门捷列夫于 1869 年提出，现行版本由国际纯粹与应用化学联合会（IUPAC）维护，随新元素发现持续更新（最近于 2016 年补全 113–118 号）。点击元素查看信息，点小喇叭听读音。'
            : 'The periodic table is an essential tool for chemistry. Proposed by Dmitri Mendeleev in 1869, the current version is maintained by IUPAC and keeps updating as new elements are discovered (most recently completing 113–118 in 2016). Tap an element for details, tap the speaker to hear its name.'}
        </p>
      </div>

      {/* 检索：**不设外框、不设静态标题**——去掉包裹层与「检索元素」四个字后，输入框直接与页面内容齐左，
          消除「框中框」的机械感；功能不受影响，无障碍名改由 aria-label 承担。
          类别图例仅 <640px 在此兜底（≥sm 由表格区中央展台承担，见下方展台默认态）。 */}
      <div className="relative mb-3 sm:mb-5 w-full sm:max-w-xs border border-[var(--border-strong)] rounded-lg transition-colors focus-within:border-[var(--accent)]">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={lang === 'zh' ? '输入元素符号或中文名，如 H / 氢' : 'Type a symbol or name, e.g. H / Hydrogen'}
          aria-label={lang === 'zh' ? '检索元素' : 'Search elements'}
          /* 内层 input **零边框零轮廓**：边框与聚焦态全部交给外层容器，全局只有一层框。
             这里的内联 outline:none 是必需的——index.css 那条 :focus-visible 焦点环在 @layer 之外，
             其注释明写「优先级高于组件里的 focus:outline-none，故必定生效」，
             故只写分层的 outline-none / focus:ring-0 挡不住它（实测聚焦时内层 2px 实心环
             与外层边框叠加，正是「双层黑框」）。 */
          style={{ outline: 'none' }}
          className="min-h-10 w-full rounded-md border-none bg-transparent pl-8 pr-3 py-2 text-sm text-[var(--fg)] outline-none focus:outline-none focus:ring-0"
        />
      </div>
      {/* 类别图例：只在 <640px 保留 —— ≥sm 时展台默认态已用同一份 CAT_COLOR 渲染「分类图例」，
          此处属重复；而小屏展台折叠（hidden sm:grid），若一并删掉小屏就只剩彩色格子、
          查不到颜色含义，故在检索框下方兜底。 */}
      <div className="mb-5 flex flex-wrap gap-4 text-[0.625rem] mono-font text-[var(--muted)] sm:hidden">
        {(Object.keys(CAT_COLOR) as ElementInfo['cat'][]).map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="w-3 h-3 border" style={{ borderColor: CAT_COLOR[c].border, backgroundColor: CAT_COLOR[c].bg }} />
            {isZh ? CAT_ZH[c] : CAT_EN[c]}
          </span>
        ))}
      </div>

      {/* 检索无命中提示：与 MathFormulas / PhysicsFormulas / PhysicalConstants 完全同构 */}
      {noSearchMatch && (
        <p className="mt-8 text-center text-xs serif-font italic text-[var(--muted)]">
          {lang === 'zh' ? '没有匹配的元素，换个关键词试试。' : 'No matching element. Try another keyword.'}
        </p>
      )}

      {/* 中考跟读（播放器：选预设 → 设置次数/间隔 → 播放，右侧进度条 + 播放控制） */}
      <div className="recite-panel mb-5 border border-[var(--border)] bg-[var(--card-bg)] p-3">
        <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6875rem] mono-font text-[var(--muted)]">
              {lang === 'zh' ? '// 中考跟读' : '// Recite'}
            </span>
            {/* 离线教学包：收敛为紧贴标题的行内纯图标按钮（不再独立占行）。
                点击逻辑与弹窗沿用原样；提示走原生 title，进度并进 title 文案。 */}
            <button
              type="button"
              onClick={() => setShowPack(true)}
              title={
                packStatus && packStatus.supported
                  ? `${t.offlinePack.entryHint} · ${packStatus.cachedCount}/${packStatus.totalCount}`
                  : t.offlinePack.entryHint
              }
              aria-label={t.offlinePack.entry}
              className="chip-tap inline-flex items-center gap-0.5 text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
            >
              <HardDrive className="w-4 h-4 shrink-0" aria-hidden="true" />
              {packStatus?.isFull && <CircleCheck className="w-3 h-3 shrink-0 text-green-600" aria-hidden="true" />}
            </button>
          </div>
          {/* 声音切换（女声/男声，语言跟随界面）+ 跟读进度 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5" role="group" aria-label={lang === 'zh' ? '声音选择' : 'Voice'}>
              <span className="text-[0.625rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '声音' : 'Voice'}</span>
              {(
                [
                  ['female', lang === 'zh' ? '女声' : 'Female'],
                  ['male', lang === 'zh' ? '男声' : 'Male'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => changeVoice(v)}
                  aria-pressed={voice === v}
                  className={`chip-tap px-2 py-1 text-xs mono-font border transition-colors ${
                    voice === v ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {showPack && <OfflinePackPanel onClose={() => setShowPack(false)} />}

        {/* 预设选择 */}
        <div className="flex flex-wrap gap-2">
          {RECITE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                if (recite?.presetId === p.id) stopRecite();
                else setReciteSetup(p.id);
              }}
              className={`chip-tap px-3 py-1.5 text-xs mono-font border transition-colors ${
                recite?.presetId === p.id || reciteSetup === p.id
                  ? 'border-[var(--fg)] text-[var(--fg)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
              }`}
            >
              {isZh ? p.zh : p.en}
            </button>
          ))}
        </div>

        {/* 播放器控制区：未播放 → 设置；播放中 → 进度条 + 控制键 */}
        {reciteSetup && !recite && (
          <div className="mt-2 pt-2 border-t border-[var(--border)] flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* 朗读次数 */}
            <div className="flex items-center gap-1.5">
              <span className="text-[0.625rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '次数' : 'Times'}</span>
              {[1, 2, 3].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRepeat(r)}
                  className={`chip-tap px-2 py-1 text-xs mono-font border transition-colors ${
                    repeat === r ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {/* 跟读间隔 */}
            <div className="flex items-center gap-1.5">
              <span className="text-[0.625rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '间隔' : 'Gap'}</span>
              {GAP_OPTIONS.map((g, i) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGapIdx(i)}
                  className={`chip-tap px-2 py-1 text-xs mono-font border transition-colors ${
                    gapIdx === i ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
                  }`}
                >
                  {g / 1000}s
                </button>
              ))}
            </div>
            {/* 开始 */}
            <button
              type="button"
              onClick={() => reciteSetup && startRecite(reciteSetup)}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs mono-font border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)]"
            >
              <Play className="w-3.5 h-3.5" />
              {lang === 'zh' ? '开始跟读' : 'Start'}
            </button>
          </div>
        )}

        {recite && reciteEl && recitePreset && (
          <div className="mt-2 pt-2 border-t border-[var(--border)]">
            <div className="flex items-center gap-3">
              {/* 播放控制键（播放器风格） */}
              {recite.paused ? (
                <button
                  type="button"
                  onClick={resumeRecite}
                  aria-label={lang === 'zh' ? '继续' : 'Resume'}
                  title={lang === 'zh' ? '继续' : 'Resume'}
                  className="flex items-center justify-center w-9 h-9 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors"
                >
                  <Play className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pauseRecite}
                  aria-label={lang === 'zh' ? '暂停' : 'Pause'}
                  title={lang === 'zh' ? '暂停' : 'Pause'}
                  className="flex items-center justify-center w-9 h-9 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
                >
                  <Pause className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={stopRecite}
                aria-label={lang === 'zh' ? '停止' : 'Stop'}
                title={lang === 'zh' ? '停止' : 'Stop'}
                className="flex items-center justify-center w-9 h-9 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
              {/* 当前元素进度条 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs serif-font text-[var(--fg)] shrink-0">
                    {voiceText(reciteEl)} {reciteEl.symbol}
                  </span>
                  <div className="flex-1 h-1 bg-[var(--border)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--fg)] transition-all duration-[var(--dur-slow)]"
                      style={{ width: `${(recite.pos / recitePreset.ns.length) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-[0.625rem] mono-font text-[var(--muted)]">
                  {recite.pos} / {recitePreset.ns.length} · {lang === 'zh' ? `每元素读 ${repeat} 遍` : `${repeat}x each`} · {GAP_OPTIONS[gapIdx] / 1000}s{' '}
                  {lang === 'zh' ? '间隔' : 'gap'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 主表 */}
      <div className="mb-1.5 flex items-center justify-between text-xs mono-font text-[var(--muted)] sm:hidden px-1">
        <span className="flex items-center gap-1">
          <span>←</span>
          <span>{lang === 'zh' ? '左右滑动画布浏览完整 118 元素' : 'Swipe horizontally for all 118 elements'}</span>
          <span>→</span>
        </span>
      </div>
      <div className="relative">
        {/* 移动端左侧滚动渐变阴影指示器 */}
        <div
          className={`pointer-events-none absolute left-0 top-0 bottom-2 w-8 sm:hidden z-10 bg-gradient-to-r from-[var(--bg)] to-transparent transition-opacity duration-[var(--dur-slow)] ${
            canScrollLeft ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
        />
        {/* 移动端右侧滚动渐变阴影与提示指示器 */}
        <div
          className={`pointer-events-none absolute right-0 top-0 bottom-2 w-10 sm:hidden z-10 bg-gradient-to-l from-[var(--bg)] via-[var(--bg)]/80 to-transparent flex items-center justify-end pr-1 transition-opacity duration-[var(--dur-slow)] ${
            canScrollRight ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
        >
          <span className="text-[0.6875rem] mono-font text-[var(--muted)] animate-pulse">›</span>
        </div>

        {/* pt-3 给第一行（氢/氦）hover 上浮留出空间，避免被上方模块遮挡 */}
        {/* 右端渐隐蒙版：只在「右侧确实还有可滚动内容」时施加。
            原先 .fade-r-x 无条件把容器最后 28px 渐隐为透明 —— CSS mask 是真的把这 28px 抹掉，
            等于把第 18 列（He~Og）与镧系/锕系右端的边框挖去。现改为条件施加并收窄到 12px。 */}
        <div
          ref={tableScrollRef}
          onScroll={checkTableScroll}
          style={canScrollRight ? { maskImage: SCROLL_FADE_MASK, WebkitMaskImage: SCROLL_FADE_MASK } : undefined}
          className="overflow-x-auto pt-3 -mt-1 touch-pan-x overscroll-x-contain pb-2 scrollbar-thin"
        >
          {/* pr-[3px] 为最右列留出均匀呼吸边距，边框不再贴住容器边缘 */}
          <div className="relative min-w-[720px] xl:min-w-[880px] pr-[3px]">
            {/* ── 中央悬停展台（Hero Preview Dashboard）──
                占位说明：主表用 flex 行渲染，单元格为 flex-1；下面这层覆层用同一套几何
                （左侧 24px 周期号 + 4px 间距 = 28px 起点，18 列等宽、4px 间隙、58px 行高），
                因此列边界与真实格子逐列重合 —— 展台恰好落在第 1~3 周期、第 3~12 列的天然空白区。
                纯 hover 交互，触屏无 hover 故在 <640px 折叠（sm:grid），390 视口下不占位、不溢出。 */}
            <div
              className="pointer-events-none absolute left-[28px] right-[3px] top-0 hidden sm:grid"
              style={{
                gridTemplateColumns: 'repeat(18, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(3, 58px)',
                gap: '4px',
              }}
              aria-hidden="true"
            >
              {/* 展台本体：**无边框、无底色、无投影、无裁切**——完全通透。
                  层级只靠字重、字阶与负空间组织，让图文直接悬浮在周期表中部的天然留白里，
                  两态（图例态 / 悬停态）共用同一片空间，不出现「外挂小卡片」的硬切割感。 */}
              <div className="col-start-3 col-end-13 row-start-1 row-end-4 relative">
                {/* 默认态：分类图例 + 操作指引 */}
                <div
                  className={`absolute inset-0 px-3 py-2.5 flex flex-col justify-center gap-1.5 transition-opacity duration-[var(--dur-base)] ${
                    heroFocus ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  <div className="text-[0.625rem] mono-font text-[var(--muted)] tracking-widest">
                    // {isZh ? '分类图例' : 'LEGEND'}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {(Object.keys(CAT_COLOR) as ElementInfo['cat'][]).map((k) => (
                      <span key={k} className="inline-flex items-center gap-1.5 text-[0.6875rem] serif-font text-[var(--fg)]">
                        <span
                          className="w-3 h-3 border shrink-0"
                          style={{ borderColor: CAT_COLOR[k].border, backgroundColor: CAT_COLOR[k].bg }}
                        />
                        {isZh ? CAT_ZH[k] : CAT_EN[k]}
                      </span>
                    ))}
                  </div>
                  <p className="text-[0.6875rem] serif-font text-[var(--muted)] leading-relaxed">
                    {isZh
                      ? '把光标移到任意元素格上，这里即时预览该元素的实物标本与核心数据。'
                      : 'Move the cursor over any cell to preview its specimen photo and key data here.'}
                  </p>
                  <p className="text-[0.625rem] mono-font text-[var(--muted)] leading-relaxed">
                    {isZh
                      ? '点击元素格 → 完整微观结构与百科故事 · 横向滚动浏览 118 个元素'
                      : 'Click a cell → full micro view and wiki story · scroll sideways for all 118'}
                  </p>
                </div>

                {/* 悬停态：实物标本 + 身份 + 核心指标 + 微提示 */}
                {heroData && heroFocus && (
                  <div
                    className={`absolute inset-0 px-3 py-2.5 flex flex-col gap-1.5 transition-opacity duration-[var(--dur-base)] ${
                      heroFocus ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative w-[72px] h-[72px] shrink-0 border border-[var(--border)] rounded-xs overflow-hidden bg-white">
                        <img
                          key={`hero-img-${heroFocus.n}`}
                          src={`/element-images/${heroFocus.n}.jpg`}
                          alt=""
                          loading="lazy"
                          draggable={false}
                          className="w-full h-full object-contain"
                          style={{ display: heroFocus.n > 104 ? 'none' : 'block' }}
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            img.style.display = 'none';
                            const fb = img.parentElement?.querySelector('[data-hero-fallback]') as HTMLElement | null;
                            if (fb) fb.style.display = 'flex';
                          }}
                        />
                        <div
                          key={`hero-fb-${heroFocus.n}`}
                          data-hero-fallback
                          className="absolute inset-0 flex-col items-center justify-center gap-0.5"
                          style={{ display: heroFocus.n > 104 ? 'flex' : 'none' }}
                        >
                          <span className="text-lg font-bold mono-font leading-none" style={{ color: CAT_COLOR[heroFocus.cat].border }}>
                            {heroFocus.symbol}
                          </span>
                          <span className="text-[0.625rem] mono-font text-[var(--muted)]">{isZh ? '无实物图' : 'no photo'}</span>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[0.625rem] mono-font text-[var(--muted)] leading-none">#{heroFocus.n}</div>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-xl font-bold mono-font text-[var(--fg)] leading-none">{heroFocus.symbol}</span>
                          <span className="text-base serif-font font-medium text-[var(--fg)] leading-none">{heroFocus.zh}</span>
                        </div>
                        <div className="text-[0.6875rem] serif-font text-[var(--muted)] truncate leading-tight mt-0.5">{heroFocus.en}</div>
                        <span
                          className="mt-1 inline-block px-1.5 py-0.5 border text-[0.625rem] mono-font rounded-xs font-medium"
                          style={{
                            borderColor: CAT_COLOR[heroFocus.cat].border,
                            color: CAT_COLOR[heroFocus.cat].border,
                            backgroundColor: CAT_COLOR[heroFocus.cat].bg,
                          }}
                        >
                          {isZh ? CAT_ZH[heroFocus.cat] : CAT_EN[heroFocus.cat]}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.6875rem] mono-font text-[var(--muted)]">
                      <span className="whitespace-nowrap">
                        {isZh ? '相对原子质量 ' : ''}
                        <i>A</i><sub>r</sub>{' '}
                        <b className="text-[var(--fg)] font-semibold">{heroData.massText}</b>
                      </span>
                      <span>
                        {isZh ? '周期 ' : 'Period '}
                        <b className="text-[var(--fg)] font-semibold">{heroFocus.period}</b>
                      </span>
                      <span>
                        {isZh ? '族 ' : 'Group '}
                        <b className="text-[var(--fg)] font-semibold serif-font">{heroData.gd.main}</b>
                      </span>
                      <span>
                        {isZh ? '电子层 ' : 'Shells '}
                        <b className="text-[var(--fg)] font-semibold">{heroData.shells}</b>
                      </span>
                      <span>
                        {isZh ? '外层倾向 ' : 'Outer '}
                        <b className="text-[var(--fg)] font-semibold">{heroData.vLabel}</b>
                      </span>
                    </div>
                    <p className="mt-auto text-[0.625rem] serif-font text-[var(--muted)] leading-tight">
                      {isZh
                        ? '点击元素格打开完整微观结构与百科故事'
                        : 'Click the cell to open the full micro view and wiki story'}
                    </p>
                  </div>
                )}
              </div>
            </div>
            {/* 周期行 */}
            {[1, 2, 3, 4, 5, 6, 7].map((period) => (
              <div key={period} className="flex gap-1 mb-1">
                {/* 周期号 */}
                <span className="w-6 shrink-0 flex items-center justify-center text-[0.625rem] mono-font text-[var(--muted)]">
                  {period}
                </span>
                {Array.from({ length: 18 }, (_, i) => {
                  const col = i + 1;
                  const el = mainRows.find((e) => e.x === col && e.y === period);
                  if (el) return renderCell(el);
                  // 镧系/锕系占位格（主表第 6/7 周期 IIIB 族位置，对应下方独立两行）
                  if (col === 3 && period === 6) {
                    return (
                      <div key={`ph-${period}-${col}`} className="flex-1 h-[58px] flex flex-col items-center justify-center border border-[var(--border)] text-center leading-tight px-0.5">
                        <span className="text-[0.625rem] serif-font text-[var(--fg)]">{lang === 'zh' ? '镧系' : 'La'}</span>
                        <span className="text-[0.625rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '57–71' : '57–71'}</span>
                      </div>
                    );
                  }
                  if (col === 3 && period === 7) {
                    return (
                      <div key={`ph-${period}-${col}`} className="flex-1 h-[58px] flex flex-col items-center justify-center border border-[var(--border)] text-center leading-tight px-0.5">
                        <span className="text-[0.625rem] serif-font text-[var(--fg)]">{lang === 'zh' ? '锕系' : 'Ac'}</span>
                        <span className="text-[0.625rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '89–103' : '89–103'}</span>
                      </div>
                    );
                  }
                  return <div key={`empty-${period}-${col}`} className="flex-1 h-[58px]" />;
                })}
              </div>
            ))}

            {/* 空行（分隔） */}
            <div className="h-4" />

            {/* 镧系 */}
            <div className="flex gap-1 mb-1">
              <span className="w-6 shrink-0 flex items-center justify-center text-[0.625rem] mono-font text-[var(--muted)]">
                {lang === 'zh' ? '镧系' : 'La'}
              </span>
              {lanthanides.map((el) => renderCell(el))}
            </div>
            {/* 锕系 */}
            <div className="flex gap-1 mb-1">
              <span className="w-6 shrink-0 flex items-center justify-center text-[0.625rem] mono-font text-[var(--muted)]">
                {lang === 'zh' ? '锕系' : 'Ac'}
              </span>
              {actinides.map((el) => renderCell(el))}
            </div>
          </div>
        </div>
      </div>

      {/* 底部说明 */}
      <p className="mt-5 text-[0.6875rem] serif-font text-[var(--muted)] leading-relaxed">
        {lang === 'zh'
          ? '注：周期表按原子序数（核电荷数）递增排列；第 8、9、10 三个纵列共同组成一个族。相对原子质量为近似值。'
          : 'Note: ordered by atomic number (nuclear charge); columns 8-10 together form one group. Atomic masses are approximate.'}
      </p>

      {/* 元素详情抽屉：公共组件（与化学式页共用同一实现，零重复） */}
      {selected && (
        <ElementDetailSheet
          selected={selected}
          onClose={() => setSelected(null)}
          onNavigate={goTo}
          lang={lang}
          isZh={isZh}
          tab={tab}
          setTab={setTab}
          atomMode={atomMode}
          setAtomMode={setAtomMode}
          hoveredLayer={hoveredLayer}
          setHoveredLayer={setHoveredLayer}
          pinnedLayer={pinnedLayer}
          setPinnedLayer={setPinnedLayer}
          photoZoom={photoZoom}
          setPhotoZoom={setPhotoZoom}
          layerHighlight={layerHighlight}
          speak={speak}
          speakState={speakState}
          selGroup={selGroup}
          selValence={selValence}
          selValenceNote={selValenceNote}
          valenceInfo={valenceInfo}
        />
      )}

      {/* 结构化讲解独立成页：工具页底部只留一行入口，正文与数据表不在这里展开 */}
      <div className="mt-10 border-t border-[var(--border)] pt-6">
        <Link
          to="/learn/periodic-table"
          className="inline-flex items-center gap-2 text-sm serif-font text-[var(--fg)] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--fg)]"
        >
          {lang === 'zh' ? '结构化讲解与数据表' : 'Structured explanation and data table'}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
        <p className="mt-2 text-xs serif-font italic text-[var(--muted)]">
          {lang === 'zh'
            ? '周期表规律、前 20 号元素速查表、常见误区与常见问题。'
            : 'Periodic trends, a first-20-elements quick table, common misconceptions and FAQs.'}
        </p>
      </div>
    </main>
  );
}
