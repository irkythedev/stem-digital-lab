/** 使用说明：课堂与个人探究的简明操作指南。 */
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app-context';

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
    controlsList: ['滑块：改变实验变量', '圆周上的点：拖动观察几何关系', '电路开关：点击改变通断状态', '表笔：拖到合法测量位置', '记一条观察：保存当前参数与现象', '元素周期表：点元素查看详情与实物照片，点喇叭听读音', '原子结构图：点击电子层查看该层电子数'],
    teaching: '教师演示建议',
    teachingText: '先让学生独立预测，再邀请学生描述证据，最后共同完成结论。可以随时返回任意幕，不设硬性步骤锁。',
    privacy: '反馈与隐私',
    privacyText: '实验反馈和项目反馈会发送给开发者；离线或网络异常时自动暂存在当前浏览器，联网后补发。无需登录账号。',
    ai: 'AI 学习助手',
    aiIntro: '顶栏「AI 学习助手」入口可辅助解释数理化知识。您需自行配置 AI 服务商（支持 DeepSeek、通义千问、Kimi、智谱 GLM、豆包等）的 API Key，本站不提供、不代购、不收取任何费用。',
    aiTermsTitle: '使用须知与免责',
    aiTerms: [
      { title: '服务性质与费用', body: '本站为纯前端静态页面，仅提供对话界面，不提供任何 AI 大模型服务，也不收取任何费用。您需自行注册并管理所选 AI 服务商的 API，相关费用由您与服务商结算。' },
      { title: '数据与隐私安全', body: '您的 API Key 仅保存在您本机浏览器的本地存储中。本站无后端服务器，不采集、不存储、不中转任何密钥或对话内容。对话数据由您的浏览器直接发送至您所选的服务商。请妥善保管您的 API Key，防范泄露风险。' },
      { title: '学习辅助声明', body: '本 AI 助手专为初中数学（人教版）、物理（苏科版）、化学（人教版）学习辅助设计。AI 生成的内容存在不准确的可能，仅供参考，请务必以学校教材和任课老师的讲解为准。未成年人请在监护人的指导下配置和使用。' },
      { title: '合规与责任限制', body: '请合法合规使用本工具，严禁用于生成或传播任何违法违规内容。由于网络环境或服务商跨域（CORS）限制导致的连接问题，本站无法干预。因使用本工具及所选 AI 服务产生的相关权责，由您与服务商自行承担。' },
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
    controlsList: ['Slider: change an experimental variable', 'Points on a circle: drag to explore geometry', 'Circuit switch: click to open or close', 'Meter probe: drag to a legal measurement point', 'Note it: save current parameters and observations', 'Periodic table: tap an element for details and photo, tap the speaker to hear its name', 'Bohr diagram: tap a shell to see its electron count'],
    teaching: 'Teaching suggestion',
    teachingText: 'Let students predict independently, invite them to describe evidence, then complete the conclusion together. Any act can be revisited; there are no hard locks.',
    privacy: 'Feedback and privacy',
    privacyText: 'Experiment and project feedback is sent to the developer; while offline or on network errors it is queued in this browser and sent automatically when back online. No account is required.',
    ai: 'AI Assistant',
    aiIntro: 'The AI assistant (header entry) helps explain math / physics / chemistry. You configure your own API key (DeepSeek, Qwen, Kimi, Zhipu GLM, Doubao and more); this site provides no key, sells nothing and charges nothing.',
    aiTermsTitle: 'Terms & disclaimer',
    aiTerms: [
      { title: 'Service nature and fees', body: 'This site is a pure front-end static page that only provides the chat UI — no AI model service, no fees. You register and manage the API of your chosen provider yourself; fees are settled with that provider.' },
      { title: 'Data and privacy', body: 'Your API key stays only in your browser\'s local storage. This site has no backend — it never collects, stores or relays keys or conversations. Chat data goes straight from your browser to your chosen provider. Keep your key safe.' },
      { title: 'Learning aid only', body: 'This assistant is limited to junior-high math (PEP), physics (Su-Ke) and chemistry (PEP) learning aid. AI output may be inaccurate — for reference; always defer to the textbook and your teacher. Minors should configure and use it under a guardian\'s guidance.' },
      { title: 'Compliance and liability', body: 'Use this tool lawfully; never generate or spread unlawful content. Connection issues caused by network or provider CORS restrictions are outside this site\'s control. Responsibility lies with you and your chosen provider.' },
    ],
  },
};

