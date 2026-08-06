/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 应用外壳：路由 + 全局 Provider。
 */
import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './lib/app-context';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import FeedbackFab from './components/feedback/FeedbackFab';
import HomePage from './pages/HomePage';
import SubjectPage from './pages/SubjectPage';
import LabPage from './pages/LabPage';
import NotFoundPage from './pages/NotFoundPage';
import GuidePage from './pages/GuidePage';
import PeriodicTable from './pages/PeriodicTable';

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-screen w-full flex flex-col justify-between px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto selection:bg-[var(--accent-light)] selection:text-[var(--fg)]">
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/subject/:subjectId" element={<SubjectPage />} />
          <Route path="/periodic-table" element={<PeriodicTable />} />
          <Route path="/lab/:labId" element={<LabPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Footer />
        <FeedbackFab />
      </div>
    </AppProvider>
  );
}
