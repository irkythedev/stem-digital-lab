/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 应用外壳：路由 + 全局 Provider。
 */
import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './lib/app-context';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import FeedbackFab from './components/feedback/FeedbackFab';
import AiAssistant from './components/ai/AiAssistant';
import WelcomeDialog from './components/ui/WelcomeDialog';
import WechatShareOverlay from './components/share/WechatShareOverlay';
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
import LicensePage from './pages/LicensePage';
import TtsTestPage from './pages/TtsTestPage';

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

  // 首开欢迎弹窗：localStorage 标记 'stem-welcome-seen' 不存在时显示
  const [showWelcome, setShowWelcome] = useState(false);
  // 欢迎弹窗的默认分区：首开自动弹出停在「实验室概览」；Header 帮助入口会先把它指到「快速上手指引」
  const [welcomeTab, setWelcomeTab] = useState<'overview' | 'guide'>('overview');
  useEffect(() => {
    try {
      if (!window.localStorage.getItem('stem-welcome-seen')) {
        setShowWelcome(true);
      }
    } catch {
      // 隐私模式等静默跳过
    }
  }, []);

  const closeWelcome = (permanent: boolean) => {
    if (permanent) {
      try {
        window.localStorage.setItem('stem-welcome-seen', '1');
      } catch {
        // 隐私模式等静默跳过
      }
    }
    setShowWelcome(false);
  };

  return (
    <AppProvider>
      <AiProvider>
      {showWelcome && <WelcomeDialog onClose={closeWelcome} initialTab={welcomeTab} />}
      <div
        id="app-main"
        className="min-h-dvh w-full flex flex-col justify-between py-4 sm:py-6 selection:bg-[var(--accent-light)] selection:text-[var(--fg)]"
      >
        <SkipLink />
        <Header
          onOpenGuide={() => {
            setWelcomeTab('guide');
            setShowWelcome(true);
          }}
        />
        {/* 内容列：外壳不再限宽（使页头/页脚的分隔线能满幅通栏），
            限宽与水平内边距改由这一层承担，正文列位置与宽度保持不变。
            页头/页脚的内容容器用 px-6 sm:px-12 lg:px-14（= 本层 px + <main> 的 px-2 sm:px-6），
            三区内容的左右边界因此严格同界。
            工作台也走这一列：它与全站页头共用同一套版心，不再 100vw 贴死屏幕边缘。
            flex-1 让这一列吃掉页头与页脚之间的全部剩余高度，
            否则 justify-between 会把空白摊在页头下方，形成一条突兀的断层。 */}
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 sm:px-6 lg:max-w-5xl lg:px-8 xl:max-w-6xl 2xl:max-w-7xl">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route path="/subject/:subjectId" element={<SubjectPage />} />
            <Route path="/periodic-table" element={<PeriodicTable />} />
            <Route path="/physics-constants" element={<PhysicalConstants />} />
            <Route path="/math-formulas" element={<MathFormulas />} />
            <Route path="/physics-formulas" element={<PhysicsFormulas />} />
            <Route path="/license" element={<LicensePage />} />
            <Route path="/tts-test" element={<TtsTestPage />} />
            <Route path="/lab/:labId" element={<LabPage />} />
            {/* 电学工作台的规范路径，与顶层查表工具同构；旧路径永久跳转过去 */}
            <Route path="/circuit-bench" element={<LabPage />} />
            <Route path="/physics/circuit-bench" element={<Navigate to="/circuit-bench" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
        <Footer />
        <WechatShareOverlay />
        <FeedbackFab />
        <AiAssistant />
      </div>
      </AiProvider>
    </AppProvider>
  );
}
