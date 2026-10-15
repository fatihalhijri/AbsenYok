import Link from 'next/link';
import { BrandMark } from './brand-mark';
import { UserMenu } from './user-menu';

/** Topbar karyawan; padding atas mengikuti `safe-area-inset-top` (mode standalone/notch). */
export function EmployeeTopbar() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-backdrop-filter:bg-background/85">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <Link
          href="/app"
          className="min-w-0 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandMark />
        </Link>
        <UserMenu profileHref="/app/profile" />
      </div>
    </header>
  );
}
