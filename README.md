# Question Bank 智能题库

面向课程复习的题库管理与学习系统，支持学生、教师、管理员三种角色，提供练习、错题本、在线考试、题目导入和可选 AI 助手。

当前版本：`0.1.0`。首发只承诺**源码本地 / 自托管运行**，不提供 Docker 或 Vercel 部署支持。

## 功能

### 学生
- 按专题练习，支持单选、多选、填空、主观题
- 练习提交与结果回顾
- 错题本与掌握状态
- 考试作答与成绩查看
- 个人设置：直接修改密码（无需邮件）、上传并裁剪头像；用户名与邮箱为只读账号信息
- KaTeX 数学公式展示

### 教师
- 题目与专题管理
- Excel / JSON 题目导入
- 考试创建、发布、归档
- 学习数据与考试统计

### 管理员
- 用户与角色管理
- 密码重置与强制改密
- SMTP 与 AI 配置（管理端在线修改，无需重启）
- 系统配置与数据维护

## 技术栈

- 前端：React 18、TypeScript、Vite、Tailwind CSS、Zustand、React Router、KaTeX
- 后端：Express 5、TypeScript、Prisma 7、SQLite、JWT、bcrypt
- 测试：Jest、Testing Library

## 环境要求

- Node.js `>=20.19 <21` 或 `>=22.12`（推荐 22 LTS）
- npm 10+

## 快速开始

```bash
git clone https://github.com/goatpretty/question_bank.git
cd question_bank
npm ci

# 生成 .env，并自动写入随机 JWT_SECRET
npm run env:init

# 编辑 .env，填写管理员账号：
#   ADMIN_EMAIL=admin@example.com
#   ADMIN_INITIAL_PASSWORD='至少8位且包含字母和数字'
# 然后初始化数据库并导入题库
npm run setup
```

`npm run setup` 会校验 `.env`、生成 Prisma Client、应用迁移并导入 `data/dataset-v1.json`。首次运行必须提供管理员账号，或在本地开发时使用演示账号：

```bash
# 仅开发环境：创建 admin / teacher / student 演示账号，密码只打印一次
SEED_DEMO=true npm run setup
```

自助注册依赖邮件验证码，因此需要同时配置 `SMTP_ENABLED=true` 与 SMTP 账号；未配置 SMTP 时请由管理员创建账号。

管理员登录后也可以进入「管理端 → 系统设置」，在线修改 SMTP 与 AI 配置并发送测试邮件 / 测试 AI 连接，保存后立即生效，无需重启服务。敏感凭据使用由 `JWT_SECRET` 派生的密钥加密后保存在数据库中；数据库中的配置优先于 `.env`，也可以一键恢复为 `.env` 配置。

> `.env` 已被 `.gitignore` 排除，只保存在本机；请勿把真实凭据写入 `.env.example` 或提交到仓库。

启动开发环境（两个终端）：

```bash
# 终端 1：后端 API，默认 http://localhost:3001
npm run dev:server

# 终端 2：前端，默认 http://localhost:5173
npm run dev
```

## 自托管运行

```bash
npm run build:all
NODE_ENV=production npm start
```

生产模式下 Express 会同时托管 `dist/` 前端静态文件和 `/api` 接口，默认监听 `PORT`（3001）。建议在反向代理后运行：

- 使用 HTTPS
- 设置 `FRONTEND_URL` 为实际访问地址
- 如果反向代理传递 `X-Forwarded-For`，设置 `TRUST_PROXY=1`
- 限制上传体积（题目导入默认单文件 10 MB，见 `api/routes/questions.ts`；头像单文件 2 MB）
- 定期备份 `var/question-bank.db` 与上传目录 `var/uploads/`（头像等运行期文件）

`deploy/` 目录提供 systemd 与 Nginx 示例，仅作参考，需按实际环境修改。

### 升级

```bash
# 1. 停止服务并备份数据库
cp var/question-bank.db var/question-bank.db.bak-$(date +%Y%m%d)
# 2. 更新代码
git pull
npm ci
npm run db:generate
npm run db:migrate
npm run build:all
# 3. 重启服务
```

## 环境变量

