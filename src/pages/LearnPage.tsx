/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 结构化讲解阅读页（/learn/:contentId）。
 *
 * 2026-10-30 拍板：答案层（摘要 / 直答 / 核心事实 / 可复现数据表 /
 * 操作步骤 / 常见误区 / FAQ / 引用信息）从工具页与实验页移出，
 * 独立成可引用、可静态化的阅读页；交互页底部只留一行入口。
 *
 * 内容按 id 动态加载，和静态化产物同源（content/*.json）。
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import BackLink from '../components/layout/BackLink';
import LabAnswerLayer from '../components/lab/LabAnswerLayer';
import { useApp } from '../lib/app-context';
import { usePageMeta } from '../lib/use-page-meta';
import { answerLayerJsonLd } from '../lib/lab-content-core';
import {
  LEARN_BACK_PATHS,
  learnContentLoader,
  learnPath,
  type LearnContentEntry,
} from '../lib/learn-content';

const SITE_URL = 'https://stem.irky.dev';

export default function LearnPage() {
  const { contentId = '' } = useParams<{ contentId: string }>();
  const { t, lang } = useApp();
  const zh = lang === 'zh';

  const loader = learnContentLoader(contentId);
  // 记下 id：换页时不借用上一篇的正文渲染一帧（effect 在首帧之后才清空）。
  const [loaded, setLoaded] = useState<{ id: string; entry: LearnContentEntry }>();
  const entry = loaded?.id === contentId ? loaded.entry : undefined;

  useEffect(() => {
    if (!loader) return;
    let cancelled = false;
    loader().then((result) => {
      if (!cancelled) setLoaded({ id: contentId, entry: result });
    }).catch(() => {
      // 内容缺失时保留空态；静态快照不受影响
    });
    return () => {
      cancelled = true;
    };
  }, [loader, contentId]);

  const pageUrl = `${SITE_URL}${learnPath(contentId)}`;
  const pageMeta = useMemo(() => {
    if (!entry) return null;
    return {
      title: `${entry.content.name[lang]} · ${zh ? '结构化讲解' : 'Study Guide'} - ${t.brandName}`,
      description: entry.content.summary[lang],
      jsonLd: answerLayerJsonLd(entry.content, lang, pageUrl),
    };
  }, [entry, lang, pageUrl, t.brandName, zh]);
  usePageMeta(pageMeta);

  if (!loader) {
    return (
      <main className="grow shrink-0 flex flex-col my-[var(--sp-block)] px-2 sm:px-6">
        <BackLink to="/">{t.backHome}</BackLink>
        <h1 className="t-h1 font-medium serif-font mt-2 text-[var(--fg)]">
          {t.underConstruction}
        </h1>
        <p className="text-sm serif-font italic text-[var(--muted)]">
          {zh ? '这个讲解页还没有内容。' : 'No study guide for this id yet.'}
        </p>
      </main>
    );
  }

  const backPath = LEARN_BACK_PATHS[contentId] ?? '/';

  return (
    <main className="grow shrink-0 flex flex-col mt-3 mb-[var(--sp-block)] px-2 sm:mt-[var(--sp-block)] sm:px-6">
      <BackLink to={backPath}>
        {zh ? '返回交互页' : 'Back to the interactive page'}
      </BackLink>

      {!entry ? (
        <div className="py-24 text-center text-sm text-[var(--muted)] mono-font" aria-busy="true">
          …
        </div>
      ) : (
        <div className="rise">
          <p className="text-[0.625rem] uppercase tracking-widest text-[var(--muted)] mono-font">
            {learnPath(contentId)}
          </p>
          <h1 className="t-h1 font-medium serif-font text-[var(--fg)] mt-2">
            {entry.content.name[lang]}
          </h1>
          <p className="serif-font text-sm text-[var(--muted)] mt-2">
            {entry.content.curriculum
              .map((c) => `${c.edition[lang]} ${c.grade[lang]} ${c.chapter[lang]}`)
              .join(' · ')}
          </p>

          <LabAnswerLayer
            content={entry.content}
            lang={lang}
            tableNote={entry.tableNote}
            pageUrl={pageUrl}
          />
        </div>
      )}
    </main>
  );
}
