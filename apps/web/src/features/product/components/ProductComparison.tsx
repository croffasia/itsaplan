import { getTranslations } from 'next-intl/server';
import ProductSection from './ProductSection';

const ROWS = ['oneHealth', 'linear', 'jira', 'trello', 'plane'] as const;
const COLUMNS = ['agents', 'billing', 'selfHost'] as const;

export default async function ProductComparison() {
  const t = await getTranslations('product.compare');
  return (
    <ProductSection id="compare" title={t('title')}>
      <div
        className="overflow-x-auto rounded-2xl border"
        tabIndex={0}
        role="region"
        aria-label={t('caption')}
      >
        <table className="w-full min-w-[640px] text-start text-sm">
          <caption className="p-4 text-start text-muted-foreground">{t('caption')}</caption>
          <thead className="bg-muted/60">
            <tr>
              <th scope="col" className="p-4 text-start font-semibold">
                {t('product')}
              </th>
              {COLUMNS.map((c) => (
                <th key={c} scope="col" className="p-4 text-start font-semibold">
                  {t(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr
                key={r}
                className={`border-t ${r === 'oneHealth' ? 'bg-brand-teal/5 dark:bg-brand-mint/5' : ''}`}
              >
                <th scope="row" className="p-4 text-start font-semibold">
                  {t(`rows.${r}.name`)}
                </th>
                {COLUMNS.map((c) => (
                  <td key={c} className="p-4 text-muted-foreground">
                    {t(`rows.${r}.${c}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ProductSection>
  );
}
