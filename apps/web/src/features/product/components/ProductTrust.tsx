import { getTranslations } from 'next-intl/server';
import {
  DatabaseIcon,
  KeyIcon,
  LockIcon,
  ShieldIcon,
  ServerIcon,
  DocsIcon,
} from '@/components/brand/icons';
import ProductSection from './ProductSection';

const ITEMS = [
  { key: 'data', Icon: DatabaseIcon },
  { key: 'secrets', Icon: LockIcon },
  { key: 'keys', Icon: KeyIcon },
  { key: 'ssrf', Icon: ShieldIcon },
  { key: 'backup', Icon: ServerIcon },
  { key: 'source', Icon: DocsIcon },
] as const;

export default async function ProductTrust() {
  const t = await getTranslations('product.trust');
  return (
    <ProductSection id="trust" title={t('title')} className="bg-muted/40">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map(({ key, Icon }) => (
          <li key={key} className="flex gap-3 rounded-xl border bg-card p-5">
            <Icon
              variant="filled"
              className="mt-0.5 shrink-0 text-brand-teal dark:text-brand-mint"
            />
            <span>{t(`items.${key}`)}</span>
          </li>
        ))}
      </ul>
    </ProductSection>
  );
}