export default function GuidePage() {
  const { lang } = useApp();
  const c = copy[lang];
  return (
    <main className="flex-1 my-10 px-2 sm:px-6">
      <Link
        to="/"
        className="text-xs mono-font text-[var(--muted)] underline hover:text-[var(--fg)]"
      >
        ← {c.backHome}
      </Link>
      <div className="mb-10 mt-5 max-w-2xl">
        <h1 className="text-base font-bold tracking-widest uppercase mono-font text-[var(--fg)] mb-4">{c.title}</h1>
        <p className="text-sm serif-font leading-relaxed text-[var(--muted)]">{c.intro}</p>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <section className="border-t border-[var(--border)] pt-4">
          <h2 className="text-xs font-bold tracking-widest uppercase mono-font mb-4">// {c.flow}</h2>
          <ol className="space-y-2">{c.steps.map((step, i) => <li key={step} className="flex gap-3 text-sm serif-font"><span className="mono-font text-[var(--muted)]">0{i + 1}</span><span>{step}</span></li>)}</ol>
        </section>
        <section className="border-t border-[var(--border)] pt-4">
          <h2 className="text-xs font-bold tracking-widest uppercase mono-font mb-4">// {c.inquiry}</h2>
          <div className="space-y-3">{c.acts.map(([title, text]) => <div key={title}><h3 className="text-sm font-semibold serif-font">{title}</h3><p className="text-xs leading-relaxed text-[var(--muted)]">{text}</p></div>)}</div>
        </section>
        <section className="border-t border-[var(--border)] pt-4">
          <h2 className="text-xs font-bold tracking-widest uppercase mono-font mb-4">// {c.controls}</h2>
          <ul className="space-y-2">{c.controlsList.map((item) => <li key={item} className="text-sm serif-font text-[var(--muted)]">{item}</li>)}</ul>
        </section>
        <section className="border-t border-[var(--border)] pt-4">
          <h2 className="text-xs font-bold tracking-widest uppercase mono-font mb-4">// {c.teaching}</h2>
          <p className="text-sm serif-font leading-relaxed text-[var(--muted)]">{c.teachingText}</p>
        </section>
        <section className="border-t border-[var(--border)] pt-4 md:col-span-2">
          <h2 className="text-xs font-bold tracking-widest uppercase mono-font mb-4">// {c.privacy}</h2>
          <p className="text-sm serif-font leading-relaxed text-[var(--muted)]">{c.privacyText}</p>
        </section>
        <section className="border-t border-[var(--border)] pt-4 md:col-span-2">
          <h2 className="text-xs font-bold tracking-widest uppercase mono-font mb-2">// {c.ai}</h2>
          <p className="text-sm serif-font leading-relaxed text-[var(--muted)] mb-3">{c.aiIntro}</p>
          <p className="text-xs font-bold mono-font text-[var(--fg)] mb-1.5">{c.aiTermsTitle}</p>
          <ul className="space-y-1.5">
            {c.aiTerms.map((t, i) => (
              <li key={i} className="text-xs text-[var(--muted)] serif-font leading-relaxed flex gap-2">
                <span className="text-[var(--fg)] mono-font shrink-0">{i + 1}.</span>
                <span>
                  <strong className="font-bold text-[var(--fg)]">{t.title}</strong>
                  {t.body}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
