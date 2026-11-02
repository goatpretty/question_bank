import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { config } from '../config.js';

export type SettingsSource = 'database' | 'environment';

export interface EffectiveSmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  source: SettingsSource;
}

export interface EffectiveAiSettings {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  source: SettingsSource;
}

export interface SmtpSettingsInput {
  enabled?: boolean;
  host?: string;
  port?: number | string;
  secure?: boolean;
  user?: string;
  from?: string;
  /** 留空表示不修改现有密码。 */
  password?: string;
}

export interface AiSettingsInput {
  enabled?: boolean;
  baseUrl?: string;
  model?: string;
  /** 留空表示不修改现有 API Key。 */
  apiKey?: string;
}

export interface AdminSmtpSettingsView extends Omit<EffectiveSmtpSettings, 'pass'> {
  hasPassword: boolean;
}

export interface AdminAiSettingsView extends Omit<EffectiveAiSettings, 'apiKey'> {
  hasApiKey: boolean;
}

export interface AdminSettingsView {
  smtp: AdminSmtpSettingsView;
  ai: AdminAiSettingsView;
}

export class SettingsValidationError extends Error {}

const SMTP_PREFIX = 'smtp.';
const AI_PREFIX = 'ai.';
const ENCRYPTION_CONTEXT = 'question-bank-settings-v1';

function readEnvBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function envSmtpSettings(): EffectiveSmtpSettings {
  const port = Number.parseInt(process.env.SMTP_PORT || '465', 10);
  const user = (process.env.SMTP_USER || '').trim();
  return {
    enabled: config.smtpEnabled,
    host: (process.env.SMTP_HOST || '').trim(),
    port: Number.isInteger(port) ? port : 465,
    secure: readEnvBoolean('SMTP_SECURE', port === 465),
    user,
    pass: process.env.SMTP_PASS || '',
    from: (process.env.SMTP_FROM || user).trim(),
    source: 'environment',
  };
}

function envAiSettings(): EffectiveAiSettings {
  return {
    enabled: config.aiEnabled,
    baseUrl: process.env.AI_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1',
    model: process.env.AI_MODEL || 'mimo-v2.6-flash',
    apiKey: process.env.AI_API_KEY || '',
    source: 'environment',
  };
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === 'true';
}

function parsePort(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) ? port : fallback;
}

/** 数据库中已有该类配置时，整组以数据库为准；缺失字段再回退环境变量。 */
function hasSection(settings: Map<string, string>, prefix: string): boolean {
  for (const key of settings.keys()) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
}

// 缓存一份同步快照，供邮件发送、AI 路由等同步代码读取。
let smtpSnapshot = envSmtpSettings();
let aiSnapshot = envAiSettings();

let encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (!encryptionKey) {
    encryptionKey = scryptSync(config.jwtSecret, ENCRYPTION_CONTEXT, 32);
  }
  return encryptionKey;
}

function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

function decryptSecret(value: string, label: string): string {
  const parts = value.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    console.warn(`[settings] ${label}的存储格式无法识别，请重新填写。`);
    return '';
  }

  const [, ivBase64, tagBase64, dataBase64] = parts;
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      Buffer.from(ivBase64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataBase64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // 不输出密文或密钥。JWT_SECRET 变化后旧值无法解密，需要管理员重新填写。
    console.warn(`[settings] 无法解密${label}，可能是 JWT_SECRET 已变更，请重新填写。`);
    return '';
  }
}

export function getSmtpSettings(): EffectiveSmtpSettings {
  return { ...smtpSnapshot };
}

export function getAiSettings(): EffectiveAiSettings {
  return { ...aiSnapshot };
}

export function getAdminSettingsView(): AdminSettingsView {
  const { pass, ...smtp } = smtpSnapshot;
  const { apiKey, ...ai } = aiSnapshot;
  return {
    smtp: { ...smtp, hasPassword: Boolean(pass) },
    ai: { ...ai, hasApiKey: Boolean(apiKey) },
  };
}

/** 从数据库加载覆盖项；启动时调用一次，更新后再次调用刷新缓存。 */
export async function loadSystemSettings(): Promise<void> {
  const rows = await prisma.systemSetting.findMany();
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const envSmtp = envSmtpSettings();
  const envAi = envAiSettings();

  const smtpFromDb = hasSection(values, SMTP_PREFIX);
  const aiFromDb = hasSection(values, AI_PREFIX);

  const passwordValue = values.get(`${SMTP_PREFIX}pass`);
  smtpSnapshot = {
    enabled: smtpFromDb
      ? parseBoolean(values.get(`${SMTP_PREFIX}enabled`), envSmtp.enabled)
      : envSmtp.enabled,
    host: values.get(`${SMTP_PREFIX}host`) ?? envSmtp.host,
    port: parsePort(values.get(`${SMTP_PREFIX}port`), envSmtp.port),
    secure: smtpFromDb
      ? parseBoolean(values.get(`${SMTP_PREFIX}secure`), envSmtp.secure)
      : envSmtp.secure,
    user: values.get(`${SMTP_PREFIX}user`) ?? envSmtp.user,
    pass: passwordValue === undefined
      ? envSmtp.pass
      : decryptSecret(passwordValue, ' SMTP 密码'),
    from: values.get(`${SMTP_PREFIX}from`) ?? envSmtp.from,
    source: smtpFromDb ? 'database' : 'environment',
  };

  aiSnapshot = {
    enabled: aiFromDb
      ? parseBoolean(values.get(`${AI_PREFIX}enabled`), envAi.enabled)
      : envAi.enabled,
    baseUrl: values.get(`${AI_PREFIX}baseUrl`) ?? envAi.baseUrl,
    model: values.get(`${AI_PREFIX}model`) ?? envAi.model,
    apiKey: values.get(`${AI_PREFIX}apiKey`) === undefined
      ? envAi.apiKey
      : decryptSecret(values.get(`${AI_PREFIX}apiKey`) as string, ' AI API Key'),
    source: aiFromDb ? 'database' : 'environment',
  };
}

