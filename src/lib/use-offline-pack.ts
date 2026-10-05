/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 离线教学包的状态与下载驱动。
 * 状态放在组件外面，是为了让「顶栏徽标 / 周期表面板入口 / 面板本身」三处始终一致，
 * 也让用户关掉面板后下载能继续跑。
 */
import { useEffect, useSyncExternalStore } from 'react';
import {
  checkStatus,
  clearOfflinePack,
  downloadAll,
  type PackProgress,
  type PackStatus,
} from './offline-pack';

let status: PackStatus | null = null;
let progress: PackProgress | null = null;
let running = false;
let failed: string[] = [];
let controller: AbortController | null = null;
let version = 0;

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const bump = () => {
  version += 1;
  listeners.forEach((listener) => listener());
};

export async function refreshPackStatus(): Promise<void> {
  status = await checkStatus();
  bump();
}

export function startPackDownload(): void {
  if (running) return;
  running = true;
  progress = null;
  failed = [];
  controller = new AbortController();
  bump();
  void downloadAll({
    signal: controller.signal,
    onProgress: (p) => {
      progress = p;
      bump();
    },
  })
    .then((result) => {
      failed = result.failed;
    })
    .catch(() => {
      /* 清单读不到等异常：保持现状，不打断页面 */
    })
    .finally(async () => {
      running = false;
      controller = null;
      await refreshPackStatus();
    });
}

export function stopPackDownload(): void {
  controller?.abort();
}

export async function clearPack(): Promise<void> {
  await clearOfflinePack();
  progress = null;
  failed = [];
  await refreshPackStatus();
}

export function useOfflinePack() {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
  // 首次挂载时读一次本机状态（顶栏徽标与入口都靠它）
  useEffect(() => {
    if (!status) void refreshPackStatus();
  }, []);
  return {
    status,
    progress,
    running,
    failedCount: failed.length,
    start: startPackDownload,
    stop: stopPackDownload,
    clear: clearPack,
    refresh: refreshPackStatus,
  };
}
