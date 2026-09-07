import { forwardRef } from 'react';
import { useTranslations } from 'next-intl';
import DocumentIconPicker from './DocumentIconPicker';

const DocumentPageTitle = forwardRef<
  HTMLTextAreaElement,
  {
    title: string;
    icon: string | null;
    editable: boolean;
    onChange: (title: string) => void;
    onSave: () => void;
    onIconChange: (icon: string | null) => void;
  }
>(function DocumentPageTitle({ title, icon, editable, onChange, onSave, onIconChange }, ref) {
  const t = useTranslations('documents');

  return (
    <div className="-ms-2 flex items-start gap-1.5">
      <DocumentIconPicker icon={icon} editable={editable} onChange={onIconChange} />
      <textarea
        ref={ref}
        value={title}
        readOnly={!editable}
        rows={1}
        maxLength={255}
        placeholder={t('titlePlaceholder')}
        aria-label={t('pageTitle')}
        dir="auto"
        className="[field-sizing:content] min-h-11 min-w-0 flex-1 resize-none overflow-hidden bg-transparent pt-0.5 text-[2rem] leading-[1.12] font-semibold tracking-[-0.035em] text-balance outline-none placeholder:text-muted-foreground/35 md:text-[2.5rem]"
        onChange={(event) => onChange(event.target.value.replace(/[\r\n]+/g, ''))}
        onBlur={onSave}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.preventDefault();
        }}
      />
    </div>
  );
});

export default DocumentPageTitle;
