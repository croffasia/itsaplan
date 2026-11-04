import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConnectGithubApp } from '@/services/gitConnections.service';
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';
import TeamGitHubAppKeyField from './TeamGitHubAppKeyField';

const EMPTY_FORM = {
  baseUrl: GIT_PROVIDER_CONFIG.github.defaultBaseUrl,
  appId: '',
  installationId: '',
  privateKey: '',
};

export default function TeamGitHubAppConnectDialog({
  teamId,
  open,
  onOpenChange,
}: {
  teamId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('settings.git');
  const connect = useConnectGithubApp(teamId);
  const [form, setForm] = useState(EMPTY_FORM);
  const { baseUrl, appId, installationId, privateKey } = form;

  useEffect(() => setForm(EMPTY_FORM), [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    connect.mutate(
      { baseUrl, appId: appId.trim(), installationId: installationId.trim(), privateKey },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>
              {t('nativeConnectProvider', { provider: t('nativeGithubApp') })}
            </DialogTitle>
            <DialogDescription>{t('nativeGithubAppHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="github-app-url">{t('nativeBaseUrl')}</Label>
            <Input
              id="github-app-url"
              type="url"
              value={baseUrl}
              onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="github-app-id">{t('nativeAppId')}</Label>
            <Input
              id="github-app-id"
              autoComplete="off"
              value={appId}
              onChange={(event) => setForm({ ...form, appId: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="github-app-installation">{t('nativeInstallationId')}</Label>
            <Input
              id="github-app-installation"
              inputMode="numeric"
              autoComplete="off"
              value={installationId}
              onChange={(event) => setForm({ ...form, installationId: event.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">{t('nativeInstallationIdHint')}</p>
          </div>
          <TeamGitHubAppKeyField
            id="github-app-key"
            value={privateKey}
            onChange={(key) => setForm((current) => ({ ...current, privateKey: key }))}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('nativeCancel')}
            </Button>
            <Button
              type="submit"
              disabled={
                connect.isPending || !appId.trim() || !installationId.trim() || !privateKey.trim()
              }
            >
              {connect.isPending ? t('nativeConnecting') : t('nativeConnect')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
