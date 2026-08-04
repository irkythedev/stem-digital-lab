/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 科目/实验页标题：学科 icon 与学科名在同一行，年级（或路径标识）显示其下。
 * 这属于"页面导航性顶部"，不构成"实验内容模板"；每个实验的主体仍各自独立布局。
 */
import SubjectIcon from '../ui/SubjectIcon';
import type { SubjectId } from '../../lib/subjects';

interface SubjectHeadingProps {
  subjectId: SubjectId;
  name: string;
  /** 显示在学科名下方的一行：年级或路径标识 */
  caption?: string;
}

export default function SubjectHeading({ subjectId, name, caption }: SubjectHeadingProps) {
  return (
    <div className="flex items-center space-x-4">
      <div className="w-12 h-12 shrink-0 flex items-center justify-center text-[var(--fg)]">
        <SubjectIcon subjectId={subjectId} className="w-10 h-10 stroke-[1.0]" glyphClassName="text-4xl" />
      </div>
      <div className="flex flex-col items-start leading-tight">
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight serif-font text-[var(--fg)]">
          {name}
        </h1>
        {caption && (
          <span className="text-[11px] mt-1 uppercase tracking-widest text-[var(--muted)] mono-font">
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}
