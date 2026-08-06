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

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    versionJson(),
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
