'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { projectPath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  isExistingAccountError,
  registerAndAccept,
  signInForInvite,
} from '../services/invite.service';

type Mode = 'register' | 'signin';

// Authentication step for the invitee. The email is fixed to the invited address
// (the API only lets that email accept), so it is shown read-only. A new invitee
// registers and joins in one step, opening the project. An existing invitee only
// signs in — the page then shows the accept/reject step so they can decide.
export default function InviteAuthForm({
  token,
  email,
  hasAccount,
}: {
  token: string;
  email: string;
  hasAccount: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(hasAccount ? 'signin' : 'register');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  // A neutral note (not an error) — e.g. when we switch a registration to sign-in
  // because the invited email already has an account.
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isRegister = mode === 'register';

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setConfirm('');
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (isRegister && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setPending(true);
    try {
      if (isRegister) {
        const result = await registerAndAccept({ email, password, token });
        router.push(projectPath(result.projectKey));
        router.refresh();
      } else {
        await signInForInvite({ email, password });
        router.refresh();
      }
    } catch (err) {
      // There is no upfront "email exists" check, so a taken email surfaces only
      // here — switch to sign-in and keep the password the invitee already typed.
      if (isRegister && isExistingAccountError(err)) {
        switchMode('signin');
        setNotice('This email already has an account. Sign in with your password.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
      setPending(false);
    }
  }

  let submitLabel;
  if (isRegister) {
    submitLabel = pending ? 'Creating account…' : 'Create account & join';
  } else {
    submitLabel = pending ? 'Signing in…' : 'Sign in';
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="invite-email">Email</FieldLabel>
          <Input id="invite-email" type="email" value={email} readOnly disabled />
          <FieldDescription>The invite is tied to this email.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="invite-password">Password</FieldLabel>
          <Input
            id="invite-password"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
          {isRegister && <FieldDescription>Must be at least 8 characters long.</FieldDescription>}
        </Field>

        {isRegister && (
          <Field>
            <FieldLabel htmlFor="invite-confirm">Confirm password</FieldLabel>
            <Input
              id="invite-confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={pending}
            />
          </Field>
        )}

        {notice && <FieldDescription className="text-foreground">{notice}</FieldDescription>}
        {error && <FieldError>{error}</FieldError>}

        <Field>
          <Button type="submit" disabled={pending}>
            {submitLabel}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          {isRegister ? 'Already have an account?' : 'Need a new account?'}{' '}
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => switchMode(isRegister ? 'signin' : 'register')}
            disabled={pending}
          >
            {isRegister ? 'Sign in' : 'Create one'}
          </button>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
