/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 通用实验详情页骨架。
 * 依据路由参数 /lab/:labId 从实验注册表读取实验并渲染其组件；
 * 未注册 / 未知的 labId 渲染建设中占位。
 */
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../lib/app-context';
import { labMap } from '../lib/labs';
import { subjects } from '../lib/subjects';
import UnderConstruction from '../components/ui/UnderConstruction';

export default function LabPage() {
  const { labId } = useParams<{ labId: string }>();
  const { t, lang } = useApp();

  const lab = labId ? labMap[labId] : undefined;

  if (!lab) {
    return (
      <main className="flex-1 flex flex-col my-16 px-2 sm:px-6">
        <div className="mb-8">
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)] mono-font">
            / lab / {labId ?? 'unknown'}
          </span>
          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight serif-font mt-2 mb-2 text-[var(--fg)]">
            {t.underConstruction}
          </h1>
          <p className="text-sm text-[var(--muted)] serif-font italic">{t.labUnderConstruction}</p>
        </div>

        <UnderConstruction />

        <div className="mt-10">
          <Link to="/" className="text-xs mono-font text-[var(--muted)] underline">
            ← {t.backHome}
          </Link>
        </div>
      </main>
    );
  }

  const Lab = lab.component;

  return (
    <main className="flex-1 flex flex-col my-10 px-2 sm:px-6">
      <Link
        to="/"
        className="text-xs mono-font text-[var(--muted)] underline hover:text-[var(--fg)]"
      >
        ← {t.backHome}
      </Link>

      <div className="mt-5 mb-8">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 shrink-0 flex items-center justify-center text-[var(--fg)]">
            <lab.icon className="w-10 h-10" />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight serif-font text-[var(--fg)]">
              {lab.name[lang]}
            </h1>
            <span className="text-[11px] mt-1 uppercase tracking-widest text-[var(--muted)] mono-font">
              {lang === 'zh' ? subjects[lab.subjectId].gradeZh : subjects[lab.subjectId].gradeEn}
            </span>
          </div>
        </div>
      </div>

      <p className="mb-5 text-xs serif-font italic text-[var(--muted)]">{lang === 'zh' ? '建议流程：先预测，再自由探索，最后完成结论。你可以随时返回任意阶段。' : 'Suggested flow: predict, explore freely, then conclude. You can revisit any stage at any time.'}</p>
      <Lab />
    </main>
  );
}
