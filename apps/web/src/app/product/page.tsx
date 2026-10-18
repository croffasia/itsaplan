import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Product from '@/features/product/Product';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('product.meta');
  return { title: t('title'), description: t('description') };
}

export default function ProductPage() {
  return <Product />;
}
