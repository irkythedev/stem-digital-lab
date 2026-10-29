/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 使用说明：课堂与个人探究的简明操作指南。
 */
import BackLink from '../components/layout/BackLink';
import { MessageSquare, NotebookPen, Sparkles } from 'lucide-react';
import { useApp } from '../lib/app-context';
import { usePageMeta } from '../lib/use-page-meta';

const copy = {
  zh: {
    title: '使用说明',
    backHome: '返回',
    intro: '这是一个本地运行的初中 STEM 数字探究空间，不需要登录。首页「每日科学」每天展示一位科学家的名言与小故事。',
    flow: '基本流程与课堂建议',
    steps: ['选择学科或工具区，或点首页「随机探索」', '进入实验页或工具页', '实验：预测 → 探索 → 结论', '工具：自由使用，不走三幕式'],
    teaching: '教师演示建议',
    teachingText: '先让学生独立预测，再邀请学生描述证据，最后共同完成结论。每一步都可以随时返回、反复调整，不做顺序限制。',
    inquiry: '三幕式探究',
    acts: [
      ['预测', '先根据已有知识形成自己的猜想，不急着看答案。'],
      ['探索', '拖动滑块、操作开关或拖拽图形，观察参数变化带来的结果，并记录证据。'],
      ['结论', '根据观察完成结论题，再查看正误反馈与考点速记。'],
    ],
    exceptionTitle: '工具页例外',
    exceptionText: '电学工作台与四个查表工具不走三幕式：工作台是自由沙盒，查表工具只读，打开即用。',
    operations: '交互与工具操作',
    opGroups: [
      {
        title: '通用实验控件',
        items: [
          ['滑块', '改变实验变量'],
          ['画布上拖动', '拖动圆周上的点或图形，观察几何关系'],
          ['按钮 / 开关', '点击改变通断状态，或启动 / 暂停'],
          ['亮点 / 表笔', '拖到正确的测量点'],
          ['记一组 / 清除', '保存当前参数与现象，或清空本轮记录'],
        ],
      },
      {
        title: '电学工作台',
        items: [
          ['工作台接线', '依次点两个接线柱连线；双击开关改变通断；右键或长按打开操作菜单'],
          ['工作台视图', '顶栏切换「电路图 / 仿真图」；画布读数与数据记录面板实时联动'],
          ['工作台模拟', '运行 / 暂停仿真，撤销 / 重做，清空与适配画布'],
          ['元件编辑', '左侧添加元件，右侧调整参数'],
          ['工作台数据', '记录读数、最小二乘拟合、导出 CSV；元件损坏时点「一键修复」（需先断开开关）'],
        ],
      },
      {
        title: '化学与三维工具',
        items: [
          ['元素周期表', '多维检索（符号 / 中文名 / 英文名），点喇叭听读音'],
          ['3D 立体模型 / 晶胞', '点「查看 3D 立体模型」进入可拖拽旋转的三维视图，点「课本平面」切回课本规范图'],
          ['玻尔模型', '点击电子层查看该层电子数'],
        ],
      },
    ],
    ai: 'AI 学习助手',
    aiPoints: [
      ['自带密钥 BYOK', '自行配置 DeepSeek、通义千问、Kimi、智谱 GLM、豆包等服务商的 API Key；本站不提供、不代购、不收取任何费用。'],
      ['多模态朗读', '回答可一键朗读，数学公式、化学式按规范读法读出而非逐字符；问答历史仅保存在本机，可随时清除，支持按科目 / 知识点筛选。'],
      ['启发式对话', '回答末尾推荐 3 个追问并支持「换一批」；面板不设自由对话输入框，提问从页面上的「问 AI」「考考你」入口发起。'],
      ['考一考出题', '基于当前知识点批量生成单选、填空或混合题，可选题量、角度与限时，支持 AI 辅助判分，作答后即时判分与讲解。'],
    ],
    mistakes: '错题本与练习卷',
    mistakePoints: [
      ['自动收录', '在 AI 面板「考考你」作答后，答错的题自动记入错题集，不需要手动收藏。'],
      ['掌握分析', '按薄弱知识点、错误类型与趋势汇总，并给出 AI 复习建议。'],
      ['排版与 A4 打印', '按知识点分节、全卷连续编号、标注建议限时；勾选「含答案与解析」后，答案在文末独立起页；含公式的选项自动改为单列。'],
      ['导出保存', '错题集 → 按科目 / 知识点筛选 → 「导出错题卷」→ 选排序方式与演算留白 → 先「预览」核对 A4 版式 → 「直接打印」，或在系统打印窗口「另存为 PDF」。'],
    ],
    termsTitle: '使用须知与免责',
    terms: [
      { title: '服务性质与费用', body: '本站为纯前端静态页面，仅提供对话界面，不提供任何 AI 大模型服务，也不收取任何费用。您需自行注册并管理所选 AI 服务商的 API，相关费用由您与服务商结算。' },
      { title: '数据与隐私安全', body: '您的 API Key 仅保存在您本机浏览器的本地存储中。本站无后端服务器，不采集、不存储、不中转任何密钥或对话内容。对话数据由您的浏览器直接发送至您所选的服务商。请妥善保管您的 API Key，防范泄露风险。' },
      { title: '学习辅助声明', body: '本 AI 助手专为初中数学（人教版）、物理（苏科版）、化学（人教版）学习辅助设计。AI 生成的内容存在不准确的可能，仅供参考，请务必以学校教材和任课老师的讲解为准。未成年人请在监护人的指导下配置和使用。' },
      { title: '合规与责任限制', body: '请合法合规使用本工具，严禁用于生成或传播任何违法违规内容。由于网络环境或服务商跨域（CORS）限制导致的连接问题，本站无法干预。因使用本工具及所选 AI 服务产生的相关权责，由您与服务商自行承担。' },
    ],
    privacy: '反馈与隐私',
    privacyText: '实验反馈和项目反馈会发送给开发者；离线或网络异常时自动暂存在当前浏览器，联网后补发。',
  },
  en: {
    title: 'How to use',
    backHome: 'Back',
    intro: 'A local middle-school STEM exploration space — no login needed. The homepage Daily Science block shares a scientist quote and story each day.',
    flow: 'Basic flow & classroom tips',
    steps: ['Choose a subject or the tools area, or hit "Random explore"', 'Open a lab page or a tool page', 'Labs: Predict → Explore → Conclude', 'Tools: free to use, no three acts'],
    teaching: 'Teaching suggestion',
    teachingText: 'Let students predict independently, invite them to describe evidence, then complete the conclusion together. Any act can be revisited; there are no hard locks.',
    inquiry: 'Three-act inquiry',
    acts: [
      ['Predict', 'Make a guess from what you already know before looking at the result.'],
      ['Explore', 'Adjust sliders, switches, or draggable points. Observe changes and record evidence.'],
      ['Conclude', 'Answer the conclusion questions, then check feedback and key points.'],
    ],
    exceptionTitle: 'Tool pages',
    exceptionText: 'The circuit workbench and the four lookup tools skip the three acts: the workbench is a free sandbox and the lookup tools are read-only.',
    operations: 'Interaction & tools',
    opGroups: [
      {
        title: 'General controls',
        items: [
          ['Slider', 'Change an experimental variable'],
          ['Drag on canvas', 'Drag points on a circle or shapes to explore geometry'],
          ['Buttons / switches', 'Click to toggle, start or pause'],
          ['Highlight / probe', 'Drag to correct measurement points'],
          ['Record / clear', 'Save current parameters and observations, or reset this round'],
        ],
      },
      {
        title: 'Circuit workbench',
        items: [
          ['Workbench wiring', 'Tap two terminals to connect; double-tap a switch to open or close it; right-click or long-press for the component menu'],
          ['Workbench views', 'Switch "Circuit / Simulation" in the toolbar; readings and the data table follow the canvas'],
          ['Workbench run', 'Run or pause the simulation, undo or redo, clear and fit the canvas'],
          ['Edit components', 'Add on the left, adjust parameters on the right'],
          ['Workbench data', 'Record readings, least-squares fit, export CSV; when a component is damaged, hit "Repair" (switch it off first)'],
        ],
      },
      {
        title: 'Chemistry & 3D tools',
        items: [
          ['Periodic table', 'Search by symbol or name; tap the speaker to hear the element'],
          ['3D model / unit cell', 'In the periodic table, "Open the 3D model" enters a draggable three-dimensional view; "Flat view" returns to the textbook diagram'],
          ['Bohr model', 'Tap a shell to see its electron count'],
        ],
      },
    ],
    ai: 'AI Assistant',
    aiPoints: [
      ['Bring your own key (BYOK)', 'Configure your own API key from DeepSeek, Qwen, Kimi, Zhipu GLM, Doubao and more; this site provides no key, sells nothing and charges nothing.'],
      ['Multimodal read-aloud', 'Read any answer aloud at one click; math formulas and chemical names use standard spoken form. History stays on this device, can be cleared anytime and filtered by subject or topic.'],
      ['Guided dialogue', 'Each answer recommends 3 follow-up questions with a refresh option; there is no free-form chat box — questions start from the page-level "Ask AI" and "Quiz me" entries.'],
      ['Quiz generation', 'Batch-generate single-choice, fill-in or mixed questions from the current topic, with count, angle and time limit, plus AI-assisted grading and instant explanations.'],
    ],
    mistakes: 'Mistake book & revision sheet',
    mistakePoints: [
      ['Auto-collected', 'Wrong answers from "Quiz me" are saved to the mistake book automatically — no manual bookmarking.'],
      ['Mastery overview', 'Weak topics, error patterns and trend, plus an AI review summary.'],
      ['Layout & A4 print', 'Sections by topic, continuous numbering, suggested time limit; include answers and explanations on their own page at the end; formula options switch to one column.'],
      ['Export & save', 'Mistake book → filter by subject / topic → "Export paper" → choose order and working space → "Preview" to check the A4 layout → "Print now", or choose "Save as PDF" in the system print dialog.'],
    ],
    termsTitle: 'Terms & disclaimer',
    terms: [
      { title: 'Service nature and fees', body: 'This site is a pure front-end static page that only provides the chat UI — no AI model service, no fees. You register and manage the API of your chosen provider yourself; fees are settled with that provider.' },
      { title: 'Data and privacy', body: 'Your API key stays only in your browser\'s local storage. This site has no backend — it never collects, stores or relays keys or conversations. Chat data goes straight from your browser to your chosen provider. Keep your key safe.' },
      { title: 'Learning aid only', body: 'This assistant is limited to junior-high math (PEP), physics (Su-Ke) and chemistry (PEP) learning aid. AI output may be inaccurate — for reference; always defer to the textbook and your teacher. Minors should configure and use it under a guardian\'s guidance.' },
      { title: 'Compliance and liability', body: 'Use this tool lawfully; never generate or spread unlawful content. Connection issues caused by network or provider CORS restrictions are outside this site\'s control. Responsibility lies with you and your chosen provider.' },
    ],
    privacy: 'Feedback and privacy',
    privacyText: 'Experiment and project feedback is sent to the developer; while offline or on network errors it is queued in this browser and sent automatically when back online.',
  },
};

