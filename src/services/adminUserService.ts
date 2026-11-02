import { User } from '../../shared/types';
import { BaseService } from './baseService';

interface UserListResponse {
  success: boolean;
  data: { users: User[]; total?: number };
  error?: string;
}

interface CreateUserResponse {
  success: boolean;
  data: User & { temporaryPassword?: string };
  error?: string;
}

interface ResetUserPasswordResponse {
  success: boolean;
  temporaryPassword?: string;
  message?: string;
  error?: string;
}

class AdminUserService extends BaseService {
  constructor() {
    super('auth');
  }

  async getUsers(params?: { page?: number; limit?: number; role?: string; search?: string }): Promise<UserListResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params)
        .filter(([_, v]) => v !== undefined)
        .forEach(([key, value]) => {
          searchParams.append(key, String(value));
        });
    }
    const url = `${this.apiBase}/users?${searchParams}`;
    return this.get<UserListResponse>(url);
  }

  async createUser(data: { username: string; password: string; role: string; email?: string }): Promise<CreateUserResponse> {
    return this.post<CreateUserResponse>(`${this.apiBase}/users`, data);
  }

  async resetUserPassword(userId: string): Promise<ResetUserPasswordResponse> {
    return this.post<ResetUserPasswordResponse>(`${this.apiBase}/users/${userId}/reset-password`);
  }
}

export const adminUserService = new AdminUserService();
