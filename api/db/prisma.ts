import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { config } from '../config.js';

// 统一以启动命令的工作目录作为项目根目录。
// 不能用模块所在目录：编译后模块位于 dist/api/db，会把数据库错误地解析到 dist/var。
const projectRoot = realpathSync(process.cwd());

if (config.databaseUrl.includes('?')) {
  throw new Error('Only local SQLite database files are allowed.');
}

const rawPath = config.databaseUrl.slice('file:'.length);
if (!rawPath) {
  throw new Error('DATABASE_URL 必须包含 SQLite 文件路径。');
}

const databasePath = isAbsolute(rawPath) ? rawPath : resolve(projectRoot, rawPath);
const databaseRelativePath = relative(projectRoot, databasePath);
const isOutsideWorkspace =
  !databaseRelativePath ||
  databaseRelativePath.startsWith(`..${sep}`) ||
  isAbsolute(databaseRelativePath);

if (isOutsideWorkspace && process.env.ALLOW_DB_OUTSIDE_WORKSPACE !== '1') {
  throw new Error(
    'The backend cannot open a database outside its project directory. ' +
      'Set ALLOW_DB_OUTSIDE_WORKSPACE=1 only for isolated tests.',
  );
}

mkdirSync(dirname(databasePath), { recursive: true });

export const isolatedDatabasePath = databasePath;

if (!existsSync(databasePath) && config.nodeEnv !== 'test') {
  console.warn(
    `[db] 数据库文件不存在：${databasePath}。请先运行 \`npm run db:migrate\` 和 \`npm run db:seed\`。`,
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaBetterSqlite3({
  url: `file:${databasePath}`,
  readonly: process.env.WRONGBOOK_READONLY === '1',
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (config.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
}
