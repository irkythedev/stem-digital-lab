/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 计算引擎标识徽章（欧姆定律 / 凸透镜成像 / 二次函数三实验共用）。
 * 挂在参数卡标题行右侧，形制借鉴 shields.io 的实色值块，但仅用本仓库
 * CSS 变量（--accent 实底反白），深浅主题自动反相：
 * - C++ 态：--accent 实底 + --bg 反白粗体「C++」（原生计算核已就绪）
 * - JS 态：灰描边细框 + --muted「JS」（兼容回退）
 * 完整说明（中英文）由调用方传入本地化文案，经 title/aria 暴露。
 * 只读状态展示，无交互副作用；直角、无新增色。
 */
export default function EngineBadge({ kind, title }: { kind: 'js' | 'wasm'; title: string }) {
  const live = kind === 'wasm';
  return (
    <span
      title={title}
      aria-label={title}
      role="status"
      className={`inline-flex shrink-0 items-center border px-2 py-[0.25rem] leading-none ${
        live
          ? 'border-transparent bg-[var(--accent)] text-[var(--bg)]'
          : 'border-[var(--border)] text-[var(--muted)]'
      }`}
    >
      <span className="text-[0.625rem] mono-font font-bold uppercase tracking-wider">
        {live ? 'C++' : 'JS'}
      </span>
    </span>
  );
}
