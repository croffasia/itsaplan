import { useTranslations } from 'next-intl';
import { useIconHover } from '@animateicons/react';
import { GlobeIcon } from '@animateicons/react/lucide/globe-icon';
import { Button } from '@/components/ui/button';

export function IntegrationWebsiteLink({
  integration,
  href,
}: {
  integration: string;
  href: string;
}) {
  const t = useTranslations('teams.integrations');
  const { ref, triggerProps } = useIconHover();
  return (
    <Button
      asChild
      variant="ghost"
      size="icon-sm"
      className="shrink-0 text-muted-foreground hover:text-foreground"
    >
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={t('website', { integration })}
        {...triggerProps}
      >
        <GlobeIcon ref={ref} size={16} />
      </a>
    </Button>
  );
}
