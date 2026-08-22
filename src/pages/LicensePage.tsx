/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 协议展示页：GNU Affero General Public License v3.0 官方原文（与仓库根 LICENSE 一致）。
 * 从弹窗 / 页脚的「AGPL-3.0」站内跳转查看，不依赖外网仓库。
 */
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { House } from 'lucide-react';
import { useApp } from '../lib/app-context';
import { AGPL_LICENSE_TEXT } from '../lib/license-text';
import { usePageMeta } from '../lib/use-page-meta';

export default function LicensePage() {
  const { t, lang } = useApp();
  // 动态标签页标题：协议名 - 品牌名（随语言切换），离开恢复默认
  const pageMeta = useMemo(() => ({
    title: `AGPL-3.0 - ${lang === 'zh' ? '数理化数字实验室' : 'STEM Digital Lab'}`,
    description: lang === 'zh'
      ? '数理化数字实验室的开源协议全文（GNU Affero General Public License v3）。'
      : 'Full license text of the STEM Digital Lab (GNU Affero General Public License v3).',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'AGPL-3.0 License - 数理化数字实验室',
      url: 'https://stem.irky.dev/license',
      inLanguage: ['zh-CN', 'en'],
    },
  }), [lang]);
  usePageMeta(pageMeta);

  return (
    <div className="space-y-4">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
      >
        <House className="w-4 h-4" />
        {t.backHome}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-bold mono-font tracking-widest">AGPL-3.0</h1>
        <p className="text-[11px] mono-font text-[var(--muted)]">
          GNU Affero General Public License, Version 3, 19 November 2007
        </p>
      </div>
      <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-words font-mono border border-[var(--border)] bg-[var(--card-bg)] p-4 max-h-[70vh] overflow-y-auto">
        {AGPL_LICENSE_TEXT}
      </pre>
    </div>
  );
}
