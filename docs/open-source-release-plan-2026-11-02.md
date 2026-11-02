# Question Bank 开源发布详细计划

制定日期：2026年11月02日。依据：[开源准备审计报告](open-source-audit-2026-11-01.md)。

## 0. 已确认的发布决策

| 决策项 | 结论 | 影响 |
| --- | --- | --- |
| 题库数据 | 代码 + 现有全部题库（维护者确认可公开） | 题目内容全部发布；仍需剥离用户表、作答记录、错题记录等运行数据，数据库文件本身不发布。 |
| 部署路径 | 仅本地 / 自托管源码运行 | 首发不承诺 Docker、Vercel；删除或隔离未验证的部署配置，README 只描述 `npm` 自托管路径。 |
| 修复范围 | P0 + P1 全部完成后首发 | 按审计 §5 发布验收清单一次性完成，再打 `v0.1.0`。 |
| 代码许可证 | 默认 MIT（沿用 README 声明，待确认权利主体） | 需补 LICENSE、版权主体与年份；题库数据另设数据许可证。 |
| 发布仓库 | 新仓库 `goatpretty/question_bank`，全新历史 | 当前目录无 `.git`；首次提交必须使用显式白名单，禁止 `git add .`。 |

**总原则：先立发布边界，再修安全，再做可复现工程，最后在干净环境验收。** 题库发布声明与凭据轮换可以并行推进，但不得跳过用户数据剥离。

---

## 1. 总体路线与里程碑

```
阶段 0  声明、凭据与冻结
   ↓
阶段 1  发布边界 + 仓库初始化（P0 A01/A02，P1 A05/A06/A15）
   ↓
阶段 2  认证与前端安全（P0 A03/A04，P1 A11）
   ↓
阶段 3  可复现工程（P1 A07/A08/A09/A10/A13）
   ↓
阶段 4  权限与资源边界（P1 A12，P2 A14）
   ↓
阶段 5  干净环境验收（审计 §5 全部勾选项）
   ↓
阶段 6  发布 v0.1.0 与运营
```

预计工期（单人 + AI 辅助）：**约 2.5～3.5 周**。题库内容已确认可公开，阶段 0 的声明与凭据轮换可在 1～2 天内完成；其余阶段约 2～3 周。

---

## 2. 阶段 0：声明、凭据与冻结（1～2 天）

### 0.1 代码许可确认

- 确认代码版权主体（个人 `goatpretty` 或组织），版权年份写 `2026`。
- 确认项目中没有复制自其他项目的、许可证不兼容的代码；重点检查 `shared/`、`src/lib/`、`api/services/`。
- 采用 MIT：添加完整 `LICENSE` 文本；`package.json` 增加 `"license": "MIT"`；README 的许可证段落与文件一致。
- 保留 `"private": true` 防止误发 npm，不影响 GitHub 开源。

### 0.2 题库发布声明与来源清单

维护者已确认现有题库内容可以公开。本项不再作为首发门槛，改为「声明 + 可追溯清单」：

1. **确定数据许可证**：在 `data/LICENSE` 中声明题库的公开再分发许可。建议 `CC BY 4.0`（允许再分发与修改，需署名）；若只想允许非商业学习使用，使用自定义数据许可并在 README 说明「代码 MIT、数据另许」。如题库中含第三方内容，按原许可标注。
2. **建立来源台账** `docs/data-provenance.csv`，字段至少包含：
   `question_id, topic, source_type, source_ref, author/compiler, license, attribution, notes`
   - 用途是署名、后续维护和回应来源询问，**不作为发布过滤器**。
   - 来源类型区分：教材原文改编、学校题库、网络收集、教师原创、AI 辅助生成后人工校订。
3. **原始教材文本不发布**：`docs/毛概-新增/*.txt` 是教材原文，默认不进仓库；只发布结构化题目、选项、答案、解析。
4. **解析来源说明**：解析若由 AI 辅助生成后人工校订，在 `data/ATTRIBUTION.md` 记录生成工具、校订方式与原创性声明。
5. **用户数据必须剥离**：题目内容可以发布，但 `users`、`verification_codes`、`exam_submissions`、`practice_sessions`、`practice_answers`、`wrong_book_*` 等运行数据绝不随题库发布；`api/data/question-bank.db` 本身也不发布，只发布导出的题目 JSON。
6. **输出物**：
   - `data/LICENSE`（数据许可证全文）
   - `data/ATTRIBUTION.md`（来源、作者、许可、修改说明）
   - `data/dataset-v1.json`（仅 topics/questions/question_options）
   - `docs/data-provenance.csv`（可公开的来源台账）

### 0.3 凭据轮换

当前 `.env` 含 SMTP、AI、JWT、Supabase 等配置。虽然目录没有 `.git`，仍按「可能已外传」处理：

- 轮换 `SMTP_PASS`（QQ 邮箱授权码）、`AI_API_KEY`。
- 生成新的 `JWT_SECRET`（至少 32 字节随机值，例如 `openssl rand -base64 48`）。
- 检查 `VITE_SUPABASE_ANON_KEY` 是否仍在使用；若移除 Supabase 路线，直接删除相关配置与依赖。
- 轮换后更新本地 `.env`，不要把新值写入任何文档、截图或提交。

### 0.4 冻结与备份

