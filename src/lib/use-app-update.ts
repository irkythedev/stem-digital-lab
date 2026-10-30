/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 应用更新状态机（顶栏更新徽章专用）。
 *
 *   idle → checking → downloading → activating → reloading
 *                     ↘ 任一环节超时 → clearing → 带版本号硬跳转
 *
 * 设计要点：
 * - 「有新版本」只由远端 version.json 判定；挂载、回到前台、恢复联网时各查一次。
 * - 刷新动作仍由 main.tsx 的 controllerchange 唯一负责；本 hook 的成功路径不自行
 *   reload，只在超时 / 无在途 worker 时执行硬兜底，避免两个刷新驱动抢跑。
 * - 旧实现「reg.update() 后没有新 worker 就直接 reload」会在旧 SW 仍控制页面时
 *   用旧 precache 应答导航 —— 刷新后还是旧版、绿点复现，这就是「点几次才生效」
 *   的根因。这里该分支被硬兜底替代。
 * - 防死循环守卫：同一标签页会话内，对同一个远端版本号最多硬重置一次
 *   （sessionStorage 记录）。发布窗口内新旧资源错配时，页面不会再被自动无限硬刷。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_VERSION } from './changelog';
import {
  countCachedEntries,
  parsePrecacheManifest,
  type UpdatePhase,
  type UpdateProgress,
} from './update-progress';

export type { UpdatePhase, UpdateProgress };

const CHECK_MS = 8000;        // reg.update() 检查的最长等待
const INSTALL_MS = 8000;      // 新 worker 安装完成的最长等待
const ACTIVATE_MS = 4000;     // 发出 SKIP_WAITING 后等 controllerchange 的硬上限
const HARD_DEADLINE_MS = 20000; // 整个流程的绝对上限
/** 预缓存条目计数的采样间隔：安装期计数单调增长，120ms 足以让弧看起来连续 */
const PROGRESS_POLL_MS = 120;

/** 硬重置的「已执行版本」标记：同一会话同一远端版本只允许一次 */
const HARD_RESET_KEY = 'stem_hard_reset_ver';

/** 记录本次硬重置；返回 false 表示该远端版本本次会话已经硬重置过，需要放弃自动循环 */
function claimHardReset(remoteVersion: string): boolean {
  try {
    if (window.sessionStorage.getItem(HARD_RESET_KEY) === remoteVersion) return false;
    window.sessionStorage.setItem(HARD_RESET_KEY, remoteVersion);
    return true;
  } catch {
    // 隐私模式 / 存储被禁用：无法持久化守卫，按「允许一次」处理
    return true;
  }
}

/** 清缓存 + 注销 SW + 带版本号硬跳转；三步都不依赖旧 SW 配合。
 *
 *  `onProgress` 给出这一步的真值（单位同样是**条目**：一个注册 + 一个缓存各算一条）。
 *  逐个删而不是 Promise.all：并发的删除只会让弧一次性跳到满，等于没有进度。 */
