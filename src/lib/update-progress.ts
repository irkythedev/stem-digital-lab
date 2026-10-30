/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 更新环的「真值」层：只做几件纯计算，不碰 DOM、不碰网络、不读时钟。
 *
 * 为什么需要它：workbox 预缓存安装**没有进度事件**，但安装过程是逐条写入缓存的，
 * 所以「新清单里已有多少条进了缓存」是一个有分母的真值（实测序列 90→91→99→104→106）。
 * 单位是**条目**不是字节：一个大的 wasm 能让弧停很久。这是刻意的诚实选择 ——
 * 条目进度不包装成时间百分比，也不在 14–18px 的徽章里塞数字。
 *
 * 四条容易算错的规则（每条都有回归用例）：
 *   1. 分母取 sw.js 里**新清单**的条目数，不是当前缓存条目数：安装期计数会超过
 *      旧总数（90→106），拿旧数当分母会算出 117%；
 *   2. 清单里大部分条目是 `revision:null`（带内容哈希的文件名那类），缓存键就是裸 URL；
 *      实测 94 条里 74 条 null、20 条带 revision —— 只数带查询串的会漏掉 3/4；
 *   3. 缓存键的查询串是 workbox 的 `?__WB_REVISION__=<rev>`，必须按「URL + 有 revision
 *      才拼查询串」逐条对齐，不能做子串/前缀匹配；
 *   4. 装完计数会回落（旧版本条目被 workbox 清理，106→90），所以「完成」的判定是
 *      「新清单每条都命中」，而不是 done === total 这种计数相等的写法。
 */

/** 更新状态机的阶段。定义在此，供状态机与环形指示器共用，避免循环依赖。 */
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'activating'
  | 'clearing'
  | 'reloading';

/** 有分母的那类读数。单位是**清单条目**。
 *
 *  `base` 是开表那一刻已经落盘的条目数：一次真实发版里，清单 94 条往往只有 20 条
 *  的 revision 变了，其余 74 条本就在缓存里。直接画 `done / total` 会让弧一起手就
 *  79%（实测 t=80ms 时 dash 从 48 跳到 9），看起来像「快好了」甚至像假进度 ——
 *  所以弧长用 `(done - base) / (total - base)`，即**本次更新还需要做的量**走了多少。 */
export type UpdateProgress = { done: number; total: number; base?: number };

/** 徽章在某一帧应该长什么样。`hidden` = 回到静态的实心箭头徽章。 */
export type RingState =
  | { mode: 'hidden' }
  | { mode: 'indeterminate' }
  | { mode: 'determinate'; ratio: number }
  | { mode: 'full' };

export type PrecacheEntry = { url: string; revision: string | null };

/**
 * 清单条目的三种真实形态（vite-plugin-pwa / workbox generateSW 的产物）：
 *   {url:"a.png",revision:"<hash>"}   {url:"b.js",revision:null}   {url:"c.png"}
 * 中间那种最常见（带哈希的文件名不需要 revision），所以 null 必须显式支持。
 */
const MANIFEST_ENTRY = /\{url:"([^"]+)"(?:,revision:(?:"([^"]+)"|null))?\}/g;

/** workbox 缓存键里的查询参数名。 */
const REVISION_PARAM = '__WB_REVISION__';

/** 从 sw.js 源码里取出 `precacheAndRoute([...])` 的条目。取不到返回空数组。 */
export function parsePrecacheManifest(source: string): PrecacheEntry[] {
  const start = source.indexOf('precacheAndRoute(');
  if (start < 0) return [];
  const end = source.indexOf(']', start);
  const slice = end > start ? source.slice(start, end + 1) : source.slice(start);
  const out: PrecacheEntry[] = [];
  const seen = new Set<string>();
  // 每次调用用新的正则实例：带 g 的正则会在模块级共享 lastIndex，跨调用会漏条目。
  const re = new RegExp(MANIFEST_ENTRY.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice)) !== null) {
    const url = m[1];
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, revision: m[2] ?? null });
  }
  return out;
}

/** 清单条目在 Cache API 里的键：有 revision 才拼查询串，null 就是裸 URL。 */
export function precacheCacheKey(entry: PrecacheEntry): string {
  return entry.revision ? `${entry.url}?${REVISION_PARAM}=${entry.revision}` : entry.url;
}

/** 把缓存里的绝对 URL 归一成与清单同口径的 `path/search`（去掉 origin 与前导斜杠）。 */
export function cachedKeyOf(href: string): string {
  const path = (() => {
    const m = /^[a-z]+:\/\/[^/]+(\/.*)$/i.exec(href);
    return m ? m[1] : href;
  })();
  return path.replace(/^\//, '');
}

/** 新清单里已经进缓存的条目数。严格逐条对齐，不做子串/前缀匹配。 */
export function countCachedEntries(
  entries: readonly PrecacheEntry[],
  cachedHrefs: Iterable<string>,
): number {
  const have = new Set<string>();
  for (const href of cachedHrefs) have.add(cachedKeyOf(href));
  let done = 0;
  for (const entry of entries) if (have.has(precacheCacheKey(entry))) done += 1;
  return done;
}

/** 新清单是否已全部落盘。这是「完成」的唯一判定，不能写成 done === total 的计数相等。 */
export function isPrecacheComplete(
  entries: readonly PrecacheEntry[],
  cachedHrefs: Iterable<string>,
): boolean {
  if (entries.length === 0) return false;
  return countCachedEntries(entries, cachedHrefs) === entries.length;
}

/**
 * 阶段 → 环形指示器的形态。
 *
 * 只有 downloading（预缓存条目）与 clearing（缓存逐个删）有分母；
 * checking / activating 只是在等事件或等超时，**没有分母**，因此恒为扫动弧 ——
 * 按时长插值伪造百分比比不动更糟。
 */
export function ringStateFor(phase: UpdatePhase, progress: UpdateProgress | null): RingState {
  if (phase === 'idle') return { mode: 'hidden' };
  if (phase === 'reloading') return { mode: 'full' };
  const measured = (() => {
    if (!progress || !(progress.total > 0) || !Number.isFinite(progress.done)) return null;
    const base = Number.isFinite(progress.base) ? Math.max(0, progress.base as number) : 0;
    const span = progress.total - base;
    // 本次更新没有需要新落的条目（清单全在缓存里）→ 直接满环，不假装从 0 开始
    if (span <= 0) return 1;
    return Math.min(1, Math.max(0, (progress.done - base) / span));
  })();
  if (phase === 'downloading' || phase === 'clearing') {
    return measured === null ? { mode: 'indeterminate' } : { mode: 'determinate', ratio: measured };
  }
  return { mode: 'indeterminate' };
}
