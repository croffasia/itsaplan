'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from '@/lib/auth-client';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleToggle } from '@/components/locale-toggle';
import GodPageSkeleton from '@/components/common/skeleton/GodPageSkeleton';
import UserMenu from '@/components/layout/UserMenu';
import GodSidebar from '@/components/layout/GodSidebar';

// The shell for god mode: the instance settings sidebar and a slim header, with no
// project loaded. It is the counterpart of Shell for the project routes, but far
// smaller — nothing here needs the board, overlays, or project permissions.
//
// Access is by the global role: only the instance owner ("god") sees the pages. The
// API enforces the same on every /god route, so this check is about what to render,
// not about security.
export default function GodShell({
  defaultSidebarOpen,
  children,
}: {
  defaultSidebarOpen: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('nav');
  const { data: session, isPending } = useSession();
  // The session can already be in the store on hydration while the server rendered
  // without it, so the role is only read after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isGod = mounted && session?.user.role === 'god';
  const sessionSettled = mounted && !isPending;

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen} className="h-svh overflow-hidden">
      <GodSidebar />
      <SidebarInset className="min-w-0">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2 sm:px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <div className="min-w-0 truncate text-sm font-medium">{t('godMode')}</div>
          <div className="ml-auto flex items-center gap-2">
            <LocaleToggle />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {isGod && children}
          {!isGod && sessionSettled && (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
              {t('godModeOwnerOnly')}
            </div>
          )}
          {!isGod && !sessionSettled && <GodPageSkeleton />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
