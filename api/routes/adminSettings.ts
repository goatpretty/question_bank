import { Router } from 'express';
import { authMiddleware, requireRole, type AuthRequest } from '../middleware/auth.js';
import {
  SettingsValidationError,
  getAdminSettingsView,
  getAiSettings,
  resetSystemSettings,
  updateSystemSettings,
  type AiSettingsInput,
  type SmtpSettingsInput,
} from '../services/systemSettings.js';
import { sendTestEmail } from '../utils/emailVerifier.js';

export const adminSettingsRouter = Router();

adminSettingsRouter.use(authMiddleware, requireRole(['admin']));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

adminSettingsRouter.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data: getAdminSettingsView() });
});

adminSettingsRouter.put('/', async (req, res) => {
  const body = isRecord(req.body) ? req.body : {};
  const smtp = body.smtp;
  const ai = body.ai;

  if (smtp !== undefined && !isRecord(smtp)) {
    return res.status(400).json({ success: false, error: 'smtp 参数格式不正确。' });
  }
  if (ai !== undefined && !isRecord(ai)) {
    return res.status(400).json({ success: false, error: 'ai 参数格式不正确。' });
  }

  try {
    const data = await updateSystemSettings({
      smtp: smtp as SmtpSettingsInput | undefined,
      ai: ai as AiSettingsInput | undefined,
    });
    res.json({ success: true, data, message: '设置已保存。' });
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error('更新系统设置失败:', error instanceof Error ? error.message : error);
    res.status(500).json({ success: false, error: '保存设置失败，请稍后重试。' });
  }
});

adminSettingsRouter.delete('/:section', async (req, res) => {
  const section = req.params.section;
  if (section !== 'smtp' && section !== 'ai') {
    return res.status(400).json({ success: false, error: '只支持 smtp 或 ai。' });
  }

  try {
    const data = await resetSystemSettings(section);
    res.json({ success: true, data, message: '已恢复为环境变量配置。' });
  } catch (error) {
    console.error('重置系统设置失败:', error instanceof Error ? error.message : error);
    res.status(500).json({ success: false, error: '重置设置失败，请稍后重试。' });
  }
});

// 使用当前已保存的 SMTP 配置发送测试邮件，默认发到当前管理员邮箱。
adminSettingsRouter.post('/test-email', async (req: AuthRequest, res) => {
  const requested = isRecord(req.body) && typeof req.body.to === 'string'
    ? req.body.to.trim()
    : '';
  const to = requested || req.user?.email || '';

  if (!to || !isEmail(to)) {
    return res.status(400).json({ success: false, error: '收件邮箱格式不正确。' });
  }

  const result = await sendTestEmail(to);
  res.status(result.success ? 200 : 400).json(result);
});

adminSettingsRouter.post('/test-ai', async (_req, res) => {
  const settings = getAiSettings();
  if (!settings.enabled) {
    return res.status(400).json({ success: false, error: 'AI 功能未启用。' });
  }
  if (!settings.apiKey) {
    return res.status(400).json({ success: false, error: '缺少 AI API Key。' });
  }

  try {
    const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0,
        max_tokens: 8,
        messages: [{ role: 'user', content: '只回复 OK' }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json().catch(() => null) as
      | { error?: { message?: string }; message?: string; model?: string }
      | null;

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: data?.error?.message || data?.message || `AI 接口返回 ${response.status}`,
      });
    }

    res.json({
      success: true,
      message: `AI 连接成功${data?.model ? `（模型：${data.model}）` : ''}。`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error('测试 AI 连接失败:', message);
    res.status(502).json({ success: false, error: 'AI 连接失败，请检查 Base URL、模型和 API Key。' });
  }
});
