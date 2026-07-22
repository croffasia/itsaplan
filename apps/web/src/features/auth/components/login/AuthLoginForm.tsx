'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
import AuthFormHeader from '../AuthFormHeader';
import AuthLoginAlternatives from './AuthLoginAlternatives';
import AuthMessagePanel from '../AuthMessagePanel';
import AuthUnconfirmedNotice from './AuthUnconfirmedNotice';
import {
  EmailNotConfirmedError,
  resendVerificationEmail,
  sendMagicLink,
  signInWithEmail,
  signInWithGoogle,
  signInWithPasskey,
} from '../../services/auth.service';
import { useAuthAction } from '../../hooks/useAuthAction';
import { useAuthConfig } from '@/services/authConfig.service';
import { redirectErrorMessage } from '../../utils/redirectErrors';

// How the visitor is signing in. The screen holds one method at a time: with a
// password, or with a link mailed to the address. Passkeys stay available in both,
// since they need neither field.
type Method = 'password' | 'link';

export default function AuthLoginForm() {
  const [method, setMethod] = useState<Method>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // The address a sign-in link went to. Set on success, and it replaces the form:
  // there is nothing left to do on this screen until the inbox is opened.
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);
  // A confirmation email was re-sent. Inline, because the sign-in form stays useful.
  const [resent, setResent] = useState(false);
  // The last sign-in attempt was held back by the verification gate, so this screen
  // offers the confirmation link again.
  const [unconfirmed, setUnconfirmed] = useState(false);
  const { error, pending, setError, run } = useAuthAction();
  const authConfig = useAuthConfig();
  const params = useSearchParams();
  const justReset = params.get('reset') === '1';
  // A Google sign-in or a confirmation link that could not complete comes back here
  // as a redirect rather than as a rejected promise, so its reason arrives in the
  // query string.
  const redirectError = redirectErrorMessage(params.get('error'), params.get('error_description'));
  // The confirmation link carries ?verified=1 and adds ?error=… when it failed, so
  // the success line only stands while there is no error next to it.
  const justVerified = params.get('verified') === '1' && !redirectError;

  function switchTo(next: Method) {
    setMethod(next);
    setError(null);
    setUnconfirmed(false);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setUnconfirmed(false);
    setResent(false);
    if (method === 'link') {
      run(
        async () => {
          await sendMagicLink(email);
          setLinkSentTo(email);
        },
        { redirect: false },
      );
      return;
    }
    run(async () => {
      try {
        await signInWithEmail({ email, password });
      } catch (err) {
        if (err instanceof EmailNotConfirmedError) setUnconfirmed(true);
        throw err;
      }
    });
  }

  if (linkSentTo) {
    return (
      <AuthMessagePanel
        title="Check your email"
        description={`We sent a sign-in link to ${linkSentTo}. Open it to sign in.`}
        footer={
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => {
              setLinkSentTo(null);
              switchTo('password');
            }}
          >
            Back to sign in
          </button>
        }
      />
    );
  }

  const signingInWithLink = method === 'link';

  function subtitle() {
    if (justVerified) return 'Your email is confirmed. Sign in to continue.';
    if (justReset) return 'Your password is changed. Sign in with it.';
    if (signingInWithLink) return 'We will email you a link that signs you in';
    return 'Sign in with your email and password';
  }

  function submitLabel() {
    if (signingInWithLink) return pending ? 'Sending…' : 'Send sign-in link';
    return pending ? 'Signing in…' : 'Sign in';
  }

  return (
    <form onSubmit={onSubmit} className="p-6 md:p-8">
      <FieldGroup>
        <AuthFormHeader title="Welcome back" description={subtitle()} />

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

        {!signingInWithLink && (
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              {authConfig?.emailEnabled && (
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
            />
          </Field>
        )}

        {(error || redirectError) && <FieldError>{error ?? redirectError}</FieldError>}

        {unconfirmed && (
          <AuthUnconfirmedNotice
            resent={resent}
            pending={pending}
            canResend={Boolean(email)}
            onResend={() =>
              run(
                async () => {
                  await resendVerificationEmail(email);
                  setResent(true);
                },
                { redirect: false },
              )
            }
          />
        )}

        <Field>
          <Button type="submit" disabled={pending}>
            {submitLabel()}
          </Button>
        </Field>

        <FieldSeparator>Or</FieldSeparator>

        <AuthLoginAlternatives
          signingInWithLink={signingInWithLink}
          pending={pending}
          onToggleMethod={() => switchTo(signingInWithLink ? 'password' : 'link')}
          onGoogle={() => run(signInWithGoogle, { redirect: false })}
          onPasskey={() => run(signInWithPasskey)}
        />

        {/* Only when anyone can register. An invite-only instance hands out links
            directly, and a closed one has nowhere to send the visitor. */}
        {authConfig?.registration === 'open' && (
          <FieldDescription className="text-center">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="underline underline-offset-4">
              Sign up
            </Link>
          </FieldDescription>
        )}
      </FieldGroup>
    </form>
  );
}
