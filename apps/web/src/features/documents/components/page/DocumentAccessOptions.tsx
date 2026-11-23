'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DocumentVisibility } from '@/lib/api/endpoints/documents';
import { useShell } from '@/context/shellContext';
import { Button } from '@/components/ui/button';
import DocumentAccessOption from './DocumentAccessOption';
import DocumentAccessPeople from './DocumentAccessPeople';

// Who can open the page, for its owner: the whole project, chosen people, or the owner alone.
export default function DocumentAccessOptions({
  projectKey,
  memberIds,
  mode,
  pending,
  disabled,
  pickerOpen,
  onPickerOpenChange,
  onPick,
  onConfirm,
  onCancel,
  onMembersChange,
}: {
  projectKey: string;
  memberIds: string[];
  mode: DocumentVisibility;
  pending: DocumentVisibility | null;
  disabled: boolean;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onPick: (visibility: DocumentVisibility) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onMembersChange: (memberIds: string[]) => void;
}) {
  const t = useTranslations('documents');
  const tCommon = useTranslations('common');
  const { project } = useShell();
  const option = (visibility: DocumentVisibility, label: string) => (
    <DocumentAccessOption
      visibility={visibility}
      label={label}
      checked={mode === visibility}
      disabled={disabled}
      onSelect={onPick}
    />
  );

  return (
    <>
      <div role="radiogroup" aria-label={t('access.whoCanOpen')} className="flex flex-col">
        {option('public', t('access.everyoneIn', { project: project?.project.name ?? '' }))}
        {option('restricted', t('access.specificPeople'))}
        {mode === 'restricted' && pending === null && (
          <DocumentAccessPeople
            projectKey={projectKey}
            memberIds={memberIds}
            disabled={disabled}
            open={pickerOpen}
            onOpenChange={onPickerOpenChange}
            onChange={onMembersChange}
          />
        )}
        {option('private', t('access.onlyYou'))}
      </div>
      {pending && (
        <div className="mt-2 flex flex-col gap-2 rounded-md bg-warning/12 px-3 py-2.5 text-[13px]">
          <p className="flex gap-2">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
            {t('access.turnsOffLink')}
          </p>
          <div className="flex flex-wrap justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-[13px] text-muted-foreground"
              onClick={onCancel}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              className="h-7 px-2.5 text-[13px]"
              onClick={onConfirm}
            >
              {t('access.turnOffLink')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
