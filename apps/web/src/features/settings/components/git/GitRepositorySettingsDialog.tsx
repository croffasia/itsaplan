import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { GitManagedRepository } from '@/lib/api/endpoints/git';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useUpdateGitRepository } from '../../services/settings.service';
import GitColumnSelect from './GitColumnSelect';
import GitIssueImport from './GitIssueImport';
import GitIssueSyncModeSelect from './GitIssueSyncModeSelect';
import GitLabelMappingList from './GitLabelMappingList';

// The issue sync of one connected repository. Every control writes immediately.
export default function GitRepositorySettingsDialog({
  project,
  repository,
  onClose,
}: {
  project: ProjectDetail;
  repository: GitManagedRepository;
  onClose: () => void;
}) {
  const t = useTranslations('settings.git');
  const projectKey = project.project.ref;
  const update = useUpdateGitRepository(projectKey);
  const change = (patch: Parameters<typeof update.mutate>[0]['patch']) =>
    update.mutate({ repositoryId: repository.id, patch });
  const syncing = repository.issueSync !== 'off';
  // The import runs page by page from this dialog, so it stays open until the import ends.
  const [importing, setImporting] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => !open && !importing && onClose()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        showCloseButton={!importing}
      >
        <DialogHeader>
          <DialogTitle>
            <span dir="ltr">{repository.fullName}</span>
          </DialogTitle>
          <DialogDescription>{t('issueSyncHint')}</DialogDescription>
        </DialogHeader>
        <SettingsCard className="divide-y divide-border/60">
          <SettingsRow
            title={t('issueSync')}
            description={t(`issueSyncModeHints.${repository.issueSync}`)}
            control={
              <GitIssueSyncModeSelect
                value={repository.issueSync}
                onChange={(issueSync) => change({ issueSync })}
              />
            }
          />
          {syncing && (
            <>
              <SettingsRow
                title={t('issueColumn')}
                description={t('issueColumnHint')}
                control={
                  <GitColumnSelect
                    columns={project.columns}
                    value={repository.issueColumnId}
                    noneLabel={t('issueColumnNone')}
                    onChange={(issueColumnId) => change({ issueColumnId })}
                  />
                }
              />
              <SettingsRow
                title={t('issueComments')}
                description={t('issueCommentsHint')}
                control={
                  <Switch
                    checked={repository.issueComments}
                    onCheckedChange={(issueComments) => change({ issueComments })}
                  />
                }
              />
              <GitIssueImport
                projectKey={projectKey}
                repositoryId={repository.id}
                onRunningChange={setImporting}
              />
            </>
          )}
        </SettingsCard>
        {syncing && (
          <GitLabelMappingList
            projectKey={projectKey}
            repositoryId={repository.id}
            labels={project.labels}
            issueTypes={project.issueTypes}
            onChange={(labelMappings) => change({ labelMappings })}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
