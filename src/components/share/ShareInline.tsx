/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 标题内嵌分享按钮：在实验标题旁放一个分享 icon，
 * 点击弹出 ShareDialog（二维码 / 系统分享 / 复制链接）。
 * URL 默认取当前页面地址（方案 A：分享当前实验页）。
 */
import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import ShareDialog from '../feedback/ShareDialog';

interface ShareInlineProps {
  /** 分享目标 URL；缺省取当前页面地址 */
  url?: string;
  /** 分享标题（如实验名）；缺省用站点通用标题 */
  title?: string;
  /** 分享正文（可带实验特色描述）；缺省用站点通用文案 */
  text?: string;
}

export default function ShareInline({ url, title, text }: ShareInlineProps) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : 'https://stem.irky.dev/');

  return (
    <>
      {/* 布局由父级 flex 行负责：这里不再自带 ml-3 / -m-1.5 / align-middle。
          负外边距原本用于抵消内联在 h1 文本流里的行高，挪进 flex 行后它会吃掉 gap
          （12px 变成 6px），并在相邻控件间造成不对称留白。
          p-1.5 保留：16px 图标 → 28px 真实盒，触屏还有 .tap-icon 的 -8px 扩区。 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t.share}
        aria-label={t.share}
        className="compact tap32 inline-flex items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] transition-colors p-1.5 tap-icon"
      >
        <Share2 className="w-4 h-4" />
      </button>
      {open && <ShareDialog url={shareUrl} title={title} text={text} onClose={() => setOpen(false)} />}
    </>
  );
}
