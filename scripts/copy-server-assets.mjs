import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const generated = resolve(root, 'generated');
const prisma = resolve(root, 'prisma');

if (!existsSync(generated)) {
  console.error('[build:server] 缺少 generated/prisma，请先运行 `npm run db:generate`。');
  process.exit(1);
}

mkdirSync(dist, { recursive: true });
cpSync(generated, resolve(dist, 'generated'), { recursive: true });
cpSync(prisma, resolve(dist, 'prisma'), { recursive: true });

console.log('[build:server] 已将 generated/prisma 与 prisma/ 复制到 dist/。');
