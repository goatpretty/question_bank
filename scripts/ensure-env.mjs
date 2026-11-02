/**
 * 首次运行辅助：确保项目根目录存在 .env。
 *
 * - 不存在时从 .env.example 复制，并写入随机 JWT_SECRET。
 * - 不覆盖已有 .env。
 * - `--require-admin` 用于 `npm run setup`：要求已填写管理员账号或启用演示账号。
 *
 * .env 含本地配置，始终被 .gitignore 排除，不能提交到仓库。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');
const examplePath = resolve(root, '.env.example');
const requireAdmin = process.argv.includes('--require-admin');

function parseEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

if (!existsSync(envPath)) {
  if (!existsSync(examplePath)) {
    console.error('[env] 缺少 .env.example，无法生成 .env。');
    process.exit(1);
  }

  const secret = randomBytes(48).toString('base64url');
  const template = readFileSync(examplePath, 'utf8').replace(
    /^JWT_SECRET=.*$/m,
    `JWT_SECRET="${secret}"`,
  );
  writeFileSync(envPath, template, { mode: 0o600 });
  console.log('[env] 已根据 .env.example 生成 .env，并写入随机 JWT_SECRET。');
}

const values = parseEnv(readFileSync(envPath, 'utf8'));
const readValue = (key) => (process.env[key] ?? values.get(key) ?? '').trim();
const missing = [];

if (readValue('JWT_SECRET').length < 32) {
  missing.push('JWT_SECRET（至少 32 个字符）');
}

if (requireAdmin) {
  const seedDemo = readValue('SEED_DEMO').toLowerCase() === 'true';
  const adminEmail = readValue('ADMIN_EMAIL');
  const adminPassword = readValue('ADMIN_INITIAL_PASSWORD');
  if (!seedDemo) {
    if (!adminEmail) missing.push('ADMIN_EMAIL');
    if (adminPassword.length < 8) missing.push('ADMIN_INITIAL_PASSWORD（至少 8 个字符）');
  }
}

if (missing.length > 0) {
  console.error('[env] 请先编辑 .env 并填写：');
  for (const item of missing) console.error(`  - ${item}`);
  console.error(`[env] 文件位置：${envPath}`);
  if (requireAdmin) {
    console.error('[env] 也可以设置 SEED_DEMO=true 创建本地演示账号。');
  }
  process.exit(1);
}

console.log('[env] 配置校验通过。');
