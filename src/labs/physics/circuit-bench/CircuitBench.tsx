/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 物理·电学工作台（Circuit Bench）
 *
 * 工具台融入全站页面流，而不是有阶段锁定的三幕式实验：
 * - 页面流：标准实验页头（LabPage）→ 预设胶囊行 → 画布卡 → 数据记录卡
 * - 画布卡：工具栏（44px）是卡片标题栏；统计/检查器与元件坞都浮在画布内部（Canvas HUD），
 *   卡片宽度 = 全站版心内容宽度；实验导读是画布上可拖拽的浮卡（挂在工作台根节点上，
 *   全屏也在），打开时元件坞自动收成小胶囊
 * - 画布下方：两栏数据记录卡片（可折叠）
 *
 * 仿真：热学量（灯丝温度 / 保险丝热积累 / 加热器热量）用 100 ms 定时器
 * 推进；运行可暂停。只有热状态真的变了才提交快照，纯电阻电路不会每帧重渲染。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { useApp } from '../../../lib/app-context';
import { useAiContext } from '../../../lib/ai-context';
import { NARROW_QUERY } from '../../../lib/use-param-dock';
import { setLabState, setPageQuestion } from '../../../lib/ai-dynamic-questions';
import BenchToolbar from './BenchToolbar';
import CircuitCanvas, {
  type CanvasTool,
  type CircuitCanvasHandle,
  type MenuTarget,
} from './CircuitCanvas';
import CanvasContextMenu from './CanvasContextMenu';
import ElementPalette, { type PaletteProjection } from './ElementPalette';
import InspectorPanel from './InspectorPanel';
import MeasurementPanel from './MeasurementPanel';
import CircuitMonitor from './CircuitMonitor';
import RepairConfirm from './RepairConfirm';
import PresetBriefing from './PresetBriefing';
import PresetPicker from './PresetPicker';
import { type CircuitViewMode } from './circuit-bench-view';
import {
  benchLayout,
  benchShellClass,
  canvasCardClass,
  canvasSlotClass,
  measureDrawerClass,
} from './workbench-layout';
import { getPreset, instantiatePreset, type CircuitPreset } from './circuit-bench-presets';
import { presetTitleOf, socraticPersona } from './circuit-bench-prompts';
import {
  formatPhysicalValue,
  resetElementState,
  stepSimulation,
  type BenchState,
  type ElementKind,
  type SolveResult,
} from './circuit-bench-core';
import { elementName } from './circuit-bench-naming';
import {
  MAX_COMPONENTS,
  MAX_WIRES,
  addComponent,
  addWire,
  moveComponent,
  removeComponent,
  removeWire,
  replugWire,
  rotateComponent,
  setSwitchClosed,
  swapPolarity,
  toggleSwitch,
  updateParams,
} from './circuit-bench-state';
import { snapDropPoint } from './circuit-bench-palette';
import { findFreeSpot } from './circuit-bench-geometry';
import {
  blankMenuItems,
  elementMenuItems,
  isFaulty,
  wireMenuItems,
  type MenuAction,
  type MenuItem,
} from './circuit-bench-menu';
import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  mark,
  redo,
  replace,
  rollbackLast,
  settle,
  undo,
  type History,
} from './circuit-bench-history';
import { readingReversed } from './circuit-bench-labels';
import { deenergizePlan, type DeenergizePlan } from './circuit-bench-monitor';
import { loadCircuitBenchEngine, solveNow, type CircuitEngineKind } from './circuit-bench-engine';
import { useNarrow, useShortViewport, useTabletSheet } from './use-bench-media';

const LAB_ID = 'circuit-bench';

/**
 * 焦点是否落在「会自己消费 Delete / Ctrl+Z」的文本编辑器里。
 *
 * 只豁免真正的文本类控件：文本 / 数字 / 搜索框、`textarea`、`select`、
 * `contenteditable`。`input[type=range]` 必须放行——学生刚拖完滑块，焦点还停在
 * 滑块上，此时 Ctrl+Z 若无反应，看起来就是「撤销坏了」（审计 P1-4）。
 * 复选框 / 单选框同理：它们没有原生撤销语义，放行给工作台。
 */
function isTextEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type;
  return !(
    type === 'range' ||
    type === 'checkbox' ||
    type === 'radio' ||
    type === 'button' ||
    type === 'submit' ||
    type === 'reset' ||
    type === 'color' ||
    type === 'file'
  );
}

/** 视口宽度：画布卡高度按版心宽度推导（SSR 默认按桌面版心）。 */
function useViewportWidth(): number {
  const [w, setW] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  );
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
}

/** 热学状态指纹：四舍五入后相同就不提交 state（否则 10 fps 无意义重渲染）。 */
function thermalSignature(state: BenchState): string {
  return state.components
    .map((el) => {
      const st = el.state;
      if (el.kind === 'bulb') return `${el.id}:${Math.round(st.temp / 2)}:${st.blown ? 1 : 0}`;
      if (el.kind === 'fuse') return `${el.id}:${Math.round(st.heat * 100)}:${st.blown ? 1 : 0}`;
      if (el.kind === 'heater') return `${el.id}:${Math.round(st.temp / 2)}`;
      return '';
    })
    .join('|');
}

