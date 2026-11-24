import { useTranslations } from 'next-intl';
import type { Label } from '@/lib/api/endpoints/labels';
import type { IssueType } from '@/lib/api/endpoints/issueTypes';
import type { RepositoryLabel, RepositoryLabelMapping } from '@/lib/api/endpoints/git';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import GitMappingTargetSelect from './GitMappingTargetSelect';

export type GitLabelMappingKind = 'label' | 'type';

export type GitLabelMappingTarget = Pick<RepositoryLabelMapping, 'labelId' | 'typeId'>;

export default function GitLabelMappingRow({
  label,
  mapping,
  kind,
  labels,
  issueTypes,
  onKindChange,
  onMap,
  onCreate,
}: {
  label: RepositoryLabel;
  mapping: RepositoryLabelMapping | undefined;
  kind: GitLabelMappingKind;
  labels: Label[];
  issueTypes: IssueType[];
  onKindChange: (kind: GitLabelMappingKind) => void;
  onMap: (target: GitLabelMappingTarget) => void;
  onCreate: () => void;
}) {
  const t = useTranslations('settings.git');
  const name = label.name;
  const target =
    kind === 'label'
      ? {
          options: labels,
          value: mapping?.labelId ?? null,
          placeholder: t('changeLabel'),
          empty: t('noLabel'),
          create: t('createLabelFrom', { name }),
        }
      : {
          options: issueTypes,
          value: mapping?.typeId ?? null,
          placeholder: t('changeType'),
          empty: t('noType'),
          create: t('createTypeFrom', { name }),
        };

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <span dir="auto" className="w-40 shrink-0 truncate font-mono text-xs">
        {name}
      </span>
      <Select value={kind} onValueChange={(next) => onKindChange(next as GitLabelMappingKind)}>
        <SelectTrigger size="sm" className="w-24" aria-label={t('mapAs', { name })}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="label">{t('mapAsLabel')}</SelectItem>
          <SelectItem value="type">{t('mapAsType')}</SelectItem>
        </SelectContent>
      </Select>
      <span className="flex-1" />
      <GitMappingTargetSelect
        options={target.options}
        value={target.value}
        externalName={name}
        text={{
          none: t('notMapped'),
          placeholder: target.placeholder,
          empty: target.empty,
          create: target.create,
        }}
        onChange={(id) =>
          onMap(kind === 'label' ? { labelId: id, typeId: null } : { labelId: null, typeId: id })
        }
        onCreate={onCreate}
      />
    </div>
  );
}
