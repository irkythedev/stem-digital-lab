/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * Token 用量图表源码守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe，**整组 9 个用例一次迁出**。
 * 用例名、断言、正则、错误消息与执行顺序与迁移前逐字相同；3 处 `readFileSync('src/…')`
 * （含 `package.json`）改走 `readSrc()`，`readAiPanel()` 换成 `./ai-panel-source` 的同义实现。
 *
 * 依赖特征：零 DOM、零 async、零全局改造；断言对象是图表组件源码、包依赖清单与 i18n 文案。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { readAiPanel } from './ai-panel-source';
import { repoPath } from './repo-paths';
import { translations } from '../lib/i18n';

export function registerTokenUsageChartTests(test: TestFn): void {
  /** 读仓库内源码：参数保持仓库相对路径，错误消息里的文件标识也不变。 */
  const readSrc = (p: string, enc: BufferEncoding = 'utf8') => readFileSync(repoPath(p), enc);
  const chart = readSrc('src/components/ui/TokenUsageChart.tsx', 'utf8');
  const dialog = readSrc('src/components/ui/TokenUsageDialog.tsx', 'utf8');

  test('包依赖中不存在任何图表库（手写原生 SVG）', () => {
    const pkg = JSON.parse(readSrc('package.json', 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) });
    const banned = deps.filter((d) => /recharts|chartjs|chart\.js|echarts|nivo|victory|apexcharts|visx|^d3$/i.test(d));
    assert.deepEqual(banned, [], `不得引入图表库：${banned.join(', ')}`);
    for (const lib of ['recharts', 'chart.js', 'echarts', 'd3']) {
      assert.ok(!chart.includes(`from '${lib}'`), `图表组件不得依赖 ${lib}`);
    }
  });

  test('非等比缩放 + 发丝描边：锁 1px 边框语言', () => {
    assert.match(chart, /preserveAspectRatio="none"/, '百分比横轴必须配 preserveAspectRatio="none"');
    assert.match(chart, /vectorEffect="non-scaling-stroke"/, '描边必须 non-scaling-stroke，否则被非等比缩放拉粗');
  });

  test('整列命中区：单个透明 rect 按 clientX 算列，不为每根柱建元素', () => {
    assert.match(chart, /data-usage-hit="1"/, '必须有整列透明命中区');
    assert.match(chart, /pickIndex\(e\.clientX/, '命中列必须按 clientX 计算');
    assert.match(chart, /Math\.floor\(ratio \* n\)/, '列序号 = floor(clientX 比例 × 柱数)');
  });

  test('断档日去方框化：只留 1.5px 圆头极淡短横条 + before 只做脚注 + 读数条常驻', () => {
    assert.match(chart, /data-usage-empty="1"/, '断档日必须有标记（供量测与测试定位）');
    assert.match(chart, /strokeLinecap="round"/, '断档日短横条必须圆头（不再是方框）');
    assert.match(chart, /strokeWidth=\{1\.5\}/, '断档日短横条 1.5px（发丝级，不抢视线）');
    assert.match(chart, /opacity=\{0\.25\}/, '断档日短横条必须极淡（无记录 ≠ 用量为 0）');
    assert.ok(!/<rect[^>]*data-usage-empty/.test(chart), '断档日不得再画空心方框 rect（整排方框=密集栅栏噪音）');
    assert.match(dialog, /u\.legacyPrefix/, 'before 桶必须以脚注呈现');
    assert.ok(!dialog.includes('此前累计'), 'before 不得作为列表行出现（该文案已收进 i18n）');
    // 方案 B：日期明细列表整体移除 —— 不得再有任何列表 / 折叠 / 滚动残留
    assert.doesNotMatch(dialog, /byDay|aria-expanded|ChevronDown/, '时间轴的日期明细列表必须已彻底移除');
    assert.match(dialog, /u\.hint/, '读数条必须常驻（固定高度，防抖动）');
  });

  test('天数切换 = 整体分段滑槽（废除三个独立方框；桌面紧凑、触屏 40px）', () => {
    assert.match(
      dialog,
      /inline-flex items-center gap-0 p-0\.5 rounded-lg bg-\[var\(--accent-light\)\]\/70 border border-\[var\(--border\)\]\/60/,
      '外层必须是整体式包裹槽（不是三个割裂方块）；槽底 70% 叠色保证未选中文字暗色 ≥5.5',
    );
    assert.match(dialog, /tap-area rounded-md px-2\.5 py-1\.5 text-\[0\.6875rem\]/, '选项必须是紧凑胶囊 + tap-area（触屏兜到 40px）');
    assert.ok(!/min-h-10 px-2 text-\[0\.625rem\] mono-font border/.test(dialog), '不得回到三个割裂的独立方框');
    assert.match(
      dialog,
      /bg-\[var\(--card-bg\)\] text-\[var\(--fg\)\] font-medium border-\[var\(--border\)\]\/50 shadow-xs/,
      '选中态必须是抬起的卡片式胶囊（底色 + 微阴影 + 半透明描边）',
    );
    assert.match(dialog, /text-\[var\(--muted\)\] border-transparent hover:text-\[var\(--fg\)\]/, '未选中态透明描边，避免选中时尺寸跳动');
    // 列表移除后，弹窗只剩「头部 + 图表块 + 脚注」三层，不得再有 flex-1 滚动容器
    assert.doesNotMatch(dialog, /flex-1 overflow-y-auto|overscroll-contain/, '弹窗不得再留多余的垂直滚动区');
  });

  test('读数条：合计 + 各模型绝对值(百分比)，未选中回落最近一天（固定高度防抖）', () => {
    assert.match(dialog, /data-usage-readout="1"/, '读数条必须有稳定标记（供量测与测试定位）');
    assert.match(dialog, /h-12 px-3 flex flex-col justify-center/, '读数条必须是固定高度（悬停/换窗都不抖动）');
    assert.match(dialog, /u\.dayTotal/, '当日数字必须带「合计 / total」标签');
    assert.match(
      dialog,
      /≈\$\{s\.tokens\.toLocaleString\(\)\} \(\$\{s\.sharePct\}%\)/,
      '每段必须同时给绝对值与百分比（方案 B 的读数条强化要求）',
    );
    assert.match(dialog, /reverse\(\)\.find\(\(b\) => b\.hasRecord\)/, '未选中时必须回落到最近一个有记录的日子');
  });

  test('图表呼吸感：X 轴时间标尺（左/中/右 MM-DD）+ 图例色块微圆角', () => {
    assert.match(dialog, /grid grid-cols-3 text-\[0\.625rem\] mono-font/, '底部必须有左/中/右三点时间标尺');
    assert.match(dialog, /axisLabels\[0\]/, '标尺取首日');
    assert.match(dialog, /axisLabels\[1\]/, '标尺取中日');
    assert.match(dialog, /axisLabels\[2\]/, '标尺取末日');
    assert.match(dialog, /day\.length >= 10 \? day\.slice\(5\)/, '标尺只显示 MM-DD');
    const dots = dialog.match(/w-2 h-2 shrink-0 rounded-\[2px\]/g) ?? [];
    assert.ok(dots.length >= 2, `图例色块必须微圆角（模型 + 其他，实测 ${dots.length} 处）`);
  });

  test('按钮去硬描边：AI 窗口重试 / 继续生成 / Quiz 重试统一为轻底色胶囊', () => {
    const ai = readAiPanel();
    const pills = ai.match(/rounded-md border border-\[var\(--border\)\]\/80 bg-\[var\(--accent-light\)\] text-\[var\(--fg\)\]/g) ?? [];
    assert.ok(pills.length >= 3, `三处 chip 都要改成轻底色胶囊（实测 ${pills.length} 处）`);
    assert.match(ai, /py-1\.5[^"]*tap-area"\s*>\s*<ChevronsDown/, '继续生成须为紧凑胶囊（py-1.5）+ tap-area 触屏热区 + Lucide 图标');
    assert.match(
      ai,
      /rounded-md border border-\[var\(--border\)\]\/60 bg-\[var\(--error\)\]\/5 px-2\.5 py-2/,
      '错误卡片也去硬边（微质感错误底 + 半透明发丝边）',
    );
  });

  test('文案全部走 i18n（中英齐全），且新文件不含 emoji / 字符符号', () => {
    const keys = [
      'title', 'totalPrefix', 'totalSuffix', 'dayTotal', 'dailyTitle', 'windowAria', 'days7', 'days14', 'days30',
      'a11yChart', 'hint', 'noRecord', 'other', 'modelTotal', 'legacyPrefix', 'legacySuffix', 'empty', 'close',
    ] as const;
    for (const k of keys) {
      assert.ok(translations.zh.usage[k], `usage.${k} 缺少中文`);
      assert.ok(translations.en.usage[k], `usage.${k} 缺少英文`);
    }
    for (const [name, src] of [['TokenUsageChart.tsx', chart], ['TokenUsageDialog.tsx', dialog]] as const) {
      const glyph = src.match(/[✓✗⏱]/);
      assert.equal(glyph, null, `${name} 不得出现字符符号：${glyph?.[0]}`);
      const emoji = src.match(/[\u{1F300}-\u{1FAFF}\u{2705}\u{274C}\u{26A0}]/u);
      assert.equal(emoji, null, `${name} 不得出现 emoji：${emoji?.[0]}`);
    }
  });
}
