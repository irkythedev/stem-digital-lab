<div align="center">

# 数理化数字实验室

![version](https://img.shields.io/badge/版本-v0.0.0-blue)
![react](https://img.shields.io/badge/React-19-blue) ![vite](https://img.shields.io/badge/Vite-6-purple) ![tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8) ![katex](https://img.shields.io/badge/KaTeX-0.18-green) ![router](https://img.shields.io/badge/React_Router-7-ff4500) ![lucide](https://img.shields.io/badge/lucide--react-0.546-9ca3af)
![typescript](https://img.shields.io/badge/TypeScript-5.9-3178c6) ![vitest](https://img.shields.io/badge/Vitest-3.2-e5cf0a) ![tsx](https://img.shields.io/badge/tsx-4.21-5c6bc0)

基于初中 7-9 年级课程大纲的数学、物理、化学数字实验与探究平台。
本地运行 · 无需登录 · 数据不上传 · 中英双语 · 深浅主题

</div>

---

## 中文说明

### 简介

数理化数字实验室是一个**本地运行、无需登录、数据不上传**的初中 STEM 探究空间。每个实验都遵循**三幕式探究**（预测 → 探索 → 结论），鼓励学生先猜想、再操作、后归纳，而非被动跟随固定步骤。

- 🌐 中英双语，右上角一键切换
- 🌗 深浅主题（默认浅色，适合希沃/投影大屏）
- 📱 响应式：手机 / 平板 / PC / 希沃大屏
- 🧪 零后端、零上传：反馈与数据仅存本机浏览器 localStorage

### 实验清单

| 科目 | 年级 | 实验 |
|---|---|---|
| 数学 | 7-9 | 一次函数 · 二次函数 · 反比例函数 · 圆的性质 |
| 物理 | 8-9 | 欧姆定律 · 串并联电路 · 凸透镜成像 |
| 化学 | 9 | 质量守恒定律 · 酸碱中和 |

| ID | 名称 | 说明 |
|---|---|---|
| `linear` | 一次函数 | 理解 k 与 b 如何决定直线的走向与截距 |
| `quadratic` | 二次函数 | 探究 a、b、c 对抛物线开口与位置的影响 |
| `inverse` | 反比例函数 | 观察 k 值变化对双曲线形状与位置的影响 |
| `circle` | 圆的性质 | 拖拽验证垂径定理、圆周角定理与直径对直角 |
| `ohm` | 欧姆定律 | 探究电流与电压、电阻的定量关系 |
| `circuits` | 串并联电路 | 对比串联与并联的电流、电压分配规律 |
| `lens` | 凸透镜成像 | 调节物距，观察倒立/正立、放大/缩小的像 |
| `mass-conservation` | 质量守恒定律 | 三个方案对比验证化学反应前后质量不变 |
| `neutralization` | 酸碱中和 | 滴定实验观察 pH 突跃与指示剂颜色变化 |

### 快速开始

```bash
npm install        # 安装依赖
npm run dev        # 开发服务器（默认 http://localhost:3000）
npm run build      # 生产构建
npm run preview    # 本地预览构建产物
npm run test       # 运行测试
npm run lint       # 类型检查
```

> 局域网访问：开发服务器监听 `0.0.0.0`，启动后其他设备打开 `http://<本机局域网IP>:3000`。

### 三幕式探究

每个实验由 **预测 → 探索 → 结论** 三幕构成，**不设硬性步骤锁**，学生可随时返回任意幕：

1. **预测**：先根据已有知识形成猜想，不急着看答案
2. **探索**：拖动滑块、开关、图形，观察参数变化并记录证据
3. **结论**：根据观察完成结论题，再查看反馈与考点速记

> 教学建议：先让学生独立预测 → 再邀请学生描述证据 → 最后共同完成结论。

### 项目结构

```
src/
├── labs/              # 实验组件（math / physics / chemistry）
├── components/
│   ├── lab/           # 共享实验原语（坐标平面/表盘/反馈面板等）
│   ├── layout/        # 外壳（Header / Footer）
│   ├── feedback/      # 反馈气泡与面板
│   └── ui/            # 通用 UI（图标/公式/占位页）
├── lib/               # 注册表 / 科目 / i18n / 反馈存储 / 全局状态
└── pages/             # 首页 / 科目 / 实验 / 使用说明
```

### 反馈

右下角浮动气泡提供**实验反馈**与**项目反馈**，仅保存在本机浏览器 `localStorage`，不上传、不需要账号。

### 版本与标签

当前开发版本：`v0.0.0`。遵循语义化版本（SemVer）：`MAJOR.MINOR.PATCH`。每次发布在 `master` 上打 tag：`git tag -a vX.Y.Z -m "..."`。

---

## English

### Overview

**STEM Digital Lab** is a **local-first, no-login, zero-upload** middle-school STEM exploration space (Grades 7–9). Every lab follows a **three-act inquiry** (Predict → Explore → Conclude) that asks students to guess first, explore freely, then conclude — not to follow fixed step-locks.

- 🌐 Bilingual (zh/en), switchable from the header
- 🌗 Light & dark themes (light by default for classroom projection)
- 📱 Responsive: mobile / tablet / PC / Seewo interactive screen
- 🧪 Zero-backend, zero-upload: feedback & data stay in the browser's localStorage

### Labs

| Subject | Grades | Labs |
|---|---|---|
| Math | 7–9 | Linear · Quadratic · Inverse Variation · Circle Properties |
| Physics | 8–9 | Ohm's Law · Series & Parallel Circuits · Convex Lens Imaging |
| Chemistry | 9 | Conservation of Mass · Acid-Base Titration |

| ID | Name | Description |
|---|---|---|
| `linear` | Linear Functions | Understand how k and b define a line |
| `quadratic` | Quadratic Functions | Explore how a, b, c shape the parabola |
| `inverse` | Inverse Variation | See how k changes the hyperbola |
| `circle` | Circle Properties | Drag to verify chord and inscribed angle theorems |
| `ohm` | Ohm's Law | Explore I = U/R through interactive circuits |
| `circuits` | Series & Parallel Circuits | Compare current and voltage in series vs parallel |
| `lens` | Convex Lens Imaging | Adjust object distance to see real and virtual images |
| `mass-conservation` | Conservation of Mass | Three experiments proving mass is conserved |
| `neutralization` | Acid-Base Titration | Titrate to see the pH jump and indicator color shift |

### Getting Started

```bash
npm install        # Install dependencies
npm run dev        # Dev server (default http://localhost:3000)
npm run build      # Production build
npm run preview    # Preview the build locally
npm run test       # Run tests
npm run lint       # Type-check
```

> LAN access: the dev server listens on `0.0.0.0`; open `http://<your-LAN-IP>:3000` from other devices.

### Three-Act Inquiry

Each lab is built from **Predict → Explore → Conclude** with **no hard step-locks**; students can revisit any act at any time:

1. **Predict**: make a guess from prior knowledge before seeing the answer
2. **Explore**: drag sliders, switches, or shapes, observe changes, and record evidence
3. **Conclude**: answer conclusion questions, then check feedback and key points

> Teaching suggestion: let students predict independently, invite them to describe evidence, then complete the conclusion together.

### Project Structure

```
src/
├── labs/              # Lab components (math / physics / chemistry)
├── components/
│   ├── lab/           # Shared primitives (coord plane / gauges / feedback)
│   ├── layout/        # Shell (Header / Footer)
│   ├── feedback/      # Feedback FAB & panel
│   └── ui/            # Generic UI (icons / formula / placeholders)
├── lib/               # Registry / subjects / i18n / feedback storage / global state
└── pages/             # Home / subject / lab / guide
```

### Feedback

A floating bubble at the bottom-right provides **experiment feedback** and **project feedback**, stored only in the browser's `localStorage` — nothing is uploaded and no account is required.

### Versioning & Tags

Current dev version: `v0.0.0`. Follows Semantic Versioning (SemVer): `MAJOR.MINOR.PATCH`. Tag each release on `master`: `git tag -a vX.Y.Z -m "..."`.

---

**License**: Apache-2.0 · Author: Ricky (张子熠)
