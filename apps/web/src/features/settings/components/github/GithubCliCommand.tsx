import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

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
  const command = (secretText: string) =>
    [
      'gh api repos/<owner>/<repo>/hooks',
      "-f name=web -F active=true -f 'events[]=pull_request'",
      `-f 'config[url]=${payloadUrl}' -f 'config[content_type]=json' -f 'config[secret]=${secretText}'`,
    ].join(' \\\n  ');

  async function copy() {
    await navigator.clipboard.writeText(command(secret));
    toast.success('Command copied. Replace <owner>/<repo>, then run it.');
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Requires the{' '}
          <a
            href="https://cli.github.com/"
            target="_blank"
            rel="noreferrer"
            className="text-foreground/70 underline underline-offset-2 hover:text-foreground"
          >
            GitHub CLI
          </a>
          . Copy this command, replace{' '}
          <code className="rounded bg-muted px-1 py-0.5">{'<owner>/<repo>'}</code> with your
          repository, and run it in a terminal.
        </p>
        <Button variant="outline" size="sm" onClick={() => void copy()}>
          Copy
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs whitespace-pre">
        {command('•'.repeat(24) + secret.slice(-4))}
      </pre>
    </div>
  );
}
