import { loginDestination } from '../utils/loginDestination';
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { BookOpen, User, Lock, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  
  const { login, error, clearError, isLoading: storeLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = loginDestination(location.state?.from);

  // 输入验证
  const validateForm = () => {
    const newErrors: { username?: string; password?: string } = {};
    
    if (!username.trim()) {
      newErrors.username = '请输入用户名或邮箱';
    } else {
      // 检查是否为邮箱格式
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username);
      if (!isEmail) {
        // 用户名格式验证：只允许字母、数字、下划线，长度3-20
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(username)) {
          newErrors.username = '用户名格式不正确，只允许字母、数字、下划线，长度3-20';
        }
      }
    }
    
    if (!password) {
      newErrors.password = '请输入密码';
    } else if (password.length < 8) {
      newErrors.password = '密码长度至少为8位';
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
      await login(username, password);
      navigate(destination, { replace: true });
    } catch (error: any) {
      console.error('Login failed:', error);
      const msg = error.data?.error || error.data?.message || error.message;
      if (msg) {
        setErrors(prev => ({ ...prev, password: msg }));
      }
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
          <p className="text-gray-600">欢迎回来，请登录您的账户</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                用户名或邮箱
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  autoComplete="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    // 清除对应字段的错误信息
                    if (errors.username) {
                      setErrors(prev => ({ ...prev, username: undefined }));
                    }
                  }}
                  className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-amber-500 focus:border-amber-500 ${errors.username ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="请输入用户名或邮箱"
                  required
                />
              </div>
              {errors.username && (
                <p className="text-red-600 text-sm mt-1">{errors.username}</p>
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
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    // 清除对应字段的错误信息
                    if (errors.password) {
                      setErrors(prev => ({ ...prev, password: undefined }));
                    }
                  }}
                  className={`block w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-amber-500 focus:border-amber-500 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="请输入密码"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  aria-controls="password"
                  className="absolute inset-y-0 right-0 px-3 flex items-center rounded-r-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
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
              {/* 忘记密码链接 */}
              <div className="mt-2 text-right">
                <Link
                  to="/forgot-password"
                  className="text-sm text-amber-600 hover:text-amber-500"
                >
                  忘记密码？
                </Link>
              </div>
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
              {(isLoading || storeLoading) ? '登录中...' : '登录'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              还没有账户？{' '}
              <Link to="/register" className="text-amber-600 hover:text-amber-500 font-medium">
                立即注册
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}