<div align="center">

# 数理化数字实验室

![version](https://img.shields.io/badge/版本-v1.15.4-blue)
![react](https://img.shields.io/badge/React-19-blue) ![vite](https://img.shields.io/badge/Vite-6-purple) ![tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8) ![katex](https://img.shields.io/badge/KaTeX-0.18-green) ![router](https://img.shields.io/badge/React_Router-7-ff4500) ![lucide](https://img.shields.io/badge/lucide--react-0.546-9ca3af)
![typescript](https://img.shields.io/badge/TypeScript-5.9-3178c6) ![vitest](https://img.shields.io/badge/Vitest-3.2-e5cf0a) ![tsx](https://img.shields.io/badge/tsx-4.21-5c6bc0)

基于初中 7-9 年级课程大纲的数学、物理、化学数字实验与探究平台。
本地运行 · 无需登录 · 中英双语 · 深浅主题 · 在线访问：https://stem.irky.dev

<img src="public/qr-stem.png" width="110" alt="扫码访问" title="手机扫码访问" />

</div>

---

**语言 / Language：** [中文说明](#中文说明) · [English](#english)

## 中文说明

### 简介

数理化数字实验室是一个**无需登录**的初中 STEM 探究空间，每个实验遵循**三幕式探究**（预测 → 探索 → 结论），鼓励学生先猜想、再操作、后归纳，而非被动跟随固定步骤。

- 🌐 中英双语，右上角一键切换
- 🌗 深浅主题（默认浅色，适合希沃/投影大屏）
- 📱 响应式：手机 / 平板 / PC / 希沃大屏
- 🎲 首页「随机探索」一键随机进入实验或工具
- 🧪 15 个交互实验 + 4 个查表工具：元素周期表（118 元素 · 实物照片 · 读音）、物理常量速查、物理公式速查、数学公式速查
- 🤖 AI 学习助手（顶栏入口）：配置您自己的 AI 服务商 API Key 即可使用，Key 仅存本机、对话直连服务商、本站不记录
- 💬 首页「每日科学」：每天一位科学家的名言与小故事

### 实验与工具清单

| 科目 | 年级 | 内容 |
|---|---|---|
| 数学 | 7-9 | 一次函数 · 二次函数 · 反比例函数 · 圆的性质 |
| 物理 | 8-9 | 欧姆定律 · 串并联电路 · 凸透镜成像 · 浮力 · 杠杆 · 压强 · 滑轮 |
| 化学 | 9 | 质量守恒定律 · 酸碱中和 · 电解水 · 金属活动性 |
| 工具 | — | 元素周期表（118 元素 · 检索 · 实物照片 · 读音 · 中考跟读） · 物理常量速查 · 物理公式速查 · 数学公式速查 |

| ID | 名称 | 说明 |
|---|---|---|
| `linear` | 一次函数 | 理解 k 与 b 如何决定直线的走向与截距 |
| `quadratic` | 二次函数 | 探究 a、b、c 对抛物线开口与位置的影响 |
| `inverse` | 反比例函数 | 观察 k 值变化对双曲线形状与位置的影响 |
| `circle` | 圆的性质 | 拖拽验证垂径定理、圆周角定理与直径对直角 |
| `ohm` | 欧姆定律 | 探究电流与电压、电阻的定量关系 |
| `circuits` | 串并联电路 | 对比串联与并联的电流、电压分配规律 |
| `lens` | 凸透镜成像 | 调节物距，观察倒立/正立、放大/缩小的像 |
| `buoyancy` | 浮力 | 探究浮力与排开液体体积、液体密度的关系 |
| `lever` | 杠杆 | 探究杠杆平衡条件 F₁l₁=F₂l₂ |
| `pressure` | 压强 | 探究压强 p=F/S 与压力、受力面积的关系 |
| `pulley` | 滑轮 | 探究定滑轮与动滑轮的特点 |
| `mass-conservation` | 质量守恒定律 | 三个方案对比验证化学反应前后质量不变 |
| `neutralization` | 酸碱中和 | 滴定实验观察 pH 突跃与指示剂颜色变化 |
| `electrolysis` | 电解水 | 观察正氧负氢体积比 2:1，探究水的组成 |
| `metal-activity` | 金属活动性 | 置换反应验证 Al > Cu > Ag 的活动性顺序 |
| `/periodic-table` | 元素周期表（工具） | 118 元素全览、检索、实物照片、中文读音、中考跟读（前 20 号/金属活动性/常见元素） |
| `/physics-constants` | 物理常量速查（工具） | 常用物理常量与典型数值一表全览，支持分类筛选与检索 |
| `/physics-formulas` | 物理公式速查（工具） | 29 个初中物理核心公式分类速览，公式与常量双向关联互跳 |
| `/math-formulas` | 数学公式速查（工具） | 19 个初中数学公式分类速览，配图与易错点提醒，一键跳转对应探究；支持中文/英文/章节/公式符号检索（如 八下、kx、π）|

### 快速开始

```bash
npm install        # 安装依赖
npm run dev        # 开发服务器（默认 http://localhost:3000）
npm run build      # 生产构建
npm run preview    # 本地预览构建产物
npm run test       # 运行测试
```

> 局域网访问：开发服务器监听 `0.0.0.0`，启动后其他设备打开 `http://<本机局域网IP>:3000`。
> Node.js 建议使用 nvm 管理的 v24.19.0（npm ≥ 11.10，.npmrc 配置了供应链保护 min-release-age=7）。

### 三幕式探究

每个实验由 **预测 → 探索 → 结论** 三幕构成，**不设硬性步骤锁**，学生可随时返回任意幕：

1. **预测**：先根据已有知识形成猜想，不急着看答案
2. **探索**：拖动滑块、开关、图形，观察参数变化并记录证据
3. **结论**：根据观察完成结论题，再查看反馈与考点速记

> 教学建议：先让学生独立预测 → 再邀请学生描述证据 → 最后共同完成结论。

### 元素周期表工具

- 118 个元素完整表格，支持检索（符号/中文/英文）
- 点击元素查看详情：基础属性（IUPAC 标准原子量 + 不确定度）、百科故事、实物照片（可放大）
- 中文读音（内置离线语音包，不依赖设备语音包）；**中考跟读**：前 20 号元素、金属活动性顺序、常见元素三清单连读，可调次数与间隔
- 原子结构示意图：点击电子层查看该层电子数

### AI 学习助手

- 顶栏入口，辅助解释初中数学（人教版）、物理（苏科版）、化学（人教版）知识，会结合当前页面内容作答
- 使用您自己的 API Key：支持 DeepSeek / 通义千问 / Kimi / 智谱 GLM / 豆包等预设及自定义端点，本站不提供、不代购、不收取任何费用
- 首次使用先阅读并同意使用须知；Key 仅存本机浏览器，对话直连您所选的服务商，本站无后端、不记录任何内容
- 模型列表在连接成功后自动获取；AI 生成内容仅供参考，请以教材和老师讲解为准
- 问答为单轮形式：点击页面「问 AI」按钮提问，回答末尾会推荐 2~3 个可继续点击了解的问题，不提供自由输入框，也不保存任何对话记录

### 每日科学

- 首页固定板块：每天展示一位科学家的名言与小故事，可一键换一条
- 中英双语，小故事可折叠展开

### 项目结构

```
src/
├── labs/              # 实验组件（math / physics / chemistry）
├── components/
│   ├── lab/           # 共享实验原语（坐标平面/表盘/反馈面板等）
│   ├── layout/        # 外壳（Header / Footer）
│   ├── feedback/      # 反馈气泡与面板 / 分享对话框
│   ├── share/         # 标题内嵌分享按钮
│   └── ui/            # 通用 UI（科目/实验图标、公式、占位页）
├── lib/               # 注册表 / 科目 / i18n / 反馈存储 / 元素数据 / 全局状态
└── pages/             # 首页 / 科目 / 实验 / 周期表 / 使用说明
```

### 反馈

右下角浮动气泡提供**实验反馈**与**项目反馈**，提交后实时推送到开发者微信（Server酱推送）；离线或网络异常时自动暂存本机，联网后自动补发。无需登录账号。

### 许可

本项目基于 **GNU Affero General Public License v3 (AGPL-3.0)** 开源（见 `LICENSE` 文件）。你可以自由使用、修改与分发，**但任何衍生作品都必须以 AGPL-3.0 开源**（含通过网络提供的服务），并**保留原作者版权声明**，不允许闭源拿走。

### 免责条款

- 本项目为**教学演示与个人探究**参考工具，不构成任何专业意见或承诺。
- 实验数据、公式与交互结果已尽力校对，但**不保证绝对正确**，教学中请以权威教材为准。
- 反馈会发送给开发者；离线时暂存本机，联网后补发。请对保存于本机的内容自行负责。

---

## English

### Overview

**STEM Digital Lab** is a **no-login** middle-school STEM exploration space (Grades 7–9). Live at https://stem.irky.dev. Every lab follows a **three-act inquiry** (Predict → Explore → Conclude) that asks students to guess first, explore freely, then conclude — not to follow fixed step-locks.

- 🌐 Bilingual (zh/en), switchable from the header
- 🌗 Light & dark themes (light by default for classroom projection)
- 📱 Responsive: mobile / tablet / PC / Seewo interactive screen
- 🎲 "Random explore" button on the homepage jumps into a random lab or tool
- 🧪 15 interactive labs + 4 lookup tools: Periodic Table (118 elements · photos · pronunciation · recite), Physics Constants, Physics Formulas, Math Formulas
- 🤖 AI assistant (header entry): configure your own provider API key for science help — key stays on-device, chats go straight to your provider, nothing is logged; single-turn Q&A driven by page buttons (no free-text input), with 2–3 recommended follow-up questions at the end of each answer
- 💬 Daily Science on the homepage: a scientist quote and short story each day

### Labs & Tools

| Subject | Grades | Content |
|---|---|---|
| Math | 7–9 | Linear · Quadratic · Inverse Variation · Circle Properties |
| Physics | 8–9 | Ohm's Law · Circuits · Lens · Buoyancy · Levers · Pressure · Pulleys |
| Chemistry | 9 | Conservation of Mass · Titration · Electrolysis · Metal Activity |
| Tool | — | Periodic Table (118 elements · search · photos · pronunciation · recite) · Physics Constants · Physics Formulas · Math Formulas |

| ID | Name | Description |
|---|---|---|
| `linear` | Linear Functions | Understand how k and b define a line |
| `quadratic` | Quadratic Functions | Explore how a, b, c shape the parabola |
| `inverse` | Inverse Variation | See how k changes the hyperbola |
| `circle` | Circle Properties | Drag to verify chord and inscribed angle theorems |
| `ohm` | Ohm's Law | Explore I = U/R through interactive circuits |
| `circuits` | Series & Parallel Circuits | Compare current and voltage in series vs parallel |
| `lens` | Convex Lens Imaging | Adjust object distance to see real and virtual images |
| `buoyancy` | Buoyancy | Explore buoyancy vs displaced volume and liquid density |
| `lever` | Levers | Explore the balance condition F₁l₁=F₂l₂ |
| `pressure` | Pressure | Explore p=F/S vs force and contact area |
| `pulley` | Pulleys | Explore fixed and movable pulleys |
| `mass-conservation` | Conservation of Mass | Three experiments proving mass is conserved |
| `neutralization` | Acid-Base Titration | Titrate to see the pH jump and indicator color shift |
| `electrolysis` | Electrolysis of Water | See O₂ and H₂ in a 2:1 ratio, explore water's composition |
| `metal-activity` | Metal Activity | Displacement reactions verifying Al > Cu > Ag |
| `/periodic-table` | Periodic Table (tool) | All 118 elements, search, photos, pronunciation, recite mode (first 20 / activity series / common elements) |
| `/physics-constants` | Physics Constants (tool) | Common constants and typical values at a glance, with filters and search |
| `/physics-formulas` | Physics Formulas (tool) | 29 core formulas, cross-linked both ways with related constants |
| `/math-formulas` | Math Formulas (tool) | 19 core formulas with diagrams and pitfalls, searchable by zh/en/chapter/symbol |

### Getting Started

```bash
npm install        # Install dependencies
npm run dev        # Dev server (default http://localhost:3000)
npm run build      # Production build
npm run preview    # Preview the build locally
npm run test       # Run tests
```

> LAN access: the dev server listens on `0.0.0.0`; open `http://<your-LAN-IP>:3000` from other devices.
> Node.js: use nvm-managed v24.19.0 (npm ≥ 11.10; .npmrc enables supply-chain guard min-release-age=7).

### Three-Act Inquiry

Each lab is built from **Predict → Explore → Conclude** with **no hard step-locks**; students can revisit any act at any time:

1. **Predict**: make a guess from prior knowledge before seeing the answer
2. **Explore**: drag sliders, switches, or shapes, observe changes, and record evidence
3. **Conclude**: answer conclusion questions, then check feedback and key points

> Teaching suggestion: let students predict independently, invite them to describe evidence, then complete the conclusion together.

### Periodic Table Tool

- All 118 elements with search (symbol / Chinese / English)
- Tap an element for details: properties (IUPAC standard atomic weights with uncertainty), mini-wiki story, and a real photo (tap to enlarge)
- Chinese pronunciation with built-in offline audio; **Recite mode**: first 20 elements, activity series, and common elements, with adjustable repeats and gaps
- Bohr diagram: tap a shell to see its electron count

### AI Assistant

- Header entry that helps explain middle-school math (PEP), physics (Su-Ke) and chemistry (PEP), grounded in the current page
- Use your own API key: presets for DeepSeek / Qwen / Kimi / Zhipu GLM / Doubao plus a custom endpoint (DeepSeek / Qwen / Kimi / Zhipu GLM / Doubao / custom endpoint); this site provides no key, sells nothing, charges nothing
- Read and accept the terms first; your key stays in your browser, chats go straight to your chosen provider, and this site has no backend and logs nothing
- The model list is fetched after a successful connection; AI output is for reference — trust the textbook and your teacher

### Daily Science

- Fixed block on the homepage: one scientist's quote and short story each day, shuffleable
- Bilingual, with a collapsible story

### Project Structure

```
src/
├── labs/              # Lab components (math / physics / chemistry)
├── components/
│   ├── lab/           # Shared primitives (coord plane / gauges / feedback)
│   ├── layout/        # Shell (Header / Footer)
│   ├── feedback/      # Feedback FAB & panel / share dialog
│   ├── share/         # Inline share button
│   └── ui/            # Generic UI (subject/lab icons, formula, placeholders)
├── lib/               # Registry / subjects / i18n / feedback storage / elements / global state
└── pages/             # Home / subject / lab / periodic table / guide
```

### Feedback

A floating bubble at the bottom-right provides **experiment feedback** and **project feedback**, sent to the developer’s WeChat via Server酱; while offline or on network errors it is queued locally and retried automatically. No account is required.

### License

This project is open-sourced under the **GNU Affero General Public License v3 (AGPL-3.0)** (see `LICENSE`). You are free to use, modify, and distribute it, **but any derivative work must be open-sourced under AGPL-3.0** (including services offered over a network) and **must retain the original author's copyright notice** — no closed-source forks are allowed.

### Disclaimer

- This project is a **teaching/demo and personal inquiry** reference tool and does not constitute professional advice or any guarantee.
- Experimental data, formulas, and interactions have been carefully proofread but are **not guaranteed to be error-free**; teaching should defer to authoritative textbooks.
- Feedback is sent to the developer and queued locally while offline. You are responsible for content saved on your own device.

---

**License**: AGPL-3.0 · Author: Ricky (张子熠) · 在线访问 / Live: https://stem.irky.dev
