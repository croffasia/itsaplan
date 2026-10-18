import { getTranslations } from 'next-intl/server';
import AppLogo from '@/components/common/AppLogo';
import { ArrowIcon, DocsIcon } from '@/components/brand/icons';
import { GITHUB_URL, SELF_HOST_URL } from '../links';

export default async function ProductCta() {
  const t = await getTranslations('product.cta');
  return (
    <section aria-labelledby="cta-title" className="px-6 py-20">
      <div className="dark mx-auto flex max-w-6xl flex-col items-center rounded-3xl bg-brand-ink px-6 py-16 text-center text-white">
        <AppLogo className="w-16 text-white" />
        <h2 id="cta-title" className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('title')}
        </h2>
        <p className="mt-4 text-lg text-white/80">{t('body')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <a
            href={SELF_HOST_URL}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-mint px-5 py-3 font-semibold text-brand-ink hover:bg-brand-mint/90"
          >
            <DocsIcon size={20} />
            {t('docs')}
          </a>
          <a
            href={GITHUB_URL}
            className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-5 py-3 font-semibold hover:bg-white/10"
          >
            {t('github')}
            <ArrowIcon size={20} className="rtl:-scale-x-100" />
          </a>
        </div>
      </div>
    </section>
  );
}
