import express from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js';
import { AuthResponse } from '../../shared/types.js';
import { sendVerificationCode, verifyVerificationCode, validateVerificationCode, consumeVerificationCode, VerificationCodeType } from '../utils/emailVerifier.js';
import { signAccessToken, verifyAccessToken } from '../utils/jwt.js';
import { validatePassword } from '../utils/password.js';

const router = express.Router();

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateTemporaryPassword(): string {
  return `Tmp${randomBytes(9).toString('base64url')}9`;
}

async function issueResetToken(userId: string): Promise<{ token: string; expiresInSeconds: number }> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt },
    }),
  ]);

  return { token, expiresInSeconds: RESET_TOKEN_TTL_MS / 1000 };
}

function readBearerToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

async function authenticateAccessToken(req: express.Request) {
  const token = readBearerToken(req);
  if (!token) {
    return null;
  }

  const payload = verifyAccessToken(token);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });

  if (!user || user.tokenVersion !== payload.tokenVersion) {
    return null;
  }

  return { payload, user };
}

// Helper: strip password_hash from user before returning to frontend
function sanitizeUser(u: any) {
  const { password_hash: _passwordHash, ...rest } = u;
  return rest;
}

// 检查用户名是否已存在
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: '用户名不能为空。'
      });
    }

    const existing = await prisma.user.findUnique({ where: { username } });

    res.json({
      success: true,
      exists: Boolean(existing)
    });
  } catch (error) {
    console.error('检查用户名失败:', error);
    res.status(500).json({
      success: false,
      error: '检查用户名失败，请稍后重试。'
    });
  }
});

// 检查邮箱是否已存在
router.get('/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: '邮箱不能为空。'
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });

    res.json({
      success: true,
      exists: Boolean(existing)
    });
  } catch (error) {
    console.error('检查邮箱失败:', error);
    res.status(500).json({
      success: false,
      error: '检查邮箱失败，请稍后重试。'
    });
  }
});

// 发送注册验证码
router.post('/send-verification-code', async (req, res) => {
  try {
    const { email, type } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: '邮箱为必填项。'
      });
    }

    const codeType: VerificationCodeType = (type as VerificationCodeType) || 'register';
    const validTypes: VerificationCodeType[] = ['register', 'reset', 'login', 'password-change', 'email-change'];
    if (!validTypes.includes(codeType)) {
      return res.status(400).json({
        success: false,
        error: '无效的验证码类型。'
      });
    }

    if (codeType === 'register') {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: '该邮箱已被注册。'
        });
      }
    }

    const result = await sendVerificationCode(email, codeType);

    if (!result.success) {
      if (result.reason === 'cooldown') {
        return res.status(429).json({
          success: false,
          message: result.message,
          reason: result.reason,
          remainingSeconds: result.remainingSeconds,
        });
      }
      return res.status(500).json({
        success: false,
        message: result.message,
      });
    }

    if (!result.emailSent) {
      return res.json({
        success: true,
        emailSent: false,
        message: result.message,
      });
    }

    res.json({
      success: true,
      emailSent: true,
      message: result.message,
    });
  } catch (error) {
    console.error('发送验证码失败:', error);
    res.status(500).json({
      success: false,
      error: '发送验证码失败，请稍后重试。'
    });
  }
});

// 验证注册验证码并完成注册
router.post('/verify-registration', async (req, res) => {
  try {
    const { username, email, password, code } = req.body;

    if (!username || !email || !password || !code) {
      return res.status(400).json({
        success: false,
        error: '用户名、邮箱、密码和验证码为必填项。'
      });
    }

    const usernameRegex = /^[a-zA-Z0-9]+$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        error: '用户名只能包含英文字母和数字。'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: '密码长度至少为8位。'
      });
    }
    const hasLetter = /[A-Za-z]/.test(password);
    const hasDigit = /\d/.test(password);
    if (!hasLetter || !hasDigit) {
      return res.status(400).json({
        success: false,
        error: '密码必须同时包含至少一个英文字母和一个数字。'
      });
    }

    const isValid = verifyVerificationCode(email, code, 'register');
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: '验证码无效或已过期。'
      });
    }

    // 双重检查用户名和邮箱
    const existingByUsername = await prisma.user.findUnique({ where: { username } });
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByUsername || existingByEmail) {
      return res.status(409).json({
        success: false,
        error: '用户名或邮箱已存在。'
      });
    }

    const role: 'student' | 'teacher' | 'admin' = 'student';
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        id: Date.now().toString(),
        username,
        email,
        role,
        password_hash: hashedPassword,
        needPasswordChange: false,
      },
    });

    const token = signAccessToken(newUser);

    const response: AuthResponse = {
      success: true,
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role as 'student' | 'teacher' | 'admin',
        avatar: newUser.avatar,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
        needPasswordChange: newUser.needPasswordChange
      }
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error('注册失败:', error);
    if (error.code === 'P2002') {
      const target = error.meta?.target as string[] | undefined;
      if (target?.includes('username')) {
        return res.status(409).json({ success: false, error: '用户名已存在。' });
      }
      if (target?.includes('email')) {
        return res.status(409).json({ success: false, error: '邮箱已存在。' });
      }
    }
    res.status(500).json({
      success: false,
      error: '注册失败，请稍后重试。'
    });
  }
});

