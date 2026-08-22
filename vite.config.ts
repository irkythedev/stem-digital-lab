import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 构建结束钩子：在 dist/ 生成 version.json（版本号 + 构建时间戳）。
 * 前端用它对比本地版本号，检测到新版本时在 Header 显示绿色圆点提示。
 * 该文件刻意排除出 SW precache，确保每次都是最新值。
 */
function versionJson(): Plugin {
  return {
    name: 'write-version-json',
    closeBundle() {
      const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
      const out = path.resolve(__dirname, 'dist/version.json');
      writeFileSync(out, JSON.stringify({ version: pkg.version, builtAt: Date.now() }, null, 2));
    },
  };
}

/** 站点域名（GEO 生成文件里的绝对 URL） */
const SITE_URL = 'https://stem.irky.dev';

interface LabSeo {
  id: string;
  zhName: string;
  enName: string;
  zhDesc: string;
  enDesc: string;
}

/** 从 src/lib/labs.ts 注册表解析实验元信息（GEO 文件随注册表自动更新） */
function parseLabs(): LabSeo[] {
  const src = readFileSync(path.resolve(__dirname, 'src/lib/labs.ts'), 'utf-8');
  const blocks = src.match(/\n  \{\n(.*?)\n  \},/gs) ?? [];
  const out: LabSeo[] = [];
  /** 从形如 zh: 'xx', en: "yy" 的字段块中取键值（兼容单双引号与转义） */
  const val = (block: string, key: string): string => {
    const m = block.match(new RegExp(`${key}:\\s*(["'])(.*?)\\1`));
    return m ? m[2] : '';
  };
  for (const b of blocks) {
    const id = val(b, 'id');
    const nameBlock = b.match(/name:\s*\{([^}]*)\}/)?.[1] ?? '';
    const descBlock = b.match(/description:\s*\{([^}]*)\}/)?.[1] ?? '';
    const zhName = val(nameBlock, 'zh');
    const enName = val(nameBlock, 'en');
    if (id && zhName && enName) {
      out.push({ id, zhName, enName, zhDesc: val(descBlock, 'zh'), enDesc: val(descBlock, 'en') });
    }
  }
  return out;
}

/** 4 个查表工具（固定路由） */
const TOOLS: { path: string; zhName: string; enName: string; zhDesc: string; enDesc: string }[] = [
  { path: '/periodic-table', zhName: '元素周期表', enName: 'Periodic Table', zhDesc: '118 元素 · 实物照片 · 读音（男 / 女声）· 中考跟读', enDesc: '118 elements, photos, pronunciation (male/female voice), recite mode' },
  { path: '/physics-constants', zhName: '物理常量速查', enName: 'Physics Constants', zhDesc: '常用物理常量一览', enDesc: 'Common physics constants at a glance' },
  { path: '/physics-formulas', zhName: '物理公式速查', enName: 'Physics Formulas', zhDesc: '电学 / 力学 / 光学公式整理', enDesc: 'Electricity, mechanics and optics formulas' },
  { path: '/math-formulas', zhName: '数学公式速查', enName: 'Math Formulas', zhDesc: '代数 / 几何 / 函数 / 统计公式整理', enDesc: 'Algebra, geometry, functions and statistics formulas' },
];

const SUBJECT_PAGES = [
  { path: '/subject/math', zh: '数学', en: 'Math' },
  { path: '/subject/physics', zh: '物理', en: 'Physics' },
  { path: '/subject/chemistry', zh: '化学', en: 'Chemistry' },
];

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * GEO（生成式引擎优化）构建钩子：从实验注册表生成
 *   - dist/llms.txt   —— llmstxt.org 标准，AI 引擎直接消费的站点目录
 *   - dist/sitemap.xml—— 全路由站点地图，帮助搜索引擎与 AI 爬虫发现所有页面
 */
function seoAssets(): Plugin {
  return {
    name: 'write-seo-assets',
    closeBundle() {
      const labs = parseLabs();
      const now = new Date().toISOString().slice(0, 10);

      // ---------- llms.txt ----------
      const lines: string[] = [];
      lines.push('# 数理化数字实验室 · STEM Digital Lab');
      lines.push('');
      lines.push('> 面向初中 7-9 年级的数学、物理、化学数字实验与探究平台：无需登录、中英双语、深浅主题，15 个交互实验 + 4 个查表工具，另有 AI 学习助手（自带 Key）。');
      lines.push('');
      lines.push('## 实验 · Labs');
      lines.push('');
      for (const lab of labs) {
        const u = `${SITE_URL}/lab/${lab.id}`;
        const zh = `- [${lab.zhName}（${lab.enName}）](${u})：${lab.zhDesc || '交互探究实验'}`;
        lines.push(zh);
      }
      lines.push('');
      lines.push('## 查表工具 · Lookup Tools');
      lines.push('');
      for (const t of TOOLS) {
        lines.push(`- [${t.zhName}（${t.enName}）](${SITE_URL}${t.path})：${t.zhDesc}`);
      }
      lines.push('');
      lines.push('## 科目页 · Subjects');
      lines.push('');
      for (const s of SUBJECT_PAGES) {
        lines.push(`- [${s.zh}（${s.en}）](${SITE_URL}${s.path})`);
      }
      lines.push('');
      lines.push('## 其他 · More');
      lines.push('');
      lines.push(`- [使用说明 Guide](${SITE_URL}/guide)`);
      lines.push(`- [开源协议 License](${SITE_URL}/license)`);
      lines.push('');
      writeFileSync(path.resolve(__dirname, 'dist/llms.txt'), lines.join('\n'));

      // ---------- sitemap.xml ----------
      const urls: { path: string; priority: string; freq: string }[] = [
        { path: '/', priority: '1.0', freq: 'weekly' },
        { path: '/guide', priority: '0.5', freq: 'monthly' },
        ...SUBJECT_PAGES.map((s) => ({ path: s.path, priority: '0.7', freq: 'weekly' })),
        ...labs.map((lab) => ({ path: `/lab/${lab.id}`, priority: '0.8', freq: 'weekly' })),
        ...TOOLS.map((t) => ({ path: t.path, priority: '0.8', freq: 'weekly' })),
        { path: '/license', priority: '0.3', freq: 'yearly' },
      ];
      const urlXml = urls
        .map(
          (u) =>
            `  <url>\n    <loc>${xmlEscape(SITE_URL + u.path)}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
        )
        .join('\n');
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlXml}\n</urlset>\n`;
      writeFileSync(path.resolve(__dirname, 'dist/sitemap.xml'), sitemap);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    versionJson(),
    seoAssets(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '数理化数字实验室',
        short_name: '数理化实验',
        description: '基于初中 7-9 年级课程大纲的数学、物理、化学数字实验与探究平台',
        lang: 'zh-CN',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#111210',
        theme_color: '#111210',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,ttf}'],
        globIgnores: ['**/version.json', '**/audio/*.mp3'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  build: {},
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});
