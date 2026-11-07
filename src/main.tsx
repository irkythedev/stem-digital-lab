/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 应用入口：React 根挂载 + 路由 + PWA 注册。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerAppSW } from './lib/register-sw';
import { installPreloadRecovery } from './lib/preload-recovery';
import 'katex/dist/katex.min.css';
import App from './App.tsx';
import './index.css';

// 发布窗口/缓存缺失导致动态 chunk 加载失败时，在线最多自动刷新一次；
// 离线或刚刷过则交给 AppErrorBoundary 显示提示，避免无限刷新。
installPreloadRecovery();

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

// 刷新时机统一由 controllerchange 驱动（唯一的刷新入口）：
// 插件默认会在 activated 阶段直接 reload，与手动点击形成两个刷新驱动 → 可能连刷两次。
let hadController = !!navigator.serviceWorker?.controller;
/**
 * 完成态停留：用户点更新后，徽章要先画出「满环 + 对勾」再刷新。
 * 原先 controllerchange 里立刻 reload，reloading 阶段一帧都渲染不出来，
 * 完成态在用户眼里等同于「卡在 100% 然后页面突然白了」。
 * 600ms 只延后本标签页的刷新，不改变 SW 接管时机；主刷新驱动仍然只有这一处。
 */
const UPDATE_DONE_HOLD_MS = 600;
let reloadScheduled = false;
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  // 首次接管（clientsClaim 让首个 SW 接管本页）不算更新：不刷新
  if (!hadController) { hadController = true; return; }
  if (reloadScheduled) return; // 多次 controllerchange 只排一次刷新
  reloadScheduled = true;
  window.setTimeout(() => window.location.reload(), UPDATE_DONE_HOLD_MS);
});

// 注册版本化 Service Worker（PWA 离线可用 + 可安装）
registerAppSW();

const rootEl = document.getElementById('root')!;
// 预渲染快照：静态 HTML 已在 #root 内写好正文，而 createRoot 会清空 #root；
// 先抓下来交给 App，作为首次挂载期 Suspense 的骨架，避免「正文 → 加载条 → 正文」的闪跳（CLS）。
const prerenderedHtml = rootEl.childElementCount > 0 ? rootEl.innerHTML : '';

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <App initialFallbackHtml={prerenderedHtml} />
    </BrowserRouter>
  </StrictMode>,
);