// 通用验证码验证接口
router.post('/verify-verification-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: '邮箱和验证码为必填项。'
      });
    }

    const type = req.body.type || 'login';
    const isValid = verifyVerificationCode(email, code, type as VerificationCodeType);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: '验证码无效或已过期。'
      });
    }

    res.json({
      success: true,
      message: '验证码验证成功。'
    });
  } catch (error) {
    console.error('验证验证码失败:', error);
    res.status(500).json({
      success: false,
      error: '验证验证码失败，请稍后重试。'
    });
  }
});

// 旧注册路由已停用：所有注册必须先通过邮箱验证码验证
router.post('/register', (_req, res) => {
  res.status(410).json({
    success: false,
    error: '该接口已停用，请先获取邮箱验证码并调用 /api/auth/verify-registration 完成注册。'
  });
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名和密码为必填项。'
      });
    }

    // Try find by username first, then by email
    let user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { email: username } });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: '用户不存在，请先注册。'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: '密码错误，请检查后重试。'
      });
    }

    const token = signAccessToken(user);

    const response: AuthResponse = {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role as 'student' | 'teacher' | 'admin',
        avatar: user.avatar,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        needPasswordChange: user.needPasswordChange
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed.'
    });
  }
});

router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated.'
    });
  }

  res.json({
    success: true,
    user: req.user
  });
});

router.get('/users', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const dbUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });
    const safeUsers = dbUsers.map(u => sanitizeUser(u));
    res.json({ success: true, data: { users: safeUsers, total: safeUsers.length } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch users.' });
  }
});

// 管理员创建用户（支持学生/教师），教师只能由管理员创建
router.post('/users', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { username, email, password, role = 'student' } = req.body || {};
    if (!username || !email) {
      return res.status(400).json({ success: false, error: '用户名和邮箱为必填项。' });
    }

    const allowedRoles: Array<'student' | 'teacher'> = ['student', 'teacher'];
    const finalRole = allowedRoles.includes(role) ? role : 'student';
    const generatedPassword = !password;
    const rawPwd = generatedPassword ? generateTemporaryPassword() : String(password);
    const passwordError = validatePassword(rawPwd);
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError });
    }
    const hash = await bcrypt.hash(rawPwd, 12);

    const now = new Date();
    const user = await prisma.user.create({
      data: {
        id: Date.now().toString(),
        username,
        email,
        role: finalRole,
        password_hash: hash,
        needPasswordChange: true,
        createdAt: now,
        updatedAt: now,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        needPasswordChange: user.needPasswordChange,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        ...(generatedPassword ? { temporaryPassword: rawPwd } : {}),
      }
    });
  } catch (error: any) {
    console.error('Admin create user error:', error);
    if (error.code === 'P2002') {
      const target = error.meta?.target as string[] | undefined;
      if (target?.includes('username')) {
        return res.status(409).json({ success: false, error: '用户名已存在。' });
      }
      if (target?.includes('email')) {
        return res.status(409).json({ success: false, error: '邮箱已存在。' });
      }
    }
    res.status(500).json({ success: false, error: '创建用户失败。' });
  }
});

router.post('/users/:id/reset-password', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ success: false, error: 'User not found.' });

    const pwd = generateTemporaryPassword();
    const hash = await bcrypt.hash(pwd, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          password_hash: hash,
          needPasswordChange: true,
          tokenVersion: { increment: 1 },
          updatedAt: new Date(),
        },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: id, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({
      success: true,
      temporaryPassword: pwd,
      message: 'Password reset successfully. Ask the user to change it after login.',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reset password.' });
  }
});

// 发送重置密码验证码
router.post('/send-reset-code', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: '邮箱为必填项。'
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '该邮箱未注册。'
      });
    }

    const result = await sendVerificationCode(email, 'reset');

    if (!result.success) {
      if (result.reason === 'cooldown') {
        return res.status(429).json({
          success: false,
          message: result.message,
          reason: result.reason,
          remainingSeconds: result.remainingSeconds,
        });
      }
      return res.status(500).json({
        success: false,
        message: result.message,
      });
    }

    if (!result.emailSent) {
      return res.json({
        success: true,
        emailSent: false,
        message: result.message,
      });
    }

    res.json({
      success: true,
      emailSent: true,
      message: result.message,
    });
  } catch (error) {
    console.error('发送重置密码验证码失败:', error);
    res.status(500).json({
      success: false,
      error: '发送验证码失败，请稍后重试。'
    });
  }
});

