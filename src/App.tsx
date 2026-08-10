/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 应用外壳：路由 + 全局 Provider。
 */
import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './lib/app-context';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import FeedbackFab from './components/feedback/FeedbackFab';
import AiAssistant from './components/ai/AiAssistant';
import { AiProvider } from './lib/ai-context';
import { flushFeedbackQueue } from './lib/feedback';
import HomePage from './pages/HomePage';
import SubjectPage from './pages/SubjectPage';
import LabPage from './pages/LabPage';
import NotFoundPage from './pages/NotFoundPage';
import GuidePage from './pages/GuidePage';
import PeriodicTable from './pages/PeriodicTable';
import PhysicalConstants from './pages/PhysicalConstants';
import MathFormulas from './pages/MathFormulas';
import PhysicsFormulas from './pages/PhysicsFormulas';

/** 无障碍跳转链接：键盘用户 Tab 到第一个焦点即可跳过导航直达内容（仅聚焦时可见） */
function SkipLink() {
  const { t } = useApp();
  return (
    <a
      href="#app-main"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-1.5 focus:bg-[var(--bg)] focus:border focus:border-[var(--fg)] focus:text-xs focus:text-[var(--fg)]"
    >
      {t.skipToContent}
    </a>
  );
}

export default function App() {
  // 页面加载时自动补传本地待发反馈队列（未配置/离线时静默跳过）
  useEffect(() => {
    void flushFeedbackQueue();
  }, []);

  return (
    <AppProvider>
      <AiProvider>
      <div id="app-main" className="min-h-screen w-full flex flex-col justify-between px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto selection:bg-[var(--accent-light)] selection:text-[var(--fg)]">
        <SkipLink />
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/subject/:subjectId" element={<SubjectPage />} />
          <Route path="/periodic-table" element={<PeriodicTable />} />
          <Route path="/physics-constants" element={<PhysicalConstants />} />
          <Route path="/math-formulas" element={<MathFormulas />} />
          <Route path="/physics-formulas" element={<PhysicsFormulas />} />
          <Route path="/lab/:labId" element={<LabPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Footer />
        <FeedbackFab />
        <AiAssistant />
      </div>
      </AiProvider>
    </AppProvider>
  );
}
