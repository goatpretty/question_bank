import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readSmtpSettings } from '../utils/emailVerifier.js';
import { getAiSettings } from '../services/systemSettings.js';

const REPOSITORY_URL = 'https://github.com/goatpretty/question_bank';

let cachedVersion: string | null = null;

function readVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { version?: string };
    cachedVersion = packageJson.version || '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}

export const metaRouter = Router();

// 公开、只读的部署信息，供首页与管理页展示。不返回任何凭据。
metaRouter.get('/', (_req, res) => {
  const ai = getAiSettings();
  // 配置可在管理端在线修改，因此不做缓存，保证首页与设置页状态一致。
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    data: {
      name: 'question-bank',
      version: readVersion(),
      // 只有 SMTP 开关打开且配置完整时，自助注册才真正可用。
      registrationEnabled: readSmtpSettings().ok,
      aiEnabled: ai.enabled && Boolean(ai.apiKey),
      database: 'SQLite',
      license: 'MIT',
      dataLicense: 'CC BY 4.0',
      repository: REPOSITORY_URL,
    },
  });
});
