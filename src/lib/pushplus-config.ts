/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * PushPlus（推送加）配置：反馈通过微信实时推送给开发者。
 * 纯前端直连（接口已允许本站跨域），无需自建后端。
 *
 * 启用步骤：
 *   1) 打开 https://www.pushplus.plus/ 用微信扫码登录（需实名认证）
 *   2) 在「消息令牌」中创建一个受限的「消息 token」（比主 token 更安全，
 *      即使泄露也只能发消息、无法管理账号）
 *   3) 把 token 填到下方 PUSHPLUS_CONFIG.token
 *   留空（默认）时反馈只存入本地队列，不会推送。
 */
export const PUSHPLUS_CONFIG = {
  /** 发送接口 */
  apiUrl: 'https://www.pushplus.plus/send',
  /** 消息 token（PushPlus 控制台 → 消息令牌）。留空 = 反馈仅本地暂存 */
  token: '',
  /** 推送标题 */
  title: '数理化数字实验室 · 反馈',
  /** 消息模板：txt 纯文本，换行友好 */
  template: 'txt',
} as const;

export function isPushPlusConfigured(): boolean {
  return PUSHPLUS_CONFIG.token.trim().length > 0;
}
