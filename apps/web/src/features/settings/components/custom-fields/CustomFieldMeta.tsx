import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CustomField } from '@/lib/api';
import { FIELD_TYPE_ICONS, useFieldTypeLabel } from '../../utils/fieldTypes';

// What a field is, at the end of its row: its type, then what that type lets the field
// hold — the options of a select, or the people a member field is narrowed to.
export default function CustomFieldMeta({ field }: { field: CustomField }) {
  const t = useTranslations('settings.customFields');
  const fieldTypeLabel = useFieldTypeLabel();
  const Icon = FIELD_TYPE_ICONS[field.fieldType];

  let holds: string | null = null;
  if (field.options.length > 0) {
    holds = field.options.map((o) => o.value).join(', ');
  } else if (field.memberScope != null && field.memberScope !== 'all') {
    holds = t(`memberScopes.${field.memberScope}`);
  }

  return (
    <span className="flex items-center gap-2">
      <span className="flex items-center gap-1.5">
        <Icon className="size-3.5 shrink-0" />
        {fieldTypeLabel(field.fieldType)}
      </span>
      {holds != null && (
        <span className="hidden items-center gap-2 sm:flex">
          <ChevronRight className="size-3.5 shrink-0 rtl:rotate-180" />
          <span className="max-w-56 truncate text-muted-foreground/80">{holds}</span>
        </span>
      )}
      {field.showInBody && (
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-foreground">
          {t('mainInfoMeta')}
        </span>
      )}
    </span>
  );
}
