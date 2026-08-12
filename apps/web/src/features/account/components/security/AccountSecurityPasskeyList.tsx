'use client';

import { ItemGroup } from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import AccountSecurityPasskeyItem from './AccountSecurityPasskeyItem';
import type { PasskeyRow } from '../../services/passkeys.service';
import { useTranslations } from 'next-intl';

export default function AccountSecurityPasskeyList({
  passkeys,
  isPending,
  onDelete,
}: {
  passkeys: PasskeyRow[];
  isPending: boolean;
  onDelete: (passkey: PasskeyRow) => void;
}) {
  const t = useTranslations('account.security');
  if (isPending) {
    return (
      <div className="space-y-2 py-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (passkeys.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <ItemGroup>
      {passkeys.map((pk) => (
        <AccountSecurityPasskeyItem key={pk.id} passkey={pk} onDelete={() => onDelete(pk)} />
      ))}
    </ItemGroup>
  );
}
