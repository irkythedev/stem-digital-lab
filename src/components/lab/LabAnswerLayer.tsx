/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * GEO 答案层：页面底部的结构化、可抽取正文。
 *
 * 设计要求（2026-10-29 拍板）：
 *   - 视觉上克制收纳，位于三幕式交互区下方，不抢首屏焦点；
 *   - DOM 必须是完整语义结构：article / dl / table / ol / details；
 *   - 纯展示组件（无 hook、无副作用），以便 tools/build-static.ts
 *     用 renderToStaticMarkup 生成与客户端完全一致的无 JS 快照。
 */
import type { LabContent, Bi } from '../../lib/lab-content-core';
import { citationText } from '../../lib/lab-content-core';

interface Props {
  content: LabContent;
  lang: 'zh' | 'en';
  /** 数据表口径说明；缺省沿用凸透镜的通用文案，其他工具应显式传入。 */
  tableNote?: Bi;
  /** 正文所在页面地址（/learn/<id>）；引用信息据此生成，缺省用 content.canonical。 */
  pageUrl?: string;
}

const COPY = {
  zh: {
    eyebrow: '// 结构化讲解 · 可引用',
    summary: '摘要',
    answer: '直答',
    facts: '核心事实卡',
    table: '可复现数据表',
    steps: '操作步骤',
    misconceptions: '常见误区',
    faqs: '常见问题',
    links: '关联内容',
    citation: '引用信息',
    license: 'License',
    updated: '更新于',
    evidence: '依据',
    what: '研究什么',
    observe: '观察到什么',
    grade: '适用年级与教材',
    tableNote: '本表由项目计算核（C++/WASM，TS 回退）按薄透镜公式计算生成，可在交互区复现。',
  },
  en: {
    eyebrow: '// Structured explanation · citable',
    summary: 'Summary',
    answer: 'Direct answer',
    facts: 'Key facts',
    table: 'Reproducible data table',
    steps: 'Procedure',
    misconceptions: 'Common misconceptions',
    faqs: 'Frequently asked questions',
    links: 'Related content',
    citation: 'Citation',
    license: 'License',
    updated: 'Updated',
    evidence: 'Source',
    what: 'What it studies',
    observe: 'What you observe',
    grade: 'Grade and textbook',
    tableNote: 'This table is computed by the project compute core (C++/WASM with a TS fallback) from the thin lens equation and can be reproduced in the interactive area.',
  },
} as const;

const pick = (b: Bi, lang: 'zh' | 'en') => b[lang];

