/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学工具页 · 元素周期表
 *
 * 18 列标准周期表（7 周期 + 镧系/锕系独立两行），三色区分
 * 金属 / 非金属 / 稀有气体（类金属单独色系）。
 * 点击元素弹出详情卡：原子序数、符号、中英文名、相对原子质量、周期/族，
 * 并可用浏览器语音（Web Speech API）朗读中文名——免费、免登录、离线可用。
 *
 * 教材依据：ch03「元素周期表简介」——7 个横行 18 个纵列，金属/非金属/稀有气体
 * 用不同颜色区分，标出相对原子质量；元素周期表是学习和研究化学的重要工具。
 */
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play, Square, Volume2 } from 'lucide-react';
import { useApp } from '../lib/app-context';
import ShareInline from '../components/share/ShareInline';
import { ELEMENTS, type ElementInfo } from '../lib/elements';

/** 类别 → 配色（教科书三色区分；类金属用中间色）——浅色背景填充 + 同色系边框 */
const CAT_COLOR: Record<ElementInfo['cat'], { border: string; text: string; bg: string }> = {
  metal: { border: '#C71D23', text: 'var(--fg)', bg: 'rgba(199,29,35,0.08)' },        // 金属：红
  nonmetal: { border: '#2f7d4f', text: 'var(--fg)', bg: 'rgba(47,125,79,0.09)' },     // 非金属：绿
  noble: { border: '#3d6bb3', text: 'var(--fg)', bg: 'rgba(61,107,179,0.10)' },       // 稀有气体：蓝
  metalloid: { border: '#8a6d1f', text: 'var(--fg)', bg: 'rgba(138,109,31,0.10)' },   // 类金属：黄褐
};

/** 类别中文名 */
const CAT_ZH: Record<ElementInfo['cat'], string> = {
  metal: '金属元素',
  nonmetal: '非金属元素',
  noble: '稀有气体',
  metalloid: '类金属',
};

/** 中考必背连读预设（人教版教材）：元素名称与符号是中考必背内容 */
const RECITE_PRESETS: { id: string; zh: string; en: string; ns: number[] }[] = [
  {
    id: 'first20',
    zh: '前 20 号元素',
    en: 'First 20 elements',
    // 氢氦锂铍硼 碳氮氧氟氖 钠镁铝硅磷 硫氯氩钾钙
    ns: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  },
  {
    id: 'activity',
    zh: '金属活动性顺序',
    en: 'Activity series',
    // 钾钙钠镁铝 锌铁锡铅(氢) 铜汞银铂金
    ns: [19, 20, 11, 12, 13, 30, 26, 50, 82, 1, 29, 80, 47, 78, 79],
  },
  {
    id: 'common',
    zh: '常见元素',
    en: 'Common elements',
    // 20 号以后初中常见：锰 铁 铜 锌 银 碘 钡 汞 铅
    ns: [25, 26, 29, 30, 47, 53, 56, 80, 82],
  },
];

/** 跟读间隔选项（毫秒）——播放器设置 */
const GAP_OPTIONS = [1000, 1800, 2600];

