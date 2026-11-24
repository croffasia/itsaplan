import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Button } from '@/components/ui/button';
import { useImportGitRepositoryIssues } from '../../services/settings.service';

// Imports the repository's open issues one page per request, so no request runs long
// and the count grows while it works.
export default function GitIssueImport({
  projectKey,
  repositoryId,
  onRunningChange,
}: {
  projectKey: string;
  repositoryId: number;
  onRunningChange: (running: boolean) => void;
}) {
  const t = useTranslations('settings.git');
  const importPage = useImportGitRepositoryIssues(projectKey, repositoryId);
  const [added, setAdded] = useState<number | null>(null);

  async function run() {
    let created = 0;
    let skipped = 0;
    setAdded(0);
    onRunningChange(true);
    try {
      for (let page: number | null = 1; page !== null;) {
        const result = await importPage.mutateAsync(page);
        created += result.created;
        skipped += result.skipped;
        setAdded(created);
        page = result.nextPage;
      }
      toast.success(t('issuesImported', { created, skipped }));
    } finally {
      setAdded(null);
      onRunningChange(false);
    }
  }

  return (
    <SettingsRow
      title={t('importIssues')}
      description={
        added === null ? t('importIssuesHint') : t('importingIssues', { created: added })
      }
      control={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={added !== null}
          onClick={() => void run()}
        >
          {t('importIssuesAction')}
        </Button>
      }
    />
  );
}
