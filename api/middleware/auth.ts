import { Request, Response, NextFunction } from 'express';
import { User } from '../../shared/types.js';
import { prisma } from '../db/prisma.js';
import { verifyAccessToken, type UserRole } from '../utils/jwt.js';

export interface AuthRequest extends Request {
  user?: User;
}

const PASSWORD_CHANGE_ALLOWED_PATHS = new Set([
  '/api/auth/me',
  '/api/auth/reset-password',
]);

function isPasswordChangeAllowed(req: Request): boolean {
  const path = req.originalUrl.split('?')[0];
  return PASSWORD_CHANGE_ALLOWED_PATHS.has(path);
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.header('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No token provided.',
    });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No token provided.',
    });
  }

  try {
    const payload = verifyAccessToken(token);

    const dbUser = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        needPasswordChange: true,
        tokenVersion: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!dbUser || dbUser.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({
        success: false,
        error: '登录状态已失效，请重新登录。',
      });
    }

    req.user = {
      ...dbUser,
      role: dbUser.role as UserRole,
    };

    if (dbUser.needPasswordChange && !isPasswordChangeAllowed(req)) {
      return res.status(403).json({
        success: false,
        code: 'PASSWORD_CHANGE_REQUIRED',
        error: '请先修改初始密码。',
      });
    }

    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token.',
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. User not authenticated.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Insufficient permissions.',
      });
    }

    next();
  };
};
