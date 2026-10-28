/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 屏幕空间标签布局
 *
 * 标签不画在 SVG 世界坐标里，而是先投影到 CSS 像素，再做候选位评分与避让。
 * 这样字号不随画布/缩放变小，标签也永远不会被后画的元件盖住。
 * 布局是纯函数：上一帧位置作为迟滞输入，避免拖动时左右跳动。
 */
import type { BenchState, CircuitComponent, ElementKind, ElementReading } from './circuit-bench-core';
import { formatPhysicalValue } from './circuit-bench-core';
import { isFaulty } from './circuit-bench-menu';
import { elementCanvasLabel } from './circuit-bench-naming';
import { buildWireRoutes, type WireRoute } from './circuit-bench-render';
import {
  WORLD_W,
  elementInkBounds,
  terminalPoint,
  worldToScreen,
  type Pt,
  type ViewTransform,
} from './circuit-bench-geometry';

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacedLabel extends ScreenRect {
  id: string;
  componentId: string;
  variant: 'name' | 'value';
  text: string;
  selected: boolean;
  /** 电表表笔接反：胶囊改用警示色，文字已带 ⚠ 前缀。 */
  reversed?: boolean;
  /**
   * 熔毁元件（灯泡烧毁 / 保险丝熔断）：这一枚不是读数胶囊，而是就近可点的告警徽章
   * 「⚠️ 已断路」。组件据此换成告警配色并把指针事件收回来（见 CircuitLabels）。
   */
  fault?: boolean;
  leader?: { x1: number; y1: number; x2: number; y2: number };
}

export interface LabelLayoutInput {
  state: BenchState;
  readings?: Record<string, ElementReading> | null;
  view: ViewTransform;
  /** 画布 CSS 像素尺寸；高度用于底部边界。 */
  size: { w: number; h: number };
  showValues: boolean;
  showNames: boolean;
  selectedId: string | null;
  /**
   * 界面语言，只影响元件名标签的文字（预设里带中文名的元件切英文界面时取 `labelEn`）。
   * 默认 `zh`，因此旧调用与单测行为不变。
   */
  lang?: 'zh' | 'en';
  previous?: Record<string, ScreenRect>;
  /**
   * 调用方已经算好的导线路径（P1-8）。
   *
   * 一帧里画布本身、流向层、标签层都要导线路径；满负载（128 导线）时
   * `buildWireRoutes` 单次就要 ~90 ms，三次独立计算等于白花两帧的钱。
   * 传进来就复用，没传（测试、单点调用）就自己算 —— 结果完全一样。
   */
  routes?: WireRoute[] | null;
}

interface LabelSpec {
  id: string;
  componentId: string;
  variant: 'name' | 'value';
  text: string;
  fontPx: number;
  height: number;
  padX: number;
  body: ScreenRect;
  vertical: boolean;
  selected: boolean;
  reversed?: boolean;
  /** 熔毁元件：这枚标签是告警徽章而不是读数。 */
  fault?: boolean;
  /** 垂直分层：名称恒定居上、读数恒定居下（见 LAYER_ANCHOR_WU）。 */
  layer: 'above' | 'below';
  /** 该层的安全间距锚点（屏幕像素），由 LAYER_ANCHOR_WU 按缩放换算。 */
  layerOffset: number;
  priority: number;
}

const VALUE_HEIGHT = 18;
const NAME_HEIGHT = 15;
const VALUE_FONT = 11;
const NAME_FONT = 10.5;
const GAP = 7;
const VIEW_PAD = 5;

/**
 * 垂直分层锚点（世界单位 wu）：名称在元件正上方、读数胶囊在正下方。
 *
 * wu 是相对世界画布的尺寸单位，这里按当前缩放换算成屏幕像素后再用——
 * 画布被缩小看全貌时，锚点也跟着收，否则一个 24wu 的偏移会顶出半块画布。
 * 换算值低于内环 GAP 时退化回 GAP（缩到很小的时候两圈就是同一圈）。
 */
const LAYER_ANCHOR_WU = { name: 12, value: 24 } as const;

