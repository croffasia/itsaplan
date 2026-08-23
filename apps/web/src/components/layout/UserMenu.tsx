'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { signOut, useSession } from '@/lib/auth-client';
import { ACCOUNT_SECTIONS, accountPath } from '@/utils/accountSections';
import { useAccountSectionLabel } from '@/hooks/useSectionLabels';
import Avatar from '@/components/common/Avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Signed-in user control in the header: shows the account avatar and a menu with
// the email, the role, links to preferences, connected accounts, account security
// (passkeys) and API keys, and sign out.
// Signing out clears the session and the proxy sends the browser back to
// the login page.
export default function UserMenu() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const sectionLabel = useAccountSectionLabel();
  const router = useRouter();
  const { data: session, isPending } = useSession();

  // better-auth reads the session on the client, so the server renders no user and
  // the client may already have a cached session. Render the placeholder until
  // mounted so the first client render matches the server and hydration succeeds.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || isPending) return <Skeleton className="size-7 rounded-full" />;
  if (!session) return null;

  const { user } = session;
  const role = (user as { role?: string }).role ?? 'user';
  const image = (user as { image?: string | null }).image ?? null;

  async function onSignOut() {
    await signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={user.email} className="rounded-full outline-none">
              <Avatar name={user.name || user.email} image={image} className="size-7 text-[11px]" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{user.email}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="truncate text-sm font-medium">{user.email}</span>
          <span className="text-xs text-muted-foreground capitalize">{t('role', { role })}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ACCOUNT_SECTIONS.map(({ slug, icon: Icon }) => (
          <DropdownMenuItem key={slug} asChild>
            <Link href={accountPath(slug)}>
              <Icon />
              {sectionLabel(slug)}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut />
          {tCommon('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
