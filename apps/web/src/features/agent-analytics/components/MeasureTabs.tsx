import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type Measure = 'tokens' | 'cost';

export default function MeasureTabs({
  value,
  onChange,
}: {
  value: Measure;
  onChange: (next: Measure) => void;
}) {
  const t = useTranslations('agentAnalytics');
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as Measure)}>
      <TabsList variant="line">
        <TabsTrigger value="tokens">{t('measure.tokens')}</TabsTrigger>
        <TabsTrigger value="cost">{t('measure.cost')}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