/**
 * 读数胶囊与下方横向主导线的最小净空（wu）。
 *
 * 胶囊只要「不压线」就会允许自己贴着主导线画，学生看到的是一串和导线黏在一起的
 * 小字；截图里定值电阻下方那排读数正是这么糊成一片的。所以给读数胶囊加一条
 * 净空成本：下沿离下方的横向导线不足 16wu 时涨分（见 CLEARANCE_COST）。
 */
const VALUE_WIRE_CLEARANCE_WU = 16;

/**
 * 净空不足的成本加成。
 *
 * 取值区间是被算好的：压线 320 / 引线穿体 260 ≫ 60 ≫ 一个候选位名次 7。
 * 也就是「宁可退到 24wu 那一圈，也不贴着导线画」，但绝不越过「压线」本身。
 */
const CLEARANCE_COST = 60;

/** 求解器内部的 1e-9 级噪声（如桥式电路的 G 表）不应显示成 -0.000。 */
const READOUT_EPS = 1e-9;

/**
 * 熔毁元件就近徽章的文案。单测、布局层与组件共用这一处出处。
 * 前缀那个 ⚠️ 不只是装饰：11px 字号下「已断路」和「0 A」在余光里长得一样，
 * 形状上的差别（图标 vs 数字）比颜色更快被人眼抓住。
 */
export const FAULT_BADGE_TEXT = { zh: '⚠️ 已断路', en: '⚠️ Open circuit' } as const;

export function sanitizeReadout(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.abs(value) < READOUT_EPS ? 0 : value;
}

/**
 * 标签上显示的读数：**电表保留符号**，其余元件取幅值。
 *
 * 口径（P0-3）：
 * - 电流表/电流计：`currentAB` 带符号 —— a 端是红柱「+」，电流由 a 流入表内即正向接入，
 *   于是 `currentAB < 0` 恰好表示「红黑表笔接反」，画布上显示 `−0.258 A` 并配接反标记；
 * - 电压表：`voltage` 带符号（v_a − v_b），红表笔接在低电位端即为负；
 * - 电池：取幅值 —— 极性已经由符号上的红黑柱和 ± 标识表达，印一个负号只会被当成故障；
 * - 其余无极性元件：取幅值（解算器给的是 a→b 参考方向，画反了没有教学含义）。
 *
 * 求解器给出的 `current` / `voltage` 是「a 端 → b 端」参考方向下的带符号量，
 * 而这个参考方向取决于接线顺序（和旋转无关）：接反了就该让学生看见负号，
 * 再靠表针左偏与「接反」告警把它和「真的有负电流」区分开。
 */
export function readingForKind(
  kind: ElementKind,
  reading: ElementReading,
): { value: number; unit: string } {
  if (kind === 'battery') return { value: Math.abs(sanitizeReadout(reading.voltage)), unit: 'V' };
  if (kind === 'voltmeter') return { value: sanitizeReadout(reading.voltage), unit: 'V' };
  const current = signedCurrent(reading);
  if (kind === 'ammeter' || kind === 'galvanometer') {
    return { value: sanitizeReadout(current), unit: 'A' };
  }
  return { value: Math.abs(sanitizeReadout(current)), unit: 'A' };
}

/** 统一取带符号的拓扑电流；遇到没有 `currentAB` 的旧数据时退化为遗留 `current`。 */
export function signedCurrent(reading: ElementReading): number {
  const v = reading.currentAB;
  return Number.isFinite(v) ? Number(v) : reading.current;
}

/** 只有电表才有「表笔接反」这回事：电池接反是合法接法，不该报接反。 */
const REVERSIBLE_KINDS = new Set<ElementKind>(['ammeter', 'voltmeter', 'galvanometer']);

/**
 * 表针方向：带符号读数相对参考方向为负，说明表笔接反了（针左偏）。
 *
 * 判据与表针偏角同源（都是同一个带符号量），所以「读数负 ↔ 针左偏 ↔ 报接反」
 * 三者永远自洽，不会出现「针右偏却提示接反」这种自相矛盾。
 */
