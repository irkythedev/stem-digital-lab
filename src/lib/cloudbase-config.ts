/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 腾讯云开发 CloudBase 反馈通道配置。
 *
 * 说明：前端通过 @cloudbase/js-sdk 匿名登录后直连云数据库，无需自建后端。
 * 需要在 CloudBase 控制台完成三步：
 *   1. 登录授权 → 开启「匿名登录」
 *   2. Web 安全域名 → 加入本站域名（如 https://stem.irky.dev 与局域网 IP）
 *   3. 数据库安全规则（Feedback 集合）：
 *      { "read": false, "write": "auth.loginType == 'ANONYMOUS'" }
 *      —— 只允许匿名用户创建记录，禁止读取/修改/删除。
 *
 * 配置方法：控制台 → 环境 → 环境 ID（形如 xxx-1g2h3j4k5l）。
 * 未配置时（留空）反馈自动降级为本地保存，不影响使用。
 */
export const CLOUDBASE_CONFIG = {
  /** CloudBase 环境 ID（形如 stem-lab-1g2h3j4k5l） */
  envId: '',
  /** 地域（默认 ap-shanghai；如环境在其他地域需填写） */
  region: 'ap-shanghai',
};

/** 是否已配置 CloudBase（环境 ID 非空才启用云端提交） */
export function isCloudBaseConfigured(): boolean {
  return Boolean(CLOUDBASE_CONFIG.envId);
}
