'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateUser, useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Saves through better-auth updateUser, which refreshes the session so every
// avatar and name in the app picks the change up.
export default function AccountProfileNameForm() {
  const { data: session } = useSession();
  const currentName = session?.user.name ?? '';
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const dirty = trimmed.length > 0 && trimmed !== currentName;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await updateUser({ name: trimmed });
      if (res.error) throw new Error(res.error.message ?? 'Could not update name.');
    },
    onSuccess: () => toast.success('Name updated'),
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not update name.'),
  });

  // The session loads after mount; fill the field once the name arrives.
  useEffect(() => {
    if (currentName) setName((n) => (n === '' ? currentName : n));
  }, [currentName]);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!dirty) return;
        setError(null);
        saveMutation.mutate();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-name">Display name</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-sm"
          autoComplete="name"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Button type="submit" size="sm" disabled={!dirty || saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
