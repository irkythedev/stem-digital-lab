/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 交互画布
 *
 * 桌面/移动共用一张 SVG：拖元件、点端子接线、双指缩放、滚轮缩放、空白拖动平移。
 * 防误触：元件拖动超过 6 个世界单位才移动；空白轻点才取消选中。
 *
 * 视觉分层：网格/导线在 SVG 世界坐标内，标签在 HTML 覆盖层里用 CSS 像素排版。
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { useApp } from '../../../lib/app-context';
import { parseTerminalRef, type BenchState, type SolveResult } from './circuit-bench-core';
import { FLOW_MIN_AMPS, computeWireFlows, flowDuration } from './circuit-bench-flow';
import { buildWireJunctions, buildWireJumps, buildWireRoutes } from './circuit-bench-render';
import type { CircuitViewMode } from './circuit-bench-view';
import CircuitLabels from './CircuitLabels';
import { CircuitSymbol } from './CircuitSymbols';
import { sleevePoints, strategyFor, wireColorAt, wireLabelAnchor } from './render';
import { fitCanvasBox } from './workbench-layout';
import {
  MAX_SCALE,
  MIN_SCALE,
  WORLD_H,
  WORLD_W,
  boxClearanceShift,
  contentBounds,
  fitView,
  fitViewToContent,
  localToWorldPoint,
  nearestTerminalRef,
  screenToWorld,
  snap,
  terminalPoint,
  wiperLocalX,
  wiperRatioAt,
  type Bounds,
  type Pt,
  type ViewTransform,
} from './circuit-bench-geometry';
import {
  LONG_PRESS_MS,
  TERMINAL_TAP_PX,
  TOUCH_GUARD,
  WIRE_MAGNET_PX,
  exceededDragThreshold,
  isDoubleTap,
  longPressDrifted,
  pxToWorld,
  terminalHitRadiusWorld,
  type PointerSample,
} from './circuit-bench-touch';

export type CanvasTool = 'select' | 'wire';

/**
 * 画布句柄：给「左侧元件坞 → 画布」的指针拖拽做屏幕 ↔ 世界坐标换算。
 *
 * 元件坞本身不知道画布怎么平移缩放的，只能把落点交给画布换算；
 * 反过来幽灵预览也要把「吸附到网格后的世界点」画回屏幕上的手指位置。
 * 拖到画布矩形外时 `clientToWorld` 返回 null = 这次拖拽取消。
 */
export interface CircuitCanvasHandle {
  clientToWorld(clientX: number, clientY: number): Pt | null;
  worldToClient(p: Pt): Pt | null;
  /** 内容适配到画布（右键菜单「适配画布居中」）。 */
  fit(): void;
}

export interface CircuitCanvasProps {
  state: BenchState;
  result: SolveResult | null;
  selectedId: string | null;
  /** 选中的导线（与元件二选一，检查器据此显示「移除导线」）。 */
  selectedWireId?: string | null;
  tool: CanvasTool;
  pendingTerminal: string | null;
  showValues: boolean;
  /** 电路图 / 仿真图；两者共用同一份端子坐标与导线拓扑。 */
  viewMode?: CircuitViewMode;
  /** 预设/清空时变化，触发一次内容适配；普通编辑不会重置视图。 */
  sceneKey?: string;
  onSelect: (id: string | null) => void;
  onSelectWire?: (id: string | null) => void;
  /** 真正越过防误触阈值、开始进入拖动时触发一次，用于打撤销点。 */
  onMoveStart?: () => void;
  onMove: (id: string, x: number, y: number) => void;
  onTerminal: (ref: string) => void;
  onToggleSwitch: (id: string) => void;
  /** 指针从起始接线柱拖到目标接线柱上松手：直接成线，不经过「待接端子」状态。 */
  onConnect?: (from: string, to: string) => void;
  /** 拖选中导线的端点手柄改接：把这一端从原柱子摘下来丢到目标柱子上（A—B → A—C）。 */
  onReplug?: (wireId: string, end: 'from' | 'to', target: string) => void;
  /** 拨动变阻器滑片（只有选中变阻器时才吃这个手势）。 */
  onWiper?: (id: string, ratio: number) => void;
  /** 指针双击元件（希沃红外屏也认）：开关直接换挡，其余打开详细参数面板。 */
  onElementDoubleTap?: (id: string) => void;
  /** 右键 / 长按 450ms 菜单；空白、元件、导线三套内容由上层按目标挑选。 */
  onElementMenu?: (id: string, clientX: number, clientY: number) => void;
  onWireMenu?: (id: string, clientX: number, clientY: number) => void;
  onBlankMenu?: (clientX: number, clientY: number) => void;
  /** 递增即把视图适配到当前电路内容（工具栏「适配」按钮）。 */
  fitSignal?: number;
  /**
   * 外部高亮的元件 id（数据记录面板悬停某个探针时传进来）。
   *
   * 与画布内部的指针悬停**并列**而不是覆盖：两者同时成立也不冲突，
   * 而且指针离开时各清各的——面板那一侧由下拉的关闭路径负责清。
   */
  highlightId?: string | null;
  /** 画布句柄出口：元件坞用它换算拖拽落点。 */
  apiRef?: { current: CircuitCanvasHandle | null };
  /** 画布内熔毁徽章被点击：由上层的「更换新元件」处理（就近修复，不必开面板）。 */
  onRepairElement?: (id: string) => void;
}

const DEFAULT_VIEW = fitView({ w: WORLD_W, h: WORLD_H });

/** 线号牌半径：直径 14 世界单位，约等于一根 2.5 单位粗的导线上的一个 1.5 字号牌。 */
const WIRE_LABEL_RADIUS = 7;

/**
 * 画布内图例胶囊的纵向落点与尺寸（**用户坐标**，即 viewBox 坐标；横向由内容宽度居中算）。
 *
 * 落点不是随手挑的右上角：右上角被监控看板的折叠药丸占着（常态 893..1004 × 56..86，
 * 全屏 958..1047 × 44..68），左上角被元件坞的折叠药丸占着（常态 −7..73 × 12..44）。
 * 预设集里所有元件的墨迹上界落在 user y≈62（默认适配实物模式按 80% 占比内切，
 * 上下各留出这条空白带），所以 **y 0..36 这条横带同时躲开了元件和两个浮层药丸**；
 * 横向取槽位居中，宽度 348~410 时落在 user x≈296..704，离两侧药丸都还有两百来单位。
 *
 * 注意这里量的是**槽位**而不是世界：图例挂在视图变换之外（见渲染处的长注释），
 * 世界坐标会随 `fitViewToContent` 平移，实测有两张预设把世界 y=5 顶出了画布。
 */
