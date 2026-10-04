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

/**
 * 软键盘适配：键盘只压缩「视觉视口」，并不触发 window.resize
 * （iOS 与 Android 默认的 interactive-widget=resizes-visual 都是如此），
 * 而 dvh/vh 只随地址栏收展变化 → 固定吸底的抽屉会被键盘直接盖住。
 *
 * 这里额外维护两个变量，供吸底浮层把自己抬到键盘之上：
 *   --vvh 视觉视口高度（键盘弹起后的可用高）
 *   --kb  键盘占高（布局视口高 − 视觉视口高 − 视觉视口下移量）
 * --kb < 120px 一律记 0：iOS 地址栏收展也会让两者差出几十像素，那不是键盘。
 */
const setKeyboardVars = () => {
  const vv = window.visualViewport;
  const root = document.documentElement.style;
  const vvH = vv ? vv.height : window.innerHeight;
  root.setProperty('--vvh', `${Math.round(vvH)}px`);
  const raw = window.innerHeight - vvH - (vv ? vv.offsetTop : 0);
  root.setProperty('--kb', `${raw < 120 ? 0 : Math.round(raw)}px`);
};
setKeyboardVars();
window.addEventListener('resize', setKeyboardVars);
window.addEventListener('orientationchange', setKeyboardVars);
// visualViewport 的 resize 才是键盘弹收的信号；scroll 用于捕捉键盘弹起后的视口下移
window.visualViewport?.addEventListener('resize', setKeyboardVars);
window.visualViewport?.addEventListener('scroll', setKeyboardVars);

// 注册 Service Worker（PWA 离线可用 + 可安装）
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
