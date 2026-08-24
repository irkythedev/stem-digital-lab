/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 微观粒子动画：化学反应中原子重新组合的可视化。
 * 显示反应物分子 → 原子分离 → 重新组合 → 生成物分子。
 * 自带可控播放：播放/暂停、上一步/下一步步进、重播、阶段指示。
 *
 * 视觉纪律：只用 --fg / --muted / --border / --accent。
 */

import { useEffect, useRef, useState } from 'react';

interface Atom {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
}

interface Molecule {
  atoms: string[]; // atom ids
}

interface MicroAnimationProps {
  /** 反应物分子描述：{ label, atoms: {id, label, color}[] } */
  reactants: { label: string; atoms: { id: string; label: string; color: string }[] }[];
  /** 生成物分子描述 */
  products: { label: string; atoms: { id: string; label: string; color: string }[] }[];
  /** 播放阶段间隔 ms */
  duration?: number;
}

type Phase = 'reactants' | 'separate' | 'recombine' | 'products';

const PHASES: Phase[] = ['reactants', 'separate', 'recombine', 'products'];

/** 阶段文案（中文） */
const PHASE_ZH: Record<Phase, string> = {
  reactants: '反应物',
  separate: '原子分离...',
  recombine: '原子重新组合...',
  products: '生成物',
};

/** 阶段文案（英文） */
const PHASE_EN: Record<Phase, string> = {
  reactants: 'Reactants',
  separate: 'Atoms separating...',
  recombine: 'Atoms recombining...',
  products: 'Products',
};

export default function MicroAnimation({ reactants, products, duration = 2000 }: MicroAnimationProps) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phase = PHASES[phaseIdx];
  const isLast = phaseIdx === PHASES.length - 1;

  // 播放：自动按 duration 推进到下一阶段
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

  // 播放完成（到达最后阶段且停止时）停留在 products，方便讲解
  const goTo = (idx: number) => {
    setPlaying(false);
    setPhaseIdx(Math.max(0, Math.min(idx, PHASES.length - 1)));
  };

  // 收集所有原子
  const allAtoms: Atom[] = [];
  const atomMap = new Map<string, Atom>();

  reactants.forEach((mol, mi) => {
    mol.atoms.forEach((a, ai) => {
      const atom: Atom = {
        id: a.id,
        label: a.label,
        color: a.color,
        x: 60 + mi * 120 + ai * 30,
        y: 60,
      };
      allAtoms.push(atom);
      atomMap.set(a.id, atom);
    });
  });

  // 生成物原子位置
  products.forEach((mol, mi) => {
    mol.atoms.forEach((a, ai) => {
      const existing = atomMap.get(a.id);
      if (existing) {
        existing.x = 60 + mi * 120 + ai * 30;
        existing.y = 60;
      }
    });
  });

  const phaseLabel = useRef<{ zh: string; en: string }>({ zh: '', en: '' });
  // 简单双语：根据浏览器语言（组件内部不依赖 context，保持轻量）
  const isZh = typeof navigator !== 'undefined' && /zh/i.test(navigator.language || '');
  phaseLabel.current = { zh: PHASE_ZH[phase], en: PHASE_EN[phase] };

  const label = isZh ? phaseLabel.current.zh : phaseLabel.current.en;
  const btnPlay = isZh ? (playing ? '暂停' : '播放') : playing ? 'Pause' : 'Play';
  const btnReplay = isZh ? '重播' : 'Replay';

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

      <svg viewBox="0 0 400 150" className="w-full" aria-label="微观粒子动画">
        {/* 反应物分子 */}
        {phase === 'reactants' &&
          reactants.map((mol, mi) => (
            <g key={mi}>
              <text x={60 + mi * 120} y={20} textAnchor="middle"
                fill="var(--muted)" fontSize={10} className="mono-font">
                {mol.label}
              </text>
              {mol.atoms.map((a, ai) => (
                <g key={a.id}>
                  <circle cx={60 + mi * 120 + ai * 30} cy={60} r={12}
                    fill={a.color} opacity={0.8} />
                  <text x={60 + mi * 120 + ai * 30} y={64} textAnchor="middle"
                    fill="#fff" fontSize={10} className="mono-font font-bold">
                    {a.label}
                  </text>
                </g>
              ))}
              {mol.atoms.length > 1 && (
                <line x1={60 + mi * 120} y1={60}
                  x2={60 + mi * 120 + (mol.atoms.length - 1) * 30} y2={60}
                  stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="3 2" />
              )}
            </g>
          ))}

        {/* 原子分离：原子散开（轻微分散） */}
        {phase === 'separate' &&
          allAtoms.map((a) => (
            <g key={a.id}>
              <circle cx={a.x + 8} cy={a.y + 12} r={12}
                fill={a.color} opacity={0.8} />
              <text x={a.x + 8} y={a.y + 16} textAnchor="middle"
                fill="#fff" fontSize={10} className="mono-font font-bold">
                {a.label}
              </text>
            </g>
          ))}
        {phase === 'separate' && (
          <text x={200} y={120} textAnchor="middle"
            fill="var(--muted)" fontSize={11} className="mono-font">
            {isZh ? '原子种类和数目不变' : 'Atom kinds and counts stay the same'}
          </text>
        )}

        {/* 重新组合 */}
        {phase === 'recombine' && (
          <text x={200} y={75} textAnchor="middle"
            fill="var(--accent)" fontSize={11} className="mono-font">
            {isZh ? '原子重新组合成新分子...' : 'Atoms recombine into new molecules...'}
          </text>
        )}

        {/* 生成物分子 */}
        {phase === 'products' &&
          products.map((mol, mi) => (
            <g key={mi}>
              <text x={60 + mi * 120} y={20} textAnchor="middle"
                fill="var(--muted)" fontSize={10} className="mono-font">
                {mol.label}
              </text>
              {mol.atoms.map((a, ai) => (
                <g key={a.id}>
                  <circle cx={60 + mi * 120 + ai * 30} cy={60} r={12}
                    fill={a.color} opacity={0.8} />
                  <text x={60 + mi * 120 + ai * 30} y={64} textAnchor="middle"
                    fill="#fff" fontSize={10} className="mono-font font-bold">
                    {a.label}
                  </text>
                </g>
              ))}
              {mol.atoms.length > 1 && (
                <line x1={60 + mi * 120} y1={60}
                  x2={60 + mi * 120 + (mol.atoms.length - 1) * 30} y2={60}
                  stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="3 2" />
              )}
            </g>
          ))}
      </svg>

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