export default function PeriodicTable() {
  const { t, lang } = useApp();
  const [selected, setSelected] = useState<ElementInfo | null>(null);
  const [query, setQuery] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [tab, setTab] = useState<'props' | 'story'>('props');
  // 原子结构示意图：当前悬停/点击的电子层（显示该层电子数）
  const [hoveredLayer, setHoveredLayer] = useState<number | null>(null);

  // 中考跟读（播放器）：设置（朗读次数/跟读间隔）+ 播放状态（预设、当前序号、暂停）
  const [reciteSetup, setReciteSetup] = useState<string | null>(null); // 正在选择设置的预设
  const [recite, setRecite] = useState<{ presetId: string; pos: number; paused: boolean } | null>(null);
  const [repeat, setRepeat] = useState(2); // 朗读次数
  const [gapIdx, setGapIdx] = useState(1); // 跟读间隔选项索引
  const reciteStop = useRef(false); // 停止标记
  const recitePaused = useRef(false); // 暂停标记
  const wakeRecite = useRef<(() => void) | null>(null); // 暂停唤醒函数
  const reciteAudio = useRef<HTMLAudioElement | null>(null); // 当前音频（暂停/继续用）

  const isZh = lang === 'zh';

  // 检索：符号精确优先 / 否则符号前缀、中文包含、英文前缀（避免短查询过度匹配）
  const queryLower = query.trim().toLowerCase();
  const exactSymbol = queryLower ? ELEMENTS.find((e) => e.symbol.toLowerCase() === queryLower) : undefined;
  const matchN = (e: ElementInfo) => {
    if (!queryLower) return false;
    // 查询恰好等于某符号 → 只精确高亮该元素（如 "fe"→仅 Fe、"cu"→仅 Cu）
    if (exactSymbol) return e.n === exactSymbol.n;
    const sym = e.symbol.toLowerCase();
    return (
      sym.startsWith(queryLower) ||
      e.zh.includes(queryLower) ||
      e.en.toLowerCase().startsWith(queryLower)
    );
  };

  /** 播放元素读音：优先本地预生成 MP3（一致、离线、免语音包），失败降级浏览器语音合成 */
  const speak = (e: ElementInfo) => {
    const audio = new Audio(`/audio/${e.n}.mp3`);
    audio.onended = () => setSpeaking(false);
    audio.onerror = () => {
      // 本地音频缺失或播放失败 → 降级 speechSynthesis（设备有语音包时仍可用）
      setSpeaking(false);
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(e.zh);
      u.lang = 'zh-CN';
      u.rate = 0.85;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    };
    audio.play().catch(() => setSpeaking(false));
    setSpeaking(true);
  };

  /** 播放单个 MP3，返回 Promise（播放结束 / 出错即 resolve）；保存引用供暂停/继续 */
  const playMp3 = (n: number) =>
    new Promise<void>((resolve) => {
      const audio = new Audio(`/audio/${n}.mp3`);
      reciteAudio.current = audio;
      audio.onended = () => resolve();
      audio.onerror = () => resolve(); // 本地缺失 → 静默跳过（不打断连读）
      audio.play().catch(() => resolve());
    });

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  /** 暂停时阻塞等待：直到继续（wake）或停止 */
  const waitIfPaused = () =>
    new Promise<void>((resolve) => {
      if (!recitePaused.current) return resolve();
      wakeRecite.current = () => {
        recitePaused.current = false;
        wakeRecite.current = null;
        resolve();
      };
    });

  /** 中考跟读（播放器）：按预设顺序连读，每元素读 repeat 遍，留跟读间隔；支持暂停/停止 */
  const startRecite = async (presetId: string) => {
    // 正在播同一预设 → 视为停止
    if (recite?.presetId === presetId) {
      stopRecite();
      return;
    }
    reciteStop.current = false;
    recitePaused.current = false;
    const preset = RECITE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setReciteSetup(null);
    setRecite({ presetId, pos: 1, paused: false });
    for (let i = 0; i < preset.ns.length; i++) {
      if (reciteStop.current) break;
      setRecite({ presetId, pos: i + 1, paused: false });
      const n = preset.ns[i];
      // 按设定次数朗读
      for (let r = 0; r < repeat; r++) {
        if (reciteStop.current) break;
        await waitIfPaused();
        if (reciteStop.current) break;
        await playMp3(n);
        // 多遍之间短暂停顿
        if (r < repeat - 1) {
          await sleep(250);
        }
      }
      if (reciteStop.current) break;
      // 跟读间隔（留时间让学生跟读）
      await waitIfPaused();
      if (reciteStop.current) break;
      await sleep(GAP_OPTIONS[gapIdx]);
    }
    if (!reciteStop.current) setRecite(null);
    reciteStop.current = false;
  };

  /** 停止跟读（清状态） */
  const stopRecite = () => {
    reciteStop.current = true;
    if (wakeRecite.current) {
      wakeRecite.current();
    }
    if (reciteAudio.current) {
      reciteAudio.current.pause();
      reciteAudio.current = null;
    }
    setRecite(null);
    setReciteSetup(null);
  };

  /** 暂停跟读 */
  const pauseRecite = () => {
    if (!recite) return;
    recitePaused.current = true;
    if (reciteAudio.current) reciteAudio.current.pause();
    setRecite({ ...recite, paused: true });
  };

  /** 继续跟读 */
  const resumeRecite = () => {
    if (!recite) return;
    if (wakeRecite.current) wakeRecite.current();
    else recitePaused.current = false;
    if (reciteAudio.current) reciteAudio.current.play().catch(() => {});
    setRecite({ ...recite, paused: false });
  };

  /** 主表 7 周期 + 镧系(6) + 锕系(7) */
  const mainRows = ELEMENTS.filter((e) => e.y <= 7);
  const lanthanides = ELEMENTS.filter((e) => e.period === 6 && e.y === 9);
  const actinides = ELEMENTS.filter((e) => e.period === 7 && e.y === 10);

  /** 跟读当前预设与元素（用于进度显示 + 格子高亮） */
  const recitePreset = recite ? RECITE_PRESETS.find((p) => p.id === recite.presetId) : undefined;
  const reciteEl =
    recite && recitePreset ? ELEMENTS.find((e) => e.n === recitePreset.ns[recite.pos - 1]) : undefined;

  /** 元素格子（教材样式：左上角核电荷数 + 符号 + 中文名 + 底部相对原子质量） */
  const renderCell = (el: ElementInfo) => {
    const color = CAT_COLOR[el.cat];
    const matched = queryLower ? matchN(el) : false;
    const reciting = !!recite && !!recitePreset && recitePreset.ns[recite.pos - 1] === el.n;
    return (
      <button
        key={el.n}
        type="button"
        onClick={() => { setSelected(el); setTab('props'); setHoveredLayer(null); }}
        title={`${el.zh} ${el.symbol}`}
        aria-label={`${el.zh} ${el.symbol}`}
        className={`relative flex-1 h-[58px] flex flex-col border transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:border-[var(--fg)] ${
          matched ? 'ring-2 ring-[var(--fg)]' : ''
        } ${reciting ? 'recite-active' : ''}`}
        style={{ borderColor: color.border, backgroundColor: color.bg }}
      >
        {/* 核电荷数（左上角） */}
        <span className="absolute top-0.5 left-1 text-[9px] mono-font text-[var(--muted)] leading-none">
          {el.n}
        </span>
        {/* 符号（居中，醒目） */}
        <span className="flex-1 flex items-center justify-center text-[16px] font-bold mono-font leading-none" style={{ color: color.text }}>
          {el.symbol}
        </span>
        {/* 中文名 */}
        <span className="text-center text-[12px] serif-font leading-none mb-0.5 font-medium">{el.zh}</span>
        {/* 相对原子质量（底部，调大调浅） */}
        <span className="text-center text-[9px] mono-font text-[var(--muted)] leading-none mb-0.5 opacity-80">
          {el.mass ?? ''}
        </span>
      </button>
    );
  };

  return (
    <main className="flex-1 flex flex-col my-10 px-2 sm:px-6">
      <Link to="/subject/chemistry" className="text-xs mono-font text-[var(--muted)] underline hover:text-[var(--fg)]">
        ← {lang === 'zh' ? '返回化学' : 'Back to Chemistry'}
      </Link>

      <div className="mt-5 mb-6">
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight serif-font text-[var(--fg)]">
          {lang === 'zh' ? '元素周期表' : 'Periodic Table'}
          <ShareInline />
        </h1>
        <p className="mt-2 text-xs serif-font italic text-[var(--muted)]">
          {lang === 'zh'
            ? '元素周期表是学习和研究化学的重要工具。由俄国化学家门捷列夫于 1869 年提出，现行版本由国际纯粹与应用化学联合会（IUPAC）维护，随新元素发现持续更新（最近于 2016 年补全 113–118 号）。点击元素查看信息，点小喇叭听读音。'
            : 'The periodic table is an essential tool for chemistry. Proposed by Dmitri Mendeleev in 1869, the current version is maintained by IUPAC and keeps updating as new elements are discovered (most recently completing 113–118 in 2016). Tap an element for details, tap the speaker to hear its name.'}
        </p>
      </div>

      {/* 检索 + 图例（灰色背景模块，与表格区视觉分离） */}
      <div className="mb-5 border border-[var(--border)] bg-[var(--card-bg)] p-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-[11px] mono-font text-[var(--muted)]">
            {lang === 'zh' ? '检索元素' : 'Search'}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === 'zh' ? '输入元素符号或中文名，如 H / 氢' : 'Type a symbol or name, e.g. H / Hydrogen'}
            className="w-full sm:max-w-xs border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--fg)]"
          />
        </div>
        {/* 图例 */}
        <div className="flex flex-wrap gap-4 text-[10px] mono-font text-[var(--muted)]">
          {(Object.keys(CAT_COLOR) as ElementInfo['cat'][]).map((c) => (
            <span key={c} className="flex items-center gap-1.5">
              <span className="w-3 h-3 border" style={{ borderColor: CAT_COLOR[c].border, backgroundColor: CAT_COLOR[c].bg }} />
              {isZh ? CAT_ZH[c] : c}
            </span>
          ))}
        </div>
      </div>

      {/* 中考跟读（播放器：选预设 → 设置次数/间隔 → 播放，右侧进度条 + 播放控制） */}
      <div className="recite-panel mb-5 border border-[var(--border)] bg-[var(--card-bg)] p-3">
        <div className="flex items-center justify-between mb-2 gap-3">
          <div className="text-[11px] mono-font text-[var(--muted)]">
            {lang === 'zh' ? '// 中考跟读' : '// Recite'}
          </div>
          {recite && reciteEl && recitePreset && (
            <div className="text-[11px] mono-font text-[var(--fg)]">
              {reciteEl.zh} {reciteEl.symbol} · {recite.pos}/{recitePreset.ns.length}
            </div>
          )}
        </div>

        {/* 预设选择 */}
        <div className="flex flex-wrap gap-2">
          {RECITE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                if (recite?.presetId === p.id) stopRecite();
                else setReciteSetup(p.id);
              }}
              className={`px-3 py-1.5 text-xs mono-font border transition-colors ${
                recite?.presetId === p.id || reciteSetup === p.id
                  ? 'border-[var(--fg)] text-[var(--fg)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
              }`}
            >
              {isZh ? p.zh : p.en}
            </button>
          ))}
        </div>

        {/* 播放器控制区：未播放 → 设置；播放中 → 进度条 + 控制键 */}
        {reciteSetup && !recite && (
          <div className="mt-2 pt-2 border-t border-[var(--border)] flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* 朗读次数 */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] mono-font text-[var(--muted)]">{lang === 'zh' ? '次数' : 'Times'}</span>
              {[1, 2, 3].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRepeat(r)}
                  className={`px-2 py-1 text-xs mono-font border transition-colors ${
                    repeat === r ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {/* 跟读间隔 */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] mono-font text-[var(--muted)]">{lang === 'zh' ? '间隔' : 'Gap'}</span>
              {GAP_OPTIONS.map((g, i) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGapIdx(i)}
                  className={`px-2 py-1 text-xs mono-font border transition-colors ${
                    gapIdx === i ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
                  }`}
                >
                  {g / 1000}s
                </button>
              ))}
            </div>
            {/* 开始 */}
            <button
              type="button"
              onClick={() => reciteSetup && startRecite(reciteSetup)}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs mono-font border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)]"
            >
              <Play className="w-3.5 h-3.5" />
              {lang === 'zh' ? '开始跟读' : 'Start'}
            </button>
          </div>
        )}

        {recite && reciteEl && recitePreset && (
          <div className="mt-2 pt-2 border-t border-[var(--border)]">
            <div className="flex items-center gap-3">
              {/* 播放控制键（播放器风格） */}
              {recite.paused ? (
                <button
                  type="button"
                  onClick={resumeRecite}
                  aria-label={lang === 'zh' ? '继续' : 'Resume'}
                  title={lang === 'zh' ? '继续' : 'Resume'}
                  className="flex items-center justify-center w-9 h-9 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors"
                >
                  <Play className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pauseRecite}
                  aria-label={lang === 'zh' ? '暂停' : 'Pause'}
                  title={lang === 'zh' ? '暂停' : 'Pause'}
                  className="flex items-center justify-center w-9 h-9 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
                >
                  <Pause className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={stopRecite}
                aria-label={lang === 'zh' ? '停止' : 'Stop'}
                title={lang === 'zh' ? '停止' : 'Stop'}
                className="flex items-center justify-center w-9 h-9 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
              {/* 当前元素进度条 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs serif-font text-[var(--fg)] shrink-0">
                    {reciteEl.zh} {reciteEl.symbol}
                  </span>
                  <div className="flex-1 h-1 bg-[var(--border)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--fg)] transition-all duration-300"
                      style={{ width: `${(recite.pos / recitePreset.ns.length) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-[10px] mono-font text-[var(--muted)]">
                  {recite.pos} / {recitePreset.ns.length} · {lang === 'zh' ? `每元素读 ${repeat} 遍` : `${repeat}x each`} · {GAP_OPTIONS[gapIdx] / 1000}s{' '}
                  {lang === 'zh' ? '间隔' : 'gap'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 主表 */}
      <div className="mb-1 text-[10px] mono-font text-[var(--muted)] sm:hidden">
        {lang === 'zh' ? '← 左右滑动查看完整周期表 →' : '← Swipe to see the full table →'}
      </div>
      {/* pt-3 给第一行（氢/氦）hover 上浮留出空间，避免被上方模块遮挡 */}
      <div className="overflow-x-auto pt-3 -mt-1">
        <div className="min-w-[720px] xl:min-w-[880px]">
          {/* 周期行 */}
          {[1, 2, 3, 4, 5, 6, 7].map((period) => (
            <div key={period} className="flex gap-1 mb-1">
              {/* 周期号 */}
              <span className="w-6 shrink-0 flex items-center justify-center text-[9px] mono-font text-[var(--muted)]">
                {period}
              </span>
              {Array.from({ length: 18 }, (_, i) => {
                const col = i + 1;
                const el = mainRows.find((e) => e.x === col && e.y === period);
                if (el) return renderCell(el);
                // 镧系/锕系占位格（主表第 6/7 周期 IIIB 族位置，对应下方独立两行）
                if (col === 3 && period === 6) {
                  return (
                    <div key={col} className="flex-1 h-[58px] flex flex-col items-center justify-center border border-[var(--border)] text-center leading-tight px-0.5">
                      <span className="text-[10px] serif-font text-[var(--fg)]">{lang === 'zh' ? '镧系' : 'La'}</span>
                      <span className="text-[9px] mono-font text-[var(--muted)]">{lang === 'zh' ? '57–71' : '57–71'}</span>
                    </div>
                  );
                }
                if (col === 3 && period === 7) {
                  return (
                    <div key={col} className="flex-1 h-[58px] flex flex-col items-center justify-center border border-[var(--border)] text-center leading-tight px-0.5">
                      <span className="text-[10px] serif-font text-[var(--fg)]">{lang === 'zh' ? '锕系' : 'Ac'}</span>
                      <span className="text-[9px] mono-font text-[var(--muted)]">{lang === 'zh' ? '89–103' : '89–103'}</span>
                    </div>
                  );
                }
                return <div key={col} className="flex-1 h-[58px]" />;
              })}
            </div>
          ))}

          {/* 空行（分隔） */}
          <div className="h-4" />

          {/* 镧系 */}
          <div className="flex gap-1 mb-1">
            <span className="w-6 shrink-0 flex items-center justify-center text-[9px] mono-font text-[var(--muted)]">
              {lang === 'zh' ? '镧系' : 'La'}
            </span>
            {lanthanides.map((el) => renderCell(el))}
          </div>
          {/* 锕系 */}
          <div className="flex gap-1 mb-1">
            <span className="w-6 shrink-0 flex items-center justify-center text-[9px] mono-font text-[var(--muted)]">
              {lang === 'zh' ? '锕系' : 'Ac'}
            </span>
            {actinides.map((el) => renderCell(el))}
          </div>
        </div>
      </div>

      {/* 底部说明 */}
      <p className="mt-5 text-[11px] serif-font text-[var(--muted)] leading-relaxed">
        {lang === 'zh'
          ? '注：周期表按原子序数（核电荷数）递增排列；第 8、9、10 三个纵列共同组成一个族。相对原子质量为近似值。'
          : 'Note: ordered by atomic number (nuclear charge); columns 8-10 together form one group. Atomic masses are approximate.'}
      </p>

      {/* 元素详情卡 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div
            className="relative w-full max-w-xs border border-[var(--border)] bg-[var(--bg)] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`${selected.zh} ${selected.symbol}`}
          >
            {/* 关闭按钮：独立右上角（无边框，仅 ×） */}
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label={lang === 'zh' ? '关闭' : 'Close'}
              className="absolute top-2 right-3 w-7 h-7 flex items-center justify-center text-lg text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
            >
              ×
            </button>

            <div className="flex items-start justify-between pr-8">
              <div>
                <div className="text-[10px] mono-font text-[var(--muted)]">#{selected.n}</div>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold serif-font text-[var(--fg)]">{selected.zh}</span>
                  {/* 读音按钮：放在中文名旁边 */}
                  <button
                    type="button"
                    onClick={() => speak(selected)}
                    title={lang === 'zh' ? '朗读' : 'Listen'}
                    aria-label={lang === 'zh' ? '朗读' : 'Listen'}
                    className="flex items-center justify-center w-8 h-8 text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-sm mono-font text-[var(--muted)]">{selected.symbol}</div>
              </div>
            </div>

            <div className="mt-3 text-sm serif-font text-[var(--fg)]">
              {/* Tab 切换：基础属性 / 百科故事 */}
              <div className="dialog-tabs flex border border-[var(--border)] mb-3 text-[11px] mono-font">
                <button
                  type="button"
                  onClick={() => setTab('props')}
                  className={`flex-1 py-1 transition-colors ${tab === 'props' ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
                >
                  {lang === 'zh' ? '基础属性' : 'Properties'}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('story')}
                  className={`flex-1 py-1 transition-colors ${tab === 'story' ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
                >
                  {lang === 'zh' ? '百科故事' : 'Story'}
                </button>
              </div>

              {/* 基础属性面板 */}
              {tab === 'props' && (
                <>
              {/* 原子结构示意图（教材简绘：核 + 实线轨道 + 电子点；悬停/点击电子层显示该层电子数） */}
              <div className="border border-[var(--border)] px-2 py-1 mb-1.5">
                <div className="text-[10px] mono-font text-[var(--muted)] tracking-widest mb-0">
                  // {lang === 'zh' ? '原子结构示意图（点击电子层查看电子数）' : 'Bohr model (tap a shell for electron count)'}
                </div>
                <svg viewBox="0 0 180 150" className="w-full max-h-[170px]" aria-label={`${selected.zh} 原子结构`}>
                  {/* 动态轨道半径：按层数分配，任何元素（1~7 层）都清晰不溢出 */}
                  {(() => {
                    const layers = selected.shells.length;
                    const cx = 90, cy = 75;
                    // 核半径随位数自适应：1-2 位 +111 三位数时核加大、字号缩小，避免文字出格
                    const digits = String(selected.n).length;
                    const coreR = digits >= 3 ? 16 : 13;
                    const coreFont = digits >= 3 ? 10 : 13;
                    // 最大可用半径：略放大（允许最外层轻微裁切，核居中即可），多层元素仍清晰
                    const maxR = Math.min(64, coreR + 51);
                    const step = layers > 1 ? (maxR - coreR) / (layers - 1) : 0;
                    const rOf = (i: number) => coreR + (layers > 1 ? i * step : 14);
                    return (
                      <>
                        {/* 电子层轨道 + 隐形感应区：悬停/点击整层都可触发，避免细线难点 */}
                        {selected.shells.map((_, i) => {
                          const r = rOf(i);
                          const active = hoveredLayer === i;
                          return (
                            <g
                              key={i}
                              className="cursor-pointer"
                              onClick={() => setHoveredLayer(active ? null : i)}
                              onMouseEnter={() => setHoveredLayer(i)}
                              onMouseLeave={() => setHoveredLayer(null)}
                            >
                              {/* 隐形感应区：透明粗描边，方便手指/鼠标命中整层 */}
                              <circle cx={cx} cy={cy} r={r} fill="none" stroke="transparent" strokeWidth="16" />
                              {/* 可见轨道：悬停/选中时加粗高亮 */}
                              <circle
                                cx={cx} cy={cy} r={r} fill="none"
                                stroke={active ? 'var(--fg)' : 'var(--muted)'}
                                strokeWidth={active ? 2 : 0.9}
                                opacity={active ? 0.9 : 0.45}
                                style={{ transition: 'stroke 0.2s ease, stroke-width 0.2s ease, opacity 0.2s ease' }}
                              />
                            </g>
                          );
                        })}
                        {/* 原子核（核电荷数） */}
                        <circle cx={cx} cy={cy} r={coreR} fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.2" />
                        <text x={cx} y={cy + (coreFont >= 13 ? 4 : 3.5)} textAnchor="middle" fontSize={coreFont} fill="var(--fg)" fontFamily="var(--f-mono)" fontWeight="bold">
                          +{selected.n}
                        </text>
                        {/* 各层电子：绕核旋转（内快外慢、交替反向）；每层最多 8 个示意点 */}
                        {selected.shells.map((count, i) => {
                          const r = rOf(i);
                          const dots: { x: number; y: number }[] = [];
                          const show = Math.min(count, 8);
                          for (let k = 0; k < show; k++) {
                            const a = (k / show) * 2 * Math.PI - Math.PI / 2;
                            dots.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
                          }
                          // 内层快(3s)、外层慢(9s)；相邻层反向
                          const dur = (3 + i * 2).toFixed(1);
                          const reverse = i % 2 === 1;
                          return (
                            <g
                              key={i}
                              className="electron-layer"
                              style={{ animationDuration: `${dur}s`, animationDirection: reverse ? 'reverse' : 'normal' }}
                            >
                              {dots.map((d, k) => (
                                <circle key={k} cx={d.x} cy={d.y} r="2.6" fill="var(--fg)" />
                              ))}
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
                {/* 当前层电子数提示条（悬停/点击时显示） */}
                {hoveredLayer !== null && selected.shells[hoveredLayer] != null && (
                  <div className="mt-1 text-[11px] mono-font text-[var(--fg)]">
                    {lang === 'zh'
                      ? `第 ${hoveredLayer + 1} 层：${selected.shells[hoveredLayer]} 个电子`
                      : `Shell ${hoveredLayer + 1}: ${selected.shells[hoveredLayer]} electron${selected.shells[hoveredLayer] > 1 ? 's' : ''}`}
                  </div>
                )}
              </div>

              {/* 属性列表：斑马线行距 */}
              <dl className="divide-y divide-[var(--border)]">
                {[
                  { k: lang === 'zh' ? '英文名' : 'English', v: selected.en },
                  { k: lang === 'zh' ? '核电荷数（原子序数）' : 'Nuclear charge (atomic number)', v: String(selected.n) },
                  { k: lang === 'zh' ? '电子层排布' : 'Electron shells', v: selected.shells.join(', ') },
                  { k: lang === 'zh' ? '相对原子质量' : 'Atomic mass', v: selected.radioactive ? String(selected.mass) : (selected.massExact != null ? String(selected.massExact) : String(selected.mass ?? '—')) },
                  { k: lang === 'zh' ? '位置' : 'Position', v: lang === 'zh' ? `第 ${selected.period} 周期，第 ${selected.group ?? '?'} 族` : `Period ${selected.period}, Group ${selected.group ?? '?'}` },
                  { k: lang === 'zh' ? '类别' : 'Category', v: isZh ? CAT_ZH[selected.cat as ElementInfo['cat']] : selected.cat },
                ].map((row, i) => {
                  const isCat = row.k === (lang === 'zh' ? '类别' : 'Category');
                  const isMass = row.k === (lang === 'zh' ? '相对原子质量' : 'Atomic mass');
                  return (
                    <div key={row.k} className={`flex items-baseline justify-between gap-3 py-2 px-2 text-sm ${i % 2 === 1 ? 'bg-[var(--card-bg)]' : ''}`}>
                      <dt className="text-[var(--muted)] serif-font shrink-0">{row.k}</dt>
                      <dd className="text-right serif-font text-[var(--fg)]">
                        {isMass ? (
                          // 相对原子质量：标准原子量 + 不确定度；放射性元素显示质量数并注明
                          <span className="inline-flex items-baseline gap-1.5">
                            <span>
                              {selected.radioactive
                                ? String(selected.mass)
                                : selected.massExact != null
                                  ? String(selected.massExact)
                                  : String(selected.mass ?? '—')}
                            </span>
                            {!selected.radioactive && selected.massUnc && (
                              <span className="text-[10px] mono-font text-[var(--muted)]">±{selected.massUnc}</span>
                            )}
                            {selected.radioactive && (
                              <span className="text-[10px] mono-font text-[var(--muted)]">
                                {lang === 'zh' ? '质量数·无稳定同位素' : 'mass no.·no stable'}
                              </span>
                            )}
                          </span>
                        ) : isCat ? (
                          // 类别：彩色标签（配色与检索图例一致：金属红/非金属绿/稀有气体蓝/类金属黄褐）
                          <span
                            className="inline-block px-2 py-0.5 border text-xs mono-font"
                            style={{
                              borderColor: CAT_COLOR[selected.cat as ElementInfo['cat']].border,
                              color: CAT_COLOR[selected.cat as ElementInfo['cat']].border,
                              backgroundColor: CAT_COLOR[selected.cat as ElementInfo['cat']].bg,
                            }}
                          >
                            {row.v}
                          </span>
                        ) : (
                          row.v
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <p className="mt-1.5 px-2 text-[10px] serif-font italic text-[var(--muted)] leading-relaxed">
                {lang === 'zh'
                  ? '相对原子质量为 IUPAC 标准原子量（2021 年修订）；无稳定同位素的元素显示其最稳定同位素的质量数。'
                  : 'Atomic masses are IUPAC standard atomic weights (2021); elements with no stable isotopes show the mass number of their longest-lived isotope.'}
              </p>
                </>
              )}

              {/* 百科故事面板 */}
              {tab === 'story' && (
                <div className="border border-[var(--border)] px-2.5 py-1.5 space-y-1.5">
                  <div>
                    <div className="text-[10px] mono-font text-[var(--muted)] tracking-widest mb-0">
                      // {lang === 'zh' ? '发现史' : 'Discovery'}
                    </div>
                    <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
                      {lang === 'zh' ? selected.discovery.zh : selected.discovery.en}
                    </p>
                  </div>
                  <div>
                    <div className="text-[10px] mono-font text-[var(--muted)] tracking-widest mb-0">
                      // {lang === 'zh' ? '生活与常见用途' : 'Where you find it'}
                    </div>
                    <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
                      {lang === 'zh' ? selected.usage.zh : selected.usage.en}
                    </p>
                  </div>
                  <p className="text-[10px] serif-font italic text-[var(--muted)] leading-relaxed">
                    {lang === 'zh'
                      ? '发现史与用途为简要科普，具体年代与细节以权威化学史资料为准。'
                      : 'Discovery and uses are brief; exact dates and details defer to authoritative chemistry history sources.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
