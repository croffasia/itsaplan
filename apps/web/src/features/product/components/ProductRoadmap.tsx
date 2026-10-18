import { getTranslations } from 'next-intl/server';
import { CheckIcon, ClockIcon } from '@/components/brand/icons';
import ProductSection from './ProductSection';

const ITEMS = [
  { key: 'budget', shipped: true },
  { key: 'actionLog', shipped: false },
  { key: 'approvals', shipped: false },
  { key: 'import', shipped: false },
  { key: 'saml', shipped: false },
  { key: 'quickAi', shipped: false },
] as const;

export default async function ProductRoadmap() {
  const t = await getTranslations('product.roadmap');
  return (
    <ProductSection id="roadmap" title={t('title')}>
      <ol className="relative grid gap-4 border-s-2 border-brand-mint/50 ps-6">
        {ITEMS.map(({ key, shipped }) => (
          <li key={key} className="flex flex-wrap items-center gap-3">
            {shipped ? (
              <CheckIcon variant="filled" className="text-brand-teal dark:text-brand-mint" />
            ) : (
              <ClockIcon animated className="text-muted-foreground" />
            )}
            <span className="font-medium">{t(`items.${key}`)}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                shipped ? 'bg-brand-teal text-white' : 'border text-muted-foreground'
              }`}
            >
              {shipped ? t('shipped') : t('inProgress')}
            </span>
          </li>
        ))}
      </ol>
    </ProductSection>
  );
}
