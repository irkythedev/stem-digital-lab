/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学实验「学术级硬伤」回归守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的 `Chemistry labs: academic hard-fault regressions` 套件，**整组 29 个用例一次迁出**。
 * 用例名、断言、正则、错误消息、循环边界与迁移前逐字相同；唯一差别是读源码的路径基准：
 * 原来 5 处 `readFileSync('src/…')` 由 `process.cwd()` 解析，现在改走 `readSrc()` →
 * `repoPath()`，从本模块位置推导仓库根，与工作目录无关。
 *
 * 本模块含 `✓`/`✗` 字面量（用于断言化学界面不得出现对勾叉字形），因此**必须**放在
 * `src/testing/`：smoke 的「全站界面零 ✓/✗ 判分字形」守卫会递归扫描
 * `src/{pages,components,labs,lib}`，放进 `src/labs/` 会被它自己判红（batch-4 已实测）。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的 `test`。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { repoPath } from './repo-paths';
import { CARD_FOCUS, GAS_COL_MAX, MOUTH_Y, OPTIONS as EL_OPTIONS, QUIZ_CORRECT as EL_CORRECT, TICK_YS, gasColumn } from '../labs/chemistry/Electrolysis';
import { OPTIONS as MASS_OPTIONS, QUIZ_CORRECT as MASS_CORRECT } from '../labs/chemistry/MassConservation';
import { OPTIONS as METAL_OPTIONS, QUIZ_CORRECT as METAL_CORRECT, canReact, wireColor } from '../labs/chemistry/MetalActivity';
import { AXIS_MAX, OPTIONS as NEUT_OPTIONS, QUIZ_CORRECT as NEUT_CORRECT, eqVolume, phAt, sampleTitration } from '../labs/chemistry/Neutralization';
import { labs } from '../lib/labs';

