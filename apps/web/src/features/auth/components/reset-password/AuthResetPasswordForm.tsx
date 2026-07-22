'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import AuthFormHeader from '../AuthFormHeader';
import AuthMessagePanel from '../AuthMessagePanel';
import { setNewPassword } from '../../services/auth.service';
import { useAuthAction } from '../../hooks/useAuthAction';

// The screen the reset link opens. better-auth redirects here with ?token= when the
// token is valid, and with ?error= when it expired or was already used.
export default function AuthResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';
  const linkError = params.get('error');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { error, pending, setError, run } = useAuthAction();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    run(
      async () => {
        const { signedIn } = await setNewPassword({ token, email, newPassword: password });
        router.push(signedIn ? '/' : '/login?reset=1');
        router.refresh();
      },
      { redirect: false },
    );
  }

  if (!token || linkError) {
    return (
      <AuthMessagePanel
        title="This link no longer works"
        description="Reset links expire and can be used once. Request a new one."
        footer={
          <Link href="/forgot-password" className="underline underline-offset-4">
            Send a new link
          </Link>
        }
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="p-6 md:p-8">
      <FieldGroup>
        <AuthFormHeader
          title="Set a new password"
          description="Choose a password you have not used here before"
        />

        <Field>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
          <FieldDescription>Must be at least 8 characters long.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={pending}
          />
        </Field>

        {error && <FieldError>{error}</FieldError>}

        <Field>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Set new password'}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
