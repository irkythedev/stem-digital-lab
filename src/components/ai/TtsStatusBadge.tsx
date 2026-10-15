/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 语音通道状态胶囊：把「云端通道是否真的可用、当前是否已降级」摊开给使用者看，
 * 打开语音页即可看到实测结果，不必靠猜。
 *
 * 三点纪律：
 * - 只用设计令牌（--success / --warn / --error / --muted / --accent-light），不引调色板色；
 * - 零 Emoji、零字符符号（面板守卫硬要求）——状态靠色点 + 文字表达；
 * - 每个状态的类名逐条写全（不做模板拼接），否则 Tailwind 静态扫描不到、样式会整块丢失。
 */
import { useTtsStatus, type TtsStatus } from '../../lib/tts-status';
import { useApp } from '../../lib/app-context';

const LABEL: Record<TtsStatus, { zh: string; en: string }> = {
  unknown: { zh: '云端语音未检测', en: 'Cloud voice not checked' },
  probing: { zh: '正在检测云端语音', en: 'Checking cloud voice' },
  ready: { zh: '云端语音就绪', en: 'Cloud voice ready' },
  fallback: { zh: '已降级为系统语音', en: 'Fallback to system voice' },
  error: { zh: '云端语音连接异常', en: 'Cloud voice unavailable' },
};

/** 逐状态写全类名（Tailwind 静态扫描依赖字面量） */
const SKIN: Record<TtsStatus, { wrap: string; dot: string }> = {
  unknown: {
    wrap: 'text-[var(--muted)] bg-[var(--accent-light)]',
    dot: 'bg-[var(--muted)]',
  },
  probing: {
    wrap: 'text-[var(--muted)] bg-[var(--accent-light)]',
    dot: 'bg-[var(--muted)] update-dot',
  },
  ready: {
    wrap: 'text-[var(--success)] bg-[color-mix(in_srgb,var(--success)_12%,transparent)]',
    dot: 'bg-[var(--success)]',
  },
  fallback: {
    wrap: 'text-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_14%,transparent)]',
    dot: 'bg-[var(--warn)]',
  },
  error: {
    wrap: 'text-[var(--error)] bg-[color-mix(in_srgb,var(--error)_12%,transparent)]',
    dot: 'bg-[var(--error)]',
  },
};

export default function TtsStatusBadge() {
  const { lang } = useApp();
  const { status, detail } = useTtsStatus();
  const zh = lang === 'zh';
  const skin = SKIN[status];
  return (
    <span
      role="status"
      aria-live="polite"
      title={detail || undefined}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.625rem] mono-font leading-none transition-colors ${skin.wrap}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${skin.dot}`} aria-hidden="true" />
      {zh ? LABEL[status].zh : LABEL[status].en}
    </span>
  );
}
