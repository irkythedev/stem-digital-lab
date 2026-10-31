/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 离线教学包：把元素实物照片、全部读音和两张架构图存到本机，断网的教室也能照常上课。
 *
 * 存的位置就是 Service Worker 已经在用的那几个缓存桶（见 offline-media.ts），
 * 所以断网时页面请求直接命中缓存，不需要改动 dist/sw.js。
 * 清单由构建时生成（vite.config.ts 的 writeOfflineManifest），数量与体积都不写死；
 * 每个文件带 8 位内容 hash，配合本机记录的「已装 hash」识别素材修正/站点更新。
 */
import { AUDIO_CACHE, DIAGRAM_CACHE, PHOTO_CACHE } from './offline-media';

export interface PackFile {
  url: string;
  bytes: number;
  /** 8 位内容哈希；旧清单可能缺失（缺省时按「存在即已装」兼容）。 */
  hash?: string;
}

export interface PackGroup {
  id: 'photos' | 'audio' | 'diagrams';
  files: PackFile[];
}

export interface PackManifest {
  /** 构建时的应用版本（APP_VERSION），用于整包换代提示。 */
  version?: string;
  builtAt: number;
  groups: PackGroup[];
}

/** 本机已装素材的 hash 索引（localStorage）：url → hash。用来与最新清单比对是否需补存。 */
const HASH_STORAGE_KEY = 'stem-offline-pack-hashes';

