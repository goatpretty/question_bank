import express from 'express';
import { resolve } from 'node:path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { json } from 'express';
import { authRouter } from './routes/auth.js';
import { questionRouter } from './routes/questions.js';
import { practiceRouter } from './routes/practice.js';
import { examRouter } from './routes/exams.js';
import { userRouter } from './routes/users.js';
import { aiRouter } from './routes/ai.js';
import { errorHandler } from './middleware/errorHandler.js';
import { prisma } from './db/prisma.js';
import { config } from './config.js';

const app = express();
const PORT = config.port;

if (config.trustProxy > 0) {
  app.set('trust proxy', config.trustProxy);
}

// 全局限流：生产环境启用，开发环境关闭；且放行所有 GET 请求，避免列表接口被限流
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => process.env.NODE_ENV !== 'production' || req.method === 'GET'
});

// 写操作限流：仅应用于 POST/PUT/DELETE，保护服务端
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Write rate limited. Please slow down.'
});

// 认证接口限流：降低暴力破解与验证码枚举风险
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '尝试次数过多，请稍后再试。' },
  skip: (req) => req.method === 'GET',
});

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    const allowed = config.frontendUrl ? [config.frontendUrl] : [];
    if (!origin || allowed.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV === 'production') {
  app.use(globalLimiter);
}

// 将写操作限流应用到主要资源路由
app.use((req, res, next) => {
  const isWrite = req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE';
  const isTarget = req.path.startsWith('/api/questions') || req.path.startsWith('/api/exams') || req.path.startsWith('/api/users');
  if (isWrite && isTarget) {
    return writeLimiter(req, res, next);
  }
  next();
});

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/questions', questionRouter);
app.use('/api/practice', practiceRouter);
app.use('/api/exams', examRouter);
app.use('/api/users', userRouter);
app.use('/api/ai', aiRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 生产模式下由 Express 同源托管前端静态文件，避免 CORS 与跨域 API 地址问题。
if (config.isProduction) {
  const distDir = resolve(process.cwd(), 'dist');
  app.use(express.static(distDir, { index: false, maxAge: '1d' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(resolve(distDir, 'index.html'));
  });
}

app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  try {
    await prisma.$connect();
    console.log('Prisma connected to SQLite database');
  } catch (error) {
    console.error('Failed to connect to database:', error);
  }
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('Prisma disconnected');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  console.log('Prisma disconnected');
  process.exit(0);
});
