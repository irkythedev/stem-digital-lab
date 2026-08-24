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

// 动态视口变量：window.innerHeight 实时值（URL 栏收展时 resize 更新），
// 兜底不支持 dvh 的旧浏览器（100vh 大视口会在内容不足一屏时于底部撑出留白）
const setVh = () => {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
};
setVh();
window.addEventListener('resize', setVh);
window.addEventListener('orientationchange', setVh);

// 注册 Service Worker（PWA 离线可用 + 可安装）
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