// 验证重置密码验证码
router.post('/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: '邮箱和验证码为必填项。'
      });
    }

    const isValid = verifyVerificationCode(email, code, 'reset');
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: '验证码无效或已过期。'
      });
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在。'
      });
    }

    const { token: resetToken, expiresInSeconds } = await issueResetToken(user.id);

    res.json({
      success: true,
      token: resetToken,
      expiresInSeconds,
      message: '验证码验证成功。'
    });
  } catch (error) {
    console.error('验证重置密码验证码失败:', error);
    res.status(500).json({
      success: false,
      error: '验证验证码失败，请稍后重试。'
    });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    // 验证码重置路径: { email, code, newPassword }
    if (req.body.email && req.body.code && req.body.newPassword) {
      const { email, code, newPassword } = req.body;

      if (!email || !code || !newPassword) {
        return res.status(400).json({ success: false, error: '邮箱、验证码和新密码为必填项。' });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(404).json({ success: false, error: '用户不存在。' });
      }

      const validation = validateVerificationCode(email, code, 'reset');

      if (!validation.found) {
        return res.status(400).json({ success: false, error: '验证码错误。' });
      }
      if (validation.used) {
        return res.status(400).json({ success: false, error: '验证码已被使用。' });
      }
      if (validation.expired) {
        return res.status(400).json({ success: false, error: '验证码已过期。' });
      }
      if (!validation.codeMatch) {
        return res.status(400).json({ success: false, error: '验证码错误。' });
      }

      const passwordError = validatePassword(newPassword);
      if (passwordError) {
        return res.status(400).json({ success: false, error: passwordError });
      }

      const consumed = consumeVerificationCode(email, code, 'reset');
      if (!consumed) {
        return res.status(400).json({ success: false, error: '验证码无效或已过期。' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            password_hash: hashedPassword,
            needPasswordChange: false,
            tokenVersion: { increment: 1 },
            updatedAt: new Date(),
          },
        }),
        prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        }),
      ]);

      return res.json({ success: true, message: '密码重置成功。' });
    }

    // 校验当前密码（仅验证，不修改）
    if (req.body.validateOnly) {
      let session;
      try {
        session = await authenticateAccessToken(req);
      } catch {
        return res.status(401).json({
          success: false,
          error: '无效的认证token。'
        });
      }

      if (!session) {
        return res.status(401).json({
          success: false,
          error: '无效的认证token。'
        });
      }

      const { currentPassword } = req.body;

      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          error: '请输入当前密码。'
        });
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, session.user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: '当前密码不正确。'
        });
      }

      return res.json({
        success: true,
        message: '当前密码验证成功。'
      });
    }

    const { token, newPassword } = req.body;

    // 已登录用户凭当前密码修改密码
    if (!token && req.headers.authorization) {
      let session;
      try {
        session = await authenticateAccessToken(req);
      } catch {
        return res.status(401).json({
          success: false,
          error: '无效的认证token。'
        });
      }

      if (!session) {
        return res.status(401).json({
          success: false,
          error: '无效的认证token。'
        });
      }

      {
        const { currentPassword } = req.body;

        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            error: '请输入当前密码。'
          });
        }

        const user = session.user;
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isPasswordValid) {
          return res.status(401).json({
            success: false,
            error: '当前密码不正确。'
          });
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
          return res.status(400).json({
            success: false,
            error: passwordError
          });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            password_hash: hashedPassword,
            needPasswordChange: false,
            tokenVersion: { increment: 1 },
            updatedAt: new Date(),
          },
        });

        // 修改密码后旧令牌全部失效，为当前会话签发新令牌
        const accessToken = signAccessToken(updatedUser);

        return res.json({
          success: true,
          token: accessToken,
          user: sanitizeUser(updatedUser),
          message: '密码更新成功。'
        });
      }
    }

    // 一次性重置令牌（由 /verify-reset-code 签发）
    if (token && newPassword) {
      const passwordError = validatePassword(newPassword);
      if (passwordError) {
        return res.status(400).json({
          success: false,
          error: passwordError
        });
      }

      const resetRecord = await prisma.passwordResetToken.findUnique({
        where: { tokenHash: hashToken(String(token)) },
      });

      if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt.getTime() <= Date.now()) {
        return res.status(401).json({
          success: false,
          error: '重置token无效或已过期。'
        });
      }

      // 先原子占用令牌，避免同一令牌被并发使用
      const claimed = await prisma.passwordResetToken.updateMany({
        where: { id: resetRecord.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      if (claimed.count !== 1) {
        return res.status(401).json({
          success: false,
          error: '重置token无效或已过期。'
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: resetRecord.userId },
        data: {
          password_hash: hashedPassword,
          needPasswordChange: false,
          tokenVersion: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      return res.json({
        success: true,
        message: '密码重置成功。'
      });
    }

    return res.status(400).json({
      success: false,
      error: '无效的请求参数。'
    });
  } catch (error) {
    console.error('重置密码失败:', error instanceof Error ? error.message : 'unknown error');
    res.status(500).json({
      success: false,
      error: '重置密码失败，请稍后重试。'
    });
  }
});

export { router as authRouter };
