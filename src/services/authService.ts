import { useAuthStore } from '../stores/auth';

export const authService = {
  getToken(): string | null {
    const token = useAuthStore.getState().token;
    if (token) return token;
    try {
      const raw = localStorage.getItem('auth-storage');
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.state?.token ?? null;
      }
    } catch {}
    return null;
  }
};
