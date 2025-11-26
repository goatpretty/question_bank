# question_bank
智能题库管理系统

一个功能完整的智能题库管理系统，支持多角色用户（学生、教师、管理员），提供个性化学习体验、智能题目推荐、在线考试等功能。

## 🌟 主要功能

### 学生端功能
- **智能练习中心**: 根据知识点智能推荐题目，支持个性化学习路径
- **在线考试系统**: 模拟真实考试环境，自动计时和评分
- **错题本管理**: 智能记录错题，支持标记掌握状态
- **学习记录分析**: 详细的学习报告和进度追踪
- **数学公式渲染**: 支持LaTeX数学公式渲染

### 教师端功能
- **题库管理系统**: 创建、编辑、删除题目，支持多种题型
- **考试管理系统**: 创建和管理在线考试，设置考试规则
- **学习数据分析**: 查看学生学习情况和考试统计

### 系统特色
- **多角色权限控制**: 学生、教师、管理员三级权限
- **响应式设计**: 完美适配移动端和桌面端
- **TypeScript支持**: 完整的类型安全
- **现代化UI**: 使用Tailwind CSS构建美观界面

## 🚀 技术栈

### 前端
- React 18 + TypeScript
- Vite (构建工具)
- Tailwind CSS (样式框架)
- Zustand (状态管理)
- React Router (路由)
- KaTeX (数学公式渲染)

### 后端
- Express.js 5 + TypeScript
- JWT (身份认证)
- SQLite (开发数据库)
- PostgreSQL (生产数据库)

### 开发工具
- ESLint (代码检查)
- Jest + Testing Library (测试框架)

## 📦 安装和运行

### 环境要求
- Node.js 18+
- npm 或 pnpm

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd 智能题库
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，设置必要的配置
```

4. **启动开发服务器**
```bash
# 启动前端开发服务器
npm run dev

# 启动后端API服务器
npm run dev:server
```

5. **构建生产版本**
```bash
# 构建前端
npm run build

# 构建后端
npm run build:server

# 启动生产服务器
npm start
```

## 🧪 测试

### 运行测试
```bash
# 运行所有测试
npm test

# 运行测试并监听文件变化
npm run test:watch

# 生成测试覆盖率报告
npm run test:coverage
```

### 测试结构
```
src/
├── components/
│   └── __tests__/          # 组件测试
├── pages/
│   └── __tests__/          # 页面测试
├── stores/
│   └── __tests__/          # 状态管理测试
└── setupTests.ts           # 测试配置
```

## 🚀 部署

### Vercel 部署

1. **连接GitHub仓库到Vercel**
2. **配置环境变量** (在Vercel控制台)
   - `JWT_SECRET`: JWT密钥
   - `DATABASE_URL`: 数据库连接字符串
   - `NODE_ENV`: production
3. **自动部署**: 每次推送到main分支将自动触发部署

### 其他部署选项

- **Docker**: 项目支持Docker容器化部署
- **传统服务器**: 支持在Linux/Windows服务器上部署

## 📁 项目结构

```
智能题库/
├── api/                    # 后端API代码
│   ├── routes/            # API路由
│   ├── middleware/        # 中间件
│   └── server.ts          # 服务器入口
├── src/                   # 前端源代码
│   ├── components/        # React组件
│   ├── pages/            # 页面组件
│   ├── stores/           # 状态管理
│   ├── services/         # API服务
│   └── utils/            # 工具函数
├── shared/               # 前后端共享类型
└── public/               # 静态资源
```

## 🔧 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DATABASE_URL` | 数据库连接字符串 | `sqlite:./database.sqlite` |
| `JWT_SECRET` | JWT加密密钥 | 必填 |
| `JWT_EXPIRES_IN` | JWT过期时间 | `7d` |
| `PORT` | 服务器端口 | `3001` |
| `NODE_ENV` | 运行环境 | `development` |
| `CORS_ORIGIN` | CORS允许的源 | `http://localhost:5173` |

### 数据库配置

项目默认使用SQLite进行开发，生产环境建议使用PostgreSQL。

## 🎯 使用指南

### 学生用户
1. 注册账户并登录
2. 选择练习专题开始学习
3. 参加在线考试
4. 查看错题本和学习记录

### 教师用户
1. 注册账户并联系管理员分配教师权限
2. 创建和管理题目
3. 组织在线考试
4. 查看学生学习数据

### 管理员
1. 系统设置和管理
2. 用户权限管理
3. 数据备份和维护

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🐛 问题反馈

如果您在使用过程中遇到问题，请在GitHub Issues中提交问题描述。

## 📞 联系方式

- 项目维护者: [您的名字]
- 邮箱: [您的邮箱]
- 项目主页: [项目URL]

---

⭐ 如果这个项目对您有帮助，请给它一个星标！