export default function LabAnswerLayer({ content, lang, tableNote, pageUrl }: Props) {
  const c = COPY[lang];
  const id = content.id;
  const headings = {
    answer: `${id}-answer`,
    facts: `${id}-facts`,
    table: `${id}-table`,
    steps: `${id}-steps`,
    misconceptions: `${id}-misconceptions`,
    faqs: `${id}-faqs`,
    links: `${id}-links`,
  };

  return (
    <article
      id={`geo-answer-layer-${id}`}
      aria-labelledby={headings.answer}
      data-geo="answer-layer"
      className="mt-2 border-t border-[var(--border)] pt-8 pb-2"
    >
      <p className="text-[0.625rem] uppercase tracking-widest text-[var(--muted)] mono-font mb-3">
        {c.eyebrow}
      </p>

      <p
        data-geo="summary"
        className="text-base serif-font leading-relaxed text-[var(--fg)] max-w-[52rem]"
      >
        {pick(content.summary, lang)}
      </p>

      <section aria-labelledby={headings.answer} className="mt-8">
        <h2 id={headings.answer} className="t-h2 font-medium serif-font text-[var(--fg)] mb-3">
          {pick(content.name, lang)} · {c.answer}
        </h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="border border-[var(--border)] p-4">
            <dt className="text-[0.625rem] uppercase tracking-widest text-[var(--muted)] mono-font mb-2">
              {c.what}
            </dt>
            <dd className="text-sm serif-font leading-relaxed text-[var(--fg)]">
              {pick(content.answer.what, lang)}
            </dd>
          </div>
          <div className="border border-[var(--border)] p-4">
            <dt className="text-[0.625rem] uppercase tracking-widest text-[var(--muted)] mono-font mb-2">
              {c.observe}
            </dt>
            <dd className="text-sm serif-font leading-relaxed text-[var(--fg)]">
              {pick(content.answer.observe, lang)}
            </dd>
          </div>
          <div className="border border-[var(--border)] p-4">
            <dt className="text-[0.625rem] uppercase tracking-widest text-[var(--muted)] mono-font mb-2">
              {c.grade}
            </dt>
            <dd className="text-sm serif-font leading-relaxed text-[var(--fg)]">
              {pick(content.answer.grade, lang)}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby={headings.facts} className="mt-8">
        <h3 id={headings.facts} className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-3">
          {c.facts}
        </h3>
        <dl className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {content.facts.map((f, i) => (
            <div key={i} className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-6">
              <dt className="text-sm serif-font font-medium text-[var(--fg)]">{pick(f.key, lang)}</dt>
              <dd className="text-sm serif-font leading-relaxed text-[var(--fg)]">
                {pick(f.value, lang)}
                <span className="mt-1 block text-[0.6875rem] leading-relaxed text-[var(--muted)]">
                  {c.evidence}：{pick(f.evidence, lang)} · {f.tier}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby={headings.table} className="mt-8">
        <h3 id={headings.table} className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-3">
          {c.table}
        </h3>
        <div className="overflow-x-auto border border-[var(--border)]">
          <table className="w-full border-collapse text-sm serif-font" data-geo="data-table">
            <caption className="caption-top border-b border-[var(--border)] px-3 py-2 text-left text-[0.75rem] leading-relaxed text-[var(--muted)]">
              {pick(content.dataTable.caption, lang)}
            </caption>
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                {content.dataTable.columns.map((col, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="px-3 py-2 align-bottom text-[0.6875rem] font-bold tracking-wider text-[var(--muted)] mono-font uppercase whitespace-nowrap"
                  >
                    {pick(col, lang)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.dataTable.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-[var(--border)] last:border-b-0">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`px-3 py-2 align-top leading-relaxed text-[var(--fg)] ${
                        ci === 0 ? 'mono-font whitespace-nowrap' : ''
                      }`}
                    >
                      {pick(cell, lang)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[0.6875rem] leading-relaxed text-[var(--muted)] serif-font italic">
          {tableNote ? tableNote[lang] : c.tableNote}
        </p>
      </section>

      <section aria-labelledby={headings.steps} className="mt-8">
        <h3 id={headings.steps} className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-3">
          {c.steps}
        </h3>
        <ol className="space-y-2 border-l border-[var(--border)] pl-5 list-decimal">
          {content.steps.map((s, i) => (
            <li key={i} className="text-sm serif-font leading-relaxed text-[var(--fg)] pl-1">
              {pick(s, lang)}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby={headings.misconceptions} className="mt-8">
        <h3 id={headings.misconceptions} className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-3">
          {c.misconceptions}
        </h3>
        <div className="space-y-4">
          {content.misconceptions.map((m, i) => (
            <div key={i} className="border-l-2 border-[var(--border)] pl-4">
              <h4 className="text-sm serif-font font-medium text-[var(--fg)]">{pick(m.claim, lang)}</h4>
              <p className="mt-1 text-sm serif-font leading-relaxed text-[var(--fg)]">
                {pick(m.correction, lang)}
              </p>
              <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--muted)]">
                {c.evidence}：{pick(m.evidence, lang)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby={headings.faqs} className="mt-8">
        <h3 id={headings.faqs} className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-3">
          {c.faqs}
        </h3>
        <div className="border-t border-[var(--border)]">
          {content.faqs.map((f, i) => (
            <details key={i} className="group border-b border-[var(--border)] py-3" data-geo="faq">
              <summary className="cursor-pointer list-none text-sm serif-font font-medium text-[var(--fg)] marker:hidden">
                {pick(f.q, lang)}
              </summary>
              <p className="mt-2 text-sm serif-font leading-relaxed text-[var(--fg)]">
                {pick(f.a, lang)}
              </p>
            </details>
          ))}
        </div>
      </section>

      <nav aria-labelledby={headings.links} className="mt-8">
        <h3 id={headings.links} className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-3">
          {c.links}
        </h3>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {content.links.map((l, i) => (
            <li key={i}>
              <a
                href={l.href}
                className="text-sm serif-font text-[var(--fg)] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--fg)]"
              >
                {pick(l.label, lang)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <footer className="mt-8 border-t border-[var(--border)] pt-4 text-[0.6875rem] leading-relaxed text-[var(--muted)]">
        <p className="font-bold tracking-widest uppercase mono-font mb-1">{c.citation}</p>
        <p data-geo="citation" className="serif-font">
          {citationText(content, lang, pageUrl)}
        </p>
        <p className="mt-1 mono-font">
          {c.license}: {content.license} · {c.updated} {content.updatedAt}
        </p>
      </footer>
    </article>
  );
}
