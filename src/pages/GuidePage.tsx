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
    aiIntro: '顶栏「AI 学习助手」入口可辅助解释数理化知识。您需自带 AI 服务商（仅限大陆可用）的 API Key，本站不提供、不代购、不收取任何费用。',
    aiTermsTitle: '使用须知与免责',
    aiTerms: [
      '本站仅提供对话界面，不提供 AI 大模型服务，不收取任何相关费用。',
      '您自行注册、购买并管理所选 AI 服务商的 API 服务，费用由您与该服务商结算。',
      'API Key 仅保存在您自己的浏览器本地，本站不采集、不存储、不中转。',
      '对话内容由浏览器直接发送至所选 AI 服务商，其处理遵循该服务商的隐私政策与服务条款；本站无后端，不存储、不记录任何对话内容。',
      'AI 助手仅用于初中数学（人教版）、物理（苏科版）、化学（人教版）学习辅助，不回答学习以外的内容；生成内容仅供参考，可能出错，请以教材和老师讲解为准。',
      '相关权责由您与所选 AI 服务商自行承担，与本站无关；请合理合法使用，未成年人请在老师或家长指导下使用。',
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
    aiIntro: 'The AI assistant (header entry) helps explain math / physics / chemistry. You bring your own API key from a mainland-China provider; this site provides no key, sells nothing and charges nothing.',
    aiTermsTitle: 'Terms & disclaimer',
    aiTerms: [
      'This site only provides the chat UI — no AI model service and no fees.',
      'You register, purchase and manage the API of your chosen provider yourself.',
      'Your API key stays in your browser only; this site never collects, stores or relays it.',
      'Chats go directly from your browser to your chosen provider under that provider\'s policies; this site has no backend and stores or logs nothing.',
      'The assistant is limited to junior-high math (PEP), physics (Su-Ke) and chemistry (PEP) learning aid; generated content is for reference and may be wrong — trust the textbook and your teacher.',
      'All responsibility lies with you and your chosen provider; use it lawfully, and minors should use it under teacher or parent guidance.',
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
                {t}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
