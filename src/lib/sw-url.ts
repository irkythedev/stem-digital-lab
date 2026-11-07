/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * Service Worker 的版本化 URL。
 *
 * 每个发布版本生成独立的 `sw-<version>.js`：EdgeOne 等边缘缓存按 URL 命中，
 * 版本一变就是全新 key，不会再把旧 `sw.js` 的 Cache Hit 喂给客户端。
 * `sw.js` 仍由构建产出一份别名，供旧版本（<0.47.9）升级时兼容。
 */
import { APP_VERSION } from './app-version';

/** 版本化 SW 路径：`/sw-<version>.js`。 */
export function swUrlFor(version: string): string {
  return `/sw-${version}.js`;
}

/** 当前构建对应的 SW URL。 */
export const APP_SW_URL = swUrlFor(APP_VERSION);
