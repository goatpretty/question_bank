import express from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createError } from '../middleware/errorHandler.js';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js';
import { AuthResponse, User } from '@/shared/types';

interface StoredUser extends User {
  password_hash: string;
}

const router = express.Router();

const users: StoredUser[] = [];

// Persistence for users
const STORE_DIR = path.resolve(process.cwd(), 'api', 'data');
const USERS_FILE = path.join(STORE_DIR, 'users.json');

function ensureStoreDir() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
}

function saveUsers() {
  try {
    ensureStoreDir();
    const serializable = users.map(u => ({
      ...u,
      createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
      updatedAt: u.updatedAt instanceof Date ? u.updatedAt.toISOString() : u.updatedAt,
    }));
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: serializable }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[auth] Failed to save users:', e);
  }
}

function loadUsersIfExists() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      const list: StoredUser[] = (data?.users || []).map((u: any) => ({
        ...u,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
      }));
      users.splice(0, users.length, ...list);
    }
  } catch (e) {
    console.warn('[auth] Failed to load users:', e);
  }
}

// Seed demo users in development for easier login
(() => {
  loadUsersIfExists();
  try {
    if (process.env.NODE_ENV !== 'production' && users.length === 0) {
      const pass = '123456';
      const hash = bcrypt.hashSync(pass, 10);
      const now = new Date();
      const demo: StoredUser[] = [
        {
          id: 'u-admin',
          username: 'admin',
          email: 'admin@example.com',
          role: 'admin',
          createdAt: now,
          updatedAt: now,
          password_hash: hash,
        },
        {
          id: 'u-teacher',
          username: 'teacher',
          email: 'teacher@example.com',
          role: 'teacher',
          createdAt: now,
          updatedAt: now,
          password_hash: hash,
        },
        {
          id: 'u-student',
          username: 'student',
          email: 'student@example.com',
          role: 'student',
          createdAt: now,
          updatedAt: now,
          password_hash: hash,
        },
      ];
      users.push(...demo);
      saveUsers();
      console.log('[auth] Seeded demo users: admin/teacher/student with password 123456');
    }
  } catch (e) {
    console.warn('[auth] Failed to seed demo users', e);
  }
})();

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role = 'student' } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required.'
      });
    }

    if (users.some(u => u.username === username || u.email === email)) {
      return res.status(409).json({
        success: false,
        error: 'Username or email already exists.'
      });
    }

    // 禁止非学生自助注册（教师/管理员只能由管理员创建）
    const requestedRole = (role || 'student') as 'student' | 'teacher' | 'admin';
    if (requestedRole !== 'student') {
      return res.status(403).json({
        success: false,
        error: '当前已关闭教师/管理员自助注册，请联系管理员创建账号。'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    
    const newUser: StoredUser = {
      id: Date.now().toString(),
      username,
      email,
      role: 'student',
      createdAt: new Date(),
      updatedAt: new Date(),
      password_hash: hashedPassword
    };

    users.push(newUser);
    saveUsers();

    const token = jwt.sign(
      { id: newUser.id, username, email, role: newUser.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    const response: AuthResponse = {
      success: true,
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt
      }
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed.'
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required.'
      });
    }

    const user = users.find(u => 
      u.username === username || u.email === username
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials.'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials.'
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    const response: AuthResponse = {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
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

router.get('/users', authMiddleware, requireRole(['admin']), (req, res) => {
  try {
    const safeUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
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
    if (users.some(u => u.username === username || u.email === email)) {
      return res.status(409).json({ success: false, error: '用户名或邮箱已存在。' });
    }
    const allowedRoles: Array<'student' | 'teacher'> = ['student', 'teacher'];
    const finalRole = allowedRoles.includes(role) ? role : 'student';
    const rawPwd = typeof password === 'string' && password.length >= 6 ? password : '123456';
    const hash = await bcrypt.hash(rawPwd, 12);
    const now = new Date();
    const user: StoredUser = {
      id: Date.now().toString(),
      username,
      email,
      role: finalRole,
      createdAt: now,
      updatedAt: now,
      password_hash: hash,
    };
    users.push(user);
    saveUsers();
    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '创建用户失败。' });
  }
});

router.post('/users/:id/reset-password', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body || {};
    const target = users.find(u => u.id === id);
    if (!target) return res.status(404).json({ success: false, error: 'User not found.' });
    const pwd = typeof newPassword === 'string' && newPassword.length >= 6 ? newPassword : '123456';
    const hash = await bcrypt.hash(pwd, 12);
    target.password_hash = hash;
    target.updatedAt = new Date();
    saveUsers();
    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reset password.' });
  }
});

export { router as authRouter };
