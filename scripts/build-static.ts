#!/usr/bin/env tsx
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 构建期静态化（GEO 方略 C）。
 *
 * 在 `vite build` 之后运行：
 *   1. 读取 sitemap.xml 的 26 个 URL（homepage 除外），为每个路由写 dist/<route>/index.html；
 *   2. 已接入 content/ 的路由（/lab/lens、/periodic-table）把答案层
 *      用 renderToStaticMarkup 原样渲染进首字节 HTML，并注入
 *      LearningResource / FAQPage / HowTo / BreadcrumbList 的 @graph；
 *   3. 其余路由生成基础 title / description / canonical / WebPage 外壳。
 *
 * 设计约束：
 *   - 复用 React 组件而不是手抄 HTML，静态快照与客户端渲染同源；
 *   - 保留 dist/index.html 的 <head>（hash 资源、PWA manifest）与 </body> 之后的收尾；
 *   - 不触碰 sw.js 预缓存清单：新路由的 HTML 不在 Workbox glob 内，
 *     离线仍由 navigateFallback → /index.html + 客户端路由接管。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LabAnswerLayer from '../src/components/lab/LabAnswerLayer.tsx';
import {
  answerLayerJsonLd,
  parseLabContent,
  type LabContent,
} from '../src/lib/lab-content-core.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SITE = 'https://stem.irky.dev';
const SITE_NAME = '数理化数字实验室';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function readContent(rel: string): LabContent {
  return parseLabContent(JSON.parse(readFileSync(join(ROOT, rel), 'utf8')), rel);
}

const CONTENTS = new Map<string, LabContent>([
  ['/lab/lens', readContent('content/labs/lens.json')],
  ['/periodic-table', readContent('content/tools/periodic-table.json')],
]);

interface RouteCopy {
  zh: string;
  en: string;
  desc: string;
}

/** 从 llms.txt 读取非内容路由的中英文名与一句话描述。 */
function readLlms(): Map<string, RouteCopy> {
  const out = new Map<string, RouteCopy>();
  const text = readFileSync(join(DIST, 'llms.txt'), 'utf8');
  for (const line of text.split('\n')) {
    const m = /^- \[([^\]]+)\]\(([^)]+)\)(?::|：)?\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const [, label, url, desc] = m;
    const pair = /^(.+?)（(.+?)）$/.exec(label);
    out.set(url, {
      zh: pair ? pair[1] : label,
      en: pair ? pair[2] : label,
      desc: desc.trim(),
    });
  }
  return out;
}

function contentBody(content: LabContent): string {
  const answer = renderToStaticMarkup(
    createElement(LabAnswerLayer, { content, lang: 'zh' }),
  );
  const curriculum = content.curriculum
    .map((c) => `${c.edition.zh} ${c.grade.zh} ${c.chapter.zh}`)
    .join(' · ');
  return `<main class="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
  <p class="mono-font text-[0.625rem] uppercase tracking-widest text-[var(--muted)]">${esc(content.canonical.replace(SITE, ''))}</p>
  <h1 class="t-h1 serif-font font-medium text-[var(--fg)] mt-2">${esc(content.name.zh)}</h1>
  <p class="serif-font text-sm text-[var(--muted)] mt-2">${esc(curriculum)}</p>
  ${answer}
</main>`;
}

function shellBody(copy: RouteCopy, path: string): string {
  return `<main class="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
  <p class="mono-font text-[0.625rem] uppercase tracking-widest text-[var(--muted)]">${esc(path)}</p>
  <h1 class="t-h1 serif-font font-medium text-[var(--fg)] mt-2">${esc(copy.zh)}</h1>
  <p class="serif-font text-sm leading-relaxed text-[var(--muted)] mt-3">${esc(copy.desc || `${copy.zh}：${SITE_NAME}的交互实验与工具。`)}</p>
</main>`;
}

interface HeadCopy {
  title: string;
  description: string;
  canonical: string;
  jsonLd: Record<string, unknown>;
}

