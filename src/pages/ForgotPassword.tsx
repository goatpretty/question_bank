import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, UserCheck } from 'lucide-react';
import { authService } from '../services/authService';

interface FormState {
  email: string;
  verificationCode: string;
  newPassword: string;
  confirmPassword: string;
  sendingCode: boolean;
  resettingPassword: boolean;
  countdown: number;
  showPassword: boolean;
  showConfirmPassword: boolean;
  emailActuallySent: boolean;
  success: boolean;
  errors: {
    email?: string;
    code?: string;
    password?: string;
    confirmPassword?: string;
  };
}

const initialState: FormState = {
  email: '',
  verificationCode: '',
  newPassword: '',
  confirmPassword: '',
  sendingCode: false,
  resettingPassword: false,
  countdown: 0,
  showPassword: false,
  showConfirmPassword: false,
  emailActuallySent: false,
  success: false,
  errors: {},
};

export default function ForgotPassword() {
  const [state, setState] = useState<FormState>(initialState);
  const [countdownTimer, setCountdownTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [countdownTimer]);

  const startCountdownTimer = (_seconds: number) => {
    const timer = setInterval(() => {
      setState(prev => {
        if (prev.countdown <= 1) {
          clearInterval(timer);
          return { ...prev, countdown: 0 };
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
    setCountdownTimer(timer);
  };

  const handleSendCode = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(state.email)) {
      setState(prev => ({
        ...prev,
        errors: { ...prev.errors, email: '邮箱格式不正确' },
      }));
      return;
    }

    setState(prev => ({ ...prev, sendingCode: true, errors: {} }));

    try {
      const data = await authService.sendResetCode(state.email);

      // 1. 后端冷却
      if (data.reason === 'cooldown' && data.remainingSeconds) {
        setState(prev => ({
          ...prev,
          sendingCode: false,
          countdown: data.remainingSeconds!,
          errors: { email: data.message || '请求过于频繁，请稍后再试' },
        }));
        startCountdownTimer(data.remainingSeconds!);
      }
      // 2. 邮件真正发送成功
      else if (data.success && data.emailSent) {
        setState(prev => ({
          ...prev,
          sendingCode: false,
          countdown: 300,
          emailActuallySent: true,
          errors: {},
        }));
        startCountdownTimer(300);
      }
      // 3. 开发模式：邮件未发出，验证码已生成
      else if (data.success && !data.emailSent) {
        setState(prev => ({
          ...prev,
          sendingCode: false,
          countdown: 300,
          emailActuallySent: false,
          errors: { email: data.message || '验证码已生成' },
        }));
        startCountdownTimer(300);
      }
      // 4. 其他失败
      else {
        setState(prev => ({
          ...prev,
          sendingCode: false,
          errors: { ...prev.errors, email: data.message || '发送验证码失败，请稍后重试' },
        }));
      }
    } catch (error: any) {
      if (error.status === 429 && error.data?.reason === 'cooldown') {
        const remaining = error.data.remainingSeconds ?? 300;
        setState(prev => ({
          ...prev,
          sendingCode: false,
          countdown: remaining,
          errors: { email: error.data.message || '请求过于频繁，请稍后再试' },
        }));
        startCountdownTimer(remaining);
      } else {
        console.error('发送验证码失败:', error);
        setState(prev => ({
          ...prev,
          sendingCode: false,
          errors: { ...prev.errors, email: '发送验证码失败，请稍后重试' },
        }));
      }
    }
  };

  const handleResetPassword = async () => {
    // 前端校验
    const newErrors: { email?: string; code?: string; password?: string; confirmPassword?: string } = {};

    if (!state.email) {
      newErrors.email = '请输入邮箱';
    }

    if (!state.verificationCode || state.verificationCode.length !== 6) {
      newErrors.code = '验证码长度为6位';
    }

    if (!state.newPassword) {
      newErrors.password = '请输入新密码';
    } else if (state.newPassword.length < 8) {
      newErrors.password = '密码长度至少为8位';
    } else {
      const hasLetter = /[A-Za-z]/.test(state.newPassword);
      const hasDigit = /\d/.test(state.newPassword);
      if (!hasLetter || !hasDigit) {
        newErrors.password = '密码必须同时包含至少一个英文字母和一个数字';
      }
    }

    if (!state.confirmPassword) {
      newErrors.confirmPassword = '请确认密码';
    } else if (state.newPassword !== state.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }

    if (Object.keys(newErrors).length > 0) {
      setState(prev => ({ ...prev, errors: newErrors }));
      return;
    }

    setState(prev => ({ ...prev, resettingPassword: true, errors: {} }));

    try {
      const data = await authService.resetPasswordByCode(
        state.email,
        state.verificationCode,
        state.newPassword,
      );

      if (data.success) {
        setState(prev => ({ ...prev, resettingPassword: false, success: true }));
      } else {
        setState(prev => ({
          ...prev,
          resettingPassword: false,
          errors: {
            ...prev.errors,
            code: data.message || '验证码错误或已过期',
          },
        }));
      }
    } catch (error: any) {
      const msg = error.data?.error || error.data?.message || error.message || '重置密码失败，请稍后重试';
      console.error('重置密码失败:', error);
      setState(prev => ({
        ...prev,
        resettingPassword: false,
        errors: {
          ...prev.errors,
          code: msg,
        },
      }));
    }
  };

  if (state.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-amber-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">密码重置成功</h2>
            <p className="text-gray-600 mb-6">
              您的密码已成功重置，请使用新密码登录。
            </p>
            <Link
              to="/login"
              className="inline-block w-full bg-amber-500 text-white py-3 px-4 rounded-lg hover:bg-amber-600 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors"
            >
              立即登录
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-amber-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-full mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">重置密码</h1>
          <p className="text-gray-600">
            请输入您的邮箱地址，我们将发送验证码到您的邮箱
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                邮箱地址
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={state.email}
                  onChange={(e) => {
                    setState(prev => ({
                      ...prev,
                      email: e.target.value,
                      errors: { ...prev.errors, email: undefined },
                    }));
                  }}
                  className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-amber-500 focus:border-amber-500 ${state.errors.email ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="请输入您的邮箱地址"
                  required
                />
              </div>
              {state.errors.email && (
                <p className="text-red-600 text-sm mt-1">{state.errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-2">
                验证码
              </label>
              <div className="flex space-x-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserCheck className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="verificationCode"
                    type="text"
                    value={state.verificationCode}
                    onChange={(e) => {
                      setState(prev => ({
                        ...prev,
                        verificationCode: e.target.value,
                        errors: { ...prev.errors, code: undefined },
                      }));
                    }}
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-amber-500 focus:border-amber-500 ${state.errors.code ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="请输入6位验证码"
                    maxLength={6}
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={state.sendingCode || state.countdown > 0}
                  className="whitespace-nowrap bg-amber-500 text-white py-3 px-4 rounded-lg hover:bg-amber-600 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {state.sendingCode ? '发送中...' : state.countdown > 0 ? `${Math.floor(state.countdown / 60)}:${String(state.countdown % 60).padStart(2, '0')}` : '获取验证码'}
                </button>
              </div>
              {state.errors.code && (
                <p className="text-red-600 text-sm mt-1">{state.errors.code}</p>
              )}
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                新密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="newPassword"
                  type={state.showPassword ? 'text' : 'password'}
                  value={state.newPassword}
                  onChange={(e) => {
                    const value = e.target.value;
                    setState(prev => ({
                      ...prev,
                      newPassword: value,
                      errors: {
                        ...prev.errors,
                        password: undefined,
                        confirmPassword: state.confirmPassword && value !== state.confirmPassword ? '两次输入的密码不一致' : undefined,
                      },
                    }));
                  }}
                  className={`block w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-amber-500 focus:border-amber-500 ${state.errors.password ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="请输入新密码（至少8位，包含字母和数字）"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setState(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                >
                  {state.showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {state.errors.password && (
                <p className="text-red-600 text-sm mt-1">{state.errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                确认新密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  type={state.showConfirmPassword ? 'text' : 'password'}
                  value={state.confirmPassword}
                  onChange={(e) => {
                    const value = e.target.value;
                    setState(prev => ({
                      ...prev,
                      confirmPassword: value,
                      errors: {
                        ...prev.errors,
                        confirmPassword: state.newPassword && value !== state.newPassword ? '两次输入的密码不一致' : undefined,
                      },
                    }));
                  }}
                  className={`block w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-amber-500 focus:border-amber-500 ${state.errors.confirmPassword ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="请再次输入新密码"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setState(prev => ({ ...prev, showConfirmPassword: !prev.showConfirmPassword }))}
                >
                  {state.showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {state.errors.confirmPassword && (
                <p className="text-red-600 text-sm mt-1">{state.errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetPassword}
              disabled={state.resettingPassword}
              className="w-full bg-amber-500 text-white py-3 px-4 rounded-lg hover:bg-amber-600 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {state.resettingPassword ? '重置中...' : '重置密码'}
            </button>

            {state.countdown > 0 && state.emailActuallySent && (
              <p className="text-green-600 text-sm text-center">
                验证码已发送，请查收邮箱
              </p>
            )}
          </div>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-gray-600 hover:text-amber-600"
            >
              <span className="mr-1">←</span> 返回登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
