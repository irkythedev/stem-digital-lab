/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 计算引擎标识徽章：全站唯一的引擎状态指示器，七处调用方共用
 * （欧姆定律 / 凸透镜成像 / 二次函数 / 反比例函数 / 酸碱中和 / 浮力经各自实验页，
 * 电学工作台经 `CircuitEngineBadge` 走 `labs.ts` 的 `headerBadge`）。
 *
 * 形制：24px 高的胶囊（`h-6`）+ 14px 矢量标 + 12px 等宽字，是**品牌淡底芯片**：
 * - 原生核（wasm）态：C++ 淡蓝底 + 深蓝墨（`--brand-cpp-chip` / `--brand-cpp-ink`），
 *   `CppIcon`（官方原形六边形）+「C++」
 * - 回退（js）态：JS 淡黄底 + 深琥珀墨（`--brand-js-chip` / `--brand-js-ink`），
 *   `JsIcon`（官方原形圆角方）+「JS」
 * 两枚图标见 `components/ui/EngineIcons.tsx`，都是单色描边 + `currentColor`；
 * 容器这里只负责把 `color` 设成对应的品牌墨令牌，标自身不含色值、不含主题分支，
 * 亮暗各一组值全在 index.css（取值与四格对比度的来历见那里的注释）。
 * 外框保留 1px 但取芯片同色 —— 它现在不画边，只为维持盒模型：去掉会让徽章比
 * 历史量值宽 2px，而这一处没有要修的问题。
 *
 * 状态信号的代价（相对「实底=运行中 / 描边=回退」那版形制）：淡底芯片两态都是
 * 「有底色」，所以「原生核正在跑」不再由实底/描边这组形制冗余重复一遍，只剩色相
 * （蓝 / 黄）与文案（C++ / JS）——两者指向同一件事，读屏也照旧只听得到文案。
 * 这是选淡底路线时就已知的取舍，不是漏做。
 *
 * 完整说明（中英文）仍由调用方经 `getEngineTooltip` 传入，透过 `title` / `aria-label`
 * 暴露；徽章自身的可见文案只有引擎名，图标 `aria-hidden`，避免读屏把
 * 「C++」念两遍。只读状态展示，无交互副作用。
 */
import { CppIcon, JsIcon } from '../ui/EngineIcons';

const ICON = 'h-3.5 w-3.5 shrink-0';

/**
 * 纯形制层：品牌淡底芯片 + 引擎标 + 引擎名（`C++` / `JS`）。
 * 状态语义（`role="status"` / 悬停文案）由调用方决定：
 * 实验页与工作台页头用 `EngineBadge`（活状态），学科页卡片直接用它标「该实验由 C++ 核驱动」
 * （静态事实，不该念成 status）。
 */
export function EngineChip({
  kind,
  className = '',
  title,
  role,
  ariaLabel,
}: {
  kind: 'js' | 'wasm';
  className?: string;
  title?: string;
  role?: string;
  ariaLabel?: string;
}) {
  const live = kind === 'wasm';
  return (
    <span
      title={title}
      aria-label={ariaLabel}
      role={role}
      className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-2 mono-font text-xs leading-none ${
        live
          ? 'border-[var(--brand-cpp-chip)] bg-[var(--brand-cpp-chip)] text-[var(--brand-cpp-ink)]'
          : 'border-[var(--brand-js-chip)] bg-[var(--brand-js-chip)] text-[var(--brand-js-ink)]'
      }${className ? ' ' + className : ''}`}
    >
      {live ? <CppIcon className={ICON} /> : <JsIcon className={ICON} />}
      <span className="font-bold uppercase tracking-wider">{live ? 'C++' : 'JS'}</span>
    </span>
  );
}

export default function EngineBadge({ kind, title }: { kind: 'js' | 'wasm'; title: string }) {
  return <EngineChip kind={kind} title={title} role="status" ariaLabel={title} />;
}
