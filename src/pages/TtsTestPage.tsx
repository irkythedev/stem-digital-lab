/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * TTS 公式朗读测试页（/tts-test）：
 * 验证 LaTeX → 口语转换 + edge-tts 真实合成是否准确。
 * 每行：KaTeX 渲染的公式 | 转换后的朗读文本 | 播放按钮。
 * 转换用线上同一份 latexToSpeech，播放走真实 TTS 端点。
 */
import { useEffect, useState } from 'react';
import Formula from '../components/ui/Formula';
import { latexToSpeech } from '../lib/latex-speech';
import { TTS_CONFIG } from '../lib/tts-config';
import { scfUrlWithToken } from '../lib/scf-token';

interface TtsCase {
  /** LaTeX 源码（不含包裹符） */
  tex: string;
  /** 场景标注 */
  label: string;
}

interface TtsGroup {
  /** 分组标题（学科/类别） */
  label: string;
  cases: TtsCase[];
}

const GROUPS: TtsGroup[] = [
  {
    label: '数学：函数与代数',
    cases: [
      { tex: 'y=ax^2+bx+c', label: '二次函数一般式' },
      { tex: 'y=x^3-2x+1', label: '三次函数' },
      { tex: '\\frac{1}{2}', label: '二分之一' },
      { tex: '\\frac{a+b}{c-d}', label: '分式（含运算）' },
      { tex: '\\sqrt{a^2+b^2}', label: '勾股定理' },
      { tex: '\\sqrt[3]{27}', label: '三次根号' },
      { tex: 'x_1+x_2=-\\frac{b}{a}', label: '韦达定理（下标）' },
      { tex: '\\Delta=b^2-4ac', label: '判别式（希腊字母）' },
      { tex: '\\pi \\approx 3.14', label: '圆周率近似' },
      { tex: '\\frac{1}{2}mv^2', label: '动能公式' },
      { tex: '-b', label: '负号（-b）' },
      { tex: 'a-b', label: '减号（a-b）' },
      { tex: 'a=-b', label: '负号（a=-b）' },
    ],
  },
  {
    label: '物理：公式',
    cases: [
      { tex: 'v=\\frac{s}{t}', label: '速度公式' },
      { tex: '\\rho=\\frac{m}{V}', label: '密度公式（ρ）' },
      { tex: 'F=ma', label: '牛顿第二定律' },
      { tex: 'G=mg', label: '重力公式' },
      { tex: 'P=UI', label: '电功率' },
      { tex: 'W=Fs', label: '功' },
      { tex: 'E=mc^2', label: '质能方程' },
      { tex: 'I=\\frac{U}{R}', label: '欧姆定律' },
      { tex: '30°C', label: '摄氏度 °C' },
      { tex: 'θ=30°', label: '角度 θ' },
    ],
  },
  {
    label: '化学：化合物名称',
    cases: [
      { tex: 'H_2O', label: '水' },
      { tex: 'CO_2', label: '二氧化碳' },
      { tex: 'NaOH', label: '氢氧化钠' },
      { tex: 'NaCl', label: '氯化钠' },
      { tex: 'H_2SO_4', label: '硫酸' },
      { tex: 'CaCO_3', label: '碳酸钙' },
      { tex: 'KMnO_4', label: '高锰酸钾' },
      { tex: '2H_2+O_2', label: '反应式（系数+下标）' },
    ],
  },
  {
    label: '边界：非化学式下标',
    cases: [
      { tex: 'x_1', label: '数学下标（不应误判为化学式）' },
      { tex: 'a_{12}', label: '复合下标' },
    ],
  },
  {
    label: '绝对值（v1.23）',
    cases: [
      { tex: '|k|', label: '绝对值 |k|' },
      { tex: '|x-2|', label: '绝对值（含减法）' },
      { tex: '|-3|', label: '绝对值（负数）' },
      { tex: '\\left| k \\right|', label: '绝对值（left/right）' },
      { tex: '\\lvert k \\rvert', label: '绝对值（lvert/rvert）' },
      { tex: '\\vert k \\vert', label: '绝对值（vert）' },
      { tex: '|x| < 3', label: '绝对值不等式' },
      { tex: '|x-2|<3', label: '绝对值+小于' },
      { tex: 'y=|k|x+b', label: '绝对值与变量相邻' },
    ],
  },
  {
    label: '裸 Unicode 符号（v1.23）',
    cases: [
      { tex: 'x<3', label: '小于（裸 <）' },
      { tex: 'x>3', label: '大于（裸 >）' },
      { tex: 'a≤b', label: '小于等于（裸 ≤）' },
      { tex: 'a≥b', label: '大于等于（裸 ≥）' },
      { tex: 'a≠b', label: '不等于（裸 ≠）' },
      { tex: 'x≈3', label: '约等于（裸 ≈）' },
      { tex: 'x±1', label: '正负（裸 ±）' },
      { tex: '2×3', label: '乘以（裸 ×）' },
      { tex: '6÷2', label: '除以（裸 ÷）' },
      { tex: 'a·b', label: '点乘（裸 ·）' },
      { tex: 'πr²', label: '裸 π 与上标²' },
      { tex: '\\{ x \\mid x>0 \\}', label: '集合（mid=满足）' },
    ],
  },
];

