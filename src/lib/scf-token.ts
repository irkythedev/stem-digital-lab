/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * SCF 云函数访问令牌（可选）。
 *
 * 安全背景：反馈 / TTS 两个 SCF 端点 URL 公开在构建产物中，无鉴权时
 * 任意第三方可直接调用（刷屏钉钉群 / 消耗云函数费用）。
 * 方案：前端配置 VITE_SCF_TOKEN（.env，不提交 git），请求时拼到 URL
 * 查询参数上；SCF 端校验该参数。未配置时返回空串（兼容旧构建，
 * 请求不带 token，SCF 旧版无校验直接放行）。
 */
export function scfTokenQuery(): string {
  const token = (import.meta.env.VITE_SCF_TOKEN as string | undefined)?.trim();
  if (!token) return '';
  // token 只允许字母数字下划线连字符，防止拼 URL 时引入查询参数注入
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return '';
  return `?token=${encodeURIComponent(token)}`;
}

/**
 * 生成带 token 的 SCF 端点 URL。
 * 已含查询参数时用 & 拼接；无 token 时原样返回（兼容旧构建）。
 */
export function scfUrlWithToken(base: string): string {
  const q = scfTokenQuery();
  if (!q) return base;
  return base.includes('?') ? `${base}&${q.slice(1)}` : `${base}${q}`;
}

/** 调试辅助：确认当前构建是否配置了 token（不打印 token 值） */
export function scfTokenConfigured(): boolean {
  const token = (import.meta.env.VITE_SCF_TOKEN as string | undefined)?.trim();
  return Boolean(token && /^[A-Za-z0-9_-]+$/.test(token));
}
