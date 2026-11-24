import { Link2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { copyText } from '@/utils/clipboard';
import { Button } from '@/components/ui/button';

// Copies the address of a run.
export default function RunnerQueueCopyLink({
  path,
  className,
}: {
  path: string;
  className?: string;
}) {
  const t = useTranslations('issue.agentRuns');

  async function copyLink() {
    if (await copyText(new URL(path, window.location.origin).href)) toast.success(t('linkCopied'));
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      title={t('copyLink')}
      onClick={() => void copyLink()}
    >
      <Link2 />
    </Button>
  );
}
