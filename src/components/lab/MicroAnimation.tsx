/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 微观粒子动画：化学反应「分子 → 自由原子 → 新分子」的可视化。
 *
 * 三阶段本质（对应教材「化学变化的微观本质」）：
 *   1 反应物：分子结合态——原子按相切规则成团（O₂ 双球相切、H₂O 呈 104.5° 弯曲、Cu 微粒相聚）；
 *   2 解离：旧键断裂——每个原子沿背离**自身分子质心**的方向外移 SPREAD(30px)，成为自由原子；
 *   3 重组：原子向生成物的结合位置收拢，重新相切成团。
 * 三个阶段由归一化进度 t ∈ [0,1] 连续插值，任何时刻都有粒子在场（不存在空白帧）。
 *
 * 视觉半径按相对原子半径常识区分（ATOM_RADII），标注字号随半径自适应；
 * 标注颜色按原子填充色的相对亮度自动取黑/白，保证文字对比度达标。
 *
 * 样式：容器只用 --fg / --muted / --border / --accent；原子配色由调用方按元素语义传入。
 */

import { useEffect, useMemo, useRef, useState } from 'react';

interface AtomSpec {
  id: string;
  label: string;
  color: string;
}

interface MoleculeSpec {
  label: string;
  atoms: AtomSpec[];
}

interface MicroAnimationProps {
  /** 反应物分子描述：{ label, atoms: {id, label, color}[] } */
  reactants: MoleculeSpec[];
  /** 生成物分子描述 */
  products: MoleculeSpec[];
  /** 相邻阶段之间的过渡时长 ms */
  duration?: number;
}

type Phase = 'reactants' | 'separate' | 'recombine' | 'products';

interface Pt {
  x: number;
  y: number;
}

/** 原子视觉半径（px）：按相对原子半径常识区分，禁止一刀切 */
export const ATOM_RADII: Record<string, number> = {
  H: 8.5, // 氢：最小
  O: 12.5, // 氧：中等
  Cu: 15.5, // 铜：明显大于氧
};
const DEFAULT_RADIUS = 12;

/** 解离位移（px）：旧键断裂后每个原子背离自身分子质心的外移量，须显著大于相切间距 */
const SPREAD = 30;
/** 解离完成的归一化时刻：t ≤ SPREAD_T 段为「分子 → 自由原子」，其后为「自由原子 → 生成物」 */
const SPREAD_T = 0.38;
/** 各阶段对应的归一化进度：0 = 反应物结合态，1 = 生成物结合态 */
const PHASE_T: Record<Phase, number> = { reactants: 0, separate: SPREAD_T, recombine: 0.72, products: 1 };

const VIEW_W = 460;
const VIEW_H = 170;
/** 分子所在水平带的中心 y（反应物与生成物共用同一条带，碰撞面积最小） */
const BAND_Y = 85;
/** 同排相邻分子之间的间隙 */
const MOL_GAP = 26;

const PHASES: Phase[] = ['reactants', 'separate', 'recombine', 'products'];

/** 阶段文案（中文） */
const PHASE_ZH: Record<Phase, string> = {
  reactants: '反应物：分子结合态',
  separate: '解离：旧键断裂，分子分裂成原子',
  recombine: '重组：原子重新结合',
  products: '生成物：新分子结合态',
};

/** 阶段文案（英文） */
const PHASE_EN: Record<Phase, string> = {
  reactants: 'Reactants: molecules',
  separate: 'Breaking: molecules split into atoms',
  recombine: 'Recombining: atoms bond again',
  products: 'Products: new molecules',
};

export const radiusOf = (label: string): number => ATOM_RADII[label] ?? DEFAULT_RADIUS;

/**
 * 按原子填充色的相对亮度自动选取标注颜色。
 * 原子底色固定（不随主题变化），故此处不能用主题令牌，必须黑白二选一。
 */
