import { useTranslations } from 'next-intl';
import { BarChart3, Bot, Grid3x3, Hash, PieChart, TrendingUp } from 'lucide-react';
import { CARD } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';
import OnboardingCursor from './OnboardingCursor';

const TEAL = '#2A9D8F';
const PICKED = 2;

// The "Add widget" menu of a dashboard, the pointer on one of its widgets.
export default function OnboardingWidgetPicker() {
  const t = useTranslations('dashboards');
  const widgets = [
    { Icon: Hash, label: t('widgets.stat.label') },
    { Icon: PieChart, label: t('widgets.breakdown.label') },
    { Icon: TrendingUp, label: t('widgets.burnup.label') },
    { Icon: BarChart3, label: t('widgets.throughput.label') },
    { Icon: Grid3x3, label: t('widgets.pulse.label') },
    { Icon: Bot, label: t('widgets.agent_runs.label') },
  ];

  return (
    <g>
      <rect x="372" y="70" width="188" height="188" rx="12" className={CARD} />
      <OnboardingArtText x={388} y={92} width={160} size={11} weight={600}>
        {t('addWidget')}
      </OnboardingArtText>
      <path d="M372 102 H560" className="stroke-muted" />
      <rect
        x="378"
        y={108 + PICKED * 24}
        width="176"
        height="22"
        rx="6"
        fill={TEAL}
        fillOpacity=".14"
      />
      {widgets.map(({ Icon, label }, i) => (
        <g key={i}>
          <rect
            x="386"
            y={111 + i * 24}
            width="16"
            height="16"
            rx="4"
            fill={TEAL}
            fillOpacity=".18"
          />
          <Icon
            x={388}
            y={113 + i * 24}
            width={12}
            height={12}
            className="text-[#1F7A6F] dark:text-[#4FC2B3]"
          />
          <OnboardingArtText
            x={410}
            y={123 + i * 24}
            width={140}
            size={10.5}
            weight={i === PICKED ? 600 : 500}
          >
            {label}
          </OnboardingArtText>
        </g>
      ))}
      <OnboardingCursor x={492} y={166} />
    </g>
  );
}
