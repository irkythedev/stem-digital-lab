/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 通用占位区块：等宽字体 + 闪烁光标，用于“建设中”提示。
 */
import { useApp } from '../../lib/app-context';

interface UnderConstructionProps {
  label?: string;
  message?: string;
}

export default function UnderConstruction({ label, message }: UnderConstructionProps) {
  const { t } = useApp();
  return (
    <div className="flex flex-col items-start space-y-2 border-l-2 border-[var(--fg)] pl-4">
      <div className="flex items-center text-xs text-[var(--fg)] mono-font font-bold">
        <span className="tracking-widest">{label ?? t.statusTag}</span>
        <span className="inline-block w-2 h-3.5 bg-[var(--fg)] ml-1 animate-pulse" />
      </div>
      <p className="text-[0.6875rem] text-[var(--muted)] mono-font max-w-md">{message ?? t.curriculumNotice}</p>
    </div>
  );
}
