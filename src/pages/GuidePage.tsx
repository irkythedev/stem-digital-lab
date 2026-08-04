/** 使用说明：课堂与个人探究的简明操作指南。 */
import { useApp } from '../lib/app-context';

const copy = {
  zh: {
    title: '使用说明',
    intro: '这是一个本地运行的初中 STEM 数字探究空间，不需要登录，反馈也只保存在当前设备。',
    flow: '基本流程',
    steps: ['选择学科', '选择实验', '预测 → 探索 → 结论'],
    inquiry: '三幕式探究',
    acts: [
      ['预测', '先根据已有知识形成自己的猜想，不急着看答案。'],
      ['探索', '拖动滑块、操作开关或拖拽图形，观察参数变化带来的结果，并记录证据。'],
      ['结论', '根据观察完成结论题，再查看正误反馈与考点速记。'],
    ],
    controls: '常见操作',
    controlsList: ['滑块：改变实验变量', '圆周上的点：拖动观察几何关系', '电路开关：点击改变通断状态', '表笔：拖到合法测量位置', '记一条观察：保存当前参数与现象'],
    teaching: '教师演示建议',
    teachingText: '先让学生独立预测，再邀请学生描述证据，最后共同完成结论。可以随时返回任意幕，不设硬性步骤锁。',
    privacy: '本地与隐私',
    privacyText: '实验反馈和项目反馈仅保存在当前浏览器的 localStorage，不上传、不需要账号。',
  },
  en: {
    title: 'How to use',
    intro: 'A local middle-school STEM exploration space. No login is needed; feedback stays on this device.',
    flow: 'Basic flow',
    steps: ['Choose a subject', 'Choose an experiment', 'Predict → Explore → Conclude'],
    inquiry: 'Three-act inquiry',
    acts: [
      ['Predict', 'Make a guess from what you already know before looking at the result.'],
      ['Explore', 'Adjust sliders, switches, or draggable points. Observe changes and record evidence.'],
      ['Conclude', 'Answer the conclusion questions, then check feedback and key points.'],
    ],
    controls: 'Common controls',
    controlsList: ['Slider: change an experimental variable', 'Points on a circle: drag to explore geometry', 'Circuit switch: click to open or close', 'Meter probe: drag to a legal measurement point', 'Note it: save current parameters and observations'],
    teaching: 'Teaching suggestion',
    teachingText: 'Let students predict independently, invite them to describe evidence, then complete the conclusion together. Any act can be revisited; there are no hard locks.',
    privacy: 'Local and private',
    privacyText: 'Experiment and project feedback are stored only in this browser’s localStorage. Nothing is uploaded and no account is required.',
  },
};

export default function GuidePage() {
  const { lang } = useApp();
  const c = copy[lang];
  return (
    <main className="flex-1 my-10 px-2 sm:px-6">
      <div className="mb-10 max-w-2xl">
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
      </div>
    </main>
  );
}
