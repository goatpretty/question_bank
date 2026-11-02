let _getToken: () => string | null = () => {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.state?.token ?? null;
    }
  } catch (error) {
    console.error('读取本地登录状态失败:', error);
  }
  return null;
};

export function setTokenGetter(fn: () => string | null) {
  _getToken = fn;
}

export function getToken(): string | null {
  return _getToken();
}