function readableOn(hex: string): string {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const chan = (i: number) => parseInt(n.slice(i * 2, i * 2 + 2), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(chan(0)) + 0.7152 * lin(chan(1)) + 0.0722 * lin(chan(2));
  return L > 0.35 ? '#111111' : '#ffffff';
}

/** 单个分子内部排布：1 原子居中；2 原子左右相切；3 原子以最大原子为中心呈 104.5° 弯曲（H₂O 形状） */
export function layoutInMolecule(atoms: AtomSpec[]): Pt[] {
  const r = atoms.map((a) => radiusOf(a.label));
  if (atoms.length <= 1) return [{ x: 0, y: 0 }];
  if (atoms.length === 2) {
    const half = (r[0] + r[1]) / 2;
    return [{ x: -half, y: 0 }, { x: half, y: 0 }];
  }
  // 取半径最大者为中心原子（H₂O 里是 O）
  let c = 0;
  for (let i = 1; i < r.length; i++) if (r[i] > r[c]) c = i;
  const halfAngle = ((104.5 / 2) * Math.PI) / 180;
  // 旁位原子按出现次序左右交替排布——不可用 `i < c` 判定，否则中心原子位于索引 0 时
  // 所有旁位原子都会被放到同一侧而互相重叠（H₂O 的两个 H 会重合，键角退化为 0°）
  let side = 0;
  return atoms.map((_, i) => {
    if (i === c) return { x: 0, y: 0 };
    const d = r[c] + r[i];
    const sign = side % 2 === 0 ? -1 : 1;
    side += 1;
    return { x: sign * d * Math.sin(halfAngle), y: -d * Math.cos(halfAngle) };
  });
}

/** 分子外接半径（自身中心到最远原子外缘），用于同一排内相切排布 */
function outerRadiusOf(mol: MoleculeSpec): number {
  const rel = layoutInMolecule(mol.atoms);
  let m = 0;
  mol.atoms.forEach((a, i) => {
    const d = Math.hypot(rel[i].x, rel[i].y) + radiusOf(a.label);
    if (d > m) m = d;
  });
  return m;
}

/** 把一组分子沿水平带依次排布（互不相切但成组相邻），返回各自中心与每个原子的坐标 */
function placeSet(molecules: MoleculeSpec[]): { centres: Pt[]; atoms: Map<string, Pt> } {
  const outers = molecules.map(outerRadiusOf);
  const total = outers.reduce((s, o) => s + 2 * o, 0) + MOL_GAP * Math.max(0, outers.length - 1);
  let cursor = (VIEW_W - total) / 2;
  const centres: Pt[] = [];
  const atoms = new Map<string, Pt>();
  molecules.forEach((mol, mi) => {
    cursor += outers[mi];
    const cx = cursor;
    centres.push({ x: cx, y: BAND_Y });
    const rel = layoutInMolecule(mol.atoms);
    mol.atoms.forEach((a, ai) => {
      atoms.set(a.id, { x: cx + rel[ai].x, y: BAND_Y + rel[ai].y });
    });
    cursor += outers[mi] + MOL_GAP;
  });
  return { centres, atoms };
}

export default function MicroAnimation({ reactants, products, duration = 2000 }: MicroAnimationProps) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef(0);
  const fromRef = useRef(0);
  const phase = PHASES[phaseIdx];
  const isLast = phaseIdx === PHASES.length - 1;

  // 三种结合状态的坐标：反应物分子 / 自由原子散开 / 生成物分子
  const geo = useMemo(() => {
    const react = placeSet(reactants);
    const prod = placeSet(products);
    // 反应物原子扁平表（生成物与反应物的原子 id 一一对应，守恒）
    const flat: AtomSpec[] = [];
    reactants.forEach((m) => m.atoms.forEach((a) => flat.push(a)));

    // 解离态：每个原子背离自身分子质心外移 SPREAD；质心与原子重合时（单原子微粒）用黄金角散开
    const spread = new Map<string, Pt>();
    reactants.forEach((mol) => {
      const ps = mol.atoms.map((a) => react.atoms.get(a.id) as Pt);
      const bx = ps.reduce((s, p) => s + p.x, 0) / ps.length;
      const by = ps.reduce((s, p) => s + p.y, 0) / ps.length;
      mol.atoms.forEach((a, i) => {
        let dx = ps[i].x - bx;
        let dy = ps[i].y - by;
        const len = Math.hypot(dx, dy);
        if (len < 0.6) {
          const ang = ((flat.findIndex((f) => f.id === a.id) * 137.508) * Math.PI) / 180;
          dx = Math.cos(ang);
          dy = Math.sin(ang);
        } else {
          dx /= len;
          dy /= len;
        }
        spread.set(a.id, { x: ps[i].x + dx * SPREAD, y: ps[i].y + dy * SPREAD });
      });
    });
    return { react, prod, flat, spread };
  }, [reactants, products]);

  /** 归一化进度 t 处的原子坐标：先「分子 → 自由原子」，再「自由原子 → 生成物」 */
  const posAt = (id: string, k: number): Pt => {
    const p0 = geo.react.atoms.get(id) as Pt;
    const p1 = geo.spread.get(id) as Pt;
    const p2 = geo.prod.atoms.get(id) as Pt;
    const u = Math.min(1, k / SPREAD_T);
    const v = k <= SPREAD_T ? 0 : (k - SPREAD_T) / (1 - SPREAD_T);
    return {
      x: p0.x + (p1.x - p0.x) * u + (p2.x - p1.x) * v,
      y: p0.y + (p1.y - p0.y) * u + (p2.y - p1.y) * v,
    };
  };

  // 进度过渡：阶段切换时把 t 平滑推到该阶段的目标值
  useEffect(() => {
    const target = PHASE_T[phase];
    const from = fromRef.current;
    fromRef.current = target;
    if (from === target) return;
    // 减动效：跳过离散插值，直接呈现目标阶段的稳定态（阶段 3 即产物结合态）
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setT(target);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOutQuad
      setT(from + (target - from) * e);
      if (k < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, duration]);

  // 播放：按 duration 自动推进到下一阶段
  useEffect(() => {
    if (!playing) return;
    if (isLast) {
      setPlaying(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      setPhaseIdx((i) => Math.min(i + 1, PHASES.length - 1));
    }, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, phaseIdx, isLast, duration]);

  const goTo = (idx: number) => {
    setPlaying(false);
    setPhaseIdx(Math.max(0, Math.min(idx, PHASES.length - 1)));
  };

  // 简单双语：根据浏览器语言（组件内部不依赖 context，保持轻量）
  const isZh = typeof navigator !== 'undefined' && /zh/i.test(navigator.language || '');
  const label = isZh ? PHASE_ZH[phase] : PHASE_EN[phase];
  const btnPlay = isZh ? (playing ? '暂停' : '播放') : playing ? 'Pause' : 'Play';
  const btnReplay = isZh ? '重播' : 'Replay';

  // 分子式标注：反应物侧随解离淡出，生成物侧随重组淡入（用 t 驱动，不用 phase 门控）
  const reactLabelOpacity = Math.max(0, 1 - t / SPREAD_T);
  const prodLabelOpacity = Math.max(0, Math.min(1, (t - SPREAD_T) / (1 - SPREAD_T)));
  const conservationVisible = t > 0.22 && t < 0.88;

  return (
    <div className="border border-[var(--border)] p-3 space-y-3">
      {/* 阶段指示 + 标题 */}
      <div className="flex items-center justify-between">
        <div className="text-[0.6875rem] mono-font text-[var(--muted)] tracking-widest">
          // {label}
        </div>
        {/* 阶段进度点 */}
        <div className="flex items-center gap-1.5" role="img" aria-label={`${phaseIdx + 1}/${PHASES.length}`}>
          {PHASES.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i <= phaseIdx ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
              }`}
            />
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full" aria-label="微观粒子动画">
        {/* 分子式标注：反应物（上）与生成物（下）交叉淡入淡出 */}
        {reactants.map((mol, mi) => (
          <text key={`rl${mi}`} x={geo.react.centres[mi].x} y={20} textAnchor="middle"
            fill="var(--muted)" fontSize={10} className="mono-font" opacity={reactLabelOpacity}>
            {mol.label}
          </text>
        ))}
        {products.map((mol, mi) => (
          <text key={`pl${mi}`} x={geo.prod.centres[mi].x} y={VIEW_H - 8} textAnchor="middle"
            fill="var(--muted)" fontSize={10} className="mono-font" opacity={prodLabelOpacity}>
            {mol.label}
          </text>
        ))}

        {/* 全部粒子始终在场：位置由归一化进度 t 连续插值，不存在空白帧 */}
        {geo.flat.map((a) => {
          const p = posAt(a.id, t);
          const r = radiusOf(a.label);
          const fs = Math.max(7, r * 0.92);
          return (
            <g key={a.id}>
              <circle cx={p.x} cy={p.y} r={r} fill={a.color} opacity={0.85} />
              <text x={p.x} y={p.y + fs * 0.34} textAnchor="middle"
                fill={readableOn(a.color)} fontSize={fs} className="mono-font font-bold">
                {a.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 守恒提示（在解离/重组中段出现，位置用 t 驱动） */}
      <p className="text-[0.625rem] mono-font text-[var(--muted)] text-center transition-opacity"
        style={{ opacity: conservationVisible ? 1 : 0 }}>
        {isZh ? '原子种类和数目不变' : 'Atom kinds and counts stay the same'}
      </p>

      {/* 控制条 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => (playing ? setPlaying(false) : setPlaying(true))}
          className="px-3 py-1 text-[0.6875rem] border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--card-bg)] transition-colors"
        >
          {btnPlay}
        </button>
        <button
          type="button"
          onClick={() => goTo(phaseIdx - 1)}
          disabled={phaseIdx === 0}
          className="px-2.5 py-1 text-[0.6875rem] border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors disabled:opacity-40"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => goTo(phaseIdx + 1)}
          disabled={isLast}
          className="px-2.5 py-1 text-[0.6875rem] border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors disabled:opacity-40"
        >
          →
        </button>
        <button
          type="button"
          onClick={() => goTo(0)}
          className="px-2.5 py-1 text-[0.6875rem] border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
        >
          {btnReplay}
        </button>
      </div>
    </div>
  );
}
