/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 顶部导航栏：品牌标识 + 语言切换 + 主题切换。
 * 从原 App.tsx 抽出，状态改由全局 useApp() 提供。
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon, Monitor , Sparkles, CircleCheck, WifiOff, CirclePlay, HelpCircle, RotateCw } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { useAiContext } from '../../lib/ai-context';
import {
  AI_STATUS_DETAIL,
  AI_STATUS_DOT,
  AI_STATUS_HOLLOW,
  AI_STATUS_LABEL,
  AI_STATUS_TTL_MS,
  aiCheckedAtLabel,
  isHollowStatus,
  isStatusFresh,
  useAiStatus,
  verifyAiStatus,
} from '../../lib/ai-status';
import { loadAiConfig } from '../../lib/ai-config';
import { APP_VERSION } from '../../lib/changelog';
import { useAppUpdate } from '../../lib/use-app-update';
import { ringStateFor, type RingState } from '../../lib/update-progress';
import VersionDialog from '../feedback/VersionDialog';
import OfflinePackPanel from '../feedback/OfflinePackPanel';
import { useOfflinePack } from '../../lib/use-offline-pack';
import type { ThemeMode } from '../../lib/app-context';
import type { AiStatus } from '../../lib/ai-status';

/**
 * 更新环几何（viewBox 18 单位，随徽章 14 / 18px 等比缩放）：
 * stroke 2.2 在 18px 下渲染 2.2px、在 14px 下渲染 1.71px —— 与候选实测的 0.12 比例一致。
 * 弧长按周长算：determinate 用 dashoffset 表达进度，indeterminate 只画 30% 并整体旋转。
 */
const UPDATE_RING_R = 7.7;
const UPDATE_RING_STROKE = 2.2;
const UPDATE_RING_C = 2 * Math.PI * UPDATE_RING_R;

/**
 * 更新徽章的可视部分。两个入口共用一份：
 *   - 顶栏版本号右侧的徽章（≥sm 可见）
 *   - logo 右上角的角标（<sm 可见；以前那块只有静态圆盘，现在同样跟着变进度环）
 * 之所以共用：形态映射只该有一处，否则两处迟早走偏（一个画弧、一个还在转箭头）。
 *
 * idle = 实心圆盘 + 白色上箭头 + 一圈从盘缘向外推开的呼吸环；
 * 忙时圆盘让位给空心环，弧长＝已落实的预缓存条目比例；
 * 没有分母的阶段（checking / activating）只走一段扫动弧，绝不按时长插值。
 */
