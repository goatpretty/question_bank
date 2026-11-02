import React, { useState } from 'react';
import { authService } from '../services/authService';
import { useAuthStore } from '../stores/auth';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface ForceChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ForceChangePasswordModal({ isOpen, onClose }: ForceChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const updateSession = useAuthStore((state) => state.updateSession);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // 验证新密码
    if (!newPassword) {
      setError('请输入新密码');
      setIsLoading(false);
      return;
    }

    // 密码验证：至少8位，必须同时包含字母和数字（允许特殊字符）
    if (newPassword.length < 8) {
      setError('密码长度至少为8位');
      setIsLoading(false);
      return;
    }
    const hasLetter = /[A-Za-z]/.test(newPassword);
    const hasDigit = /\d/.test(newPassword);
    if (!hasLetter || !hasDigit) {
      setError('密码必须同时包含至少一个英文字母和一个数字');
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      setIsLoading(false);
      return;
    }

    if (currentPassword === newPassword) {
      setError('新密码不能与当前密码相同');
      setIsLoading(false);
      return;
    }

    try {
      // 调用更新密码API
      const response = await authService.resetPasswordWithCurrent(currentPassword, newPassword);

      if (response.success && response.token && response.user) {
        // 后端已使旧令牌失效，这里替换为修改密码后签发的新令牌
        updateSession(response.token, response.user);
        onClose();
      } else {
        setError(response.message || '密码更新失败');
      }
    } catch (err: any) {
      const errorMessage = err?.message || err?.error || '密码更新失败，请稍后重试';
      setError(errorMessage);
      console.error('密码更新失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl">
          <CardHeader>
            <CardTitle>强制修改密码</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600 mb-4">
              您的密码是由管理员重置的，为了您的账号安全，请立即修改密码。
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="当前密码"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="请输入当前密码（管理员提供的临时密码）"
              />
              <Input
                label="新密码"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="请输入新密码（至少8位，包含字母和数字）"
              />
              <Input
                label="确认新密码"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入新密码"
              />
              {error && (
                <p className="text-red-600 text-sm mt-1">{error}</p>
              )}
            </form>
          </CardBody>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              取消
            </Button>
            <Button onClick={handleSubmit} loading={isLoading}>
              保存
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}