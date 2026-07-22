'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import GoogleIcon from '@/components/common/GoogleIcon';
import AuthFormHeader from '../AuthFormHeader';
import AuthMessagePanel from '../AuthMessagePanel';
import { signInWithGoogle, signOutUnverified, signUpWithEmail } from '../../services/auth.service';
import { useAuthAction } from '../../hooks/useAuthAction';
import { useAuthConfig } from '@/services/authConfig.service';

export default function AuthRegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const { error, pending, setError, run } = useAuthAction();
  const authConfig = useAuthConfig();
  const inviteOnly = authConfig?.registration === 'invite';
  const needsConfirmation = authConfig?.requireEmailVerification === true;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    // With confirmation required, sign-up still opens a session (autoSignIn), so it
    // is dropped right away: the account exists but stays unusable until the link in
    // the email is opened.
    if (needsConfirmation) {
      run(
        async () => {
          await signUpWithEmail({ email, password });
          await signOutUnverified();
          setAwaitingConfirmation(true);
        },
        { redirect: false },
      );
      return;
    }
    run(() => signUpWithEmail({ email, password }));
  }

  if (awaitingConfirmation) {
    return (
      <AuthMessagePanel
        title="Confirm your email"
        description={`We sent a link to ${email}. Open it to finish creating your account.`}
        footer={
          <Link href="/login" className="underline underline-offset-4">
            Back to sign in
          </Link>
        }
      />
    );
  }

  // Registration closed: the form has nothing to submit to. Invite-only still shows
  // the form — an invited address can sign up here, and the API rejects the rest.
  if (authConfig?.registration === 'closed') {
    return (
      <AuthMessagePanel
        title="Registration is closed"
        description="This instance is not accepting new accounts."
        footer={
          <>
            Already have an account?{' '}
            <Link href="/login" className="underline underline-offset-4">
              Sign in
            </Link>
          </>
        }
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="p-6 md:p-8">
      <FieldGroup>
        <AuthFormHeader
          title="Create your account"
          description={
            inviteOnly
              ? 'This instance is invite only. Use the address you were invited with.'
              : 'Sign up with your email and password'
          }
        />

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
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
            {pending ? 'Creating account…' : 'Create account'}
          </Button>
        </Field>

        {/* Google covers sign-up too: an address without an account gets one, subject
            to the same registration mode as the form above. */}
        {authConfig?.google && (
          <>
            <FieldSeparator>Or</FieldSeparator>
            <Field>
              <Button
                type="button"
                variant="outline"
                onClick={() => run(signInWithGoogle, { redirect: false })}
                disabled={pending}
              >
                <GoogleIcon className="size-4" />
                Continue with Google
              </Button>
            </Field>
          </>
        )}

        <FieldDescription className="text-center">
          Already have an account?{' '}
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
