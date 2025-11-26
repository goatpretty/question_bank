import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { json } from 'express';
import { authRouter } from './routes/auth.js';
import { questionRouter } from './routes/questions.js';
import { practiceRouter } from './routes/practice.js';
import { examRouter } from './routes/exams.js';
import { userRouter } from './routes/users.js';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

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

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    const allowed = process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [];
    if (!origin || allowed.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(json());
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

app.use('/api/auth', authRouter);
app.use('/api/questions', questionRouter);
app.use('/api/practice', practiceRouter);
app.use('/api/exams', examRouter);
app.use('/api/users', userRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