- 将当前工作目录完整复制到仓库外私有备份（例如 `E:\web\question-bank-private-backup-20261102\`），包含数据库与 `.codex-backups`。
- 记录 `api/data/question-bank.db` 的 SHA-256，作为后续导出比对基线。
- 后续开发改用独立数据目录 `var/`（被忽略），不再直接写 `api/data/`。
- 宣布进入「发布冻结」：阶段 1～4 期间不新增真实用户数据到将被发布的目录。

### 0.5 工具链基线

- 固定 Node.js 22 LTS（Prisma 7 要求 `^20.19 || ^22.12 || >=24.0`，Node 18 不可用）。
- 添加 `.nvmrc`（`22`）与 `package.json` 的 `engines`。
- 在干净目录执行一次 `npm ci`，记录安装耗时、原生模块（better-sqlite3）编译结果与 `npm audit` 基线。

**阶段 0 出口条件**：题库发布声明与数据许可证已确定；`docs/data-provenance.csv` 已覆盖全部题目来源；用户数据剥离方案已确定；凭据已轮换；私有备份完成。

---

## 3. 阶段 1：发布边界与仓库初始化（2～3 天）

对应审计：A01、A02、A05、A06、A15。

### 3.1 重写忽略规则

`.gitignore` 必须覆盖以下内容（当前只忽略构建与编辑器文件）：

```gitignore
# 环境与凭据
.env
.env.*
!.env.example
*.pem
*.key
*.p12
test-token.txt

# 运行数据
api/data/
var/
data/private/
*.db
*.db-wal
*.db-shm
*.sqlite
*.sqlite3
*.sqlite-wal
*.sqlite-shm
*.journal

# 备份与证据
.codex-backups/
docs/round4-evidence/
docs/rights/private/
docs/毛概-新增/

# 构建与生成
node_modules/
dist/
dist-ssr/
generated/
coverage/
.vercel/
.trae/
*.tsbuildinfo

# 日志与临时文件
logs/
*.log
npm-debug.log*
.DS_Store
```

同时添加 `.gitattributes`：

```gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
*.ico binary
```

> 注意：`.gitignore` 只在文件未被跟踪时生效。首次提交前必须用 `git status --ignored` 与 `git ls-files` 双重核对，不能依赖忽略规则本身。

### 3.2 运行数据迁出项目树

- 将 `api/data/question-bank.db`、`users.json`、`store.json`、`wrongbook-backups/` 移到 `var/` 或仓库外私有目录。
- 修改默认值：
  - `api/db/prisma.ts:7` 默认 `DATABASE_URL` 改为 `file:./var/question-bank.db`。
  - 启动时自动创建 `var/` 目录；数据库文件不存在时不要先 `realpathSync`（当前 `:10` 会直接失败）。
  - 保留「数据库必须在项目目录内」的限制，但允许通过 `ALLOW_DB_OUTSIDE_WORKSPACE=1` 给测试使用隔离临时目录。
- 更新 `.env.example`、`prisma.config.ts`、README 与所有脚本中的路径。
- `api/data/` 若仍需保留目录占位，使用 `.gitkeep`，不得包含任何数据库或用户文件。

### 3.3 环境变量模板与启动校验

`.env.example` 补全并分组（只保留变量名与安全示例值）：

```dotenv
# 必填
DATABASE_URL="file:./var/question-bank.db"
JWT_SECRET="replace-with-openssl-rand-base64-48"
JWT_EXPIRES_IN="7d"
NODE_ENV="development"
PORT=3001
FRONTEND_URL="http://localhost:5173"

# 可选：邮件验证
SMTP_ENABLED=false
SMTP_HOST=
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# 可选：AI 助手
AI_ENABLED=false
AI_BASE_URL=
AI_MODEL=
AI_API_KEY=
AI_TIMEOUT_MS=30000
AI_DAILY_QUOTA=50

