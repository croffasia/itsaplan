'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateUser, useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Saves through better-auth updateUser, which refreshes the session so every avatar
// and name in the app picks the change up. It also validates the username and
// refuses one another account already has — that message is what the form shows.
// The plugin keeps a second column for the username as typed, so it is sent along or
// it would keep showing the previous one.
export default function AccountProfileDetailsForm() {
  const t = useTranslations('account.profile');
  const tCommon = useTranslations('common');
  const { data: session } = useSession();
  const currentName = session?.user.name ?? '';
  const currentUsername = session?.user.username ?? '';
  const [name, setName] = useState(currentName);
  const [username, setUsername] = useState(currentUsername);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const trimmedUsername = username.trim().toLowerCase();
  const nameChanged = trimmedName.length > 0 && trimmedName !== currentName;
  const usernameChanged = trimmedUsername.length > 0 && trimmedUsername !== currentUsername;
  const dirty = nameChanged || usernameChanged;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await updateUser({
        ...(nameChanged ? { name: trimmedName } : {}),
        ...(usernameChanged ? { username: trimmedUsername, displayUsername: trimmedUsername } : {}),
      });
      if (res.error) throw new Error(res.error.message ?? t('detailsUpdateFailed'));
    },
    onSuccess: () => toast.success(t('detailsUpdated')),
    onError: (err) => setError(err instanceof Error ? err.message : t('detailsUpdateFailed')),
  });

  // The session loads after mount; fill the fields once it arrives.
  useEffect(() => {
    if (currentName) setName((value) => (value === '' ? currentName : value));
    if (currentUsername) setUsername((value) => (value === '' ? currentUsername : value));
  }, [currentName, currentUsername]);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!dirty) return;
        setError(null);
        saveMutation.mutate();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-name">{t('name')}</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-sm"
          autoComplete="name"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-username">{t('username')}</Label>
        <Input
          id="profile-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="max-w-sm"
          autoComplete="username"
          minLength={3}
          maxLength={30}
        />
        <p className="text-sm text-muted-foreground">{t('usernameHint')}</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Button type="submit" size="sm" disabled={!dirty || saveMutation.isPending}>
          {saveMutation.isPending ? tCommon('saving') : tCommon('save')}
        </Button>
      </div>
    </form>
  );
}
