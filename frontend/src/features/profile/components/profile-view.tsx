'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/auth-store';
import { ProfileHeader } from './profile-header';
import { ProfileInfo } from './profile-info';
import { ProfileMenu } from './profile-menu';

/** `/app/profile`: header avatar, info akun, menu pengaturan. */
export function ProfileView() {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Skeleton className="h-[560px] w-full rounded-2xl" />;
  return (
    <div className="space-y-5">
      <ProfileHeader user={user} />
      <ProfileInfo user={user} />
      <ProfileMenu />
    </div>
  );
}