export function registerChemistryLabsTests(test: TestFn): void {
  /** 读仓库内源码：参数保持仓库相对路径，错误消息里的文件标识也不变。 */
  const readSrc = (p: string, enc: BufferEncoding = 'utf8') => readFileSync(repoPath(p), enc);

  // 先剥注释再断言：本项目已有两次被注释内示例文本误伤的经历
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  const lab = (f: string) => strip(readSrc(`src/labs/chemistry/${f}`, 'utf8'));
  const neutralization = lab('Neutralization.tsx');
  const electrolysis = lab('Electrolysis.tsx');
  const mass = lab('MassConservation.tsx');
  const balance = strip(readSrc('src/components/lab/BalanceScale.tsx', 'utf8'));
  const metal = strip(readSrc('src/labs/chemistry/MetalActivity.tsx', 'utf8'));
  const stageNav = strip(readSrc('src/components/lab/StageNav.tsx', 'utf8'));
  // 文件里 LaTeX 的反斜杠在字符串字面量中是双写；断言前归一为单写，避免数不清反斜杠
  const tex = (s: string) => s.replace(/\\\\/g, '\\');

  test('滴定曲线方向：pH 单调上升，只允许「陡升」，禁止「陡降」', () => {
    assert.doesNotMatch(
      neutralization, /陡降|平缓下降|sharp drop/,
      '向酸中滴加碱时 pH 单调上升；出现「陡降/平缓下降」即为学科方向性错误',
    );
    assert.match(neutralization, /陡升/, '中文须写明陡升段');
    assert.match(neutralization, /平缓上升/, '反馈文案须写明「中和前平缓上升」');
    assert.match(neutralization, /sharp rise/, '英文须为 sharp rise');
  });

  test('电解水方程式：必须带「通电」条件且由 Formula（KaTeX）渲染', () => {
    const t = tex(electrolysis);
    assert.match(t, /<Formula tex=\{c\.eqWater\}/, '方程式须由 Formula 渲染，不得手写箭头');
    assert.match(t, /\\text\{通电\}/, '中文方程式必须含通电条件');
    assert.match(t, /\\text\{electric current\}/, '英文方程式必须含电流条件');
    assert.doesNotMatch(t, /→\(通电\)/, '不得再用手写箭头加括号条件');
  });

  test('质量守恒方案一方程式：须配平、含参与反应的 O₂ 与加热条件', () => {
    const t = tex(mass);
    assert.match(t, /<Formula tex=\{c\.eqCuO\}/, '方案一方程式须由 Formula 渲染');
    assert.match(t, /2\\mathrm\{Cu\}/, '须以 2Cu 起始（配平）');
    assert.match(t, /\\mathrm\{O_2\}/, '必须写出参与反应的 O₂');
    assert.match(t, /xrightarrow/, '反应条件须写在箭头上方');
    assert.doesNotMatch(t, /Cu → CuO/, '不得再有漏 O₂ / 未配平的 Cu → CuO');
  });

  test('结论幕微观动画：必须对应当前实验（铜氧化），且两侧原子守恒', () => {
    assert.doesNotMatch(mass, /label: 'H₂'/, '不得再沿用氢气燃烧的反应物');
    assert.doesNotMatch(mass, /label: 'H₂O'/, '不得再沿用氢气燃烧的生成物');
    assert.match(mass, /label: 'CuO'/, '生成物须为 CuO');
    const idx = mass.indexOf('<MicroAnimation');
    assert.ok(idx >= 0, '结论幕须有微观动画');
    const micro = mass.slice(idx, idx + 1600);
    const ids = (block: string) => (block.match(/id: '\w+'/g) ?? []).map((s) => s.slice(5, -1));
    const [reactPart, prodPart] = micro.split('products=');
    assert.ok(prodPart, '微观动画须声明生成物');
    assert.deepEqual(
      [...ids(prodPart)].sort(), [...ids(reactPart)].sort(),
      '微观动画两侧原子 id 必须一一对应（质量守恒的微观本质）',
    );
  });

  test('天平横梁不得恒为水平：倾角由质量差驱动，且带阻尼过渡与分度盘', () => {
    assert.doesNotMatch(balance, /beamAngle\s*=\s*0/, '不得再有「简化：水平」的常量横梁');
    assert.match(balance, /rotate\(\$\{angle\}/, '横梁与指针须按角度旋转');
    assert.match(balance, /useDampedAngle/, '须有阻尼振荡过渡（非瞬时硬切）');
    assert.match(balance, /tiltDeg\(/, '倾角须由质量差函数求得');
    // 分度盘刻度：5 条，且最外刻度必须落在指针真实可达域内（±7px ↔ 38×sin10° ≈ 6.6px）
    const dial = balance.match(/\[(-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)+)\]\.map/);
    assert.ok(dial, '指针下方须有分度盘刻度线');
    assert.ok(dial[1].split(',').length === 5, `分度盘刻度须为 5 条：实测 [${dial[1]}]`);
    assert.match(balance, /prefers-reduced-motion/, 'rAF 须自行处理减动效偏好（全局 CSS 兜底管不到）');
  });

  test('反应现象文案：中英各一套，英文侧不得泄漏中文', () => {
    assert.doesNotMatch(mass, /REACTED_DESCS/, 'REACTED_DESCS 硬编码中文已移除');
    assert.match(mass, /\{c\.reactionLines\[activeScheme\]\[0\]\}/, '渲染须取自 copy 字典');
    const zhBlock = mass.slice(mass.indexOf('  zh: {'), mass.indexOf('  en: {'));
    const enBlock = mass.slice(mass.indexOf('  en: {'));
    const pick = (b: string) => {
      const i = b.indexOf('reactionLines');
      return i < 0 ? '' : b.slice(i, i + 420);
    };
    assert.match(pick(zhBlock), /[\u4e00-\u9fff]/, '中文 reactionLines 须为中文');
    assert.ok(pick(enBlock), '英文 copy 须有 reactionLines');
    assert.doesNotMatch(pick(enBlock), /[\u4e00-\u9fff]/, '英文 reactionLines 不得含中文字符');
  });

  test('电解水气泡：必须动态推进且受液面截断，不得进入气室', () => {
    assert.doesNotMatch(electrolysis, /cy="8[0-9]"/, '不得再有固定坐标的静止气泡');
    assert.match(electrolysis, /bubbles\.map/, '气泡须由状态数组驱动');
    assert.match(electrolysis, /requestAnimationFrame/, '气泡须逐帧推进');
    assert.match(electrolysis, /surface \+ 1/, '须有液面截断约束');
    assert.match(electrolysis, /BUBBLE_ACC/, '须体现浮力加速');
  });

  test('锥形瓶几何：下宽上窄且具竖直直颈（禁倒锥形）', () => {
    const m = mass.match(/aria-label="锥形瓶加热铜粉"[\s\S]*?<path d="([^"]+)"/);
    assert.ok(m, '须能找到锥形瓶轮廓 path');
    // 解析 M/V/L/H 绝对坐标命令，重建轮廓折点
    const pts: { x: number; y: number }[] = [];
    let x = 0;
    let y = 0;
    for (const tok of m[1].match(/[MVLHZ][^MVLHZ]*/g) ?? []) {
      const n = (tok.slice(1).match(/-?[\d.]+/g) ?? []).map(Number);
      if (tok[0] === 'M' || tok[0] === 'L') {
        x = n[0];
        y = n[1];
        pts.push({ x, y });
      } else if (tok[0] === 'V') {
        y = n[0];
        pts.push({ x, y });
      } else if (tok[0] === 'H') {
        x = n[0];
        pts.push({ x, y });
      }
    }
    assert.ok(pts.length >= 4, `锥形瓶轮廓折点不足：${pts.length}`);
    const ys = pts.map((p) => p.y);
    const widthAt = (yy: number) => {
      const xs = pts.filter((p) => Math.abs(p.y - yy) < 0.01).map((p) => p.x);
      return xs.length < 2 ? 0 : Math.max(...xs) - Math.min(...xs);
    };
    const wTop = widthAt(Math.min(...ys));
    const wBot = widthAt(Math.max(...ys));
    assert.ok(wTop > 4, `须能在瓶口高度取到两条边（实测宽度 ${wTop}）`);
    assert.ok(
      wBot > wTop * 1.5,
      `锥形瓶须下宽上窄：实测底宽 ${wBot} / 颈宽 ${wTop}（禁上宽下窄的倒锥形）`,
    );
    assert.match(m[1], /V-?[\d.]/, '须含竖直直颈段（V 命令），不得用斜线直接把瓶口封死');
  });

  test('方案一锥形瓶：须有底部细沙层与「细沙」标示', () => {
    assert.match(mass, /M86 126 V118 H154 V126 Z/, '须有铺在瓶底的细沙层');
    assert.match(mass, /\[92, 100, 108, 116, 124, 132, 140, 148\]\.map/, '须有沙纹点阵');
    assert.match(mass, /\{c\.sandLabel\}/, '须有细沙标示文字');
    const zh = mass.slice(mass.indexOf('  zh: {'), mass.indexOf('  en: {'));
    assert.match(zh, /细沙/, '中文文案须出现「细沙」');
    assert.match(zh, /炸裂/, '须写明细沙的作用（防止锥形瓶炸裂）');
  });

  test('胶头滴管：尖嘴须悬空于烧杯口上方（不得伸入容器内）', () => {
    const rim = neutralization.match(/<path d="M40 (\d+) H180 V170 H40 Z"/);
    assert.ok(rim, '须能找到烧杯轮廓 path');
    const rimY = Number(rim[1]);
    const tip = neutralization.match(/M108 (-?[\d.]+) L112 -?[\d.]+ L110 (-?[\d.]+) Z/);
    assert.ok(tip, '须能找到滴管尖嘴三角形');
    const tipY = Number(tip[2]);
    assert.ok(
      rimY - tipY >= 4,
      `尖嘴须悬空于烧杯口上方 ≥4px（规范：垂直悬空、不得伸入容器内），`
        + `实测 ${rimY - tipY}px（尖嘴 y=${tipY}、杯口 y=${rimY}）`,
    );
    // 上抬后管身下端必须与尖嘴顶端相接，避免仪器断裂
    const stem = neutralization.match(/x1="110" y1="(-?[\d.]+)" x2="110" y2="(-?[\d.]+)"/);
    assert.ok(stem, '须能找到滴管管身');
    assert.ok(Number(stem[1]) < Number(stem[2]), `管身须自上而下：实测 y1=${stem[1]} y2=${stem[2]}`);
    assert.equal(
      Number(stem[2]), Number(tip[1]),
      `管身下端(y=${stem[2]}) 须与尖嘴顶端(y=${tip[1]}) 相接`,
    );
  });

  test('金属丝几何恒定：y2 不得随反应进度拉伸', () => {
    const wire = metal.match(/<line x1="150" y1="(\d+)" x2="150" y2="(\d+)" stroke=\{wireColor\(/);
    assert.ok(wire, '须能找到金属丝 line（显色由 wireColor(react, polished) 决定）');
    assert.ok(Number(wire[2]) > Number(wire[1]), `金属丝须自上而下：y1=${wire[1]} y2=${wire[2]}`);
    // 旧实现 y2={done ? 148 : 100}：反应后金属丝被拉长 83%
    assert.doesNotMatch(metal, /y2=\{done/, '金属丝 y2 不得依赖反应状态（禁物理形变）');
    const wireY1 = Number(wire[1]);
    const wireY2 = Number(wire[2]);

    // 析出物以「表面涂层」表达，而不是改变金属丝几何
    const coat = metal.match(/<line x1="150" y1="(\d+)" x2="150" y2="(\d+)" stroke=\{depositColor\}/);
    assert.ok(coat, '须有覆盖在金属丝表面的析出物涂层 line');
    assert.ok(Number(coat[1]) >= wireY1 && Number(coat[2]) <= wireY2, `析出物涂层须落在金属丝范围内`);
    assert.match(metal, /\[76, 82, 88, 94\]\.map/, '须有析出物颗粒纹理');
    assert.match(metal, /done && depositVisible/, '析出物须随反应进度渐显');
  });

  test('析出铜色值：须为紫红系，不得用亮橙 #e08a3c', () => {
    assert.match(metal, /const depositColor = isAlCu \? '#b8533a'/, '析出铜须为紫红色 #b8533a');
    const decl = metal.match(/const depositColor[^\n]*/);
    assert.ok(decl, '须能读到 depositColor 定义');
    assert.doesNotMatch(decl[0], /#e08a3c/, '析出铜不得再用亮橙 #e08a3c');
  });

  test('溶液颜色措辞：不得绝对化断言「变无色」', () => {
    assert.doesNotMatch(metal, /由蓝色变无色/, '不得出现绝对化断言「由蓝色变无色」');
    assert.doesNotMatch(metal, /turns colorless(?! )/, '英文不得出现绝对的 turns colorless');
    assert.match(metal, /完全反应后近无色/, '中文须用规范表述「完全反应后近无色」');
    assert.match(metal, /nearly colorless upon completion/, '英文须用规范表述 nearly colorless upon completion');
    assert.match(metal, /蓝色变浅/, '中文须写明「蓝色变浅」');
  });

  test('砂纸打磨：未打磨不得启动置换反应，打磨后才可反应', () => {
    // ① 打磨状态与打磨动作（初始未打磨）
    assert.match(metal, /const \[polished, setPolished\] = useState\(false\)/, '须有 polished 状态，初值 false');
    assert.match(metal, /function polish\(\)/, '须有砂纸打磨动作');
    assert.match(metal, /onClick=\{polish\}/, '打磨按钮须绑定打磨动作');
    // ② 行为级：反应前置条件（未打磨时表面氧化膜阻隔溶液，反应无法发生）
    assert.equal(canReact(false), false, '未打磨时反应不得发生（表面氧化膜阻隔）');
    assert.equal(canReact(true), true, '打磨后反应应当可以发生');
    // ③ 未打磨就点反应 → 先 return（只给教学提示），不得走到 setDone
    assert.match(
      metal,
      /if \(!canReact\(polished\)\) \{ setNudge\(true\); return; \}/,
      '未打磨时点反应须先给提示并 return，不得启动反应',
    );
    // ④ 换金属丝 / 重置实验都要回到未打磨（新拿一根丝，表面仍有氧化膜）
    assert.match(metal, /setDone\(false\); setPolished\(false\); setNudge\(false\);/, '切换金属丝须重置打磨状态');
    assert.match(metal, /setPolished\(false\); setNudge\(false\);/, '重置实验须回到未打磨');
    // ⑤ 教学提示须按金属区分（铝的氧化膜致密、几乎不反应）
    assert.match(metal, /oxideWarn\[isAlCu \? 'al' : 'cu'\]/, '提示须按当前金属给出对应解释');
    assert.match(metal, /致密的氧化铝薄膜/, '铝须说明「致密的氧化铝薄膜」');
  });

  test('砂纸打磨：双语文案须含「砂纸打磨 / sandpaper」「氧化膜 / oxide」考点词', () => {
    assert.match(metal, /砂纸打磨/, '中文须含考点词「砂纸打磨」');
    assert.match(metal, /氧化膜/, '中文须含考点词「氧化膜」');
    assert.match(metal, /[Ss]andpaper/, '英文须含 sandpaper');
    assert.match(metal, /oxide film/, '英文须含 oxide film');
    // 探索卡文案须写明「先打磨再浸入」的操作顺序
    assert.match(metal, /prompt: '先用砂纸打磨/, '中文探索卡须写明「先用砂纸打磨」');
    assert.match(metal, /prompt: 'Polish the \w+ wire with sandpaper/, '英文探索卡须写明 Polish with sandpaper');
    // 考点速记须收录该中考必考点
    assert.match(metal, /实验前必须用砂纸打磨金属丝/, '考点速记须收录「实验前必须用砂纸打磨金属丝」');
  });

  test('Cu 语义色统一：#b8533a，全站化学实验不得再出现亮橙 #e08a3c', () => {
    // 行为级：三种铜表示（铜丝本色 / Cu 原子）必须同色
    assert.equal(wireColor('cu-agno3', true), '#b8533a', '铜丝打压磨后须为紫红 #b8533a');
    assert.equal(wireColor('al-cuso4', true), '#c8cdd4', '铝丝打磨后须为银白 #c8cdd4');
    assert.equal(wireColor('cu-agno3', false), '#7a4436', '铜丝未打磨须为暗哑氧化膜色');
    assert.equal(wireColor('al-cuso4', false), '#8b9299', '铝丝未打磨须为暗哑氧化膜色');
    // 未打磨（氧化膜）必须比打磨后暗——打磨 = 除去氧化膜、露金属光泽
    const lum = (h: string) => {
      const n = parseInt(h.slice(1), 16);
      return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    };
    for (const r of ['al-cuso4', 'cu-agno3'] as const) {
      assert.ok(
        lum(wireColor(r, false)) < lum(wireColor(r, true)),
        `${r}: 未打磨（氧化膜）亮度须低于打磨后（金属光泽）`,
      );
    }
    // 源码级：跨文件铜色不得分裂
    assert.match(metal, /cu: \{ zh: '铜丝 Cu', en: 'Cu wire', color: '#b8533a'/, 'METALS.cu.color 须为 #b8533a');
    assert.doesNotMatch(metal, /#e08a3c/, 'MetalActivity 不得再含亮橙 #e08a3c');
    assert.doesNotMatch(mass, /#e08a3c/, 'MassConservation 不得再含亮橙 #e08a3c');
    assert.equal((mass.match(/fill="#b8533a"/g) || []).length, 3, '析出红铜的 3 个颗粒须为 #b8533a');
    assert.equal((mass.match(/color: '#b8533a'/g) || []).length, 4, '微观动画的 4 个 Cu 原子须统一为 #b8533a');
  });

  test('铜粉色令牌：须为紫红系，不得再保留暗金 #b8860b / #d4a017', () => {
    const css = readSrc('src/index.css', 'utf8');
    assert.doesNotMatch(css, /#b8860b/i, '铜粉不得再用暗金 #b8860b');
    assert.doesNotMatch(css, /#d4a017/i, '铜粉不得再用亮金 #d4a017');
    assert.equal((css.match(/--cu-powder: #9e3f2b/g) || []).length, 1, '浅色主题铜粉须为 #9e3f2b');
    assert.equal(
      (css.match(/--cu-powder: #cc6242/g) || []).length, 2,
      '暗色主题铜粉须为 #cc6242（基础暗色 + 系统偏好两处）',
    );
    // 暗色不得直接沿用浅色/析出铜的 #b8533a：0.8 不透明度合成后仅 2.65:1，跌破图形元素 3:1 门槛
    assert.doesNotMatch(css, /--cu-powder: #b8533a/, '暗色铜粉不得直接用 #b8533a（合成后 2.65:1 < 3:1）');
    // 铜粉与 Cu 语义色须同族（同为紫红），不得再回到金色系
    assert.match(metal, /color: '#b8533a'/, 'Cu 语义色须为 #b8533a');

    // 实测对比度：浅色铜粉对 --card-bg 须 ≥3:1（WCAG 1.4.11 图形元素）
    const lum = (h: string) => {
      const n = parseInt(h.slice(1), 16);
      const f = (c: number) => (c <= 0.03928 ? c / 12.92 : (((c + 0.055) / 1.055) ** 2.4));
      const r = f(((n >> 16) & 255) / 255);
      const g = f(((n >> 8) & 255) / 255);
      const b = f((n & 255) / 255);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const la = lum(a);
      const lb = lum(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    const over = (fg: string, bg: string, alpha: number) => {
      const f = parseInt(fg.slice(1), 16);
      const b = parseInt(bg.slice(1), 16);
      const ch = (sh: number) => {
        const v = Math.round((((f >> sh) & 255) * alpha) + (((b >> sh) & 255) * (1 - alpha)));
        return v.toString(16).padStart(2, '0');
      };
      return `#${ch(16)}${ch(8)}${ch(0)}`;
    };
    // 铜粉矩形在实验中以 opacity 0.8 绘制，按合成后的实际呈现色判定
    assert.ok(ratio(over('#9e3f2b', '#ffffff', 0.8), '#ffffff') >= 3, '浅色铜粉合成后须 ≥3:1');
    assert.ok(ratio(over('#cc6242', '#1e1e1a', 0.8), '#1e1e1a') >= 3, '暗色铜粉合成后须 ≥3:1');
  });

  test('金属活动性：未被引用的 METALS.ag 死代码须清除', () => {
    assert.doesNotMatch(metal, /\bag: \{/, 'METALS.ag 无任何引用，须删除');
    assert.doesNotMatch(metal, /METALS\.ag/, 'METALS.ag 不得再被引用');
    assert.match(metal, /al: \{ zh: '铝丝 Al'/, 'METALS.al 须保留');
    assert.match(metal, /cu: \{ zh: '铜丝 Cu'/, 'METALS.cu 须保留');
  });

  test('电解水探索卡：4 张卡「试试这个」必须动作互异，禁止一律只通电', () => {
    // 行为级：动作主题表四者互异，且与顺序一致
    assert.equal(CARD_FOCUS.length, 4, '须有 4 张探索卡');
    assert.equal(new Set(CARD_FOCUS).size, 4, `4 张卡的动作主题必须互异：${CARD_FOCUS.join(', ')}`);
    assert.deepEqual(
      [...CARD_FOCUS], ['power', 'ratio', 'test', 'micro'],
      '动作主题须依次为 通电观察 / 体积比 / 检验气体 / 微观本质',
    );
    // 动作表与文案卡数必须一致（加卡漏配动作会退化成兜底的 power）
    assert.equal((electrolysis.match(/\{ title: '/g) || []).length, 8, '中英各 4 张卡');
    // 源码级：tryIt 由主题表驱动，不再是单一 setPower(true)
    assert.match(electrolysis, /const f: CardFocus = CARD_FOCUS\[i\] \?\? 'power'/, 'tryIt 须由 CARD_FOCUS 驱动');
    assert.doesNotMatch(
      electrolysis, /tryIt: \(\) => \{\s*setPower\(true\);\s*\}/,
      '禁止 tryIt 一律只 setPower(true)',
    );
    assert.match(electrolysis, /if \(f === 'ratio' \|\| f === 'test'\) setElapsed\(1\)/, '卡 2/3 须把两管气体收满');
    assert.match(electrolysis, /if \(f === 'test'\) setGasTest/, '卡 3 须触发气体检验动画');
    assert.match(electrolysis, /if \(f === 'micro'\) \{ setMicroOpen\(true\); setMicroEpoch/, '卡 4 须展开微观区域并触发滚动');
    // 卡 1：液面下降指示
    assert.match(electrolysis, /focus === 'power' && power && \(/, '卡 1 须有液面下降指示图层');
    assert.match(electrolysis, /\{c\.levelDrop\}/, '卡 1 须标出「液面下降」');
    // 卡 2：刻度提亮 + 量程括号 + 2:1 结论
    assert.match(electrolysis, /opacity=\{focus === 'ratio' \? 0\.95 : 0\.55\}/, '卡 2 须提亮管身刻度');
    assert.match(electrolysis, /focus === 'ratio' && \(/, '卡 2 须有体积比标注图层');
    assert.match(electrolysis, /\{c\.ratioTag\}/, '卡 2 须标出 2:1 结论');
    // 卡 4：锚点 + 平滑滚动
    assert.match(electrolysis, /microRef/, '须有微观区域锚点');
    assert.match(electrolysis, /scrollIntoView\(\{ behavior/, '卡 4 须滚动到微观区域');
    assert.match(electrolysis, /behavior: reduce \? 'auto' : 'smooth'/, '减动效偏好下须退化为即时滚动');
    // 探索幕的微观动画与结论幕共用同一份粒子规格（避免两处漂移）
    assert.match(electrolysis, /<MicroAnimation reactants=\{MICRO_REACTANTS\} products=\{MICRO_PRODUCTS\}/, '微观规格须单一定义复用');
  });

  test('电解水气体检验：须有淡蓝火焰与带火星木条的视觉表达', () => {
    assert.match(electrolysis, /focus === 'test' && gasTest > 0/, '须由焦点状态 + 播放序号驱动');
    assert.match(electrolysis, /key=\{`gas-test-\$\{gasTest\}`\}/, '重播须靠 key 重挂载');
    // H₂ 火焰：淡蓝为语义色，较深描边保证浅底轮廓 ≥3:1
    assert.match(electrolysis, /fill="#a8ccff" stroke="#3f6fb5"/, 'H₂ 火焰须为淡蓝且带可辨轮廓');
    assert.match(electrolysis, /\{c\.testH2\}/, '须有 H₂ 燃烧的说明');
    assert.match(electrolysis, /\{c\.testO2\}/, '须有 O₂ 复燃的说明');
    assert.match(electrolysis, /<circle cx="286" cy="31"/, '须有带火星木条的火星点');
    // 双语文案
    assert.match(electrolysis, /淡蓝色火焰/, '中文须写明「淡蓝色火焰」');
    assert.match(electrolysis, /带火星木条/, '中文须写明「带火星木条」');
    assert.match(electrolysis, /pale blue flame/, '英文须写明 pale blue flame');
    assert.match(electrolysis, /glowing splint/, '英文须写明 glowing splint');
  });

  test('图标纪律：化学实验与天平内不得出现对勾/叉号文本字符，须用 Lucide 矢量图标', () => {
    const files: [string, string][] = [
      ['Electrolysis', electrolysis],
      ['MetalActivity', metal],
      ['MassConservation', mass],
      ['Neutralization', neutralization],
      ['BalanceScale', balance],
    ];
    for (const [name, src] of files) {
      assert.doesNotMatch(src, /[✓✗]/, `${name} 不得残留对勾/叉号文本字符（须改用 Lucide 图标）`);
    }
    // 反向确认图标确实用上了（而不是「把字符删了、什么都没留」）
    for (const [name, src] of files.slice(0, 4)) {
      assert.match(src, /<Check className=\{MARK_CLS\}/, `${name} 判定标记须用 Lucide <Check />`);
      assert.match(src, /<X className=\{MARK_CLS\}/, `${name} 判定标记须用 Lucide <X />`);
      assert.match(src, /from 'lucide-react'/, `${name} 须从 lucide-react 引入图标`);
    }
    // BalanceScale 的提示在 SVG 内：图标须为内嵌 <svg>，文本另起 <text>
    assert.match(balance, /<Check x=\{118\} y=\{9\}/, 'BalanceScale 须内嵌 Lucide <Check />');
    assert.match(balance, /<X x=\{118\} y=\{9\}/, 'BalanceScale 须内嵌 Lucide <X />');
    // 共享 StageNav 也必须图标化：两实验改用它之后仍会渲染该完成标记
    assert.doesNotMatch(stageNav, /[✓✗]/, 'StageNav 不得残留对勾文本字符');
    assert.match(stageNav, /<Check className=/, 'StageNav 完成标记须用 Lucide <Check />');
  });

  test('四实验幕导航：须统一复用共享 StageNav，不得再手写胶囊条', () => {
    const labs: [string, string][] = [
      ['Electrolysis', electrolysis],
      ['MetalActivity', metal],
      ['MassConservation', mass],
      ['Neutralization', neutralization],
    ];
    for (const [name, src] of labs) {
      assert.match(
        src, /import StageNav from '\.\.\/\.\.\/components\/lab\/StageNav'/,
        `${name} 须引入共享 StageNav`,
      );
      assert.match(src, /<StageNav/, `${name} 须渲染 <StageNav>`);
      // 手写实现的指纹：min-h-[38px] 胶囊 + 自拼完成标记
      assert.doesNotMatch(src, /min-h-\[38px\]/, `${name} 不得再手写幕导航（min-h-[38px] 指纹）`);
      assert.doesNotMatch(src, /isDone && stage !== s/, `${name} 不得再自拼导航完成标记`);
    }
    // 三幕顺序与完成态契约须与共享组件一致
    assert.match(stageNav, /min-h-\[34px\]/, 'StageNav 胶囊须为 min-h-[34px]（四实验统一高度）');
    assert.match(stageNav, /labels: \{/, 'StageNav 须接收 labels');
    assert.match(stageNav, /isDone\?: \{/, 'StageNav 须支持 isDone 完成态');
  });

  test('题库选项顺序：正确项索引不得清一色为 0（防「总选第一项」蒙对）', () => {
    const banks: [string, Record<string, readonly (readonly [string, string])[]>, Record<string, string[]>][] = [
      ['Electrolysis', EL_OPTIONS, EL_CORRECT],
      ['MetalActivity', METAL_OPTIONS, METAL_CORRECT],
      ['MassConservation', MASS_OPTIONS, MASS_CORRECT],
      ['Neutralization', NEUT_OPTIONS, NEUT_CORRECT],
    ];
    const idxs: number[] = [];
    const where: string[] = [];
    for (const [name, options, correct] of banks) {
      for (const key of Object.keys(options)) {
        const opts = options[key] as readonly (readonly [string, string])[];
        const keys = correct[key];
        assert.ok(keys && keys.length > 0, `${name}.${key} 须有判题正确项`);
        const i = opts.findIndex(([v]) => keys.includes(v));
        assert.ok(i >= 0, `${name}.${key}: 正确项不在选项内（判题键与选项不匹配 → 永远判错）`);
        idxs.push(i);
        where.push(`${name}.${key}=${i}`);
      }
    }
    const hist = [0, 1, 2].map((slot) => idxs.filter((i) => i === slot).length);
    assert.ok(idxs.length >= 19, `题库总题数须 ≥19（实测 ${idxs.length}）`);
    assert.ok(idxs.some((i) => i !== 0), `不得所有题的正确项都在首位：${where.join(' ')}`);
    for (const slot of [0, 1, 2]) {
      assert.ok(
        hist[slot] >= 2,
        `正确项须在位置 ${slot} 至少出现 2 次；实测分布 ${JSON.stringify(hist)}（${where.join(' ')}）`,
      );
    }
    // 位置须按 1/3 均摊：理论占比 33.3%，故判据是「不得显著高于随机基线（约 36%）」，
    // 而非「首位必须 ≤30%」—— 后者与均摊目标自相矛盾（旧实现 19/19 = 100% 全挤首位）
    const share = (slot: number) => hist[slot] / idxs.length;
    for (const slot of [0, 1, 2]) {
      assert.ok(
        share(slot) <= 0.4,
        `位置 ${slot} 的正解占比 ${(share(slot) * 100).toFixed(1)}% 过高（须 ≤40%，随机基线约 36%）：${where.join(' ')}`,
      );
      assert.ok(
        share(slot) >= 0.25,
        `位置 ${slot} 的正解占比 ${(share(slot) * 100).toFixed(1)}% 过低（均摊目标约 33%）`,
      );
    }
  });

  test('电解水体积比（行为级）：气柱 H₂:O₂ 恒为 2:1，收满时两侧液面落在刻度线上', () => {
    // 读数与几何必须一致：20 mL : 10 mL 对应 36px : 18px
    assert.equal(GAS_COL_MAX, 36, 'H₂ 侧收满气柱须为 36px（对应 20 mL）');
    assert.equal(gasColumn(1).h2, 2 * gasColumn(1).o2, '收满时两管气柱必须恰为 2:1');
    assert.equal(gasColumn(0).h2, 0, '未通电时无气体');
    assert.equal(gasColumn(0).h2, gasColumn(0).o2, '未通电时两管液面须齐平');
    // 全过程中比值恒为 2:1（旧实现按「下降距离」建模，画出来的气柱只有 1.8:1）
    for (const e of [0.1, 0.25, 0.5, 0.75, 1]) {
      assert.equal(gasColumn(e).h2, 2 * gasColumn(e).o2, `elapsed=${e} 时气柱仍须为 2:1`);
    }
    // 收满时两侧液面必须正好落在刻度线上，否则「对照刻度读数」无从谈起
    const full = { left: MOUTH_Y + gasColumn(1).h2, right: MOUTH_Y + gasColumn(1).o2 };
    assert.ok(TICK_YS.includes(full.left), `H₂ 侧收满液面 ${full.left} 须落在刻度线上`);
    assert.ok(TICK_YS.includes(full.right), `O₂ 侧收满液面 ${full.right} 须落在刻度线上`);
    // 气体自管口起算
    assert.match(electrolysis, /const leftLevel = MOUTH_Y \+ col\.h2/, '液面须由 gasColumn 推出');
    assert.match(electrolysis, /const rightLevel = MOUTH_Y \+ col\.o2/, '液面须由 gasColumn 推出');
  });

  test('中和浓度档：最高档等当点须落在坐标轴内并留有余量', () => {
    const axis = neutralization.match(/const AXIS_MAX = (\d+)/);
    assert.ok(axis, '须有 AXIS_MAX 常量');
    const axisMax = Number(axis[1]);
    const slider = neutralization.match(/label="c \(HCl\)"[\s\S]{0,160}?max=\{([\d.]+)\}/);
    assert.ok(slider, '须能找到 c(HCl) 滑块上限');
    const cMax = Number(slider[1]);
    // 模型：V_eq = c × V0(20mL) / c(NaOH)=0.1
    const eqMax = (cMax * 20) / 0.1;
    assert.ok(
      eqMax <= axisMax * 0.9,
      `最高浓度档等当点须落在轴内并留 10% 余量（否则突跃被右边框截断）：V_eq=${eqMax}mL / 轴=${axisMax}mL`,
    );
    // 坐标轴、滴入量程、曲线采样必须同量程，否则曲线被截断或画到轴外
    assert.match(neutralization, /xMax=\{AXIS_MAX\}/, '坐标轴量程须用 AXIS_MAX');
    assert.match(neutralization, /max=\{AXIS_MAX\}/, '滴入量程须用 AXIS_MAX');
    assert.match(neutralization, /const steps = Math\.round\(AXIS_MAX \/ 0\.2\)/, '曲线采样须用 AXIS_MAX');
    assert.match(neutralization, /Math\.min\(volume, AXIS_MAX\) \/ AXIS_MAX/, '液面映射须与量程同源');
  });

  test('中和曲线（行为级）：三档 pH 全部落在 [0,14]，突跃恰好落在中和点', () => {
    for (const c of [0.05, 0.1, 0.2]) {
      const pts = sampleTitration(c);
      assert.equal(pts.length, 251, `曲线点数须为 251（c=${c} 实测 ${pts.length}）`);
      for (const [v, ph] of pts) {
        assert.ok(
          ph >= 0 && ph <= 14,
          `pH 必须落在 [0,14]：c=${c} v=${v.toFixed(1)}mL 得到 pH=${ph.toFixed(3)}`
            + `（酸性分支若只有 Math.max(0,…) 而无上界，等当点附近会发散到 16.9）`,
        );
      }
      const eq = eqVolume(c);
      let best = -1;
      let bestV = -1;
      for (let i = 1; i < pts.length; i++) {
        const d = pts[i][1] - pts[i - 1][1];
        if (d > best) {
          best = d;
          bestV = pts[i][0];
        }
      }
      assert.ok(
        Math.abs(bestV - eq) < 0.21,
        `突跃点须恰落在中和点：c=${c} 理论 V_eq=${eq}mL，实测最大跳变在 ${bestV}mL`,
      );
      assert.ok(eq <= AXIS_MAX * 0.9, `中和点须留轴内余量：V_eq=${eq}mL / 轴=${AXIS_MAX}mL`);
      assert.equal(phAt(c, eq), 7, `恰好中和时 pH 必须为 7（c=${c} 实测 ${phAt(c, eq)}）`);
    }
  });

  test('中和浓度：单位须为 mol/L，覆盖 0.05–0.20，不得用独立大写 M', () => {
    assert.match(neutralization, /v\.toFixed\(2\)\} mol\/L/, '浓度显示须为 mol/L 且保留两位小数');
    assert.match(neutralization, /\{acidM\.toFixed\(2\)\} mol\/L/, '读数须为 mol/L');
    assert.doesNotMatch(neutralization, /acidM\.toFixed\(\d\)\} M/, '不得再有裸「M」浓度单位');
    assert.match(
      neutralization, /label="c \(HCl\)"[\s\S]{0,120}?min=\{0\.05\}[\s\S]{0,60}?max=\{0\.2\}/,
      '浓度档须覆盖 0.05 – 0.20 mol/L',
    );
    // 0.05 用 toFixed(1) 会被显示成 0.1，故浓度一律两位小数
    assert.doesNotMatch(neutralization, /acidM\.toFixed\(1\)/, '浓度不得用一位小数（0.05 会被显示为 0.1）');
  });

  test('电解水读数：须带 mL 物理单位', () => {
    assert.match(electrolysis, /H₂ \{hVol\.toFixed\(0\)\} mL/, 'H₂ 读数须带 mL');
    assert.match(electrolysis, /O₂ \{oVol\.toFixed\(0\)\} mL/, 'O₂ 读数须带 mL');
  });

  test('电解水集气管：须有主副交替刻度线（两管齐备）', () => {
    assert.match(electrolysis, /TICK_YS\.map/, '须由 TICK_YS 常量驱动 8 条刻度');
    assert.equal(TICK_YS.length, 8, '两管各须 8 条刻度');
    assert.match(electrolysis, /<line x1="113" y1=\{y\} x2=\{i % 2 === 0 \? 127 : 120\}/, '左管刻度须存在');
    assert.match(electrolysis, /<line x1="257" y1=\{y\} x2=\{i % 2 === 0 \? 271 : 264\}/, '右管刻度须存在');
    assert.match(electrolysis, /strokeWidth=\{i % 2 === 0 \? 0\.8 : 0\.5\}/, '须区分主刻度与副刻度的线宽');
  });
}
