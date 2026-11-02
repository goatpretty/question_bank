import { BaseService } from './baseService';
import { useAuthStore } from '../stores/auth';
import { User, AuthResponse } from '../../shared/types';
import { getToken } from './tokenUtils';

interface SendCodeResponse {
  success: boolean;
  emailSent?: boolean;
  message?: string;
  reason?: 'cooldown';
  remainingSeconds?: number;
}

class AuthApiService extends BaseService {
  constructor() {
    super('auth');
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    return this.post<AuthResponse>('/api/auth/login', { username, password });
  }

  async getMe(): Promise<{ success: boolean; user: User }> {
    return this.get<{ success: boolean; user: User }>('/api/auth/me');
  }

  async checkUsername(username: string): Promise<{ success: boolean; exists: boolean }> {
    return this.get<{ success: boolean; exists: boolean }>(`/api/auth/check-username/${encodeURIComponent(username)}`);
  }

  async checkEmail(email: string): Promise<{ success: boolean; exists: boolean }> {
    return this.get<{ success: boolean; exists: boolean }>(`/api/auth/check-email/${encodeURIComponent(email)}`);
  }

  async sendVerificationCode(email: string): Promise<SendCodeResponse> {
    return this.post<SendCodeResponse>('/api/auth/send-verification-code', { email });
  }

  async verifyRegistration(email: string, code: string, password: string, username: string): Promise<AuthResponse> {
    return this.post<AuthResponse>('/api/auth/verify-registration', { email, code, password, username });
  }

  async sendResetCode(email: string): Promise<SendCodeResponse> {
    return this.post<SendCodeResponse>('/api/auth/send-reset-code', { email });
  }

  async verifyResetCode(email: string, code: string): Promise<{ success: boolean; token?: string; message?: string }> {
    return this.post<{ success: boolean; token?: string; message?: string }>('/api/auth/verify-reset-code', { email, code });
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    return this.post<{ success: boolean; message?: string }>('/api/auth/reset-password', { token, newPassword });
  }

  async resetPasswordWithCurrent(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message?: string; token?: string; user?: User }> {
    return this.post<{ success: boolean; message?: string; token?: string; user?: User }>('/api/auth/reset-password', {
      currentPassword,
      newPassword,
    });
  }

  async resetPasswordByCode(email: string, code: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    return this.post<{ success: boolean; message?: string }>('/api/auth/reset-password', {
      email,
      code,
      newPassword,
    });
  }

  async sendVerificationCodeWithType(email: string, type: 'register' | 'reset' | 'login' | 'password-change' | 'email-change'): Promise<SendCodeResponse> {
    return this.post<SendCodeResponse>('/api/auth/send-verification-code', { email, type });
  }

  async verifyVerificationCodeWithType(email: string, code: string, type: 'register' | 'reset' | 'login' | 'password-change' | 'email-change'): Promise<{ success: boolean; message?: string }> {
    return this.post<{ success: boolean; message?: string }>('/api/auth/verify-verification-code', { email, code, type });
  }

  async validateCurrentPassword(currentPassword: string): Promise<{ success: boolean; message?: string }> {
    return this.post<{ success: boolean; message?: string }>('/api/auth/reset-password', {
      currentPassword,
      validateOnly: true,
    });
  }
}

const authApi = new AuthApiService();

export const authService = {
  getToken(): string | null {
    const token = useAuthStore.getState().token;
    if (token) return token;
    return getToken();
  },

  login: (...args: Parameters<typeof authApi.login>) => authApi.login(...args),
  getMe: () => authApi.getMe(),
  checkUsername: (...args: Parameters<typeof authApi.checkUsername>) => authApi.checkUsername(...args),
  checkEmail: (...args: Parameters<typeof authApi.checkEmail>) => authApi.checkEmail(...args),
  sendVerificationCode: (...args: Parameters<typeof authApi.sendVerificationCode>) => authApi.sendVerificationCode(...args),
  verifyRegistration: (...args: Parameters<typeof authApi.verifyRegistration>) => authApi.verifyRegistration(...args),
  sendResetCode: (...args: Parameters<typeof authApi.sendResetCode>) => authApi.sendResetCode(...args),
  verifyResetCode: (...args: Parameters<typeof authApi.verifyResetCode>) => authApi.verifyResetCode(...args),
  resetPassword: (...args: Parameters<typeof authApi.resetPassword>) => authApi.resetPassword(...args),
  resetPasswordWithCurrent: (...args: Parameters<typeof authApi.resetPasswordWithCurrent>) => authApi.resetPasswordWithCurrent(...args),
  resetPasswordByCode: (...args: Parameters<typeof authApi.resetPasswordByCode>) => authApi.resetPasswordByCode(...args),
  sendVerificationCodeWithType: (...args: Parameters<typeof authApi.sendVerificationCodeWithType>) => authApi.sendVerificationCodeWithType(...args),
  verifyVerificationCodeWithType: (...args: Parameters<typeof authApi.verifyVerificationCodeWithType>) => authApi.verifyVerificationCodeWithType(...args),
  validateCurrentPassword: (...args: Parameters<typeof authApi.validateCurrentPassword>) => authApi.validateCurrentPassword(...args),
};
