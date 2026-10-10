/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 使用说明：课堂与个人探究的简明操作指南。
 */
import { Link } from 'react-router-dom';
import { BookOpen, Coins, MessageSquare, NotebookPen, Scale, ShieldCheck, Sparkles } from 'lucide-react';
import { useApp } from '../lib/app-context';
import { usePageMeta } from '../lib/use-page-meta';

const copy = {
  zh: {
    title: '使用说明',
    backHome: '返回',
    intro: '这是一个本地运行的初中 STEM 数字探究空间，不需要登录；反馈会发送给开发者，离线时自动暂存，联网后补发。首页「每日科学」每天展示一位科学家的名言与小故事。',
    flow: '基本流程',
    steps: ['选择学科', '选择实验', '预测 → 探索 → 结论'],
    inquiry: '三幕式探究',
    acts: [
      ['预测', '先根据已有知识形成自己的猜想，不急着看答案。'],
      ['探索', '拖动滑块、操作开关或拖拽图形，观察参数变化带来的结果，并记录证据。'],
      ['结论', '根据观察完成结论题，再查看正误反馈与考点速记。'],
    ],
    controls: '常见操作',
    controlsList: ['滑块：改变实验变量', '圆周上的点：拖动观察几何关系', '电路开关：点击改变通断状态', '表笔：拖到正确的测量点', '记一条观察：保存当前参数与现象', '元素周期表：点元素查看详情与实物照片，点喇叭听读音', '原子结构图：点击电子层查看该层电子数'],
    teaching: '教师演示建议',
    teachingText: '先让学生独立预测，再邀请学生描述证据，最后共同完成结论。每一步都可以随时返回、反复调整，不做顺序限制。',
    privacy: '反馈与隐私',
    privacyText: '实验反馈和项目反馈会发送给开发者；离线或网络异常时自动暂存在当前浏览器，联网后补发。无需登录账号。',
    ai: 'AI 学习助手',
    aiIntro: '顶栏「AI 学习助手」入口可辅助解释数理化知识。您需自行配置 AI 服务商（支持 DeepSeek、通义千问、Kimi、智谱 GLM、豆包等）的 API Key，本站不提供、不代购、不收取任何费用。支持问答历史（仅保存在本机浏览器，可随时清除，支持按科目/知识点筛选），回答末尾会推荐 3 个追问并支持「换一批」；回答可一键朗读，数学公式、化学式按规范读法读出而非逐字符；「考考你」可让 AI 基于当前知识点批量出单选题或填空题（可选题型：单选/填空/混合，支持 AI 辅助判分，可选题量与基础知识/进阶提升/易混淆辨析角度，支持每题限时），作答后即时判分与讲解，错题自动记入错题集；不提供自由输入框。',
    aiTermsTitle: '使用须知与免责',
    aiTerms: [
      { title: '服务性质与费用', body: '本站为纯前端静态页面，仅提供对话界面，不提供任何 AI 大模型服务，也不收取任何费用。您需自行注册并管理所选 AI 服务商的 API，相关费用由您与服务商结算。' },
      { title: '数据与隐私安全', body: '您的 API Key 仅保存在您本机浏览器的本地存储中。本站无后端服务器，不采集、不存储、不中转任何密钥或对话内容。对话数据由您的浏览器直接发送至您所选的服务商。请妥善保管您的 API Key，防范泄露风险。' },
      { title: '学习辅助声明', body: '本 AI 助手专为初中数学（人教版）、物理（苏科版）、化学（人教版）学习辅助设计。AI 生成的内容存在不准确的可能，仅供参考，请务必以学校教材和任课老师的讲解为准。未成年人请在监护人的指导下配置和使用。' },
      { title: '合规与责任限制', body: '请合法合规使用本工具，严禁用于生成或传播任何违法违规内容。由于网络环境或服务商跨域（CORS）限制导致的连接问题，本站无法干预。因使用本工具及所选 AI 服务产生的相关权责，由您与服务商自行承担。' },
    ],
    mistakes: '错题集与复习卷',
    mistakesList: [
      '自动收集：在 AI 面板「考考你」作答后，答错的题自动记入错题集，不需要手动收藏',
      '学情分析：按薄弱知识点、错误类型与趋势汇总，并给出 AI 复习建议',
      '组卷导出：错题集 → 按科目 / 知识点筛选 → 「导出错题卷」→ 选排序方式与演算留白 → 先「预览」核对 A4 版式 → 「直接打印」',
      '卷面排版：按知识点分节、全卷连续编号、标注建议限时；勾选「含答案与解析」后，答案在文末独立起页；含公式的选项自动改为单列，避免长公式被挤压',
      '打印保存：直接连接打印机，或在系统打印窗口中选择「另存为 PDF」导出保存',
    ],
  },
  en: {
    title: 'How to use',
    backHome: 'Back',
    intro: 'A local middle-school STEM exploration space. No login is needed; feedback is sent to the developer, or queued locally while offline and retried when back online. The homepage Daily Science block shares a scientist quote and story each day.',
    flow: 'Basic flow',
    steps: ['Choose a subject', 'Choose an experiment', 'Predict → Explore → Conclude'],
    inquiry: 'Three-act inquiry',
    acts: [
      ['Predict', 'Make a guess from what you already know before looking at the result.'],
      ['Explore', 'Adjust sliders, switches, or draggable points. Observe changes and record evidence.'],
      ['Conclude', 'Answer the conclusion questions, then check feedback and key points.'],
    ],
    controls: 'Common controls',
    controlsList: ['Slider: change an experimental variable', 'Points on a circle: drag to explore geometry', 'Circuit switch: click to open or close', 'Probes: Drag to correct measurement points', 'Note it: save current parameters and observations', 'Periodic table: tap an element for details and photo, tap the speaker to hear its name', 'Bohr diagram: tap a shell to see its electron count'],
    teaching: 'Teaching suggestion',
    teachingText: 'Let students predict independently, invite them to describe evidence, then complete the conclusion together. Any act can be revisited; there are no hard locks.',
    privacy: 'Feedback and privacy',
    privacyText: 'Experiment and project feedback is sent to the developer; while offline or on network errors it is queued in this browser and sent automatically when back online. No account is required.',
    ai: 'AI Assistant',
    aiIntro: 'The AI assistant (header entry) helps explain math / physics / chemistry. You configure your own API key (DeepSeek, Qwen, Kimi, Zhipu GLM, Doubao and more); this site provides no key, sells nothing and charges nothing. Q&A history is stored only in your browser, clearable anytime, filterable by subject or topic; each answer recommends 3 follow-up questions with a "refresh" option; answers can be read aloud at one click, with math formulas and chemical names read in standard spoken form instead of raw characters; "Quiz" lets the AI batch-generate single-choice or fill-in questions from the current topic (pick single-choice / fill-in / mixed, with AI-assisted grading, plus the count and an angle — basic knowledge / advanced / easy-to-confuse concepts — with an optional per-question time limit), scoring each instantly with an explanation and auto-saving mistakes to a mistake collection — there is no free-text input.',
    aiTermsTitle: 'Terms & disclaimer',
    aiTerms: [
      { title: 'Service nature and fees', body: 'This site is a pure front-end static page that only provides the chat UI — no AI model service, no fees. You register and manage the API of your chosen provider yourself; fees are settled with that provider.' },
      { title: 'Data and privacy', body: 'Your API key stays only in your browser\'s local storage. This site has no backend — it never collects, stores or relays keys or conversations. Chat data goes straight from your browser to your chosen provider. Keep your key safe.' },
      { title: 'Learning aid only', body: 'This assistant is limited to junior-high math (PEP), physics (Su-Ke) and chemistry (PEP) learning aid. AI output may be inaccurate — for reference; always defer to the textbook and your teacher. Minors should configure and use it under a guardian\'s guidance.' },
      { title: 'Compliance and liability', body: 'Use this tool lawfully; never generate or spread unlawful content. Connection issues caused by network or provider CORS restrictions are outside this site\'s control. Responsibility lies with you and your chosen provider.' },
    ],
    mistakes: 'Mistake book & revision sheet',
    mistakesList: [
      'How mistakes are collected: after answering in the panel\'s "Quiz me", wrong answers are saved to the mistake book automatically — no manual bookmarking',
      'What the overview shows: weak topics, error patterns and trend, plus an AI review summary',
      'How to export: mistake book → filter by subject / topic → "Export paper" → choose order and working space → "Preview" to check the A4 layout → "Print now"',
      'How the sheet is laid out: sections by topic, continuous numbering across the sheet, a suggested time limit; tick "Include answers and explanations" to place them on their own page at the end; options containing formulas switch to a single column so long formulas are not squeezed',
      'Printing and saving: print straight to a printer, or choose "Save as PDF" in the system print dialog to export a file',
    ],
  },
};

