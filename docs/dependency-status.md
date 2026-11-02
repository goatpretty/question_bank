# 依赖安全状态

记录日期：2026年11月02日。基线：`package-lock.json`，Node.js 22，`npm audit`。

## 生产依赖

`npm audit --omit=dev` 结果：**0 个 critical、0 个 high、9 个 moderate、1 个 low**。

| 依赖链 | 级别 | 可达性说明 |
| --- | --- | --- |
| `exceljs` → `archiver` → `archiver-utils` → `glob` → `minimatch` | moderate | 仅用于服务端生成/读取 `.xlsx`。触发条件是攻击者控制 glob 模式并放大输入；本项目不把用户输入作为 glob 模式，导入文件受 10 MB 与单文件限制。 |
| `exceljs` → `uuid` | moderate | 告警仅影响调用 `uuid.v3/v5/v6` 并显式传入 `buf` 的场景；ExcelJS 的常规读写路径不经过该用法。 |
| `exceljs` → `archiver` → `zip-stream` / `readdir-glob` / `rimraf` | moderate | 与上条同一压缩/文件遍历链路，无用户可控路径拼接进入该链路。 |
| `katex` | low | 公告涉及原型污染绕过 `trust` 限制。渲染层已设置 `trust: false`，且题干文本按 React 文本节点渲染，不把原始 HTML 写入页面。 |

当前没有可用的非破坏性升级修复。后续处理方式：

- 每周检查 Dependabot / `npm audit`；ExcelJS 或 KaTeX 发布修复版本后升级并回归题目导入与公式渲染。
- 若未来允许用户上传并直接指定压缩包内部路径或 glob，需要重新评估上述 moderate 项的适用性。
- 不使用 `npm audit fix --force` 做跨大版本强制升级。

## 开发依赖

`npm audit` 全量结果包含开发工具链的 moderate/low 告警，不影响生产运行。CI 中仍会执行 `npm ci`、类型检查、Lint、测试与构建；不把开发依赖告警作为发布阻断项，但会随 Dependabot 逐步升级。
