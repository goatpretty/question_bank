import { mkdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

/** 运行期上传文件目录，默认位于 var/uploads，已被 .gitignore 排除。 */
export const UPLOADS_ROOT = resolve(process.cwd(), process.env.UPLOAD_DIR || 'var/uploads');
export const AVATAR_DIR = join(UPLOADS_ROOT, 'avatars');

export async function ensureAvatarDir(): Promise<void> {
  await mkdir(AVATAR_DIR, { recursive: true });
}

/** 只接受本系统生成的头像路径，避免 ../ 之类的路径穿越。 */
export function avatarFilePathFromUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('/uploads/avatars/')) return null;

  const name = url.slice('/uploads/avatars/'.length);
  if (!name || name !== basename(name)) return null;

  return join(AVATAR_DIR, name);
}
