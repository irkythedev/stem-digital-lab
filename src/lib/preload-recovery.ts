/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 动态 chunk 加载失败的自救：Vite 在预加载或动态 import 失败时派发
 * `vite:preloadError`。发布窗口里旧 chunk 已被边缘清掉、或离线时 chunk
 * 不在缓存里，都会走到这里。
 *
 * 策略：
 *   - 在线且 60 秒内没有因同一原因刷过 → 拦截错误并刷新一次，拿到新入口；
 *   - 离线 / 冷却期内 → **不刷新**，把错误留给顶层 ErrorBoundary 显示可操作提示。
 *
 * 防循环的关键是刷新时间落在 sessionStorage：刷新后仍失败时，新页面能读到
 * 上一次的时间戳并拒绝再次刷新。拿不到 sessionStorage（隐私模式等）时宁可不
 * 自动刷新，也不能冒无限刷新的风险。
 */

const STORAGE_KEY = 'stem-preload-reload-at';

/** 两次自动刷新之间的最小间隔；冷却是跨页面刷新生效的。 */
export const PRELOAD_RELOAD_COOLDOWN_MS = 60_000;

/** 连通性探测超时：探不通就当作离线，交给 ErrorBoundary，不刷新。 */
export const PRELOAD_PROBE_TIMEOUT_MS = 3_000;

/** 探测目标：构建产物里存在、且刻意不预缓存（离线时不会由 SW 命中）。 */
const PROBE_URL = '/version.json';

type ReloadStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface PreloadRecoveryOptions {
  reload?: () => void;
  now?: () => number;
  storage?: ReloadStorage | null;
  isOnline?: () => boolean;
  /** 真实连通性探测：离线导航由 SW 返回页面后，navigator.onLine 可能误报在线。 */
  probeReachable?: () => Promise<boolean>;
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
}

function getSessionStorage(): ReloadStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

async function probeReachable(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PRELOAD_PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(PROBE_URL, { cache: 'no-store', signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 安装 preloadError 处理，返回卸载函数。
 *
 * 先拦截错误再探测连通性：`navigator.onLine` 在离线导航由 SW 返回页面后
 * 可能误报为在线，所以真正决定刷新前要探测一次；探不通就不刷新，把错误
 * 交给 ErrorBoundary 显示可操作提示，而不是离线反复刷新。
 */
export function installPreloadRecovery(options: PreloadRecoveryOptions = {}): () => void {
  if (typeof window === 'undefined' && !options.addEventListener) return () => {};

  const add = options.addEventListener
    ?? ((type: string, listener: EventListener) => window.addEventListener(type, listener));
  const remove = options.removeEventListener
    ?? ((type: string, listener: EventListener) => window.removeEventListener(type, listener));
  const reload = options.reload ?? (() => window.location.reload());
  const now = options.now ?? (() => Date.now());
  const isOnline = options.isOnline ?? (() => navigator.onLine !== false);
  const storage = options.storage !== undefined ? options.storage : getSessionStorage();
  const probe = options.probeReachable ?? probeReachable;
  // 探测在途时不再处理后续派发：一次 chunk 失败会先后从依赖预加载与动态导入各派发一次。
  let probing = false;

  const handler: EventListener = (event) => {
    if (probing) return;
    // navigator.onLine === false 时刷新不会让缺失的 chunk 出现，只会形成刷新循环。
    if (!isOnline()) return;
    // 没有可跨刷新保存的时间戳时，放弃自动刷新，交给 ErrorBoundary。
    if (!storage) return;

    let last = 0;
    try {
      last = Number(storage.getItem(STORAGE_KEY) ?? 0);
    } catch {
      return;
    }
    // last === 0 表示从未自动刷新过（空存储），不能按「1970 年刚刷过」处理。
    if (last > 0 && Number.isFinite(last) && now() - last < PRELOAD_RELOAD_COOLDOWN_MS) {
      // 刚因 chunk 失败刷过：再刷大概率还是同一份缓存，停在提示页。
      return;
    }

    event.preventDefault();
    probing = true;
    void probe().then((reachable) => {
      if (!reachable) {
        // 探不通（离线 / 站点不可达）：不刷新，错误仍会由 ErrorBoundary 呈现。
        probing = false;
        return;
      }
      try {
        storage.setItem(STORAGE_KEY, String(now()));
      } catch {
        // 写不进去就不刷新：否则下一次失败无法判断是否已经试过。
        probing = false;
        return;
      }
      // 时间戳已落盘，刷新前的后续派发会被冷却挡住；这里复位只为测试与卸载路径一致。
      probing = false;
      reload();
    });
  };

  add('vite:preloadError', handler);
  return () => remove('vite:preloadError', handler);
}
