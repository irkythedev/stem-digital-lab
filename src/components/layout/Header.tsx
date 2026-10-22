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
import { useVersionCheck } from '../../lib/use-version-check';
import VersionDialog from '../feedback/VersionDialog';
import OfflinePackPanel from '../feedback/OfflinePackPanel';
import { useOfflinePack } from '../../lib/use-offline-pack';
import type { ThemeMode } from '../../lib/app-context';
import type { AiStatus } from '../../lib/ai-status';

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
  const [toast, setToast] = useState(false);

  // 显示"正在刷新"toast 2 秒
  const showToast = () => {
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  };

  // 有新版本：等新 SW 真正接管（controllerchange）→ 只刷新一次
  // 刷新时机的唯一正确判据是「控制器换人了」：安装中静候、不设短兜底打断，
  // 无待接管的新 SW 时说明当前控制者就是服务端最新版，此时刷新必定拿到新版。
  const handleRefresh = () => {
    showToast();
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      window.location.reload();
      return;
    }
    let done = false;
    const reload = () => {
      if (done) return;
      done = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
    navigator.serviceWorker
      .getRegistration()
      .then(async (reg) => {
        if (!reg) { reload(); return; }
        // 新 SW 正在安装 / 待接管：静候接管事件，不用定时器抢刷
        if (reg.installing || reg.waiting) return;
        await reg.update().catch(() => { /* 检查失败：下面按无待更新处理 */ });
        if (!reg.installing && !reg.waiting) reload();
      })
      .catch(reload);
    // 仅极端慢网兜底（实测预缓存约 2.74MB，正常几秒内接管）
    setTimeout(reload, 90000);
  };

  // 检测是否有新版本：对比远端 version.json 与本版本号（hook 内 fetch 失败则静默忽略）
  const { hasUpdate } = useVersionCheck();

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
      <Link to="/" className="flex items-center gap-2 group p-1 -m-1 rounded-lg hover:bg-[var(--accent-light)]/50 transition-colors tap-area" aria-label={t.brandName}>
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
          {/* 移动端更新绿点：有新版时显示在 logo 右上角（桌面用版本号旁的绿点） */}
          {hasUpdate && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRefresh();
              }}
              title={t.updateAvailable}
              aria-label={t.updateAvailable}
              className="sm:hidden absolute -top-1 -right-1 group/dot"
            >
              <span className="block w-1.5 h-1.5 rounded-full bg-green-500 update-dot" />
              <span className="absolute inset-0 rounded-full bg-green-500/50 update-dot-halo" />
            </button>
          )}
        </span>
        <span className="hidden sm:inline text-[0.625rem] mono-font uppercase tracking-wider text-[var(--fg)] group-hover:opacity-70 transition-opacity">
          STEM DIGITAL LAB
        </span>
        {/* 版本号：点击弹出版本历史；有更新时显示绿色呼吸灯圆点，点击圆点刷新到新版本 */}
        {/* 注意：按钮嵌在品牌区 <Link to="/"> 内，必须阻止冒泡，否则会同时跳回首页 */}
        {/* 版本号（桌面显示；移动端隐藏——移动端仅在有新版时于 logo 右上角显示绿点） */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowVersion((v) => !v);
          }}
          title={t.versionTitle.replace('{version}', APP_VERSION)}
          aria-label={t.versionAria}
          className="hidden sm:flex items-center gap-1.5 self-end mb-0.5 rounded text-[0.625rem] mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
        >
          <span className="relative">
            v{APP_VERSION}
            {hasUpdate && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRefresh();
                }}
                title={t.updateAvailable}
                aria-label={t.updateAvailable}
                className="absolute -right-2.5 top-1/2 -translate-y-1/2 group/dot"
              >
                <span className="block w-1.5 h-1.5 rounded-full bg-green-500 update-dot" />
                <span className="absolute inset-0 rounded-full bg-green-500/50 update-dot-halo" />
              </button>
            )}
          </span>
        </button>
      </Link>

      {/* 刷新状态 toast：右上角 */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 border border-[var(--border)]/80 bg-[var(--card-bg)] px-3.5 py-2 rounded-xl text-[0.6875rem] text-[var(--fg)] shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 update-dot" aria-hidden="true" />
          {lang === 'zh' ? '正在刷新到最新版本…' : 'Refreshing to latest version…'}
        </div>
      )}

      {/* 右侧操作簇：统一用 flex gap 排布，不插「|」竖线分隔。
          竖线只夹在中间两个控件之间，两端却是间隙——那条竖线反而把操作簇切成
          「有线的一段」和「没线的一段」，读起来像两个不相干的组。
          间距直接给在容器上：移动端 gap-1、桌面 gap-4，各控件自己的 padding 再加一层呼吸。 */}
      <div className="flex items-center gap-1 sm:gap-4 text-[0.6875rem] mono-font uppercase tracking-wider">
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
              <span className="text-[0.5rem] mono-font font-bold text-[var(--fg)]">
                {Math.round(((packProgress?.bytes ?? 0) / Math.max(1, packProgress?.totalBytes ?? 1)) * 100)}%
              </span>
            ) : (
              <CircleCheck className="w-3.5 h-3.5 text-green-600" />
            )}
          </button>
        )}

        {/* AI 入口：图标开面板；状态角标是**附属徽标**，做成标准 Badge 贴在字形右上角。
            角标只表达「连通性」：未配置时不渲染（没配置不是故障）。

            几何（16×16 盒，落在图标按钮的右上角内）：
            - 图标按钮 36×36，Sparkles 字形 14×14 居中 → 字形四角在 11..25 之间。
            - 盒取 right-0 top-0，圆心在「距右边 8 / 距上边 8」，即字形右上角再向外 3px；
              6px 圆点 + 2px 环（ring-[var(--bg)]）外扩后与字形角重叠约 2px —— 这正是
              标准通知徽标的「压住一角」关系，读起来是长在图标上，而不是悬在旁边。
            - 盒的下沿止于 y=16，字形中心在 y=18，所以**图标中心仍归图标按钮**（开面板）。
              旧版把盒抬到 -26px 是为了不压字形，代价是圆点飘在图标上方空白里，
              视觉上完全脱离图标——那个"悬浮错觉"就是这次要修的东西。 */}
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

                  点位内收 -3/+3：命中盒留在 16×16 的右上角（不吞图标中心），但圆点自己
                  向字形拐角里挪 3px，与字形包围盒重叠 3×3px，再叠 ring-2(--bg) 切出一圈
                  底色——这才是标准 Badge 的「压在拐角上」关系。不挪的话两点只是**角对角相切**，
                  看着像浮在斜上方一团空里，就是用户说的那个视错觉。 */}
              {isHollowStatus(shownStatus) ? (
                <span className={`h-2 w-2 rounded-full -translate-x-[3px] translate-y-[3px] ${AI_STATUS_HOLLOW[shownStatus]}`} aria-hidden="true" />
              ) : (
                <span className={`h-1.5 w-1.5 rounded-full ring-2 ring-[var(--bg)] -translate-x-[3px] translate-y-[3px] ${AI_STATUS_DOT[shownStatus]}`} aria-hidden="true" />
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
                className="fixed z-[71] inset-x-3 sm:inset-x-auto sm:right-6 top-[calc(env(safe-area-inset-top,0px)+3.75rem)] rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-3 text-left normal-case tracking-normal shadow-[0_10px_28px_rgba(0,0,0,0.16)] sm:w-[19rem]"
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
          {lang === 'zh' ? '中文' : 'EN'}
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
          className="group/guide inline-flex items-center justify-center gap-1.5 leading-none px-2 py-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors tap-area"
        >
          {/* 媒体指示：说明页顶部就是项目介绍视频；图标与文字同属一个链接，触屏上常驻可见 */}
          <CirclePlay
            className="w-3.5 h-3.5 shrink-0 motion-safe:transition-transform motion-safe:duration-[var(--dur-base)] motion-safe:group-hover/guide:scale-[1.06]"
            aria-hidden="true"
          />
          {t.guide}
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
