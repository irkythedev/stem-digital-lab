/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 版本号比较：只回答一个问题 ——「远端这个版本**是不是比本地新**」。
 *
 * 为什么不能直接比 `d.version !== APP_VERSION`：
 * 相等只说明「不一样」，不说明「更新」。服务端回滚、或者边缘节点给出一份陈旧的
 * version.json 时，远端会比本地旧，旧写法照样点亮更新徽章；点下去还会清空全部
 * CacheStorage（连用户主动下载的离线教学包一起），刷新后徽章仍在，再点又不动作，
 * 徽章就变成一个常亮、点了没反应的死按钮。
 *
 * 解析失败（空串 / 非数字 / 只有后缀）一律返回 false：宁可少提示一次，
 * 也不要给一个点下去会破坏本机缓存的假更新。
 */

/** 取 major/minor/patch 的数字部分；缺省段按 0 处理，预发布/构建后缀忽略不计。 */
export function parseVersion(v: string): [number, number, number] | null {
  if (typeof v !== 'string') return null;
  const m = /^\s*v?(\d+)\.(\d+)\.(\d+)/.exec(v);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** 远端严格大于本地才算有更新；相等、更旧、任一侧解析失败都返回 false。 */
export function isVersionNewer(remote: string, local: string): boolean {
  const a = parseVersion(remote);
  const b = parseVersion(local);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
