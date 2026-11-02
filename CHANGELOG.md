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
- `npm run env:init` 首次生成 `.env` 并写入随机 `JWT_SECRET`
- `npm run setup` 在初始化前校验管理员账号或演示账号配置
- 公开只读接口 `/api/meta`，首页与管理页展示版本、注册/AI 状态与许可证
- 题库统计接口新增 `totals`（专题、题目、选项），首页展示当前部署的真实数据
- 管理端系统设置支持在线修改 SMTP 与 AI 配置：保存后立即生效、发送测试邮件、测试 AI 连接、一键恢复 `.env` 配置
- SMTP 密码与 AI API Key 使用 `JWT_SECRET` 派生密钥加密存库，接口只返回是否已配置，不回显明文
- 个人设置支持修改用户名 / 邮箱、校验当前密码后直接修改密码（无需邮件），并签发新令牌使旧会话失效
- 头像上传：支持 JPG / PNG / WebP、单文件 2 MB 限制，内置方形与圆形裁剪器，文件保存在 `var/uploads/avatars`

### Changed

- 项目名改为 `question-bank`，版本 `0.1.0`
- 数据库默认路径改为 `var/question-bank.db`
- 后端构建改为 NodeNext ESM，产物输出到 `dist/api`，并复制 Prisma 生成客户端
- 环境变量集中校验，`JWT_SECRET` 缺失或过短时拒绝启动
- 开发服务器默认只监听 `127.0.0.1`
- 文档重写为源码自托管路径
- 首页重写为开源项目介绍：真实功能、自托管步骤、许可证与社区链接，移除虚构统计和用户评价
- 管理端「系统设置」改为真实部署信息页，移除没有逻辑的保存/应用按钮
- 导航栏移除未实现的搜索与通知入口，补充 GitHub 仓库链接与准确的功能描述
- `/profile` 合并进 `/settings`，旧地址自动重定向；导航、移动端顶栏统一展示头像入口
- 管理端系统设置中 SMTP 与 AI 卡片改为同一行两列，压缩留白

### Removed

- `.env`、运行数据库、用户数据、历史备份与验收截图（不进入公开仓库）
- Supabase 客户端与相关依赖
- Trae 徽标插件
- 未验证的 Docker、Vercel 配置
- 独立的个人资料页 `src/pages/Profile.tsx`（功能并入个人设置）
- 一次性标点检查脚本与依赖真实运行库的临时脚本
- 公开仓库中的内部审计、发布计划、发布验收与依赖状态文档（仅保留在本地）

### Security

- JWT 强制校验过期时间、issuer、audience 与 `purpose`，并通过 `tokenVersion` 使改密后的旧会话立即失效
- 密码重置改为数据库存储的一次性 SHA-256 令牌，重复使用返回 401
- 题目渲染不再拼接未清洗 HTML，KaTeX 关闭 `trust`
- 移除前端持久化明文密码，旧 `auth-storage` 状态在升级时清空
- 注册强制邮箱验证；SMTP 未配置时明确拒绝；验证码只存哈希并限制错误次数
- 管理员创建/重置用户使用一次性随机临时密码，首次登录强制改密
- 清理认证、考试、题库与 token 相关调试日志
- 替换 `xlsx` 为 ExcelJS，升级 `nodemailer`、`multer`、`react-router-dom`、`vite`、`katex`；生产依赖无 high/critical 告警
