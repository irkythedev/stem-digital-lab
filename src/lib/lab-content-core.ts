/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * GEO 内容层内核：类型、校验、JSON-LD 与引用口径。
 * 不依赖 Vite 的 `?raw`，因此构建期脚本（tsx）与浏览器端可以共用同一份实现。
 */
export interface Bi {
  zh: string;
  en: string;
}

export type EvidenceTier = 'A' | 'B' | 'C' | 'D';

export interface CurriculumEntry {
  edition: Bi;
  grade: Bi;
  chapter: Bi;
}

export interface LabFact {
  key: Bi;
  value: Bi;
  evidence: Bi;
  tier: EvidenceTier;
}

export interface DataTable {
  caption: Bi;
  columns: Bi[];
  rows: Bi[][];
}

export interface LabMisconception {
  claim: Bi;
  correction: Bi;
  evidence: Bi;
  tier: EvidenceTier;
}

export interface LabFaq {
  q: Bi;
  a: Bi;
}

export interface LabLink {
  href: string;
  label: Bi;
}

export interface BreadcrumbItem {
  href: string;
  label: Bi;
}

export interface LabContent {
  id: string;
  canonical: string;
  name: Bi;
  aliases: Bi[];
  curriculum: CurriculumEntry[];
  summary: Bi;
  answer: {
    what: Bi;
    observe: Bi;
    grade: Bi;
  };
  facts: LabFact[];
  dataTable: DataTable;
  steps: Bi[];
  misconceptions: LabMisconception[];
  faqs: LabFaq[];
  links: LabLink[];
  breadcrumb: BreadcrumbItem[];
  updatedAt: string;
  license: string;
}

const isBi = (v: unknown): v is Bi =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as Bi).zh === 'string' &&
  typeof (v as Bi).en === 'string' &&
  (v as Bi).zh.length > 0 &&
  (v as Bi).en.length > 0;

/**
 * 运行时最小校验。字段缺失时直接抛错，避免组件渲染出半张答案层；
 * 更严格的字数/证据/表格门禁在 scripts/check-geo-assets.ts。
 */
export function parseLabContent(raw: unknown, source: string): LabContent {
  const fail = (path: string): never => {
    throw new Error(`[lab-content] ${source} 缺少或写错字段：${path}`);
  };
  if (typeof raw !== 'object' || raw === null) fail('<root>');
  const c = raw as Partial<LabContent>;

  if (typeof c.id !== 'string' || !c.id) fail('id');
  if (typeof c.canonical !== 'string' || !/^https:\/\//.test(c.canonical)) fail('canonical');
  if (!isBi(c.name)) fail('name');
  if (!Array.isArray(c.aliases) || !c.aliases.every(isBi)) fail('aliases');
  if (!Array.isArray(c.curriculum) || c.curriculum.length === 0) fail('curriculum');
  for (const [i, entry] of c.curriculum.entries()) {
    if (!isBi(entry.edition) || !isBi(entry.grade) || !isBi(entry.chapter)) fail(`curriculum[${i}]`);
  }
  if (!isBi(c.summary)) fail('summary');
  if (!c.answer || !isBi(c.answer.what) || !isBi(c.answer.observe) || !isBi(c.answer.grade)) fail('answer');
  if (!Array.isArray(c.facts) || c.facts.length === 0) fail('facts');
  for (const [i, f] of c.facts.entries()) {
    if (!isBi(f.key) || !isBi(f.value) || !isBi(f.evidence)) fail(`facts[${i}]`);
    if (!['A', 'B', 'C', 'D'].includes(f.tier)) fail(`facts[${i}].tier`);
  }
  if (!c.dataTable || !isBi(c.dataTable.caption)) fail('dataTable.caption');
  if (!Array.isArray(c.dataTable.columns) || c.dataTable.columns.length === 0) fail('dataTable.columns');
  if (!Array.isArray(c.dataTable.rows) || c.dataTable.rows.length === 0) fail('dataTable.rows');
  if (!Array.isArray(c.steps) || c.steps.length === 0 || !c.steps.every(isBi)) fail('steps');
  if (!Array.isArray(c.misconceptions) || !c.misconceptions.every((m) => isBi(m.claim) && isBi(m.correction))) {
    fail('misconceptions');
  }
  if (!Array.isArray(c.faqs) || !c.faqs.every((f) => isBi(f.q) && isBi(f.a))) fail('faqs');
  if (!Array.isArray(c.links) || !c.links.every((l) => typeof l.href === 'string' && isBi(l.label))) fail('links');
  if (!Array.isArray(c.breadcrumb) || !c.breadcrumb.every((b) => typeof b.href === 'string' && isBi(b.label))) {
    fail('breadcrumb');
  }
  if (typeof c.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.updatedAt)) fail('updatedAt');
  if (c.license !== 'AGPL-3.0') fail('license');

  return c as LabContent;
}

/** 许可与引用口径全站统一（见 GEO 方略第 9 节决议）。 */
export const CONTENT_LICENSE = 'AGPL-3.0';
export const LICENSE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html';

/**
 * 答案层对应的 schema.org `@graph`：
 * LearningResource + FAQPage + HowTo + BreadcrumbList。
 * 构建期与客户端共用同一函数，避免静态 HTML 与运行时 JSON-LD 口径漂移。
 */
export function answerLayerJsonLd(content: LabContent, lang: 'zh' | 'en'): Record<string, unknown> {
  const name = content.name[lang];
  const url = content.canonical;
  const grade = content.curriculum.map((c) => c.grade[lang]).join(' / ');

  const nodes: Record<string, unknown>[] = [
    {
      '@type': 'LearningResource',
      '@id': `${url}#resource`,
      name,
      description: content.summary[lang],
      url,
      mainEntityOfPage: url,
      inLanguage: ['zh-CN', 'en'],
      learningResourceType: lang === 'zh' ? '交互实验与结构化讲解' : 'Interactive lab with structured explanation',
      educationalLevel: grade,
      isAccessibleForFree: true,
      license: LICENSE_URL,
      keywords: content.aliases.map((a) => a[lang]),
      dateModified: content.updatedAt,
      provider: {
        '@type': 'Person',
        name: '数理化数字实验室 · STEM Digital Lab',
        url: 'https://stem.irky.dev/',
      },
    },
    {
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: content.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q[lang],
        acceptedAnswer: { '@type': 'Answer', text: f.a[lang] },
      })),
    },
    {
      '@type': 'HowTo',
      '@id': `${url}#howto`,
      name: lang === 'zh' ? `${name}操作步骤` : `How to run the ${name} experiment`,
      totalTime: 'PT15M',
      step: content.steps.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        text: s[lang],
      })),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        ...content.breadcrumb.map((b, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: b.label[lang],
          item: `https://stem.irky.dev${b.href === '/' ? '/' : b.href}`,
        })),
        {
          '@type': 'ListItem',
          position: content.breadcrumb.length + 1,
          name,
          item: url,
        },
      ],
    },
  ];

  return { '@context': 'https://schema.org', '@graph': nodes };
}

/** 标准引用格式（页脚与 llms.txt 共用口径）。 */
export function citationText(content: LabContent, lang: 'zh' | 'en'): string {
  return `数理化数字实验室（stem.irky.dev） — ${content.name[lang]} (${content.canonical})`;
}
