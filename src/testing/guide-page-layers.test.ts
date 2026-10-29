/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 使用说明页四层信息层级回归守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的 `使用说明页信息层级重构（视频以下三层结构）` 套件，
 * **整组 10 个用例一次迁出**。用例名、断言、正则、错误消息与执行顺序与迁移前逐字相同；
 * 唯一差别是 1 处 `readFileSync('src/…')` 改走 `readSrc()` → `repoPath()`。
 *
 * 依赖特征：零 DOM、零 async、零全局改造；只读 `src/pages/GuidePage.tsx` 源码文本，
 * 外加调用该页面的 `splitSentences` 做逐字节往返校验。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的 `test`。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { repoPath } from './repo-paths';
import { splitSentences } from '../pages/GuidePage';

export function registerGuidePageLayersTests(test: TestFn): void {
  /** 读仓库内源码：参数保持仓库相对路径，错误消息里的文件标识也不变。 */
  const readSrc = (p: string, enc: BufferEncoding = 'utf8') => readFileSync(repoPath(p), enc);
  const guide = readSrc('src/pages/GuidePage.tsx', 'utf8');
  const copyMatch = guide.match(/const copy = \{[\s\S]*?\n\};/);
  const copyBlock = copyMatch ? copyMatch[0] : '';
  const renderBlock = copyBlock ? guide.slice(guide.indexOf(copyBlock) + copyBlock.length) : guide;
  const code = guide.replace(/\/\*[\s\S]*?\*\//g, '');

  test('顶部标题、导语与视频展台保持原样', () => {
    assert.match(guide, /mx-auto w-full max-w-5xl/, '缺少统一的页面容器');
    assert.match(guide, /<figure className="mb-10 rounded-xl border[^"]*p-2[^"]*">/, '视频未升级为 figure 展台');
    assert.match(guide, /relative aspect-video w-full overflow-hidden rounded-lg bg-\[var\(--bg\)\]/, '视频内层 16:9 容器缺失');
    assert.match(guide, /text-\[var\(--muted\)\] w-full">\{c\.intro\}/, 'header 首段须 w-full 自适应撑满');
    assert.doesNotMatch(guide, /max-w-2xl/, '头部/视频不应再各自 max-w-2xl（宽度须与栅格统一）');
  });

  test('第一层：双栏等高，左卡 01–04 + 教师建议内嵌，右卡三幕 + 工具页例外', () => {
    assert.match(guide, /<div className="grid gap-4 md:grid-cols-2">/, '视频下方须为双栏栅格（移动端单列）');
    assert.doesNotMatch(guide, /md:items-start/, '不得用 items-start 收拢矮卡：左右两卡须等高对齐');
    assert.match(
      guide,
      /flex flex-col rounded-lg border border-\[var\(--border\)\] bg-\[var\(--card-bg\)\] p-4 md:p-5/,
      '半幅卡须 flex flex-col，供内嵌框 mt-auto 贴底',
    );
    assert.match(guide, /className="mt-5 rounded-md border border-\[var\(--border\)\] bg-\[var\(--accent-light\)\] p-3 md:mt-auto"/, '教师建议须以内嵌框并入左卡下半部');
    assert.match(guide, /className="mt-5 border-l-2 border-\[var\(--border\)\] py-1 pl-3 md:mt-auto"/, '工具页例外须以紧凑提示框贴右卡底部');
    const steps = copyBlock.match(/steps: \[([^\]]*)\]/)?.[1] ?? '';
    assert.equal(steps.split("',").length, 4, `基本流程须为 4 步（01–04），实际 ${steps.split("',").length}`);
    assert.ok(copyBlock.includes('预测 → 探索 → 结论'), '三幕式核心流程关键词须保留');
    assert.match(guide, /\{c\.exceptionTitle\}/, '工具页例外标题缺失');
    assert.match(guide, /\{c\.exceptionText\}/, '工具页例外正文缺失');
  });

  test('第二层：全宽通栏，三列按场景分组，词条与说明上下排', () => {
    assert.match(guide, /grid gap-6 md:grid-cols-3/, '操作卡须为桌面三列分组');
    assert.match(guide, /\{c\.opGroups\.map\(\(group\) => \(/, '操作须由三组场景数据驱动');
    assert.match(guide, /<dt className="text-sm font-semibold serif-font text-\[var\(--fg\)\]">\{term\}<\/dt>/, '词条须左侧/上方紧凑加粗');
    assert.match(guide, /<dd className="mt-0\.5 text-xs leading-relaxed text-\[var\(--muted\)\]">\{desc\}<\/dd>/, '说明须置于词条下方并弱化');
    assert.doesNotMatch(guide, /rounded-full|bg-\[var\(--accent-light\)\] px-2/, '操作条目不得再用灰色胶囊标签');
    for (const group of ['通用实验控件', '电学工作台', '化学与三维工具']) {
      assert.ok(copyBlock.includes(group), `缺少场景分组「${group}」`);
    }
  });

  test('第三层：AI 与错题本双栏并列，免责压成卡底紧凑小字', () => {
    assert.match(guide, /<div className="grid gap-6 md:grid-cols-2">/, 'AI 与错题本须双栏并列');
    assert.match(guide, /\{c\.aiPoints\.map\(/, 'AI 助手须提炼为结构化要点');
    assert.match(guide, /\{c\.mistakePoints\.map\(/, '错题本须提炼为结构化要点');
    assert.match(guide, /mt-5 border-t border-\[var\(--border\)\] pt-3/, '免责区须以顶部分隔线收束在卡片底部');
    assert.match(guide, /className="text-xs leading-snug text-\[var\(--muted\)\] serif-font"/, '免责须为 text-xs 紧凑小字，弱化视觉权重');
    assert.match(guide, /\{c\.terms\.map\(\(t\) => \(/, '四条合规声明须完整渲染');
  });

  test('第四层：首尾反馈说明不再重复', () => {
    const introZh = copyBlock.match(/intro: '([^']*)'/)?.[1] ?? '';
    assert.ok(!introZh.includes('暂存'), '顶部导语不得再解释离线暂存（与底部页脚重复）');
    assert.ok(introZh.includes('不需要登录'), '顶部导语须保留本地运行、免登录说明');
    assert.match(guide, /\{c\.privacyText\}/, '底部须保留单行反馈与隐私说明');
    assert.match(guide, /px-4 py-3 md:col-span-2/, '反馈与隐私须为紧凑单行页脚');
    assert.match(guide, /flex flex-col gap-1\.5 md:flex-row md:items-baseline md:gap-4/, '桌面端页脚标签与正文同排一行');
    assert.match(
      guide,
      /<h2 className="shrink-0 text-xs font-bold tracking-widest uppercase mono-font">/,
      '页脚标题须为普通文本块：flex 容器的基线取自图标底边，items-baseline 会把标题顶高',
    );
    assert.match(guide, /mr-2 inline-block h-3\.5 w-3\.5 align-\[-0\.125em\]/, '页脚图标须改为行内对齐，随文字基线走');
  });

  test('通栏与行宽：3 处通栏、无子级任意值死限宽', () => {
    const spans = code.match(/md:col-span-2/g) ?? [];
    assert.equal(spans.length, 3, `操作卡 + AI 卡 + 页脚应恰为 3 处通栏（注释不计），实测 ${spans.length}`);
    const arbitrary = code.match(/max-w-\[[^\]]+\]/g) ?? [];
    assert.deepEqual(arbitrary, [], `GuidePage 不得再有子级任意值死限宽，实测 ${JSON.stringify(arbitrary)}`);
    assert.match(guide, /mx-auto w-full max-w-5xl/, '页面容器须保留 max-w-5xl 统一控宽');
  });

  test('文案保留：核心关键词与四条合规声明逐字仍在', () => {
    const refs = [
      'c.backHome', 'c.title', 'c.intro', 'c.flow', 'c.steps', 'c.teaching', 'c.teachingText',
      'c.inquiry', 'c.acts', 'c.exceptionTitle', 'c.exceptionText', 'c.operations', 'c.opGroups',
      'c.ai', 'c.aiPoints', 'c.mistakes', 'c.mistakePoints', 'c.termsTitle', 'c.terms',
      'c.privacy', 'c.privacyText',
    ];
    for (const ref of refs) {
      assert.ok(guide.includes(ref), `缺少文案引用 ${ref}`);
    }
    const keywords = [
      '预测', '探索', '结论', '教师演示建议', '表笔', '拖到正确的测量点',
      '工作台接线', '工作台视图', '工作台模拟', '工作台数据', '工具页例外',
      '电路图 / 仿真图', '3D 立体模型', '最小二乘', 'CSV',
      '自带密钥 BYOK', '考一考', '自动收录', '掌握分析', '排版与 A4 打印', '导出保存',
      '服务性质与费用', '数据与隐私安全', '学习辅助声明', '合规与责任限制',
      '纯前端静态页面', 'API Key 仅保存在您本机浏览器', '未成年人请在监护人的指导下',
      '严禁用于生成或传播任何违法违规内容',
    ];
    for (const s of keywords) {
      assert.ok(copyBlock.includes(s), `核心文案丢失或被改写：${s}`);
    }
    for (const s of ['Workbench wiring', 'Workbench views', 'Workbench run', 'Workbench data', 'Tool pages', '3D model']) {
      assert.ok(copyBlock.includes(s), `英文核心文案丢失：${s}`);
    }
    assert.ok(guide.includes('数理化数字实验室'), '路由标题里的品牌名须仍在');
  });

  test('AI 首段分句工具：拼接后与原文逐字节一致', () => {
    for (const s of ['第一句。第二句；第三句。', '无句末标点结尾', '', 'A.B; C。']) {
      assert.equal(splitSentences(s).join(''), s, `分句破坏了字符：${s.slice(0, 24)}`);
    }
  });

  test('图标纪律：严禁 Emoji 与字符符号替代图标', () => {
    assert.doesNotMatch(guide, /[\u{1F300}-\u{1FAFF}]/u, '不得出现 Emoji');
    assert.doesNotMatch(guide, /[✓✗⏱▾▸●★☆]/u, '不得出现字符符号代替图标');
  });

  test('文案零改动：JSX 渲染段不得出现任何中文硬编码', () => {
    const jsx = renderBlock.slice(renderBlock.indexOf('return ('));
    const noComments = jsx.replace(/\/\*[\s\S]*?\*\//g, '');
    const cjk = noComments.match(/[一-龥]+/g) ?? [];
    assert.deepEqual(cjk, [], `JSX 段出现中文硬编码：${cjk.join(' / ')}`);
  });
}
