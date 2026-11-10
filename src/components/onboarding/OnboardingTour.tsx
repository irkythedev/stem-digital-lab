/**
 * 首页首次访问引导：聚光灯挖孔 + 响应式说明卡。
 * 不引入第三方库；目标元素用 data-tour 定位；目标缺失时退化为居中模态。
 */
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { useEscapeKey } from '../../lib/use-escape-key';
import { ONBOARDING_STEP_EVENT, ONBOARDING_TOTAL_STEPS } from '../../lib/use-onboarding-tour';

interface TourStep {
  selector: string;
  title: { zh: string; en: string };
  body: { zh: string; en: string };
}

const STEPS: TourStep[] = [
  {
    selector: '[data-tour="subject-cards"]',
    title: { zh: '选择学科与实验', en: 'CHOOSE A SUBJECT & LAB' },
    body: {
      zh: '点击数、理、化学科进入实验列表，或直接展开下拉菜单快速跳转。你也可以开启「BETA」开关解锁新增的进阶几何实验。',
      en: 'Click Math, Physics or Chemistry to open its lab list, or expand the dropdown to jump straight in. You can also turn on the BETA switch to unlock the new advanced geometry labs.',
    },
  },
  {
    selector: '[data-tour="lab-entry"]',
    title: { zh: '预测 → 探索 → 结论', en: 'PREDICT → EXPLORE → CONCLUDE' },
    body: {
      zh: '每个实验都遵循三幕式设计：先独立做出预测，再动手拖拽画布参数观察规律，最后归纳结论，把抽象公式变成直观直觉。',
      en: 'Every lab follows a three-act flow: make a prediction first, drag the canvas parameters to discover the pattern, then conclude — turning abstract formulas into intuition.',
    },
  },
  {
    selector: '[data-tour="header-tools"]',
    title: { zh: '启发式 AI 助教与工具栏', en: 'HEURISTIC AI & TOOLS' },
    body: {
      zh: '实验遇到卡点时，点击右上角「AI 助教」可结合当前画布读数获取思考线索（不会直接剧透答案）。右上角还可随时切换中英文、深浅色主题或重看本指南。',
      en: 'When a lab gets tricky, use the AI assistant in the top-right for hints based on the current canvas readings (without spoiling the answer). The same toolbar switches language, theme and replays this guide.',
    },
  },
  {
    selector: '[data-tour="more-works"]',
    title: { zh: '作者更多作品', en: 'MORE BY RICKY' },
    body: {
      zh: '页脚的「其他作品」里有作者更多数理化互动作品，可随时展开查看，再决定是否前往。',
      en: 'The “Other Works” button in the footer opens more interactive math and science projects by the author — browse first, then decide whether to visit.',
    },
  },
];

interface SpotlightRect { left: number; top: number; width: number; height: number; }
interface Props { active: boolean; step: number; onNext: () => void; onPrev: () => void; onSkip: () => void; onFinish: () => void; }

function findTarget(selector: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  let el = document.querySelector<HTMLElement>(selector);
  if (el && el.getBoundingClientRect().width >= 8 && el.getBoundingClientRect().height >= 8) return el;
  // 首次展开展示列表前，lab-entry 可能还没有高度：回退到学科卡片区。
  if (selector === '[data-tour="lab-entry"]') {
    const subjectCards = document.querySelector<HTMLElement>('[data-tour="subject-cards"]');
    if (subjectCards) return subjectCards;
  }
  if (selector === '[data-tour="more-works"]') {
    const trigger = document.querySelector<HTMLElement>('[data-tour="more-works-trigger"]');
    if (trigger) return trigger;
  }
  return el;
}

