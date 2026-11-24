'use client';

import { useTranslations } from 'next-intl';
import { localeDirection } from '@/i18n/locales';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { EmailText } from '@/lib/api/endpoints/god';
import GodEmailDraftActions from './GodEmailDraftActions';
import GodEmailLocalePicker from './GodEmailLocalePicker';
import GodEmailMarkdownToolbar from './GodEmailMarkdownToolbar';
import GodEmailVariables from './GodEmailVariables';
import { useEmailVariableInsert } from '../../hooks/useEmailVariableInsert';
import { unknownVariables, writtenText } from '../../utils/emailMarkdown';
import type { EmailSelection, GodEmailTemplatesForm } from '../../hooks/useGodEmailTemplatesForm';

export default function GodEmailTextEditor({
  form,
  selection,
  onSelect,
}: {
  form: GodEmailTemplatesForm;
  selection: EmailSelection;
  onSelect: (patch: Partial<EmailSelection>) => void;
}) {
  const t = useTranslations('god.emailTemplates');
  const { key, locale } = selection;
  const template = form.template(key);
  const text = form.text(key, locale);
  const dir = localeDirection(locale);
  const written = writtenText(text);
  const unknown = unknownVariables(written, template.variables);

  function change(patch: Partial<EmailText>) {
    form.setText(key, locale, { ...text, ...patch });
  }

  const fields = useEmailVariableInsert(text, change);

  return (
    <section className="flex min-w-0 flex-col gap-5">
      <GodEmailLocalePicker form={form} selection={selection} onSelect={onSelect} />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email-subject">{t('subject')}</Label>
          <Input
            id="email-subject"
            ref={fields.subject}
            dir={dir}
            onFocus={() => fields.track('subject')}
            value={text.subject}
            onChange={(e) => change({ subject: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email-body">{t('text')}</Label>
          <div className="rounded-lg border border-input focus-within:ring-2 focus-within:ring-ring">
            <GodEmailMarkdownToolbar
              area={fields.body}
              value={text.body}
              onChange={(body) => change({ body })}
            />
            <Textarea
              ref={fields.body}
              id="email-body"
              dir={dir}
              onFocus={() => fields.track('body')}
              value={text.body}
              onChange={(e) => change({ body: e.target.value })}
              className="min-h-56 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
        {template.hasLink && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email-button">{t('button')}</Label>
            <Input
              id="email-button"
              ref={fields.button}
              dir={dir}
              onFocus={() => fields.track('button')}
              value={text.button}
              onChange={(e) => change({ button: e.target.value })}
            />
          </div>
        )}
        {unknown.length > 0 && (
          <p className="text-xs text-warning">
            {t('unknownVariables', {
              count: unknown.length,
              names: unknown.map((name) => `{${name}}`).join(', '),
            })}
          </p>
        )}
      </div>

      <GodEmailVariables
        variables={template.variables}
        written={written}
        onInsert={fields.insert}
      />

      <GodEmailDraftActions
        form={form}
        selection={selection}
        canReset={form.isEdited(key, locale)}
        onReset={() => form.resetText(key, locale)}
      />
    </section>
  );
}
