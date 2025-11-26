import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthResponse } from '../../shared/types';
const API_HOST = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3001`;

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
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
          const response = await fetch(`${API_HOST}/api/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
          });

          const data: AuthResponse = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || '登录失败');
          }

          if (data.token && data.user) {
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            try { localStorage.setItem('token', data.token); } catch {}
          }
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : '登录失败',
          });
          throw error;
        }
      },

      register: async (username: string, email: string, password: string, role = 'student') => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(`${API_HOST}/api/auth/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password, role }),
          });

          const data: AuthResponse = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || '注册失败');
          }

          if (data.token && data.user) {
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            try { localStorage.setItem('token', data.token); } catch {}
          }
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : '注册失败',
          });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
        try { localStorage.removeItem('token'); } catch {}
      },

      clearError: () => {
        set({ error: null });
      },

      checkAuth: async () => {
        try {
          let token = get().token || localStorage.getItem('token');
          if (!token) {
            try {
              const raw = localStorage.getItem('auth-storage');
              if (raw) {
                const parsed = JSON.parse(raw);
                token = parsed?.state?.token || parsed?.token || null;
              }
            } catch {}
          }
          if (!token) {
            set({ isAuthenticated: false, user: null, token: null });
            return;
          }
          // Optimistic auth: decode JWT payload locally to avoid logout on refresh
          try {
            const payload = JSON.parse(atob(token.split('.')[1] || ''));
            if (payload && payload.id) {
              set({ isAuthenticated: true, user: {
                id: payload.id,
                username: payload.username,
                email: payload.email,
                role: payload.role,
                createdAt: new Date(payload.createdAt || Date.now()),
                updatedAt: new Date(payload.updatedAt || Date.now()),
              }, token });
            }
          } catch {}
          const resp = await fetch(`${API_HOST}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await resp.json();
          if (resp.ok && data?.success && data?.user) {
            set({ isAuthenticated: true, user: data.user, token });
          } else {
            // Keep optimistic auth to prevent logout on refresh; optionally clear if needed later
            // set({ isAuthenticated: false, user: null, token: null });
            // localStorage.removeItem('token');
          }
        } catch (e) {
          // Keep current auth state on network errors
          // set({ isAuthenticated: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