export default function CircuitBench() {
  const { lang } = useApp();
  const { setAiCtx, askAi } = useAiContext();
  const zh = lang === 'zh';

  const [presetId, setPresetId] = useState('sp');
  const preset = getPreset(presetId);
  const [history, setHistory] = useState<History<BenchState>>(() =>
    createHistory(instantiatePreset('sp')),
  );
  const bench = history.present;
  const benchRef = useRef(bench);
  benchRef.current = bench;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [tool, setTool] = useState<CanvasTool>('select');
  const [pendingTerminal, setPendingTerminal] = useState<string | null>(null);
  const [showValues, setShowValues] = useState(true);
  const [viewMode, setViewMode] = useState<CircuitViewMode>('schematic');
  const [running, setRunning] = useState(true);
  const [error, setError] = useState('');
  const [dataEpoch, setDataEpoch] = useState(0);
  const [fitSignal, setFitSignal] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  /**
   * 伪全屏：iOS Safari 没有 `Element.requestFullscreen`，可选链会静默短路——
   * 上一版点「全屏」前后 shell 尺寸一模一样、不报错也无回退（审计 §2.10）。
   * 没有原生 API（或请求被拒）时退到 `fixed inset-0` 的沉浸布局，判据与布局
   * 全部复用 `fsActive`，学生看到的是同一套「画布吃掉整屏」。
   */
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  /** 导读浮卡 / 画布下方数据记录台是否展开；都默认收起或不占画布空间。 */
  const [infoOpen, setInfoOpen] = useState(false);
  /**
   * 元件坞是否收成一枚小胶囊。**默认收起**：一进实验台先看见一块完整的画布与电路，
   * 左侧只留一枚 `[ + 元件库 ]` 胶囊，要用元件库再点开。
   */
  const [paletteCollapsed, setPaletteCollapsed] = useState(true);
  /**
   * 窄屏首帧就要是收起态。上一版初始 `true`：首帧 `sheetOpen` 成立，reveal effect
   * 直接把页面平滑滚到画布上沿（375×667 实测落地 scrollY=348，header y=-332、
   * H1 y=-195.8，顶栏与标题全被滚出视口）。窄屏默认收起，桌面默认展开。
   */
  const [measureOpen, setMeasureOpen] = useState(
    () => !(typeof window !== 'undefined' && window.matchMedia?.(NARROW_QUERY).matches),
  );
  /**
   * 详细参数面板是否展开。单击元件只做选中/拖动，不推开这块大面板——
   * 课堂上学生点一下就想挪元件，面板自己弹出来会盖住半个画布。
   * 双击元件、或右键菜单里的「详细参数…」才打开它。
   */
  const [inspectorOpen, setInspectorOpen] = useState(false);
  /**
   * 实时监控面板的展开态。桌面由面板自己管；窄屏必须提到这一层，因为
   * 「同一时刻只允许一块浮层」的互斥要跨四个兄弟节点（导读卡 / 元件库 /
   * 检查器 / 监控），谁都只能看见自己，只有实验台能替它们互相收。
   */
  const [monitorOpen, setMonitorOpen] = useState(false);
  /** 窄屏判据（与 Tailwind `sm` 断点同界，见 use-bench-media）。 */
  const narrow = useNarrow();
  /** 竖屏平板：导读卡放不下 380px 浮卡，改走贴底抽屉（见 use-bench-media）。 */
  const tabletSheet = useTabletSheet();
  /** 矮视口（横屏手机）：数据记录改成贴底浮层，否则它永远在折叠线以下（见 use-bench-media）。 */
  const shortViewport = useShortViewport();
  /** 原生全屏或伪全屏：布局、取景、抽屉让位都只认这一个判据。 */
  const fsActive = fullscreen || pseudoFullscreen;
  /** 右键 / 长按菜单：屏幕坐标 + 打的是谁。 */
  const [menu, setMenu] = useState<{ x: number; y: number; target: MenuTarget } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  /** 画布句柄：元件坞拖拽要借它做屏幕 ↔ 世界坐标换算。 */
  const canvasApi = useRef<CircuitCanvasHandle | null>(null);
  /**
   * 「数据记录下拉里正被高亮的那只电表」→ 画布轮廓微光。
   *
   * 多表同屏时（三只电压表分散在三个支路上），光看下拉里的「电压表 V₂」根本
   * 不知道画布上指的是哪一只；指针还在面板上、离画布很远，画布自己的 hover 也帮不上忙。
   * 状态提在实验台这一层，因为画布与数据记录面板是兄弟节点，谁也不持有对方。
   */
  const [probeHighlight, setProbeHighlight] = useState<string | null>(null);
  const layout = benchLayout(useViewportWidth());

  /* ── C++/WASM 计算核：加载完成后重算一次，读数切到 bench_solve ── */
  const [engineKind, setEngineKind] = useState<CircuitEngineKind>('ts');
  useEffect(() => {
    let alive = true;
    void loadCircuitBenchEngine().then((engine) => {
      if (alive) setEngineKind(engine.kind);
    });
    return () => {
      alive = false;
    };
  }, []);

  const result: SolveResult | null = useMemo(() => {
    if (!bench.components.length) return null;
    return solveNow(bench);
  }, [bench, engineKind]);

  /* ── 热学仿真：100 ms 推进；暂停时完全停下 ── */
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const current = benchRef.current;
      if (!current.components.length) return;
      const next = stepSimulation(current, 0.1);
      if (thermalSignature(next.state) !== thermalSignature(current)) {
        setHistory((h) => replace(h, next.state));
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [running]);

  /* ── 全屏状态跟随浏览器 ── */
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  /**
   * 伪全屏时锁住页面滚动：`fixed inset-0` 只盖住视口，底下的长页面还在，
   * iOS 上照样能把它拖走。退出时逐字还原，不影响其他页面。
   */
  useEffect(() => {
    if (!pseudoFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pseudoFullscreen]);

  /**
   * 进出全屏：画布盒子从「按版心宽度推导的固定高度」换成「吃掉视口剩余高度」，
   * 尺寸变化本身不会触发 fitViewToContent，所以这里补一次内容适配，
   * 电路在全屏里才是铺开的而不是缩在原来那个 620px 盒子的比例上。
   * 原生全屏与 iOS 伪全屏共用这一个判据。
   */
  useEffect(() => {
    setFitSignal((n) => n + 1);
  }, [fsActive]);

  /**
   * 全屏默认把数据记录收起，把纵向空间 100% 让给画布；退出时恢复学生原来的选择。
   * 面板本身始终挂在同一处，只换外层容器——不会因为折叠/展开丢掉已记录的读数。
   */
  const measureBeforeFullscreen = useRef(measureOpen);
  useEffect(() => {
    if (fsActive) {
      measureBeforeFullscreen.current = measureOpen;
      setMeasureOpen(false);
    } else {
      setMeasureOpen(measureBeforeFullscreen.current);
    }
    // 只在进出全屏（含 iOS 伪全屏）时切换；学生自己在全屏里展开/收起不应被这个 effect 覆盖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fsActive]);

  /**
   * 窄屏默认收起数据记录。
   *
   * 桌面它是一整块页面流卡片，学生往下滚就能看到；窄屏它被改成贴底抽屉（见
   * MeasurementPanel 的 `max-sm:fixed`），默认展开就等于一进实验台先盖住半块画布。
   * 所以进窄屏先收成药丸，并把桌面的选择记下来——回到宽屏时原样还回去，
   * 不替学生做「我是不是不想看记录」的决定。
   */
  const narrowMeasureChoice = useRef<boolean | null>(null);
  /** 首帧就是窄屏（直接手机上打开）：桌面默认值是「展开」，回到宽屏时按它还回去。 */
  const mountedNarrow = useRef(narrow);
  useEffect(() => {
    if (narrow) {
      if (narrowMeasureChoice.current === null) {
        narrowMeasureChoice.current = mountedNarrow.current ? true : measureOpen;
        setMeasureOpen(false);
      }
    } else if (narrowMeasureChoice.current !== null) {
      setMeasureOpen(narrowMeasureChoice.current);
      narrowMeasureChoice.current = null;
    }
    // 只在跨越窄屏断点时切换；学生自己在窄屏里展开/收起不应被这个 effect 覆盖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrow]);

  /**
   * 矮视口（横屏手机）同样默认收起。
   *
   * 这一档面板也是贴底浮层（样式在 `index.css` 的 `(max-height: 520px) and
   * (min-width: 640px)` 一档，与 `useShortViewport` 同一条件），默认展开就等于
   * 一进实验台先盖住画布下半截。与窄屏那条完全同构：进这一档收成药丸，
   * 记下原来的选择，回到常态原样还回去。
   *
   * 两条互斥（`max-sm` 到 639，这条从 640 起），不会互相覆盖同一个 ref。
   */
  const shortMeasureChoice = useRef<boolean | null>(null);
  useEffect(() => {
    if (shortViewport) {
      if (shortMeasureChoice.current === null) {
        shortMeasureChoice.current = measureOpen;
        setMeasureOpen(false);
      }
    } else if (shortMeasureChoice.current !== null) {
      setMeasureOpen(shortMeasureChoice.current);
      shortMeasureChoice.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortViewport]);

  /**
   * 窄屏「浮层让位」：贴底抽屉打开前，先把画布滚到视口上沿。
   *
   * 病灶（审计 V1/V2 实测）：竖屏画布槽顶在 y≈459，视口只有 667/844 高；
   * 45–55dvh 的抽屉一摊开就从底边一直盖到画布中部，可点面积掉到 0–40%。
   * 抽屉高度是内容决定的（改小就读不了），能动的只有页面滚动——把画布带到
   * 抽屉上方那条空带里，学生一边看公式/参数，一边还能看见电路本身。
   *
   * 只做「对齐到上沿」这一件事：已经在位（顶端 0–24px）就一动不动，避免每次
   * 点药丸都把页面抖一下；全屏没有页面滚动，直接跳过（画布本来就在抽屉上方
   * 那一半，靠抽屉自己的 max-h 收口——全屏下的另一种解法见 index.css 里
   * 「画布卡让出底边」那条规则）。
   *
   * `force`：竖屏平板上只有导读卡是抽屉（其余浮层仍是浮卡），它的打开动作要
   * 借这一手把画布带上来，所以由调用方显式放行，而不是把判据放宽成「平板一律滚」。
   *
   * 矮视口（横屏手机）也走这一手：那边数据记录同样是贴底抽屉（见 `index.css`），
   * 不先把画布顶到上沿，抽屉一摊开就正好压住唯一露出来的那一条画布。
   */
  /**
   * 抽屉打开前记下的 scrollY。关闭抽屉时按它滚回去——上一版只滚不记，
   * 375 下打开检查器后停在 scrollY=451，关掉仍停在 451，标题与预设条回不来
   * （审计 §2.6：beforeClose 451 → afterClose 451）。
   */
  const sheetScrollBeforeRef = useRef<number | null>(null);
  const revealCanvasAboveSheet = (force = false) => {
    if ((!narrow && !shortViewport && !force) || fsActive) return;
    const el = canvasRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top >= 0 && top <= 24) return;
    // 只在第一块抽屉打开时记；连续切换浮层不该把「打开前」覆盖成「上一块打开后」。
    if (sheetScrollBeforeRef.current === null) sheetScrollBeforeRef.current = window.scrollY;
    window.scrollTo({ top: Math.max(0, Math.round(top + window.scrollY - 8)), behavior: 'smooth' });
  };

  /**
   * 左控右看：画布左侧同一时刻只站一块操作面板。
   *
   * 元件坞真正收起的条件 = 学生自己的收起选择 ∪ 导读卡打开 ∪ 检查器打开——
   * 三者任意一个成立都收成胶囊，左侧就不会同时冒出两块浮板；学生自己点开元件库
   * （`onCollapsedChange(false)`）时顺手收掉导读与检查器，等于「谁最后动手谁独占左边」。
   *
   * 上一版是「记住元件坞原状态、导读开了替它收、关了再还原」的 ref 写法，这版把
   * 收起状态收敛成一个受控值，省掉第二份 ref，也不再有两条 effect 抢着写同一个
   * state 的竞态（学生手快一点就会互相覆盖）。
   */
  const paletteHidden = paletteCollapsed || infoOpen || inspectorOpen || (narrow && monitorOpen);
  const onPaletteCollapsedChange = (v: boolean) => {
    setPaletteCollapsed(v);
    if (!v) {
      setInspectorOpen(false);
      setInfoOpen(false);
      // 窄屏元件库是底部横向坞、监控面板也是底部抽屉，两者叠在一起会互相压死；
      // 桌面一左一右并不冲突，所以只收窄屏这一档。
      if (narrow) {
        setMonitorOpen(false);
        setMeasureOpen(false);
        revealCanvasAboveSheet();
      }
    }
  };

  /**
   * 窄屏单层约束：四块浮层（导读卡 / 元件库 / 检查器 / 监控）同一时刻只留一块。
   *
   * 桌面有 1440/1280 的横向余量，两块浮层各占一角反而能同屏对照；窄屏 375px
   * 一块抽屉就吃掉半个屏幕，四块全开时画布的可点面积几乎归零（审计实测 <40%）。
   * 所以窄屏在任何一块「打开」的动作里，先把其余三块收起——包括把元件库的
   * `paletteCollapsed` 真的置回 true，而不是只靠 `paletteHidden` 遮住：
   * 否则关掉检查器时元件库会自己弹回来，学生看到的就是「我明明收过它」。
   */
  const closeOverlaysFor = (keep: 'briefing' | 'palette' | 'inspector' | 'monitor' | 'measure') => {
    // 竖屏平板（768 级）上的导读卡也是贴底抽屉，和手机同一副身子：
    // 抽屉一摊开就吃掉 55dvh，再叠一块底边面板同样谁也点不到，所以一并进互斥。
    // 桌面（无 `tabletSheet`）保持一左一右可同屏对照。
    if (!narrow && !tabletSheet) return;
    if (keep !== 'briefing') setInfoOpen(false);
    if (keep !== 'palette') setPaletteCollapsed(true);
    if (keep !== 'inspector') setInspectorOpen(false);
    if (keep !== 'monitor') setMonitorOpen(false);
    // 数据记录在窄屏也是贴底抽屉（桌面是页面流里的卡片，不受这条约束）。
    // 它不属于审计点名的「四浮层」，但同样是底边一块整宽面板——
    // 两块叠在一起谁也点不到，所以一并进互斥。
    if (keep !== 'measure') setMeasureOpen(false);
  };

  /* ── 删除 / 撤销 / 重做快捷键（文本输入控件内不拦截） ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Esc：取消待接的接线柱 / 关闭检查器。检查器浮在右上角，会盖住元件，
      // 学生要快速回到干净画布时它必须能一键收走。
      if (e.key === 'Escape') {
        setPendingTerminal(null);
        setSelectedId(null);
        setSelectedWireId(null);
        setInspectorOpen(false);
        setMenu(null);
        return;
      }
      if (isTextEditable(e.target)) return;
      // 桌面端的主删除路径：选中元件/导线后直接按 Delete 或 Backspace。
      // 语义与右键菜单的「删除」完全一致（同一套清理：历史 + 选中态 + 面板）。
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedWireId) {
          e.preventDefault();
          deleteWireById(selectedWireId);
          return;
        }
        if (selectedId) {
          e.preventDefault();
          deleteElement(selectedId);
        }
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        setHistory((h) => undo(h));
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        setHistory((h) => redo(h));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, selectedWireId]);

  /* ── 加载预设 / 清空：历史与记录都重新开始 ── */
  const pickPreset = (next: CircuitPreset) => {
    setPresetId(next.id);
    setHistory(createHistory(instantiatePreset(next.id)));
    setSelectedId(null);
    setSelectedWireId(null);
    setPendingTerminal(null);
    setInspectorOpen(false);
    setMenu(null);
    setTool('select');
    setError('');
    setPendingRepair(null);
    setDataEpoch((n) => n + 1);
  };

  const clearBench = () => {
    setPresetId('free');
    setHistory(createHistory(instantiatePreset('free')));
    setSelectedId(null);
    setSelectedWireId(null);
    setPendingTerminal(null);
    setInspectorOpen(false);
    setMenu(null);
    setTool('select');
    setError('');
    setPendingRepair(null);
    setDataEpoch((n) => n + 1);
  };

  const toggleFullscreen = () => {
    if (pseudoFullscreen) {
      // 退出伪全屏：fitSignal 由 fsActive 的 effect 统一补一次。
      setPseudoFullscreen(false);
      return;
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
      return;
    }
    const el = shellRef.current;
    if (!el) return;
    // iOS Safari：没有 requestFullscreen（可选链静默短路，连 catch 都进不去）。
    // 有 API 但请求被拒（缺用户手势 / 策略禁止）同样退到伪全屏，不再只报一句错。
    const request = el.requestFullscreen?.();
    if (!request) {
      setPseudoFullscreen(true);
      return;
    }
    void request.catch(() => setPseudoFullscreen(true));
  };

  /* ── 画布交互 ── */
  const onMoveStart = () => {
    setHistory((h) => mark(h));
  };

  const onMove = (id: string, x: number, y: number) => {
    setHistory((h) => replace(h, moveComponent(h.present, id, x, y)));
  };

  /**
   * 一次拖动收尾：丢掉「按下了但什么都没改」的那次 mark。
   * 有真实位移时栈顶是拖动前的状态、present 已经不同，这里不动，
   * 所以「拖一次 = 撤销一次」不受影响。
   */
  const onMoveEnd = () => {
    setHistory((h) => settle(h));
  };

  /** 检查器滑块连续拖动：起点 mark、过程 replace、松手 settle —— 一次拖动只留一条历史。 */
  const onInspectorDragStart = () => {
    setHistory((h) => mark(h));
  };
  const onInspectorDragEnd = () => {
    setHistory((h) => settle(h));
  };
  const onInspectorChangeLive = (next: BenchState) => {
    setHistory((h) => replace(h, next));
  };

  /**
   * 成线：两个接线柱直接接上，不看「待接状态」。
   * 拖拽连线（接线柱拉皮筋到目标柱）一次手势就走这里，
   * 「点第一个 → 点第二个」则先由 `onTerminal` 记下第一个再调它。
   * 拆成这个函数是因为两次 `onTerminal` 在同一 tick 里都会读到旧的
   * `pendingTerminal`，串起来接会接错端点。
   */
  const connect = (from: string, to: string) => {
    const out = addWire(benchRef.current, from, to);
    if (out.added) {
      setHistory((h) => commit(h, out.state));
      setError('');
    } else {
      const zhMsg: Record<string, string> = {
        端子不存在: '端子不存在',
        不能连接同一个端子: '不能把同一个接线柱连到自己',
        不能短接同一个元件的两端: '不能短接同一个元件的两端',
        导线已存在: '这条导线已经存在',
        导线数量已达上限: `导线数量已达上限（${MAX_WIRES} 根）`,
      };
      const enMsg: Record<string, string> = {
        端子不存在: 'That terminal no longer exists',
        不能连接同一个端子: 'Cannot wire a terminal to itself',
        不能短接同一个元件的两端: 'Cannot short both ends of the same part',
        导线已存在: 'This wire already exists',
        导线数量已达上限: `Wire limit reached (${MAX_WIRES})`,
      };
      // 英文界面绝不能弹出中文原因（addWire 的 reason 是中文常量）。
      setError(
        zh
          ? zhMsg[out.reason ?? ''] ?? '这条线接不上'
          : enMsg[out.reason ?? ''] ?? 'Cannot connect those terminals',
      );
    }
    setPendingTerminal(null);
  };

  /**
   * 改接：把选中导线的一端（端点手柄）拖到别的接线柱上，`A—B` 变成 `A—C`。
   *
   * 规则全在 `replugWire` 里（自环整根撤掉 / 短接同一元件两端拒绝 / 重边合并只留一根），
   * 这里只负责把结果写进历史、把原因翻成当前语言。被合并或撤掉的导线已经不存在了，
   * 所以非 `moved` 的结果要顺手清掉选中，免得检查器继续显示一根幽灵导线。
   */
  const replug = (wireId: string, end: 'from' | 'to', target: string) => {
    const out = replugWire(benchRef.current, wireId, end, target);
    if (!out.changed) {
      const zhMsg: Record<string, string> = {
        导线不存在: '这条导线已经不存在了',
        端子不存在: '端子不存在',
        端子格式错误: '端子格式错误',
        不能短接同一个元件的两端: '不能短接同一个元件的两端',
      };
      const enMsg: Record<string, string> = {
        导线不存在: 'That wire no longer exists',
        端子不存在: 'That terminal no longer exists',
        端子格式错误: 'Malformed terminal reference',
        不能短接同一个元件的两端: 'Cannot short both ends of the same part',
      };
      setError(
        zh
          ? zhMsg[out.reason ?? ''] ?? '这一端接不过去'
          : enMsg[out.reason ?? ''] ?? 'Cannot re-plug this end there',
      );
      return;
    }
    setHistory((h) => commit(h, out.state));
    setError('');
    if (out.status !== 'moved') setSelectedWireId(null);
  };

  const onTerminal = (ref: string) => {
    if (!pendingTerminal) {
      setPendingTerminal(ref);
      return;
    }
    if (pendingTerminal === ref) {
      setPendingTerminal(null);
      return;
    }
    connect(pendingTerminal, ref);
  };

  /**
   * 在指定世界坐标建元件。落点已经吸附过网格，建出来的元件正好在
   * 幽灵预览停住的那一格，且立刻选中——拖进来就是为了接着调它。
   */
  const onAddAt = (kind: ElementKind, x: number, y: number) => {
    // addComponent 到顶后会静默返回原状态；这里必须自己拦下并说明原因，
    // 否则学生点了元件栏什么也不会发生。
    if (benchRef.current.components.length >= MAX_COMPONENTS) {
      setError(
        zh
          ? `元件数量已达上限（${MAX_COMPONENTS} 个），请先移除一些再添加`
          : `Part limit reached (${MAX_COMPONENTS}) — remove some parts first`,
      );
      return;
    }
    const next = addComponent(benchRef.current, kind, x, y);
    const created = next.components[next.components.length - 1];
    setHistory((h) => commit(h, next));
    setError('');
    setSelectedId(created && created.kind === kind ? created.id : null);
    setSelectedWireId(null);
  };

  /**
   * 元件坞单击添加：
   * - 落点取**当前视口可见中心**（不是写死的 360,200——平移/缩放之后那个点
   *   可能早就不在屏幕上，学生点了「加电阻」却看不到新元件）；
   * - 再交给 `findFreeSpot` 按本体尺寸螺旋找空位，连续添加不会叠在一起。
   */
  const onAdd = (kind: ElementKind) => {
    const center = canvasApi.current?.visibleCenter() ?? { x: 500, y: 310 };
    const p = snapDropPoint(center);
    const spot = findFreeSpot(benchRef.current.components, kind, p);
    onAddAt(kind, spot.x, spot.y);
  };

  /**
   * 从元件坞拖进画布的落点：屏幕坐标 → 世界坐标 → 吸附网格。
   * 换算全交给画布句柄（它知道 viewBox、缩放与平移），
   * 落点落在画布矩形外时句柄返回 null，这次拖拽就作废。
   */
  const onDropAt = (kind: ElementKind, clientX: number, clientY: number) => {
    const world = canvasApi.current?.clientToWorld(clientX, clientY);
    if (!world) return;
    const p = snapDropPoint(world);
    onAddAt(kind, p.x, p.y);
  };

  const paletteProjection: PaletteProjection = {
    toWorld: (clientX, clientY) => canvasApi.current?.clientToWorld(clientX, clientY) ?? null,
    toClient: (p) => canvasApi.current?.worldToClient(p) ?? null,
  };

  const onToggleSwitch = (id: string) => {
    setHistory((h) => commit(h, toggleSwitch(h.present, id)));
  };

  /**
   * 删除一只元件：历史、选中态、检查器、菜单一次收干净。
   * 键盘 Delete、右键 / 长按菜单、检查器垃圾桶都走这里，
   * 避免三条路径里有一条忘了清选中态（或忘了关面板）。
   */
  const deleteElement = (id: string) => {
    setHistory((h) => commit(h, removeComponent(h.present, id)));
    setSelectedId((cur) => (cur === id ? null : cur));
    setInspectorOpen(false);
    setMenu(null);
  };

  /** 删除一根导线；与 `deleteElement` 同一口径。 */
  const deleteWireById = (id: string) => {
    setHistory((h) => commit(h, removeWire(h.present, id)));
    setSelectedWireId((cur) => (cur === id ? null : cur));
    setMenu(null);
  };

  const onInspectorChange = (next: BenchState) => {
    setHistory((h) => commit(h, next));
  };

  const selectElement = (id: string | null) => {
    setSelectedId(id);
    if (id) setSelectedWireId(null);
  };

  const selectWire = (id: string | null) => {
    setSelectedWireId(id);
    if (id) setSelectedId(null);
  };

  /**
   * 双击元件：展开详细参数面板。
   *
   * 开关的「单击即拨动」已经下沉到画布（见 CircuitCanvas 的 pointerup）。
   * 双击的第一下同样是一次完整的单击，所以画布会在第二击命中时带上
   * `revertToggle`——这里把那一次拨动连同它的撤销点一起收回，再开面板。
   * 不用 `undo`：撤销会把「拨反后的状态」留在重做栈里，学生点重做就会
   * 把刚看过的开关又拨一次；双击从来不是一次编辑，栈里不该留痕。
   */
  const onElementDoubleTap = (id: string, opts?: { revertToggle?: boolean }) => {
    const el = benchRef.current.components.find((c) => c.id === id);
    if (!el) return;
    if (opts?.revertToggle) setHistory((h) => rollbackLast(h));
    setMenu(null);
    selectElement(id);
    closeOverlaysFor('inspector');
    setInspectorOpen(true);
    // 窄屏检查器是贴底抽屉：先把画布带上去，别让参数表把刚点的那只元件盖住。
    revealCanvasAboveSheet();
  };

  /* ── 熔毁元件：顶栏、状态看板顶部、画布徽章、右键菜单四处共用同一套复位动作 ── */

  /** 当前已熔毁（灯泡烧毁 / 保险丝熔断）的元件 id：一处判定，看板与顶栏计数同源。 */
  const faultyIds = useMemo(() => bench.components.filter((c) => isFaulty(c)).map((c) => c.id), [bench]);

  /**
   * 待确认的「带电更换」：`plan` 由 `deenergizePlan` 算好，`ids` 是这次真正要换的元件。
   *
   * 只在**换上去的新件会立刻带电**时才出现（判据见 circuit-bench-monitor）。
   * 学生按要求断好开关，再点一次就没有这一层了——提示不是常驻状态。
   */
  const [pendingRepair, setPendingRepair] = useState<{ ids: string[]; plan: DeenergizePlan } | null>(null);

  /**
   * 一次 commit 完成「断电 + 换新」：这样撤销一步就回到动手之前。
   *
   * 顺序不能反：先断开关再复位元件。反过来的话，中间那一瞬（同一个 commit 里其实
   * 不可观测，但读代码时容易照抄错误的写法）新灯泡会带着电挂上电源——正是要拦住的事。
   */
  const applyRepair = (ids: string[], openSwitchId: string | null) => {
    setHistory((h) => {
      let next = h.present;
      if (openSwitchId) next = setSwitchClosed(next, openSwitchId, false);
      for (const id of ids) next = resetElementState(next, id);
      return commit(h, next);
    });
    setError('');
    setPendingRepair(null);
  };

  /**
   * 更换元件的统一入口（顶栏一键修复 / 看板 / 画布徽章 / 右键 / 检查器五处共用）。
   *
   * 带电就拦一道，先问「实验要求先断开 S₁ 再更换」，确认后由 `applyRepair` 一次做完；
   * 不带电（开关已经断开、元件悬空）就直接换，不多一步点击——规范提示的意义在于
   * **该守的时候守**，处处弹窗只会让学生闭着眼点确定。
   */
  const requestRepair = (ids: string[]) => {
    const existing = ids.filter((id) => benchRef.current.components.some((c) => c.id === id));
    if (existing.length === 0) return;
    const plan = deenergizePlan({ state: benchRef.current, ids: existing, lang: zh ? 'zh' : 'en' });
    if (plan) {
      setPendingRepair({ ids: existing, plan });
      return;
    }
    applyRepair(existing, null);
  };

  /**
   * 就地换掉某一只元件（画布徽章「更换新元件」/ 看板行内按钮 / 右键「更换」/ 检查器按钮）。
   *
   * 走 core 的 `resetElementState`：它整只元件的物理态回初始态，于是 `resistanceOf`
   * 也把阻值原样复原成额定值——学生要的是「换了一只新的」，不是「把红标记擦掉」，
   * 一个温度停在 0 K 的灯泡会在下一帧仿真里立刻露馅。
   */
  const repairOne = (id: string) => {
    requestRepair([id]);
  };

  /**
   * 一键修复：把所有熔毁元件整体换新。
   *
   * 状态层在「没有坏元件」时返回原引用，`commit` 于是不留空撤销点。
   * 修完 `bench` 引用即变，`result` 那个 useMemo 会自动重解一次稳态
   * （热仿真也会把新灯泡从冷态重新开始加热）。
   *
   * 这一路同样过 `requestRepair`：只烧了一只、而且它还串在带电回路里的时候，
   * 「一键修复」与「更换这一只」该守的是同一条规矩，不该因为入口不同而少问一句。
   */
  const repairAll = () => {
    requestRepair(benchRef.current.components.filter((c) => isFaulty(c)).map((c) => c.id));
  };

  /**
   * 右键 / 长按菜单的动作派发。菜单只产出动作 id，所有状态改动都收在这里，
   * 于是「右键菜单里的每个动作都真的能用」可以逐条读代码核对。
   */
  const handleMenuAction = (action: MenuAction, target: MenuTarget) => {
    setMenu(null);
    const elId = target.kind === 'element' ? target.id : null;
    const wireId = target.kind === 'wire' ? target.id : null;

    switch (action) {
      case 'rotate-cw':
        if (elId) setHistory((h) => commit(h, rotateComponent(h.present, elId, 90)));
        return;
      case 'rotate-ccw':
        if (elId) setHistory((h) => commit(h, rotateComponent(h.present, elId, -90)));
        return;
      case 'swap-polarity':
        if (elId) setHistory((h) => commit(h, swapPolarity(h.present, elId)));
        return;
      case 'duplicate': {
        if (!elId) return;
        if (benchRef.current.components.length >= MAX_COMPONENTS) {
          setError(
            zh
              ? `元件数量已达上限（${MAX_COMPONENTS} 个），请先移除一些再添加`
              : `Part limit reached (${MAX_COMPONENTS}) — remove some parts first`,
          );
          return;
        }
        const base = benchRef.current.components.find((c) => c.id === elId);
        if (!base) return;
        // 副本默认落在原件右下方，但先用 findFreeSpot 避让：原件旁边已经站着
        // 别的元件时（桥式电路、串并联预设），固定 +60/+60 会叠出一个看不出来的副本。
        const spot = findFreeSpot(benchRef.current.components, base.kind, { x: base.x + 60, y: base.y + 60 }, base.rotation);
        const next = addComponent(
          benchRef.current,
          base.kind,
          spot.x,
          spot.y,
          base.params,
          base.rotation,
        );
        const copy = next.components[next.components.length - 1];
        setHistory((h) => commit(h, next));
        setError('');
        setSelectedId(copy && copy.id !== base.id ? copy.id : base.id);
        setSelectedWireId(null);
        return;
      }
      case 'inspect':
        if (elId) selectElement(elId);
        closeOverlaysFor('inspector');
        setInspectorOpen(true);
        revealCanvasAboveSheet();
        return;
      case 'delete':
        if (elId) deleteElement(elId);
        return;
      case 'toggle-switch':
        if (elId) setHistory((h) => commit(h, toggleSwitch(h.present, elId)));
        return;
      case 'repair':
        // 与看板/画布徽章同一入口：一处复位口径，不存在「菜单里换新了、徽章还红着」。
        if (elId) repairOne(elId);
        return;
      case 'delete-wire':
        if (wireId) deleteWireById(wireId);
        return;
      case 'fit':
        setFitSignal((n) => n + 1);
        return;
      case 'toggle-values':
        setShowValues((v) => !v);
        return;
      case 'clear':
        clearBench();
        return;
      default:
        return;
    }
  };

  /* ── AI 上下文：粗粒度 live 摘要 + 逐帧读数走易失注册表 ── */
  const battery = bench.components.find((c) => c.kind === 'battery');
  const mainSwitch = bench.components.find((c) => c.kind === 'switch');
  const batteryReading = battery ? result?.elements[battery.id] : undefined;
  const supplyI = batteryReading ? Math.abs(batteryReading.current) : 0;
  const supplyU = battery ? Number(battery.params.emf) || 0 : 0;
  const switchOn = mainSwitch ? mainSwitch.params.closed !== false : true;

  useEffect(() => {
    setLabState(LAB_ID, {
      presetZh: preset.title.zh,
      presetEn: preset.title.en,
      running,
      switchOn,
      i: Number.isFinite(supplyI) ? Number(supplyI.toFixed(4)) : 0,
      u: supplyU,
      p: result ? Number(result.totalPower.toFixed(4)) : 0,
      r: Number.isFinite(batteryReading?.resistance) ? Number(batteryReading?.resistance.toFixed(2)) : 0,
      wires: bench.wires.length,
    });
  }, [
    preset.title.zh,
    preset.title.en,
    running,
    switchOn,
    supplyI,
    supplyU,
    result,
    batteryReading?.resistance,
    bench.wires.length,
  ]);

  useEffect(() => {
    const name = zh ? preset.title.zh : preset.title.en;
    // 逐元件读数与告警摘要：AI 答疑 / 出题需要知道「哪块表接反了、哪个元件过载」，
    // 只给干路 U/I 会让它答不出学生真正问的那一句。
    const warnText = (result?.warnings ?? []).map((w) => (zh ? w.zh : w.en)).join(zh ? '；' : '; ');
    const sel = selectedId ? bench.components.find((c) => c.id === selectedId) : undefined;
    const selReading = sel ? result?.elements[sel.id] : undefined;
    // 元件名走统一的派生口（见 circuit-bench-naming）：不再出现 `l1` 这种内部 id，
    // 也不出现「无名元件」——没有标号的元件按种类自动起名，与画布、下拉一致。
    const selName = sel ? elementName(bench, sel, zh ? 'zh' : 'en') : '';
    const selText =
      sel && selReading
        ? zh
          ? `选中 ${selName}：I=${formatPhysicalValue(Math.abs(selReading.current), 'A')}，U=${formatPhysicalValue(Math.abs(selReading.voltage), 'V')}${readingReversed(sel.kind, selReading) ? '（表笔接反）' : ''}`
          : `selected ${selName}: I=${formatPhysicalValue(Math.abs(selReading.current), 'A')}, U=${formatPhysicalValue(Math.abs(selReading.voltage), 'V')}${readingReversed(sel.kind, selReading) ? ' (probes reversed)' : ''}`
        : '';
    const question = zh
      ? `我在电学工作台的「${name}」里读到：电源电压 ${formatPhysicalValue(supplyU, 'V')}、干路电流 ${formatPhysicalValue(supplyI, 'A')}${switchOn ? '' : '（开关断开）'}。这个读数说明电路在发生什么？`
      : `On the Circuit Workbench "${name}" I read ${formatPhysicalValue(supplyU, 'V')} across the supply and ${formatPhysicalValue(supplyI, 'A')} in the main branch${switchOn ? '' : ' (switch open)'}. What does this tell me about the circuit?`;
    setPageQuestion(LAB_ID, question);
    setAiCtx((prev) => ({
      ...prev,
      live: zh
        ? `【电学工作台】预设：${name}；仿真${running ? '运行中' : '已暂停'}；电源 ${formatPhysicalValue(supplyU, 'V')}，干路电流 ${formatPhysicalValue(supplyI, 'A')}，开关${switchOn ? '闭合' : '断开'}，${bench.components.length} 个元件、${bench.wires.length} 根导线。告警：${warnText || '无'}。${selText}`
        : `[Circuit Workbench] preset: ${name}; simulation ${running ? 'running' : 'paused'}; supply ${formatPhysicalValue(supplyU, 'V')}, main current ${formatPhysicalValue(supplyI, 'A')}, switch ${switchOn ? 'closed' : 'open'}, ${bench.components.length} parts and ${bench.wires.length} wires. Warnings: ${warnText || 'none'}. ${selText}`,
    }));
    return () => setAiCtx((prev) => ({ ...prev, live: undefined }));
  }, [
    presetId,
    running,
    supplyU,
    supplyI,
    switchOn,
    zh,
    setAiCtx,
    preset.title.zh,
    preset.title.en,
    bench.components.length,
    bench.wires.length,
    bench.components,
    result,
    selectedId,
  ]);

  /**
   * 追问胶囊 → AI 助手。胶囊里的题面只指向「看哪两个量、比什么」（见 circuit-bench-prompts），
   * 所以这里同时把**苏格拉底教学人设**注入系统提示词：不许直接报答案，先认可学生的思路，
   * 再用一两个关键物理量或生活类比把推导留给他自己。人设只改讲法，不越系统提示词第三节的禁令
   * （面板没有输入框，任何「追问」都必须写成引导学生自己想的话）。
   */
  const askInquiry = (question: string) => {
    setAiCtx((prev) => ({ ...prev, persona: socraticPersona(presetTitleOf(presetId, zh), zh) }));
    askAi(question);
  };

  /**
   * 人设随预设走：换预设（effect 重跑 → 清上一次的 cleanup）或离开本页（卸载）时撤掉，
   * 否则学生换了电路，AI 还在拿上一节课的立论追问；离开实验台后更不该把它带给别的页。
   */
  useEffect(
    () => () => setAiCtx((prev) => (prev.persona ? { ...prev, persona: undefined } : prev)),
    [presetId, setAiCtx],
  );

  const undoable = canUndo(history);
  const redoable = canRedo(history);

  /**
   * 空台面（画布上还没东西）：工具条与窄屏计数胶囊都不报「0 元件 · 0 导线」。
   * 那两个零不是信息，只是把「空」换一种写法；学生第一次进来需要的是下一步
   * 去哪拿元件。计数留到真有东西可数时再出现。
   */
  const benchEmpty = bench.components.length === 0 && bench.wires.length === 0;
  const counts = benchEmpty
    ? zh
      ? '空白画布 · 从元件库开始'
      : 'Blank canvas · start from the parts bin'
    : zh
      ? `${bench.components.length} 元件 · ${bench.wires.length} 导线${running ? '' : ' · 已暂停'}`
      : `${bench.components.length} parts · ${bench.wires.length} wires${running ? '' : ' · paused'}`;

  /** 右上角 HUD：没选中任何对象时是一条轻量统计胶囊，选中后才换成检查器。 */
  const hudCounts = benchEmpty
    ? zh
      ? '空白画布'
      : 'Blank canvas'
    : zh
      ? `${bench.components.length} 元件 · ${bench.wires.length} 导线`
      : `${bench.components.length} parts · ${bench.wires.length} wires`;
  /**
   * 右侧面板是否可见：
   * - 选中了元件/导线：由 `inspectorOpen` 决定（单击只选中，双击或右键菜单里的「详细参数…」才展开）
   * - 没选中：只要电路有全局告警，就一直挂着那张告警卡——短路/过载是整条电路的事，
   *   不该因为学生点开了别的元件就消失。
   */
  const hasSelection = !!(selectedId || selectedWireId);
  const showInspector = hasSelection ? inspectorOpen : (result?.warnings?.length ?? 0) > 0;

  /**
   * 底部是否被「贴底面板」占着：窄屏的四块抽屉，以及展开的元件库横向坞。
   * 数据记录胶囊与反馈 FAB 都固定在视口底，抽屉一开就被压在下面（审计 §2.5/§2.7：
   * 胶囊 ∩ 监控抽屉 5824px²、FAB ∩ 抽屉 2304px²）。两者在这一档统一让位。
   */
  const bottomDocked =
    narrow && (measureOpen || infoOpen || monitorOpen || showInspector || !paletteCollapsed);
  /**
   * 收起态的数据记录胶囊是否让位：别的底边面板摊开时它必然被盖住。
   * 展开态本身不算——那时它就是上面那块抽屉。
   */
  const measureCapsuleHidden =
    narrow && !measureOpen && (infoOpen || monitorOpen || showInspector || !paletteCollapsed);

  /**
   * 底部面板打开时给 `<html>` 挂标记：反馈 FAB 是全局组件（不在工作台子树里），
   * 只能靠这个标记让位（样式见 index.css 的 `html[data-bench-sheet] .feedback-fab`）。
   * 只在窄屏 + 面板真打开时挂，桌面与其他页面零影响。
   */
  useEffect(() => {
    const root = document.documentElement;
    if (bottomDocked) root.setAttribute('data-bench-sheet', '');
    else root.removeAttribute('data-bench-sheet');
    return () => root.removeAttribute('data-bench-sheet');
  }, [bottomDocked]);

  /** 最后一块底部面板关上时，回到打开前的位置（窄屏才做，桌面没有这条滚动路径）。 */
  const prevBottomDocked = useRef(false);
  useEffect(() => {
    if (prevBottomDocked.current && !bottomDocked && sheetScrollBeforeRef.current !== null) {
      const y = sheetScrollBeforeRef.current;
      sheetScrollBeforeRef.current = null;
      if (narrow && !fsActive) window.scrollTo({ top: y, behavior: 'smooth' });
    }
    prevBottomDocked.current = bottomDocked;
  }, [bottomDocked, narrow, fsActive]);

  /**
   * 贴底抽屉是否开着：窄屏的四块浮层都算；竖屏平板只有导读卡改成了抽屉
   * （其余浮层仍是浮卡，滚页面反而多余）。只用于「补滚动余量 / 全屏让出底边」。
   */
  const sheetOpen = narrow ? infoOpen || monitorOpen || showInspector || measureOpen : tabletSheet && infoOpen;

  /**
   * 抽屉打开时给页面补一段滚动余量（渲染在 shell 末尾的那块空白）。
   *
   * 病灶（审计 V2 实测）：竖屏文档只有 1015px 高，页面能滚到的极限让画布槽停在
   * 视口中部，55dvh 的导读抽屉再从底边盖上来——画布可点面积只剩 19.3%。抽屉高度
   * 是内容决定的（改小就读不了），能动的只有页面高度：抽屉开着时垫一块与它同高的
   * 空白，画布就能被滚到抽屉上方那条带子里。
   *
   * 必须放在 effect 里而不是点击回调里：余量是这次渲染才垫进 DOM 的，点击那一刻
   * 页面还没长高，`scrollTo` 会被 clamp 在旧上限（实测就卡在 348，抽屉照样压着画布）。
   */
  /**
   * 首帧跳过：即使某个抽屉因为「故障自动摊开」在挂载时就成立，那也不是学生
   * 刚刚点开的动作，不该把落地页直接滚走（审计 §2.1）。
   */
  const sheetRevealFirstRun = useRef(true);
  useEffect(() => {
    if (sheetRevealFirstRun.current) {
      sheetRevealFirstRun.current = false;
      return;
    }
    if (!sheetOpen || fsActive) return;
    revealCanvasAboveSheet(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, infoOpen, monitorOpen, showInspector, measureOpen, fsActive]);

  /**
   * 垫片晚一步再撤：抽屉关上的瞬间页面矮了 55dvh，浏览器立刻把 scrollY 从 375
   * clamp 到 93，而这次「空白轻点」的合成 click 恰好在这之后才派发——命中点
   * （390×844 实测 y=278）正好落进被滚上来的工具条，把仿真按成了暂停。
   * 因此垫片要留到「回滚动画停下来」，页面才不会在同一个手势里跳位；
   * 最多守 800ms，学生中途自己滚动也不会被一直占着空滚区。
   * 只在窄屏、且是「开着 → 关上」的那一次跳变才留，落地页不会多出空白。
   */
  const [spacerHold, setSpacerHold] = useState(false);
  const prevSheetOpen = useRef(sheetOpen);
  useEffect(() => {
    const was = prevSheetOpen.current;
    prevSheetOpen.current = sheetOpen;
    if (!was || sheetOpen || !narrow) return;
    setSpacerHold(true);
    let last = -1;
    let frames = 0;
    let raf = 0;
    const tick = () => {
      // 回滚是平滑动画：位置还在变就一直等；连续两帧不动（或超时）才撤垫片。
      if (window.scrollY === last || frames >= 48) {
        setSpacerHold(false);
        return;
      }
      last = window.scrollY;
      frames += 1;
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [sheetOpen, narrow]);

  /** 右键 / 长按菜单的内容：按打的是谁挑一套。 */
  const menuTarget: MenuTarget | null = menu ? menu.target : null;
  let menuItems: MenuItem[] = [];
  if (menuTarget?.kind === 'blank') {
    menuItems = blankMenuItems(showValues);
  } else if (menuTarget?.kind === 'wire') {
    menuItems = wireMenuItems();
  } else if (menuTarget) {
    const el = bench.components.find((c) => c.id === menuTarget.id);
    menuItems = el ? elementMenuItems(el) : [];
  }

  return (
    // 全屏时这一层就是 :fullscreen 根容器：必须自己铺主题底色，否则 gap 与
    // 无背景的行会漏出浏览器 ::backdrop 的纯黑（见 benchShellClass）。
    <div
      ref={shellRef}
      data-bench-shell=""
      // 贴底抽屉开着时挂个标记：全屏没有页面可滚，index.css 靠它让画布卡让出底边。
      data-sheet-open={sheetOpen ? '' : undefined}
      // 伪全屏（iOS）：没有 :fullscreen 宿主，只能自己 fixed 到视口并压住页面。
      data-pseudo-fullscreen={pseudoFullscreen ? '' : undefined}
      className={`${benchShellClass(fsActive)} ${
        pseudoFullscreen ? 'max-sm:fixed max-sm:inset-0 max-sm:z-[80] max-sm:bg-[var(--bg)]' : ''
      }`}
    >
      {/* 预设胶囊行：与画布卡同宽，右侧固定「实验导读」 */}
      <PresetPicker
        activeId={presetId}
        onPick={(id) => pickPreset(getPreset(id))}
        infoOpen={infoOpen}
        onToggleInfo={() => {
          const next = !infoOpen;
          // 窄屏单层约束：导读卡是「打开」动作，先替它收掉其余三块浮层。
          if (next) {
            closeOverlaysFor('briefing');
            // 竖屏平板上导读卡同样是贴底抽屉，放行这一手把画布带上来。
            revealCanvasAboveSheet(tabletSheet);
          }
          setInfoOpen(next);
        }}
        zh={zh}
      />

      {/* 实验导读：画布内可自由拖拽的浮卡，打开时自动把左侧元件坞收成小胶囊。
          它 portal 到工作台根节点（shellRef）而不是 body——全屏时这一层就是 :fullscreen
          宿主，挂到 body 的浮层会被浏览器连同一个 body 一起藏掉（页面上永远只有一个实例）。 */}
      <PresetBriefing
        preset={preset}
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        zh={zh}
        onAsk={askInquiry}
        mount={shellRef.current}
        // 全屏时工具栏被顶到视口顶部（实测 844×390 下 y≈59–103），卡片再按常态的
        // top:56 落位就会压住工具栏末尾的「退出全屏」——那不是模态框，不能吃工作台控件。
        // 56 = 工具栏 44 + 12 的呼吸位。
        // 只在浮卡真会撞上工具条的那几档下移：桌面 1440/1280 的工具条按钮止于 x≈760，
        // 而浮卡从右边缘起（1440 下 x≈1036），两者横向不相交——桌面全屏一个像素都不动
        // （实测「退出全屏」命中的是它自己的 span，改动前后一致）。
        topInset={fsActive && (narrow || shortViewport || tabletSheet) ? 56 : 0}
      />

      {/* 画布卡：工具栏是卡片标题栏；全屏时 flex-1 吃掉剩余高度，电路才铺得开。
          全屏 + 抽屉打开时让出 55dvh 的底边（手机这档走 `max-sm:`，平板那档在
          index.css 的同名媒体查询里）：画布槽跟着变矮，ResizeObserver 重新取景，
          电路整体落在抽屉上方——全屏没有页面可滚，这是唯一能让出位置的解法。 */}
      <div
        data-bench-canvas-card=""
        className={`${canvasCardClass(fsActive)} ${fsActive && sheetOpen ? 'max-sm:pb-[55dvh]' : ''}`}
      >
        <BenchToolbar
          tool={tool}
          onTool={(next) => {
            setTool(next);
            if (next === 'select') setPendingTerminal(null);
          }}
          viewMode={viewMode}
          onViewMode={setViewMode}
          running={running}
          onToggleRun={() => setRunning((v) => !v)}
          onUndo={() => setHistory((h) => undo(h))}
          onRedo={() => setHistory((h) => redo(h))}
          undoable={undoable}
          redoable={redoable}
          onClear={clearBench}
          onFit={() => setFitSignal((n) => n + 1)}
          onFullscreen={toggleFullscreen}
          fullscreen={fsActive}
          showValues={showValues}
          onToggleValues={() => setShowValues((v) => !v)}
          counts={counts}
          faults={faultyIds.length}
          onRepair={repairAll}
          zh={zh}
        />

        {/* 画布槽位：常态高度由 benchLayout 写死；全屏改由 flex 决定，内联高度必须撤掉。
            `data-bench-canvas-slot` 只给 index.css 的短横屏分支（max-height:520px）当锚点，
            用来给矮屏兜一个 220px 的高度下限；桌面与窄屏竖屏都不命中那段媒体查询。 */}
        <div
          ref={canvasRef}
          data-bench-canvas-slot=""
          className={canvasSlotClass(fsActive)}
          style={fsActive ? undefined : { height: layout.canvasH }}
        >
          <CircuitCanvas
            state={bench}
            result={result}
            selectedId={selectedId}
            selectedWireId={selectedWireId}
            tool={tool}
            pendingTerminal={pendingTerminal}
            showValues={showValues}
            viewMode={viewMode}
            sceneKey={`${presetId}:${dataEpoch}`}
            onSelect={(id) => {
              selectElement(id);
              // 选中别的元件时不再自动推开参数面板；但面板已经开着的话，
              // 让它平滑换到新元件上，而不是「点了没反应」。
              if (!id) {
                setInspectorOpen(false);
                // 窄屏空点 = 回到干净画布：上一版只关检查器，导读 / 元件库 /
                // 监控 / 数据记录纹丝不动（审计 §2.8，三张前后截图 md5 相同）。
                if (narrow) {
                  // 先立住垫片，再和下面的关门更新合并进同一次渲染：否则页面在
                  // 这次手势里先矮掉 55dvh，浏览器的合成 click 会落到被滚上来的
                  // 工具条上（390×844 实测把仿真按成了暂停）。
                  if (infoOpen || monitorOpen || showInspector || measureOpen) setSpacerHold(true);
                  setInfoOpen(false);
                  setPaletteCollapsed(true);
                  setMonitorOpen(false);
                  setMeasureOpen(false);
                }
              }
            }}
            onSelectWire={(id) => {
              selectWire(id);
              if (!id) setInspectorOpen(false);
            }}
            onMoveStart={onMoveStart}
            onMoveEnd={onMoveEnd}
            onMove={onMove}
            onTerminal={onTerminal}
            onToggleSwitch={onToggleSwitch}
            onConnect={connect}
            onReplug={replug}
            // 拖动滑片：起点已由 onMoveStart 打点，过程只覆盖 present，
            // 松手由 onMoveEnd 收尾——整段拖动只留一次撤销。
            onWiper={(id, ratio) => setHistory((h) => replace(h, updateParams(h.present, id, { ratio })))}
            onElementDoubleTap={onElementDoubleTap}
            onElementMenu={(id, x, y) => {
              selectElement(id);
              setMenu({ x, y, target: { kind: 'element', id } });
            }}
            onWireMenu={(id, x, y) => {
              selectWire(id);
              setMenu({ x, y, target: { kind: 'wire', id } });
            }}
            onBlankMenu={(x, y) => setMenu({ x, y, target: { kind: 'blank' } })}
            apiRef={canvasApi}
            fitSignal={fitSignal}
            // 数据记录下拉的悬停高亮：与画布自己的 hover 是两回事，一起 OR 进选中环。
            highlightId={probeHighlight}
            // 熔毁徽章就近点击 = 换新，不必先开参数面板再找那颗按钮。
            onRepairElement={repairOne}
          />

          {/* 右键 / 长按菜单：浮层挂在画布槽位里，坐标用视口像素，所以能贴到屏幕边上 */}
          {menu && menuItems.length > 0 && (
            <CanvasContextMenu
              x={menu.x}
              y={menu.y}
              items={menuItems}
              zh={zh}
              onPick={(action) => handleMenuAction(action, menu.target)}
              onClose={() => setMenu(null)}
            />
          )}

          {/* 左侧（控）：检查器与元件坞共用画布左内缘——左半边只谈「怎么调」。
              检查器停在 `left-4 top-14`：上边给元件坞胶囊留出一条，两者叠不到一起；
              未选中时这里是一条轻量统计胶囊（窄屏才有，xl 以上顶栏已经在报计数）。
              窄屏（`max-sm:`）换形态：256px 竖卡压在 325px 宽的画布上会吃掉七成可点面积，
              改成与导读卡/监控同一套贴底抽屉——画布留在抽屉上方，面板内部自己滚。 */}
          <div
            className={`pointer-events-none absolute left-4 top-14 z-20 flex max-h-[calc(100%-4.5rem)] flex-col items-start ${
              // 只有「检查器真的开着」才转抽屉：没选中元件时这里只是一条计数胶囊，
              // 也套 fixed 会把它拉成整宽横条，正压在元件库坞上。
              showInspector
                ? // 52dvh 而不是 45dvh：检查器两整组控件实测 326px 高，45dvh（375×667 下
                  // 300px）会裁掉最后 28px，第二组的增减按钮必须再滚一次才点得到（审计 §2.5/§2.6）。
                  // 52dvh ≈ 347px，两组一屏放得下；FAB 与胶囊此时已让位。
                  'max-sm:fixed max-sm:inset-x-2 max-sm:top-auto max-sm:bottom-2 max-sm:z-40 max-sm:max-h-[52dvh] max-sm:items-stretch max-sm:overflow-y-auto'
                : ''
            }`}
          >
            {showInspector ? (
              <InspectorPanel
                state={bench}
                result={result}
                selectedId={selectedId}
                selectedWireId={selectedWireId}
                onChange={onInspectorChange}
                onChangeLive={onInspectorChangeLive}
                onAdjustStart={onInspectorDragStart}
                onAdjustEnd={onInspectorDragEnd}
                onRepair={repairOne}
                onSelect={selectElement}
                onRemoveWire={(id) => {
                  setHistory((h) => commit(h, { ...h.present, wires: h.present.wires.filter((w) => w.id !== id) }));
                  selectWire(null);
                }}
                onClose={() => setInspectorOpen(false)}
              />
            ) : (
              <span className="pointer-events-auto whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--card-bg)]/85 px-2.5 py-1 text-[10px] leading-none text-[var(--muted)] shadow-sm backdrop-blur-md xl:hidden">
                {hudCounts}
              </span>
            )}
          </div>

          {/* 左侧元件坞：贴在画布左内缘。默认就是一枚 `[ + 元件库 ]` 胶囊，
              点开是竖排元件板（画布始终保持 100% 版心宽）。
              拖进画布即在该网格落点建元件并选中；只点击则自动铺到空位。
              缩略图跟着 viewMode 走：仿真图下显示的就是实物教具本身。
              左侧要让位给检查器/导读时由上层置 collapsed 收成胶囊（互斥见 paletteHidden）。 */}
          <div className="pointer-events-none absolute left-3 top-3 z-30 flex max-h-[calc(100%-1.5rem)] items-start">
            <ElementPalette
              onAdd={onAdd}
              onDropAt={onDropAt}
              projection={paletteProjection}
              zh={zh}
              viewMode={viewMode}
              used={bench.components.length}
              max={MAX_COMPONENTS}
              collapsed={paletteHidden}
              onCollapsedChange={onPaletteCollapsedChange}
            />
          </div>

          {/* 报错条顶部居中：画布右上角是元件状态 HUD 的地盘，接线错误提示横铺一条
              会叠在监控卡上，两条红字各说各话。 */}
          {error && (
            <div className="pointer-events-none absolute inset-x-2 top-2 z-40 mx-auto flex w-fit max-w-[80%] items-start gap-1.5 rounded-lg border border-[var(--danger)]/40 bg-[var(--card-bg)]/95 px-2 py-1.5 text-[10px] text-[var(--danger)] shadow-sm backdrop-blur-sm">
              <X className="mt-px h-3 w-3 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 右上（看）：元件状态 HUD 常驻右上角，左半边只控、右半边只看，两块浮板
              各占一边，互不遮挡。导读卡（fixed z-50）默认也停在右上角，它开着时 HUD
              自动挪到右下角，两块卡不会叠在同一角上。
              窄屏只有一列，右下角改成底部抽屉（max-sm:fixed），元件库展开时它让回
              右上角——底部横向坞是元件库的地盘。
              出现熔毁元件时 HUD 自己展开并亮出「一键修复」，折叠成药丸也不会漏掉故障。
              点某一行 = 选中画布上那只元件，与检查器同一套选中语义。
              空台面时它换成「放元件 → 接线 → 合闸」的三步引导，那枚「打开元件库」
              按钮走的就是元件坞自己的摊开动作（`onCollapsedChange(false)`）。 */}
          <CircuitMonitor
            state={bench}
            readings={result?.elements}
            shortCircuit={!!result?.warnings.some((w) => w.code === 'short-circuit')}
            selectedId={selectedId}
            corner={
              /*
               * 窄屏恒停右下：底部 30px 药丸整个落在画布槽位的信箱留白里
               * （375 下槽高 300、世界只画 201.5，留白 49.25），而读数胶囊
               * 贴着元件停在 y54–145 的「上带」。改前元件库一展开就把药丸
               * 挪到 top-14（slot 内 y56–86），正好压住 `2.96 V / 258 mA`
               * 一类读数——实测 852px²。展开元件库时页面已被
               * `revealCanvasAboveSheet` 顶到画布贴顶，底部坞不会盖住药丸。
               */
              narrow ? 'bottom-right' : infoOpen ? 'bottom-right' : 'top-right'
            }
            open={monitorOpen}
            onOpenChange={(v) => {
              // 故障自动摊开时也会走到这里：窄屏上它同样要独占屏幕。
              if (v) {
                closeOverlaysFor('monitor');
                revealCanvasAboveSheet();
              }
              setMonitorOpen(v);
            }}
            onSelect={(id) => {
              selectElement(id);
              if (!id) setInspectorOpen(false);
            }}
            onRepairAll={repairAll}
            onRepairElement={repairOne}
            onOpenPalette={() => onPaletteCollapsedChange(false)}
          />
        </div>
      </div>

      {/* 数据记录：常态在页面流里占一整块卡片；全屏改成浮层——收起时只剩左下角
          一枚胶囊，展开时是贴着底边的抽屉。外层容器一直在同一棵子树位置上，
          所以进出全屏、折叠展开都不会卸载面板、丢掉已记录的读数。 */}
      <div
        className={
          fsActive
            ? measureDrawerClass(measureOpen)
            : // 窄屏任何一块贴底面板展开时，胶囊都让位：元件库横坞、监控抽屉、
              // 导读抽屉、检查器都铺在视口底边，胶囊固定 bottom-2 必然被压住。
              // 收起对应面板它自动回来（状态没改，只是不渲染）。
              measureCapsuleHidden
              ? 'max-sm:hidden'
              : ''
        }
      >
        <MeasurementPanel
          state={bench}
          result={result}
          preset={preset}
          resetToken={dataEpoch}
          open={measureOpen}
          floating={fsActive}
          onToggle={() => {
            const next = !measureOpen;
            if (next) {
              closeOverlaysFor('measure');
              revealCanvasAboveSheet();
            }
            setMeasureOpen(next);
          }}
          onProbeHover={setProbeHighlight}
        />
      </div>
      {/* 更换元件前的断电确认：带电作业本来就不合规，先问一句再动手。
          挂在工作台根节点上（而不是画布槽位里）：全屏时这一层就是 :fullscreen 宿主，
          浮层跟着一起进全屏，也盖得住画布、工具栏与两块 HUD。 */}
      {pendingRepair && (
        <RepairConfirm
          plan={pendingRepair.plan}
          zh={zh}
          onConfirm={() => applyRepair(pendingRepair.ids, pendingRepair.plan.switchId)}
          onCancel={() => setPendingRepair(null)}
        />
      )}
      {/* 抽屉的滚动余量：抽屉开着时才垫，高度与最高的那块抽屉（导读 55dvh）齐平。
          关掉抽屉后窄屏再留到回滚动画停下（见 spacerHold），页面才回到原本的高度，
          不留一块永久空滚区。
          竖屏平板同垫：那边导读卡也是 55dvh 抽屉，而它一开就顺手收掉数据记录卡
          （见 closeOverlaysFor），页面反而变短——不垫这一块，画布根本滚不到抽屉上方。 */}
      {(sheetOpen || (narrow && spacerHold)) && !fsActive && (
        <div aria-hidden className="h-[55dvh] shrink-0" />
      )}
    </div>
  );
}
