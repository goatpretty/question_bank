import { API_HOST } from '@/config/runtime';

/** 数据库存的是站内路径，开发环境需要补上 API 主机名。 */
export function resolveAvatarUrl(avatar?: string | null): string | null {
  if (!avatar) return null;
  if (/^(https?:|data:|blob:)/.test(avatar)) return avatar;
  const path = avatar.startsWith('/') ? avatar : `/${avatar}`;
  return `${API_HOST}${path}`;
}
