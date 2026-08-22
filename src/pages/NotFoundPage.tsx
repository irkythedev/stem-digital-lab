/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 404 页面。
 */
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { usePageMeta } from '../lib/use-page-meta';

export default function NotFoundPage() {
  const { t } = useApp();
  usePageMeta({ title: `404 - ${t.brandName}` });
  return (
    <main className="flex-1 flex flex-col items-center justify-center my-16 px-2 sm:px-6 text-center">
      <h1 className="text-4xl serif-font text-[var(--fg)] mb-2">404</h1>
      <p className="text-sm text-[var(--muted)] mono-font mb-6">{t.pageNotFound}</p>
      <Link to="/" className="text-xs mono-font text-[var(--muted)] underline">
        {t.backToHome}
      </Link>
    </main>
  );
}
