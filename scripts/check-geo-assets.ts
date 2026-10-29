#!/usr/bin/env tsx
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * GEO 资产门禁（并入 `npm test`）。
 *
 * 分两层：
 *   1. 内容层：content/ JSON 的字段、字数、表格、FAQ 与证据等级；
 *   2. 构建产物：dist/<route>/index.html 在剥离 <script> 后仍含
 *      H1、摘要、数据表、全部 FAQ；JSON-LD 的 FAQ/HowTo 与正文逐字一致。
 *
 * 凸透镜表用与生成时相同的 lens-core 函数重算并逐字比对，
 * 手改 JSON 数字会直接失败。
 *
 * dist 不存在时（干净克隆、只跑单测）跳过第二层并明确提示；
 * dist 存在但内容路由缺页时失败。
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectedTables } from './gen-geo-tables.ts';
import { parseLabContent, type LabContent } from '../src/lib/lab-content-core.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SITE = 'https://stem.irky.dev';

const problems: string[] = [];
const notes: string[] = [];
const fail = (msg: string) => problems.push(msg);

const CJK = /[一-鿿]/g;
const cjkCount = (s: string) => (s.match(CJK) ?? []).length;

function collectZh(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') return out;
  if (Array.isArray(value)) {
    for (const v of value) collectZh(v, out);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'zh' && typeof v === 'string') out.push(v);
      else collectZh(v, out);
    }
  }
  return out;
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

interface Entry {
  file: string;
  route: string;
  content: LabContent;
}

const ENTRIES: Entry[] = [
  { file: 'content/labs/lens.json', route: '/lab/lens', content: load('content/labs/lens.json') },
  {
    file: 'content/tools/periodic-table.json',
    route: '/periodic-table',
    content: load('content/tools/periodic-table.json'),
  },
];

function load(rel: string): LabContent {
  return parseLabContent(JSON.parse(readFileSync(join(ROOT, rel), 'utf8')), rel);
}

function checkContent(entry: Entry): void {
  const { file, content } = entry;
  const tag = `[${file}]`;

  const summaryZh = content.summary.zh;
  const n = cjkCount(summaryZh);
  if (n < 80 || n > 120) fail(`${tag} summary 中文字数 ${n}，要求 80–120`);

  const bodyZh = collectZh(content).join('\n');
  const bodyChars = cjkCount(bodyZh);
  if (bodyChars < 800) fail(`${tag} 正文中文字数 ${bodyChars}，要求 ≥ 800`);

  if (content.dataTable.rows.length < 1) fail(`${tag} dataTable 至少 1 行`);
  if (content.faqs.length < 5) fail(`${tag} FAQ ${content.faqs.length} 条，要求 ≥ 5`);
  if (content.faqs.length > 8) fail(`${tag} FAQ ${content.faqs.length} 条，超过 8 条上限`);
  if (content.steps.length < 3 || content.steps.length > 6) {
    fail(`${tag} 操作步骤 ${content.steps.length} 条，要求 3–6`);
  }
  if (content.misconceptions.length < 3 || content.misconceptions.length > 5) {
    fail(`${tag} 常见误区 ${content.misconceptions.length} 条，要求 3–5`);
  }
  if (content.license !== 'AGPL-3.0') fail(`${tag} license 必须为 AGPL-3.0`);

  for (const [i, f] of content.facts.entries()) {
    if (f.tier === 'A' && (!f.evidence.zh.trim() || !f.evidence.en.trim())) {
      fail(`${tag} facts[${i}] tier A 缺少 evidence`);
    }
  }

  const width = content.dataTable.columns.length;
  for (const [i, row] of content.dataTable.rows.entries()) {
    if (row.length !== width) {
      fail(`${tag} dataTable.rows[${i}] 有 ${row.length} 列，表头是 ${width} 列`);
    }
  }

  const expected = expectedTables().get(file);
  if (!expected) fail(`${tag} 没有对应的生成器`);
  else if (JSON.stringify(expected) !== JSON.stringify(content.dataTable)) {
    fail(`${tag} dataTable 与计算核重算结果不一致（请跑 npx tsx scripts/gen-geo-tables.ts --write）`);
  }

  notes.push(`${tag} 中文 ${bodyChars} 字 / 表格 ${content.dataTable.rows.length} 行 / FAQ ${content.faqs.length} 条`);
}

interface LdNode {
  '@type'?: string | string[];
  [k: string]: unknown;
}

function flattenLd(raw: unknown, out: LdNode[] = []): LdNode[] {
  if (Array.isArray(raw)) {
    for (const v of raw) flattenLd(v, out);
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj['@type'] === 'string') out.push(obj as LdNode);
    if (Array.isArray(obj['@graph'])) flattenLd(obj['@graph'], out);
  }
  return out;
}

const hasType = (node: LdNode, t: string): boolean =>
  Array.isArray(node['@type']) ? node['@type'].includes(t) : node['@type'] === t;

