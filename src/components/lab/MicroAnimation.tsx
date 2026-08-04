/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 微观粒子动画：化学反应中原子重新组合的可视化。
 * 显示反应物分子 → 原子分离 → 重新组合 → 生成物分子。
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
  /** 是否播放动画 */
  playing?: boolean;
  /** 播放完成后回调 */
  onComplete?: () => void;
}

type Phase = 'reactants' | 'separate' | 'recombine' | 'products';

const DURATION = 2000; // 每阶段 ms

export default function MicroAnimation({
  reactants,
  products,
  playing = false,
  onComplete,
}: MicroAnimationProps) {
  const [phase, setPhase] = useState<Phase>('reactants');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!playing) {
      setPhase('reactants');
      return;
    }
    setPhase('reactants');
    timerRef.current = setTimeout(() => {
      setPhase('separate');
      timerRef.current = setTimeout(() => {
        setPhase('recombine');
        timerRef.current = setTimeout(() => {
          setPhase('products');
          onComplete?.();
        }, DURATION);
      }, DURATION);
    }, DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, onComplete]);

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

  const phaseLabel =
    phase === 'reactants'
      ? '反应物'
      : phase === 'separate'
        ? '原子分离...'
        : phase === 'recombine'
          ? '原子重新组合...'
          : '生成物';

  return (
    <div className="border border-[var(--border)] p-3">
      <div className="text-[11px] mono-font text-[var(--muted)] tracking-widest mb-2">
        // {phaseLabel}
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
              {/* 化学键 */}
              {mol.atoms.length > 1 && (
                <line x1={60 + mi * 120} y1={60}
                  x2={60 + mi * 120 + (mol.atoms.length - 1) * 30} y2={60}
                  stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="3 2" />
              )}
            </g>
          ))}

        {/* 原子分离（散开） */}
        {phase === 'separate' &&
          allAtoms.map((a, i) => (
            <g key={a.id}>
              <circle cx={40 + i * 50} cy={70} r={12}
                fill={a.color} opacity={0.8} />
              <text x={40 + i * 50} y={74} textAnchor="middle"
                fill="#fff" fontSize={10} className="mono-font font-bold">
                {a.label}
              </text>
            </g>
          ))}

        {/* 重新组合（过渡） */}
        {phase === 'recombine' && (
          <>
            {allAtoms.map((a, i) => (
              <g key={a.id}>
                <circle cx={40 + i * 50} cy={70} r={12}
                  fill={a.color} opacity={0.6} />
                <text x={40 + i * 50} y={74} textAnchor="middle"
                  fill="#fff" fontSize={10} className="mono-font font-bold">
                  {a.label}
                </text>
              </g>
            ))}
            <text x={200} y={110} textAnchor="middle"
              fill="var(--accent)" fontSize={11} className="mono-font">
              原子种类和数目不变
            </text>
          </>
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
    </div>
  );
}
