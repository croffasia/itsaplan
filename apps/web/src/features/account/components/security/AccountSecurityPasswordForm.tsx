'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { changePassword } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// better-auth's default minimum password length.
const MIN_LENGTH = 8;

// Changes the account password. Requires the current password, and revokes other
// sessions so a leaked old password stops working elsewhere.
export default function AccountSecurityPasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (res.error) throw new Error(res.error.message ?? 'Could not change password.');
    },
    onSuccess: () => {
      toast.success('Password changed');
      reset();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not change password.'),
  });

  const valid = current.length > 0 && next.length >= MIN_LENGTH && confirm.length > 0;

  return (
    <form
      className="flex max-w-sm flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (next !== confirm) {
          setError('New passwords do not match');
          return;
        }
        if (!valid) return;
        saveMutation.mutate();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">At least {MIN_LENGTH} characters.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Button type="submit" size="sm" disabled={!valid || saveMutation.isPending}>
          {saveMutation.isPending ? 'Changing…' : 'Change password'}
        </Button>
      </div>
    </form>
  );
}
