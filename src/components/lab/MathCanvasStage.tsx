/**
 * 数学实验全画布工作台外壳。
 *
 * 移动端保持实验原有的流式布局；桌面端（md+）只提供：
 * - 一行紧凑页头；
 * - 100% 满铺、圆角、无滚动的画布舞台；
 * 具体 HUD 分区由实验通过 children 内部绝对定位组合，保证每个实验可复用同一外壳。
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import ShareInline from '../share/ShareInline';
import AskAiButton from '../ai/AskAiButton';
import AskQuizButton from '../ai/AskQuizButton';

export interface MathCanvasStageProps {
  title: string;
  grade: string;
  backHref: string;
  backLabel: string;
  labId: string;
  aiQuestion: string;
  shareTitle?: string;
  shareText?: string;
  icon?: ReactNode;
  /** 中区三幕导航；放在页面一字顶栏，绝不进入画布内部 */
  center?: ReactNode;
  /** sheet: 无界画板模式；default: 旧工作台模式 */
  variant?: 'default' | 'sheet';
  children: ReactNode;
}

export default function MathCanvasStage({
  title,
  grade,
  backHref,
  backLabel,
  labId,
  aiQuestion,
  shareTitle,
  shareText,
  icon,
  center,
  variant = 'default',
  children,
}: MathCanvasStageProps) {
  return (
    <>
      {/* 桌面/横屏：极简一字页头；移动端隐藏，保留 LabPage 的原始标题区 */}
      <header className={variant === 'sheet'
        ? 'hidden h-12 w-full shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--card-bg)] px-4 lg:flex'
        : 'mx-auto hidden w-full max-w-[1400px] shrink-0 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-1 py-1 lg:grid xl:h-12 xl:grid-cols-[1fr_auto_1fr] xl:py-0'}>
        <div className="flex min-w-0 items-center gap-2 lg:justify-self-start">
          <Link
            to={backHref}
            className="inline-flex shrink-0 items-center gap-0.5 text-xs mono-font text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>
          <span className="h-4 w-px bg-[var(--border)]" aria-hidden="true" />
          {icon ? <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[var(--fg)]">{icon}</span> : null}
          <h1 className="truncate text-sm font-semibold serif-font text-[var(--fg)]">{title}</h1>
          <span className="hidden shrink-0 rounded border border-[var(--border)] px-1.5 py-0.5 text-[0.5625rem] mono-font text-[var(--muted)] lg:inline">
            {grade}
          </span>
        </div>
        <div className={variant === 'sheet' ? 'flex flex-1 justify-center px-4' : 'flex justify-self-center lg:col-span-2 lg:row-start-2 xl:col-span-1 xl:col-start-2 xl:row-start-1'}>{center}</div>
        <div className={`flex shrink-0 items-center gap-1.5 ${variant === 'sheet' ? '' : 'justify-self-end lg:col-start-2 lg:row-start-1 xl:col-start-3'}`}>
          <ShareInline labId={labId} labName={{ zh: title, en: title }} title={shareTitle} text={shareText} />
          <AskAiButton labId={labId} question={aiQuestion} />
          <AskQuizButton />
        </div>
      </header>

      <section className={variant === 'sheet'
        ? 'relative flex-1 min-h-0 w-full overflow-hidden bg-[var(--card-bg)]'
        : 'relative w-full lg:mx-auto lg:h-[calc(100vh-157px)] xl:h-[calc(100vh-116px)] lg:min-h-[560px] lg:max-h-[800px] lg:max-w-[1400px] lg:overflow-hidden lg:rounded-xl lg:border lg:border-[var(--border)] lg:bg-[var(--card-bg)]'}>
        {children}
      </section>
    </>
  );
}
