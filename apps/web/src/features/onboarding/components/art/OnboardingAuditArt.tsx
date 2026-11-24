import { useLocale, useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { CARD, GOLD_ICON, GOLD_SOFT, GOLD_STROKE, SUB, sampleDate } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';
import OnboardingSparkle from './OnboardingSparkle';

type Row = {
  hour: number;
  minute: number;
  who: string;
  avatar?: string;
  action: 'role' | 'sso' | 'created' | 'label' | 'tried' | 'requireSso';
  where: string;
  denied?: boolean;
};

// The latest entries of an audit log: people and an agent changing things, a sign-in and an
// action refused for want of rights.
export default function OnboardingAuditArt() {
  const t = useTranslations('onboarding.art.audit');
  const tSlides = useTranslations('onboarding.slides');
  const tWorkflows = useTranslations('onboarding.art.workflows');
  const time = new Intl.DateTimeFormat(useLocale(), { hour: 'numeric', minute: '2-digit' });
  const rows: Row[] = [
    { hour: 9, minute: 42, who: 'Anna', avatar: '#F6B9A0', action: 'role', where: 'Core' },
    { hour: 9, minute: 31, who: 'Ivan', avatar: '#A7C4F7', action: 'sso', where: t('workspace') },
    { hour: 9, minute: 18, who: tWorkflows('writer'), action: 'created', where: 'Website' },
    { hour: 8, minute: 57, who: 'Bob', avatar: '#C3B5F2', action: 'label', where: 'Website' },
    {
      hour: 8,
      minute: 40,
      who: 'Lena',
      avatar: '#9ED9C9',
      action: 'tried',
      where: 'Billing',
      denied: true,
    },
    {
      hour: 8,
      minute: 12,
      who: 'Anna',
      avatar: '#F6B9A0',
      action: 'requireSso',
      where: t('workspace'),
    },
  ];
  const columns = [
    { x: 44, width: 52, label: t('time') },
    { x: 100, width: 90, label: t('who') },
    { x: 196, width: 260, label: t('action') },
    { x: 470, width: 90, label: t('where') },
  ];

  return (
    <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
      <rect x="28" y="18" width="544" height="244" rx="16" className={CARD} />
      <rect x="44" y="32" width="28" height="28" rx="8" className={GOLD_SOFT} />
      <ShieldCheck x={50} y={38} width={16} height={16} className={GOLD_ICON} />
      <OnboardingArtText x={82} y={51} width={300} size={13} weight={600}>
        {tSlides('audit.name')}
      </OnboardingArtText>
      <rect x="478" y="32" width="78" height="24" rx="8" className="fill-card stroke-border" />
      <OnboardingArtText x={488} y={48} width={62} size={10} weight={600}>
        {t('export')}
      </OnboardingArtText>
      {columns.map((column) => (
        <OnboardingArtText
          key={column.x}
          x={column.x}
          y={84}
          width={column.width}
          size={9}
          weight={600}
          className={SUB}
        >
          {column.label}
        </OnboardingArtText>
      ))}
      <path d="M28 92 H572" className="stroke-border" />
      {rows.map((row, i) => {
        const cy = 106 + i * 26;
        return (
          <g key={i}>
            {i > 0 && <path d={`M28 ${cy - 13} H572`} className="stroke-muted" />}
            <text x="44" y={cy + 3.5} fontSize="10" className={SUB}>
              {time.format(sampleDate(12, row.hour, row.minute))}
            </text>
            {row.avatar ? (
              <circle cx="106" cy={cy} r="7" fill={row.avatar} />
            ) : (
              <rect
                x="100"
                y={cy - 6}
                width="12"
                height="12"
                rx="3.5"
                fill="none"
                strokeWidth="2"
                className={GOLD_STROKE}
              />
            )}
            <OnboardingArtText x={118} y={cy + 3.5} width={72} size={10} weight={400}>
              {row.who}
            </OnboardingArtText>
            <OnboardingArtText
              x={196}
              y={cy + 3.5}
              width={row.denied ? 198 : 266}
              size={10.5}
              weight={400}
            >
              {t(`actions.${row.action}`)}
            </OnboardingArtText>
            {row.denied && (
              <g>
                <rect
                  x="400"
                  y={cy - 8}
                  width="58"
                  height="16"
                  rx="8"
                  className="fill-destructive/12"
                />
                <OnboardingArtText
                  x={408}
                  y={cy + 3.5}
                  width={46}
                  size={9}
                  weight={600}
                  className="fill-destructive"
                >
                  {t('denied')}
                </OnboardingArtText>
              </g>
            )}
            <OnboardingArtText
              x={470}
              y={cy + 3.5}
              width={92}
              size={10}
              weight={400}
              className={SUB}
            >
              {row.where}
            </OnboardingArtText>
          </g>
        );
      })}
      <OnboardingSparkle x={14} y={30} size={7} color="#E9A52A" />
      <OnboardingSparkle x={586} y={254} size={6} color="#E9A52A" />
    </svg>
  );
}
