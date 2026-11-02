// Only same-origin application paths are valid return destinations.
export function loginDestination(from: unknown): string {
  if (!from || typeof from !== 'object') return '/';
  const { pathname, search = '', hash = '' } = from as Record<string, unknown>;
  if (typeof pathname !== 'string' || !pathname.startsWith('/') ||
      pathname.startsWith('//') || /[\\\s?#]/.test(pathname) ||
      pathname === '/login' || pathname === '/register') return '/';
  if (typeof search !== 'string' || (search && !search.startsWith('?')) ||
      typeof hash !== 'string' || (hash && !hash.startsWith('#'))) return '/';
  return `${pathname}${search}${hash}`;
}
