/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 科目图标：数学 / 物理 / 化学三科统一为 24 栅格、固定线宽的矢量图标
 * （数学＝几何曲线 π，物理＝Atom 原子轨道，化学＝FlaskConical 锥形瓶），
 * 统一由本渲染器输出，保证三科图标在首页 / 科目页 / 实验页全站一致。
 *
 * 数学为何不再用字体字形 π：衬线体的 π 横细竖粗、笔画末端带弯钩，字宽与字重
 * 还会随 font-family（--f-serif 子集 / 系统宋体 / 各端回退）与 font-weight 漂移，
 * 与另外两个固定线宽的矢量图标永远凑不齐——此前靠 `text-2xl font-bold leading-none`
 * 去硬贴 20px 图标的墨迹高度，属补偿式对齐。改用矢量后三科同栅格、同线宽。
 *
 * 亦不用 lucide 的 Pi：它的横梁与左竖之间是衬线式弯钩
 * （lucide 0.546 的 d="M4 7c0-1.7 1.3-3 3-3h13"），正是本次要去掉的形态。
 *
 * 笔画形态：三笔皆为曲线 —— 顶横线是两端略低、中间微隆的浅弧，左腿圆角过渡后
 * 微向左倾并以左下撇脚收笔，右腿顺滑下探后以 C 形弯钩向右下舒展。无生硬直角与纯直线。
 *
 * 线宽：默认 stroke-width 2（24 栅格标准线宽）。调用方传 `stroke-[1.0]` 等类名时
 * 由 CSS 覆盖（CSS 声明优先于表现属性，与 lucide 图标同一机制）→ 大尺寸下三科同步变细。
 *
 * 为何物理/化学也从 lucide 组件改为内联（2026-10）：
 * 首页学科入口需要极克制的 hover 微动效（π 描摹 / 双环反向自转 / 锥形瓶阻尼摆动），
 * 而 lucide 组件把图元平铺在同一个 <svg> 里，无法给「两条轨道」「瓶身」分别挂标记。
 * 内联后路径数据**逐字照抄上游**（atom 与 flask-conical，lucide 0.546, ISC），
 * 视觉与 lucide 完全一致，只是多了可寻址的 data-subject-part 分组与 data-subject-anim 根标记。
 * 动画样式本身写在 src/index.css，且只在 `.home-subjects` 作用域内生效——
 * 同一图标在欢迎弹窗、科目页、实验页里保持静态。
 */
import type { SubjectId } from '../../lib/subjects';

/**
 * 几何 π（派下稿 1:1 落笔，24 栅格）：
 *   · 顶横线：左端微垂过渡 → 中段舒展平直 → 右端轻轻上扬收笔；
 *   · 左腿：上半段基本垂直、仅微斜，末段自然向左微撇；
 *   · 右腿：直落到底后圆润勾起（标准 J 型反勾），圆头端点。
 * 三笔皆曲线，无生硬直角与纯直线；2px 固定线宽、圆头端点。
 *
 * 体量实测（同条件光栅化，20px 框 / stroke 2）：本几何 ink 2397.6、bbox 15.3×12.7，
 * 而同框的 Atom 5349.1、FlaskConical 3632.2 —— 即 1:1 落笔会比另两科轻约三成。
 * 若需回到已验收体量，把三条 path 绕中心 (12,12) 等比放大 1.23（ink 2935.1、bbox 18.5×15.2，
 * 见 docs/changelog-internal.md 的对照表）；注意墨迹随几何线性增长（描边宽度不随几何缩放），
 * 拉到与 Flask 同重需 ×1.52，几何将顶出 24 栅格、2px 描边会被裁，不可取。
 *
 * pathLength={1}：把每条路径的总长归一化为 1，描摹动画就能直接用
 * `stroke-dasharray: 1 / stroke-dashoffset: 1→0`，不必手算三条路径各自的长度
 * （三条长度各不相同，写死像素值在改动几何时会立刻失配）。
 */
