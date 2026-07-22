'use client';

import Link from 'next/link';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SettingsSection from '@/components/common/page/SettingsSection';
import { telegramAccountLabel, useTelegramAccountQuery } from '@/services/telegram.service';

// Where the member's Telegram notifications go. There is nothing to fill in here:
// the chat comes from the Telegram account connected to their profile, which is the
// same for every project. This only shows which account that is, or sends them to
// connect one.
export default function NotificationTelegramAccount() {
  const { data } = useTelegramAccountQuery();

  // Telegram is not offered on this instance at all.
  if (data && !data.botUsername) return null;

  const link = data?.link ?? null;
  const label = link ? telegramAccountLabel(link) : null;

  return (
    <SettingsSection
      title="Telegram account"
      description="Telegram notifications go to the account connected to your profile, for every project you are in."
    >
      <div className="flex items-center justify-between gap-6 rounded-lg border border-border p-4 sm:max-w-md">
        <div className="flex min-w-0 items-center gap-3">
          <Send className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm">{label ?? 'No Telegram account connected'}</span>
        </div>
        {!label && (
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="/account/accounts">Connect</Link>
          </Button>
        )}
      </div>
    </SettingsSection>
  );
}
