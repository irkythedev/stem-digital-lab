/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 离线媒体约定 —— Service Worker 运行时路由（vite.config.ts）与页面侧（离线教学包）
 * 共用的单一来源：缓存桶名 + URL 匹配规则。
 *
 * 规则必须覆盖清单里的每一个真实文件，否则会出现「下好了却断网打不开」：
 * 页面请求先落到 SW 的路由上，没被任何路由接住的请求会直连网络，离线即失败。
 * smoke.test.ts 会拿 public/ 下的真实文件名逐个校验这三条规则。
 */
export const PHOTO_CACHE = 'element-photos';
export const AUDIO_CACHE = 'element-audio';
export const DIAGRAM_CACHE = 'architecture-assets';

/** 元素实物照片：/element-images/1.jpg */
export const PHOTO_URL_PATTERN = /\/element-images\/[\w-]+\.jpg$/i;
/** 元素读音：/audio/1.mp3、/audio/1-e.mp3、/audio/1-m.mp3、/audio/1-em.mp3 */
export const AUDIO_URL_PATTERN = /\/audio\/[\w-]+\.mp3$/i;
/** 架构图两张：/architecture-diagram-cn.jpg、/architecture-diagram-en.jpg */
export const DIAGRAM_URL_PATTERN = /\/architecture-diagram-[\w-]+\.jpg$/i;
