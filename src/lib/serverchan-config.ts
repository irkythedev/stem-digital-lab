/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * Server酱（Turbo 版）配置：反馈通过微信服务号实时推送给开发者。
 * 纯前端直连（sctapi.ftqq.com 已允许本站跨域），无需自建后端。
 *
 * 启用步骤：
 *   1) 打开 https://sct.ftqq.com/ 用 GitHub 账号登录（免实名）
 *   2) 登录后页面顶部即是你的 SendKey（形如 SCTxxxxxxxxxxxxxxxx）
 *   3) 把 SendKey 填到下方 SERVERCHAN_CONFIG.sendKey
 *   留空（默认）时反馈只存入本地队列，不会推送。
 *
 * 免费额度：Turbo 版每天 5 条消息，反馈量小足够用。
 */
export const SERVERCHAN_CONFIG = {
  /** 发送接口：POST https://sctapi.ftqq.com/{sendKey}.send */
  apiBase: 'https://sctapi.ftqq.com',
  /** SendKey（sct.ftqq.com 登录后获取）。留空 = 反馈仅本地暂存 */
  sendKey: '',
  /** 推送标题（Server酱限制最长 32 字符） */
  title: '数理化数字实验室 · 反馈',
} as const;

export function isServerChanConfigured(): boolean {
  return SERVERCHAN_CONFIG.sendKey.trim().length > 0;
}
