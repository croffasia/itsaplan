import { useTranslations } from 'next-intl';

export default function GodEmailEditedDot() {
  const t = useTranslations('god.emailTemplates');
  return (
    <span
      role="img"
      aria-label={t('edited')}
      title={t('edited')}
      className="inline-block size-[7px] shrink-0 rounded-full bg-foreground"
    />
  );
}
