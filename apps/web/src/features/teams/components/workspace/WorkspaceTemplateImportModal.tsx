'use client';

import { useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { SharedProjectTemplate } from '@/lib/api/endpoints/project-templates';
import {
  useImportedTemplatePreviewQuery,
  useImportProjectTemplate,
} from '@/services/projectTemplates.service';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import WorkspaceTemplateDialog from '../WorkspaceTemplateDialog';
import WorkspaceTemplateFields, {
  templateFieldsComplete,
  type WorkspaceTemplateFieldsValue,
} from '../WorkspaceTemplateFields';
import WorkspaceTemplatePreview from '../WorkspaceTemplatePreview';

// The pasted text as a template, or null when it is not a JSON object. The server checks
// the rest.
function parseShared(text: string): SharedProjectTemplate | null {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as SharedProjectTemplate)
      : null;
  } catch {
    return null;
  }
}

// Imports a template copied or downloaded from another workspace, pasted or uploaded as a
// file. It takes the name and the description the template came with until they are
// edited.
export default function WorkspaceTemplateImportModal({
  workspaceId,
  onClose,
}: {
  workspaceId: number;
  onClose: () => void;
}) {
  const t = useTranslations('projects.saveTemplate');
  const [text, setText] = useState('');
  const template = useMemo(() => parseShared(text), [text]);
  const [fields, setFields] = useState<WorkspaceTemplateFieldsValue>({
    name: '',
    description: '',
    teamIds: null,
  });
  const [fieldsEdited, setFieldsEdited] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = useImportedTemplatePreviewQuery(workspaceId, template);
  const importTemplate = useImportProjectTemplate(workspaceId);

  function paste(next: string) {
    setText(next);
    const parsed = parseShared(next);
    if (parsed && !fieldsEdited) {
      setFields({
        ...fields,
        name: String(parsed.name ?? ''),
        description: String(parsed.description ?? ''),
      });
    }
  }

  function submit() {
    if (!template) return;
    importTemplate.mutate(
      {
        template,
        name: fields.name.trim(),
        description: fields.description.trim(),
        teamIds: fields.teamIds ?? undefined,
      },
      {
        onSuccess: (created) => {
          toast.success(t('saved', { name: created.name }));
          onClose();
        },
      },
    );
  }

  let previewPane;
  if (text.trim() === '') {
    previewPane = <p className="text-sm text-muted-foreground">{t('importEmpty')}</p>;
  } else if (!template || preview.isError) {
    previewPane = <p className="text-sm text-destructive">{t('importInvalid')}</p>;
  } else {
    previewPane = (
      <WorkspaceTemplatePreview
        name={fields.name.trim()}
        description={fields.description.trim()}
        contents={preview.data}
      />
    );
  }

  return (
    <WorkspaceTemplateDialog
      title={t('importTitle')}
      onClose={onClose}
      canSave={
        !importTemplate.isPending && preview.data !== undefined && templateFieldsComplete(fields)
      }
      onSave={submit}
      form={
        <>
          <p className="text-sm text-muted-foreground">{t('importHint')}</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="template-import">{t('importLabel')}</Label>
              <Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
                <Upload />
                {t('importFile')}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) paste(await file.text());
                }}
              />
            </div>
            <Textarea
              id="template-import"
              autoFocus
              rows={6}
              className="max-h-48 resize-none font-mono text-xs"
              placeholder={t('importPlaceholder')}
              value={text}
              onChange={(e) => paste(e.target.value)}
            />
          </div>
          <WorkspaceTemplateFields
            workspaceId={workspaceId}
            value={fields}
            onChange={(next) => {
              if (next.name !== fields.name || next.description !== fields.description) {
                setFieldsEdited(true);
              }
              setFields(next);
            }}
          />
        </>
      }
      preview={previewPane}
    />
  );
}
