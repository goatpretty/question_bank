import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useAuthStore } from '../stores/auth';

interface EmailVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  onVerificationSuccess: () => void;
}

export function EmailVerificationModal({ isOpen, onClose, email, onVerificationSuccess }: EmailVerificationModalProps) {
  const { sendVerificationCode, verifyVerificationCode } = useAuthStore();
  const [currentEmail, setCurrentEmail] = useState(email);
  const [newEmail, setNewEmail] = useState('');
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 倒计时逻辑
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 关闭弹窗时重置状态
  useEffect(() => {
    if (!isOpen) {
      setCurrentEmail(email);
      setNewEmail('');
      setShowChangeEmail(false);
      setVerificationCode('');
      setCountdown(0);
      setError('');
      setSuccess('');
    }
  }, [isOpen, email]);

  // 发送验证邮件
  const handleSendVerificationCode = async () => {
    if (countdown > 0) return;
    
    setIsSendingCode(true);
    setError('');
    setSuccess('');
    
    try {
      await sendVerificationCode(currentEmail, 'login');
      setSuccess('验证邮件已发送，请注意查收！');
      setCountdown(60); // 60秒倒计时
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送验证邮件失败，请稍后重试。');
    } finally {
      setIsSendingCode(false);
    }
  };

  // 验证验证码
  const handleVerifyCode = async () => {
    if (!verificationCode) {
      setError('请输入验证码');
      return;
    }
    
    setIsVerifying(true);
    setError('');
    setSuccess('');
    
    try {
      await verifyVerificationCode(currentEmail, verificationCode, 'login');
      setSuccess('邮箱验证成功！');
      // 延迟关闭弹窗，让用户看到成功信息
      setTimeout(() => {
        onVerificationSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码无效或已过期，请重新获取。');
    } finally {
      setIsVerifying(false);
    }
  };

  // 切换邮箱
  const handleChangeEmail = () => {
    if (!newEmail) {
      setError('请输入新邮箱');
      return;
    }
    
    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setError('请输入有效的邮箱地址');
      return;
    }
    
    setCurrentEmail(newEmail);
    setNewEmail('');
    setShowChangeEmail(false);
    setSuccess('邮箱已更换，请点击发送验证邮件。');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl">
          <CardHeader>
            <CardTitle>邮箱验证</CardTitle>
            <CardDescription>
              为了您的账号安全，首次登录需要验证邮箱
            </CardDescription>
          </CardHeader>
          <CardBody>
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-md text-sm">
                {success}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  当前关联邮箱
                </label>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">{currentEmail}</p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowChangeEmail(!showChangeEmail)}
                  >
                    {showChangeEmail ? '取消' : '更换邮箱'}
                  </Button>
                </div>
              </div>
              
              {showChangeEmail && (
                <div className="space-y-2">
                  <Input
                    placeholder="请输入新邮箱"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    type="email"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleChangeEmail}
                  >
                    确认更换
                  </Button>
                </div>
              )}
              
              <div className="space-y-2">
                <Button
                  onClick={handleSendVerificationCode}
                  disabled={isSendingCode || countdown > 0}
                  className="w-full"
                >
                  {isSendingCode ? '发送中...' : countdown > 0 ? `重新发送(${countdown}s)` : '发送验证邮件'}
                </Button>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  验证码
                </label>
                <Input
                  placeholder="请输入6位验证码"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  type="text"
                  maxLength={6}
                />
                <Button
                  onClick={handleVerifyCode}
                  disabled={isVerifying || !verificationCode}
                  className="w-full"
                >
                  {isVerifying ? '验证中...' : '验证验证码'}
                </Button>
              </div>
            </div>
          </CardBody>
          <CardFooter className="flex justify-center">
            <p className="text-xs text-gray-500 text-center">
              验证码将在5分钟后过期，请及时验证。
              <br />
              如未收到邮件，请检查垃圾邮箱或重新发送。
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
