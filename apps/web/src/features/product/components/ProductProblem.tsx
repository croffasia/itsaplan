import { getTranslations } from 'next-intl/server';
import { BudgetIcon, LockIcon, ClockIcon } from '@/components/brand/icons';
import ProductSection from './ProductSection';

const POINTS = [
  { key: 'metered', Icon: BudgetIcon },
  { key: 'tier', Icon: ClockIcon },
  { key: 'data', Icon: LockIcon },
] as const;

export default async function ProductProblem() {
  const t = await getTranslations('product.problem');
  return (
    <ProductSection id="problem" title={t('title')} intro={t('body')}>
      <ul className="grid gap-4 sm:grid-cols-3">
        {POINTS.map(({ key, Icon }) => (
          <li key={key} className="flex gap-3 rounded-xl border bg-card p-5">
            <Icon className="mt-0.5 shrink-0 text-muted-foreground" />
            <span>{t(`points.${key}`)}</span>
          </li>
        ))}
      </ul>
    </ProductSection>
  );
}
