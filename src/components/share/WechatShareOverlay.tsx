/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 微信内转发引导覆层：微信内置浏览器打开本站时，引导点击右上角「···」转发给同学。
 * 防骚扰：会话级一次（sessionStorage）；首访者（欢迎弹窗未确认）本轮不弹，避免叠罗汉。
 * 层级 z-[110]，高于欢迎弹窗（z-[100]）。
 */
import { useEffect, useState } from 'react';
import { isWechat } from '../../lib/is-wechat';
import { useApp } from '../../lib/app-context';

const SESSION_KEY = 'stem-wechat-overlay';

export default function WechatShareOverlay() {
  const { t } = useApp();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isWechat()) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    // 首访者（欢迎弹窗未确认过）本轮不弹，避免与欢迎弹窗叠罗汉
    if (!localStorage.getItem('stem-welcome-seen')) return;
    setShow(true);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/60 flex flex-col items-center"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label={t.wechatOverlayHint}
    >
      {/* 弧形箭头指向右上角「···」胶囊菜单 */}
      <svg className="mt-14 w-28 h-28 text-white" viewBox="0 0 112 112" fill="none" aria-hidden="true">
        <path
          d="M36 76 C 44 44, 62 22, 92 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="5 5"
        />
        <path d="M92 10 l-9 -15 M92 10 l-16 -1" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p className="mt-6 px-8 text-center text-sm leading-relaxed text-white serif-font">{t.wechatOverlayHint}</p>
      <p className="mt-3 text-xs text-white/70">{t.wechatOverlayDismiss}</p>
    </div>
  );
}
