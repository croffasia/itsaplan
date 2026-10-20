'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { projectPath, projectRefOf } from '@/utils/paths';
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
import { useAuthConfig } from '@/services/authConfig.service';
import AuthLoginAlternatives from '@/features/auth/components/login/AuthLoginAlternatives';
import { useRedirectError } from '@/features/auth/hooks/useRedirectError';
import { useRefusalMessage } from '@/hooks/useRefusalMessage';
import {
  signInWithGoogle,
  signInWithOidc,
  signInWithPasskey,
} from '@/features/auth/services/auth.service';
import {
  isExistingAccountError,
  registerAndAccept,
  signInForInvite,
} from '../services/invite.service';

type Mode = 'register' | 'signin';

// Authentication step for the invitee. The email is fixed to the invited address
// (the API only lets that email accept), so it is shown read-only. A new invitee
// registers and joins in one step, opening the project. An existing invitee only
// signs in — the page then shows the accept/reject step so they can decide. The other
// sign-in methods of the sign-in screen come back here, and are all there is while the
// instance has the password form off.
export default function InviteAuthForm({
  token,
  email,
  hasAccount,
}: {
  token: string;
  email: string;
  hasAccount: boolean;
}) {
  const t = useTranslations('invite');
  const tAuth = useTranslations('auth.errors');
  const refusalMessage = useRefusalMessage();
  const tLogin = useTranslations('auth.login');
  const router = useRouter();
  const passwordEnabled = useAuthConfig()?.emailPassword !== false;
  const params = useSearchParams();
  const redirectError = useRedirectError()(params.get('error'), params.get('error_description'));
  const returnTo = `/invite/${token}`;
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
      setError(t('passwordsDoNotMatch'));
      return;
    }
    setPending(true);
    try {
      if (isRegister) {
        const result = await registerAndAccept({
          email,
          password,
          token,
          registerFailed: t('registerFailed'),
        });
        router.push(
          result.projectKey ? projectPath(projectRefOf(result.teamRef, result.projectKey)) : '/',
        );
        router.refresh();
      } else {
        await signInForInvite({ email, password, signInFailed: t('signInFailed') });
        router.refresh();
      }
    } catch (err) {
      // There is no upfront "email exists" check, so a taken email surfaces only
      // here — switch to sign-in and keep the password the invitee already typed.
      if (isRegister && isExistingAccountError(err)) {
        switchMode('signin');
        setNotice(t('existingAccountNotice'));
      } else {
        setError(refusalMessage(err));
      }
      setPending(false);
    }
  }

  async function signInOtherwise(start: () => Promise<void>, fallback?: string) {
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      await start();
      router.refresh();
    } catch (err) {
      setError(refusalMessage(err, fallback));
    }
    setPending(false);
  }

  let submitLabel;
  if (isRegister) {
    submitLabel = pending ? t('registering') : t('register');
  } else {
    submitLabel = pending ? t('signingIn') : t('signIn');
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="invite-email">{t('emailLabel')}</FieldLabel>
          <Input id="invite-email" type="email" value={email} readOnly disabled />
          <FieldDescription>{t('emailHint')}</FieldDescription>
        </Field>

        {passwordEnabled && (
          <Field>
            <FieldLabel htmlFor="invite-password">{t('passwordLabel')}</FieldLabel>
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
            {isRegister && <FieldDescription>{t('passwordHint')}</FieldDescription>}
          </Field>
        )}

        {passwordEnabled && isRegister && (
          <Field>
            <FieldLabel htmlFor="invite-confirm">{t('confirmPasswordLabel')}</FieldLabel>
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
        {(error || redirectError) && <FieldError>{error ?? redirectError}</FieldError>}

        {passwordEnabled && (
          <>
            <Field>
              <Button type="submit" disabled={pending}>
                {submitLabel}
              </Button>
            </Field>
            <FieldSeparator>{tLogin('or')}</FieldSeparator>
          </>
        )}

        <AuthLoginAlternatives
          pending={pending}
          email={email}
          onOidc={() => void signInOtherwise(() => signInWithOidc(returnTo))}
          onGoogle={() => void signInOtherwise(() => signInWithGoogle(returnTo))}
          onPasskey={() => void signInOtherwise(signInWithPasskey, tAuth('passkey'))}
        />

        {passwordEnabled && (
          <FieldDescription className="text-center">
            {isRegister ? t('haveAccount') : t('needAccount')}{' '}
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => switchMode(isRegister ? 'signin' : 'register')}
              disabled={pending}
            >
              {isRegister ? t('switchToSignIn') : t('switchToRegister')}
            </button>
          </FieldDescription>
        )}
      </FieldGroup>
    </form>
  );
}
