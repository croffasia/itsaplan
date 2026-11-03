'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import WorkspaceTemplateTeamsField from './WorkspaceTemplateTeamsField';

// `teamIds` is null for every team of the workspace.
export interface WorkspaceTemplateFieldsValue {
  name: string;
  description: string;
  teamIds: number[] | null;
}

export function templateFieldsComplete(value: WorkspaceTemplateFieldsValue): boolean {
  return value.name.trim() !== '' && value.teamIds?.length !== 0;
}

// The name, the description and the teams of a template of the workspace.
export default function WorkspaceTemplateFields({
  workspaceId,
  value,
  onChange,
  autoFocus,
}: {
  workspaceId: number;
  value: WorkspaceTemplateFieldsValue;
  onChange: (next: WorkspaceTemplateFieldsValue) => void;
  autoFocus?: boolean;
}) {
  const t = useTranslations('newProject');

  return (
    <>
      <div className="space-y-1.5">
        <Label>{t('name')}</Label>
        <Input
          autoFocus={autoFocus}
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('description')}</Label>
        <Textarea
          rows={2}
          className="resize-none"
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
        />
      </div>
      <WorkspaceTemplateTeamsField
        workspaceId={workspaceId}
        value={value.teamIds}
        onChange={(teamIds) => onChange({ ...value, teamIds })}
      />
    </>
  );
}
