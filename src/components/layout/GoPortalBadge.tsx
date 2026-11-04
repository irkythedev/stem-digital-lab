/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 页脚围棋入口：3×3 交点局部棋形，7s 一轮「叫吃 → 落子 → 提子 → 留白 → 复局」。
 * 纯 SVG + CSS keyframes，不挂定时器；减动效下停在静态叫吃形（白子 1 气）。
 * 只做入口，不注册进 labs 注册表。
 *
 * 落地页本身是独立静态项目（go-irky-dev/index.html），不随本站构建、不进预缓存；
 * 域名与部署由站点侧负责（计划部署在 EdgeOne），本组件只维护入口开关。
 * 留空 = 筹备中占位；填上 URL = 可点击外链。
 */
import { useApp } from '../../lib/app-context';

/** 上线开关：留空 = 筹备中占位；填 'https://go.irky.dev/' = 正常外链。 */
const GO_PORTAL_URL: string = 'https://go.irky.dev/';

export default function GoPortalBadge() {
  const { t } = useApp();

  const art = (
    <svg
      width="20"
      height="20"
      viewBox="0 0 32 32"
      className="go-badge-art flex-shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      {/* 3×3 交点局部网格：viewBox 32，三条线落在 5 / 16 / 27。
          格距 11、子径 4.2，相邻两子之间留 2.6 单位的缝——20px 显示时约 1.6px，
          黑白子才不会糊成一团，「棋盘上落了子」的读法才立得住。 */}
      <g
        className="go-badge-grid"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="1"
        shapeRendering="crispEdges"
      >
        <line x1="5" y1="27" x2="27" y2="27" />
        <line x1="5" y1="16" x2="27" y2="16" />
        <line x1="5" y1="5" x2="27" y2="5" />
        <line x1="5" y1="5" x2="5" y2="27" />
        <line x1="16" y1="5" x2="16" y2="27" />
        <line x1="27" y1="5" x2="27" y2="27" />
      </g>

      {/* 白子：外径与黑子对齐（r 3.4 + 描边 1.6/2 = 4.2），
          描边按 viewBox 单位走，缩放后内外径一起缩，20px 下约 1px 的墨环、3px 的留白。 */}
      <circle
        className="go-badge-white"
        cx="16"
        cy="16"
        r="3.4"
        fill="var(--bg)"
        stroke="var(--fg)"
        strokeWidth="1.6"
      />

      <circle className="go-badge-stone" cx="16" cy="5" r="4.2" fill="var(--fg)" />
      <circle className="go-badge-stone" cx="5" cy="16" r="4.2" fill="var(--fg)" />
      <circle className="go-badge-stone" cx="27" cy="16" r="4.2" fill="var(--fg)" />

      {/* 最后一气：呼吸环，黑子落下后熄灭 */}
      <g className="go-badge-liberty">
        <circle
          className="go-badge-liberty-pulse"
          cx="16"
          cy="27"
          r="3.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </g>

      {/* 黑子收紧：落下 → 提走白子 → 留白 → 收起复位 */}
      <circle className="go-badge-drop" cx="16" cy="27" r="4.2" fill="var(--fg)" />
      <circle
        className="go-badge-ripple"
        cx="16"
        cy="27"
        r="4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );

  if (!GO_PORTAL_URL) {
    // 没上线就没有可去的地方：不加 tap-icon 的透明热区，不举、不亮网格，
    // 只把棋形继续跑着——它是「这里迟早会有个入口」的预告，不是一个假链接。
    return (
      <span
        className="go-badge is-pending flex items-center leading-none text-[var(--muted)] p-1.5"
        role="img"
        aria-label={t.goPortalLabel}
        title={t.goPortalLabel}
      >
        {art}
      </span>
    );
  }

  return (
    <a
      href={GO_PORTAL_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.goPortalLabel}
      title={t.goPortalLabel}
      className="go-badge tap-icon flex items-center leading-none text-[var(--muted)] hover:text-[var(--fg)] transition-colors p-1.5"
    >
      {art}
    </a>
  );
}