/** AI 条款左侧的语义图标，与条款顺序一一对应。 */
const TERM_ICONS = [Coins, ShieldCheck, BookOpen, Scale];

/**
 * 将 AI 首段按句末标点（。；）拆分为多个渲染节点，用于消解整块压迫感。
 * 仅拆节点、不动字符：`splitSentences(x).join('') === x` 恒成立（句末标点归入前一句）。
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
      <Link
        to="/"
        className="text-xs mono-font text-[var(--muted)] underline hover:text-[var(--fg)]"
      >
        ← {c.backHome}
      </Link>
      <div className="mb-8 mt-5">
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
          <source src="/videos/stem-intro.mp4?v=37fa592c" type="video/mp4" />
        </video>
        </div>
      </figure>

      <div className="grid gap-5 sm:gap-6 md:grid-cols-2 md:items-start">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4">
          <h2 className="text-xs font-bold tracking-widest uppercase mono-font mb-4">// {c.flow}</h2>
          <ol className="space-y-2">{c.steps.map((step, i) => <li key={step} className="flex gap-3 text-sm serif-font"><span className="mono-font text-[var(--muted)]">0{i + 1}</span><span>{step}</span></li>)}</ol>
        </section>
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4">
          <h2 className="text-xs font-bold tracking-widest uppercase mono-font mb-4">// {c.teaching}</h2>
          <p className="text-sm serif-font leading-relaxed text-[var(--muted)]">{c.teachingText}</p>
        </section>
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4">
          <h2 className="text-xs font-bold tracking-widest uppercase mono-font mb-4">// {c.inquiry}</h2>
          <div className="space-y-3">{c.acts.map(([title, text]) => <div key={title}><h3 className="text-sm font-semibold serif-font">{title}</h3><p className="text-xs leading-relaxed text-[var(--muted)]">{text}</p></div>)}</div>
        </section>
        {/* 常见操作：与错题集共用同一套微底胶囊规范（标签剥离分隔冒号，中文短引子同行、英文长引子转下一行）。
            卡片顺序调整为「基本流程 + 教师演示建议」「三幕式探究 + 常见操作」，配合栅格 items-start
            让矮卡随内容收拢，消除卡内底部死白。文案仅表笔一条按裁决微调，其余逐字原样。 */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4">
          <h2 className="text-xs font-bold tracking-widest uppercase mono-font mb-4">// {c.controls}</h2>
          <ul className="space-y-3">
            {c.controlsList.map((item) => {
              const at = item.search(/[：:]/);
              const lead = at > 0 ? item.slice(0, at) : '';
              const rest = at > 0 ? item.slice(at + 1) : item;
              const inline = at > 0 && at <= 8;
              return (
                <li
                  key={item}
                  className={'flex text-sm serif-font leading-relaxed ' + (inline ? 'flex-row items-baseline gap-2.5' : 'flex-col items-start gap-1.5')}
                >
                  {lead && (
                    <span className="shrink-0 rounded border border-[var(--border)]/40 bg-[var(--accent-light)] px-2 py-0.5 text-xs font-medium leading-normal text-[var(--fg)]">{lead}</span>
                  )}
                  <span className="min-w-0 text-[var(--muted)]">{rest}</span>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-5 sm:p-6 md:col-span-2">
          <h2 className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase mono-font mb-2">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            {c.ai}
          </h2>
          {/* 首段：按句末标点分句流式排布，逐句成行以消解整块压迫感（拼接后与原文逐字节一致）。
              不再施加固定行宽：w-full 撑满卡片内容区，与下方条款左右边距垂直对齐，消除右侧断崖式留白。 */}
          <div className="mb-5 w-full">
            {splitSentences(c.aiIntro).map((sentence, si) => (
              <p key={si} className="text-sm serif-font leading-relaxed text-[var(--muted)] mb-1.5 last:mb-0">{sentence}</p>
            ))}
          </div>
          <p className="text-xs font-bold mono-font text-[var(--fg)] mb-3">{c.aiTermsTitle}</p>
          {/* 条款：纯语义图标 + 标题同排垂直居中（不再叠加数字序号），正文置于下方并与标题左缘对齐；
              桌面 2×2 栅格让卡片横向充盈，条目同样不设固定行宽，与首段共享同一内容区边距。 */}
          <ul className="grid gap-x-8 gap-y-4 md:grid-cols-2">
            {c.aiTerms.map((t, i) => {
              const Icon = TERM_ICONS[i] ?? Coins;
              return (
                <li key={i} className="text-xs text-[var(--muted)] serif-font leading-relaxed">
                  <p className="flex items-center gap-2 mb-1.5 text-[var(--fg)]">
                    <Icon className="w-4 h-4 shrink-0 text-[var(--fg)]" aria-hidden="true" />
                    <strong className="font-bold">{t.title}</strong>
                  </p>
                  <p className="pl-6">{t.body}</p>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4 md:col-span-2">
          <h2 className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase mono-font mb-4">
            <NotebookPen className="w-3.5 h-3.5" aria-hidden="true" />
            {c.mistakes}
          </h2>
          {/* 键值化：中文短引子（≤8 字）升级为微底标签并与流程同排；英文长引子退回「标签在上、流程在下」。
              标签只取冒号前的词组，分隔冒号本身不参与渲染 —— 胶囊底色与右侧正文自然分界。
              本卡片通栏承载（md:col-span-2），且步骤在桌面端按「列优先」双列流式排布（1-3 左列 / 4-5 右列）：
              既消除右侧大片死白，也避免单列过长把整行拉高而与相邻卡片产生高度失衡。文案逐字原样输出。 */}
          <ul className="grid gap-x-8 gap-y-3 md:grid-flow-col md:grid-cols-2 md:grid-rows-3">
            {c.mistakesList.map((item) => {
              const at = item.search(/[：:]/);
              const lead = at > 0 ? item.slice(0, at) : '';
              const rest = at > 0 ? item.slice(at + 1) : item;
              const inline = at > 0 && at <= 8;
              return (
                <li
                  key={item}
                  className={'flex text-sm serif-font leading-relaxed ' + (inline ? 'flex-row items-baseline gap-2.5' : 'flex-col items-start gap-1.5')}
                >
                  {lead && (
                    <span className="shrink-0 rounded border border-[var(--border)]/40 bg-[var(--accent-light)] px-2 py-0.5 text-xs font-medium leading-normal text-[var(--fg)]">{lead}</span>
                  )}
                  <span className="min-w-0 text-[var(--muted)]">{rest}</span>
                </li>
              );
            })}
          </ul>
        </section>
        {/* 反馈与隐私：收敛为底部轻量级通栏辅助面板（桌面端标签与正文同排一行），
            高度随内容自适应，不再被等高拉伸撑出内部空洞。 */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-4 py-3 md:col-span-2">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-baseline md:gap-4">
            <h2 className="flex shrink-0 items-center gap-2 text-xs font-bold tracking-widest uppercase mono-font">
              <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
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
