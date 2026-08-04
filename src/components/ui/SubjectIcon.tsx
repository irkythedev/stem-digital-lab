/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 科目图标：数学用 π 字形，物理用 Atom（原子），化学用 FlaskConical（锥形瓶）。
 * 统一由此渲染器输出，保证三科图标在首页/科目页/实验页全站一致。
 */
import { Atom, FlaskConical } from 'lucide-react';
import type { SubjectId } from '../../lib/subjects';

const LUCIDE_ICONS = {
  physics: Atom,
  chemistry: FlaskConical,
} as const;

interface SubjectIconProps {
  subjectId: SubjectId;
  /** lucide 图标的尺寸/描边类（物理、化学） */
  className?: string;
  /** π 字形的字体类（数学）；缺省时复用 className */
  glyphClassName?: string;
}

export default function SubjectIcon({ subjectId, className = '', glyphClassName }: SubjectIconProps) {
  if (subjectId === 'math') {
    return (
      <span
        className={`serif-font font-light leading-none select-none tracking-tighter ${glyphClassName ?? className}`}
        aria-hidden="true"
      >
        π
      </span>
    );
  }
  const Icon = LUCIDE_ICONS[subjectId as keyof typeof LUCIDE_ICONS];
  return <Icon className={className} />;
}