# 首次初始化
SEED_DEMO=false
ADMIN_EMAIL=
ADMIN_INITIAL_PASSWORD=
```

`api/config.ts` 改为集中配置与启动校验：

- 删除 `|| 'fallback-secret'`（当前 `:4`）。
- `JWT_SECRET` 缺失或长度不足时**直接抛错退出**；测试环境可用显式测试密钥。
- `NODE_ENV=production` 时要求 `FRONTEND_URL`、`DATABASE_URL`、`JWT_SECRET` 均已设置。
- SMTP、AI 未配置时明确输出「能力已关闭」，而不是启动后静默失败。
- 拒绝 `VITE_*` 变量出现在服务端秘密位置；前端只允许公开配置。

### 3.4 清理与旧技术路线

从首发内容中移除或隔离：

- `.codex-backups/`（约 40 MB 源码与数据库副本）
- `api/data/wrongbook-backups/`（约 129 MB）
- `docs/round4-evidence/`（真实作答快照、日志、截图）
- `docs/毛概-新增/*.txt`（教材原文）
- `.vercel/`、`vercel.json`、`.vercelignore`、`Dockerfile*`、`docker-compose.yml`、`nginx.conf`（首发不承诺这些部署路径；可移到 `deploy/experimental/` 并在 README 标明「未验证、不提供支持」）
- `supabase/`、`src/lib/supabaseClient.ts`、`@supabase/supabase-js` 依赖、`VITE_SUPABASE_*` 配置、旧 Supabase 测试
- `vite-plugin-trae-solo-badge` 及 `vite.config.ts` 中的 Trae 徽标注入（`vite.config.ts:60` 附近）
- `test-token.txt`、根目录无扩展名的 `npm` 文件、`api/check_punct.js` 等临时脚本（确认无引用后删除）
- `frontend-optimization-*.md`、`CODE_WIKI.md`：逐份检查是否含真实数据、绝对路径或过时架构描述，决定保留、重写或删除

### 3.5 数据导出与导入流水线

新增脚本，禁止手工复制运行库：

- `scripts/export-public-dataset.ts`
  - 只查询 `topics`、`questions`、`question_options` 三张表。
  - 绝不导出 `users`、`verification_codes`、`exam_submissions`、`practice_sessions`、`practice_answers`、`wrong_book_*`。
  - 导出全部题目，不按授权状态过滤（维护者已确认题库可公开）；`docs/data-provenance.csv` 只用于署名与追溯。
  - 输出 `data/dataset-v1.json`，包含 `schemaVersion`、`generatedAt`、`counts`、`topics`、`questions`。
  - 生成后执行断言：无邮箱、无 `password_hash`、无用户 ID、无绝对路径。
- `scripts/import-public-dataset.ts`
  - 从空库导入 `data/dataset-v1.json`，可幂等执行。
  - 与 `prisma/seed.ts` 共用逻辑，避免两套导入代码。
- `data/README.md`：说明数据集版本、题目数量、许可证、来源与更新方式。

### 3.6 仓库初始化与首次提交

1. `git init`（在确认忽略规则生效之后）。
2. 使用显式路径 `git add`，**禁止 `git add .`**。建议白名单：
   `LICENSE README.md CONTRIBUTING.md SECURITY.md CHANGELOG.md .gitignore .gitattributes .env.example package.json package-lock.json tsconfig*.json vite.config.ts eslint.config.js jest*.js/cjs postcss.config.js tailwind.config.js index.html prisma/ src/ api/ shared/ scripts/ data/ docs/*.md`
3. 核对：
   - `git ls-files` 逐项审查，确认无 `.env`、数据库、备份、截图、用户数据。
   - `git status --ignored` 确认敏感目录确实被忽略。
   - `gitleaks detect --no-git` 或 `trufflehog filesystem .` 扫描。
   - `git grep -nE "(SMTP_PASS|AI_API_KEY|JWT_SECRET|password_hash|@qq\.com|BEGIN (RSA|OPENSSH))"` 人工复核命中项。
4. 首次提交建议消息：`chore: initialize public release boundary`。
5. 创建 GitHub 空仓库后 `git remote add origin ...`，**首次推送前再执行一次全量扫描**。

### 3.7 开源交付材料

- `README.md` 重写：准确功能、Node 22、安装/初始化/seed/启动、自托管说明、环境变量表、数据许可证、已知限制。
- `CONTRIBUTING.md`：开发环境、提交规范、测试与 PR 要求。
- `SECURITY.md`：私下报告漏洞的邮箱与响应时限；明确不要用公开 issue 报安全问题。
- `CHANGELOG.md`：`v0.1.0` 初始版本。
- `THIRD_PARTY_NOTICES.md`：KaTeX 字体、lucide 图标、React 等依赖的许可与归属；保留 `node_modules` 之外的必要许可文件。
- 可选：`.github/ISSUE_TEMPLATE/`、`PULL_REQUEST_TEMPLATE.md`；不要添加空模板。

**阶段 1 出口条件**：待提交文件清单人工复核通过；全量扫描无真实密钥与用户数据；数据导出脚本可重复运行；LICENSE 与数据许可证齐备。

---

## 4. 阶段 2：认证与前端安全（4～6 天）

对应审计：A03、A04、A11。

### 4.1 JWT 与令牌用途隔离

**目标**：过期令牌、错误用途令牌、缺少 `sub`/`role` 的令牌一律拒绝；重置令牌一次性；改密/降权后旧令牌立即失效。

1. 新建 `api/services/tokens.ts`：
   - `signAccessToken(user)`：payload `{ sub: user.id, role, type: 'access', ver: user.tokenVersion, jti }`，`expiresIn` 默认 `15m` 或 `7d`（按产品选择，但必须显式设置）。
   - `signResetToken(userId)`：`{ sub, type: 'reset', jti }`，`expiresIn: '15m'`。
   - `verifyToken(token, expectedType)`：固定 `algorithms: ['HS256']`、`issuer`、`audience`；校验 `type`、`sub`、`role`。
2. 修改 `api/routes/auth.ts`：
   - `:271`、`:416`、`:510` 的登录/注册签名改用 `signAccessToken`，补 `expiresIn`。
   - `:742` 重置令牌改用 `signResetToken`；重置令牌的 `jti` 以哈希形式落库（新建 `PasswordResetToken` 表，或扩展 `VerificationCode` 增加 `consumedAt` / `attempts`）。
   - `:1112` 改用 `verifyToken(token, 'reset')`，去掉 `ignoreExpiration`；验证后在同一事务中标记已消费；第二次使用返回 401。
   - 删除 `:964`、`:1013` 的 `ignoreExpiration`，按实际用途分别校验。
3. 修改 `api/middleware/auth.ts`：
   - 删除 `ignoreExpiration: true`（`:34`）。
   - 校验通过后按 `sub` 查询当前用户，确认存在、角色未变、`tokenVersion` 与令牌一致。
   - `needPasswordChange=true` 时只允许访问 `/api/auth/me`、`/api/auth/change-password`、`/api/auth/logout`，其余返回 403。
   - 请求对象使用明确的 `AuthUser` 类型，不直接断言 `as User`。
4. Prisma schema 增加：
   ```prisma
   model User {
     // ...
     tokenVersion Int @default(0)
   }

   model PasswordResetToken {
     id        String   @id
     userId    String
     tokenHash String   @unique
     expiresAt DateTime
     consumedAt DateTime?
     createdAt DateTime @default(now())
     @@index([userId])
     @@map("password_reset_tokens")
   }
   ```
   - 改密、重置、角色变更、管理员强制下线时递增 `tokenVersion`。
5. `wrongBookBackfill` 的预览令牌（`api/services/wrongBookBackfill.ts:97`、`:113`）保持独立 `purpose` 校验，不能被通用认证中间件接受。

### 4.2 注册、验证码与默认密码

1. `/register`（`api/routes/auth.ts:352`）：
   - 统一走邮箱验证；未验证邮箱的请求不得直接签发访问令牌。
   - 若保留「无邮箱模式」，必须由 `ALLOW_UNVERIFIED_REGISTER=false` 显式控制，默认关闭，并在 README 说明风险。
2. 验证码：
   - `api/utils/emailVerifier.ts:57` 改用 `crypto.randomInt(100000, 1000000)`。
   - 数据库只存验证码哈希；增加 `attempts` 字段；同一验证码失败 5 次即作废。
   - 发送冷却按 `email + type + IP` 组合；验证尝试按 `email + type + IP` 限流。
   - 删除 `:188`、`:196` 的验证码日志；非 production 也不得在响应中返回验证码，除非 `NODE_ENV=test` 且 `ALLOW_TEST_CODE_ECHO=1`。
3. 删除模块加载时的演示账号播种（`api/routes/auth.ts:14` 起）：
   - 移到 `prisma/seed.ts`，仅 `SEED_DEMO=true` 且非 production 时执行。
   - 演示密码不要硬编码在业务代码；seed 输出到控制台或 `var/seed-credentials.txt`（忽略）。
   - 管理员创建/重置用户（`:581`、`:631`）改为随机一次性密码或激活链接，并设置 `needPasswordChange=true`。
4. 前端 `src/stores/auth.ts`：
   - 删除 `lastLoginPassword` 字段、`setLastLoginPassword`、所有写入与持久化（`:59`、`:300`）。
   - 删除 `:43` 对 `12345678` / `miao@miao` 的明文比较。
   - Zustand `persist` 增加 `version: 2` 与 `migrate`，在升级时显式删除旧 `lastLoginPassword`；`partialize` 只保留 `user`、`token`、`isAuthenticated`。
   - 考虑把 token 从 `localStorage` 迁移到 `sessionStorage` 或 httpOnly cookie；若首发不改，至少在 SECURITY.md 说明 XSS 风险与 CSP 缓解。

### 4.3 日志清理

- `api/middleware/auth.ts:12`、`:27` 删除原始授权头与令牌片段日志；`:42` 不记录 `jwtSecretLength`。
- `src/services/baseService.ts:22` 删除完整令牌日志。
- `src/stores/auth.ts:47` 删除令牌长度日志。
- 引入统一 `api/utils/logger.ts`，对 `authorization`、`password`、`code`、`token`、`cookie` 字段自动脱敏；生产环境默认 `info` 级别。

### 4.4 题目渲染 XSS 修复

`src/components/MathRenderer.tsx` 当前把未清洗内容写入 `innerHTML`（`:59`），并开启 KaTeX `trust: true`（`:34`、`:48`）。重写方案：

1. **默认纯文本 + 公式**：把 `content` 按 `$...$` / `$$...$$` / `\[...\]` 切分为文本段与公式段。
2. 文本段使用 React 文本节点或 `textContent` 渲染；需要换行时按 `\n` 拆分 `<br />`，**不得把原始字符串拼进 HTML**。
3. 公式段只把 `katex.renderToString(formula, { trust: false, throwOnError: false, strict: 'ignore' })` 的结果写入容器；错误回退文本必须先转义。
4. 如果业务确实需要富文本（加粗、图片等），使用 `DOMPurify` + 严格允许列表，而不是仅过滤 `<script>`；允许列表至少覆盖标签、属性、URL 协议（禁止 `javascript:`、`data:` 中的脚本类型、SVG 事件属性）。
5. 搜索并评估其他富文本入口：`react-markdown` 是否启用 `rehype-raw`；任何 `dangerouslySetInnerHTML` 都必须经过同一清洗函数。
6. 增加 CSP（作为附加防线，不替代输出清洗）：
   - Express 使用 `helmet` 的 CSP 配置：`default-src 'self'`、`script-src 'self'`、`style-src 'self' 'unsafe-inline'`（KaTeX 需要）、`img-src 'self' data:`、`connect-src 'self'`（自托管同源）。
   - 静态部署时在 `index.html` 加对应 `<meta http-equiv="Content-Security-Policy">`，或由反向代理注入响应头。

### 4.5 安全回归测试

新增/更新测试：

- 过期 access token → 401。
- `type: 'reset'` 令牌访问业务接口 → 401。
- 缺少 `sub` / `role` 的令牌 → 401。
- 重置令牌第二次使用 → 401。
- 改密、角色变更后旧令牌 → 401。
- `needPasswordChange=true` 访问非改密接口 → 403。
- MathRenderer 对 `<img onerror>`、`<svg onload>`、`javascript:` 链接、KaTeX `\href` 的清洗结果 → 无脚本执行、文本正确显示。
- Zustand 持久化迁移后 `auth-storage` 不含 `lastLoginPassword`。

**阶段 2 出口条件**：审计 §5 中所有认证与 XSS 勾选项通过；日志中无令牌、密码、验证码。

---

## 5. 阶段 3：可复现工程（5～7 天）

对应审计：A07、A08、A09、A10、A13。

### 5.1 数据库初始化基线（A07）

1. 用空库生成完整基线迁移：
   ```bash
   npx prisma migrate diff \
     --from-empty \
     --to-schema-datamodel prisma/schema.prisma \
     --script > prisma/migrations/0001_init/migration.sql
   ```
   - 基线必须包含 `users`、`topics`、`questions`、`question_options`、`exams`、`exam_rules`、`exam_submissions`、`exam_submission_questions`、`exam_answers`、`practice_sessions`、`practice_answers`、`wrong_book_items`、`wrong_book_occurrences`、`wrong_book_collection_jobs`、`wrong_book_backfill_runs`，以及阶段 2 新增的 `password_reset_tokens` 与 `tokenVersion`。
   - 现有两份 wrongbook 迁移（`202611010001`、`202611010002`）并入基线后删除或标记为历史，避免重复建表。
   - 统一策略：正式环境只使用 `prisma migrate deploy`；开发环境也走迁移，不使用 `db push` 覆盖迁移历史。
2. `prisma/seed.ts`：
   - 创建管理员（从 `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` 或随机密码）。
   - 可选创建教师/学生演示账号（`SEED_DEMO=true`）。
   - 导入 `data/dataset-v1.json`（调用共享导入函数）。
   - 幂等：重复执行不重复插入。
3. `api/db/prisma.ts`：
   - 默认数据库路径改为 `var/question-bank.db`。
   - 启动时 `mkdir -p` 父目录。
   - 数据库不存在时给出「请先运行 `npm run db:migrate`」的明确错误，不要 `realpathSync` 先失败。
   - 测试路径允许通过 `DATABASE_URL` 指向 `ALLOW_DB_OUTSIDE_WORKSPACE=1` 允许的隔离目录。
4. `scripts/exam-lifecycle-integration.ts:12` 等集成脚本改为从已提交 schema/迁移建库，不再读取运行库表结构；临时库放在 `var/test-*` 或系统临时目录（需与 `prisma.ts` 的路径策略一致）。
5. `package.json` 新增脚本：
   ```json
   {
     "db:generate": "prisma generate",
     "db:migrate": "prisma migrate deploy",
     "db:migrate:dev": "prisma migrate dev",
     "db:seed": "tsx prisma/seed.ts",
     "db:reset": "prisma migrate reset --force",
     "setup": "npm run db:generate && npm run db:migrate && npm run db:seed"
   }
   ```

### 5.2 后端构建与启动（A08）

1. `api/tsconfig.json`：
   - 改为 `"module": "NodeNext"`、`"moduleResolution": "NodeNext"`。
   - `"rootDir": ".."`、`"outDir": "../dist"`，使入口输出为 `dist/api/server.js`，共享类型输出为 `dist/shared/*.js`。
   - `exclude` 增加 `scripts/**`、`**/*.test.ts`、`api/check_punct.ts` 等非生产脚本。
   - 所有相对导入补 `.js` 扩展名；重点修 `api/routes/auth.ts` 中 `../utils/emailVerifier` 的无扩展名导入（审计确认会触发 `ERR_MODULE_NOT_FOUND`）。
2. 修复严格类型错误：
   - `api/check_punct.ts:1`：移到 `scripts/` 或安装 `@types/better-sqlite3` 后排除出生产编译。
   - `api/routes/questions.ts:1003` 等 4 处 `options` 可能为 `undefined`：补空值分支或类型收窄。
   - 运行 `npm run typecheck:server` 直到 0 错误。
3. `package.json`：
   - `"build:server": "tsc -p api/tsconfig.json"` 保持。
   - `"start": "node dist/api/server.js"`。
   - 增加 `"typecheck:client": "tsc -p tsconfig.json --noEmit"`、`"typecheck:server": "tsc -p api/tsconfig.json --noEmit"`、`"build:all": "npm run build && npm run build:server"`。
4. 生产静态托管（自托管路径）：
   - 在 `api/server.ts` 增加：`NODE_ENV=production` 时 `app.use(express.static('dist'))` + SPA fallback（排除 `/api/*`）。
   - 这样 `npm run build:all && npm start` 即可单端口运行，避免 `VITE_API_URL`、CORS、前后端分域问题。
   - 同时修正 `src/services/authService.ts:20` 等直接使用 `/api/auth/...` 与 `baseService.ts` 使用 `VITE_API_URL` 的不一致：统一由 `baseService` 构造 base URL，默认空字符串（同源）。
5. 构建验收：
   - 干净副本执行 `npm ci && npm run db:generate && npm run build:all`。
   - 用构建产物启动，不依赖 `tsx`。
   - `curl /api/health`、登录、查询题目成功。

### 5.3 测试体系（A09）

1. 修复 Jest 默认配置：
   - ESM/`import.meta`：使用 `ts-jest` 的 ESM preset，或在 `jest.config.cjs` 中配置 `extensionsToTreatAsEsm` 与 `transform`；必要时用 `babel-jest` 处理 `import.meta`。
   - CSS 模块：`moduleNameMapper` 增加 `\\.(css|less|scss)$` → `identity-obj-proxy` 或空 mock。
   - `TextEncoder` / `TextDecoder`：在 `src/setupTests.ts` 中从 `node:util` 注入。
   - React 18 `act` 环境、`@testing-library/react` 版本对齐。
   - 删除 Supabase 相关 mock 与旧测试。
2. 更新过时测试：`src/stores/__tests__/auth.test.ts` 等按新 store 接口重写；移除 `lastLoginPassword` 断言。
3. 分离测试配置：
   - `jest.config.cjs`：前端 jsdom。
   - `jest.api.config.cjs`：后端 node 环境，使用临时数据库，跑集成测试。
   - `npm test` 默认跑前端单测 + 后端服务层测试；`npm run test:api` 单独跑需要数据库的集成测试。
4. 目标：`npm test` 在 Linux CI 上全绿；不能通过关闭 `ts-jest` diagnostics 或缩小 `testMatch` 来「制造通过」。

### 5.4 Lint 与跨平台换行（A09）

1. `eslint.config.js`：
   - `ignores` 增加 `generated`、`.codex-backups`、`dist`、`coverage`、`api/data`、`docs`、`data`、`var`。
   - `linebreak-style` 改为 `'unix'`。
   - 检查范围明确为 `src`、`api`、`shared`、`scripts`，不要扫描本地备份。
2. 添加 `.gitattributes` 的 `* text=auto eol=lf`（阶段 1 已完成）。
3. 先统计真实源码错误数，再分目录修复：
   - 优先修 `api/` 的 `no-explicit-any`、`no-non-null-assertion`、未使用变量。
   - 组件目录可先以 `warn` 级别过渡，但 CI 至少要求 0 error。
4. 不要为了清零而全局关闭规则；如果某类规则短期无法修完，在 `eslint.config.js` 中对具体目录设置 `warn` 并记录后续 issue。

### 5.5 CI 重写（A09）

删除现有 `.github/workflows/ci-cd.yml`，替换为：

- `.github/workflows/ci.yml`：
  - 触发：`pull_request` 与 `push` 到 `main`。
  - `permissions: contents: read`。
  - `concurrency` 取消旧运行。
  - Node 22，`npm ci`，缓存 npm。
  - 步骤顺序：`npm run db:generate` → `npm run typecheck:client` → `npm run typecheck:server` → `npm run lint` → `npm test` → `npm run build:all`。
  - 数据库步骤：创建临时 `var/test.db`，`npx prisma migrate deploy`，`npm run db:seed`（seed 使用合成/公开数据，不依赖真实库）。
  - 后端 smoke：后台启动 `node dist/api/server.js`，`curl /api/health`，再登录演示账号并请求 `/api/questions`，最后关闭进程。
- `.github/workflows/release.yml`：
  - 仅在 `v*` tag 或 `workflow_dispatch` 触发。
  - 构建产物、生成 checksum、创建 GitHub Release；首发不推送 Docker/Vercel。
- 删除 `ci-cd.yml:63` 的错误 Vercel 表达式；首发不再包含自动部署。
- 添加 `.github/dependabot.yml`：npm 与 GitHub Actions 每周检查。

### 5.6 依赖治理（A10）

按「实际输入链路」排序处理：

| 依赖 | 现状 | 计划 |
| --- | --- | --- |
| `xlsx` 0.18.5 | high，`fixAvailable:false`，实际解析上传文件 | 替换为 `exceljs`（读写均可，MIT）或 SheetJS 官方 CDN 的受支持版本；替换后回归 `.xlsx` 模板下载、预览、导入、错误提示。 |
| `multer` 2.0.2 | high | 升级到最新 2.x；补 `limits`（见阶段 4）。 |
| `nodemailer` 7.0.11 | high | 升级并回归邮件地址处理、发送失败分支。 |
| `axios` 1.13.2 | high | 全项目未发现实际使用（仅 `package.json` 声明），直接删除。 |
| `react-router-dom` 7.9.6 | high | 升级到最新 7.x；确认 SPA 用法不受 SSR 公告影响。 |
| `vite` 6.4.1 | high（dev） | 升级到最新 6.x 或 7.x（以 Node 22 为准）；`server.host` 改为 `127.0.0.1`，`allowedHosts` 收紧。 |
| `fast-xml-parser` 5.2.5 | critical（传递） | 沿 `nodemailer` / AWS 相关依赖链确认可达性；能升级则升级，不能则记录缓解。 |
| `proxy-addr` 2.0.7 | critical（传递） | 检查 `trust proxy` 配置；不要无条件信任 `X-Forwarded-For`。 |
| `@supabase/supabase-js` | 旧路线 | 删除。 |

执行原则：

- 不使用 `npm audit fix --force`；逐项升级并跑测试。
- 升级后重新生成 `package-lock.json`，提交锁文件。
- 在 `SECURITY.md` 或 `docs/dependency-status.md` 记录残余高危项的真实调用路径、缓解措施与后续计划。
- 添加 `engines` 与 `.nvmrc`，统一 CI 与本地版本。

### 5.7 自托管部署文档（A13）

首发只承诺源码自托管：

- 删除/隔离 Docker、Vercel、Nginx 生产配置；如保留，放到 `deploy/experimental/`，README 明确「未验证、不提供支持」。
- 新增 `deploy/question-bank.service.example`（systemd）与可选的 `deploy/nginx.conf.example`（反向代理 + HTTPS + 静态缓存）。
- README「自托管」章节覆盖：
  - Node 22 安装、`npm ci`、`.env` 配置、`db:generate`、`db:migrate`、`db:seed`。
  - `npm run build:all && npm start` 单端口运行。
  - 反向代理、HTTPS、`FRONTEND_URL`、限流与真实 IP（`trust proxy`）。
  - 数据备份：停止服务后复制 `var/question-bank.db`，或使用 SQLite `.backup`；不要复制到公开目录。
  - 升级：备份 → `git pull` → `npm ci` → `db:migrate` → 重启。
  - 首次管理员创建与密码修改。
- 删除 README 中「PostgreSQL 生产」「Vercel 自动部署」「Docker 支持」等未实现描述。

**阶段 3 出口条件**：从空目录可完成 `npm ci → db:generate → db:migrate → db:seed → build:all → start`；CI 在 Linux 通过；`npm audit --omit=dev` 的高危项均有修复或书面说明。

---

## 6. 阶段 4：权限与资源边界（3～4 天）

对应审计：A12、A14。

### 6.1 考试答案与可见性（A12）

先明确产品定位，二选一：

- **定位 A：学习/自测工具（推荐首发）**：README 明确「答案在作答过程中可见，不提供防作弊保证」。仍然修复明显的数据泄露：
  - `api/routes/exams.ts:777`、`:805` 在 `in_progress` 状态下不返回 `answer` / `analysis`，提交后再返回。
  - `GET /api/questions/:id`（`api/routes/questions.ts:1080`）改为需要登录；学生端只返回当前练习/考试上下文允许的字段。
  - 考试列表/详情只返回 `status='published'`；教师/管理员可看自己的草稿。
- **定位 B：正式考试**：使用独立响应 DTO，提交前绝不发送答案/解析；通用题库读取必须做旁路封堵；成绩与解析在提交后单独接口返回。工作量显著更大。

无论哪种定位，都补：

- `api/routes/exams.ts:410`、`:477` 等编辑/删除/发布接口增加资源归属校验：`role === 'admin' || exam.createdBy === req.user.id`；如果产品确实需要「全体教师共享管理」，在 README 与测试中显式声明，不要默认放行。
- `api/routes/exams.ts:255`、`:260` 从令牌取 `sub` 后校验非空，再用于 `submission.userId` 范围查询；不要信任缺失 ID 的令牌（阶段 2 已从源头修复，但仍补防御性检查）。

### 6.2 上传与解析限制（A14）

- `api/routes/questions.ts:10` 的 `multer.memoryStorage()` 增加：
  ```ts
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 20, parts: 25 }
  ```
- 校验扩展名与 MIME：`.xlsx` / `.xls` / `.json`；拒绝双扩展名与未知类型。
- Excel 解析限制：最大行数、最大列数、单元格长度、总题目数；超出返回 400 并给出中文错误。
- JSON 导入同样校验数组长度与字段类型。
- 解析失败不把原始单元格内容回显到错误响应（避免 XSS 与信息泄露）。

### 6.3 查询分页（A14）

- `api/routes/questions.ts:65` 当前查询全部题目后在内存过滤分页。改为数据库 `where + skip + take`，并对 `page`、`pageSize`、`topicId`、`type`、`keyword` 做校验。
- `pageSize` 上限 100；非法参数返回 400。
- 统计接口（`/stats`）使用 `count` / `groupBy`，不要加载全表。
- 全局限流不要无条件跳过 GET：对 GET 设置更高额度（例如 300/15min），对写操作维持更严格额度。

### 6.4 AI 资源与数据边界（A14）

- `api/routes/ai.ts:64`：
  - `AI_ENABLED=false` 时返回 503 与明确提示；默认关闭。
  - 外部请求增加 `AbortController` 超时（`AI_TIMEOUT_MS`，默认 30s）。
  - 题目上下文与聊天消息使用同等长度上限；限制历史消息条数。
  - 每用户每日额度与并发上限（内存计数或数据库表），超限返回 429。
  - 记录调用量、耗时、错误率与估算成本；日志不记录完整提问内容。
- README / `PRIVACY.md` 说明：AI 请求会把用户提问与题目上下文发送到所配置的外部服务；部署者需自行评估数据处理与题库授权。
- 不要把维护者真实密钥或专用服务地址写成默认值。

### 6.5 反向代理与 IP

- `api/server.ts` 增加 `app.set('trust proxy', ...)`，由 `TRUST_PROXY` 环境变量控制（例如 `1` 表示信任一层代理）；默认不信任。
- 限流键使用 `req.ip`，不要直接读 `X-Forwarded-For`。
- 自托管文档给出 Nginx / Caddy 示例时说明 `TRUST_PROXY=1` 的适用条件。

**阶段 4 出口条件**：正式考试提交前响应不含答案；教师越权有明确策略与测试；上传、分页、AI 均有上限；限流与真实 IP 配置有文档。

---

## 7. 阶段 5：干净环境验收（2～3 天）

### 7.1 干净副本验收

在全新目录执行（不复制 `.env`、数据库、`generated/`、`node_modules`、`dist/`）：

```bash
git clone <local-bare-repo> question-bank-clean
cd question-bank-clean
npm ci
cp .env.example .env
# 编辑 .env：JWT_SECRET、DATABASE_URL、FRONTEND_URL
npm run db:generate
npm run db:migrate
npm run db:seed
npm run typecheck:client
npm run typecheck:server
npm run lint
npm test
npm run build:all
npm start
```

逐项验证：

- [ ] `/api/health` 返回 200。
- [ ] 注册 → 邮箱验证码（测试模式）→ 登录。
- [ ] 学生：练习、提交、回顾、错题本。
- [ ] 教师：创建题目、导入 `.xlsx`、创建考试、发布。
- [ ] 管理员：创建用户、重置密码、强制改密。
- [ ] 考试进行中响应不含 `answer` / `analysis`；提交后可见。
- [ ] 改密后旧 token 失效；重置 token 第二次使用失败。
- [ ] 恶意题干在练习、考试、错题、管理预览中均不执行脚本。
- [ ] 历史 `auth-storage` 升级后不含密码。
- [ ] 重启服务后数据仍在。
- [ ] 前端生产构建由 Express 正常托管，SPA 刷新不 404。

### 7.2 数据与发布内容验收

- [ ] `git ls-files` 无 `.env`、`*.db`、`users.json`、`wrongbook-backups`、`round4-evidence`、`毛概-新增/*.txt`、`.codex-backups`。
- [ ] `data/dataset-v1.json` 题目数量与导出报告一致；`docs/data-provenance.csv` 已覆盖全部题目来源（用于署名与追溯）。
- [ ] 数据集不含用户 ID、邮箱、`password_hash`、作答记录、会话 ID。
- [ ] `data/LICENSE`、`data/ATTRIBUTION.md`、`THIRD_PARTY_NOTICES.md` 完整。
- [ ] `gitleaks` / `trufflehog` 全量扫描无真实凭据。
- [ ] GitHub Actions 在公开 PR 与 `main` 上全绿。
- [ ] 依赖扫描：高危/严重项全部修复或有书面适用性说明。

### 7.3 发布

- 打 tag `v0.1.0`，创建 GitHub Release，附：
  - 变更说明
  - 安装/自托管步骤
  - 数据许可证与来源说明
  - 已知限制（不支持 Docker/Vercel、正式考试防作弊不承诺等）
- 仓库设置：`main` 分支保护、要求 CI 通过、启用 secret scanning、Dependabot alerts。

---

## 8. 阶段 6：发布后运营（持续）

- 每周处理 Dependabot PR；每月复跑 `npm audit --omit=dev`。
- 关注 GitHub Security Advisories；`SECURITY.md` 中的私密报告渠道保持可用。
- 题库数据更新走独立 PR：更新 `data/dataset-v1.json` + `docs/data-provenance.csv` + `CHANGELOG.md`，并重新跑数据断言。
- 若后续要支持 Docker / Vercel，另开 `deploy` 里程碑，完成真实构建、重启持久化、CORS/反代验证后再写入 README。
- 定期轮换密钥；不要把生产 `.env` 放进任何 CI 日志或 issue。

---

## 9. 审计问题映射表

| 审计项 | 级别 | 对应阶段 | 关键交付 |
| --- | --- | --- | --- |
| A01 环境文件边界 | P0 | 阶段 1 | `.gitignore`、`.env.example`、`api/config.ts` 校验、凭据轮换 |
| A02 运行数据分发 | P0 | 阶段 1 | 数据迁出、导出白名单、Docker/CI 工件边界（首发移除） |
| A03 JWT 与令牌 | P0 | 阶段 2 | `tokens.ts`、`tokenVersion`、重置一次性、中间件重写 |
| A04 XSS 与明文密码 | P0 | 阶段 2 | MathRenderer 重写、Zustand 迁移、CSP |
| A05 许可证缺失 | P1 | 阶段 0/1 | `LICENSE`、`package.json`、README 一致 |
| A06 题库再分发声明 | P1 | 阶段 0 | 数据许可证、`docs/data-provenance.csv`、`data/ATTRIBUTION.md`、用户数据剥离 |
| A07 空库初始化 | P1 | 阶段 3 | 基线迁移、`prisma/seed.ts`、`db:*` 脚本、路径修复 |
| A08 后端构建启动 | P1 | 阶段 3 | NodeNext、`outDir`、`.js` 扩展名、类型错误、静态托管 |
| A09 测试/Lint/CI | P1 | 阶段 3 | Jest 修复、ESLint ignores、`.gitattributes`、`ci.yml` |
| A10 依赖告警 | P1 | 阶段 3 | 替换 `xlsx`、升级、删除 `axios`/Supabase、依赖说明 |
| A11 注册/默认密码/日志 | P1 | 阶段 2 | 邮箱验证强制、`crypto.randomInt`、日志脱敏、seed 隔离 |
| A12 考试答案与教师权限 | P1 | 阶段 4 | 响应 DTO、发布态可见性、`createdBy` 校验 |
| A13 部署不一致 | P1 | 阶段 3 | 移除未验证部署、自托管文档、单端口静态托管 |
| A14 上传/查询/AI 限制 | P2 | 阶段 4 | multer limits、数据库分页、AI 超时与额度 |
| A15 项目材料 | P2 | 阶段 1/6 | README 重写、CONTRIBUTING、SECURITY、CHANGELOG、移除 Trae/Supabase |

---

## 10. 建议提交顺序（便于逐条审查）

1. `chore: add release boundary and license`
2. `chore: remove runtime data and unsupported deployment configs`
3. `feat(data): add provenance ledger and public dataset export/import`
4. `fix(config): validate environment and remove fallback JWT secret`
5. `fix(auth): scope tokens by purpose and enforce expiry`
6. `fix(auth): one-time reset tokens and session invalidation`
7. `fix(auth): enforce email verification and remove demo seeding`
8. `fix(frontend): remove password persistence and sanitize rendering`
9. `fix(db): add baseline migration and reproducible seed`
10. `fix(build): NodeNext server build and single-port static serving`
11. `test: repair jest suite and add security regressions`
12. `chore(ci): replace workflow with reproducible CI`
13. `chore(deps): replace xlsx and upgrade vulnerable packages`
14. `fix(exams): hide answers in progress and scope teacher resources`
15. `fix(resources): limit uploads, pagination and AI calls`
16. `docs: rewrite README and self-hosting guide`
17. `chore: release v0.1.0`

每个提交都应满足：`npm run typecheck:client`、`npm run typecheck:server`、`npm test`、`npm run lint` 至少不新增失败；阶段 3 之后要求全绿。

---

## 11. 风险与回退

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 题库来源后续收到异议 | 需要补充署名或调整数据许可 | 保留 `docs/data-provenance.csv` 与 `data/ATTRIBUTION.md`，可快速定位、补充署名或按来源拆分数据集。 |
| `xlsx` 替换引入导入回归 | 教师导入不可用 | 先写导入/模板/预览的回归测试，再替换；保留 CSV/JSON 导入作为兜底。 |
| Prisma 7 + Node 22 + ESM 兼容问题 | 构建/启动失败 | 阶段 3 先在临时分支完成，不合并到发布分支；必要时锁定 Prisma 版本。 |
| 一次性大改导致难以定位回归 | 安全或功能倒退 | 按第 10 节小步提交；每步跑对应测试；安全修复优先于重构。 |
| 移除 Supabase 导致旧页面/测试失败 | 前端编译失败 | 先用 `grep` 建立引用清单，分文件删除；保留的页面改用现有 JWT 服务。 |
| 数据导出误带用户数据 | P0 泄露 | 导出脚本只允许三张表；输出断言 + 人工抽样 + CI 检查字段白名单。 |
| Windows 换行/路径差异 | CI 失败 | `.gitattributes` + ESLint `unix` + 所有路径用 `path` API；在干净 Linux CI 验证。 |

---

## 12. 首发验收清单（摘自审计 §5，逐项勾选）

- [ ] 待发布源码及历史不含真实密钥、账号数据库、作答记录或未经审查的备份/快照。
- [ ] 项目许可证有效；题库数据发布声明、数据许可证与来源清单完整。
- [ ] 无固定后备 JWT 密钥；过期和用途错误令牌被拒绝；重置一次性且旧会话可失效。
- [ ] 不保存明文密码；题目与作答渲染能阻止脚本执行。
- [ ] 无需运行数据库副本就能完成 Prisma 生成、空库初始化和演示管理员创建。
- [ ] 前后端构建、生产启动、默认测试、类型检查及有效范围 lint 在干净环境通过。
- [ ] 高危/严重依赖有修复或经复核的适用性与缓解记录。
- [ ] 实际部署方式与文档一致，重启后数据持久化符合说明。