function UpdateBadgeVisual({
  ring,
  arrowClass,
  arrowStroke,
}: {
  ring: RingState;
  arrowClass: string;
  arrowStroke: number;
}) {
  if (ring.mode === 'hidden') {
    return (
      <>
        {/* 呼吸环与圆盘同尺寸起跳（h-full/w-full 继承外层的 14 / 18px），
            几何和动画都写在 .update-halo 里：最大只推到 1.45 倍，不出命中盒。 */}
        <span
          aria-hidden="true"
          className="update-halo pointer-events-none absolute inset-0 m-auto h-full w-full rounded-full text-emerald-500"
        />
        <span className="relative flex h-full w-full items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
          <svg viewBox="0 0 16 16" className={arrowClass} fill="none" stroke="currentColor" strokeWidth={arrowStroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 12V4M8 4L4.5 7.5M8 4L11.5 7.5" />
          </svg>
        </span>
      </>
    );
  }
  /* 忙时不再叠光晕：光晕会在环心填出一块底色，把 1/4 的那段弧吃掉 */
  return (
    <svg
      viewBox="0 0 18 18"
      className={`h-full w-full text-emerald-500 ${ring.mode === 'indeterminate' ? 'update-ring-spin' : ''}`}
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="update-ring-track"
        cx="9"
        cy="9"
        r={UPDATE_RING_R}
        stroke="currentColor"
        strokeWidth={UPDATE_RING_STROKE}
      />
      <circle
        className="update-ring-arc"
        cx="9"
        cy="9"
        r={UPDATE_RING_R}
        stroke="currentColor"
        strokeWidth={UPDATE_RING_STROKE}
        strokeLinecap="round"
        transform="rotate(-90 9 9)"
        strokeDasharray={
          ring.mode === 'indeterminate' ? `${UPDATE_RING_C * 0.3} ${UPDATE_RING_C}` : UPDATE_RING_C
        }
        strokeDashoffset={ring.mode === 'determinate' ? UPDATE_RING_C * (1 - ring.ratio) : 0}
      />
    </svg>
  );
}

/**
 * 健康卡片的标题：刻意不复用 AI_STATUS_LABEL——那是图标的悬浮提示（带「AI 助手（…）」外壳），
 * 卡片里需要的是「结论本身」，两套文案各自服务一处，避免一处改字另一处跟着变味。
 */
const HEALTH_TITLE: Record<AiStatus, { zh: string; en: string }> = {
  unconfigured: { zh: '尚未配置 AI 助手', en: 'AI assistant not configured' },
  configured: { zh: '待验证：还没确认能不能用', en: 'Unverified: not confirmed yet' },
  verifying: { zh: '正在验证连接…', en: 'Verifying connection…' },
  valid: { zh: '已就绪，可以对话', en: 'Ready to chat' },
  invalid: { zh: '连接异常', en: 'Connection error' },
};

export default function Header({ onOpenGuide }: { onOpenGuide?: () => void }) {
  const { t, lang, setLang, themeMode, setThemeMode, isOffline } = useApp();
  const { open: aiOpen, setOpen: setAiOpen, openSettings } = useAiContext();
  // 顶栏 AI 图标五态（unconfigured / configured / verifying / valid / invalid）——状态来自 lib/ai-status，
  // 只在「用户主动验证 / 面板首开 / 实战请求」时推进，页面加载绝不自动 Ping。标题与角标同源同一状态。
  const aiStatus = useAiStatus();
  /** 连通性健康卡片（点角标展开；不打开大面板） */
  const [showHealth, setShowHealth] = useState(false);
  const [showVersion, setShowVersion] = useState(false);
  const [showPack, setShowPack] = useState(false);

  // 卡片只在自己打开时读一次配置（端点要显示给用户排查用）；关闭即不再读
  const healthCfg = showHealth ? loadAiConfig() : null;
  const checkedStale = aiStatus.checkedAt !== null && !isStatusFresh(aiStatus.checkedAt);
  /**
   * 结论过期即降级（渲染期纯函数复核，不引定时器、不联网）。
   * 状态机只在「有事件」时重算，标签页一直开着就可能带着一条 24 小时前的结论；
   * 此前角标只读 status，于是出现「角标说已就绪、卡片说已过期」的自相矛盾。
   * 只降级 valid / invalid 两种**确定结论**：verifying 期间 checkedAt 沿用上一次的旧值，
   * 那不是"过期结论"，若一并降级会把"验证中"的呼吸环也吞掉。
   */
  const expiredConclusion = checkedStale && (aiStatus.status === 'valid' || aiStatus.status === 'invalid');
  const shownStatus: AiStatus = expiredConclusion ? 'configured' : aiStatus.status;
  const aiLabel = AI_STATUS_LABEL[shownStatus][lang].replace('{model}', aiStatus.model);
  /**
   * 过期判定是渲染期纯函数：没有重渲染就不会重算，标签页一直开着便会停在旧结论上。
   * 所以只补一个**一次性到点定时器**（不是轮询）：在 checkedAt + TTL 那一刻让这一帧重新求值。
   * 已在过去则不再排队；每次 checkedAt/status 变化都重排，清理时撤销。
   */
  const [, bumpFreshness] = useState(0);
  useEffect(() => {
    const at = aiStatus.checkedAt;
    if (at === null) return;
    const ms = at + AI_STATUS_TTL_MS - Date.now();
    if (ms <= 0) return;
    const t = setTimeout(() => bumpFreshness((n) => n + 1), ms + 50);
    return () => clearTimeout(t);
  }, [aiStatus.checkedAt, aiStatus.status]);

  // Esc 关闭健康卡片（外部点击由覆盖层负责，不挂 document 监听）
  useEffect(() => {
    if (!showHealth) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowHealth(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showHealth]);
  // 离线教学包状态：只在「下载中 / 已就绪」时于顶栏露出徽标，平时不占位置
  const { status: packStatus, progress: packProgress, running: packRunning } = useOfflinePack();

  // 更新状态机：检测（挂载 / 回前台 / 恢复联网）+ 显式阶段 + 硬兜底
  const { hasUpdate, phase, progress, applyUpdate, busy } = useAppUpdate();
  /** 徽章形态：idle 静态箭头 / 有分母时 determinate 弧 / 其余扫动弧 / reloading 满环 */
  const ring = ringStateFor(phase, progress);
  const phaseText =
    phase === 'checking' ? (lang === 'zh' ? '正在检查新版本…' : 'Checking for updates…')
      : phase === 'downloading' ? (lang === 'zh' ? '正在下载新版本…' : 'Downloading the new version…')
        : phase === 'activating' ? (lang === 'zh' ? '正在激活新版本…' : 'Activating the new version…')
          : phase === 'clearing' ? (lang === 'zh' ? '正在清理旧缓存…' : 'Clearing the old cache…')
            : phase === 'reloading' ? (lang === 'zh' ? '正在刷新…' : 'Reloading…')
              : '';

  // 单按钮循环切换：system → light → dark
  const themeOrder: ThemeMode[] = ['system', 'light', 'dark'];
  const ThemeIcon = themeMode === 'system' ? Monitor : themeMode === 'light' ? Sun : Moon;
  const cycleTheme = () => {
    const idx = themeOrder.indexOf(themeMode);
    setThemeMode(themeOrder[(idx + 1) % themeOrder.length]);
  };

  return (
    <header className="w-full border-b border-[var(--border)]/70 pb-3 sm:pb-3.5 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:pt-[calc(0.875rem+env(safe-area-inset-top,0px))] transition-colors duration-[var(--dur-base)]">
      {/* 底线满幅通栏：border 落在满宽 header 上；内容由内层容器收回正文列。
          px-6 sm:px-12 lg:px-14 = 内容列容器的 px-4/sm:px-6/lg:px-8 + <main> 的 px-2 sm:px-6。 */}
      <div className="mx-auto flex w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl items-center justify-between gap-2 px-6 sm:px-12 lg:px-14">
      {/* 左簇（品牌 + 版本号）必须锁死成一行：顶栏是 justify-between 的两组 flex 子项，
          默认 flex-shrink:1 会先压左簇；品牌文字是普通文本，一被压就在词间折行、
          版本号跟着错位。所以这里显式 nowrap + shrink-0，宁可左右组间隙变窄，
          也不让品牌行变成两行（实测 640 处两组间隔只剩 62px，字体度量一变就触界）。
          版本号**不能**挂 self-end：.tap-area 在触屏下把本行撑到 40px（桌面只有 28px），
          self-end 会把版本号钉到行底，实测下沉 6.5px —— 10px 的小字看起来就像「掉到了下一行」。 */}
      <Link to="/" className="flex flex-nowrap shrink-0 items-center gap-2 group p-1 -m-1 rounded-lg hover:bg-[var(--accent-light)]/50 transition-colors tap-area" aria-label={t.brandName}>
        <span className="relative w-5 h-5 text-[var(--fg)] shrink-0">
          {/* 三角（数学）— 上中 */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="absolute w-2 h-2 animate-tri-spin" style={{ top: 0, left: 6 }}
          >
            <path d="M3 20 L12 4 L21 20 Z" />
          </svg>
          {/* 方框（化学）— 左下 */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="absolute w-2 h-2 animate-sq-spin" style={{ top: 12, left: 0 }}
          >
            <rect x="4" y="4" width="16" height="16" />
          </svg>
          {/* 圆（物理）— 右下 */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="absolute w-2 h-2 animate-ci-spin" style={{ top: 12, left: 12 }}
          >
            <circle cx="12" cy="12" r="8" />
          </svg>
          {/* 移动端更新徽章：圆形向上箭头 + 呼吸光晕，落在 logo 右上角。
              外层 40×40 透明命中盒（视觉只占 14px），解决旧版 6×6 圆点点不中的问题。
              视觉本体在窄屏再收一档（14px 圆盘 / 16px 光晕 / 8px 箭头）：logo 只有 20px，
              16px 圆盘配 24px 光晕会盖住三角，看着比品牌还重。 */}
          {hasUpdate && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void applyUpdate();
              }}
              disabled={busy}
              title={busy ? phaseText : t.updateAvailable}
              aria-label={busy ? phaseText : t.updateAvailable}
              className="sm:hidden absolute -top-1.5 -right-1.5 z-10 flex h-10 w-10 items-start justify-end rounded-full disabled:cursor-progress"
            >
              <span className="relative block h-3.5 w-3.5">
                <UpdateBadgeVisual ring={ring} arrowClass="h-2 w-2" arrowStroke={2.4} />
              </span>
            </button>
          )}
        </span>
        <span className="hidden sm:inline whitespace-nowrap text-[0.625rem] mono-font uppercase tracking-wider text-[var(--fg)] group-hover:opacity-70 transition-opacity">
          STEM DIGITAL LAB
        </span>
        {/* 版本号：点击弹出版本历史；有更新时显示绿色呼吸灯圆点，点击圆点刷新到新版本 */}
        {/* 注意：按钮嵌在品牌区 <Link to="/"> 内，必须阻止冒泡，否则会同时跳回首页 */}
        {/* 版本号（桌面与平板显示；移动端隐藏——移动端仅在有新版时于 logo 右上角显示绿点）
            与品牌同轴：不再 self-end（触屏下会把版本号压到 40px 行的底部、下沉 6.5px）。
            tap-pad-10 只补透明热区，视觉仍是 10px 小字（15px 高 → 35px 命中）。 */}
        <span className="relative hidden items-center gap-1 sm:inline-flex">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowVersion((v) => !v);
            }}
            title={t.versionTitle.replace('{version}', APP_VERSION)}
            aria-label={t.versionAria}
            className="flex items-center whitespace-nowrap tap-pad-10 rounded text-[0.625rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          >
            v{APP_VERSION}
          </button>
          {/* 更新徽章：版本号按钮的**兄弟**（旧版嵌在版本号按钮里，既是非法嵌套，
              也飘到右边界之外 4px）。28×28 透明命中盒 + 圆形箭头 + 光晕。
              视觉本体在 lg 以下再收一档（14px 圆盘 / 16px 光晕 / 8px 箭头）：
              手机横屏与平板走的是 sm 分支（实测 780px 视口），18px 圆盘配 24px 光晕
              比同排 10px 的 v0.43.2 大一倍，像个按钮压着文字；命中盒仍留 28×28，
              所以相邻元素的位置与桌面完全一致。lg 起回到 18px，桌面不受影响。

              点击后不再另开浮层：徽章自己变成进度环（盘边即弧），阶段文案改由
              sr-only 的 live region 播报。形态映射见 update-progress.ts 的 ringStateFor。 */}
          {hasUpdate && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void applyUpdate();
              }}
              disabled={busy}
              title={phase === 'idle' ? t.updateAvailable : phaseText}
              aria-label={phase === 'idle' ? t.updateAvailable : phaseText}
              className="relative flex h-7 w-7 items-center justify-center rounded-full disabled:cursor-progress"
            >
              <span className="relative block h-3.5 w-3.5 lg:h-[18px] lg:w-[18px]">
                <UpdateBadgeVisual
                  ring={ring}
                  arrowClass="h-2 w-2 lg:h-2.5 lg:w-2.5"
                  arrowStroke={2.2}
                />
              </span>
            </button>
          )}
        </span>
      </Link>

      {/* 阶段播报：右上角的浮层已取消（进度显示在徽章本身上），但**播报不能跟着删** ——
          看得见的进度环替代不了看不见的 live region，读屏用户只有这一条线索。
          data-update-phase 留在这一层，供量测与断言读取，不再是浮层。 */}
      {phase !== 'idle' && (
        <span role="status" aria-live="polite" data-update-phase={phase} className="sr-only">
          {phaseText}
        </span>
      )}

      {/* 右侧操作簇：统一用 flex gap 排布，不插「|」竖线分隔。
          竖线只夹在中间两个控件之间，两端却是间隙——那条竖线反而把操作簇切成
          「有线的一段」和「没线的一段」，读起来像两个不相干的组。
          间距直接给在容器上：移动端 gap-1.5、桌面 gap-4，各控件自己的 padding 再加一层呼吸。
          注意：48px 的「节距」里 40px 是控件自身的 .tap-area 命中盒（触屏地板），
          真正可调的只有这 6px 间隙——所以收紧的观感来自「组更靠拢」，不是图标变小。 */}
      <div className="flex items-center gap-1.5 sm:gap-4 text-[0.6875rem] mono-font uppercase tracking-wider">
        {/* 离线教学包：仅下载中 / 已就绪时出现 */}
        {(packRunning || packStatus?.isFull) && (
          <button
            type="button"
            onClick={() => setShowPack(true)}
            aria-label={t.offlinePack.entry}
            title={t.offlinePack.entryHint}
            className="relative flex items-center justify-center p-2 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors tap-area"
          >
            {packRunning ? (
              <span className="text-[0.625rem] mono-font font-bold text-[var(--fg)]">
                {Math.round(((packProgress?.bytes ?? 0) / Math.max(1, packProgress?.totalBytes ?? 1)) * 100)}%
              </span>
            ) : (
              <CircleCheck className="w-3.5 h-3.5 text-green-600" />
            )}
          </button>
        )}

        {/* AI 入口：图标开面板；状态角标是**附属徽标**，做成标准 Badge 贴在字形右上角。
            角标只表达「连通性」：未配置时不渲染（没配置不是故障）。

            移动端与桌面共用这一处入口（页面右缘不再有悬浮书签）：横向空间由语言按钮的
            「中 / 中文」双断点（省 12px）腾出来，右簇 5 个控件在 390 下仍单行不溢出。

            几何（16×16 盒，落在图标按钮的右上角内）：
            - 图标按钮 36×36，Sparkles 字形 14×14 居中 → 字形包围盒在 11..25 之间。
            - 但**包围盒拐角不是空白**：Lucide 的 Sparkles 在字形右上角本身就有墨迹
              （一条十字短线，含描边实测约 x∈20.91..24.42、y∈11.58..15.08，按钮坐标）。
              所以角标不能按「压住包围盒一角」摆——那会正好盖住图标自己的那个点。
            - 盒取 right-0 top-0（16×16，完全落在按钮内 → 不影响 header 高度），圆点再向右 1px、
              向上 2px：圆心 (29,6) 落在字形拐角**外侧**，与十字墨迹的最近距离是环外缘 2.22px、
              圆点本体 4.22px —— 既不压住图标自己的点，也没飘到斜上方那团空白里。
            - 盒的下沿止于 y=16，字形中心在 y=18，所以**图标中心仍归图标按钮**（开面板）。
              旧版把盒抬到 -26px 是为了不压字形，代价是圆点飘在图标上方空白里，
              视觉上完全脱离图标——那个"悬浮错觉"是上一轮修掉的。 */}
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => setAiOpen(!aiOpen)}
            aria-label={isOffline ? t.offlineAi.hint : aiLabel}
            title={isOffline ? t.offlineAi.hint : aiLabel}
            className={`flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--accent-light)] transition-colors tap-area ${isOffline ? 'text-[var(--muted)]' : 'text-[var(--fg)]'}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isOffline && <WifiOff className="absolute bottom-1 right-1 w-2.5 h-2.5 text-[var(--error)]" aria-hidden="true" />}
          </button>
          {!isOffline && shownStatus !== 'unconfigured' && (
            <button
              type="button"
              onClick={() => setShowHealth((v) => !v)}
              aria-label={`${aiLabel} — ${lang === 'zh' ? '查看连通状态' : 'view connection status'}`}
              title={`${HEALTH_TITLE[shownStatus][lang]} · ${aiCheckedAtLabel(aiStatus.checkedAt, lang)}`}
              aria-expanded={showHealth}
              data-ai-health-trigger
              className="absolute right-0 top-0 z-10 grid h-4 w-4 place-items-center rounded-full"
            >
              {/* 形状表确定性：实心=有结论（已就绪/异常）；空心=结论未定（待验证/验证中）。
                  颜色只用设计令牌，深色主题下随令牌自适应；静态常亮，不做装饰性闪烁
                  （唯一例外：verifying 用 motion-safe 呼吸，表示「正在进行」。

                  点位 = 盒中心再向右 1px、向上 2px（圆心 (29,6)）：让开字形右上角那条十字墨迹
                  （含描边墨迹止于 x=24.42 / y=11.58，圆心距它 7.22px ＞ 环半径 5px），
                  环外缘因此留出 2.22px 底色缝、圆点本体留 4.22px —— 既不压点也不飘远。
                  旧版是向字形里内收 -3/+3（圆心贴着字形拐角 (25,11)，距墨迹仅 0.82px），
                  圆点会吃掉图标自己的那个点——本次修的正是这个。 */}
              {isHollowStatus(shownStatus) ? (
                <span className={`h-2 w-2 rounded-full translate-x-[1px] -translate-y-[2px] ${AI_STATUS_HOLLOW[shownStatus]}`} aria-hidden="true" />
              ) : (
                <span className={`h-1.5 w-1.5 rounded-full ring-2 ring-[var(--bg)] translate-x-[1px] -translate-y-[2px] ${AI_STATUS_DOT[shownStatus]}`} aria-hidden="true" />
              )}
            </button>
          )}

          {showHealth && (
            <>
              {/* 外部点击关闭：透明覆盖层（不挂 document 监听，避免与面板的全局快捷键互抢） */}
              <button
                type="button"
                tabIndex={-1}
                aria-label={lang === 'zh' ? '关闭连通状态卡片' : 'Close connection status'}
                onClick={() => setShowHealth(false)}
                className="fixed inset-0 z-[70] cursor-default bg-transparent"
              />
              <div
                role="dialog"
                aria-label={lang === 'zh' ? 'AI 连通状态' : 'AI connection status'}
                data-ai-health-card
                className="fixed z-[71] inset-x-3 sm:inset-x-auto sm:right-6 top-[calc(env(safe-area-inset-top,0px)+3.75rem)] rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-3 text-left normal-case tracking-normal shadow-[var(--elev-md)] sm:w-[19rem]"
              >
                <div className="flex items-center gap-2">
                  {isHollowStatus(shownStatus) ? (
                    <span className={`h-2 w-2 shrink-0 rounded-full ${AI_STATUS_HOLLOW[shownStatus]}`} aria-hidden="true" />
                  ) : (
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${AI_STATUS_DOT[shownStatus]}`} aria-hidden="true" />
                  )}
                  <span className="text-[0.6875rem] font-bold text-[var(--fg)]">{HEALTH_TITLE[shownStatus][lang]}</span>
                </div>

                <dl className="mt-2 space-y-1 mono-font text-[0.625rem] text-[var(--muted)]">
                  <div className="flex gap-2">
                    <dt className="shrink-0">{lang === 'zh' ? '模型' : 'Model'}</dt>
                    <dd className="truncate text-[var(--fg)]">{aiStatus.model || (lang === 'zh' ? '未设置' : 'Not set')}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0">{lang === 'zh' ? '端点' : 'Endpoint'}</dt>
                    <dd className="truncate text-[var(--fg)]" title={healthCfg?.baseUrl || ''}>{healthCfg?.baseUrl || '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0">{lang === 'zh' ? '上次检测' : 'Checked'}</dt>
                    <dd className="text-[var(--fg)]">
                      {aiCheckedAtLabel(aiStatus.checkedAt, lang)}
                      {checkedStale && (lang === 'zh' ? '（已过期）' : ' (expired)')}
                    </dd>
                  </div>
                </dl>

                {/* 已过期的结论不再复述原因：标题已经退回「待验证」，此时再讲 401/网络
                    就是在陈述一件 24 小时前的事，反而诱导用户照旧结论排查。 */}
                {!expiredConclusion && aiStatus.detail !== '' && (
                  <p className="mt-1.5 text-[0.625rem] leading-snug text-[var(--error)]">{AI_STATUS_DETAIL[aiStatus.detail][lang]}</p>
                )}

                <div className="mt-2.5 flex items-center gap-2">
                  {aiStatus.status !== 'unconfigured' && (
                    <button
                      type="button"
                      disabled={aiStatus.status === 'verifying'}
                      onClick={() => { void verifyAiStatus(loadAiConfig()); }}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--fg)] px-2.5 py-1 text-[0.625rem] text-[var(--bg)] transition-opacity hover:opacity-85 disabled:opacity-50"
                    >
                      <RotateCw className={`w-3 h-3 ${aiStatus.status === 'verifying' ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
                      {aiStatus.status === 'verifying' ? (lang === 'zh' ? '验证中…' : 'Verifying…') : (lang === 'zh' ? '重新验证' : 'Re-verify')}
                    </button>
                  )}
                  {/* 主次：卡片的本职是「查连通」，所以「重新验证」是主按钮；
                      「去设置」是出口而非目标，压成次级描边按钮（此前反了，视线被吸到设置上）。 */}
                  <button
                    type="button"
                    onClick={() => { setShowHealth(false); openSettings(); }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[0.625rem] text-[var(--fg)] transition-colors hover:bg-[var(--accent-light)]"
                  >
                    {lang === 'zh' ? '去设置' : 'Settings'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Language Switcher (single toggle button) */}
        <button
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          aria-label="Switch language"
          title={lang === 'zh' ? 'EN' : '中文'}
          className="inline-flex items-center justify-center leading-none px-2.5 py-1.5 min-h-[1.625rem] rounded-lg text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors tap-area"
        >
          {/* 移动端只留「中」：省 12px 横向宽度，给回归的 AI 图标腾位置；
              桌面（sm:）仍是完整的「中文」。英文侧 EN 两档同形，不需要拆。 */}
          {lang === 'zh' ? (
            <>
              <span className="sm:hidden">中</span>
              <span className="hidden sm:inline">中文</span>
            </>
          ) : (
            'EN'
          )}
        </button>

        {/* Theme Mode Switcher (single cycle button) */}
        <button
          onClick={cycleTheme}
          title={t[themeMode]}
          aria-label={t[themeMode]}
          className="flex items-center justify-center p-2 rounded-lg text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors tap-area"
        >
          <ThemeIcon className="w-3.5 h-3.5" />
        </button>

        {/* Guide link */}
        <Link
          to="/guide"
          title={t.guideHint}
          aria-label={t.guide}
          className="group/guide inline-flex items-center justify-center gap-1.5 leading-none px-2 py-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors tap-area"
        >
          {/* 媒体指示：说明页顶部就是项目介绍视频；图标与文字同属一个链接，触屏上常驻可见 */}
          <CirclePlay
            className="w-3.5 h-3.5 shrink-0 motion-safe:transition-transform motion-safe:duration-[var(--dur-base)] motion-safe:group-hover/guide:scale-[1.06]"
            aria-hidden="true"
          />
          {/* <1024 只留图标：右组 5 个入口在 375 下已顶到上限（261.3px / 可用 327），
              四个汉字占 46px。隐藏后右组降到 219px，320/360 的崩点整体后移。
              平板段（640–1023）同理收成图标形态：iPad 上右簇 296px + 左簇 198px，
              两组间隔只剩 62px，字体度量一变就会顶到品牌行；退到图标形态后余量翻倍，
              且右簇全部 40px 方盒、呼吸节奏与手机端一致。
              文字隐去不影响可访问名——aria-label 常驻（≥1024 另有 title 提示含演示视频）。 */}
          <span className="hidden lg:inline">{t.guide}</span>
        </Link>

        {/* 帮助入口：幽灵图标按钮，点击打开欢迎弹窗并默认停在「快速上手指引」 */}
        {onOpenGuide && (
          <button
            type="button"
            onClick={onOpenGuide}
            title={t.helpTitle}
            aria-label={t.helpTitle}
            className="flex items-center justify-center p-2 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors tap-area"
          >
            <HelpCircle className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
      </div>
      {showVersion && <VersionDialog onClose={() => setShowVersion(false)} />}
      {showPack && <OfflinePackPanel onClose={() => setShowPack(false)} />}
    </header>
  );
}