function readInstalledHashes(): Map<string, string> {
  try {
    if (typeof localStorage === 'undefined') return new Map();
    const raw = localStorage.getItem(HASH_STORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, string>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function writeInstalledHashes(hashes: Map<string, string>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(HASH_STORAGE_KEY, JSON.stringify(Object.fromEntries(hashes)));
  } catch {
    /* 隐私模式不可写：忽略，下次仍会按未装处理 */
  }
}

/** 不支持时的真实原因：非安全上下文 / 浏览器确实没有该能力 */
export type SupportReason = 'ok' | 'insecure' | 'unsupported';

export interface PackStatus {
  /** 浏览器是否支持把文件存到本机 */
  supported: boolean;
  /** 不支持的具体原因（面板据此给不同说法，避免一句「不支持」盖住真实缘由） */
  reason: SupportReason;
  /** 清单里的文件是否已经全在本机 */
  isFull: boolean;
  cachedCount: number;
  totalCount: number;
  /** 已缓存但 hash 与最新清单不一致（或旧版无 hash）而需要补存的条目数。 */
  outdatedCount: number;
  cachedBytes: number;
  totalBytes: number;
  /** 各组明细（照片/读音/架构图各多少个、共多少字节）——面板文案据此显示，不写死数字 */
  groups: { id: string; count: number; bytes: number }[];
}

export interface PackProgress {
  done: number;
  total: number;
  bytes: number;
  totalBytes: number;
}

/** 每一组素材存进哪个桶 —— 与 vite.config.ts 的运行时路由一一对应 */
const GROUP_CACHE: Record<string, string> = {
  photos: PHOTO_CACHE,
  audio: AUDIO_CACHE,
  diagrams: DIAGRAM_CACHE,
};

/** 一次最多同时下 6 个：比逐个下快得多，又不会把教室里的带宽占满 */
const CONCURRENCY = 6;

export async function loadManifest(): Promise<PackManifest | null> {
  try {
    const res = await fetch('/offline-manifest.json');
    if (!res.ok) return null;
    const data = (await res.json()) as PackManifest;
    return Array.isArray(data?.groups) ? data : null;
  } catch {
    return null;
  }
}

export function isSupported(): boolean {
  return supportReason() === 'ok';
}

/**
 * 为什么不能用：浏览器的离线存储（CacheStorage 与 Service Worker）只在安全上下文下提供，
 * 也就是 https 或 localhost。内网用 http 地址打开时它们直接不存在——这是浏览器规则，
 * 应用侧无法绕过，只能如实告诉用户原因与办法。
 */
export function supportReason(): SupportReason {
  const hasApi =
    typeof caches !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  if (hasApi) return 'ok';
  const insecure = typeof window !== 'undefined' && window.isSecureContext === false;
  return insecure ? 'insecure' : 'unsupported';
}

/**
 * 纯计算：把清单摊平成「哪个文件写进哪个桶」，并标出哪些已经在本机。
 * 已在本机的不再重复下载 —— 这就是断点续下。
 */
export function planTasks(
  manifest: PackManifest,
  cachedPaths: Map<string, Set<string>>,
  installedHashes: Map<string, string> = new Map(),
): { file: PackFile; cache: string; cached: boolean; present: boolean }[] {
  const tasks: { file: PackFile; cache: string; cached: boolean; present: boolean }[] = [];
  for (const group of manifest.groups) {
    const cache = GROUP_CACHE[group.id];
    if (!cache) continue;
    const have = cachedPaths.get(cache) ?? new Set<string>();
    for (const file of group.files) {
      const present = have.has(file.url);
      // 有 hash 时必须与「本机已装 hash」一致才算已就绪；旧版无 hash 的清单退化为「存在即已装」。
      const cached = present && (!file.hash || installedHashes.get(file.url) === file.hash);
      tasks.push({ file, cache, cached, present });
    }
  }
  return tasks;
}

/** 读出各桶里已存的路径（只取 pathname，便于与清单里的 /element-images/1.jpg 直接比对） */
async function readCachedPaths(): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  for (const name of new Set(Object.values(GROUP_CACHE))) {
    try {
      const cache = await caches.open(name);
      out.set(name, new Set((await cache.keys()).map((req) => new URL(req.url).pathname)));
    } catch {
      out.set(name, new Set());
    }
  }
  return out;
}

export async function checkStatus(): Promise<PackStatus> {
  const reason = supportReason();
  const supported = reason === 'ok';
  const manifest = await loadManifest();
  if (!manifest) {
    return { supported, reason, isFull: false, cachedCount: 0, totalCount: 0, outdatedCount: 0, cachedBytes: 0, totalBytes: 0, groups: [] };
  }
  const tasks = planTasks(
    manifest,
    supported ? await readCachedPaths() : new Map(),
    supported ? readInstalledHashes() : new Map(),
  );
  const totalBytes = tasks.reduce((sum, t) => sum + t.file.bytes, 0);
  const cached = tasks.filter((t) => t.cached);
  // 「已在本机、但版本旧了」的条目：需要补存（不与「全新未下载」混为一谈）。
  const outdatedCount = tasks.filter((t) => t.present && !t.cached).length;
  const groups = manifest.groups.map((g) => ({
    id: g.id,
    count: g.files.length,
    bytes: g.files.reduce((sum, f) => sum + f.bytes, 0),
  }));
  return {
    supported,
    reason,
    groups,
    isFull: tasks.length > 0 && cached.length === tasks.length,
    cachedCount: cached.length,
    totalCount: tasks.length,
    outdatedCount,
    cachedBytes: cached.reduce((sum, t) => sum + t.file.bytes, 0),
    totalBytes,
  };
}

/** 进度用字节算，比「第几个/总数」平滑；已存过的先算进去 */
export async function downloadAll(
  options: { onProgress?: (p: PackProgress) => void; signal?: AbortSignal } = {},
): Promise<{ ok: number; failed: string[] }> {
  const manifest = await loadManifest();
  if (!manifest) throw new Error('offline-manifest-unavailable');

  // 申请持久化：教室平板放久了也不该被浏览器悄悄清掉
  if (navigator.storage?.persist) {
    try {
      await navigator.storage.persist();
    } catch {
      /* 不支持就算了，不影响下载 */
    }
  }

  const installedHashes = readInstalledHashes();
  const tasks = planTasks(manifest, await readCachedPaths(), installedHashes);
  const totalBytes = tasks.reduce((sum, t) => sum + t.file.bytes, 0);
  const total = tasks.length;
  const handles = new Map<string, Cache>();
  for (const name of new Set(tasks.map((t) => t.cache))) handles.set(name, await caches.open(name));

  let done = tasks.filter((t) => t.cached).length;
  let bytes = tasks.filter((t) => t.cached).reduce((sum, t) => sum + t.file.bytes, 0);
  const report = () => options.onProgress?.({ done, total, bytes, totalBytes });
  report();

  const todo = tasks.filter((t) => !t.cached);
  const failed: string[] = [];
  let cursor = 0;

  const worker = async () => {
    while (cursor < todo.length) {
      if (options.signal?.aborted) return;
      const task = todo[cursor++];
      let ok = false;
      // 单个文件最多试 3 次；中途取消就直接退出
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        try {
          const res = await fetch(task.file.url, { signal: options.signal });
          if (!res.ok) throw new Error(String(res.status));
          await handles.get(task.cache)!.put(new Request(task.file.url), res);
          ok = true;
        } catch {
          if (options.signal?.aborted) return;
        }
      }
      if (ok) {
        done += 1;
        bytes += task.file.bytes;
        if (task.file.hash) installedHashes.set(task.file.url, task.file.hash);
      } else {
        // 个别文件失败不打断整体，最后一起报出来
        failed.push(task.file.url);
      }
      report();
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
  writeInstalledHashes(installedHashes);
  return { ok: done, failed };
}

export async function clearOfflinePack(): Promise<void> {
  for (const name of new Set(Object.values(GROUP_CACHE))) {
    try {
      await caches.delete(name);
    } catch {
      /* 忽略 */
    }
  }
  writeInstalledHashes(new Map());
}

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
