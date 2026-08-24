/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 版本检测 hook：对比远端 version.json 与本版本号，有新版本时置 hasUpdate。
 * Header 与 WelcomeDialog 共用；fetch 失败（离线/网络异常）静默忽略，不打扰用户。
 */
import { useEffect, useState } from 'react';
import { APP_VERSION } from './changelog';

export function useVersionCheck(): { hasUpdate: boolean } {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/version.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && typeof d.version === 'string' && d.version !== APP_VERSION) {
          setHasUpdate(true);
        }
      })
      .catch(() => { /* 网络/离线：忽略，不打扰 */ });
    return () => { cancelled = true; };
  }, []);

  return { hasUpdate };
}