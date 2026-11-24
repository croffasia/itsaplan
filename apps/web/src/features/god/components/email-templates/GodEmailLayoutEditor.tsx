'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import GodEmailDraftActions from './GodEmailDraftActions';
import GodEmailPlaceholders from './GodEmailPlaceholders';
import { replaceSelection, selectAfterEdit } from '../../utils/emailMarkdown';
import type { EmailSelection, GodEmailTemplatesForm } from '../../hooks/useGodEmailTemplatesForm';

export default function GodEmailLayoutEditor({
  form,
  selection,
}: {
  form: GodEmailTemplatesForm;
  selection: EmailSelection;
}) {
  const t = useTranslations('god.emailTemplates');
  const area = useRef<HTMLTextAreaElement>(null);
  const [file, setFile] = useState<'html' | 'css'>('html');
  const { layout, setLayout, missingPlaceholders, unknownPlaceholders } = form;

  function insert(name: string) {
    const element = area.current;
    if (!element) return;
    const { selectionStart, selectionEnd } = element;
    const next = replaceSelection(layout.html, selectionStart, selectionEnd, `{${name}}`);
    setLayout({ ...layout, html: next.value });
    selectAfterEdit(element, next);
  }

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="rounded-lg border border-input">
        <div className="border-b p-1">
          <Tabs value={file} onValueChange={(value) => setFile(value as 'html' | 'css')}>
            <TabsList className="h-8">
              <TabsTrigger value="html">HTML</TabsTrigger>
              <TabsTrigger value="css">CSS</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Textarea
          key={file}
          ref={area}
          dir="ltr"
          wrap="off"
          aria-label={file === 'html' ? t('layoutHtml') : t('layoutCss')}
          value={layout[file]}
          onChange={(e) => setLayout({ ...layout, [file]: e.target.value })}
          className="min-h-[440px] rounded-none border-0 bg-transparent font-mono text-xs leading-relaxed shadow-none focus-visible:ring-0"
        />
      </div>
      {missingPlaceholders.length > 0 && (
        <p className="text-xs text-warning">
          {t('requiredPlaceholders', {
            names: missingPlaceholders.map((name) => `{${name}}`).join(', '),
          })}
        </p>
      )}
      {unknownPlaceholders.length > 0 && (
        <p className="text-xs text-warning">
          {t('unknownVariables', {
            count: unknownPlaceholders.length,
            names: unknownPlaceholders.map((name) => `{${name}}`).join(', '),
          })}
        </p>
      )}
      {file === 'html' && <GodEmailPlaceholders form={form} onInsert={insert} />}
      <GodEmailDraftActions
        form={form}
        selection={selection}
        canReset={form.layoutEdited}
        onReset={form.resetLayout}
      />
    </section>
  );
}