export function readingReversed(kind: ElementKind, reading: ElementReading): boolean {
  if (!REVERSIBLE_KINDS.has(kind)) return false;
  const raw = kind === 'voltmeter' ? reading.voltage : signedCurrent(reading);
  return Number.isFinite(raw) && raw < -READOUT_EPS;
}

/**
 * 画布上是否值得给这个元件印读数。
 *
 * 闭合开关和导线在网表里会把两端并成同一个节点（mergesTerminals），求解器
 * 因此只能给出 v=0、I=0 —— 那是「合并后的节点」，不是真实支路电流。给它印
 * 一个 0A 会让学生以为开关里没有电流，所以这类元件不显示读数。
 */
export function hasCanvasReadout(el: CircuitComponent): boolean {
  if (el.kind === 'wire') return false;
  if (el.kind === 'switch' && el.params?.closed !== false) return false;
  return true;
}

/** 粗略但稳定的等宽/中文宽度估算；误差由 padX 吸收。 */
export function estimateLabelWidth(text: string, fontPx: number): number {
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x2e80 && code <= 0x9fff) units += 1;
    else if (code >= 0xff00 && code <= 0xffef) units += 1;
    else if (ch === ' ') units += 0.34;
    else if (/[ilI1.,:;'|]/.test(ch)) units += 0.36;
    else if (/[A-Z]/.test(ch)) units += 0.68;
    else units += 0.59;
  }
  return Math.ceil(units * fontPx);
}

function projection(view: ViewTransform, size: { w: number; h: number }) {
  const css = size.w / WORLD_W;
  return {
    css,
    x: (v: number) => (v * view.scale + view.tx) * css,
    y: (v: number) => (v * view.scale + view.ty) * css,
    point: (p: Pt) => ({
      x: (p.x * view.scale + view.tx) * css,
      y: (p.y * view.scale + view.ty) * css,
    }),
  };
}

function rectFromWorld(
  view: ViewTransform,
  size: { w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): ScreenRect {
  const p = projection(view, size);
  return {
    x: p.x(b.x),
    y: p.y(b.y),
    w: b.w * view.scale * p.css,
    h: b.h * view.scale * p.css,
  };
}

function overlaps(a: ScreenRect, b: ScreenRect, margin = 0): boolean {
  return (
    a.x < b.x + b.w + margin &&
    a.x + a.w + margin > b.x &&
    a.y < b.y + b.h + margin &&
    a.y + a.h + margin > b.y
  );
}

function inside(a: ScreenRect, size: { w: number; h: number }, pad = VIEW_PAD): boolean {
  return a.x >= pad && a.y >= pad && a.x + a.w <= size.w - pad && a.y + a.h <= size.h - pad;
}

function clampRect(a: ScreenRect, size: { w: number; h: number }, pad = VIEW_PAD): ScreenRect {
  return {
    ...a,
    x: Math.min(Math.max(pad, a.x), Math.max(pad, size.w - a.w - pad)),
    y: Math.min(Math.max(pad, a.y), Math.max(pad, size.h - a.h - pad)),
  };
}

/** 线段与矩形是否相交（含端点落在内部）。 */
function segmentHitsRect(a: Pt, b: Pt, r: ScreenRect): boolean {
  if (
    (a.x >= r.x && a.x <= r.x + r.w && a.y >= r.y && a.y <= r.y + r.h) ||
    (b.x >= r.x && b.x <= r.x + r.w && b.y >= r.y && b.y <= r.y + r.h)
  ) {
    return true;
  }
  const edges: [Pt, Pt][] = [
    [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }],
    [{ x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }],
    [{ x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }],
    [{ x: r.x, y: r.y + r.h }, { x: r.x, y: r.y }],
  ];
  return edges.some(([c, d]) => segmentsCross(a, b, c, d));
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const orient = (p: Pt, q: Pt, r: Pt) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 * o2 <= 0 && o3 * o4 <= 0;
}

