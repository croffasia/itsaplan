import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { Label } from '@/lib/api/endpoints/labels';
import type { IssueType } from '@/lib/api/endpoints/issueTypes';
import type { RepositoryLabel, RepositoryLabelMapping } from '@/lib/api/endpoints/git';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import {
  useCreateIssueType,
  useCreateLabel,
  useGitRepositoryMappingQuery,
} from '../../services/settings.service';
import GitLabelMappingRow, {
  type GitLabelMappingKind,
  type GitLabelMappingTarget,
} from './GitLabelMappingRow';

// What each label of the repository becomes: a project label or an issue type. A change
// sends the whole mapping, the way the route stores it. A label or type created here is
// created in the project; nothing here deletes one.
export default function GitLabelMappingList({
  projectKey,
  repositoryId,
  labels,
  issueTypes,
  onChange,
}: {
  projectKey: string;
  repositoryId: number;
  labels: Label[];
  issueTypes: IssueType[];
  onChange: (mappings: RepositoryLabelMapping[]) => void;
}) {
  const t = useTranslations('settings.git');
  const mappingQuery = useGitRepositoryMappingQuery(projectKey, repositoryId);
  const createLabel = useCreateLabel(projectKey);
  const createType = useCreateIssueType(projectKey);
  // A row switched to "type" before a type is picked has no mapping to read it from.
  const [kinds, setKinds] = useState<Record<string, GitLabelMappingKind>>({});
  const mappings = mappingQuery.data?.labelMappings ?? [];

  const mappingOf = (name: string) => mappings.find((mapping) => mapping.externalName === name);
  const kindOf = (name: string): GitLabelMappingKind =>
    kinds[name] ?? (mappingOf(name)?.typeId != null ? 'type' : 'label');

  function map(name: string, target: GitLabelMappingTarget) {
    const rest = mappings.filter((mapping) => mapping.externalName !== name);
    const unmapped = target.labelId == null && target.typeId == null;
    onChange(unmapped ? rest : [...rest, { externalName: name, ...target }]);
  }

  function switchKind(name: string, kind: GitLabelMappingKind) {
    setKinds((current) => ({ ...current, [name]: kind }));
    if (mappingOf(name)) map(name, { labelId: null, typeId: null });
  }

  async function create(label: RepositoryLabel) {
    const input = { name: label.name, ...(label.color ? { color: label.color } : {}) };
    if (kindOf(label.name) === 'label') {
      const created = await createLabel.mutateAsync(input);
      map(label.name, { labelId: created.id, typeId: null });
    } else {
      const created = await createType.mutateAsync(input);
      map(label.name, { labelId: null, typeId: created.id });
    }
  }

  let content: ReactNode;
  if (mappingQuery.isPending) content = <ListSkeleton rows={3} rowClassName="h-10" />;
  else if (mappingQuery.isError)
    content = <p className="text-xs text-destructive">{mappingQuery.error.message}</p>;
  else if (mappingQuery.data.labels.length === 0)
    content = <p className="text-xs text-muted-foreground">{t('noRepositoryLabels')}</p>;
  else
    content = (
      <SettingsCard className="divide-y divide-border/60">
        {mappingQuery.data.labels.map((label) => (
          <GitLabelMappingRow
            key={label.name}
            label={label}
            mapping={mappingOf(label.name)}
            kind={kindOf(label.name)}
            labels={labels}
            issueTypes={issueTypes}
            onKindChange={(kind) => switchKind(label.name, kind)}
            onMap={(target) => map(label.name, target)}
            onCreate={() => void create(label)}
          />
        ))}
      </SettingsCard>
    );

  return (
    <SettingsSection title={t('labelMapping')} description={t('labelMappingHint')}>
      {content}
    </SettingsSection>
  );
}
