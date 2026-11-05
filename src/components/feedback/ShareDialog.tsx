/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 分享组件：一键分享（Web Share API）+ 二维码（qrcode.react，本地打包）+ 复制链接。
 * 自动降级：不支持 navigator.share 时提供复制链接。
 *
 * 层叠规则（见 index.css 的层级阶梯）：
 *  - 一律 createPortal 到 document.body。分享按钮所在的工作区/页头可能带 transform、
 *    backdrop-filter 或 overflow，fixed 会被困在局部层叠上下文里，页面后渲染的
 *    工作台浮层（自由实验台胶囊、预设标签）就会从卡片底下透出来。
 *  - 卡片必须使用**不透明**的 --card-bg + shadow-2xl；模态遮罩用 bg-black/45 +
 *    backdrop-blur-sm，锚定模式也铺一层透明拦截层，杜绝点击穿透与文字混叠。
 *  - 交互：点击遮罩/Escape 关闭，卡片内部点击不冒泡。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Check, TriangleAlert } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import { isWechat } from '../../lib/is-wechat';
import { useEscapeKey } from '../../lib/use-escape-key';
import { useLockBodyScroll } from '../../lib/use-lock-body-scroll';

interface ShareDialogProps {
  url: string;
  onClose: () => void;
  /** 自定义分享标题；缺省用站点通用标题 */
  title?: string;
  /** 自定义分享正文；缺省用站点通用文案 */
  text?: string;
  /** 锚定模式：二维码从触发按钮位置弹出（popover），默认 false 为底部 sheet/卡片 */
  anchored?: boolean;
  /** 锚定模式的触发元素；传入后按它的屏幕坐标定位（portal 后仍能贴合按钮） */
  anchorRef?: RefObject<HTMLElement | null>;
}

type Placement = 'top' | 'bottom';

