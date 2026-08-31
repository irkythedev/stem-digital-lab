/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * PWA 安装引导 Sheet：按环境展示差异化图文指引。
 * - ios：Safari 分享 → 添加到主屏幕 → 添加（左侧时间线三步，图标贴近系统语义）
 * - wechat：微信内右上角 ··· → 在浏览器中打开（精确文案）
 * - webview：其他内置浏览器（钉钉/飞书/抖音/QQ 等）→ 同样引导去系统浏览器（通用文案）
 * - menu：浏览器菜单（⋮）→ 添加到主屏幕 / 安装应用
 *
 * 视觉设计说明：
 * - 时间线排版（左侧 01-02-03 节点 + 竖线），去内层闭合线框，靠间距与对齐建立秩序
 * - 步骤图标贴近系统真实语义：Share（方框上箭头）→ SquarePlus（方框加号）→ CheckCircle2
 * - 标题用品牌三角方块圆（与 Header logo 同源）；iOS 附价值副标题；底部单一主按钮「我知道了」
 */
import { CheckCircle2, ExternalLink, MoreHorizontal, MoreVertical, Share, SquarePlus } from 'lucide-react';
import { useApp } from '../../lib/app-context';

export type InstallGuideKind = 'ios' | 'wechat' | 'webview' | 'menu';

interface InstallGuideSheetProps {
  kind: InstallGuideKind;
  onClose: () => void;
}

/** 时间线步骤：左侧序号节点 + 竖线，右侧图标 + 主文案 + 可选注释 */
function TimelineStep({
  no, icon, title, note, last,
}: {
  no: string;
  icon: React.ReactNode;
  title: string;
  note?: string;
  last?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="w-6 h-6 shrink-0 rounded-full border border-[var(--border)] flex items-center justify-center text-[0.5625rem] mono-font text-[var(--muted)]">
          {no}
        </span>
        {!last && <span className="w-px flex-1 bg-[var(--border)] my-1" aria-hidden="true" />}
      </div>
      <div className="pb-3 min-w-0">
        <div className="flex items-start gap-2.5">
          <span className="w-5 h-5 mt-0.5 shrink-0 text-[var(--fg)]" aria-hidden="true">
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-[var(--fg)] leading-snug">{title}</p>
            {note && (
              <p className="text-[0.625rem] text-[var(--muted)] mt-0.5 leading-snug">{note}</p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function InstallGuideSheet({ kind, onClose }: InstallGuideSheetProps) {
  const { t, lang } = useApp();

  const title =
    kind === 'ios' ? t.installTitleIOS :
    kind === 'menu' ? t.installTitleMenu :
    t.installTitleBrowser;

  const hint = kind === 'wechat' ? t.installWechatHint : t.installWebviewHint;
  const after = kind === 'wechat' ? t.installWechatAfter : t.installWebviewAfter;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6 bg-black/40 sm:bg-transparent backdrop-blur-[1px] sm:backdrop-blur-none"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-sm max-h-[85dvh] flex flex-col border border-[var(--border)] bg-[var(--bg)] p-4 sm:p-5 shadow-[0_12px_32px_rgba(0,0,0,0.18)] rounded-t-xl sm:rounded-sm overflow-y-auto overscroll-contain pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest mono-font uppercase">
              {/* 品牌三角方块圆（三角·数学 / 方块·化学 / 圆·物理），与 Header logo 同源 */}
              <span className="relative w-3.5 h-3.5 text-[var(--fg)] shrink-0" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  className="absolute w-1.5 h-1.5" style={{ top: 1, left: 4 }}
                >
                  <path d="M3 20 L12 4 L21 20 Z" />
                </svg>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  className="absolute w-1.5 h-1.5" style={{ top: 8, left: 0 }}
                >
                  <rect x="4" y="4" width="16" height="16" />
                </svg>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  className="absolute w-1.5 h-1.5" style={{ top: 8, left: 8 }}
                >
                  <circle cx="12" cy="12" r="8" />
                </svg>
              </span>
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={lang === 'zh' ? '关闭' : 'Close'}
              title={lang === 'zh' ? '关闭' : 'Close'}
              className="p-1.5 -m-1.5 text-lg leading-none text-[var(--muted)] hover:text-[var(--fg)]"
            >
              ×
            </button>
          </div>

          {/* 价值说明（iOS 场景）：一句让师生心动的话 */}
          {kind === 'ios' && (
            <p className="text-[0.6875rem] text-[var(--muted)] leading-snug">{t.installIosSubtitle}</p>
          )}

          {kind === 'ios' ? (
            <ol className="mt-1">
              <TimelineStep
                no="01"
                icon={<Share className="w-5 h-5" />}
                title={t.installIosStep1}
                note={t.installIosStep1Note}
              />
              <TimelineStep
                no="02"
                icon={<SquarePlus className="w-5 h-5" />}
                title={t.installIosStep2}
              />
              <TimelineStep
                no="03"
                icon={<CheckCircle2 className="w-5 h-5" />}
                title={t.installIosStep3}
                last
              />
              <p className="text-[0.625rem] text-[var(--muted)] leading-snug opacity-80 mt-1">{t.installIosNote}</p>
            </ol>
          ) : kind === 'wechat' || kind === 'webview' ? (
            <ol className="mt-1">
              <TimelineStep
                no="01"
                icon={<MoreHorizontal className="w-5 h-5" />}
                title={hint}
              />
              <TimelineStep
                no="02"
                icon={<ExternalLink className="w-5 h-5" />}
                title={t.installBrowserOpen}
                last
              />
              <p className="text-[0.6875rem] text-[var(--muted)] leading-snug">{after}</p>
            </ol>
          ) : (
            <ol className="mt-1">
              <TimelineStep
                no="01"
                icon={<MoreVertical className="w-5 h-5" />}
                title={t.installMenuHint}
                last
              />
              <p className="text-[0.6875rem] text-[var(--muted)] leading-snug">{t.installMenuNote}</p>
            </ol>
          )}

          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={onClose}
              className="border border-[var(--fg)] px-6 py-2 text-xs text-[var(--fg)] hover:bg-[var(--accent-light)] min-h-[40px] touch-manipulation"
            >
              {t.installGotIt}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
