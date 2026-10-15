'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { adminBreadcrumbs } from './admin-nav';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

/** Topbar admin: tombol menu (hamburger di mobile), breadcrumb, tema, menu user. */
export function AdminTopbar() {
  const pathname = usePathname();
  const crumbs = adminBreadcrumbs(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/85 md:px-4">
      <SidebarTrigger className="size-10" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            // Di mobile hanya dua tingkat terakhir yang tampil.
            const hiddenOnMobile = index < crumbs.length - 2 && 'hidden md:inline-flex';
            return (
              <Fragment key={`${crumb.href}-${index}`}>
                <BreadcrumbItem className={cn('min-w-0', hiddenOnMobile)}>
                  {last ? (
                    <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {last ? null : <BreadcrumbSeparator className={cn(hiddenOnMobile)} />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu profileHref="/admin/settings" />
      </div>
    </header>
  );
}
