import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { gitlabWebhookCommand } from './gitlabCommand';

export default function GitlabCliCommand({
  payloadUrl,
  secret,
}: {
  payloadUrl: string;
  secret: string;
}) {
  const t = useTranslations('settings.git');
  const tCommon = useTranslations('common');
  const command = gitlabWebhookCommand(payloadUrl, secret);
  const preview = gitlabWebhookCommand(payloadUrl, '•'.repeat(24) + secret.slice(-4));

  async function copy() {
    await navigator.clipboard.writeText(command);
    toast.success(t('gitlabCommandCopied'));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t.rich('gitlabCliHint', {
            link: (chunks) => (
              <a
                href="https://docs.gitlab.com/cli/"
                target="_blank"
                rel="noreferrer"
                className="text-foreground/70 underline underline-offset-2 hover:text-foreground"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
        <Button variant="outline" size="sm" onClick={() => void copy()}>
          {tCommon('copy')}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs whitespace-pre">
        {preview}
      </pre>
    </div>
  );
}
