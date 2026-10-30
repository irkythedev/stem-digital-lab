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

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'activating'
  | 'clearing'
  | 'reloading';

const CHECK_MS = 8000;        // reg.update() 检查的最长等待
const INSTALL_MS = 8000;      // 新 worker 安装完成的最长等待
const ACTIVATE_MS = 4000;     // 发出 SKIP_WAITING 后等 controllerchange 的硬上限
const HARD_DEADLINE_MS = 20000; // 整个流程的绝对上限

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

/** 清缓存 + 注销 SW + 带版本号硬跳转；三步都不依赖旧 SW 配合 */
export async function hardResetAndReload(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
  } catch { /* 无 SW / 隐私模式：继续清缓存 */ }
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch { /* ignore */ }
  const url = new URL(window.location.href);
  url.searchParams.set('_v', String(Date.now()));
  window.location.replace(url.toString());
}

export function useAppUpdate() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const runningRef = useRef(false);
  const remoteVersionRef = useRef('');
  const ccBoundRef = useRef(false);

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

    let settled = false;
    let resetting = false;
    let deadline = 0;
    let activationTimer = 0;

    const settle = () => {
      if (settled) return;
      settled = true;
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
      await hardResetAndReload();
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
    applyUpdate,
    busy: phase === 'checking' || phase === 'downloading' || phase === 'activating' || phase === 'clearing',
  };
}
