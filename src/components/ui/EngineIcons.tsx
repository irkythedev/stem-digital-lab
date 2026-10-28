/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 计算引擎的矢量标识：`CppIcon`（ISO C++ 六边形）与 `JsIcon`（JS 方标）。
 * 用于 `EngineBadge` —— 全站七处引擎状态徽章（欧姆定律 / 凸透镜成像 / 二次函数 /
 * 反比例函数 / 酸碱中和 / 浮力 / 电学工作台）共用同一枚组件，此处是它们唯一的图标来源。
 *
 * 为什么手写 path 而不引资产或图标包：
 * 这两枚是**品牌标**（trademark 归 Standard C++ Foundation / Oracle 所有，
 * 此处为指明「当前跑的是哪个引擎」的指代性使用），官方发布的是位图与带字形的完整
 * logo 文件；lucide 一族里没有任何一枚表达「C++」或「JS」。所以按官方原形的几何
 * 自己描 path：C++ = 尖顶尖底、左右平边的六边形内嵌两枚加号；JS = 圆角方框内嵌
 * J、S 字骨。不引外部资产、不走 CDN（内网/断网会挂）、不依赖字体（SVG `<text>`
 * 会随解析到的字体栈变形状，14px 下不可控）。
 *
 * 上色是**单色描边 + `currentColor`**，与 `ActualSizeIcon` / lucide / `ProviderIcon`
 * 同一条纪律：组件里不写任何 hex，色相由外层经 `color` 给进来（`EngineBadge` 的
 * 品牌淡底芯片按 `--brand-*-ink` 出墨）。所以这两枚标在亮暗两套主题下是同一份几何、
 * 同一份代码，明暗差异全落在 index.css 的令牌上，组件里没有、也不该有主题分支。
 *
 * 尺寸与墨迹：图标在徽章里固定 14px（`h-3.5 w-3.5`），1px = 24/14 = 1.714 单位，
 * 圆头帽半径 = strokeWidth/2。字内净空不是目测调的，全部按 SVG `getBBox` 实测：
 * - C++ 加号：中心距 7.00 单位、臂半长 1.40、字骨描边 1.70 —— 两枚加号墨迹之间
 *   净空 2.50 单位 = 1.46px，各自到六边形竖边的描边带内边界 1.75 单位 = 1.02px。
 *   （原先中心距 5.20 / 臂半长 1.60 / 描边 2.0：圆头帽半径 1.0，两侧墨迹刚好
 *   在 12.0 处相接 → 净空 0.00px，14px 下两个加号糊成一枚四瓣墨团。）
 * - JS 字骨：横向凝缩到 0.85（纵向不动，保住字高）并整体居中，方框同步放大到
 *   rect w=20.69 —— 四边净空最小 1.71 单位 = 1.00px，字骨墨迹 8.90×6.32px。
 *   三档是实测比出来的：等比缩到 0.7546（框不动）净空同为 1.00px 但字高只剩
 *   5.17px，14px 下笔画断成虚影；等比缩到 0.92 并把框撑到 21.78 字高 6.06px
 *   但框比六边形大 25%。凝缩只动横向 15%，14px 下看不出，却是三者里字最高、
 *   框最小的一档。（旧字形未缩：墨迹 17.6 单位已超过方框净宽 17.2 单位，S 的右弧
 *   扎进右边框描边带 0.80 单位 = 0.47px，看上去 S 与边框粘连——这不是口味问题，
 *   是要在 14px 下同时保住「一整像素净空」与「看得清的字高」的几何下限。）
 * - 描边纪律：六边形与方框保持 2.0，与全站操作图标（lucide / `SubjectIcon` /
 *   `ActualSizeIcon`）同重；字骨取 1.70 是上面那笔净空算出来的，不是「看起来
 *   更精致」的别的原因——它在 14px 下让加号仍是两块独立墨迹。
 */
export interface EngineIconProps {
  className?: string;
}

/** ISO C++ 六边形：尖顶尖底、左右平边，内嵌两枚加号（官方 logo 的简化字骨）。 */
export function CppIcon({ className = '' }: EngineIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2.5 20.5 7.9V16.1L12 21.5 3.5 16.1V7.9Z" />
      {/* 加号比外框细一档（1.70）：2.0 时圆头帽会把两枚加号的墨迹接到一起 */}
      <path d="M8.5 10.6v2.8M7.1 12h2.8M15.5 10.6v2.8M14.1 12h2.8" strokeWidth="1.7" />
    </svg>
  );
}

/**
 * JavaScript 方标：圆角方框内嵌 J、S 字骨（官方 logo 的简化字骨，非黄底黑字版）。
 * 两条 path 是字形横向凝缩到 0.85 并居中后的结果，见文件头「字内净空」段。
 */
export function JsIcon({ className = '' }: EngineIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1.66" y="1.66" width="20.69" height="20.69" rx="3" />
      <path d="M10.3 7.71v5.18a2.46 2.9 0 0 1-4.93 0" />
      <path d="M13.1 15.31a2.8 3.3 0 0 0 4.76-1.2c.34-1.4-.77-2-1.7-2.4s-1.7-.8-1.7-1.9a2.29 2.7 0 0 1 4.17-1" />
    </svg>
  );
}
