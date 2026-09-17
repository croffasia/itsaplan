import { useFormatter, useTranslations } from 'next-intl';
import { colorDot } from '@/components/common/fields/colorDot';
import { byKey } from '@/utils/messageKey';
import type { ResolvedLinkPreview } from './resolveLinkPreview';

export default function EditorLinkPreviewDetails({ preview }: { preview: ResolvedLinkPreview }) {
  const t = useTranslations('common.editor');
  const filters = useTranslations('filters');
  const display = useTranslations('display');
  const format = useFormatter();
  const updated = preview.updatedAt ? new Date(preview.updatedAt) : null;
  return (
    <div className="space-y-1.5 text-xs text-muted-foreground">
      {preview.status && (
        <div className="flex items-center gap-1.5">
          {colorDot(preview.status.color)}
          <span dir="auto">{preview.status.name}</span>
        </div>
      )}
      {preview.noteCount !== undefined && (
        <p>{t('previewNoteCount', { count: preview.noteCount })}</p>
      )}
      {preview.layout && <p>{byKey(display)(`layouts.${preview.layout}`)}</p>}
      {preview.filters?.map((filter, index) => (
        <p key={index} className="line-clamp-2" dir="auto">
          {filter.label ||
            (filter.field === 'custom'
              ? t('previewCustomField')
              : byKey(filters)(`fields.${filter.field}`))}{' '}
          {byKey(filters)(`operators.${filter.op}`)} {filter.values.join(', ')}
          {filter.remainingValues > 0 && (
            <>
              {' '}
              {filter.values.length > 0
                ? t('previewOtherValues', { count: filter.remainingValues })
                : filters('selected', { count: filter.remainingValues })}
            </>
          )}
        </p>
      ))}
      {preview.filters?.length === 0 && <p>{t('previewAllWorkItems')}</p>}
      {updated && Number.isFinite(updated.getTime()) && (
        <p>{t('previewUpdated', { date: format.dateTime(updated, { dateStyle: 'medium' }) })}</p>
      )}
    </div>
  );
}
