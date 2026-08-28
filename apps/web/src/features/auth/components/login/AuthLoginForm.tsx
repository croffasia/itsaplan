'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldSeparator,
} from '@/components/ui/field';
import AuthFormHeader from '../AuthFormHeader';
import AuthLoginAlternatives from './AuthLoginAlternatives';
import AuthLoginPasswordFields from './AuthLoginPasswordFields';
import AuthMessagePanel from '../AuthMessagePanel';
import AuthUnconfirmedNotice from './AuthUnconfirmedNotice';
import {
  EmailNotConfirmedError,
  isEmailAddress,
  resendVerificationEmail,
  sendMagicLink,
  signInWithPassword,
  signInWithGoogle,
  signInWithOidc,
  signInWithPasskey,
} from '../../services/auth.service';
import { useAuthAction } from '../../hooks/useAuthAction';
import { useAuthConfig } from '@/services/authConfig.service';
import { useRedirectError } from '../../hooks/useRedirectError';

// How the visitor is signing in. The screen holds one method at a time: with a
// password, or with a link mailed to the address. Passkeys stay available in both,
// since they need neither field.
type Method = 'password' | 'link';

export default function AuthLoginForm() {
  const t = useTranslations('auth');
  const [method, setMethod] = useState<Method>('password');
  // With a password this is either an address or a username; a sign-in link can only
  // go to an address.
  const [identifier, setIdentifier] = useState('');
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
  // An instance that runs entirely off its identity provider offers no form at all,
  // only the buttons below it.
  const passwordEnabled = authConfig?.emailPassword !== false;
  const params = useSearchParams();
  const justReset = params.get('reset') === '1';
  // `apiFailure` in lib/api.ts sends the browser here with ?expired=1 after the API
  // refused the session, so the screen can say why the user is back on it.
  const sessionExpired = params.get('expired') === '1';
  // A Google sign-in or a confirmation link that could not complete comes back here
  // as a redirect rather than as a rejected promise, so its reason arrives in the
  // query string.
  const redirectErrorMessage = useRedirectError();
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
          await sendMagicLink(identifier);
          setLinkSentTo(identifier);
        },
        { redirect: false },
      );
      return;
    }
    run(async () => {
      try {
        await signInWithPassword({ identifier, password });
      } catch (err) {
        if (err instanceof EmailNotConfirmedError) setUnconfirmed(true);
        throw err;
      }
    });
  }

  if (linkSentTo) {
    return (
      <AuthMessagePanel
        title={t('login.linkSentTitle')}
        description={t('login.linkSentDescription', { email: linkSentTo })}
        footer={
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => {
              setLinkSentTo(null);
              switchTo('password');
            }}
          >
            {t('login.backToSignIn')}
          </button>
        }
      />
    );
  }

  const signingInWithLink = method === 'link';

  function subtitle() {
    if (sessionExpired) return t('login.subtitleExpired');
    if (justVerified) return t('login.subtitleVerified');
    if (justReset) return t('login.subtitleReset');
    if (!passwordEnabled) return t('login.subtitleSso');
    if (signingInWithLink) return t('login.subtitleLink');
    return t('login.subtitlePassword');
  }

  function submitLabel() {
    if (signingInWithLink) return pending ? t('login.sendLinkPending') : t('login.sendLink');
    return pending ? t('login.submitPending') : t('login.submit');
  }

  return (
    <form onSubmit={onSubmit} className="p-6 md:p-8">
      <FieldGroup>
        <AuthFormHeader title={t('login.title')} description={subtitle()} />

        {passwordEnabled && (
          <AuthLoginPasswordFields
            signingInWithLink={signingInWithLink}
            identifier={identifier}
            password={password}
            pending={pending}
            onIdentifierChange={setIdentifier}
            onPasswordChange={setPassword}
          />
        )}

        {(error || redirectError) && <FieldError>{error ?? redirectError}</FieldError>}

        {unconfirmed && (
          <AuthUnconfirmedNotice
            resent={resent}
            pending={pending}
            canResend={isEmailAddress(identifier)}
            onResend={() =>
              run(
                async () => {
                  await resendVerificationEmail(identifier);
                  setResent(true);
                },
                { redirect: false },
              )
            }
          />
        )}

        {passwordEnabled && (
          <>
            <Field>
              <Button type="submit" disabled={pending}>
                {submitLabel()}
              </Button>
            </Field>

            <FieldSeparator>{t('login.or')}</FieldSeparator>
          </>
        )}

        <AuthLoginAlternatives
          signingInWithLink={signingInWithLink}
          pending={pending}
          onToggleMethod={() => switchTo(signingInWithLink ? 'password' : 'link')}
          onOidc={() => run(signInWithOidc, { redirect: false })}
          onGoogle={() => run(signInWithGoogle, { redirect: false })}
          onPasskey={() => run(signInWithPasskey, { fallback: t('errors.passkey') })}
        />

        {/* Only when anyone can register with a password. An invite-only instance
            hands out links directly, a closed one has nowhere to send the visitor,
            and with single sign-on the identity provider makes the account. */}
        {authConfig?.registration === 'open' && passwordEnabled && (
          <FieldDescription className="text-center">
            {t('login.noAccount')}{' '}
            <Link href="/register" className="underline underline-offset-4">
              {t('login.signUp')}
            </Link>
          </FieldDescription>
        )}
      </FieldGroup>
    </form>
  );
}
