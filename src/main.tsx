/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 应用入口：React 根挂载 + 路由 + PWA 注册。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import 'katex/dist/katex.min.css';
import App from './App.tsx';
import './index.css';

// 注册 Service Worker（PWA 离线可用 + 可安装）
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
