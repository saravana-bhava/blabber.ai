import type { PostAccessLevel } from '@/lib/types';

export function computeHasFullPostAccess(opts: {
  accessLevel: PostAccessLevel;
  isOwnPost: boolean;
  isAdmin?: boolean;
  isAllAccess?: boolean;
  isSubscribed: boolean;
  hasPPVAccess: boolean;
}): boolean {
  const hasSpecialAccess = !!(opts.isAdmin || opts.isAllAccess);
  return (
    opts.accessLevel === 'public' ||
    opts.isOwnPost ||
    hasSpecialAccess ||
    (opts.accessLevel === 'subscribers_only' && opts.isSubscribed) ||
    (opts.accessLevel === 'ppv' && opts.hasPPVAccess)
  );
}

export function publicPostImageUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-images/${path}`;
}
