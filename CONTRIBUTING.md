# 贡献指南

## 开发环境

1. 安装 Node.js 22 LTS。
2. Fork 并克隆仓库。
3. 安装依赖并初始化数据库：

```bash
npm ci
npm run env:init
# 生成 .env 与随机 JWT_SECRET；编辑 .env 填写管理员账号
npm run setup
# 或使用演示账号：SEED_DEMO=true npm run setup
```

4. 启动前后端：

```bash
npm run dev:server
npm run dev
```

## 提交前检查

```bash
npm run typecheck:client
npm run typecheck:server
npm test
npm run lint
```

请确保没有新增失败。若某项检查暂时无法通过，在 PR 中说明原因和影响范围。

## 分支与提交

- 从 `main` 创建分支：`feature/...`、`fix/...`、`docs/...`。
- 提交信息使用清晰的动词开头，例如：
  - `fix(auth): reject expired access tokens`
  - `feat(data): add dataset export script`
  - `docs: update self-hosting guide`
- 一个 PR 只做一件事，避免混入无关格式化。

## 数据相关改动

- 修改题目后运行 `npm run db:export`，同时更新 `data/dataset-v1.json` 和 `docs/data-provenance.csv`。
- 数据集只允许包含 `topics`、`questions`、`question_options` 三张表的内容。
- 不得提交用户账号、考试提交、练习作答、错题记录、浏览器存储或截图中的真实数据。
- 新增来源时在 `data/ATTRIBUTION.md` 补充署名。

## 安全相关改动

- 不要提交 `.env`、真实密钥、数据库文件或备份。
- 认证、权限、上传、渲染相关改动请附带测试。
- 发现安全漏洞不要开公开 issue，按 `SECURITY.md` 私下报告。

## PR 要求

- 描述改动目的、影响范围和验证方式。
- 涉及界面的改动附截图（使用演示数据）。
- 涉及数据库的改动说明迁移和回滚方式。
