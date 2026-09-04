import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { githubWebhookCommand } from './githubCommand';

// A copyable `gh` command that registers the repository webhook in one step. The
// payload URL and secret are already inlined; only <owner>/<repo> is left to
// replace. The secret stays masked on screen (like the manual tab's field); only
// the copied text carries the real value.
export default function GithubCliCommand({
  payloadUrl,
  secret,
}: {
  payloadUrl: string;
  secret: string;
}) {
  const t = useTranslations('settings.git');
  const tCommon = useTranslations('common');
  const command = githubWebhookCommand(payloadUrl, secret);
  const preview = githubWebhookCommand(payloadUrl, '•'.repeat(24) + secret.slice(-4));

  async function copy() {
    await navigator.clipboard.writeText(command);
    toast.success(t('commandCopied'));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t.rich('cliHint', {
            placeholder: '<owner>/<repo>',
            link: (chunks) => (
              <a
                href="https://cli.github.com/"
                target="_blank"
                rel="noreferrer"
                className="text-foreground/70 underline underline-offset-2 hover:text-foreground"
              >
                {chunks}
              </a>
            ),
            code: (chunks) => <code className="rounded bg-muted px-1 py-0.5">{chunks}</code>,
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