export default function OnboardingTour({ active, step, onNext, onPrev, onSkip, onFinish }: Props) {
  const { lang } = useApp();
  const zh = lang === 'zh';
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 390,
    height: typeof window !== 'undefined' ? window.innerHeight : 844,
  }));

  const safeStep = Math.max(0, Math.min(ONBOARDING_TOTAL_STEPS - 1, step));
  const current = STEPS[safeStep];
  useEscapeKey(onSkip, active);

  useEffect(() => {
    if (!active) return;
    const syncViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    syncViewport();
    const onKeyDown = (event: KeyboardEvent) => {
      const targetTag = event.target instanceof HTMLElement ? event.target.tagName : '';
      if (event.key === 'ArrowRight' || (event.key === 'Enter' && !/^(BUTTON|INPUT|TEXTAREA|SELECT)$/.test(targetTag))) {
        event.preventDefault();
        onNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onPrev();
      }
    };
    window.addEventListener('resize', syncViewport);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [active, onNext, onPrev]);

  useEffect(() => {
    if (!active) { setRect(null); return; }
    let raf = 0;
    let timer = 0;
    const measure = () => {
      const el = findTarget(current.selector);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) { setRect(null); return; }
      setRect({ left: r.left - 6, top: r.top - 6, width: r.width + 12, height: r.height + 12 });
    };
    const kick = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { measure(); raf = requestAnimationFrame(measure); });
    };
    const el = findTarget(current.selector);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    timer = window.setTimeout(measure, 80);
    kick();
    window.addEventListener('resize', kick);
    window.addEventListener('scroll', kick, true);
    window.dispatchEvent(new CustomEvent(ONBOARDING_STEP_EVENT, { detail: { step: safeStep } }));
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', kick);
      window.removeEventListener('scroll', kick, true);
    };
  }, [active, current.selector, safeStep]);

  if (!active || typeof document === 'undefined') return null;

  const isMobile = viewport.width < 640;
  const cardWidth = 360;
  const estimatedCardHeight = 184;
  const desktopLeft = rect ? Math.max(16, Math.min(viewport.width - cardWidth - 16, rect.left)) : 16;
  const belowTop = rect ? rect.top + rect.height + 14 : 0;
  const desktopTop = rect
    ? (belowTop + estimatedCardHeight <= viewport.height - 16
      ? belowTop
      : Math.max(12, rect.top - estimatedCardHeight - 14))
    : 24;
  const cardStyle = isMobile
    ? undefined
    : rect
      ? { left: desktopLeft, top: desktopTop, width: cardWidth }
      : { left: '50%', top: '50%', width: cardWidth, transform: 'translate(-50%, -50%)' };

  return createPortal(
    <div className="fixed inset-0 z-[90] pointer-events-none" data-onboarding-tour="true">
      {rect ? (
        <div
          className="fixed pointer-events-none z-[90] rounded-xl transition-all duration-300"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            border: '1.5px solid var(--fg)',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.48), inset 0 0 0 2px var(--card-bg)',
          }}
          aria-hidden="true"
        />
      ) : (
        <div className="fixed inset-0 z-[90] bg-black/48" aria-hidden="true" />
      )}

      {/* 聚光灯内的目标本身也不允许点击：透明拦截层压住整个页面，只有说明卡在 z-[95] 可交互。 */}
      <div className="fixed inset-0 z-[91] pointer-events-auto" aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={zh ? '首页新手引导' : 'Home onboarding tour'}
        className={`pointer-events-auto fixed z-[95] bg-[var(--card-bg)] text-[var(--fg)] border border-[var(--fg)] rounded-xl p-4 shadow-xl ${isMobile ? 'left-3 right-3 bottom-4 w-auto max-w-none' : ''}`}
        style={cardStyle}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 mono-font text-[0.625rem] text-[var(--muted)]">
            <span>{String(safeStep + 1).padStart(2, '0')}</span>
            <span className="flex items-center gap-1.5" aria-hidden="true">
              {Array.from({ length: ONBOARDING_TOTAL_STEPS }, (_, i) => (
                <span key={i} className={i === safeStep ? 'w-4 h-1.5 rounded-full bg-[var(--fg)]' : 'w-1.5 h-1.5 rounded-full bg-[var(--border)]'} />
              ))}
            </span>
          </div>
          <button type="button" onClick={onSkip} className="h-6 px-2 text-xs text-[var(--muted)] hover:text-[var(--fg)] rounded transition-colors">
            {zh ? '跳过' : 'Skip'}
          </button>
        </div>
        <h2 className="mt-3 font-medium text-sm mb-1">{current.title[zh ? 'zh' : 'en']}</h2>
        <p className="text-xs text-[var(--muted)] leading-relaxed">{current.body[zh ? 'zh' : 'en']}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onPrev}
            disabled={safeStep === 0}
            title={zh ? '上一步' : 'Previous'}
            aria-label={zh ? '上一步' : 'Previous'}
            className={`h-7 w-7 rounded-md border border-[var(--border)] inline-flex items-center justify-center transition-colors ${safeStep === 0 ? 'invisible pointer-events-none' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--fg)]'}`}
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={safeStep === ONBOARDING_TOTAL_STEPS - 1 ? onFinish : onNext}
            className="h-7 px-3 rounded-md border border-[var(--fg)] bg-[var(--fg)] text-[var(--card-bg)] text-xs mono-font font-bold transition-opacity hover:opacity-85 inline-flex items-center gap-1.5"
          >
            {safeStep === ONBOARDING_TOTAL_STEPS - 1 ? (
              <><span>{zh ? '开始探索' : 'Get Started'}</span><Check className="w-3.5 h-3.5" aria-hidden="true" /></>
            ) : (
              <span>{zh ? '下一步' : 'Next'}</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
