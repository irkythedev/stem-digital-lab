# 数理化数字实验室 / STEM Digital Lab

> 基于初中 7-9 年级课程大纲的数学、物理、化学数字实验与探究平台。
> An interactive digital experiment & inquiry platform for Grades 7–9 math, physics, and chemistry.

> **当前开发版本 / Current dev version: `v0.0.0`** · 三幕式探究（预测 → 探索 → 结论）· 中英双语 · 深浅主题

---

## 简介 / Overview

数理化数字实验室是一个**本地运行、无需登录、数据不上传**的初中 STEM 探究空间。每个实验都遵循**三幕式探究**（预测 → 探索 → 结论），鼓励学生先猜想、再操作、后归纳，而非被动跟随步骤。

A local-first, no-login STEM inquiry space. Every lab follows a **three-act inquiry** (Predict → Explore → Conclude) that asks students to guess first, explore freely, then conclude — not to follow fixed step-locks.

- 🌐 **中英双语** / Bilingual (zh/en)
- 🌗 **深浅主题**（默认浅色，适合希沃/投影大屏） / Light & dark themes (light by default for classroom projection)
- 📱 **响应式**：手机 / 平板 / PC / 希沃大屏 / Responsive across devices
- 🧪 **零后端、零上传**：反馈与数据仅存本机 localStorage / Zero-backend, zero-upload: feedback stays local

## 三大科目与实验 / Subjects & Labs

| 科目 / Subject | 年级 / Grades | 实验 / Labs |
|---|---|---|
| 数学 Math | 7–9 | 一次函数 · 二次函数 · 反比例函数 · 圆的性质 |
| 物理 Physics | 8–9 | 欧姆定律 · 串并联电路 · 凸透镜成像 |
| 化学 Chemistry | 9 | 质量守恒定律 · 酸碱中和 |

**实验清单 / Lab list**

| ID | 名称 (zh/en) | 说明 |
|---|---|---|
| `linear` | 一次函数 / Linear Functions | 理解 k 与 b 如何决定直线的走向与截距 |
| `quadratic` | 二次函数 / Quadratic Functions | 探究 a、b、c 对抛物线开口与位置的影响 |
| `inverse` | 反比例函数 / Inverse Variation | 观察 k 值变化对双曲线形状与位置的影响 |
| `circle` | 圆的性质 / Circle Properties | 拖拽验证垂径定理、圆周角定理与直径对直角 |
| `ohm` | 欧姆定律 / Ohm's Law | 探究电流与电压、电阻的定量关系 |
| `circuits` | 串并联电路 / Series & Parallel Circuits | 对比串联与并联的电流、电压分配规律 |
| `lens` | 凸透镜成像 / Convex Lens Imaging | 调节物距，观察倒立/正立、放大/缩小的像 |
| `mass-conservation` | 质量守恒定律 / Conservation of Mass | 三个方案对比验证化学反应前后质量不变 |
| `neutralization` | 酸碱中和 / Acid-Base Titration | 滴定实验观察 pH 突跃与指示剂颜色变化 |

## 快速开始 / Getting Started

```bash
# 安装依赖 / Install dependencies
npm install

# 开发服务器（默认 http://localhost:3000）/ Dev server
npm run dev

# 生产构建 / Production build
npm run build

# 本地预览构建产物 / Preview the build
npm run preview

# 测试 / Run tests
npm run test

# 类型检查 / Type-check
npm run lint
```

> 局域网内其他设备访问：启动后打开 `http://<本机局域网IP>:3000`（默认监听 `0.0.0.0`）。
> For LAN access: open `http://<your-LAN-IP>:3000` (dev server listens on `0.0.0.0`).

## 技术栈 / Tech Stack

**核心 / Core**
- [React 19](https://react.dev/) + [Vite 6](https://vitejs.dev/)（开发/构建工具）
- [React Router 7](https://reactrouter.com/)（路由）
- [Tailwind CSS 4](https://tailwindcss.com/)（样式）
- [KaTeX 0.18](https://katex.org/)（数学公式渲染）
- [lucide-react](https://lucide.dev/)（图标）

**依赖清单 / Dependencies**（见 `package.json`）

| 包 / Package | 版本 | 用途 |
|---|---|---|
| `react` / `react-dom` | ^19.0.1 | UI 框架 |
| `react-router-dom` | ^7.18.2 | 路由 |
| `vite` | ^6.2.3 | 构建工具 |
| `@vitejs/plugin-react` | ^5.0.4 | React 插件 |
| `@tailwindcss/vite` | ^4.1.14 | Tailwind 插件 |
| `tailwindcss` | ^4.1.14 | 样式框架 |
| `katex` | ^0.18.1 | 公式渲染 |
| `lucide-react` | ^0.546.0 | 图标库 |

**开发依赖 / Dev Dependencies**

| 包 / Package | 版本 | 用途 |
|---|---|---|
| `typescript` | ^5.9.3 | 类型系统 |
| `vitest` | ^3.2.7 | 测试框架 |
| `tsx` | ^4.21.0 | smoke 测试运行器 |
| `@types/react` / `@types/react-dom` | ^19.x | React 类型 |
| `@types/katex` / `@types/node` | — | 类型声明 |
| `autoprefixer` | ^10.4.21 | 样式兼容 |

## 项目结构 / Project Structure

```
src/
├── labs/                    # 实验组件（按科目分组）
│   ├── math/                # 数学实验
│   ├── physics/             # 物理实验
│   └── chemistry/           # 化学实验
├── components/
│   ├── lab/                 # 共享实验原语（坐标平面/表盘/反馈面板等）
│   ├── layout/              # 外壳（Header / Footer）
│   ├── feedback/            # 反馈气泡与面板
│   └── ui/                  # 通用 UI（图标/公式/占位页）
├── lib/
│   ├── labs.ts              # 实验注册表
│   ├── subjects.ts          # 科目元数据
│   ├── i18n.ts              # 中英文翻译
│   ├── feedback.ts          # 本地反馈存储
│   └── app-context.tsx      # 语言 + 主题全局状态
└── pages/                   # 页面（首页/科目/实验/使用说明）
```

## 三幕式探究设计 / Three-Act Inquiry

每个实验由 **预测 (Predict) → 探索 (Explore) → 结论 (Conclude)** 三幕构成，**不设硬性步骤锁**，学生可随时返回任意幕：

1. **预测**：先根据已有知识形成猜想，不急着看答案
2. **探索**：拖动滑块、开关、图形，观察参数变化并记录证据
3. **结论**：根据观察完成结论题，再查看反馈与考点速记

> 教学建议：先让学生独立预测 → 再邀请学生描述证据 → 最后共同完成结论。

## 反馈 / Feedback

右下角浮动气泡提供**实验反馈**与**项目反馈**，仅保存在本机浏览器 `localStorage`，不上传、不需要账号。

## 开发版本与标签 / Versioning & Tags

| 标识 / Tag | 说明 |
|---|---|
| `v0.0.0` | 当前开发版 / Current development build |

- 开发迭代遵循**语义化版本**（SemVer）：`MAJOR.MINOR.PATCH`
- 每次发布在 `master` 上打 tag：`git tag -a vX.Y.Z -m "..."`

---

**License**: Apache-2.0 · 作者 / Author: Ricky (张子熠)
