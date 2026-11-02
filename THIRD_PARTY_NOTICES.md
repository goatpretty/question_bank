# 第三方组件与许可

本项目依赖开源软件。以下为直接依赖的主要许可信息，完整列表以 `package-lock.json` 中各包的 `license` 字段为准。

## 运行时依赖

| 组件 | 许可 | 用途 |
| --- | --- | --- |
| React / React DOM | MIT | 前端 UI |
| React Router | MIT | 前端路由 |
| Zustand | MIT | 状态管理 |
| Tailwind CSS | MIT | 样式 |
| KaTeX | MIT | 数学公式渲染 |
| KaTeX 字体 | SIL Open Font License 1.1 | 公式字体 |
| lucide-react | ISC | 图标 |
| Radix UI | MIT | 对话框、下拉菜单、选择器 |
| Express | MIT | HTTP 服务 |
| Prisma / @prisma/client | Apache-2.0 | ORM 与迁移 |
| better-sqlite3 | MIT | SQLite 驱动 |
| bcryptjs | MIT | 密码哈希 |
| jsonwebtoken | MIT | JWT |
| nodemailer | MIT | 邮件发送 |
| multer | MIT | 文件上传 |
| ExcelJS | MIT | Excel 解析与模板生成 |
| helmet | MIT | HTTP 安全头 |
| express-rate-limit | MIT | 限流 |
| dotenv | BSD-2-Clause | 环境变量加载 |
| clsx / tailwind-merge | MIT | 样式工具 |

## 开发依赖

| 组件 | 许可 |
| --- | --- |
| TypeScript | Apache-2.0 |
| Vite | MIT |
| @vitejs/plugin-react | MIT |
| Jest / ts-jest | MIT |
| Testing Library | MIT |
| ESLint / typescript-eslint | MIT |
| PostCSS / Autoprefixer | MIT |

## 说明

- 分发前端构建产物时，请保留 KaTeX 字体及相关许可声明。
- 若替换 ExcelJS 或其他依赖，请同步更新本文件与 `package-lock.json`。
- 本文件不构成法律意见；发布前建议用许可扫描工具复核。
