import type { ReactNode, Ref } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import DocumentIconPicker from './DocumentIconPicker';

const TITLE =
  'min-w-0 flex-1 text-[clamp(30px,4cqi,40px)] leading-[1.12] font-semibold tracking-[-0.035em] text-balance';

// `canEdit` picks the editing controls; `editable` is false while the editing session is
// not ready yet.
export default function DocumentPageTitle({
  ref,
  title,
  icon,
  canEdit,
  editable,
  onChange,
  onSave,
  onSubmit,
  onIconChange,
  children,
}: {
  ref: Ref<HTMLTextAreaElement>;
  title: string;
  icon: string | null;
  canEdit: boolean;
  editable: boolean;
  onChange: (title: string) => void;
  onSave: () => void;
  onSubmit: () => void;
  onIconChange: (icon: string | null) => void;
  children: ReactNode;
}) {
  const t = useTranslations('documents');

  return (
    <header className="group/title relative mb-8 flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <DocumentIconPicker icon={icon} editable={canEdit} onChange={onIconChange} />
        {canEdit ? (
          <textarea
            ref={ref}
            value={title}
            readOnly={!editable}
            rows={1}
            maxLength={255}
            placeholder={t('titlePlaceholder')}
            aria-label={t('pageTitle')}
            dir="auto"
            spellCheck={false}
            className={cn(
              TITLE,
              '[field-sizing:content] resize-none overflow-hidden bg-transparent outline-none placeholder:text-muted-foreground/60',
            )}
            onChange={(event) => onChange(event.target.value.replace(/[\r\n]+/g, ''))}
            onBlur={onSave}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
              event.preventDefault();
              onSubmit();
            }}
          />
        ) : (
          <h1 className={TITLE} dir="auto">
            {title.trim() || t('untitled')}
          </h1>
        )}
      </div>
      {children}
    </header>
  );
}
