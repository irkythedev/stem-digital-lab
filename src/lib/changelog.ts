/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 版本历史（面向用户的更新记录，非技术性）。
 * 对外展示用，语言贴近使用者而非开发者。
 */
// 应用版本号（与 package.json 同步维护）
export const APP_VERSION = '1.15.1';

export interface ChangelogEntry {
  version: string;
  date: string;
  zh: string[];
  en: string[];
}

/** 新版本记录在前。 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.15.1',
    date: '2026-08',
    zh: [
      '移动端适配调整优化：随机探索按钮触控区域加大，页脚「其他作品」面板在手机上不再超出屏幕，作品名称精简',
    ],
    en: [
      'Mobile experience refinements: larger touch target for the random-explore button, the footer "More Works" popover no longer overflows the screen, and shorter work titles',
    ],
  },
  {
    version: '1.15.0',
    date: '2026-08',
    zh: [
      '新增「AI 学习助手」（顶栏入口）：支持 DeepSeek、通义千问、Kimi、智谱 GLM、豆包等预设及自定义端点，您自行配置 API Key 即可使用，辅助解释初中数理化知识',
      '首次使用先阅读并同意使用须知，再进入设置；Key 仅存本机浏览器、对话直连您所选的服务商、本站无后端不记录任何内容',
      'AI 会结合当前页面内容作答（如当前公式、实验、元素），模型列表在连接成功后自动获取；AI 内容仅供参考，请以教材和老师讲解为准',
      '优化移动端竖屏视觉效果',
    ],
    en: [
      'New "AI Assistant" (header entry): presets for DeepSeek, Qwen, Kimi, Zhipu GLM, Doubao and a custom endpoint — configure your own API key for help with middle-school math, physics and chemistry',
      'Read and accept the terms first, then configure; the key stays in your browser, chats go straight to your chosen provider, and this site has no backend and logs nothing',
      'AI answers are grounded in the current page (formula, lab, element); the model list is fetched after a successful connection; output is for reference — trust the textbook and your teacher',
      'Improved mobile portrait visuals',
    ],
  },
  {
    version: '1.14.0',
    date: '2026-08',
    zh: [
      '首页新增「每日科学」板块：每天展示一位科学家的名言与小故事，可一键换一条，中英双语',
    ],
    en: [
      'Homepage adds a "Daily Science" block: a scientist quote with a short story each day, shuffleable and bilingual',
    ],
  },
  {
    version: '1.13.1',
    date: '2026-08',
    zh: [
      '修复串并联电路实验结论幕的对错反馈：答题后现在会正确显示 ✓/✗（此前对错标记不显示）；灯泡灯丝点亮改为平滑渐变；化学实验液面颜色在深色主题下更清晰',
    ],
    en: [
      'Fixed the answer feedback in the series-parallel circuits lab: correct/incorrect marks now appear after answering (previously missing); bulb filament brightens smoothly; chemical liquid colors are brighter in dark theme',
    ],
  },
  {
    version: '1.13.0',
    date: '2026-08',
    zh: [
      '物理新增「物理公式速查」工具：29 个初中物理核心公式按力学/热学/光学/声学/电学分类，点开看公式、单位、适用条件与易错点；公式与常量双向关联——点公式里的相关常量直接跳到常量页（带数值），常量页也能反查用到它的公式',
    ],
    en: [
      'Physics adds a "Physics Formulas" tool: 29 core formulas grouped by mechanics / thermal / optics / sound / electricity, each with units, conditions and pitfalls; formulas and constants are cross-linked both ways — tap a related constant in a formula to jump to it (with its value), and each constant shows the formulas that use it',
    ],
  },
  {
    version: '1.12.2',
    date: '2026-08',
    zh: [
      '修复欧姆定律实验并贴近教材：电压口径统一为电阻两端电压（电压表读数），伏安法测电阻结果与真实值精确一致；探究流程按教材表述（保持 R 不变变电压 / 保持电压不变换 R），伏安法按教材操作（变阻器先调至最大保护电路再逐渐调小）；小灯泡电压表读数含灯丝升温的动态电阻；特殊点验证读数与提示一致；电路图符号对齐教科书（滑动变阻器斜向下箭头+接线端子）',
    ],
    en: [
      'Fixed voltage semantics in the Ohm\'s law lab and aligned it with the textbook: voltage means the drop across the resistor (voltmeter reading), so voltmeter-ammeter resistance matches the true value exactly; exploration follows the textbook wording (fix R and vary V / fix V and swap R); voltmeter-ammeter method follows textbook procedure (rheostat at maximum to protect, then reduce); bulb voltmeter uses hot-filament dynamic resistance; special-point readings match prompts',
    ],
  },
  {
    version: '1.12.1',
    date: '2026-08',
    zh: [
      '修复数学公式速查勾股定理配图：改为课本常见的「竖短横长」画法，三个正方形与三角形边长严格对应，大小比例更协调',
    ],
    en: [
      'Fixed the Pythagorean diagram in Math Formulas: now drawn in the textbook style with the shorter leg vertical, squares strictly matching each side length',
    ],
  },
  {
    version: '1.12.0',
    date: '2026-08',
    zh: [
      '反馈通道升级：实验/项目反馈提交后实时推送到开发者微信（Server酱推送，免实名、免费），反馈直达、更及时；离线时仍自动暂存本机，联网后补发',
    ],
    en: [
      'Feedback channel upgrade: experiment/project feedback now arrives on the developer\'s WeChat in real time via Server酱 (no real-name verification, free); offline feedback is still queued locally and auto-sent when back online',
    ],
  },
  {
    version: '1.11.1',
    date: '2026-08',
    zh: [
      '数学公式速查检索升级：可按公式符号（如 kx、π、l=）或章节简称（如「八下」「九上」）直接搜，英文名也能用关键词匹配，找到公式更容易',
    ],
    en: [
      'Math Formulas search upgrade: look up by formula symbols (e.g. kx, π, l=) or chapter shorthand (e.g. "八下", "九上"), and English names now match by any keyword',
    ],
  },
  {
    version: '1.11.0',
    date: '2026-08',
    zh: [
      '数学新增「数学公式速查」工具：19 个初中数学公式分类速览、随查随搜；点开看公式详解、直观配图与易错点提醒，还能一键跳去对应的函数探究',
      '数学公式配图更严谨：函数图像与几何示意图均按教材规范绘制，圆、扇形等图示准确清晰',
      '数学实验与公式说明统一为「探究」表述，和教材栏目保持一致',
    ],
    en: [
      'Math adds a "Math Formulas" tool: 19 middle-school formulas at a glance with search; tap a card for the formula, a clear diagram, and common pitfalls, then jump straight to the related function exploration',
      'Math diagrams are drawn to textbook standards: accurate function graphs and geometry figures, especially circles and sectors',
      'Math labs and formula notes now use "exploration" wording, matching the textbook',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-08',
    zh: [
      '物理新增「物理常量速查」工具：常用常量与典型数值一表全览，支持分类筛选与检索，点开查看物理意义、应用场景与关联实验',
    ],
    en: [
      'Physics adds a "Physics Constants" tool: common constants and typical values at a glance, with category filters and search; tap a card for meaning, usage, and related labs',
    ],
  },
  {
    version: '1.9.4',
    date: '2026-08',
    zh: [
      '修复：新版本刷新改为等新版加载完成后自动刷新，一次点击即可更新到位',
    ],
    en: [
      'Fixed: update refresh now waits for the new Service Worker before reloading, so one tap updates in place',
    ],
  },
  {
    version: '1.9.3',
    date: '2026-08',
    zh: [
      '修复：有新版本时点一次刷新即更新到位（不再需要点两次）',
      '元素读音按钮增加加载中/播放中状态提示',
      '分享文案更丰富：实验分享带实验名与特色描述',
      '图标与实验图优化：favicon 三形状更舒展，实验图线条统一、深色主题可读性提升',
      '使用说明同步更新（反馈通道说明等）',
    ],
    en: [
      'Fixed: one tap on the update dot now refreshes to the latest version',
      'Element pronunciation button shows loading/playing states',
      'Richer share text: lab shares include the lab name and a highlight',
      'Visual polish: roomier favicon shapes, unified stroke weights across experiments, better dark-theme readability',
      'Guide updated (feedback channel notes, etc.)',
    ],
  },
  {
    version: '1.9.2',
    date: '2026-08',
    zh: [
      '实验页新增「返回学科」与「首页」双导航，浏览更方便',
      '首页新增「随机探索」按钮，随机进入一个实验或工具，发现更多内容',
      '修复点击版本号时误跳回首页的问题',
    ],
    en: [
      'Lab pages now offer both "Back to subject" and "Home" navigation',
      'New "Random explore" button on the homepage jumps to a random lab or tool',
      'Fixed version badge click accidentally navigating home',
    ],
  },
  {
    version: '1.9.1',
    date: '2026-08',
    zh: [
      '元素实物照片移入「百科故事」页签，基础属性页更紧凑',
      '超铀元素图片标注更严谨：97-104 号标注为示意图，105-118 号提示为人工合成元素（无实物照片）',
    ],
    en: [
      'Element photos moved into the "Story" tab, keeping Properties compact',
      'Superheavy element imagery is now labelled accurately: 97-104 shown as illustrations, 105-118 noted as synthetic elements without photos',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-08',
    zh: [
      '元素详情新增实物照片：104 个元素可查看真实外观，点击可放大（照片来自 images-of-elements，遵循 CC BY 3.0 署名）',
      '原子结构示意图优化：第一层电子环更容易点击，修复悬停时卡片晃动问题',
      '反馈通道升级：提交的反馈将通过腾讯云开发（CloudBase）送达开发者，离线时自动保存并在联网后补发',
    ],
    en: [
      'Element details now show real photos for 104 elements, tappable to enlarge (photos from images-of-elements, CC BY 3.0)',
      'Bohr diagram improvements: inner shell is easier to tap; fixed card jitter on hover',
      'Feedback now reaches the developer via Tencent CloudBase, with offline queue and auto-retry',
    ],
  },
  {
    version: '1.8.1',
    date: '2026-08',
    zh: [
      '修复在微信等内置浏览器中跟读只播放前几个元素读音的问题，连读更顺畅',
    ],
    en: [
      'Fixed sequential recitation audio stopping after the first few elements in in-app browsers such as WeChat',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-08',
    zh: [
      '元素周期表新增「中考跟读」：前 20 号元素、金属活动性顺序、常见元素三大必背清单，可调朗读次数与跟读间隔，逐元素连读并高亮对应格子',
      '元素详情相对原子质量升级为 IUPAC 标准原子量（含不确定度）；无稳定同位素的元素明确标注质量数',
      '原子结构示意图可点击/悬停电子层，查看每层电子数',
      '元素读音改为内置语音（118 个元素离线发音，不再依赖设备语音包）；修正个别元素数据与类别',
      '周期表页与实验入口支持一键分享，界面细节优化',
    ],
    en: [
      'Periodic Table adds a "Recite" mode: three must-memorize lists (first 20 elements, activity series, common elements) with adjustable repeats and gaps, sequential audio with live cell highlighting',
      'Atomic masses upgraded to IUPAC standard atomic weights (with uncertainty); elements without stable isotopes are clearly marked with mass numbers',
      'Tap or hover a shell in the Bohr diagram to see its electron count',
      'Element pronunciation now uses built-in offline audio for all 118 elements; some data and category fixes',
      'Share buttons added to the periodic table and lab entries; UI polish',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-08',
    zh: [
      '化学新增「元素周期表」工具：118 个元素一表全览，支持检索、查看元素信息、听中文读音',
      '元素详情含原子结构示意图、发现史与生活常见用途小百科',
    ],
    en: [
      'Chemistry adds a Periodic Table tool: all 118 elements with search, element details, and audio pronunciation',
      'Element details include a Bohr-model diagram plus a brief discovery-and-uses mini-wiki',
    ],
  },
  {
    version: '1.6.0',

    date: '2026-08',
    zh: [
      '化学新增「元素周期表」工具：118 个元素一表全览，支持检索、查看元素信息、听中文读音',
    ],
    en: [
      'Chemistry adds a Periodic Table tool: all 118 elements at a glance, with search, element details, and audio pronunciation',
    ],
  },
  {
    version: '1.5.0',

    date: '2026-08',
    zh: [
      '新增版本更新提示：当有新版本时，顶部版本号旁会亮起呼吸灯圆点，点击即可刷新到最新版',
      '部分样式与交互更新：页面细节更清爽、更顺手',
    ],
    en: [
      'Added an update notice: when a new version is available, a breathing dot lights up beside the version number — tap it to refresh to the latest version',
      'Polished some styles and interactions for a cleaner, smoother feel',
    ],
  },
  {
    version: '1.4.3',
    date: '2026-08',
    zh: [
      '电解水更贴近教材：装置结构、电极与正负极标注更清晰',
      '金属活动性的实验现象与反应过程更自然、更容易观察',
      '修正一些实验细节，让操作与观察更顺畅',
    ],
    en: [
      'Electrolysis now matches the textbook more closely: clearer apparatus, electrodes and polarity labels',
      'Metal-activity reactions look more natural and are easier to observe',
      'Polished several experiment details for smoother operation',
    ],
  },
  {
    version: '1.4.2',
    date: '2026-08',
    zh: [
      '电解水装置改为标准双管电解器：两支竖直玻璃管底部连通、电极插入水中、直流电源与导线在电解器外部上方，不再浸入水中',
    ],
    en: [
      'Electrolysis now uses a standard two-tube cell: vertical tubes connected at the base, electrodes in the water, DC supply and wires placed above/outside the cell (no longer submerged)',
    ],
  },
  {
    version: '1.4.1',

    date: '2026-08',
    zh: [
      '电解水改为标准 U 形玻璃管电解器：左右管底部连通、电极接直流电源、气体体积 H₂:O₂=2:1 清晰呈现',
      '金属活动性修正：Al+CuSO₄ 反应后溶液变无色、试管改圆底、金属丝与析出物更真实',
      '质量守恒三方案新增反应容器动画（锥形瓶加热铜粉、铁钉浸硫酸铜、碳酸钠与盐酸冒泡）',
    ],
    en: [
      'Electrolysis now uses a standard U-shaped glass-tube cell: tubes connected at the base, electrodes to a DC supply, gas volume H₂:O₂ = 2:1 clearly shown',
      'Metal activity fixed: Al+CuSO₄ solution turns colorless, round-bottom tube, more realistic wire and deposit',
      'Conservation of mass adds reaction-vessel visuals for all three schemes (flask + copper, iron in CuSO₄, carbonate + HCl bubbling)',
    ],
  },
  {
    version: '1.4.0',

    date: '2026-08',
    zh: [
      '新增 2 个化学实验：电解水（正氧负氢、体积比 2:1）、金属活动性（Al > Cu > Ag 置换反应）',
      '微观动画支持可控播放：播放/暂停、上一步/下一步步进、重播与阶段指示，便于课堂逐步讲解',
    ],
    en: [
      'Added 2 chemistry labs: electrolysis of water (O₂ and H₂ in a 2:1 ratio) and metal activity (Al > Cu > Ag displacement)',
      'Micro-animation now has controlled playback: play/pause, step back/forward, replay, and phase indicator for classroom teaching',
    ],
  },
  {
    version: '1.3.1',

    date: '2026-08',
    zh: [
      '参数滑块标签改为保留大小写：一次函数 k、b，二次函数 a、b、c，反比例 k 等按数学教材原样小写显示',
    ],
    en: [
      'Param slider labels now preserve case: linear k, b; quadratic a, b, c; inverse k display in lowercase as in the textbook',
    ],
  },
  {
    version: '1.3.0',

    date: '2026-08',
    zh: [
      '函数实验更贴合教材：一次函数/二次函数参数范围与坐标轴范围加大，反比例步进调细',
      '一次函数新增「函数类型标注」：k=0 提示常函数非一次函数，b=0 标注正比例函数特例',
      '圆的性质新增圆心角 ∠BOC 与圆周角 ∠BPC 实时度数对比，直观呈现「圆周角 = 圆心角一半」',
    ],
    en: [
      'Function labs now match the textbook more closely: wider parameter and axis ranges for linear/quadratic, finer steps for inverse',
      'Linear functions now label the function type: k=0 shows a constant function (not linear), b=0 marks a direct-proportion special case',
      'Circle lab adds a live central-angle ∠BOC vs inscribed-angle ∠BPC comparison, showing "inscribed angle = half central angle"',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08',
    zh: [
      '每个实验页标题旁新增分享按钮：一键分享该实验（二维码 / 系统分享 / 复制链接），并针对微信给出转发引导',
      '电路图更贴近真实实验：电压表的并联引线改为「接上才显示」，默认不再有悬空的引线',
      '修正圆周角定理证明步骤（补充外角定理推导）、标题年级位置与重复提示文字',
    ],
    en: [
      'Each lab page now has a share button next to the title: share that lab via QR / native share / copy link, with WeChat forwarding guidance',
      'Circuit diagrams match real experiments: voltmeter leads now appear only when attached — no more dangling wires by default',
      'Fixed the inscribed-angle theorem proof (added exterior-angle derivation), title grade placement, and duplicate hint text',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08',
    zh: [
      '新增 4 个物理实验：浮力（阿基米德原理）、杠杆的平衡条件、压强、滑轮',
      '数学实验升级：圆的性质新增证明步骤引导，函数类补充代数推导，建立「观察 → 猜想 → 证明」的数学思维闭环',
      '欧姆定律更贴合教材伏安法：滑动变阻器调压 + 参数滑块随所选元件自动匹配',
    ],
    en: [
      'Added 4 physics labs: Buoyancy (Archimedes\' principle), Lever balance, Pressure, and Pulleys',
      'Math labs upgraded: circle properties now guide proof steps; function labs add algebraic derivation — building an observe → conjecture → prove loop',
      'Ohm\'s law now matches the textbook voltmeter-ammeter method: rheostat adjusts voltage, parameter sliders auto-match the selected element',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-08',
    zh: [
      '优化触屏与点击操作：开关、按钮、滑块都更容易点中和拖动',
      '家庭电路的开关、灯泡等元件在平板上操作更跟手',
      '修正若干交互细节，让课堂演示与个人操作更顺滑',
    ],
    en: [
      'Improved touch & tap experience: switches, buttons and sliders are easier to tap and drag',
      'Household-circuit components (switches, bulbs) respond better on tablets',
      'Refined interaction details for smoother classroom demo and personal use',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-08',
    zh: [
      '首发完整版：覆盖数学、物理、化学三大科目共 9 个探究实验',
      '每个实验采用「预测 → 探索 → 结论」三幕式，鼓励先猜想再验证',
      '家庭电路改为真实的交流电逻辑：火线、零线、接地三线清晰呈现',
      '支持中英双语、深浅主题，课堂投影与个人使用都舒适',
      '可安装到手机/电脑桌面（PWA），离线也能用',
      '支持一键分享、二维码分享，方便同学交流',
      '可保存到本机，无需账号、数据不上传',
    ],
    en: [
      'First full release: 9 inquiry labs across Math, Physics and Chemistry',
      'Every lab follows a Predict → Explore → Conclude flow that encourages guessing before verifying',
      'Household circuit now uses real AC logic: live, neutral and earth wires clearly shown',
      'Bilingual (zh/en) and light/dark themes, comfortable for classroom projection and personal use',
      'Installable to your device home screen (PWA) and usable offline',
      'One-tap and QR-code sharing for easy exchange with classmates',
      'Saves locally — no account, no uploads',
    ],
  },
  {
    version: '0.0.0',
    date: '2026-07',
    zh: ['项目起步，搭建数字实验平台基础框架'],
    en: ['Project inception: basic framework of the digital lab platform'],
  },
];
