import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Which side of a panel that counts both is shown. Tokens and cost are one click
// apart in every panel that can be read either way.
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