export async function hardResetAndReload(
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  let regs: readonly ServiceWorkerRegistration[] = [];
  try {
    regs = await navigator.serviceWorker.getRegistrations();
  } catch { /* 无 SW / 隐私模式：继续清缓存 */ }
  let keys: string[] = [];
  try {
    if (typeof caches !== 'undefined') keys = await caches.keys();
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

export function useAppUpdate() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  /** 只有 downloading / clearing 两段会赋值；其余阶段为 null，环退化成扫动弧 */
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const runningRef = useRef(false);
  const remoteVersionRef = useRef('');
  const ccBoundRef = useRef(false);
  const pollRef = useRef(0);
  /** trackPrecache 幂等守卫：一次点击只开一表（checking 阶段先开，downloading 复用） */
  const trackingRef = useRef(false);

  /** 停表：阶段切换与流程结束都必须调，否则页面加载完还在每 120ms 开一次 cache */
  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = 0;
    }
  }, []);

  /**
   * 预缓存条目进度。真值边界见 update-progress.ts 抬头：
   * 分母取 sw.js 里的**新清单**，逐条按 URL + revision 对齐已写入的缓存条目。
   * 拿不到清单或没有 caches（隐私模式）就什么都不做 —— 环会保持扫动弧，不编造进度。
   */
  const trackPrecache = useCallback(async () => {
    if (typeof caches === 'undefined') return;
    if (trackingRef.current) return; // 幂等：点一次只开一表
    trackingRef.current = true;
    try {
      const res = await fetch('/sw.js', { cache: 'no-store' });
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

  // 检测：挂载 + 回到前台 + 恢复联网时各查一次（旧 hook 只查一次，
  // 标签页长期挂着时永远看不到之后发布的版本）
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      fetch('/version.json', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled || !d || typeof d.version !== 'string') return;
          remoteVersionRef.current = d.version;
          setHasUpdate(d.version !== APP_VERSION);
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
    runningRef.current = true;
    setPhase('checking');
    setProgress(null);
    /* 采样必须在 reg.update() 之前开表：update() 返回时新 worker 往往已经在装，
       晚开表会让基准吃掉前半段进度，弧一起手就接近满（实测 160ms 内 0→87%）。 */
    trackingRef.current = false;
    void trackPrecache();

    let settled = false;
    let resetting = false;
    let deadline = 0;
    let activationTimer = 0;

    const settle = () => {
      if (settled) return;
      settled = true;
      stopPoll();
      window.clearTimeout(deadline);
      window.clearTimeout(activationTimer);
    };

    const hardReset = async () => {
      if (resetting) return; // watchdog 与失败分支可能同时到达
      resetting = true;
      settle();
      // 防死循环：同一会话对同一远端版本只硬重置一次
      const remote = remoteVersionRef.current || 'unknown';
      if (!claimHardReset(remote)) {
        setPhase('idle');
        runningRef.current = false;
        return;
      }
      setPhase('clearing');
      await hardResetAndReload((done, total) => setProgress({ done, total }));
    };

    deadline = window.setTimeout(() => { void hardReset(); }, HARD_DEADLINE_MS);

    try {
      if (!('serviceWorker' in navigator)) {
        await hardReset();
        return;
      }

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

      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        // 连注册都没有 → 当前页面本就没有 SW 缓存，直接带版本号刷新
        await hardReset();
        return;
      }

      // 1) 上次点击已留下 installing / waiting，直接续跑
      let worker: ServiceWorker | null = reg.installing ?? reg.waiting ?? null;

      // 2) 没有在途 worker → 主动触发一次更新检查
      if (!worker) {
        const outcome = await Promise.race([
          reg.update().then(() => 'ok' as const).catch(() => 'error' as const),
          new Promise<'timeout'>((resolve) => {
            window.setTimeout(() => resolve('timeout'), CHECK_MS);
          }),
        ]);
        if (outcome === 'timeout') { await hardReset(); return; }
        worker = reg.installing ?? reg.waiting ?? null;
      }

      // 3) 远端 version.json 说新版、SW 却说没有更新：旧控制器仍会用旧
      //    precache 应答导航，普通 reload 100% 还是旧版 → 必须硬兜底
      if (!worker) { await hardReset(); return; }

      if (worker.state === 'redundant') { await hardReset(); return; }

      // 4) 等安装完成（8s 上限）
      if (worker.state !== 'installed' && worker.state !== 'activated') {
        setPhase('downloading');
        // 采样在 checking 阶段就开好了（基准必须是安装前状态），这里只是确保在跑
        void trackPrecache();
        const installed = await new Promise<boolean>((resolve) => {
          let timer = 0;
          const onChange = () => {
            if (worker!.state === 'installed' || worker!.state === 'activated') {
              window.clearTimeout(timer);
              worker!.removeEventListener('statechange', onChange);
              resolve(true);
            } else if (worker!.state === 'redundant') {
              window.clearTimeout(timer);
              worker!.removeEventListener('statechange', onChange);
              resolve(false);
            }
          };
          timer = window.setTimeout(() => {
            worker!.removeEventListener('statechange', onChange);
            resolve(false);
          }, INSTALL_MS);
          worker!.addEventListener('statechange', onChange);
          onChange();
        });
        if (!installed) { await hardReset(); return; }
        // 安装结束即停表：接下来是 activating（无分母，走扫动弧），不再需要采样
        stopPoll();
      }

      // 5) 请求接管（生成的 SW 自带 skipWaiting；对 waiting 型 SW 同样有效）
      setPhase('activating');
      try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch { /* ignore */ }

      // 6) 4s 内仍未 controllerchange → 清缓存注销 + 硬跳
      activationTimer = window.setTimeout(() => { void hardReset(); }, ACTIVATE_MS);
    } catch {
      await hardReset();
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
