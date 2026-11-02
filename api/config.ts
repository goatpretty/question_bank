import dotenv from 'dotenv';

dotenv.config();

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`[config] ${name} 必须是正整数，当前值无效。`);
  }
  return value;
}

const nodeEnv = (process.env.NODE_ENV || 'development').trim();
const isTest = nodeEnv === 'test';

// 测试环境允许固定测试密钥；其他环境必须显式配置足够长度的 JWT_SECRET。
const testOnlyJwtSecret = 'test-only-jwt-secret-do-not-use-in-production-0000000000';
const jwtSecret = (
  process.env.JWT_SECRET ||
  (isTest ? testOnlyJwtSecret : '')
).trim();

if (jwtSecret.length < 32) {
  throw new Error(
    '[config] JWT_SECRET 缺失或长度不足 32 个字符。请使用 `openssl rand -base64 48` 生成后写入 .env。',
  );
}

const databaseUrl = (process.env.DATABASE_URL || 'file:./var/question-bank.db').trim();
if (!databaseUrl.startsWith('file:')) {
  throw new Error('[config] DATABASE_URL 必须指向本地 SQLite 文件（以 file: 开头）。');
}

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest,
  port: readInt('PORT', 3001),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl,
  frontendUrl: process.env.FRONTEND_URL || '',
  trustProxy: Number(process.env.TRUST_PROXY || 0),
  smtpEnabled: readBoolean('SMTP_ENABLED', false),
  aiEnabled: readBoolean('AI_ENABLED', false),
  aiTimeoutMs: readInt('AI_TIMEOUT_MS', 30000),
  aiDailyQuota: readInt('AI_DAILY_QUOTA', 50),
  seedDemo: readBoolean('SEED_DEMO', false),
  adminEmail: process.env.ADMIN_EMAIL || '',
  adminInitialPassword: process.env.ADMIN_INITIAL_PASSWORD || '',
} as const;

export const JWT_SECRET = config.jwtSecret;
