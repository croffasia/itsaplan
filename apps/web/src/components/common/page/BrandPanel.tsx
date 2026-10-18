import { useFormatter, useTranslations } from 'next-intl';
import AppWordmark from '@/components/common/AppWordmark';
import HeroBackdrop from '@/components/brand/hero/HeroBackdrop';
import OrbitRings from '@/components/brand/hero/OrbitRings';
import PulseLine from '@/components/brand/hero/PulseLine';
import MiniBars from '@/components/brand/hero/MiniBars';
import RadialProgress from '@/components/brand/hero/RadialProgress';
import Sparkline from '@/components/brand/hero/Sparkline';
import StatCard from '@/components/brand/hero/StatCard';

export default function BrandPanel({ subtitle }: { subtitle?: string }) {
  const t = useTranslations('common');
  const format = useFormatter();
  return (
    <div className="relative hidden flex-col justify-between gap-6 overflow-hidden p-8 text-white [--logo-arrow:var(--brand-mint)] md:flex">
      <HeroBackdrop />
      <AppWordmark className="relative w-36" accentClassName="text-brand-mint" />
      <div className="relative flex flex-col items-center gap-4">
        <OrbitRings className="w-full max-w-sm text-white" />
        <PulseLine className="w-full max-w-sm text-white" />
        <p className="max-w-xs text-center text-sm text-white/75">
          {subtitle ?? t('brandSubtitle')}
        </p>
      </div>
      <div className="relative grid grid-cols-3 gap-3">
        <StatCard
          label={t('hero.plansOnTrack')}
          value={format.number(0.94, { style: 'percent' })}
          chart={<Sparkline />}
        />
        <StatCard
          label={t('hero.careTeamsSynced')}
          value={format.number(128)}
          chart={<RadialProgress percent={82} />}
        />
        <StatCard
          label={t('hero.tasksDoneThisWeek')}
          value={format.number(1204)}
          chart={<MiniBars />}
        />
      </div>
    </div>
  );
}
