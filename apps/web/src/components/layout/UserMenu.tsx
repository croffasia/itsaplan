'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { signOut, useSession } from '@/lib/auth-client';
import { ACCOUNT_SECTIONS, accountPath } from '@/utils/accountSections';
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

// Signed-in user control in the header: shows the account avatar and a menu with
// the email, the role, links to preferences, connected accounts, account security
// (passkeys) and API keys, and sign out.
// Signing out clears the session and the middleware sends the browser back to
// the login page.
export default function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  if (isPending) return <Skeleton className="size-7 rounded-full" />;
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
      <DropdownMenuTrigger asChild>
        <button type="button" title={user.email} className="rounded-full outline-none">
          <Avatar name={user.name || user.email} image={image} className="size-7 text-[11px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="truncate text-sm font-medium">{user.email}</span>
          <span className="text-xs text-muted-foreground capitalize">Role: {role}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ACCOUNT_SECTIONS.map(({ slug, label, icon: Icon }) => (
          <DropdownMenuItem key={slug} asChild>
            <Link href={accountPath(slug)}>
              <Icon />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
