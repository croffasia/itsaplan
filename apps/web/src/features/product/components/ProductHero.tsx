import { getTranslations } from 'next-intl/server';
import HeroBackdrop from '@/components/brand/hero/HeroBackdrop';
import OrbitRings from '@/components/brand/hero/OrbitRings';
import PulseLine from '@/components/brand/hero/PulseLine';
import StatCard from '@/components/brand/hero/StatCard';
import MiniBars from '@/components/brand/hero/MiniBars';
import RadialProgress from '@/components/brand/hero/RadialProgress';
import Sparkline from '@/components/brand/hero/Sparkline';
import { ArrowIcon, SelfHostIcon } from '@/components/brand/icons';
import { GITHUB_URL, SELF_HOST_URL } from '../links';

export default async function ProductHero() {
  const t = await getTranslations('product.hero');
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden text-white">
      <HeroBackdrop />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 sm:py-28 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-sm font-medium tracking-wide text-brand-mint">{t('eyebrow')}</p>
          <h1
            id="hero-title"
            className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            {t('title')}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/85">{t('subtitle')}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href={SELF_HOST_URL}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-mint px-5 py-3 font-semibold text-brand-ink hover:bg-brand-mint/90"
            >
              <SelfHostIcon size={20} />
              {t('primary')}
            </a>
            <a
              href={GITHUB_URL}
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-5 py-3 font-semibold hover:bg-white/10"
            >
              {t('secondary')}
              <ArrowIcon size={20} className="rtl:-scale-x-100" />
            </a>
          </div>
          <PulseLine className="mt-12 w-full max-w-md text-white" />
        </div>
        <div className="relative mx-auto w-full max-w-sm">
          <OrbitRings className="text-white" />
          <div className="mt-6 grid grid-cols-3 gap-3">
            <StatCard label={t('statRuns')} value="128" chart={<MiniBars />} />
            <StatCard label={t('statBudget')} value="42%" chart={<RadialProgress percent={42} />} />
            <StatCard label={t('statDone')} value="57" chart={<Sparkline />} />
          </div>
        </div>
      </div>
    </section>
  );
}