function closestGap(body: ScreenRect, box: ScreenRect): number {
  const dx = Math.max(body.x - (box.x + box.w), box.x - (body.x + body.w), 0);
  const dy = Math.max(body.y - (box.y + box.h), box.y - (body.y + body.h), 0);
  return Math.hypot(dx, dy);
}

/**
 * 均匀网格包围盒索引：只负责「不可能相交」的排除，精度无关。
 *
 * 键是格子坐标的纯函数，且 add 会把矩形包围盒覆盖到的每个格子都登记一遍，
 * 所以任何与该盒真正相交的矩形必然落在某个被覆盖的格子里 —— 返回的是包围盒
 * **超集**：哈希/格子冲突只会多带几个候选（下方仍用 segmentHitsRect / 点包含
 * 精确判定），绝不可能漏。因此布局结果与逐条线性扫描逐像素一致，只是把
 * 500+ 段导线 × 16 个候选位 × 每个标签的求交次数降了一两个数量级。
 */
const INDEX_CELL = 48;

class RectIndex {
  private readonly cells = new Map<number, number[]>();
  /** query 的去重用时间戳数组：每格只查一次，避免同一索引被多个格子重复带出。 */
  private readonly seen: number[] = [];
  private stamp = 0;

  private static key(gx: number, gy: number): number {
    // ±512 格（±24k px）远超任何真实画布；偏移只为让负数格子也进同一个整数键空间。
    return (gx + 512) * 2048 + (gy + 512);
  }

  add(index: number, rect: ScreenRect): void {
    const x0 = Math.floor(rect.x / INDEX_CELL);
    const x1 = Math.floor((rect.x + Math.max(rect.w, 0)) / INDEX_CELL);
    const y0 = Math.floor(rect.y / INDEX_CELL);
    const y1 = Math.floor((rect.y + Math.max(rect.h, 0)) / INDEX_CELL);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const key = RectIndex.key(gx, gy);
        const list = this.cells.get(key);
        if (list) list.push(index);
        else this.cells.set(key, [index]);
      }
    }
  }

  /** 返回包围盒可能与 box 相交的索引（去重、无序）——调用方仍需精确判定。 */
  query(box: ScreenRect): number[] {
    const out: number[] = [];
    this.stamp++;
    const x0 = Math.floor(box.x / INDEX_CELL);
    const x1 = Math.floor((box.x + Math.max(box.w, 0)) / INDEX_CELL);
    const y0 = Math.floor(box.y / INDEX_CELL);
    const y1 = Math.floor((box.y + Math.max(box.h, 0)) / INDEX_CELL);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const list = this.cells.get(RectIndex.key(gx, gy));
        if (!list) continue;
        for (const index of list) {
          if (this.seen[index] === this.stamp) continue;
          this.seen[index] = this.stamp;
          out.push(index);
        }
      }
    }
    return out;
  }
}

function leaderFor(body: ScreenRect, box: ScreenRect): PlacedLabel['leader'] | undefined {
  if (closestGap(body, box) < 19) return undefined;
  const bc = { x: body.x + body.w / 2, y: body.y + body.h / 2 };
  const lc = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  return {
    x1: bc.x + Math.sign(lc.x - bc.x) * (body.w / 2),
    y1: bc.y + Math.sign(lc.y - bc.y) * (body.h / 2),
    x2: lc.x,
    y2: lc.y + Math.sign(bc.y - lc.y) * (box.h / 2),
  };
}

/**
 * 候选锚点：围绕元件本体的一圈（近）、一圈（安全间距）与一圈（远），每圈八个方向。
 *
 * 分层不是「偏好」而是**顺序**：候选位按「本层（名称上方 / 读数下方）→ 本层斜位 →
 * 两侧 → 对侧 → 远环」成组排列。旧实现是「内环所有方向排完再排外环」，于是
 * 「元件下方 24wu 上有个干净位」会输给「贴着本体但爬到元件上方」的位子——
 * 实测截图里定值电阻上下多层堆叠、读数挤到标号的正上方，就是这么来的。
 *
 * 内环（GAP）永远排在最前面：干净场景里标签必须紧贴本体，这条是回归测试钉住的。
 * 只有内环被邻居/导线占住时才退到 LAYER_ANCHOR_WU 那一圈，而不是立刻越层。
 */
