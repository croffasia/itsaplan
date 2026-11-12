import { useTranslations } from 'next-intl';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CARD, GOLD, GOLD_ICON, GOLD_SOFT, GOLD_STROKE, SOFT, SUB } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';

const EVENTS = ['created', 'assigned', 'labelAdded', 'commentAdded'] as const;
const PICKED = 'labelAdded';

// Pro's schedule on an issue event: the event, the filter on the issues it counts and how
// often it may run.
export default function OnboardingEventSchedule() {
  const t = useTranslations('onboarding.art.schedules');
  const filters = [
    { x: 298, y: 166, width: 100, label: t('typeBug') },
    { x: 404, y: 166, width: 158, label: t('priorityHigh') },
    { x: 298, y: 186, width: 180, label: t('createdByAnyone') },
    { x: 298, y: 226, width: 110, label: t('perDay', { count: 5 }) },
    { x: 414, y: 226, width: 148, label: t('atOnce', { count: 2 }) },
  ];

  return (
    <g>
      <rect
        x="284"
        y="20"
        width="292"
        height="238"
        rx="14"
        strokeWidth="1.5"
        className={cn(CARD, GOLD_STROKE)}
      />
      <rect x="298" y="34" width="30" height="30" rx="9" className={GOLD_SOFT} />
      <Zap x={305} y={41} width={16} height={16} className={GOLD_ICON} />
      <OnboardingArtText x={338} y={47} width={210} size={12} weight={600}>
        {t('triageBugs')}
      </OnboardingArtText>
      <rect x="338" y="53" width="36" height="15" rx="7.5" className={GOLD} />
      <text
        x="356"
        y="63.5"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        letterSpacing="1"
        fill="#171717"
      >
        PRO
      </text>
      <OnboardingArtText x={298} y={80} width={260} size={9} weight={600} className={SUB}>
        {t('when')}
      </OnboardingArtText>
      {EVENTS.map((event, i) => {
        const y = 92 + i * 16;
        const picked = event === PICKED;
        return (
          <g key={event}>
            <circle
              cx="304"
              cy={y - 3.5}
              r="4.5"
              fill="none"
              strokeWidth={picked ? 1.5 : 1.3}
              className={picked ? GOLD_STROKE : 'stroke-muted-foreground'}
            />
            {picked && <circle cx="304" cy={y - 3.5} r="2.2" className={GOLD} />}
            <OnboardingArtText x={314} y={y} width={150} size={10} weight={picked ? 600 : 400}>
              {t(`events.${event}`)}
            </OnboardingArtText>
            {picked && (
              <g>
                <rect
                  x="470"
                  y={y - 11}
                  width="48"
                  height="15"
                  rx="7.5"
                  fill="#EF4444"
                  fillOpacity=".14"
                />
                <circle cx="479" cy={y - 3.5} r="2.5" fill="#EF4444" />
                <OnboardingArtText
                  x={485}
                  y={y}
                  width={30}
                  size={9}
                  weight={600}
                  className="fill-[#EF4444]"
                >
                  {t('bugLabel')}
                </OnboardingArtText>
              </g>
            )}
          </g>
        );
      })}
      <OnboardingArtText x={298} y={160} width={260} size={9} weight={600} className={SUB}>
        {t('onlyFor')}
      </OnboardingArtText>
      <OnboardingArtText x={298} y={220} width={260} size={9} weight={600} className={SUB}>
        {t('howOften')}
      </OnboardingArtText>
      {filters.map((filter) => (
        <g key={`${filter.x}-${filter.y}`}>
          <rect
            x={filter.x}
            y={filter.y}
            width={filter.width}
            height="16"
            rx="8"
            className={SOFT}
          />
          <OnboardingArtText
            x={filter.x + 8}
            y={filter.y + 11.5}
            width={filter.width - 14}
            size={9}
            weight={400}
          >
            {filter.label}
          </OnboardingArtText>
        </g>
      ))}
    </g>
  );
}