/**
 * 将首段按句末标点（。；）拆分为多个渲染节点，用于消解整块压迫感。
 * 仅拆节点、不动字符：`splitSentences(x).join('') === x` 恒成立（句末标点归入前一句）。
 * 说明页已改为结构化要点，本函数保留给需要分句流式排版的页面与回归测试。
 */
export function splitSentences(text: string): string[] {
  return text.match(/[^。；]*[。；]|[^。；]+$/g) ?? [text];
}

export default function GuidePage() {
  const { lang } = useApp();
  usePageMeta({ title: `${lang === 'zh' ? '使用说明' : 'Guide'} - ${lang === 'zh' ? '数理化数字实验室' : 'STEM Digital Lab'}` });
  const c = copy[lang];
  return (
    <main className="grow shrink-0 my-[var(--sp-block)] px-2 sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
      <BackLink to="/">{c.backHome}</BackLink>
      <div className="mb-8">
        <h1 className="t-h1 font-bold serif-font text-[var(--fg)] mb-4">{c.title}</h1>
        <p className="text-sm serif-font leading-relaxed text-[var(--muted)] w-full">{c.intro}</p>
      </div>

      {/* 项目介绍视频：先看总览再读细节；preload="none" 不拖慢首屏 */}
      {/* ?v= 为内容哈希：该文件由 EdgeOne 以 immutable + 1 年缓存发出，同名路径替换后
          回访者的浏览器不会回源，会长期看到旧片；改了查询串即换缓存键。
          路径本身保持不变——public/qr-intro-video.png 二维码编码的就是
          https://stem.irky.dev/videos/stem-intro.mp4，改名会让二维码失效。 */}
      {/* 外层锁 16:9：比例由容器决定，不再等媒体元数据 —— 否则未加载时浏览器按 UA 默认
          300×150（2:1）排布，元数据到位后回跳（实测桌面 41px / 移动端 19px 的布局抖动）。
          封面（poster）同时给出视觉锚点，离线/未点播时不再是一块黑方块。 */}
      {/* figure 展台：外层留白 8px + 双层阴影 + 圆角外框，让视频像放在台面上的仪器，
          与下方卡片同宽（max-w-5xl），消除「上半屏窄、下半屏宽」的流线跳跃。 */}
      <figure className="mb-10 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-22px_rgba(0,0,0,0.28)]">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[var(--bg)]">
        <video
          controls
          preload="none"
          playsInline
          poster="/videos/stem-intro-poster.webp?v=1"
          className="h-full w-full object-cover"
        >
          <source src="/videos/stem-intro.mp4?v=62b8afe7" type="video/mp4" />
        </video>
        </div>
      </figure>

      {/* 视频下方三层结构：双栏等高 → 全宽操作分组 → AI 与错题闭环（含紧凑免责）→ 单行页脚。
          外层栅格默认拉伸，左右两卡同高；矮卡内部用 mt-auto 把补充说明推到底部，避免空白塌陷。 */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4 md:p-5">
          <h2 className="text-xs font-bold tracking-widest uppercase mono-font mb-4">// {c.flow}</h2>
          <ol className="space-y-2">{c.steps.map((step, i) => <li key={step} className="flex gap-3 text-sm serif-font"><span className="mono-font text-[var(--muted)]">0{i + 1}</span><span>{step}</span></li>)}</ol>
          {/* 教师建议并入左卡下半部：浅底内嵌框，mt-auto 让它在等高栅格里贴底，左卡不再空半屏。 */}
          <div className="mt-5 rounded-md border border-[var(--border)] bg-[var(--accent-light)] p-3 md:mt-auto">
            <h3 className="text-xs font-bold mono-font text-[var(--fg)] mb-1.5">{c.teaching}</h3>
            <p className="text-xs serif-font leading-relaxed text-[var(--muted)]">{c.teachingText}</p>
          </div>
        </section>
        <section className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4 md:p-5">
          <h2 className="text-xs font-bold tracking-widest uppercase mono-font mb-4">// {c.inquiry}</h2>
          <div className="space-y-3">{c.acts.map(([title, text]) => <div key={title}><h3 className="text-sm font-semibold serif-font">{title}</h3><p className="text-xs leading-relaxed text-[var(--muted)]">{text}</p></div>)}</div>
          {/* 工具页例外：左侧细竖线提示框，mt-auto 与左卡的教师建议底边对齐。 */}
          <div className="mt-5 border-l-2 border-[var(--border)] py-1 pl-3 md:mt-auto">
            <p className="text-xs font-bold mono-font text-[var(--fg)]">{c.exceptionTitle}</p>
            <p className="mt-1 text-xs serif-font leading-relaxed text-[var(--muted)]">{c.exceptionText}</p>
          </div>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4 md:col-span-2 md:p-5">
          <h2 className="text-xs font-bold tracking-widest uppercase mono-font mb-4">// {c.operations}</h2>
          {/* 三列按场景分组：控件 / 电学 / 化学与三维；条目统一「加粗词条在上、说明在下」，降低视觉噪点。 */}
          <div className="grid gap-6 md:grid-cols-3">
            {c.opGroups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-3 text-xs font-bold mono-font tracking-wide text-[var(--muted)]">{group.title}</h3>
                <dl className="space-y-3">
                  {group.items.map(([term, desc]) => (
                    <div key={term}>
                      <dt className="text-sm font-semibold serif-font text-[var(--fg)]">{term}</dt>
                      <dd className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{desc}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4 md:col-span-2 md:p-5">
          {/* 上半部：AI 助手与错题本双栏并列，考一考 → 错题本形成闭环。 */}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase mono-font mb-3">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                {c.ai}
              </h2>
              <dl className="space-y-3">
                {c.aiPoints.map(([term, desc]) => (
                  <div key={term}>
                    <dt className="text-sm font-semibold serif-font text-[var(--fg)]">{term}</dt>
                    <dd className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{desc}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h2 className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase mono-font mb-3">
                <NotebookPen className="w-3.5 h-3.5" aria-hidden="true" />
                {c.mistakes}
              </h2>
              <dl className="space-y-3">
                {c.mistakePoints.map(([term, desc]) => (
                  <div key={term}>
                    <dt className="text-sm font-semibold serif-font text-[var(--fg)]">{term}</dt>
                    <dd className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{desc}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          {/* 下半部：免责声明压成卡底紧凑小字区，顶部分隔线收束；4 条合规信息逐字保留。 */}
          <div className="mt-5 border-t border-[var(--border)] pt-3">
            <p className="text-xs font-bold mono-font text-[var(--fg)] mb-2">{c.termsTitle}</p>
            <ul className="space-y-1.5">
              {c.terms.map((t) => (
                <li key={t.title} className="text-xs leading-snug text-[var(--muted)] serif-font">
                  <strong className="font-semibold text-[var(--fg)]">{t.title}{lang === 'zh' ? '：' : ': '}</strong>{t.body}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 反馈与隐私：单行轻量页脚，顶部导语不再重复离线补发说明。 */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-4 py-3 md:col-span-2">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-baseline md:gap-4">
            {/* 标题不用 flex：flex 容器的基线取自首个子项（图标底边），
                items-baseline 会把标题整体顶高；改为行内图标，基线回到文字本身。 */}
            <h2 className="shrink-0 text-xs font-bold tracking-widest uppercase mono-font">
              <MessageSquare className="mr-2 inline-block h-3.5 w-3.5 align-[-0.125em]" aria-hidden="true" />
              {c.privacy}
            </h2>
            <p className="min-w-0 flex-1 text-sm serif-font leading-relaxed text-[var(--muted)]">{c.privacyText}</p>
          </div>
        </section>
      </div>
      </div>
    </main>
  );
}
