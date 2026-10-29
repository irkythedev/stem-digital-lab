/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 设置面板布局与控件打磨守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe，**整组 5 个用例一次迁出**。
 * 用例名、断言、正则、错误消息与执行顺序与迁移前逐字相同；1 处 `readFileSync('src/…')`
 * 改走 `readSrc()`，`readAiPanel()` 换成 `./ai-panel-source` 的同义实现。
 *
 * 依赖特征：零 DOM、零 async、零全局改造。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { readAiPanel } from './ai-panel-source';
import { repoPath } from './repo-paths';

export function registerAiSettingsLayoutTests(test: TestFn): void {
  /** 读仓库内源码：参数保持仓库相对路径，错误消息里的文件标识也不变。 */
  const readSrc = (p: string, enc: BufferEncoding = 'utf8') => readFileSync(repoPath(p), enc);
  const ai = readAiPanel();

  test('保底高度只服务对话视图：表单视图必须内容自适应，不得再被 62dvh 撑出死区', () => {
    assert.match(
      ai,
      /\$\{view === 'chat' && height === 0 \? ' min-h-\[min\(62dvh,calc\(100dvh-4\.5rem\)\)\]' : ''\}/,
      '面板保底高度必须收紧为「对话视图且未拖过高度」',
    );
    assert.ok(
      !ai.includes("${height > 0 && view === 'chat' ? '' : ' min-h-[min(62dvh,calc(100dvh-4.5rem))]'}"),
      '旧的宽条件（设置视图也吃 62dvh）必须移除，否则高视口下栏下留 184px 死区',
    );
    assert.match(ai, /移动端抽屉|ai-sheet inset-x-0/, '移动端抽屉保高不受影响');
  });

  test('思考强度 = 整体分段滑槽，且不再用符号点表达选中', () => {
    assert.match(
      ai,
      /inline-flex items-center p-0\.5 rounded-lg bg-\[var\(--accent-light\)\]\/70 border border-\[var\(--border\)\]\/60" role="group" aria-label=\{lang === 'zh' \? '思考强度'/,
      '三档必须同槽（整体分段滑槽）',
    );
    assert.match(
      ai,
      /bg-\[var\(--card-bg\)\] text-\[var\(--fg\)\] font-medium border-\[var\(--border\)\]\/50 shadow-xs/,
      '选中档位必须由背景滑块承托',
    );
    assert.ok(!ai.includes("'● '"), '不得再用 ● 字符符号表达选中态');

    // ── 说明只留一行：档位差一句话就够，长度/能力解释收进 title ──
    // 单行说明：三档各有且只有一句
    assert.match(ai, /const TIER_HINT: Record<ThinkingEffort, \{ zh: string; en: string \}> = \{/, '须有档位一句话说明表');
    for (const s of ['禁用思考过程，极速响应，适合查速查表', '适度启发引导，兼顾质量与响应速度（推荐）', '展开完整推理草稿，Token 消耗增加，适合大题推导']) {
      assert.ok(ai.includes(s), `档位说明须为「${s}」`);
    }
    assert.ok(ai.includes('当前模型按服务商默认策略处理。'), '模型无思考旋钮时须给统一口径');
    // 反例：那两段长文案不得回到正文里（在 title/说明表之外出现即为回潮）
    assert.ok(
      !ai.includes('深度思考会给出更充分的启发线索，但 Token 消耗显著增加'),
      '「深度思考会更充分但烧 token」那段长文案已并入档位一句话，不得回潮',
    );
    // 输出上限：单行轻量布局 + 解释进 title
    assert.match(
      ai,
      /输出上限 \(tokens\)：/,
      '输出上限须为单行「输出上限 (tokens)：」+ 输入框',
    );
    assert.match(ai, /w-24 rounded-md border border-\[var\(--border\)\] bg-\[var\(--bg\)\] px-2 py-0\.5 text-xs mono-font/, '输出上限输入框须为 py-0.5 轻量尺寸');
    assert.match(ai, /思考型模型（R1 \/ 思考版千问 \/ 本地模型）的思考也计入这个上限/, '思考型模型解释须保留（收进 title，不得直接删掉）');
    assert.ok(
      !/text-\[0\.625rem\] text-\[var\(--muted\)\] mt-0\.5 leading-snug">\s*\{thinkingPlan\?\.note/.test(ai),
      '模型能力说明不得再单独占一段（应合并进单行说明的 title）',
    );
  });

  test('服务商与筛选 chips = 柔和 Chip：去硬描边、选中态微强调', () => {
    const selected = ai.match(/border-\[var\(--fg\)\]\/25 bg-\[var\(--accent-light\)\] text-\[var\(--fg\)\] font-medium/g) ?? [];
    const unselected = ai.match(/border-transparent text-\[var\(--muted\)\] hover:bg-\[var\(--accent-light\)\]\/60 hover:text-\[var\(--fg\)\]/g) ?? [];
    assert.ok(selected.length >= 8, `选中态柔和 Chip 至少 8 处（实测 ${selected.length}）`);
    assert.ok(unselected.length >= 8, `未选中态去描边 Chip 至少 8 处（实测 ${unselected.length}）`);
    assert.ok(
      !/px-2 py-1 text-\[0\.6875rem\] mono-font border transition-colors/.test(ai),
      '不得残留「1px 硬描边方框」的旧 chip 写法',
    );
    const tap = ai.match(/tap-area (rounded-md|inline-flex)/g) ?? [];
    assert.ok(tap.length >= 8, `chips 必须挂 tap-area 兜触屏 40px（实测 ${tap.length} 处）`);
  });

  test('操作按钮层级：保存实底主操作 / 返回与关闭 ghost / 清除补 40px', () => {
    assert.match(
      ai,
      /onClick=\{save\} className="tap-primary tap-ai-primary rounded-md px-3 py-1\.5 text-xs mono-font font-bold border border-transparent bg-\[var\(--fg\)\] text-\[var\(--bg\)\]/,
      '保存必须是实底主操作（亮色黑底 / 暗色白底）',
    );
    const ghost = ai.match(/tap-primary tap-ai-primary rounded-md px-3 py-1\.5 text-xs mono-font border border-transparent text-\[var\(--muted\)\] transition-colors hover:bg-\[var\(--accent-light\)\] hover:text-\[var\(--fg\)\]/g) ?? [];
    assert.ok(ghost.length >= 3, `返回对话 / 关闭 / 取消 都要是 ghost（实测 ${ghost.length} 处）`);
    assert.match(
      ai,
      /className="ml-auto tap-area inline-flex items-center gap-1 text-\[0\.6875rem\] mono-font text-\[var\(--muted\)\] transition-colors hover:text-\[var\(--fg\)\]"/,
      '清除入口必须保持文字链并补 tap-area（触屏 ≥40px）',
    );
    // 清除入口的文案必须与行为一致：它只清「本机配置 + 当前会话 + 本轮测验进度」，
    // 持久化的问答历史与考考你记录（错题集）不在此列 —— 那两样各自在「学习记录」里清。
    // 旧文案 label「清除 AI 配置与记录」+ title「问答历史与答题统计」是谎报：
    // 点完历史仍在（历史入口的信息点也还亮着），用户会以为按钮坏了。
    // 注意：断言只扫代码段（注释里会引用旧文案，扫全文会自我绊倒）。
    const aiCopy = ai.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.match(aiCopy, /'清除 AI 配置'/, '清除入口的可见 label 不得再声称会清「记录」');
    assert.match(
      aiCopy,
      /清除本机保存的 API Key 与模型设置，重置当前对话与测验进度；问答历史与错题集请在「学习记录」中清空/,
      'title 须写明真正清掉什么、并指出历史与错题集去哪清',
    );
    assert.match(aiCopy, /'Clear AI config'/, '英文 label 须同步（不得仍写 Clear AI data）');
    assert.doesNotMatch(aiCopy, /清除 AI 配置与记录|Clear AI data|清除 AI 配置、问答历史与答题统计/, '旧的谎报文案不得回归');
    // ── AI 设置弹窗减重（触屏）：全部只在 .tap-area 上让位，并把省下的高度还给透明伪元素 ──
    //    chips 40→28、思考强度 40→28（外轨 46→34）、设置 Tab 40→29、常用 chips 40→24、
    //    吸底栏 44→36、获取模型/测试连接 29.7→34。桌面无 .tap-area，本来就是自然高，故零回归。
    {
      const css = readSrc('src/index.css', 'utf8');
      assert.match(css, /\.tap-ai-chip\.tap-area,\s*\.tap-ai-tab\.tap-area \{\s*min-height: 0;/, 'chips/Tab 须解除 40px 地板');
      assert.match(css, /\.tap-ai-tier\.tap-area \{\s*min-height: 1\.75rem;/, '思考强度三档须 28px（外轨随之 34px）');
      assert.match(css, /\.tap-ai-mini\.tap-area \{\s*min-height: 1\.5rem;/, '常用 chips 须 24px');
      assert.match(css, /\.tap-primary\.tap-ai-primary \{\s*min-height: 2\.25rem;/, '吸底栏须 36px');
      // 热区补偿：为减掉的高度补回透明扩区，否则只减不补就是拿触控精度换版式
      assert.match(css, /\.tap-ai-chip\.tap-area::after \{[^}]*top: -4px;[^}]*bottom: -4px;/, 'chips 须补 ±4px 热区（28+8=36）');
      assert.match(css, /\.tap-ai-tier\.tap-area::after \{[^}]*inset: -5px -1px;/, '思考强度须补 ±5px 热区（28+10=38）');
      assert.match(css, /\.tap-ai-text::after \{[^}]*inset: -8px -2px;/, '「查看须知」须补 ±8px 热区（18+16=34）');
      // 行距必须 ≥ 伪元素外扩之和，否则换行后上下两行互压（页脚图标踩过同一个坑）
      assert.match(ai, /flex flex-wrap items-center gap-x-1\.5 gap-y-2 sm:gap-y-1\.5/, 'chips 容器纵向行距须 ≥8px（±4 + ±4），桌面仍 6px');
      // P0：滚动容器底部安全隙，否则内容末段永远落在吸底栏的 69px 带里
      assert.match(ai, /overflow-y-auto overscroll-contain px-4 pt-4 pb-6 space-y-3 text-sm serif-font sm:pb-0/, '设置滚动区须移动端 pb-6（吸底栏安全隙）、桌面仍 pb-0');
      // 三处「只在移动端生效」必须带 max-sm / sm: 前缀，否则桌面盒模型会跟着变（用户要求桌面 100% 冻结）
      assert.match(ai, /whitespace-nowrap max-sm:min-h-\[34px\]/, '辅助按钮的 34px 须限定 max-sm（桌面保持自然高）');
    }

    // 模型行的两个动作按钮：图标语义必须与动作一致，且不得重复「插头」这个身份标。
    // 获取模型 = 重新拉一次清单（RefreshCw，load 时自转）；测试连接 = 探一次活不活（Activity 心跳）。
    assert.match(
      ai,
      /<RefreshCw\s+className=\{`h-3\.5 w-3\.5 shrink-0 \$\{fetching \? 'motion-safe:animate-spin' : ''\}`\}/,
      '「获取模型」须用 RefreshCw（14px）且在请求中自转',
    );
    assert.match(
      ai,
      /<Activity\s+className=\{`h-3\.5 w-3\.5 shrink-0 \$\{testing \? 'motion-safe:animate-pulse' : ''\}`\}/,
      '「测试连接」须用 Activity（心跳波形，14px）',
    );
    // 插头只属于「自定义端点」的身份标（ProviderIcon 里的 Plug 退化），按钮上再用就撞了
    assert.ok(!ai.includes('PlugZap'), '「测试连接」不得再用 PlugZap 插头（与自定义端点的插头标撞车）');
    assert.ok(!/<List className="w-3 h-3"/.test(ai), '「获取模型」不得再用 List（语义是"看列表"，实际动作是"重新拉取"）');
    assert.ok(ai.includes('import { Activity,') || /import \{[^}]*\bActivity\b[^}]*\} from 'lucide-react'/.test(ai), 'Activity 须从 lucide-react 具名引入');
  });

  test('问答历史入口的「有内容」信息点：口径覆盖两个 Tab，配色不得用墨色或状态色', () => {
    const ai = readAiPanel();
    // 提取信息点这一条（位置 + 尺寸 + 配色一起看，避免只断言颜色而漏掉几何回归）
    const dot = ai.match(/absolute right-[\d.]+ top-[\d.]+ w-1\.5 h-1\.5 rounded-full bg-\[var\(--[a-z-]+\)\]/);
    assert.ok(dot, '历史入口须有 6px 信息点（位置 / 尺寸 / 配色缺一不可）');

    // 口径：入口指向的面板有「问答历史 / 考考你记录」两个 Tab，只按问答历史点亮会让
    // 「只做过考考你」的用户看到一个没有提示的空入口（桌面 1280 实测复现过）。
    assert.match(
      ai,
      /\(persistHistory\.length > 0 \|\| quizHistoryData\.length > 0\) && \(/,
      '信息点须覆盖问答历史与考考你记录两个 Tab；都为空时不渲染',
    );

    // 配色：必须是有信息语义的强调色（--tech-blue），不得回退到 --accent（浅色纯黑 /
    // 深色纯白，语义空）、也不得用红/绿/琥珀等状态色（那是错误 / 成功 / 告警的语义）。
    assert.match(dot![0], /bg-\[var\(--tech-blue\)\]/, '信息点须用 --tech-blue 信息色');
    assert.doesNotMatch(dot![0], /(accent|error|success|warn|green|red|amber)/, '不得用墨色或状态色表达「有内容」');

    // 几何：不得回到贴角 4px —— History 字形外弧半径 6.67px，贴角时与点相切（实测 0.2px 缝）。
    assert.doesNotMatch(ai, /absolute right-1 top-1 w-1\.5 h-1\.5 rounded-full/, '信息点不得再贴着按钮角（会与 History 外弧相切）');
  });
}
