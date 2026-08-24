/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 微信内置浏览器检测（转发引导覆层与分享弹窗共用，避免两处正则漂移）。
 */
export function isWechat(): boolean {
  return typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent);
}
