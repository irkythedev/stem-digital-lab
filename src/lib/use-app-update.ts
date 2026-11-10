/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 应用更新状态机（顶栏更新徽章专用）。
 *
 *   idle → checking → downloading → activating → reloading
 *                     ↘ 慢网/异常 → idle（提示重试，绝不清缓存）
 *
 * 设计要点：
 * - 「有新版本」只由远端 version.json 判定（带时间戳，穿透边缘缓存）；
 *   挂载、回到前台、恢复联网时各查一次。
 * - SW 文件名按版本生成（`sw-<version>.js`）；更新时先探测目标版本的 SW 是否存在，
 *   再显式 `register(swUrlFor(remoteVersion), { scope: '/' })`。版本变化即 URL 变化，
 *   边缘缓存不会再把旧 `sw.js` 喂回来。
 * - 刷新动作仍由 main.tsx 的 controllerchange 唯一负责；本 hook 不自行 reload。
 * - 失败（更新检查抛错 / 拿不到 worker / 安装或激活超时）一律回到 idle，让用户重试；
 *   自动 `hardReset()` 已移除，只有显式故障恢复能力 `hardResetAndReload()` 保留。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_VERSION } from './app-version';
import { AUDIO_CACHE, DIAGRAM_CACHE, PHOTO_CACHE } from './offline-media';
import { isVersionNewer } from './version-compare';
import { swUrlFor } from './sw-url';
import {
  countCachedEntries,
  parsePrecacheManifest,
  type UpdatePhase,
  type UpdateProgress,
} from './update-progress';

export type { UpdatePhase, UpdateProgress };

const CHECK_MS = 20000;       // 更新检查的最长等待（慢网下放宽）
const INSTALL_MS = 60000;     // 新 worker 安装完成的最长等待（首装/慢网可能几十秒）
const ACTIVATE_MS = 45000;    // 发出 SKIP_WAITING 后等 controllerchange 的上限
const HARD_DEADLINE_MS = 120000; // 整个流程的绝对上限
/** 更新失败提示的停留时间：足够用户看到，又不至于长期占着顶栏 */
const UPDATE_FAILED_NOTICE_MS = 3500;
/** 预缓存条目计数的采样间隔：安装期计数单调增长，120ms 足以让弧看起来连续 */
const PROGRESS_POLL_MS = 120;

/** 离线教学包（元素照片 / 元素音频 / 架构图）是用户主动下载的内容，更新前端不该删。 */
const PACK_CACHES = new Set<string>([PHOTO_CACHE, AUDIO_CACHE, DIAGRAM_CACHE]);

/** 只清「应用外壳」缓存：Workbox precache 与架构页缓存；离线教学包一律保留。 */
export function selectShellCachesToClear(keys: readonly string[]): string[] {
  return keys.filter(
    (k) => !PACK_CACHES.has(k) && (k.startsWith('workbox-precache') || k.startsWith('architecture-page')),
  );
}

/** 故障恢复（仅用户显式触发）：注销 SW + 精准清 precache + 带版本号硬跳。
 *
 *  这是兜底能力，更新流程不会再自动调用它。
 */
export async function hardResetAndReload(
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  let regs: readonly ServiceWorkerRegistration[] = [];
  try {
    regs = await navigator.serviceWorker.getRegistrations();
  } catch { /* 无 SW / 隐私模式：继续清缓存 */ }
  let keys: string[] = [];
  try {
    if (typeof caches !== 'undefined') keys = selectShellCachesToClear(await caches.keys());
  } catch { /* ignore */ }

  const total = regs.length + keys.length;
  let done = 0;
  if (total > 0) onProgress?.(0, total);

  for (const reg of regs) {
    await reg.unregister().catch(() => false);
    done += 1;
    onProgress?.(done, total);
  }
  for (const key of keys) {
    if (typeof caches === 'undefined') break;
    await caches.delete(key).catch(() => false);
    done += 1;
    onProgress?.(done, total);
  }

  const url = new URL(window.location.href);
  url.searchParams.set('_v', String(Date.now()));
  window.location.replace(url.toString());
}

