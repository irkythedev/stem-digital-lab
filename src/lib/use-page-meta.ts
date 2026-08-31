/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 路由级页面 meta 管理（便于搜索引擎收录）：
 *   - document.title 随路由与语言切换
 *   - meta description 同步
 *   - 页面级 JSON-LD 结构化数据注入（如 LearningResource），卸载时自动清理
 * 零依赖：原生 DOM 操作，不引入 react-helmet。
 */
import { useEffect } from 'react';

export interface PageMeta {
  /** 完整标题（直接替换 document.title） */
  title: string;
  /** 页面级 meta description */
  description?: string;
  /** 页面级 JSON-LD（对象或数组），注入到 <head>，卸载时移除 */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export const SITE_TITLE = '数理化数字实验室 | STEM Digital Lab';

export const SITE_DESC =
  '基于初中 7-9 年级课程大纲的数学、物理、化学数字实验与探究平台：15 个交互实验 + 4 个查表工具，无需登录、中英双语、深浅主题，可安装为 PWA 离线使用。';

let jsonLdSeq = 0;

/** 生成页面级 LearningResource 结构化数据（实验/工具页通用） */
export function learningResourceLd(opts: {
  name: string;
  description: string;
  url: string;
  inLanguage?: string[];
  educationalLevel?: string;
  resourceType?: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    inLanguage: opts.inLanguage ?? ['zh-CN', 'en'],
    learningResourceType: opts.resourceType ?? 'Interactive Resource',
    educationalLevel: opts.educationalLevel ?? '初中 7-9 年级 / Grades 7-9',
    isAccessibleForFree: true,
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
    provider: {
      '@type': 'Organization',
      name: '数理化数字实验室 · STEM Digital Lab',
      url: 'https://stem.irky.dev/',
    },
  };
}

/**
 * 页面挂载时设置标题/描述/JSON-LD，卸载时恢复站点默认标题并清理 JSON-LD。
 * 传 null/undefined 时仅恢复默认标题（用于无定制页）。
 */
export function usePageMeta(meta?: PageMeta | null): void {
  useEffect(() => {
    document.title = meta?.title ?? SITE_TITLE;

    const desc = meta?.description ?? SITE_DESC;
    let md = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!md) {
      md = document.createElement('meta');
      md.name = 'description';
      document.head.appendChild(md);
    }
    md.content = desc;

    const id = `page-ld-${++jsonLdSeq}`;
    if (meta?.jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      script.textContent = JSON.stringify(meta.jsonLd);
      document.head.appendChild(script);
    }
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [meta]);
}