function normalizePort(input: number | string): number {
  const port = typeof input === 'number' ? input : Number.parseInt(input, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new SettingsValidationError('SMTP 端口必须是 1 到 65535 之间的整数。');
  }
  return port;
}

function validateSmtp(settings: EffectiveSmtpSettings): void {
  if (!settings.enabled) return;
  if (!settings.host) {
    throw new SettingsValidationError('启用 SMTP 时必须填写服务器地址。');
  }
  if (!Number.isInteger(settings.port) || settings.port <= 0 || settings.port > 65535) {
    throw new SettingsValidationError('SMTP 端口必须是 1 到 65535 之间的整数。');
  }
  if (!settings.user) {
    throw new SettingsValidationError('启用 SMTP 时必须填写用户名。');
  }
  if (!settings.pass) {
    throw new SettingsValidationError('启用 SMTP 时必须填写密码或授权码。');
  }
  if (!settings.from) {
    throw new SettingsValidationError('启用 SMTP 时必须填写发件人地址。');
  }
}

function validateAi(settings: EffectiveAiSettings): void {
  if (!settings.enabled) return;
  if (!settings.baseUrl) {
    throw new SettingsValidationError('启用 AI 功能时必须填写 Base URL。');
  }

  let url: URL;
  try {
    url = new URL(settings.baseUrl);
  } catch {
    throw new SettingsValidationError('AI Base URL 不是有效的网址。');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SettingsValidationError('AI Base URL 必须以 http:// 或 https:// 开头。');
  }
  if (!settings.model) {
    throw new SettingsValidationError('启用 AI 功能时必须填写模型名称。');
  }
  if (!settings.apiKey) {
    throw new SettingsValidationError('启用 AI 功能时必须填写 API Key。');
  }
}

function mergeSmtp(
  current: EffectiveSmtpSettings,
  input: SmtpSettingsInput,
): EffectiveSmtpSettings {
  return {
    enabled: input.enabled ?? current.enabled,
    host: input.host !== undefined ? input.host.trim() : current.host,
    port: input.port !== undefined ? normalizePort(input.port) : current.port,
    secure: input.secure ?? current.secure,
    user: input.user !== undefined ? input.user.trim() : current.user,
    pass: input.password ? input.password : current.pass,
    from: input.from !== undefined ? input.from.trim() : current.from,
    source: 'database',
  };
}

function mergeAi(
  current: EffectiveAiSettings,
  input: AiSettingsInput,
): EffectiveAiSettings {
  return {
    enabled: input.enabled ?? current.enabled,
    baseUrl: input.baseUrl !== undefined
      ? input.baseUrl.trim().replace(/\/+$/, '')
      : current.baseUrl,
    model: input.model !== undefined ? input.model.trim() : current.model,
    apiKey: input.apiKey ? input.apiKey : current.apiKey,
    source: 'database',
  };
}

export async function updateSystemSettings(input: {
  smtp?: SmtpSettingsInput;
  ai?: AiSettingsInput;
}): Promise<AdminSettingsView> {
  if (!input.smtp && !input.ai) {
    throw new SettingsValidationError('没有需要保存的设置。');
  }

  const writes: Array<ReturnType<typeof prisma.systemSetting.upsert>> = [];
  const upsert = (key: string, value: string) => {
    writes.push(
      prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    );
  };

  if (input.smtp) {
    const prospective = mergeSmtp(getSmtpSettings(), input.smtp);
    validateSmtp(prospective);

    if (input.smtp.enabled !== undefined) upsert(`${SMTP_PREFIX}enabled`, String(prospective.enabled));
    if (input.smtp.host !== undefined) upsert(`${SMTP_PREFIX}host`, prospective.host);
    if (input.smtp.port !== undefined) upsert(`${SMTP_PREFIX}port`, String(prospective.port));
    if (input.smtp.secure !== undefined) upsert(`${SMTP_PREFIX}secure`, String(prospective.secure));
    if (input.smtp.user !== undefined) upsert(`${SMTP_PREFIX}user`, prospective.user);
    if (input.smtp.from !== undefined) upsert(`${SMTP_PREFIX}from`, prospective.from);
    if (input.smtp.password) upsert(`${SMTP_PREFIX}pass`, encryptSecret(input.smtp.password));
  }

  if (input.ai) {
    const prospective = mergeAi(getAiSettings(), input.ai);
    validateAi(prospective);

    if (input.ai.enabled !== undefined) upsert(`${AI_PREFIX}enabled`, String(prospective.enabled));
    if (input.ai.baseUrl !== undefined) upsert(`${AI_PREFIX}baseUrl`, prospective.baseUrl);
    if (input.ai.model !== undefined) upsert(`${AI_PREFIX}model`, prospective.model);
    if (input.ai.apiKey) upsert(`${AI_PREFIX}apiKey`, encryptSecret(input.ai.apiKey));
  }

  if (writes.length > 0) {
    await prisma.$transaction(writes);
  }
  await loadSystemSettings();
  return getAdminSettingsView();
}

export async function resetSystemSettings(section: 'smtp' | 'ai'): Promise<AdminSettingsView> {
  const prefix = section === 'smtp' ? SMTP_PREFIX : AI_PREFIX;
  await prisma.systemSetting.deleteMany({ where: { key: { startsWith: prefix } } });
  await loadSystemSettings();
  return getAdminSettingsView();
}
