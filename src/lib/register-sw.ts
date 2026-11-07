/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 显式注册版本化 Service Worker：
 *   register('/sw-<APP_VERSION>.js', { scope: '/' })
 * 若该版本文件缺失（例如部署窗口内旧入口先到），回退到兼容别名 `/sw.js`，
 * 保证首装可用。刷新仍由 main.tsx 的 controllerchange 唯一驱动。
 */
import { APP_VERSION } from './app-version';
import { swUrlFor } from './sw-url';

export function registerAppSW(): void {
  if (!('serviceWorker' in navigator)) return;
  const register = (url: string) => navigator.serviceWorker.register(url, { scope: '/' });
  register(swUrlFor(APP_VERSION)).catch(() => {
    // 版本化文件暂不可用（边缘窗口/旧部署）：退回兼容别名
    register('/sw.js').catch(() => { /* 离线或隐私模式：忽略 */ });
  });
}
