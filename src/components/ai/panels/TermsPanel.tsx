/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * TermsPanel —— AI 面板的条款页。
 *
 * P0 拆分产物：JSX **逐字**从 AiAssistant.tsx 搬移（未改一个字符），只把「读到的值」与「调用的动作」
 * 按域打包成 props。面板是纯展示：不持有业务状态、不发请求、不改 view 状态机；
 * DOM 结构 / className / 触屏热区 / .ai-* 规则与拆分前完全一致。
 * memo 导出：state 由父级按值 memo、actions 走 useStable（身份恒定）→ 父组件无关的 setState 不再触发本面板重渲。
 */

import { memo } from 'react';
import { TriangleAlert, Coins, ChevronDown, ShieldCheck, BookOpen, Scale } from 'lucide-react';

export interface TermsPanelState {
  collapsedTerms: any;
  pending: any;
}

export interface TermsPanelActions {
  setView: any;
  toggleTerm: (i: number) => any;
}

interface TermsPanelProps {
  lang: 'zh' | 'en';
  state: TermsPanelState;
  actions: TermsPanelActions;
}

function TermsPanelInner({ lang, state, actions }: TermsPanelProps) {
  const { collapsedTerms, pending } = state;
  const { setView, toggleTerm } = actions;
  return (
    <>
<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* 条款区：内容超高时独立滚动 */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 space-y-3">
          <p className="text-[0.6875rem] font-bold mono-font text-[var(--fg)] tracking-widest">
            {lang === 'zh' ? '使用须知' : 'Terms'}
          </p>
          <p className="flex items-start gap-1.5 border-l-4 border-l-[var(--error)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-3 py-2 text-[0.6875rem] text-[var(--error)] serif-font leading-relaxed">
            <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{lang === 'zh' ? '配置/使用 AI 助手前，请阅读并同意以下条款：' : 'Before configuring or using the AI assistant, please read and accept the terms below:'}</span>
          </p>
          {pending && (
            <p className="text-[0.6875rem] text-[var(--fg)] serif-font leading-relaxed">
              {lang === 'zh' ? '您点击的问题将在配置完成后自动发送。' : 'Your question will be sent automatically once you finish the setup.'}
            </p>
          )}
          <div className="space-y-2 text-[0.6875rem] text-[var(--muted)] leading-relaxed">
            {lang === 'zh' ? (
              <>
                <div>
                  <button type="button" onClick={() => toggleTerm(0)} className="flex w-full items-center gap-1.5 font-bold text-[var(--fg)] text-left"><Coins className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />1. 服务性质与费用<ChevronDown className={`w-3 h-3 ml-auto shrink-0 text-[var(--muted)] transition-transform ${collapsedTerms[0] ? '-rotate-90' : ''}`} /></button>

                  {!collapsedTerms[0] && (

                  <p>本站为纯前端静态页面，<strong className="font-bold text-[var(--fg)]">仅提供对话界面，不提供任何 AI 大模型服务</strong>，也不收取任何费用。您需自行注册并管理所选 AI 服务商的 API，相关费用由您与服务商结算。</p>

                  )}
                </div>
                <div>
                  <button type="button" onClick={() => toggleTerm(1)} className="flex w-full items-center gap-1.5 font-bold text-[var(--fg)] text-left"><ShieldCheck className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />2. 数据与隐私安全<ChevronDown className={`w-3 h-3 ml-auto shrink-0 text-[var(--muted)] transition-transform ${collapsedTerms[1] ? '-rotate-90' : ''}`} /></button>

                  {!collapsedTerms[1] && (

                  <>
                  <p>您的 API Key 仅以<strong className="font-bold text-[var(--fg)]">明文形式保存在当前浏览器的 localStorage 中，不在任何服务器落盘</strong>。本站<strong className="font-bold text-[var(--fg)]">无后端服务器，不采集、不存储、不中转</strong>任何密钥或对话内容。<strong className="font-bold text-[var(--fg)]">若在公共设备（如学校机房、图书馆）使用，请在离开前点击设置面板底部的「清除 AI 配置」，清空本机保存的 Key；问答历史与错题集请在「学习记录」中一并清空。</strong></p>
                  <p>数据流向：您的<strong className="font-bold text-[var(--fg)]">提问内容、当前实验器材读数与错题记录</strong>会由浏览器<strong className="font-bold text-[var(--fg)]">直接发送至您所配置的大模型服务商</strong>（如 DeepSeek、通义千问 Qwen 等）用于生成回答与学情归纳，本站不经手、不留存。<strong className="font-bold text-[var(--fg)]">请勿在提问中输入个人隐私、账号密码或任何涉密信息。</strong></p>
                  </>

                  )}
                </div>
                <div>
                  <button type="button" onClick={() => toggleTerm(2)} className="flex w-full items-center gap-1.5 font-bold text-[var(--fg)] text-left"><BookOpen className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />3. 学习辅助声明<ChevronDown className={`w-3 h-3 ml-auto shrink-0 text-[var(--muted)] transition-transform ${collapsedTerms[2] ? '-rotate-90' : ''}`} /></button>

                  {!collapsedTerms[2] && (

                  <p>本 AI 助手专为初中数理化学习辅助设计。AI 生成的内容存在不准确的可能，<strong className="font-bold text-[var(--fg)]">仅供参考，请务必以学校教材和任课老师的讲解为准</strong>。未成年人请在监护人的指导下配置和使用。</p>

                  )}
                </div>
                <div>
                  <button type="button" onClick={() => toggleTerm(3)} className="flex w-full items-center gap-1.5 font-bold text-[var(--fg)] text-left"><Scale className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />4. 合规与责任限制<ChevronDown className={`w-3 h-3 ml-auto shrink-0 text-[var(--muted)] transition-transform ${collapsedTerms[3] ? '-rotate-90' : ''}`} /></button>

                  {!collapsedTerms[3] && (

                  <p>请合法合规使用本工具，严禁用于生成或传播任何违法违规内容。由于网络环境或服务商跨域（CORS）限制导致的连接问题，本站无法干预。因使用本工具及所选 AI 服务产生的相关权责，<strong className="font-bold text-[var(--fg)]">由您与服务商自行承担</strong>。</p>

                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <button type="button" onClick={() => toggleTerm(0)} className="flex w-full items-center gap-1.5 font-bold text-[var(--fg)] text-left"><Coins className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />1. Service nature and fees<ChevronDown className={`w-3 h-3 ml-auto shrink-0 text-[var(--muted)] transition-transform ${collapsedTerms[0] ? '-rotate-90' : ''}`} /></button>

                  {!collapsedTerms[0] && (

                  <p>This site is a pure front-end static page that <strong className="font-bold text-[var(--fg)]">only provides the chat UI — no AI model service</strong>, no fees. You register and manage the API of your chosen provider yourself; fees are settled with that provider.</p>

                  )}
                </div>
                <div>
                  <button type="button" onClick={() => toggleTerm(1)} className="flex w-full items-center gap-1.5 font-bold text-[var(--fg)] text-left"><ShieldCheck className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />2. Data and privacy<ChevronDown className={`w-3 h-3 ml-auto shrink-0 text-[var(--muted)] transition-transform ${collapsedTerms[1] ? '-rotate-90' : ''}`} /></button>

                  {!collapsedTerms[1] && (

                  <>
                  <p>Your API key is stored <strong className="font-bold text-[var(--fg)]">in plain text only in this browser's localStorage — never written to any server</strong>. This site <strong className="font-bold text-[var(--fg)]">has no backend — it never collects, stores or relays</strong> keys or conversations. <strong className="font-bold text-[var(--fg)]">On a shared device (e.g. a school lab or library), click "Clear AI config" at the bottom of the settings panel before you leave to wipe the key saved here; clear Q&A history and the mistake set too under Records.</strong></p>
                  <p>Data flow: your <strong className="font-bold text-[var(--fg)]">questions, the current lab instrument readings and your mistake records</strong> are sent by your browser <strong className="font-bold text-[var(--fg)]">directly to the model provider you configured</strong> (e.g. DeepSeek, Qwen) to generate answers and learning summaries — this site neither handles nor stores them. <strong className="font-bold text-[var(--fg)]">Never type personal, confidential or otherwise sensitive information into a question.</strong></p>
                  </>

                  )}
                </div>
                <div>
                  <button type="button" onClick={() => toggleTerm(2)} className="flex w-full items-center gap-1.5 font-bold text-[var(--fg)] text-left"><BookOpen className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />3. Learning aid only<ChevronDown className={`w-3 h-3 ml-auto shrink-0 text-[var(--muted)] transition-transform ${collapsedTerms[2] ? '-rotate-90' : ''}`} /></button>

                  {!collapsedTerms[2] && (

                  <p>This assistant is for middle-school science learning only. AI output may be inaccurate — <strong className="font-bold text-[var(--fg)]">for reference; always defer to the textbook and your teacher</strong>. Minors should configure and use it under a guardian's guidance.</p>

                  )}
                </div>
                <div>
                  <button type="button" onClick={() => toggleTerm(3)} className="flex w-full items-center gap-1.5 font-bold text-[var(--fg)] text-left"><Scale className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />4. Compliance and liability<ChevronDown className={`w-3 h-3 ml-auto shrink-0 text-[var(--muted)] transition-transform ${collapsedTerms[3] ? '-rotate-90' : ''}`} /></button>

                  {!collapsedTerms[3] && (

                  <p>Use this tool lawfully; never generate or spread unlawful content. Connection issues caused by network or provider CORS restrictions are outside this site's control. Responsibility for using this tool and your chosen AI service <strong className="font-bold text-[var(--fg)]">lies with you and that provider</strong>.</p>

                  )}
                </div>
              </>
            )}
          </div>
          </div>
          {/* 同意按钮固定在底部（始终可见，不与条款一起滚动） */}
          <div className="shrink-0 px-4 pb-4 pt-2.5 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => setView('settings')}
            className="tap-primary w-full px-3 py-2 text-xs mono-font border border-[var(--fg)] text-[var(--fg)] transition-colors"
          >
            {lang === 'zh' ? '我同意并继续 →' : 'I agree and continue →'}
          </button>
          </div>
        </div>
    </>
  );
}

export default memo(TermsPanelInner);
