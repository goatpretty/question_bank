# v0.1.0 发布就绪记录

检查日期：2026年11月02日。对应计划：[open-source-release-plan-2026-11-02.md](open-source-release-plan-2026-11-02.md)。

## 1. 审计项完成情况

| 审计项 | 级别 | 状态 | 交付/验证 |
| --- | --- | --- | --- |
| A01 环境文件边界 | P0 | 完成 | `.gitignore` 排除 `.env*`、数据库、WAL/SHM、备份、证据目录；已提交内容仅含 `.env.example` 占位值。 |
| A02 运行数据分发 | P0 | 完成 | `data/dataset-v1.json` 仅含专题、题目、选项；断言无用户、邮箱、`password_hash`、作答或会话字段。数据库文件与 `api/data/` 不进入仓库。 |
| A03 JWT 与令牌 | P0 | 完成 | 强制 HS256、过期时间、issuer、audience、`purpose=access`；`tokenVersion` 使改密后旧令牌失效；重置令牌为数据库一次性 SHA-256 记录。 |
| A04 XSS 与明文密码 | P0 | 完成 | `MathRenderer` 不再拼接原始 HTML，KaTeX `trust: false`；Zustand `persist` 版本迁移清除旧密码字段。 |
| A05 许可证 | P1 | 完成 | 根 `LICENSE` 为 MIT；`package.json` 为 `"license": "MIT"`；README 一致。 |
| A06 题库再分发声明 | P1 | 完成 | `data/LICENSE`（CC BY 4.0）、`data/ATTRIBUTION.md`、`docs/data-provenance.csv`；题库按维护者确认全部公开。 |
| A07 空库初始化 | P1 | 完成 | `0001_init` + `0002_auth_security` 迁移可在空库应用；`prisma/seed.ts` 幂等导入 49 个专题、1514 道题、6052 个选项；不依赖运行库副本或私有 JSON。 |
| A08 后端构建启动 | P1 | 完成 | NodeNext ESM，入口 `dist/api/server.js`；生产模式 Express 同源托管前端；数据库路径以启动工作目录解析。 |
| A09 测试/Lint/CI | P1 | 完成 | Jest 9 个 suite / 104 个测试通过；ESLint 0 error / 242 warning；CI 覆盖生成、类型检查、Lint、测试、构建、迁移、seed 与生产 smoke。 |
| A10 依赖告警 | P1 | 完成 | `xlsx` 已替换为 ExcelJS；`nodemailer`、`multer`、`react-router-dom`、`vite` 已升级；生产依赖 0 critical / 0 high，残余项见 `docs/dependency-status.md`。 |
| A11 注册/默认密码/日志 | P1 | 完成 | 注册强制邮箱验证；SMTP 未配置时明确拒绝；验证码只存哈希、限制错误次数与发送频率；管理员临时密码一次性展示并强制首次改密；认证/考试/题库调试日志已清理。 |
| A12 考试答案与教师权限 | P1 | 完成 | 考试进行中不下发答案与解析；README 明确自测定位与教师共享权限策略。 |
| A13 部署一致性 | P1 | 完成 | 删除 Docker/Vercel 配置；只承诺本地/自托管源码运行；提供 systemd/Nginx 示例；`.nvmrc` 与 `engines` 对齐 Node 22。 |

## 2. 本地验证结果

```text
npm run typecheck:client   通过
npm run typecheck:server   通过
npm run lint               0 errors, 242 warnings
npm test                   9 suites, 104 tests passed
npm run build:all          成功，产物 dist/index.html 与 dist/api/server.js
```

## 3. 干净副本验证

在仓库外全新目录执行 `git clone`（仅提交内容），随后：

```text
npm ci                     成功
npm run db:generate        成功
npm run db:migrate         0001_init、0002_auth_security 全部应用
npm run db:seed            49 专题 / 1514 题 / 6052 选项；创建管理员
npm run typecheck:client   通过
npm run typecheck:server   通过
npm run lint               0 errors
npm test                   9 suites, 104 tests passed
npm run build:all          成功
NODE_ENV=production npm start
```

生产 smoke 结果（端口 3102）：

| 请求 | 结果 |
| --- | --- |
| `GET /api/health` | 200 |
| `GET /api/questions/topics` | 200 |
| `GET /` | 200 |
| `GET /wrongbook`（SPA fallback） | 200 |
| `POST /api/auth/login`（管理员） | 200，返回 token 与 `needPasswordChange: true` |
| `GET /api/auth/me` | 200 |
| `GET /api/practice/history`（未改密） | 403，强制改密门禁生效 |

干净副本 `npm audit --omit=dev`：**0 critical / 0 high / 9 moderate / 1 low**，分析见 `docs/dependency-status.md`。

## 4. 发布前文件检查

- `git ls-files` 共 150 个文件，不含 `.env`、`.env.production`、`*.db`、`var/`、`api/data/`、`.codex-backups/`、`docs/round4-evidence/`、`docs/毛概-新增/`。
- 暂存内容密钥扫描仅命中占位值与说明文字；无真实 SMTP、AI、JWT 凭据。
- `data/dataset-v1.json`、`data/LICENSE`、`data/ATTRIBUTION.md`、根 `LICENSE`、`THIRD_PARTY_NOTICES.md` 均已包含。
- `docs/data-provenance.csv` 1514 条记录，覆盖全部题目，用于署名与追溯，不作为发布过滤器。

## 5. 发布后仍需处理

- 如 `SMTP_PASS`、`AI_API_KEY` 曾在仓库外传播，应在对应服务商控制台轮换；新值只写入部署环境，不提交。
- GitHub 仓库启用 secret scanning、Dependabot alerts，并为 `main` 配置分支保护与 CI 必需检查。
- 每周处理 Dependabot PR，每月复跑 `npm audit --omit=dev`。
