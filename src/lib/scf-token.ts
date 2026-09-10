/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * SCF 云函数访问令牌。
 *
 * 安全背景：反馈 / TTS 两个 SCF 端点 URL 公开在构建产物中，无鉴权时
 * 任意第三方可直接调用（刷屏钉钉群 / 消耗云函数费用）。
 * 方案：请求时把 token 拼到 URL 查询参数上；SCF 端校验该参数。
 *
 * 取值优先级：VITE_SCF_TOKEN（.env，本地可覆盖）> 内置 fallback。
 * 内置 fallback 保证公网构建（EdgeOne 从仓库构建，无 .env）也带 token，
 * 否则 SCF 鉴权部署后公网请求全部 403。
 * 注意：token 会随构建产物公开，它的作用是「防随意脚本滥用」而非保密；
 * 如需轮换，改这里 + SCF 环境变量 TTS_TOKEN 同步更新。
 */
const BUILTIN_TOKEN = '9980ca248b144f7982f66ea36113835a';

/** 读取 SCF token：优先环境变量，其次内置 fallback */
function readScfToken(): string {
  const env = readEnvToken()?.trim();
  const token = env || BUILTIN_TOKEN;
  if (!token) return '';
  // token 只允许字母数字下划线连字符，防止拼 URL 时引入查询参数注入
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return '';
  return token;
}

/**
 * 读取构建期注入的 VITE_SCF_TOKEN。
 * 必须用可选链访问 import.meta.env：纯 Node / CJS 转译环境下 import.meta 可能不存在，
 * 直接访问 .env 会抛 TypeError，被调用方 catch 后静默降级（token 失效且难以排查）。
 */
function readEnvToken(): string | undefined {
  try {
    const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
    return meta?.env?.VITE_SCF_TOKEN;
  } catch {
    return undefined;
  }
}

/** 生成带 token 的查询串（?token=xxx）；无有效 token 返回空串 */
export function scfTokenQuery(): string {
  const token = readScfToken();
  if (!token) return '';
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

/** 调试辅助：确认当前构建是否配置了有效 token（不打印 token 值） */
export function scfTokenConfigured(): boolean {
  return Boolean(readScfToken());
}
