'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthConfigQuery } from '@/services/authConfig.service';
import { useLinkedAccountsQuery, hasPasswordCredential } from '../../services/accounts.service';
import { usePasskeysQuery } from '../../services/passkeys.service';
import { useConfirmSession } from '../../hooks/useConfirmSession';

export default function AccountSecurityConfirmSession({
  userId,
  email,
  onClose,
  onConfirmed,
}: {
  userId: string;
  email: string;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const t = useTranslations('account.security');
  const common = useTranslations('common');
  const id = useId();
  const [password, setPassword] = useState('');
  const config = useAuthConfigQuery();
  const accounts = useLinkedAccountsQuery();
  const keys = usePasskeysQuery();
  const confirm = useConfirmSession(userId, email, onConfirmed);
  const canPassword = config.data?.emailPassword && hasPasswordCredential(accounts.data ?? []);
  const canMagicLink = config.data?.emailPassword && config.data?.magicLink;
  const providers = (['google', 'oidc'] as const).filter(
    (provider) => config.data?.[provider] && accounts.data?.some((a) => a.providerId === provider),
  );
  const loading = config.isPending || accounts.isPending || keys.isPending;
  const loadFailed = config.isError || accounts.isError || keys.isError;

  return (
    <Modal
      title={t('confirmSessionTitle')}
      onClose={() => {
        if (!confirm.pending) onClose();
      }}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('confirmSessionDescription', { email })}</p>
        {loading && (
          <p role="status" className="text-sm">
            {t('confirmSessionLoading')}
          </p>
        )}
        {loadFailed && (
          <p role="alert" className="text-sm text-destructive">
            {t('confirmSessionLoadFailed')}
          </p>
        )}
        {canPassword && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (confirm.pending || !password) return;
              void confirm.password(password);
              setPassword('');
            }}
          >
            <input type="hidden" name="username" autoComplete="username" value={email} readOnly />
            <div className="space-y-2">
              <Label htmlFor={id}>{t('currentPassword')}</Label>
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                value={password}
                disabled={confirm.pending}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={!password || confirm.pending}>
              {t('confirmSession')}
            </Button>
          </form>
        )}
        {!loading &&
          !loadFailed &&
          !canPassword &&
          !keys.data?.length &&
          !providers.length &&
          !canMagicLink && (
            <p role="status" className="text-sm">
              {t('confirmSessionUnavailable')}
            </p>
          )}
        <div className="flex flex-col gap-2">
          {!!keys.data?.length && (
            <Button
              variant="outline"
              disabled={confirm.pending}
              onClick={() => void confirm.passkey()}
            >
              {t('confirmWithPasskey')}
            </Button>
          )}
          {providers.map((provider) => (
            <Button
              key={provider}
              variant="outline"
              disabled={confirm.pending}
              onClick={() => void confirm.provider(provider)}
            >
              {t('confirmWithProvider', {
                provider: provider === 'google' ? 'Google' : config.data?.oidcLabel || 'SSO',
              })}
            </Button>
          ))}
          {canMagicLink && (
            <Button
              variant="outline"
              disabled={confirm.pending || confirm.linkSent}
              onClick={() => void confirm.magicLink()}
            >
              {t('confirmWithLink')}
            </Button>
          )}
        </div>
        {confirm.pending && (
          <p role="status" className="text-sm">
            {t('confirmSessionPending')}
          </p>
        )}
        {confirm.linkSent && (
          <p role="status" className="text-sm">
            {t('confirmLinkSent', { email })}
          </p>
        )}
        {confirm.error && (
          <p role="alert" className="text-sm text-destructive">
            {confirm.error}
          </p>
        )}
        <Button variant="outline" disabled={confirm.pending} onClick={onClose}>
          {common('cancel')}
        </Button>
      </div>
    </Modal>
  );
}
