'use client';

import { ItemGroup } from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import AccountSecurityPasskeyItem from './AccountSecurityPasskeyItem';
import type { PasskeyRow } from '../../services/passkeys.service';

export default function AccountSecurityPasskeyList({
  passkeys,
  isPending,
  onDelete,
}: {
  passkeys: PasskeyRow[];
  isPending: boolean;
  onDelete: (passkey: PasskeyRow) => void;
}) {
  if (isPending) {
    return (
      <div className="space-y-2 py-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (passkeys.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        No passkeys yet. Add one to sign in without a password.
      </p>
    );
  }

  return (
    <ItemGroup>
      {passkeys.map((pk) => (
        <AccountSecurityPasskeyItem key={pk.id} passkey={pk} onDelete={() => onDelete(pk)} />
      ))}
    </ItemGroup>
  );
}
