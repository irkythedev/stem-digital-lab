/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 次级控件视觉实体尺寸守卫（注册模块，不含执行入口）。
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

export function registerAiSecondaryControlsTests(test: TestFn): void {
  /** 读仓库内源码：参数保持仓库相对路径，错误消息里的文件标识也不变。 */
  const readSrc = (p: string, enc: BufferEncoding = 'utf8') => readFileSync(repoPath(p), enc);
  const ai = readAiPanel();

  test('全文件零 min-h-10：视觉高度不再被 40px 硬撑', () => {
    assert.doesNotMatch(ai, /min-h-10/, '仍有 min-h-10：桌面端会撑出 40px 方块（应改 py-1.5 + tap-area）');
  });

  test('不再用负外边距伪造紧凑（-m-* 会吃掉 flex 间距，与历史事故同源）', () => {
    assert.doesNotMatch(ai, /-m-[0-9.]+/, '朗读/停止按钮不得再用 -m-1.5 抵消 padding（会吃掉 flex 间距）');
    assert.match(
      ai,
      /tap-area inline-flex items-center justify-center transition-colors p-1\.5/,
      '朗读按钮须改挂 tap-area 兜触屏热区（视觉仍 17px 图标）',
    );
  });

  test('错误卡片：图标 + 文案 + 操作同处一行（横向流式，不再另起一行留白）', () => {
    assert.doesNotMatch(
      ai,
      /bg-\[var\(--error\)\]\/5 px-2\.5 py-2 space-y-1\.5/,
      '错误卡容器不得再用 space-y 竖向堆叠',
    );
    assert.match(
      ai,
      /shrink-0 inline-flex items-center gap-1\.5 px-2\.5 py-1\.5[^"]*tap-area/,
      '重试胶囊须与文案同行（shrink-0）且视觉紧凑',
    );
  });

  test('操作栏 / Prompt chips / 思考折叠：去硬描边、微底色、各带触屏热区', () => {
    // 断言改写说明：推荐追问由「微底色 chip」升级为「细描边交互卡片」后，
    // 原两条断言（微底色计数 ≥2、chip 字符串）断言的正是被替换掉的旧设计，会让改版永远红。
    // 这里保留原意图（复制回答仍为微底色、控件仍承托触屏热区、不得用字符符号），
    // 并把追问项换成新契约：细描边 + 卡片底 + 右侧箭头 + 悬停位移。
    const subtle = ai.match(/border border-transparent bg-\[var\(--accent-light\)\]\/50/g) ?? [];
    assert.ok(subtle.length >= 1, `复制回答须保持微底色（实测 ${subtle.length} 处）`);
    assert.ok(
      // 用纯字符串包含断言：类名里有 [ ] ( ) 等字符，写正则容易在转义上悄悄失配
      ai.includes('group flex w-full items-center justify-between gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-left text-xs leading-snug text-[var(--fg)]'),
      '推荐追问须为细描边卡片、文字左对齐，并挂 tap-area 兜触屏热区',
    );
    assert.match(
      ai,
      /mono-font text-xs text-\[var\(--muted\)\] transition-transform group-hover:translate-x-0\.5 group-hover:text-\[var\(--fg\)\]">→</,
      '追问卡片右侧须有箭头指示（悬停轻微右移并提亮）',
    );
    assert.match(ai, /<RotateCw className="h-3 w-3"/, '「换一批」须带 Lucide 旋转图标，不得用字符符号');
    assert.ok(!ai.includes("'▾ '") && !ai.includes("'▸ '"), '思考折叠不得再用 ▾/▸ 字符符号，应换 Lucide 图标');
    // 守卫升级：原断言是「renderReasoning 之后 900 字符内出现 ChevronDown」——
    // 窗口式断言在头部插任何东西都会红，且对「灯泡呼吸灯」毫无约束。改为先切出 renderReasoning
    // 片段（到下一个 hook 声明为止）再逐条断言，窗口大小不再影响判定。
    const rrStart = ai.indexOf('renderReasoning = (text');
    const rrEnd = ai.indexOf('const [reasoningSec', rrStart);
    assert.ok(rrStart > 0 && rrEnd > rrStart, '思考折叠函数须可定位且未被改名');
    // 注释里会提到被否决的写法（如 animate-pulse），断言前先剥注释，否则守的是注释不是代码
    const rr = ai.slice(rrStart, rrEnd).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.match(rr, /<ChevronDown className=\{`h-3 w-3 shrink-0 transition-transform/, '思考折叠须用 Lucide ChevronDown 表达展开态');
    // 呼吸灯：灯泡在折叠箭头之前（头部最左侧）、14px；正在想＝琥珀黄呼吸，想完＝中性灰静态
    const bulbAt = rr.indexOf('<Lightbulb');
    const chevAt = rr.indexOf('<ChevronDown');
    assert.ok(bulbAt > 0 && bulbAt < chevAt, '灯泡须位于折叠箭头之前（头部最左侧）');
    assert.ok(rr.includes('h-3.5 w-3.5 shrink-0 text-[var(--warn)] bulb-breathe'), '思考中须为琥珀黄（--warn 令牌）+ 呼吸');
    assert.ok(rr.includes('h-3.5 w-3.5 shrink-0 text-[var(--muted)]'), '思考结束须回中性灰静态（不抢正文视线）');
    // 呼吸用自建键帧而非 animate-pulse：后者 1→0.5 会把浅色主题的琥珀洗成浅金
    const cssBulb = readSrc('src/index.css', 'utf8');
    assert.match(cssBulb, /@keyframes bulb-breathe \{\s*0%, 100% \{ opacity: 1; \}\s*50% \{ opacity: 0\.72; \}/, '呼吸键帧须为 1→0.72（保住黄色可辨性）');
    assert.match(cssBulb, /\.bulb-breathe \{ animation: bulb-breathe 1\.8s ease-in-out infinite; \}/, '呼吸周期须 1.8s（1.5–2s 区间）');
    assert.match(cssBulb, /prefers-reduced-motion: reduce\) \{\s*\.bulb-breathe \{ animation: none; opacity: 1; \}/, '减少动效下须停呼吸并回满不透明');
    assert.ok(!rr.includes('animate-pulse'), '灯泡不得再用 animate-pulse（透明度压到 0.5，浅色下黄色失真）');
    // 两个分支必须是互斥整串：同时挂 text-[var(--warn)] 与 text-[var(--muted)] 时，
    // 谁生效取决于 Tailwind 产出的 CSS 顺序（不是 class 书写顺序），等于把颜色交给运气
    assert.doesNotMatch(rr, /text-\[var\(--muted\)\][^'"`]*text-\[var\(--warn\)\]/, '灯泡颜色不得靠类名叠加实现');
    assert.ok(!rr.includes('text-amber') && !/text-\[#[0-9a-f]{3,8}\]/i.test(rr), '黄色须走 --warn 令牌，不得用调色板色或写死色值（深色主题会失真）');
    // 耗时口径：思考中不得出现任何秒数（旧版写「约 ${sec}s」而 sec 恒为 0 → 界面宣称「想了 0 秒」）
    assert.ok(rr.includes('正在思考 · ${text.length} 字'), '思考中须为语义化提示（正在思考 · N 字）');
    assert.ok(rr.includes('首字约 ${sec}s · ${text.length} 字'), '定稿后口径须为「首字约 Ns」（测的是首包时间，不是纯思考时长）');
    assert.doesNotMatch(rr.replace(/\/\*[\s\S]*?\*\//g, ''), /（约 \$\{sec\}s \(≈\$\{sec\}s/, '旧写法「约 Ns」不得回潮（口径已改为「首字约 Ns」）');
    assert.ok(rr.includes('const settled = sec > 0'), '思考/定稿必须由 sec 是否定稿来分派（sec=0 即未定稿）');
    assert.ok(
      rr.includes("id === 'live' && reasoningStreaming"),
      '只有「当前轮且思考仍在推进」才呼吸：历史轮次与正文流式阶段都必须静止',
    );
    // 呼吸的起停在状态机里落点必须齐备，缺一个就会出现「一直闪」或「不闪」
    assert.match(ai, /setReasoningStreaming\(true\); \/\/ 首个思考增量/, '首个思考增量须点亮呼吸灯');
    assert.match(ai, /setReasoningStreaming\(false\); \/\/ 思考到此结束/, '正文首包须停止呼吸');
    assert.match(ai, /setReasoningStreaming\(false\); \/\/ 收尾兜底/, '请求收尾（含失败/中止）须停止呼吸');
  });

  test('尺寸规范：主胶囊内边距统一 px-2.5 py-1.5 + leading-none（≈26–28px 视觉）', () => {
    const pills = ai.match(/px-2\.5 py-1\.5 text-\[0\.6875rem\] mono-font leading-none/g) ?? [];
    assert.ok(pills.length >= 3, `三处主胶囊须统一（实测 ${pills.length}）`);
  });
}
