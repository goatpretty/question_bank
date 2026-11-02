import { BaseService } from './baseService';

interface UserProfileResponse {
  success: boolean;
  data: {
    id: string;
    username: string;
    email: string;
    role: 'student' | 'teacher' | 'admin';
    stats?: { totalWrongQuestions: number; masteredWrongQuestions: number; masteryRate: number };
    wrongBookStats?: {
      totalWrong: number;
      masteredCount: number;
      masteryRate: number;
    };
  };
  error?: string;
}

class UserService extends BaseService {
  constructor() {
    super('users');
  }

  async getProfile(): Promise<UserProfileResponse> {
    return this.get<UserProfileResponse>(`${this.apiBase}/profile`);
  }
}

export const userService = new UserService();
