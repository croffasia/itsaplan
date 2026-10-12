import { useTranslations } from 'next-intl';
import type { ModelPriceRow } from '@/lib/api/endpoints/modelPrices';
import { Badge } from '@/components/ui/badge';

export default function ModelPriceSource({ row }: { row: ModelPriceRow }) {
  const t = useTranslations('teams.workspace.modelPrices.source');
  if (row.own)
    return (
      <Badge className="border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-400">
        {t('own')}
      </Badge>
    );
  if (row.builtIn) return <Badge variant="outline">{t('builtIn')}</Badge>;
  return (
    <Badge className="border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400">
      {t('none')}
    </Badge>
  );
}
