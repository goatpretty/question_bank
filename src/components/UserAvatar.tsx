import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { resolveAvatarUrl } from '../lib/avatar';
import { cn } from '../lib/utils';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-16 w-16',
  xl: 'h-24 w-24',
};

const textClasses: Record<AvatarSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-xl',
  xl: 'text-3xl',
};

const iconClasses: Record<AvatarSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
  xl: 'h-10 w-10',
};

interface UserAvatarProps {
  avatar?: string | null;
  username?: string;
  size?: AvatarSize;
  className?: string;
}

export function UserAvatar({ avatar, username, size = 'md', className }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const url = resolveAvatarUrl(avatar);

  useEffect(() => {
    setFailed(false);
  }, [avatar]);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={username ? `${username} 的头像` : '用户头像'}
        className={cn(
          'rounded-full object-cover bg-secondary-100 dark:bg-secondary-800',
          sizeClasses[size],
          className,
        )}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-semibold shadow-soft',
        sizeClasses[size],
        textClasses[size],
        className,
      )}
      aria-label={username ? `${username} 的默认头像` : '默认头像'}
    >
      {username ? username.charAt(0).toUpperCase() : <User className={iconClasses[size]} />}
    </div>
  );
}
