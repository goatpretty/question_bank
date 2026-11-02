/**
 * 前端运行时配置。
 *
 * 通过独立模块封装 `import.meta.env`，便于 Jest 等非 Vite 环境替换实现。
 */
export const API_HOST = import.meta.env.VITE_API_URL ? String(import.meta.env.VITE_API_URL) : '';
