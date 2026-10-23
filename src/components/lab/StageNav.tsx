/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 三幕式探究步骤条（Predict → Explore → Conclude）
 * iOS Segmented Control 风格胶囊组件：浅底托 + 激活白卡微投影 + 触控安全。
 */

import { Check, RotateCcw } from 'lucide-react';

export type Stage = 'predict' | 'explore' | 'conclude';

interface StageNavProps {
  stage: Stage;
  setStage: (stage: Stage) => void;
  stageOrder?: Stage[];
  labels: {
    predict: string;
    explore: string;
    conclude: string;
    /**
     * 下一步文案：**必填**。
     * 此处原是可选，兜底 `'Next →'`，于是 4 个实验漏传后中文页直接显示英文
     * （Circle / Lens / Pressure / Buoyancy）。文案兜底是静默失败——它不会报错，
     * 只会让用户看到一串英文。改成必填后漏传在 `tsc --noEmit` 阶段就挂掉。
     */
    next: string;
    redo?: string;
  };
  onNext?: () => void;
  onRedo?: () => void;
  isDone?: {
    predict?: boolean;
    explore?: boolean;
    conclude?: boolean;
  };
  className?: string;
}

export default function StageNav({
  stage,
  setStage,
  stageOrder = ['predict', 'explore', 'conclude'],
  labels,
  onNext,
  onRedo,
  isDone,
  className = '',
}: StageNavProps) {
  const stageIdx = stageOrder.indexOf(stage);

  const getLabel = (s: Stage) => {
    switch (s) {
      case 'predict':
        return labels.predict;
      case 'explore':
        return labels.explore;
      case 'conclude':
        return labels.conclude;
    }
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else if (stageIdx < stageOrder.length - 1) {
      setStage(stageOrder[stageIdx + 1]);
    }
  };

  return (
    /**
     * 单行确定性布局（<640 也是单行，不靠 flex-wrap 自己挤）。
     *
     * 两条约束同时成立：
     *  1) 中英都必须塞进一行——英文轨（Predict/Explore/Conclude）在 12px + px-3.5 下
     *     需要 274px，加 Next 81 + gap 10 = 365 > 390 视口的 342 → 于是移动端把轨降到
     *     11px、按钮 px-2、轨内 gap-0.5，Next px-2.5：实测 en 总宽 302 / zh 221.5，
     *     360 / 375 / 390 / 430 四档全部单行（桌面 sm: 起恢复 12px 与宽 padding）。
     *  2) 两段盒高相同——轨道是 p-1 + 1px 边框包着 40px 按钮 = 50px；右段套一层同样的
     *     p-1 + 透明 1px 边框信封，于是也是 50px（桌面同为 44px）。此前轨 50 / 按钮 40，
     *     并排时右段上下各余 5px，视觉上比胶囊矮一截。
     *
     * <360px（iPhone SE 一代那档）才退回竖排：那里 3 个英文按钮 + Next 物理上放不下，
     * 与其让浏览器随机折行，不如显式声明成两段。
     */
    <div className={`flex flex-nowrap items-center gap-2 text-[0.6875rem] mono-font tracking-wider sm:gap-2.5 sm:text-xs 2xl:text-sm max-[359px]:flex-col max-[359px]:items-stretch ${className}`}>
      {/* iOS Segmented 胶囊外壳 */}
      <div className="stage-rail inline-flex w-fit shrink-0 items-center gap-0.5 rounded-xl bg-[var(--accent-light)] border border-[var(--border)]/70 p-0.5 shadow-xs sm:gap-1 sm:p-1">
        {stageOrder.map((s) => {
          const active = stage === s;
          const done = isDone ? isDone[s] : false;
          const text = getLabel(s);

          return (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              className={`min-h-[28px] px-2 py-1 tap-area rounded-lg font-medium sm:min-h-[34px] transition-all duration-[var(--dur-fast)] touch-manipulation select-none whitespace-nowrap sm:px-3.5 ${
                active
                  ? 'bg-[var(--card-bg)] text-[var(--fg)] shadow-xs font-semibold'
                  : done
                  ? 'text-[var(--fg)] hover:text-[var(--fg)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {done && !active && (
                <Check className="inline-block w-3.5 h-3.5 align-middle mr-1" aria-hidden />
              )}
              {text}
            </button>
          );
        })}
      </div>

      {/* 右侧动作簇：<360 独占一行、居右；其余档位与阶段轨同排、靠右。
          外层给与胶囊轨**相同的信封**（p-1 + 1px 边框，边框透明不显示）：
          触屏 40+8+2 = 50 = 轨道 50；桌面 34+8+2 = 44 = 轨道 44。
          此前轨 50 / 按钮 40，外沿上下各差 5px——两段并排时右段的上下留白明显偏小。 */}
      <div className="stage-act ml-auto flex shrink-0 items-center gap-2 rounded-xl border border-transparent p-0.5 sm:gap-2.5 sm:p-1 max-[359px]:ml-0 max-[359px]:w-full max-[359px]:justify-end">
        {stageIdx < stageOrder.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="min-h-[28px] px-2.5 py-1 tap-area border border-[var(--fg)] sm:min-h-[34px] bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 transition-all rounded-lg font-medium touch-manipulation select-none active:scale-95 shadow-xs whitespace-nowrap sm:px-4 sm:py-1.5"
          >
            {labels.next}
          </button>
        ) : onRedo ? (
          <button
            type="button"
            onClick={onRedo}
            className="group inline-flex items-center gap-1.5 min-h-[28px] px-2.5 py-1 tap-area sm:min-h-[34px] border border-[var(--border)]/80 text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] transition-all rounded-lg touch-manipulation select-none active:scale-95 whitespace-nowrap sm:px-3.5 sm:py-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 opacity-70 group-hover:rotate-[-45deg] transition-transform duration-[var(--dur-base)]" />
            <span>{labels.redo || 'Redo'}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