const LEGEND = { y: 5, h: 26, r: 13, padLeft: 14, pitch: 22 } as const;

/**
 * 右侧浮层（`CircuitMonitor`，256px 宽的半透明监控 HUD）预留的固定净空，世界单位。
 *
 * 两层防线的第一层，管的是「整幅图看上去偏右」：适配时先把整幅图左移半个预留量，
 * 让默认电路（串并联）那类贴右边缘的布局不至于顶着监控卡。140 世界单位在 1440×900
 * （槽位 1038px 宽、比例尺 1）下约合 70 CSS 像素。
 *
 * 真正「被浮窗压住」的墨迹由 `fitContent` 里的几何避让兜底（见那里的注释）：
 * 固定预留量看不出导线落在浮窗的哪一段高度上，窄支路和长支路的差别只能量出来。
 * 只平移不缩放：见 `fitViewToContent`。
 */
const HUD_RIGHT_INSET = 140;

/**
 * 监控 HUD 在画布槽位里的实际占位（CSS 像素），与 `CircuitMonitor` 的锚点一一对应：
 * `absolute top-14 right-4`、`w-64`（256px）。高度取实测最高形态：七只元件排到
 * 四行是 194px（六只元件三行 155px），再加上故障横幅那一行就是 222px——这里给到
 * 200 是「预设集里见得到的最高常态」，宁可把判定带画高一点（多推一点），也不要
 * 让卡片底缘那几像素里的墨迹漏过去。只用来把「浮窗盖住哪一块」折算回画布坐标，
 * 改锚点、改宽度或改每格高度时这里必须跟着改。
 */
const HUD_BOX_CSS = { width: 256, right: 16, top: 56, height: 200 };

/** 浮窗左缘与电路墨迹之间至少留出的空隙（CSS 像素）。 */
const HUD_CLEARANCE_CSS = 32;

interface PinchState {
  distance: number;
  midpoint: Pt;
  view: ViewTransform;
}

/** 长按 / 右键命中的对象：元件、导线，或空白画布。 */
/** 右键 / 长按菜单打的是谁：元件、导线，还是空白。 */
export type MenuTarget = { kind: 'element' | 'wire'; id: string } | { kind: 'blank' };

interface DragState {
  id: string;
  startPointer: Pt;
  startX: number;
  startY: number;
  moved: boolean;
  /** 拖的是变阻器滑片（只改 ratio），不是整只元件。 */
  wiper?: boolean;
}

