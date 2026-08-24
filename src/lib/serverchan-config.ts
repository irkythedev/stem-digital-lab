/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 反馈推送通道配置（双通道，优先钉钉云函数，未配置时回退 Server酱）：
 *
 * ── 通道一：钉钉群机器人（经腾讯云 SCF 云函数转发）──────────
 * 钉钉 webhook 只接受服务端调用（浏览器直连被 CORS + Content-Type 封锁），
 * 需先部署 docs/dingtalk-feedback-function.js 到 SCF（部署步骤见文件头），
 * 然后把「函数 URL」填到下方 DINGTALK_PROXY.apiBase。
 * 免费额度：SCF 每月 40 万次调用；钉钉群机器人无限量、手机实时通知。
 *
 * ── 通道二：Server酱（兜底，原通道）────────────────────────
 * 纯前端直连（sctapi.ftqq.com 已允许本站跨域）。免费额度 Turbo 版每天 5 条。
 *
 * 两个通道 apiBase 都留空时，反馈只存入本地队列，不会推送。
 */
export const SERVERCHAN_CONFIG = {
  /** 发送接口：POST https://sctapi.ftqq.com/{sendKey}.send */
  apiBase: 'https://sctapi.ftqq.com',
  /** SendKey（sct.ftqq.com 登录后获取）。留空 = 反馈仅本地暂存 */
  sendKey: 'SCT393012THwfuZWcSnf5LHNfh0zbZCPWZ',
  /** 推送标题（Server酱限制最长 32 字符） */
  title: '数理化数字实验室 · 反馈',
} as const;

/** 钉钉通道：SCF 云函数转发地址（部署 docs/dingtalk-feedback-function.js 后填写，形如 https://xxx.service.tcloudbase.com/ding-feedback） */
export const DINGTALK_PROXY = {
  apiBase: 'https://1307683613-c6djcnfpz2.ap-shanghai.tencentscf.com',
  /** 推送标题（钉钉 markdown 首行标题） */
  title: '数理化数字实验室 · 反馈',
} as const;

export function isServerChanConfigured(): boolean {
  return SERVERCHAN_CONFIG.sendKey.trim().length > 0;
}

export function isDingtalkProxyConfigured(): boolean {
  return DINGTALK_PROXY.apiBase.trim().startsWith('https://');
}
