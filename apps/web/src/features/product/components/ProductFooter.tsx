import { getTranslations } from 'next-intl/server';

export default async function ProductFooter() {
  const t = await getTranslations('product.footer');
  return (
    <footer className="border-t px-6 py-10 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-2">
        <p>{t('license')}</p>
        <p>{t('trademarks')}</p>
      </div>
    </footer>
  );
}