function checkDist(entry: Entry): void {
  const rel = `${entry.route.replace(/^\//, '')}/index.html`;
  const path = join(DIST, rel);
  const tag = `[dist/${rel}]`;
  if (!existsSync(path)) {
    fail(`${tag} 缺失（先跑 npm run build）`);
    return;
  }

  const html = readFileSync(path, 'utf8');
  const visible = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  if ((visible.match(/<h1\b/g) ?? []).length !== 1) {
    fail(`${tag} 剥离脚本后应有且仅有 1 个 <h1>`);
  }
  if (!new RegExp(`<h1[^>]*>[\\s\\S]*?${escapeHtml(entry.content.name.zh)}[\\s\\S]*?</h1>`).test(visible)) {
    fail(`${tag} <h1> 不含「${entry.content.name.zh}」`);
  }
  if (!visible.includes(escapeHtml(entry.content.summary.zh))) {
    fail(`${tag} 正文缺少摘要`);
  }
  if (!/<table\b/.test(visible)) fail(`${tag} 正文缺少 <table>`);
  if (!visible.includes(escapeHtml(entry.content.dataTable.caption.zh))) {
    fail(`${tag} 表格 caption 未出现在正文`);
  }
  for (const [i, row] of entry.content.dataTable.rows.entries()) {
    for (const [j, cell] of row.entries()) {
      if (!visible.includes(escapeHtml(cell.zh))) {
        fail(`${tag} 表格第 ${i + 1} 行第 ${j + 1} 列文本缺失`);
      }
    }
  }
  if ((visible.match(/data-geo="faq"/g) ?? []).length < 5) {
    fail(`${tag} FAQ <details> 少于 5 条`);
  }
  for (const [i, faq] of entry.content.faqs.entries()) {
    if (!visible.includes(escapeHtml(faq.q.zh))) fail(`${tag} FAQ[${i}] 问题缺失`);
    if (!visible.includes(escapeHtml(faq.a.zh))) fail(`${tag} FAQ[${i}] 答案缺失`);
  }
  for (const [i, step] of entry.content.steps.entries()) {
    if (!visible.includes(escapeHtml(step.zh))) fail(`${tag} 步骤[${i}] 缺失`);
  }
  if (!/AGPL-3\.0/.test(visible)) fail(`${tag} 缺少 AGPL-3.0 许可声明`);
  if (!visible.includes(escapeHtml(entry.content.canonical))) {
    fail(`${tag} 缺少标准引用中的 canonical URL`);
  }

  const canonicalRe = new RegExp(
    `<link rel="canonical" href="${entry.content.canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
  );
  if (!canonicalRe.test(html)) fail(`${tag} <link rel="canonical"> 不匹配`);
  if (!new RegExp(`<title>[^<]*${entry.content.name.zh}[^<]*</title>`).test(html)) {
    fail(`${tag} <title> 不含页面名`);
  }

  const nodes: LdNode[] = [];
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      flattenLd(JSON.parse(m[1]), nodes);
    } catch (e) {
      fail(`${tag} JSON-LD 解析失败：${(e as Error).message}`);
    }
  }

  const faqNode = nodes.find((n) => hasType(n, 'FAQPage'));
  if (!faqNode) fail(`${tag} 缺少 FAQPage JSON-LD`);
  else {
    const qs = ((faqNode.mainEntity as Array<{ name?: string }>) ?? []).map((q) => q.name ?? '');
    const want = entry.content.faqs.map((f) => f.q.zh);
    if (qs.length !== want.length || qs.some((q, i) => q !== want[i])) {
      fail(`${tag} FAQPage JSON-LD 与正文 FAQ 不一致`);
    }
  }

  const howNode = nodes.find((n) => hasType(n, 'HowTo'));
  if (!howNode) fail(`${tag} 缺少 HowTo JSON-LD`);
  else {
    const steps = ((howNode.step as Array<{ text?: string }>) ?? []).map((s) => s.text ?? '');
    const want = entry.content.steps.map((s) => s.zh);
    if (steps.length !== want.length || steps.some((s, i) => s !== want[i])) {
      fail(`${tag} HowTo JSON-LD 与正文步骤不一致`);
    }
  }

  const resNode = nodes.find((n) => hasType(n, 'LearningResource'));
  if (!resNode) fail(`${tag} 缺少 LearningResource JSON-LD`);
  else {
    if (!String(resNode.license ?? '').includes('agpl-3.0')) fail(`${tag} LearningResource.license 不是 AGPL-3.0`);
    if (resNode.url !== entry.content.canonical) fail(`${tag} LearningResource.url 与 canonical 不一致`);
  }

  if (!nodes.some((n) => hasType(n, 'BreadcrumbList'))) fail(`${tag} 缺少 BreadcrumbList JSON-LD`);
}

function checkOtherRoutes(): void {
  const sitemapPath = join(DIST, 'sitemap.xml');
  if (!existsSync(sitemapPath)) {
    fail('[dist/sitemap.xml] 缺失');
    return;
  }
  const urls = [...readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  let checked = 0;
  for (const url of urls) {
    const path = url.startsWith(SITE) ? url.slice(SITE.length) || '/' : new URL(url).pathname;
    const file = path === '/' ? join(DIST, 'index.html') : join(DIST, path.replace(/^\//, ''), 'index.html');
    if (!existsSync(file)) {
      fail(`[${path}] 未生成静态 HTML`);
      continue;
    }
    const html = readFileSync(file, 'utf8');
    const canonical = path === '/' ? `${SITE}/` : url;
    if (!html.includes(`rel="canonical" href="${canonical}"`)) fail(`[${path}] canonical 缺失或不符`);
    if (!/<title>[^<]+<\/title>/.test(html)) fail(`[${path}] <title> 缺失`);
    checked += 1;
  }
  notes.push(`静态路由 ${checked}/${urls.length} 个有 title + canonical`);
}

for (const entry of ENTRIES) checkContent(entry);

if (!existsSync(DIST)) {
  notes.push('未发现 dist/，跳过构建产物校验（需要时先跑 npm run build）');
} else {
  for (const entry of ENTRIES) checkDist(entry);
  checkOtherRoutes();
}

if (problems.length) {
  console.error('\n✗ GEO 资产门禁未通过：');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log('✓ GEO 资产门禁通过');
for (const n of notes) console.log(`  · ${n}`);