/** 带时间戳读取远端版本号：边缘与浏览器都必须回源，避免拿到陈旧 version.json。 */
export async function fetchRemoteVersion(): Promise<string | null> {
  try {
    const r = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const d = (await r.json()) as { version?: unknown };
    return typeof d.version === 'string' ? d.version : null;
  } catch {
    return null;
  }
}

/** 判断响应体是否像真正的 Service Worker 脚本，而不是 EdgeOne 的 SPA fallback HTML。 */
function looksLikeServiceWorkerScript(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('<')) return false;
  return /(?:self\.|addEventListener|precache|CACHE|importScripts|function\s|=>)/.test(trimmed);
}

/** 探测目标版本的 SW 文件是否存在（带时间戳，穿透边缘缓存）。 */
export async function probeSwExists(version: string): Promise<boolean> {
  try {
    const r = await fetch(`${swUrlFor(version)}?_t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return false;
    const contentType = r.headers.get('content-type') || '';
    if (contentType && !/(javascript|ecmascript)/i.test(contentType)) return false;
    return looksLikeServiceWorkerScript(await r.text());
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { window.setTimeout(resolve, ms); });
}

export function useAppUpdate() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  /** 只有 downloading / clearing 两段会赋值；其余阶段为 null，环退化成扫动弧 */
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const runningRef = useRef(false);
  const remoteVersionRef = useRef('');
  const ccBoundRef = useRef(false);
  const pollRef = useRef(0);
  /** trackPrecache 幂等守卫：一次点击只开一表 */
  const trackingRef = useRef(false);
  /** 失败提示的自动回 idle 定时器 */
  const failedTimer = useRef(0);

  /** 停表：阶段切换与流程结束都必须调，否则页面加载完还在每 120ms 开一次 cache */
  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = 0;
    }
  }, []);

  useEffect(() => () => {
    if (failedTimer.current) window.clearTimeout(failedTimer.current);
  }, []);

  /**
   * 预缓存条目进度。分母取**目标版本** SW 里的新清单，
   * 逐条按 URL + revision 对齐已写入的缓存条目。
   */
  const trackPrecache = useCallback(async (version: string) => {
    if (typeof caches === 'undefined') return;
    if (trackingRef.current) return;
    trackingRef.current = true;
    try {
      const res = await fetch(`${swUrlFor(version)}?_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const entries = parsePrecacheManifest(await res.text());
      if (entries.length === 0) return;
      setProgress({ done: 0, total: entries.length });
      /** 第一次采样同时充当基准：弧只画「本次更新还要做的量」的进度 */
      let base: number | undefined;
      const sample = async () => {
        try {
          const names = (await caches.keys()).filter((n) => n.startsWith('workbox-precache'));
          const hrefs: string[] = [];
          for (const name of names) {
            const cache = await caches.open(name);
            for (const request of await cache.keys()) hrefs.push(request.url);
          }
          const done = countCachedEntries(entries, hrefs);
          if (base === undefined) base = done;
          setProgress({ done, total: entries.length, base });
        } catch { /* 读缓存失败：保留上一次读数，不倒退到 0 */ }
      };
      void sample();
      stopPoll();
      pollRef.current = window.setInterval(() => { void sample(); }, PROGRESS_POLL_MS);
    } catch { /* 清单拿不到：保持 null，走扫动弧 */ }
  }, [stopPoll]);

  // 检测：挂载 + 回到前台 + 恢复联网时各查一次
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled || !d || typeof d.version !== 'string') return;
          remoteVersionRef.current = d.version;
          setHasUpdate(isVersionNewer(d.version, APP_VERSION));
        })
        .catch(() => { /* 离线 / 网络异常：保持上一次结论，不打扰 */ });
    };
    check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', check);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', check);
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    if (runningRef.current) return; // 防连点
    const known = remoteVersionRef.current;
    if (known && !isVersionNewer(known, APP_VERSION)) {
      setHasUpdate(false);
      setPhase('idle');
      return;
    }
    runningRef.current = true;
    if (failedTimer.current) {
      window.clearTimeout(failedTimer.current);
      failedTimer.current = 0;
    }
    setPhase('checking');
    setProgress(null);
    trackingRef.current = false;

    let settled = false;
    let deadline = 0;
    let activationTimer = 0;

    const settle = () => {
      if (settled) return;
      settled = true;
      stopPoll();
      window.clearTimeout(deadline);
      window.clearTimeout(activationTimer);
    };

    /** 慢网/异常：回到可见的失败态，3.5s 后再回 idle；绝不清缓存。 */
    const giveUp = () => {
      settle();
      runningRef.current = false;
      setPhase('failed');
      if (failedTimer.current) window.clearTimeout(failedTimer.current);
      failedTimer.current = window.setTimeout(() => {
        failedTimer.current = 0;
        setPhase('idle');
      }, UPDATE_FAILED_NOTICE_MS);
    };

    deadline = window.setTimeout(() => { giveUp(); }, HARD_DEADLINE_MS);

    try {
      if (!('serviceWorker' in navigator)) { giveUp(); return; }

      // 接管成功：main.tsx 的 controllerchange 会刷新页面；这里只更新文案
      if (!ccBoundRef.current) {
        ccBoundRef.current = true;
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => {
            ccBoundRef.current = false;
            settle();
            setPhase('reloading');
          },
          { once: true },
        );
      }

      const remote = remoteVersionRef.current || (await fetchRemoteVersion()) || '';
      remoteVersionRef.current = remote;
      if (!remote || !isVersionNewer(remote, APP_VERSION)) {
        setHasUpdate(false);
        giveUp();
        return;
      }

      // 目标版本 SW 不存在（部署窗口/边缘未就绪）：按网络慢处理，重试即可
      if (!(await probeSwExists(remote))) { giveUp(); return; }

      void trackPrecache(remote);

      // 显式注册目标版本的 SW；版本变化 = URL 变化，边缘缓存无法再喂旧条目
      const reg = await navigator.serviceWorker.register(swUrlFor(remote), { scope: '/' });
      let worker: ServiceWorker | null = reg.installing ?? reg.waiting ?? null;
      for (let i = 0; i < 20 && !worker; i += 1) {
        await sleep(100);
        worker = reg.installing ?? reg.waiting ?? null;
      }
      if (!worker) { giveUp(); return; }
      if (worker.state === 'redundant') { giveUp(); return; }

      // 等安装完成（60s 上限）
      if (worker.state !== 'installed' && worker.state !== 'activated') {
        setPhase('downloading');
        void trackPrecache(remote);
        const installed = await new Promise<'ok' | 'redundant' | 'timeout'>((resolve) => {
          let timer = 0;
          const onChange = () => {
            if (worker!.state === 'installed' || worker!.state === 'activated') {
              window.clearTimeout(timer);
              worker!.removeEventListener('statechange', onChange);
              resolve('ok');
            } else if (worker!.state === 'redundant') {
              window.clearTimeout(timer);
              worker!.removeEventListener('statechange', onChange);
              resolve('redundant');
            }
          };
          timer = window.setTimeout(() => {
            worker!.removeEventListener('statechange', onChange);
            resolve('timeout');
          }, INSTALL_MS);
          worker!.addEventListener('statechange', onChange);
          onChange();
        });
        if (installed !== 'ok') { giveUp(); return; }
        stopPoll();
      }

      // 请求接管（生成的 SW 自带 skipWaiting；对 waiting 型 SW 同样有效）
      setPhase('activating');
      try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch { /* ignore */ }

      // 首访/强制刷新后页面没有 controller，controllerchange 永远不会触发；
      // 新 SW 安装/激活已经完成后直接刷新，避免空等 45s。
      if (!navigator.serviceWorker.controller) {
        setPhase('reloading');
        settle();
        runningRef.current = false;
        window.setTimeout(() => window.location.reload(), 600);
        return;
      }

      // 激活上限：45s；超时回失败态让用户重试，不清缓存
      activationTimer = window.setTimeout(() => { giveUp(); }, ACTIVATE_MS);
    } catch {
      giveUp();
    }
  }, []);

  return {
    hasUpdate,
    phase,
    progress,
    applyUpdate,
    busy: phase === 'checking' || phase === 'downloading' || phase === 'activating' || phase === 'clearing',
  };
}
