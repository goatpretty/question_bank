# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格。

## [Unreleased] - 目标版本 v0.1.0

### Added

- 公开题库数据集 `data/dataset-v1.json` 与来源台账 `docs/data-provenance.csv`
- `scripts/export-public-dataset.ts`，只导出专题、题目、选项三张表
- 完整空库基线迁移 `prisma/migrations/0001_init`
- 幂等 `prisma/seed.ts`，支持公开题库导入与管理员/演示账号初始化
- `CONTRIBUTING.md`、`SECURITY.md`、`THIRD_PARTY_NOTICES.md`
- 自托管 systemd / Nginx 示例
- 生产模式由 Express 同源托管前端静态文件

### Changed

- 项目名改为 `question-bank`，版本 `0.1.0`
- 数据库默认路径改为 `var/question-bank.db`
- 后端构建改为 NodeNext ESM，产物输出到 `dist/api`，并复制 Prisma 生成客户端
- 环境变量集中校验，`JWT_SECRET` 缺失或过短时拒绝启动
- 开发服务器默认只监听 `127.0.0.1`
- 文档重写为源码自托管路径

### Removed

- `.env`、运行数据库、用户数据、历史备份与验收截图（不进入公开仓库）
- Supabase 客户端与相关依赖
- Trae 徽标插件
- 未验证的 Docker、Vercel 配置
- 一次性标点检查脚本与依赖真实运行库的临时脚本

### Security

- JWT 强制校验过期时间、issuer、audience 与 `purpose`，并通过 `tokenVersion` 使改密后的旧会话立即失效
- 密码重置改为数据库存储的一次性 SHA-256 令牌，重复使用返回 401
- 题目渲染不再拼接未清洗 HTML，KaTeX 关闭 `trust`
- 移除前端持久化明文密码，旧 `auth-storage` 状态在升级时清空
- 注册强制邮箱验证；SMTP 未配置时明确拒绝；验证码只存哈希并限制错误次数
- 管理员创建/重置用户使用一次性随机临时密码，首次登录强制改密
- 清理认证、考试、题库与 token 相关调试日志
- 替换 `xlsx` 为 ExcelJS，升级 `nodemailer`、`multer`、`react-router-dom`、`vite`、`katex`；生产依赖无 high/critical 告警
