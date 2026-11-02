import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../../shared/types';
import { setTokenGetter } from '../services/tokenUtils';
import { authService } from '../services/authService';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkAuth: () => Promise<void>;
  updateSession: (token: string, user: User) => void;
  updateUser: (user: User) => void;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  sendVerificationCode: (email: string, type: 'register' | 'reset' | 'login' | 'password-change' | 'email-change') => Promise<void>;
  verifyVerificationCode: (email: string, code: string, type: 'register' | 'reset' | 'login' | 'password-change' | 'email-change') => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authService.login(username, password);

          if (response.success && response.user && response.token) {
            set({
              user: response.user,
              token: response.token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error('登录成功但返回数据格式不正确');
          }
        } catch (error) {
          let errorMessage = '登录失败';
          if (error instanceof Error) {
            errorMessage = error.message;
          }

          set({
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      logout: async () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => {
        set({ error: null });
      },

      checkAuth: async () => {
        try {
          const currentToken = get().token;

          if (!currentToken) {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
            return;
          }

          try {
            const response = await authService.getMe();

            if (response.success && response.user) {
              set({
                user: response.user,
                token: currentToken,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              });
            } else {
              set({
                user: null,
                token: null,
                isAuthenticated: false,
                isLoading: false,
              });
            }
          } catch {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch (error) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      updateSession: (token: string, user: User) => {
        set({
          token,
          user,
          isAuthenticated: true,
          error: null,
        });
      },

      updateUser: (user: User) => {
        set({
          user,
          isAuthenticated: true,
          error: null,
        });
      },

      forgotPassword: async (email: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authService.sendResetCode(email);

          if (!response.success) {
            throw new Error(response.message || '发送重置验证码失败');
          }

          set({ isLoading: false, error: null });
        } catch (error) {
          let errorMessage = '重置密码请求失败';
          if (error instanceof Error) {
            errorMessage = error.message;
          }

          set({
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      resetPassword: async (token: string, newPassword: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authService.resetPassword(token, newPassword);

          if (!response.success) {
            throw new Error(response.message || '重置密码失败');
          }

          set({ isLoading: false, error: null });
        } catch (error) {
          let errorMessage = '重置密码失败';
          if (error instanceof Error) {
            errorMessage = error.message;
          }

          set({
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      sendVerificationCode: async (email: string, type: 'register' | 'reset' | 'login' | 'password-change' | 'email-change') => {
        set({ isLoading: true, error: null });

        try {
          let response;
          if (type === 'reset') {
            response = await authService.sendResetCode(email);
          } else {
            response = await authService.sendVerificationCode(email);
          }

          if (!response.success) {
            throw new Error(response.message || '发送验证码失败');
          }

          set({ isLoading: false, error: null });
        } catch (error) {
          let errorMessage = '发送验证码失败';
          if (error instanceof Error) {
            errorMessage = error.message;
          }

          set({ isLoading: false, error: errorMessage });
          throw error;
        }
      },

      verifyVerificationCode: async (email: string, code: string, type: 'register' | 'reset' | 'login' | 'password-change' | 'email-change') => {
        set({ isLoading: true, error: null });

        try {
          let response;
          if (type === 'reset') {
            response = await authService.verifyResetCode(email, code);
          } else {
            response = await authService.verifyVerificationCodeWithType(email, code, type);
          }

          if (!response.success) {
            throw new Error(response.message || '验证验证码失败');
          }

          set({ isLoading: false, error: null });
        } catch (error) {
          let errorMessage = '验证验证码失败';
          if (error instanceof Error) {
            errorMessage = error.message;
          }

          set({ isLoading: false, error: errorMessage });
          throw error;
        }
      },

    }),
    {
      name: 'auth-storage',
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<AuthState>;

        // v2 之前会把登录明文密码写入 localStorage，迁移时一并清除旧会话
        if (version < 2) {
          return {
            ...state,
            token: null,
            isAuthenticated: false,
            user: null,
          } as AuthState;
        }

        return state as AuthState;
      },
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

setTokenGetter(() => useAuthStore.getState().token);
