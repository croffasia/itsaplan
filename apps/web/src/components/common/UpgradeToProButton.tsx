import { ArrowUpRight, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type ProFeature, proUrl } from '@/utils/app';

export default function UpgradeToProButton({
  feature,
  className,
}: {
  feature: ProFeature;
  className?: string;
}) {
  const t = useTranslations('common');

  return (
    <Button
      size="sm"
      className={cn('bg-pro text-pro-foreground hover:bg-pro/90', className)}
      asChild
    >
      <a href={proUrl(feature)} target="_blank" rel="noreferrer">
        <Sparkles />
        {t('upgradeToPro')}
        <ArrowUpRight className="size-3.5 opacity-70" />
      </a>
    </Button>
  );
}
