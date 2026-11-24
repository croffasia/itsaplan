import { useLocale, useTranslations } from 'next-intl';
import { CARD, GOLD, GOLD_SOFT, GOLD_STROKE, GOLD_TEXT, INK, SOFT, SUB } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';
import OnboardingSparkle from './OnboardingSparkle';

// The point the gauge reaches at 82%: an arc of radius 46 from the left end of the half circle.
const GAUGE_END = {
  x: 498 + 46 * Math.cos(Math.PI * 0.18),
  y: 140 - 46 * Math.sin(Math.PI * 0.18),
};

// Budgets on what agents spend, one of them nearly spent, and a run it refused.
export default function OnboardingBudgetsArt() {
  const t = useTranslations('onboarding.art.budgets');
  const tSlides = useTranslations('onboarding.slides');
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
  const percent = new Intl.NumberFormat(locale, { style: 'percent' });
  const budgets = [
    { kind: t('workspace'), period: t('perMonth'), spent: 412, limit: 500, bar: GOLD },
    { kind: t('team', { name: 'Core' }), period: t('perWeek'), spent: 96, limit: 200, bar: GOLD },
    { kind: t('person'), period: t('perDay'), spent: 23, limit: 25, bar: 'fill-[#F97316]' },
  ];

  return (
    <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
      <rect x="36" y="22" width="372" height="236" rx="16" className={CARD} />
      <OnboardingArtText x={56} y={50} width={236} size={13} weight={600}>
        {tSlides('budgets.name')}
      </OnboardingArtText>
      <rect x="306" y="34" width="86" height="24" rx="8" className={GOLD_SOFT} />
      <OnboardingArtText x={315} y={50} width={72} size={10} weight={600} className={GOLD_TEXT}>
        {t('newBudget')}
      </OnboardingArtText>
      {budgets.map((budget, i) => {
        const y = 70 + i * 60;
        return (
          <g key={i}>
            <OnboardingArtText x={56} y={y + 16} width={240} size={11} weight={600}>
              {budget.kind}
            </OnboardingArtText>
            <text x="392" y={y + 16} textAnchor="end" fontSize="9.5" className={SUB}>
              {budget.period}
            </text>
            <OnboardingArtText x={56} y={y + 32} width={240} size={10} weight={400} className={SUB}>
              {t('spentOf', {
                spent: money.format(budget.spent),
                limit: money.format(budget.limit),
              })}
            </OnboardingArtText>
            <rect x="56" y={y + 40} width="336" height="8" rx="4" className={SOFT} />
            <rect
              x="56"
              y={y + 40}
              width={(336 * budget.spent) / budget.limit}
              height="8"
              rx="4"
              className={budget.bar}
            />
          </g>
        );
      })}

      <rect x="428" y="40" width="140" height="128" rx="14" className={CARD} />
      <OnboardingArtText x={442} y={60} width={116} size={10} weight={600} className={SUB}>
        {t('thisMonth')}
      </OnboardingArtText>
      <path
        d="M452 140 A46 46 0 0 1 544 140"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
        className="stroke-muted"
      />
      <path
        d={`M452 140 A46 46 0 0 1 ${GAUGE_END.x} ${GAUGE_END.y}`}
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
        className={GOLD_STROKE}
      />
      <text x="498" y="136" textAnchor="middle" fontSize="18" fontWeight="700" className={INK}>
        {percent.format(0.82)}
      </text>
      <text x="498" y="156" textAnchor="middle" fontSize="9" className={SUB}>
        {t('ofLimit', { limit: money.format(500) })}
      </text>

      <rect x="428" y="184" width="140" height="56" rx="12" className={CARD} />
      <circle cx="447" cy="212" r="10" className="fill-destructive/12" />
      <rect x="443" y="208" width="8" height="8" rx="2" className="fill-destructive" />
      <OnboardingArtText x={464} y={208} width={98} size={10} weight={600}>
        {t('refused')}
      </OnboardingArtText>
      <OnboardingArtText x={464} y={222} width={98} size={9} weight={400} className={SUB}>
        {t('spent')}
      </OnboardingArtText>
      <OnboardingSparkle x={574} y={26} size={8} color="#E9A52A" />
      <OnboardingSparkle x={22} y={250} size={6} color="#E9A52A" />
    </svg>
  );
}
