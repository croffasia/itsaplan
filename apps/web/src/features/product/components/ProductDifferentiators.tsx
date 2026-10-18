import { getTranslations } from 'next-intl/server';
import { AgentIcon, BudgetIcon, SelfHostIcon, RunnerIcon, MCPIcon } from '@/components/brand/icons';
import ProductSection from './ProductSection';

const ITEMS = [
  { key: 'teammates', Icon: AgentIcon },
  { key: 'metering', Icon: BudgetIcon },
  { key: 'selfHost', Icon: SelfHostIcon },
  { key: 'runner', Icon: RunnerIcon },
  { key: 'api', Icon: MCPIcon },
] as const;

export default async function ProductDifferentiators() {
  const t = await getTranslations('product.different');
  return (
    <ProductSection id="different" title={t('title')} className="bg-muted/40">
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map(({ key, Icon }) => (
          <li key={key} className="rounded-2xl border bg-card p-6">
            <span className="inline-flex rounded-xl bg-brand-teal/10 p-3 text-brand-teal dark:bg-brand-mint/10 dark:text-brand-mint">
              <Icon variant="filled" animated />
            </span>
            <h3 className="mt-4 text-lg font-semibold">{t(`items.${key}.title`)}</h3>
            <p className="mt-2 text-muted-foreground">{t(`items.${key}.body`)}</p>
          </li>
        ))}
      </ul>
    </ProductSection>
  );
}