/** 扁平化（模块级，播放用全局索引，与渲染顺序一致） */
const FLAT: TtsCase[] = GROUPS.flatMap((g) => g.cases);

type PlayState = 'idle' | 'loading' | 'playing' | 'error';

export default function TtsTestPage() {
  // 测试页固定用中文朗读，直接使用生产 TTS 端点（需有外网访问）
  const TEST_TTS_URL = TTS_CONFIG.PRODUCTION_URL;
  const TEST_VOICE = 'zh-CN-XiaoxiaoNeural';
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [errMsg, setErrMsg] = useState('');

  // 测试页不弹欢迎窗（本地标记已看过）
  useEffect(() => {
    try {
      window.localStorage.setItem('stem-welcome-seen', '1');
    } catch {
      /* 隐私模式忽略 */
    }
  }, []);

  const play = async (idx: number) => {
    const c = FLAT[idx];
    const spoken = latexToSpeech(c.tex, 'zh');
    setPlayingIdx(idx);
    setPlayState('loading');
    setErrMsg('');
    try {
      // 先拼完整 query（text/voice），再用 scfUrlWithToken 把 token 用 & 挂上
      // （避免 TEST_TTS_URL 已带 ?token= 再拼 ?text= 产生双问号 → SCF 校验失败 403）
      const resp = await fetch(
        scfUrlWithToken(`${TEST_TTS_URL}?text=${encodeURIComponent(spoken)}&voice=${encodeURIComponent(TEST_VOICE)}`),
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = await resp.arrayBuffer();
      const view = new Uint8Array(raw, 0, Math.min(raw.byteLength, 4));
      let blob: Blob;
      if (view.length >= 2 && (view[0] & 0xff) === 0xff && (view[1] & 0xe0) === 0xe0) {
        // 裸 MP3
        blob = new Blob([raw], { type: 'audio/mpeg' });
      } else {
        // base64 文本（SCF 代理格式）
        const text = new TextDecoder().decode(raw);
        const binary = atob(text.replace(/\s/g, ''));
        const bytes = new Uint8Array(binary.length);
        for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
        blob = new Blob([bytes], { type: 'audio/mpeg' });
      }
      const objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      setPlayState('playing');
      audio.onended = () => {
        URL.revokeObjectURL(objectUrl);
        setPlayState('idle');
        setPlayingIdx(null);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setPlayState('error');
        setErrMsg('播放失败');
      };
      void audio.play();
    } catch (e) {
      setPlayState('error');
      setErrMsg(e instanceof Error ? e.message : String(e));
    }
  };

  // 扁平全局索引：遍历分组累计偏移
  let flatIdx = 0;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-lg font-bold mb-1">TTS 公式朗读测试</h1>
      <p className="text-xs text-[var(--muted)] mb-4">
        验证 LaTeX → 口语转换 与 edge-tts 合成准确性。点击每行播放按钮试听。
        当前语言：中文 · 语音：{TEST_VOICE} · 共 {FLAT.length} 条
      </p>

      {GROUPS.map((g) => (
        <section key={g.label} className="mb-4">
          <h2 className="text-xs font-bold tracking-widest mono-font text-[var(--fg)] mb-1.5 border-b border-[var(--border)] pb-1 flex items-center gap-1.5">
            <span className="w-1 h-3 bg-[var(--accent)]" aria-hidden="true" />
            {g.label}
            <span className="text-[0.625rem] font-normal text-[var(--muted)]">({g.cases.length})</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {g.cases.map((c) => {
              const idx = flatIdx++;
              const spoken = latexToSpeech(c.tex, 'zh');
              const isPlaying = playingIdx === idx;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-2 py-1.5 border border-[var(--border)] rounded-md min-w-0"
                >
                  <button
                    type="button"
                    onClick={() => void play(idx)}
                    disabled={playState === 'loading' && isPlaying}
                    className="shrink-0 w-7 h-7 rounded-full border border-[var(--fg)] flex items-center justify-center text-[var(--fg)] hover:bg-[var(--accent-light)] disabled:opacity-50 transition-colors"
                    aria-label={`播放 ${c.label}`}
                  >
                    {isPlaying && playState === 'loading' ? (
                      <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-[var(--fg)] border-t-transparent rounded-full" />
                    ) : isPlaying && playState === 'playing' ? (
                      <span className="text-[9px]">●</span>
                    ) : (
                      <span className="text-xs">▶</span>
                    )}
                  </button>

                  <div className="flex-1 min-w-0 leading-tight">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-[var(--muted)] shrink-0">{c.label}</span>
                      <span className="text-xs text-[var(--fg)] whitespace-nowrap overflow-hidden">
                        <Formula tex={c.tex} />
                      </span>
                    </div>
                    <div className="text-xs text-[var(--fg)] break-words">{spoken}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {playState === 'error' && (
        <div className="mt-4 p-3 border border-[var(--error)] rounded-lg text-sm text-[var(--error)]">
          播放失败：{errMsg}
        </div>
      )}
    </div>
  );
}