export default function CircuitCanvas({
  state,
  result,
  selectedId,
  selectedWireId = null,
  tool,
  pendingTerminal,
  showValues,
  viewMode = 'schematic',
  sceneKey,
  onSelect,
  onSelectWire,
  onMoveStart,
  onMove,
  onTerminal,
  onToggleSwitch,
  onConnect,
  onReplug,
  onWiper,
  onElementDoubleTap,
  onElementMenu,
  onWireMenu,
  onBlankMenu,
  fitSignal,
  highlightId = null,
  apiRef,
  onRepairElement,
}: CircuitCanvasProps) {
  const { lang } = useApp();
  const zh = lang === 'zh';
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<ViewTransform>(DEFAULT_VIEW);
  // 画布盒子按世界比例在可用区域内等比内切（可能是高度受限）。
  // 标签层是 CSS 像素绝对定位，必须拿这块真实尺寸，不能再由宽度推算高度。
  const [canvasBox, setCanvasBox] = useState<{ w: number; h: number; x: number; y: number }>({ w: 0, h: 0, x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const stateRef = useRef(state);
  stateRef.current = state;

  const pointers = useRef(new Map<number, Pt>());
  const drag = useRef<DragState | null>(null);
  const pan = useRef<{ start: Pt; tx: number; ty: number; moved: boolean } | null>(null);
  const pinch = useRef<PinchState | null>(null);
  /** canvasBox 的最新值：指针回调里要判「落点是否落在画布矩形内」。 */
  const boxRef = useRef(canvasBox);
  boxRef.current = canvasBox;

  /* ── 触控手势（希沃红外屏不认原生 dblclick，全部自己判） ── */
  /** 上一次 pointerdown 落在哪个元件上，用来识别双击。 */
  const lastTap = useRef<{ id: string; sample: PointerSample } | null>(null);
  /** 长按定时器：按住 450ms 且漂移 <8px 就弹菜单。`start` 与 pointermove 同一时间轴。 */
  const longPress = useRef<{ timer: number; target: MenuTarget; start: PointerSample } | null>(null);
  /** 从接线柱拉出的连线手势（虚线皮筋 + 20px 磁吸）。 */
  const wireDrag = useRef<{
    from: string;
    pointerId: number;
    start: PointerSample;
    active: boolean;
    /** 磁吸命中的目标接线柱（`id:a`）；松手时用它成线。 */
    target: string | null;
  } | null>(null);
  /** 皮筋预览：`ref` 是被按住的那根柱子（按下去就亮，不必等拉出阈值）。 */
  const [wirePreview, setWirePreview] = useState<{ ref: string; from: Pt; to: Pt; target: string | null } | null>(null);
  /**
   * 导线端点手柄的拔插手势：另一端（`fixed`）钉在端子上不动，
   * 抓住的这一端跟着手指走，松手落到哪根柱子就改接成哪根。
   */
  const replug = useRef<{
    wireId: string;
    end: 'from' | 'to';
    fixedRef: string;
    fixed: Pt;
    pointerId: number;
    start: PointerSample;
    active: boolean;
    target: string | null;
  } | null>(null);

  const routes = useMemo(() => buildWireRoutes(state), [state]);
  const junctions = useMemo(() => buildWireJunctions(state), [state]);
  // 复用上面这份 routes：跳线只用折点，重算一遍等于每次 state 变化付两遍全量路由。
  const jumps = useMemo(() => buildWireJumps(state, routes), [state, routes]);
  const routeIndex = useMemo(() => {
    const map = new Map<string, number>();
    routes.forEach((r, i) => map.set(r.wire.id, i));
    return map;
  }, [routes]);
  // 同一份 routes 也喂给取景：`contentBounds` / `boxClearanceShift` 拿它当墨迹，
  // 走 ref 是为了让 `fitContent` 的身份不随每一次 state 变化而变。
  const routesRef = useRef(routes);
  routesRef.current = routes;

  /** 每个端子接了几根线：≥2 时仿真图要画叠插插头（BV/并联引线同柱并接）。 */
  const wireCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of state.wires) {
      counts[w.from] = (counts[w.from] ?? 0) + 1;
      counts[w.to] = (counts[w.to] ?? 0) + 1;
    }
    return counts;
  }, [state.wires]);
  /** 同柱并接时插头要按各自导线皮色上色：顺序与 lessons 里导线编号一致。 */
  const wireColors = useMemo(() => {
    const colors: Record<string, string[]> = {};
    routes.forEach((route, index) => {
      const color = wireColorAt(index);
      for (const ref of [route.wire.from, route.wire.to]) {
        (colors[ref] ??= []).push(color);
      }
    });
    return colors;
  }, [routes]);
  const strategy = strategyFor(viewMode);

  /**
   * 每条导线的电流（带符号）。推导（`currentAB` 统一符号 / 串联端优先 / 死支路不画）
   * 全在 `circuit-bench-flow.ts` 里，测试跑的是同一份实现，不靠源码字符串猜行为。
   * 复用上一行的 `routes`：满负载时 `buildWireRoutes` 单次 ~90 ms，重复算就是白花帧时间。
   */
  const flows = useMemo(() => computeWireFlows(state, result, routes), [state, result, routes]);

  // 视图变换用的是 SVG 用户坐标（viewBox 0 0 1000 620），与 CSS 像素无关：
  // 画布盒子按世界比例等比内切，所以「可用画布」永远是 WORLD_W × WORLD_H。
  // 实物模式按 80% 视觉占比适配（落在 75%–85% 的目标区间），
  // 元件放大后台面更饱满，不会仍像一张缩在角落的小图。
  const fitContent = useCallback(() => {
    const fill = viewMode === 'physical' ? 0.8 : 0;
    const current = stateRef.current;
    const next = fitViewToContent(
      contentBounds(current, routesRef.current),
      { w: WORLD_W, h: WORLD_H },
      110,
      fill,
      HUD_RIGHT_INSET,
    );
    /*
     * 固定预留量管的是「整幅图看起来偏左」；真的被浮窗压住的墨迹还得按几何推开，
     * 否则像「短路与保险丝」那种右端长支路，导线照样从监控卡底下穿过去。
     *
     * 换算要用画布槽位的真实映射：SVG 的 viewBox 恒为 WORLD_W × WORLD_H，
     * `preserveAspectRatio` 取默认值，于是「1 画布单位 = k 个 CSS 像素，
     * k = min(槽宽 / WORLD_W, 槽高 / WORLD_H)」，并且宽向会留出 `insetX` 的居中留白
     * （1440 宽下是 19px）——光拿槽宽除 WORLD_W 是量不准的，会差出小半个身位。
     *
     * 直接量 SVG 自己的矩形、而不是读 `canvasBox` 状态：首次 `fitContent` 跑在
     * ResizeObserver 之前，那时 `canvasBox` 还是全零，避让会静默失效。
     * 同理不能把尺寸挂进依赖数组：尺寸一变就重算视图，等于抹掉手动平移/缩放。
     *
     * 推到「最靠右的墨迹离浮窗左缘 clearance」为止，于是电路最终停在
     * 「浮窗左边那块可见区域」的中间：默认电路左 29 / 右 713（世界坐标），
     * 两侧各留三十来像素，正好把浮窗让出来的空当用满。
     */
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      setView(next);
      return;
    }
    const k = Math.min(rect.width / WORLD_W, rect.height / WORLD_H);
    if (!(k > 0)) {
      setView(next);
      return;
    }
    const insetX = (rect.width - WORLD_W * k) / 2;
    const insetY = (rect.height - WORLD_H * k) / 2;
    const hud: Bounds = {
      x: (rect.width - HUD_BOX_CSS.right - HUD_BOX_CSS.width - insetX) / k,
      y: (HUD_BOX_CSS.top - insetY) / k,
      w: HUD_BOX_CSS.width / k,
      h: HUD_BOX_CSS.height / k,
    };
    const shift = boxClearanceShift(current, next, hud, HUD_CLEARANCE_CSS / k, routesRef.current);
    setView(shift > 0 ? { ...next, tx: next.tx - shift } : next);
  }, [viewMode]);

  /* 切换电路图 / 仿真图时，视图变换用 320ms 过渡滑过去，而不是瞬移。 */
  const [viewAnimating, setViewAnimating] = useState(false);
  const animTimer = useRef<number | null>(null);
  useEffect(() => {
    setViewAnimating(true);
    if (animTimer.current) window.clearTimeout(animTimer.current);
    animTimer.current = window.setTimeout(() => setViewAnimating(false), 380);
    return () => {
      if (animTimer.current) window.clearTimeout(animTimer.current);
    };
  }, [viewMode]);

  useEffect(() => {
    fitContent();
  }, [sceneKey, fitSignal, viewMode, fitContent]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = (w: number, h: number) => {
      const box = fitCanvasBox(w, h);
      setCanvasBox((prev) =>
        Math.abs(prev.w - box.w) < 0.5 && Math.abs(prev.h - box.h) < 0.5 && Math.abs(prev.x - box.x) < 0.5 && Math.abs(prev.y - box.y) < 0.5
          ? prev
          : box,
      );
    };
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      apply(rect.width, rect.height);
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    apply(rect.width, rect.height);
    return () => ro.disconnect();
  }, [fitContent]);

  const canvasWidth = canvasBox.w;

  const pxPerWorld = canvasWidth > 0 ? (canvasWidth / WORLD_W) * view.scale : 1;
  // 希沃大屏上手指目标要 ≥22px：世界半径按当前倍率反算，再由
  // `terminalHitRadiusFor` 封顶，屏幕空间那一道由 nearestTerminalRef 补齐。
  const terminalHitRadius = terminalHitRadiusWorld(pxPerWorld);
  const junctionRadius = Math.min(6.5, Math.max(2.8, 3.5 / Math.max(0.001, pxPerWorld)));
  // 端点手柄：可见尺寸在屏幕上恒定（缩到最小也抓得住），命中圈再按 22px 触控标准放大。
  const handleRadius = Math.min(11, Math.max(4, 6.5 / Math.max(0.001, pxPerWorld)));
  const handleHitRadius = Math.max(handleRadius + 1.5, pxToWorld(TERMINAL_TAP_PX, pxPerWorld));

  const userPoint = useCallback((clientX: number, clientY: number): Pt | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = svg.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const local = p.matrixTransform(ctm.inverse());
    // SVG 用户坐标即画布 viewBox 坐标；再经过视图变换得到世界坐标。
    return screenToWorld({ x: local.x, y: local.y }, viewRef.current);
  }, []);

  const viewPoint = useCallback((clientX: number, clientY: number): Pt | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = svg.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const local = p.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }, []);

  /* ── 画布句柄：左侧元件坞靠它把「手指落点」换算成世界坐标 ── */
  /** 落点是否在画布矩形内（世界矩形在容器里的真实落点，不是整个容器）。 */
  const insideCanvas = useCallback((clientX: number, clientY: number): boolean => {
    const wrap = wrapRef.current;
    if (!wrap) return false;
    const r = wrap.getBoundingClientRect();
    const box = boxRef.current;
    const lx = clientX - r.left;
    const ly = clientY - r.top;
    return lx >= box.x && lx <= box.x + box.w && ly >= box.y && ly <= box.y + box.h;
  }, []);

  const toScreen = useCallback((p: Pt): Pt | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const v = viewRef.current;
    const point = svg.createSVGPoint();
    point.x = p.x * v.scale + v.tx;
    point.y = p.y * v.scale + v.ty;
    const out = point.matrixTransform(ctm);
    return { x: out.x, y: out.y };
  }, []);

  const api = useMemo<CircuitCanvasHandle>(
    () => ({
      // 拖到画布外松手 = 取消本次添加，所以不在矩形内就返回 null。
      clientToWorld: (clientX, clientY) => (insideCanvas(clientX, clientY) ? userPoint(clientX, clientY) : null),
      worldToClient: toScreen,
      fit: () => fitContent(),
    }),
    [fitContent, insideCanvas, toScreen, userPoint],
  );

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = api;
    return () => {
      apiRef.current = null;
    };
  }, [api, apiRef]);

  /* ── 长按（触屏右键）：按住 450ms 不动弹菜单 ── */
  const cancelLongPress = useCallback(() => {
    const lp = longPress.current;
    if (!lp) return;
    window.clearTimeout(lp.timer);
    longPress.current = null;
  }, []);

  const fireMenu = useCallback(
    (target: MenuTarget, clientX: number, clientY: number) => {
      if (target.kind === 'element') onElementMenu?.(target.id, clientX, clientY);
      else if (target.kind === 'wire') onWireMenu?.(target.id, clientX, clientY);
      else onBlankMenu?.(clientX, clientY);
    },
    [onBlankMenu, onElementMenu, onWireMenu],
  );

  const armLongPress = useCallback(
    (target: MenuTarget, sample: PointerSample) => {
      cancelLongPress();
      longPress.current = {
        timer: window.setTimeout(() => {
          longPress.current = null;
          // 已经变成菜单了，这一次按下的拖动/平移语义作废
          drag.current = null;
          pan.current = null;
          fireMenu(target, sample.x, sample.y);
        }, LONG_PRESS_MS),
        target,
        start: sample,
      };
    },
    [cancelLongPress, fireMenu],
  );

  // 卸载时收掉未触发的定时器，避免对着已卸载组件弹菜单。
  useEffect(() => {
    return () => {
      cancelLongPress();
    };
  }, [cancelLongPress]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = viewPoint(e.clientX, e.clientY);
      if (!p) return;
      setView((v) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
        if (next === v.scale) return v;
        const world = screenToWorld(p, v);
        return { scale: next, tx: p.x - world.x * next, ty: p.y - world.y * next };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [viewPoint]);

  const endGesture = useCallback(() => {
    if (pointers.current.size === 0) {
      drag.current = null;
      pan.current = null;
      pinch.current = null;
    }
  }, []);

  /**
   * 从某个接线柱起手拉线：记下手势起点，并立刻点亮源柱。
   * 画出来的那个圈半径受「同一元件两端不能连成一片」限制（`terminalHitRadiusFor`
   * 封到 half×0.9），标准元件算下来只有 ~20px，够不上希沃要求的 22px。
   * 所以画布层还要再补一道屏幕空间的判定（见 onSvgPointerDown），
   * 两条路径共用这个起手函数，行为完全一致。
   */
  const startWireDrag = useCallback((ref: string, e: { pointerId: number; timeStamp: number; clientX: number; clientY: number }) => {
    wireDrag.current = {
      from: ref,
      pointerId: e.pointerId,
      start: { t: e.timeStamp, x: e.clientX, y: e.clientY },
      active: false,
      target: null,
    };
    // 按下就点亮源柱：用户看得见「这根柱子被抓住了」，也才敢往外拖。
    const parsed = parseTerminalRef(ref);
    const own = parsed ? stateRef.current.components.find((c) => c.id === parsed.id) : undefined;
    if (parsed && own) {
      const anchor = terminalPoint(own, parsed.terminal);
      setWirePreview({ ref, from: anchor, to: anchor, target: null });
    }
  }, []);

  /**
   * 抓住选中导线的端点手柄：另一端钉住不动，这一端跟着指针走。
   * 皮筋从固定端拉向手指，与「从接线柱拉新线」共用同一套视觉语言。
   */
  const startReplug = useCallback(
    (
      wireId: string,
      end: 'from' | 'to',
      anchor: Pt,
      fixedRef: string,
      e: { pointerId: number; timeStamp: number; clientX: number; clientY: number },
    ) => {
      replug.current = {
        wireId,
        end,
        fixedRef,
        fixed: anchor,
        pointerId: e.pointerId,
        start: { t: e.timeStamp, x: e.clientX, y: e.clientY },
        active: false,
        target: null,
      };
      setWirePreview({ ref: fixedRef, from: anchor, to: anchor, target: null });
    },
    [],
  );

  const onSvgPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        view: viewRef.current,
      };
      drag.current = null;
      pan.current = null;
      return;
    }
    if (pointers.current.size === 1) {
      const p = viewPoint(e.clientX, e.clientY);
      if (!p) return;
      // 空白处按下，但落在某个接线柱 22px 屏幕热区内：也算抓住了那根柱子。
      // 画出来的圈子半径为了不互相吞并被封顶，够不到 22px，这里补齐。
      const world = userPoint(e.clientX, e.clientY);
      const near = world
        ? nearestTerminalRef(stateRef.current.components, world, pxToWorld(TERMINAL_TAP_PX, pxPerWorld))
        : null;
      if (near) {
        cancelLongPress();
        startWireDrag(near.ref, e);
        svgRef.current?.setPointerCapture?.(e.pointerId);
        return;
      }
      pan.current = { start: p, tx: viewRef.current.tx, ty: viewRef.current.ty, moved: false };
      svgRef.current?.setPointerCapture?.(e.pointerId);
      // 触屏：空白处长按 450ms 就是右键菜单（适配 / 读数开关 / 清空）。
      // 鼠标不参与——桌面端的右键由 onContextMenu 负责，鼠标长按反而会误弹。
      if (e.pointerType !== 'mouse') {
        armLongPress({ kind: 'blank' }, { t: e.timeStamp, x: e.clientX, y: e.clientY });
      }
    }
  };

  const onSvgPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const now = { t: e.timeStamp, x: e.clientX, y: e.clientY };

    // 长按期间飘出容差 = 手指在拖，不是在按，定时器立刻收掉。
    const lp = longPress.current;
    if (lp && longPressDrifted(lp.start, now)) cancelLongPress();

    // 接线柱拉出的连线：拉出虚线皮筋，指针进入目标接线柱 20px 磁吸圈就高亮它。
    // 这条手势不占用 pointers 表（它从接线柱上按下去，压根不是平移/拖元件）。
    const wd = wireDrag.current;
    if (wd && wd.pointerId === e.pointerId) {
      if (!wd.active && !exceededDragThreshold(wd.start, now)) return;
      wd.active = true;
      const world = userPoint(e.clientX, e.clientY);
      if (!world) return;
      const src = parseTerminalRef(wd.from);
      const srcEl = src ? stateRef.current.components.find((c) => c.id === src.id) : undefined;
      const from = src && srcEl ? terminalPoint(srcEl, src.terminal) : world;
      const hit = nearestTerminalRef(
        stateRef.current.components,
        world,
        pxToWorld(WIRE_MAGNET_PX, pxPerWorld),
        wd.from,
      );
      wd.target = hit?.ref ?? null;
      setWirePreview({ ref: wd.from, from, to: hit?.point ?? world, target: wd.target });
      return;
    }

    // 拖导线端点手柄：另一端钉着不动，皮筋从固定端拉向指针，进入磁吸圈就高亮目标柱。
    const rp = replug.current;
    if (rp && rp.pointerId === e.pointerId) {
      if (!rp.active && !exceededDragThreshold(rp.start, now)) return;
      rp.active = true;
      const world = userPoint(e.clientX, e.clientY);
      if (!world) return;
      const hit = nearestTerminalRef(
        stateRef.current.components,
        world,
        pxToWorld(WIRE_MAGNET_PX, pxPerWorld),
        rp.fixedRef,
      );
      rp.target = hit?.ref ?? null;
      setWirePreview({ ref: rp.fixedRef, from: rp.fixed, to: hit?.point ?? world, target: rp.target });
      return;
    }

    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const base = pinch.current;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, base.view.scale * (dist / base.distance)));
      const anchor = viewPoint(base.midpoint.x, base.midpoint.y);
      if (!anchor) return;
      const world = screenToWorld(anchor, base.view);
      const offset = viewPoint(mid.x, mid.y);
      if (!offset) return;
      setView({ scale, tx: offset.x - world.x * scale, ty: offset.y - world.y * scale });
      return;
    }

    const d = drag.current;
    if (d) {
      const p = userPoint(e.clientX, e.clientY);
      if (!p) return;
      if (d.wiper) {
        // 拨滑片：手指在世界坐标里的投影就是滑片位置，元件本身一步都不动。
        const el = stateRef.current.components.find((c) => c.id === d.id);
        if (el) onWiper?.(d.id, wiperRatioAt(el, p, viewMode));
        return;
      }
      const dx = p.x - d.startPointer.x;
      const dy = p.y - d.startPointer.y;
      if (!d.moved && Math.hypot(dx, dy) < 6) return;
      if (!d.moved) onMoveStart?.();
      d.moved = true;
      onMove(d.id, snap(d.startX + dx), snap(d.startY + dy));
      return;
    }

    const p = pan.current;
    if (p) {
      const q = viewPoint(e.clientX, e.clientY);
      if (!q) return;
      const dx = q.x - p.start.x;
      const dy = q.y - p.start.y;
      if (!p.moved && Math.hypot(dx, dy) < 3) return;
      p.moved = true;
      setView((v) => ({ ...v, tx: p.tx + dx, ty: p.ty + dy }));
    }
  };

  const onSvgPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    cancelLongPress();
    const wasTap = !drag.current && (!pan.current || !pan.current.moved) && pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (svgRef.current?.hasPointerCapture?.(e.pointerId)) {
      svgRef.current.releasePointerCapture(e.pointerId);
    }
    if (pointers.current.size < 2) pinch.current = null;
    if (drag.current) drag.current = null;
    if (pan.current) pan.current = null;

    // 从接线柱拉出的连线：吸到目标接线柱就成线（一次手势接完一根）；
    // 只是轻点没拉动，则按老逻辑走「点第一个 → 点第二个」的待接状态。
    const wd = wireDrag.current;
    if (wd && wd.pointerId === e.pointerId) {
      wireDrag.current = null;
      setWirePreview(null);
      if (wd.active) {
        if (wd.target) onConnect?.(wd.from, wd.target);
      } else if (tool === 'wire') {
        onTerminal(wd.from);
      }
      endGesture();
      return;
    }

    // 端点改接：只有真的拖到别的柱子上才动网表；原地松手 = 取消（不改也不删）。
    const rp = replug.current;
    if (rp && rp.pointerId === e.pointerId) {
      replug.current = null;
      setWirePreview(null);
      if (rp.active && rp.target) onReplug?.(rp.wireId, rp.end, rp.target);
      endGesture();
      return;
    }

    if (wasTap && tool === 'select') {
      onSelect(null);
      onSelectWire?.(null);
    }
    endGesture();
  };

  const onComponentDown = (e: ReactPointerEvent<SVGGElement>, id: string) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    const el = state.components.find((c) => c.id === id);
    const p = userPoint(e.clientX, e.clientY);
    if (!el || !p) return;
    const sample: PointerSample = { t: e.timeStamp, x: e.clientX, y: e.clientY };

    // 双击：希沃红外屏快速双击时第二下会偏 5–18px，原生 dblclick 根本不触发，
    // 所以这里用「两次 pointerdown 间隔 <350ms 且落点 <24px」自己判。
    const prev = lastTap.current;
    const doubleTap = prev?.id === id && isDoubleTap(prev.sample, sample);
    lastTap.current = doubleTap ? null : { id, sample };

    onSelect(id);
    if (doubleTap) {
      cancelLongPress();
      onElementDoubleTap?.(id);
      return;
    }
    if (tool === 'wire') return;
    if (e.pointerType !== 'mouse') armLongPress({ kind: 'element', id }, sample);

    // 变阻器滑片：只有元件已选中时才吃这个手势，否则靠近导轨按住拖动仍是移动整只元件。
    if (el.kind === 'rheostat' && selectedId === id && onWiper) {
      const head = localToWorldPoint(el, { x: wiperLocalX(el.params.ratio, viewMode), y: -16 });
      const grab = Math.max(14, pxToWorld(20, pxPerWorld));
      if (Math.hypot(head.x - p.x, head.y - p.y) <= grab) {
        onMoveStart?.();
        drag.current = { id, startPointer: p, startX: el.x, startY: el.y, moved: true, wiper: true };
        svgRef.current?.setPointerCapture?.(e.pointerId);
        return;
      }
    }

    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag.current = {
      id,
      startPointer: p,
      startX: el.x,
      startY: el.y,
      moved: false,
    };
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onTerminalDown = (e: ReactPointerEvent<SVGCircleElement>, ref: string) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    cancelLongPress();
    // 按下去先记下起点，拉出阈值才算「拖拽连线」；没拉动就还是轻点。
    startWireDrag(ref, e);
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  /**
   * 桌面端右键：由容器统一接管（元件 / 导线 / 空白三选一）。
   * 触屏的长按 450ms 走 armLongPress，两条路最后都汇到 fireMenu。
   * 判断目标用事件目标往上找 `data-*`：比再跑一次命中测试更贴近视觉层，
   * 点在哪条线上就是哪条线，不会被叠在上面的透明命中区抢走。
   */
  const onContainerContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const t = e.target as Element | null;
    const elId = t?.closest?.('[data-component-id]')?.getAttribute('data-component-id') ?? null;
    const wireId = t?.closest?.('[data-wire-id]')?.getAttribute('data-wire-id') ?? null;
    if (elId) {
      onSelect(elId);
      fireMenu({ kind: 'element', id: elId }, e.clientX, e.clientY);
    } else if (wireId) {
      onSelectWire?.(wireId);
      fireMenu({ kind: 'wire', id: wireId }, e.clientX, e.clientY);
    } else {
      fireMenu({ kind: 'blank' }, e.clientX, e.clientY);
    }
  };

  /** 待接端子与新连线拖拽的起点：两者都要在图上把那个柱子画成「已选中」。 */
  const armedRef = wirePreview?.ref ?? pendingTerminal;
  const armedParsed = armedRef ? parseTerminalRef(armedRef) : null;

  // 画布铺满整个槽位：SVG 用 viewBox + 默认 meet 等比内切，点阵网格画在一张
  // 远大于世界的背景矩形上，因此容器左右不会再出现空白条。
  // 注意不要再给内容层套 clipPath：viewBox 只有 1000×620，而视图变换会把世界
  // 坐标放大平移，右侧预设（x≈720 的回程竖边）会被那条用户坐标裁剪直接切掉。
  // 需要裁剪的部分由外层容器的 overflow-hidden + 圆角完成。
  // 标签层是 CSS 像素绝对定位，需要对齐「世界矩形」在容器内的真实落点，
  // 所以仍要算一次 fitCanvasBox 得到 { x, y, w, h }。
  return (
    <div
      ref={wrapRef}
      className={`relative h-full min-h-0 w-full overflow-hidden bg-[var(--card-bg)] ${TOUCH_GUARD}`}
      onContextMenu={onContainerContextMenu}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 block h-full w-full touch-none select-none"
        role="application"
        aria-label={zh ? '电学工作台画布' : 'Circuit workbench canvas'}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
        onPointerCancel={onSvgPointerUp}
        onPointerLeave={(e) => {
          if (e.buttons === 0) onSvgPointerUp(e);
        }}
      >
        <defs>
          <pattern id="cb-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.85" fill="var(--border)" opacity="0.6" />
          </pattern>
        </defs>

        {/* 全幅点阵：不受世界矩形裁剪，随视图平移缩放，覆盖整个容器 */}
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`} aria-hidden>
          <rect
            x={-WORLD_W * 8}
            y={-WORLD_H * 8}
            width={WORLD_W * 17}
            height={WORLD_H * 17}
            fill="url(#cb-grid)"
          />
        </g>

        <g
          /* 变换走 CSS style 而不是 transform 属性：属性变化不会触发 CSS 过渡，
             改用 style 后切换电路图 / 仿真图时视口能平滑滑过去（320ms）。
             SVG 用户单位 1:1 对应 px，缩放原点固定在左上角。 */
          style={{
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
            transformOrigin: '0 0',
            ...(viewAnimating ? { transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)' } : null),
          }}
        >
          {routes.map((route, index) => {
            const style = strategy.wireStyle(index);
            const active = selectedWireId === route.wire.id;
            return (
              <g
                key={route.wire.id}
                data-wire-id={route.wire.id}
                onPointerDown={(e) => {
                  if (tool !== 'select') return;
                  e.stopPropagation();
                  onSelectWire?.(route.wire.id);
                  // 触屏长按导线 = 右键菜单（只有「删除该导线」一项）
                  if (e.pointerType !== 'mouse') {
                    armLongPress({ kind: 'wire', id: route.wire.id }, { t: e.timeStamp, x: e.clientX, y: e.clientY });
                  }
                }}
                style={{ cursor: tool === 'select' ? 'pointer' : undefined }}
              >
                {/* 加宽透明命中区：细导线也能点中 */}
                <path d={route.path} fill="none" stroke="transparent" strokeWidth={14} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                {style.casing && (
                  <path
                    d={route.path}
                    fill="none"
                    stroke={style.casing.stroke}
                    strokeOpacity={style.casing.strokeOpacity}
                    strokeWidth={style.casing.strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <path
                  d={route.path}
                  fill="none"
                  stroke={style.stroke}
                  strokeOpacity={style.strokeOpacity}
                  strokeWidth={style.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {viewMode === 'physical' && (() => {
                  const flow = flows.get(route.wire.id);
                  if (!flow || flow.amps < FLOW_MIN_AMPS) return null;
                  // 流动层：半透明亮色虚线压在导线之上，纯 CSS 关键帧滚动 dashoffset，
                  // 电流越大周期越短；方向取反即可让「从正极流向负极」跟着电流符号走。
                  return (
                    <path
                      className="cb-current-flow"
                      d={route.path}
                      fill="none"
                      stroke="var(--cb-flow, #ffd166)"
                      strokeOpacity={0.85}
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="6 6"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                      style={{
                        animationDuration: `${flowDuration(flow.amps)}s`,
                        animationDirection: flow.dir < 0 ? 'reverse' : 'normal',
                        opacity: flow.amps >= 0.05 ? 1 : 0.7,
                      }}
                    />
                  );
                })()}
                {active && (
                  <path
                    d={route.path}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="4 3"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {style.sleeves &&
                  [true, false].map((atStart) => {
                    const seg = sleevePoints(route.points, atStart);
                    if (!seg) return null;
                    return (
                      <line
                        key={atStart ? 'start' : 'end'}
                        x1={seg[0].x}
                        y1={seg[0].y}
                        x2={seg[1].x}
                        y2={seg[1].y}
                        stroke={style.stroke}
                        strokeWidth={4.4}
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
              </g>
            );
          })}

          {/* 跨线跳线：先抹掉直线段，补回被跨导线，再画半圆本体 */}
          {jumps.map((j) => {
            const jumperIndex = routeIndex.get(j.jumper) ?? 0;
            const crossedIndex = routeIndex.get(j.crossed) ?? 0;
            return (
              <g key={`${j.jumper}|${j.crossed}|${j.point.x},${j.point.y}`} pointerEvents="none">
                <line
                  x1={j.bridge[0].x}
                  y1={j.bridge[0].y}
                  x2={j.bridge[1].x}
                  y2={j.bridge[1].y}
                  stroke="var(--card-bg)"
                  strokeWidth={7}
                  strokeLinecap="butt"
                />
                <line
                  x1={j.across[0].x}
                  y1={j.across[0].y}
                  x2={j.across[1].x}
                  y2={j.across[1].y}
                  stroke={strategy.wireStyle(crossedIndex).stroke}
                  strokeWidth={1.4}
                  strokeLinecap="round"
                />
                <path
                  d={j.path}
                  fill="none"
                  stroke={strategy.wireStyle(jumperIndex).stroke}
                  strokeWidth={1.4}
                  strokeLinecap="round"
                />
              </g>
            );
          })}
          {junctions.map((j) => {
            const style = strategy.junctionStyle;
            return (
              <circle
                key={j.ref}
                cx={j.point.x}
                cy={j.point.y}
                r={junctionRadius}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
              />
            );
          })}

          {state.components.map((el) => {
            const pending = armedParsed && armedParsed.id === el.id ? armedParsed.terminal : null;
            return (
              <g
                key={el.id}
                onPointerEnter={() => setHoveredId(el.id)}
                onPointerLeave={() => setHoveredId((id) => (id === el.id ? null : id))}
              >
                <CircuitSymbol
                  el={el}
                  reading={result?.elements[el.id]}
                  selected={selectedId === el.id}
                  hovered={hoveredId === el.id}
                  glow={highlightId === el.id}
                  pendingTerminal={pending}
                  terminalHitRadius={terminalHitRadius}
                  viewMode={viewMode}
                  wireCounts={wireCounts}
                  wireColors={wireColors}
                  // 端子从任意模式都吃指针：选择工具下按住接线柱往外拖就是拉线。
                  // 没拉出阈值的轻点仍按工具分流（接线工具接第二个柱子，选择工具不动）。
                  terminalsInteractive
                  onPointerDown={onComponentDown}
                  onTerminalDown={onTerminalDown}
                />
              </g>
            );
          })}

          {/* 线号牌：颜色之外的**第二条身份通道**。
              六色循环意味着第 7 根线必然与第 1 根同色，色觉障碍下蓝紫两色也几乎
              分不开（相对亮度比 1.051）——只靠颜色认线是认不准的。号码牌压在
              最长直段的中点上，用 --card-bg 填芯把导线「切断」一小截，读成挂在
              线上的号码牌而不是导线上的疙瘩。
              画在元件之后：号码必须永远露在外面，被元件本体盖住就白画了。 */}
          {viewMode === 'physical' &&
            routes.map((route, index) => {
              const anchor = wireLabelAnchor(route.points);
              if (!anchor) return null;
              return (
                <g key={`cbn-${route.wire.id}`} data-wire-number={index + 1} pointerEvents="none">
                  <circle
                    cx={anchor.x}
                    cy={anchor.y}
                    r={WIRE_LABEL_RADIUS}
                    fill="var(--card-bg)"
                    stroke={strategy.wireStyle(index).stroke}
                    strokeWidth={1}
                  />
                  <text
                    x={anchor.x}
                    y={anchor.y + 3.2}
                    textAnchor="middle"
                    fontSize={9}
                    fill="var(--fg)"
                    fontFamily="var(--f-mono)"
                  >
                    {index + 1}
                  </text>
                </g>
              );
            })}

          {/* 选中导线的两端手柄：抓住它把这一端拔下来丢到别的接线柱上（A—B → A—C）。
              画在元件之上，端点贴着元件外壳时也照样抓得住。 */}
          {tool === 'select' &&
            (() => {
              const route = routes.find((r) => r.wire.id === selectedWireId);
              if (!route || !onReplug) return null;
              const ends = [
                { end: 'from' as const, at: route.points[0], fixedRef: route.wire.to, fixed: route.points[route.points.length - 1] },
                { end: 'to' as const, at: route.points[route.points.length - 1], fixedRef: route.wire.from, fixed: route.points[0] },
              ];
              return ends.map((h) => (
                <g key={h.end} data-wire-handle={`${route.wire.id}:${h.end}`}>
                  <circle
                    cx={h.at.x}
                    cy={h.at.y}
                    r={handleHitRadius}
                    fill="transparent"
                    stroke="none"
                    style={{ cursor: 'grab' }}
                    onPointerDown={(e) => {
                      if (e.button !== 0 && e.pointerType === 'mouse') return;
                      e.preventDefault();
                      e.stopPropagation();
                      cancelLongPress();
                      onSelectWire?.(route.wire.id);
                      startReplug(route.wire.id, h.end, h.fixed, h.fixedRef, e);
                      svgRef.current?.setPointerCapture?.(e.pointerId);
                    }}
                  />
                  <circle
                    cx={h.at.x}
                    cy={h.at.y}
                    r={handleRadius}
                    fill="var(--card-bg, #fff)"
                    stroke="var(--accent)"
                    strokeWidth={1.6}
                    pointerEvents="none"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ));
            })()}

          {/* 连线皮筋：从起点接线柱拉向手指；进入目标柱子磁吸圈时端点吸过去并高亮目标 */}
          {wirePreview && (
            <g pointerEvents="none">
              <line
                x1={wirePreview.from.x}
                y1={wirePreview.from.y}
                x2={wirePreview.to.x}
                y2={wirePreview.to.y}
                stroke="var(--accent)"
                strokeWidth={1.8}
                strokeDasharray="6 4"
                strokeLinecap="round"
              />
              <circle cx={wirePreview.from.x} cy={wirePreview.from.y} r={4} fill="var(--accent)" />
              {wirePreview.target && (
                <circle
                  cx={wirePreview.to.x}
                  cy={wirePreview.to.y}
                  r={7.5}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1.6}
                />
              )}
            </g>
          )}

        </g>

        {/* 画布内图例胶囊：把「本图在用的色彩语言」钉在画布自己身上。
            它替代不了导读浮卡里的那张大图例——浮卡会被关掉、也可能被滚走，
            而学生盯着画布问「这个红点是什么意思」的时候，答案必须在画布上。
            内容只放**当前这张图真的用得到**的东西：红正/黑负（物理惯例）、
            电流流动虚线、以及画布上现有导线的颜色↔线号映射；没有导线时
            最后一段自动消失，不摆一排空色块。
            只画在仿真图上：电路图是单色教科书线稿，端子是实心点不是红黑柱，
            给它挂一套色彩图例反而是误导。

            **它挂在视图变换之外**（上面那个 `<g transform>` 的兄弟，坐标就是 viewBox
            用户坐标），这是逐张实测逼出来的，不是随手一放：
            图例原先跟电路一起随 `fitViewToContent` 平移缩放，8 张预设量下来，
            「惠斯通电桥」与「短路与保险丝」把世界坐标 y=5 推到了画布上沿之外
            （可见面积 0/14499、0/16571 px²）——图例整个消失；其余预设虽然 98.6% 可见，
            左上角那枚 80×32 的「元件库」胶囊又压掉它 1128 px²，正好盖住「红正 / 黑负」
            两个色例。钉在槽位里就与平移缩放无关：横向居中让开左上元件坞、也够不着
            右上读数药丸，纵向 user y=5..31 落在默认适配（实物模式 80% 占比）留出的
            顶部空白带里，压不到电路。代价是学生手动把电路平移到顶部时图例会盖住它
            ——一块 26px 高的半透明键位卡，比「图例没了」划算。 */}
        {viewMode === 'physical' &&
          (() => {
            const shown = Math.min(routes.length, 8);
            const over = routes.length - shown;
            const swarmX = 188;
            const width = swarmX + shown * LEGEND.pitch + (over > 0 ? 34 : 0) + 12;
            return (
              <g
                data-cb-legend=""
                pointerEvents="none"
                transform={`translate(${(WORLD_W - width) / 2} ${LEGEND.y})`}
              >
                <rect
                  x={0}
                  y={0}
                  width={width}
                  height={LEGEND.h}
                  rx={LEGEND.r}
                  fill="var(--card-bg)"
                  fillOpacity={0.92}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
                {/* 红正 */}
                <circle cx={LEGEND.padLeft} cy={13} r={3.5} fill="var(--danger)" />
                <text x={21} y={16.2} fontSize={10} fill="var(--fg)">
                  红正
                </text>
                {/* 黑负：暗底上黑芯本身没有亮度差，靠一圈 --muted 描边把它勾出来 */}
                <circle cx={52} cy={13} r={3.5} fill="#18181b" stroke="var(--muted)" strokeWidth={0.9} />
                <text x={59} y={16.2} fontSize={10} fill="var(--fg)">
                  黑负
                </text>
                {/* 电流方向：与画布上的流动虚线同色同虚线节距 */}
                <line
                  x1={90}
                  y1={13}
                  x2={108}
                  y2={13}
                  stroke="var(--cb-flow)"
                  strokeWidth={1.8}
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                />
                <text x={112} y={16.2} fontSize={10} fill="var(--fg)">
                  电流方向
                </text>
                {/* 颜色↔线号：色点就是这根线绝缘皮的颜色，数字就是画布上的线号牌 */}
                {shown > 0 && (
                  <>
                    <text x={162} y={16.2} fontSize={10} fill="var(--fg)">
                      导线
                    </text>
                    {routes.slice(0, shown).map((route, i) => (
                      <g key={`lg-${route.wire.id}`}>
                        <circle
                          cx={swarmX + i * LEGEND.pitch + 4}
                          cy={13}
                          r={3.5}
                          fill={strategy.wireStyle(i).stroke}
                        />
                        <text
                          x={swarmX + i * LEGEND.pitch + 11}
                          y={16.2}
                          fontSize={9}
                          fill="var(--fg)"
                          fontFamily="var(--f-mono)"
                        >
                          {i + 1}
                        </text>
                      </g>
                    ))}
                    {over > 0 && (
                      <text x={swarmX + shown * LEGEND.pitch + 4} y={16.2} fontSize={9} fill="var(--muted)">
                        +{over}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })()}
      </svg>

      {canvasBox.w > 0 && (
        <div
          className="pointer-events-none absolute z-10"
          style={{ left: canvasBox.x, top: canvasBox.y, width: canvasBox.w, height: canvasBox.h }}
        >
          <CircuitLabels
            state={state}
            readings={result?.elements}
            view={view}
            size={canvasBox}
            showValues={showValues}
            showNames
            selectedId={selectedId}
            routes={routes}
            lang={zh ? 'zh' : 'en'}
            // 视图/预设一变就丢掉旧标签位置：两种视图的元件尺寸不同，
            // 沿用旧位置会把标签锁在远环上，拖出一条长引线。
            // 语言同理——换了文字宽度，旧位置的迟滞输入不再对应当前文字。
            resetKey={`${sceneKey ?? ''}:${viewMode}:${zh ? 'zh' : 'en'}`}
            onRepairElement={onRepairElement}
          />
        </div>
      )}

      {/* 操作提示降级为右下角水印：不再挡住画布正上方，也不再随交互淡出——
          它是常驻的辅助说明，低对比度即可。 */}
      <div className="pointer-events-none absolute right-2 bottom-1.5 z-20 max-w-[70%] text-right text-[10px] leading-tight text-[var(--muted)] opacity-60 select-none">
        {tool === 'wire'
          ? pendingTerminal
            ? zh
              ? '请选择第二个接线柱'
              : 'Pick the second terminal'
            : zh
              ? '点两个接线柱完成接线'
              : 'Tap two terminals to wire'
          : zh
            ? '拖拽元件 · 从接线柱拖出导线 · 滚轮/双指缩放'
            : 'Drag parts · drag from a terminal to wire · wheel/pinch to zoom'}
      </div>

    </div>
  );
}
