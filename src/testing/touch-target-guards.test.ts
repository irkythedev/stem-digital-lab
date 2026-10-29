/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 触屏热区反向对抗守护（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的 `触屏热区 · 反向对抗守护（v0.35.0）` 套件，
 * **整组 7 个用例一次迁出**。用例名、断言、正则、错误消息与执行顺序与迁移前逐字相同；
 * 唯一差别是 12 处 `readFileSync('src/…')` 改走 `readSrc()` → `repoPath()`。
 *
 * 依赖特征：零 DOM、零 async、零全局改造。断言对象是 `index.css` 的
 * `.tap-icon` / `.tap-area` 规则、顶栏与页脚组件源码，属跨站点的对抗性守卫。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { repoPath } from './repo-paths';

export function registerTouchTargetGuardsTests(test: TestFn): void {
  /** 读仓库内源码：参数保持仓库相对路径，错误消息里的文件标识也不变。 */
  const readSrc = (p: string, enc: BufferEncoding = 'utf8') => readFileSync(repoPath(p), enc);
  const css = readSrc('src/index.css', 'utf8');
  const touchBlock = css.slice(css.indexOf('@media (hover: none) and (pointer: coarse)'));

  test('tap-icon 必须有自身定位上下文：::after 是 absolute，锚点若为 static 会逃逸到视口劫持全页点击', () => {
    assert.match(touchBlock, /\.tap-icon:not\(\[class\*='absolute'\]\)\s*\{\s*position:\s*relative/);
    assert.match(touchBlock, /\.tap-icon::after\s*\{[^}]*position:\s*absolute/);
  });

  test('tap-area 必须居中内容：min-height 撑高的盒子多出的空间全加在下方，<a> 没有 UA 居中会被顶到上方', () => {
    assert.match(touchBlock, /\.tap-area\s*\{[^}]*display:\s*inline-flex/);
    assert.match(touchBlock, /\.tap-area\s*\{[^}]*align-items:\s*center/);
    assert.match(touchBlock, /\.tap-area\s*\{[^}]*min-height:\s*2\.5rem/);

    // 地板本身仍在：L1 阶段导航 / Next / 答题选项要的就是拇指命中区
    assert.match(css, /main button\s*\{[^}]*min-height:\s*40px/, '40px 地板须保留（只兜 L1）');
    assert.match(css, /main button\.compact\s*\{[^}]*min-height:\s*0/, '须有 main button.compact 解除地板');
    // 触屏 compact 两档（P2）：默认 28px（成排的 chip / 预设 / 重置），
    // .tap32 提到 32px（分享 / 问 AI / 考考你这类单点辅助）。
    // 40px 只留给 L1 —— 阶段轨与答题选项，见下一条断言。
    assert.match(
      touchBlock,
      /main button\.compact\s*\{[^}]*min-height:\s*1\.75rem/,
      '触屏 compact 第一档须为 28px',
    );
    assert.match(
      touchBlock,
      /main button\.compact\.tap32\s*\{[^}]*min-height:\s*2rem/,
      '触屏 compact 第二档（.tap32）须为 32px',
    );
    assert.match(
      touchBlock,
      /main \.stage-rail button,[\s\S]{0,80}min-height:\s*1\.75rem/,
      '阶段轨与「下一步」在触屏下须回到 28px（P4 减重），否则 .tap-area 会把它们顶回 40px',
    );
    // 关闭类幽灵按钮：按下微缩 + 极浅底，绝不铺实底
    assert.match(css, /button\.ghost-x:active:not\(:disabled\)\s*\{[^}]*scale\(0\.95\)/, '关闭按钮须 ghost-x 微缩 0.95');
    assert.match(css, /button\.ghost-x:active:not\(:disabled\)\s*\{[^}]*background-color:\s*var\(--accent-light\)/, '关闭按钮按压只许极浅底');

    // 全站源码：主操作令牌不得再做按压底色（会铺满控件盒）
    const uiFiles = [
      'src/components/ai/AiAssistant.tsx', 'src/components/ai/AskAiButton.tsx', 'src/components/ai/AskQuizButton.tsx',
      'src/components/ui/DailyQuote.tsx', 'src/components/layout/Footer.tsx', 'src/components/lab/ExploreStage.tsx',
      'src/pages/MathFormulas.tsx', 'src/pages/PhysicsFormulas.tsx', 'src/pages/PhysicalConstants.tsx',
      'src/labs/math/Quadratic.tsx', 'src/labs/math/Linear.tsx', 'src/labs/math/Inverse.tsx',
      'src/labs/physics/Ohm.tsx', 'src/labs/physics/Circuits.tsx', 'src/labs/chemistry/Neutralization.tsx',
    ];
    for (const f of uiFiles) {
      const src = readSrc(f, 'utf8');
      assert.doesNotMatch(src, /active:bg-\[var\(--accent\)\]/, `${f} 不得用 --accent 做按压底色（会变成实心黑/白块）`);
    }

    // 代表性 L3 微控件必须挂 .compact（否则仍被 40px 撑着）
    const l3: [string, string][] = [
      ['src/components/ui/DailyQuote.tsx', "▸ 人物小故事"],
      ['src/components/ai/AskAiButton.tsx', '问 AI'],
      ['src/components/ai/AskQuizButton.tsx', '考考你'],
      ['src/labs/math/Quadratic.tsx', '重置'],
      ['src/pages/HomePage.tsx', '随机进入'],
    ];
    for (const [f, name] of l3) {
      assert.match(readSrc(f, 'utf8'), /\bcompact\b/, `${name}（${f}）须挂 compact 解除 40px 地板`);
    }
    // L2 chips：compact + leading-5（20px 行盒 + 3px 内边距 + 1px 边 = 28px 落点）
    const chips = readSrc('src/pages/PhysicsFormulas.tsx', 'utf8');
    assert.match(chips, /compact leading-5 px-3 py-\[0\.1875rem\]/, '筛选 chip 须 compact + leading-5 收到 28px');
  });

  /* ── 40px 地板与按压态（v0.40.5 收口）─────────────────────────────────────
     这一节守两件事，都是实测出来的，不是审美偏好：

     1. `main button { min-height: 40px }` 是无层元素规则，特异性高于 Tailwind 的
        min-h-*（在 @layer utilities 内）→ 组件写 min-h-[34px] 也无效。
        实测代价：11px 文字 + py-1 的「人物小故事」渲染 40px、自身只有 24.5px；
        「翻一翻」自身 16.5px 被抬 142%。所以必须有 .compact 口子，否则改 padding 全是白工。
     2. `active:bg-[var(--accent)]` 当 --accent 是 #000/#fff 时铺满整个控件盒 →
        实测 2242px² 纯黑（深色主题纯白）。卡片里的微控件按下去就是一块黑砖。

     没有这两条断言，下一次「统一风格」会把它们原样改回去。 */
  test('页脚独立图标：允许 tap-icon 扩区，但间距与视觉尺寸必须同时守住', () => {
    const footer = readSrc('src/components/layout/Footer.tsx', 'utf8');
    if (!footer.includes('tap-icon')) return; // 未扩区时无需约束
    // 历史事故：页脚图标彼此仅隔几像素，+8px 外扩后热区互压，出现「点邮箱触发作品集」。
    // 现在改为「先把间距拉开、再扩区」：间距被改小时本测试立刻失败。
    assert.ok(/flex items-center gap-5/.test(footer), '作者行图标需保留 gap-5：26px 盒 + 20px 间隙 = 中心距 46px ≥ 44px');
    // 横向：移动端 16px（gap-x-4）—— 26px 图标盒 + 两端各 8px 扩区 = 42px 命中盒，
    // 16px 间隙让两盒**恰好相切**（实测重叠 0px），这是零重叠的下限；再小就互抢点击。
    // 桌面回到 10px（sm:gap-x-2.5）：tap-icon::after 只在 (hover:none) and (pointer:coarse)
    // 内生成，桌面压根没有扩区，10px 不会撞 —— 因此不再需要统一 20px 去迁就触屏。
    assert.ok(/gap-x-4/.test(footer) && /sm:gap-x-2\.5/.test(footer) && /gap-y-4/.test(footer), '底部图标行需 gap-x-4（触屏相切）/ sm:gap-x-2.5（桌面冻结）/ gap-y-4（换行不撞）');
    const p15 = (footer.match(/p-1\.5(?! -m)/g) || []).length;
    assert.ok(p15 >= 4, `扩区图标需用 p-1.5 把 14px 视觉盒撑到 26px 命中盒，实际 ${p15} 处`);
    assert.ok(!footer.includes('-m-1\.5'), '扩区图标不得再用 -m-1.5：负外边距会吃掉 flex 间距 12px，中心距掉到 34px 后 42px 扩区必然互压');

    // 页脚品牌图标指向**仓库首页**，不是 issue 模板选择页；欢迎弹窗底部的反馈入口维持 issue 不变。
    assert.match(footer, /import \{[^}]*REPO_URLS[^}]*\} from '\.\.\/\.\.\/lib\/brand-icons'/, '页脚品牌图标须走 REPO_URLS（仓库首页）');
    assert.doesNotMatch(footer, /ISSUE_URLS/, '页脚品牌图标不得再指向 issue 入口');
    const brandUrls = readSrc('src/lib/brand-icons.ts', 'utf8');
    const repoBlock = (brandUrls.match(/REPO_URLS = \{[\s\S]*?\} as const/) || [''])[0];
    assert.ok(
      repoBlock.includes('gitee.com/K4Ricky2Win/stem-digital-lab') &&
        repoBlock.includes('github.com/irkythedev/stem-digital-lab'),
      'REPO_URLS 必须指向两个仓库首页',
    );
    assert.doesNotMatch(repoBlock, /issues/, 'REPO_URLS 不得带 /issues');
    const welcomeDlg = readSrc('src/components/ui/WelcomeDialog.tsx', 'utf8');
    assert.doesNotMatch(welcomeDlg, /ISSUE_URLS/, '欢迎弹窗的品牌图标不得再指向 issue 入口');
    assert.match(welcomeDlg, /REPO_URLS\.gitee/, '欢迎弹窗的品牌图标指向仓库首页');
    // issue 入口迁到反馈面板：「发送反馈」后面两枚品牌图标
    const fbPanel = readSrc('src/components/feedback/FeedbackPanel.tsx', 'utf8');
    assert.match(fbPanel, /ISSUE_URLS\.gitee/, '反馈面板须保留 Gitee issue 入口');
    assert.match(fbPanel, /ISSUE_URLS\.github/, '反馈面板须保留 GitHub issue 入口');
    assert.match(fbPanel, /<path d=\{GITEE_PATH\} \/>/, '反馈面板须用 Gitee 品牌图标');
    assert.match(fbPanel, /<path d=\{GITHUB_PATH\} \/>/, '反馈面板须用 GitHub 品牌图标');
    assert.match(fbPanel, /externalIssueHint/, '反馈面板的外链提示须用 Issue 专用文案');
    const submitAt = fbPanel.indexOf('onClick={submit}');
    const issueAt = fbPanel.indexOf('<ExternalLinkConfirm');
    assert.ok(submitAt > 0 && issueAt > submitAt, 'issue 图标须排在「发送反馈」按钮之后');
    assert.ok(/<Share2 className="w-3\.5 h-3\.5"/.test(footer) && /<Network className="w-3\.5 h-3\.5"/.test(footer),
      '扩区只能靠伪元素：图标本身不得放大（视觉仍 14px）');

    // 作品集角标：科技蓝（曾是品牌红 #C71D23，在页脚里读起来像未读告警）
    const css = readSrc('src/index.css', 'utf8');
    const i18nSrc = readSrc('src/lib/i18n.ts', 'utf8');
    assert.match(footer, /footer-works-badge/, '作品集角标须挂 .footer-works-badge 钩子（hover 动效用）');
    assert.doesNotMatch(footer, /bg-\[#C71D23\]/, '作品集角标不得再用品牌红背景');
    assert.match(css, /--tech-blue: #4d6bfe;/, '须有 --tech-blue 令牌（--accent 是黑/白，当不了蓝）');
    assert.match(css, /\.footer-works-badge \{[^}]*background: var\(--tech-blue\)/, '角标底色须取 --tech-blue 令牌');
    // hover 微动效：整体上浮 1px + 角标 1.08 + 同色光晕，且尊重减少动效
    assert.match(css, /\.footer-works:hover \.footer-works-glyph,[\s\S]{0,80}translateY\(-1px\)/, '悬停须整体上浮 1px');
    assert.match(css, /\.footer-works:hover \.footer-works-badge,[\s\S]{0,120}scale\(1\.08\)/, '悬停角标须缩放 1.08');
    assert.match(css, /0 0 6px var\(--tech-blue-glow\)/, '悬停须叠加同色光晕');
    assert.match(css, /prefers-reduced-motion: reduce[\s\S]{0,400}\.footer-works-badge \{ transform: none; \}/, '减少动效时须取消位移与缩放');
    // 浮层提示：单行 + 深底令牌 + 12px + 箭头，且必须 pointer-events:none（不许挡住按钮）
    assert.match(css, /\.footer-works-tip \{[^}]*pointer-events: none/, '浮层不得拦截点击');
    assert.match(css, /\.footer-works-tip \{[^}]*font-size: 12px/, '浮层字号须 12px');
    assert.match(css, /\.footer-works-tip \{[^}]*white-space: nowrap/, '浮层须单行');
    assert.match(css, /\.footer-works-tip::after \{[^}]*transform: rotate\(45deg\)/, '浮层须有指向图标的小箭头');
    assert.ok(footer.includes('footer-works-tip'), '页脚须渲染浮层提示');
    assert.match(i18nSrc, /moreWorksHint: 'Ricky 的其他作品'/, '浮层文案须为「Ricky 的其他作品」');
    assert.match(i18nSrc, /moreWorksHint: 'More By Ricky'/, '浮层文案须有英文对应「More By Ricky」');
    assert.match(css, /\.footer-works-tip \{[^}]*max-width: calc\(100vw - 1\.5rem\)/, '浮层须有极窄视口兜底宽度');
  });

  test('顶栏安全区不得清零上内边距：须为 calc 叠加（页脚同款写法）', () => {
    const header = readSrc('src/components/layout/Header.tsx', 'utf8');
    assert.ok(!/pt-\[env\(safe-area-inset-top/.test(header), 'pt-[env(...)] 会覆盖 py 的上内边距，造成上下不对称');
    assert.match(header, /pt-\[calc\([^)]*env\(safe-area-inset-top/);
  });

  test('顶栏「使用说明」媒体图标：须与文字同属一个链接，且右组只有一个 /guide 入口', () => {
    const header = readSrc('src/components/layout/Header.tsx', 'utf8');
    assert.match(header, /import \{[^}]*\bCirclePlay\b[^}]*\} from 'lucide-react'/, '须从 lucide-react 引入 CirclePlay');
    const entries = (header.match(/to="\/guide"/g) || []).length;
    assert.equal(entries, 1, `顶栏只能有一个 /guide 入口（实际 ${entries}）——相邻双目标既新增可聚焦元素，也会在 360px 上把右组挤爆`);
    const link = header.match(/<Link\s+to="\/guide"[\s\S]*?<\/Link>/)?.[0] ?? '';
    assert.ok(link.includes('title={t.guideHint}'), '须给出桌面悬停提示，说明此处含演示视频');
    assert.ok(link.includes('<CirclePlay'), '图标必须放在同一个 <Link> 内：独立按钮会破坏 44px 中心距并抢点击');
    assert.ok(link.includes('aria-hidden="true"'), '图标是装饰，文字已表意，须 aria-hidden 以免读屏重复播报');
    assert.match(link, /w-3\.5 h-3\.5/, '图标视觉尺寸须 14px，与同组 AI / 主题图标同级');
    assert.match(link, /motion-safe:group-hover\/guide:scale-\[1\.06\]/, '微缩放须包在 motion-safe 内，尊重 prefers-reduced-motion');
    assert.match(link, /gap-1\.5/, '图标与文字间距须显式给出：右组小屏 gap 只有 6px，靠容器间距会粘在一起');
    const i18n = readSrc('src/lib/i18n.ts', 'utf8');
    assert.equal((i18n.match(/guideHint:/g) || []).length, 2, 'guideHint 必须中英各一条，否则切到英文会露出 undefined');
  });

  // ── 平板/iPad 断点（768–1024）：品牌行不许折行、版本号不许错位 ──
  test('顶栏品牌行：品牌与版本号锁死一行、同轴对齐（触屏 .tap-area 会把这一行撑到 40px）', () => {
    const header = readSrc('src/components/layout/Header.tsx', 'utf8');
    // ① 左簇不被压缩：顶栏是 justify-between 的两组 flex 子项，默认 shrink:1 会先压左簇，
    //    品牌文字是普通文本，一被压就在词间折行。显式 nowrap + shrink-0 才锁得住。
    assert.match(
      header,
      /<Link to="\/" className="flex flex-nowrap shrink-0 items-center gap-2 /,
      '左簇须 flex-nowrap + shrink-0：缺任一项，窄窗口下品牌文字先在词间折行、版本号跟着错位',
    );
    // ② 两行文字都不许换行
    assert.match(header, /hidden sm:inline whitespace-nowrap text-\[0\.625rem\] mono-font uppercase/, '品牌文字须 whitespace-nowrap');
    // ③ 版本号禁止 self-end / mb-0.5 —— coarse 下 .tap-area 把品牌行撑到 40px（桌面 28px），
    //    self-end 会把版本号钉到行底：实测下沉 6.5px，10px 小字看上去就像「掉到了下一行」。
    //    只校验按钮自身的 className——注释里会解释这段历史，全局扫词会把说明文字也算进去。
    const ver = header.match(/className="hidden sm:flex items-center gap-1\.5[^"]*"/)?.[0] ?? '';
    assert.ok(ver.length > 0, '未找到版本号按钮的 className');
    assert.ok(!/self-end|mb-0\.5/.test(ver), `版本号不得再用 self-end / mb-0.5：触屏下会相对品牌标题下沉（实测 6.5px）——当前 ${ver}`);
    assert.ok(ver.includes('whitespace-nowrap'), '版本号须 whitespace-nowrap，彻底禁止折行');
    assert.ok(ver.includes('tap-pad-10'), '版本号须挂 tap-pad-10：它是顶栏唯一没走 .tap-area 的控件，命中盒只有 42×15');
    // ④ 热区只在触屏块里扩，桌面视觉零变化
    const touchBlock = css.slice(css.indexOf('@media (hover: none) and (pointer: coarse)'));
    assert.match(touchBlock, /\.tap-pad-10::after \{[\s\S]*?inset: -10px -2px;/, '.tap-pad-10 须在触屏块内、横向只扩 2px（左邻品牌文字，横扩会劫持「点标题回首页」）');
  });

  test('顶栏「使用说明」文案断点：≥1024（lg）才展开文字，平板段保持图标形态', () => {
    const header = readSrc('src/components/layout/Header.tsx', 'utf8');
    const link = header.match(/<Link\s+to="\/guide"[\s\S]*?<\/Link>/)?.[0] ?? '';
    assert.match(link, /<span className="hidden lg:inline">\{t\.guide\}<\/span>/, '文案须 hidden lg:inline：平板段收成图标形态，右簇回到 40px 方盒节奏');
    assert.doesNotMatch(link, /hidden sm:inline/, 'sm 断点展开文字会让 iPad（768）右簇 296px 与左簇只剩 62px 余量');
    assert.match(link, /aria-label=\{t\.guide\}/, '文字隐去后 aria-label 是唯一可访问名，须常驻');
  });
}