function GeometricPi({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      data-subject-anim="pi"
    >
      <path pathLength={1} d="M2.04 6.47C3.27 4.62 5.11 4.62 7.57 4.62h11.69c1.23 0 2.21-.25 2.71-.74" />
      <path pathLength={1} d="M8.19 4.62c-.25 5.54-.98 10.46-2.71 13.53-.49.86-1.11 1.48-1.85 1.85" />
      <path pathLength={1} d="M14.7 4.62v11.69c0 2.46 1.23 3.69 2.95 3.69 1.23 0 2.09-.62 2.58-1.6" />
    </svg>
  );
}

/**
 * 物理 · 原子：核（1px 圆）+ 两条交叉椭圆轨道。
 *
 * 动效设计（2026-10 第二版，第一版已废弃）：
 * 第一版让两条轨道**各自**绕核以不同速率反向自转，实测效果不成立——
 * 原子符号的识别性来自两条轨道之间**固定的夹角**（它们互为镜像，整体约 180° 对称）。
 * 一旦两环独立旋转，夹角就连续变化：交叉点漂移、中心描边密度忽厚忽薄，
 * 36px 下看起来是"在扭动/发糊"，而不是"在公转"；且两环速率不同永不重合，
 * 大部分时间里它都不是一个原子。
 *
 * 第二版把运动放到"沿轨道跑的东西"上：轨道几何**一动不动**，
 * 每个环上各有一颗电子（r=1.1，与 2px 描边同粗）沿路径行进，周期 2.6s / 3.4s 反向。
 * 既保住了符号形态，又真的表达了"电子绕核"——轨道不转，电子在转。
 *
 * 电子用 CSS `offset-path` 定位：路径数据与下面的 <path d> 共用同一常量，
 * 不存在两份几何漂移的可能（offset-path 只能用 CSS 表达，故写在 style 里，而非 index.css）。
 */
const ATOM_ORBIT_A = 'M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z';
const ATOM_ORBIT_B = 'M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z';

function PhysicsAtom({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      data-subject-anim="atom"
    >
      <circle cx="12" cy="12" r="1" />
      <path d={ATOM_ORBIT_A} />
      <path d={ATOM_ORBIT_B} />
      {/* 电子：默认 opacity=0（非首页场景完全不可见），只在首页卡片 hover 时淡入并沿轨道行进。
          cx/cy=0：位置完全由 offset-path 决定，否则会被自身圆心二次偏移。 */}
      <circle
        data-subject-part="electron-a"
        cx={0}
        cy={0}
        r={1.1}
        fill="currentColor"
        stroke="none"
        opacity={0}
        style={{ offsetPath: `path("${ATOM_ORBIT_A}")` }}
      />
      <circle
        data-subject-part="electron-b"
        cx={0}
        cy={0}
        r={1.1}
        fill="currentColor"
        stroke="none"
        opacity={0}
        style={{ offsetPath: `path("${ATOM_ORBIT_B}")` }}
      />
    </svg>
  );
}

/** 化学 · 锥形瓶：瓶身 + 液面线 + 瓶口，整体一组，绕瓶底中心摆动 */
function ChemistryFlask({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      data-subject-anim="flask"
    >
      <g data-subject-part="flask">
        <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />
        <path d="M6.453 15h11.094" />
        <path d="M8.5 2h7" />
      </g>
    </svg>
  );
}

interface SubjectIconProps {
  subjectId: SubjectId;
  /** 尺寸与线宽类（三科统一由此控制；线宽可被 stroke-[n] 覆盖） */
  className?: string;
}

export default function SubjectIcon({ subjectId, className = '' }: SubjectIconProps) {
  if (subjectId === 'math') return <GeometricPi className={className} />;
  if (subjectId === 'physics') return <PhysicsAtom className={className} />;
  return <ChemistryFlask className={className} />;
}
