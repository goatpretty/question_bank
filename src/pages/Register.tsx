import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { authService } from '../services/authService';
import { BookOpen, User, Mail, Lock, Eye, EyeOff, UserCheck } from 'lucide-react';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [emailActuallySent, setEmailActuallySent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errors, setErrors] = useState<{ username?: string; email?: string; password?: string; confirmPassword?: string; code?: string }>({});
  const [checking, setChecking] = useState<{ username?: boolean; email?: boolean }>({});
  const [usernameCheckTimer, setUsernameCheckTimer] = useState<NodeJS.Timeout | null>(null);
  const [emailCheckTimer, setEmailCheckTimer] = useState<NodeJS.Timeout | null>(null);
  const [countdownTimer, setCountdownTimer] = useState<NodeJS.Timeout | null>(null);

  const { error, clearError, isLoading: storeLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSendCode = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrors(prev => ({ ...prev, email: '邮箱格式不正确' }));
      return;
    }

    setSendingCode(true);

    try {
      const data = await authService.sendVerificationCode(email);

      // 1. 后端冷却
      if (data.reason === 'cooldown' && data.remainingSeconds) {
        setCountdown(data.remainingSeconds);
        setErrors(prev => ({ ...prev, email: data.message || '请求过于频繁，请稍后再试' }));
        startCountdownTimer(data.remainingSeconds);
      }
      // 2. 邮件真正发送成功
      else if (data.success && data.emailSent) {
        setCodeSent(true);
        setEmailActuallySent(true);
        setCountdown(300);
        setErrors(prev => ({ ...prev, email: undefined }));
        startCountdownTimer(300);
      }
      // 3. 开发模式：邮件未发出，验证码已生成
      else if (data.success && !data.emailSent) {
        setCodeSent(true);
        setEmailActuallySent(false);
        setCountdown(300);
        setErrors(prev => ({ ...prev, email: data.message || '验证码已生成' }));
        startCountdownTimer(300);
      }
      // 4. 其他失败
      else {
        setErrors(prev => ({ ...prev, email: data.message || '发送验证码失败，请稍后重试' }));
      }
    } catch (error: any) {
      if (error.status === 429 && error.data?.reason === 'cooldown') {
        const remaining = error.data.remainingSeconds ?? 300;
        setCountdown(remaining);
        setErrors(prev => ({ ...prev, email: error.data.message || '请求过于频繁，请稍后再试' }));
        startCountdownTimer(remaining);
      } else {
        console.error('发送验证码失败:', error);
        setErrors(prev => ({ ...prev, email: '发送验证码失败，请稍后重试' }));
      }
    } finally {
      setSendingCode(false);
    }
  };

  const startCountdownTimer = (_seconds: number) => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setCodeSent(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setCountdownTimer(timer);
  };

  useEffect(() => {
    return () => {
      if (countdownTimer) {
        clearInterval(countdownTimer);
      }
    };
  }, [countdownTimer]);

  const checkUsername = async (value: string) => {
    if (!value.trim()) return;

    setChecking(prev => ({ ...prev, username: true }));

    try {
      const usernameRegex = /^[a-zA-Z0-9]{3,20}$/;
      if (!usernameRegex.test(value)) {
        setErrors(prev => ({ ...prev, username: '用户名格式不正确，只允许字母、数字，长度3-20' }));
        return false;
      }

      const data = await authService.checkUsername(value);

      if (data.success) {
        if (data.exists) {
          setErrors(prev => ({ ...prev, username: '用户名已存在，请选择其他用户名' }));
          return false;
        } else {
          setErrors(prev => ({ ...prev, username: undefined }));
          return true;
        }
      } else {
        setErrors(prev => ({ ...prev, username: '检查用户名失败，请稍后重试' }));
        return false;
      }
    } catch (error) {
      console.error('检查用户名失败:', error);
      setErrors(prev => ({ ...prev, username: '检查用户名失败，请稍后重试' }));
      return false;
    } finally {
      setChecking(prev => ({ ...prev, username: false }));
    }
  };

  const checkEmail = async (value: string) => {
    if (!value.trim()) return;

    setChecking(prev => ({ ...prev, email: true }));

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        setErrors(prev => ({ ...prev, email: '邮箱格式不正确' }));
        return false;
      }

      const data = await authService.checkEmail(value);

      if (data.success) {
        if (data.exists) {
          setErrors(prev => ({ ...prev, email: '邮箱已存在，请使用其他邮箱' }));
          return false;
        } else {
          setErrors(prev => ({ ...prev, email: undefined }));
          return true;
        }
      } else {
        setErrors(prev => ({ ...prev, email: '检查邮箱失败，请稍后重试' }));
        return false;
      }
    } catch (error) {
      console.error('检查邮箱失败:', error);
      setErrors(prev => ({ ...prev, email: '检查邮箱失败，请稍后重试' }));
      return false;
    } finally {
      setChecking(prev => ({ ...prev, email: false }));
    }
  };

  const validateForm = () => {
    const newErrors: { username?: string; email?: string; password?: string; confirmPassword?: string; code?: string } = {};

    if (!username.trim()) {
      newErrors.username = '请输入用户名';
    } else {
      const usernameRegex = /^[a-zA-Z0-9]+$/;
      if (!usernameRegex.test(username)) {
        newErrors.username = '用户名只能包含英文字母和数字';
      } else if (username.length < 3 || username.length > 20) {
        newErrors.username = '用户名长度必须在3-20个字符之间';
      }
    }

    if (!email.trim()) {
      newErrors.email = '请输入邮箱';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        newErrors.email = '邮箱格式不正确';
      }
    }

    if (!password) {
      newErrors.password = '请输入密码';
    } else if (password.length < 8) {
      newErrors.password = '密码至少需要8位';
    } else {
      const hasLetter = /[A-Za-z]/.test(password);
      const hasDigit = /\d/.test(password);
      if (!hasLetter || !hasDigit) {
        newErrors.password = '密码必须同时包含至少一个英文字母和一个数字';
      }
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = '请确认密码';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }

    if (codeSent && !verificationCode) {
      newErrors.code = '请输入验证码';
    } else if (codeSent && verificationCode.length !== 6) {
      newErrors.code = '验证码长度为6位';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const data = await authService.verifyRegistration(email, verificationCode, password, username);

      if (data.success) {
        navigate('/');
      } else {
        const err = data as { success: boolean; error?: string; message?: string };
        setErrors(prev => ({
          ...prev,
          code: err.error || data.message || '验证码错误或已过期',
        }));
      }
    } catch (error: any) {
      console.error('Registration failed:', error);
      const msg = error.data?.error || error.data?.message || error.message || '注册失败，请稍后重试';
      setErrors(prev => ({ ...prev, code: msg }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-amber-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-full mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">思政复习题库系统</h1>
          <p className="text-gray-600">创建您的新账户</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                用户类型
              </label>
              <div className="p-3 border rounded-lg text-sm text-gray-600 bg-gray-50">
                当前仅支持注册学生账号；教师账号请联系管理员在后台创建。
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                用户名
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    const value = e.target.value;
                    setUsername(value);
                    if (errors.username) {
                      setErrors(prev => ({ ...prev, username: undefined }));
                    }
                    if (usernameCheckTimer) {
                      clearTimeout(usernameCheckTimer);
                    }
                    const timer = setTimeout(() => {
                      checkUsername(value);
                    }, 1000);
                    setUsernameCheckTimer(timer);
                  }}
                  onBlur={(e) => {
                    checkUsername(e.target.value);
                  }}
                  className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-amber-500 focus:border-amber-500 ${errors.username ? 'border-red-500' : checking.username ? 'border-yellow-500' : 'border-gray-300'}`}
                  placeholder="请输入用户名"
                  required
                />
              </div>
              {checking.username && (
                <p className="text-yellow-600 text-sm mt-1">检查用户名是否可用...</p>
              )}
              {errors.username && (
                <p className="text-red-600 text-sm mt-1">{errors.username}</p>
              )}
            </div>

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
                  value={email}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEmail(value);
                    if (errors.email) {
                      setErrors(prev => ({ ...prev, email: undefined }));
                    }
                    if (emailCheckTimer) {
                      clearTimeout(emailCheckTimer);
                    }
                    const timer = setTimeout(() => {
                      checkEmail(value);
                    }, 1000);
                    setEmailCheckTimer(timer);
                  }}
                  onBlur={(e) => {
                    checkEmail(e.target.value);
                  }}
                  className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-amber-500 focus:border-amber-500 ${errors.email ? 'border-red-500' : checking.email ? 'border-yellow-500' : 'border-gray-300'}`}
                  placeholder="请输入邮箱地址"
                  required
                />
              </div>
              {checking.email && (
                <p className="text-yellow-600 text-sm mt-1">检查邮箱是否可用...</p>
              )}
              {errors.email && (
                <p className="text-red-600 text-sm mt-1">{errors.email}</p>
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
                    value={verificationCode}
                    onChange={(e) => {
                      const value = e.target.value;
                      setVerificationCode(value);
                      if (errors.code) {
                        setErrors(prev => ({ ...prev, code: undefined }));
                      }
                    }}
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-amber-500 focus:border-amber-500 ${errors.code ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="请输入6位验证码"
                    maxLength={6}
                    required={codeSent}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sendingCode || countdown > 0}
                  className="whitespace-nowrap bg-amber-500 text-white py-3 px-4 rounded-lg hover:bg-amber-600 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendingCode ? '发送中...' : countdown > 0 ? `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}` : '获取验证码'}
                </button>
              </div>
              {errors.code && (
                <p className="text-red-600 text-sm mt-1">{errors.code}</p>
              )}
              {codeSent && emailActuallySent && (
                <p className="text-green-600 text-sm mt-1">验证码已发送，请查收邮箱</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPassword(value);

                    let passwordError: string | undefined;
                    if (value && value.length < 8) {
                      passwordError = '密码至少需要8位';
                    } else if (value) {
                      const hasLetter = /[A-Za-z]/.test(value);
                      const hasDigit = /\d/.test(value);
                      if (!hasLetter || !hasDigit) {
                        passwordError = '密码必须同时包含至少一个英文字母和一个数字';
                      }
                    }

                    setErrors(prev => ({
                      ...prev,
                      password: passwordError,
                      confirmPassword: confirmPassword && value !== confirmPassword ? '两次输入的密码不一致' : undefined
                    }));
                  }}
                  className={`block w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-amber-500 focus:border-amber-500 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="请输入8位包含字母和数字的密码"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-600 text-sm mt-1">{errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                确认密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    const value = e.target.value;
                    setConfirmPassword(value);
                    if (password && value !== password) {
                      setErrors(prev => ({ ...prev, confirmPassword: '两次输入的密码不一致' }));
                    } else {
                      setErrors(prev => ({ ...prev, confirmPassword: undefined }));
                    }
                  }}
                  className={`block w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-amber-500 focus:border-amber-500 ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="请再次输入密码"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-600 text-sm mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || storeLoading}
              className="w-full bg-amber-500 text-white py-3 px-4 rounded-lg hover:bg-amber-600 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {(isLoading || storeLoading) ? '注册中...' : '注册'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              已有账户？{' '}
              <Link to="/login" className="text-amber-600 hover:text-amber-500 font-medium">
                立即登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
