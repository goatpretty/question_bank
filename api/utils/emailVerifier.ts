import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { getSmtpSettings } from '../services/systemSettings.js';

// 验证码类型
export type VerificationCodeType = 'register' | 'reset' | 'login' | 'password-change' | 'email-change';

// 验证码存储结构（只保存摘要，不保存明文）
interface VerificationCode {
  email: string;
  codeHash: string;
  expiresAt: number;
  type: VerificationCodeType;
  used: boolean;
  attempts: number;
}

const verificationCodes: VerificationCode[] = [];

// 邮件传输器（延迟创建；配置变化时按指纹重建）
let transporter: Transporter | null = null;
let transporterKey = '';

const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 5 * 60 * 1000;
const CODE_EXPIRES_MS = 5 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;
const SEND_WINDOW_MS = 60 * 60 * 1000;

const sendCooldowns: Record<string, number> = {};
const sendHistory: Record<string, number[]> = {};

function hashCode(email: string, type: VerificationCodeType, code: string): string {
  return createHash('sha256').update(`${email}:${type}:${code}`).digest('hex');
}

function hashesMatch(expectedHash: string, actualHash: string): boolean {
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(actualHash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function readSmtpSettings():
  | { ok: true; host: string; port: number; secure: boolean; user: string; pass: string; from: string }
  | { ok: false; message: string } {
  const settings = getSmtpSettings();

  if (!settings.enabled) {
    return {
      ok: false,
      message: '邮件服务未启用，请联系管理员配置 SMTP 后再使用验证码功能。',
    };
  }

  if (
    !settings.host ||
    !settings.user ||
    !settings.pass ||
    !settings.from ||
    !Number.isInteger(settings.port) ||
    settings.port <= 0
  ) {
    return {
      ok: false,
      message: '邮件服务配置不完整，请联系管理员检查 SMTP 配置。',
    };
  }

  return {
    ok: true,
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    user: settings.user,
    pass: settings.pass,
    from: settings.from,
  };
}

// 初始化邮件传输器；配置变更后按指纹重建连接。
const getTransporter = (smtp: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}): Transporter => {
  const key = [smtp.host, smtp.port, smtp.secure, smtp.user, smtp.pass].join('\u0000');
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    transporterKey = key;
  }
  return transporter;
};

/** 使用当前 SMTP 配置发送一封测试邮件，不写入验证码状态。 */
export async function sendTestEmail(to: string): Promise<{ success: boolean; message: string }> {
  const smtp = readSmtpSettings();
  if (smtp.ok === false) {
    return { success: false, message: smtp.message };
  }

  try {
    await getTransporter(smtp).sendMail({
      from: smtp.from,
      to,
      subject: '思政复习题库系统 - SMTP 配置测试',
      text: '这是一封来自思政复习题库系统的测试邮件。\n\n如果你收到此邮件，说明 SMTP 配置可以正常发送邮件。',
    });
    return { success: true, message: '测试邮件已发送，请检查收件箱。' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error('发送测试邮件失败:', message);
    return { success: false, message: '测试邮件发送失败，请检查 SMTP 配置。' };
  }
}

// 生成 6 位安全随机验证码
const generateVerificationCode = (): string => {
  return randomInt(100000, 1000000).toString();
};

interface SendCodeResult {
  success: boolean;
  emailSent: boolean;
  message: string;
  reason?: 'cooldown' | 'rate-limit' | 'not-configured';
  remainingSeconds?: number;
}

// 发送验证码邮件
export const sendVerificationCode = async (email: string, type: VerificationCodeType): Promise<SendCodeResult> => {
  const smtp = readSmtpSettings();
  if (smtp.ok === false) {
    return {
      success: false,
      emailSent: false,
      message: smtp.message,
      reason: 'not-configured',
    };
  }

  const cooldownKey = `${email}:${type}`;
  const now = Date.now();

  const lastSentAt = sendCooldowns[cooldownKey];
  if (lastSentAt !== undefined && now - lastSentAt < COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - (now - lastSentAt)) / 1000);
    return {
      success: false,
      emailSent: false,
      message: '验证码请求过于频繁，请稍后再试',
      reason: 'cooldown',
      remainingSeconds,
    };
  }

  const recentSends = (sendHistory[cooldownKey] || []).filter((sentAt) => now - sentAt < SEND_WINDOW_MS);
  if (recentSends.length >= MAX_SENDS_PER_WINDOW) {
    return {
      success: false,
      emailSent: false,
      message: '该邮箱验证码发送次数过多，请一小时后再试。',
      reason: 'rate-limit',
    };
  }

  const code = generateVerificationCode();
  const expiresAt = now + CODE_EXPIRES_MS;

  // 同一邮箱、同一用途只保留最新一条验证码
  const existingIndex = verificationCodes.findIndex(
    (item) => item.email === email && item.type === type && !item.used,
  );
  if (existingIndex !== -1) {
    verificationCodes.splice(existingIndex, 1);
  }

  verificationCodes.push({
    email,
    codeHash: hashCode(email, type, code),
    expiresAt,
    type,
    used: false,
    attempts: 0,
  });

  sendCooldowns[cooldownKey] = now;
  sendHistory[cooldownKey] = [...recentSends, now];

  let subject = '';
  let actionType = '';

  switch (type) {
    case 'register':
      actionType = '注册账号';
      subject = '思政复习题库系统 - 注册验证码';
      break;
    case 'reset':
      actionType = '重置密码';
      subject = '思政复习题库系统 - 重置密码验证码';
      break;
    case 'login':
      actionType = '登录验证';
      subject = '思政复习题库系统 - 登录验证码';
      break;
    case 'password-change':
      actionType = '修改密码';
      subject = '思政复习题库系统 - 密码修改确认验证码';
      break;
    case 'email-change':
      actionType = '修改邮箱';
      subject = '思政复习题库系统 - 邮箱修改确认验证码';
      break;
    default:
      actionType = '验证操作';
      subject = '思政复习题库系统 - 验证码';
  }

  const text = `【思政复习题库系统】验证码通知\n\n尊敬的用户：\n\n您正在执行${actionType}操作，验证码为：${code}\n\n验证码有效期：5分钟\n\n安全提示：\n1. 请不要将验证码泄露给他人\n2. 如非本人操作，请忽略此邮件或联系管理员\n3. 验证码仅用于当前操作，请勿用于其他用途\n\n感谢您的使用！`;

  try {
    await getTransporter(smtp).sendMail({
      from: smtp.from,
      to: email,
      subject,
      text,
    });

    return {
      success: true,
      emailSent: true,
      message: '验证码已发送，请注意查收',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error('发送验证码邮件失败:', message);

    // 邮件发送失败时不返回验证码，也不把验证码写入日志
    return {
      success: false,
      emailSent: false,
      message: '邮件发送失败，请稍后重试。',
    };
  }
};

