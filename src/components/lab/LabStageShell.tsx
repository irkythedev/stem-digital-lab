import type { ReactNode } from 'react';
import MathCanvasStage from './MathCanvasStage';
import { useApp } from '../../lib/app-context';

export interface LabStageShellProps {
  titleZh: string;
  titleEn: string;
  labId: string;
  variant: 'default' | 'sheet';
  children: ReactNode;
  center?: ReactNode;
  icon?: ReactNode;
}

/**
 * 数学实验统一页面壳：只负责页头/视口，不改变实验内部业务模块。
 * 几何实验复用此壳后，桌面宽度和高度由 MathCanvasStage 统一收敛。
 */
export default function LabStageShell({ titleZh, titleEn, labId, variant, children, center, icon }: LabStageShellProps) {
  const { lang } = useApp();
  const title = lang === 'zh' ? titleZh : titleEn;
  return (
    <MathCanvasStage
      variant={variant}
      title={title}
      grade={lang === 'zh' ? '7-9 年级' : 'Grades 7-9'}
      backHref="/subject/math"
      backLabel={lang === 'zh' ? '返回数学' : 'Back to Math'}
      labId={labId}
      aiQuestion={lang === 'zh' ? `请讲解${titleZh}实验的原理与观察重点` : `Explain the ${titleEn} lab and what to observe`}
      shareTitle={`${title} · ${lang === 'zh' ? '数理化数字实验室' : 'STEM Digital Lab'}`}
      icon={icon}
      center={center}
    >
      {children}
    </MathCanvasStage>
  );
}
