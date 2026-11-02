import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '../db/prisma.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { signAccessToken } from '../utils/jwt.js';
import { validatePassword } from '../utils/password.js';
import { avatarFilePathFromUrl, AVATAR_DIR, ensureAvatarDir } from '../utils/uploads.js';

export const accountRouter = Router();

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_AVATAR_MIME.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error('UNSUPPORTED_IMAGE'));
  },
});

type AvatarExtension = 'png' | 'jpg' | 'webp';

/** 依据文件头判断真实图片类型，不信任客户端传入的 MIME。 */
function detectAvatarType(buffer: Buffer): AvatarExtension | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (
    buffer.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

function toPublicUser<T extends { password_hash: string }>(user: T): Omit<T, 'password_hash'> {
  const { password_hash: _passwordHash, ...rest } = user;
  return rest;
}

async function removeStoredAvatar(publicPath: string | null | undefined): Promise<void> {
  const filePath = avatarFilePathFromUrl(publicPath);
  if (!filePath) return;
  await unlink(filePath).catch(() => {
    // 旧头像可能已被删除，不影响本次操作。
  });
}

accountRouter.use(authMiddleware);

// 凭当前密码直接修改密码，不依赖邮箱验证码
accountRouter.post('/password', async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: '请先登录。' });
  }

  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (!currentPassword) {
    return res.status(400).json({ success: false, error: '请输入当前密码。' });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({ success: false, error: passwordError });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在。' });
    }

    const currentValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!currentValid) {
      return res.status(401).json({ success: false, error: '当前密码不正确。' });
    }

    const samePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (samePassword) {
      return res.status(400).json({ success: false, error: '新密码不能与当前密码相同。' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        password_hash: hashedPassword,
        needPasswordChange: false,
        tokenVersion: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    // 旧令牌全部失效，为当前会话签发新令牌。
    res.json({
      success: true,
      token: signAccessToken(updated),
      user: toPublicUser(updated),
      message: '密码更新成功。',
    });
  } catch (error) {
    console.error('修改密码失败:', error instanceof Error ? error.message : error);
    res.status(500).json({ success: false, error: '修改密码失败，请稍后重试。' });
  }
});

// 上传裁剪后的头像（PNG/JPEG/WebP，最大 2MB）
accountRouter.post('/avatar', (req, res) => {
  upload.single('avatar')(req, res, (error: unknown) => {
    if (error) {
      const message = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
        ? '头像文件不能超过 2MB。'
        : error instanceof Error && error.message === 'UNSUPPORTED_IMAGE'
          ? '仅支持 JPG、PNG 或 WebP 图片。'
          : '头像上传失败，请重试。';
      return res.status(400).json({ success: false, error: message });
    }

    void saveAvatar(req as AuthRequest, res);
  });
});

async function saveAvatar(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: '请先登录。' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, error: '请选择要上传的头像。' });
  }

  const extension = detectAvatarType(req.file.buffer);
  if (!extension) {
    return res.status(400).json({ success: false, error: '文件内容不是有效的图片。' });
  }

  const oldAvatar = req.user?.avatar;
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const publicPath = `/uploads/avatars/${filename}`;
  const filePath = join(AVATAR_DIR, filename);

  try {
    await ensureAvatarDir();
    await writeFile(filePath, req.file.buffer);

    let updated;
    try {
      updated = await prisma.user.update({
        where: { id: userId },
        data: { avatar: publicPath, updatedAt: new Date() },
      });
    } catch (error) {
      await unlink(filePath).catch(() => {});
      throw error;
    }

    await removeStoredAvatar(oldAvatar);

    res.json({
      success: true,
      data: { avatar: publicPath, user: toPublicUser(updated) },
      message: '头像已更新。',
    });
  } catch (error) {
    console.error('保存头像失败:', error instanceof Error ? error.message : error);
    res.status(500).json({ success: false, error: '保存头像失败，请稍后重试。' });
  }
}

accountRouter.delete('/avatar', async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: '请先登录。' });
  }

  try {
    const oldAvatar = req.user?.avatar;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatar: null, updatedAt: new Date() },
    });
    await removeStoredAvatar(oldAvatar);

    res.json({
      success: true,
      data: { avatar: null, user: toPublicUser(updated) },
      message: '头像已移除。',
    });
  } catch (error) {
    console.error('移除头像失败:', error instanceof Error ? error.message : error);
    res.status(500).json({ success: false, error: '移除头像失败，请稍后重试。' });
  }
});