| 变量 | 必填 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 是 | SQLite 文件地址，必须以 `file:` 开头 | `file:./var/question-bank.db` |
| `JWT_SECRET` | 是 | JWT 签名密钥，至少 32 个字符 | 无，缺失时拒绝启动 |
| `JWT_EXPIRES_IN` | 否 | 访问令牌有效期 | `7d` |
| `NODE_ENV` | 否 | `development` / `test` / `production` | `development` |
| `PORT` | 否 | 后端端口 | `3001` |
| `FRONTEND_URL` | 生产建议 | 前端访问地址，用于 CORS | 空 |
| `TRUST_PROXY` | 否 | 信任的反向代理层数 | `0` |
| `UPLOAD_DIR` | 否 | 运行期上传目录（头像等），相对路径以项目根目录为基准 | `var/uploads` |
| `SMTP_ENABLED` | 自助注册时必填 | 启用邮件验证码；关闭时只能由管理员创建账号 | `false` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | 否 | SMTP 连接配置 | — |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | 否 | SMTP 账号与发件人 | — |
| `AI_ENABLED` | 否 | 是否启用 AI 助手 | `false` |
| `AI_BASE_URL` / `AI_MODEL` / `AI_API_KEY` | 否 | OpenAI 兼容接口配置 | — |
| `AI_TIMEOUT_MS` | 否 | AI 请求超时 | `30000` |
| `AI_DAILY_QUOTA` | 否 | 每用户每日调用额度 | `50` |
| `SEED_DEMO` | 否 | 是否创建演示账号 | `false` |
| `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` | 否 | 首次初始化管理员 | 空 |

> `VITE_*` 变量会进入前端构建产物，不能存放服务端秘密。

> `SMTP_*` 与 `AI_*` 同时作为管理端在线配置的初始值；一旦在管理端保存过对应分组，就以数据库中的配置为准。

## 题库数据

- 公开数据集：`data/dataset-v1.json`，当前 49 个专题、1514 道题、6052 个选项。
- 逐题来源与署名：`docs/data-provenance.csv`。
- 数据许可证：CC BY 4.0，见 `data/LICENSE` 与 `data/ATTRIBUTION.md`。
- 重新导出：`npm run db:export`。

数据集只包含专题、题目和选项，不包含用户账号、考试提交、练习作答或错题记录。

## 测试

```bash
npm test
npm run typecheck:client
npm run typecheck:server
npm run lint
```

## 项目结构

```text
api/                后端 Express 应用
  routes/           认证、题目、练习、考试、用户、AI 接口
  middleware/       认证、错误处理
  services/         考试规则、错题本、学习提交
  db/               Prisma 客户端
prisma/             schema、迁移、seed
src/                前端 React 应用
  components/       通用组件
  pages/            页面
  services/         API 客户端
  stores/           Zustand 状态
shared/             前后端共享类型
data/               公开题库数据集与数据许可证
deploy/             systemd / Nginx 示例
docs/               题库来源台账与署名信息
scripts/            导出、构建辅助脚本
var/                本地数据库与运行数据（不提交）
```

## 已知限制

- 当前考试模式以学习/自测为主，不提供防作弊保证。考试进行中的单题接口不返回标准答案和解析，但题库/练习接口本身是学习功能，仍可读取题目答案；不要把本系统用于高风险正式考试。
- 教师角色当前共享全部考试的管理权限（创建、编辑、发布、删除），不按 `createdBy` 隔离；管理员拥有同等或更高权限。如需要多租户隔离，应在业务层另行实现。
- SQLite 适合单实例自托管；多实例部署需要改用其他数据库并重新验证。
- AI 助手默认关闭；开启后用户提问与题目上下文会发送到所配置的外部服务。
- 首发不包含 Docker、Vercel 或 PostgreSQL 生产方案。

## 安全

发现问题请阅读 `SECURITY.md`，通过私下渠道报告，不要在公开 issue 中披露漏洞细节。

## 贡献

见 `CONTRIBUTING.md`。

## 许可证

- 代码：MIT，见 `LICENSE`。
- 题库数据：CC BY 4.0，见 `data/LICENSE`。
- 第三方组件：见 `THIRD_PARTY_NOTICES.md`。
