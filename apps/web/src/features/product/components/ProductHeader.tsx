import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import AppWordmark from '@/components/common/AppWordmark';
import { GITHUB_URL } from '../links';

const ANCHORS = ['features', 'architecture', 'compare', 'roadmap'] as const;

export default async function ProductHeader() {
  const t = await getTranslations('product.nav');
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <Link href="/product" className="text-brand-teal dark:text-white" aria-label="One Health">
          <AppWordmark className="h-9 w-auto" />
        </Link>
        <nav aria-label={t('label')} className="hidden flex-1 gap-6 text-sm md:flex">
          {ANCHORS.map((a) => (
            <a key={a} href={`#${a}`} className="text-muted-foreground hover:text-foreground">
              {t(a)}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-4 text-sm">
          <a href={GITHUB_URL} className="text-muted-foreground hover:text-foreground">
            {t('github')}
          </a>
          <Link
            href="/login"
            className="rounded-lg bg-brand-teal px-3 py-2 font-medium text-white hover:bg-brand-teal/90"
          >
            {t('signIn')}
          </Link>
        </div>
      </div>
    </header>
  );
}