export default function ShareDialog({ url, onClose, title, text, anchored = false, anchorRef }: ShareDialogProps) {
  useEscapeKey(onClose);
  useLockBodyScroll(!anchored);
  const { t } = useApp();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  // 锚定层的位置（相对视口）。portal 之后无法再靠 CSS 的 absolute 贴合按钮，
  // 因此由 anchorRef 的 getBoundingClientRect 计算 fixed 坐标。
  const [anchorPos, setAnchorPos] = useState<{ left: number; top: number; placement: Placement } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // 微信内置浏览器检测：点右上角「···」即可转发，无需/不能程序化调起（与转发引导覆层共用 lib）
  const wechatBrowser = isWechat();

  const shareTitle = title || t.shareTitle;
  const shareText = text || t.shareText;

  // 模态模式：焦点落到关闭按钮，键盘用户不会掉回背景页面。
  useEffect(() => {
    if (!anchored) closeRef.current?.focus();
  }, [anchored]);

  const updateAnchor = useCallback(() => {
    const anchor = anchorRef?.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const cardW = Math.min(288, viewportW - 32);
    const cardH = cardRef.current?.offsetHeight ?? 320;
    // 与按钮中心对齐，再夹进视口左右内缘（16px）。
    const left = Math.min(Math.max(rect.left + rect.width / 2 - cardW / 2, 16), viewportW - cardW - 16);
    const aboveTop = rect.top - 10 - cardH;
    if (aboveTop >= 8) {
      setAnchorPos({ left, top: rect.top - 10, placement: 'top' });
    } else {
      // 上方放不下（矮视口/按钮在页顶）时翻到下方，并保证卡片底边不出视口。
      const top = Math.min(rect.bottom + 10, Math.max(8, viewportH - cardH - 8));
      setAnchorPos({ left, top, placement: 'bottom' });
    }
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!anchored) return;
    updateAnchor();
    window.addEventListener('resize', updateAnchor);
    // 捕获阶段：工作台内部滚动容器滚动时也能跟随。
    window.addEventListener('scroll', updateAnchor, true);
    return () => {
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', updateAnchor, true);
    };
  }, [anchored, updateAnchor]);

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return; // 用户取消
      }
    }
    await handleCopy();
  };

  const handleCopy = async () => {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板 API 失败：降级用 execCommand
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setCopyFailed(true);
        setTimeout(() => setCopyFailed(false), 3000);
      }
    }
  };

  // 弹层内容（两种模式共用）
  const body = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-widest mono-font uppercase">// {t.share}</h2>
        <button ref={closeRef} type="button" onClick={onClose} aria-label={t.share} title={t.share} className="h-7 w-7 rounded-md inline-flex items-center justify-center shrink-0 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] ghost-x transition-colors text-lg leading-none">×</button>
      </div>

      {/* 二维码 */}
      <div className="flex flex-col items-center gap-2">
        <div className="bg-white p-2 rounded">
          <QRCodeSVG value={url} size={160} level="M" marginSize={2} />
        </div>
        <p className="text-xs text-[var(--muted)]">
          {wechatBrowser ? t.wechatInnerHint : t.wechatOuterHint}
        </p>
      </div>

      {/* 按钮：仅支持 Web Share API 的浏览器显示「分享」主按钮，其余直接用「复制链接」 */}
      <div className="flex flex-col gap-2">
        {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="border border-[var(--fg)] px-4 py-2 text-xs text-[var(--fg)] hover:bg-[var(--accent-light)] min-h-[40px] touch-manipulation"
          >
            {t.share}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="border border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] min-h-[40px] touch-manipulation"
        >
          {copied ? <span className="inline-flex items-center gap-1.5"><Check className="inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em]" aria-hidden="true" />{t.copied}</span> : t.copyLink}
        </button>
        {copyFailed && (
          <p className="flex items-center gap-1.5 text-xs text-[var(--error)] serif-font" role="alert">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t.copyFailed}</span>
          </p>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;

  // 锚定模式（anchored）：二维码从触发按钮位置弹出（popover，带指向箭头）。
  // portal 后仍用 fixed 坐标贴合按钮；透明拦截层负责点外关闭，卡片本身不透明。
  if (anchored) {
    const placement = anchorPos?.placement ?? 'top';
    return createPortal(
      <>
        <div
          className="fixed inset-0 z-overlay"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-hidden="true"
        />
        <div
          ref={cardRef}
          className="fixed z-modal w-[min(18rem,calc(100vw-2rem))] max-h-[70dvh] overflow-y-auto overscroll-contain rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4 text-[var(--fg)] shadow-2xl"
          style={{
            left: anchorPos?.left ?? 16,
            top: anchorPos?.top ?? 16,
            transform: placement === 'top' ? 'translateY(-100%)' : undefined,
            // 锚点尚未测量时先隐藏一帧，避免卡片从左上角飞入。
            visibility: anchorPos ? 'visible' : 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t.share}
        >
          <span
            className={`hidden sm:block absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 border-[var(--border)] bg-[var(--card-bg)] ${
              placement === 'top'
                ? 'top-full -mt-[5px] border-r border-b'
                : 'bottom-full -mb-[5px] border-l border-t'
            }`}
            aria-hidden="true"
          />
          {body}
        </div>
      </>,
      document.body,
    );
  }

  // 默认模式：移动端底部 sheet / 桌面右下角卡片。
  // 遮罩始终带实底（bg-black/45 + blur），不再在 sm 断点退化成近乎透明的 bg-black/20。
  return createPortal(
    <div
      className="fixed inset-0 z-overlay flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6 bg-black/45 backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="relative z-modal w-full sm:max-w-xs border border-[var(--border)] bg-[var(--card-bg)] p-4 sm:p-5 text-[var(--fg)] shadow-2xl rounded-t-xl sm:rounded-xl pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true"
        aria-label={t.share}
      >
        {body}
      </div>
    </div>,
    document.body,
  );
}
