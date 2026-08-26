/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 版本历史（面向用户的更新记录，非技术性）。
 * 对外展示用，语言贴近使用者而非开发者。
 */
// 应用版本号（与 package.json 同步维护）
export const APP_VERSION = '1.21.10';

export interface ChangelogEntry {
  version: string;
  date: string;
  zh: string[];
  en: string[];
}

/** 新版本记录在前。 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.21.10',
    date: '2026-08',
    zh: [
      '[优化] 优化周期表朗读体验，支持英文发音',
      '[优化] 提升多语言切换时的朗读体验',
    ],
    en: [
      '[Improved] Enhanced periodic-table reading with English pronunciation',
      '[Improved] Smoother reading experience when switching languages',
    ],
  },

  {
    version: '1.21.9',
    date: '2026-08',
    zh: [
      '[新增] AI 回答加载动画升级，等待过久自动变色提示',
      '[优化] 朗读自动匹配界面语言，切换更顺手',
      '[修复] 优化 AI 追问建议，提问更稳定',
    ],
    en: [
      '[New] Upgraded AI loading animation with a color hint when waiting too long',
      '[Improved] Reading aloud now follows the interface language',
      '[Fixed] Made AI follow-up suggestions more reliable',
    ],
  },

  {
    version: '1.21.8',
    date: '2026-08',
    zh: [
      '[新增] 安装应用提供分设备图文引导',
      '[优化] 分享二维码从按钮处弹出',
    ],
    en: [
      '[New] Step-by-step install guide for each device',
      '[Improved] Share QR code pops up from the button',
    ],
  },

  {
    version: '1.21.7',
    date: '2026-08',
    zh: [
      '[修复] 修复移动端页面底部显示问题',
      '[优化] 优化页脚细节显示',
    ],
    en: [
      '[Fixed] Fixed a mobile page bottom display issue',
      '[Improved] Polished footer details',
    ],
  },

  {
    version: '1.21.6',
    date: '2026-08',
    zh: [
      '[优化] 统一实验步骤导航与弹窗交互体验',
      '[优化] 优化实验与工具页的窄屏适配与细节排版',
    ],
    en: [
      '[Improved] Unified lab step navigation and modal interactions',
      '[Improved] Refined narrow-screen layouts across labs and tools',
    ],
  },

  {
    version: '1.21.5',
    date: '2026-08',
    zh: [
      '[优化] 优化移动端与触控体验，适配大屏教学设备',
      '[优化] 优化实验与工具页在窄屏、大屏下的显示',
    ],
    en: [
      '[Improved] Improved mobile touch experience and large-screen display',
      '[Improved] Optimized lab and tool pages on narrow and large screens',
    ],
  },

  {
    version: '1.21.4',
    date: '2026-08',
    zh: [
      '[优化] 大屏教学设备显示优化，字号自动放大',
    ],
    en: [
      '[Improved] Optimized display on large teaching screens with auto-scaling text',
    ],
  },

  {
    version: '1.21.3',
    date: '2026-08',
    zh: [
      '[修复] 修复「换一批」追问未跟随对话主题的问题',
    ],
    en: [
      '[Fixed] Fixed "refresh" follow-ups not following the conversation topic',
    ],
  },

  {
    version: '1.21.2',
    date: '2026-08',
    zh: [
      '[修复] 修复 AI 回答中追问建议重复显示的问题',
    ],
    en: [
      '[Fixed] Fixed duplicate follow-up suggestions in AI answers',
    ],
  },

  {
    version: '1.21.1',
    date: '2026-08',
    zh: [
      '[优化] 优化反馈功能，可留下联系方式便于回访',
      '[优化] 优化界面细节与交互体验',
    ],
    en: [
      '[Improved] Feedback now supports optional contact info for follow-up',
      '[Improved] Polished UI details and interactions',
    ],
  },

  {
    version: '1.21.0',
    date: '2026-08',
    zh: [
      '[新增] AI 助手回答支持语音朗读，可暂停、继续',
      '[优化] 长回答朗读自动分段衔接，等待时显示动效',
    ],
    en: [
      '[New] AI assistant answers support read-aloud with pause and resume',
      '[Improved] Long answers are read in smooth segments, with animation while synthesizing',
    ],
  },

  {
    version: '1.20.10',
    date: '2026-08',
    zh: [
      '[新增] 使用说明页新增项目介绍视频',
    ],
    en: [
      '[New] Guide page now includes a project intro video',
    ],
  },

  {
    version: '1.20.9',
    date: '2026-08',
    zh: [
      '[优化] 语言默认跟随系统，英文系统自动切到英文界面',
      '[优化] 使用说明中反馈与 AI 助手条目改为图标标题，更易识别',
      '[修复] 修复移动端首页底部多余留白，旧设备也生效',
    ],
    en: [
      '[Improved] Language now follows the system preference — English devices start in English',
      '[Improved] Guide page icons for feedback and AI assistant sections',
      '[Fixed] Removed extra whitespace at the bottom of the homepage on mobile (works on older devices too)',
    ],
  },

  {
    version: '1.20.8',
    date: '2026-08',
    zh: [
      '[新增] 微信内打开页面自动提示转发，分享给同学更顺手',
      '[优化] 分享提示更清晰，工具页分享文案更贴合内容',
      '[修复] 修复移动端页面底部多余留白，电路实验图走线更清晰',
    ],
    en: [
      '[New] WeChat visitors get an automatic forward tip for sharing pages with classmates',
      '[Improved] Clearer share hints and tailored share text on tool pages',
      '[Fixed] Removed extra whitespace at the bottom on mobile; cleaner circuit wiring',
    ],
  },

  {
    version: '1.20.7',
    date: '2026-08',
    zh: [
      '[优化] 优化欢迎介绍中的版本信息展示与更新提示',
      '[优化] 优化移动端部分操作按钮的触控体验',
    ],
    en: [
      '[Improved] Polished version info and update hints in the welcome dialog',
      '[Improved] Refined touch targets for some controls on mobile',
    ],
  },

  {
    version: '1.20.6',
    date: '2026-08',
    zh: [
      '[优化] 优化 AI 助手使用须知的提示样式与文案',
      '[优化] 优化部分页面图标与资源加载',
    ],
    en: [
      '[Improved] Polished the AI assistant terms notice style and copy',
      '[Improved] Refined page icons and asset loading',
    ],
  },

  {
    version: '1.20.5',
    date: '2026-08',
    zh: [
      '[优化] 开源协议改为弹窗查看，无需跳转页面',
      '[修复] 修复 AI 助手个别实验信息标注不准确的问题',
    ],
    en: [
      '[Improved] License now opens in a dialog without page navigation',
      '[Fixed] Fix inaccurate info labeling for some labs in the AI assistant',
    ],
  },

  {
    version: '1.20.4',
    date: '2026-08',
    zh: [
      '[优化] 优化首次欢迎介绍的展示细节',
    ],
    en: [
      '[Improved] Polished the welcome dialog display details',
    ],
  },

  {
    version: '1.20.3',
    date: '2026-08',
    zh: [
      '[优化] 优化中英文切换下的界面显示与文案表述',
      '[优化] 优化首次欢迎介绍与页脚的展示布局',
      '[修复] 修复 AI 助手使用须知显示不完整的问题',
    ],
    en: [
      '[Improved] Polished bilingual UI copy and display',
      '[Improved] Refined welcome dialog and footer layouts',
      '[Fixed] Fix incomplete display of AI assistant terms',
    ],
  },

  {
    version: '1.20.2',
    date: '2026-08',
    zh: [
      '[优化] 暗色主题调整为暖色系，夜间阅读更柔和护眼',
      '[优化] 首页布局精简，随机探索入口移至标题旁',
      '[优化] 每日科学支持「翻一翻」随机切换内容',
    ],
    en: [
      '[Improved] Warmer dark theme tones for more comfortable night reading',
      '[Improved] Streamlined homepage — random-explore entry moved next to the title',
      '[Improved] Daily Science "flip" interaction for random content',
    ],
  },

  {
    version: '1.20.1',
    date: '2026-08',
    zh: [
      '[优化] AI 助手追问支持「换一批」，问答过程中实时显示 token 用量',
      '[修复] 修复停止生成后无法继续提问、切换页面后问答未跟随的问题',
      '[优化] 电路实验图更清晰，电压表符号与并联电路布局更规整',
    ],
    en: [
      '[Improved] AI follow-up questions support "refresh"; real-time token usage while answering',
      '[Fixed] Fix inability to continue asking after stopping; answers now follow page switches',
      '[Improved] Clearer circuit diagrams — refined voltmeter symbol and parallel-circuit layout',
    ],
  },

  {
    version: '1.20.0',
    date: '2026-08',
    zh: [
      '[新增] AI 学习助手支持数学公式排版、多轮问答历史与用量统计，窗口尺寸可自由调整',
      '[优化] AI 问答更贴合当前实验内容，预设服务商模型列表同步更新',
      '[优化] 优化部分页面交互与文案描述',
    ],
    en: [
      '[New] AI assistant renders math formulas, supports multi-turn chat and usage stats, with adjustable panel size',
      '[Improved] AI answers better anchored to the current lab content; provider model lists updated',
      '[Improved] Polished interactions and copy across pages',
    ],
  },

  {
    version: '1.19.2',
    date: '2026-08',
    zh: [
      '[优化] 优化部分页面交互与文案描述',
    ],
    en: [
      '[Improved] Polished page interactions and copy',
    ],
  },
  {
    version: '1.19.1',
    date: '2026-08',
    zh: [
      '[优化] 优化部分页面交互与文案描述，多端体验更顺畅',
    ],
    en: [
      '[Improved] Polished interactions and copy across pages for a smoother multi-device experience',
    ],
  },
  {
    version: '1.19.0',
    date: '2026-08',
    zh: [
      '[新增] 圆的性质探究新增分步构造动画，可逐步演示辅助线作法并配合拖拽验证',
      '[新增] 函数图像可实时标注对称轴、渐近线与顶点，二次函数新增顶点式平移演示',
      '[优化] 调整函数图像坐标范围，数值更紧凑、图像更舒展',
    ],
    en: [
      '[New] Circle inquiry adds step-by-step construction animation for its three theorems',
      '[New] Function graphs now highlight axes, asymptotes and vertices live; quadratic adds a vertex-form translation demo',
      '[Improved] Tighter coordinate ranges make function graphs more compact and comfortable',
    ],
  },
  {
    version: '1.18.0',
    date: '2026-08',
    zh: [
      '[新增] 元素周期表跟读新增男声，可在中考跟读面板一键切换，默认女生',
    ],
    en: [
      '[New] Period-table reciting gains a male voice — switch in the recite panel, female by default',
    ],
  },
  {
    version: '1.17.3',
    date: '2026-08',
    zh: [
      '[优化] 每日科学张謇卡片的彩蛋提示文案优化',
    ],
    en: [
      '[Improved] Polished the Zhang Jian easter-egg prompt copy',
    ],
  },
  {
    version: '1.17.2',
    date: '2026-08',
    zh: [
      '[优化] 每日科学张謇卡片的彩蛋图标改为本地加载，与卡片内容同步显示，加载更快且支持离线',
    ],
    en: [
      '[Improved] The Zhang Jian easter-egg icon now loads locally with the card — faster and works offline',
    ],
  },
  {
    version: '1.17.1',
    date: '2026-08',
    zh: [
      '[修复] 修复 AI 学习助手面板在移动端打开时可能出现在屏幕外的问题：面板位置自动适配当前屏幕',
    ],
    en: [
      '[Fixed] The AI assistant panel no longer opens off-screen on mobile — its position now adapts to the current viewport',
    ],
  },
  {
    version: '1.17.0',
    date: '2026-08',
    zh: [
      '[新增] 每日科学扩充：名人名言增至 48 位科学家（国内为主），新增考点速记 30 条（物理/化学/数学，契合教材），名言与考点自然混合展示',
      '[新增] 新增南通先贤张謇（实业家、教育家）条目，卡片可点击查看「百年回响 · 江海潮声」文博展（确认后跳转）',
      '[优化] 移动端顶部不再显示版本号，有新版本时在图标旁显示提示点；每日科学小故事在手机上直接展示，可点击查看完整内容',
    ],
    en: [
      '[New] Daily Science expanded: quotes from 48 scientists (mostly Chinese) plus 30 textbook-aligned key points (physics / chemistry / math), naturally mixed',
      '[New] Added Zhang Jian — Nantong\'s industrialist-educator — whose cards link (with confirmation) to the "100 Years Echo · Jianghai Tides" cultural expo',
      '[Improved] Mobile: the version number is hidden from the header (an indicator dot appears when an update is available), and the daily story shows inline with a tap-to-read-full option',
    ],
  },
  {
    version: '1.16.1',
    date: '2026-08',
    zh: [
      '[新增] 页脚作者旁新增邮箱入口：点击调起本地邮件客户端，可直接给作者发邮件',
    ],
    en: [
      '[New] An email entry next to the author in the footer: one tap opens your mail app to email the author directly',
    ],
  },
  {
    version: '1.16.0',
    date: '2026-08',
    zh: [
      '[新增] 首页学科实验按领域分类展示：物理分电学/力学/光学，数学分函数/几何，化学分物质变化/金属与酸碱，点击分类快速定位',
      '[优化] 移动端适配：随机探索按钮更紧凑，学科卡片内容在窄屏下居中显示',
      '[优化] 学科卡片内容清单最多显示两行，超出部分省略（悬停可看完整列表），三科卡片对齐更整齐',
    ],
    en: [
      '[New] Homepage labs are grouped by domain tabs: Electricity / Mechanics / Optics (physics), Functions / Geometry (math), Matter & Change / Metals & Acids-Bases (chemistry) — tap to filter',
      '[Improved] Mobile polish: a more compact random-explore button and centered subject-card content on narrow screens',
      '[Improved] Subject-card listings clamp to two lines with an ellipsis (full list on hover) and the three cards align evenly',
    ],
  },
  {
    version: '1.15.5',
    date: '2026-08',
    zh: [
      '[修复] 串并联电路图完善：三电流表样式的干路电流表 A₀ 串联在干路导线上、读数不再压线，分流/汇合处补充节点标记，电表读数统一带底衬',
      '[修复] 电压表初始正确并联在电路两端（并联图跨右侧汇合母线两端、串联图跨元件两端），不再直接搭在电源上；电源处不再有多余引线',
      '[优化] 悬停电路元件（电表/电阻/滑动变阻器）显示公式推导浮层：公式原型 + 数值代入 + 物理原理',
    ],
    en: [
      '[Fixed] Series/parallel circuit diagrams refined: the main-line ammeter A₀ sits on the main-line wire with its reading clear of any wire, junction dots mark branch split/join points, and meter readings share a unified background card',
      '[Fixed] The voltmeter now starts correctly across the circuit (the right bus in parallel diagrams, the first element in series) instead of across the supply; no more dangling leads from the battery',
      '[Improved] Hovering a circuit element (meter / resistor / rheostat) shows a formula tooltip: formula, live substitution, and the physics behind it',
    ],
  },
  {
    version: '1.15.4',
    date: '2026-08',
    zh: [
      '[优化] 首页学科卡片不再显示「建设中」等开发状态标签，展示更干净',
      '[优化] 浏览器标签页标题随页面变化：实验页显示实验名称，工具页显示工具名称',
      '[优化] 无障碍改进：键盘用户可一键跳过导航直达内容；系统开启「减少动效」时停用装饰动画',
    ],
    en: [
      '[Improved] Homepage subject cards no longer show development status labels — cleaner presentation',
      '[Improved] Browser tab titles now match the page: labs show the lab name, tools show the tool name',
      '[Improved] Accessibility: keyboard users can skip navigation to reach content; decorative animations pause when the system "reduce motion" setting is on',
    ],
  },
  {
    version: '1.15.3',
    date: '2026-08',
    zh: [
      '[优化] 首页点击学科后，实验列表紧跟学科卡片展开，内容即时可见，无需向下滚动寻找',
    ],
    en: [
      '[Improved] On the homepage, the lab list now unfolds right below the subject card so the content is immediately visible without scrolling',
    ],
  },
  {
    version: '1.15.2',
    date: '2026-08',
    zh: [
      '[优化] 优化新版本更新机制：检测到新版本后，点击提示一次刷新即可完成更新',
    ],
    en: [
      '[Improved] Improved the update flow: when a new version is detected, one tap on the indicator completes the update with a single refresh',
    ],
  },
  {
    version: '1.15.1',
    date: '2026-08',
    zh: [
      '[优化] 移动端适配调整优化：随机探索按钮触控区域加大，页脚「其他作品」面板在手机上不再超出屏幕，作品名称精简',
    ],
    en: [
      '[Improved] Mobile experience refinements: larger touch target for the random-explore button, the footer "More Works" popover no longer overflows the screen, and shorter work titles',
    ],
  },
  {
    version: '1.15.0',
    date: '2026-08',
    zh: [
      '[新增] 新增「AI 学习助手」（顶栏入口）：支持 DeepSeek、通义千问、Kimi、智谱 GLM、豆包等预设及自定义端点，您自行配置 API Key 即可使用，辅助解释初中数理化知识',
      '[优化] 首次使用先阅读并同意使用须知，再进入设置；Key 仅存本机浏览器、对话直连您所选的服务商、本站无后端不记录任何内容',
      '[优化] AI 会结合当前页面内容作答（如当前公式、实验、元素），模型列表在连接成功后自动获取；AI 内容仅供参考，请以教材和老师讲解为准',
      '[优化] 优化移动端竖屏视觉效果',
    ],
    en: [
      '[New] New "AI Assistant" (header entry): presets for DeepSeek, Qwen, Kimi, Zhipu GLM, Doubao and a custom endpoint — configure your own API key for help with middle-school math, physics and chemistry',
      '[Improved] Read and accept the terms first, then configure; the key stays in your browser, chats go straight to your chosen provider, and this site has no backend and logs nothing',
      '[Improved] AI answers are grounded in the current page (formula, lab, element); the model list is fetched after a successful connection; output is for reference — trust the textbook and your teacher',
      '[Improved] Improved mobile portrait visuals',
    ],
  },
  {
    version: '1.14.0',
    date: '2026-08',
    zh: [
      '[新增] 首页新增「每日科学」板块：每天展示一位科学家的名言与小故事，可一键换一条，中英双语',
    ],
    en: [
      '[New] Homepage adds a "Daily Science" block: a scientist quote with a short story each day, shuffleable and bilingual',
    ],
  },
  {
    version: '1.13.1',
    date: '2026-08',
    zh: [
      '[修复] 修复串并联电路实验的结论反馈：答题后正确显示 ✓/✗；优化实验视觉效果（灯泡点亮渐变、深色主题下液面颜色更清晰）',
    ],
    en: [
      '[Fixed] Fixed the conclusion feedback in the series-parallel circuits lab: ✓/✗ now shows correctly after answering; polished lab visuals (smooth bulb glow, clearer liquid colors in dark theme)',
    ],
  },
  {
    version: '1.13.0',
    date: '2026-08',
    zh: [
      '[新增] 物理新增「物理公式速查」工具：29 个初中物理核心公式按力学/热学/光学/声学/电学分类，点开看公式、单位、适用条件与易错点；公式与常量双向关联——点公式里的相关常量直接跳到常量页（带数值），常量页也能反查用到它的公式',
    ],
    en: [
      '[New] Physics adds a "Physics Formulas" tool: 29 core formulas grouped by mechanics / thermal / optics / sound / electricity, each with units, conditions and pitfalls; formulas and constants are cross-linked both ways — tap a related constant in a formula to jump to it (with its value), and each constant shows the formulas that use it',
    ],
  },
  {
    version: '1.12.2',
    date: '2026-08',
    zh: [
      '[优化] 欧姆定律实验更贴近教材：探究流程按教材表述（保持 R 不变变电压 / 保持电压不变换 R），伏安法按教材操作（变阻器先调至最大保护电路再逐渐调小），电压表读数更准确；电路图符号对齐教科书（滑动变阻器斜向下箭头+接线端子）',
    ],
    en: [
      '[Improved] The Ohm\'s law lab is now closer to the textbook: exploration follows the textbook wording (fix R and vary V / fix V and swap R), the rheostat starts at maximum to protect the circuit, voltmeter readings are more accurate, and circuit symbols match the textbook (sliding rheostat with diagonal arrow and terminals)',
    ],
  },
  {
    version: '1.12.1',
    date: '2026-08',
    zh: [
      '[修复] 修复数学公式速查勾股定理配图：改为课本常见的「竖短横长」画法，三个正方形与三角形边长严格对应，大小比例更协调',
    ],
    en: [
      '[Fixed] Fixed the Pythagorean diagram in Math Formulas: now drawn in the textbook style with the shorter leg vertical, squares strictly matching each side length',
    ],
  },
  {
    version: '1.12.0',
    date: '2026-08',
    zh: [
      '[优化] 反馈更及时：实验/项目反馈提交后直达开发者；离线时自动保存，联网后自动补发',
    ],
    en: [
      '[Improved] Faster feedback delivery: experiment/project feedback reaches the developer directly, and is saved automatically when offline and re-sent once back online',
    ],
  },
  {
    version: '1.11.1',
    date: '2026-08',
    zh: [
      '[优化] 数学公式速查检索升级：可按公式符号（如 kx、π、l=）或章节简称（如「八下」「九上」）直接搜，英文名也能用关键词匹配，找到公式更容易',
    ],
    en: [
      '[Improved] Math Formulas search upgrade: look up by formula symbols (e.g. kx, π, l=) or chapter shorthand (e.g. "八下", "九上"), and English names now match by any keyword',
    ],
  },
  {
    version: '1.11.0',
    date: '2026-08',
    zh: [
      '[新增] 数学新增「数学公式速查」工具：19 个初中数学公式分类速览、随查随搜；点开看公式详解、直观配图与易错点提醒，还能一键跳去对应的函数探究',
      '[优化] 数学公式配图更严谨：函数图像与几何示意图均按教材规范绘制，圆、扇形等图示准确清晰',
      '[优化] 数学实验与公式说明统一为「探究」表述，和教材栏目保持一致',
    ],
    en: [
      '[New] Math adds a "Math Formulas" tool: 19 middle-school formulas at a glance with search; tap a card for the formula, a clear diagram, and common pitfalls, then jump straight to the related function exploration',
      '[Improved] Math diagrams are drawn to textbook standards: accurate function graphs and geometry figures, especially circles and sectors',
      '[Improved] Math labs and formula notes now use "exploration" wording, matching the textbook',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-08',
    zh: [
      '[新增] 物理新增「物理常量速查」工具：常用常量与典型数值一表全览，支持分类筛选与检索，点开查看物理意义、应用场景与关联实验',
    ],
    en: [
      '[New] Physics adds a "Physics Constants" tool: common constants and typical values at a glance, with category filters and search; tap a card for meaning, usage, and related labs',
    ],
  },
  {
    version: '1.9.4',
    date: '2026-08',
    zh: [
      '[修复] 新版本更新一次点击即可到位',
    ],
    en: [
      '[Fixed] a new version now updates in place with a single tap',
    ],
  },
  {
    version: '1.9.3',
    date: '2026-08',
    zh: [
      '[修复] 有新版本时点一次刷新即更新到位（不再需要点两次）',
      '[优化] 元素读音按钮增加加载中/播放中状态提示',
      '[优化] 分享文案更丰富：实验分享带实验名与特色描述',
      '[优化] 图标与实验图优化：favicon 三形状更舒展，实验图线条统一、深色主题可读性提升',
        ],
    en: [
      '[Fixed] one tap on the update dot now refreshes to the latest version',
      '[Improved] Element pronunciation button shows loading/playing states',
      '[Improved] Richer share text: lab shares include the lab name and a highlight',
      '[Improved] Visual polish: roomier favicon shapes, unified stroke weights across experiments, better dark-theme readability',
    ],
  },
  {
    version: '1.9.2',
    date: '2026-08',
    zh: [
      '[新增] 实验页新增「返回学科」与「首页」双导航，浏览更方便',
      '[新增] 首页新增「随机探索」按钮，随机进入一个实验或工具，发现更多内容',
      '[修复] 修复点击版本号时误跳回首页的问题',
    ],
    en: [
      '[New] Lab pages now offer both "Back to subject" and "Home" navigation',
      '[New] New "Random explore" button on the homepage jumps to a random lab or tool',
      '[Fixed] Fixed version badge click accidentally navigating home',
    ],
  },
  {
    version: '1.9.1',
    date: '2026-08',
    zh: [
      '[优化] 元素实物照片移入「百科故事」页签，基础属性页更紧凑',
      '[优化] 超铀元素图片标注更严谨：97-104 号标注为示意图，105-118 号提示为人工合成元素（无实物照片）',
    ],
    en: [
      '[Improved] Element photos moved into the "Story" tab, keeping Properties compact',
      '[Improved] Superheavy element imagery is now labelled accurately: 97-104 shown as illustrations, 105-118 noted as synthetic elements without photos',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-08',
    zh: [
      '[新增] 元素详情新增实物照片：104 个元素可查看真实外观，点击可放大（照片来自 images-of-elements，遵循 CC BY 3.0 署名）',
      '[优化] 原子结构示意图优化：第一层电子环更容易点击，修复悬停时卡片晃动问题',
      '[优化] 反馈通道升级：提交的反馈可及时送达开发者，离线时自动保存、联网后补发',
    ],
    en: [
      '[New] Element details now show real photos for 104 elements, tappable to enlarge (photos from images-of-elements, CC BY 3.0)',
      '[Improved] Bohr diagram improvements: inner shell is easier to tap; fixed card jitter on hover',
      '[Improved] Feedback now reaches the developer promptly, saved automatically when offline and re-sent once back online',
    ],
  },
  {
    version: '1.8.1',
    date: '2026-08',
    zh: [
      '[修复] 修复在微信等内置浏览器中跟读只播放前几个元素读音的问题，连读更顺畅',
    ],
    en: [
      '[Fixed] Fixed sequential recitation audio stopping after the first few elements in in-app browsers such as WeChat',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-08',
    zh: [
      '[新增] 元素周期表新增「中考跟读」：前 20 号元素、金属活动性顺序、常见元素三大必背清单，可调朗读次数与跟读间隔，逐元素连读并高亮对应格子',
      '[优化] 元素详情相对原子质量升级为国际标准原子量，数据更准确；无稳定同位素的元素明确标注质量数',
      '[新增] 原子结构示意图可点击/悬停电子层，查看每层电子数',
      '[优化] 元素读音改为内置语音：118 个元素离线发音；修正个别元素数据与类别',
      '[新增] 周期表页与实验入口支持一键分享，界面细节优化',
    ],
    en: [
      '[New] Periodic Table adds a "Recite" mode: three must-memorize lists (first 20 elements, activity series, common elements) with adjustable repeats and gaps, sequential audio with live cell highlighting',
      '[Improved] Atomic masses upgraded to international standard values for greater accuracy; elements without stable isotopes are clearly marked with mass numbers',
      '[New] Tap or hover a shell in the Bohr diagram to see its electron count',
      '[Improved] Element pronunciation now uses built-in offline audio: all 118 elements speak offline; some data and category fixes',
      '[New] Share buttons added to the periodic table and lab entries; UI polish',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-08',
    zh: [
      '[优化] 元素周期表升级：元素详情新增原子结构示意图，并收录发现史与生活常见用途小百科',
    ],
    en: [
      '[Improved] Periodic Table upgraded: element details now include a Bohr-model diagram, along with a brief discovery-and-uses mini-wiki',
    ],
  },
  {
    version: '1.6.0',

    date: '2026-08',
    zh: [
      '[新增] 化学新增「元素周期表」工具：118 个元素一表全览，支持检索、查看元素信息、听中文读音',
    ],
    en: [
      '[New] Chemistry adds a Periodic Table tool: all 118 elements at a glance, with search, element details, and audio pronunciation',
    ],
  },
  {
    version: '1.5.0',

    date: '2026-08',
    zh: [
      '[新增] 新增版本更新提示：当有新版本时，顶部版本号旁会亮起呼吸灯圆点，点击即可刷新到最新版',
      '[优化] 部分样式与交互更新：页面细节更清爽、更顺手',
    ],
    en: [
      '[New] Added an update notice: when a new version is available, a breathing dot lights up beside the version number — tap it to refresh to the latest version',
      '[Improved] Polished some styles and interactions for a cleaner, smoother feel',
    ],
  },
  {
    version: '1.4.3',
    date: '2026-08',
    zh: [
      '[优化] 电解水更贴近教材：装置结构、电极与正负极标注更清晰',
      '[优化] 金属活动性的实验现象与反应过程更自然、更容易观察',
      '[修复] 修正一些实验细节，让操作与观察更顺畅',
    ],
    en: [
      '[Improved] Electrolysis now matches the textbook more closely: clearer apparatus, electrodes and polarity labels',
      '[Improved] Metal-activity reactions look more natural and are easier to observe',
      '[Fixed] Polished several experiment details for smoother operation',
    ],
  },
  {
    version: '1.4.2',
    date: '2026-08',
    zh: [
      '[优化] 电解水装置改为标准双管电解器：两支竖直玻璃管底部连通、电极插入水中，直流电源与导线在电解器外部上方',
    ],
    en: [
      '[Improved] Electrolysis now uses a standard two-tube cell: vertical tubes connected at the base, electrodes in the water, DC supply and wires placed above/outside the cell',
    ],
  },
  {
    version: '1.4.1',

    date: '2026-08',
    zh: [
      '[优化] 电解水改为标准 U 形玻璃管电解器：左右管底部连通、电极接直流电源、气体体积 H₂:O₂=2:1 清晰呈现',
      '[修复] 金属活动性修正：Al+CuSO₄ 反应后溶液变无色、试管改圆底、金属丝与析出物更真实',
      '[新增] 质量守恒三方案新增反应容器动画（锥形瓶加热铜粉、铁钉浸硫酸铜、碳酸钠与盐酸冒泡）',
    ],
    en: [
      '[Improved] Electrolysis now uses a standard U-shaped glass-tube cell: tubes connected at the base, electrodes to a DC supply, gas volume H₂:O₂ = 2:1 clearly shown',
      '[Fixed] Metal activity fixed: Al+CuSO₄ solution turns colorless, round-bottom tube, more realistic wire and deposit',
      '[New] Conservation of mass adds reaction-vessel visuals for all three schemes (flask + copper, iron in CuSO₄, carbonate + HCl bubbling)',
    ],
  },
  {
    version: '1.4.0',

    date: '2026-08',
    zh: [
      '[新增] 新增 2 个化学实验：电解水（正氧负氢、体积比 2:1）、金属活动性（Al > Cu > Ag 置换反应）',
      '[优化] 微观动画支持可控播放：播放/暂停、上一步/下一步步进、重播与阶段指示，便于课堂逐步讲解',
    ],
    en: [
      '[New] Added 2 chemistry labs: electrolysis of water (O₂ and H₂ in a 2:1 ratio) and metal activity (Al > Cu > Ag displacement)',
      '[Improved] Micro-animation now has controlled playback: play/pause, step back/forward, replay, and phase indicator for classroom teaching',
    ],
  },
  {
    version: '1.3.1',

    date: '2026-08',
    zh: [
      '[优化] 参数标签按教材原样显示：一次函数 k、b，二次函数 a、b、c，反比例 k 等小写',
    ],
    en: [
      '[Improved] Parameter labels follow the textbook: linear k, b; quadratic a, b, c; inverse k — all lowercase',
    ],
  },
  {
    version: '1.3.0',

    date: '2026-08',
    zh: [
      '[优化] 函数实验更贴合教材：一次函数/二次函数参数范围与坐标轴范围加大，反比例步进调细',
      '[新增] 一次函数新增「函数类型标注」：k=0 提示常函数非一次函数，b=0 标注正比例函数特例',
      '[新增] 圆的性质新增圆心角 ∠BOC 与圆周角 ∠BPC 实时度数对比，直观呈现「圆周角 = 圆心角一半」',
    ],
    en: [
      '[Improved] Function labs now match the textbook more closely: wider parameter and axis ranges for linear/quadratic, finer steps for inverse',
      '[New] Linear functions now label the function type: k=0 shows a constant function (not linear), b=0 marks a direct-proportion special case',
      '[New] Circle lab adds a live central-angle ∠BOC vs inscribed-angle ∠BPC comparison, showing "inscribed angle = half central angle"',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08',
    zh: [
      '[新增] 每个实验页标题旁新增分享按钮：一键分享该实验（二维码 / 系统分享 / 复制链接），并针对微信给出转发引导',
      '[优化] 电路图更贴近真实实验：电压表的并联引线改为「接上才显示」，默认不再有悬空的引线',
      '[修复] 修正圆周角定理的证明步骤（补充外角定理推导）',
    ],
    en: [
      '[New] Each lab page now has a share button next to the title: share that lab via QR / native share / copy link, with WeChat forwarding guidance',
      '[Improved] Circuit diagrams match real experiments: voltmeter leads now appear only when attached — no more dangling wires by default',
      '[Fixed] Fixed the inscribed-angle theorem proof (added the exterior-angle derivation)',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08',
    zh: [
      '[新增] 新增 4 个物理实验：浮力（阿基米德原理）、杠杆的平衡条件、压强、滑轮',
      '[优化] 数学实验升级：圆的性质新增证明步骤引导，函数类补充代数推导，建立「观察 → 猜想 → 证明」的数学思维闭环',
      '[优化] 欧姆定律更贴合教材伏安法：滑动变阻器调压',
    ],
    en: [
      '[New] Added 4 physics labs: Buoyancy (Archimedes\' principle), Lever balance, Pressure, and Pulleys',
      '[Improved] Math labs upgraded: circle properties now guide proof steps; function labs add algebraic derivation — building an observe → conjecture → prove loop',
      '[Improved] Ohm\'s law now matches the textbook voltmeter-ammeter method: rheostat adjusts voltage',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-08',
    zh: [
      '[优化] 优化触屏与点击操作：开关、按钮、滑块都更容易点中和拖动',
      '[优化] 家庭电路的开关、灯泡等元件在平板上操作更跟手',
      '[修复] 修正若干交互细节，让课堂演示与个人操作更顺滑',
    ],
    en: [
      '[Improved] Improved touch & tap experience: switches, buttons and sliders are easier to tap and drag',
      '[Improved] Household-circuit components (switches, bulbs) respond better on tablets',
      '[Fixed] Refined interaction details for smoother classroom demo and personal use',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-08',
    zh: [
      '[新增] 首发完整版：覆盖数学、物理、化学三大科目共 9 个探究实验',
      '[新增] 每个实验采用「预测 → 探索 → 结论」三幕式，鼓励先猜想再验证',
      '[新增] 家庭电路改为真实的交流电逻辑：火线、零线、接地三线清晰呈现',
      '[新增] 支持中英双语、深浅主题，课堂投影与个人使用都舒适',
      '[新增] 可安装到手机/电脑桌面（PWA），离线也能用',
      '[新增] 支持一键分享、二维码分享，方便同学交流',
      '[新增] 可保存到本机，无需账号、数据不上传',
    ],
    en: [
      '[New] First full release: 9 inquiry labs across Math, Physics and Chemistry',
      '[New] Every lab follows a Predict → Explore → Conclude flow that encourages guessing before verifying',
      '[New] Household circuit now uses real AC logic: live, neutral and earth wires clearly shown',
      '[New] Bilingual (zh/en) and light/dark themes, comfortable for classroom projection and personal use',
      '[New] Installable to your device home screen (PWA) and usable offline',
      '[New] One-tap and QR-code sharing for easy exchange with classmates',
      '[New] Saves locally — no account, no uploads',
    ],
  },
  {
    version: '0.0.0',
    date: '2026-07',
    zh: ['项目起步，搭建数字实验平台基础框架'],
    en: ['Project inception: basic framework of the digital lab platform'],
  },
];