interface CodeValidationResult {
  found: boolean;
  expired: boolean;
  used: boolean;
  codeMatch: boolean;
}

// 查找验证码（不消耗；错误尝试计入次数上限）
export const validateVerificationCode = (
  email: string,
  inputCode: string,
  type: VerificationCodeType,
): CodeValidationResult => {
  const index = verificationCodes.findIndex(
    (item) => item.email === email && item.type === type,
  );

  if (index === -1) {
    return { found: false, expired: false, used: false, codeMatch: false };
  }

  const record = verificationCodes[index];

  if (record.used) {
    return { found: true, expired: false, used: true, codeMatch: false };
  }

  if (record.expiresAt <= Date.now()) {
    return { found: true, expired: true, used: false, codeMatch: false };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    record.used = true;
    return { found: true, expired: false, used: true, codeMatch: false };
  }

  const codeMatch = hashesMatch(record.codeHash, hashCode(email, type, String(inputCode)));

  if (!codeMatch) {
    record.attempts += 1;
    if (record.attempts >= MAX_ATTEMPTS) {
      record.used = true;
    }
  }

  return { found: true, expired: false, used: false, codeMatch };
};

// 消耗验证码（标记为已使用）
export const consumeVerificationCode = (
  email: string,
  inputCode: string,
  type: VerificationCodeType,
): boolean => {
  const validation = validateVerificationCode(email, inputCode, type);
  if (!validation.found || validation.used || validation.expired || !validation.codeMatch) {
    return false;
  }

  const index = verificationCodes.findIndex(
    (item) => item.email === email && item.type === type,
  );

  if (index === -1) {
    return false;
  }

  verificationCodes[index].used = true;
  return true;
};

// 验证验证码（兼容旧接口：验证并立即消耗）
export const verifyVerificationCode = (
  email: string,
  inputCode: string,
  type: VerificationCodeType,
): boolean => {
  return consumeVerificationCode(email, inputCode, type);
};

// 清理过期验证码
export const cleanupExpiredCodes = () => {
  const now = Date.now();
  const validCodes = verificationCodes.filter(
    (code) => !code.used && code.expiresAt > now,
  );

  verificationCodes.splice(0, verificationCodes.length, ...validCodes);

  for (const key of Object.keys(sendHistory)) {
    const recent = sendHistory[key].filter((sentAt) => now - sentAt < SEND_WINDOW_MS);
    if (recent.length === 0) {
      delete sendHistory[key];
    } else {
      sendHistory[key] = recent;
    }
  }
};

// 定期清理过期验证码
setInterval(cleanupExpiredCodes, 60 * 1000);

export type { VerificationCode };