function candidateBoxes(spec: LabelSpec, size: { w: number; h: number }): ScreenRect[] {
  const b = spec.body;
  const w = estimateLabelWidth(spec.text, spec.fontPx) + spec.padX * 2;
  const h = spec.height;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const ring = (d: number) => {
    const below = { x: cx - w / 2, y: b.y + b.h + d, w, h };
    const above = { x: cx - w / 2, y: b.y - h - d, w, h };
    const right = { x: b.x + b.w + d, y: cy - h / 2, w, h };
    const left = { x: b.x - w - d, y: cy - h / 2, w, h };
    const gap = Math.max(2, d - 3);
    const belowRight = { x: b.x + b.w + gap, y: b.y + b.h + gap, w, h };
    const belowLeft = { x: b.x - w - gap, y: b.y + b.h + gap, w, h };
    const aboveRight = { x: b.x + b.w + gap, y: b.y - h - gap, w, h };
    const aboveLeft = { x: b.x - w - gap, y: b.y - h - gap, w, h };
    return { below, above, right, left, belowRight, belowLeft, aboveRight, aboveLeft };
  };
  const near = ring(GAP);
  const far = ring(GAP + 18);
  // 安全间距那一圈：读数 24wu 下、名称 12wu 上（按缩放换算；低于 GAP 时与内环重合，
  // 由下面的去重合并掉）。
  const anchor = ring(Math.max(GAP, spec.layerOffset));
  const above = spec.layer === 'above';
  // 本层：正位两档（贴本体 / 规格间距）→ 斜位 → 两侧 → 对侧 → 远环。
  const layer = above ? [near.above, anchor.above] : [near.below, anchor.below];
  const layerDiag = above ? [near.aboveRight, near.aboveLeft] : [near.belowRight, near.belowLeft];
  const opposite = above
    ? [near.below, near.belowRight, near.belowLeft]
    : [near.above, near.aboveRight, near.aboveLeft];
  const farRing = above
    ? [far.above, far.aboveRight, far.aboveLeft, far.right, far.left, far.below, far.belowRight, far.belowLeft]
    : [far.below, far.belowRight, far.belowLeft, far.right, far.left, far.above, far.aboveRight, far.aboveLeft];
  // 竖直元件的本体窄而高，左右两侧和正下方一样近，所以侧位提到斜位前面。
  const order = spec.vertical
    ? [...layer, near.right, near.left, anchor.right, anchor.left, ...layerDiag, ...opposite, ...farRing]
    : [...layer, ...layerDiag, near.right, near.left, anchor.right, anchor.left, ...opposite, ...farRing];

  // 远处的角位在小画布上会被 clamp 回同一处，去重避免评分偏向同一点。
  const seen = new Set<string>();
  const out: ScreenRect[] = [];
  for (const r of order) {
    const box = clampRect(r, size);
    const key = `${Math.round(box.x)},${Math.round(box.y)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(box);
  }
  return out;
}

function makeSpecs(input: LabelLayoutInput): LabelSpec[] {
  const { state, readings, view, size, showValues, showNames, selectedId } = input;
  const lang = input.lang ?? 'zh';
  const specs: LabelSpec[] = [];
  /** 世界单位 → 屏幕像素：分层锚点（wu）要靠它换算，缩放/画布尺寸变化时同步收放。 */
  const effective = (size.w / WORLD_W) * view.scale;
  for (const el of state.components) {
    if (el.x < -5000 || el.y < -5000) continue;
    // 避让框用**墨迹**包络（本体 + 光晕）：灯泡额定发光时，上沿会顶到本体框外
    // 19 个单位，按本体框排的标号正好落在光晕上（审计点名的「19 wu 上溢」）。
    const body = rectFromWorld(view, size, elementInkBounds(el));
    const vertical = el.rotation % 180 !== 0;
    const selected = selectedId === el.id;
    const meterGlyph = el.kind === 'ammeter' || el.kind === 'voltmeter' || el.kind === 'galvanometer';
    // 元件名与「数据记录」下拉同源（见 circuit-bench-naming）：灯泡 L₁、电流表 A₁，
    // 学生照着画布上的标号就能在下拉里认领那一项。
    const name = elementCanvasLabel(state, el, lang);
    const showName = showNames && !!name && !(meterGlyph && /^[AVG]$/.test(name));
    if (showName) {
      specs.push({
        id: `${el.id}:name`,
        componentId: el.id,
        variant: 'name',
        text: name,
        fontPx: NAME_FONT,
        height: NAME_HEIGHT,
        padX: 5,
        body,
        vertical,
        selected,
        // 标号恒居上：读数胶囊再挤也不会把标号顶到元件下方去。
        layer: 'above',
        layerOffset: LAYER_ANCHOR_WU.name * effective,
        priority: selected ? 10 : 20,
      });
    }
    // 熔毁元件的读数位改挂告警徽章：灯泡烧毁 / 保险丝熔断后，那个位子上印一串
    // 「0A」既不像读数也不像告警，学生根本看不出元件已经断了。徽章与读数同级优先，
    // 并且**不依赖求解结果**——没接电源、求解器没跑（readings 为空）时，
    // 烧毁的灯泡照样要把「已断路」写在脸上。
    if (showValues && isFaulty(el)) {
      specs.push({
        id: `${el.id}:value`,
        componentId: el.id,
        variant: 'value',
        text: lang === 'zh' ? FAULT_BADGE_TEXT.zh : FAULT_BADGE_TEXT.en,
        fontPx: VALUE_FONT,
        height: VALUE_HEIGHT,
        padX: 8,
        body,
        vertical,
        selected,
        fault: true,
        layer: 'below',
        layerOffset: LAYER_ANCHOR_WU.value * effective,
        priority: selected ? 0 : 10,
      });
      continue;
    }
    const reading = readings?.[el.id];
    if (showValues && reading && hasCanvasReadout(el)) {
      const { value, unit } = readingForKind(el.kind, reading);
      // 表笔接反：读数带负号，再补一个 ⚠ 前缀把「负号」和「电路真的反向」区分开。
      // 前缀计入同一次宽度估算，所以加字不会撑破胶囊、不会被裁。
      const reversed = readingReversed(el.kind, reading);
      const valueText = formatPhysicalValue(value, unit);
      specs.push({
        id: `${el.id}:value`,
        componentId: el.id,
        variant: 'value',
        // 画布读数与检查器共用同一套工程单位排版（258 mA / 2.96 V），
        // 绝不在画布上印出 e-6、e+6 这类裸指数。
        text: reversed ? `⚠ ${valueText}` : valueText,
        reversed,
        fontPx: VALUE_FONT,
        height: VALUE_HEIGHT,
        padX: 7,
        body,
        vertical,
        selected,
        // 读数恒居下：与名称分层，定值电阻不会被两枚标签上下夹住。
        layer: 'below',
        layerOffset: LAYER_ANCHOR_WU.value * effective,
        priority: selected ? 0 : 10,
      });
    }
  }
  // 读数优先；选中元件优先；同优先级保持预设顺序，布局稳定。
  return specs.sort((a, b) => a.priority - b.priority);
}

/**
 * 计算所有标签的最终屏幕框。返回值只包含实际可见的标签。
 * 先放读数、再放名称；名称抢不到合法位置时宁可不显示，也不压线。
 */
export function layoutCircuitLabels(input: LabelLayoutInput): PlacedLabel[] {
  const { state, view, size } = input;
  if (size.w < 40 || size.h < 40) return [];
  const effective = (size.w / WORLD_W) * view.scale;
  const selectedId = input.selectedId;
  const lowDensity = effective < 0.30;
  const specs = makeSpecs({
    ...input,
    // 语义缩放：密度不足时只保留选中元件的名称/读数。
    showNames: input.showNames && (effective >= 0.42 || !!selectedId),
    showValues: input.showValues && (effective >= 0.30 || !!selectedId),
  }).filter((spec) => {
    if (!lowDensity) return true;
    return spec.componentId === selectedId;
  });
  // 别人本体的避让框同样取墨迹包络：标签不许压在邻居灯泡的光晕上。
  const bodies = state.components.map((el) => rectFromWorld(view, size, elementInkBounds(el)));
  const routes = input.routes ?? buildWireRoutes(state);
  const wireSegments: [Pt, Pt][] = [];
  for (const route of routes) {
    for (let i = 1; i < route.points.length; i++) {
      wireSegments.push([
        { x: (route.points[i - 1].x * view.scale + view.tx) * (size.w / WORLD_W), y: (route.points[i - 1].y * view.scale + view.ty) * (size.w / WORLD_W) },
        { x: (route.points[i].x * view.scale + view.tx) * (size.w / WORLD_W), y: (route.points[i].y * view.scale + view.ty) * (size.w / WORLD_W) },
      ]);
    }
  }
  const terminals: Pt[] = [];
  for (const el of state.components) {
    for (const t of ['a', 'b'] as const) {
      const q = terminalPoint(el, t);
      terminals.push({
        x: (q.x * view.scale + view.tx) * (size.w / WORLD_W),
        y: (q.y * view.scale + view.ty) * (size.w / WORLD_W),
      });
    }
  }

  const placed: PlacedLabel[] = [];
  // 满负载（64 元件 / 128 导线）时这里是热路径：每个候选位都要和 500+ 段导线、
  // 128 个接线柱逐一求交，一次布局 ≈3.8 s，拖一个元件就是整帧卡住。
  // 均匀网格只做「不可能相交」的排除（包围盒超集，键冲突只会多算一次、不会漏），
  // 精确判定仍由下面的 segmentHitsRect / 点包含完成，所以布局结果逐像素不变。
  const wireIndex = new RectIndex();
  wireSegments.forEach(([a, b], i) =>
    wireIndex.add(i, {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(a.x - b.x),
      h: Math.abs(a.y - b.y),
    }),
  );
  const terminalIndex = new RectIndex();
  terminals.forEach((t, i) => terminalIndex.add(i, { x: t.x, y: t.y, w: 0, h: 0 }));

  for (const spec of specs) {
    let best: PlacedLabel | null = null;
    let bestCost = Infinity;
    let fallback: PlacedLabel | null = null;
    let fallbackCost = Infinity;
    // candidateBoxes 已经 clamp 过一遍（并据此去重），这里不再重复 clamp。
    const candidates = candidateBoxes(spec, size);
    // 读数胶囊才查「下方横向主导线的净空」：名称没有这条规矩，少查一步是白赚的。
    const clearancePx = spec.variant === 'value' ? VALUE_WIRE_CLEARANCE_WU * effective : 0;
    const previous = input.previous?.[spec.id];
    const bodyCenter = { x: spec.body.x + spec.body.w / 2, y: spec.body.y + spec.body.h / 2 };
    // 热路径：候选位 ×（本体 + 已放标签 + 接线柱 + 导线段）的判定全部写成普通循环。
    // dev（Vite/tsx 的 esbuild keepNames）会给每个新建的箭头函数套一层 __name，
    // 满负载一次布局要建上万次闭包、实测吃掉约 15% 布局时间，所以这里不留闭包。
    for (let index = 0; index < candidates.length; index++) {
      const box = candidates[index];
      if (!inside(box, size, 3)) continue;
      // 压住本体或别的标签的候选位既当不了 best 也当不了 fallback（判定与成本里
      // bodyHits/labelHits 只可能是 0），所以一旦发现压住就立刻丢弃，不必再算成本。
      let blocked = false;
      for (let i = 0; i < bodies.length; i++) {
        if (overlaps(box, bodies[i], 2)) {
          blocked = true;
          break;
        }
      }
      for (let i = 0; i < placed.length && !blocked; i++) {
        if (overlaps(box, placed[i], 2)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const nearTerminals = terminalIndex.query(box);
      let terminalHits = 0;
      for (let i = 0; i < nearTerminals.length; i++) {
        const t = terminals[nearTerminals[i]];
        if (t.x >= box.x && t.x <= box.x + box.w && t.y >= box.y && t.y <= box.y + box.h) terminalHits++;
      }
      // 向下多探一截（净空高度）再查导线：查回来的是**超集**，压线与否仍由
      // segmentHitsRect 逐段精确判定，所以压线计数与从前逐像素一致；多出来的
      // 那一段只是拿来判「下沿离主线够不够远」，不额外查第二次索引。
      const nearWires = wireIndex.query(
        clearancePx > 0 ? { x: box.x, y: box.y, w: box.w, h: box.h + clearancePx } : box,
      );
      let wireHits = 0;
      let railBelow = 0;
      const boxBottom = box.y + box.h;
      for (let i = 0; i < nearWires.length; i++) {
        const seg = wireSegments[nearWires[i]];
        if (segmentHitsRect(seg[0], seg[1], box)) {
          wireHits++;
          continue;
        }
        if (clearancePx <= 0 || railBelow) continue;
        // 「下方横向主导线」：整段都在胶囊下沿之外、离下沿不足净空，且横向与胶囊有交叠。
        const segTop = seg[0].y < seg[1].y ? seg[0].y : seg[1].y;
        if (segTop < boxBottom - 0.5 || segTop - boxBottom >= clearancePx) continue;
        const segLeft = seg[0].x < seg[1].x ? seg[0].x : seg[1].x;
        const segRight = seg[0].x < seg[1].x ? seg[1].x : seg[0].x;
        if (segRight > box.x && segLeft < box.x + box.w) railBelow = 1;
      }
      // 迟滞只做「真正的平票加时赛」：整数量化后再减 0.5。
      // 候选位差一个名次就是 index*7 = 7 分，内环↔外环还差十几分距离分，
      // 0.5 分绝无可能推翻它们；只有两个候选位算出同一分（亚像素抖动）时才钉住上一帧，
      // 因此不会像早先的 -70 那样把标签自锁死在远环上。
      const sticky = !!previous && Math.hypot(previous.x - box.x, previous.y - box.y) < 8;
      const distance = Math.hypot(box.x + box.w / 2 - bodyCenter.x, box.y + box.h / 2 - bodyCenter.y);
      const leader = leaderFor(spec.body, box);
      // 引线也不许穿过别的元件，否则会读成「元件的一部分」。
      let leaderHits = 0;
      if (leader) {
        for (let i = 0; i < bodies.length; i++) {
          if (state.components[i]?.id === spec.componentId) continue;
          if (segmentHitsRect({ x: leader.x1, y: leader.y1 }, { x: leader.x2, y: leader.y2 }, bodies[i])) leaderHits++;
        }
      }
      const candidate: PlacedLabel = {
        id: spec.id,
        componentId: spec.componentId,
        variant: spec.variant,
        text: spec.text,
        selected: spec.selected,
        reversed: spec.reversed,
        fault: spec.fault,
        ...box,
        leader,
      };
      // bodyHits / labelHits 到这里必然是 0，两项可从成本里省掉。
      // railBelow 只影响「挑哪一格」，不影响能不能用：胶囊宁可贴着导线画，
      // 也不该因此被判成非法位而整枚丢失。
      const base =
        terminalHits * 500 +
        wireHits * 320 +
        leaderHits * 260 +
        railBelow * CLEARANCE_COST +
        index * 7 +
        distance * 0.22;
      const cost = Math.round(base) - (sticky ? 0.5 : 0);
      if (terminalHits === 0 && wireHits === 0 && leaderHits === 0) {
        if (cost < bestCost) {
          bestCost = cost;
          best = candidate;
        }
      }
      // 找不到完全干净的位置时，宁可让标签靠近导线，也绝不盖住元件本体或别的标签。
      if (cost < fallbackCost) {
        fallbackCost = cost;
        fallback = candidate;
      }
    }
    const chosen = best ?? (spec.variant === 'value' ? fallback : null);
    if (chosen) placed.push(chosen);
  }
  return placed;
}
