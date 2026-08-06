/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 版本历史（面向用户的更新记录，非技术性）。
 * 对外展示用，语言贴近使用者而非开发者。
 */
// 应用版本号（与 package.json 同步维护）
export const APP_VERSION = '1.7.0';

export interface ChangelogEntry {
  version: string;
  date: string;
  zh: string[];
  en: string[];
}

/** 新版本记录在前。 */
export const CHANGELOG: ChangelogEntry[] = [
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
