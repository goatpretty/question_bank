import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { visualizer } from 'rollup-plugin-visualizer';

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      }
    }
  },
  build: {
    sourcemap: 'hidden',
    // 代码分割配置
    rollupOptions: {
      output: {
        manualChunks: {
          // 将第三方库拆分到独立的chunk
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'state-vendor': ['zustand'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          'math-vendor': ['katex'],
        },
        // 启用长期缓存
        // 使用sha256哈希函数（Rollup默认支持）
      },
    },
    // 启用压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.warn'],
      },
    },
    // 优化静态资源
    assetsInlineLimit: 4096, // 小于4kb的资源内联
    cssCodeSplit: true,
  },
  plugins: [
    react(),
    tsconfigPaths(),
    // 可选：构建可视化分析
    process.env.NODE_ENV === 'production' && visualizer({
      open: false,
      filename: 'dist/stats.html',
    }),
  ],
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand'],
    exclude: ['katex'],
  },
})