function applyHead(html: string, copy: HeadCopy): string {
  const ld = JSON.stringify(copy.jsonLd).replace(/<\//g, '\\u003c/');
  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(copy.title)}</title>`);
  out = out.replace(
    /<meta name="description" content="[^"]*"/i,
    `<meta name="description" content="${esc(copy.description)}"`,
  );
  out = out.replace(
    /<meta property="og:title" content="[^"]*"/i,
    `<meta property="og:title" content="${esc(copy.title)}"`,
  );
  out = out.replace(
    /<meta property="og:description" content="[^"]*"/i,
    `<meta property="og:description" content="${esc(copy.description)}"`,
  );
  out = out.replace(
    /<meta property="og:url" content="[^"]*"/i,
    `<meta property="og:url" content="${esc(copy.canonical)}"`,
  );
  // canonical 必须唯一：源 index.html 已带首页 canonical，这里替换而不是再追加一条。
  const canonicalTag = `<link rel="canonical" href="${esc(copy.canonical)}" />`;
  if (/<link\s+rel="canonical"[^>]*>/i.test(out)) {
    out = out.replace(/<link\s+rel="canonical"[^>]*>/i, canonicalTag);
  } else {
    out = out.replace('</head>', `  ${canonicalTag}\n  </head>`);
  }
  out = out.replace(
    '</head>',
    `    <script type="application/ld+json" data-page-ld="static">${ld}</script>\n  </head>`,
  );
  return out;
}

/** 构建期守卫：每个静态页必须恰好一条 canonical，且指向该页自己的绝对地址。 */
function assertSingleCanonical(html: string, expected: string, where: string): void {
  const tags = html.match(/<link\s+rel="canonical"[^>]*>/gi) ?? [];
  if (tags.length !== 1) {
    throw new Error(`${where}：期望 1 个 canonical，实际 ${tags.length} 个`);
  }
  if (!tags[0].includes(`href="${esc(expected)}"`)) {
    throw new Error(`${where}：canonical 不是 ${expected}（实际：${tags[0]}）`);
  }
}

function webPageJsonLd(copy: HeadCopy): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${copy.canonical}#webpage`,
        name: copy.title,
        description: copy.description,
        url: copy.canonical,
        inLanguage: ['zh-CN', 'en'],
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${SITE}/` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${copy.canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '首页', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: copy.title.split(' - ')[0], item: copy.canonical },
        ],
      },
    ],
  };
}

function main(): void {
  const template = readFileSync(join(DIST, 'index.html'), 'utf8');
  const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (urls.length === 0) throw new Error('dist/sitemap.xml 里没有任何 <loc>');

  const llms = readLlms();
  const rootOpen = '<div id="root">';
  const openIdx = template.indexOf(rootOpen);
  const bodyIdx = template.indexOf('</body>');
  if (openIdx < 0 || bodyIdx < 0) throw new Error('dist/index.html 结构异常：找不到 #root 或 </body>');

  const headPart = template.slice(0, openIdx + rootOpen.length);
  const tailPart = template.slice(bodyIdx);
  const homePath = '/';

  let generated = 0;
  const covered: string[] = [];

  for (const url of urls) {
    const path = url.startsWith(SITE) ? url.slice(SITE.length) || '/' : new URL(url).pathname;
    if (path === homePath) continue;

    const content = CONTENTS.get(path);
    const copy: RouteCopy =
      llms.get(url) ??
      (content
        ? { zh: content.name.zh, en: content.name.en, desc: content.summary.zh }
        : { zh: path, en: path, desc: '' });

    const head: HeadCopy = {
      title: `${copy.zh} - ${SITE_NAME}`,
      description: content ? content.summary.zh : copy.desc || `${copy.zh}：${SITE_NAME}的交互实验与工具。`,
      canonical: url,
      jsonLd: content ? answerLayerJsonLd(content, 'zh') : webPageJsonLd({
        title: `${copy.zh} - ${SITE_NAME}`,
        description: copy.desc || `${copy.zh}：${SITE_NAME}的交互实验与工具。`,
        canonical: url,
        jsonLd: {},
      }),
    };

    const body = content ? contentBody(content) : shellBody(copy, path);
    const html = applyHead(
      `${headPart}\n${body}\n    </div>\n  ${tailPart}`,
      head,
    );
    assertSingleCanonical(html, head.canonical, path);

    const outDir = join(DIST, path.replace(/^\//, ''));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'index.html'), html, 'utf8');
    generated += 1;
    if (content) covered.push(path);
  }

  // 首页 canonical 已在源 index.html 中，构建后不再改写：
  // 改写会发生在 Workbox 计算 precache revision 之后，导致 sw.js 记录的哈希
  // 与线上 index.html 内容不一致。这里只做构建期校验。
  const homeFile = join(DIST, 'index.html');
  const home = readFileSync(homeFile, 'utf8');
  assertSingleCanonical(home, `${SITE}/`, '/');

  console.log(`✓ 静态化 ${generated + 1}/${urls.length} 个路由（含首页）`);
  console.log(`  答案层快照：${covered.join('、')}`);
}

main();
