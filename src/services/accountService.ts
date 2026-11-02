import { BaseService } from './baseService';
import type { User } from '../../shared/types';

interface AccountResponse {
  success: boolean;
  user?: User;
  message?: string;
  error?: string;
}

interface PasswordResponse extends AccountResponse {
  token?: string;
}

interface AvatarResponse {
  success: boolean;
  data?: {
    avatar: string | null;
    user: User;
  };
  message?: string;
  error?: string;
}

class AccountService extends BaseService {
  constructor() {
    super('account');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<PasswordResponse> {
    return this.post<PasswordResponse>(`${this.apiBase}/password`, { currentPassword, newPassword });
  }

  async uploadAvatar(blob: Blob): Promise<AvatarResponse> {
    const formData = new FormData();
    formData.append('avatar', blob, 'avatar.png');
    return this.post<AvatarResponse>(`${this.apiBase}/avatar`, formData);
  }

  async removeAvatar(): Promise<AvatarResponse> {
    return this.delete<AvatarResponse>(`${this.apiBase}/avatar`);
  }
}

export const accountService = new AccountService();
