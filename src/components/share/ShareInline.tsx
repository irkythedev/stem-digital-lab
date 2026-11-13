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
import { getLabState } from '../../lib/ai-dynamic-questions';
import { buildLabShareText, urlHasSnapshot } from '../../lib/lab-snapshot';

interface ShareInlineProps {
  /** 分享目标 URL；缺省取当前页面地址 */
  url?: string;
  /** 实验 id：用于读取 getLabState() 生成带当前工况的手稿摘要 */
  labId?: string;
  /** 实验名（双语）：分享正文用 */
  labName?: { zh: string; en: string };
  /** 分享标题（如实验名）；缺省用站点通用标题 */
  title?: string;
  /** 分享正文（可带实验特色描述）；缺省用站点通用文案 */
  text?: string;
}

export default function ShareInline({ url, labId, labName, title, text }: ShareInlineProps) {
  const { t, lang } = useApp();
  const [dialog, setDialog] = useState<{ url: string; text?: string } | null>(null);

  const buildPayload = () => {
    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : 'https://stem.irky.dev/');
    const state = labId ? getLabState(labId) : undefined;
    const snapshotText = labId && labName
      ? buildLabShareText({ labName, labId, state, url: shareUrl, lang, restorable: urlHasSnapshot(shareUrl) })
      : undefined;
    return { url: shareUrl, text: snapshotText || text };
  };

  return (
    <>
      {/* 布局由父级 flex 行负责：这里不再自带 ml-3 / -m-1.5 / align-middle。
          负外边距原本用于抵消内联在 h1 文本流里的行高，挪进 flex 行后它会吃掉 gap
          （12px 变成 6px），并在相邻控件间造成不对称留白。
          p-1.5 保留：16px 图标 → 28px 真实盒，触屏还有 .tap-icon 的 -8px 扩区。 */}
      <button
        type="button"
        onClick={() => setDialog(buildPayload())}
        title={t.share}
        aria-label={t.share}
        className="compact tap32 inline-flex items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] transition-colors p-1.5 tap-icon"
      >
        <Share2 className="w-4 h-4" />
      </button>
      {dialog && <ShareDialog url={dialog.url} title={title} text={dialog.text} onClose={() => setDialog(null)} />}
    </>
  );
}
